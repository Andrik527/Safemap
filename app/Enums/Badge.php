<?php

namespace App\Enums;

enum Badge: string
{
    case FirstVerified     = 'first_verified';
    case ExemplaryCitizen  = 'exemplary_citizen';
    case CityGuardian      = 'city_guardian';
    case WatchfulNeighbor  = 'watchful_neighbor';

    public function label(): string
    {
        return match ($this) {
            self::FirstVerified    => 'Primer aporte',
            self::ExemplaryCitizen => 'Ciudadano Ejemplar',
            self::CityGuardian     => 'Guardián de Xalapa',
            self::WatchfulNeighbor => 'Vecino Vigilante',
        };
    }

    public function icon(): string
    {
        return match ($this) {
            self::FirstVerified    => '🌱',
            self::ExemplaryCitizen => '🏅',
            self::CityGuardian     => '🛡️',
            self::WatchfulNeighbor => '👁️',
        };
    }

    public function description(): string
    {
        return match ($this) {
            self::FirstVerified    => 'Tu primer reporte fue confirmado por otros ciudadanos.',
            self::ExemplaryCitizen => 'Racha de 3 reportes seguidos confirmados como verdaderos.',
            self::CityGuardian     => '10 reportes verificados por la comunidad.',
            self::WatchfulNeighbor => 'Validaste 10 reportes de otros ciudadanos.',
        };
    }
}
