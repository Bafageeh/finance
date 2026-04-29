<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class ClientController extends Controller
{
    // ── GET /api/clients ──────────────────────────────
    public function index(Request $request): JsonResponse
    {
        $query = Client::with('payments');

        if ($request->status && $request->status !== 'all') {
            if ($request->status === 'court') {
                $query->where('has_court', true);
            } else {
                $query->where('status', $request->status);
            }
        }

        // افتراضيًا نرسل جدول الأقساط أيضًا لأن تطبيق الجوال يعتمد عليه
        // لحساب المتأخرين والقريبين ومركز التحصيل.
        $withSchedule = $request->boolean('with_schedule', true);

        $clients = $query->orderBy('created_at', 'desc')->get()
            ->map(fn ($c) => $this->formatClient($c, $withSchedule));

        return response()->json(['data' => $clients]);
    }

    // ── POST /api/clients ─────────────────────────────
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'required|string|max:255',
            'id_number'     => 'nullable|string|max:20',
            'phone'         => 'nullable|string|max:20',
            'asset'         => 'nullable|string|max:100',
            'contract_date' => 'required|date',
            'first_installment_date' => 'nullable|date|after_or_equal:contract_date',
            'cost'          => 'nullable|numeric|min:0',
            'principal'     => 'nullable|numeric|min:0',
            'rate'          => 'nullable|numeric|min:0',
            'months'        => 'required|integer|min:1|max:360',
            'bond_cost'     => 'nullable|numeric|min:0',
            'bond_total'    => 'nullable|numeric|min:0',
            'profit_share'  => ['nullable', Rule::in(['shared', 'ahmad_only'])],
            'status'        => ['nullable', Rule::in(['active', 'stuck', 'done'])],
            'has_court'     => 'nullable|boolean',
            'court_note'    => 'nullable|string|max:500',
            'notes'         => 'nullable|string|max:5000',
        ]);

        $this->ensureFirstInstallmentDateIsAllowed($data, null);

        $data = $this->normalizeClientPayload($data, null);

        $client = Client::create($data);

        return response()->json(['data' => $this->formatClient($client->fresh('payments'), true)], 201);
    }

    // ── GET /api/clients/{id} ─────────────────────────
    public function show(Client $client): JsonResponse
    {
        $client->load('payments');

        return response()->json(['data' => $this->formatClient($client, true)]);
    }

    // ── PUT /api/clients/{id} ─────────────────────────
    public function update(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'name'          => 'sometimes|string|max:255',
            'id_number'     => 'nullable|string|max:20',
            'phone'         => 'nullable|string|max:20',
            'asset'         => 'nullable|string|max:100',
            'contract_date' => 'sometimes|date',
            'first_installment_date' => 'nullable|date',
            'cost'          => 'nullable|numeric|min:0',
            'principal'     => 'nullable|numeric|min:0',
            'rate'          => 'nullable|numeric|min:0',
            'months'        => 'sometimes|integer|min:1|max:360',
            'bond_cost'     => 'nullable|numeric|min:0',
            'bond_total'    => 'nullable|numeric|min:0',
            'profit_share'  => ['nullable', Rule::in(['shared', 'ahmad_only'])],
            'status'        => ['sometimes', Rule::in(['active', 'stuck', 'done'])],
            'has_court'     => 'sometimes|boolean',
            'court_note'    => 'nullable|string|max:500',
            'notes'         => 'nullable|string|max:5000',
        ]);

        $this->ensureFirstInstallmentDateIsAllowed($data, $client);

        $data = $this->normalizeClientPayload($data, $client);

        DB::transaction(function () use ($client, $data) {
            $client->update($data);
            $client->refresh()->load('payments');
            $this->syncPaymentInstallmentInfo($client);
            $this->refreshClientStatus($client);
        });

        return response()->json(['data' => $this->formatClient($client->fresh('payments'), true)]);
    }

    // ── DELETE /api/clients/{id} ──────────────────────
    public function destroy(Client $client): JsonResponse
    {
        $client->delete();

        return response()->json(['message' => 'تم حذف العميل بنجاح']);
    }

    // ── POST /api/clients/{id}/pay ────────────────────
    public function recordPayment(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'period_key'  => 'required|string',
            'paid_amount' => 'nullable|numeric|min:0',
            'bank_note'   => 'nullable|string|max:1000',
        ]);

        $client->load('payments');
        $periodKey = $this->normalizePeriodKey($data['period_key']);
        $schedule = $client->generateSchedule();
        $slot = collect($schedule)->firstWhere('period_key', $periodKey);

        if (! $slot) {
            return response()->json(['message' => 'الفترة غير موجودة'], 422);
        }

        $paidAmount = array_key_exists('paid_amount', $data) && $data['paid_amount'] !== null
            ? round((float) $data['paid_amount'], 2)
            : round((float) $slot['amount'], 2);

        $payment = Payment::updateOrCreate(
            ['client_id' => $client->id, 'period_key' => $periodKey],
            [
                'month_number'       => $slot['month'],
                'due_date'           => $slot['due_date'],
                'installment_amount' => $slot['amount'],
                'paid_amount'        => $paidAmount,
                'bank_note'          => $data['bank_note'] ?? null,
                'paid_date'          => now()->toDateString(),
                'is_paid'            => true,
            ]
        );

        $this->refreshClientStatus($client->fresh('payments'));

        return response()->json([
            'data'    => $payment,
            'message' => $paidAmount + 0.01 >= (float) $slot['amount']
                ? 'تم تسجيل الدفعة بنجاح'
                : 'تم تسجيل دفعة جزئية بنجاح',
        ]);
    }

    // ── DELETE /api/clients/{id}/pay/{periodKey} ──────
    // ── DELETE /api/clients/{id}/pay/{periodKey} ──────
    // ── DELETE /api/clients/{id}/pay/{periodKey} ──────
    // ── DELETE /api/clients/{id}/pay/{periodKey} ──────
    public function removePayment(Request $request, Client $client, string $periodKey): JsonResponse
    {
        $client->load('payments');

        $normalizedPeriodKey = $this->normalizePeriodKey($periodKey);
        $monthNumber = $request->query('month_number');
        $paymentId = $request->query('payment_id');
        $payment = null;

        if ($paymentId !== null && $paymentId !== '') {
            $payment = Payment::where('client_id', $client->id)
                ->where('id', (int) $paymentId)
                ->first();
        }

        if (! $payment && $monthNumber !== null && $monthNumber !== '') {
            $payment = Payment::where('client_id', $client->id)
                ->where('month_number', (int) $monthNumber)
                ->orderByDesc('id')
                ->first();
        }

        if (! $payment && $periodKey !== '') {
            $periodVariants = array_values(array_unique(array_filter([
                $periodKey,
                $normalizedPeriodKey,
                preg_replace('/-(0)(\d)$/', '-$2', $normalizedPeriodKey),
            ])));

            $payment = Payment::where('client_id', $client->id)
                ->whereIn('period_key', $periodVariants)
                ->orderByDesc('id')
                ->first();
        }

        if (! $payment && preg_match('/^\d{4}-\d{1,2}$/', $normalizedPeriodKey)) {
            try {
                $monthStart = Carbon::parse($normalizedPeriodKey . '-01')->startOfMonth();
                $monthEnd = $monthStart->copy()->endOfMonth();

                $payment = Payment::where('client_id', $client->id)
                    ->whereBetween('due_date', [$monthStart->toDateString(), $monthEnd->toDateString()])
                    ->orderByDesc('id')
                    ->first();
            } catch (\Throwable $e) {
                // تجاهل الخطأ وانتقل إلى طريقة البحث التالية
            }
        }

        if (! $payment && $monthNumber !== null && $monthNumber !== '') {
            $payment = $this->findPaymentCoveringInstallment($client, (int) $monthNumber);
        }

        if (! $payment) {
            return response()->json([
                'message' => 'لم يتم العثور على دفعة مسجلة لهذا القسط. قد يكون القسط مغطى من زيادة دفعة سابقة، أو أن بيانات الدفعة قديمة. حدّث بيانات العميل ثم حاول مرة أخرى.',
            ], 404);
        }

        $deletedData = [
            'id'           => $payment->id,
            'month_number' => (int) ($payment->month_number ?? 0),
            'period_key'   => $payment->period_key,
            'paid_amount'  => round((float) ($payment->paid_amount ?? 0), 2),
        ];

        $payment->delete();
        $this->refreshClientStatus($client->fresh('payments'));

        return response()->json([
            'message' => 'تم إلغاء الدفعة بنجاح',
            'data'    => $deletedData,
        ]);
    }

