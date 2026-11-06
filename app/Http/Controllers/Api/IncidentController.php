<?php

namespace App\Http\Controllers\Api;

use App\Enums\IncidentStatus;
use App\Enums\IncidentType;
use App\Http\Controllers\Controller;
use App\Http\Requests\StoreIncidentRequest;
use App\Http\Resources\IncidentResource;
use App\Models\Incident;
use App\Services\IncidentLifecycle;
use App\Services\IncidentPhotoStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class IncidentController extends Controller
{
    public function __construct(private IncidentLifecycle $lifecycle)
    {
    }

    /**
     * GET /api/incidents
     * Público. Solo reportes activos y vigentes (los vencidos se ocultan solos).
     * Opcional: ?bbox=minLng,minLat,maxLng,maxLat
     */
    public function index(Request $request)
    {
        $request->validate(['bbox' => ['nullable', 'string']]);

        $this->lifecycle->throttledSweep();

        $query = Incident::query()->active()->latest();

        // Si hay sesión, adjunta SOLO el voto de este usuario (para saber si ya votó)
        if (auth()->check()) {
            $query->with(['votes' => fn ($q) => $q->where('user_id', auth()->id())]);
        }

        if ($request->filled('bbox')) {
            $parts = array_map('floatval', explode(',', $request->string('bbox')));
            if (count($parts) === 4) {
                $query->withinBounds(...$parts);
            }
        }

        return IncidentResource::collection($query->limit(500)->get());
    }

    /**
     * POST /api/incidents   (multipart/form-data, con foto opcional)
     * El reporte nace activo pero SIN verificar: tiene una ventana de tiempo
     * para recibir las confirmaciones de otros ciudadanos o se oculta.
     */
    public function store(StoreIncidentRequest $request, IncidentPhotoStorage $photos): JsonResponse
    {
        $data = $request->validated();
        $type = IncidentType::from($data['type']);

        $photoPath = $request->hasFile('photo')
            ? $photos->store($request->file('photo'))
            : null;

        $incident = Incident::create([
            'user_id'     => auth()->id(),
            'type'        => $type,
            'title'       => trim(strip_tags($data['title'] ?? '')) ?: $type->label() . ' reportado',
            'description' => strip_tags($data['description']),
            'photo_path'  => $photoPath,
            'lat'         => $data['lat'],
            'lng'         => $data['lng'],
            'status'      => IncidentStatus::Active->value,
            'expires_at'  => now()->addMinutes((int) config('safemap.unverified_ttl_minutes')),
        ]);

        return (new IncidentResource($incident))
            ->response()
            ->setStatusCode(201);
    }
}
