import { Ionicons } from '@expo/vector-icons';
import { DimensionValue, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Client } from '@/types/api';
import { getClientAlertInfo, getNextUnpaidScheduleItem, getOverdueScheduleItems } from '@/utils/finance';
import { formatCurrency, formatDate, getClientDisplayStatus } from '@/utils/format';
import { buildPaymentProgress } from '@/utils/payment-progress';
import { buildCapitalRecoveryPosition, getClientCapitalRecoveryTarget } from '@/utils/capital-recovery';
import { colors } from '@/utils/theme';

interface ClientListItemProps {
  client: Client;
  onPress: () => void;
}

function getScheduleTime(value?: string | null) {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = Date.parse(String(value).slice(0, 10));
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export function ClientListItem({ client, onPress }: ClientListItemProps) {
  const status = getClientDisplayStatus(client);
  const isDoneClient =
    status === 'done' ||
    Number(client.summary?.progress_percent ?? 0) >= 100 ||
    Number(client.summary?.remaining_amount ?? 0) <= 0.01 ||
    Number(client.summary?.remaining_principal ?? 0) <= 0.01;
  const alertInfo = getClientAlertInfo(client);
  const overdueItems = getOverdueScheduleItems(client);
  const firstOverdueItem = [...overdueItems].sort((a, b) => getScheduleTime(a.due_date) - getScheduleTime(b.due_date))[0];
  const paymentDisplayItem = firstOverdueItem || getNextUnpaidScheduleItem(client) || alertInfo.nextUpcoming;
  const paymentDateLabel = firstOverdueItem ? 'أول دفعة متأخرة' : 'الدفعة القادمة';
  const paymentDisplayDate = paymentDisplayItem?.due_date ? formatDate(paymentDisplayItem.due_date) : 'لا يوجد';
  const remainingPrincipal = Number(client.summary.remaining_principal ?? 0) || 0;
  // Keep this calculation identical to the client details screen.
  const ahmadProfitCapital =
    (Number(client.cost) || 0) +
    (Number(client.bond_cost ?? 74.75) || 0) +
    (Number(client.summary.ali_total) || 0);
  const financingMonths = Number(client.months) || 0;
  const ahmadProfitRate = ahmadProfitCapital > 0 && financingMonths > 0
    ? ((Number(client.summary.ahmad_total) || 0) / ahmadProfitCapital) * 100 * (12 / financingMonths)
    : 0;
  const isLate = overdueItems.length > 0;
  const bondTotal = Number(client.summary.bond_total) > 0
    ? Number(client.summary.bond_total)
    : Math.max(0, Number(client.summary.paid_amount) + Number(client.summary.remaining_amount));
  const progress = buildPaymentProgress(
    bondTotal,
    Number(client.summary.paid_amount),
    alertInfo.overdueAmount,
  );
  const capitalGoal = getClientCapitalRecoveryTarget(client);
  const recovery = buildCapitalRecoveryPosition(bondTotal, progress.paid, capitalGoal);

  const statusLabel = client.has_court
    ? 'قضية'
    : status === 'stuck'
      ? 'متعثر'
      : status === 'done'
        ? 'منتهي'
        : 'نشط';

  const cadenceLabel = client.has_court
    ? 'قضية نشطة'
    : isLate
      ? `${alertInfo.overdueCount || overdueItems.length} متأخر`
      : status === 'done'
        ? 'مكتمل'
        : 'منتظم';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.mainRow}>
        <View style={styles.amountColumn}>
          <Text style={styles.amountLabel}>القسط</Text>
          <Text style={styles.amountValue} numberOfLines={1}>
            {formatCurrency(client.summary.monthly_installment)}
          </Text>
        </View>

        <View style={styles.contentColumn}>
          <View style={styles.identityRow}>
            <View style={styles.nameStack}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {client.name}
                </Text>
                <Ionicons name="chatbubble-ellipses-outline" size={17} color={colors.textMuted} />
                {client.has_court ? <Ionicons name="shield-outline" size={14} color={colors.court} /> : null}
              </View>

              <View style={styles.badgesRow}>
                <Text style={styles.meta} numberOfLines={1}>
                  {client.asset || 'تمويل'} · {client.summary.paid_count}/{client.months} شهر
                </Text>
                <View style={[styles.cadencePill, isLate ? styles.cadenceLate : styles.cadenceRegular]}>
                  <Text style={[styles.cadenceText, isLate ? styles.cadenceLateText : styles.cadenceRegularText]}>
                    {cadenceLabel}
                  </Text>
                </View>
                <View
                  style={[
                    styles.statusPill,
                    client.has_court
                      ? styles.statusCourt
                      : status === 'done'
                        ? styles.statusDone
                        : isLate || status === 'stuck'
                          ? styles.statusLate
                          : styles.statusActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      client.has_court
                        ? styles.statusCourtText
                        : status === 'done'
                          ? styles.statusDoneText
                          : isLate || status === 'stuck'
                            ? styles.statusLateText
                            : styles.statusActiveText,
                    ]}
                  >
                    {statusLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <View style={styles.footerRow}>
            <View style={styles.hintsRow}>
              {client.phone ? (
                <View style={styles.inlineHint}>
                  <Ionicons name="call-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.inlineHintText} numberOfLines={1}>
                    {client.phone}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>

        </View>
      </View>

      {!isDoneClient ? (
        <View style={styles.detailRow}>
          <View style={[styles.detailPill, firstOverdueItem && styles.detailPillLate]}>
            <Text style={[styles.detailLabel, firstOverdueItem && styles.detailLabelLate]} numberOfLines={1}>{paymentDateLabel}</Text>
            <Text style={[styles.detailValue, firstOverdueItem && styles.detailValueLate]} numberOfLines={1}>{paymentDisplayDate}</Text>
          </View>
          <View style={styles.detailPill}>
            <Text style={styles.detailLabel} numberOfLines={1}>رأس المال المتبقي</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{formatCurrency(remainingPrincipal)}</Text>
          </View>
          <View style={styles.detailPill}>
            <Text style={styles.detailLabel} numberOfLines={1}>المتبقي</Text>
            <Text style={styles.detailValue} numberOfLines={1}>{formatCurrency(client.summary.remaining_amount)}</Text>
          </View>
          <View style={[styles.detailPill, styles.profitRatePill]}>
            <Text style={[styles.detailLabel, styles.profitRateLabel]} numberOfLines={1}>نسبة ربح أحمد</Text>
            <Text style={[styles.detailValue, styles.profitRateValue]} numberOfLines={1}>{ahmadProfitRate.toFixed(2)}%</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.progressBreakdown}>
        <View style={styles.capitalBarContainer}>
        <View
          style={styles.progressTrack}
          accessibilityRole="text"
          accessibilityLabel={'المدفوع ' + formatCurrency(progress.paid) + '، المتأخر ' + formatCurrency(progress.overdue) + '، المتبقي غير المتأخر ' + formatCurrency(progress.upcoming)}
        >
          {progress.paidPercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(progress.paidPercent) + '%') as DimensionValue, backgroundColor: colors.success }]} />
          ) : null}
          {progress.overduePercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(progress.overduePercent) + '%') as DimensionValue, backgroundColor: colors.danger }]} />
          ) : null}
          {progress.upcomingPercent > 0 ? (
            <View style={[styles.progressPart, { width: (String(progress.upcomingPercent) + '%') as DimensionValue, backgroundColor: '#b5b8bc' }]} />
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
                {recovery.outOfRange ? 'رأس المال خارج قيمة السند' : 'استرداد رأس المال عند ' + recovery.thresholdPercent + '%'}
              </Text>
            </View>
            <Text style={[styles.capitalRecoveryStatus, recovery.reached && styles.capitalRecoveryDone]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
              {recovery.reached ? 'تم الاسترداد' : 'باقٍ ' + formatCurrency(recovery.remainingToRecover)}
            </Text>
          </View>
        ) : null}
        <View style={styles.progressLegend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendText}>مدفوع {progress.paidRoundedPercent}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.danger }]} />
            <Text style={styles.legendText}>متأخر {progress.overdueRoundedPercent}%</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: '#9ca0a6' }]} />
            <Text style={styles.legendText}>متبقٍ {progress.upcomingRoundedPercent}%</Text>
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  amountColumn: {
    width: 102,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  amountValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  identityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  nameStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-end',
  },
  nameRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  badgesRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  cadencePill: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cadenceRegular: {
    backgroundColor: '#f3f1ec',
  },
  cadenceLate: {
    backgroundColor: colors.dangerSoft,
  },
  cadenceText: {
    fontSize: 10,
    fontWeight: '800',
  },
  cadenceRegularText: {
    color: colors.textMuted,
  },
  cadenceLateText: {
    color: colors.danger,
  },
  meta: {
    flexShrink: 1,
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  detailRow: {
    flexDirection: 'row-reverse',
    gap: 6,
  },
  detailPill: {
    flex: 1,
    minWidth: 0,
    minHeight: 42,
    borderRadius: 14,
    backgroundColor: '#faf9f6',
    borderWidth: 1,
    borderColor: '#eee8de',
    paddingHorizontal: 4,
    paddingVertical: 6,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  detailPillLate: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#f0c7c7',
  },
  profitRatePill: {
    backgroundColor: colors.successSoft,
    borderColor: '#cfe5d8',
  },
  profitRateLabel: {
    color: '#1b6c4f',
  },
  profitRateValue: {
    color: '#1b6c4f',
  },
  detailLabel: {
    color: colors.textMuted,
    fontSize: 8,
    fontWeight: '800',
    textAlign: 'right',
  },
  detailLabelLate: {
    color: colors.danger,
  },
  detailValue: {
    color: colors.text,
    fontSize: 10,
    fontWeight: '900',
    textAlign: 'right',
  },
  detailValueLate: {
    color: colors.danger,
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  statusPill: {
    minWidth: 52,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActive: {
    backgroundColor: colors.successSoft,
  },
  statusLate: {
    backgroundColor: colors.dangerSoft,
  },
  statusCourt: {
    backgroundColor: colors.courtSoft,
  },
  statusDone: {
    backgroundColor: colors.infoSoft,
  },
  statusText: {
    fontSize: 10,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#1b6c4f',
  },
  statusLateText: {
    color: colors.danger,
  },
  statusCourtText: {
    color: colors.court,
  },
  statusDoneText: {
    color: colors.info,
  },
  hintsRow: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  inlineHint: {
    maxWidth: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  inlineHintText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  capitalBarContainer: { position: 'relative' },
  capitalMarkerOverlay: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  capitalMarker: {
    width: 3, height: 17, borderRadius: 2,
    backgroundColor: '#b77809', borderWidth: 0.5, borderColor: '#fff',
  },
  capitalMarkerReached: { backgroundColor: '#065f46' },
  capitalLegendRow: {
    flexDirection: 'row-reverse', justifyContent: 'space-between',
    alignItems: 'center', gap: 6,
  },
  capitalLegendHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4, flexShrink: 1 },
  capitalLegendDot: { width: 7, height: 12, borderRadius: 2, backgroundColor: '#b77809' },
  capitalDotReached: { backgroundColor: '#065f46' },
  capitalLegendText: { fontSize: 9, color: '#8a5808', fontWeight: '800', textAlign: 'right', flexShrink: 1 },
  capitalRecoveryStatus: { fontSize: 9, color: colors.textMuted, fontWeight: '700', textAlign: 'left', flexShrink: 1 },
  capitalRecoveryDone: { color: colors.success },
  progressBreakdown: { gap: 5 },
  progressTrack: {
    flexDirection: 'row-reverse',
    height: 8,
    backgroundColor: '#ebe7df',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressPart: { height: '100%' },
  progressLegend: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 4,
  },
  legendItem: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 3,
  },
  legendDot: { width: 6, height: 6, borderRadius: 3 },
  legendText: { fontSize: 9, color: colors.textMuted, fontWeight: '700' },
});
