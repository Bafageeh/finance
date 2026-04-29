import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface ProgressOverviewCardProps {
  paidCount: number;
  remainingCount: number;
  totalCount: number;
  progressPercent: number;
  progressColor?: string;
}

export function ProgressOverviewCard({
  paidCount,
  remainingCount,
  totalCount,
  progressPercent,
  progressColor = colors.success,
}: ProgressOverviewCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.grid}>
        <View style={styles.box}>
          <Text style={[styles.boxValue, { color: colors.success }]}>{paidCount}</Text>
          <Text style={styles.boxLabel}>شهر مدفوع</Text>
        </View>
        <View style={styles.box}>
          <Text style={[styles.boxValue, { color: colors.danger }]}>{remainingCount}</Text>
          <Text style={styles.boxLabel}>شهر متبقٍ</Text>
        </View>
        <View style={styles.box}>
          <Text style={styles.boxValue}>{totalCount}</Text>
          <Text style={styles.boxLabel}>إجمالي الأشهر</Text>
        </View>
      </View>

      <View style={styles.progressHeader}>
        <Text style={styles.progressValue}>{progressPercent}%</Text>
        <Text style={styles.progressLabel}>التقدم في السداد</Text>
      </View>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: progressColor }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
  },
  grid: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  box: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 10,
    alignItems: 'center',
    gap: 2,
  },
  boxValue: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
  },
  boxLabel: {
    fontSize: 11,
    color: colors.textMuted,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  progressLabel: {
    fontSize: 12,
    color: colors.textMuted,
  },
  progressValue: {
    fontSize: 13,
    fontWeight: '800',
    color: colors.text,
  },
  progressTrack: {
    height: 8,
    backgroundColor: colors.border,
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
