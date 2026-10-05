<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;

class AccountStatsController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $accountId = (int) ($user?->account_id ?? 0);

        if ($accountId <= 0) {
            return response()->json([
                'message' => 'لم يتم ربط المستخدم المسجل بحساب صالح.',
            ], 422);
        }

        // جميع الإحصائيات أدناه تخص الحساب المرتبط بالمستخدم المسجل فقط.
        $clients = Client::with('payments')
            ->where('account_id', $accountId)
            ->get();

        $today = Carbon::today();

        $activeClients = $clients->filter(fn (Client $client) =>
            $client->status === 'active'
            && $client->getRemainingAmount() > 0.01
        );

        $stuckClients = $clients->where('status', 'stuck');

        $doneClients = $clients->filter(fn (Client $client) =>
            $client->status === 'done'
            || $client->getRemainingAmount() <= 0.01
        );

        $courtClients = $clients->filter(fn (Client $client) =>
            (bool) ($client->has_court ?? false)
            || $client->status === 'court'
        );

        $nonStuckClients = $clients->where('status', '!=', 'stuck');

        $monthlyIncome = $activeClients->sum(
            fn (Client $client) => $client->getMonthlyInstallment()
        );

        $monthlyProfit = $activeClients->sum(
            fn (Client $client) => $client->getMonthlyProfit()
        );

        $ahmadTotal = $nonStuckClients->sum(function (Client $client): float {
            $profitShare = $client->profit_share ?: 'shared';
            $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;

            return $client->getTotalProfit() * $ahmadPct;
        });

        $ahmadMonthly = $activeClients->sum(function (Client $client): float {
            $profitShare = $client->profit_share ?: 'shared';
            $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;

            return $client->getMonthlyProfit() * $ahmadPct;
        });

        $aliMonthly = $activeClients->sum(function (Client $client): float {
            $profitShare = $client->profit_share ?: 'shared';
            $aliPct = $profitShare === 'ahmad_only' ? 0.0 : 0.35;

            return $client->getMonthlyProfit() * $aliPct;
        });

        // يعتمد على المبلغ المدفوع فعليًا، وليس على عدد سجلات السداد.
        $zakatBase = $nonStuckClients
            ->filter(fn (Client $client) => $client->status !== 'done')
            ->sum(fn (Client $client) => $client->getRemainingAmount());

        $stuckStats = [
            'count' => $stuckClients->count(),
            'total_remaining' => round(
                $stuckClients->sum(fn (Client $client) => $client->getRemainingAmount()),
                2
            ),
            'total_principal' => round($stuckClients->sum('principal'), 2),
            'remaining_principal' => round(
                $stuckClients->sum(fn (Client $client) => $client->getRemainingPrincipal()),
                2
            ),
        ];

        $lateClients = [];
        $warnClients = [];

        foreach ($clients->where('status', '!=', 'stuck') as $client) {
            if ($client->getRemainingAmount() <= 0.01) {
                continue;
            }

            try {
                $schedule = $client->generateSchedule();
            } catch (\Throwable) {
                continue;
            }

            $overdue = array_values(array_filter(
                $schedule,
                function (array $item) use ($today): bool {
                    $remaining = (float) ($item['remaining_due'] ?? $item['amount'] ?? 0);
                    $dueDate = $item['due_date'] ?? null;

                    if ($remaining <= 0.01 || ! $dueDate) {
                        return false;
                    }

                    // يبدأ التأخير من اليوم التالي لتاريخ الاستحقاق.
                    return Carbon::parse($dueDate)->lt($today);
                }
            ));

            $nextDue = collect($schedule)->first(function (array $item) use ($today): bool {
                $remaining = (float) ($item['remaining_due'] ?? $item['amount'] ?? 0);
                $dueDate = $item['due_date'] ?? null;

                return $remaining > 0.01
                    && $dueDate
                    && Carbon::parse($dueDate)->gte($today);
            });

            if (count($overdue) > 0) {
                $lateClients[] = [
                    'id' => $client->id,
                    'name' => $client->name,
                    'id_number' => $client->id_number,
                    'overdue_count' => count($overdue),
                    'overdue_amount' => round(array_sum(array_map(
                        fn (array $item): float => (float) (
                            $item['remaining_due']
                            ?? $item['amount']
                            ?? 0
                        ),
                        $overdue
                    )), 2),
                ];
            } elseif (
                $nextDue
                && Carbon::parse($nextDue['due_date'])->diffInDays($today) <= 7
            ) {
                $warnClients[] = [
                    'id' => $client->id,
                    'name' => $client->name,
                    'days_left' => Carbon::parse($nextDue['due_date'])->diffInDays($today),
                    'next_due' => $nextDue['due_date'],
                    'amount' => round((float) (
                        $nextDue['remaining_due']
                        ?? $nextDue['amount']
                        ?? 0
                    ), 2),
                ];
            }
        }

        return response()->json([
            'data' => [
                'account' => [
                    'id' => $accountId,
                    'name' => $user?->account?->name,
                ],
                'counts' => [
                    'active' => $activeClients->count(),
                    'stuck' => $stuckClients->count(),
                    'done' => $doneClients->count(),
                    'court' => $courtClients->count(),
                    'total' => $clients->count(),
                ],
                'monthly_income' => round($monthlyIncome, 2),
                'monthly_profit' => round($monthlyProfit, 2),
                'ahmad_total' => round($ahmadTotal, 2),
                'ahmad_monthly' => round($ahmadMonthly, 2),
                'ali_monthly' => round($aliMonthly, 2),
                'zakat_base' => round($zakatBase, 2),
                'zakat' => round($zakatBase * 0.025, 2),
                'sadaqa' => round($zakatBase * 0.01, 2),
                'stuck' => $stuckStats,
                'alerts' => [
                    'late' => $lateClients,
                    'warn' => $warnClients,
                ],
            ],
        ]);
    }

    public function capitalReport(Request $request): JsonResponse
    {
        $user = $request->user();
        $accountId = (int) ($user?->account_id ?? 0);

        if ($accountId <= 0) {
            return response()->json([
                'message' => 'لم يتم ربط المستخدم المسجل بحساب صالح.',
            ], 422);
        }

        $clients = Client::with('payments')
            ->where('account_id', $accountId)
            ->get();

        $ahmadTotalProfit = 0.0;
        $ahmadRealizedProfit = 0.0;
        $aliTotalProfit = 0.0;
        $aliRealizedProfit = 0.0;
        $activeRemainingCapital = 0.0;
        $stuckRemainingCapital = 0.0;
        $totalCustomerRemaining = 0.0;

        foreach ($clients as $client) {
            $bondTotal = max(0, (float) $client->getCalculatedBondTotal());
            $paidAmount = max(0, (float) $client->getPaidAmount());
            $collectionRatio = $bondTotal > 0
                ? min(1.0, max(0.0, $paidAmount / $bondTotal))
                : 0.0;

            $totalProfit = max(0, (float) $client->getTotalProfit());
            $profitShare = strtolower(trim((string) ($client->profit_share ?: 'shared')));
            $ahmadOnly = in_array($profitShare, [
                'ahmad_only',
                'ahmed_only',
                'none',
                'no_ali',
                'ahmad',
                'ahmed',
            ], true);

            $ahmadPct = $ahmadOnly ? 1.0 : 0.65;
            $aliPct = $ahmadOnly ? 0.0 : 0.35;

            $clientAhmadProfit = $totalProfit * $ahmadPct;
            $clientAliProfit = $totalProfit * $aliPct;

            $ahmadTotalProfit += $clientAhmadProfit;
            $aliTotalProfit += $clientAliProfit;
            $ahmadRealizedProfit += $clientAhmadProfit * $collectionRatio;
            $aliRealizedProfit += $clientAliProfit * $collectionRatio;

            $remainingCapital = max(0, (float) $client->getRemainingPrincipal());
            $status = strtolower(trim((string) ($client->status ?: 'active')));

            if (in_array($status, ['active', 'late', 'overdue', 'court'], true)) {
                $activeRemainingCapital += $remainingCapital;
            } elseif ($status === 'stuck') {
                $stuckRemainingCapital += $remainingCapital;
            }

            $totalCustomerRemaining += max(0, (float) $client->getRemainingAmount());
        }

        $ahmadRemainingProfit = max(0, $ahmadTotalProfit - $ahmadRealizedProfit);
        $aliRemainingProfit = max(0, $aliTotalProfit - $aliRealizedProfit);
        $remainingCapital = $activeRemainingCapital + $stuckRemainingCapital;
        $ahmadOutstandingAmount = max(0, $totalCustomerRemaining - $aliRemainingProfit);

        $firstContractDate = $clients
            ->filter(fn (Client $client) => ! empty($client->contract_date))
            ->sortBy('contract_date')
            ->first()?->contract_date;

        return response()->json([
            'data' => [
                'as_of' => now()->toDateString(),
                'first_contract_date' => $firstContractDate
                    ? Carbon::parse($firstContractDate)->toDateString()
                    : null,
                'contracts_count' => $clients->count(),
                'total_customer_remaining' => round($totalCustomerRemaining, 2),
                'remaining_capital' => round($remainingCapital, 2),
                'active_remaining_capital' => round($activeRemainingCapital, 2),
                'stuck_remaining_capital' => round($stuckRemainingCapital, 2),
                'ahmad_total_profit' => round($ahmadTotalProfit, 2),
                'ahmad_realized_profit' => round($ahmadRealizedProfit, 2),
                'ahmad_remaining_profit' => round($ahmadRemainingProfit, 2),
                'ali_total_profit' => round($aliTotalProfit, 2),
                'ali_realized_profit' => round($aliRealizedProfit, 2),
                'ali_remaining_profit' => round($aliRemainingProfit, 2),
                'ahmad_outstanding_amount' => round($ahmadOutstandingAmount, 2),
            ],
        ]);
    }

}
