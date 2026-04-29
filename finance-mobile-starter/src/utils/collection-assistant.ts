import { Client } from '@/types/api';
import {
  AssistantActionKind,
  AssistantUrgency,
  CollectionAssistantBoard,
  CollectionAssistantLead,
} from '@/types/assistant';
import { FollowUpSummary } from '@/types/follow-up';
import { getClientAlertInfo, getNextUnpaidScheduleItem } from '@/utils/finance';
import { formatCurrency, formatDate } from '@/utils/format';

function toDateOnly(value?: string | null): string | null {
  if (!value) return null;
  return String(value).slice(0, 10);
}

function startOfToday(): Date {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function daysUntil(value?: string | null): number | null {
  const onlyDate = toDateOnly(value);
  if (!onlyDate) return null;

  const date = new Date(`${onlyDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return null;

  const diff = date.getTime() - startOfToday().getTime();
  return Math.round(diff / 86400000);
}

function urgencyFromScore(score: number): AssistantUrgency {
  if (score >= 80) return 'critical';
  if (score >= 55) return 'high';
  if (score >= 30) return 'medium';
  return 'normal';
}

function moneyScore(amount: number): number {
  if (amount <= 0) return 0;
  return Math.min(28, Math.round(amount / 250));
}

function buildReason(params: {
  actionKind: AssistantActionKind;
  overdueCount: number;
  overdueAmount: number;
  dueDate?: string | null;
  nextFollowUpAt?: string | null;
  hasCourt?: boolean;
}): string {
  if (params.hasCourt) {
    return `عميل مرتبط بقضية، والمتبقي أو المتأخر يحتاج متابعة دقيقة. المتأخر الحالي: ${formatCurrency(params.overdueAmount)}.`;
  }

  if (params.actionKind === 'promise_followup') {
    return `لديه وعد أو موعد متابعة مستحق بتاريخ ${formatDate(params.nextFollowUpAt || params.dueDate || '')}.`;
  }

  if (params.overdueCount > 0) {
    return `لديه ${params.overdueCount} قسط/أقساط متأخرة بإجمالي ${formatCurrency(params.overdueAmount)}.`;
  }

  if (params.actionKind === 'today_due') {
    return `لديه قسط مستحق اليوم أو خلال فترة قريبة بتاريخ ${formatDate(params.dueDate || '')}.`;
  }

  return 'متابعة ودية للحفاظ على انتظام السداد وتقليل احتمالية التعثر.';
}

function nextActionLabel(kind: AssistantActionKind): string {
  switch (kind) {
    case 'court_warning':
      return 'مراجعة ملف القضية وتحديث آخر إجراء';
    case 'promise_followup':
      return 'اتصال لتأكيد تنفيذ وعد السداد';
    case 'late_collection':
      return 'اتصال تحصيل وإرسال تذكير واتساب';
    case 'today_due':
      return 'تذكير قبل نهاية اليوم';
    default:
      return 'تواصل ودي وجدولة متابعة';
  }
}

function actionKindFor(client: Client, overdueCount: number, nextDays: number | null, followUpDays: number | null): AssistantActionKind {
  if (client.has_court) return 'court_warning';
  if (followUpDays !== null && followUpDays <= 0) return 'promise_followup';
  if (overdueCount > 0) return 'late_collection';
  if (nextDays !== null && nextDays <= 1) return 'today_due';
  return 'friendly_reminder';
}

export function buildCollectionAssistantBoard(
  clients: Client[],
  summaries: Record<number, FollowUpSummary> = {},
): CollectionAssistantBoard {
  const leads: CollectionAssistantLead[] = clients
    .map((client) => {
      const alertInfo = getClientAlertInfo(client);
      const nextDue = getNextUnpaidScheduleItem(client);
      const summary = summaries[client.id];

      const overdueCount = Number(alertInfo.overdueCount || 0);
      const overdueAmount = Number(alertInfo.overdueAmount || 0);
      const remainingAmount = Number(client.summary?.remaining_amount || 0);
      const nextDueDate = nextDue?.due_date || null;
      const nextDays = daysUntil(nextDueDate);
      const followUpDate = summary?.next_follow_up_at || summary?.promise_date || null;
      const followUpDays = daysUntil(followUpDate);
      const actionKind = actionKindFor(client, overdueCount, nextDays, followUpDays);

      let score = 0;
      score += Math.min(45, overdueCount * 15);
      score += moneyScore(overdueAmount || remainingAmount);
      if (client.has_court) score += 35;
      if (followUpDays !== null && followUpDays <= 0) score += 22;
      if (nextDays !== null && nextDays <= 0) score += 18;
      else if (nextDays !== null && nextDays <= 3) score += 10;
      if (summary?.last_outcome === 'no_answer') score += 8;
      if (summary?.last_outcome === 'promise') score += 6;

      const amount = overdueAmount || Number(nextDue?.amount || 0) || remainingAmount;
      const reason = buildReason({
        actionKind,
        overdueCount,
        overdueAmount,
        dueDate: nextDueDate,
        nextFollowUpAt: followUpDate,
        hasCourt: client.has_court,
      });

      const lead: CollectionAssistantLead = {
        key: `${client.id}-${actionKind}`,
        client,
        summary,
        urgency: urgencyFromScore(score),
        actionKind,
        score,
        amount,
        overdueAmount,
        overdueCount,
        dueDate: nextDueDate,
        nextFollowUpAt: followUpDate,
        reason,
        nextActionLabel: nextActionLabel(actionKind),
      };

      return lead;
    })
    .filter((lead) => lead.score > 0 || lead.overdueCount > 0 || lead.client.has_court)
    .sort((a, b) => b.score - a.score || b.amount - a.amount);

  return {
    leads,
    totalLeads: leads.length,
    criticalCount: leads.filter((lead) => lead.urgency === 'critical').length,
    highCount: leads.filter((lead) => lead.urgency === 'high').length,
    mediumCount: leads.filter((lead) => lead.urgency === 'medium').length,
    promiseDueCount: leads.filter((lead) => lead.actionKind === 'promise_followup').length,
    courtCount: leads.filter((lead) => lead.client.has_court).length,
    totalOpportunityAmount: leads.reduce((sum, lead) => sum + Number(lead.amount || 0), 0),
  };
}
