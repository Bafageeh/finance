<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Carbon\Carbon;
use PhpOffice\PhpSpreadsheet\Spreadsheet;
use PhpOffice\PhpSpreadsheet\Style\Alignment;
use PhpOffice\PhpSpreadsheet\Style\Fill;
use PhpOffice\PhpSpreadsheet\Writer\Xlsx;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ActiveLateClientsXlsxReportController extends Controller
{
    public function download(): StreamedResponse
    {
        $clients = Client::with('payments')->orderBy('name')->get()
            ->filter(fn (Client $c) => ! $c->has_court && ! in_array((string) $c->status, ['done', 'stuck', 'cancelled'], true) && $c->getRemainingAmount() > 0.01)
            ->values();

        $book = new Spreadsheet();
        $sheet = $book->getActiveSheet();
        $sheet->setTitle('التقرير');
        $sheet->setRightToLeft(true);

        $headers = array_merge(['البيان'], $clients->pluck('name')->all(), ['الإجمالي']);
        $row = 1;
        $this->row($sheet, $row, $headers, '0F172A', 'FFFFFF', true);

        $info = [
            'تاريخ العقد' => fn ($c) => optional($c->contract_date)->format('Y-m-d') ?: '',
            'عدد الشهور' => fn ($c) => $c->months ?: 0,
            'القيمة التمويلية' => fn ($c) => $c->getFinancedAmount(),
            'قيمة السند المطالبة' => fn ($c) => $c->getCalculatedBondTotal(),
            'القسط الشهري' => fn ($c) => $c->getMonthlyInstallment(),
            'نسبة الربح' => fn ($c) => $c->getEffectiveRate(),
            'نسبة الربح السنوي' => fn ($c) => $c->getEffectiveRate() * 12,
            'ربح أحمد السنوي' => fn ($c) => $c->getSummary()['ahmad_monthly'] * 12,
            'ربح أحمد الشهري' => fn ($c) => $c->getSummary()['ahmad_monthly'],
        ];

        foreach ($info as $label => $getter) {
            $row++;
            $values = [$label];
            $total = 0;
            foreach ($clients as $client) {
                $value = $getter($client);
                if (is_numeric($value)) $total += (float) $value;
                $values[] = $value;
            }
            $values[] = $total ?: '';
            $this->row($sheet, $row, $values, 'FFFFFF');
            $this->style($sheet, "A{$row}", 'E2E8F0', '0F172A', true);
            $this->style($sheet, $this->cell($clients->count() + 2, $row), 'FEF3C7', '0F172A', true);
        }

        foreach ($this->periods($clients) as $period) {
            $row++;
            $sheet->setCellValue("A{$row}", $period->format('m / Y'));
            $this->style($sheet, "A{$row}", 'E2E8F0', '0F172A', true);
            $total = 0;
            foreach ($clients as $i => $client) {
                $slot = collect($client->generateSchedule())->firstWhere('period_key', $period->format('Y-m'));
                $cell = $this->cell($i + 2, $row);
                $paid = (float) ($slot['recorded_paid_amount'] ?? 0);
                $required = (float) ($slot['installment_amount'] ?? 0);
                if ($paid > 0) {
                    $sheet->setCellValue($cell, $this->money($paid));
                    $this->style($sheet, $cell, 'DCFCE7', '166534', true);
                    $total += $paid;
                } elseif ($required > 0 && $period->lessThanOrEqualTo(now()->startOfMonth())) {
                    $sheet->setCellValue($cell, '');
                    $this->style($sheet, $cell, 'FEE2E2', '991B1B', true);
                } elseif ($required > 0) {
                    $sheet->setCellValue($cell, '');
                    $this->style($sheet, $cell, 'DBEAFE', '1D4ED8', true);
                }
            }
            $cell = $this->cell($clients->count() + 2, $row);
            $sheet->setCellValue($cell, $total ? $this->money($total) : '');
            $this->style($sheet, $cell, 'FEF3C7', '0F172A', true);
        }

        $footers = [
            'مجموع المدفوع لكل عميل' => fn ($c) => $c->getSummary()['paid_amount'],
            'المتبقي لتغطية قيمة السند المطلوب' => fn ($c) => $c->getSummary()['remaining_amount'],
            'المتبقي من رأس المال' => fn ($c) => $c->getSummary()['remaining_principal'],
        ];

        foreach ($footers as $label => $getter) {
            $row++;
            $values = [$label];
            $total = 0;
            foreach ($clients as $client) {
                $value = (float) $getter($client);
                $total += $value;
                $values[] = $this->money($value);
            }
            $values[] = $this->money($total);
            $this->row($sheet, $row, $values, 'FEF3C7', '0F172A', true);
        }

        foreach (range(1, $clients->count() + 2) as $col) {
            $sheet->getColumnDimensionByColumn($col)->setWidth($col === 1 ? 28 : 18);
        }
        $sheet->freezePane('B2');

        return response()->streamDownload(function () use ($book) {
            (new Xlsx($book))->save('php://output');
        }, 'active-late-clients-' . now()->format('Y-m-d-His') . '.xlsx', [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        ]);
    }

    private function periods($clients)
    {
        $all = collect();
        foreach ($clients as $client) {
            foreach ($client->generateSchedule() as $slot) {
                $all->push(Carbon::parse($slot['period_key'] . '-01')->startOfMonth());
            }
        }
        if ($all->isEmpty()) return collect([now()->startOfMonth()]);
        $start = $all->min()->copy();
        $end = $all->max()->greaterThan(now()->startOfMonth()) ? $all->max()->copy() : now()->startOfMonth();
        $range = collect();
        while ($start->lessThanOrEqualTo($end)) { $range->push($start->copy()); $start->addMonthNoOverflow(); }
        return $range;
    }

    private function row($sheet, int $row, array $values, string $fill, string $font = '0F172A', bool $bold = false): void
    {
        foreach ($values as $i => $value) {
            $cell = $this->cell($i + 1, $row);
            $sheet->setCellValue($cell, $this->latin($value));
            $this->style($sheet, $cell, $fill, $font, $bold);
        }
    }

    private function style($sheet, string $cell, string $fill, string $font = '0F172A', bool $bold = false): void
    {
        $sheet->getStyle($cell)->applyFromArray([
            'font' => ['bold' => $bold, 'color' => ['rgb' => $font], 'name' => 'Arial', 'size' => 11],
            'fill' => ['fillType' => Fill::FILL_SOLID, 'startColor' => ['rgb' => $fill]],
            'alignment' => ['horizontal' => Alignment::HORIZONTAL_RIGHT, 'vertical' => Alignment::VERTICAL_CENTER, 'wrapText' => true],
        ]);
    }

    private function cell(int $column, int $row): string
    {
        $name = '';
        while ($column > 0) { $mod = ($column - 1) % 26; $name = chr(65 + $mod) . $name; $column = intdiv($column - 1, 26); }
        return $name . $row;
    }

    private function money($value): string
    {
        return number_format(round((float) ($value ?? 0), 2), 2, '.', '');
    }

    private function latin($value): string
    {
        return strtr((string) ($value ?? ''), ['٠'=>'0','١'=>'1','٢'=>'2','٣'=>'3','٤'=>'4','٥'=>'5','٦'=>'6','٧'=>'7','٨'=>'8','٩'=>'9','٫'=>'.','٬'=>',']);
    }
}
