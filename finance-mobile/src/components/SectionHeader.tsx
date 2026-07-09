import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface SectionHeaderProps {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onActionPress?: () => void;
}

export function SectionHeader({ title, subtitle, actionLabel, onActionPress }: SectionHeaderProps) {
  return (
    <View style={styles.wrapper}>
      <View style={styles.topRow}>
        {actionLabel && onActionPress ? (
          <Pressable onPress={onActionPress} style={({ pressed }) => [styles.actionChip, pressed ? styles.actionChipPressed : null]}>
            <Text style={styles.actionText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 4,
    marginBottom: 8,
  },
  topRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    flex: 1,
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 20,
  },
  actionChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionChipPressed: {
    opacity: 0.8,
  },
  actionText: {
    color: colors.text,
    fontSize: 11,
    fontWeight: '700',
  },
});
