import { Ionicons } from '@expo/vector-icons';
import { router, useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, KeyboardAvoidingView, Modal, Platform, ScrollView,
  StyleSheet, Text, TextInput, TouchableOpacity, View,
} from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { IconButton } from '@/components/IconButton';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import {
  CharityOverview, CharityPaymentInput, CharityPaymentRecord,
  createCharityPayment, editCharityPayment, getCharityOverview, removeCharityPayment,
} from '@/services/api';
import { formatCurrency, formatDateDDMMYYYY } from '@/utils/format';
import { colors } from '@/utils/theme';

type Draft = { amount: string; paidAt: string; note: string };

function todayDisplay(): string {
  const now = new Date();
  return String(now.getDate()).padStart(2, '0') + '/' +
    String(now.getMonth() + 1).padStart(2, '0') + '/' + now.getFullYear();
}
function normalizeDigits(value: string) {
  return value.replace(/[٠-٩]/g, (digit) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(digit)))
    .replace(/[۰-۹]/g, (digit) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(digit)));
}
function toApiDate(raw: string): string | null {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(normalizeDigits(raw.trim()));
  if (!match) return null;
  const [day, month, year] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  if (year < 2000 || date.getFullYear() !== year || date.getMonth() !== month - 1
    || date.getDate() !== day || date > now) return null;
  return match[3] + '-' + match[2] + '-' + match[1];
}
function parseAmount(raw: string): number | null {
  const cleaned = normalizeDigits(raw.trim()).replace(/[٬,\s]/g, '').replace(/٫/g, '.');
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) && value > 0 && value <= 9999999999999.99 ? value : null;
}

