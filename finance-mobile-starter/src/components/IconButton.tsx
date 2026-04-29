import { Ionicons } from '@expo/vector-icons';
import { ComponentProps } from 'react';
import { StyleSheet, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '@/utils/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

type Variant = 'default' | 'primary' | 'danger' | 'success' | 'ghost';
type Size = 'sm' | 'md' | 'lg';

interface IconButtonProps {
  icon: IconName;
  onPress?: () => void;
  accessibilityLabel: string;
  variant?: Variant;
  size?: Size;
  disabled?: boolean;
  style?: ViewStyle;
}

const palette = {
  default: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    iconColor: colors.text,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    iconColor: '#fff',
  },
  danger: {
    backgroundColor: colors.dangerSoft,
    borderColor: '#f1b1b1',
    iconColor: colors.danger,
  },
  success: {
    backgroundColor: colors.successSoft,
    borderColor: '#b5e6d6',
    iconColor: '#0f6e56',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
    iconColor: colors.textMuted,
  },
} satisfies Record<Variant, { backgroundColor: string; borderColor: string; iconColor: string }>;

const sizeMap = {
  sm: {
    box: 36,
    icon: 18,
  },
  md: {
    box: 42,
    icon: 20,
  },
  lg: {
    box: 48,
    icon: 22,
  },
} satisfies Record<Size, { box: number; icon: number }>;

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  variant = 'default',
  size = 'md',
  disabled = false,
  style,
}: IconButtonProps) {
  const currentPalette = palette[variant];
  const currentSize = sizeMap[size];

  return (
    <TouchableOpacity
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.button,
        {
          width: currentSize.box,
          height: currentSize.box,
          borderRadius: currentSize.box / 2,
          backgroundColor: currentPalette.backgroundColor,
          borderColor: currentPalette.borderColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      <Ionicons name={icon} size={currentSize.icon} color={currentPalette.iconColor} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
});
