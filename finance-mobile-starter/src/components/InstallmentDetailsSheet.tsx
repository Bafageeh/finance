import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { PaymentScheduleItem } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';
import { BottomSheet } from './BottomSheet';
import { IconPillButton } from './IconPillButton';
import { KeyValueRow } from './KeyValueRow';

interface InstallmentDetailsSheetProps {
  item: PaymentScheduleItem | null;
  visible: boolean;
  onClose: () => void;
  onRecordPress?: () => void;
  onUndoPress?: () => void;
}

export function InstallmentDetailsSheet({
  item,
  visible,
  onClose,
  onRecordPress,
  onUndoPress,
}: InstallmentDetailsSheetProps) {
  if (!item) return null;

  const palette = item.is_paid
    ? {
        label: 'مدفوع',
        badgeBg: colors.successSoft,
        badgeText: colors.success,
        accent: '#d4e9de',
        icon: 'checkmark-done-circle-outline' as const,
      }
    : {
        label: 'بانتظار السداد',
        badgeBg: colors.warningSoft,
        badgeText: colors.warning,
        accent: '#efe0c2',
        icon: 'time-outline' as const,
      };

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title={`القسط ${item.month}`}
      subtitle={item.is_paid ? 'مراجعة تفاصيل الدفعة المسجلة' : 'مراجعة القسط قبل تنفيذ إجراء سريع'}
      footer={
        <View style={styles.footerActions}>
          {item.is_paid ? (
            <IconPillButton icon="refresh-outline" label="إلغاء الدفعة" tone="danger" onPress={onUndoPress} />
          ) : (
            <IconPillButton icon="checkmark-done-outline" label="تسجيل دفعة" tone="success" onPress={onRecordPress} />
          )}
          <IconPillButton icon="close-outline" label="إغلاق" onPress={onClose} />
        </View>
      }
    >
      <View style={[styles.hero, { borderColor: palette.accent }]}> 
        <View style={styles.heroTopRow}>
          <View style={[styles.statusBadge, { backgroundColor: palette.badgeBg }]}>
            <Text style={[styles.statusLabel, { color: palette.badgeText }]}>{palette.label}</Text>
          </View>

          <View style={styles.iconWrap}>
            <Ionicons name={palette.icon} size={18} color={palette.badgeText} />
          </View>
        </View>

        <Text style={styles.heroAmount}>{formatCurrency(item.is_paid ? item.paid_amount ?? item.amount : item.amount)}</Text>
        <Text style={styles.heroCaption}>قيمة هذا القسط</Text>
      </View>

      <View style={styles.groupCard}>
        <KeyValueRow label="تاريخ الاستحقاق" value={formatDate(item.due_date)} />
        <KeyValueRow label="المفتاح الزمني" value={item.period_key} />
        {item.is_paid ? (
          <>
            <KeyValueRow label="تاريخ السداد" value={formatDate(item.paid_date || item.due_date)} />
            <KeyValueRow label="المبلغ المدفوع" value={formatCurrency(item.paid_amount ?? item.amount)} />
          </>
        ) : (
          <KeyValueRow label="المبلغ المطلوب" value={formatCurrency(item.amount)} />
        )}
      </View>

      <View style={styles.noteCard}>
        <Text style={styles.noteLabel}>الملاحظة البنكية</Text>
        <Text style={styles.noteValue}>
          {item.bank_note?.trim() || (item.is_paid ? 'تم السداد بدون ملاحظة مضافة.' : 'لا توجد ملاحظة بنكية لهذا القسط حتى الآن.')}
        </Text>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  hero: {
    borderRadius: 22,
    borderWidth: 1,
    backgroundColor: colors.surfaceMuted,
    padding: 16,
    gap: 6,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: '800',
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroAmount: {
    fontSize: 26,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  heroCaption: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  groupCard: {
    borderRadius: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
  },
  noteCard: {
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  noteLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  noteValue: {
    fontSize: 13,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'right',
  },
  footerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
});
