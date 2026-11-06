<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ReputationEvent extends Model
{
    protected $fillable = ['user_id', 'incident_id', 'points', 'reason'];
}
