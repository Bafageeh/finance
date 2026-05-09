import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import { getProfile, setApiToken, signIn as apiSignIn, signOutRemote } from '@/services/api';
import { AuthSession, LoginPayload } from '@/types/auth';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuestSession: boolean;
  hasSavedSession: boolean;
  biometricAvailable: boolean;
  biometricLabel: string;
  signIn: (payload: LoginPayload) => Promise<void>;
  signInWithBiometric: () => Promise<void>;
  signOut: () => Promise<void>;
  resetSavedSession: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_STORAGE_KEY = 'finance.savedSession.v2';

function canUseWebStorage(): boolean {
  return Platform.OS === 'web' && typeof window !== 'undefined' && Boolean(window.localStorage);
}

async function readStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = Platform.OS === 'web'
      ? (canUseWebStorage() ? window.localStorage.getItem(SESSION_STORAGE_KEY) : null)
      : await SecureStore.getItemAsync(SESSION_STORAGE_KEY);

    return raw ? JSON.parse(raw) as AuthSession : null;
  } catch {
    return null;
  }
}

async function saveStoredSession(session: AuthSession): Promise<void> {
  const raw = JSON.stringify(session);

  if (Platform.OS === 'web') {
    if (canUseWebStorage()) window.localStorage.setItem(SESSION_STORAGE_KEY, raw);
    return;
  }

  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, raw);
}

async function deleteStoredSession(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (canUseWebStorage()) window.localStorage.removeItem(SESSION_STORAGE_KEY);
      return;
    }

    await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
  } catch {
    // تجاهل أخطاء حذف التخزين المحلي.
  }
}

function pickBiometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (Platform.OS === 'ios' && types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'بصمة الوجه';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'البصمة';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'بصمة الوجه';
  }

  return 'البصمة';
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedSession, setHasSavedSession] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricLabel, setBiometricLabel] = useState('البصمة');

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const storedSession = await readStoredSession();
        const hasHardware = Platform.OS !== 'web' && await LocalAuthentication.hasHardwareAsync();
        const enrolled = Platform.OS !== 'web' && await LocalAuthentication.isEnrolledAsync();
        const supportedTypes = Platform.OS === 'web' ? [] : await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (!mounted) return;

        setHasSavedSession(Boolean(storedSession?.token));
        setBiometricAvailable(Boolean(hasHardware && enrolled));
        setBiometricLabel(pickBiometricLabel(supportedTypes));
        setApiToken(null);
        setSession(null);
      } finally {
        if (mounted) setIsLoading(false);
      }
    }

    void bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function activateSession(nextSession: AuthSession, options: { requireProfile?: boolean } = {}) {
    setApiToken(nextSession.token);

    try {
      const user = await getProfile();
      const hydratedSession = { ...nextSession, user };
      setSession(hydratedSession);
      await saveStoredSession(hydratedSession);
      setHasSavedSession(true);
    } catch (error) {
      if (options.requireProfile) {
        setSession(null);
        setApiToken(null);
        await deleteStoredSession();
        setHasSavedSession(false);
        throw new Error('انتهت الجلسة المحفوظة. سجّل الدخول مرة أخرى باسم المستخدم وكلمة المرور.');
      }

      setSession(nextSession);
      await saveStoredSession(nextSession);
      setHasSavedSession(true);
    }
  }

  async function signIn(payload: LoginPayload) {
    const nextSession = await apiSignIn(payload);
    await activateSession(nextSession);
  }

  async function signInWithBiometric() {
    const storedSession = await readStoredSession();

    if (!storedSession?.token) {
      throw new Error('لا توجد جلسة محفوظة. سجّل الدخول أول مرة باسم المستخدم وكلمة المرور.');
    }

    if (Platform.OS === 'web') {
      await activateSession(storedSession, { requireProfile: true });
      return;
    }

    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();

    if (!hasHardware || !enrolled) {
      throw new Error('فعّل البصمة أو بصمة الوجه أو رمز قفل الجهاز من الإعدادات.');
    }

    const result = await LocalAuthentication.authenticateAsync({
      promptMessage: `الدخول باستخدام ${biometricLabel}`,
      cancelLabel: 'إلغاء',
      fallbackLabel: 'استخدام رمز الجهاز',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new Error('لم يتم تأكيد الهوية.');
    }

    await activateSession(storedSession, { requireProfile: true });
  }

  async function refreshProfile() {
    if (!session?.token) return;

    const user = await getProfile();
    const nextSession = { ...session, user };
    setSession(nextSession);
    await saveStoredSession(nextSession);
    setHasSavedSession(true);
  }

  async function signOut() {
    setSession(null);
    setApiToken(null);
    setHasSavedSession(Boolean(await readStoredSession()));
  }

  async function resetSavedSession() {
    try {
      if (session?.token) await signOutRemote();
    } catch {
      // حذف الجلسة محليًا أهم من نجاح إلغاء التوكن في الخادم.
    } finally {
      await deleteStoredSession();
      setSession(null);
      setApiToken(null);
      setHasSavedSession(false);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: Boolean(session?.token),
      isGuestSession: false,
      hasSavedSession,
      biometricAvailable,
      biometricLabel,
      signIn,
      signInWithBiometric,
      signOut,
      resetSavedSession,
      refreshProfile,
    }),
    [biometricAvailable, biometricLabel, hasSavedSession, isLoading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useSession() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useSession must be used inside AuthProvider.');
  return context;
}
