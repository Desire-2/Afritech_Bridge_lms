'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { getUserCache, setUserCache, fetchMe, login as doLogin, logout as doLogout, setToken } from './api';

const AuthContext = createContext<{
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<any>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}>({
  user: null,
  loading: true,
  login: async () => null,
  logout: async () => {},
  refresh: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const cached = getUserCache();
    setUser(cached);
    if (cached) {
      fetchMe()
        .then((u) => setUser(u))
        .catch(() => {
          setToken(null);
          setUserCache(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const u = await doLogin(email, password);
    setUser(u);
    return u;
  }, []);

  const logout = useCallback(async () => {
    await doLogout();
    setUser(null);
  }, []);

  const refresh = useCallback(async () => {
    const u = await fetchMe();
    setUser(u);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);