<?php

namespace App\Console\Commands;

use App\Services\OverdueWhatsAppReportService;
use Illuminate\Console\Command;

class SendOverdueWhatsAppReport extends Command
{
    protected $signature = 'finance:send-overdue-whatsapp-report {--to= : Recipient WhatsApp number} {--test : Prefix report as a test} {--pdf : Send report as PDF document}';

    protected $description = 'Send overdue clients report excluding stuck clients via WhatsApp';

    public function handle(OverdueWhatsAppReportService $service): int
    {
        $toPhone = (string) ($this->option('to') ?: env('FINANCE_OVERDUE_REPORT_WHATSAPP_TO', '0500007650'));
        $result = $service->send($toPhone, (bool) $this->option('test'), (bool) $this->option('pdf'));

        $this->info('WhatsApp overdue report sent.');
        $this->line('Type: ' . ($result['type'] ?? 'text'));
        $this->line('Phone: ' . $result['to_phone']);
        $this->line('Late clients: ' . $result['summary']['late_clients_count']);
        $this->line('Total overdue: ' . number_format((float) $result['summary']['total_overdue_amount'], 2));

        if (! empty($result['file']['url'])) {
            $this->line('PDF URL: ' . $result['file']['url']);
        }

        return self::SUCCESS;
    }
}