// ── GET /api/stats ────────────────────────────────
    public function stats(): JsonResponse
    {
        $clients = Client::with('payments')->get();
        $today = Carbon::today();

        $activeClients = $clients->filter(fn ($c) =>
            $c->status === 'active' && $c->getRemainingAmount() > 0
        );
        $stuckClients = $clients->where('status', 'stuck');
        $doneClients = $clients->filter(fn ($c) => $c->status === 'done' || $c->getRemainingAmount() <= 0.01);
        $courtClients = $clients->where('has_court', true);
        $nonStuck = $clients->where('status', '!=', 'stuck');

        $monthlyIncome = $activeClients->sum(fn ($c) => $c->getMonthlyInstallment());
        $monthlyProfit = $activeClients->sum(fn ($c) => $c->getMonthlyProfit());
        $ahmadTotal = $nonStuck->sum(function ($c) {
            $profitShare = $c->profit_share ?: 'shared';
            $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;
            return $c->getTotalProfit() * $ahmadPct;
        });
        $ahmadMonthly = $activeClients->sum(function ($c) {
            $profitShare = $c->profit_share ?: 'shared';
            $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;
            return $c->getMonthlyProfit() * $ahmadPct;
        });
        $aliMonthly = $activeClients->sum(function ($c) {
            $profitShare = $c->profit_share ?: 'shared';
            $aliPct = $profitShare === 'ahmad_only' ? 0.0 : 0.35;
            return $c->getMonthlyProfit() * $aliPct;
        });

        // يعتمد الآن على المبلغ المدفوع فعليًا وليس عدد الأقساط المسجلة.
        $zakatBase = $nonStuck->filter(fn ($c) => $c->status !== 'done')
            ->sum(fn ($c) => $c->getRemainingAmount());

        $stuckStats = [
            'count'               => $stuckClients->count(),
            'total_remaining'     => round($stuckClients->sum(fn ($c) => $c->getRemainingAmount()), 2),
            'total_principal'     => round($stuckClients->sum('principal'), 2),
            'remaining_principal' => round($stuckClients->sum(fn ($c) => $c->getRemainingPrincipal()), 2),
        ];

        $lateClients = [];
        $warnClients = [];

        foreach ($clients->where('status', '!=', 'stuck') as $c) {
            if ($c->getRemainingAmount() <= 0.01) {
                continue;
            }

            $schedule = $c->generateSchedule();
            $overdue = array_values(array_filter($schedule, function ($s) use ($today) {
                return (float) ($s['remaining_due'] ?? 0) > 0.01
                    && Carbon::parse($s['due_date'])->lte($today);
            }));
            $nextDue = collect($schedule)->first(function ($s) use ($today) {
                return (float) ($s['remaining_due'] ?? $s['amount']) > 0.01
                    && Carbon::parse($s['due_date'])->gt($today);
            });

            if (count($overdue) > 0) {
                $lateClients[] = [
                    'id'             => $c->id,
                    'name'           => $c->name,
                    'id_number'      => $c->id_number,
                    'overdue_count'  => count($overdue),
                    'overdue_amount' => round(array_sum(array_map(
                        fn ($s) => (float) ($s['remaining_due'] ?? $s['amount'] ?? 0),
                        $overdue
                    )), 2),
                ];
            } elseif ($nextDue && Carbon::parse($nextDue['due_date'])->diffInDays($today) <= 7) {
                $warnClients[] = [
                    'id'        => $c->id,
                    'name'      => $c->name,
                    'days_left' => Carbon::parse($nextDue['due_date'])->diffInDays($today),
                    'next_due'  => $nextDue['due_date'],
                    'amount'    => round((float) ($nextDue['remaining_due'] ?? $nextDue['amount']), 2),
                ];
            }
        }

        return response()->json([
            'data' => [
                'counts'         => [
                    'active' => $activeClients->count(),
                    'stuck'  => $stuckClients->count(),
                    'done'   => $doneClients->count(),
                    'court'  => $courtClients->count(),
                    'total'  => $clients->count(),
                ],
                'monthly_income' => round($monthlyIncome, 2),
                'monthly_profit' => round($monthlyProfit, 2),
                'ahmad_total'    => round($ahmadTotal, 2),
                'ahmad_monthly'  => round($ahmadMonthly, 2),
                'ali_monthly'    => round($aliMonthly, 2),
                'zakat_base'     => round($zakatBase, 2),
                'zakat'          => round($zakatBase * 0.025, 2),
                'sadaqa'         => round($zakatBase * 0.01, 2),
                'stuck'          => $stuckStats,
                'alerts'         => [
                    'late' => $lateClients,
                    'warn' => $warnClients,
                ],
            ],
        ]);
    }

    // ── Private helpers ───────────────────────────────

    private function formatClient(Client $client, bool $withSchedule = false): array
    {
        $client->loadMissing('payments');
        $summary = $client->getSummary();
        $data = array_merge($client->toArray(), ['summary' => $summary]);

        if ($withSchedule) {
            $data['schedule'] = $client->generateSchedule();
        }

        return $data;
    }

    private function ensureFirstInstallmentDateIsAllowed(array $data, ?Client $client): void
    {
        $hasFirstInstallmentDate = array_key_exists('first_installment_date', $data)
            && $data['first_installment_date'] !== null
            && $data['first_installment_date'] !== '';

        if (! $hasFirstInstallmentDate) {
            return;
        }

        try {
            $rawContractDate = $data['contract_date'] ?? ($client?->contract_date ?? now());
            $contractDate = $rawContractDate instanceof Carbon
                ? $rawContractDate->copy()->startOfDay()
                : Carbon::parse($rawContractDate ?: now())->startOfDay();
            $firstInstallmentDate = Carbon::parse($data['first_installment_date'])->startOfDay();
        } catch (\Throwable) {
            return;
        }

        if ($firstInstallmentDate->lt($contractDate)) {
            throw ValidationException::withMessages([
                'first_installment_date' => ['تاريخ أول قسط لا يمكن أن يكون أقدم من تاريخ العقد.'],
            ]);
        }
    }

    private function normalizeClientPayload(array $data, ?Client $client): array
    {
        $data['bond_cost'] = $data['bond_cost'] ?? ($client?->bond_cost ?? 74.75);
        $data['rate'] = $data['rate'] ?? ($client?->rate ?? 0);
        $data['profit_share'] = $data['profit_share'] ?? ($client?->profit_share ?? 'shared');
        $data['status'] = $data['status'] ?? ($client?->status ?? 'active');
        $data['has_court'] = $data['has_court'] ?? ($client?->has_court ?? false);

        if (array_key_exists('principal', $data) && ($data['principal'] === null || $data['principal'] === '')) {
            $data['principal'] = array_key_exists('cost', $data) ? $data['cost'] : ($client?->cost ?? 0);
        }

        if (array_key_exists('cost', $data) && ($data['cost'] === null || $data['cost'] === '')) {
            $data['cost'] = array_key_exists('principal', $data) ? $data['principal'] : ($client?->principal ?? 0);
        }

        if (! array_key_exists('principal', $data) && array_key_exists('cost', $data)) {
            $data['principal'] = $data['cost'];
        }

        if (! array_key_exists('cost', $data) && array_key_exists('principal', $data)) {
            $data['cost'] = $data['principal'];
        }

        if ($client === null) {
            $data['principal'] = $data['principal'] ?? ($data['cost'] ?? 0);
            $data['cost'] = $data['cost'] ?? $data['principal'];
        }

        if (array_key_exists('bond_total', $data) && ($data['bond_total'] === null || $data['bond_total'] === '')) {
            $data['bond_total'] = null;
        }

        try {
            $rawContractDate = $data['contract_date'] ?? ($client?->contract_date ?? now());
            $contractDate = $rawContractDate instanceof \Illuminate\Support\Carbon
                ? $rawContractDate->copy()->startOfDay()
                : \Illuminate\Support\Carbon::parse($rawContractDate ?: now())->startOfDay();
        } catch (\Throwable $e) {
            $contractDate = now()->startOfDay();
        }

        $defaultFirstInstallmentDate = $contractDate->copy()->addMonthsNoOverflow(1)->startOfDay();
        $hasExplicitFirstInstallment = array_key_exists('first_installment_date', $data)
            && $data['first_installment_date'] !== null
            && $data['first_installment_date'] !== '';

        if ($hasExplicitFirstInstallment) {
            try {
                $firstInstallmentDate = \Illuminate\Support\Carbon::parse($data['first_installment_date'])->startOfDay();
            } catch (\Throwable $e) {
                $firstInstallmentDate = $defaultFirstInstallmentDate->copy();
            }

            if ($firstInstallmentDate->lt($contractDate)) {
                $firstInstallmentDate = $defaultFirstInstallmentDate->copy();
            }

            $data['first_installment_date'] = $firstInstallmentDate->toDateString();
        } elseif ($client !== null && ! empty($client->first_installment_date)) {
            try {
                $firstInstallmentDate = \Illuminate\Support\Carbon::parse($client->first_installment_date)->startOfDay();
            } catch (\Throwable $e) {
                $firstInstallmentDate = $defaultFirstInstallmentDate->copy();
            }

            if ($firstInstallmentDate->lt($contractDate)) {
                $firstInstallmentDate = $defaultFirstInstallmentDate->copy();
            }

            $data['first_installment_date'] = $firstInstallmentDate->toDateString();
        } else {
            $data['first_installment_date'] = $defaultFirstInstallmentDate->toDateString();
        }

        return $data;
    }

