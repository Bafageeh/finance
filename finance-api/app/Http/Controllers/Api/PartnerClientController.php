<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PartnerClientController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $this->ensureAli($request);

        $clients = Client::withoutGlobalScope('account')
            ->with(['payments' => fn ($query) => $query->withoutGlobalScope('account')])
            ->where('profit_share', 'shared')
            ->orderByDesc('created_at')
            ->get();

        $accountNames = $this->accountNamesFor($clients);

        return response()->json([
            'data' => $clients->map(fn (Client $client) => $this->formatPartnerClient($client, $accountNames, false))->values(),
        ]);
    }

    public function show(Request $request, int|string $client): JsonResponse
    {
        $this->ensureAli($request);

        $clientModel = Client::withoutGlobalScope('account')
            ->with(['payments' => fn ($query) => $query->withoutGlobalScope('account')])
            ->where('profit_share', 'shared')
            ->whereKey($client)
            ->firstOrFail();

        $accountNames = $this->accountNamesFor(collect([$clientModel]));

        return response()->json([
            'data' => $this->formatPartnerClient($clientModel, $accountNames, true),
        ]);
    }

    private function ensureAli(Request $request): void
    {
        $user = $request->user()?->loadMissing('account');
        $email = strtolower((string) ($user?->email ?? ''));
        $accountSlug = strtolower((string) ($user?->account?->slug ?? ''));

        abort_if($email !== 'ali@pm.sa' && $accountSlug !== 'ali', 403, 'هذه الشاشة مخصصة لحساب علي فقط.');
    }

    private function accountNamesFor($clients): array
    {
        return DB::table('accounts')
            ->whereIn('id', $clients->pluck('account_id')->filter()->unique()->values())
            ->pluck('name', 'id')
            ->all();
    }

    private function formatPartnerClient(Client $client, array $accountNames, bool $withSchedule): array
    {
        $summary = $client->getSummary();
        $row = array_merge($client->toArray(), [
            'summary' => $summary,
            'read_only' => true,
            'source_account_id' => $client->account_id,
            'source_account_name' => $accountNames[$client->account_id] ?? 'حساب غير محدد',
            'partner_profit_total' => $summary['ali_total'] ?? 0,
            'partner_profit_monthly' => $summary['ali_monthly'] ?? 0,
        ]);

        if ($withSchedule) {
            $row['schedule'] = $client->generateSchedule();
        }

        return $row;
    }
}
