import * as React from 'react';
import { Client, ClientSummary, PaymentScheduleItem, ProfitShare, StatsData } from '@/types/api';

export interface ClientAlertInfo {
  overdueCount: number;
  overdueAmount: number;
  previousDueAmount: number;
  paidAmount: number;
  monthlyInstallment: number;
  nextUpcoming: PaymentScheduleItem | null;
  daysUntilNext: number | null;
}

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function padMonth(value: number): string {
  return String(value).padStart(2, '0');
}

function numeric(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseDateOnly(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function todayOnly(referenceDate = new Date()): Date {
  const today = new Date(referenceDate);
  today.setHours(0, 0, 0, 0);
  return today;
}

function isBeforeToday(dateString: unknown, referenceDate = new Date()): boolean {
  const dueDate = parseDateOnly(dateString);
  if (!dueDate) return false;
  return dueDate < todayOnly(referenceDate);
}

function sortByDueDateAsc(a: PaymentScheduleItem, b: PaymentScheduleItem): number {
  return String(a.due_date || '').localeCompare(String(b.due_date || ''));
}

function normalizePeriodKeyValue(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).trim();
  const match = raw.match(/^(\d{4})-(\d{1,2})$/);
  if (match) {
    return `${match[1]}-${padMonth(Number(match[2]))}`;
  }

  const date = new Date(`${raw}-01`);
  if (Number.isNaN(date.getTime())) return raw || null;
  return `${date.getFullYear()}-${padMonth(date.getMonth() + 1)}`;
}

function isExistingScheduleItemForCurrentContract(
  item: PaymentScheduleItem,
  targetMonth: number,
  targetPeriodKey: string,
  contractStart: Date,
): boolean {
  const itemPeriodKey = normalizePeriodKeyValue(item.period_key);

  if (itemPeriodKey) {
    return itemPeriodKey === targetPeriodKey;
  }

  const dueDate = parseDateOnly(item.due_date);
  const contractDate = new Date(contractStart);
  contractDate.setHours(0, 0, 0, 0);

  if (dueDate && dueDate < contractDate) {
    return false;
  }

  return Number(item.month) === targetMonth;
}

function addMonthsKeepingDay(baseDate: Date, monthsToAdd: number): Date {
  const next = new Date(baseDate);
  const day = baseDate.getDate();
  next.setDate(1);
  next.setMonth(next.getMonth() + monthsToAdd);
  next.setDate(Math.min(day, 28));
  next.setHours(0, 0, 0, 0);
  return next;
}

function getFirstInstallmentDate(contractDate: string, firstInstallmentDate?: string | null): Date {
  const contract = new Date((contractDate || new Date().toISOString().slice(0, 10)).slice(0, 10));
  const safeContract = Number.isNaN(contract.getTime()) ? new Date() : contract;
  safeContract.setHours(0, 0, 0, 0);

  const explicit = firstInstallmentDate ? new Date(String(firstInstallmentDate).slice(0, 10)) : null;

  if (explicit && !Number.isNaN(explicit.getTime())) {
    explicit.setHours(0, 0, 0, 0);

    if (explicit >= safeContract) {
      return explicit;
    }
  }

  return addMonthsKeepingDay(safeContract, 1);
}

function getItemExpectedAmount(item?: PaymentScheduleItem | null): number {
  if (!item) return 0;
  return round2(numeric(item.installment_amount ?? item.amount));
}

function getItemPaidAmount(item: PaymentScheduleItem): number {
  return round2(numeric(item.recorded_paid_amount ?? item.paid_amount));
}

function getItemRemainingDue(item: PaymentScheduleItem): number {
  if (item.remaining_due !== undefined && item.remaining_due !== null) {
    return round2(numeric(item.remaining_due));
  }

  return round2(Math.max(0, getItemExpectedAmount(item) - getItemPaidAmount(item)));
}

function getPaymentStatus(recordedPaid: number, expected: number): 'paid' | 'partial' | 'unpaid' {
  if (recordedPaid + 0.01 >= expected) return 'paid';
  if (recordedPaid > 0) return 'partial';
  return 'unpaid';
}

function getClientMonthlyInstallment(client: Client): number {
  const summaryMonthly = numeric(client.summary?.monthly_installment, NaN);
  if (Number.isFinite(summaryMonthly) && summaryMonthly > 0) return round2(summaryMonthly);

  const firstScheduleAmount = getItemExpectedAmount(client.schedule?.[0]);
  if (firstScheduleAmount > 0) return firstScheduleAmount;

  return computeMonthlyInstallment(
    numeric(client.cost),
    numeric(client.rate),
    numeric(client.months),
    numeric(client.bond_cost, 74.75),
    numeric(client.bond_total, 0),
  );
}

function getClientTotalPaidAmount(client: Client): number {
  const summaryPaid = numeric(client.summary?.paid_amount, NaN);
  if (Number.isFinite(summaryPaid)) return round2(summaryPaid);
  return getPaidAmount(client.schedule || []);
}

function getPreviousDueInstallmentsTotal(client: Client, referenceDate = new Date()): number {
  return round2(
    getPreviousDueScheduleItems(client, referenceDate)
      .reduce((sum, item) => sum + getItemExpectedAmount(item), 0),
  );
}

function ceilInstallments(value: number, monthlyInstallment: number): number {
  if (value <= 0.01 || monthlyInstallment <= 0) return 0;
  return Math.max(0, Math.ceil(Math.max(0, value - 0.01) / monthlyInstallment));
}

export function computeMonthlyInstallment(
  cost: number,
  rate: number,
  months: number,
  bondCost: number,
  bondTotal?: number | null,
): number {
  if (!months) return 0;
  if (bondTotal && bondTotal > 0) {
    return round2(bondTotal / months);
  }

  const totalProfit = cost * (rate / 100) * months;
  return round2((cost + bondCost + totalProfit) / months);
}

export function computeBondTotal(
  cost: number,
  rate: number,
  months: number,
  bondCost: number,
  bondTotal?: number | null,
): number {
  if (bondTotal && bondTotal > 0) {
    return round2(bondTotal);
  }

  const totalProfit = cost * (rate / 100) * months;
  return round2(cost + bondCost + totalProfit);
}

export function buildPaymentSchedule(
  contractDate: string,
  months: number,
  installmentAmount: number,
  existingSchedule: PaymentScheduleItem[] = [],
  firstInstallmentDate?: string | null,
): PaymentScheduleItem[] {
  const firstDue = getFirstInstallmentDate(contractDate, firstInstallmentDate);

  return Array.from({ length: months }, (_, index) => {
    const dueDate = addMonthsKeepingDay(firstDue, index);
    const periodKey = `${dueDate.getFullYear()}-${padMonth(dueDate.getMonth() + 1)}`;
    const monthNumber = index + 1;
    const existing = existingSchedule.find((item) => isExistingScheduleItemForCurrentContract(item, monthNumber, periodKey, firstDue));
    const expected = round2(installmentAmount);
    const recordedPaid = round2(numeric(existing?.recorded_paid_amount ?? existing?.paid_amount));
    const coveredAmount = round2(Math.min(expected, recordedPaid));
    const remainingDue = round2(Math.max(0, expected - recordedPaid));
    const paymentStatus = remainingDue <= 0.01 ? 'paid' : recordedPaid > 0 ? 'partial' : 'unpaid';

    return {
      month: monthNumber,
      due_date: dueDate.toISOString().slice(0, 10),
      period_key: periodKey,
      amount: expected,
      installment_amount: expected,
      is_paid: paymentStatus === 'paid',
      payment_status: paymentStatus,
      paid_amount: recordedPaid > 0 ? recordedPaid : null,
      recorded_paid_amount: recordedPaid > 0 ? recordedPaid : null,
      covered_amount: coveredAmount,
      remaining_due: remainingDue,
      bank_note: recordedPaid > 0 ? existing?.bank_note || null : null,
      paid_date: recordedPaid > 0 ? existing?.paid_date || null : null,
      payment_id: recordedPaid > 0 ? existing?.payment_id ?? null : null,
      direct_payment_id: recordedPaid > 0 ? existing?.direct_payment_id ?? existing?.payment_id ?? null : null,
      allocation_payment_id: recordedPaid > 0 ? existing?.allocation_payment_id ?? null : null,
      can_cancel_payment: recordedPaid > 0 ? existing?.can_cancel_payment ?? true : false,
    };
  });
}

export function getPaidAmount(schedule: PaymentScheduleItem[] = []): number {
  return round2(
    schedule.reduce((sum, item) => sum + getItemPaidAmount(item), 0),
  );
}

export function getPaidCount(schedule: PaymentScheduleItem[] = []): number {
  return schedule.filter((item) => item.is_paid || getItemRemainingDue(item) <= 0.01).length;
}

export function getProfitSharePercentages(profitShare: ProfitShare | null | undefined): { ahmadPct: number; aliPct: number } {
  if (profitShare === 'ahmad_only') {
    return { ahmadPct: 1, aliPct: 0 };
  }

  return { ahmadPct: 0.65, aliPct: 0.35 };
}

export function buildClientSummary(client: Omit<Client, 'summary'> & { summary?: ClientSummary; schedule?: PaymentScheduleItem[] }): ClientSummary {
  const bondCost = client.bond_cost ?? 74.75;
  const bondTotal = computeBondTotal(client.cost, client.rate, client.months, bondCost, client.bond_total);
  const monthlyInstallment = computeMonthlyInstallment(client.cost, client.rate, client.months, bondCost, client.bond_total);
  const totalProfit = round2(bondTotal - client.cost - bondCost);
  const schedule = buildPaymentSchedule(client.contract_date, client.months, monthlyInstallment, client.schedule || [], client.first_installment_date);
  const paidCount = getPaidCount(schedule);
  const paidAmount = getPaidAmount(schedule);
  const remainingAmount = round2(Math.max(0, bondTotal - paidAmount));
  const paidRatio = bondTotal > 0 ? Math.min(1, paidAmount / bondTotal) : 0;
  const remainingPrincipal = round2(Math.max(0, client.principal - client.principal * paidRatio));
  const { ahmadPct, aliPct } = getProfitSharePercentages(client.profit_share);
  const monthlyProfit = client.months ? round2(totalProfit / client.months) : 0;

  return {
    monthly_installment: monthlyInstallment,
    bond_total: bondTotal,
    financed_amount: round2(client.cost + bondCost + totalProfit * aliPct),
    total_profit: totalProfit,
    monthly_profit: monthlyProfit,
    effective_rate: round2(client.rate),
    total_rate: client.cost ? round2((totalProfit / client.cost) * 100) : 0,
    paid_count: paidCount,
    remaining_months: Math.max(0, client.months - paidCount),
    paid_amount: paidAmount,
    remaining_amount: remainingAmount,
    remaining_principal: remainingPrincipal,
    profit_share: client.profit_share || 'shared',
    ahmad_pct: ahmadPct,
    ali_pct: aliPct,
    ahmad_total: round2(totalProfit * ahmadPct),
    ahmad_monthly: round2(monthlyProfit * ahmadPct),
    ali_total: round2(totalProfit * aliPct),
    ali_monthly: round2(monthlyProfit * aliPct),
    progress_percent: bondTotal > 0 ? Math.min(100, Math.round((paidAmount / bondTotal) * 100)) : 0,
  };
}

export function normalizeClient(client: Client): Client {
  const bondCost = client.bond_cost ?? 74.75;
  const monthlyInstallment = computeMonthlyInstallment(client.cost, client.rate, client.months, bondCost, client.bond_total);
  const schedule = buildPaymentSchedule(client.contract_date, client.months, monthlyInstallment, client.schedule || [], client.first_installment_date);
  const normalizedClient: Client = {
    ...client,
    bond_cost: bondCost,
    schedule,
  };

  return {
    ...normalizedClient,
    summary: buildClientSummary(normalizedClient),
  };
}

export function getPreviousDueScheduleItems(client: Client, referenceDate = new Date()): PaymentScheduleItem[] {
  if (!client.schedule?.length) return [];

  return client.schedule
    .filter((item) => isBeforeToday(item.due_date, referenceDate))
    .sort(sortByDueDateAsc);
}

export function calculateClientOverdueInfo(client: Client, referenceDate = new Date()): Pick<ClientAlertInfo, 'overdueCount' | 'overdueAmount' | 'previousDueAmount' | 'paidAmount' | 'monthlyInstallment'> {
  const monthlyInstallment = getClientMonthlyInstallment(client);
  const previousDueAmount = getPreviousDueInstallmentsTotal(client, referenceDate);
  const paidAmount = getClientTotalPaidAmount(client);
  const overdueAmount = round2(Math.max(0, previousDueAmount - paidAmount));
  const overdueCount = ceilInstallments(overdueAmount, monthlyInstallment);

  return {
    overdueCount,
    overdueAmount,
    previousDueAmount,
    paidAmount,
    monthlyInstallment,
  };
}

export function getOverdueScheduleItems(client: Client): PaymentScheduleItem[] {
  const overdueInfo = calculateClientOverdueInfo(client);

  if (overdueInfo.overdueAmount <= 0.01 || overdueInfo.overdueCount <= 0) {
    return [];
  }

  let remainingOverdueAmount = overdueInfo.overdueAmount;

  return getPreviousDueScheduleItems(client)
    .slice(0, overdueInfo.overdueCount)
    .map((item) => {
      const expectedAmount = getItemExpectedAmount(item) || overdueInfo.monthlyInstallment;
      const remainingDue = round2(Math.min(Math.max(expectedAmount, 0), remainingOverdueAmount));
      remainingOverdueAmount = round2(Math.max(0, remainingOverdueAmount - remainingDue));

      return {
        ...item,
        is_paid: false,
        payment_status: remainingDue + 0.01 >= expectedAmount ? 'unpaid' : 'partial',
        remaining_due: remainingDue,
        covered_amount: round2(Math.max(0, expectedAmount - remainingDue)),
      };
    });
}

export function getUpcomingScheduleItems(client: Client, days = 7): PaymentScheduleItem[] {
  if (!client.schedule?.length) return [];
  const today = todayOnly();
  const maxDate = new Date(today);
  maxDate.setDate(maxDate.getDate() + days);

  return client.schedule.filter((item) => {
    const dueDate = parseDateOnly(item.due_date);
    if (!dueDate) return false;
    return dueDate > today && dueDate <= maxDate && getItemRemainingDue(item) > 0.01;
  });
}

export function getNextUnpaidScheduleItem(client: Client): PaymentScheduleItem | null {
  if (!client.schedule?.length) return null;
  return client.schedule.find((item) => getItemRemainingDue(item) > 0.01) || null;
}

export function getDaysUntil(dateString: string): number | null {
  const target = new Date(dateString);
  if (Number.isNaN(target.getTime())) return null;
  target.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

export function getClientAlertInfo(client: Client): ClientAlertInfo {
  const overdue = calculateClientOverdueInfo(client);
  const nextUpcoming = getUpcomingScheduleItems(client, 3650)[0] || null;
  const daysUntilNext = nextUpcoming ? getDaysUntil(nextUpcoming.due_date) : null;

  return {
    ...overdue,
    nextUpcoming,
    daysUntilNext,
  };
}

export function buildStatsFromClients(clients: Client[]): StatsData {
  const normalized = clients.map(normalizeClient);
  const activeClients = normalized.filter((client) => client.status === 'active' && client.summary.remaining_amount > 0.01);
  const nonStuckClients = normalized.filter((client) => client.status !== 'stuck');
  const stuckClients = normalized.filter((client) => client.status === 'stuck');

  return {
    counts: {
      active: activeClients.length,
      stuck: stuckClients.length,
      done: normalized.filter((client) => client.status === 'done' || client.summary.remaining_amount <= 0.01).length,
      court: normalized.filter((client) => client.has_court).length,
      total: normalized.length,
    },
    monthly_income: round2(activeClients.reduce((sum, client) => sum + client.summary.monthly_installment, 0)),
    monthly_profit: round2(activeClients.reduce((sum, client) => sum + client.summary.monthly_profit, 0)),
    ahmad_total: round2(nonStuckClients.reduce((sum, client) => sum + client.summary.ahmad_total, 0)),
    ahmad_monthly: round2(activeClients.reduce((sum, client) => sum + client.summary.ahmad_monthly, 0)),
    ali_monthly: round2(activeClients.reduce((sum, client) => sum + client.summary.ali_monthly, 0)),
    zakat_base: round2(nonStuckClients.reduce((sum, client) => sum + client.summary.remaining_amount, 0)),
    zakat: 0,
    sadaqa: 0,
    stuck: {
      count: stuckClients.length,
      total_remaining: round2(stuckClients.reduce((sum, client) => sum + client.summary.remaining_amount, 0)),
      total_principal: round2(stuckClients.reduce((sum, client) => sum + client.principal, 0)),
      remaining_principal: round2(stuckClients.reduce((sum, client) => sum + client.summary.remaining_principal, 0)),
    },
    alerts: {
      late: normalized
        .map((client) => ({ client, info: getClientAlertInfo(client) }))
        .filter(({ info }) => info.overdueCount > 0)
        .map(({ client, info }) => ({
          id: client.id,
          name: client.name,
          id_number: client.id_number || null,
          overdue_count: info.overdueCount,
          overdue_amount: info.overdueAmount,
        })),
      warn: normalized
        .map((client) => ({ client, info: getClientAlertInfo(client) }))
        .filter(({ info }) => info.overdueCount === 0 && info.nextUpcoming && info.daysUntilNext !== null && info.daysUntilNext <= 7)
        .map(({ client, info }) => ({
          id: client.id,
          name: client.name,
          days_left: info.daysUntilNext || 0,
          next_due: info.nextUpcoming?.due_date || '',
          amount: getItemRemainingDue(info.nextUpcoming as PaymentScheduleItem) || info.nextUpcoming?.amount || 0,
        })),
    },
  };
}

export function withRecordedPayment(client: Client, periodKey: string, paidAmount?: number | null, bankNote?: string | null): Client {
  const schedule = (client.schedule || []).map((item) => {
    if (item.period_key !== periodKey) return item;
    const recordedPaid = round2(paidAmount ?? item.amount);
    const remainingDue = round2(Math.max(0, item.amount - recordedPaid));
    return {
      ...item,
      is_paid: remainingDue <= 0.01,
      payment_status: remainingDue <= 0.01 ? 'paid' : 'partial',
      paid_amount: recordedPaid,
      recorded_paid_amount: recordedPaid,
      covered_amount: Math.min(item.amount, recordedPaid),
      remaining_due: remainingDue,
      bank_note: bankNote || null,
      paid_date: new Date().toISOString().slice(0, 10),
      payment_id: item.payment_id ?? item.month,
    };
  });

  return normalizeClient({ ...client, schedule });
}

export function withRemovedPayment(client: Client, periodKey: string): Client {
  const schedule = (client.schedule || []).map((item) => {
    if (item.period_key !== periodKey) return item;
    return {
      ...item,
      is_paid: false,
      payment_status: 'unpaid',
      paid_amount: null,
      recorded_paid_amount: null,
      covered_amount: 0,
      remaining_due: item.amount,
      bank_note: null,
      paid_date: null,
      payment_id: null,
    };
  });

  return normalizeClient({ ...client, schedule });
}
