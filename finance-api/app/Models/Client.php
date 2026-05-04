<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Client extends Model
{
    protected $fillable = [
        'account_id', 'user_id',
        'name', 'id_number', 'phone', 'asset',
        'contract_date', 'first_installment_date', 'cost', 'principal', 'rate',
        'months', 'bond_cost', 'bond_total', 'profit_share',
        'status', 'has_court', 'court_note', 'notes',
    ];

    protected $casts = [
        'account_id' => 'integer',
        'user_id' => 'integer',
        'contract_date' => 'date',
        'first_installment_date' => 'date',
        'cost'          => 'float',
        'principal'     => 'float',
        'rate'          => 'float',
        'months'        => 'integer',
        'bond_cost'     => 'float',
        'bond_total'    => 'float',
        'has_court'     => 'boolean',
    ];

    public function account(): BelongsTo
    {
        return $this->belongsTo(Account::class);
    }

    public function payments(): HasMany
    {
        return $this->hasMany(Payment::class)->orderBy('month_number');
    }

    // ────────────────────────────────────────────────
    // Finance calculation helpers
    // ────────────────────────────────────────────────

    private function money(float|int|null $value): float
    {
        return round((float) ($value ?? 0), 2);
    }

    private function safeMonths(): int
    {
        return max(1, (int) ($this->months ?: 1));
    }

    public function getBondCostValue(): float
    {
        return $this->money($this->bond_cost ?? 74.75);
    }

    public function getCalculatedBondTotal(): float
    {
        if ($this->bond_total !== null && (float) $this->bond_total > 0) {
            return $this->money($this->bond_total);
        }

        $principal = $this->money($this->principal ?: $this->cost);
        $totalProfit = $principal * ((float) $this->rate / 100) * $this->safeMonths();

        return $this->money($principal + $totalProfit + $this->getBondCostValue());
    }

    public function getMonthlyInstallment(): float
    {
        return $this->money($this->getCalculatedBondTotal() / $this->safeMonths());
    }

    public function getTotalProfit(): float
    {
        $principal = $this->money($this->principal ?: $this->cost);
        return $this->money($this->getCalculatedBondTotal() - $this->getBondCostValue() - $principal);
    }

    public function getMonthlyProfit(): float
    {
        return $this->money($this->getTotalProfit() / $this->safeMonths());
    }

    public function getEffectiveRate(): float
    {
        $principal = $this->money($this->principal ?: $this->cost);
        if ((float) $this->rate > 0) {
            return round((float) $this->rate, 4);
        }

        if ($principal <= 0) {
            return 0.0;
        }

        return round(($this->getMonthlyProfit() / $principal) * 100, 4);
    }

    public function getFinancedAmount(): float
    {
        $totalProfit = $this->getTotalProfit();
        $profitShare = $this->profit_share ?: 'shared';
        $aliPct = $profitShare === 'ahmad_only' ? 0.0 : 0.35;
        $baseAmount = $this->money($this->cost ?: $this->principal);

        return $this->money($baseAmount + $this->getBondCostValue() + ($totalProfit * $aliPct));
    }

    private function contractStartDate()
    {
        try {
            if ($this->contract_date instanceof \Illuminate\Support\Carbon) {
                return $this->contract_date->copy()->startOfDay();
            }

            return \Illuminate\Support\Carbon::parse($this->contract_date ?: now())->startOfDay();
        } catch (\Throwable $e) {
            return now()->startOfDay();
        }
    }
    private function firstInstallmentDate()
    {
        $contractDate = $this->contractStartDate();

        try {
            if ($this->first_installment_date instanceof \Illuminate\Support\Carbon) {
                return $this->first_installment_date->copy()->startOfDay();
            }

            if (! empty($this->first_installment_date)) {
                return \Illuminate\Support\Carbon::parse($this->first_installment_date)->startOfDay();
            }
        } catch (\Throwable $e) {
            // إذا كان تاريخ أول قسط غير صالح نستخدم الافتراضي الآمن.
        }

        return $contractDate->copy()->addMonthsNoOverflow(1)->startOfDay();
    }

private function dueDateForInstallment(int $monthNumber)
    {
        return $this->firstInstallmentDate()->addMonthsNoOverflow(max(0, $monthNumber - 1))->startOfDay();
    }
    private function normalizePaymentPeriodKey($periodKey): ?string
    {
        if ($periodKey === null || $periodKey === '') {
            return null;
        }

        try {
            return \Illuminate\Support\Carbon::parse((string) $periodKey . '-01')->format('Y-m');
        } catch (\Throwable $e) {
            if (preg_match('/^(\d{4})-(\d{1,2})$/', (string) $periodKey, $matches)) {
                return sprintf('%04d-%02d', (int) $matches[1], (int) $matches[2]);
            }

            return (string) $periodKey;
        }
    }
    private function currentSchedulePeriodKeys(): array
    {
        $keys = [];

        for ($i = 1; $i <= $this->safeMonths(); $i++) {
            $keys[] = $this->dueDateForInstallment($i)->format('Y-m');
        }

        return $keys;
    }
    private function paymentBelongsToCurrentSchedule($payment): bool
    {
        $month = (int) ($payment->month_number ?? 0);
        if ($month < 1 || $month > $this->safeMonths()) {
            return false;
        }

        $expectedPeriodKey = $this->dueDateForInstallment($month)->format('Y-m');
        $periodKey = $this->normalizePaymentPeriodKey($payment->period_key ?? null);

        if ($periodKey !== null && $periodKey !== '') {
            return $periodKey === $expectedPeriodKey;
        }

        if (! empty($payment->due_date)) {
            try {
                return \Illuminate\Support\Carbon::parse($payment->due_date)->format('Y-m') === $expectedPeriodKey;
            } catch (\Throwable $e) {
                return false;
            }
        }

        return true;
    }

private function validPaymentsForCurrentSchedule()
    {
        $this->loadMissing('payments');

        return $this->payments
            ->filter(fn ($payment) => $this->paymentBelongsToCurrentSchedule($payment))
            ->values();
    }
    public function getPaidAmount(): float
    {
        return $this->money(
            $this->validPaymentsForCurrentSchedule()
                ->sum(fn ($payment) => max(0, (float) ($payment->paid_amount ?? 0)))
        );
    }

public function getRemainingAmount(): float
    {
        return $this->money(max(0, $this->getCalculatedBondTotal() - $this->getPaidAmount()));
    }

    /**
     * يحسب عدد الأقساط المغطاة فعليًا حسب مجموع المدفوعات، وليس حسب عدد سجلات السداد.
     * يبقى مفيدًا للإحصائيات العامة، أما حالة كل قسط فتُحسب من دفعة القسط نفسه.
     */
    public function getCoveredInstallmentsCount(): int
    {
        $monthly = $this->getMonthlyInstallment();
        if ($monthly <= 0) {
            return 0;
        }

        return min($this->safeMonths(), (int) floor(($this->getPaidAmount() + 0.01) / $monthly));
    }

    public function getRemainingPrincipal(): float
    {
        return $this->money(max(0, $this->getFinancedAmount() - $this->getPaidAmount()));
    }

    private function paymentStatus(float $recordedPaidAmount, float $installmentAmount): string
    {
        if ($recordedPaidAmount + 0.01 >= $installmentAmount) {
            return 'paid';
        }

        if ($recordedPaidAmount > 0) {
            return 'partial';
        }

        return 'unpaid';
    }
    public function generateSchedule(): array
    {
        $schedule = [];
        $monthly = $this->getMonthlyInstallment();
        $validPayments = $this->validPaymentsForCurrentSchedule();
        $paymentsByKey = $validPayments->keyBy(function ($payment) {
            return $this->normalizePaymentPeriodKey($payment->period_key ?? null) ?: (string) ($payment->period_key ?? '');
        });
        $paymentsByMonth = $validPayments->keyBy('month_number');

        for ($i = 1; $i <= $this->safeMonths(); $i++) {
            $date = $this->dueDateForInstallment($i);
            $key = $date->format('Y-m');
            $payment = $paymentsByKey->get($key) ?: $paymentsByMonth->get($i);
            $recordedPaidAmount = $this->money($payment?->paid_amount ?? 0);
            $coveredAmount = $this->money(min($monthly, $recordedPaidAmount));
            $remainingDue = $this->money(max(0, $monthly - $recordedPaidAmount));
            $status = $this->paymentStatus($recordedPaidAmount, $monthly);

            $schedule[] = [
                'month'                => $i,
                'due_date'             => $date->toDateString(),
                'period_key'           => $key,
                'amount'               => $monthly,
                'installment_amount'   => $monthly,
                'is_paid'              => $status === 'paid',
                'payment_status'       => $status,
                'paid_amount'          => $recordedPaidAmount > 0 ? $recordedPaidAmount : null,
                'recorded_paid_amount' => $recordedPaidAmount > 0 ? $recordedPaidAmount : null,
                'covered_amount'       => $coveredAmount,
                'remaining_due'        => $remainingDue,
                'bank_note'            => $payment?->bank_note,
                'paid_date'            => $payment?->paid_date,
                'payment_id'           => $payment?->id,
                'direct_payment_id'    => $payment?->id,
                'can_cancel_payment'   => $payment !== null,
            ];
        }

        return $schedule;
    }

public function getSummary(): array
    {
        $schedule = $this->generateSchedule();
        $paidCount = collect($schedule)->where('is_paid', true)->count();
        $monthly = $this->getMonthlyInstallment();
        $bondTotal = $this->getCalculatedBondTotal();
        $totalProfit = $this->getTotalProfit();
        $paidAmount = $this->getPaidAmount();
        $remainingAmount = $this->getRemainingAmount();
        $principal = $this->money($this->principal ?: $this->cost);
        $profitShare = $this->profit_share ?: 'shared';
        $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;
        $aliPct = $profitShare === 'ahmad_only' ? 0.0 : 0.35;

        return [
            'monthly_installment' => $monthly,
            'bond_total'          => $bondTotal,
            'financed_amount'     => $this->getFinancedAmount(),
            'total_profit'        => $totalProfit,
            'monthly_profit'      => $this->getMonthlyProfit(),
            'effective_rate'      => $this->getEffectiveRate(),
            'total_rate'          => $principal > 0 ? round(($totalProfit / $principal) * 100, 2) : 0,
            'paid_count'          => $paidCount,
            'remaining_months'    => max(0, $this->safeMonths() - $paidCount),
            'paid_amount'         => $paidAmount,
            'remaining_amount'    => $remainingAmount,
            'remaining_principal' => $this->getRemainingPrincipal(),
            'profit_share'        => $profitShare,
            'ahmad_pct'           => $ahmadPct,
            'ali_pct'             => $aliPct,
            'ahmad_total'         => $this->money($totalProfit * $ahmadPct),
            'ahmad_monthly'       => $this->money($this->getMonthlyProfit() * $ahmadPct),
            'ali_total'           => $this->money($totalProfit * $aliPct),
            'ali_monthly'         => $this->money($this->getMonthlyProfit() * $aliPct),
            'progress_percent'    => $bondTotal > 0 ? min(100, round(($paidAmount / $bondTotal) * 100)) : 0,
        ];
    }

    public function followUps()
    {
        return $this->hasMany(\App\Models\FollowUp::class);
    }

    public function reminders()
    {
        return $this->hasMany(\App\Models\ClientReminder::class);
    }
}
