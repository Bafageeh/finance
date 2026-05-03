import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from '@react-navigation/native';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { MetricCard } from '@/components/MetricCard';
import { ReportExportCard } from '@/components/ReportExportCard';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { getClients, getPartnerClients, getStats } from '@/services/api';
import { getFollowUpSummaries } from '@/services/follow-up-store';
import { exportReportExcelCsv, exportReportPdf } from '@/services/report-export';
import { Client, StatsData } from '@/types/api';
import { CollectionAssistantBoard, CollectionAssistantLead } from '@/types/assistant';
import { FollowUpSummary } from '@/types/follow-up';
import { buildCollectionAssistantBoard } from '@/utils/collection-assistant';
import { formatCurrency, formatDate } from '@/utils/format';
import {
  buildCourtReport,
  buildLateClientsReport,
  buildLateClientsWithAliReport,
  buildPortfolioReport,
  buildSmartCollectionReport,
  buildUpcomingReport,
} from '@/utils/reports';
import { colors } from '@/utils/theme';

function urgencyTone(lead: CollectionAssistantLead) {
  switch (lead.urgency) {
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

function targetDateText(lead: CollectionAssistantLead): string {
  const value = lead.dueDate || lead.nextFollowUpAt || lead.summary?.next_follow_up_at || null;
  return value ? formatDate(value) : 'بدون تاريخ';
}

function isAliSession(session: ReturnType<typeof useSession>['session']): boolean {
  return (
    String(session?.user?.email || '').toLowerCase() === 'ali@pm.sa'
    || String(session?.user?.account_slug || '').toLowerCase() === 'ali'
  );
}

export default function ReportsScreen() {
  const isFocused = useIsFocused();
  const { session } = useSession();
  const isAli = isAliSession(session);
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [aliSharedClients, setAliSharedClients] = useState<Client[]>([]);
  const [followUps, setFollowUps] = useState<Record<number, FollowUpSummary>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadData(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);

      const [statsResponse, clientsResponse, aliClientsResponse] = await Promise.all([
        getStats(),
        getClients('all'),
        isAli ? getPartnerClients() : Promise.resolve<Client[]>([]),
      ]);
      const summaries = await getFollowUpSummaries(clientsResponse.map((client) => client.id));

      setStats(statsResponse);
      setClients(clientsResponse);
      setAliSharedClients(aliClientsResponse);
      setFollowUps(summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات التقارير.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) {
      void loadData();
    }
  }, [isFocused, isAli]);

  const assistantBoard: CollectionAssistantBoard = useMemo(
    () => buildCollectionAssistantBoard(clients, followUps),
    [clients, followUps],
  );

  const featuredLeads = useMemo(() => assistantBoard.leads.slice(0, 3), [assistantBoard.leads]);

  const aliReportClients = useMemo(() => (isAli ? aliSharedClients : clients), [aliSharedClients, clients, isAli]);

  const reports = useMemo(() => {
    if (!stats) return [];

    return [
      buildSmartCollectionReport(assistantBoard),
      buildPortfolioReport(clients, stats),
      buildLateClientsReport(clients),
      buildLateClientsWithAliReport(aliReportClients),
      buildCourtReport(clients),
      buildUpcomingReport(clients),
    ];
  }, [aliReportClients, assistantBoard, clients, stats]);

  async function handlePdf(index: number) {
    const report = reports[index];
    if (!report) return;

    try {
      await exportReportPdf(report);
    } catch (err) {
      Alert.alert('تصدير PDF', err instanceof Error ? err.message : 'تعذر إنشاء ملف PDF.');
    }
  }

  async function handleExcel(index: number) {
    const report = reports[index];
    if (!report) return;

    try {
      await exportReportExcelCsv(report);
    } catch (err) {
      Alert.alert('تصدير Excel', err instanceof Error ? err.message : 'تعذر إنشاء ملف Excel المتوافق.');
    }
  }

  return (
    <Screen
      title="التقارير"
      subtitle="مركز تقارير PDF وExcel مع تقرير مركز التحصيل مبني على الأولويات والمتابعات."
      compactHeader
      scrollable={false}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر تحميل التقارير">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error && stats ? (
          <>
            <AppCard title="مؤشر التحصيل الذكي">
              <View style={styles.metricGrid}>
                <MetricCard label="أولويات اليوم" value={String(assistantBoard.totalLeads)} tone="info" />
                <MetricCard label="حالات حرجة" value={String(assistantBoard.criticalCount)} tone="danger" />
                <MetricCard label="وعود مستحقة" value={String(assistantBoard.promiseDueCount)} tone="warning" />
                <MetricCard label="قيمة الفرص" value={formatCurrency(assistantBoard.totalOpportunityAmount)} tone="success" />
              </View>

              <View style={styles.assistantBox}>
                <View style={styles.assistantTextWrap}>
                  <Text style={styles.assistantTitle}>تمت إضافة تقرير جديد: التحصيل الذكي</Text>
                  <Text style={styles.assistantSubtitle}>
                    التقرير يرتب العملاء حسب درجة الأولوية، ويصدر PDF وCSV متوافق مع Excel متضمنًا المبلغ، التاريخ، آخر متابعة، والإجراء المقترح.
                  </Text>
                </View>

                <TouchableOpacity style={styles.assistantButton} onPress={() => router.push('/assistant' as never)} activeOpacity={0.9}>
                  <Ionicons name="sparkles-outline" size={16} color="#fff" />
                  <Text style={styles.assistantButtonText}>فتح المساعد</Text>
                </TouchableOpacity>
              </View>

              {featuredLeads.length ? (
                <View style={styles.leadsPreview}>
                  {featuredLeads.map((lead: CollectionAssistantLead) => (
                    <SmartLeadRow key={lead.key} lead={lead} />
                  ))}
                </View>
              ) : (
                <Text style={styles.helperText}>لا توجد أولويات مركز التحصيلة حاليًا. عند وجود متأخرات أو وعود متابعة ستظهر هنا.</Text>
              )}
            </AppCard>

            <AppCard title="مركز التقارير">
              <View style={styles.summaryGrid}>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{reports.length}</Text>
                  <Text style={styles.summaryLabel}>أنواع التقارير</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>{clients.length}</Text>
                  <Text style={styles.summaryLabel}>إجمالي السجلات</Text>
                </View>
                <View style={styles.summaryBox}>
                  <Text style={styles.summaryValue}>PDF / CSV</Text>
                  <Text style={styles.summaryLabel}>صيغ التصدير</Text>
                </View>
              </View>
              <Text style={styles.helperText}>
                يتم إنشاء ملفات PDF مباشرة من التطبيق، وملفات CSV عربية متوافقة مع Excel للمشاركة أو الحفظ.
              </Text>
            </AppCard>

            {reports.map((report, index) => (
              <ReportExportCard
                key={report.kind}
                report={report}
                onExportPdf={() => void handlePdf(index)}
                onExportExcel={() => void handleExcel(index)}
              />
            ))}
          </>
        ) : null}

        {!loading && !error && !stats ? (
          <EmptyState title="لا توجد بيانات" description="عند توفر العملاء والإحصائيات ستظهر التقارير هنا." />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function SmartLeadRow({ lead }: { lead: CollectionAssistantLead }) {
  const tone = urgencyTone(lead);

  return (
    <TouchableOpacity
      style={styles.leadRow}
      onPress={() => router.push({ pathname: '/clients/[id]', params: { id: String(lead.client.id) } })}
      activeOpacity={0.9}
    >
      <View style={[styles.urgencyBadge, { backgroundColor: tone.background }]}>
        <Text style={[styles.urgencyText, { color: tone.color }]}>{tone.label}</Text>
      </View>

      <View style={styles.leadInfo}>
        <Text style={styles.leadName} numberOfLines={1}>{lead.client.name}</Text>
        <Text style={styles.leadReason} numberOfLines={2}>{lead.reason}</Text>
        <View style={styles.leadMetaRow}>
          <Text style={styles.leadMeta}>{formatCurrency(lead.amount)}</Text>
          <Text style={styles.leadMeta}>درجة {lead.score}</Text>
          <Text style={styles.leadMeta}>{targetDateText(lead)}</Text>
        </View>
      </View>

      <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
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
  assistantBox: {
    borderRadius: 18,
    padding: 14,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 12,
  },
  assistantTextWrap: {
    gap: 5,
  },
  assistantTitle: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  assistantSubtitle: {
    fontSize: 12,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'right',
  },
  assistantButton: {
    minHeight: 42,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 7,
  },
  assistantButtonText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
  },
  leadsPreview: {
    gap: 8,
  },
  leadRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  urgencyBadge: {
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 9,
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: '900',
  },
  leadInfo: {
    flex: 1,
    gap: 4,
  },
  leadName: {
    fontSize: 14,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  leadReason: {
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
    textAlign: 'right',
  },
  leadMetaRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 6,
  },
  leadMeta: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 4,
    overflow: 'hidden',
  },
  summaryGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  summaryBox: {
    flex: 1,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 14,
    paddingHorizontal: 10,
    gap: 4,
  },
  summaryValue: {
    fontSize: 18,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  summaryLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  helperText: {
    fontSize: 12,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'right',
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },

});
