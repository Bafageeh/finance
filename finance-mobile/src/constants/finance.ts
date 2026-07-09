import { ClientFilter, ProfitShare } from '@/types/api';

export const bondOptions = [
  {
    key: 'none',
    value: 0,
    title: 'بدون',
    subtitle: 'لا توجد رسوم سند',
  },
  {
    key: 'single',
    value: 74.75,
    title: 'سند واحد',
    subtitle: 'للعقود الفردية أو البسيطة',
  },
  {
    key: 'group',
    value: 126.5,
    title: 'مجموعة سندات',
    subtitle: 'للعقود التي تحتاج أكثر من سند',
  },
  {
    key: 'custom',
    value: 'custom',
    title: 'مبلغ آخر',
    subtitle: 'تحديد مبلغ مختلف يدويًا',
  },
] as const;

export const profitShareOptions: { value: ProfitShare; label: string; subtitle: string }[] = [
  {
    value: 'shared',
    label: `الحساب 65% + علي 35%`,
    subtitle: 'التوزيع الافتراضي للأرباح',
  },
  {
    value: 'ahmad_only',
    label: `الحساب 100%`,
    subtitle: 'عند عدم وجود شريك في العقد',
  },
];

export const clientFilterOrder: ClientFilter[] = ['all', 'active', 'late', 'stuck', 'court', 'done'];
