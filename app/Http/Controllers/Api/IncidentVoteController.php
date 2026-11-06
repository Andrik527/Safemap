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
     *  - Se necesitan N confirmaciones de usuarios distintos (config: confirmations_required)
     *    para que el reporte quede "verificado" y viva más tiempo.
     *  - Si no las consigue en su ventana de tiempo, se oculta solo (expires_at).
     *  - Si los "Ya no existe" alcanzan el mínimo y superan a los "Sigue aquí", se marca resuelto.
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

        $required       = (int) config('safemap.confirmations_required');
        $threshold      = (int) config('safemap.resolve_votes_threshold');
        $verifiedTtl    = (int) config('safemap.verified_ttl_minutes');
        $becameVerified = false;
        $rejected       = false;

        try {
            DB::transaction(function () use (
                $incident, $user, $vote, $lat, $lng, $distance, $isAuthor,
                $required, $threshold, $verifiedTtl, &$becameVerified, &$rejected
            ) {
                // Relee y bloquea la fila: dos confirmaciones simultáneas no se pisan
                $fresh = Incident::whereKey($incident->id)->lockForUpdate()->first();
                $incident->forceFill($fresh->getAttributes())->syncOriginal();

                $incident->votes()->create([
                    'user_id'    => $user->id,
                    'vote'       => $vote->value,
                    'lat'        => $lat,
                    'lng'        => $lng,
                    'distance_m' => $distance,
                ]);

                if ($vote === VoteType::StillThere) {
                    $incident->increment('confirmations_count', 1, ['last_confirmed_at' => now()]);

                    if (! $incident->verified_at && $incident->confirmations_count >= $required) {
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

                $communityClosed = $incident->resolve_votes_count >= $threshold
                                && $incident->resolve_votes_count > $incident->confirmations_count;

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

        // Reputación (fuera de la transacción: cada movimiento es idempotente)
        if ($becameVerified) {
            $reputation->onReportVerified($incident);
        }
        if ($rejected) {
            $reputation->onReportRejected($incident);
        }
        $reputation->onVoteCast($user, $incident);

        $incident->load(['votes' => fn ($q) => $q->where('user_id', $user->id)]);
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
