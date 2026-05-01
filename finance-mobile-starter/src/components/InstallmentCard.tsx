import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { GestureResponderEvent, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PaymentScheduleItem } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

interface InstallmentCardProps {
  item: PaymentScheduleItem;
  state: 'paid' | 'late' | 'next' | 'upcoming';
  onPress?: () => void;
  onRecordPress?: () => void;
  onUndoPress?: () => void;
  readOnly?: boolean;
}

function asMoney(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function stopAndRun(event: GestureResponderEvent, callback?: () => void) {
  event.stopPropagation?.();
  callback?.();
}

export function InstallmentCard({ item, state, onPress, onRecordPress, onUndoPress, readOnly = false }: InstallmentCardProps) {
  const [actionsOpen, setActionsOpen] = useState(false);

  const expectedAmount = asMoney(item.installment_amount ?? item.amount);
  const recordedAmount = asMoney(item.recorded_paid_amount ?? item.paid_amount);
  const hasRecordedPayment = Boolean(item.payment_id) || recordedAmount > 0;
  const paidStatus = String(item.payment_status || '').toLowerCase();
  const computedRemainingDue = Math.max(0, expectedAmount - recordedAmount);
  const remainingDue = asMoney(item.remaining_due ?? computedRemainingDue);
  const isPartialPayment = hasRecordedPayment && (paidStatus === 'partial' || remainingDue > 0.01);

  const palette = isPartialPayment ? statePalette.partial : statePalette[state];
  const shownAmount = hasRecordedPayment ? (recordedAmount > 0 ? recordedAmount : expectedAmount) : expectedAmount;
  const amountCaption = hasRecordedPayment ? 'المسجل' : 'المطلوب';
  const badgeLabel = isPartialPayment ? 'جزئي' : palette.label;

  const secondaryText = hasRecordedPayment
    ? isPartialPayment
      ? `دفع جزئي · المتبقي ${formatCurrency(remainingDue)}`
      : item.bank_note || 'تم السداد بدون ملاحظة'
    : state === 'late'
      ? 'القسط متأخر ويحتاج متابعة'
      : state === 'next'
        ? 'القسط الأقرب للسداد'
        : 'بانتظار تسجيل الدفعة';

  function handlePrimaryAction(event: GestureResponderEvent) {
    event.stopPropagation?.();

    if (readOnly) {
      return;
    }

    if (hasRecordedPayment) {
      setActionsOpen((current) => !current);
      return;
    }

    onRecordPress?.();
  }

  function handleEditPayment(event: GestureResponderEvent) {
    stopAndRun(event, () => {
      if (readOnly) return;
      setActionsOpen(false);
      (onRecordPress || onPress)?.();
    });
  }

  function handleCancelPayment(event: GestureResponderEvent) {
    stopAndRun(event, () => {
      if (readOnly) return;
      setActionsOpen(false);
      onUndoPress?.();
    });
  }

  const canInteract = !readOnly && Boolean(onPress);

  return (
    <Pressable
      onPress={readOnly ? undefined : onPress}
      disabled={!canInteract}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: palette.background,
          borderColor: palette.borderColor,
          opacity: pressed && canInteract ? 0.96 : 1,
        },
      ]}
    >
      <View style={styles.rowTop}>
        {!readOnly ? (
          <View style={styles.actionWrap}>
            <TouchableOpacity
              accessibilityLabel={hasRecordedPayment ? 'تعديل الدفعة' : 'تسجيل دفعة'}
              style={[styles.iconButton, hasRecordedPayment ? styles.editButton : styles.recordButton]}
              onPress={handlePrimaryAction}
              activeOpacity={0.82}
            >
              <Ionicons name={hasRecordedPayment ? 'create-outline' : 'checkmark-done-outline'} size={16} color={hasRecordedPayment ? colors.text : '#0f6e56'} />
            </TouchableOpacity>
            <Text style={styles.actionLabel}>{hasRecordedPayment ? 'تعديل' : 'دفع'}</Text>
          </View>
        ) : null}

        <View style={styles.mainInfo}>
          <View style={styles.titleRow}>
            <View style={styles.amountColumn}>
              <Text style={styles.amount}>{formatCurrency(shownAmount)}</Text>
              <Text style={styles.amountCaption}>{amountCaption}</Text>
            </View>

            <View style={styles.titleColumn}>
              <View style={styles.titleLine}>
                {!readOnly ? <Ionicons name="chevron-back" size={16} color={colors.textMuted} /> : null}
                <Text style={styles.title}>القسط {item.month}</Text>
              </View>

              <View style={styles.metaRow}>
                <Text style={styles.metaText}>{formatDate(item.due_date)}</Text>
                <Text style={styles.metaDot}>•</Text>
                <View style={[styles.badge, { backgroundColor: palette.badgeBackground }]}> 
                  <Text style={[styles.badgeText, { color: palette.badgeText }]}>{badgeLabel}</Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.noteText} numberOfLines={1}>
            {secondaryText}
          </Text>
        </View>
      </View>

      {!readOnly && actionsOpen && hasRecordedPayment ? (
        <View style={styles.actionsPanel}>
          <TouchableOpacity style={[styles.panelButton, styles.panelEditButton]} onPress={handleEditPayment} activeOpacity={0.86}>
            <Ionicons name="create-outline" size={15} color={colors.text} />
            <Text style={styles.panelEditText}>تعديل مبلغ الدفعة</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.panelButton, styles.panelCancelButton]} onPress={handleCancelPayment} activeOpacity={0.86}>
            <Ionicons name="trash-outline" size={15} color={colors.danger} />
            <Text style={styles.panelCancelText}>إلغاء الدفعة</Text>
          </TouchableOpacity>
        </View>
      ) : null}
    </Pressable>
  );
}

