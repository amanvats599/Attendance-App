import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import { authenticateUser, getDatabase } from '../db/database';
import type { User } from '../types';

interface AuthContextValue {
  user: User | null;
  isBootstrapping: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);

  useEffect(() => {
    getDatabase()
      .catch(console.error)
      .finally(() => setIsBootstrapping(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const authenticated = await authenticateUser(username, password);
    if (!authenticated) {
      return 'Invalid username or password.';
    }
    if (authenticated.role === 'staff' && authenticated.staffId == null) {
      return 'Staff account is not linked to an employee profile.';
    }
    setUser(authenticated);
    return null;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({ user, isBootstrapping, login, logout }),
    [user, isBootstrapping, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
