import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { InsightStatCard } from '@/components/InsightStatCard';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getStats } from '@/services/api';
import { Client, StatsData } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { buildCaseMetrics, buildStatsOverview } from '@/utils/stats';
import { colors } from '@/utils/theme';

export default function StatsScreen() {
  const isFocused = useIsFocused();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
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
      setError(err instanceof Error ? err.message : 'تعذر تحميل الإحصائيات.');
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

  const overview = useMemo(() => (stats ? buildStatsOverview(stats, clients) : null), [stats, clients]);
  const caseMetrics = useMemo(() => buildCaseMetrics(clients), [clients]);
  const stuckClients = useMemo(() => clients.filter((client) => client.status === 'stuck'), [clients]);

  return (
    <Screen title="الإحصائيات" subtitle="لوحة مختصرة للإدارة مع انتقالات مباشرة للتحليل التفصيلي ومركز القضايا." scrollable={false}>
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

        {!loading && !error && stats && overview ? (
          <>
            <AppCard title="ملخص عام">
              <View style={styles.metricGrid}>
                <MetricCard label="نشطون" value={String(stats.counts.active)} tone="success" />
                <MetricCard label="متعثرون" value={String(stats.counts.stuck)} tone="danger" />
                <MetricCard label="قضايا" value={String(stats.counts.court)} tone="info" />
                <MetricCard label="منتهون" value={String(stats.counts.done)} />
              </View>
            </AppCard>

            <AppCard title="مؤشرات الإدارة السريعة">
              <InsightStatCard
                title="إجمالي قيمة المحفظة"
                value={formatCurrency(overview.totalPortfolio)}
                helper="الدخول إلى شاشة التحليل التفصيلي"
                tone="info"
                onPress={() => router.push('/stats/details')}
              />
              <InsightStatCard
                title="إجمالي المتبقي للتحصيل"
                value={formatCurrency(overview.totalRemaining)}
                helper={`${overview.overdueContracts} عقود فيها تأخير حالياً`}
                tone="danger"
                onPress={() => router.push('/alerts/late')}
              />
              <InsightStatCard
                title="مركز القضايا"
                value={String(caseMetrics.totalCount)}
                helper={`${caseMetrics.overdueCount} قضايا متأخرة و${caseMetrics.withoutNotes} بدون ملاحظات`}
                tone="court"
                onPress={() => router.push('/cases')}
              />
            </AppCard>

            <AppCard title="الدفعات الشهرية — النشطون فقط">
              <View style={styles.metricGrid}>
                <MetricCard label="مجموع الدفعات" value={formatCurrency(stats.monthly_income)} tone="info" />
                <MetricCard label="مجموع الأرباح" value={formatCurrency(stats.monthly_profit)} tone="success" />
                <MetricCard label="ربح أحمد الشهري" value={formatCurrency(stats.ahmad_monthly)} tone="success" />
                <MetricCard label="ربح علي الشهري" value={formatCurrency(stats.ali_monthly)} tone="warning" />
              </View>
            </AppCard>

            <AppCard title="الزكاة والصدقة — ما عدا المتعثرين">
              <View style={styles.metricGrid}>
                <MetricCard label="وعاء الزكاة" value={formatCurrency(stats.zakat_base)} />
                <MetricCard label="الزكاة 2.5%" value={formatCurrency(stats.zakat)} tone="success" />
                <MetricCard label="الصدقة 1%" value={formatCurrency(stats.sadaqa)} tone="info" />
                <MetricCard label="المجموع" value={formatCurrency(stats.zakat + stats.sadaqa)} tone="warning" />
              </View>
              <Text style={styles.footnote}>المتعثرون ({stats.counts.stuck}) مستثنون من حساب الزكاة والصدقة.</Text>
            </AppCard>

            <AppCard title="إحصاءات المتعثرين">
              <KeyValueRow label="عدد المتعثرين" value={String(stats.stuck.count)} />
              <KeyValueRow label="إجمالي المبالغ المتبقية" value={formatCurrency(stats.stuck.total_remaining)} />
              <KeyValueRow label="إجمالي رأس المال" value={formatCurrency(stats.stuck.total_principal)} />
              <KeyValueRow label="رأس المال غير المحصل" value={formatCurrency(stats.stuck.remaining_principal)} />

              <SectionHeader title="الحالات المتعثرة" subtitle="فتح العميل مباشرة لمراجعة الأقساط أو التحويل القضائي." actionLabel="التحليل التفصيلي" onActionPress={() => router.push('/stats/details')} />
              {stuckClients.length ? (
                <View style={styles.stuckList}>
                  {stuckClients.slice(0, 5).map((client) => (
                    <TouchableOpacity key={client.id} style={styles.stuckRow} onPress={() => router.push(`/clients/${client.id}`)}>
                      <View style={styles.stuckTextWrap}>
                        <Text style={styles.stuckName}>{client.name}</Text>
                        <Text style={styles.stuckMeta}>
                          {client.summary.paid_count}/{client.months} شهر · متبقٍ {formatCurrency(client.summary.remaining_amount)}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <EmptyState title="لا يوجد عملاء متعثرون" description="عند تفعيل حالة التعثر على أي عميل سيظهر هنا تلقائياً." />
              )}
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 80,
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  footnote: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
  },
  stuckList: {
    marginTop: 8,
    gap: 8,
  },
  stuckRow: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  stuckTextWrap: {
    gap: 4,
  },
  stuckName: {
    fontSize: 14,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  stuckMeta: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
});
