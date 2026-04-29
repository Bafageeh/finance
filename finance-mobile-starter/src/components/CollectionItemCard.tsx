import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CollectionEntry } from '@/utils/alerts';
import { formatCurrency, formatDate } from '@/utils/format';
import { colors } from '@/utils/theme';

interface CollectionItemCardProps {
  entry: CollectionEntry;
  onPress?: () => void;
}

const palette = {
  late: {
    background: colors.dangerSoft,
    border: '#efaaaa',
    badgeBackground: '#fff',
    badgeText: colors.danger,
    amount: '#791f1f',
  },
  upcoming: {
    background: colors.infoSoft,
    border: '#bdd7f1',
    badgeBackground: '#fff',
    badgeText: colors.info,
    amount: '#0c447c',
  },
};

export function CollectionItemCard({ entry, onPress }: CollectionItemCardProps) {
  const toneStyles = palette[entry.state];
  const dueText = entry.state === 'late'
    ? `متأخر منذ ${Math.abs(entry.daysUntil ?? 0)} يوم`
    : `يستحق خلال ${entry.daysUntil ?? 0} يوم`;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: toneStyles.background,
          borderColor: toneStyles.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: toneStyles.badgeBackground }]}>
            <Text style={[styles.badgeText, { color: toneStyles.badgeText }]}>{entry.state === 'late' ? 'متأخر' : 'قريب'}</Text>
          </View>
          <Text style={[styles.amount, { color: toneStyles.amount }]}>{formatCurrency(entry.item.amount)}</Text>
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.clientName}>{entry.client.name}</Text>
          <Text style={styles.metaText}>{entry.client.asset || 'بدون أصل محدد'}</Text>
        </View>
      </View>

      <View style={styles.detailsGrid}>
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>الاستحقاق</Text>
          <Text style={styles.detailValue}>{formatDate(entry.item.due_date)}</Text>
        </View>
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>رقم القسط</Text>
          <Text style={styles.detailValue}>{entry.item.month}</Text>
        </View>
      </View>

      <Text style={styles.footerText}>{dueText}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 14,
    borderWidth: 1,
    gap: 12,
    marginBottom: 10,
  },
  headerRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
  },
  titleWrap: {
    flex: 1,
    gap: 4,
  },
  clientName: {
    fontSize: 15,
    fontWeight: '800',
    color: colors.text,
    textAlign: 'right',
  },
  metaText: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
  },
  badgesRow: {
    alignItems: 'flex-start',
    gap: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  amount: {
    fontSize: 14,
    fontWeight: '900',
  },
  detailsGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  detailBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.65)',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 4,
  },
  detailLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  detailValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'right',
  },
  footerText: {
    fontSize: 12,
    lineHeight: 20,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