const statePalette = {
  paid: {
    background: '#fbfcf9',
    borderColor: '#e4eee8',
    badgeBackground: colors.successSoft,
    badgeText: colors.success,
    label: 'مدفوع',
  },
  partial: {
    background: '#fffaf2',
    borderColor: '#f1dfbd',
    badgeBackground: '#fff0d2',
    badgeText: '#9a6510',
    label: 'جزئي',
  },
  late: {
    background: '#fff7f7',
    borderColor: '#f2d0d0',
    badgeBackground: '#f7d7d7',
    badgeText: colors.danger,
    label: 'متأخر',
  },
  next: {
    background: '#f7fbff',
    borderColor: '#d7e7f7',
    badgeBackground: '#d8eaf7',
    badgeText: colors.info,
    label: 'التالي',
  },
  upcoming: {
    background: '#faf9f6',
    borderColor: '#ece8de',
    badgeBackground: '#ece8de',
    badgeText: colors.textMuted,
    label: 'قادم',
  },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 11,
    marginBottom: 8,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  actionWrap: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    width: 40,
  },
  iconButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  recordButton: {
    borderColor: '#b5e6d6',
    backgroundColor: colors.successSoft,
  },
  editButton: {
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  actionLabel: {
    fontSize: 9,
    fontWeight: '800',
    color: colors.textMuted,
  },
  mainInfo: {
    flex: 1,
    gap: 5,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 10,
  },
  amountColumn: {
    alignItems: 'flex-start',
    gap: 2,
    minWidth: 82,
  },
  amount: {
    fontSize: 12,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'left',
  },
  amountCaption: {
    fontSize: 10,
    color: colors.textMuted,
  },
  titleColumn: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 4,
  },
  titleLine: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  title: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    flexWrap: 'wrap',
  },
  metaText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  metaDot: {
    fontSize: 11,
    color: '#b7b3a8',
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  noteText: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  actionsPanel: {
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
    paddingTop: 10,
    flexDirection: 'row-reverse',
    gap: 8,
  },
  panelButton: {
    flex: 1,
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 10,
  },
  panelEditButton: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
  },
  panelCancelButton: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#f1b1b1',
  },
  panelEditText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  panelCancelText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '900',
  },
});
