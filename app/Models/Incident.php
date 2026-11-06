<?php

namespace App\Models;

use App\Enums\IncidentStatus;
use App\Enums\IncidentType;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Incident extends Model
{
    protected $fillable = [
        'user_id', 'type', 'title', 'description', 'photo_path', 'lat', 'lng',
        'status', 'resolved_at', 'confirmations_count', 'resolve_votes_count',
        'last_confirmed_at', 'verified_at', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'type'              => IncidentType::class,
            'status'            => IncidentStatus::class,
            'lat'               => 'float',
            'lng'               => 'float',
            'resolved_at'       => 'datetime',
            'last_confirmed_at' => 'datetime',
            'verified_at'       => 'datetime',
            'expires_at'        => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function votes(): HasMany
    {
        return $this->hasMany(IncidentVote::class);
    }

    /** Visible en el mapa: activo y todavía vigente (expires_at null = reporte antiguo). */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', IncidentStatus::Active->value)
                     ->where(fn (Builder $q) => $q->whereNull('expires_at')->orWhere('expires_at', '>', now()));
    }

    /** Filtra por caja geográfica: [minLng, minLat, maxLng, maxLat] */
    public function scopeWithinBounds(Builder $query, float $minLng, float $minLat, float $maxLng, float $maxLat): Builder
    {
        return $query->whereBetween('lat', [$minLat, $maxLat])
                     ->whereBetween('lng', [$minLng, $maxLng]);
    }

    public function isVerified(): bool
    {
        return $this->verified_at !== null;
    }

    /** Distancia en metros (fórmula de Haversine) entre este incidente y un punto. */
    public function distanceTo(float $lat, float $lng): float
    {
        $earthRadius = 6371000;
        $dLat = deg2rad($lat - $this->lat);
        $dLng = deg2rad($lng - $this->lng);

        $a = sin($dLat / 2) ** 2
           + cos(deg2rad($this->lat)) * cos(deg2rad($lat)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadius * asin(min(1, sqrt($a)));
    }
}
