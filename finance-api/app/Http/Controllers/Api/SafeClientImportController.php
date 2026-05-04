<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;

class SafeClientImportController extends Controller
{
    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => 'required|string|max:255',
            'id_number' => 'nullable|string|max:20',
            'phone' => 'nullable|string|max:20',
            'asset' => 'nullable|string|max:100',
            'contract_date' => 'required|date',
            'first_installment_date' => 'nullable|date|after_or_equal:contract_date',
            'cost' => 'nullable|numeric|min:0',
            'principal' => 'nullable|numeric|min:0',
            'rate' => 'nullable|numeric|min:0',
            'months' => 'required|integer|min:1|max:360',
            'bond_cost' => 'nullable|numeric|min:0',
            'bond_total' => 'nullable|numeric|min:0',
            'profit_share' => ['nullable', Rule::in(['shared', 'ahmad_only'])],
            'status' => ['nullable', Rule::in(['active', 'stuck', 'done'])],
            'has_court' => 'nullable|boolean',
            'court_note' => 'nullable|string|max:500',
            'notes' => 'nullable|string|max:5000',
            'confirm_insert_only' => 'accepted',
        ]);

        $user = $request->user();
        $accountId = $user?->account_id;

        $payload = $this->normalizePayload($data, $accountId, $user?->id);

        $duplicate = $this->findPotentialDuplicate($payload, $accountId);
        if ($duplicate) {
            return response()->json([
                'message' => 'يوجد عميل مشابه بالفعل. لم يتم تعديل أي سجل. افتح العميل الموجود وعدّله يدويًا إن كان هو نفسه.',
                'data' => [
                    'duplicate' => $this->formatClient($duplicate),
                ],
            ], 409);
        }

        $client = DB::transaction(function () use ($payload) {
            return Client::create($payload)->fresh('payments');
        });

        return response()->json([
            'data' => $this->formatClient($client),
            'message' => 'تم إدخال العميل كسجل جديد مستقل بدون تعديل أي سجل موجود.',
        ], 201);
    }

    private function normalizePayload(array $data, ?int $accountId, ?int $userId): array
    {
        $contractDate = Carbon::parse($data['contract_date'])->startOfDay();
        $firstInstallmentDate = ! empty($data['first_installment_date'])
            ? Carbon::parse($data['first_installment_date'])->startOfDay()
            : $contractDate->copy()->addMonthsNoOverflow(1)->startOfDay();

        $cost = round((float) ($data['cost'] ?? $data['principal'] ?? 0), 2);
        $principal = round((float) ($data['principal'] ?? $cost), 2);

        $payload = [
            'name' => trim((string) $data['name']),
            'id_number' => $this->nullableTrim($data['id_number'] ?? null),
            'phone' => $this->normalizePhone($data['phone'] ?? null),
            'asset' => $this->nullableTrim($data['asset'] ?? null),
            'contract_date' => $contractDate->toDateString(),
            'first_installment_date' => $firstInstallmentDate->toDateString(),
            'cost' => $cost,
            'principal' => $principal,
            'rate' => round((float) ($data['rate'] ?? 0), 4),
            'months' => (int) $data['months'],
            'bond_cost' => round((float) ($data['bond_cost'] ?? 74.75), 2),
            'bond_total' => array_key_exists('bond_total', $data) && $data['bond_total'] !== null && $data['bond_total'] !== ''
                ? round((float) $data['bond_total'], 2)
                : null,
            'profit_share' => $data['profit_share'] ?? 'shared',
            'status' => $data['status'] ?? 'active',
            'has_court' => (bool) ($data['has_court'] ?? false),
            'court_note' => $this->nullableTrim($data['court_note'] ?? null),
            'notes' => $this->nullableTrim($data['notes'] ?? null),
        ];

        if (Schema::hasColumn('clients', 'account_id')) {
            $payload['account_id'] = $accountId;
        }

        if (Schema::hasColumn('clients', 'user_id')) {
            $payload['user_id'] = $userId;
        }

        return $payload;
    }

    private function findPotentialDuplicate(array $payload, ?int $accountId): ?Client
    {
        $query = Client::query()->with('payments');

        if (Schema::hasColumn('clients', 'account_id') && $accountId) {
            $query->where('account_id', $accountId);
        }

        $phone = $payload['phone'] ?? null;
        $idNumber = $payload['id_number'] ?? null;
        $name = $payload['name'] ?? null;

        $query->where(function ($q) use ($phone, $idNumber, $name) {
            if ($phone) {
                $q->orWhere('phone', $phone);
            }

            if ($idNumber) {
                $q->orWhere('id_number', $idNumber);
            }

            if ($name) {
                $q->orWhere(function ($inner) use ($name) {
                    $inner->where('name', $name);
                });
            }
        });

        return $query->first();
    }

    private function formatClient(Client $client): array
    {
        $client->loadMissing('payments');
        $data = array_merge($client->toArray(), ['summary' => $client->getSummary()]);
        $data['schedule'] = $client->generateSchedule();

        return $data;
    }

    private function nullableTrim(mixed $value): ?string
    {
        $value = trim((string) ($value ?? ''));
        return $value === '' ? null : $value;
    }

    private function normalizePhone(mixed $value): ?string
    {
        $phone = preg_replace('/\s+/', '', (string) ($value ?? ''));
        return $phone === '' ? null : $phone;
    }
}
