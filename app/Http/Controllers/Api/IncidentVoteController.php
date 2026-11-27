<?php

namespace App\Http\Controllers\Api;

use App\Enums\IncidentStatus;
use App\Enums\VoteType;
use App\Http\Controllers\Controller;
use App\Http\Requests\VoteIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Services\ReputationService;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class IncidentVoteController extends Controller
{
    /**
     * POST /api/incidents/{incident}/vote
     * Body: vote (still_there|gone), lat, lng  → posición actual del usuario.
     *
     * Reglas:
     *  - Cada voto tiene un PESO según la reputación del votante (Idea 5): un vecino
     *    nuevo pesa menos que un usuario veterano. El umbral se compara contra la suma
     *    de pesos, no contra el número de votos.
     *  - El umbral exigido se ajusta según la confianza del AUTOR (reporte de un
     *    usuario nuevo necesita más respaldo).
     *  - Si no consigue las confirmaciones en su ventana de tiempo, se oculta (expires_at).
     *  - Si los "Ya no existe" (ponderados) alcanzan el mínimo y superan a los "Sigue aquí",
     *    se marca resuelto.
     *  - El autor puede cerrar su propio reporte, pero no confirmarlo.
     */
    public function store(VoteIncidentRequest $request, Incident $incident, ReputationService $reputation): JsonResponse
    {
        $user = $request->user();
        $vote = VoteType::from($request->validated('vote'));
        $lat  = (float) $request->validated('lat');
        $lng  = (float) $request->validated('lng');

        $stillActive = $incident->status === IncidentStatus::Active
            && ($incident->expires_at === null || $incident->expires_at->isFuture());

        if (! $stillActive) {
            return response()->json(['message' => 'Este reporte ya no está activo.'], 409);
        }

        $isAuthor = $incident->user_id === $user->id;

        if ($isAuthor && $vote === VoteType::StillThere) {
            return response()->json(['message' => 'No puedes confirmar tu propio reporte.'], 422);
        }

        if ($incident->votes()->where('user_id', $user->id)->exists()) {
            return response()->json(['message' => 'Ya votaste en este reporte.'], 409);
        }

        // Validación por proximidad (calculada en el servidor)
        $distance = (int) round($incident->distanceTo($lat, $lng));
        $radius   = (int) config('safemap.vote_radius_m');

        if ($radius > 0 && $distance > $radius) {
            return response()->json([
                'message' => sprintf(
                    'Estás a %s de este incidente. Acércate a menos de %d m para validarlo.',
                    $distance >= 1000 ? number_format($distance / 1000, 1) . ' km' : $distance . ' m',
                    $radius
                ),
            ], 403);
        }

        // Peso del voto (Idea 5) y umbral ajustado por la confianza del autor.
        $weight      = $reputation->weightFor($user);
        $required    = $reputation->requiredConfirmationsFor($incident);
        $threshold   = (float) config('safemap.resolve_votes_threshold');
        $verifiedTtl = (int) config('safemap.verified_ttl_minutes');
        $becameVerified = false;
        $rejected       = false;
        $conflict       = false;

        try {
            DB::transaction(function () use (
                $incident, $user, $vote, $lat, $lng, $distance, $weight, $isAuthor,
                $required, $threshold, $verifiedTtl, &$becameVerified, &$rejected, &$conflict
            ) {
                // Relee y bloquea la fila: dos confirmaciones simultáneas no se pisan
                $fresh = Incident::whereKey($incident->id)->lockForUpdate()->first();

                // Pudo cerrarse/se vencerse entre la validación previa y el bloqueo
                $active = $fresh->status === IncidentStatus::Active
                    && ($fresh->expires_at === null || $fresh->expires_at->isFuture());

                if (! $active) {
                    $conflict = true;

                    return;
                }

                $incident->forceFill($fresh->getAttributes())->syncOriginal();

                $incident->votes()->create([
                    'user_id'    => $user->id,
                    'vote'       => $vote->value,
                    'weight'     => $weight,
                    'lat'        => $lat,
                    'lng'        => $lng,
                    'distance_m' => $distance,
                ]);

                if ($vote === VoteType::StillThere) {
                    $incident->increment('confirmations_count', 1, ['last_confirmed_at' => now()]);
                    $incident->increment('weighted_confirmations', $weight);

                    if (! $incident->verified_at && $incident->weighted_confirmations >= $required) {
                        $incident->verified_at = now();
                        $becameVerified = true;
                    }

                    // Cada confirmación renueva la vida de un reporte ya verificado
                    if ($incident->verified_at) {
                        $incident->expires_at = now()->addMinutes($verifiedTtl);
                    }
                    $incident->save();

                    return;
                }

                // Voto "Ya no existe"
                $incident->increment('resolve_votes_count');
                $incident->increment('weighted_resolve_votes', $weight);

                $communityClosed = $incident->weighted_resolve_votes >= $threshold
                                && $incident->weighted_resolve_votes > $incident->weighted_confirmations;

                if ($isAuthor || $communityClosed) {
                    $incident->update([
                        'status'      => IncidentStatus::Resolved->value,
                        'resolved_at' => now(),
                    ]);

                    // Cerrado por la comunidad SIN haber sido verificado = posible reporte falso
                    $rejected = ! $isAuthor && ! $incident->verified_at;
                }
            });
        } catch (UniqueConstraintViolationException) {
            return response()->json(['message' => 'Ya votaste en este reporte.'], 409);
        }

        if ($conflict) {
            return response()->json(['message' => 'Este reporte ya no está activo.'], 409);
        }

        // Reputación (fuera de la transacción: cada movimiento es idempotente)
        if ($becameVerified) {
            $reputation->onReportVerified($incident);
        }
        if ($rejected) {
            $reputation->onReportRejected($incident);
        }
        $reputation->onVoteCast($user, $incident);

        $incident->load(['user', 'votes' => fn ($q) => $q->where('user_id', $user->id)]);
        $resolved = $incident->status === IncidentStatus::Resolved;

        $message = match (true) {
            $resolved                          => 'Reporte marcado como resuelto. ¡Gracias!',
            $becameVerified                    => '¡Reporte verificado por la comunidad! Gracias por confirmar.',
            $vote === VoteType::StillThere     => 'Gracias, confirmaste que sigue aquí.',
            default                            => 'Gracias, registramos tu voto.',
        };

        return (new IncidentResource($incident))
            ->additional(['resolved' => $resolved, 'verified_now' => $becameVerified, 'message' => $message])
            ->response();
    }
}
