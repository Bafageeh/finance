<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\Payment;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartnerClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $email = strtolower((string) ($user?->email ?? ''));
        $accountSlug = strtolower((string) ($user?->account?->slug ?? ''));

        if ($email !== 'ali@pm.sa' && $accountSlug !== 'ali') {
            return response()->json([
                'message' => 'هذه الشاشة مخصصة لحساب علي فقط.',
            ], 403);
        }

        $clients = Client::withoutGlobalScope('account')
            ->with(['payments' => fn ($query) => $query->withoutGlobalScope('account')])
            ->where('profit_share', 'shared')
            ->orderByDesc('created_at')
            ->get();

        $accountNames = DB::table('accounts')
            ->whereIn('id', $clients->pluck('account_id')->filter()->unique()->values())
            ->pluck('name', 'id');

        $data = $clients->map(function (Client $client) use ($accountNames) {
            $summary = $client->getSummary();
            $row = array_merge($client->toArray(), [
                'summary' => $summary,
                'read_only' => true,
                'source_account_id' => $client->account_id,
                'source_account_name' => $accountNames[$client->account_id] ?? 'حساب غير محدد',
                'partner_profit_total' => $summary['ali_total'] ?? 0,
                'partner_profit_monthly' => $summary['ali_monthly'] ?? 0,
            ]);

            return $row;
        })->values();

        return response()->json([
            'data' => $data,
        ]);
    }
}
