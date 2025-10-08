'use client';
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useHydrationFix } from '@/lib/hydration-fix';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '@/services/auth.service';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/api';

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
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  validateSession: () => Promise<boolean>;
  isSessionValid: () => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [sessionValidationTimeout, setSessionValidationTimeout] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();
  
  // Apply hydration fix
  useHydrationFix();
  
  // Mark when hydration is complete
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Force timeout mechanism - ensure loading never hangs indefinitely
  useEffect(() => {
    const forceTimeout = setTimeout(() => {
      if (isLoading) {
        console.warn('AuthContext: AGGRESSIVE FORCE timeout reached, setting loading to false');
        setIsLoading(false);
      }
    }, 3000); // Much more aggressive - 3 second absolute maximum

    return () => clearTimeout(forceTimeout);
  }, [isLoading]);

  useEffect(() => {
    const initializeAuth = async () => {
      if (!hydrated) return;
      
      console.log('AuthContext: Starting AGGRESSIVE initialization...');
      
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        console.log('AuthContext: Found stored token, validating with 2s timeout...');
        setToken(storedToken);
        
        try {
          // VERY aggressive timeout - only 2 seconds
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('AGGRESSIVE: Authentication initialization timed out')), 2000);
          });
          
          await Promise.race([fetchUserProfile(), timeoutPromise]);
          console.log('AuthContext: User profile fetched successfully');
          setIsAuthenticated(true);
        } catch (error) {
          console.error('AuthContext: Auth initialization failed (aggressive timeout):', error);
          
          // Clean up on timeout or error
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
          
          console.warn('AuthContext: Cleared auth state due to timeout/error');
        }
      } else {
        console.log('AuthContext: No stored token found');
      }
      
      // Always set loading to false after initialization attempt
      console.log('AuthContext: AGGRESSIVE initialization complete, setting loading to false');
      setIsLoading(false);
    };
    
    initializeAuth();
  }, [hydrated]);

  const fetchUserProfile = async () => {
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // AGGRESSIVE timeout - only 2 seconds for user profile
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('AGGRESSIVE: User profile fetch timed out')), 2000);
      });
      
      const userData = await Promise.race([AuthService.getCurrentUser(), timeoutPromise]);
      setUser(userData);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to fetch user profile (aggressive timeout):', error);
      
      // Clear authentication state on any error
      console.warn('Clearing auth state due to profile fetch failure');
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Check if the current session is valid without making API calls
   */
  const isSessionValid = (): boolean => {
    if (!token || !isAuthenticated) {
      return false;
    }

    try {
      const decoded = jwtDecode<TokenPayload>(token);
      const now = Math.floor(Date.now() / 1000);
      return decoded.exp > now;
    } catch (error) {
      console.error('Token validation failed:', error);
      return false;
    }
  };

  /**
   * Validate session with API call and token refresh if needed
   */
  const validateSession = async (): Promise<boolean> => {
    try {
      if (!token) {
        return false;
      }

      // First check token validity
      if (!isSessionValid()) {
        console.log('Token expired, attempting refresh...');
        const refreshSuccess = await refreshToken();
        if (!refreshSuccess) {
          return false;
        }
      }

      // Ensure user profile is loaded
      if (!user && isAuthenticated) {
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Session validation timed out')), 5000);
        });
        
        await Promise.race([fetchUserProfile(), timeoutPromise]);
      }

      return isAuthenticated && !!user;
    } catch (error) {
      console.error('Session validation failed:', error);
      
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error('Session validation timed out');
        logout();
      }
      
      return false;
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
        return '/instructor/dashboard';
      case 'student':
      default:
        return '/student/dashboard';
    }
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      // Add timeout to login request
      const loginPromise = AuthService.login({ identifier, password });
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Login request timed out')), 12000); // 12 second timeout
      });

      const authData = await Promise.race([loginPromise, timeoutPromise]);
      
      // Validate the response data
      if (!authData || !authData.user || !authData.access_token) {
        throw new Error('Invalid authentication response received');
      }

      console.log(`Login API successful for user: ${authData.user.email}, role: ${authData.user.role}`);
      
      // Store tokens and set state atomically
      localStorage.setItem('token', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      setToken(authData.access_token);
      setUser(authData.user);
      setIsAuthenticated(true);
      setIsLoading(false);
      
      // Determine dashboard route based on user role
      const dashboardRoute = getDashboardByRole(authData.user.role);
      
      console.log(`Login successful for ${authData.user.role}, redirecting to ${dashboardRoute}`);
      
      // Use window.location for more reliable redirect (prevents race conditions with GuestGuard)
      window.location.href = dashboardRoute;
      
    } catch (error) {
      console.error('Login failed:', error);
      
      // Clear any partial authentication state
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      setToken(null);
      setUser(null);
      setIsAuthenticated(false);
      setIsLoading(false);
      
      // Handle timeout specifically
      if (error instanceof Error && error.message.includes('timed out')) {
        console.error('Login timed out:', error);
        throw new Error('Login is taking too long. Please check your connection and try again.');
      }
      
      // Don't double-process the error - AuthService already handled it
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    setIsLoading(true);
    try {
      await AuthService.register(userData);
      router.push('/auth/login?registered=true');
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    console.log('Logout initiated - clearing authentication state');
    
    // Call logout endpoint (fire and forget)
    AuthService.logout().catch(console.error);
    
    // Clear local state immediately
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setIsLoading(false);
    
    // Use window.location for reliable redirect to login
    window.location.href = '/auth/login';
  };

  /**
   * Refreshes the access token using the refresh token
   * @returns Whether the refresh was successful
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await AuthService.refreshToken();
      localStorage.setItem('token', response.access_token);
      setToken(response.access_token);
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      logout();
      return false;
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const updatedUser = await AuthService.updateProfile(userData);
      setUser(updatedUser);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      await AuthService.changePassword(oldPassword, newPassword);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
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
      fetchUserProfile,
      updateProfile,
      changePassword,
      validateSession,
      isSessionValid
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