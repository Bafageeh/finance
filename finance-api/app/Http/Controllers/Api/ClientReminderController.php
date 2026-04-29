<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use App\Models\ClientReminder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class ClientReminderController extends Controller
{
    public function summary(Client $client): JsonResponse
    {
        $reminders = $client->reminders()->get();
        $latest = $reminders->sortByDesc('target_date')->first();

        return response()->json([
            'data' => [
                'client_id' => $client->id,
                'total' => $reminders->count(),
                'notification_count' => $reminders->where('kind', 'notification')->count(),
                'calendar_count' => $reminders->where('kind', 'calendar')->count(),
                'latest_target_date' => $latest?->target_date?->toDateString(),
            ],
        ]);
    }

    public function upsert(Request $request, Client $client): JsonResponse
    {
        $data = $request->validate([
            'key' => 'required|string|max:190',
            'kind' => ['required', Rule::in(['notification', 'calendar'])],
            'context' => ['required', Rule::in(['follow_up', 'collection_due', 'due_today'])],
            'target_date' => 'required|date',
            'title' => 'required|string|max:255',
            'external_id' => 'nullable|string|max:255',
        ]);

        $record = ClientReminder::updateOrCreate(
            [
                'client_id' => $client->id,
                'key' => $data['key'],
                'kind' => $data['kind'],
            ],
            [
                'context' => $data['context'],
                'target_date' => $data['target_date'],
                'title' => $data['title'],
                'external_id' => $data['external_id'] ?? null,
            ]
        );

        return response()->json([
            'data' => [
                'key' => $record->key,
                'client_id' => (int) $record->client_id,
                'kind' => $record->kind,
                'context' => $record->context,
                'target_date' => $record->target_date?->toDateString(),
                'title' => $record->title,
                'external_id' => $record->external_id,
                'created_at' => $record->created_at?->toISOString(),
                'updated_at' => $record->updated_at?->toISOString(),
            ],
        ]);
    }
}
