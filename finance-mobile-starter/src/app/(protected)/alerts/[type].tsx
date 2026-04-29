import { useIsFocused } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { alertTypeMeta, AlertRouteType } from '@/constants/alerts';
import { AlertItemCard } from '@/components/AlertItemCard';
import { IconButton } from '@/components/IconButton';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { getClients } from '@/services/api';
import { Client } from '@/types/api';
import { buildAlertEntries, filterAlertEntries } from '@/utils/alerts';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

type SummaryTone = 'info' | 'warning' | 'danger';

const compactSubtitles: Record<AlertRouteType, string> = {
  court: 'العملاء المرتبطون بمتابعة قضائية.',
  late: 'الأقساط المستحقة حتى اليوم.',
  warn: 'الأقساط القادمة خلال 7 أيام.',
  stuck: 'الحالات المتعثرة قبل التحويل القضائي.',
};

const summaryPalette: Record<SummaryTone, { backgroundColor: string; color: string }> = {
  info: { backgroundColor: colors.infoSoft, color: colors.info },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
};

function CompactSummaryMetric({ label, value, tone }: { label: string; value: string; tone: SummaryTone }) {
  const palette = summaryPalette[tone];

  return (
    <View style={[styles.summaryMetric, { backgroundColor: palette.backgroundColor }]}>
      <Text style={[styles.summaryMetricValue, { color: palette.color }]} numberOfLines={1} adjustsFontSizeToFit>
        {value}
      </Text>
      <Text style={styles.summaryMetricLabel} numberOfLines={1}>{label}</Text>
    </View>
  );
}

export default function AlertGroupScreen() {
  const isFocused = useIsFocused();
  const params = useLocalSearchParams<{ type?: string }>();
  const [clients, setClients] = useState<Client[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentType: AlertRouteType = params.type && params.type in alertTypeMeta
    ? (params.type as AlertRouteType)
    : 'late';
  const meta = alertTypeMeta[currentType];

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getClients('all');
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات التنبيه.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused, currentType]);

  const entries = useMemo(() => buildAlertEntries(clients, currentType), [clients, currentType]);
  const visibleEntries = useMemo(() => filterAlertEntries(entries, query), [entries, query]);

  const metrics = useMemo(() => {
    const count = visibleEntries.length;
    const amountTotal = visibleEntries.reduce((sum, entry) => sum + (entry.amount ?? entry.client.summary.remaining_amount), 0);
    const contractsTotal = visibleEntries.reduce((sum, entry) => sum + entry.client.summary.remaining_amount, 0);
    return { count, amountTotal, contractsTotal };
  }, [visibleEntries]);

  return (
    <Screen
      title={meta.title}
      subtitle={compactSubtitles[currentType]}
      scrollable={false}
      compactHeader
      rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" size="sm" onPress={() => router.back()} />}
    >
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث بالاسم أو الهوية أو الجوال"
        placeholderTextColor="#998d7b"
        textAlign="right"
      />

      <View style={styles.summaryCard}>
        <View style={styles.summaryHeaderRow}>
          <Text style={styles.summaryTitle}>ملخص الشاشة</Text>
          <Text style={styles.summaryHint} numberOfLines={1}>اضغط على العميل للتسجيل أو المتابعة</Text>
        </View>

        <View style={styles.summaryGrid}>
          <CompactSummaryMetric label="الحالات" value={String(metrics.count)} tone="info" />
          <CompactSummaryMetric label="إجمالي المبالغ" value={formatCurrency(metrics.amountTotal)} tone="warning" />
          <CompactSummaryMetric label="المتبقي بالعقود" value={formatCurrency(metrics.contractsTotal)} tone="danger" />
        </View>
      </View>

      {currentType === 'court' ? (
        <AppCard title="متابعة قضائية" style={styles.courtCard}>
          <Text style={styles.helperText}>لإدارة القضايا بشكل أوضح استخدم مركز القضايا المستقل.</Text>
          <TouchableOpacity style={styles.primaryActionButton} onPress={() => router.push('/cases')}>
            <Text style={styles.primaryActionButtonText}>فتح مركز القضايا</Text>
          </TouchableOpacity>
        </AppCard>
      ) : null}

      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر التحميل">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error && visibleEntries.length === 0 ? (
          <EmptyState title={meta.emptyTitle} description={meta.emptyDescription} />
        ) : null}

        {!loading && !error && visibleEntries.map((entry) => (
          <AlertItemCard
            key={`${currentType}-${entry.client.id}`}
            tone={entry.tone}
            title={entry.title}
            description={entry.description}
            amountText={entry.amount ? formatCurrency(entry.amount) : undefined}
            onPress={() => router.push({
              pathname: '/clients/[id]',
              params: {
                id: String(entry.client.id),
                ...(entry.focusPeriod ? { focusPeriod: entry.focusPeriod } : {}),
              },
            })}
          />
        ))}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 44,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: colors.text,
    marginBottom: 8,
  },
  summaryCard: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 8,
    gap: 10,
  },
  summaryHeaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  summaryHint: {
    flex: 1,
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'left',
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  summaryMetric: {
    flex: 1,
    minHeight: 72,
    borderRadius: 16,
    paddingHorizontal: 8,
    paddingVertical: 10,
    justifyContent: 'center',
    gap: 6,
  },
  summaryMetricValue: {
    fontSize: 17,
    fontWeight: '900',
    textAlign: 'center',
  },
  summaryMetricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'center',
  },
  helperText: {
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
    fontSize: 13,
  },
  listContent: {
    paddingTop: 4,
    paddingBottom: 70,
  },
  courtCard: {
    marginBottom: 8,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
  primaryActionButton: {
    backgroundColor: colors.court,
    borderRadius: 12,
    alignItems: 'center',
    paddingVertical: 12,
  },
  primaryActionButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
});
