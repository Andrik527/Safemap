<?php

namespace App\Models;

use App\Enums\VoteType;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class IncidentVote extends Model
{
    protected $fillable = ['incident_id', 'user_id', 'vote', 'lat', 'lng', 'distance_m'];

    protected function casts(): array
    {
        return [
            'vote' => VoteType::class,
            'lat'  => 'float',
            'lng'  => 'float',
        ];
    }

    public function incident(): BelongsTo
    {
        return $this->belongsTo(Incident::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
