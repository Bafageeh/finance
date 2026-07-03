import { Client, PaymentScheduleItem } from '@/types/api';
import { ReportDocument } from '@/types/report';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency, formatDate } from '@/utils/format';

type CellTone = 'paid' | 'due' | 'late';

type StyledReportDocument = ReportDocument & {
  cellStyles?: Record<string, CellTone>;
  legend?: Array<{ label: string; tone: CellTone }>;
};

function n(value: number | string | null | undefined): number {
  const numberValue = Number(value ?? 0);
  return Number.isFinite(numberValue) ? Math.round(numberValue * 100) / 100 : 0;
}

function currency(value: number): string {
  return formatCurrency(n(value)).replace(' ر.س', '');
}

function percent(value: number): string {
  return `${n(value)}%`;
}

function toPeriod(value: string | null | undefined): string | null {
  const match = String(value || '').match(/^(\d{4})-(\d{1,2})/);
  return match ? `${match[1]}-${String(match[2]).padStart(2, '0')}` : null;
}

function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${month} / ${year}`;
}

function addMonth(period: string): string {
  const [year, month] = period.split('-').map(Number);
  const date = new Date(year, month, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function activeOrLateClients(clients: Client[]): Client[] {
  return clients
    .filter((client) => {
      const alert = getClientAlertInfo(client);
      const remaining = n(client.summary?.remaining_amount);
      return !client.has_court && client.status !== 'done' && client.status !== 'stuck' && (remaining > 0.01 || alert.overdueCount > 0);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
}

function itemPeriod(item: PaymentScheduleItem): string | null {
  return toPeriod(item.period_key) || toPeriod(item.due_date);
}

function currentPeriod(): string {
  return toPeriod(new Date().toISOString()) || '2021-11';
}

function firstReportPeriod(clients: Client[]): string {
  let minPeriod: string | null = null;
  for (const client of clients) {
    for (const item of client.schedule || []) {
      const period = itemPeriod(item);
      if (!period) continue;
      const paid = n(item.recorded_paid_amount ?? item.paid_amount ?? item.covered_amount ?? 0);
      const required = n(item.installment_amount ?? item.amount ?? 0);
      if (paid > 0 || required > 0) {
        minPeriod = minPeriod === null || period < minPeriod ? period : minPeriod;
      }
    }
  }
  return minPeriod || currentPeriod();
}

function lastReportPeriod(clients: Client[]): string {
  let maxPeriod = firstReportPeriod(clients);
  for (const client of clients) {
    for (const item of client.schedule || []) {
      const period = itemPeriod(item);
      if (period && period > maxPeriod) maxPeriod = period;
    }
  }
  const nowPeriod = currentPeriod();
  return nowPeriod > maxPeriod ? nowPeriod : maxPeriod;
}

function periodRange(start: string, end: string): string[] {
  const periods: string[] = [];
  let cursor = start;
  while (cursor <= end && periods.length < 240) {
    periods.push(cursor);
    cursor = addMonth(cursor);
  }
  return periods;
}

function ahmadAnnual(client: Client): number {
  return n(n(client.summary?.ahmad_monthly) * 12);
}

function infoRow(label: string, clients: Client[], values: Array<string | number>, total: string | number = '—'): Array<string | number> {
  return [label, ...clients.map((_, index) => values[index] ?? '—'), total];
}

function findScheduleItem(client: Client, period: string): PaymentScheduleItem | undefined {
  return (client.schedule || []).find((item) => itemPeriod(item) === period);
}

function scheduleCell(client: Client, period: string, todayPeriod: string): { value: string; amount: number; tone?: CellTone } {
  const item = findScheduleItem(client, period);
  if (!item) return { value: '', amount: 0 };

  const required = n(item.installment_amount ?? item.amount ?? 0);
  if (required <= 0) return { value: '', amount: 0 };

  const paid = n(item.recorded_paid_amount ?? item.paid_amount ?? item.covered_amount ?? 0);

  // المطلوب: لا نعرض مبالغ الدفعات المستقبلية أو المتأخرة، نعرض فقط المبالغ المدفوعة.
  // أما اللون فيوضح الحالة: مدفوع / متأخر / مستقبلي.
  if (paid > 0) {
    return { value: currency(paid), amount: paid, tone: 'paid' };
  }

  if (period <= todayPeriod) {
    return { value: '', amount: 0, tone: 'late' };
  }

  return { value: '', amount: 0, tone: 'due' };
}

export function buildActiveLateClientsMatrixReport(allClients: Client[]): ReportDocument {
  const clients = activeOrLateClients(allClients);
  const startPeriod = firstReportPeriod(clients);
  const periods = periodRange(startPeriod, lastReportPeriod(clients));
  const todayPeriod = currentPeriod();
  const generatedAt = new Date().toISOString();
  const cellStyles: Record<string, CellTone> = {};

  const monthlyTotal = clients.reduce((sum, client) => sum + n(client.summary?.monthly_installment), 0);
  const ahmadAnnualTotal = clients.reduce((sum, client) => sum + ahmadAnnual(client), 0);
  const ahmadMonthlyTotal = clients.reduce((sum, client) => sum + n(client.summary?.ahmad_monthly), 0);
  const financedTotal = clients.reduce((sum, client) => sum + n(client.summary?.financed_amount || client.principal || client.cost), 0);
  const bondTotal = clients.reduce((sum, client) => sum + n(client.summary?.bond_total || client.bond_total), 0);
  const paidTotals = clients.map((client) => n(client.summary?.paid_amount));
  const remainingBondTotals = clients.map((client) => n(client.summary?.remaining_amount));
  const remainingPrincipalTotals = clients.map((client) => n(client.summary?.remaining_principal));

  const rows: Array<Array<string | number>> = [
    infoRow('تاريخ العقد', clients, clients.map((client) => formatDate(client.contract_date))),
    infoRow('عدد الشهور', clients, clients.map((client) => client.months || 0)),
    infoRow('القيمة التمويلية', clients, clients.map((client) => currency(n(client.summary?.financed_amount || client.principal || client.cost))), currency(financedTotal)),
    infoRow('قيمة السند المطالبة', clients, clients.map((client) => currency(n(client.summary?.bond_total || client.bond_total))), currency(bondTotal)),
    infoRow('القسط الشهري', clients, clients.map((client) => currency(n(client.summary?.monthly_installment))), currency(monthlyTotal)),
    infoRow('نسبة الربح', clients, clients.map((client) => percent(n(client.summary?.effective_rate ?? client.rate)))),
    infoRow('نسبة الربح السنوي', clients, clients.map((client) => percent(n(client.summary?.effective_rate ?? client.rate) * 12))),
    infoRow('ربح أحمد السنوي', clients, clients.map((client) => currency(ahmadAnnual(client))), currency(ahmadAnnualTotal)),
    infoRow('ربح أحمد الشهري', clients, clients.map((client) => currency(n(client.summary?.ahmad_monthly))), currency(ahmadMonthlyTotal)),
  ];

  for (const period of periods) {
    const rowIndex = rows.length;
    let total = 0;
    const values = clients.map((client, clientIndex) => {
      const cell = scheduleCell(client, period, todayPeriod);
      if (cell.tone) {
        cellStyles[`${rowIndex}:${clientIndex + 1}`] = cell.tone;
      }
      total += cell.amount;
      return cell.value;
    });

    rows.push([periodLabel(period), ...values, total > 0 ? currency(total) : '']);
  }

  rows.push(
    infoRow('مجموع المدفوع لكل عميل', clients, paidTotals.map(currency), currency(paidTotals.reduce((sum, value) => sum + value, 0))),
    infoRow('المتبقي لتغطية قيمة السند المطلوب', clients, remainingBondTotals.map(currency), currency(remainingBondTotals.reduce((sum, value) => sum + value, 0))),
    infoRow('المتبقي من رأس المال', clients, remainingPrincipalTotals.map(currency), currency(remainingPrincipalTotals.reduce((sum, value) => sum + value, 0))),
  );

  const document: StyledReportDocument = {
    kind: 'portfolio',
    title: 'تقرير العملاء النشطين والمتأخرين',
    subtitle: 'يعرض داخل الشهور المبالغ المدفوعة فقط. الأخضر = مدفوع، الأزرق = دفعة مستقبلية، الأحمر = متأخر.',
    filename: `active-late-clients-matrix-${generatedAt.slice(0, 10)}`,
    generatedAt,
    summary: [
      { label: 'عدد العملاء', value: String(clients.length) },
      { label: 'مجموع الأقساط الشهرية', value: formatCurrency(monthlyTotal) },
      { label: 'مجموع ربح أحمد السنوي', value: formatCurrency(ahmadAnnualTotal) },
      { label: 'مجموع ربح أحمد الشهري', value: formatCurrency(ahmadMonthlyTotal) },
      { label: 'بداية التواريخ', value: periodLabel(startPeriod) },
      { label: 'آخر شهر في التقرير', value: periodLabel(periods[periods.length - 1] || startPeriod) },
    ],
    headers: ['البيان', ...clients.map((client) => client.name), 'الإجمالي'],
    rows,
    cellStyles,
    legend: [
      { label: 'مدفوع', tone: 'paid' },
      { label: 'دفعة مستقبلية', tone: 'due' },
      { label: 'متأخر', tone: 'late' },
    ],
  };

  return document;
}
