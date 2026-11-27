<?php

namespace App\Services;

use App\Enums\IncidentType;
use App\Models\Incident;
use Illuminate\Support\Carbon;

/**
 * Analítica básica sobre el histórico de incidentes de Xalapa.
 *
 * - heatmapPoints(): concentración histórica de reportes para el mapa de calor (Idea 6).
 * - floodRiskZones(): zonas predictivas de anegamiento cruzando la temporada actual
 *   con los puntos donde históricamente se reporta más encharcamiento (Idea 3).
 */
class AnalyticsService
{
    /** Caja geográfica de Xalapa: [minLng, minLat, maxLng, maxLat]. */
    private const BBOX = [-97.05, 19.47, -96.77, 19.63];

    public function heatmapPoints(): array
    {
        $decimals = (int) config('safemap.analytics.cluster_decimals', 3);

        $incidents = Incident::query()
            ->withinBounds(...self::BBOX)
            ->get(['lat', 'lng', 'created_at']);

        $buckets = [];
        foreach ($incidents as $incident) {
            $key = $this->key($incident->lat, $incident->lng, $decimals);

            $buckets[$key] ??= [
                'lat'   => round((float) $incident->lat, $decimals),
                'lng'   => round((float) $incident->lng, $decimals),
                'count' => 0,
                'weight' => 0.0,
            ];

            // Los reportes recientes pesan más: decaimiento con vida media ≈ 90 días.
            $ageDays = $incident->created_at ? (int) abs(now()->diffInDays($incident->created_at)) : 90;
            $buckets[$key]['weight'] += 1 / (1 + $ageDays / 90);
            $buckets[$key]['count']++;
        }

        $max = 0.0;
        foreach ($buckets as $bucket) {
            $max = max($max, $bucket['weight']);
        }

        $points = array_map(
            fn (array $b) => [$b['lat'], $b['lng'], $max > 0 ? round($b['weight'] / $max, 3) : 0.0, $b['count']],
            array_values($buckets)
        );

        return ['points' => $points, 'max' => round($max, 3), 'total' => $incidents->count()];
    }

    public function isRainySeason(?Carbon $date = null): bool
    {
        $date ??= now();

        return in_array((int) $date->month, config('safemap.analytics.rainy_season_months', []), true);
    }

    public function floodRiskZones(): array
    {
        $decimals   = (int) config('safemap.analytics.cluster_decimals', 3);
        $minReports = (int) config('safemap.analytics.flood_min_reports', 1);
        $radius     = (int) config('safemap.analytics.flood_zone_radius_m', 350);
        $rainy      = $this->isRainySeason();

        // Inundaciones + reportes "otros" descritos como anegamiento/encharcamiento.
        $historical = Incident::query()
            ->withinBounds(...self::BBOX)
            ->where(function ($query) {
                $query->where('type', IncidentType::Flood->value)
                    ->orWhere(fn ($q) => $q->where('type', IncidentType::Other->value)
                        ->where(fn ($q2) => $q2->where('description', 'like', '%aneg%')
                            ->orWhere('description', 'like', '%encharc%')));
            })
            ->get(['lat', 'lng', 'created_at']);

        $buckets = [];
        $monthly = [];
        foreach ($historical as $row) {
            $key = $this->key($row->lat, $row->lng, $decimals);

            $buckets[$key] ??= [
                'lat'   => round((float) $row->lat, $decimals),
                'lng'   => round((float) $row->lng, $decimals),
                'count' => 0,
            ];
            $buckets[$key]['count']++;

            $month = (int) $row->created_at->month;
            $monthly[$month] = ($monthly[$month] ?? 0) + 1;
        }

        $zones = [];
        foreach ($buckets as $bucket) {
            if ($bucket['count'] >= $minReports) {
                $zones[] = $this->zone($bucket['lat'], $bucket['lng'], $radius, $bucket['count'], $rainy);
            }
        }

        // Semilla de puntos históricamente problemáticos (útil mientras hay pocos datos reales).
        foreach (config('safemap.analytics.known_flood_zones', []) as $known) {
            $zones[] = $this->zone($known['lat'], $known['lng'], $radius, 0, $rainy, $known['name']);
        }

        return [
            'season' => [
                'active'          => $rainy,
                'month'           => (int) now()->month,
                'label'           => $rainy ? 'Temporada de lluvias' : 'Temporada seca',
                'monthly_profile' => $monthly,
            ],
            'zones' => $zones,
        ];
    }

    private function key(float $lat, float $lng, int $decimals): string
    {
        return round($lat, $decimals) . ',' . round($lng, $decimals);
    }

    private function zone(float $lat, float $lng, int $radius, int $reports, bool $rainy, ?string $name = null): array
    {
        $level = $rainy
            ? ($reports >= 3 ? 'alto' : 'medio')
            : ($reports >= 3 ? 'medio' : 'bajo');

        return [
            'name'    => $name ?? 'Punto con anegamientos históricos',
            'lat'     => $lat,
            'lng'     => $lng,
            'radius'  => $radius,
            'reports' => $reports,
            'risk'    => $level,
            'advice'  => $rainy
                ? 'Con lluvia este punto suele encharcarse: reduce la velocidad y evita el carril bajo.'
                : 'Antecedentes de anegamiento. Precaución si empieza a llover.',
        ];
    }
}