private function normalizePeriodKey(string $periodKey): string
    {
        try {
            return Carbon::parse($periodKey . '-01')->format('Y-m');
        } catch (\Throwable) {
            return $periodKey;
        }
    }
    private function syncPaymentInstallmentInfo(Client $client): void
    {
        $client->refresh()->load('payments');

        $payments = $client->payments()
            ->orderBy('month_number')
            ->orderBy('id')
            ->get();

        if ($payments->isEmpty()) {
            return;
        }

        $scheduleByMonth = collect($client->generateSchedule())->keyBy('month');

        \Illuminate\Support\Facades\DB::transaction(function () use ($payments, $scheduleByMonth, $client) {
            /*
             * سبب الخطأ السابق:
             * عند تغيير تاريخ العقد أو تاريخ أول قسط، بعض الدفعات تتحرك إلى period_key
             * موجود مسبقاً لنفس العميل، فيصطدم النظام بالقيد unique:
             * payments_client_id_period_key_unique.
             *
             * الحل الآمن:
             * 1) ننقل كل دفعات العميل مؤقتاً إلى period_key آمنة وفريدة.
             * 2) نعيد فقط دفعة واحدة لكل قسط/شهر إلى period_key الصحيح.
             * 3) أي دفعات مكررة لنفس رقم القسط تبقى محفوظة لكن خارج جدول العقد الحالي،
             *    حتى لا تدخل في حساب المدفوع والمتبقي ولا تسبب تكراراً.
             */
            foreach ($payments as $index => $payment) {
                $payment->forceFill([
                    'period_key' => sprintf('%04d-01', 1200 + $index),
                ])->save();
            }

            $usedPeriodKeys = [];
            $usedMonths = [];

            foreach ($payments as $index => $payment) {
                $monthNumber = (int) ($payment->month_number ?? 0);
                $slot = $scheduleByMonth->get($monthNumber);

                if (! $slot) {
                    $payment->forceFill([
                        'period_key' => sprintf('%04d-02', 1200 + $index),
                    ])->save();
                    continue;
                }

                $targetPeriodKey = (string) ($slot['period_key'] ?? '');

                if ($targetPeriodKey === '' || isset($usedPeriodKeys[$targetPeriodKey]) || isset($usedMonths[$monthNumber])) {
                    $payment->forceFill([
                        'period_key'           => sprintf('%04d-03', 1200 + $index),
                        'due_date'             => $slot['due_date'] ?? null,
                        'installment_amount'   => $slot['amount'] ?? $payment->installment_amount,
                    ])->save();
                    continue;
                }

                $usedPeriodKeys[$targetPeriodKey] = true;
                $usedMonths[$monthNumber] = true;

                $payment->forceFill([
                    'period_key'           => $targetPeriodKey,
                    'due_date'             => $slot['due_date'],
                    'installment_amount'   => $slot['amount'],
                ])->save();
            }
        });
    }

