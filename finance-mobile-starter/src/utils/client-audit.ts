import * as React from 'react';
import { Client, PaymentScheduleItem } from '@/types/api';

export type FinancialAuditSeverity = 'ok' | 'warning' | 'danger';

export interface FinancialAuditIssue {
  key: string;
  severity: FinancialAuditSeverity;
  title: string;
  description: string;
}

export interface ClientFinancialAudit {
  status: FinancialAuditSeverity;
  statusLabel: string;
  issues: FinancialAuditIssue[];
  notes: FinancialAuditIssue[];
  metrics: {
    bondTotal: number;
    summaryPaidAmount: number;
    schedulePaidAmount: number;
    summaryRemainingAmount: number;
    computedRemainingAmount: number;
    expectedScheduleTotal: number;
    scheduleCount: number;
    expectedMonths: number;
    paidCount: number;
    partialCount: number;
    overdueCount: number;
    upcomingCount: number;
    invalidBeforeContractCount: number;
    duplicatePeriodCount: number;
    paidDifference: number;
    remainingDifference: number;
    firstInstallmentDate: string | null;
    firstVisibleDueDate: string | null;
    lastVisibleDueDate: string | null;
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function round2(value: number): number {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function money(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizedDate(value: unknown): string | null {
  if (!value) return null;
  const raw = String(value).slice(0, 10);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return raw;
}

function dateTime(value: unknown): number | null {
  const date = normalizedDate(value);
  if (!date) return null;
  const parsed = new Date(date);
  parsed.setHours(0, 0, 0, 0);
  return Number.isNaN(parsed.getTime()) ? null : parsed.getTime();
}

function expectedAmount(item: PaymentScheduleItem): number {
  return round2(money(item.installment_amount ?? item.amount));
}

function recordedPaidAmount(item: PaymentScheduleItem): number {
  return round2(money(item.recorded_paid_amount ?? item.paid_amount));
}

function remainingDue(item: PaymentScheduleItem): number {
  if (item.remaining_due !== undefined && item.remaining_due !== null) {
    return round2(Math.max(0, money(item.remaining_due)));
  }

  return round2(Math.max(0, expectedAmount(item) - recordedPaidAmount(item)));
}

function sortSchedule(schedule: PaymentScheduleItem[]): PaymentScheduleItem[] {
  return [...schedule].sort((a, b) => {
    const aTime = dateTime(a.due_date) ?? 0;
    const bTime = dateTime(b.due_date) ?? 0;
    return aTime - bTime || Number(a.month || 0) - Number(b.month || 0);
  });
}

function countDuplicatePeriods(schedule: PaymentScheduleItem[]): number {
  const seen = new Set<string>();
  let duplicates = 0;

  schedule.forEach((item) => {
    const key = String(item.period_key || '').trim();
    if (!key) return;
    if (seen.has(key)) {
      duplicates += 1;
      return;
    }
    seen.add(key);
  });

  return duplicates;
}

function addIssue(target: FinancialAuditIssue[], issue: FinancialAuditIssue) {
  if (!target.some((entry) => entry.key === issue.key)) {
    target.push(issue);
  }
}

function getFirstInstallmentDate(client: Client): string | null {
  const source = client as Client & { first_installment_date?: string | null };
  return normalizedDate(source.first_installment_date) || null;
}

export function buildClientFinancialAudit(client: Client): ClientFinancialAudit {
  const schedule = sortSchedule(client.schedule || []);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const bondTotal = round2(money(client.summary?.bond_total ?? client.bond_total));
  const summaryPaidAmount = round2(money(client.summary?.paid_amount));
  const summaryRemainingAmount = round2(money(client.summary?.remaining_amount));
  const schedulePaidAmount = round2(schedule.reduce((sum, item) => sum + recordedPaidAmount(item), 0));
  const expectedScheduleTotal = round2(schedule.reduce((sum, item) => sum + expectedAmount(item), 0));
  const computedRemainingAmount = round2(Math.max(0, bondTotal - schedulePaidAmount));
  const paidDifference = round2(summaryPaidAmount - schedulePaidAmount);
  const remainingDifference = round2(summaryRemainingAmount - computedRemainingAmount);
  const firstInstallmentDate = getFirstInstallmentDate(client);
  const firstVisibleDueDate = normalizedDate(schedule[0]?.due_date);
  const lastVisibleDueDate = normalizedDate(schedule[schedule.length - 1]?.due_date);
  const contractTime = dateTime(client.contract_date);
  const firstInstallmentTime = dateTime(firstInstallmentDate);
  const duplicatePeriodCount = countDuplicatePeriods(schedule);
  const invalidBeforeContractCount = schedule.filter((item) => {
    const due = dateTime(item.due_date);
    return due !== null && contractTime !== null && due < contractTime;
  }).length;

  const paidCount = schedule.filter((item) => recordedPaidAmount(item) > 0 && remainingDue(item) <= 0.01).length;
  const partialCount = schedule.filter((item) => recordedPaidAmount(item) > 0 && remainingDue(item) > 0.01).length;
  const overdueCount = schedule.filter((item) => {
    const due = dateTime(item.due_date);
    return due !== null && due <= today.getTime() && remainingDue(item) > 0.01;
  }).length;
  const upcomingCount = schedule.filter((item) => {
    const due = dateTime(item.due_date);
    return due !== null && due > today.getTime() && due <= today.getTime() + 30 * ONE_DAY_MS && remainingDue(item) > 0.01;
  }).length;

  const issues: FinancialAuditIssue[] = [];
  const notes: FinancialAuditIssue[] = [];

  if (schedule.length !== Number(client.months || 0)) {
    addIssue(issues, {
      key: 'schedule-count-mismatch',
      severity: 'danger',
      title: 'عدد الأقساط لا يطابق مدة العقد',
      description: `المفترض ${client.months || 0} قسط، والظاهر حالياً ${schedule.length} قسط.`,
    });
  }

  if (duplicatePeriodCount > 0) {
    addIssue(issues, {
      key: 'duplicate-periods',
      severity: 'danger',
      title: 'تكرار في مفاتيح الأشهر',
      description: `يوجد ${duplicatePeriodCount} قسط أو دفعة مكررة على نفس الشهر. راجع بيانات الدفعات قبل الاعتماد على التقرير.`,
    });
  }

  if (invalidBeforeContractCount > 0) {
    addIssue(issues, {
      key: 'before-contract',
      severity: 'danger',
      title: 'أقساط قبل تاريخ العقد',
      description: `يوجد ${invalidBeforeContractCount} قسط بتاريخ أقدم من تاريخ العقد، وهذا قد يسبب خطأ في المدفوع والمتبقي.`,
    });
  }

  if (firstInstallmentTime !== null && contractTime !== null && firstInstallmentTime < contractTime) {
    addIssue(issues, {
      key: 'first-installment-before-contract',
      severity: 'danger',
      title: 'تاريخ أول قسط أقدم من تاريخ العقد',
      description: 'يجب أن يكون تاريخ أول قسط مساويًا أو أحدث من تاريخ العقد، ويفضل بعده بشهر عند الإضافة.',
    });
  }

  if (firstInstallmentDate && firstVisibleDueDate && firstInstallmentDate !== firstVisibleDueDate) {
    addIssue(issues, {
      key: 'first-installment-not-used',
      severity: 'danger',
      title: 'جدول الأقساط لا يبدأ من تاريخ أول قسط',
      description: `تاريخ أول قسط المسجل ${firstInstallmentDate}، بينما أول قسط ظاهر ${firstVisibleDueDate}.`,
    });
  }

  if (Math.abs(paidDifference) > 0.05) {
    addIssue(issues, {
      key: 'paid-difference',
      severity: 'danger',
      title: 'فرق في إجمالي المدفوع',
      description: `ملخص العميل يعرض ${summaryPaidAmount.toFixed(2)} بينما مجموع الدفعات الظاهرة ${schedulePaidAmount.toFixed(2)}.`,
    });
  }

  if (Math.abs(remainingDifference) > 0.05) {
    addIssue(issues, {
      key: 'remaining-difference',
      severity: 'danger',
      title: 'فرق في المتبقي',
      description: `المتبقي المعروض ${summaryRemainingAmount.toFixed(2)} بينما المتبقي المحسوب من قيمة السند والمدفوعات ${computedRemainingAmount.toFixed(2)}.`,
    });
  }

  if (bondTotal > 0 && expectedScheduleTotal > 0 && Math.abs(bondTotal - expectedScheduleTotal) > Math.max(2, schedule.length * 0.05)) {
    addIssue(issues, {
      key: 'schedule-total-difference',
      severity: 'warning',
      title: 'إجمالي جدول الأقساط لا يطابق قيمة السند',
      description: `قيمة السند ${bondTotal.toFixed(2)} بينما مجموع الأقساط ${expectedScheduleTotal.toFixed(2)}. قد يكون الفرق بسبب تقريب أو تعديل قسط يدوي.`,
    });
  }

  if (schedulePaidAmount > bondTotal + 0.05) {
    addIssue(issues, {
      key: 'overpaid',
      severity: 'warning',
      title: 'المدفوع أكبر من قيمة السند',
      description: `إجمالي المدفوعات أكبر من قيمة السند بمبلغ ${(schedulePaidAmount - bondTotal).toFixed(2)}.`,
    });
  }

  if (partialCount > 0) {
    addIssue(notes, {
      key: 'partial-payments',
      severity: 'warning',
      title: 'يوجد أقساط مدفوعة جزئيًا',
      description: `${partialCount} قسط عليه دفعة ناقصة. هذا طبيعي إذا كان العميل دفع مبلغًا أقل من المطلوب.`,
    });
  }

  if (overdueCount > 0) {
    addIssue(notes, {
      key: 'overdue-payments',
      severity: 'warning',
      title: 'يوجد تأخير قائم',
      description: `${overdueCount} قسط متأخر يحتاج متابعة تحصيل.`,
    });
  }

  const hasDanger = issues.some((issue) => issue.severity === 'danger');
  const hasWarning = issues.some((issue) => issue.severity === 'warning');
  const status: FinancialAuditSeverity = hasDanger ? 'danger' : hasWarning ? 'warning' : 'ok';

  return {
    status,
    statusLabel: status === 'ok' ? 'سليم' : status === 'warning' ? 'يحتاج مراجعة' : 'يوجد خطأ حسابي',
    issues,
    notes,
    metrics: {
      bondTotal,
      summaryPaidAmount,
      schedulePaidAmount,
      summaryRemainingAmount,
      computedRemainingAmount,
      expectedScheduleTotal,
      scheduleCount: schedule.length,
      expectedMonths: Number(client.months || 0),
      paidCount,
      partialCount,
      overdueCount,
      upcomingCount,
      invalidBeforeContractCount,
      duplicatePeriodCount,
      paidDifference,
      remainingDifference,
      firstInstallmentDate,
      firstVisibleDueDate,
      lastVisibleDueDate,
    },
  };
}
