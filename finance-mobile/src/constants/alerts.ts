import { AlertTone } from '@/components/AlertItemCard';

export type AlertRouteType = 'court' | 'late' | 'warn' | 'stuck';

export interface AlertTypeMeta {
  title: string;
  subtitle: string;
  helper: string;
  emptyTitle: string;
  emptyDescription: string;
  tone: AlertTone;
}

export const alertTypeMeta: Record<AlertRouteType, AlertTypeMeta> = {
  court: {
    title: 'قضايا المحكمة',
    subtitle: 'كل العملاء الذين تم تفعيل المتابعة القضائية لهم.',
    helper: 'مطابقة مباشرة لقسم قضايا المحكمة في شاشة التمويل الرئيسية.',
    emptyTitle: 'لا توجد قضايا حالياً',
    emptyDescription: 'عند تفعيل قضية على أي عميل ستظهر هنا تلقائياً.',
    tone: 'court',
  },
  late: {
    title: 'المتأخرون في السداد',
    subtitle: 'العملاء الذين لديهم أقساط مستحقة وغير مدفوعة حتى اليوم.',
    helper: 'هذه الشاشة تساعدك على مراجعة المتأخرات بسرعة ثم فتح العميل مباشرة لتسجيل التحصيل أو المتابعة.',
    emptyTitle: 'لا توجد متأخرات حالياً',
    emptyDescription: 'جميع العملاء الحاليين منتظمون في السداد.',
    tone: 'late',
  },
  warn: {
    title: 'الاستحقاقات القريبة',
    subtitle: 'الأقساط القادمة خلال 7 أيام لتسهيل التذكير المبكر.',
    helper: 'مطابقة لقسم يستحق قريباً الموجود في ملف HTML الأصلي.',
    emptyTitle: 'لا توجد استحقاقات قريبة',
    emptyDescription: 'سيتم عرض أول الأقساط القادمة هنا تلقائياً عند اقتراب موعدها.',
    tone: 'warn',
  },
  stuck: {
    title: 'العملاء المتعثرون',
    subtitle: 'الحالات المتعثرة غير المرتبطة بقضية حتى الآن.',
    helper: 'هذه الشاشة مخصصة للفرز والمتابعة اليدوية قبل التحويل القضائي.',
    emptyTitle: 'لا يوجد متعثرون',
    emptyDescription: 'الحالات المتعثرة ستظهر هنا عندما تتغير حالة أي عميل إلى متعثر.',
    tone: 'stuck',
  },
};
