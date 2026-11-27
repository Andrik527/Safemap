<?php

namespace App\Traits;

use App\Models\ReputationEvent;
use App\Models\UserBadge;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Relaciones de gamificación del usuario. Ya está aplicado en App\Models\User:
 *
 *     use App\Traits\HasReputation;
 *     class User extends Authenticatable { use HasReputation; ... }
 */
trait HasReputation
{
    public function badges(): HasMany
    {
        return $this->hasMany(UserBadge::class);
    }

    public function reputationEvents(): HasMany
    {
        return $this->hasMany(ReputationEvent::class);
    }
}
