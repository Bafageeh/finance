export interface CapitalRecoveryPosition {
  threshold: number;
  thresholdPercent: number;
  markerPercent: number;
  remainingToRecover: number;
  reached: boolean;
  outOfRange: boolean;
  visible: boolean;
}

/** Break-even after actual payments cover the financed capital including Ali's contractual share. */
export function buildCapitalRecoveryPosition(bondValue: number, paidValue: number, financedValue: number): CapitalRecoveryPosition {
  const halalas = (n: number) => Number.isFinite(n) && n > 0 ? Math.round(n * 100) : 0;
  const bond = halalas(bondValue);
  const paid = halalas(paidValue);
  const threshold = halalas(financedValue);
  const visible = bond > 0 && threshold > 0;
  const fraction = visible ? threshold / bond * 100 : 0;
  return {
    threshold: threshold / 100,
    thresholdPercent: Math.round(fraction * 10) / 10,
    markerPercent: visible ? Math.min(99.65, Math.max(0.35, fraction)) : 0,
    remainingToRecover: Math.max(0, threshold - paid) / 100,
    reached: visible && paid >= threshold,
    outOfRange: visible && threshold > bond,
    visible,
  };
}


import type { Client } from '@/types/api';

/** Original amount to be recovered from a single bond.
 * Same rule as Client::getFinancedAmount, independent of how much has been paid.
 * Do not use the API-normalized summary.financed_amount here: paid-in-full
 * contracts may report a higher number than the original capital threshold.
 */
export function getClientCapitalRecoveryTarget(client: Client): number {
  const cost = Number(client.cost) || Number(client.principal) || 0;
  const bondCost = Number(client.bond_cost ?? 74.75) || 0;
  const aliProfit = client.profit_share === 'ahmad_only'
    ? 0
    : Number(client.summary?.ali_total) || 0;
  return Math.max(0, Math.round((cost + bondCost + aliProfit) * 100) / 100);
}
