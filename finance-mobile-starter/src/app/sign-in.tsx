import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { AppCard } from '@/components/AppCard';
import { InfoPill } from '@/components/InfoPill';
import { LabeledInput } from '@/components/LabeledInput';
import { Screen } from '@/components/Screen';
import { useSession } from '@/contexts/auth-context';
import { apiConfig } from '@/services/api';
import { colors } from '@/utils/theme';

const DEMO_ACCOUNTS = [
  { label: 'admin', value: 'admin' },
  { label: 'admin@pm.sa', value: 'admin@pm.sa' },
];

export default function SignInScreen() {
  const { signIn, isAuthenticated } = useSession();
  const [login, setLogin] = useState(apiConfig.useMocks ? 'admin' : '');
  const [password, setPassword] = useState(apiConfig.useMocks ? '123456' : '');
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  async function handleSubmit() {
    if (!login.trim() || !password.trim()) {
      Alert.alert('بيانات ناقصة', 'أدخل اسم المستخدم أو البريد وكلمة المرور.');
      return;
    }

    try {
      setSubmitting(true);
      await signIn({ login: login.trim(), password: password.trim() });
    } catch (error) {
      Alert.alert('تعذر تسجيل الدخول', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <Screen
      scrollable={false}
      title="تسجيل الدخول"
      subtitle={apiConfig.useMocks ? 'وضع تجريبي سريع للتطوير.' : 'أدخل بيانات حساب Laravel للوصول إلى النظام.'}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="wallet-outline" size={24} color="#fff" />
            </View>
            <View style={styles.heroPills}>
              <InfoPill compact tone={apiConfig.useMocks ? 'warning' : 'success'} label="الوضع" value={apiConfig.useMocks ? 'تجريبي' : 'مباشر'} />
              <InfoPill compact tone="info" label="الواجهة" value="Expo Go" />
            </View>
          </View>

          <Text style={styles.heroTitle}>إدارة التمويل</Text>
          <Text style={styles.heroSub}>{apiConfig.useMocks ? 'نسخة جوال عملية لمتابعة العملاء والأقساط والتحصيل ببيانات تجريبية.' : 'تسجيل دخول آمن للربط المباشر مع Laravel API بدون فتح التطبيق تلقائيًا.'}</Text>

          <View style={styles.heroStatsRow}>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatValue}>جاهز</Text>
              <Text style={styles.heroStatLabel}>التشغيل</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatValue}>{apiConfig.useMocks ? 'Mock' : 'API'}</Text>
              <Text style={styles.heroStatLabel}>المصدر</Text>
            </View>
            <View style={styles.heroStatBox}>
              <Text style={styles.heroStatValue}>محمول</Text>
              <Text style={styles.heroStatLabel}>التجربة</Text>
            </View>
          </View>
        </View>

        <AppCard title="بيانات الدخول" style={styles.formCard}>
          <LabeledInput
            label="اسم المستخدم أو البريد"
            value={login}
            onChangeText={setLogin}
            autoCapitalize="none"
            placeholder="admin أو admin@pm.sa"
          />
          <LabeledInput
            label="كلمة المرور"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="123456"
          />

          {apiConfig.useMocks ? (
            <View style={styles.quickAccountsRow}>
              {DEMO_ACCOUNTS.map((account) => (
                <Pressable
                  key={account.value}
                  onPress={() => {
                    setLogin(account.value);
                    setPassword('123456');
                  }}
                  style={styles.quickAccountChip}
                >
                  <Ionicons name="sparkles-outline" size={14} color={colors.primary} />
                  <Text style={styles.quickAccountText}>{account.label}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <TouchableOpacity
            style={[styles.primaryButton, submitting && styles.buttonDisabled]}
            onPress={() => void handleSubmit()}
            disabled={submitting}
            activeOpacity={0.92}
          >
            {submitting ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="log-in-outline" size={18} color="#fff" />
                <Text style={styles.primaryButtonText}>دخول</Text>
              </>
            )}
          </TouchableOpacity>
        </AppCard>

        <AppCard title="حالة الجلسة" style={styles.infoCard}>
          <View style={styles.stateGrid}>
            <InfoPill compact tone="default" label="المصدر" value={apiConfig.useMocks ? 'تجريبي' : 'Laravel API'} />
            <InfoPill compact tone="success" label="Expo Go" value="متوافق" />
          </View>

          <View style={styles.infoRow}>
            <Text numberOfLines={1} style={styles.infoValue}>{apiConfig.baseUrl}</Text>
            <Text style={styles.infoLabel}>عنوان الـ API</Text>
          </View>
          <Text style={styles.helperText}>{apiConfig.useMocks ? 'الوضع التجريبي يستخدم بيانات دخول ثابتة لتسريع التطوير.' : 'تم إيقاف الدخول التلقائي؛ كل طلب مباشر يحتاج رمز دخول صادر من الخادم.'}</Text>
        </AppCard>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    gap: 12,
  },
  heroCard: {
    backgroundColor: colors.primary,
    borderRadius: 28,
    padding: 18,
    gap: 14,
  },
  heroTopRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  heroIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  heroPills: {
    flex: 1,
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
    justifyContent: 'flex-start',
  },
  heroTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#fff',
    textAlign: 'right',
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.82)',
    textAlign: 'right',
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
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
  },
  heroStatLabel: {
    fontSize: 12,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'center',
    fontWeight: '700',
  },
  formCard: {
    marginBottom: 0,
  },
  infoCard: {
    marginBottom: 0,
  },
  quickAccountsRow: {
    flexDirection: 'row-reverse',
    flexWrap: 'wrap',
    gap: 8,
  },
  quickAccountChip: {
    minHeight: 38,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 12,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
  },
  quickAccountText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.text,
  },
  primaryButton: {
    minHeight: 54,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row-reverse',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  stateGrid: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  infoRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
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
    textAlign: 'left',
    fontWeight: '700',
  },
  helperText: {
    fontSize: 13,
    lineHeight: 21,
    color: colors.textMuted,
    textAlign: 'right',
  },
  liveHero: {
    borderRadius: 28,
    padding: 18,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 14,
  },
  liveHeroBadge: {
    alignSelf: 'flex-start',
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.successSoft,
  },
  liveHeroBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: colors.success,
  },
  liveHeroTitle: {
    fontSize: 24,
    fontWeight: '900',
    color: colors.text,
    textAlign: 'right',
  },
  liveHeroSub: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textMuted,
    textAlign: 'right',
  },
  livePillsRow: {
    flexDirection: 'row-reverse',
    gap: 8,
  },
  liveCard: {
    marginBottom: 0,
  },
});
