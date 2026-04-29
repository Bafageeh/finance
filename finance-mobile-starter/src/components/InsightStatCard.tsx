import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface InsightStatCardProps {
  title: string;
  value: string;
  helper?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'court';
  onPress?: () => void;
}

const palette = {
  default: { background: colors.surfaceMuted, value: colors.text, border: colors.border },
  success: { background: colors.successSoft, value: colors.success, border: '#bfe4d8' },
  warning: { background: colors.warningSoft, value: colors.warning, border: '#f0d4a1' },
  danger: { background: colors.dangerSoft, value: colors.danger, border: '#efc2c2' },
  info: { background: colors.infoSoft, value: colors.info, border: '#c3dbf5' },
  court: { background: colors.courtSoft, value: colors.court, border: '#d4d0ff' },
} as const;

export function InsightStatCard({ title, value, helper, tone = 'default', onPress }: InsightStatCardProps) {
  const current = palette[tone];

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: current.background,
          borderColor: current.border,
          opacity: pressed ? 0.86 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <Text style={[styles.value, { color: current.value }]}>{value}</Text>
        <Text style={styles.title}>{title}</Text>
      </View>
      {helper ? <Text style={styles.helper}>{helper}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  value: {
    fontSize: 17,
    fontWeight: '800',
  },
  helper: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
    lineHeight: 20,
  },
});
