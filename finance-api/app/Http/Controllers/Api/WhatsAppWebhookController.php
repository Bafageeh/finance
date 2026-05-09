<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\OverdueWhatsAppReportService;
use App\Services\WhatsAppService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Throwable;

class WhatsAppWebhookController extends Controller
{
    public function verify(Request $request)
    {
        $mode = $request->query('hub_mode', $request->query('hub.mode'));
        $token = $request->query('hub_verify_token', $request->query('hub.verify_token'));
        $challenge = $request->query('hub_challenge', $request->query('hub.challenge'));

        if ($mode === 'subscribe' && hash_equals((string) env('WHATSAPP_WEBHOOK_VERIFY_TOKEN'), (string) $token)) {
            return response($challenge, 200)->header('Content-Type', 'text/plain');
        }

        return response('Forbidden', 403);
    }

    public function receive(Request $request, OverdueWhatsAppReportService $reports, WhatsAppService $whatsApp)
    {
        $payload = $request->all();
        $entries = data_get($payload, 'entry', []);

        foreach ($entries as $entry) {
            foreach (data_get($entry, 'changes', []) as $change) {
                $value = data_get($change, 'value', []);

                foreach (data_get($value, 'messages', []) as $message) {
                    $from = (string) data_get($message, 'from', '');
                    $type = (string) data_get($message, 'type', '');
                    $text = trim((string) data_get($message, 'text.body', ''));

                    if ($from === '' || $type !== 'text' || $text === '') {
                        continue;
                    }

                    try {
                        if ($this->isReportCommand($text)) {
                            $reports->send($from, false, true);
                        } elseif ($this->isHelpCommand($text)) {
                            $whatsApp->sendText($from, $this->helpText());
                        }
                    } catch (Throwable $exception) {
                        Log::error('WhatsApp webhook command failed', [
                            'from' => $from,
                            'text' => $text,
                            'error' => $exception->getMessage(),
                        ]);

                        try {
                            $whatsApp->sendText($from, 'تعذر تنفيذ الطلب حاليًا. الرجاء المحاولة لاحقًا.');
                        } catch (Throwable) {
                            // Do not fail the webhook response if fallback notification fails.
                        }
                    }
                }
            }
        }

        return response()->json(['ok' => true]);
    }

    private function isReportCommand(string $text): bool
    {
        $normalized = mb_strtolower(trim($text));

        return in_array($normalized, [
            'تقرير',
            'التقرير',
            'تقرير المتأخرين',
            'المتأخرين',
            'pdf',
            'report',
            'overdue',
        ], true);
    }

    private function isHelpCommand(string $text): bool
    {
        $normalized = mb_strtolower(trim($text));

        return in_array($normalized, ['مساعدة', 'help', 'الاوامر', 'الأوامر'], true);
    }

    private function helpText(): string
    {
        return "أوامر Finance المتاحة:\n"
            . "- ارسل: تقرير\n"
            . "وسيتم إرسال تقرير المتأخرين PDF مع استثناء المتعثرين.";
    }
}
