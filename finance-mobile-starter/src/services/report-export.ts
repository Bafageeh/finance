import { Buffer } from 'buffer';
import ExcelJS from 'exceljs';
import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReportDocument } from '@/types/report';
import { formatDate } from '@/utils/format';

if (typeof (globalThis as any).Buffer === 'undefined') {
  (globalThis as any).Buffer = Buffer;
}

function escapeHtml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function toLatinDigits(value: string | number): string {
  const eastern = '٠١٢٣٤٥٦٧٨٩';
  const persian = '۰۱۲۳۴۵۶۷۸۹';

  return String(value ?? '')
    .replace(/[٠-٩]/g, (digit) => String(eastern.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String(persian.indexOf(digit)))
    .replace(/٫/g, '.')
    .replace(/٬/g, ',')
    .replace(/‏/g, '')
    .replace(/‎/g, '')
    .trim();
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i];
    const b = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const c = i + 2 < bytes.length ? bytes[i + 2] : 0;
    const triplet = (a << 16) | (b << 8) | c;

    output += alphabet[(triplet >> 18) & 63];
    output += alphabet[(triplet >> 12) & 63];
    output += i + 1 < bytes.length ? alphabet[(triplet >> 6) & 63] : '=';
    output += i + 2 < bytes.length ? alphabet[triplet & 63] : '=';
  }

  return output;
}

