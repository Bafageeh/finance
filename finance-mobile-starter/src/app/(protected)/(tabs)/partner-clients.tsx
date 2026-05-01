import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ClientListItem } from '@/components/ClientListItem';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { getPartnerClients } from '@/services/api';
import { Client } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

export default function PartnerClientsScreen() {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      setClients(await getPartnerClients());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل عملاء الشركاء.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused]);

  const summary = useMemo(() => {
    const totalProfit = clients.reduce((sum, client) => sum + Number((client as any).partner_profit_total ?? client.summary?.ali_total ?? 0), 0);
    const monthlyProfit = clients.reduce((sum, client) => sum + Number((client as any).partner_profit_monthly ?? client.summary?.ali_monthly ?? 0), 0);
    return { totalProfit, monthlyProfit };
  }, [clients]);

  const listHeader = (
    <View style={styles.headerStack}>
      <View style={styles.noticeCard}>
        <Ionicons name="eye-outline" size={18} color={colors.info} />
        <Text style={styles.noticeText}>هذه الشاشة عرض فقط لحساب علي، وتعرض أي عميل له نسبة ربح لعلي من جميع حسابات النظام.</Text>
      </View>
      <View style={styles.metricGrid}>
        <MetricCard label="عدد العملاء" value={String(clients.length)} />
        <MetricCard label="ربح علي الشهري" value={formatCurrency(summary.monthlyProfit)} tone="info" />
        <MetricCard label="ربح علي الكلي" value={formatCurrency(summary.totalProfit)} tone="success" />
      </View>
    </View>
  );

  return (
    <Screen
      title="عملاء شركاء"
      subtitle="عملاء يظهر لعلي فيها نسبة ربح"
      scrollable={false}
      compactHeader
      rightSlot={
        <View style={styles.headerAvatar}>
          <Ionicons name="people-circle-outline" size={22} color={colors.primary} />
        </View>
      }
    >
      {loading ? <LoadingBlock /> : null}

      {!loading && error ? (
        <View style={styles.errorCard}>
          <Text style={styles.errorTitle}>تعذر تحميل عملاء الشركاء</Text>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : null}

      {!loading && !error ? (
        <FlatList
          data={clients}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <View style={styles.itemWrap}>
              <ClientListItem client={item} onPress={() => router.push({ pathname: '/partner-clients/[id]', params: { id: String(item.id) } })} />
              <Text style={styles.sourceText}>من حساب: {(item as any).source_account_name || 'غير محدد'} · ربح علي: {formatCurrency((item as any).partner_profit_total ?? item.summary.ali_total)}</Text>
            </View>
          )}
          ListHeaderComponent={listHeader}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={<EmptyState title="لا يوجد عملاء شركاء" description="أي عميل بتوزيع ربح مشترك سيظهر هنا لعلي." />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
        />
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#eef2ea',
    borderWidth: 1,
    borderColor: '#e5e1d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerStack: { gap: 12, marginBottom: 12 },
  noticeCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
  },
  noticeText: { flex: 1, color: colors.textMuted, textAlign: 'right', lineHeight: 21, fontWeight: '700', fontSize: 12 },
  metricGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  itemWrap: { gap: 6 },
  sourceText: { textAlign: 'right', color: colors.textMuted, fontSize: 12, fontWeight: '800', paddingHorizontal: 8 },
  listContent: { paddingBottom: 90 },
  separator: { height: 12 },
  errorCard: { backgroundColor: '#fff', borderRadius: 16, borderWidth: 1, borderColor: '#ece6dd', padding: 14, gap: 6 },
  errorTitle: { color: colors.text, textAlign: 'right', fontWeight: '800', fontSize: 15 },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 22 },
});
