import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, setApiToken, signIn as apiSignIn, signOutRemote } from '@/services/api';
import { AuthSession, LoginPayload } from '@/types/auth';

const SESSION_STORAGE_KEY = 'finance.auth.session.v1';

type LocalAuthenticationModule = typeof import('expo-local-authentication');
type SecureStoreModule = typeof import('expo-secure-store');

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

let secureStoreModulePromise: Promise<SecureStoreModule | null> | null = null;
let localAuthenticationModulePromise: Promise<LocalAuthenticationModule | null> | null = null;
let volatileSession: AuthSession | null = null;

function getSecureStoreModule(): Promise<SecureStoreModule | null> {
  if (!secureStoreModulePromise) {
    secureStoreModulePromise = import('expo-secure-store').catch(() => null);
  }

  return secureStoreModulePromise;
}

function getLocalAuthenticationModule(): Promise<LocalAuthenticationModule | null> {
  if (!localAuthenticationModulePromise) {
    localAuthenticationModulePromise = import('expo-local-authentication').catch(() => null);
  }

  return localAuthenticationModulePromise;
}

function getBiometricLabel(types: number[], localAuthentication: LocalAuthenticationModule | null): string {
  if (localAuthentication && types.includes(localAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'بصمة الوجه';
  }

  if (localAuthentication && types.includes(localAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'البصمة';
  }

  return 'البصمة';
}

async function readStoredSession(): Promise<AuthSession | null> {
  try {
    const secureStore = await getSecureStoreModule();

    if (!secureStore) {
      return volatileSession;
    }

    const raw = await secureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.token ? parsed : null;
  } catch {
    return volatileSession;
  }
}

async function saveStoredSession(session: AuthSession): Promise<void> {
  volatileSession = session;

  try {
    const secureStore = await getSecureStoreModule();
    if (secureStore) {
      await secureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
    }
  } catch {
    // استمرار الدخول أهم من فشل التخزين الآمن على جهاز أو Build معين.
  }
}

async function deleteStoredSession(): Promise<void> {
  volatileSession = null;

  try {
    const secureStore = await getSecureStoreModule();
    if (secureStore) {
      await secureStore.deleteItemAsync(SESSION_STORAGE_KEY);
    }
  } catch {
    // لا نوقف التطبيق بسبب تعذر حذف التخزين المحلي.
  }
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
        const localAuthentication = await getLocalAuthenticationModule();
        const storedSession = await readStoredSession();

        let hasHardware = false;
        let isEnrolled = false;
        let supportedTypes: number[] = [];

        if (localAuthentication) {
          [hasHardware, isEnrolled, supportedTypes] = await Promise.all([
            localAuthentication.hasHardwareAsync().catch(() => false),
            localAuthentication.isEnrolledAsync().catch(() => false),
            localAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
          ]);
        }

        if (!mounted) return;

        setHasSavedSession(Boolean(storedSession?.token));
        setBiometricAvailable(Boolean(localAuthentication && hasHardware && isEnrolled));
        setBiometricLabel(getBiometricLabel(supportedTypes, localAuthentication));
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
      const hydratedSession = {
        ...nextSession,
        user,
      };
      setSession(hydratedSession);
      await saveStoredSession(hydratedSession);
      setHasSavedSession(true);
    } catch (error) {
      if (options.requireProfile) {
        setSession(null);
        setApiToken(null);
        await deleteStoredSession();
        setHasSavedSession(false);
        throw new Error('انتهت الجلسة المحفوظة. سجّل الدخول مرة واحدة باسم المستخدم وكلمة المرور ليتم حفظ جلسة جديدة.');
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
    const localAuthentication = await getLocalAuthenticationModule();

    if (!localAuthentication) {
      throw new Error('البصمة غير متاحة في هذه النسخة. سجّل الدخول باسم المستخدم وكلمة المرور.');
    }

    const storedSession = await readStoredSession();

    if (!storedSession?.token) {
      throw new Error('لا توجد جلسة محفوظة. سجّل الدخول مرة واحدة باسم المستخدم وكلمة المرور.');
    }

    const result = await localAuthentication.authenticateAsync({
      promptMessage: 'الدخول إلى التمويل',
      cancelLabel: 'إلغاء',
      fallbackLabel: 'استخدام رمز الجهاز',
      disableDeviceFallback: false,
    });

    if (!result.success) {
      throw new Error('لم يتم تأكيد البصمة.');
    }

    await activateSession(storedSession, { requireProfile: true });
  }

  async function refreshProfile() {
    if (!session?.token) return;

    const user = await getProfile();
    const nextSession = {
      ...session,
      user,
    };
    setSession(nextSession);
    await saveStoredSession(nextSession);
    setHasSavedSession(true);
  }

  async function signOut() {
    // هذا قفل محلي فقط: نخرج من الشاشة الحالية ونُبقي الجلسة محفوظة على الجهاز
    // حتى يكون الدخول القادم بالبصمة بدل اسم المستخدم وكلمة المرور.
    setSession(null);
    setApiToken(null);
    setHasSavedSession(Boolean(await readStoredSession()));
  }

  async function resetSavedSession() {
    try {
      if (session?.token) {
        await signOutRemote();
      }
    } catch {
      // حذف الجلسة من الجهاز أهم من نجاح إلغاء التوكن في الخادم.
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
  if (!context) {
    throw new Error('useSession must be used inside AuthProvider.');
  }
  return context;
}
