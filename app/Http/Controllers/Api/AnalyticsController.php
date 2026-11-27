<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\AnalyticsService;
use Illuminate\Http\JsonResponse;

class AnalyticsController extends Controller
{
    /** GET /api/analytics/heatmap — concentración histórica de incidentes (Idea 6). */
    public function heatmap(AnalyticsService $analytics): JsonResponse
    {
        return response()->json(['data' => $analytics->heatmapPoints()]);
    }

    /** GET /api/analytics/risk-zones — zonas predictivas de anegamiento (Idea 3). */
    public function riskZones(AnalyticsService $analytics): JsonResponse
    {
        return response()->json(['data' => $analytics->floodRiskZones()]);
    }
}
