import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Client } from '@/types/api';
import { formatCurrency } from '@/utils/format';
import { colors } from '@/utils/theme';

interface CaseClientCardProps {
  client: Client;
  overdueCount: number;
  overdueAmount: number;
  onPress?: () => void;
}

export function CaseClientCard({ client, overdueCount, overdueAmount, onPress }: CaseClientCardProps) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed ? styles.cardPressed : null]}>
      <View style={styles.headerRow}>
        <View style={styles.badgesRow}>
          <View style={styles.caseBadge}>
            <Text style={styles.caseBadgeText}>قضية</Text>
          </View>
          {client.status === 'stuck' ? (
            <View style={styles.stuckBadge}>
              <Text style={styles.stuckBadgeText}>متعثر</Text>
            </View>
          ) : null}
        </View>
        <View style={styles.titleWrap}>
          <Text style={styles.name}>{client.name}</Text>
          <Text style={styles.meta}>{client.id_number || 'بدون هوية'}{client.phone ? ` · ${client.phone}` : ''}</Text>
        </View>
      </View>

      <View style={styles.row}>
        <Text style={styles.value}>{formatCurrency(client.summary.remaining_amount)}</Text>
        <Text style={styles.label}>المتبقي بالعقد</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.value}>{overdueCount ? `${overdueCount} قسط · ${formatCurrency(overdueAmount)}` : 'لا يوجد تأخير حالي'}</Text>
        <Text style={styles.label}>التأخير</Text>
      </View>

      <View style={styles.row}>
        <Text style={styles.note}>{client.court_note?.trim() || 'لا توجد ملاحظة قضية حتى الآن.'}</Text>
        <Text style={styles.label}>الملاحظة</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 12,
    gap: 12,
  },
  cardPressed: {
    opacity: 0.85,
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
  name: {
    textAlign: 'right',
    fontSize: 16,
    fontWeight: '800',
    color: colors.text,
  },
  meta: {
    textAlign: 'right',
    fontSize: 12,
    color: colors.textMuted,
  },
  badgesRow: {
    flexDirection: 'row-reverse',
    gap: 6,
    alignItems: 'center',
  },
  caseBadge: {
    backgroundColor: colors.courtSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  caseBadgeText: {
    color: colors.court,
    fontSize: 11,
    fontWeight: '800',
  },
  stuckBadge: {
    backgroundColor: colors.neutralSoft,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  stuckBadgeText: {
    color: colors.neutral,
    fontSize: 11,
    fontWeight: '800',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
  },
  label: {
    color: colors.textMuted,
    fontSize: 12,
  },
  value: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
    fontSize: 13,
    fontWeight: '700',
  },
  note: {
    flex: 1,
    textAlign: 'right',
    color: colors.text,
    fontSize: 13,
    lineHeight: 22,
  },
});
