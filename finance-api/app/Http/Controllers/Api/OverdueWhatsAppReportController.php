<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OverdueWhatsAppReportService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OverdueWhatsAppReportController extends Controller
{
    public function send(Request $request, OverdueWhatsAppReportService $service): JsonResponse
    {
        $this->authorizeInternalRequest($request);

        $data = $request->validate([
            'to_phone' => ['nullable', 'string', 'max:30'],
            'test' => ['nullable', 'boolean'],
            'pdf' => ['nullable', 'boolean'],
        ]);

        $toPhone = $data['to_phone'] ?? env('FINANCE_OVERDUE_REPORT_WHATSAPP_TO', '0500007650');
        $result = $service->send($toPhone, (bool) ($data['test'] ?? false), (bool) ($data['pdf'] ?? false));

        return response()->json($result);
    }

    private function authorizeInternalRequest(Request $request): void
    {
        $secret = (string) env('FINANCE_INTERNAL_SECRET', env('WHATSAPP_INTERNAL_SECRET', ''));

        if ($secret === '') {
            return;
        }

        $provided = (string) $request->header('X-Finance-Secret', $request->input('secret', ''));

        abort_unless(hash_equals($secret, $provided), 403, 'Forbidden');
    }
}
