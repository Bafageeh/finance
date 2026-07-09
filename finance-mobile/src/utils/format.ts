import { Client, ClientFilter, ClientStatus, ProfitShare } from '@/types/api';

export function toSafeNumber(value: unknown): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value
      .replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
      .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)))
      .replace(/,/g, '')
      .replace(/[^\d.-]/g, '')
      .trim();
    const numeric = Number(normalized);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
}

export function formatCurrency(value: unknown): string {
  const safeValue = toSafeNumber(value);
  return `${safeValue.toLocaleString('ar-SA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ر.س`;
}

export function formatPercent(value: number | null | undefined): string {
  const safeValue = Number.isFinite(value as number) ? Number(value) : 0;
  return `${safeValue.toFixed(2)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return String(value);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
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

export function formatDateDDMMYYYY(value?: string | Date | null): string {
  if (!value) return '—';

  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return '—';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${day}/${month}/${year}`;
}
