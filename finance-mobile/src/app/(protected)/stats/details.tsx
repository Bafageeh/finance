import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { InsightStatCard } from '@/components/InsightStatCard';
import { IconButton } from '@/components/IconButton';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getStats } from '@/services/api';
import { Client, StatsData } from '@/types/api';
import {
  buildClosestToFinishRows,
  buildCourtCaseRows,
  buildHighestMonthlyRows,
  buildHighestRemainingRows,
  buildStatsOverview,
  RankedClientRow,
} from '@/utils/stats';
import { formatCurrency, formatInteger, formatPercent } from '@/utils/format';
import { colors } from '@/utils/theme';

export default function StatsDetailsScreen() {
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
      setError(err instanceof Error ? err.message : 'تعذر تحميل شاشة التحليل المالي.');
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
  const highestRemaining = useMemo(() => buildHighestRemainingRows(clients), [clients]);
  const highestMonthly = useMemo(() => buildHighestMonthlyRows(clients), [clients]);
  const closestToFinish = useMemo(() => buildClosestToFinishRows(clients), [clients]);
  const courtRows = useMemo(() => buildCourtCaseRows(clients), [clients]);

  function openClient(row: RankedClientRow) {
    router.push({
      pathname: '/clients/[id]',
      params: {
        id: String(row.client.id),
        ...(row.focusPeriod ? { focusPeriod: row.focusPeriod } : {}),
      },
    });
  }

  return (
    <Screen
      title="تفصيل الإحصائيات"
      subtitle="تحليل أعمق للمحفظة، المخاطر، العقود الأعلى قيمة، وأولويات المتابعة اليومية."
      scrollable={false}
      rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />}
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

        {!loading && !error && stats && overview ? (
          <>
            <AppCard title="صورة المحفظة">
              <InsightStatCard title="إجمالي قيمة العقود" value={formatCurrency(overview.totalPortfolio)} helper="المبلغ الكلي لكافة العقود بما فيها المنتهية." tone="info" />
              <InsightStatCard title="إجمالي المتبقي للتحصيل" value={formatCurrency(overview.totalRemaining)} helper="الرصيد الحالي الذي ما زال بانتظار التحصيل." tone="danger" />
              <InsightStatCard title="ما تم تحصيله حتى الآن" value={formatCurrency(overview.totalPaid)} helper="إجمالي الدفعات المسجلة في العقود جميعها." tone="success" />
              <InsightStatCard title="التغطية من المحفظة" value={formatPercent(overview.collectionCoveragePercent)} helper="نسبة ما تم تحصيله مقارنة بإجمالي قيمة العقود." tone="warning" />
            </AppCard>

            <AppCard title="تشغيل يومي">
              <View style={styles.grid}>
                <InsightStatCard title="عقود متأخرة" value={formatInteger(overview.overdueContracts)} helper={formatCurrency(overview.overdueAmount)} tone="danger" onPress={() => router.push('/alerts/late')} />
                <InsightStatCard title="استحقاقات خلال 7 أيام" value={formatInteger(overview.upcomingContracts)} helper={formatCurrency(overview.upcomingAmount)} tone="warning" onPress={() => router.push('/alerts/warn')} />
                <InsightStatCard title="قضايا المحكمة" value={formatInteger(overview.courtContracts)} helper="فتح مركز القضايا" tone="court" onPress={() => router.push('/cases')} />
                <InsightStatCard title="متوسط القسط النشط" value={formatCurrency(overview.averageMonthlyInstallment)} helper="متوسط الدفعة الشهرية للعقود النشطة." tone="info" onPress={() => router.push('/collections')} />
              </View>
            </AppCard>

            <AppCard title="توزيع الحالات">
              <View style={styles.grid}>
                <InsightStatCard title="نشطون" value={formatInteger(overview.activeContracts)} tone="success" />
                <InsightStatCard title="منتهون" value={formatInteger(overview.completedContracts)} tone="info" />
                <InsightStatCard title="متعثرون" value={formatInteger(overview.stuckContracts)} helper="تحتاج متابعة قبل أو بعد التحويل القضائي." tone="danger" onPress={() => router.push('/alerts/stuck')} />
                <InsightStatCard title="إجمالي الأرباح" value={formatCurrency(overview.totalProfit)} helper="الربح الكلي المحسوب من جميع العقود." tone="warning" />
              </View>
            </AppCard>

            <AppCard title="العقود الأعلى بقاءً">
              <SectionHeader title="أعلى المتبقي" subtitle="ابدأ بهذه العقود إذا أردت تقليل المخاطر المالية أولاً." />
              {highestRemaining.length ? highestRemaining.map((row) => (
                <TouchableOpacity key={`remaining-${row.client.id}`} style={styles.rankRow} onPress={() => openClient(row)}>
                  <View style={styles.rankTextWrap}>
                    <Text style={styles.rankName}>{row.client.name}</Text>
                    <Text style={styles.rankHelper}>{row.helper}</Text>
                  </View>
                  <Text style={styles.rankValue}>{formatCurrency(row.value)}</Text>
                </TouchableOpacity>
              )) : <EmptyState title="لا توجد بيانات" description="لا يوجد ما يمكن ترتيبه في هذا القسم حالياً." />}
            </AppCard>

            <AppCard title="العقود الأعلى قسطاً">
              <SectionHeader title="أعلى القسط الشهري" subtitle="مفيد لتحديد أهم العقود تأثيراً على التدفق النقدي الشهري." />
              {highestMonthly.length ? highestMonthly.map((row) => (
                <TouchableOpacity key={`monthly-${row.client.id}`} style={styles.rankRow} onPress={() => openClient(row)}>
                  <View style={styles.rankTextWrap}>
                    <Text style={styles.rankName}>{row.client.name}</Text>
                    <Text style={styles.rankHelper}>{row.helper}</Text>
                  </View>
                  <Text style={styles.rankValue}>{formatCurrency(row.value)}</Text>
                </TouchableOpacity>
              )) : <EmptyState title="لا توجد بيانات" description="لا يوجد ما يمكن ترتيبه في هذا القسم حالياً." />}
            </AppCard>

            <AppCard title="العقود الأقرب للإغلاق">
              <SectionHeader title="إقفال سريع" subtitle="عقود قريبة من الانتهاء ويمكن متابعتها للوصول إلى إغلاق أسرع." />
              {closestToFinish.length ? closestToFinish.map((row) => (
                <TouchableOpacity key={`close-${row.client.id}`} style={styles.rankRow} onPress={() => openClient(row)}>
                  <View style={styles.rankTextWrap}>
                    <Text style={styles.rankName}>{row.client.name}</Text>
                    <Text style={styles.rankHelper}>{row.helper}</Text>
                  </View>
                  <Text style={styles.rankValue}>{formatCurrency(row.value)}</Text>
                </TouchableOpacity>
              )) : <EmptyState title="لا توجد بيانات" description="لا يوجد عقود قريبة من الإقفال حالياً." />}
            </AppCard>

            <AppCard title="القضايا ذات القيمة الأعلى">
              <SectionHeader title="الأعلى قضائياً" subtitle="أكبر القضايا من حيث المتبقي بالعقد لبدء المتابعة القانونية من الأعلى أثراً." actionLabel="فتح مركز القضايا" onActionPress={() => router.push('/cases')} />
              {courtRows.length ? courtRows.slice(0, 5).map((row) => (
                <TouchableOpacity key={`court-${row.client.id}`} style={styles.rankRow} onPress={() => openClient(row)}>
                  <View style={styles.rankTextWrap}>
                    <Text style={styles.rankName}>{row.client.name}</Text>
                    <Text style={styles.rankHelper}>{row.helper}</Text>
                  </View>
                  <Text style={styles.rankValue}>{formatCurrency(row.value)}</Text>
                </TouchableOpacity>
              )) : <EmptyState title="لا توجد قضايا حالياً" description="عند تفعيل قضية على أي عميل ستظهر هنا تلقائياً." />}
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
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
  grid: {
    gap: 2,
  },
  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  rankTextWrap: {
    flex: 1,
    gap: 4,
  },
  rankName: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  rankHelper: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
  },
  rankValue: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },

});
