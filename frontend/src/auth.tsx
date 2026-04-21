import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from './api';
import { clearStoredUserPreferences, persistUserPreferences } from './preferences';
import type { User, UserSettingsUpdate } from './types';

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refresh: () => Promise<void>;
  updateSettings: (patch: UserSettingsUpdate) => Promise<User>;
}

const Ctx = createContext<AuthCtx | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const r = await api.get<User>('/auth/me');
      setUser(r.data);
      persistUserPreferences(r.data);
    } catch {
      setUser(null);
      clearStoredUserPreferences();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const login = async (username: string, password: string) => {
    const r = await api.post<{ access_token: string }>('/auth/login', { username, password });
    setToken(r.data.access_token);
    await refresh();
  };

  const logout = () => {
    clearToken();
    setUser(null);
    clearStoredUserPreferences();
    window.location.href = '/login';
  };

  const updateSettings = async (patch: UserSettingsUpdate) => {
    const response = await api.patch<User>('/auth/me/settings', patch);
    setUser(response.data);
    persistUserPreferences(response.data);
    return response.data;
  };

  return (
    <Ctx.Provider value={{ user, loading, login, logout, refresh, updateSettings }}>
      {children}
    </Ctx.Provider>
  );
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth must be inside AuthProvider');
  return v;
}
