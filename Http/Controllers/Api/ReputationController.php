<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\ReputationService;
use Illuminate\Http\JsonResponse;

class ReputationController extends Controller
{
    /** GET /api/me/reputation  (requiere sesión) */
    public function show(ReputationService $reputation): JsonResponse
    {
        return response()->json(['data' => $reputation->summary(auth()->user())]);
    }
}
