<?php

namespace App\Console\Commands;

use App\Services\IncidentLifecycle;
use Illuminate\Console\Command;

class SweepIncidents extends Command
{
    protected $signature = 'incidents:sweep';
    protected $description = 'Marca como expirados los reportes que no recibieron confirmaciones a tiempo';

    public function handle(IncidentLifecycle $lifecycle): int
    {
        $this->info('Reportes expirados: ' . $lifecycle->sweepExpired());

        return self::SUCCESS;
    }
}
