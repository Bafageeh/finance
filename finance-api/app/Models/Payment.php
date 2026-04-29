<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'client_id', 'period_key', 'month_number',
        'due_date', 'installment_amount',
        'paid_amount', 'bank_note', 'paid_date', 'is_paid',
    ];

    protected $casts = [
        'due_date'           => 'date',
        'paid_date'          => 'date',
        'installment_amount' => 'float',
        'paid_amount'        => 'float',
        'is_paid'            => 'boolean',
    ];

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
