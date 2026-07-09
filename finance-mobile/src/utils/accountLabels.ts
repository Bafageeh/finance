import { AuthUser } from '@/types/auth';
import { ProfitShare } from '@/types/api';

export function getAccountOwnerName(user?: AuthUser | null): string {
  const email = String(user?.email || '').toLowerCase();
  const slug = String(user?.account_slug || '').toLowerCase();
  const name = String(user?.name || '').trim();

  if (email === 'sara@pm.sa' || slug === 'sara') {
    return 'سارة';
  }

  if (email === 'ali@pm.sa' || slug === 'ali') {
    return 'علي';
  }

  if (name && name !== 'Admin') {
    return name;
  }

  return 'أحمد';
}

export function getPartnerName(ownerName: string): string {
  return ownerName === 'علي' ? 'أحمد' : 'علي';
}

export function ownerProfitLabel(user?: AuthUser | null): string {
  return `ربح ${getAccountOwnerName(user)}`;
}

export function partnerProfitLabel(user?: AuthUser | null): string {
  return `ربح ${getPartnerName(getAccountOwnerName(user))}`;
}

export function ownerMonthlyProfitLabel(user?: AuthUser | null): string {
  return `${getAccountOwnerName(user)} شهريًا`;
}

export function partnerMonthlyProfitLabel(user?: AuthUser | null): string {
  return `${getPartnerName(getAccountOwnerName(user))} شهريًا`;
}

export function ownerTotalProfitLineLabel(user?: AuthUser | null): string {
  return `ربح ${getAccountOwnerName(user)} الكلي`;
}

export function partnerTotalProfitLineLabel(user?: AuthUser | null): string {
  return `ربح ${getPartnerName(getAccountOwnerName(user))} الكلي`;
}

export function profitShareLabelForUser(value: ProfitShare | null | undefined, user?: AuthUser | null): string {
  const ownerName = getAccountOwnerName(user);
  const partnerName = getPartnerName(ownerName);

  return value === 'ahmad_only' ? `${ownerName} 100%` : `${ownerName} 65% + ${partnerName} 35%`;
}
