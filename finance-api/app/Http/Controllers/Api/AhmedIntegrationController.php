<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class AhmedIntegrationController extends Controller
{
    public function summary(): JsonResponse
    {
        $clients = Client::with('payments')->get();
        $today = Carbon::today();

        $activeClients = $clients->filter(fn ($client) =>
            $client->status === 'active' && $client->getRemainingAmount() > 0
        );
        $stuckClients = $clients->where('status', 'stuck');
        $doneClients = $clients->filter(fn ($client) =>
            $client->status === 'done' || $client->getRemainingAmount() <= 0.01
        );
        $courtClients = $clients->where('has_court', true);
        $nonStuckClients = $clients->where('status', '!=', 'stuck');

        $monthlyInstallments = $activeClients->sum(fn ($client) => $client->getMonthlyInstallment());
        $monthlyProfit = $activeClients->sum(fn ($client) => $client->getMonthlyProfit());
        $ahmedMonthlyProfit = $activeClients->sum(fn ($client) => $this->ahmedMonthlyProfit($client));
        $aliMonthlyProfit = $activeClients->sum(fn ($client) => $this->aliMonthlyProfit($client));

        $totalInstallmentsRemaining = $activeClients->sum(fn ($client) => $client->getRemainingAmount());
        $totalPrincipalRemaining = $activeClients->sum(fn ($client) => $client->getRemainingPrincipal());
        $totalAhmedProfit = $nonStuckClients->sum(fn ($client) => $this->ahmedTotalProfit($client));

        $overdueInstallmentsAmount = 0.0;
        $overdueInstallmentsCount = 0;
        $overdueClientsCount = 0;

        foreach ($activeClients as $client) {
            $schedule = $client->generateSchedule();
            $clientOverdueCount = 0;

            foreach ($schedule as $slot) {
                $remainingDue = (float) ($slot['remaining_due'] ?? 0);
                $dueDate = Carbon::parse($slot['due_date']);

                if ($remainingDue > 0.01 && $dueDate->lt($today)) {
                    $overdueInstallmentsAmount += $remainingDue;
                    $overdueInstallmentsCount++;
                    $clientOverdueCount++;
                }
            }

            if ($clientOverdueCount > 0) {
                $overdueClientsCount++;
            }
        }

        return response()->json([
            'data' => [
                'source' => 'finance',
                'owner' => 'ahmed',
                'currency' => 'SAR',
                'period' => [
                    'type' => 'monthly',
                    'from' => now()->startOfMonth()->toDateString(),
                    'to' => now()->endOfMonth()->toDateString(),
                ],
                'income' => [
                    'monthly_installments_total' => $this->money($monthlyInstallments),
                    'monthly_profit_total' => $this->money($monthlyProfit),
                    'ahmed_monthly_profit' => $this->money($ahmedMonthlyProfit),
                    'ali_monthly_profit' => $this->money($aliMonthlyProfit),
                ],
                'portfolio' => [
                    'remaining_installments_total' => $this->money($totalInstallmentsRemaining),
                    'remaining_principal_total' => $this->money($totalPrincipalRemaining),
                    'ahmed_total_profit' => $this->money($totalAhmedProfit),
                ],
                'counts' => [
                    'clients_total' => $clients->count(),
                    'clients_active' => $activeClients->count(),
                    'clients_stuck' => $stuckClients->count(),
                    'clients_done' => $doneClients->count(),
                    'clients_court' => $courtClients->count(),
                    'clients_overdue' => $overdueClientsCount,
                    'overdue_installments' => $overdueInstallmentsCount,
                ],
                'alerts' => [
                    'overdue_amount' => $this->money($overdueInstallmentsAmount),
                ],
                'synced_at' => now()->toDateTimeString(),
            ],
        ]);
    }

    public function installmentsIncome(): JsonResponse
    {
        $clients = Client::with('payments')->get();
        $activeClients = $clients->filter(fn ($client) =>
            $client->status === 'active' && $client->getRemainingAmount() > 0
        );

        $ahmedMonthly = $activeClients->sum(fn ($client) => $this->ahmedMonthlyProfit($client));

        return response()->json([
            'data' => [
                'source' => 'finance',
                'metric' => 'ahmed_installments_income',
                'label' => 'دخل الأقساط لأحمد من Finance',
                'owner' => 'ahmed',
                'period' => 'monthly',
                'amount' => $this->money($ahmedMonthly),
                'currency' => 'SAR',
                'from' => Carbon::now()->startOfMonth()->toDateString(),
                'to' => Carbon::now()->endOfMonth()->toDateString(),
                'synced_at' => now()->toDateTimeString(),
            ],
        ]);
    }

    private function ahmedMonthlyProfit(Client $client): float
    {
        return $client->getMonthlyProfit() * $this->ahmedProfitPercent($client);
    }

    private function aliMonthlyProfit(Client $client): float
    {
        return $client->getMonthlyProfit() * $this->aliProfitPercent($client);
    }

    private function ahmedTotalProfit(Client $client): float
    {
        return $client->getTotalProfit() * $this->ahmedProfitPercent($client);
    }

    private function ahmedProfitPercent(Client $client): float
    {
        return ($client->profit_share ?: 'shared') === 'ahmad_only' ? 1.0 : 0.65;
    }

    private function aliProfitPercent(Client $client): float
    {
        return ($client->profit_share ?: 'shared') === 'ahmad_only' ? 0.0 : 0.35;
    }

    private function money(float|int|null $value): float
    {
        return round((float) ($value ?? 0), 2);
    }
}
