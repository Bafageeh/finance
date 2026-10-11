import { Ionicons } from '@expo/vector-icons';
import { useIsFocused } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AccordionSection } from '@/components/AccordionSection';
import { AppCard } from '@/components/AppCard';
import { InsightStatCard } from '@/components/InsightStatCard';
import { KeyValueRow } from '@/components/KeyValueRow';
import { LoadingBlock } from '@/components/LoadingBlock';
import { getCapitalReport } from '@/services/api';
import { CapitalReportData } from '@/types/api';
import { formatCurrency, formatDate, formatInteger } from '@/utils/format';
import { colors } from '@/utils/theme';

interface CapitalStatsSectionProps {
  refreshKey: number;
}

export function CapitalStatsSection({ refreshKey }: CapitalStatsSectionProps) {
  const isFocused = useIsFocused();
  const [data, setData] = useState<CapitalReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!isFocused) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    void getCapitalReport()
      .then((response) => { if (!cancelled) setData(response); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'تعذر تحميل إحصائيات الأرباح ورأس المال.');
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [isFocused, refreshKey]);

  if (loading) {
    return <AppCard title="الأرباح ورأس المال"><LoadingBlock /></AppCard>;
  }
  if (error) {
    return <AppCard title="الأرباح ورأس المال"><Text style={styles.errorText}>{error}</Text></AppCard>;
  }
  if (!data) return null;

  return (
    <>
      <AppCard title="الأرباح ورأس المال">
        <Text style={styles.note}>من أول تمويل وحتى آخر دفعة مسجلة في النظام.</Text>
        <InsightStatCard
          title="ربح أحمد المحقق حتى الآن"
          value={formatCurrency(data.ahmad_realized_profit)}
          helper="الجزء المحقق من ربح أحمد بحسب نسبة التحصيل الفعلية من كل عقد."
          tone="success"
        />
        <InsightStatCard
          title="ربح علي المحقق حتى الآن"
          value={formatCurrency(data.ali_realized_profit)}
          helper="حصة علي المحققة من عقود الشراكة فقط."
          tone="warning"
        />
        <InsightStatCard
          title="رأس المال المتبقي لاسترجاعه"
          value={formatCurrency(data.remaining_capital)}
          helper="رأس المال غير المحصل حسب طريقة احتساب التطبيق الحالية."
          tone="danger"
        />
        <InsightStatCard
          title="المبلغ المتبقي لأحمد ولم يرجع بعد"
          value={formatCurrency(data.ahmad_outstanding_amount)}
          helper="إجمالي المتبقي لدى العملاء بعد استبعاد حصة علي الربحية غير المحققة."
          tone="info"
        />
      </AppCard>

      <AccordionSection
        title="تفاصيل الأرباح ورأس المال"
        subtitle="أرباح أحمد وعلي، رأس المال، والفترة"
        expanded={expanded}
        onToggle={() => setExpanded((current) => !current)}
      >
        <AppCard title="أرباح أحمد">
          <KeyValueRow label="إجمالي الربح المتوقع" value={formatCurrency(data.ahmad_total_profit)} />
          <KeyValueRow label="المحقق حتى الآن" value={formatCurrency(data.ahmad_realized_profit)} />
          <KeyValueRow label="الربح المتبقي" value={formatCurrency(data.ahmad_remaining_profit)} />
        </AppCard>

        <AppCard title="أرباح علي">
          <KeyValueRow label="إجمالي الربح المتوقع" value={formatCurrency(data.ali_total_profit)} />
          <KeyValueRow label="المحقق حتى الآن" value={formatCurrency(data.ali_realized_profit)} />
          <KeyValueRow label="الربح المتبقي" value={formatCurrency(data.ali_remaining_profit)} />
        </AppCard>

        <AppCard title="تفصيل رأس المال والتحصيل">
          <KeyValueRow label="رأس المال المتبقي — نشط" value={formatCurrency(data.active_remaining_capital)} />
          <KeyValueRow label="رأس المال المتبقي — متعثر" value={formatCurrency(data.stuck_remaining_capital)} />
          <KeyValueRow label="إجمالي المتبقي لدى العملاء" value={formatCurrency(data.total_customer_remaining)} />
          <KeyValueRow label="عدد العقود من البداية" value={formatInteger(data.contracts_count)} />
        </AppCard>

        <AppCard title="الفترة وطريقة الاحتساب">
          <View style={styles.periodRow}>
            <Ionicons name="calendar-outline" size={18} color={colors.primary} />
            <Text style={styles.periodText}>
              من {formatDate(data.first_contract_date)} حتى {formatDate(data.as_of)}
            </Text>
          </View>
          <Text style={styles.note}>
            الأرباح المحققة تُحسب بنسبة المبلغ المحصل فعلياً من كل عقد إلى إجمالي قيمة السند، ثم تُوزع حسب نوع التمويل: أحمد 65% وعلي 35% في الشراكة، وأحمد 100% في التمويلات الخاصة به.
          </Text>
          <Text style={styles.note}>
            تتحدث الإحصائيات تلقائياً مع تسجيل أو إلغاء أي دفعة، ويمكن السحب لأسفل لتحديث الأرقام فوراً.
          </Text>
        </AppCard>
      </AccordionSection>
    </>
  );
}

const styles = StyleSheet.create({
  errorText: { color: colors.danger, textAlign: 'right', lineHeight: 24 },
  periodRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 8 },
  periodText: { flex: 1, color: colors.text, fontSize: 14, fontWeight: '800', textAlign: 'right' },
  note: { color: colors.textMuted, fontSize: 12, lineHeight: 21, textAlign: 'right' },
});
