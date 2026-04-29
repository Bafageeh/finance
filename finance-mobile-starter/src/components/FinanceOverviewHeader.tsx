import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { colors } from '@/utils/theme';

interface FinanceOverviewHeaderProps {
  title: string;
  subtitle: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimaryPress?: () => void;
  onSecondaryPress?: () => void;
}

export function FinanceOverviewHeader({
  title,
  subtitle,
  primaryLabel,
  secondaryLabel,
  onPrimaryPress,
  onSecondaryPress,
}: FinanceOverviewHeaderProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.kicker}>إدارة التمويل</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.subtitle}>{subtitle}</Text>
      <View style={styles.actions}>
        {primaryLabel && onPrimaryPress ? (
          <TouchableOpacity style={styles.primaryButton} onPress={onPrimaryPress}>
            <Ionicons name="add" size={18} color="#fff" />
            <Text style={styles.primaryText}>{primaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
        {secondaryLabel && onSecondaryPress ? (
          <TouchableOpacity style={styles.secondaryButton} onPress={onSecondaryPress}>
            <Ionicons name="people-outline" size={18} color={colors.text} />
            <Text style={styles.secondaryText}>{secondaryLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 8,
    marginBottom: 12,
  },
  kicker: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  subtitle: {
    fontSize: 13,
    color: colors.textMuted,
    textAlign: 'right',
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row-reverse',
    gap: 8,
    marginTop: 4,
    flexWrap: 'wrap',
  },
  primaryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.primary,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  primaryText: {
    color: '#fff',
    fontWeight: '700',
  },
  secondaryButton: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
  },
  secondaryText: {
    color: colors.text,
    fontWeight: '700',
  },
});