private function findPaymentCoveringInstallment(Client $client, int $monthNumber): ?Payment
    {
        $monthly = (float) $client->getMonthlyInstallment();
        $monthNumber = max(1, $monthNumber);

        if ($monthly <= 0) {
            return null;
        }

        $targetStart = ($monthNumber - 1) * $monthly;
        $targetEnd = $monthNumber * $monthly;
        $running = 0.0;
        $candidate = null;

        $payments = $client->payments
            ->sortBy(function ($payment) {
                return sprintf(
                    '%06d-%s-%06d',
                    (int) ($payment->month_number ?? 0),
                    (string) ($payment->period_key ?? ''),
                    (int) ($payment->id ?? 0)
                );
            })
            ->values();

        foreach ($payments as $payment) {
            $amount = max(0, (float) ($payment->paid_amount ?? 0));
            if ($amount <= 0) {
                continue;
            }

            $before = $running;
            $after = $running + $amount;

            if ($after > $targetStart + 0.01 && $before < $targetEnd - 0.01) {
                $candidate = $payment;
            }

            $running = $after;
        }

        return $candidate;
    }

private function refreshClientStatus(Client $client): void
    {
        $client->loadMissing('payments');
        $remaining = $client->getRemainingAmount();

        if ($remaining <= 0.01 && $client->status !== 'done') {
            $client->update(['status' => 'done']);
            return;
        }

        if ($remaining > 0.01 && $client->status === 'done') {
            $client->update(['status' => 'active']);
        }
    }
}
