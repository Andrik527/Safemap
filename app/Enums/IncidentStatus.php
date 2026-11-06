<?php

namespace App\Enums;

enum IncidentStatus: string
{
    case Active   = 'active';     // visible en el mapa
    case Resolved = 'resolved';   // la comunidad (o su autor) dijo "Ya no existe"
    case Expired  = 'expired';    // no recibió confirmaciones a tiempo / se venció
}
