<?php

namespace App\Enums;

enum VoteType: string
{
    case StillThere = 'still_there';   // "Sigue aquí"
    case Gone       = 'gone';          // "Ya no existe"
}
