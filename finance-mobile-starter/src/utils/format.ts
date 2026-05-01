import { Client, ClientFilter, ClientStatus, ProfitShare } from '@/types/api';

export function formatCurrency(value: number | null | undefined): string {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return `${safeValue.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
}

export function formatPercent(value: number | null | undefined): string {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return `${safeValue.toFixed(2)}%`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', {
    calendar: 'gregory',
    numberingSystem: 'latn',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function statusLabel(status: ClientStatus): string {
  switch (status) {
    case 'active':
      return 'نشط';
    case 'stuck':
      return 'متعثر';
    case 'done':
      return 'منتهي';
    default:
      return status;
  }
}

export function filterLabel(filter: ClientFilter): string {
  switch (filter) {
    case 'all':
      return 'الكل';
    case 'active':
      return 'نشط';
    case 'stuck':
      return 'متعثر';
    case 'done':
      return 'منتهي';
    case 'court':
      return 'قضية';
    default:
      return filter;
  }
}

export function profitShareLabel(value: ProfitShare | null | undefined): string {
  return value === 'ahmad_only' ? 'أحمد 100%' : 'أحمد 65% + علي 35%';
}

export function getClientDisplayStatus(client: Client): ClientStatus {
  if (client.status === 'stuck') return 'stuck';
  if ((client.summary?.paid_count || 0) >= client.months || client.status === 'done') return 'done';
  return 'active';
}

export function clientMatchesSearch(client: Client, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;

  return [client.name, client.id_number, client.phone, client.asset, client.notes]
    .filter(Boolean)
    .some((field) => String(field).toLowerCase().includes(q));
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((part) => part[0]).join('');
}

export function formatInteger(value: number | null | undefined): string {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return safeValue.toLocaleString('ar-SA');
}
