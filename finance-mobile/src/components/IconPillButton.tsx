import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { colors } from '@/utils/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];
type Tone = 'default' | 'primary' | 'danger' | 'success';

interface IconPillButtonProps {
  icon: IconName;
  label: string;
  onPress?: () => void;
  tone?: Tone;
  disabled?: boolean;
}

const toneStyles = {
  default: {
    backgroundColor: colors.surfaceMuted,
    borderColor: colors.border,
    text: colors.text,
  },
  primary: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.border,
    text: colors.text,
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#f1b1b1',
    text: colors.danger,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: '#b5e6d6',
    text: '#0f6e56',
  },
} satisfies Record<Tone, { backgroundColor: string; borderColor: string; text: string }>;

export function IconPillButton({ icon, label, onPress, tone = 'default', disabled = false }: IconPillButtonProps) {
  const currentTone = toneStyles[tone];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[
        styles.button,
        {
          backgroundColor: currentTone.backgroundColor,
          borderColor: currentTone.borderColor,
          opacity: disabled ? 0.5 : 1,
        },
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={16} color={currentTone.text} />
      <Text style={[styles.label, { color: currentTone.text }]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
  },
});
