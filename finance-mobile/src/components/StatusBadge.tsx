import { StyleSheet, Text, View } from 'react-native';
import { ClientStatus } from '@/types/api';
import { statusLabel } from '@/utils/format';
import { colors } from '@/utils/theme';

interface StatusBadgeProps {
  status: ClientStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const palette = badgePalette[status];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background }]}>
      <Text style={[styles.label, { color: palette.text }]}>{statusLabel(status)}</Text>
    </View>
  );
}

const badgePalette = {
  active: { background: colors.successSoft, text: '#27500a' },
  stuck: { background: colors.neutralSoft, text: colors.neutral },
  done: { background: colors.infoSoft, text: '#0c447c' },
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  label: {
    fontSize: 12,
    fontWeight: '700',
  },
});
