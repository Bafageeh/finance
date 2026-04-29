import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CollectionEntry } from '@/utils/alerts';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

interface CollectionPreviewRowProps {
  entry: CollectionEntry;
  onPress?: () => void;
}

export function CollectionPreviewRow({ entry, onPress }: CollectionPreviewRowProps) {
  const isLate = entry.state === 'late';

  return (
    <Pressable style={({ pressed }) => [styles.card, pressed && styles.cardPressed]} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={[styles.badge, isLate ? styles.lateBadge : styles.upcomingBadge]}>
          <Text style={[styles.badgeText, isLate ? styles.lateBadgeText : styles.upcomingBadgeText]}>
            {isLate ? 'متأخر' : 'قريب'}
          </Text>
        </View>

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{entry.client.name}</Text>
          <Text style={styles.meta} numberOfLines={1}>
            قسط {entry.item.month} · {formatDate(entry.item.due_date)}
          </Text>
        </View>
      </View>

      <View style={styles.bottomRow}>
        <View style={styles.trailingWrap}>
          <Ionicons name="chevron-back" size={16} color={colors.textMuted} />
          <Text style={styles.amount}>{formatCurrency(entry.item.amount)}</Text>
        </View>
        <Text style={styles.asset} numberOfLines={1}>{entry.client.asset || 'بدون أصل محدد'}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
  },
  cardPressed: {
    opacity: 0.88,
  },
  topRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  titleWrap: {
    flex: 1,
    gap: 2,
  },
  title: {
    textAlign: 'right',
    color: colors.text,
    fontSize: 14,
    fontWeight: '800',
  },
  meta: {
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 11,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  lateBadge: {
    backgroundColor: colors.dangerSoft,
  },
  upcomingBadge: {
    backgroundColor: colors.infoSoft,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  lateBadgeText: {
    color: colors.danger,
  },
  upcomingBadgeText: {
    color: colors.info,
  },
  bottomRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  trailingWrap: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  amount: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '900',
  },
  asset: {
    flex: 1,
    textAlign: 'right',
    color: colors.textMuted,
    fontSize: 12,
  },
});
