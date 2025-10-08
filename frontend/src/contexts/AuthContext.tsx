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
  login: (identifier: string, password: string) => Promise<AuthResponse>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: () => void;
  fetchUserProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  const router = useRouter();
  
  // Apply hydration fix
  useHydrationFix();
  
  // Mark when hydration is complete
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Setup automatic token refresh and event listeners
  useEffect(() => {
    if (!hydrated) return;

    // Listen for token refresh events from API client
    const handleTokenExpired = () => {
      console.log('Token expired, attempting refresh...');
      refreshToken();
    };

    const handleRefreshFailed = () => {
      console.log('Token refresh failed, logging out...');
      logout();
    };

    window.addEventListener('auth:token-expired', handleTokenExpired);
    window.addEventListener('auth:refresh-failed', handleRefreshFailed);

    return () => {
      window.removeEventListener('auth:token-expired', handleTokenExpired);
      window.removeEventListener('auth:refresh-failed', handleRefreshFailed);
    };
  }, [hydrated]);

  // Setup automatic token refresh based on expiration
  useEffect(() => {
    if (!token || !isAuthenticated) {
      if (refreshInterval) {
        clearInterval(refreshInterval);
        setRefreshInterval(null);
      }
      return;
    }

    try {
      const decoded: TokenPayload = jwtDecode(token);
      const currentTime = Math.floor(Date.now() / 1000);
      const expiresIn = decoded.exp - currentTime;
      
      // Refresh token 5 minutes before it expires, but not less than 30 seconds
      const refreshTime = Math.max(30, (expiresIn - 300) * 1000);
      
      if (refreshTime > 0) {
        const interval = setTimeout(() => {
          console.log('Auto-refreshing token before expiration...');
          refreshToken();
        }, refreshTime);
        
        setRefreshInterval(interval);
        
        return () => {
          clearTimeout(interval);
        };
      } else {
        // Token is already expired or expires very soon, refresh immediately
        console.log('Token expired or expiring soon, refreshing immediately...');
        refreshToken();
      }
    } catch (error) {
      console.error('Error decoding token:', error);
      logout();
    }
  }, [token, isAuthenticated]);

  useEffect(() => {
    const initializeAuth = async () => {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        try {
          // Set a timeout for the authentication check
          const authPromise = fetchUserProfile();
          const timeoutPromise = new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Authentication timeout')), 10000)
          );
          
          await Promise.race([authPromise, timeoutPromise]);
          // Don't set isAuthenticated here - fetchUserProfile already does it
        } catch (error: any) {
          console.error('Auth initialization failed:', error);
          // Only clear tokens if it's an authentication error (401), not timeout or network errors
          if (error.response?.status === 401 || error.message?.includes('401')) {
            console.log('Token invalid, clearing auth data');
            localStorage.removeItem('token');
            localStorage.removeItem('refreshToken');
            setToken(null);
            setUser(null);
            setIsAuthenticated(false);
          } else {
            // For timeouts or network errors, keep the token but mark as not authenticated
            // The user can try again
            console.log('Temporary error, keeping token for retry');
            setIsAuthenticated(false);
          }
        }
      }
      setIsLoading(false);
    };
    
    // Only initialize after hydration
    if (hydrated) {
      initializeAuth();
    }
  }, [hydrated]);

  const fetchUserProfile = async () => {
    if (!token) {
      setIsAuthenticated(false);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      // Add timeout to user data fetch
      const userPromise = AuthService.getCurrentUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      );
      
      const userData = await Promise.race([userPromise, timeoutPromise]);
      setUser(userData as User);
      setIsAuthenticated(true);
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      // Re-throw the error so initializeAuth can handle it appropriately
      setIsAuthenticated(false);
      setUser(null);
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
        return '/instructor/dashboard';
      case 'student':
      default:
        return '/student/dashboard';
    }
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    try {
      const authData = await AuthService.login({ identifier, password });
      
      // Store tokens and set state
      localStorage.setItem('token', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      setToken(authData.access_token);
      setUser(authData.user);
      setIsAuthenticated(true);
      
      // Log successful login
      console.log(`AuthContext: User ${authData.user.role} logged in successfully`);
      
      // Give the state a moment to properly update
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
      
      // Return the user data so LoginForm can redirect immediately
      return authData;
    } catch (error) {
      setIsAuthenticated(false);
      setIsLoading(false);
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
    console.log('AuthContext: Performing logout');
    
    // Clear refresh interval
    if (refreshInterval) {
      clearInterval(refreshInterval);
      setRefreshInterval(null);
    }
    
    // Immediately clear local state to prevent loops
    setIsLoading(false);
    setIsAuthenticated(false);
    setUser(null);
    setToken(null);
    
    // Clear storage
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Call logout endpoint (fire and forget - don't wait for it)
    AuthService.logout().catch(console.error);
    
    // Force navigation to login page
    setTimeout(() => {
      window.location.href = '/auth/login';
    }, 100);
  };

  /**
   * Refreshes the access token using the refresh token
   * @returns Whether the refresh was successful
   */
  const refreshToken = async (): Promise<boolean> => {
    try {
      const refreshTokenValue = localStorage.getItem('refreshToken');
      if (!refreshTokenValue) {
        console.warn('No refresh token available');
        logout();
        return false;
      }

      console.log('Refreshing access token...');
      const response = await AuthService.refreshToken();
      
      // Update localStorage and state
      localStorage.setItem('token', response.access_token);
      setToken(response.access_token);
      
      console.log('Token refreshed successfully');
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      // Only logout if we're currently authenticated (avoid loops)
      if (isAuthenticated) {
        logout();
      }
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
      changePassword
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