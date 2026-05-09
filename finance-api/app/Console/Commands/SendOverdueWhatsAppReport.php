<?php

namespace App\Console\Commands;

use App\Services\OverdueWhatsAppReportService;
use Illuminate\Console\Command;

class SendOverdueWhatsAppReport extends Command
{
    protected $signature = 'finance:send-overdue-whatsapp-report {--to= : رقم الواتساب المستلم} {--test : إضافة عبارة تجربة في بداية التقرير}';

    protected $description = 'إرسال تقرير المتأخرين باستثناء المتعثرين عبر واتساب';

    public function handle(OverdueWhatsAppReportService $service): int
    {
        $toPhone = (string) ($this->option('to') ?: env('FINANCE_OVERDUE_REPORT_WHATSAPP_TO', '0500007650'));
        $result = $service->send($toPhone, (bool) $this->option('test'));

        $this->info('تم إرسال تقرير المتأخرين عبر واتساب.');
        $this->line('الرقم: ' . $result['to_phone']);
        $this->line('عدد المتأخرين: ' . $result['summary']['late_clients_count']);
        $this->line('إجمالي المتأخرات: ' . number_format((float) $result['summary']['total_overdue_amount'], 2) . ' ريال');

        return self::SUCCESS;
    }
}
