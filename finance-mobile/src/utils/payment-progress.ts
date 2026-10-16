
/** Partitions one bond into paid, overdue and future amounts in halalas. */
export interface PaymentProgressBreakdown {
  bondTotal: number;
  paid: number;
  overdue: number;
  upcoming: number;
  paidPercent: number;
  overduePercent: number;
  upcomingPercent: number;
  paidRoundedPercent: number;
  overdueRoundedPercent: number;
  upcomingRoundedPercent: number;
}

export function buildPaymentProgress(bondValue: number, paidValue: number, overdueValue: number): PaymentProgressBreakdown {
  const toHalalas = (value: number) => Number.isFinite(value) ? Math.max(0, Math.round(value * 100)) : 0;
  const bondHalalas = toHalalas(bondValue);
  const paidHalalas = Math.min(bondHalalas, toHalalas(paidValue));
  const uncollectedHalalas = bondHalalas - paidHalalas;
  const overdueHalalas = Math.min(uncollectedHalalas, toHalalas(overdueValue));
  const upcomingHalalas = uncollectedHalalas - overdueHalalas;
  const ratio = (n: number) => bondHalalas > 0 ? n * 100 / bondHalalas : 0;
  const paidRoundedPercent = Math.round(ratio(paidHalalas));
  const overdueRoundedPercent = Math.min(100 - paidRoundedPercent, Math.round(ratio(overdueHalalas)));
  const upcomingRoundedPercent = bondHalalas > 0 ? 100 - paidRoundedPercent - overdueRoundedPercent : 0;

  return {
    bondTotal: bondHalalas / 100,
    paid: paidHalalas / 100,
    overdue: overdueHalalas / 100,
    upcoming: upcomingHalalas / 100,
    paidPercent: ratio(paidHalalas),
    overduePercent: ratio(overdueHalalas),
    upcomingPercent: ratio(upcomingHalalas),
    paidRoundedPercent,
    overdueRoundedPercent,
    upcomingRoundedPercent,
  };
}
