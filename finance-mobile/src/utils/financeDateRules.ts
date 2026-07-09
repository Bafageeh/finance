export function formatDateOnly(value?: string | Date | null): string {
  if (!value) return '';
  if (value instanceof Date) {
    const y = value.getFullYear();
    const m = String(value.getMonth() + 1).padStart(2, '0');
    const d = String(value.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const valueText = String(value).trim();
  if (!valueText) return '';
  const match = valueText.match(/^(\d{4}-\d{2}-\d{2})/);
  return match ? match[1] : valueText;
}

function toLocalDate(value: string): Date {
  const dateOnly = formatDateOnly(value);
  const [year, month, day] = dateOnly.split('-').map(Number);
  return new Date(year || 1970, (month || 1) - 1, day || 1);
}

export function addOneMonthToDateOnly(value: string): string {
  const date = toLocalDate(value);
  const originalDay = date.getDate();
  const target = new Date(date.getFullYear(), date.getMonth() + 1, 1);
  const lastDayOfTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(originalDay, lastDayOfTargetMonth));
  return formatDateOnly(target);
}

export function isDateOnlyBefore(left?: string | null, right?: string | null): boolean {
  const a = formatDateOnly(left || '');
  const b = formatDateOnly(right || '');
  if (!a || !b) return false;
  return toLocalDate(a).getTime() < toLocalDate(b).getTime();
}
