<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Client;
use Carbon\Carbon;
use Symfony\Component\HttpFoundation\Response;

class ActiveLateClientsXlsxReportController extends Controller
{
    public function download(): Response
    {
        $clients = Client::with('payments')->orderBy('name')->get()
            ->filter(fn (Client $client) => ! $client->has_court
                && ! in_array((string) $client->status, ['done', 'stuck', 'cancelled'], true)
                && $client->getRemainingAmount() > 0.01)
            ->values();

        $rows = [];
        $rows[] = $this->styledRow(
            array_merge(['البيان'], $clients->pluck('name')->all(), ['الإجمالي']),
            1,
        );

        $info = [
            'تاريخ العقد' => fn (Client $client) => optional($client->contract_date)->format('Y-m-d') ?: '',
            'عدد الشهور' => fn (Client $client) => $client->months ?: 0,
            'القيمة التمويلية' => fn (Client $client) => $client->getFinancedAmount(),
            'قيمة السند المطالبة' => fn (Client $client) => $client->getCalculatedBondTotal(),
            'القسط الشهري' => fn (Client $client) => $client->getMonthlyInstallment(),
            'نسبة الربح' => fn (Client $client) => $client->getEffectiveRate(),
            'نسبة الربح السنوي' => fn (Client $client) => $client->getEffectiveRate() * 12,
            'ربح أحمد السنوي' => fn (Client $client) => $client->getSummary()['ahmad_monthly'] * 12,
            'ربح أحمد الشهري' => fn (Client $client) => $client->getSummary()['ahmad_monthly'],
        ];

        foreach ($info as $label => $getter) {
            $values = [$label];
            $total = 0.0;
            foreach ($clients as $client) {
                $value = $getter($client);
                if (is_numeric($value)) {
                    $total += (float) $value;
                }
                $values[] = $value;
            }
            $values[] = abs($total) > 0.00001 ? round($total, 4) : '';

            $row = $this->styledRow($values, 0);
            $row[0]['style'] = 2;
            $row[count($row) - 1]['style'] = 3;
            $rows[] = $row;
        }

        foreach ($this->periods($clients) as $period) {
            $row = [$this->cell($period->format('m / Y'), 2)];
            $total = 0.0;

            foreach ($clients as $client) {
                $slot = collect($client->generateSchedule())
                    ->firstWhere('period_key', $period->format('Y-m'));
                $paid = (float) ($slot['recorded_paid_amount'] ?? 0);
                $required = (float) ($slot['installment_amount'] ?? 0);
                $dueDate = null;

                if (! empty($slot['due_date'])) {
                    try {
                        $dueDate = Carbon::parse($slot['due_date'])->startOfDay();
                    } catch (\Throwable $e) {
                        $dueDate = null;
                    }
                }

                $isLate = $required > 0
                    && $dueDate !== null
                    && $dueDate->lt(now()->startOfDay());

                if ($paid > 0) {
                    $row[] = $this->cell(round($paid, 2), 4);
                    $total += $paid;
                } elseif ($isLate) {
                    $row[] = $this->cell('', 6);
                } elseif ($required > 0) {
                    $row[] = $this->cell('', 5);
                } else {
                    $row[] = $this->cell('', 0);
                }
            }

            $row[] = $this->cell($total > 0 ? round($total, 2) : '', 3);
            $rows[] = $row;
        }

        $footers = [
            'مجموع المدفوع لكل عميل' => fn (Client $client) => $client->getSummary()['paid_amount'],
            'المتبقي لتغطية قيمة السند المطلوب' => fn (Client $client) => $client->getSummary()['remaining_amount'],
            'المتبقي من رأس المال' => fn (Client $client) => $client->getSummary()['remaining_principal'],
        ];

        foreach ($footers as $label => $getter) {
            $values = [$label];
            $total = 0.0;
            foreach ($clients as $client) {
                $value = (float) $getter($client);
                $total += $value;
                $values[] = round($value, 2);
            }
            $values[] = round($total, 2);
            $rows[] = $this->styledRow($values, 3);
        }

        $xlsx = $this->buildXlsx($rows, $clients->count() + 2);
        $filename = 'active-late-clients-' . now()->format('Y-m-d-His') . '.xlsx';

        return response($xlsx, 200, [
            'Content-Type' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'Content-Disposition' => 'attachment; filename="' . $filename . '"',
            'Content-Length' => (string) strlen($xlsx),
            'Cache-Control' => 'private, no-store, no-cache, must-revalidate',
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

        if ($all->isEmpty()) {
            return collect([now()->startOfMonth()]);
        }

        $start = $all->min()->copy();
        $end = $all->max()->greaterThan(now()->startOfMonth())
            ? $all->max()->copy()
            : now()->startOfMonth();
        $range = collect();

        while ($start->lessThanOrEqualTo($end)) {
            $range->push($start->copy());
            $start->addMonthNoOverflow();
        }

        return $range;
    }

    private function cell(mixed $value, int $style = 0): array
    {
        return ['value' => $value, 'style' => $style];
    }

    private function styledRow(array $values, int $style): array
    {
        return array_map(fn (mixed $value) => $this->cell($value, $style), $values);
    }

    private function buildXlsx(array $rows, int $columnCount): string
    {
        $sheetRows = [];
        foreach ($rows as $rowIndex => $row) {
            $cells = [];
            foreach ($row as $columnIndex => $cell) {
                $reference = $this->columnName($columnIndex + 1) . ($rowIndex + 1);
                $style = (int) ($cell['style'] ?? 0);
                $value = $cell['value'] ?? '';

                if (is_int($value) || is_float($value)) {
                    $cells[] = '<c r="' . $reference . '" s="' . $style . '"><v>'
                        . $this->number($value) . '</v></c>';
                } else {
                    $cells[] = '<c r="' . $reference . '" s="' . $style . '" t="inlineStr"><is><t xml:space="preserve">'
                        . $this->xml($this->latin($value)) . '</t></is></c>';
                }
            }
            $sheetRows[] = '<row r="' . ($rowIndex + 1) . '">' . implode('', $cells) . '</row>';
        }

        $lastColumn = $this->columnName(max(1, $columnCount));
        $sheet = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
            . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
            . '<sheetViews><sheetView rightToLeft="1" workbookViewId="0">'
            . '<pane xSplit="1" ySplit="1" topLeftCell="B2" activePane="bottomRight" state="frozen"/>'
            . '</sheetView></sheetViews>'
            . '<cols><col min="1" max="1" width="28" customWidth="1"/>'
            . '<col min="2" max="' . max(2, $columnCount) . '" width="18" customWidth="1"/></cols>'
            . '<sheetData>' . implode('', $sheetRows) . '</sheetData>'
            . '<autoFilter ref="A1:' . $lastColumn . '1"/>'
            . '</worksheet>';

        $styles = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            . '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            . '<fonts count="4">'
            . '<font><sz val="11"/><name val="Arial"/><family val="2"/></font>'
            . '<font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Arial"/></font>'
            . '<font><b/><color rgb="FF0F172A"/><sz val="11"/><name val="Arial"/></font>'
            . '<font><b/><color rgb="FF991B1B"/><sz val="11"/><name val="Arial"/></font>'
            . '</fonts>'
            . '<fills count="8">'
            . '<fill><patternFill patternType="none"/></fill>'
            . '<fill><patternFill patternType="gray125"/></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FF0F172A"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFE2E8F0"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFFEF3C7"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFDCFCE7"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFDBEAFE"/><bgColor indexed="64"/></patternFill></fill>'
            . '<fill><patternFill patternType="solid"><fgColor rgb="FFFEE2E2"/><bgColor indexed="64"/></patternFill></fill>'
            . '</fills>'
            . '<borders count="2"><border/><border>'
            . '<left style="thin"><color rgb="FFE2E8F0"/></left>'
            . '<right style="thin"><color rgb="FFE2E8F0"/></right>'
            . '<top style="thin"><color rgb="FFE2E8F0"/></top>'
            . '<bottom style="thin"><color rgb="FFE2E8F0"/></bottom>'
            . '</border></borders>'
            . '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>'
            . '<cellXfs count="7">'
            . $this->xf(0, 0, 1)
            . $this->xf(1, 2, 1)
            . $this->xf(2, 3, 1)
            . $this->xf(2, 4, 1)
            . $this->xf(2, 5, 1)
            . $this->xf(2, 6, 1)
            . $this->xf(3, 7, 1)
            . '</cellXfs>'
            . '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>'
            . '</styleSheet>';

        $files = [
            '[Content_Types].xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
                . '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
                . '<Default Extension="xml" ContentType="application/xml"/>'
                . '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
                . '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
                . '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
                . '</Types>',
            '_rels/.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                . '</Relationships>',
            'xl/workbook.xml' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                . 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                . '<workbookViews><workbookView firstSheet="0" activeTab="0"/></workbookViews>'
                . '<sheets><sheet name="التقرير" sheetId="1" r:id="rId1"/></sheets>'
                . '</workbook>',
            'xl/_rels/workbook.xml.rels' => '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                . '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                . '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
                . '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
                . '</Relationships>',
            'xl/styles.xml' => $styles,
            'xl/worksheets/sheet1.xml' => $sheet,
        ];

        return $this->zip($files);
    }

    private function xf(int $fontId, int $fillId, int $borderId): string
    {
        return '<xf numFmtId="0" fontId="' . $fontId . '" fillId="' . $fillId
            . '" borderId="' . $borderId . '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">'
            . '<alignment horizontal="right" vertical="center" wrapText="1" readingOrder="2"/>'
            . '</xf>';
    }

    private function zip(array $files): string
    {
        $body = '';
        $directory = '';
        $offset = 0;
        $count = 0;

        foreach ($files as $name => $content) {
            $name = (string) $name;
            $content = (string) $content;
            $nameLength = strlen($name);
            $size = strlen($content);
            $crc = (int) sprintf('%u', crc32($content));
            $flags = 0x0800;

            $local = pack(
                'VvvvvvVVVvv',
                0x04034b50,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
            ) . $name . $content;

            $directory .= pack(
                'VvvvvvvVVVvvvvvVV',
                0x02014b50,
                20,
                20,
                $flags,
                0,
                0,
                0,
                $crc,
                $size,
                $size,
                $nameLength,
                0,
                0,
                0,
                0,
                0,
                $offset,
            ) . $name;

            $body .= $local;
            $offset += strlen($local);
            $count++;
        }

        $directoryOffset = strlen($body);
        $body .= $directory;
        $body .= pack(
            'VvvvvVVv',
            0x06054b50,
            0,
            0,
            $count,
            $count,
            strlen($directory),
            $directoryOffset,
            0,
        );

        return $body;
    }

    private function columnName(int $column): string
    {
        $name = '';
        while ($column > 0) {
            $mod = ($column - 1) % 26;
            $name = chr(65 + $mod) . $name;
            $column = intdiv($column - 1, 26);
        }

        return $name;
    }

    private function number(int|float $value): string
    {
        return rtrim(rtrim(number_format((float) $value, 4, '.', ''), '0'), '.');
    }

    private function xml(mixed $value): string
    {
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', (string) $value) ?? '';
        return htmlspecialchars($text, ENT_QUOTES | ENT_XML1, 'UTF-8');
    }

    private function latin(mixed $value): string
    {
        return strtr((string) ($value ?? ''), [
            '٠' => '0', '١' => '1', '٢' => '2', '٣' => '3', '٤' => '4',
            '٥' => '5', '٦' => '6', '٧' => '7', '٨' => '8', '٩' => '9',
            '٫' => '.', '٬' => ',',
        ]);
    }
}
