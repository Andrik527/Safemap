<?php

namespace Tests\Feature;

use App\Models\Incident;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Verificación de la votación comunitaria ponderada por reputación (Ideas 5 y 7)
 * y de la analítica (Ideas 3 y 6). Corre sobre SQLite en memoria.
 */
class IncidentVotingTest extends TestCase
{
    use RefreshDatabase;

    private function user(int $points = 0, int $daysOld = 0): User
    {
        $user = User::factory()->create();

        $attributes = ['reputation_points' => $points];
        if ($daysOld > 0) {
            $attributes['created_at'] = now()->subDays($daysOld);
        }

        $user->forceFill($attributes)->save();

        return $user->refresh();
    }

    private function incident(User $author, array $overrides = []): Incident
    {
        return Incident::create(array_merge([
            'user_id'     => $author->id,
            'type'        => 'pothole',
            'title'       => 'Bache en la calle',
            'description' => 'Bache profundo frente al parque',
            'lat'         => 19.5438,
            'lng'         => -96.9238,
            'status'      => 'active',
            'expires_at'  => now()->addHours(3),
        ], $overrides));
    }

    public function test_reporte_de_usuario_nuevo_necesita_mas_respaldo(): void
    {
        // Autor nuevo → umbral base (2) + 1 = 3
        $author = $this->user(0, 0);
        $incident = $this->incident($author);

        $this->assertEquals(3.0, app(\App\Services\ReputationService::class)->requiredConfirmationsFor($incident));
    }

    public function test_un_solo_vecino_veterano_puede_verificar_pero_uno_nuevo_no(): void
    {
        config(['safemap.new_account_days' => 0]); // aísla el peso por puntos

        $author = $this->user(60, 60);             // autor consolidado → umbral base 2
        $incident = $this->incident($author);

        // Voto de un vecino nuevo (peso 0.5): no alcanza el umbral 2
        $rookie = $this->user(0, 60);
        $this->actingAs($rookie)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'still_there', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertOk();

        $incident->refresh();
        $this->assertNull($incident->verified_at, 'Un vecino nuevo no debería verificar solo.');
        $this->assertEquals(0.5, (float) $incident->weighted_confirmations);

        // Voto de un vecino veterano (peso 2.0): ahora sí verifica
        $veteran = $this->user(250, 60);
        $this->actingAs($veteran)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'still_there', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertOk();

        $incident->refresh();
        $this->assertNotNull($incident->verified_at);
        $this->assertTrue((float) $incident->weighted_confirmations >= 2.0);
    }

    public function test_cuenta_recien_creada_nunca_pesa_como_veterana(): void
    {
        config(['safemap.new_account_days' => 14]);

        $freshVeteran = $this->user(250, 0); // muchos puntos pero cuenta nueva
        $this->assertEquals(0.5, app(\App\Services\ReputationService::class)->weightFor($freshVeteran));
    }

    public function test_no_se_puede_votar_dos_veces(): void
    {
        $author = $this->user(60, 60);
        $incident = $this->incident($author);
        $voter = $this->user(0, 60);

        $this->actingAs($voter)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'still_there', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertOk();

        $this->actingAs($voter)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'still_there', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertStatus(409);
    }

    public function test_el_autor_no_puede_confirmar_su_propio_reporte(): void
    {
        $author = $this->user(60, 60);
        $incident = $this->incident($author);

        $this->actingAs($author)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'still_there', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertStatus(422);
    }

    public function test_los_votos_negativos_ponderados_cierran_el_reporte(): void
    {
        config(['safemap.vote_radius_m' => 0, 'safemap.new_account_days' => 0]);

        $author = $this->user(0, 60);
        $incident = $this->incident($author);

        // Un veterano (peso 2.0) con "Ya no existe" supera el umbral 2
        $veteran = $this->user(250, 60);
        $this->actingAs($veteran)->postJson("/api/incidents/{$incident->id}/vote", [
            'vote' => 'gone', 'lat' => 19.5438, 'lng' => -96.9238,
        ])->assertOk()->assertJson(['resolved' => true]);

        $this->assertSame('resolved', $incident->refresh()->status->value);
    }

    public function test_el_panel_de_reputacion_responde_con_sesion(): void
    {
        $user = $this->user(30, 30);

        $this->actingAs($user)
            ->getJson('/api/me/reputation')
            ->assertOk()
            ->assertJsonStructure(['data' => ['points', 'level', 'badges']]);
    }

    public function test_los_endpoints_de_analitica_responden(): void
    {
        $this->getJson('/api/analytics/heatmap')
            ->assertOk()
            ->assertJsonStructure(['data' => ['points', 'max', 'total']]);

        $this->getJson('/api/analytics/risk-zones')
            ->assertOk()
            ->assertJsonStructure(['data' => ['season' => ['active', 'label'], 'zones']]);
    }
}
