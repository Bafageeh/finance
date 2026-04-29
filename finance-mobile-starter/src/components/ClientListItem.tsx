import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Client } from '@/types/api';
import { getClientAlertInfo, getOverdueScheduleItems } from '@/utils/finance';
import { formatCurrency, getClientDisplayStatus, getInitials } from '@/utils/format';
import { colors } from '@/utils/theme';

interface ClientListItemProps {
  client: Client;
  onPress: () => void;
}

export function ClientListItem({ client, onPress }: ClientListItemProps) {
  const status = getClientDisplayStatus(client);
  const alertInfo = getClientAlertInfo(client);
  const overdueItems = getOverdueScheduleItems(client);
  const isLate = overdueItems.length > 0;
  const progressColor = client.has_court
    ? colors.court
    : status === 'stuck'
      ? colors.warning
      : status === 'done'
        ? colors.info
        : isLate
          ? colors.danger
          : colors.success;

  const statusLabel = client.has_court
    ? 'قضية'
    : status === 'stuck'
      ? 'متعثر'
      : status === 'done'
        ? 'منتهي'
        : 'نشط';

  const cadenceLabel = client.has_court
    ? 'قضية نشطة'
    : isLate
      ? `${alertInfo.overdueCount || overdueItems.length} متأخر`
      : status === 'done'
        ? 'مكتمل'
        : 'منتظم';

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.mainRow}>
        <View style={styles.amountColumn}>
          <Text style={styles.amountLabel}>القسط</Text>
          <Text style={styles.amountValue} numberOfLines={1}>
            {formatCurrency(client.summary.monthly_installment)}
          </Text>
        </View>

        <View style={styles.contentColumn}>
          <View style={styles.identityRow}>
            <View style={styles.avatarWrap}>
              <View style={[styles.avatar, client.has_court ? styles.avatarCourt : styles.avatarDefault]}>
                <Text style={[styles.avatarText, client.has_court && styles.avatarTextCourt]}>
                  {getInitials(client.name)}
                </Text>
              </View>
            </View>

            <View style={styles.nameStack}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>
                  {client.name}
                </Text>
                {client.has_court ? <Ionicons name="shield-outline" size={14} color={colors.court} /> : null}
              </View>

              <View style={styles.subRow}>
                <View style={[styles.cadencePill, isLate ? styles.cadenceLate : styles.cadenceRegular]}>
                  <Text style={[styles.cadenceText, isLate ? styles.cadenceLateText : styles.cadenceRegularText]}>
                    {cadenceLabel}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          <Text style={styles.meta} numberOfLines={1}>
            {client.asset || 'تمويل'} · {client.summary.paid_count}/{client.months} شهر · متبقي: {formatCurrency(client.summary.remaining_amount)}
          </Text>

          <View style={styles.footerRow}>
            <View style={styles.statusGroup}>
              <Text style={styles.progressPercent}>{client.summary.progress_percent}%</Text>
              <View
                style={[
                  styles.statusPill,
                  client.has_court
                    ? styles.statusCourt
                    : status === 'done'
                      ? styles.statusDone
                      : isLate || status === 'stuck'
                        ? styles.statusLate
                        : styles.statusActive,
                ]}
              >
                <Text
                  style={[
                    styles.statusText,
                    client.has_court
                      ? styles.statusCourtText
                      : status === 'done'
                        ? styles.statusDoneText
                        : isLate || status === 'stuck'
                          ? styles.statusLateText
                          : styles.statusActiveText,
                  ]}
                >
                  {statusLabel}
                </Text>
              </View>
            </View>

            <View style={styles.hintsRow}>
              {client.phone ? (
                <View style={styles.inlineHint}>
                  <Ionicons name="call-outline" size={12} color={colors.textMuted} />
                  <Text style={styles.inlineHintText} numberOfLines={1}>
                    {client.phone}
                  </Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${client.summary.progress_percent}%`, backgroundColor: progressColor }]} />
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  mainRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  amountColumn: {
    width: 102,
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    paddingTop: 4,
  },
  amountLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '800',
    marginBottom: 6,
  },
  amountValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  contentColumn: {
    flex: 1,
    minWidth: 0,
    gap: 6,
  },
  identityRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
  },
  avatarWrap: {
    width: 48,
    alignItems: 'flex-end',
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarDefault: {
    backgroundColor: '#f2f1ee',
  },
  avatarCourt: {
    backgroundColor: colors.courtSoft,
  },
  avatarText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  avatarTextCourt: {
    color: colors.court,
  },
  nameStack: {
    flex: 1,
    minWidth: 0,
    gap: 4,
    alignItems: 'flex-end',
  },
  nameRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 6,
  },
  name: {
    flexShrink: 1,
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
    textAlign: 'right',
  },
  subRow: {
    width: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
  },
  cadencePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  cadenceRegular: {
    backgroundColor: '#f3f1ec',
  },
  cadenceLate: {
    backgroundColor: colors.dangerSoft,
  },
  cadenceText: {
    fontSize: 11,
    fontWeight: '700',
  },
  cadenceRegularText: {
    color: colors.textMuted,
  },
  cadenceLateText: {
    color: colors.danger,
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: 'right',
  },
  footerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  statusGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  progressPercent: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: '700',
  },
  statusPill: {
    minWidth: 72,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusActive: {
    backgroundColor: colors.successSoft,
  },
  statusLate: {
    backgroundColor: colors.dangerSoft,
  },
  statusCourt: {
    backgroundColor: colors.courtSoft,
  },
  statusDone: {
    backgroundColor: colors.infoSoft,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  statusActiveText: {
    color: '#1b6c4f',
  },
  statusLateText: {
    color: colors.danger,
  },
  statusCourtText: {
    color: colors.court,
  },
  statusDoneText: {
    color: colors.info,
  },
  hintsRow: {
    flex: 1,
    minWidth: 0,
    alignItems: 'flex-end',
  },
  inlineHint: {
    maxWidth: '100%',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 4,
  },
  inlineHintText: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    backgroundColor: '#ebe7df',
    borderRadius: 999,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
});
