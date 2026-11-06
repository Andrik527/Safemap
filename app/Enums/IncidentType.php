<?php

namespace App\Enums;

enum IncidentType: string
{
    case Fire      = 'fire';
    case Landslide = 'landslide';
    case Flood     = 'flood';
    case Accident  = 'accident';
    case Pothole   = 'pothole';
    case Other     = 'other';

    public function label(): string
    {
        return match ($this) {
            self::Fire      => 'Incendio',
            self::Landslide => 'Deslave',
            self::Flood     => 'Inundación',
            self::Accident  => 'Accidente',
            self::Pothole   => 'Bache',
            self::Other     => 'Otro',
        };
    }

    public function color(): string
    {
        return match ($this) {
            self::Fire      => '#E84855',
            self::Landslide => '#F2A65A',
            self::Flood     => '#3BB6D8',
            self::Accident  => '#6B8F71',
            self::Pothole   => '#9C88FF',
            self::Other     => '#697A84',
        };
    }
}
