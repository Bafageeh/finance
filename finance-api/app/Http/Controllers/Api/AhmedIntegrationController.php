<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class AhmedIntegrationController extends Controller
{
    private const AHMED_EMAIL = 'admin@pm.sa';

    public function summary(): JsonResponse
    {
        $clients = $this->ahmedClients();
        $today = Carbon::today();

        $activeClients = $clients->filter(fn ($client) =>
            $client->status === 'active' && $client->getRemainingAmount() > 0
        );
        $stuckClients = $clients->where('status', 'stuck');
        $doneClients = $clients->filter(fn ($client) =>
            $client->status === 'done' || $client->getRemainingAmount() <= 0.01
        );
        $courtClients = $clients->where('has_court', true);

        $monthlyInstallments = $activeClients->sum(fn ($client) => $client->getMonthlyInstallment());
        $ahmedMonthlyProfit = $activeClients->sum(fn ($client) => $this->ahmedMonthlyProfit($client));

        $totalInstallmentsRemaining = $activeClients->sum(fn ($client) => $client->getRemainingAmount());
        $totalPrincipalRemaining = $activeClients->sum(fn ($client) => $client->getRemainingPrincipal());
        $totalAhmedProfit = $activeClients->sum(fn ($client) => $this->ahmedTotalProfit($client));

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
                'account_email' => self::AHMED_EMAIL,
                'currency' => 'SAR',
                'period' => [
                    'type' => 'monthly',
                    'from' => now()->startOfMonth()->toDateString(),
                    'to' => now()->endOfMonth()->toDateString(),
                ],
                'income' => [
                    'monthly_installments_total' => $this->money($monthlyInstallments),
                    'ahmed_monthly_profit' => $this->money($ahmedMonthlyProfit),
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
        $clients = $this->ahmedClients();
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
                'account_email' => self::AHMED_EMAIL,
                'period' => 'monthly',
                'amount' => $this->money($ahmedMonthly),
                'currency' => 'SAR',
                'from' => Carbon::now()->startOfMonth()->toDateString(),
                'to' => Carbon::now()->endOfMonth()->toDateString(),
                'synced_at' => now()->toDateTimeString(),
            ],
        ]);
    }

    private function ahmedClients()
    {
        $accountId = User::query()
            ->where('email', self::AHMED_EMAIL)
            ->value('account_id');

        if (! $accountId) {
            return collect();
        }

        return Client::with('payments')
            ->where('account_id', $accountId)
            ->get();
    }

    private function ahmedMonthlyProfit(Client $client): float
    {
        return $client->getMonthlyProfit() * $this->ahmedProfitPercent($client);
    }

    private function ahmedTotalProfit(Client $client): float
    {
        return $client->getTotalProfit() * $this->ahmedProfitPercent($client);
    }

    private function ahmedProfitPercent(Client $client): float
    {
        return ($client->profit_share ?: 'shared') === 'ahmad_only' ? 1.0 : 0.65;
    }

    private function money(float|int|null $value): float
    {
        return round((float) ($value ?? 0), 2);
    }
}
