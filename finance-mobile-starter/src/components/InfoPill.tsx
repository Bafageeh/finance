import { ReactNode } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '@/utils/theme';

interface InfoPillProps {
  label: string;
  value?: string;
  tone?: 'default' | 'success' | 'warning' | 'danger' | 'info';
  icon?: ReactNode;
  compact?: boolean;
  style?: ViewStyle;
}

const toneMap = {
  default: { bg: colors.surfaceMuted, border: colors.border, text: colors.text },
  success: { bg: colors.successSoft, border: '#d8ebdf', text: colors.success },
  warning: { bg: colors.warningSoft, border: '#f0ddbf', text: colors.warning },
  danger: { bg: colors.dangerSoft, border: '#f1d4d4', text: colors.danger },
  info: { bg: colors.infoSoft, border: '#d7e6f5', text: colors.info },
};

export function InfoPill({ label, value, tone = 'default', icon, compact = false, style }: InfoPillProps) {
  const toneStyle = toneMap[tone];

  return (
    <View
      style={[
        styles.pill,
        compact && styles.compact,
        { backgroundColor: toneStyle.bg, borderColor: toneStyle.border },
        style,
      ]}
    >
      {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
      <View style={styles.textWrap}>
        {value ? <Text style={[styles.value, { color: toneStyle.text }]}>{value}</Text> : null}
        <Text style={[styles.label, { color: value ? colors.textMuted : toneStyle.text }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    minHeight: 44,
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  compact: {
    minHeight: 38,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  iconWrap: {
    width: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textWrap: {
    gap: 2,
  },
  value: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
});
