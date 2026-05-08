import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertItemCard } from '@/components/AlertItemCard';
import { AlertSummaryTile } from '@/components/AlertSummaryTile';
import { AppCard } from '@/components/AppCard';
import { CollectionPreviewRow } from '@/components/CollectionPreviewRow';
import { EmptyState } from '@/components/EmptyState';
import { FinanceHeroCard } from '@/components/FinanceHeroCard';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getStats } from '@/services/api';
import { Client, ClientFilter, StatsData } from '@/types/api';
import { buildCollectionEntries } from '@/utils/alerts';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

type FinanceDashboardFilter = Extract<ClientFilter, 'all' | 'active' | 'late' | 'stuck' | 'court' | 'done'>;
type SelectableFinanceFilter = Exclude<FinanceDashboardFilter, 'all'>;

const financeFilterOptions: { key: FinanceDashboardFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
  { key: 'court', label: 'قضية' },
  { key: 'done', label: 'منتهي' },
];

export default function FinanceHomeScreen() {
  const isFocused = useIsFocused();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientFilters, setClientFilters] = useState<SelectableFinanceFilter[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const [statsResponse, clientsResponse] = await Promise.all([getStats(), getClients('all')]);
      setStats(statsResponse);
      setClients(clientsResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات لوحة التمويل.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused]);

  const filteredClients = useMemo(
    () => clients.filter((client) => matchesFinanceFilters(client, clientFilters)),
    [clients, clientFilters],
  );

  const selectedFilterLabel = useMemo(() => {
    if (clientFilters.length === 0) return 'الكل';
    return financeFilterOptions
      .filter((option): option is { key: SelectableFinanceFilter; label: string } => option.key !== 'all' && clientFilters.includes(option.key))
      .map((option) => option.label)
      .join(' + ');
  }, [clientFilters]);

  const toggleClientFilter = (filter: FinanceDashboardFilter) => {
    if (filter === 'all') {
      setClientFilters([]);
      return;
    }

    setClientFilters((current) => {
      if (current.includes(filter)) {
        return current.filter((item) => item !== filter);
      }

      return [...current, filter];
    });
  };

  const dashboardStats = useMemo(() => buildDashboardStats(filteredClients), [filteredClients]);

  const alertGroups = useMemo(() => {
    const courtClients = filteredClients.filter((client) => client.has_court);
    const lateClients = filteredClients
      .map((client) => ({ client, info: getClientAlertInfo(client) }))
      .filter(({ client, info }) => isLateClient(client, info));
    const warnClients = filteredClients
      .map((client) => ({ client, info: getClientAlertInfo(client) }))
      .filter(({ client, info }) => !isDoneClient(client) && !isStuckClient(client) && !client.has_court && info.overdueCount === 0 && info.nextUpcoming && info.daysUntilNext !== null && info.daysUntilNext <= 7);
    const stuckClients = filteredClients.filter((client) => isStuckClient(client) && !client.has_court);

    return {
      courtClients,
      lateClients,
      warnClients,
      stuckClients,
      lateAmount: lateClients.reduce((sum, entry) => sum + entry.info.overdueAmount, 0),
      upcomingAmount: warnClients.reduce((sum, entry) => sum + (entry.info.nextUpcoming?.amount || 0), 0),
      courtRemaining: courtClients.reduce((sum, client) => sum + Number(client.summary?.remaining_amount || 0), 0),
      stuckRemaining: stuckClients.reduce((sum, client) => sum + Number(client.summary?.remaining_amount || 0), 0),
    };
  }, [filteredClients]);

  const collectionEntries = useMemo(() => buildCollectionEntries(filteredClients, 'all'), [filteredClients]);

  const collectionSummary = useMemo(() => {
    const lateCount = collectionEntries.filter((entry) => entry.state === 'late').length;
    const upcomingCount = collectionEntries.filter((entry) => entry.state === 'upcoming').length;
    const totalAmount = collectionEntries.reduce((sum, entry) => sum + entry.item.amount, 0);

    return { lateCount, upcomingCount, totalAmount };
  }, [collectionEntries]);

  const totalRemainingFinancedCapital = useMemo(() => filteredClients.reduce((sum, client) => {
    const financedAmount = Number(client.summary?.financed_amount || 0);
    const paidAmount = Number(client.summary?.paid_amount || 0);
    return sum + Math.max(0, financedAmount - paidAmount);
  }, 0), [filteredClients]);

  const collectionPreview = useMemo(() => collectionEntries.slice(0, 4), [collectionEntries]);
  const topLateClients = useMemo(() => alertGroups.lateClients.slice(0, 2), [alertGroups.lateClients]);
  const topCourtClients = useMemo(() => alertGroups.courtClients.slice(0, 2), [alertGroups.courtClients]);
  const topWarnClients = useMemo(() => alertGroups.warnClients.slice(0, 2), [alertGroups.warnClients]);
  const topStuckClients = useMemo(() => alertGroups.stuckClients.slice(0, 2), [alertGroups.stuckClients]);

  return (
    <Screen title="التمويل" subtitle="المتابعة اليومية" scrollable={false} compactHeader>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر التحميل">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error && stats ? (
          <>
            <FinanceHeroCard
              totalClients={dashboardStats.counts.total}
              activeCount={dashboardStats.counts.active}
              lateCount={dashboardStats.counts.late}
              courtCount={dashboardStats.counts.court}
              monthlyIncomeText={formatCurrency(dashboardStats.monthlyIncome)}
              monthlyProfitText={formatCurrency(dashboardStats.monthlyProfit)}
              remainingText={formatCurrency(dashboardStats.remainingAmount)}
              onAddClient={() => router.push('/clients/form')}
              onOpenClients={() => router.push('/clients')}
              onOpenCollections={() => router.push('/collections')}
            />

            <AppCard title="فلتر العملاء">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {financeFilterOptions.map((option) => {
                  const isActive = option.key === 'all' ? clientFilters.length === 0 : clientFilters.includes(option.key);
                  return (
                    <TouchableOpacity
                      key={option.key}
                      activeOpacity={0.85}
                      style={[styles.filterChip, isActive && styles.filterChipActive]}
                      onPress={() => toggleClientFilter(option.key)}
                    >
                      <Text style={[styles.filterChipText, isActive && styles.filterChipTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.filterHelper}>الإحصائيات والقوائم محسوبة الآن حسب: {selectedFilterLabel}</Text>
            </AppCard>

            <AppCard title="نظرة سريعة">
              <View style={styles.metricGrid}>
                <MetricCard label="العملاء" value={String(dashboardStats.counts.total)} />
                <MetricCard label="نشطون" value={String(dashboardStats.counts.active)} tone="success" />
                <MetricCard label="المتأخرون" value={String(dashboardStats.counts.late)} tone="danger" />
                <MetricCard label="القريب" value={String(collectionSummary.upcomingCount)} tone="warning" />
              </View>
            </AppCard>

            <SectionHeader
              title="الأولوية الآن"
              subtitle="الوصول السريع للحالات الأهم قبل فتح تفاصيل القوائم."
            />
            <View style={styles.summaryGrid}>
              <AlertSummaryTile
                tone="late"
                title="المتأخرون"
                count={alertGroups.lateClients.length}
                amountText={formatCurrency(alertGroups.lateAmount)}
                helperText="أقساط تحتاج متابعة فورية"
                onPress={() => router.push('/alerts/late')}
              />
              <AlertSummaryTile
                tone="warn"
                title="استحقاقات قريبة"
                count={alertGroups.warnClients.length}
                amountText={formatCurrency(alertGroups.upcomingAmount)}
                helperText="خلال 7 أيام"
                onPress={() => router.push('/alerts/warn')}
              />
              <AlertSummaryTile
                tone="court"
                title="قضايا المحكمة"
                count={alertGroups.courtClients.length}
                amountText={formatCurrency(alertGroups.courtRemaining)}
                helperText="متابعة قانونية مفتوحة"
                onPress={() => router.push('/cases')}
              />
              <AlertSummaryTile
                tone="stuck"
                title="متعثرون"
                count={alertGroups.stuckClients.length}
                amountText={formatCurrency(alertGroups.stuckRemaining)}
                helperText="حالات غير قضائية"
                onPress={() => router.push('/alerts/stuck')}
              />
            </View>

            <AppCard title="مركز التحصيل السريع">
              <View style={styles.collectionTopRow}>
                <Text style={styles.collectionFootnote}>إجمالي المبالغ المفتوحة {formatCurrency(collectionSummary.totalAmount)}</Text>
                <TouchableOpacity style={styles.collectionButton} onPress={() => router.push('/collections')}>
                  <Text style={styles.collectionButtonText}>فتح المركز</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.previewList}>
                {collectionPreview.length ? (
                  collectionPreview.map((entry) => (
                    <CollectionPreviewRow
                      key={entry.key}
                      entry={entry}
                      onPress={() => router.push({
                        pathname: '/clients/[id]',
                        params: {
                          id: String(entry.client.id),
                          focusPeriod: entry.item.period_key,
                        },
                      })}
                    />
                  ))
                ) : (
                  <EmptyState title="لا توجد دفعات مفتوحة" description="عند وجود أقساط متأخرة أو قريبة ستظهر هنا." />
                )}
              </View>
            </AppCard>

            <AppCard title="التحصيل والربحية">
              <View style={styles.metricGrid}>
                <MetricCard label="الدفعات الشهرية" value={formatCurrency(dashboardStats.monthlyIncome)} tone="info" />
                <MetricCard label="الربح الشهري" value={formatCurrency(dashboardStats.monthlyProfit)} tone="success" />
                <MetricCard label="رأس المال المتبقي" value={formatCurrency(totalRemainingFinancedCapital)} tone="warning" />
                <MetricCard label="الزكاة + الصدقة" value={formatCurrency(dashboardStats.zakat + dashboardStats.sadaqa)} tone="warning" />
              </View>
            </AppCard>

            <SectionHeader title="تنبيهات حرجة" actionLabel="كل القضايا" onActionPress={() => router.push('/cases')} />
            {topCourtClients.length ? (
              topCourtClients.map((client) => (
                <AlertItemCard
                  key={`court-${client.id}`}
                  tone="court"
                  title={client.name}
                  description={`${client.court_note || 'متابعة قضائية'} · المتبقي ${formatCurrency(client.summary.remaining_amount)}`}
                  onPress={() => router.push(`/clients/${client.id}`)}
                />
              ))
            ) : (
              <EmptyState title="لا توجد قضايا حالياً" description="أي متابعة قضائية جديدة ستظهر هنا مباشرة." />
            )}

            {topLateClients.length ? (
              topLateClients.map(({ client, info }) => (
                <AlertItemCard
                  key={`late-${client.id}`}
                  tone="late"
                  title={client.name}
                  description={`${info.overdueCount} قسط متأخر · ${client.asset || 'بدون أصل محدد'}`}
                  amountText={formatCurrency(info.overdueAmount)}
                  onPress={() => router.push(`/clients/${client.id}`)}
                />
              ))
            ) : (
              <EmptyState title="لا توجد حالات تأخير" description="جميع العملاء الحاليين منتظمون في السداد." />
            )}

            <SectionHeader title="متابعة قريبة" actionLabel="كل التنبيهات" onActionPress={() => router.push('/alerts/warn')} />
            {topWarnClients.length ? (
              topWarnClients.map(({ client, info }) => (
                <AlertItemCard
                  key={`warn-${client.id}`}
                  tone="warn"
                  title={`${client.name} · خلال ${info.daysUntilNext} أيام`}
                  description={`${formatDate(info.nextUpcoming?.due_date)} · ${client.asset || 'بدون أصل محدد'}`}
                  amountText={formatCurrency(info.nextUpcoming?.amount || 0)}
                  onPress={() => router.push(`/clients/${client.id}`)}
                />
              ))
            ) : (
              <EmptyState title="لا توجد استحقاقات قريبة" description="الدفعات القريبة خلال أسبوع ستظهر هنا تلقائياً." />
            )}

            {topStuckClients.length ? (
              topStuckClients.map((client) => (
                <AlertItemCard
                  key={`stuck-${client.id}`}
                  tone="stuck"
                  title={client.name}
                  description={`المتبقي ${formatCurrency(client.summary.remaining_amount)} · رأس المال ${formatCurrency(client.principal)}`}
                  onPress={() => router.push(`/clients/${client.id}`)}
                />
              ))
            ) : (
              <EmptyState title="لا يوجد متعثرون" description="الحالات المتعثرة ستظهر هنا عندما توجد." />
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function buildDashboardStats(clients: Client[]) {
  const counts = clients.reduce((acc, client) => {
    if (client.has_court) acc.court += 1;
    if (isStuckClient(client) && !client.has_court) acc.stuck += 1;
    if (isDoneClient(client)) acc.done += 1;
    if (isLateClient(client) && !client.has_court) acc.late += 1;
    if (isActiveClient(client)) acc.active += 1;
    return acc;
  }, { total: clients.length, active: 0, late: 0, stuck: 0, court: 0, done: 0 });

  const monthlyIncome = clients.reduce((sum, client) => sum + Number(client.summary?.monthly_installment || 0), 0);
  const monthlyProfit = clients.reduce((sum, client) => sum + Number(client.summary?.monthly_profit || 0), 0);
  const ahmadMonthly = clients.reduce((sum, client) => sum + Number(client.summary?.ahmad_monthly || 0), 0);
  const aliMonthly = clients.reduce((sum, client) => sum + Number(client.summary?.ali_monthly || 0), 0);
  const ahmadTotal = clients.reduce((sum, client) => sum + Number(client.summary?.ahmad_total || 0), 0);
  const remainingAmount = clients.reduce((sum, client) => sum + Number(client.summary?.remaining_amount || 0), 0);
  const zakat = remainingAmount * 0.025;
  const sadaqa = remainingAmount * 0.01;

  return {
    counts,
    monthlyIncome,
    monthlyProfit,
    ahmadMonthly,
    aliMonthly,
    ahmadTotal,
    remainingAmount,
    zakat,
    sadaqa,
  };
}

function matchesFinanceFilters(client: Client, filters: SelectableFinanceFilter[]): boolean {
  if (filters.length === 0) return true;
  return filters.some((filter) => matchesFinanceFilter(client, filter));
}

function matchesFinanceFilter(client: Client, filter: SelectableFinanceFilter): boolean {
  if (filter === 'court') return client.has_court;
  if (filter === 'stuck') return isStuckClient(client) && !client.has_court;
  if (filter === 'done') return isDoneClient(client);
  if (filter === 'late') return isLateClient(client) && !client.has_court;
  if (filter === 'active') return isActiveClient(client);
  return true;
}

function isActiveClient(client: Client): boolean {
  return client.status === 'active'
    && !client.has_court
    && !isDoneClient(client)
    && !isLateClient(client)
    && Number(client.summary?.remaining_amount || 0) > 0.01;
}

function isLateClient(client: Client, info = getClientAlertInfo(client)): boolean {
  return !isDoneClient(client)
    && !isStuckClient(client)
    && Number(client.summary?.remaining_amount || 0) > 0.01
    && info.overdueCount > 0;
}

function isStuckClient(client: Client): boolean {
  return client.status === 'stuck';
}

function isDoneClient(client: Client): boolean {
  return client.status === 'done' || Number(client.summary?.remaining_amount || 0) <= 0.01;
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 84,
  },
  filterRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    paddingVertical: 2,
  },
  filterChip: {
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: '900',
  },
  filterChipTextActive: {
    color: '#fff',
  },
  filterHelper: {
    marginTop: 10,
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
    fontWeight: '800',
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  collectionTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  collectionFootnote: {
    flex: 1,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
  },
  collectionButton: {
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 22,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  collectionButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  previewList: {
    gap: 8,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },

});
