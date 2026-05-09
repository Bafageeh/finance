<?php

namespace App\Services;

use App\Models\Client;
use Illuminate\Support\Carbon;
use Throwable;

class OverdueWhatsAppReportService
{
    public function __construct(
        private readonly WhatsAppService $whatsApp,
        private readonly OverduePdfReportService $pdfReport,
    ) {
    }

    public function send(string $toPhone, bool $test = false, bool $pdf = false): array
    {
        $report = $this->buildReport($test);

        if ($pdf) {
            $file = $this->pdfReport->generate($report['late_clients'], $report['summary'], $test);
            $caption = ($test ? 'تجربة إرسال للتقرير اليومي' . "\n" : '')
                . 'تقرير المتأخرين باستثناء المتعثرين - ' . Carbon::today()->format('Y-m-d');
            $response = $this->whatsApp->sendDocument($toPhone, $file['url'], $file['filename'], $caption);

            return [
                'ok' => true,
                'type' => 'pdf',
                'to_phone' => $this->whatsApp->normalizeSaudiPhone($toPhone),
                'summary' => $report['summary'],
                'file' => $file,
                'provider_response' => $response,
            ];
        }

        $response = $this->whatsApp->sendText($toPhone, $report['body']);

        return [
            'ok' => true,
            'type' => 'text',
            'to_phone' => $this->whatsApp->normalizeSaudiPhone($toPhone),
            'summary' => $report['summary'],
            'provider_response' => $response,
        ];
    }

    public function buildReport(bool $test = false): array
    {
        $today = Carbon::today();
        $clients = Client::with('payments')
            ->where('status', '!=', 'stuck')
            ->orderBy('name')
            ->get();

        $lateClients = [];

        foreach ($clients as $client) {
            if ($client->getRemainingAmount() <= 0.01) {
                continue;
            }

            $overdue = collect($client->generateSchedule())
                ->filter(function (array $slot) use ($today) {
                    try {
                        return (float) ($slot['remaining_due'] ?? 0) > 0.01
                            && Carbon::parse($slot['due_date'])->lte($today);
                    } catch (Throwable) {
                        return false;
                    }
                })
                ->values();

            if ($overdue->isEmpty()) {
                continue;
            }

            $lateClients[] = [
                'name' => (string) $client->name,
                'phone' => (string) ($client->phone ?? ''),
                'count' => $overdue->count(),
                'amount' => round($overdue->sum(fn ($slot) => (float) ($slot['remaining_due'] ?? $slot['amount'] ?? 0)), 2),
                'oldest_due' => optional($overdue->sortBy('due_date')->first())['due_date'] ?? null,
            ];
        }

        usort($lateClients, fn ($a, $b) => $b['amount'] <=> $a['amount']);

        $totalAmount = round(array_sum(array_column($lateClients, 'amount')), 2);
        $lines = [];

        if ($test) {
            $lines[] = 'تجربة إرسال للتقرير اليومي';
            $lines[] = '';
        }

        $lines[] = 'تقرير المتأخرين باستثناء المتعثرين';
        $lines[] = 'التاريخ: ' . $today->format('Y-m-d');
        $lines[] = 'عدد العملاء المتأخرين: ' . count($lateClients);
        $lines[] = 'إجمالي المبالغ المتأخرة: ' . number_format($totalAmount, 2) . ' ريال';
        $lines[] = '';

        if ($lateClients === []) {
            $lines[] = 'لا يوجد عملاء متأخرون حاليًا بعد استثناء المتعثرين.';
        } else {
            foreach ($lateClients as $index => $client) {
                $line = ($index + 1) . '. ' . $client['name']
                    . ' - ' . number_format((float) $client['amount'], 2) . ' ريال'
                    . ' - عدد الأقساط: ' . $client['count'];

                if (! empty($client['oldest_due'])) {
                    $line .= ' - أقدم استحقاق: ' . $client['oldest_due'];
                }

                if (! empty($client['phone'])) {
                    $line .= ' - جوال: ' . $client['phone'];
                }

                $lines[] = $line;
            }
        }

        return [
            'body' => implode("\n", $lines),
            'late_clients' => $lateClients,
            'summary' => [
                'late_clients_count' => count($lateClients),
                'total_overdue_amount' => $totalAmount,
            ],
        ];
    }
}
