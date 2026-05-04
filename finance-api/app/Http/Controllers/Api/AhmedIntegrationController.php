<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Carbon;

class AhmedIntegrationController extends Controller
{
    public function installmentsIncome(): JsonResponse
    {
        $clients = Client::with('payments')->get();
        $activeClients = $clients->filter(fn ($client) =>
            $client->status === 'active' && $client->getRemainingAmount() > 0
        );

        $ahmadMonthly = $activeClients->sum(function ($client) {
            $profitShare = $client->profit_share ?: 'shared';
            $ahmadPct = $profitShare === 'ahmad_only' ? 1.0 : 0.65;

            return $client->getMonthlyProfit() * $ahmadPct;
        });

        return response()->json([
            'data' => [
                'source' => 'finance',
                'metric' => 'ahmad_installments_income',
                'label' => 'دخل الأقساط لأحمد من Finance',
                'owner' => 'ahmed',
                'period' => 'monthly',
                'amount' => round($ahmadMonthly, 2),
                'currency' => 'SAR',
                'from' => Carbon::now()->startOfMonth()->toDateString(),
                'to' => Carbon::now()->endOfMonth()->toDateString(),
                'synced_at' => now()->toDateTimeString(),
            ],
        ]);
    }
}
