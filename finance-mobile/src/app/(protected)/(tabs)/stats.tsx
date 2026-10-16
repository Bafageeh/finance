import { router, useIsFocused } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AlertSummaryTile } from '@/components/AlertSummaryTile';
import { AppCard } from '@/components/AppCard';
import { CapitalStatsSection } from '@/components/CapitalStatsSection';
import { PortfolioCollectionProgress } from '@/components/PortfolioCollectionProgress';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getStats } from '@/services/api';
import { getFollowUpSummaries } from '@/services/follow-up-store';
import { Client, StatsData } from '@/types/api';
import { FollowUpSummary } from '@/types/follow-up';
import { buildCollectionAssistantBoard } from '@/utils/collection-assistant';
import { getClientAlertInfo } from '@/utils/finance';
import { formatCurrency } from '@/utils/format';
import { buildStatsOverview, classifyStatsClient } from '@/utils/stats';
import { colors } from '@/utils/theme';

export default function StatsScreen() {
  const isFocused = useIsFocused();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [capitalRefreshKey, setCapitalRefreshKey] = useState(0);
  const [showStuckCapital, setShowStuckCapital] = useState(false);
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

  // Portfolio bar and headline figures refer to open contracts only.
  // Historical realized profit figures below continue to cover the full history.
  const portfolioClients = useMemo(() => clients.filter((client) =>
    client.status !== 'done' && Number(client.summary?.remaining_amount ?? 0) > 0.01
  ), [clients]);
  const overview = useMemo(() => stats ? buildStatsOverview(stats, portfolioClients) : null, [stats, portfolioClients]);
  const assistantBoard = useMemo(() => buildCollectionAssistantBoard(clients, followUps), [clients, followUps]);
  // Each client belongs to exactly one status. Upcoming dues are a separate reminder,
  // not another customer status.
  const statusOverview = useMemo(() => {
    const groups = {
      active: [] as Client[],
      late: [] as Client[],
      stuck: [] as Client[],
      court: [] as Client[],
      done: [] as Client[],
    };
    let lateAmount = 0;
    let upcomingCount = 0;
    let upcomingAmount = 0;

    clients.forEach((client) => {
      const alert = getClientAlertInfo(client);
      const category = classifyStatsClient(client, alert);
      groups[category].push(client);
      if (category === 'late') lateAmount += alert.overdueAmount;
      if (category === 'active' && alert.nextUpcoming && alert.daysUntilNext !== null
        && alert.daysUntilNext >= 0 && alert.daysUntilNext <= 7) {
        upcomingCount += 1;
        upcomingAmount += Number(alert.nextUpcoming.remaining_due ?? alert.nextUpcoming.amount ?? 0);
      }
    });

    const totalRemaining = (group: Client[]) =>
      group.reduce((sum, client) => sum + Number(client.summary?.remaining_amount || 0), 0);

    return {
      groups,
      total: clients.length,
      lateAmount,
      upcomingCount,
      upcomingAmount,
      activeRemaining: totalRemaining(groups.active),
      courtRemaining: totalRemaining(groups.court),
      stuckRemaining: totalRemaining(groups.stuck),
      stuckPrincipal: groups.stuck.reduce((sum, client) => sum + Number(client.principal || 0), 0),
      stuckUncollectedPrincipal: groups.stuck.reduce((sum, client) => sum + Number(client.summary?.remaining_principal || 0), 0),
    };
  }, [clients]);

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
                <MetricCard label="قيمة العقود غير المنتهية" value={formatCurrency(overview.totalPortfolio)} tone="info" />
                <MetricCard label="المحصل من العقود غير المنتهية" value={formatCurrency(overview.totalPaid)} tone="success" />
                <MetricCard label="المتبقي لدى العملاء" value={formatCurrency(overview.totalRemaining)} tone="danger" />
              </View>
              <PortfolioCollectionProgress clients={portfolioClients} />
            </AppCard>

            <CapitalStatsSection refreshKey={capitalRefreshKey} />

            <AppCard>
              <SectionHeader
                title="حالات العملاء والتحصيل"
                subtitle="كل عميل ضمن حالة واحدة فقط؛ اضغط على الحالة للاطلاع على التفاصيل."
                actionLabel="مركز التحصيل"
                onActionPress={() => router.push('/collections')}
              />
              <View style={styles.clientTotalRow}>
                <Text style={styles.clientTotalLabel}>إجمالي العملاء</Text>
                <Text style={styles.clientTotalValue}>{statusOverview.total}</Text>
              </View>
              <View style={styles.metricGrid}>
                <AlertSummaryTile tone="active" title="نشطون" count={statusOverview.groups.active.length} amountText={formatCurrency(statusOverview.activeRemaining)} helperText="المتبقي بالعقود" onPress={() => router.push({ pathname: '/clients', params: { overview: 'active' } })} />
                <AlertSummaryTile tone="late" title="متأخرون" count={statusOverview.groups.late.length} amountText={formatCurrency(statusOverview.lateAmount)} helperText="إجمالي الأقساط المتأخرة" onPress={() => router.push('/alerts/late')} />
                <AlertSummaryTile tone="stuck" title="متعثرون" count={statusOverview.groups.stuck.length} amountText={formatCurrency(statusOverview.stuckRemaining)} helperText="المتبقي دون القضايا" onPress={() => router.push('/alerts/stuck')} />
                <AlertSummaryTile tone="court" title="قضايا" count={statusOverview.groups.court.length} amountText={formatCurrency(statusOverview.courtRemaining)} helperText="المتبقي بالقضايا" onPress={() => router.push('/cases')} />
                <AlertSummaryTile tone="done" title="منتهون" count={statusOverview.groups.done.length} helperText="عقود مكتملة" onPress={() => router.push({ pathname: '/clients', params: { overview: 'done' } })} />
              </View>
              <View style={styles.upcomingSection}>
                <Text style={styles.subSectionTitle}>الاستحقاقات القريبة</Text>
                <Text style={styles.helperText}>تنبيه إضافي للعقود النشطة، لا يُضاف إلى إجمالي العملاء.</Text>
                <View style={styles.metricGrid}>
                  <AlertSummaryTile tone="warn" title="خلال 7 أيام" count={statusOverview.upcomingCount} amountText={formatCurrency(statusOverview.upcomingAmount)} helperText="المبالغ القادمة" onPress={() => router.push('/alerts/warn')} />
                </View>
              </View>
              <TouchableOpacity
                style={styles.stuckDetailsToggle}
                activeOpacity={0.85}
                onPress={() => setShowStuckCapital((current) => !current)}
                accessibilityRole="button"
                accessibilityState={{ expanded: showStuckCapital }}
              >
                <Ionicons name={showStuckCapital ? 'chevron-up-outline' : 'chevron-down-outline'} size={18} color={colors.textMuted} />
                <Text style={styles.stuckDetailsTitle}>تفصيل رأس مال المتعثرين (دون القضايا)</Text>
              </TouchableOpacity>
              {showStuckCapital ? (
                <View style={styles.stuckDetailsContent}>
                  <KeyValueRow label="إجمالي رأس المال" value={formatCurrency(statusOverview.stuckPrincipal)} />
                  <KeyValueRow label="رأس المال غير المحصل" value={formatCurrency(statusOverview.stuckUncollectedPrincipal)} />
                </View>
              ) : null}
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
              <SectionHeader title="مؤشر التحصيل الذكي" actionLabel="فتح المساعد" onActionPress={() => router.push('/assistant' as never)} />
              <View style={styles.metricGrid}>
                <MetricCard label="أولويات اليوم" value={assistantLoading ? '…' : String(assistantBoard.totalLeads)} tone="info" />
                <MetricCard label="حالات حرجة" value={assistantLoading ? '…' : String(assistantBoard.criticalCount)} tone="danger" />
                <MetricCard label="وعود مستحقة" value={assistantLoading ? '…' : String(assistantBoard.promiseDueCount)} tone="warning" />
                <MetricCard label="قيمة الفرص" value={assistantLoading ? '…' : formatCurrency(assistantBoard.totalOpportunityAmount)} tone="success" />
              </View>
            </AppCard>

            <AppCard>
              <SectionHeader title="الزكاة والصدقات" actionLabel="سجل الصدقات" onActionPress={() => router.push('/stats/charity' as never)} />
              <View style={styles.metricGrid}>
                <MetricCard label="وعاء الزكاة" value={formatCurrency(stats.zakat_base)} />
                <MetricCard label="الزكاة 2.5%" value={formatCurrency(stats.zakat)} tone="success" />
              </View>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityLabel="فتح سجل الصدقات"
                style={styles.charityLink}
                onPress={() => router.push('/stats/charity' as never)}
                activeOpacity={0.85}
              >
                <View style={styles.charityTextColumn}>
                  <Text style={styles.charityTitle}>الصدقة 1% من أرباح أحمد</Text>
                  <Text style={styles.charityHint}>جميع العقود عدا المتعثرين، وتشمل المنتهية</Text>
                  <Text style={styles.charityPaid}>المستحق {formatCurrency(stats.sadaqa_total ?? stats.sadaqa)} · المدفوع {formatCurrency(stats.sadaqa_paid ?? 0)}</Text>
                  {(stats.sadaqa_overpaid ?? 0) > 0 ? <Text style={styles.charityPaid}>رصيد زائد {formatCurrency(stats.sadaqa_overpaid)}</Text> : null}
                </View>
                <View style={styles.charityAmountColumn}>
                  <Text style={styles.charityAmountLabel}>المتبقي</Text>
                  <Text style={styles.charityAmount} numberOfLines={1} adjustsFontSizeToFit>{formatCurrency(stats.sadaqa)}</Text>
                </View>
                <Ionicons name="chevron-back" size={18} color={colors.info} />
              </TouchableOpacity>
            </AppCard>

          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 84 },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  clientTotalRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 13,
    backgroundColor: colors.surfaceMuted,
  },
  clientTotalLabel: { color: colors.text, fontSize: 14, fontWeight: '800' },
  clientTotalValue: { color: colors.text, fontSize: 24, fontWeight: '900' },
  upcomingSection: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 14, gap: 7 },
  subSectionTitle: { color: colors.text, textAlign: 'right', fontSize: 14, fontWeight: '800' },
  helperText: { color: colors.textMuted, fontSize: 12, lineHeight: 20, textAlign: 'right' },
  stuckDetailsToggle: {
    borderTopWidth: 1, borderTopColor: colors.border,
    paddingTop: 14, flexDirection: 'row', alignItems: 'center', gap: 9,
  },
  stuckDetailsTitle: { flex: 1, textAlign: 'right', color: colors.text, fontSize: 13, fontWeight: '700' },
  stuckDetailsContent: { gap: 6 },
  charityLink: {
    flexDirection: 'row-reverse', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#c3dbf5', borderRadius: 14,
    paddingHorizontal: 12, paddingVertical: 13, backgroundColor: colors.infoSoft,
  },
  charityTextColumn: { flex: 1, gap: 5 },
  charityTitle: { textAlign: 'right', fontSize: 13, fontWeight: '800', color: colors.text },
  charityHint: { textAlign: 'right', color: colors.textMuted, fontSize: 11 },
  charityPaid: { textAlign: 'right', color: colors.textMuted, fontSize: 11 },
  charityAmountColumn: { maxWidth: '40%', gap: 6, alignItems: 'flex-end' },
  charityAmountLabel: { color: colors.textMuted, fontSize: 11 },
  charityAmount: { color: colors.info, fontSize: 15, fontWeight: '900', textAlign: 'left' },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
});
