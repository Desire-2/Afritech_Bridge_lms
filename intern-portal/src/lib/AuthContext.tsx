/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Auth context with:
 *  - Token expiry check on startup (proactive, not just reactive)
 *  - Pre-emptive token refresh via jwt-decode (refreshes 5 min before expiry)
 *  - Uses the main frontend pattern for auth initialization
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, isTokenExpired, getLoginErrorMessage, extractApiError, scheduleTokenRefresh } from './api';

interface AuthContextType {
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    must_change_password: boolean;
  } | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateMustChangePasswordState: (state: boolean) => void;
  refreshUser: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthContextType['user']>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // -----------------------------------------------------------------------
  // Auth initialization — runs once on mount
  // -----------------------------------------------------------------------
  const refreshUser = useCallback(() => {
    const savedUser = localStorage.getItem('user');
    const savedToken = localStorage.getItem('token');

    if (savedUser && savedToken) {
      // ── Token expiry guard: if expired, try silent refresh ──
      if (isTokenExpired(savedToken)) {
        api.trySilentRefresh()
          .then((refreshed) => {
            if (refreshed) {
              const newToken = localStorage.getItem('token');
              setToken(newToken);
              try { setUser(JSON.parse(savedUser!)); } catch { setUser(null); }
            } else {
              localStorage.removeItem('user');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('token');
              setUser(null);
              setToken(null);
            }
          })
          .catch(() => {
            localStorage.removeItem('user');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem('token');
            setUser(null);
            setToken(null);
          })
          .finally(() => setLoading(false));
        return;
      }

      // ── Token is still valid — restore session ──
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
      } catch {
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        setUser(null);
        setToken(null);
      }
    } else {
      setUser(null);
      setToken(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  // -----------------------------------------------------------------------
  // Pre-emptive token refresh — refresh when < 5 min until expiry
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!token) return;
    const cancel = scheduleTokenRefresh();
    return cancel;
  }, [token]);

  // -----------------------------------------------------------------------
  // Login
  // -----------------------------------------------------------------------
  const login = async (email: string, password: string) => {
    try {
      const session = await api.login(email, password);
      setUser(session.user);
      setToken(session.access_token);
    } catch (err) {
      // Rethrow with user-friendly message matching main frontend's pattern
      const apiErr = extractApiError(err);
      throw new Error(getLoginErrorMessage(apiErr));
    }
  };

  // -----------------------------------------------------------------------
  // Logout
  // -----------------------------------------------------------------------
  const logout = () => {
    api.logout();
    setUser(null);
    setToken(null);
  };

  // -----------------------------------------------------------------------
  // Helper: update must_change_password flag in local state + storage
  // -----------------------------------------------------------------------
  const updateMustChangePasswordState = (state: boolean) => {
    if (user) {
      const updatedUser = { ...user, must_change_password: state };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      loading,
      login,
      logout,
      updateMustChangePasswordState,
      refreshUser,
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
