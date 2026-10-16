import type { Client } from '@/types/api';
import { getClientAlertInfo } from '@/utils/finance';
import { buildCapitalRecoveryPosition, getClientCapitalRecoveryTarget } from '@/utils/capital-recovery';
import { buildPaymentProgress } from '@/utils/payment-progress';

/**
 * Open (non-completed) contracts only. Includes overdue, stuck and court clients,
 * without deducting Ali's profit from unpaid bond balances.
 * Fully paid contracts and status=done are excluded from every bar segment,
 * including collected amounts and capital-recovery threshold.
 */
export function buildPortfolioCollectionProgress(clients: Client[]) {
  const halalas = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
  let paid = 0;
  let remaining = 0;
  let overdue = 0;
  let capital = 0;
  for (const client of clients) {
    // Keep classification consistent with "منتهون" on the statistics screen.
    if (client.status === 'done' || Number(client.summary?.remaining_amount ?? 0) <= 0.01) continue;
    const clientRemaining = halalas(Number(client.summary?.remaining_amount));
    paid += halalas(Number(client.summary?.paid_amount));
    remaining += clientRemaining;
    const clientOverdue = halalas(getClientAlertInfo(client).overdueAmount);
    overdue += Math.min(clientRemaining, clientOverdue);
    capital += halalas(getClientCapitalRecoveryTarget(client));
  }

  const full = (paid + remaining) / 100;
  const segments = buildPaymentProgress(full, paid / 100, overdue / 100);
  const marker = buildCapitalRecoveryPosition(full, paid / 100, capital / 100);

  return {
    ...segments,
    marker,
    totalOutstanding: remaining / 100,
    totalCollected: paid / 100,
    overdueOutstanding: overdue / 100,
    upcomingOutstanding: (remaining - overdue) / 100,
    originalCapitalToRecover: capital / 100,
  };
}
