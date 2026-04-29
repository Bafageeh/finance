import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { Screen } from '@/components/Screen';
import { getClients } from '@/services/api';
import { getFollowUpSummaries } from '@/services/follow-up-store';
import { Client } from '@/types/api';
import { CollectionAssistantLead } from '@/types/assistant';
import { FollowUpSummary } from '@/types/follow-up';
import { buildCollectionAssistantBoard } from '@/utils/collection-assistant';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

function urgencyTone(urgency: CollectionAssistantLead['urgency']) {
  switch (urgency) {
    case 'critical':
      return { label: 'حرج', color: colors.danger, background: colors.dangerSoft };
    case 'high':
      return { label: 'مرتفع', color: colors.warning, background: colors.warningSoft };
    case 'medium':
      return { label: 'متوسط', color: colors.info, background: colors.infoSoft };
    default:
      return { label: 'اعتيادي', color: colors.textMuted, background: colors.surfaceMuted };
  }
}

function dateText(value?: string | null): string {
  return value ? formatDate(value) : 'بدون تاريخ';
}

export default function AssistantScreen() {
  const isFocused = useIsFocused();
  const [clients, setClients] = useState<Client[]>([]);
  const [summaries, setSummaries] = useState<Record<number, FollowUpSummary>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      const clientsResponse = await getClients('all');
      const followUpSummaries = await getFollowUpSummaries(clientsResponse.map((client) => client.id));
      setClients(clientsResponse);
      setSummaries(followUpSummaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل مساعد التحصيل.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused]);

  const board = useMemo(() => buildCollectionAssistantBoard(clients, summaries), [clients, summaries]);

  return (
    <Screen title="مساعد التحصيل" subtitle="أولويات ذكية حسب المتأخرات والوعود والقضايا وقيمة الفرصة." compactHeader scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر تحميل البيانات">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error ? (
          <>
            <AppCard title="ملخص الأولويات">
              <View style={styles.metricGrid}>
                <MetricCard label="أولويات" value={String(board.totalLeads)} tone="info" />
                <MetricCard label="حرجة" value={String(board.criticalCount)} tone="danger" />
                <MetricCard label="وعود" value={String(board.promiseDueCount)} tone="warning" />
                <MetricCard label="قيمة" value={formatCurrency(board.totalOpportunityAmount)} tone="success" />
              </View>
            </AppCard>

            {board.leads.length ? (
              <View style={styles.list}>
                {board.leads.map((lead) => <LeadCard key={lead.key} lead={lead} />)}
              </View>
            ) : (
              <EmptyState title="لا توجد أولويات حاليًا" description="عند وجود متأخرات أو مواعيد متابعة أو قضايا ستظهر هنا تلقائيًا." />
            )}
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function LeadCard({ lead }: { lead: CollectionAssistantLead }) {
  const tone = urgencyTone(lead.urgency);
  const target = lead.nextFollowUpAt || lead.dueDate || null;

  return (
    <TouchableOpacity
      style={styles.leadCard}
      activeOpacity={0.9}
      onPress={() => router.push({ pathname: '/clients/[id]', params: { id: String(lead.client.id) } })}
    >
      <View style={styles.leadTopRow}>
        <View style={[styles.badge, { backgroundColor: tone.background }]}>
          <Text style={[styles.badgeText, { color: tone.color }]}>{tone.label}</Text>
        </View>
        <View style={styles.leadTitleWrap}>
          <Text style={styles.leadName}>{lead.client.name}</Text>
          <Text style={styles.leadReason}>{lead.reason}</Text>
        </View>
        <Ionicons name="chevron-back" size={18} color={colors.textMuted} />
      </View>

      <View style={styles.metaRow}>
        <Text style={styles.metaPill}>{formatCurrency(lead.amount)}</Text>
        <Text style={styles.metaPill}>درجة {lead.score}</Text>
        <Text style={styles.metaPill}>{dateText(target)}</Text>
      </View>

      <View style={styles.actionBox}>
        <Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} />
        <Text style={styles.actionText}>{lead.nextActionLabel}</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 90,
  },
  metricGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 10,
  },
  list: {
    gap: 10,
  },
  leadCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: 14,
    gap: 12,
  },
  leadTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '900',
  },
  leadTitleWrap: {
    flex: 1,
    gap: 5,
  },
  leadName: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'right',
  },
  leadReason: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
    textAlign: 'right',
  },
  metaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 7,
  },
  metaPill: {
    borderRadius: 999,
    paddingHorizontal: 9,
    paddingVertical: 5,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    fontSize: 11,
    fontWeight: '800',
    overflow: 'hidden',
  },
  actionBox: {
    borderRadius: 14,
    backgroundColor: colors.primarySoft,
    padding: 10,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 7,
  },
  actionText: {
    flex: 1,
    color: colors.text,
    fontSize: 12,
    fontWeight: '800',
    textAlign: 'right',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
});
