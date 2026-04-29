<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class FollowUp extends Model
{
    protected $fillable = [
        'client_id',
        'outcome',
        'note',
        'next_follow_up_at',
        'channel',
    ];

    protected $casts = [
        'client_id' => 'integer',
        'next_follow_up_at' => 'date',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
