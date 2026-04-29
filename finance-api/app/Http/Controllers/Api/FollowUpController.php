<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\FollowUp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Validation\Rule;

class FollowUpController extends Controller
{
    public function index(Client $client): JsonResponse
    {
        return response()->json([
            'data' => $client->followUps()->get()->map(fn (FollowUp $record) => $this->formatRecord($record))->values(),
        ]);
    }

    public function store(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'outcome' => ['required', Rule::in(['contacted', 'promise', 'no_answer', 'excused', 'court'])],
            'note' => 'nullable|string|max:2000',
            'next_follow_up_at' => 'nullable|date',
            'channel' => ['nullable', Rule::in(['whatsapp', 'call', 'manual'])],
        ]);

        $record = $client->followUps()->create([
            'outcome' => $data['outcome'],
            'note' => $data['note'] ?? null,
            'next_follow_up_at' => $data['next_follow_up_at'] ?? null,
            'channel' => $data['channel'] ?? 'manual',
        ]);

        return response()->json(['data' => $this->formatRecord($record)], 201);
    }

    public function summary(Client $client): JsonResponse
    {
        return response()->json(['data' => $this->buildSummary($client->id, $client->followUps()->get())]);
    }

    public function summaries(Request $request): JsonResponse
    {
        $ids = collect(explode(',', (string) $request->query('client_ids', '')))
            ->map(fn ($value) => (int) trim($value))
            ->filter(fn ($value) => $value > 0)
            ->values();

        if ($ids->isEmpty()) {
            return response()->json(['data' => []]);
        }

        $records = FollowUp::whereIn('client_id', $ids)->latest('created_at')->get()->groupBy('client_id');
        $summaries = [];

        foreach ($ids as $id) {
            $summaries[(string) $id] = $this->buildSummary($id, $records->get($id, collect()));
        }

        return response()->json(['data' => $summaries]);
    }

    private function buildSummary(int $clientId, $records): array
    {
        $records = collect($records)->sortByDesc(fn ($item) => strtotime((string) $item->created_at))->values();
        $last = $records->first();
        $today = Carbon::today();

        $nextFollow = $records
            ->map(fn ($item) => $item->next_follow_up_at ? Carbon::parse($item->next_follow_up_at) : null)
            ->filter(fn ($date) => $date && $date->greaterThanOrEqualTo($today))
            ->sortBy(fn ($date) => $date->timestamp)
            ->first();

        return [
            'client_id' => $clientId,
            'count' => $records->count(),
            'last_outcome' => $last?->outcome,
            'last_note' => $last?->note,
            'last_contact_at' => $last?->created_at?->toISOString(),
            'next_follow_up_at' => $nextFollow?->toDateString(),
            'last_channel' => $last?->channel,
        ];
    }

    private function formatRecord(FollowUp $record): array
    {
        return [
            'id' => (string) $record->id,
            'client_id' => (int) $record->client_id,
            'outcome' => $record->outcome,
            'note' => $record->note,
            'created_at' => $record->created_at?->toISOString(),
            'next_follow_up_at' => $record->next_follow_up_at?->toDateString(),
            'channel' => $record->channel,
        ];
    }
}
