import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
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
let volatileSession: AuthSession | null = null;

async function readStoredSession(): Promise<AuthSession | null> {
  return volatileSession;
}

async function saveStoredSession(session: AuthSession): Promise<void> {
  volatileSession = session;
}

async function deleteStoredSession(): Promise<void> {
  volatileSession = null;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasSavedSession, setHasSavedSession] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const storedSession = await readStoredSession();

        if (!mounted) return;

        setHasSavedSession(Boolean(storedSession?.token));
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
    throw new Error('تم تعطيل الدخول بالبصمة مؤقتًا في هذه النسخة لحل مشكلة إغلاق التطبيق. سجّل الدخول باسم المستخدم وكلمة المرور.');
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
      biometricAvailable: false,
      biometricLabel: 'البصمة',
      signIn,
      signInWithBiometric,
      signOut,
      resetSavedSession,
      refreshProfile,
    }),
    [hasSavedSession, isLoading, session],
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
