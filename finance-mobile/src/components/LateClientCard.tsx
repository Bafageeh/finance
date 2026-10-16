import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AlertEntry } from '@/utils/alerts';
import { formatCurrency, formatDateDDMMYYYY } from '@/utils/format';
import { colors } from '@/utils/theme';

interface LateClientCardProps {
  entry: AlertEntry;
  overdueCount: number;
  firstDueDate?: string | null;
  onPress: () => void;
}

export function LateClientCard({ entry, overdueCount, firstDueDate, onPress }: LateClientCardProps) {
  const client = entry.client;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${client.name}، ${overdueCount} أقساط متأخرة، ${formatCurrency(entry.amount ?? 0)}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.mainRow}>
        <View style={styles.identity}>
          <Text style={styles.name} numberOfLines={2}>{client.name}</Text>
          {client.id_number ? (
            <Text style={styles.identityText} numberOfLines={1}>هوية: {client.id_number}</Text>
          ) : null}
        </View>

        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>المبلغ المتأخر</Text>
          <Text
            style={styles.amountValue}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.72}
          >{formatCurrency(entry.amount ?? 0)}</Text>
        </View>

        <Ionicons name="chevron-back" size={17} color={colors.textMuted} />
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.overdueBadge}>
          <Ionicons name="alert-circle-outline" size={13} color={colors.danger} />
          <Text style={styles.badgeText} numberOfLines={1}>
            {overdueCount} {overdueCount === 1 ? 'قسط متأخر' : 'أقساط متأخرة'}
          </Text>
        </View>
        <Text style={styles.firstDue} numberOfLines={1}>
          أول استحقاق: {formatDateDDMMYYYY(firstDueDate)}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRightWidth: 3,
    borderRightColor: colors.danger,
    borderRadius: 15,
    paddingHorizontal: 11,
    paddingVertical: 9,
    marginBottom: 6,
    gap: 7,
  },
  pressed: { backgroundColor: '#fff9f9' },
  mainRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 8,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  name: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '900',
    lineHeight: 19,
  },
  identityText: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 10.5,
  },
  amountBlock: {
    maxWidth: '43%',
    minWidth: 102,
    alignItems: 'flex-end',
    gap: 3,
  },
  amountLabel: {
    textAlign: 'left',
    color: colors.textMuted,
    fontSize: 10,
  },
  amountValue: {
    textAlign: 'left',
    fontSize: 16,
    fontWeight: '900',
    color: colors.danger,
  },
  detailsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 6,
  },
  overdueBadge: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.dangerSoft,
    borderRadius: 15,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 10.5,
    fontWeight: '800',
    color: colors.danger,
  },
  firstDue: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 10.5,
    flexShrink: 1,
  },
});