export default function CharityScreen() {
  const focused = useIsFocused();
  const [overview, setOverview] = useState<CharityOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CharityPaymentRecord | null>(null);
  const [draft, setDraft] = useState<Draft>({ amount: '', paidAt: todayDisplay(), note: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<number | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      setOverview(await getCharityOverview());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل سجل الصدقات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }
  useEffect(() => { if (focused) void loadData(); }, [focused]);

  function openEditor(payment?: CharityPaymentRecord) {
    setEditing(payment || null);
    setDraft(payment
      ? { amount: String(payment.amount), paidAt: formatDateDDMMYYYY(payment.paid_at), note: payment.note || '' }
      : { amount: '', paidAt: todayDisplay(), note: '' });
    setModalOpen(true);
  }

  async function savePayment() {
    if (saving) return;
    const amount = parseAmount(draft.amount);
    const paidAt = toApiDate(draft.paidAt);
    if (amount === null) {
      Alert.alert('تحقق من المبلغ', 'أدخل مبلغًا أكبر من صفر، وبحد أقصى منزلتين عشريتين.');
      return;
    }
    if (!paidAt) {
      Alert.alert('تحقق من التاريخ', 'أدخل تاريخ الدفع بصيغة يوم/شهر/سنة ولا يتجاوز اليوم.');
      return;
    }
    const input: CharityPaymentInput = { amount, paid_at: paidAt, note: draft.note.trim() || null };
    setSaving(true);
    try {
      if (editing) await editCharityPayment(editing.id, input);
      else await createCharityPayment(input);
      setModalOpen(false);
      setEditing(null);
      await loadData(true);
    } catch (err) {
      Alert.alert('تعذر الحفظ', err instanceof Error ? err.message : 'حاول مرة أخرى.');
    } finally {
      setSaving(false);
    }
  }

  function confirmDelete(payment: CharityPaymentRecord) {
    Alert.alert('حذف دفعة الصدقة',
      'هل تريد حذف دفعة ' + formatCurrency(payment.amount) + '؟ سيُعاد حساب الرصيد.',
      [
        { text: 'إلغاء', style: 'cancel' },
        { text: 'حذف', style: 'destructive', onPress: () => { void deletePayment(payment.id); } },
      ]);
  }

  async function deletePayment(id: number) {
    if (deleting !== null) return;
    setDeleting(id);
    try {
      await removeCharityPayment(id);
      await loadData(true);
    } catch (err) {
      Alert.alert('تعذر حذف الدفعة', err instanceof Error ? err.message : 'حاول مرة أخرى.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <Screen
      title="سجل الصدقات"
      subtitle="صدقة أحمد 1% من إجمالي أرباحه، باستثناء العملاء المتعثرين."
      compactHeader
      rightSlot={<IconButton icon="arrow-back" accessibilityLabel="رجوع" size="sm" onPress={() => router.back()} />}
    >
      {loading ? <LoadingBlock /> : null}
      {!loading && error ? <AppCard title="تعذر التحميل"><Text style={styles.error}>{error}</Text></AppCard> : null}
      {!loading && overview ? (
        <>
          <AppCard title="احتساب الصدقة">
            <Text style={styles.description}>
              تشمل أرباح أحمد من جميع العقود، بما فيها المنتهية والقضايا، وتستبعد المتعثرين حتى رفع التعثر.
              حصة أحمد 100% في تمويله الخاص و65% في الشراكة مع علي.
            </Text>
            <View style={styles.profitRow}>
              <Text style={styles.profitLabel}>إجمالي أرباح أحمد المشمولة</Text>
              <Text style={styles.profitValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(overview.ahmad_profit_eligible)}</Text>
            </View>
            <View style={styles.summaryGrid}>
              <View style={[styles.summaryTile, styles.totalTile]}>
                <Text style={styles.summaryTitle}>الصدقة المستحقة (1%)</Text>
                <Text style={styles.summaryNumber} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(overview.sadaqa_total)}</Text>
              </View>
              <View style={[styles.summaryTile, styles.paidTile]}>
                <Text style={styles.summaryTitle}>إجمالي ما تم دفعه</Text>
                <Text style={[styles.summaryNumber, styles.paidText]} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(overview.sadaqa_paid)}</Text>
              </View>
            </View>
            <View style={styles.balanceRow}>
              <Text style={styles.balanceLabel}>المتبقي من الصدقة</Text>
              <Text style={styles.balanceValue} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(overview.sadaqa_remaining)}</Text>
            </View>
            {overview.sadaqa_overpaid > 0 ? (
              <Text style={styles.creditText}>المبالغ المدفوعة تزيد عن المستحق حاليًا بمقدار {formatCurrency(overview.sadaqa_overpaid)}؛ وتبقى محفوظة في السجل.</Text>
            ) : null}
            <Text style={styles.countText}>العقود المشمولة: {overview.eligible_clients_count} · المستبعدة للتعثر: {overview.excluded_stuck_count}</Text>
          </AppCard>

          <View style={styles.recordsHeader}>
            <TouchableOpacity style={styles.addButton} onPress={() => openEditor()} accessibilityRole="button">
              <Ionicons name="add-circle-outline" size={19} color="#fff" />
              <Text style={styles.addText}>إضافة دفعة صدقة</Text>
            </TouchableOpacity>
            <Text style={styles.recordsTitle}>سجل المدفوعات ({overview.payments.length})</Text>
          </View>
          {overview.payments.length === 0 ? (
            <EmptyState title="لا توجد دفعات صدقة مسجلة" description="استخدم زر إضافة دفعة لتسجيل أول صدقة مدفوعة." />
          ) : overview.payments.map((payment) => (
            <View key={payment.id} style={styles.paymentCard}>
              <View style={styles.paymentMain}>
                <View style={styles.paymentInfo}>
                  <Text style={styles.paymentAmount}>{formatCurrency(payment.amount)}</Text>
                  <Text style={styles.paymentDate}>تاريخ الدفع: {formatDateDDMMYYYY(payment.paid_at)}</Text>
                  {payment.note ? <Text style={styles.paymentNote}>{payment.note}</Text> : null}
                </View>
                <View style={styles.actions}>
                  <TouchableOpacity style={styles.iconAction} accessibilityRole="button" accessibilityLabel="تعديل دفعة" onPress={() => openEditor(payment)}>
                    <Ionicons name="create-outline" size={20} color={colors.info} />
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.iconAction} disabled={deleting !== null} accessibilityRole="button" accessibilityLabel="حذف دفعة" onPress={() => confirmDelete(payment)}>
                    {deleting === payment.id
                      ? <ActivityIndicator size="small" color={colors.danger} />
                      : <Ionicons name="trash-outline" size={20} color={colors.danger} />}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
          <TouchableOpacity style={styles.refreshButton} onPress={() => { setRefreshing(true); void loadData(true); }}>
            <Ionicons name="refresh-outline" size={16} color={colors.textMuted} />
            <Text style={styles.refreshText}>{refreshing ? 'جارٍ التحديث...' : 'تحديث الرصيد والدفعات'}</Text>
          </TouchableOpacity>
        </>
      ) : null}

      <Modal visible={modalOpen} transparent animationType="fade" onRequestClose={() => { if (!saving) setModalOpen(false); }}>
        <KeyboardAvoidingView style={styles.modalOverlay} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalScroll}>
            <View style={styles.formCard}>
              <View style={styles.formHeader}>
                <TouchableOpacity disabled={saving} onPress={() => setModalOpen(false)} accessibilityLabel="إغلاق">
                  <Ionicons name="close-circle-outline" size={25} color={colors.textMuted} />
                </TouchableOpacity>
                <Text style={styles.formTitle}>{editing ? 'تعديل دفعة الصدقة' : 'تسجيل دفعة صدقة'}</Text>
              </View>
              <Text style={styles.inputLabel}>المبلغ المدفوع (ريال)</Text>
              <TextInput style={styles.input} value={draft.amount}
                onChangeText={(amount) => setDraft((current) => ({ ...current, amount }))}
                keyboardType="decimal-pad" placeholder="0.00" placeholderTextColor="#9d9d9b" textAlign="right"
              />
              <Text style={styles.inputLabel}>تاريخ الدفع (يوم/شهر/سنة)</Text>
              <TextInput style={styles.input} value={draft.paidAt}
                onChangeText={(paidAt) => setDraft((current) => ({ ...current, paidAt }))}
                placeholder="16/10/2026" placeholderTextColor="#9d9d9b" keyboardType="numbers-and-punctuation" textAlign="right"
              />
              <Text style={styles.inputLabel}>البيان أو الملاحظة (اختياري)</Text>
              <TextInput style={[styles.input, styles.noteInput]} value={draft.note}
                onChangeText={(note) => setDraft((current) => ({ ...current, note }))}
                placeholder="مثال: صدقة شهر أكتوبر" placeholderTextColor="#9d9d9b" multiline maxLength={1000} textAlign="right"
              />
              <View style={styles.formActions}>
                <TouchableOpacity disabled={saving} style={[styles.submitButton, saving && styles.disabled]} onPress={() => { void savePayment(); }} accessibilityRole="button">
                  {saving ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.submitText}>{editing ? 'حفظ التعديل' : 'تسجيل الدفعة'}</Text>}
                </TouchableOpacity>
                <TouchableOpacity disabled={saving} style={styles.cancelButton} onPress={() => setModalOpen(false)}>
                  <Text style={styles.cancelText}>إلغاء</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.danger, textAlign: 'right' },
  description: { color: colors.textMuted, fontSize: 12, textAlign: 'right', lineHeight: 21 },
  profitRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  profitLabel: { flex: 1, fontSize: 12, color: colors.textMuted, textAlign: 'right' },
  profitValue: { maxWidth: '55%', color: colors.text, fontSize: 15, fontWeight: '900' },
  summaryGrid: { flexDirection: 'row-reverse', gap: 8 },
  summaryTile: { flex: 1, minWidth: 0, borderRadius: 14, padding: 12, gap: 9 },
  totalTile: { backgroundColor: colors.warningSoft },
  paidTile: { backgroundColor: colors.successSoft },
  summaryTitle: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  summaryNumber: { color: colors.warning, fontSize: 16, fontWeight: '900', textAlign: 'right' },
  paidText: { color: colors.success },
  balanceRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', backgroundColor: colors.infoSoft, borderRadius: 14, padding: 13, gap: 12 },
  balanceLabel: { flex: 1, color: colors.text, fontSize: 13, fontWeight: '800', textAlign: 'right' },
  balanceValue: { maxWidth: '60%', color: colors.info, fontWeight: '900', fontSize: 19 },
  creditText: { color: colors.warning, fontSize: 11, textAlign: 'right', lineHeight: 19 },
  countText: { color: colors.textMuted, fontSize: 11, textAlign: 'right' },
  recordsHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, gap: 10 },
  recordsTitle: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 15, fontWeight: '800' },
  addButton: { flexDirection: 'row-reverse', backgroundColor: colors.primary, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center', gap: 6 },
  addText: { color: '#fff', fontSize: 12, fontWeight: '800' },
  paymentCard: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: 14, marginBottom: 8, padding: 13 },
  paymentMain: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  paymentInfo: { flex: 1, gap: 5 },
  paymentAmount: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  paymentDate: { color: colors.textMuted, fontSize: 12, textAlign: 'right' },
  paymentNote: { color: colors.text, fontSize: 12, textAlign: 'right', lineHeight: 20 },
  actions: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  iconAction: { backgroundColor: colors.surfaceMuted, borderRadius: 9, padding: 9 },
  refreshButton: { flexDirection: 'row-reverse', justifyContent: 'center', alignItems: 'center', gap: 7, paddingVertical: 15 },
  refreshText: { color: colors.textMuted, fontSize: 12 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center' },
  modalScroll: { flexGrow: 1, justifyContent: 'center', padding: 16 },
  formCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, gap: 10 },
  formHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  formTitle: { color: colors.text, fontSize: 17, fontWeight: '900', textAlign: 'right' },
  inputLabel: { color: colors.text, fontSize: 12, fontWeight: '800', textAlign: 'right' },
  input: { minHeight: 45, borderRadius: 11, backgroundColor: colors.surfaceMuted, borderColor: colors.border, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: colors.text },
  noteInput: { minHeight: 73, textAlignVertical: 'top' },
  formActions: { flexDirection: 'row-reverse', gap: 10, marginTop: 10 },
  submitButton: { flex: 2, minHeight: 44, backgroundColor: colors.primary, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  submitText: { color: '#fff', fontWeight: '900', fontSize: 13 },
  cancelButton: { flex: 1, backgroundColor: colors.surfaceMuted, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.text, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
