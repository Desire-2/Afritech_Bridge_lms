'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useHydrationFix } from '@/lib/hydration-fix';
import { jwtDecode } from 'jwt-decode';

interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  role: string;
}

interface TokenPayload {
  exp: number;
  iat: number;
  jti: string;
  type: string;
  sub: number;
  nbf: number;
  fresh: boolean;
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (userData: any) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const router = useRouter();
  
  // Apply hydration fix
  useHydrationFix();
  
  // Mark when hydration is complete
  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('accessToken');
      if (storedToken) {
        setToken(storedToken);
        try {
          await fetchUserProfile(storedToken);
          setIsAuthenticated(true);
        } catch (error) {
          localStorage.removeItem('accessToken');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      }
      setIsLoading(false);
    };
    initializeAuth();
  }, []);

  const fetchUserProfile = async (currentToken?: string) => {
    const activeToken = currentToken || token;
    if (!activeToken) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/users/me`, {
        headers: { 'Authorization': `Bearer ${activeToken}` },
      });
      
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        throw new Error('Failed to fetch profile');
      }
    } catch (error) {
      logout();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Gets the appropriate dashboard route based on user role
   * @param role User role (student, instructor, admin)
   * @returns Dashboard route path
   */
  const getDashboardByRole = (role: string): string => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return '/admin/dashboard';
      case 'instructor':
        return '/instructor/Dashboard'; // Updated to match the actual folder name with capital D
      case 'student':
      default:
        return '/dashboard';
    }
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password }),
      });
      
      const data = await response.json() as {
        message?: string;
        access_token: string;
        refresh_token: string;
        user: User;
      };
      
      if (!response.ok) throw new Error(data.message || 'Login failed');

      // First set the state and local storage
      localStorage.setItem('accessToken', data.access_token);
      localStorage.setItem('refreshToken', data.refresh_token);
      setToken(data.access_token);
      setUser(data.user);
      setIsAuthenticated(true);
      
      // Determine dashboard route based on user role
      const dashboardRoute = getDashboardByRole(data.user.role);
      
      // Give the state a moment to properly update before redirecting
      setTimeout(() => {
        setIsLoading(false); // Ensure loading is false before navigation
        router.push(dashboardRoute);
      }, 300);
      
      return; // Early return so we don't hit the finally block yet
    } catch (error) {
      setIsAuthenticated(false);
      setIsLoading(false);
      throw error;
    }
  };

  const register = async (userData: any) => {
    setIsLoading(true);
    try {
      const response = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Registration failed');
      
      router.push('/auth/login?registered=true');
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    router.push('/auth/login');
  };

  /**
   * Refreshes the access token using the refresh token
   * @returns Whether the refresh was successful
   */
  const refreshToken = async (): Promise<boolean> => {
    const storedRefreshToken = localStorage.getItem('refreshToken');
    
    if (!storedRefreshToken) {
      return false;
    }
    
    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${storedRefreshToken}`
        }
      });
      
      if (!response.ok) {
        throw new Error('Failed to refresh token');
      }
      
      const data = await response.json() as { access_token: string };
      localStorage.setItem('accessToken', data.access_token);
      setToken(data.access_token);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      return false;
    }
  };

  return (
    <AuthContext.Provider value={{ 
      user, 
      token, 
      isLoading: isLoading || !hydrated, // Consider not hydrated as still loading
      isAuthenticated, 
      login, 
      register, 
      logout,
      refreshToken,
      fetchUserProfile: () => fetchUserProfile() 
    }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};