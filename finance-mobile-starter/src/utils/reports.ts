import { Client, StatsData } from '@/types/api';
import { AssistantActionKind, AssistantUrgency, CollectionAssistantBoard, CollectionAssistantLead } from '@/types/assistant';
import { ReportDocument } from '@/types/report';
import { getClientAlertInfo, getNextUnpaidScheduleItem } from '@/utils/finance';
import { formatCurrency, formatDate, statusLabel } from '@/utils/format';

function nowStamp(): string {
  return new Date().toISOString();
}

function plainCurrency(value: number): string {
  return formatCurrency(value || 0).replace(' ر.س', '');
}

function safe(value: string | number | null | undefined): string | number {
  if (value === null || value === undefined || value === '') return '—';
  return value;
}

function safeDate(value: string | null | undefined): string {
  if (!value) return '—';
  return formatDate(value);
}

function rowsByRemaining(clients: Client[]): Client[] {
  return [...clients].sort((a, b) => b.summary.remaining_amount - a.summary.remaining_amount);
}

function urgencyLabel(urgency: AssistantUrgency): string {
  switch (urgency) {
    case 'critical':
      return 'حرج';
    case 'high':
      return 'مرتفع';
    case 'medium':
      return 'متوسط';
    default:
      return 'اعتيادي';
  }
}

function actionKindLabel(kind: AssistantActionKind): string {
  switch (kind) {
    case 'late_collection':
      return 'تحصيل متأخر';
    case 'promise_followup':
      return 'متابعة وعد';
    case 'court_warning':
      return 'متابعة قضائية';
    case 'today_due':
      return 'استحقاق اليوم';
    default:
      return 'تذكير ودي';
  }
}

function outcomeLabel(outcome?: string | null): string {
  switch (outcome) {
    case 'contacted':
      return 'تم التواصل';
    case 'promise':
      return 'وعد بالسداد';
    case 'no_answer':
      return 'لم يرد';
    case 'excused':
      return 'اعتذر';
    case 'court':
      return 'إجراء قضائي';
    default:
      return '—';
  }
}

function leadTargetDate(lead: CollectionAssistantLead): string {
  return safeDate(lead.dueDate || lead.nextFollowUpAt || lead.summary?.next_follow_up_at || null);
}

export function buildSmartCollectionReport(board: CollectionAssistantBoard): ReportDocument {
  const leads = board.leads.slice(0, 100);
  const generatedAt = nowStamp();

  return {
    kind: 'smart_collection',
    title: 'تقرير التحصيل الذكي',
    subtitle: 'ترتيب آلي لأولويات التحصيل حسب درجة الخطورة، التأخير، الوعود، القضايا، وقيمة الفرصة.',
    filename: `smart-collection-report-${generatedAt.slice(0, 10)}`,
    generatedAt,
    summary: [
      { label: 'أولويات التحصيل', value: String(board.totalLeads) },
      { label: 'حالات حرجة', value: String(board.criticalCount) },
      { label: 'وعود مستحقة', value: String(board.promiseDueCount) },
      { label: 'مرتبطة بقضايا', value: String(board.courtCount) },
      { label: 'قيمة الفرص', value: formatCurrency(board.totalOpportunityAmount) },
      { label: 'أعلى درجة', value: leads[0] ? String(leads[0].score) : '—' },
    ],
    headers: [
      '#',
      'العميل',
      'الجوال',
      'الأولوية',
      'نوع الإجراء',
      'الدرجة',
      'مبلغ المتابعة',
      'التاريخ المستهدف',
      'عدد الأقساط المتأخرة',
      'المبلغ المتأخر',
      'آخر تواصل',
      'آخر نتيجة',
      'الإجراء المقترح',
    ],
    rows: leads.map((lead, index) => [
      index + 1,
      lead.client.name,
      safe(lead.client.phone),
      urgencyLabel(lead.urgency),
      actionKindLabel(lead.actionKind),
      lead.score,
      plainCurrency(lead.amount),
      leadTargetDate(lead),
      lead.overdueCount,
      plainCurrency(lead.overdueAmount),
      safeDate(lead.summary?.last_contact_at || null),
      outcomeLabel(lead.summary?.last_outcome),
      lead.nextActionLabel,
    ]),
  };
}

export function buildPortfolioReport(clients: Client[], stats: StatsData): ReportDocument {
  const ordered = rowsByRemaining(clients);

  return {
    kind: 'portfolio',
    title: 'تقرير المحفظة',
    subtitle: 'نظرة شاملة على جميع العقود مع المتبقي والقسط الشهري والحالة.',
    filename: 'portfolio-report',
    generatedAt: nowStamp(),
    summary: [
      { label: 'إجمالي العملاء', value: String(stats.counts.total) },
      { label: 'نشطون', value: String(stats.counts.active) },
      { label: 'متعثرون', value: String(stats.counts.stuck) },
      { label: 'قضايا', value: String(stats.counts.court) },
      { label: 'التحصيل الشهري', value: formatCurrency(stats.monthly_income) },
      { label: 'الربح الشهري', value: formatCurrency(stats.monthly_profit) },
    ],
    headers: ['العميل', 'الحالة', 'تاريخ العقد', 'القسط الشهري', 'المدفوع', 'المتبقي', 'الأشهر'],
    rows: ordered.map((client) => [
      client.name,
      client.has_court ? 'قضية' : statusLabel(client.status),
      formatDate(client.contract_date),
      plainCurrency(client.summary.monthly_installment),
      plainCurrency(client.summary.paid_amount),
      plainCurrency(client.summary.remaining_amount),
      `${client.summary.paid_count}/${client.months}`,
    ]),
  };
}

