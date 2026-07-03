import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReportDocument } from '@/types/report';
import { formatDate } from '@/utils/format';

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

function colorStyle(tone?: string): string {
  if (tone === 'paid') return 'background:#dcfce7;color:#166534;font-weight:700;';
  if (tone === 'due') return 'background:#dbeafe;color:#1d4ed8;font-weight:700;';
  if (tone === 'late') return 'background:#fee2e2;color:#991b1b;font-weight:700;';
  return '';
}

function tableRows(report: ReportDocument, styled = false): string {
  const extras = report as ReportDocument & { cellStyles?: Record<string, string> };
  const cellStyles = extras.cellStyles || {};
  const totalLabels = ['مجموع المدفوع لكل عميل', 'المتبقي لتغطية قيمة السند المطلوب', 'المتبقي من رأس المال'];

  return report.rows.map((row, rowIndex) => {
    const totalRow = totalLabels.includes(String(row[0] || ''));
    return `<tr>${row.map((cell, colIndex) => {
      const tone = colIndex > 0 ? cellStyles[`${rowIndex}:${colIndex}`] : undefined;
      const fallback = colIndex === 0 ? 'background:#e2e8f0;font-weight:700;' : totalRow ? 'background:#fef3c7;font-weight:700;' : '';
      return `<td style="${styled ? colorStyle(tone) || fallback : ''}">${escapeHtml(toLatinDigits(cell))}</td>`;
    }).join('')}</tr>`;
  }).join('');
}

function baseStyles(): string {
  return `
    body { font-family: Arial, sans-serif; direction: rtl; color: #0f172a; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; direction: rtl; }
    th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: right; border: 1px solid #0f172a; white-space: nowrap; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; text-align: right; }
    .title { background:#ede9fe;color:#4c1d95;font-size:18px;font-weight:700; }
    .summary-label { background:#e0f2fe;color:#075985;font-weight:700; }
  `;
}

function buildHtml(report: ReportDocument): string {
  const headerHtml = report.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>${baseStyles()}</style></head><body>
    <h1>${escapeHtml(report.title)}</h1>
    <p>${escapeHtml(report.subtitle)}</p>
    <p>تاريخ الإنشاء: ${escapeHtml(formatDate(report.generatedAt))}</p>
    ${report.rows.length ? `<table><thead><tr>${headerHtml}</tr></thead><tbody>${tableRows(report)}</tbody></table>` : '<div>لا توجد بيانات في هذا التقرير.</div>'}
  </body></html>`;
}

function buildExcelHtml(report: ReportDocument): string {
  const summaryRows = report.summary.map((item) => `<tr><td class="summary-label">${escapeHtml(toLatinDigits(item.label))}</td><td>${escapeHtml(toLatinDigits(item.value))}</td></tr>`).join('');
  const headerHtml = report.headers.map((header) => `<th>${escapeHtml(toLatinDigits(header))}</th>`).join('');
  const colSpan = Math.max(1, report.headers.length);

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>${baseStyles()} td, th { mso-number-format:'\\@'; }</style></head><body><table>
    <tr><td class="title" colspan="${colSpan}">${escapeHtml(toLatinDigits(report.title))}</td></tr>
    <tr><td colspan="${colSpan}">${escapeHtml(toLatinDigits(report.subtitle))}</td></tr>
    <tr><td colspan="${colSpan}">${escapeHtml(toLatinDigits(`تاريخ الإنشاء: ${formatDate(report.generatedAt)}`))}</td></tr>
    <tr></tr>
    <tr><td class="summary-label">الملخص</td></tr>
    ${summaryRows}
    <tr></tr>
    <tr>${headerHtml}</tr>
    ${tableRows(report, true)}
  </table></body></html>`;
}

function safeFilename(report: ReportDocument, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = (report.filename || report.kind || 'report').replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${base}-${stamp}.${extension}`;
}

export async function exportReportPdf(report: ReportDocument): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(report), base64: false });
  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'pdf')}`;
  await FileSystem.copyAsync({ from: uri, to: target });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, { mimeType: 'application/pdf', dialogTitle: report.title, UTI: 'com.adobe.pdf' });
  }
  return target;
}

export async function exportReportExcelCsv(report: ReportDocument): Promise<string> {
  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'xls')}`;
  await FileSystem.writeAsStringAsync(target, buildExcelHtml(report), { encoding: FileSystem.EncodingType.UTF8 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, { mimeType: 'application/vnd.ms-excel', dialogTitle: report.title, UTI: 'com.microsoft.excel.xls' });
  }
  return target;
}
