import { Client, PaymentScheduleItem } from '@/types/api';
import { ReportDocument } from '@/types/report';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency, formatDate } from '@/utils/format';

const REPORT_START_PERIOD = '2021-11';

function nowStamp(): string {
  return new Date().toISOString();
}

function money(value: number | string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0;
}

function plainCurrency(value: number): string {
  return formatCurrency(money(value)).replace(' ر.س', '');
}

function plainPercent(value: number): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return '0%';
  return `${Math.round(n * 100) / 100}%`;
}

function monthPeriod(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = String(value).match(/^(\d{4})-(\d{1,2})/);
  if (!match) return null;
  return `${match[1]}-${String(match[2]).padStart(2, '0')}`;
}

function periodLabel(period: string): string {
  const [year, month] = period.split('-');
  return `${month} / ${year}`;
}

function addMonths(period: string, months: number): string {
  const [year, month] = period.split('-').map((part) => Number(part));
  const date = new Date(year, month - 1 + months, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function comparePeriod(a: string, b: string): number {
  return a.localeCompare(b);
}

function selectedClients(clients: Client[]): Client[] {
  return clients
    .filter((client) => {
      const info = getClientAlertInfo(client);
      const remaining = money(client.summary?.remaining_amount);
      const isActive = client.status === 'active' && remaining > 0.01;
      const isLate = info.overdueCount > 0;

      // المطلوب: النشطون والمتأخرون فقط، بدون المنتهي أو المتعثر أو القضايا.
      return !client.has_court && client.status !== 'done' && client.status !== 'stuck' && (isActive || isLate);
    })
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), 'ar'));
}

function schedulePeriod(item: PaymentScheduleItem): string | null {
  return monthPeriod(item.period_key) || monthPeriod(item.due_date);
}

function scheduleAmountByPeriod(client: Client): Record<string, number> {
  const result: Record<string, number> = {};

  for (const item of client.schedule || []) {
    const period = schedulePeriod(item);
    if (!period) continue;
    const amount = money(item.installment_amount ?? item.amount ?? 0);
    result[period] = money((result[period] || 0) + amount);
  }

  return result;
}

function maxReportPeriod(clients: Client[]): string {
  let maxPeriod = REPORT_START_PERIOD;

  for (const client of clients) {
    for (const item of client.schedule || []) {
      const period = schedulePeriod(item);
      if (period && comparePeriod(period, maxPeriod) > 0) {
        maxPeriod = period;
      }
    }
  }

  const current = monthPeriod(new Date().toISOString()) || REPORT_START_PERIOD;
  return comparePeriod(current, maxPeriod) > 0 ? current : maxPeriod;
}

function periodRange(start: string, end: string): string[] {
  const periods: string[] = [];
  let cursor = start;

  while (comparePeriod(cursor, end) <= 0 && periods.length < 240) {
    periods.push(cursor);
    cursor = addMonths(cursor, 1);
  }

  return periods;
}

function clientAhmadAnnual(client: Client): number {
  return money((client.summary?.ahmad_monthly || 0) * 12);
}

function buildInfoRow(label: string, clients: Client[], values: Array<string | number>, total: string | number = '—'): Array<string | number> {
  return [label, ...clients.map((_, index) => values[index] ?? '—'), total];
}

export function buildActiveLateClientsMatrixReport(allClients: Client[]): ReportDocument {
  const clients = selectedClients(allClients);
  const generatedAt = nowStamp();
  const amountMaps = clients.map(scheduleAmountByPeriod);
  const periods = periodRange(REPORT_START_PERIOD, maxReportPeriod(clients));

  const monthlyInstallmentTotal = clients.reduce((sum, client) => sum + money(client.summary?.monthly_installment), 0);
  const ahmadAnnualTotal = clients.reduce((sum, client) => sum + clientAhmadAnnual(client), 0);
  const ahmadMonthlyTotal = clients.reduce((sum, client) => sum + money(client.summary?.ahmad_monthly), 0);

  const rows: Array<Array<string | number>> = [
    buildInfoRow('تاريخ العقد', clients, clients.map((client) => formatDate(client.contract_date))),
    buildInfoRow('عدد الشهور', clients, clients.map((client) => client.months || 0)),
    buildInfoRow('القيمة التمويلية', clients, clients.map((client) => plainCurrency(money(client.summary?.financed_amount || client.principal || client.cost))), plainCurrency(clients.reduce((sum, client) => sum + money(client.summary?.financed_amount || client.principal || client.cost), 0))),
    buildInfoRow('قيمة السند المطالبة', clients, clients.map((client) => plainCurrency(money(client.summary?.bond_total || client.bond_total))), plainCurrency(clients.reduce((sum, client) => sum + money(client.summary?.bond_total || client.bond_total), 0))),
    buildInfoRow('القسط الشهري', clients, clients.map((client) => plainCurrency(money(client.summary?.monthly_installment))), plainCurrency(monthlyInstallmentTotal)),
    buildInfoRow('نسبة الربح', clients, clients.map((client) => plainPercent(money(client.summary?.effective_rate ?? client.rate)))),
    buildInfoRow('نسبة الربح السنوي', clients, clients.map((client) => plainPercent(money(client.summary?.effective_rate ?? client.rate) * 12))),
    buildInfoRow('ربح أحمد السنوي', clients, clients.map((client) => plainCurrency(clientAhmadAnnual(client))), plainCurrency(ahmadAnnualTotal)),
    buildInfoRow('ربح أحمد الشهري', clients, clients.map((client) => plainCurrency(money(client.summary?.ahmad_monthly))), plainCurrency(ahmadMonthlyTotal)),
  ];

  for (const period of periods) {
    const values = clients.map((_, index) => {
      const amount = money(amountMaps[index]?.[period] || 0);
      return amount > 0 ? plainCurrency(amount) : '';
    });
    const total = amountMaps.reduce((sum, map) => sum + money(map[period] || 0), 0);
    rows.push([periodLabel(period), ...values, total > 0 ? plainCurrency(total) : '']);
  }

  return {
    kind: 'active_late_clients_matrix',
    title: 'تقرير العملاء النشطين والمتأخرين',
    subtitle: 'جدول عرضي يبدأ بأسماء العملاء، ويعرض بيانات العقد والأقساط الشهرية من 11 / 2021 مع عمود إجمالي في النهاية.',
    filename: `active-late-clients-matrix-${generatedAt.slice(0, 10)}`,
    generatedAt,
    summary: [
      { label: 'عدد العملاء', value: String(clients.length) },
      { label: 'مجموع الأقساط الشهرية', value: formatCurrency(monthlyInstallmentTotal) },
      { label: 'مجموع ربح أحمد السنوي', value: formatCurrency(ahmadAnnualTotal) },
      { label: 'مجموع ربح أحمد الشهري', value: formatCurrency(ahmadMonthlyTotal) },
      { label: 'بداية التواريخ', value: '11 / 2021' },
      { label: 'آخر شهر في التقرير', value: periodLabel(periods[periods.length - 1] || REPORT_START_PERIOD) },
    ],
    headers: ['البيان', ...clients.map((client) => client.name), 'الإجمالي'],
    rows,
  };
}
