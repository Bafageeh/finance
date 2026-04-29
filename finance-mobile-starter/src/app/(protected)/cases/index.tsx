import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { IconPillButton } from '@/components/IconPillButton';
import { CaseClientCard } from '@/components/CaseClientCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients } from '@/services/api';
import { Client } from '@/types/api';
import { clientMatchesSearch, formatCurrency } from '@/utils/format';
import { getClientAlertInfo, getOverdueScheduleItems } from '@/utils/finance';
import { buildCaseMetrics } from '@/utils/stats';
import { colors } from '@/utils/theme';

const modes = [
  { value: 'all', label: 'الكل' },
  { value: 'late', label: 'متأخرون' },
  { value: 'without_note', label: 'بدون ملاحظة' },
] as const;

type CasesMode = (typeof modes)[number]['value'];

export default function CasesCenterScreen() {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<Client[]>([]);
  const [mode, setMode] = useState<CasesMode>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getClients('all');
      setClients(data.filter((client) => client.has_court));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مركز القضايا.');
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

  const metrics = useMemo(() => buildCaseMetrics(clients), [clients]);

  const visibleClients = useMemo(() => {
    return clients.filter((client) => {
      if (!clientMatchesSearch(client, query)) return false;
      const alertInfo = getClientAlertInfo(client);
      if (mode === 'late') return alertInfo.overdueCount > 0;
      if (mode === 'without_note') return !client.court_note?.trim();
      return true;
    });
  }, [clients, mode, query]);

  return (
    <Screen
      title="مركز القضايا"
      subtitle="شاشة مستقلة لمتابعة القضايا، ترتيبها، وفتح العميل مباشرة من ملفه القضائي."
      scrollable={false}
      rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />}
    >
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="ابحث بالاسم أو الهوية أو الجوال"
        placeholderTextColor="#998d7b"
        textAlign="right"
      />

      <View style={styles.modeRow}>
        {modes.map((item) => {
          const active = item.value === mode;
          return (
            <TouchableOpacity key={item.value} style={[styles.modeChip, active ? styles.modeChipActive : null]} onPress={() => setMode(item.value)}>
              <Text style={[styles.modeChipText, active ? styles.modeChipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AppCard title="ملخص قضائي سريع">
        <View style={styles.metricGrid}>
          <MetricCard label="عدد القضايا" value={String(metrics.totalCount)} tone="info" />
          <MetricCard label="إجمالي المتبقي" value={formatCurrency(metrics.totalRemaining)} tone="danger" />
          <MetricCard label="قضايا متأخرة" value={String(metrics.overdueCount)} tone="warning" />
          <MetricCard label="بدون ملاحظة" value={String(metrics.withoutNotes)} />
        </View>
      </AppCard>

      <AppCard title="عمليات سريعة">
        <SectionHeader title="التشغيل اليومي" subtitle="افتح شاشة المتأخرين أو مركز التحصيل عند الحاجة للوصول السريع." />
        <View style={styles.actionsRow}>
          <IconPillButton icon="alert-circle-outline" label="المتأخرون" onPress={() => router.push('/alerts/late')} tone="danger" />
          <IconPillButton icon="cash-outline" label="مركز التحصيل" onPress={() => router.push('/collections')} tone="primary" />
        </View>
        <Text style={styles.helperText}>القضية التي تحتوي أقساطًا متأخرة تحتاج عادةً متابعة من شاشتين: القضايا + التحصيل.</Text>
      </AppCard>

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

        {!loading && !error && visibleClients.length === 0 ? (
          <EmptyState title="لا توجد قضايا مطابقة" description="جرّب تغيير نوع العرض أو عبارة البحث." />
        ) : null}

        {!loading && !error && visibleClients.map((client) => {
          const alertInfo = getClientAlertInfo(client);
          const firstLate = getOverdueScheduleItems(client)[0];
          return (
            <CaseClientCard
              key={client.id}
              client={client}
              overdueCount={alertInfo.overdueCount}
              overdueAmount={alertInfo.overdueAmount}
              onPress={() => router.push({
                pathname: '/clients/[id]',
                params: {
                  id: String(client.id),
                  ...(firstLate?.period_key ? { focusPeriod: firstLate.period_key } : {}),
                },
              })}
            />
          );
        })}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 50,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
    marginBottom: 12,
  },
  modeRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  modeChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modeChipActive: {
    backgroundColor: colors.court,
    borderColor: colors.court,
  },
  modeChipText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  modeChipTextActive: {
    color: '#fff',
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  actionButton: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: colors.primary,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#fff',
    fontWeight: '800',
  },
  helperText: {
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
    lineHeight: 20,
  },
  listContent: {
    paddingBottom: 80,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },

});
