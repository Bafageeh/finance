import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { IconButton } from '@/components/IconButton';
import { InsightStatCard } from '@/components/InsightStatCard';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { Screen } from '@/components/Screen';
import { getCapitalReport } from '@/services/api';
import { CapitalReportData } from '@/types/api';
import { formatCurrency, formatDate, formatInteger } from '@/utils/format';
import { colors } from '@/utils/theme';

export default function CapitalReportScreen() {
  const isFocused = useIsFocused();
  const [report, setReport] = useState<CapitalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function loadReport(silent = false) {
    try {
      if (!silent) setLoading(true);
      setError(null);
      setReport(await getCapitalReport());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'تعذر تحميل تقرير الأرباح ورأس المال.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  useEffect(() => {
    if (isFocused) void loadReport();
  }, [isFocused]);

  return (
    <Screen
      title="تقرير الأرباح ورأس المال"
      subtitle="من أول تمويل وحتى آخر دفعة مسجلة في النظام."
      scrollable={false}
      rightSlot={<IconButton icon="arrow-forward" accessibilityLabel="رجوع" onPress={() => router.back()} />}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void loadReport(true); }} />}
      >
        {loading ? <LoadingBlock /> : null}

        {!loading && error ? (
          <AppCard title="تعذر التحميل">
            <Text style={styles.errorText}>{error}</Text>
          </AppCard>
        ) : null}

        {!loading && !error && report ? (
          <>
            <AppCard title="النتائج الرئيسية">
              <InsightStatCard
                title="ربح أحمد المحقق حتى الآن"
                value={formatCurrency(report.ahmad_realized_profit)}
                helper="الجزء المحقق من ربح أحمد بحسب نسبة التحصيل الفعلية من كل عقد."
                tone="success"
              />
              <InsightStatCard
                title="ربح علي المحقق حتى الآن"
                value={formatCurrency(report.ali_realized_profit)}
                helper="حصة علي المحققة من عقود الشراكة فقط."
                tone="warning"
              />
              <InsightStatCard
                title="رأس المال المتبقي لاسترجاعه"
                value={formatCurrency(report.remaining_capital)}
                helper="رأس المال غير المحصل حسب طريقة احتساب التطبيق الحالية."
                tone="danger"
              />
              <InsightStatCard
                title="المبلغ المتبقي لأحمد ولم يرجع بعد"
                value={formatCurrency(report.ahmad_outstanding_amount)}
                helper="إجمالي المتبقي لدى العملاء بعد استبعاد حصة علي الربحية غير المحققة."
                tone="info"
              />
            </AppCard>

            <AppCard title="أرباح أحمد">
              <KeyValueRow label="إجمالي الربح المتوقع" value={formatCurrency(report.ahmad_total_profit)} />
              <KeyValueRow label="المحقق حتى الآن" value={formatCurrency(report.ahmad_realized_profit)} />
              <KeyValueRow label="الربح المتبقي" value={formatCurrency(report.ahmad_remaining_profit)} />
            </AppCard>

            <AppCard title="أرباح علي">
              <KeyValueRow label="إجمالي الربح المتوقع" value={formatCurrency(report.ali_total_profit)} />
              <KeyValueRow label="المحقق حتى الآن" value={formatCurrency(report.ali_realized_profit)} />
              <KeyValueRow label="الربح المتبقي" value={formatCurrency(report.ali_remaining_profit)} />
            </AppCard>

            <AppCard title="تفصيل رأس المال والتحصيل">
              <KeyValueRow label="رأس المال المتبقي — نشط" value={formatCurrency(report.active_remaining_capital)} />
              <KeyValueRow label="رأس المال المتبقي — متعثر" value={formatCurrency(report.stuck_remaining_capital)} />
              <KeyValueRow label="إجمالي المتبقي لدى العملاء" value={formatCurrency(report.total_customer_remaining)} />
              <KeyValueRow label="عدد العقود من البداية" value={formatInteger(report.contracts_count)} />
            </AppCard>

            <AppCard title="نطاق التقرير">
              <View style={styles.periodRow}>
                <Ionicons name="calendar-outline" size={18} color={colors.primary} />
                <Text style={styles.periodText}>
                  من {formatDate(report.first_contract_date)} حتى {formatDate(report.as_of)}
                </Text>
              </View>
              <Text style={styles.note}>
                الأرباح المحققة تُحسب بنسبة المبلغ المحصل فعلياً من كل عقد إلى إجمالي قيمة السند، ثم تُوزع حسب نوع التمويل: أحمد 65% وعلي 35% في الشراكة، وأحمد 100% في التمويلات الخاصة به.
              </Text>
              <Text style={styles.note}>
                يتحدث التقرير تلقائياً مع تسجيل أو إلغاء أي دفعة، ويمكن السحب لأسفل لتحديث الأرقام فوراً.
              </Text>
            </AppCard>
          </>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 84,
  },
  errorText: {
    color: colors.danger,
    textAlign: 'right',
    lineHeight: 24,
  },
  periodRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  periodText: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
    textAlign: 'right',
  },
  note: {
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 21,
    textAlign: 'right',
  },
});
