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
         * The old list formatter generated the complete schedule twice and
         * recalculated the paid amount several times for every client. It also
         * returned the raw payments relation together with the generated
         * schedule, which made the JSON response unnecessarily large.
         *
         * Generate the schedule once, derive the summary from that same result,
         * and omit the duplicate raw payments collection from list responses.
         */
        $schedule = $client->generateSchedule();
        $monthly = (float) $client->getMonthlyInstallment();
        $bondTotal = (float) $client->getCalculatedBondTotal();
        $totalProfit = (float) $client->getTotalProfit();
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
            'monthly_profit' => round((float) $client->getMonthlyProfit(), 2),
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
            'ahmad_monthly' => round((float) $client->getMonthlyProfit() * $ahmadPct, 2),
            'ali_total' => round($totalProfit * $aliPct, 2),
            'ali_monthly' => round((float) $client->getMonthlyProfit() * $aliPct, 2),
            'progress_percent' => $bondTotal > 0
                ? min(100, (int) round(($paidAmount / $bondTotal) * 100))
                : 0,
        ];

        $data = $client->toArray();
        unset($data['payments']);
        $data['summary'] = $summary;

        if ($withSchedule) {
            $data['schedule'] = $schedule;
        }

        return $data;
    }
}
