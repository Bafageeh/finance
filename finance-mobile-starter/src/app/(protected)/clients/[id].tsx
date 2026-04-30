import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AccordionSection } from '@/components/AccordionSection';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { EmptyState } from '@/components/EmptyState';
import { InstallmentCard } from '@/components/InstallmentCard';
import { InstallmentDetailsSheet } from '@/components/InstallmentDetailsSheet';
import { KeyValueRow } from '@/components/KeyValueRow';
import { PaymentSheet } from '@/components/PaymentSheet';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { ClientHeroCard } from '@/components/ClientHeroCard';
import { Screen } from '@/components/Screen';
import { deleteClient, getClient, removePayment, recordPayment, updateClient } from '@/services/api';
import { Client, PaymentScheduleItem } from '@/types/api';
import { getClientAlertInfo, getOverdueScheduleItems, getUpcomingScheduleItems } from '@/utils/finance';
import { formatCurrency, formatDate, getClientDisplayStatus, profitShareLabel } from '@/utils/format';
import { colors } from '@/utils/theme';

type ExpandedSection = 'profit' | 'basic';

export default function ClientDetailsScreen() {
  const params = useLocalSearchParams<{ id: string; focusPeriod?: string }>();
  const isFocused = useIsFocused();
  const clientId = params.id;
  const focusPeriod = typeof params.focusPeriod === 'string' ? params.focusPeriod : undefined;

  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<PaymentScheduleItem | null>(null);
  const [inspectItem, setInspectItem] = useState<PaymentScheduleItem | null>(null);
  const [paidAmount, setPaidAmount] = useState('');
  const [bankNote, setBankNote] = useState('');
  const [savingPayment, setSavingPayment] = useState(false);
  const [updatingFlags, setUpdatingFlags] = useState(false);
  const [hasAutoOpenedFocus, setHasAutoOpenedFocus] = useState(false);
  const [expandedSections, setExpandedSections] = useState<Record<ExpandedSection, boolean>>({
    profit: false,
    basic: false,
  });

  async function loadData(silent = false) {
    if (!clientId) return;

    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getClient(clientId);
      setClient(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات العميل.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      setHasAutoOpenedFocus(false);
      void loadData();
    }
  }, [isFocused, clientId, focusPeriod]);

  useEffect(() => {
    if (!client || !focusPeriod || hasAutoOpenedFocus) return;

    const targetItem = client.schedule?.find((item) => item.period_key === focusPeriod && !item.is_paid);
    if (targetItem) {
      openPaymentModal(targetItem);
      setHasAutoOpenedFocus(true);
    }
  }, [client, focusPeriod, hasAutoOpenedFocus]);

  const status = client ? getClientDisplayStatus(client) : 'active';
  const alertInfo = useMemo(() => (client ? getClientAlertInfo(client) : null), [client]);
  const overdueItems = useMemo(() => (client ? getOverdueScheduleItems(client) : []), [client]);
  const upcomingItems = useMemo(() => (client ? getUpcomingScheduleItems(client, 365) : []), [client]);
  const firstUpcomingKey = upcomingItems[0]?.period_key;
  const progressColor = client?.has_court
    ? colors.court
    : status === 'stuck'
      ? colors.neutral
      : status === 'done'
        ? colors.info
        : overdueItems.length
          ? colors.danger
          : colors.success;
  const remainingFinancedCapital = client
    ? Math.max(0, (Number(client.summary.financed_amount) || 0) - (Number(client.summary.paid_amount) || 0))
    : 0;

  function toggleSection(section: ExpandedSection) {
    setExpandedSections((current) => ({
      ...current,
      [section]: !current[section],
    }));
  }

  async function handleDelete() {
    if (!client) return;

    Alert.alert('حذف العميل', `سيتم حذف ${client.name} نهائياً.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'حذف',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteClient(client.id);
            router.back();
          } catch (err) {
            Alert.alert('تعذر الحذف', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
          }
        },
      },
    ]);
  }

  async function toggleClientStatus() {
    if (!client) return;

    const nextStatus = client.status === 'stuck' ? 'active' : 'stuck';
    try {
      setUpdatingFlags(true);
      await updateClient(client.id, { status: nextStatus });
      await loadData(true);
    } catch (err) {
      Alert.alert('تعذر تحديث الحالة', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setUpdatingFlags(false);
    }
  }

  async function toggleCourtStatus() {
    if (!client) return;

    try {
      setUpdatingFlags(true);
      await updateClient(client.id, {
        has_court: !client.has_court,
        court_note: client.has_court ? '' : client.court_note || 'تمت إضافة متابعة قضائية من تطبيق الجوال.',
      });
      await loadData(true);
    } catch (err) {
      Alert.alert('تعذر تحديث القضية', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setUpdatingFlags(false);
    }
  }

  function openPaymentModal(item: PaymentScheduleItem) {
    setInspectItem(null);
    setSelectedItem(item);
    setPaidAmount(item.paid_amount ? String(item.paid_amount) : String(item.amount));
    setBankNote(item.bank_note || '');
  }

  function openInspectModal(item: PaymentScheduleItem) {
    setInspectItem(item);
  }

  async function submitPayment() {
    if (!client || !selectedItem) return;

    try {
      setSavingPayment(true);
      await recordPayment(client.id, {
        period_key: selectedItem.period_key,
        paid_amount: paidAmount ? Number(paidAmount) : selectedItem.amount,
        bank_note: bankNote || null,
      });
      setSelectedItem(null);
      setInspectItem(null);
      await loadData(true);
    } catch (err) {
      Alert.alert('تعذر التسجيل', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleRemovePayment(item: PaymentScheduleItem) {
    if (!client) return;

    Alert.alert('إلغاء الدفعة', `سيتم إلغاء دفعة القسط رقم ${item.month}.`, [
      { text: 'إلغاء', style: 'cancel' },
      {
        text: 'إلغاء الدفعة',
        style: 'destructive',
        onPress: async () => {
          try {
            await removePayment(client.id, item.period_key, { monthNumber: item.month, paymentId: item.payment_id ?? item.allocation_payment_id ?? item.direct_payment_id });
            await loadData(true);
          } catch (err) {
            Alert.alert('تعذر الإلغاء', err instanceof Error ? err.message : 'حدث خطأ غير متوقع.');
          }
        },
      },
    ]);
  }

  return (
    <Screen
      title="تفاصيل العميل"
      subtitle={client ? `${client.id_number ? `هوية ${client.id_number}` : 'بدون هوية'}${client.phone ? ` · ${client.phone}` : ''}` : 'تحميل بيانات العميل'}
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerActions}>
          <IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />
          {client ? (
            <>
              <IconButton
                icon="create-outline"
                accessibilityLabel="تعديل العميل"
                onPress={() => router.push({ pathname: '/clients/form', params: { id: String(client.id) } })}
              />
              <IconButton
                icon="trash-outline"
                accessibilityLabel="حذف العميل"
                variant="danger"
                onPress={handleDelete}
              />
            </>
          ) : null}
        </View>
      }
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر التحميل">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error && client ? (
          <>
            <ClientHeroCard
              client={client}
              status={status}
              progressColor={progressColor}
              overdueCount={alertInfo?.overdueCount || 0}
              overdueAmount={alertInfo?.overdueAmount || 0}
              onToggleClient={() => void toggleClientStatus()}
              onToggleCourt={() => void toggleCourtStatus()}
              disabled={updatingFlags}
            />

            <AppCard title="مؤشرات مالية مختصرة">
              <View style={styles.metricGrid}>
                <MetricCard label="قيمة السند" value={formatCurrency(client.summary.bond_total)} />
                <MetricCard label="رأس المال المتبقي" value={formatCurrency(remainingFinancedCapital)} tone="warning" />
                <MetricCard label="ربح أحمد" value={formatCurrency(client.summary.ahmad_total)} tone="success" />
                <MetricCard label="ربح علي" value={formatCurrency(client.summary.ali_total)} tone="info" />
              </View>
            </AppCard>

            <AccordionSection
              title="توزيع الأرباح"
              subtitle={`النوع: ${profitShareLabel(client.profit_share)}`}
              expanded={expandedSections.profit}
              onToggle={() => toggleSection('profit')}
            >
              <KeyValueRow label="نوع التوزيع" value={profitShareLabel(client.profit_share)} />
              <KeyValueRow label="ربح أحمد الكلي" value={formatCurrency(client.summary.ahmad_total)} />
              <KeyValueRow label="ربح أحمد الشهري" value={formatCurrency(client.summary.ahmad_monthly)} />
              <KeyValueRow label="ربح علي الكلي" value={formatCurrency(client.summary.ali_total)} />
              <KeyValueRow label="ربح علي الشهري" value={formatCurrency(client.summary.ali_monthly)} />
            </AccordionSection>

            <AccordionSection
              title="البيانات الأساسية"
              subtitle={`${formatDate(client.contract_date)} · ${client.months} شهر`}
              expanded={expandedSections.basic}
              onToggle={() => toggleSection('basic')}
            >
              <KeyValueRow label="تاريخ العقد" value={formatDate(client.contract_date)} />
              <KeyValueRow label="عدد الأشهر" value={String(client.months)} />
              <KeyValueRow label="المبلغ الأصلي" value={formatCurrency(client.principal)} />
              <KeyValueRow label="تكلفة الشراء" value={formatCurrency(client.cost)} />
              <KeyValueRow label="نسبة الربح الشهرية" value={`${client.rate}%`} />
              <KeyValueRow label="تكلفة السند" value={formatCurrency(client.bond_cost ?? 74.75)} />
            </AccordionSection>

            <AppCard title="جدول الأقساط" style={styles.installmentsCard}>
              {client.schedule?.length ? (
                client.schedule.map((item) => {
                  const state = item.is_paid
                    ? 'paid'
                    : overdueItems.some((overdue) => overdue.period_key === item.period_key)
                      ? 'late'
                      : item.period_key === firstUpcomingKey
                        ? 'next'
                        : 'upcoming';

                  return (
                    <InstallmentCard
                      key={item.period_key}
                      item={item}
                      state={state}
                      onPress={() => openInspectModal(item)}
                      onRecordPress={() => openPaymentModal(item)}
                      onUndoPress={() => void handleRemovePayment(item)}
                    />
                  );
                })
              ) : (
                <EmptyState title="لا يوجد جدول سداد" description="سيظهر هنا جدول الأقساط بعد نجاح الجلب من الـ API أو الموك المحلي." />
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>

      <InstallmentDetailsSheet
        item={inspectItem}
        visible={Boolean(inspectItem)}
        onClose={() => setInspectItem(null)}
        onRecordPress={() => inspectItem && openPaymentModal(inspectItem)}
        onUndoPress={() => {
          if (!inspectItem) return;
          const currentItem = inspectItem;
          setInspectItem(null);
          void handleRemovePayment(currentItem);
        }}
      />

      <PaymentSheet
        item={selectedItem}
        visible={Boolean(selectedItem)}
        paidAmount={paidAmount}
        bankNote={bankNote}
        saving={savingPayment}
        onClose={() => setSelectedItem(null)}
        onAmountChange={setPaidAmount}
        onNoteChange={setBankNote}
        onSubmit={() => void submitPayment()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 40,
  },
  headerActions: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  installmentsCard: {
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
});
