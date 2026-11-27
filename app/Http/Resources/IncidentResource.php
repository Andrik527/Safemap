<?php

namespace App\Http\Resources;

use App\Services\ReputationService;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Facades\Storage;

/** @mixin \App\Models\Incident */
class IncidentResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $reputation = app(ReputationService::class);

        // Umbral de confirmaciones ajustado por la confianza del autor (Idea 5).
        $required            = $reputation->requiredConfirmationsFor($this->resource);
        $weightedConfirms    = (float) $this->weighted_confirmations;
        $trust               = $reputation->trustFor($this->user);   // relación precargada

        $disk     = config('safemap.photo_disk');

        $photoUrl = null;
        if ($this->photo_path) {
            // Disco local: ruta relativa (evita problemas http/https detrás del proxy de Render)
            $photoUrl = $disk === 'public'
                ? '/storage/' . $this->photo_path
                : Storage::disk($disk)->url($this->photo_path);
        }

        return [
            'id'         => $this->id,
            'type'       => $this->type->value,
            'label'      => $this->type->label(),
            'color'      => $this->type->color(),
            'title'      => $this->title,
            'desc'       => $this->description,
            'photo_url'  => $photoUrl,
            'lat'        => $this->lat,
            'lng'        => $this->lng,
            'time'       => $this->created_at->locale('es')->diffForHumans(short: true),
            'created_at' => $this->created_at->toIso8601String(),

            // Validación comunitaria
            'status'        => $this->status->value,
            'confirmations' => $this->confirmations_count,
            'resolve_votes' => $this->resolve_votes_count,
            'verified'      => $this->verified_at !== null,
            'confirmations_needed' => $this->verified_at ? 0 : max(0, (int) ceil($required - $weightedConfirms)),
            'expires_at'    => $this->expires_at?->toIso8601String(),
            'my_vote'       => $this->relationLoaded('votes') ? $this->votes->first()?->vote->value : null,
            'mine'          => auth()->check() && auth()->id() === $this->user_id,

            // Verificación cruzada por reputación (Idea 5) y clasificación (Ideas 6-7)
            'weighted_confirmations' => round($weightedConfirms, 2),
            'weighted_resolve_votes' => round((float) $this->weighted_resolve_votes, 2),
            'reporter_trust'         => ['weight' => $trust['weight'], 'label' => $trust['label']],
            'high_impact'            => $this->resource->isHighImpact(),
            // No se expone user_id ni datos del autor
        ];
    }
}
