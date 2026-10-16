import { useMemo } from 'react';
import { DimensionValue, StyleSheet, Text, View } from 'react-native';
import type { Client } from '@/types/api';
import { buildPortfolioCollectionProgress } from '@/utils/portfolio-collection-progress';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

interface PortfolioCollectionProgressProps {
  clients: Client[];
}

export function PortfolioCollectionProgress({ clients }: PortfolioCollectionProgressProps) {
  const totals = useMemo(() => buildPortfolioCollectionProgress(clients), [clients]);
  const marker = totals.marker;

  return (
    <View style={styles.container}>
      <View style={styles.heading}>
        <Text style={styles.title}>شريط التحصيل واسترداد رأس المال</Text>
        <Text style={styles.subtitle}>العقود غير المنتهية فقط، دون خصم أرباح علي</Text>
      </View>

      <View style={styles.remainingRow}>
        <Text style={styles.remainingLabel}>المتبقي كاملًا على العقود غير المنتهية</Text>
        <Text style={styles.remainingValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
          {formatCurrency(totals.totalOutstanding)}
        </Text>
      </View>

      <View
        style={styles.barContainer}
        accessibilityRole="text"
        accessibilityLabel={
          'المحصل ' + formatCurrency(totals.totalCollected)
          + '، المتأخر ' + formatCurrency(totals.overdueOutstanding)
          + '، المتبقي غير المتأخر ' + formatCurrency(totals.upcomingOutstanding)
          + '، حد استرداد رأس المال ' + formatCurrency(totals.originalCapitalToRecover)
        }
      >
        <View style={styles.barTrack}>
          {totals.paidPercent > 0 ? (
            <View style={[styles.barPart, { width: (String(totals.paidPercent) + '%') as DimensionValue, backgroundColor: colors.success }]} />
          ) : null}
          {totals.overduePercent > 0 ? (
            <View style={[styles.barPart, { width: (String(totals.overduePercent) + '%') as DimensionValue, backgroundColor: colors.danger }]} />
          ) : null}
          {totals.upcomingPercent > 0 ? (
            <View style={[styles.barPart, { width: (String(totals.upcomingPercent) + '%') as DimensionValue, backgroundColor: '#b5b8bc' }]} />
          ) : null}
        </View>
        {marker.visible && !marker.outOfRange ? (
          <View pointerEvents="none" style={styles.markerLayer}>
            <View style={{ width: (String(marker.markerPercent) + '%') as DimensionValue }} />
            <View style={styles.capitalMarker} />
          </View>
        ) : null}
      </View>

      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={styles.legendHeading}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <Text style={styles.legendLabel}>المدفوع</Text>
          </View>
          <Text style={styles.legendAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
            {formatCurrency(totals.totalCollected)}
          </Text>
          <Text style={styles.legendPercent}>{totals.paidRoundedPercent}%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendHeading}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <Text style={styles.legendLabel}>المتأخر</Text>
          </View>
          <Text style={styles.legendAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
            {formatCurrency(totals.overdueOutstanding)}
          </Text>
          <Text style={styles.legendPercent}>{totals.overdueRoundedPercent}%</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={styles.legendHeading}>
            <View style={[styles.dot, { backgroundColor: '#9ca0a6' }]} />
            <Text style={styles.legendLabel}>المتبقي غير المتأخر</Text>
          </View>
          <Text style={styles.legendAmount} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.68}>
            {formatCurrency(totals.upcomingOutstanding)}
          </Text>
          <Text style={styles.legendPercent}>{totals.upcomingRoundedPercent}%</Text>
        </View>
      </View>

      {marker.visible ? (
        <View style={styles.capitalRow}>
          <View style={styles.capitalHeading}>
            <View style={styles.capitalLineIcon} />
            <View style={styles.capitalDescription}>
              <Text style={styles.capitalTitle}>
                {marker.outOfRange ? 'حد رأس المال يتجاوز نطاق السندات' : 'نقطة استرداد رأس المال · ' + marker.thresholdPercent + '%'}
              </Text>
              <Text style={styles.capitalAmount}>{formatCurrency(totals.originalCapitalToRecover)}</Text>
            </View>
          </View>
          <Text style={[styles.capitalStatus, marker.reached && styles.capitalReached]}
            numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {marker.reached ? 'تم استرداده' : 'باقٍ ' + formatCurrency(marker.remainingToRecover)}
          </Text>
        </View>
      ) : null}

      <Text style={styles.footnote}>
        طول الشريط يمثل المدفوع + كامل المتبقي على العقود غير المنتهية. الأقساط المتأخرة جزء من المتبقي وليست إضافة عليه.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 10, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 13 },
  heading: { gap: 4 },
  title: { color: colors.text, fontSize: 14, fontWeight: '900', textAlign: 'right' },
  subtitle: { color: colors.textMuted, fontSize: 11, lineHeight: 18, textAlign: 'right' },
  remainingRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: 9 },
  remainingLabel: { fontSize: 11, color: colors.textMuted, textAlign: 'right', flex: 1 },
  remainingValue: { fontSize: 16, fontWeight: '900', color: colors.text, maxWidth: '54%', textAlign: 'left' },
  barContainer: { position: 'relative', paddingVertical: 6, marginVertical: 2 },
  barTrack: { height: 12, backgroundColor: colors.surfaceMuted, borderRadius: 99, overflow: 'hidden', flexDirection: 'row-reverse' },
  barPart: { height: '100%' },
  markerLayer: {
    ...StyleSheet.absoluteFill,
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  capitalMarker: { width: 3, height: 24, borderRadius: 2, backgroundColor: '#b77809', borderWidth: 0.5, borderColor: '#fff' },
  legendRow: { flexDirection: 'row-reverse', gap: 6 },
  legendItem: { flex: 1, minWidth: 0, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 7, paddingVertical: 8, gap: 4 },
  legendHeading: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  legendLabel: { fontSize: 10, fontWeight: '700', color: colors.textMuted, textAlign: 'right', flexShrink: 1 },
  legendAmount: { color: colors.text, fontWeight: '900', fontSize: 11, textAlign: 'right' },
  legendPercent: { color: colors.textMuted, fontSize: 10, textAlign: 'right', fontWeight: '700' },
  capitalRow: {
    borderRadius: 11,
    backgroundColor: '#f8f1dd',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10, paddingVertical: 9, gap: 8,
  },
  capitalHeading: { flexDirection: 'row-reverse', alignItems: 'center', flex: 1, minWidth: 0, gap: 7 },
  capitalLineIcon: { width: 3, height: 25, borderRadius: 2, backgroundColor: '#b77809' },
  capitalDescription: { flex: 1, gap: 3 },
  capitalTitle: { color: '#77500d', fontSize: 10, fontWeight: '900', textAlign: 'right' },
  capitalAmount: { color: '#77500d', fontSize: 12, fontWeight: '800', textAlign: 'right' },
  capitalStatus: { maxWidth: '42%', color: '#77500d', fontSize: 11, fontWeight: '900', textAlign: 'left' },
  capitalReached: { color: '#11724d' },
  footnote: { color: colors.textMuted, fontSize: 10, lineHeight: 17, textAlign: 'right' },
});
