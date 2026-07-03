import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { ReportDocument } from '@/types/report';
import { buildXlsxBase64 } from '@/utils/xlsx-export';
import { formatDate } from '@/utils/format';

function escapeHtml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function buildHtml(report: ReportDocument): string {
  const headerHtml = report.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');
  const rowsHtml = report.rows
    .map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`)
    .join('');

  return `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8" /><style>
    body { font-family: Arial, sans-serif; direction: rtl; color: #0f172a; background: #ffffff; }
    table { width: 100%; border-collapse: collapse; direction: rtl; font-size: 10px; }
    th { background: #0f172a; color: #fff; padding: 8px 6px; text-align: right; border: 1px solid #0f172a; white-space: nowrap; }
    td { padding: 7px 6px; border: 1px solid #e2e8f0; vertical-align: top; line-height: 1.5; text-align: right; }
    tr:nth-child(even) td { background: #f8fafc; }
  </style></head><body>
    <h1>${escapeHtml(report.title)}</h1>
    <p>${escapeHtml(report.subtitle)}</p>
    <p>تاريخ الإنشاء: ${escapeHtml(formatDate(report.generatedAt))}</p>
    ${report.rows.length ? `<table><thead><tr>${headerHtml}</tr></thead><tbody>${rowsHtml}</tbody></table>` : '<div>لا توجد بيانات في هذا التقرير.</div>'}
  </body></html>`;
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
  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'xlsx')}`;
  await FileSystem.writeAsStringAsync(target, buildXlsxBase64(report), { encoding: FileSystem.EncodingType.Base64 });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: report.title,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }
  return target;
}
