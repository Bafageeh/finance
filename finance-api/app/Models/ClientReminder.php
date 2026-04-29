<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ClientReminder extends Model
{
    protected $fillable = [
        'client_id',
        'key',
        'kind',
        'context',
        'target_date',
        'title',
        'external_id',
    ];

    protected $casts = [
        'client_id' => 'integer',
        'target_date' => 'date',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
