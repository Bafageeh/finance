import { useIsFocused } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { EmptyState } from '@/components/EmptyState';
import { LoadingBlock } from '@/components/LoadingBlock';
import { ReportExportCard } from '@/components/ReportExportCard';
import { Screen } from '@/components/Screen';
import { SectionHeader } from '@/components/SectionHeader';
import { getClients, getPartnerClients, getStats } from '@/services/api';
import { getFollowUpSummaries } from '@/services/follow-up-store';
import { exportReportExcelCsv, exportReportPdf } from '@/services/report-export';
import { Client, StatsData } from '@/types/api';
import { FollowUpSummary } from '@/types/follow-up';
import { ReportDocument } from '@/types/report';
import { buildActiveLateClientsMatrixReport } from '@/utils/active-late-clients-report';
import { buildCollectionAssistantBoard } from '@/utils/collection-assistant';
import {
  buildCourtReport,
  buildLateClientsReport,
  buildLateClientsWithAliReport,
  buildPortfolioReport,
  buildSmartCollectionReport,
  buildUpcomingReport,
} from '@/utils/reports';
import { colors } from '@/utils/theme';

export default function ReportsScreen() {
  const isFocused = useIsFocused();
  const [stats, setStats] = useState<StatsData | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [aliReportClients, setAliReportClients] = useState<Client[]>([]);
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
        getPartnerClients().catch(() => null),
      ]);
      const summaries = await getFollowUpSummaries(clientsResponse.map((client) => client.id));
      setStats(statsResponse);
      setClients(clientsResponse);
      setAliReportClients(aliClientsResponse ?? clientsResponse);
      setFollowUps(summaries);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل بيانات التقارير.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadData();
  }, [isFocused]);

  const assistantBoard = useMemo(() => buildCollectionAssistantBoard(clients, followUps), [clients, followUps]);
  const reportGroups = useMemo(() => {
    if (!stats) return [];
    return [
      {
        title: 'تقارير المحفظة والعملاء',
        reports: [buildActiveLateClientsMatrixReport(clients), buildPortfolioReport(clients, stats)],
      },
      {
        title: 'تقارير التحصيل والمتابعة',
        reports: [
          buildSmartCollectionReport(assistantBoard),
          buildLateClientsReport(clients),
          buildLateClientsWithAliReport(aliReportClients),
          buildUpcomingReport(clients),
        ],
      },
      { title: 'التقارير القضائية', reports: [buildCourtReport(clients)] },
    ];
  }, [aliReportClients, assistantBoard, clients, stats]);

  async function handlePdf(report: ReportDocument) {
    try {
      await exportReportPdf(report);
    } catch (err) {
      Alert.alert('تصدير PDF', err instanceof Error ? err.message : 'تعذر إنشاء ملف PDF.');
    }
  }

  async function handleExcel(report: ReportDocument) {
    try {
      await exportReportExcelCsv(report);
    } catch (err) {
      Alert.alert('تصدير Excel', err instanceof Error ? err.message : 'تعذر إنشاء ملف Excel المتوافق.');
    }
  }

  return (
    <Screen title="التقارير" subtitle="تقارير العملاء والمحفظة والتحصيل" compactHeader scrollable={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadData(true); }} />}
        showsVerticalScrollIndicator={false}
      >
        {loading ? <LoadingBlock /> : null}
        {!loading && error ? (
          <AppCard title="تعذر تحميل التقارير"><Text style={styles.errorText}>{error}</Text></AppCard>
        ) : null}
        {!loading && !error && stats ? reportGroups.map((group) => (
          <View key={group.title} style={styles.group}>
            <SectionHeader title={group.title} />
            {group.reports.map((report) => (
              <ReportExportCard
                key={report.filename}
                report={report}
                onExportPdf={() => void handlePdf(report)}
                onExportExcel={() => void handleExcel(report)}
              />
            ))}
          </View>
        )) : null}
        {!loading && !error && !stats ? (
          <EmptyState title="لا توجد بيانات" description="عند توفر العملاء ستظهر تقاريرهم هنا." />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: 90, gap: 12 },
  group: { gap: 10 },
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
});
