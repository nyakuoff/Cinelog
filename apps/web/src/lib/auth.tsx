import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type {
  AuthResponse,
  LoginRequest,
  SetupRequest,
  UserPublic,
} from '@cinelog/contracts';
import { api, setAccessToken } from './api';
import { queryClient } from './queryClient';

interface AuthContextValue {
  user: UserPublic | null;
  /** True until the initial "am I logged in?" refresh completes. */
  initializing: boolean;
  login: (dto: LoginRequest) => Promise<void>;
  setup: (dto: SetupRequest) => Promise<void>;
  logout: () => Promise<void>;
  /** Apply a freshly updated user (e.g. after a profile edit) without a full session refresh. */
  updateUser: (user: UserPublic) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<UserPublic | null>(null);
  const [initializing, setInitializing] = useState(true);

  const apply = useCallback((res: AuthResponse) => {
    // Query keys aren't user-scoped, so drop anything cached for a previous session.
    queryClient.clear();
    setAccessToken(res.tokens.accessToken);
    setUser(res.user);
  }, []);

  // Restore an existing session from the refresh cookie on first load.
  useEffect(() => {
    let cancelled = false;
    api
      .refresh()
      .then((res) => {
        if (!cancelled) apply(res);
      })
      .catch(() => {
        /* not logged in */
      })
      .finally(() => {
        if (!cancelled) setInitializing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apply]);

  const login = useCallback(
    async (dto: LoginRequest) => apply(await api.login(dto)),
    [apply],
  );
  const setup = useCallback(
    async (dto: SetupRequest) => apply(await api.setup(dto)),
    [apply],
  );
  const logout = useCallback(async () => {
    await api.logout().catch(() => undefined);
    setAccessToken(null);
    setUser(null);
    queryClient.clear();
  }, []);

  const updateUser = useCallback((u: UserPublic) => setUser(u), []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, initializing, login, setup, logout, updateUser }),
    [user, initializing, login, setup, logout, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
