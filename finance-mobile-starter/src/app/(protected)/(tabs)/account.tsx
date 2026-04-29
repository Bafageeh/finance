import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { AccordionSection } from '@/components/AccordionSection';
import { ActionTile } from '@/components/ActionTile';
import { AppCard } from '@/components/AppCard';
import { InfoPill } from '@/components/InfoPill';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { apiConfig } from '@/services/api';
import { colors } from '@/utils/theme';

function maskToken(token?: string) {
  if (!token) return 'لا يوجد';
  if (token.length <= 18) return token;
  return `${token.slice(0, 8)}...${token.slice(-6)}`;
}

export default function AccountScreen() {
  const { session, signOut, refreshProfile, isGuestSession } = useSession();
  const [refreshing, setRefreshing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [openSection, setOpenSection] = useState<'session' | 'connection' | null>('session');

  const firstLetter = session?.user?.name?.trim()?.slice(0, 1) || 'م';
  const statusTone = isGuestSession ? 'success' : 'info';
  const statusLabel = isGuestSession ? 'جلسة مباشرة' : 'جلسة موثقة';
  const issuedDate = session?.issued_at?.slice(0, 10) || '--';
  const userRole = session?.user?.role || (isGuestSession ? 'live-api' : 'غير محدد');

  const topBadges = useMemo(
    () => [
      { label: 'الوضع', value: apiConfig.useMocks ? 'تجريبي' : 'حي', tone: apiConfig.useMocks ? 'warning' as const : 'success' as const },
      { label: 'الجلسة', value: statusLabel, tone: statusTone as 'success' | 'info' },
    ],
    [isGuestSession, statusLabel, statusTone],
  );

  async function handleRefresh() {
    try {
      setRefreshing(true);
      await refreshProfile();
      Alert.alert('تم', isGuestSession ? 'تم تحديث حالة الاتصال بالتطبيق.' : 'تم تحديث بيانات الحساب.');
    } catch (error) {
      Alert.alert('تعذر التحديث', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSignOut() {
    try {
      setSigningOut(true);
      await signOut();
      Alert.alert('تم', isGuestSession ? 'تمت إعادة تهيئة الجلسة المحلية.' : 'تم تسجيل الخروج.');
    } catch (error) {
      Alert.alert('تعذر تنفيذ العملية', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <Screen title={isGuestSession ? 'الاتصال والحساب' : 'الحساب'} subtitle="مركز مختصر لمعرفة وضع الربط والجلسة الحالية مع واجهة Laravel من الجوال.">
      <View style={styles.heroCard}>
        <View style={styles.heroTopRow}>
          <View style={styles.avatarWrap}>
            <Text style={styles.avatarText}>{firstLetter}</Text>
          </View>

          <View style={styles.heroTextWrap}>
            <Text style={styles.heroTitle}>{session?.user?.name || 'مستخدم النظام'}</Text>
            <Text style={styles.heroSubtitle}>{session?.user?.email || (isGuestSession ? 'ربط مباشر بدون بريد حساب' : 'لا يوجد بريد')}</Text>
            <Text style={styles.heroMeta}>الصلاحية: {userRole}</Text>
          </View>
        </View>

        <View style={styles.heroBadgesRow}>
          {topBadges.map((badge) => (
            <InfoPill key={`${badge.label}-${badge.value}`} compact tone={badge.tone} label={badge.label} value={badge.value} />
          ))}
        </View>

        <View style={styles.heroStatsRow}>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatValue}>{issuedDate}</Text>
            <Text style={styles.heroStatLabel}>آخر تهيئة</Text>
          </View>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatValue}>{apiConfig.useMocks ? 'Mock' : 'Live'}</Text>
            <Text style={styles.heroStatLabel}>المصدر</Text>
          </View>
          <View style={styles.heroStatBox}>
            <Text style={styles.heroStatValue}>{session?.token ? 'موجود' : 'محلي'}</Text>
            <Text style={styles.heroStatLabel}>التوكن</Text>
          </View>
        </View>
      </View>

      <AppCard title="إجراءات سريعة" style={styles.actionsCard}>
        <View style={styles.actionGrid}>
          <ActionTile
            label={refreshing ? 'جارٍ التحديث' : isGuestSession ? 'تحديث الاتصال' : 'تحديث الحساب'}
            icon={refreshing ? 'sync-outline' : 'refresh-outline'}
            onPress={() => void handleRefresh()}
            tone="default"
            disabled={refreshing}
            style={styles.actionTile}
          />
          <ActionTile
            label={signingOut ? 'جارٍ التنفيذ' : isGuestSession ? 'إعادة الجلسة' : 'تسجيل الخروج'}
            icon={isGuestSession ? 'reload-outline' : 'log-out-outline'}
            onPress={() => void handleSignOut()}
            tone="danger"
            disabled={signingOut}
            style={styles.actionTile}
          />
        </View>

        {(refreshing || signingOut) ? (
          <View style={styles.loaderRow}>
            <ActivityIndicator size="small" color={colors.primary} />
            <Text style={styles.loaderText}>يتم تنفيذ العملية الحالية...</Text>
          </View>
        ) : null}
      </AppCard>

      <AccordionSection
        title="معلومات الجلسة"
        subtitle="التوكن والحالة الحالية للجلسة"
        expanded={openSection === 'session'}
        onToggle={() => setOpenSection((prev) => (prev === 'session' ? null : 'session'))}
      >
        <View style={styles.infoList}>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{statusLabel}</Text>
            <Text style={styles.infoLabel}>نوع الجلسة</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{issuedDate}</Text>
            <Text style={styles.infoLabel}>وقت التهيئة</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoValue}>{maskToken(session?.token)}</Text>
            <Text style={styles.infoLabel}>التوكن</Text>
          </View>
        </View>
      </AccordionSection>

      <AccordionSection
        title="بيانات الربط"
        subtitle="الخادم والوضع الحالي"
        expanded={openSection === 'connection'}
        onToggle={() => setOpenSection((prev) => (prev === 'connection' ? null : 'connection'))}
      >
        <View style={styles.pillsWrap}>
          <InfoPill
            compact
            tone={apiConfig.useMocks ? 'warning' : 'success'}
            label="بيئة العمل"
            value={apiConfig.useMocks ? 'تجريبية' : 'حية'}
            icon={<Ionicons name={apiConfig.useMocks ? 'flask-outline' : 'cloud-done-outline'} size={15} color={apiConfig.useMocks ? colors.warning : colors.success} />}
          />
          <InfoPill
            compact
            tone="info"
            label="التطبيق"
            value="Expo Router"
            icon={<Ionicons name="phone-portrait-outline" size={15} color={colors.info} />}
          />
        </View>

        <View style={styles.connectionBox}>
          <Text style={styles.connectionLabel}>عنوان الـ API</Text>
          <Text style={styles.connectionValue}>{apiConfig.baseUrl}</Text>
        </View>

        <Text style={styles.connectionHint}>هذا القسم مناسب لمراجعة مصدر البيانات بسرعة قبل اختبار الشاشات أو التأكد من أنك تعمل على البيئة الصحيحة.</Text>
      </AccordionSection>
    </Screen>
  );
}

const styles = StyleSheet.create({
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    padding: 18,
    marginBottom: 12,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 14,
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '900',
  },
  heroTextWrap: {
    flex: 1,
    gap: 4,
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'right',
  },
  heroSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right',
  },
  heroMeta: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.68)',
    textAlign: 'right',
  },
  heroBadgesRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  heroStatsRow: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  heroStatBox: {
    flex: 1,
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 4,
  },
  heroStatValue: {
    fontSize: 13,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'center',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    fontWeight: '700',
  },
  actionsCard: {
    marginBottom: 12,
  },
  actionGrid: {
    flexDirection: 'row-reverse',
    gap: 10,
  },
  actionTile: {
    flex: 1,
  },
  loaderRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  loaderText: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: '700',
  },
  infoList: {
    gap: 12,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  infoLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: '700',
  },
  infoValue: {
    flex: 1,
    fontSize: 13,
    color: colors.text,
    fontWeight: '800',
    textAlign: 'left',
  },
  pillsWrap: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  connectionBox: {
    borderRadius: 18,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  connectionLabel: {
    fontSize: 12,
    color: colors.textMuted,
    textAlign: 'right',
    fontWeight: '700',
  },
  connectionValue: {
    fontSize: 13,
    color: colors.text,
    textAlign: 'left',
    fontWeight: '800',
  },
  connectionHint: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'right',
  },
});
