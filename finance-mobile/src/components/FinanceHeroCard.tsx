import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { InfoPill } from '@/components/InfoPill';
import { colors } from '@/utils/theme';

interface FinanceHeroCardProps {
  totalClients: number;
  activeCount: number;
  lateCount: number;
  courtCount: number;
  monthlyIncomeText: string;
  monthlyProfitText: string;
  remainingText: string;
  onAddClient: () => void;
  onOpenClients: () => void;
  onOpenCollections: () => void;
}

export function FinanceHeroCard({
  totalClients,
  activeCount,
  lateCount,
  courtCount,
  monthlyIncomeText,
  monthlyProfitText,
  remainingText,
  onAddClient,
  onOpenClients,
  onOpenCollections,
}: FinanceHeroCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <View style={styles.todayPill}>
          <Ionicons name="sparkles-outline" size={14} color="#fff" />
          <Text style={styles.todayText}>لوحة اليوم</Text>
        </View>

        <View style={styles.headerTextWrap}>
          <Text style={styles.title}>إدارة التمويل</Text>
          <Text style={styles.subtitle}>متابعة أقصر، أسرع، وأوضح للحالات اليومية.</Text>
        </View>
      </View>

      <View style={styles.mainMetricCard}>
        <Text style={styles.mainMetricValue}>{monthlyIncomeText}</Text>
        <Text style={styles.mainMetricLabel}>التحصيل الشهري المتوقع</Text>

        <View style={styles.inlineStatsRow}>
          <View style={styles.inlineStatBox}>
            <Text style={styles.inlineStatValue}>{monthlyProfitText}</Text>
            <Text style={styles.inlineStatLabel}>ربح شهري</Text>
          </View>
          <View style={styles.inlineDivider} />
          <View style={styles.inlineStatBox}>
            <Text style={styles.inlineStatValue}>{remainingText}</Text>
            <Text style={styles.inlineStatLabel}>متبقٍ بالمحفظة</Text>
          </View>
        </View>
      </View>

      <View style={styles.pillsGrid}>
        <InfoPill
          label="إجمالي العملاء"
          value={String(totalClients)}
          tone="default"
          compact
          icon={<Ionicons name="people-outline" size={15} color={colors.text} />}
          style={styles.pillItem}
        />
        <InfoPill
          label="نشطون"
          value={String(activeCount)}
          tone="success"
          compact
          icon={<Ionicons name="checkmark-circle-outline" size={15} color={colors.success} />}
          style={styles.pillItem}
        />
        <InfoPill
          label="متأخرون"
          value={String(lateCount)}
          tone="danger"
          compact
          icon={<Ionicons name="alert-circle-outline" size={15} color={colors.danger} />}
          style={styles.pillItem}
        />
        <InfoPill
          label="قضايا"
          value={String(courtCount)}
          tone="info"
          compact
          icon={<Ionicons name="shield-checkmark-outline" size={15} color={colors.info} />}
          style={styles.pillItem}
        />
      </View>

      <View style={styles.actionsRow}>
        <TouchableOpacity style={[styles.actionButton, styles.primaryAction]} onPress={onAddClient} activeOpacity={0.92}>
          <Ionicons name="add" size={18} color="#fff" />
          <Text style={styles.primaryActionText}>عميل جديد</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryAction} onPress={onOpenClients} activeOpacity={0.92}>
          <Ionicons name="people-outline" size={17} color={colors.text} />
          <Text style={styles.secondaryActionText}>العملاء</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryAction} onPress={onOpenCollections} activeOpacity={0.92}>
          <Ionicons name="cash-outline" size={17} color={colors.text} />
          <Text style={styles.secondaryActionText}>التحصيل</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    gap: 14,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.03,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  headerTextWrap: {
    flex: 1,
    gap: 4,
  },
  todayPill: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  todayText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },
  title: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 22,
    fontWeight: '900',
  },
  subtitle: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
  },
  mainMetricCard: {
    borderRadius: 20,
    padding: 16,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 6,
  },
  mainMetricValue: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 26,
    fontWeight: '900',
  },
  mainMetricLabel: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  inlineStatsRow: {
    marginTop: 6,
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
    gap: 10,
  },
  inlineStatBox: {
    flex: 1,
    gap: 3,
  },
  inlineDivider: {
    width: 1,
    backgroundColor: colors.border,
  },
  inlineStatValue: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  inlineStatLabel: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 11,
  },
  pillsGrid: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  pillItem: {
    minWidth: '47%',
    flex: 1,
  },
  actionsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  actionButton: {
    minHeight: 44,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  primaryAction: {
    flex: 1.15,
    backgroundColor: colors.primary,
    paddingHorizontal: 12,
  },
  secondaryAction: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 6,
  },
  primaryActionText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  secondaryActionText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
});
