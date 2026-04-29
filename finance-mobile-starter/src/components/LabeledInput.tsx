import { StyleSheet, Text, TextInput, TextInputProps, View } from 'react-native';
import { colors } from '@/utils/theme';

interface LabeledInputProps extends TextInputProps {
  label: string;
  hint?: string;
}

export function LabeledInput({ label, hint, style, ...props }: LabeledInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor="#998d7b"
        style={[styles.input, style]}
        textAlign="right"
        {...props}
      />
      {hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  input: {
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    paddingHorizontal: 14,
    color: colors.text,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
