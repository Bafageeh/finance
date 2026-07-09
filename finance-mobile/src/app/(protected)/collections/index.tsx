import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { CollectionItemCard } from '@/components/CollectionItemCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { getClients } from '@/services/api';
import { Client } from '@/types/api';
import { buildCollectionEntries, filterCollectionEntries } from '@/utils/alerts';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

const modes = [
  { value: 'all', label: 'الكل' },
  { value: 'late', label: 'المتأخر' },
  { value: 'upcoming', label: 'القريب' },
] as const;

type CollectionMode = (typeof modes)[number]['value'];

export default function CollectionCenterScreen() {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<Client[]>([]);
  const [mode, setMode] = useState<CollectionMode>('all');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const data = await getClients('all');
      setClients(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مركز التحصيل.');
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

  const entries = useMemo(() => buildCollectionEntries(clients, mode), [clients, mode]);
  const visibleEntries = useMemo(() => filterCollectionEntries(entries, query), [entries, query]);

  const metrics = useMemo(() => {
    const lateEntries = visibleEntries.filter((entry) => entry.state === 'late');
    const upcomingEntries = visibleEntries.filter((entry) => entry.state === 'upcoming');

    return {
      lateCount: lateEntries.length,
      upcomingCount: upcomingEntries.length,
      totalAmount: visibleEntries.reduce((sum, entry) => sum + entry.item.amount, 0),
    };
  }, [visibleEntries]);

  return (
    <Screen
      title="مركز التحصيل"
      subtitle="قائمة تشغيل يومية للأقساط المتأخرة والقريبة مع فتح العميل مباشرة عند الحاجة."
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
            <TouchableOpacity
              key={item.value}
              style={[styles.modeChip, active ? styles.modeChipActive : null]}
              onPress={() => setMode(item.value)}
            >
              <Text style={[styles.modeChipText, active ? styles.modeChipTextActive : null]}>{item.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <AppCard title="ملخص التحصيل">
        <View style={styles.metricGrid}>
          <MetricCard label="المتأخر" value={String(metrics.lateCount)} tone="danger" />
          <MetricCard label="القريب" value={String(metrics.upcomingCount)} tone="warning" />
          <MetricCard label="إجمالي المبالغ" value={formatCurrency(metrics.totalAmount)} tone="info" />
        </View>
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

        {!loading && !error && visibleEntries.length === 0 ? (
          <EmptyState title="لا توجد عناصر" description="جرّب تغيير وضع العرض أو عبارة البحث." />
        ) : null}

        {!loading && !error && visibleEntries.map((entry) => (
          <CollectionItemCard
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
        ))}
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
    backgroundColor: colors.primary,
    borderColor: colors.primary,
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
  listContent: {
    paddingBottom: 70,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },

});
