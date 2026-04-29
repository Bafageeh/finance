import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, ViewStyle } from 'react-native';
import { colors } from '@/utils/theme';

interface ActionTileProps {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export function ActionTile({ label, icon, onPress, tone = 'default', disabled = false, style }: ActionTileProps) {
  return (
    <TouchableOpacity
      style={[
        styles.base,
        tone === 'primary' && styles.primary,
        tone === 'danger' && styles.danger,
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.9}
    >
      <Ionicons
        name={icon}
        size={18}
        color={tone === 'default' ? colors.text : '#fff'}
      />
      <Text style={[styles.label, tone !== 'default' && styles.labelOnColor]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 56,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primary: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.55,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'center',
  },
  labelOnColor: {
    color: '#fff',
  },
});
