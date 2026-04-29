import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface MetricCardProps {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

export function MetricCard({ label, value, tone = 'default' }: MetricCardProps) {
  const palette = toneStyles[tone];

  return (
    <View style={[styles.card, { backgroundColor: palette.background }]}> 
      <Text style={[styles.value, { color: palette.text }]}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const toneStyles = {
  default: { background: colors.surfaceMuted, text: colors.text },
  success: { background: colors.successSoft, text: colors.success },
  warning: { background: colors.warningSoft, text: colors.warning },
  danger: { background: colors.dangerSoft, text: colors.danger },
  info: { background: colors.infoSoft, text: colors.info },
};

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 16,
    padding: 14,
    gap: 8,
  },
  value: {
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  label: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
