import { Client, PaymentScheduleItem, StatsData } from '@/types/api';
import { getClientAlertInfo, getOverdueScheduleItems, getUpcomingScheduleItems } from '@/utils/finance';

export interface RankedClientRow {
  client: Client;
  value: number;
  helper: string;
  focusPeriod?: string;
}

export interface StatsOverviewModel {
  totalPortfolio: number;
  totalRemaining: number;
  totalPaid: number;
  totalProfit: number;
  activeContracts: number;
  completedContracts: number;
  courtContracts: number;
  stuckContracts: number;
  overdueContracts: number;
  overdueAmount: number;
  upcomingContracts: number;
  upcomingAmount: number;
  averageMonthlyInstallment: number;
  collectionCoveragePercent: number;
}

function firstByDate(items: PaymentScheduleItem[]): PaymentScheduleItem | undefined {
  return [...items].sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())[0];
}

function remainingDue(item: PaymentScheduleItem): number {
  const explicit = Number(item.remaining_due);
  if (Number.isFinite(explicit)) return explicit;
  const covered = Number(item.covered_amount ?? item.paid_amount ?? 0);
  return Math.max(0, Number(item.amount || 0) - covered);
}

export function buildStatsOverview(stats: StatsData, clients: Client[]): StatsOverviewModel {
  const normalized = clients;
  const overdueEntries = normalized.map((client) => ({ client, items: getOverdueScheduleItems(client) }));
  const upcomingEntries = normalized.map((client) => ({ client, items: getUpcomingScheduleItems(client, 7) }));
  const totalPortfolio = normalized.reduce((sum, client) => sum + client.summary.bond_total, 0);
  const totalRemaining = normalized.reduce((sum, client) => sum + client.summary.remaining_amount, 0);
  const totalPaid = normalized.reduce((sum, client) => sum + client.summary.paid_amount, 0);
  const totalProfit = normalized.reduce((sum, client) => sum + client.summary.total_profit, 0);
  const activeClients = normalized.filter((client) => client.status === 'active');

  return {
    totalPortfolio,
    totalRemaining,
    totalPaid,
    totalProfit,
    activeContracts: stats.counts.active,
    completedContracts: stats.counts.done,
    courtContracts: stats.counts.court,
    stuckContracts: stats.counts.stuck,
    overdueContracts: overdueEntries.filter((entry) => entry.items.length > 0).length,
    overdueAmount: overdueEntries.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + remainingDue(item), 0), 0),
    upcomingContracts: upcomingEntries.filter((entry) => entry.items.length > 0).length,
    upcomingAmount: upcomingEntries.reduce((sum, entry) => sum + entry.items.reduce((inner, item) => inner + remainingDue(item), 0), 0),
    averageMonthlyInstallment: activeClients.length
      ? activeClients.reduce((sum, client) => sum + client.summary.monthly_installment, 0) / activeClients.length
      : 0,
    collectionCoveragePercent: totalPortfolio > 0 ? (totalPaid / totalPortfolio) * 100 : 0,
  };
}

export function buildHighestRemainingRows(clients: Client[]): RankedClientRow[] {
  return [...clients]
    .sort((a, b) => b.summary.remaining_amount - a.summary.remaining_amount)
    .slice(0, 5)
    .map((client) => ({
      client,
      value: client.summary.remaining_amount,
      helper: `${client.summary.remaining_months} شهر متبقٍ`,
      focusPeriod: firstByDate(getOverdueScheduleItems(client))?.period_key,
    }));
}

export function buildHighestMonthlyRows(clients: Client[]): RankedClientRow[] {
  return [...clients]
    .filter((client) => client.status !== 'done')
    .sort((a, b) => b.summary.monthly_installment - a.summary.monthly_installment)
    .slice(0, 5)
    .map((client) => ({
      client,
      value: client.summary.monthly_installment,
      helper: client.asset || 'بدون أصل محدد',
      focusPeriod: firstByDate(getUpcomingScheduleItems(client, 30))?.period_key,
    }));
}

export function buildClosestToFinishRows(clients: Client[]): RankedClientRow[] {
  return [...clients]
    .filter((client) => client.status !== 'done' && client.summary.remaining_months > 0)
    .sort((a, b) => a.summary.remaining_months - b.summary.remaining_months || a.summary.remaining_amount - b.summary.remaining_amount)
    .slice(0, 5)
    .map((client) => ({
      client,
      value: client.summary.remaining_amount,
      helper: `متبقٍ ${client.summary.remaining_months} شهر`,
      focusPeriod: firstByDate(getUpcomingScheduleItems(client, 365))?.period_key,
    }));
}

export function buildCourtCaseRows(clients: Client[]): RankedClientRow[] {
  return [...clients]
    .filter((client) => client.has_court)
    .sort((a, b) => b.summary.remaining_amount - a.summary.remaining_amount)
    .map((client) => {
      const overdue = getClientAlertInfo(client);
      return {
        client,
        value: client.summary.remaining_amount,
        helper: overdue.overdueCount > 0 ? `${overdue.overdueCount} قسط متأخر` : 'بدون أقساط متأخرة حالياً',
        focusPeriod: firstByDate(getOverdueScheduleItems(client))?.period_key,
      };
    });
}

export function buildCaseMetrics(clients: Client[]) {
  const courtClients = clients.filter((client) => client.has_court);
  const overdueCourt = courtClients.map((client) => ({ client, info: getClientAlertInfo(client) }));

  return {
    totalCount: courtClients.length,
    totalRemaining: courtClients.reduce((sum, client) => sum + client.summary.remaining_amount, 0),
    overdueCount: overdueCourt.filter((entry) => entry.info.overdueCount > 0).length,
    overdueAmount: overdueCourt.reduce((sum, entry) => sum + entry.info.overdueAmount, 0),
    withoutNotes: courtClients.filter((client) => !client.court_note?.trim()).length,
    activeCases: courtClients.filter((client) => client.status === 'active').length,
    stuckCases: courtClients.filter((client) => client.status === 'stuck').length,
  };
}
