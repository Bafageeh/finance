import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, setApiToken, signIn as apiSignIn, signOutRemote } from '@/services/api';
import { AuthSession, LoginPayload } from '@/types/auth';

const SESSION_STORAGE_KEY = 'finance.auth.session.v1';

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

function getBiometricLabel(types: LocalAuthentication.AuthenticationType[]): string {
  if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
    return 'بصمة الوجه';
  }

  if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
    return 'البصمة';
  }

  return 'البصمة';
}

async function readStoredSession(): Promise<AuthSession | null> {
  try {
    const raw = await SecureStore.getItemAsync(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed?.token ? parsed : null;
  } catch {
    return null;
  }
}

async function saveStoredSession(session: AuthSession): Promise<void> {
  await SecureStore.setItemAsync(SESSION_STORAGE_KEY, JSON.stringify(session));
}

async function deleteStoredSession(): Promise<void> {
  await SecureStore.deleteItemAsync(SESSION_STORAGE_KEY);
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
        const [storedSession, hasHardware, isEnrolled, supportedTypes] = await Promise.all([
          readStoredSession(),
          LocalAuthentication.hasHardwareAsync().catch(() => false),
          LocalAuthentication.isEnrolledAsync().catch(() => false),
          LocalAuthentication.supportedAuthenticationTypesAsync().catch(() => []),
        ]);

        if (!mounted) return;

        setHasSavedSession(Boolean(storedSession?.token));
        setBiometricAvailable(Boolean(hasHardware && isEnrolled));
        setBiometricLabel(getBiometricLabel(supportedTypes));
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
    const storedSession = await readStoredSession();

    if (!storedSession?.token) {
      throw new Error('لا توجد جلسة محفوظة. سجّل الدخول مرة واحدة باسم المستخدم وكلمة المرور.');
    }

    const result = await LocalAuthentication.authenticateAsync({
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
