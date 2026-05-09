<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use RuntimeException;

class OverduePdfReportService
{
    public function generate(array $lateClients, array $summary, bool $test = false): array
    {
        if (! class_exists(\Mpdf\Mpdf::class)) {
            throw new RuntimeException('مكتبة PDF غير مثبتة. نفذ: composer require mpdf/mpdf');
        }

        $directory = public_path('reports/overdue');
        if (! is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        $date = Carbon::today()->format('Y-m-d');
        $filename = 'finance-overdue-report-' . $date . '-' . now()->format('His') . '.pdf';
        $path = $directory . DIRECTORY_SEPARATOR . $filename;

        $mpdf = new \Mpdf\Mpdf([
            'mode' => 'utf-8',
            'format' => 'A4',
            'default_font' => 'dejavusans',
            'default_font_size' => 11,
            'margin_top' => 14,
            'margin_right' => 10,
            'margin_bottom' => 14,
            'margin_left' => 10,
            'tempDir' => storage_path('app/mpdf-temp'),
        ]);

        $mpdf->SetDirectionality('rtl');
        $mpdf->autoScriptToLang = true;
        $mpdf->autoLangToFont = true;
        $mpdf->SetTitle('تقرير المتأخرين');
        $mpdf->WriteHTML($this->html($lateClients, $summary, $test));
        $mpdf->Output($path, \Mpdf\Output\Destination::FILE);

        return [
            'path' => $path,
            'filename' => $filename,
            'url' => rtrim((string) env('APP_URL', url('/')), '/') . '/reports/overdue/' . $filename,
        ];
    }

    private function html(array $lateClients, array $summary, bool $test): string
    {
        $date = Carbon::today()->format('Y-m-d');
        $rows = '';

        foreach ($lateClients as $index => $client) {
            $rows .= '<tr>'
                . '<td>' . ($index + 1) . '</td>'
                . '<td>' . e($client['name']) . '</td>'
                . '<td>' . e($client['phone'] ?: '-') . '</td>'
                . '<td>' . e((string) $client['count']) . '</td>'
                . '<td>' . number_format((float) $client['amount'], 2) . '</td>'
                . '<td>' . e($client['oldest_due'] ?: '-') . '</td>'
                . '</tr>';
        }

        if ($rows === '') {
            $rows = '<tr><td colspan="6" class="empty">لا يوجد عملاء متأخرون حاليًا بعد استثناء المتعثرين.</td></tr>';
        }

        $badge = $test ? '<div class="test">تجربة إرسال للتقرير اليومي</div>' : '';

        return '<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><style>'
            . 'body{font-family:dejavusans,sans-serif;direction:rtl;text-align:right;color:#111827;}'
            . '.test{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:8px 12px;border-radius:8px;margin-bottom:10px;font-weight:bold;}'
            . '.header{border-bottom:2px solid #111827;padding-bottom:10px;margin-bottom:14px;}'
            . 'h1{font-size:22px;margin:0 0 6px 0;} .subtitle{font-size:12px;color:#4b5563;}'
            . '.cards{width:100%;margin:12px 0;border-collapse:separate;border-spacing:8px 0;}'
            . '.card{border:1px solid #e5e7eb;border-radius:10px;padding:10px;background:#f9fafb;}'
            . '.label{font-size:11px;color:#6b7280;} .value{font-size:17px;font-weight:bold;margin-top:5px;}'
            . 'table.report{width:100%;border-collapse:collapse;margin-top:12px;font-size:10.5px;}'
            . 'table.report th{background:#111827;color:#ffffff;padding:8px;border:1px solid #111827;}'
            . 'table.report td{padding:7px;border:1px solid #d1d5db;vertical-align:top;}'
            . 'table.report tr:nth-child(even) td{background:#f9fafb;}'
            . '.empty{text-align:center;padding:18px;color:#6b7280;} .footer{margin-top:14px;font-size:10px;color:#6b7280;text-align:center;}'
            . '</style></head><body>'
            . $badge
            . '<div class="header"><h1>تقرير المتأخرين باستثناء المتعثرين</h1><div class="subtitle">التاريخ: ' . e($date) . '</div></div>'
            . '<table class="cards"><tr>'
            . '<td class="card"><div class="label">عدد العملاء المتأخرين</div><div class="value">' . number_format((float) $summary['late_clients_count']) . '</div></td>'
            . '<td class="card"><div class="label">إجمالي المبالغ المتأخرة</div><div class="value">' . number_format((float) $summary['total_overdue_amount'], 2) . ' ريال</div></td>'
            . '</tr></table>'
            . '<table class="report"><thead><tr><th>#</th><th>العميل</th><th>الجوال</th><th>عدد الأقساط</th><th>المبلغ المتأخر</th><th>أقدم استحقاق</th></tr></thead><tbody>'
            . $rows
            . '</tbody></table>'
            . '<div class="footer">تم إنشاء التقرير آليًا من نظام Finance</div>'
            . '</body></html>';
    }
}
