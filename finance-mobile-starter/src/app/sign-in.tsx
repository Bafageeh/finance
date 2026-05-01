import { Ionicons } from '@expo/vector-icons';
import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
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
  const {
    signIn,
    signInWithBiometric,
    resetSavedSession,
    isAuthenticated,
    hasSavedSession,
    biometricAvailable,
    biometricLabel,
  } = useSession();
  const [login, setLogin] = useState(apiConfig.useMocks ? 'admin' : '');
  const [password, setPassword] = useState(apiConfig.useMocks ? '123456' : '');
  const [submitting, setSubmitting] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [biometricAttempted, setBiometricAttempted] = useState(false);

  const canUseBiometric = hasSavedSession && biometricAvailable;
  const shouldShowPasswordForm = !canUseBiometric || showPasswordForm;

  useEffect(() => {
    if (!canUseBiometric || biometricAttempted || isAuthenticated) return;
    setBiometricAttempted(true);
    void handleBiometricLogin(true);
  }, [canUseBiometric, biometricAttempted, isAuthenticated]);

  if (isAuthenticated) {
    return <Redirect href="/(protected)/(tabs)" />;
  }

  async function handleBiometricLogin(silent = false) {
    try {
      setSubmitting(true);
      await signInWithBiometric();
    } catch (error) {
      if (!silent) {
        Alert.alert('تعذر الدخول بالبصمة', error instanceof Error ? error.message : 'حدث خطأ غير متوقع.');
      }
      setShowPasswordForm(true);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetSavedSession() {
    await resetSavedSession();
    setShowPasswordForm(true);
    setBiometricAttempted(true);
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
      subtitle={canUseBiometric && !shouldShowPasswordForm ? `الدخول السريع باستخدام ${biometricLabel}.` : 'أدخل بياناتك أول مرة فقط، وبعدها يتم الدخول بالبصمة.'}
    >
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <View style={styles.heroTopRow}>
            <View style={styles.heroIconWrap}>
              <Ionicons name="wallet-outline" size={24} color="#fff" />
            </View>
            <View style={styles.heroPills}>
              <InfoPill compact tone={apiConfig.useMocks ? 'warning' : 'success'} label="الوضع" value={apiConfig.useMocks ? 'تجريبي' : 'مباشر'} />
              <InfoPill compact tone="info" label="الدخول" value={canUseBiometric ? biometricLabel : 'كلمة مرور'} />
            </View>
          </View>

          <Text style={styles.heroTitle}>إدارة التمويل</Text>
          <Text style={styles.heroSub}>{canUseBiometric ? 'جلسة محفوظة. استخدم البصمة للدخول السريع حتى بعد إغلاق التطبيق أو تسجيل الخروج.' : 'سجّل الدخول مرة واحدة، وسيتم حفظ الجلسة آمنًا لاستخدام البصمة في المرات القادمة.'}</Text>
        </View>

        {canUseBiometric && !shouldShowPasswordForm ? (
          <AppCard title="الدخول السريع" style={styles.formCard}>
            <TouchableOpacity
              style={[styles.primaryButton, submitting && styles.buttonDisabled]}
              onPress={() => void handleBiometricLogin(false)}
              disabled={submitting}
              activeOpacity={0.92}
            >
              {submitting ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Ionicons name="finger-print-outline" size={20} color="#fff" />
                  <Text style={styles.primaryButtonText}>الدخول باستخدام {biometricLabel}</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.secondaryButton} onPress={() => setShowPasswordForm(true)} activeOpacity={0.9}>
              <Text style={styles.secondaryButtonText}>استخدام اسم المستخدم وكلمة المرور</Text>
            </TouchableOpacity>
          </AppCard>
        ) : null}

        {shouldShowPasswordForm ? (
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

            {hasSavedSession ? (
              <TouchableOpacity style={styles.dangerTextButton} onPress={() => void handleResetSavedSession()}>
                <Text style={styles.dangerText}>نسيان الجلسة المحفوظة</Text>
              </TouchableOpacity>
            ) : null}
          </AppCard>
        ) : null}

        <AppCard title="حالة الجلسة" style={styles.infoCard}>
          <View style={styles.stateGrid}>
            <InfoPill compact tone="default" label="المصدر" value={apiConfig.useMocks ? 'تجريبي' : 'Laravel API'} />
            <InfoPill compact tone={canUseBiometric ? 'success' : 'warning'} label="البصمة" value={canUseBiometric ? 'مفعلة' : 'بعد أول دخول'} />
          </View>

          <View style={styles.infoRow}>
            <Text numberOfLines={1} style={styles.infoValue}>{apiConfig.baseUrl}</Text>
            <Text style={styles.infoLabel}>عنوان الـ API</Text>
          </View>
          <Text style={styles.helperText}>بعد أول تسجيل دخول ناجح سيتم حفظ الجلسة، وفي المرات القادمة تظهر البصمة فقط.</Text>
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
  secondaryButton: {
    minHeight: 46,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: '800',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '900',
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  dangerTextButton: {
    alignItems: 'center',
    paddingVertical: 4,
  },
  dangerText: {
    color: colors.danger,
    fontWeight: '800',
    fontSize: 12,
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
});
