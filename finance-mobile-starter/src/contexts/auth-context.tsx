import { PropsWithChildren, createContext, useContext, useEffect, useMemo, useState } from 'react';
import { getProfile, setApiToken, signIn as apiSignIn, signOutRemote } from '@/services/api';
import { AuthSession, LoginPayload } from '@/types/auth';

interface AuthContextValue {
  session: AuthSession | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isGuestSession: boolean;
  signIn: (payload: LoginPayload) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setApiToken(null);
    setSession(null);
    setIsLoading(false);
  }, []);

  async function signIn(payload: LoginPayload) {
    const nextSession = await apiSignIn(payload);
    setApiToken(nextSession.token);

    try {
      const user = await getProfile();
      setSession({
        ...nextSession,
        user,
      });
    } catch {
      setSession(nextSession);
    }
  }

  async function refreshProfile() {
    if (!session?.token) return;

    const user = await getProfile();
    setSession({
      ...session,
      user,
    });
  }

  async function signOut() {
    try {
      await signOutRemote();
    } finally {
      setSession(null);
      setApiToken(null);
    }
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isLoading,
      isAuthenticated: Boolean(session?.token),
      isGuestSession: false,
      signIn,
      signOut,
      refreshProfile,
    }),
    [isLoading, session],
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
