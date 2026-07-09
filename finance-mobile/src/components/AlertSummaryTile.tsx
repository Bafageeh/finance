import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertTone } from '@/components/AlertItemCard';
import { colors } from '@/utils/theme';

interface AlertSummaryTileProps {
  tone: AlertTone;
  title: string;
  count: number;
  amountText?: string;
  helperText?: string;
  onPress?: () => void;
}

const palette = {
  court: {
    background: colors.courtSoft,
    border: '#cbc7f5',
    accent: colors.court,
    text: '#3c3489',
    icon: 'shield-checkmark-outline' as const,
  },
  late: {
    background: colors.dangerSoft,
    border: '#f3b5b5',
    accent: colors.danger,
    text: '#791f1f',
    icon: 'alert-circle-outline' as const,
  },
  warn: {
    background: colors.warningSoft,
    border: '#f4d29d',
    accent: colors.warning,
    text: '#633806',
    icon: 'time-outline' as const,
  },
  stuck: {
    background: colors.neutralSoft,
    border: '#dbd7ca',
    accent: colors.neutral,
    text: '#444441',
    icon: 'pause-circle-outline' as const,
  },
};

export function AlertSummaryTile({ tone, title, count, amountText, helperText, onPress }: AlertSummaryTileProps) {
  const toneStyles = palette[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: toneStyles.background,
          borderColor: toneStyles.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={[styles.iconWrap, { backgroundColor: '#fff' }]}>
          <Ionicons name={toneStyles.icon} size={17} color={toneStyles.accent} />
        </View>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: toneStyles.text }]} numberOfLines={1}>{title}</Text>
          {helperText ? <Text style={styles.helper} numberOfLines={2}>{helperText}</Text> : null}
        </View>
      </View>

      <View style={styles.footerRow}>
        {amountText ? <Text style={[styles.amount, { color: toneStyles.text }]} numberOfLines={1}>{amountText}</Text> : <View />}
        <Text style={[styles.count, { color: toneStyles.accent }]}>{count}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 13,
    borderWidth: 1,
    gap: 12,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: 10,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  title: {
    textAlign: 'right',
    fontSize: 13,
    fontWeight: '900',
  },
  helper: {
    textAlign: 'right',
    fontSize: 11,
    lineHeight: 18,
    color: colors.textMuted,
  },
  footerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  amount: {
    flex: 1,
    textAlign: 'right',
    fontSize: 12,
    fontWeight: '800',
  },
  count: {
    fontSize: 24,
    fontWeight: '900',
  },
});