export function buildLateClientsReport(clients: Client[]): ReportDocument {
  const lateClients = clients
    .map((client) => ({ client, info: getClientAlertInfo(client) }))
    .filter(({ info }) => info.overdueCount > 0)
    .sort((a, b) => b.info.overdueAmount - a.info.overdueAmount);

  return {
    kind: 'late',
    title: 'تقرير المتأخرين',
    subtitle: 'العملاء الذين لديهم أقساط متأخرة حاليًا بصفة عامة.',
    filename: 'late-clients-report',
    generatedAt: nowStamp(),
    summary: [
      { label: 'عدد المتأخرين', value: String(lateClients.length) },
      { label: 'إجمالي المتأخر', value: formatCurrency(lateClients.reduce((sum, item) => sum + item.info.overdueAmount, 0)) },
      { label: 'إجمالي الأقساط المتأخرة', value: String(lateClients.reduce((sum, item) => sum + item.info.overdueCount, 0)) },
    ],
    headers: ['العميل', 'الجوال', 'عدد الأقساط', 'المبلغ المتأخر', 'القسط الشهري', 'المتبقي', 'الحالة'],
    rows: lateClients.map(({ client, info }) => [
      client.name,
      safe(client.phone),
      info.overdueCount,
      plainCurrency(info.overdueAmount),
      plainCurrency(client.summary.monthly_installment),
      plainCurrency(client.summary.remaining_amount),
      client.has_court ? 'قضية' : statusLabel(client.status),
    ]),
  };
}

export function buildCourtReport(clients: Client[]): ReportDocument {
  const courtClients = rowsByRemaining(clients.filter((client) => client.has_court));

  return {
    kind: 'court',
    title: 'تقرير القضايا',
    subtitle: 'العملاء المحالون للقضايا أو المرتبطون بمتابعة قضائية.',
    filename: 'court-cases-report',
    generatedAt: nowStamp(),
    summary: [
      { label: 'عدد القضايا', value: String(courtClients.length) },
      { label: 'إجمالي المتبقي', value: formatCurrency(courtClients.reduce((sum, client) => sum + client.summary.remaining_amount, 0)) },
      { label: 'بدون ملاحظة', value: String(courtClients.filter((client) => !client.court_note).length) },
    ],
    headers: ['العميل', 'الجوال', 'المتبقي', 'القسط الشهري', 'الحالة', 'ملاحظة القضية'],
    rows: courtClients.map((client) => [
      client.name,
      safe(client.phone),
      plainCurrency(client.summary.remaining_amount),
      plainCurrency(client.summary.monthly_installment),
      statusLabel(client.status),
      safe(client.court_note),
    ]),
  };
}

export function buildUpcomingReport(clients: Client[]): ReportDocument {
  const upcoming = clients
    .map((client) => {
      const nextDue = getNextUnpaidScheduleItem(client);
      const info = getClientAlertInfo(client);
      return { client, nextDue, info };
    })
    .filter((entry) => entry.nextDue && entry.info.overdueCount === 0)
    .sort((a, b) => String(a.nextDue?.due_date).localeCompare(String(b.nextDue?.due_date)))
    .slice(0, 50);

  return {
    kind: 'upcoming',
    title: 'تقرير الاستحقاقات القادمة',
    subtitle: 'أقرب الأقساط القادمة للعملاء المنتظمين أو غير المتأخرين.',
    filename: 'upcoming-dues-report',
    generatedAt: nowStamp(),
    summary: [
      { label: 'عدد السجلات', value: String(upcoming.length) },
      { label: 'إجمالي القيمة', value: formatCurrency(upcoming.reduce((sum, item) => sum + (item.nextDue?.amount || 0), 0)) },
      { label: 'أقرب استحقاق', value: upcoming[0]?.nextDue ? formatDate(upcoming[0].nextDue.due_date) : '—' },
    ],
    headers: ['العميل', 'الجوال', 'تاريخ القسط القادم', 'قيمة القسط', 'المتبقي', 'الحالة'],
    rows: upcoming.map(({ client, nextDue }) => [
      client.name,
      safe(client.phone),
      formatDate(nextDue?.due_date || ''),
      plainCurrency(nextDue?.amount || 0),
      plainCurrency(client.summary.remaining_amount),
      client.has_court ? 'قضية' : statusLabel(client.status),
    ]),
  };
}
