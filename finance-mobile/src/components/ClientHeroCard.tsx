import { Ionicons } from '@expo/vector-icons';
import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import { Client, ClientStatus } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { buildPaymentProgress } from '@/utils/payment-progress';
import { buildCapitalRecoveryPosition, getClientCapitalRecoveryTarget } from '@/utils/capital-recovery';
import { colors } from '@/utils/theme';
import { IconPillButton } from './IconPillButton';

interface ClientHeroCardProps {
  client: Client;
  status: ClientStatus;
  progressColor: string;
  overdueCount: number;
  overdueAmount: number;
  remainingFinancedCapital: number;
  ahmadProfitRate: number;
  ownerProfitLabel: string;
  onToggleClient: () => void;
  onToggleCourt: () => void;
  disabled?: boolean;
}

export function ClientHeroCard({
  client,
  status,
  progressColor,
  overdueCount,
  overdueAmount,
  remainingFinancedCapital,
  ahmadProfitRate,
  ownerProfitLabel,
  onToggleClient,
  onToggleCourt,
  disabled,
}: ClientHeroCardProps) {
  const bondTotal = Number(client.summary.bond_total) > 0
    ? Number(client.summary.bond_total)
    : Math.max(0, Number(client.summary.paid_amount) + Number(client.summary.remaining_amount));
  const paymentProgress = buildPaymentProgress(bondTotal, Number(client.summary.paid_amount), overdueAmount);
  const capitalGoal = getClientCapitalRecoveryTarget(client);
  const recovery = buildCapitalRecoveryPosition(bondTotal, paymentProgress.paid, capitalGoal);

  const compactStatusLabel = client.has_court
    ? 'قضية'
    : status === 'stuck'
      ? 'متعثر'
      : status === 'done'
        ? 'منتهي'
        : 'نشط';

  const statusPalette = client.has_court
    ? { background: colors.courtSoft, text: colors.court }
    : status === 'stuck'
      ? { background: colors.warningSoft, text: colors.warning }
      : status === 'done'
        ? { background: colors.infoSoft, text: colors.info }
        : overdueCount > 0
          ? { background: colors.dangerSoft, text: colors.danger }
          : { background: colors.successSoft, text: '#1b6c4f' };

  const heroNotices = [
    client.has_court
      ? { icon: 'shield-outline' as const, text: client.court_note || 'متابعة قضائية مضافة', tone: 'court' as const }
      : null,
    status === 'stuck'
      ? { icon: 'pause-circle-outline' as const, text: 'العميل متعثر وموقوف مؤقتًا من المؤشرات العامة', tone: 'neutral' as const }
      : null,
    overdueCount > 0
      ? {
          icon: 'alert-circle-outline' as const,
          text: `${overdueCount} متأخر · ${formatCurrency(overdueAmount)}`,
          tone: 'danger' as const,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: keyof typeof Ionicons.glyphMap; text: string; tone: 'court' | 'neutral' | 'danger' }>;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>القسط الشهري</Text>
          <Text style={styles.amountValue} numberOfLines={1}>
            {formatCurrency(client.summary.monthly_installment)}
          </Text>
          <Text style={styles.amountSubtext} numberOfLines={1}>
            أصل التمويل {client.asset || 'تمويل'}
          </Text>
        </View>

        <View style={styles.identitySide}>
          <View style={styles.identityText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {client.name}
              </Text>
              {client.has_court ? <Ionicons name="shield-outline" size={15} color={colors.court} /> : null}
              {overdueCount > 0 ? <Ionicons name="alert-circle-outline" size={15} color={colors.danger} /> : null}
            </View>

            <Text style={styles.metaLine} numberOfLines={1}>
              {client.asset || 'بدون أصل'} · {client.summary.paid_count}/{client.months} شهر · متبقي {formatCurrency(client.summary.remaining_amount)}
            </Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: statusPalette.background }]}> 
                <Text style={[styles.statusText, { color: statusPalette.text }]}>{compactStatusLabel}</Text>
              </View>
              <Text style={styles.progressText}>{client.summary.progress_percent}% إنجاز</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.paymentProgress}>
        <Text style={styles.breakdownTitle}>توزيع قيمة السند</Text>
        <View style={styles.capitalBarContainer}>
        <View
          style={styles.progressTrack}
          accessibilityRole="text"
          accessibilityLabel={'المدفوع ' + formatCurrency(paymentProgress.paid) + '، المتأخر ' + formatCurrency(paymentProgress.overdue) + '، المتبقي غير المتأخر ' + formatCurrency(paymentProgress.upcoming)}
        >
          {paymentProgress.paidPercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(paymentProgress.paidPercent) + '%') as DimensionValue, backgroundColor: colors.success }]} />
          ) : null}
          {paymentProgress.overduePercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(paymentProgress.overduePercent) + '%') as DimensionValue, backgroundColor: colors.danger }]} />
          ) : null}
          {paymentProgress.upcomingPercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(paymentProgress.upcomingPercent) + '%') as DimensionValue, backgroundColor: '#b5b8bc' }]} />
          ) : null}
        </View>
          {recovery.visible && !recovery.outOfRange ? (
            <View pointerEvents="none" style={styles.capitalMarkerOverlay}>
              <View style={{ width: (String(recovery.markerPercent) + '%') as DimensionValue }} />
              <View style={[styles.capitalMarker, recovery.reached && styles.capitalMarkerReached]} />
            </View>
          ) : null}
        </View>
        {recovery.visible ? (
          <View style={styles.capitalLegendRow}>
            <View style={styles.capitalLegendHeading}>
              <View style={[styles.capitalLegendDot, recovery.reached && styles.capitalDotReached]} />
              <Text style={styles.capitalLegendText} numberOfLines={1}>
                {recovery.outOfRange ? 'رأس المال خارج قيمة السند' : 'نقطة استرداد رأس المال: ' + recovery.thresholdPercent + '%'}
              </Text>
            </View>
            <Text style={[styles.capitalRecoveryStatus, recovery.reached && styles.capitalRecoveryDone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {recovery.reached ? 'تم الاسترداد' : 'باقٍ ' + formatCurrency(recovery.remainingToRecover)}
            </Text>
          </View>
        ) : null}
        <View style={styles.statsRow}>
          <MiniStat label="المدفوع" value={formatCurrency(paymentProgress.paid)} percent={paymentProgress.paidRoundedPercent} tone="success" />
          <MiniStat label="المتأخر" value={formatCurrency(paymentProgress.overdue)} percent={paymentProgress.overdueRoundedPercent} tone="danger" />
          <MiniStat label="المتبقي" detail="غير متأخر" value={formatCurrency(paymentProgress.upcoming)} percent={paymentProgress.upcomingRoundedPercent} tone="default" />
        </View>
      </View>

      <View style={styles.financialMetricsGrid}>
        <FinancialMetric label="قيمة السند" value={formatCurrency(client.summary.bond_total)} />
        <FinancialMetric label="رأس المال المتبقي" value={formatCurrency(remainingFinancedCapital)} tone="warning" />
        <FinancialMetric label="إجمالي الربح" value={formatCurrency(client.summary.total_profit)} tone="info" />
        <FinancialMetric label={ownerProfitLabel} value={formatCurrency(client.summary.ahmad_total)} tone="success" />
        <FinancialMetric label="نسبة ربح أحمد السنوية" value={`${ahmadProfitRate.toFixed(2)}%`} tone="success" wide />
      </View>

      {heroNotices.length ? (
        <View style={styles.noticeWrap}>
          {heroNotices.map((notice, index) => (
            <View
              key={`${notice.text}-${index}`}
              style={[
                styles.noticePill,
                notice.tone === 'court'
                  ? styles.noticeCourt
                  : notice.tone === 'neutral'
                    ? styles.noticeNeutral
                    : styles.noticeDanger,
              ]}
            >
              <Ionicons
                name={notice.icon}
                size={13}
                color={notice.tone === 'court' ? colors.court : notice.tone === 'neutral' ? colors.neutral : colors.danger}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.noticeText,
                  notice.tone === 'court'
                    ? styles.noticeTextCourt
                    : notice.tone === 'neutral'
                      ? styles.noticeTextNeutral
                      : styles.noticeTextDanger,
                ]}
              >
                {notice.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.quickActionsRow}>
        <IconPillButton
          icon={client.status === 'stuck' ? 'sparkles-outline' : 'pause-circle-outline'}
          label={client.status === 'stuck' ? 'تنشيط' : 'تعثر'}
          tone={client.status === 'stuck' ? 'success' : 'default'}
          onPress={onToggleClient}
          disabled={disabled}
        />
        <IconPillButton
          icon={client.has_court ? 'shield-checkmark-outline' : 'shield-outline'}
          label={client.has_court ? 'إزالة قضية' : 'إضافة قضية'}
          tone={client.has_court ? 'danger' : 'primary'}
          onPress={onToggleCourt}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

function MiniStat({
  label,
  value,
  percent,
  detail,
  tone = 'default',
}: {
  label: string;
  value: string;
  percent: number;
  detail?: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
}) {
  const palette =
    tone === 'success'
      ? { background: colors.successSoft, value: colors.success }
      : tone === 'danger'
        ? { background: colors.dangerSoft, value: colors.danger }
        : tone === 'info'
          ? { background: colors.infoSoft, value: colors.info }
          : { background: colors.surfaceMuted, value: colors.text };

  return (
    <View style={[styles.statCard, { backgroundColor: palette.background }]}>
      <View style={styles.statHeader}>
        <View style={[styles.statDot, { backgroundColor: tone === 'default' ? colors.neutral : palette.value }]} />
        <Text style={styles.statLabel}>{label}</Text>
      </View>
      <Text style={[styles.statValue, { color: palette.value }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
        {value}
      </Text>
      <Text style={styles.statFootnote}>{percent}%{detail ? ' · ' + detail : ''}</Text>
    </View>
  );
}

function FinancialMetric({
  label,
  value,
  tone = 'default',
  wide = false,
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'info' | 'warning';
  wide?: boolean;
}) {
  const palette =
    tone === 'success'
      ? { background: colors.successSoft, value: colors.success }
      : tone === 'info'
        ? { background: colors.infoSoft, value: colors.info }
        : tone === 'warning'
          ? { background: colors.warningSoft, value: colors.warning }
          : { background: colors.surfaceMuted, value: colors.text };

  return (
    <View style={[styles.financialMetricCard, wide && styles.financialMetricCardWide, { backgroundColor: palette.background }]}>
      <Text style={[styles.financialMetricValue, { color: palette.value }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.financialMetricLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountBlock: {
    minWidth: 122,
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 3,
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  amountValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
  },
  amountSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  identitySide: {
    flex: 1,
    minWidth: 0,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'right',
  },
  metaLine: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  capitalBarContainer: { position: 'relative' },
  capitalMarkerOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  capitalMarker: {
    width: 3, height: 21, borderRadius: 2,
    backgroundColor: '#b77809', borderWidth: 0.5, borderColor: '#fff',
  },
  capitalMarkerReached: { backgroundColor: '#065f46' },
  capitalLegendRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', gap: 6,
  },
  capitalLegendHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5, flexShrink: 1 },
  capitalLegendDot: { width: 8, height: 14, borderRadius: 2, backgroundColor: '#b77809' },
  capitalDotReached: { backgroundColor: '#065f46' },
  capitalLegendText: { fontSize: 11, color: '#8a5808', fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  capitalRecoveryStatus: { fontSize: 11, color: colors.textMuted, fontWeight: '700', textAlign: 'left', flexShrink: 1 },
  capitalRecoveryDone: { color: colors.success },
  paymentProgress: { gap: 8 },
  breakdownTitle: { color: colors.textMuted, textAlign: 'right', fontSize: 11, fontWeight: '700' },
  progressTrack: {
    height: 11, width: '100%', borderRadius: 999,
    backgroundColor: colors.surfaceMuted, overflow: 'hidden',
    flexDirection: 'row-reverse',
  },
  progressPart: { height: '100%' },
  statsRow: { flexDirection: 'row-reverse', gap: 6 },
  financialMetricsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  financialMetricCard: {
    width: '48.5%',
    flexGrow: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 11,
    gap: 4,
  },
  financialMetricCardWide: {
    width: '100%',
  },
  financialMetricValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  financialMetricLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  statCard: {
    flex: 1, minWidth: 0, borderRadius: 13,
    paddingHorizontal: 8, paddingVertical: 9, gap: 5,
  },
  statHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: 5 },
  statDot: { height: 8, width: 8, borderRadius: 4 },
  statValue: { fontSize: 12, fontWeight: '900', textAlign: 'right' },
  statLabel: { fontSize: 11, fontWeight: '800', color: colors.textMuted, textAlign: 'right' },
  statFootnote: { color: colors.textMuted, fontSize: 10, textAlign: 'right' },
  noticeWrap: {
    gap: 6,
  },
  noticePill: {
    minHeight: 36,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  noticeCourt: {
    backgroundColor: colors.courtSoft,
  },
  noticeNeutral: {
    backgroundColor: colors.neutralSoft,
  },
  noticeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  noticeTextCourt: {
    color: colors.court,
  },
  noticeTextNeutral: {
    color: colors.neutral,
  },
  noticeTextDanger: {
    color: colors.danger,
  },
  quickActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
});
