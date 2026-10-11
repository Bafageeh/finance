import { router, useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertSummaryTile } from '@/components/AlertSummaryTile';
import { AppCard } from '@/components/AppCard';
import { CollectionPreviewRow } from '@/components/CollectionPreviewRow';
import { CapitalStatsSection } from '@/components/CapitalStatsSection';
import { EmptyState } from '@/components/EmptyState';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getStats } from '@/services/api';
import { getFollowUpSummaries } from '@/services/follow-up-store';
import { Client, ClientFilter, StatsData } from '@/types/api';
import { FollowUpSummary } from '@/types/follow-up';
import { buildCollectionEntries } from '@/utils/alerts';
import { buildCollectionAssistantBoard } from '@/utils/collection-assistant';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency } from '@/utils/format';
import { buildStatsOverview } from '@/utils/stats';
import { colors } from '@/utils/theme';

type DashboardFilter = Extract<ClientFilter, 'all' | 'active' | 'late' | 'stuck' | 'court' | 'done'>;
type SelectedFilter = Exclude<DashboardFilter, 'all'>;

const filterOptions: { key: DashboardFilter; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'active', label: 'نشط' },
  { key: 'late', label: 'متأخر' },
  { key: 'stuck', label: 'متعثر' },
  { key: 'court', label: 'قضية' },
  { key: 'done', label: 'منتهي' },
];

