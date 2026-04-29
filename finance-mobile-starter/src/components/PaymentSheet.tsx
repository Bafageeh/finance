import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { PaymentScheduleItem } from '@/types/api';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';
import { BottomSheet } from './BottomSheet';
import { LabeledInput } from './LabeledInput';

interface PaymentSheetProps {
  item: PaymentScheduleItem | null;
  visible: boolean;
  paidAmount: string;
  bankNote: string;
  saving: boolean;
  onClose: () => void;
  onAmountChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onSubmit: () => void;
}

export function PaymentSheet({
  item,
  visible,
  paidAmount,
  bankNote,
  saving,
  onClose,
  onAmountChange,
  onNoteChange,
  onSubmit,
}: PaymentSheetProps) {
  if (!item) return null;

  const presetAmount = formatCurrency(item.amount);

  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      title="تسجيل دفعة"
      subtitle={`القسط ${item.month} · استحقاق ${formatDate(item.due_date)}`}
      footer={
        <View style={styles.footerActions}>
          <TouchableOpacity style={styles.secondaryButton} onPress={onClose} disabled={saving}>
            <Text style={styles.secondaryButtonText}>إلغاء</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.primaryButton, saving && styles.primaryButtonDisabled]} onPress={onSubmit} disabled={saving}>
            <Ionicons name="wallet-outline" size={16} color="#fff" />
            <Text style={styles.primaryButtonText}>{saving ? 'جارٍ الحفظ...' : 'حفظ الدفعة'}</Text>
          </TouchableOpacity>
        </View>
      }
    >
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryTag}>
            <Text style={styles.summaryTagText}>المبلغ المطلوب</Text>
          </View>
          <Text style={styles.summaryAmount}>{presetAmount}</Text>
        </View>

        <Text style={styles.summaryHint}>يمكنك تعديل المبلغ إذا كانت الحوالة أقل أو أعلى من قيمة القسط.</Text>
      </View>

      <View style={styles.presetRow}>
        <TouchableOpacity style={styles.presetChip} onPress={() => onAmountChange(String(item.amount))}>
          <Ionicons name="sparkles-outline" size={14} color={colors.text} />
          <Text style={styles.presetChipText}>اعتماد المبلغ الكامل</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.presetChip} onPress={() => onNoteChange('تم السداد عبر تحويل بنكي')}>
          <Ionicons name="document-text-outline" size={14} color={colors.text} />
          <Text style={styles.presetChipText}>إضافة ملاحظة جاهزة</Text>
        </TouchableOpacity>
      </View>

      <LabeledInput
        label="قيمة الحوالة البنكية"
        value={paidAmount}
        onChangeText={onAmountChange}
        keyboardType="decimal-pad"
        hint={`المبلغ الافتراضي ${presetAmount}`}
      />

      <LabeledInput
        label="النص البنكي / ملاحظة"
        value={bankNote}
        onChangeText={onNoteChange}
        placeholder="مثال: حوالة بنك الراجحي 15:20"
        multiline
        style={styles.noteInput}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  summaryCard: {
    borderRadius: 22,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 10,
  },
  summaryRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  summaryTag: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  summaryTagText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  summaryHint: {
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 20,
    textAlign: 'right',
  },
  presetRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetChip: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  presetChipText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  noteInput: {
    minHeight: 100,
    textAlignVertical: 'top',
    paddingTop: 14,
  },
  footerActions: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
  },
  primaryButton: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    backgroundColor: colors.primary,
    paddingVertical: 13,
  },
  primaryButtonDisabled: {
    opacity: 0.6,
  },
  primaryButtonText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
  },
});
