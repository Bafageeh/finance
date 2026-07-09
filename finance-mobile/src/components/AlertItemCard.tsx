import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

export type AlertTone = 'court' | 'late' | 'warn' | 'stuck';

interface AlertItemCardProps {
  tone: AlertTone;
  title: string;
  description: string;
  amountText?: string;
  onPress?: () => void;
}

const palette = {
  court: { background: colors.courtSoft, border: '#cbc7f5', accent: colors.court, title: '#3c3489', icon: 'shield-checkmark-outline' as const },
  late: { background: colors.dangerSoft, border: '#efbcbc', accent: colors.danger, title: '#791f1f', icon: 'alert-circle-outline' as const },
  warn: { background: colors.warningSoft, border: '#f0d09c', accent: colors.warning, title: '#633806', icon: 'time-outline' as const },
  stuck: { background: colors.neutralSoft, border: '#dfdbd1', accent: colors.neutral, title: '#444441', icon: 'pause-circle-outline' as const },
};

export function AlertItemCard({ tone, title, description, amountText, onPress }: AlertItemCardProps) {
  const toneStyles = palette[tone];

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: toneStyles.background,
          borderColor: toneStyles.border,
          opacity: pressed ? 0.88 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.leadingWrap}>
          <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          {amountText ? <Text style={[styles.amount, { color: toneStyles.title }]}>{amountText}</Text> : null}
        </View>

        <View style={styles.titleWrap}>
          <Text style={[styles.title, { color: toneStyles.title }]} numberOfLines={1}>{title}</Text>
          <Text style={styles.description} numberOfLines={2}>{description}</Text>
        </View>

        <View style={[styles.iconWrap, { backgroundColor: '#fff' }]}>
          <Ionicons name={toneStyles.icon} size={15} color={toneStyles.accent} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 7,
    borderWidth: 1,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleWrap: {
    flex: 1,
    gap: 3,
  },
  title: {
    textAlign: 'right',
    fontSize: 14,
    fontWeight: '900',
  },
  description: {
    textAlign: 'right',
    fontSize: 12,
    lineHeight: 18,
    color: colors.textMuted,
  },
  leadingWrap: {
    minWidth: 54,
    alignItems: 'flex-start',
    gap: 4,
  },
  amount: {
    fontSize: 12,
    fontWeight: '800',
  },
});
