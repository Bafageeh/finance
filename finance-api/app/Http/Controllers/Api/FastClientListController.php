<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class FastClientListController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Client::query()->with('payments');

        $status = (string) $request->query('status', 'all');

        if ($status !== '' && $status !== 'all') {
            if ($status === 'court') {
                $query->where('has_court', true);
            } else {
                $query->where('status', $status);
            }
        }

        $withSchedule = $request->boolean('with_schedule', true);

        $clients = $query
            ->orderByDesc('created_at')
            ->get()
            ->map(fn (Client $client): array => $this->formatListClient($client, $withSchedule))
            ->values();

        return response()->json(['data' => $clients]);
    }

    private function formatListClient(Client $client, bool $withSchedule): array
    {
        /*
         * Generate the schedule only once, derive the summary from the same
         * result, omit duplicate raw payment records, and return only the
         * schedule fields required by the clients list cards.
         */
        $schedule = $client->generateSchedule();
        $monthly = (float) $client->getMonthlyInstallment();
        $bondTotal = (float) $client->getCalculatedBondTotal();
        $totalProfit = (float) $client->getTotalProfit();
        $monthlyProfit = (float) $client->getMonthlyProfit();
        $paidAmount = round(collect($schedule)->sum(
            fn (array $item): float => max(0, (float) ($item['recorded_paid_amount'] ?? $item['paid_amount'] ?? 0))
        ), 2);
        $paidCount = collect($schedule)->where('is_paid', true)->count();
        $principal = round((float) ($client->principal ?: $client->cost), 2);
        $profitShare = $client->profit_share ?: 'shared';
        $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;
        $aliPct = $profitShare === 'ahmad_only' ? 0.0 : 0.35;
        $financedAmount = (float) $client->getFinancedAmount();
        $remainingAmount = round(max(0, $bondTotal - $paidAmount), 2);
        $remainingPrincipal = round(max(0, $financedAmount - $paidAmount), 2);

        $summary = [
            'monthly_installment' => round($monthly, 2),
            'bond_total' => round($bondTotal, 2),
            'financed_amount' => round($financedAmount, 2),
            'total_profit' => round($totalProfit, 2),
            'monthly_profit' => round($monthlyProfit, 2),
            'effective_rate' => round((float) $client->getEffectiveRate(), 4),
            'total_rate' => $principal > 0 ? round(($totalProfit / $principal) * 100, 2) : 0,
            'paid_count' => $paidCount,
            'remaining_months' => max(0, (int) $client->months - $paidCount),
            'paid_amount' => $paidAmount,
            'remaining_amount' => $remainingAmount,
            'remaining_principal' => $remainingPrincipal,
            'profit_share' => $profitShare,
            'ahmad_pct' => $ahmadPct,
            'ali_pct' => $aliPct,
            'ahmad_total' => round($totalProfit * $ahmadPct, 2),
            'ahmad_monthly' => round($monthlyProfit * $ahmadPct, 2),
            'ali_total' => round($totalProfit * $aliPct, 2),
            'ali_monthly' => round($monthlyProfit * $aliPct, 2),
            'progress_percent' => $bondTotal > 0
                ? min(100, (int) round(($paidAmount / $bondTotal) * 100))
                : 0,
        ];

        $data = $client->toArray();
        unset($data['payments']);
        $data['summary'] = $summary;

        if ($withSchedule) {
            $data['schedule'] = array_map(
                static fn (array $item): array => [
                    'month' => $item['month'] ?? null,
                    'due_date' => $item['due_date'] ?? null,
                    'period_key' => $item['period_key'] ?? null,
                    'amount' => $item['amount'] ?? 0,
                    'installment_amount' => $item['installment_amount'] ?? ($item['amount'] ?? 0),
                    'is_paid' => (bool) ($item['is_paid'] ?? false),
                    'payment_status' => $item['payment_status'] ?? 'unpaid',
                    'paid_amount' => $item['paid_amount'] ?? null,
                    'recorded_paid_amount' => $item['recorded_paid_amount'] ?? null,
                    'covered_amount' => $item['covered_amount'] ?? 0,
                    'remaining_due' => $item['remaining_due'] ?? 0,
                ],
                $schedule,
            );
        }

        return $data;
    }
}
