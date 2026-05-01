import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { EmptyState } from '@/components/EmptyState';
import { InstallmentCard } from '@/components/InstallmentCard';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { getPartnerClient } from '@/services/api';
import { Client } from '@/types/api';
import { getClientAlertInfo, getOverdueScheduleItems, getUpcomingScheduleItems } from '@/utils/finance';
import { formatCurrency, formatDate, getClientDisplayStatus } from '@/utils/format';
import { colors } from '@/utils/theme';

export default function PartnerClientDetailsScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const isFocused = useIsFocused();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    if (!params.id) return;
    try {
      if (!silent) setLoading(true);
      setError(null);
      setClient(await getPartnerClient(params.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تفاصيل العميل.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused, params.id]);

  const status = client ? getClientDisplayStatus(client) : 'active';
  const alertInfo = useMemo(() => (client ? getClientAlertInfo(client) : null), [client]);
  const overdueItems = useMemo(() => (client ? getOverdueScheduleItems(client) : []), [client]);
  const upcomingItems = useMemo(() => (client ? getUpcomingScheduleItems(client, 365) : []), [client]);
  const firstUpcomingKey = upcomingItems[0]?.period_key;
  const sourceAccountName = String((client as any)?.source_account_name || 'حساب غير محدد');
  const aliTotal = Number((client as any)?.partner_profit_total ?? client?.summary?.ali_total ?? 0);
  const aliMonthly = Number((client as any)?.partner_profit_monthly ?? client?.summary?.ali_monthly ?? 0);
  const remainingFinancedCapital = client ? Math.max(0, (Number(client.summary.financed_amount) || 0) - (Number(client.summary.paid_amount) || 0)) : 0;

  return (
    <Screen
      title="تفاصيل عميل شريك"
      subtitle={client ? `${sourceAccountName} · عرض فقط` : 'تحميل بيانات العميل'}
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerActions}>
          <IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />
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
            <AppCard title={client.name}>
              <View style={styles.readOnlyNotice}>
                <Text style={styles.readOnlyText}>عرض فقط لحساب علي — لا يمكن التعديل أو تسجيل الدفعات من هذه الشاشة.</Text>
              </View>
              <KeyValueRow label="الحساب المصدر" value={sourceAccountName} />
              <KeyValueRow label="الحالة" value={client.has_court ? 'قضية' : status === 'stuck' ? 'متعثر' : status === 'done' ? 'منتهي' : 'نشط'} />
              <KeyValueRow label="الأصل / السلعة" value={client.asset || '—'} />
              <KeyValueRow label="الجوال" value={client.phone || '—'} />
              <KeyValueRow label="رقم الهوية" value={client.id_number || '—'} />
            </AppCard>

            <AppCard title="مؤشرات مالية لعلي">
              <View style={styles.metricGrid}>
                <MetricCard label="ربح علي الكلي" value={formatCurrency(aliTotal)} tone="success" />
                <MetricCard label="ربح علي الشهري" value={formatCurrency(aliMonthly)} tone="info" />
                <MetricCard label="قيمة السند" value={formatCurrency(client.summary.bond_total)} />
                <MetricCard label="رأس المال المتبقي" value={formatCurrency(remainingFinancedCapital)} tone="warning" />
              </View>
            </AppCard>

            <AppCard title="ملخص العقد">
              <KeyValueRow label="تاريخ العقد" value={formatDate(client.contract_date)} />
              <KeyValueRow label="عدد الأشهر" value={String(client.months)} />
              <KeyValueRow label="القسط الشهري" value={formatCurrency(client.summary.monthly_installment)} />
              <KeyValueRow label="المدفوع" value={formatCurrency(client.summary.paid_amount)} />
              <KeyValueRow label="المتبقي" value={formatCurrency(client.summary.remaining_amount)} />
              <KeyValueRow label="الأقساط المتأخرة" value={String(alertInfo?.overdueCount || 0)} />
              <KeyValueRow label="مبلغ المتأخر" value={formatCurrency(alertInfo?.overdueAmount || 0)} />
            </AppCard>

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
                      onPress={() => {}}
                    />
                  );
                })
              ) : (
                <EmptyState title="لا يوجد جدول سداد" description="سيظهر هنا جدول الأقساط عند توفره." />
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 40 },
  headerActions: { flexDirection: 'row-reverse', gap: 8, flexWrap: 'wrap' },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  installmentsCard: { gap: 8 },
  readOnlyNotice: {
    backgroundColor: colors.infoSoft,
    borderRadius: 14,
    padding: 10,
    marginBottom: 4,
  },
  readOnlyText: {
    color: colors.info,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
    lineHeight: 20,
  },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
});
