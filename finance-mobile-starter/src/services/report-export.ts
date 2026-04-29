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

function csvCell(value: string | number): string {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return `"${text.replace(/"/g, '""')}"`;
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
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      direction: rtl;
      color: #0f172a;
      background: #ffffff;
      margin: 0;
      padding: 0;
    }
    .header {
      border-bottom: 2px solid #e2e8f0;
      padding-bottom: 14px;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 24px;
      margin: 0 0 8px;
      color: #111827;
    }
    .subtitle {
      font-size: 12px;
      line-height: 1.8;
      color: #64748b;
      margin: 0;
    }
    .generated {
      margin-top: 8px;
      color: #64748b;
      font-size: 11px;
    }
    .summary-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 16px;
    }
    .summary-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 12px;
      padding: 10px;
      page-break-inside: avoid;
    }
    .summary-label {
      color: #64748b;
      font-size: 11px;
      margin-bottom: 6px;
    }
    .summary-value {
      color: #0f172a;
      font-size: 16px;
      font-weight: 800;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
    }
    th {
      background: #0f172a;
      color: #fff;
      padding: 8px 6px;
      text-align: right;
      border: 1px solid #0f172a;
      white-space: nowrap;
    }
    td {
      padding: 7px 6px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
      line-height: 1.5;
    }
    tr:nth-child(even) td { background: #f8fafc; }
    .empty {
      border: 1px dashed #cbd5e1;
      color: #64748b;
      border-radius: 12px;
      padding: 18px;
      text-align: center;
      font-size: 13px;
    }
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

function buildCsv(report: ReportDocument): string {
  const titleRows = [
    [report.title],
    [report.subtitle],
    [`تاريخ الإنشاء: ${formatDate(report.generatedAt)}`],
    [],
    ['الملخص'],
    ...report.summary.map((item) => [item.label, item.value]),
    [],
  ];

  const dataRows = [report.headers, ...report.rows];
  const allRows = [...titleRows, ...dataRows];
  return `\uFEFF${allRows.map((row) => row.map(csvCell).join(',')).join('\n')}`;
}

function safeFilename(report: ReportDocument, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  const base = (report.filename || report.kind || 'report').replace(/[^a-zA-Z0-9-_]/g, '-');
  return `${base}-${stamp}.${extension}`;
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
  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'csv')}`;
  await FileSystem.writeAsStringAsync(target, buildCsv(report), {
    encoding: FileSystem.EncodingType.UTF8,
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(target, {
      mimeType: 'text/csv',
      dialogTitle: report.title,
      UTI: 'public.comma-separated-values-text',
    });
  }

  return target;
}
