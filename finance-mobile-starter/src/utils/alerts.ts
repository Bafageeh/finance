import { AlertTone } from '@/components/AlertItemCard';
import { AlertRouteType } from '@/constants/alerts';
import { Client, PaymentScheduleItem } from '@/types/api';
import { clientMatchesSearch } from '@/utils/format';
import { getClientAlertInfo, getDaysUntil, getOverdueScheduleItems, getUpcomingScheduleItems } from '@/utils/finance';

export interface AlertEntry {
  client: Client;
  tone: AlertTone;
  title: string;
  description: string;
  amount?: number;
  focusPeriod?: string;
}

export interface CollectionEntry {
  key: string;
  client: Client;
  item: PaymentScheduleItem;
  state: 'late' | 'upcoming';
  daysUntil: number | null;
}

function sortByDueDateAsc(a: PaymentScheduleItem, b: PaymentScheduleItem): number {
  return new Date(a.due_date).getTime() - new Date(b.due_date).getTime();
}

export function buildAlertEntries(clients: Client[], type: AlertRouteType): AlertEntry[] {
  switch (type) {
    case 'court':
      return clients
        .filter((client) => client.has_court)
        .sort((a, b) => b.summary.remaining_amount - a.summary.remaining_amount)
        .map((client) => ({
          client,
          tone: 'court',
          title: `⚖ ${client.name}${client.id_number ? ` · ${client.id_number}` : ''}`,
          description: `${client.court_note || 'رُفعت عليه قضية'} · المتبقي ${client.summary.remaining_amount.toLocaleString('ar-SA')} ر.س`,
        }));

    case 'late':
      return clients
        .map((client) => {
          const alertInfo = getClientAlertInfo(client);
          const firstLate = getOverdueScheduleItems(client).sort(sortByDueDateAsc)[0] || null;
          return { client, alertInfo, firstLate };
        })
        .filter(({ alertInfo }) => alertInfo.overdueCount > 0)
        .sort((a, b) => b.alertInfo.overdueAmount - a.alertInfo.overdueAmount)
        .map(({ client, alertInfo, firstLate }) => ({
          client,
          tone: 'late',
          title: `${client.name}${client.id_number ? ` · ${client.id_number}` : ''}`,
          description: `${alertInfo.overdueCount} قسط متأخر${firstLate ? ` · أول استحقاق ${firstLate.due_date}` : ''}`,
          amount: alertInfo.overdueAmount,
          focusPeriod: firstLate?.period_key,
        }));

    case 'warn':
      return clients
        .map((client) => {
          const alertInfo = getClientAlertInfo(client);
          return { client, alertInfo };
        })
        .filter(({ alertInfo }) => alertInfo.overdueCount === 0 && alertInfo.nextUpcoming && alertInfo.daysUntilNext !== null && alertInfo.daysUntilNext <= 7)
        .sort((a, b) => (a.alertInfo.daysUntilNext || 0) - (b.alertInfo.daysUntilNext || 0))
        .map(({ client, alertInfo }) => ({
          client,
          tone: 'warn',
          title: `${client.name} · خلال ${alertInfo.daysUntilNext} أيام`,
          description: `${alertInfo.nextUpcoming?.due_date || ''} · ${client.asset || 'بدون أصل محدد'}`,
          amount: alertInfo.nextUpcoming?.amount || 0,
          focusPeriod: alertInfo.nextUpcoming?.period_key,
        }));

    case 'stuck':
      return clients
        .filter((client) => client.status === 'stuck' && !client.has_court)
        .sort((a, b) => b.summary.remaining_amount - a.summary.remaining_amount)
        .map((client) => ({
          client,
          tone: 'stuck',
          title: `⚠ ${client.name}${client.id_number ? ` · ${client.id_number}` : ''}`,
          description: `المتبقي ${client.summary.remaining_amount.toLocaleString('ar-SA')} ر.س · رأس المال ${client.principal.toLocaleString('ar-SA')} ر.س`,
        }));

    default:
      return [];
  }
}

export function filterAlertEntries(entries: AlertEntry[], query: string): AlertEntry[] {
  return entries.filter((entry) => clientMatchesSearch(entry.client, query));
}

export function buildCollectionEntries(clients: Client[], mode: 'all' | 'late' | 'upcoming' = 'all'): CollectionEntry[] {
  const lateEntries = clients.flatMap((client) => (
    getOverdueScheduleItems(client)
      .sort(sortByDueDateAsc)
      .map((item) => ({
        key: `${client.id}-${item.period_key}`,
        client,
        item,
        state: 'late' as const,
        daysUntil: getDaysUntil(item.due_date),
      }))
  ));

  const upcomingEntries = clients.flatMap((client) => (
    getUpcomingScheduleItems(client, 30)
      .sort(sortByDueDateAsc)
      .map((item) => ({
        key: `${client.id}-${item.period_key}`,
        client,
        item,
        state: 'upcoming' as const,
        daysUntil: getDaysUntil(item.due_date),
      }))
  ));

  if (mode === 'late') {
    return lateEntries.sort((a, b) => new Date(a.item.due_date).getTime() - new Date(b.item.due_date).getTime());
  }

  if (mode === 'upcoming') {
    return upcomingEntries.sort((a, b) => new Date(a.item.due_date).getTime() - new Date(b.item.due_date).getTime());
  }

  return [...lateEntries, ...upcomingEntries].sort((a, b) => {
    if (a.state !== b.state) return a.state === 'late' ? -1 : 1;
    return new Date(a.item.due_date).getTime() - new Date(b.item.due_date).getTime();
  });
}

export function filterCollectionEntries(entries: CollectionEntry[], query: string): CollectionEntry[] {
  return entries.filter((entry) => clientMatchesSearch(entry.client, query));
}
