<?php

namespace App\Models\Concerns;

use App\Models\ReputationEvent;
use App\Models\UserBadge;
use Illuminate\Database\Eloquent\Relations\HasMany;

/**
 * Agrega esta línea a tu modelo App\Models\User:
 *
 *     use App\Models\Concerns\HasReputation;
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
