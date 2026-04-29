import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Client, ClientStatus } from '@/types/api';
import { formatCurrency, getInitials } from '@/utils/format';
import { colors } from '@/utils/theme';
import { IconPillButton } from './IconPillButton';

interface ClientHeroCardProps {
  client: Client;
  status: ClientStatus;
  progressColor: string;
  overdueCount: number;
  overdueAmount: number;
  onToggleClient: () => void;
  onToggleCourt: () => void;
  disabled?: boolean;
}

export function ClientHeroCard({
  client,
  status,
  progressColor,
  overdueCount,
  overdueAmount,
  onToggleClient,
  onToggleCourt,
  disabled,
}: ClientHeroCardProps) {
  const compactStatusLabel = client.has_court
    ? 'قضية'
    : status === 'stuck'
      ? 'متعثر'
      : status === 'done'
        ? 'منتهي'
        : 'نشط';

  const statusPalette = client.has_court
    ? { background: colors.courtSoft, text: colors.court }
    : status === 'stuck'
      ? { background: colors.warningSoft, text: colors.warning }
      : status === 'done'
        ? { background: colors.infoSoft, text: colors.info }
        : overdueCount > 0
          ? { background: colors.dangerSoft, text: colors.danger }
          : { background: colors.successSoft, text: '#1b6c4f' };

  const heroNotices = [
    client.has_court
      ? { icon: 'shield-outline' as const, text: client.court_note || 'متابعة قضائية مضافة', tone: 'court' as const }
      : null,
    status === 'stuck'
      ? { icon: 'pause-circle-outline' as const, text: 'العميل متعثر وموقوف مؤقتًا من المؤشرات العامة', tone: 'neutral' as const }
      : null,
    overdueCount > 0
      ? {
          icon: 'alert-circle-outline' as const,
          text: `${overdueCount} متأخر · ${formatCurrency(overdueAmount)}`,
          tone: 'danger' as const,
        }
      : null,
  ].filter(Boolean) as Array<{ icon: keyof typeof Ionicons.glyphMap; text: string; tone: 'court' | 'neutral' | 'danger' }>;

  return (
    <View style={styles.card}>
      <View style={styles.topRow}>
        <View style={styles.amountBlock}>
          <Text style={styles.amountLabel}>القسط الشهري</Text>
          <Text style={styles.amountValue} numberOfLines={1}>
            {formatCurrency(client.summary.monthly_installment)}
          </Text>
          <Text style={styles.amountSubtext} numberOfLines={1}>
            أصل التمويل {client.asset || 'تمويل'}
          </Text>
        </View>

        <View style={styles.identitySide}>
          <View style={[styles.avatar, client.has_court ? styles.avatarCourt : styles.avatarDefault]}>
            <Text style={[styles.avatarText, client.has_court && styles.avatarTextCourt]}>{getInitials(client.name)}</Text>
          </View>

          <View style={styles.identityText}>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>
                {client.name}
              </Text>
              {client.has_court ? <Ionicons name="shield-outline" size={15} color={colors.court} /> : null}
              {overdueCount > 0 ? <Ionicons name="alert-circle-outline" size={15} color={colors.danger} /> : null}
            </View>

            <Text style={styles.metaLine} numberOfLines={1}>
              {client.asset || 'بدون أصل'} · {client.summary.paid_count}/{client.months} شهر · متبقي {formatCurrency(client.summary.remaining_amount)}
            </Text>

            <View style={styles.statusRow}>
              <View style={[styles.statusPill, { backgroundColor: statusPalette.background }]}> 
                <Text style={[styles.statusText, { color: statusPalette.text }]}>{compactStatusLabel}</Text>
              </View>
              <Text style={styles.progressText}>{client.summary.progress_percent}% إنجاز</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${client.summary.progress_percent}%`, backgroundColor: progressColor }]} />
      </View>

      <View style={styles.statsRow}>
        <MiniStat label="المدفوع" value={formatCurrency(client.summary.paid_amount)} tone="success" />
        <MiniStat label="المتبقي" value={formatCurrency(client.summary.remaining_amount)} tone={overdueCount > 0 ? 'danger' : 'default'} />
        <MiniStat label="الربح" value={formatCurrency(client.summary.total_profit)} tone="info" />
      </View>

      {heroNotices.length ? (
        <View style={styles.noticeWrap}>
          {heroNotices.map((notice, index) => (
            <View
              key={`${notice.text}-${index}`}
              style={[
                styles.noticePill,
                notice.tone === 'court'
                  ? styles.noticeCourt
                  : notice.tone === 'neutral'
                    ? styles.noticeNeutral
                    : styles.noticeDanger,
              ]}
            >
              <Ionicons
                name={notice.icon}
                size={13}
                color={notice.tone === 'court' ? colors.court : notice.tone === 'neutral' ? colors.neutral : colors.danger}
              />
              <Text
                numberOfLines={1}
                style={[
                  styles.noticeText,
                  notice.tone === 'court'
                    ? styles.noticeTextCourt
                    : notice.tone === 'neutral'
                      ? styles.noticeTextNeutral
                      : styles.noticeTextDanger,
                ]}
              >
                {notice.text}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.quickActionsRow}>
        <IconPillButton
          icon={client.status === 'stuck' ? 'sparkles-outline' : 'pause-circle-outline'}
          label={client.status === 'stuck' ? 'تنشيط' : 'تعثر'}
          tone={client.status === 'stuck' ? 'success' : 'default'}
          onPress={onToggleClient}
          disabled={disabled}
        />
        <IconPillButton
          icon={client.has_court ? 'shield-checkmark-outline' : 'shield-outline'}
          label={client.has_court ? 'إزالة قضية' : 'إضافة قضية'}
          tone={client.has_court ? 'danger' : 'primary'}
          onPress={onToggleCourt}
          disabled={disabled}
        />
      </View>
    </View>
  );
}

function MiniStat({
  label,
  value,
  tone = 'default',
}: {
  label: string;
  value: string;
  tone?: 'default' | 'success' | 'danger' | 'info';
}) {
  const palette =
    tone === 'success'
      ? { background: colors.successSoft, value: colors.success }
      : tone === 'danger'
        ? { background: colors.dangerSoft, value: colors.danger }
        : tone === 'info'
          ? { background: colors.infoSoft, value: colors.info }
          : { background: colors.surfaceMuted, value: colors.text };

  return (
    <View style={[styles.statCard, { backgroundColor: palette.background }]}> 
      <Text style={[styles.statValue, { color: palette.value }]} numberOfLines={1}>
        {value}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    padding: 14,
    gap: 12,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  amountBlock: {
    minWidth: 122,
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 12,
    gap: 3,
    alignItems: 'flex-start',
  },
  amountLabel: {
    fontSize: 11,
    color: colors.textMuted,
    fontWeight: '700',
  },
  amountValue: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '800',
  },
  amountSubtext: {
    fontSize: 11,
    color: colors.textMuted,
  },
  identitySide: {
    flex: 1,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 10,
    minWidth: 0,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  avatarDefault: {
    backgroundColor: '#f1f0ee',
  },
  avatarCourt: {
    backgroundColor: colors.courtSoft,
  },
  avatarText: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '800',
  },
  avatarTextCourt: {
    color: colors.court,
  },
  identityText: {
    flex: 1,
    minWidth: 0,
    gap: 4,
  },
  nameRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 5,
  },
  name: {
    flex: 1,
    color: colors.text,
    fontSize: 21,
    fontWeight: '900',
    textAlign: 'right',
  },
  metaLine: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'right',
  },
  statusRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  statusPill: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '800',
  },
  progressText: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
  },
  progressTrack: {
    height: 7,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 999,
  },
  statsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 4,
  },
  statValue: {
    fontSize: 13,
    fontWeight: '800',
    textAlign: 'right',
  },
  statLabel: {
    fontSize: 11,
    color: colors.textMuted,
    textAlign: 'right',
  },
  noticeWrap: {
    gap: 6,
  },
  noticePill: {
    minHeight: 36,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  noticeCourt: {
    backgroundColor: colors.courtSoft,
  },
  noticeNeutral: {
    backgroundColor: colors.neutralSoft,
  },
  noticeDanger: {
    backgroundColor: colors.dangerSoft,
  },
  noticeText: {
    flex: 1,
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'right',
  },
  noticeTextCourt: {
    color: colors.court,
  },
  noticeTextNeutral: {
    color: colors.neutral,
  },
  noticeTextDanger: {
    color: colors.danger,
  },
  quickActionsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
    flexWrap: 'wrap',
  },
});
