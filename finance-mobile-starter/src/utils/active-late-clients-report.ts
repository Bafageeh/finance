import { Client, PaymentScheduleItem } from '@/types/api';
import { ReportDocument } from '@/types/report';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency, formatDate } from '@/utils/format';

const START_PERIOD = '2021-11';

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

function clientScheduleMap(client: Client): Record<string, number> {
  const map: Record<string, number> = {};
  for (const item of client.schedule || []) {
    const period = itemPeriod(item);
    if (!period) continue;
    map[period] = n((map[period] || 0) + n(item.installment_amount ?? item.amount));
  }
  return map;
}

function lastPeriod(clients: Client[]): string {
  let max = START_PERIOD;
  for (const client of clients) {
    for (const item of client.schedule || []) {
      const period = itemPeriod(item);
      if (period && period > max) max = period;
    }
  }
  const current = toPeriod(new Date().toISOString()) || START_PERIOD;
  return current > max ? current : max;
}

function periodsUntil(end: string): string[] {
  const periods: string[] = [];
  let cursor = START_PERIOD;
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

export function buildActiveLateClientsMatrixReport(allClients: Client[]): ReportDocument {
  const clients = activeOrLateClients(allClients);
  const maps = clients.map(clientScheduleMap);
  const periods = periodsUntil(lastPeriod(clients));
  const generatedAt = new Date().toISOString();

  const monthlyTotal = clients.reduce((sum, client) => sum + n(client.summary?.monthly_installment), 0);
  const ahmadAnnualTotal = clients.reduce((sum, client) => sum + ahmadAnnual(client), 0);
  const ahmadMonthlyTotal = clients.reduce((sum, client) => sum + n(client.summary?.ahmad_monthly), 0);
  const financedTotal = clients.reduce((sum, client) => sum + n(client.summary?.financed_amount || client.principal || client.cost), 0);
  const bondTotal = clients.reduce((sum, client) => sum + n(client.summary?.bond_total || client.bond_total), 0);

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
    const values = maps.map((map) => {
      const amount = n(map[period] || 0);
      return amount > 0 ? currency(amount) : '';
    });
    const total = maps.reduce((sum, map) => sum + n(map[period] || 0), 0);
    rows.push([periodLabel(period), ...values, total > 0 ? currency(total) : '']);
  }

  return {
    kind: 'portfolio',
    title: 'تقرير العملاء النشطين والمتأخرين',
    subtitle: 'أسماء العملاء في الصف الأول، وبيانات العقد والأقساط الشهرية من 11 / 2021 في أول عمود، مع إجمالي نهائي.',
    filename: `active-late-clients-matrix-${generatedAt.slice(0, 10)}`,
    generatedAt,
    summary: [
      { label: 'عدد العملاء', value: String(clients.length) },
      { label: 'مجموع الأقساط الشهرية', value: formatCurrency(monthlyTotal) },
      { label: 'مجموع ربح أحمد السنوي', value: formatCurrency(ahmadAnnualTotal) },
      { label: 'مجموع ربح أحمد الشهري', value: formatCurrency(ahmadMonthlyTotal) },
      { label: 'بداية التواريخ', value: '11 / 2021' },
      { label: 'آخر شهر في التقرير', value: periodLabel(periods[periods.length - 1] || START_PERIOD) },
    ],
    headers: ['البيان', ...clients.map((client) => client.name), 'الإجمالي'],
    rows,
  };
}
