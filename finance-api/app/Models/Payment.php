<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Payment extends Model
{
    protected $fillable = [
        'account_id', 'client_id', 'period_key', 'month_number',
        'due_date', 'installment_amount',
        'paid_amount', 'bank_note', 'paid_date', 'is_paid',
    ];

    protected $casts = [
        'account_id'          => 'integer',
        'due_date'           => 'date',
        'paid_date'          => 'date',
        'installment_amount' => 'float',
        'paid_amount'        => 'float',
        'is_paid'            => 'boolean',
    ];

    protected static function booted(): void
    {
        static::addGlobalScope('account', function (Builder $builder) {
            $accountId = request()?->user()?->account_id;
            if ($accountId) {
                $builder->where($builder->getModel()->getTable() . '.account_id', $accountId);
            }
        });

        static::creating(function (Payment $payment) {
            if (! $payment->account_id) {
                $payment->account_id = request()?->user()?->account_id;
            }
        });
    }

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function client(): BelongsTo
    {
        return $this->belongsTo(Client::class);
    }
}
