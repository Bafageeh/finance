import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/utils/theme';

interface KeyValueRowProps {
  label: string;
  value: string;
}

export function KeyValueRow({ label, value }: KeyValueRowProps) {
  return (
    <View style={styles.row}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    gap: 12,
  },
  label: {
    color: colors.textMuted,
    fontSize: 13,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    fontSize: 14,
    color: colors.text,
    fontWeight: '600',
  },
});