function buildHtml(report: ReportDocument): string {
  const summaryHtml = report.summary
    .map(
      (item) => `
        <div class="summary-card">
          <div class="summary-label">${escapeHtml(item.label)}</div>
          <div class="summary-value">${escapeHtml(item.value)}</div>
        </div>
      `,
    )
    .join('');

  const headerHtml = report.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');

  const rowsHtml = report.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8" />
  <style>
    @page { margin: 22px; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif; direction: rtl; color: #0f172a; background: #ffffff; margin: 0; padding: 0; }
    .header { border-bottom: 2px solid #e2e8f0; padding-bottom: 14px; margin-bottom: 16px; }
    h1 { font-size: 24px; margin: 0 0 8px; color: #111827; }
    .subtitle { font-size: 12px; line-height: 1.8; color: #64748b; margin: 0; }
    .generated { margin-top: 8px; color: #64748b; font-size: 11px; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; margin-bottom: 16px; }
    .summary-card { border: 1px solid #e2e8f0; background: #f8fafc; border-radius: 12px; padding: 10px; page-break-inside: avoid; }
    .summary-label { color: #64748b; font-size: 11px; margin-bottom: 6px; }
    .summary-value { color: #0f172a; font-size: 16px; font-weight: 800; }
    table { width: 100%; border-collapse: collapse; font-size: 10px; }
    th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: right; border: 1px solid #0f172a; white-space: nowrap; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; }
    tr:nth-child(even) td { background: #f8fafc; }
    .empty { border: 1px dashed #cbd5e1; color: #64748b; border-radius: 12px; padding: 18px; text-align: center; font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>${escapeHtml(report.title)}</h1>
    <p class="subtitle">${escapeHtml(report.subtitle)}</p>
    <div class="generated">تاريخ الإنشاء: ${escapeHtml(formatDate(report.generatedAt))}</div>
  </div>
  <div class="summary-grid">${summaryHtml}</div>
  ${report.rows.length ? `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>` : '<div class="empty">لا توجد بيانات في هذا التقرير.</div>'}
</body>
</html>`;
}

function safeFilename(report: ReportDocument, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = (report.filename || report.kind || 'report').replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${base}-${stamp}.${extension}`;
}

function styleCell(cell: ExcelJS.Cell, fill: string, fontColor = 'FF0F172A', bold = false) {
  cell.font = { name: 'Arial', size: 11, bold, color: { argb: fontColor } };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
  cell.alignment = { horizontal: 'right', vertical: 'middle', wrapText: true };
  cell.border = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  };
}

async function buildXlsxBase64(report: ReportDocument): Promise<string> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Finance App';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('التقرير', {
    views: [{ rightToLeft: true, state: 'frozen', ySplit: report.summary.length + 7 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const rows: Array<Array<string | number>> = [
    [toLatinDigits(report.title)],
    [toLatinDigits(report.subtitle)],
    [toLatinDigits(`تاريخ الإنشاء: ${formatDate(report.generatedAt)}`)],
    [],
    ['الملخص'],
    ...report.summary.map((item) => [toLatinDigits(item.label), toLatinDigits(item.value)]),
    [],
    report.headers.map(toLatinDigits),
    ...report.rows.map((row) => row.map(toLatinDigits)),
  ];

  rows.forEach((row) => sheet.addRow(row));

  const maxColumns = Math.max(...rows.map((row) => row.length), 1);
  sheet.columns = Array.from({ length: maxColumns }, (_, index) => ({ width: index === 0 ? 32 : 18 }));

  const titleRow = sheet.getRow(1);
  titleRow.height = 28;
  sheet.mergeCells(1, 1, 1, Math.max(1, maxColumns));
  titleRow.eachCell((cell) => styleCell(cell, 'FFEDE9FE', 'FF4C1D95', true));

  sheet.getRow(2).eachCell((cell) => styleCell(cell, 'FFF8FAFC', 'FF475569'));
  sheet.getRow(3).eachCell((cell) => styleCell(cell, 'FFF8FAFC', 'FF475569'));
  sheet.getRow(5).eachCell((cell) => styleCell(cell, 'FFDBEAFE', 'FF1E3A8A', true));

  const summaryStart = 6;
  const summaryEnd = summaryStart + report.summary.length - 1;
  for (let rowIndex = summaryStart; rowIndex <= summaryEnd; rowIndex += 1) {
    sheet.getRow(rowIndex).eachCell((cell, colNumber) => {
      styleCell(cell, colNumber === 1 ? 'FFE0F2FE' : 'FFF8FAFC', colNumber === 1 ? 'FF075985' : 'FF0F172A', colNumber === 1);
    });
  }

  const headerRowIndex = summaryEnd + 2;
  sheet.getRow(headerRowIndex).eachCell((cell) => styleCell(cell, 'FF0F172A', 'FFFFFFFF', true));

  const lastThreeDataLabels = new Set([
    'مجموع المدفوع لكل عميل',
    'المتبقي لتغطية قيمة السند المطلوب',
    'المتبقي من رأس المال',
  ]);

  for (let rowIndex = headerRowIndex + 1; rowIndex <= sheet.rowCount; rowIndex += 1) {
    const row = sheet.getRow(rowIndex);
    const label = String(row.getCell(1).value || '');
    const isTotalRow = lastThreeDataLabels.has(label);
    const fill = isTotalRow ? 'FFFEF3C7' : rowIndex % 2 === 0 ? 'FFFFFFFF' : 'FFF8FAFC';

    row.eachCell((cell, colNumber) => {
      if (colNumber === 1) {
        styleCell(cell, isTotalRow ? 'FFFDE68A' : 'FFE2E8F0', 'FF0F172A', true);
      } else {
        styleCell(cell, fill, 'FF0F172A', isTotalRow);
      }
    });
  }

  const arrayBuffer = await workbook.xlsx.writeBuffer();
  return arrayBufferToBase64(arrayBuffer as ArrayBuffer);
}

export async function exportReportPdf(report: ReportDocument): Promise<string> {
  const html = buildHtml(report);
  const { uri } = await Print.printToFileAsync({ html, base64: false });

  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'pdf')}`;
  await FileSystem.copyAsync({ from: uri, to: target });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: 'application/pdf',
      dialogTitle: report.title,
      UTI: 'com.adobe.pdf',
    });
  }

  return target;
}

export async function exportReportExcelCsv(report: ReportDocument): Promise<string> {
  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'xlsx')}`;
  const base64 = await buildXlsxBase64(report);

  await FileSystem.writeAsStringAsync(target, base64, {
    encoding: FileSystem.EncodingType.Base64,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: report.title,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }

  return target;
}
