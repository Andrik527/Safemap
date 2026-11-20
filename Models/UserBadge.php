<?php

namespace App\Models;

use App\Enums\Badge;
use Illuminate\Database\Eloquent\Model;

class UserBadge extends Model
{
    protected $fillable = ['user_id', 'badge', 'awarded_at', 'notified_at'];

    protected function casts(): array
    {
        return [
            'badge'       => Badge::class,
            'awarded_at'  => 'datetime',
            'notified_at' => 'datetime',
        ];
    }
}
