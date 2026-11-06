<?php

namespace App\Services;

use App\Enums\IncidentStatus;
use App\Models\Incident;
use Illuminate\Support\Facades\Cache;

/**
 * Oculta los reportes que se vencieron sin recibir las confirmaciones necesarias.
 *
 * El mapa ya filtra por expires_at, así que un reporte vencido desaparece aunque este
 * barrido no corra. El barrido solo actualiza el estado a "expired" para dejar la BD limpia.
 */
class IncidentLifecycle
{
    public function sweepExpired(): int
    {
        return Incident::query()
            ->where('status', IncidentStatus::Active->value)
            ->whereNotNull('expires_at')
            ->where('expires_at', '<=', now())
            ->update(['status' => IncidentStatus::Expired->value]);
    }

    /** Barrido "perezoso": como mucho una vez por minuto, disparado por quien consulta el mapa. */
    public function throttledSweep(): void
    {
        if (Cache::add('incidents:sweep-lock', 1, 60)) {
            $this->sweepExpired();
        }
    }
}