export default function StatsScreen() {
  const isFocused = useIsFocused();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [clientFilters, setClientFilters] = useState<SelectedFilter[]>([]);
  const [capitalRefreshKey, setCapitalRefreshKey] = useState(0);
  const [followUps, setFollowUps] = useState<Record<number, FollowUpSummary>>({});
  const [assistantLoading, setAssistantLoading] = useState(true);
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
      setCapitalRefreshKey((current) => current + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused]);

  useEffect(() => {
    if (!isFocused || loading || error) return;
    let cancelled = false;
    setAssistantLoading(true);
    void getFollowUpSummaries(clients.map((client) => client.id))
      .then((summaries) => { if (!cancelled) setFollowUps(summaries); })
      .catch(() => { if (!cancelled) setFollowUps({}); })
      .finally(() => { if (!cancelled) setAssistantLoading(false); });
    return () => { cancelled = true; };
  }, [clients, isFocused, loading, error]);

  const overview = useMemo(() => stats ? buildStatsOverview(stats, clients) : null, [stats, clients]);
  const counts = useMemo(() => buildClientCounts(clients), [clients]);
  const assistantBoard = useMemo(() => buildCollectionAssistantBoard(clients, followUps), [clients, followUps]);
  const filteredClients = useMemo(() => clients.filter((client) => (
    !clientFilters.length || clientFilters.some((filter) => matchesFilter(client, filter))
  )), [clients, clientFilters]);
  const selectedFilterLabel = filterOptions
    .filter((option) => option.key !== 'all' && clientFilters.includes(option.key as SelectedFilter))
    .map((option) => option.label)
    .join(' + ') || 'الكل';

  function toggleFilter(filter: DashboardFilter) {
    if (filter === 'all') {
      setClientFilters([]);
      return;
    }
    setClientFilters((current) => current.includes(filter)
      ? current.filter((item) => item !== filter)
      : [...current, filter]);
  }

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
  const collectionPreview = useMemo(() => buildCollectionEntries(filteredClients, 'all').slice(0, 5), [filteredClients]);

  return (
    <Screen title="الإحصائيات" subtitle="المحفظة والأرباح والمتابعة اليومية" scrollable={false} compactHeader>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
      >
        {loading ? <LoadingBlock /> : null}
        {!loading && error ? (
          <AppCard title="تعذر التحميل"><Text style={styles.errorText}>{error}</Text></AppCard>
        ) : null}

        {!loading && !error && stats && overview ? (
          <>
            <AppCard>
              <SectionHeader title="ملخص المحفظة" actionLabel="التحليل التفصيلي" onActionPress={() => router.push('/stats/details')} />
              <View style={styles.metricGrid}>
                <MetricCard label="إجمالي قيمة العقود" value={formatCurrency(overview.totalPortfolio)} tone="info" />
                <MetricCard label="المحصل حتى الآن" value={formatCurrency(overview.totalPaid)} tone="success" />
                <MetricCard label="المتبقي لدى العملاء" value={formatCurrency(overview.totalRemaining)} tone="danger" />
              </View>
            </AppCard>

            <CapitalStatsSection refreshKey={capitalRefreshKey} />

            <AppCard title="حالات العملاء">
              <View style={styles.metricGrid}>
                <MetricCard label="إجمالي العملاء" value={String(counts.total)} />
                <MetricCard label="نشطون" value={String(counts.active)} tone="success" />
                <MetricCard label="متأخرون" value={String(counts.late)} tone="danger" />
                <MetricCard label="متعثرون" value={String(counts.stuck)} tone="warning" />
                <MetricCard label="قضايا" value={String(counts.court)} tone="info" />
                <MetricCard label="منتهون" value={String(counts.done)} />
              </View>
            </AppCard>

            <AppCard title="الدفعات والأرباح الشهرية — النشطون فقط">
              <View style={styles.metricGrid}>
                <MetricCard label="مجموع الدفعات" value={formatCurrency(stats.monthly_income)} tone="info" />
                <MetricCard label="مجموع الأرباح" value={formatCurrency(stats.monthly_profit)} tone="success" />
                <MetricCard label="ربح أحمد الشهري" value={formatCurrency(stats.ahmad_monthly)} tone="success" />
                <MetricCard label="ربح علي الشهري" value={formatCurrency(stats.ali_monthly)} tone="warning" />
              </View>
            </AppCard>

            <AppCard>
              <SectionHeader title="المتابعة والتحصيل" actionLabel="مركز التحصيل" onActionPress={() => router.push('/collections')} />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
                {filterOptions.map((option) => {
                  const selected = option.key === 'all' ? !clientFilters.length : clientFilters.includes(option.key);
                  return (
                    <TouchableOpacity
                      key={option.key}
                      activeOpacity={0.85}
                      accessibilityRole="button"
                      accessibilityState={{ selected }}
                      style={[styles.filterChip, selected && styles.filterChipActive]}
                      onPress={() => toggleFilter(option.key)}
                    >
                      <Text style={[styles.filterText, selected && styles.filterTextActive]}>{option.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <Text style={styles.helperText}>المتابعة حسب: {selectedFilterLabel}</Text>
              <View style={styles.metricGrid}>
                <AlertSummaryTile tone="late" title="متأخرات" count={alertGroups.lateClients.length} amountText={formatCurrency(alertGroups.lateAmount)} helperText="أقساط تحتاج متابعة" onPress={() => router.push('/alerts/late')} />
                <AlertSummaryTile tone="warn" title="استحقاقات قريبة" count={alertGroups.warnClients.length} amountText={formatCurrency(alertGroups.upcomingAmount)} helperText="خلال 7 أيام" onPress={() => router.push('/alerts/warn')} />
                <AlertSummaryTile tone="court" title="قضايا المحكمة" count={alertGroups.courtClients.length} amountText={formatCurrency(alertGroups.courtRemaining)} onPress={() => router.push('/cases')} />
                <AlertSummaryTile tone="stuck" title="حالات التعثر" count={alertGroups.stuckClients.length} amountText={formatCurrency(alertGroups.stuckRemaining)} helperText="حالات غير قضائية" onPress={() => router.push('/alerts/stuck')} />
              </View>
              {collectionPreview.length ? (
                <View style={styles.previewList}>
                  {collectionPreview.map((entry) => (
                    <CollectionPreviewRow
                      key={entry.key}
                      entry={entry}
                      onPress={() => router.push({
                        pathname: '/clients/[id]',
                        params: { id: String(entry.client.id), focusPeriod: entry.item.period_key },
                      })}
                    />
                  ))}
                </View>
              ) : <EmptyState title="لا توجد دفعات مفتوحة" description="لا توجد أقساط متأخرة أو قريبة ضمن الفلتر المحدد." />}
            </AppCard>

            <AppCard>
              <SectionHeader title="مؤشر التحصيل الذكي" actionLabel="فتح المساعد" onActionPress={() => router.push('/assistant' as never)} />
              <View style={styles.metricGrid}>
                <MetricCard label="أولويات اليوم" value={assistantLoading ? '…' : String(assistantBoard.totalLeads)} tone="info" />
                <MetricCard label="حالات حرجة" value={assistantLoading ? '…' : String(assistantBoard.criticalCount)} tone="danger" />
                <MetricCard label="وعود مستحقة" value={assistantLoading ? '…' : String(assistantBoard.promiseDueCount)} tone="warning" />
                <MetricCard label="قيمة الفرص" value={assistantLoading ? '…' : formatCurrency(assistantBoard.totalOpportunityAmount)} tone="success" />
              </View>
            </AppCard>

            <AppCard title="الزكاة والصدقة — ما عدا المتعثرين">
              <View style={styles.metricGrid}>
                <MetricCard label="وعاء الزكاة" value={formatCurrency(stats.zakat_base)} />
                <MetricCard label="الزكاة 2.5%" value={formatCurrency(stats.zakat)} tone="success" />
                <MetricCard label="الصدقة 1%" value={formatCurrency(stats.sadaqa)} tone="info" />
                <MetricCard label="المجموع" value={formatCurrency(stats.zakat + stats.sadaqa)} tone="warning" />
              </View>
              <Text style={styles.helperText}>المتعثرون مستثنون من حساب الزكاة والصدقة.</Text>
            </AppCard>

            <AppCard>
              <SectionHeader title="أموال المتعثرين" actionLabel="فتح الحالات" onActionPress={() => router.push('/alerts/stuck')} />
              <KeyValueRow label="إجمالي المبالغ المتبقية" value={formatCurrency(stats.stuck.total_remaining)} />
              <KeyValueRow label="إجمالي رأس المال" value={formatCurrency(stats.stuck.total_principal)} />
              <KeyValueRow label="رأس المال غير المحصل" value={formatCurrency(stats.stuck.remaining_principal)} />
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function buildClientCounts(clients: Client[]) {
  return clients.reduce((counts, client) => {
    if (client.has_court) counts.court += 1;
    if (isStuckClient(client) && !client.has_court) counts.stuck += 1;
    if (isDoneClient(client)) counts.done += 1;
    if (isLateClient(client) && !client.has_court) counts.late += 1;
    if (isActiveClient(client)) counts.active += 1;
    return counts;
  }, { total: clients.length, active: 0, late: 0, stuck: 0, court: 0, done: 0 });
}

function matchesFilter(client: Client, filter: SelectedFilter): boolean {
  if (filter === 'court') return client.has_court;
  if (filter === 'stuck') return isStuckClient(client) && !client.has_court;
  if (filter === 'done') return isDoneClient(client);
  if (filter === 'late') return isLateClient(client) && !client.has_court;
  return isActiveClient(client);
}

function isActiveClient(client: Client): boolean {
  return client.status === 'active' && !client.has_court && !isDoneClient(client)
    && !isLateClient(client) && Number(client.summary?.remaining_amount || 0) > 0.01;
}

function isLateClient(client: Client, info = getClientAlertInfo(client)): boolean {
  return !isDoneClient(client) && !isStuckClient(client)
    && Number(client.summary?.remaining_amount || 0) > 0.01 && info.overdueCount > 0;
}

function isStuckClient(client: Client): boolean {
  return client.status === 'stuck';
}

function isDoneClient(client: Client): boolean {
  return client.status === 'done' || Number(client.summary?.remaining_amount || 0) <= 0.01;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 84 },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  filterRow: { flexDirection: 'row-reverse', gap: 8, paddingVertical: 2 },
  filterChip: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9 },
  filterChipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontSize: 12, fontWeight: '800' },
  filterTextActive: { color: '#fff' },
  helperText: { color: colors.textMuted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  previewList: { gap: 8 },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
});
