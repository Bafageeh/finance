import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as SecureStore from 'expo-secure-store';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { ReportDocument } from '@/types/report';
import { buildXlsxBase64 } from '@/utils/xlsx-export';
import { formatDate } from '@/utils/format';

const SESSION_STORAGE_KEY = 'finance.savedSession.v2';
const SERVER_XLSX_ENDPOINTS: Record<string, string> = {
  'تقرير العملاء النشطين والمتأخرين': '/reports/active-late-clients-xlsx',
  'تقرير جميع العملاء باستثناء المنتهين': '/reports/active-late-clients-xlsx?scope=all-except-done',
};

function escapeHtml(value: string | number): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function resolveApiBase(): string {
  return (
    process.env.EXPO_PUBLIC_API_BASE_URL
    || process.env.EXPO_PUBLIC_API_URL
    || 'https://finance.pm.sa/api/v1'
  ).replace(/\/$/, '');
}

async function readAuthToken(): Promise<string | null> {
  try {
    const raw = Platform.OS === 'web'
      ? (typeof window !== 'undefined' ? window.localStorage.getItem(SESSION_STORAGE_KEY) : null)
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

    if (!raw) return null;

    const session = JSON.parse(raw) as { token?: string | null };
    return session.token || null;
  } catch {
    return null;
  }
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

async function downloadServerXlsx(report: ReportDocument, endpoint: string): Promise<string> {
  const token = await readAuthToken();

  if (!token) {
    throw new Error('لم يتم العثور على جلسة دخول صالحة لتحميل ملف XLSX من الخادم.');
  }

  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'xlsx')}`;

  const result = await FileSystem.downloadAsync(
    `${resolveApiBase()}${endpoint}`,
    target,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      },
    },
  );

  if (result.status < 200 || result.status >= 300) {
    throw new Error(`تعذر تحميل ملف XLSX من الخادم. الرمز: ${result.status}`);
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(result.uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: report.title,
      UTI: 'org.openxmlformats.spreadsheetml.sheet',
    });
  }

  return result.uri;
}

export async function exportReportPdf(report: ReportDocument): Promise<string> {
  const { uri } = await Print.printToFileAsync({ html: buildHtml(report), base64: false });
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
  const serverEndpoint = SERVER_XLSX_ENDPOINTS[report.title];
  if (serverEndpoint) {
    return downloadServerXlsx(report, serverEndpoint);
  }

  const target = `${FileSystem.documentDirectory}${safeFilename(report, 'xlsx')}`;

  await FileSystem.writeAsStringAsync(target, buildXlsxBase64(report), {
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
