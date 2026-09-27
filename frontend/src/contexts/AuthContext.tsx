'use client';
import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useHydrationFix } from '@/lib/hydration-fix';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '@/services/auth.service';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, LoginRequest, RegisterRequest, AuthResponse } from '@/types/api';

// Idle timeout advertised by the admin "Session Timeout (minutes)" setting.
// The settings panel publishes the saved value to localStorage; we fall back
// to the same 30 minute default the backend uses.
const SESSION_TIMEOUT_STORAGE_KEY = 'session_timeout_minutes';
const DEFAULT_SESSION_TIMEOUT_MINUTES = 30;

const getIdleTimeoutMs = (): number => {
  if (typeof window === 'undefined') return DEFAULT_SESSION_TIMEOUT_MINUTES * 60_000;
  const stored = Number(window.localStorage.getItem(SESSION_TIMEOUT_STORAGE_KEY));
  const minutes = Number.isFinite(stored) && stored > 0 ? stored : DEFAULT_SESSION_TIMEOUT_MINUTES;
  return minutes * 60_000;
};

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
  logout: (message?: string) => void;
  fetchUserProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  updateUser: (userData: Partial<User>) => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [refreshInterval, setRefreshInterval] = useState<NodeJS.Timeout | null>(null);
  // True last-activity timestamp for idle timeout. Kept in a ref so timer
  // callbacks never read a stale render's value.
  const lastActivityRef = useRef<number>(Date.now());
  // Keeps idle-timeout callbacks calling the latest `logout` closure
  const logoutRef = useRef<(message?: string) => void>(() => {});
  const router = useRouter();
  
  // Apply hydration fix
  useHydrationFix();
  
  // Mark when hydration is complete
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Track user activity (pointer, keyboard, touch, scroll) for idle timeout
  useEffect(() => {
    if (!hydrated) return;

    let lastRecorded = 0;
    const recordActivity = () => {
      const now = Date.now();
      // mousemove fires continuously - only record once a second
      if (now - lastRecorded < 1000) return;
      lastRecorded = now;
      lastActivityRef.current = now;
    };

    window.addEventListener('click', recordActivity);
    window.addEventListener('keydown', recordActivity);
    window.addEventListener('scroll', recordActivity);
    window.addEventListener('mousemove', recordActivity);
    window.addEventListener('touchstart', recordActivity);
    window.addEventListener('wheel', recordActivity);

    return () => {
      window.removeEventListener('click', recordActivity);
      window.removeEventListener('keydown', recordActivity);
      window.removeEventListener('scroll', recordActivity);
      window.removeEventListener('mousemove', recordActivity);
      window.removeEventListener('touchstart', recordActivity);
      window.removeEventListener('wheel', recordActivity);
    };
  }, [hydrated]);

  // Enforce "Automatic logout after inactivity" (admin session_timeout setting)
  useEffect(() => {
    if (!hydrated || !isAuthenticated) return;

    // Starting a session counts as activity - otherwise the very first idle
    // check would fire immediately with a lastActivity from page load.
    lastActivityRef.current = Date.now();

    const interval = setInterval(() => {
      if (Date.now() - lastActivityRef.current > getIdleTimeoutMs()) {
        clearInterval(interval);
        logoutRef.current('You have been logged out after a period of inactivity. Please log in again.');
      }
    }, 30_000); // Check every 30 seconds

    return () => clearInterval(interval);
  }, [hydrated, isAuthenticated]);

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
      const storedUser = localStorage.getItem('user');
      
      console.log('🔑 Initializing auth...', { hasToken: !!storedToken, hasUser: !!storedUser });
      
      if (storedToken) {
        setToken(storedToken);
        
        // Check if token is valid
        try {
          const decoded: TokenPayload = jwtDecode(storedToken);
          const currentTime = Math.floor(Date.now() / 1000);
          
          console.log('🕐 Token check:', { 
            expires: new Date(decoded.exp * 1000).toISOString(),
            current: new Date().toISOString(),
            isExpired: decoded.exp <= currentTime 
          });
          
          // If we have cached user data, set it immediately
          if (storedUser) {
            try {
              const parsedUser = JSON.parse(storedUser);
              setUser(parsedUser);
              setIsAuthenticated(true);
              console.log('✅ User restored from cache:', { id: parsedUser.id, email: parsedUser.email });
            } catch (parseError) {
              console.error('❌ Failed to parse stored user data:', parseError);
              localStorage.removeItem('user');
            }
          }
          
          // If token is expired, attempt refresh
          if (decoded.exp <= currentTime) {
            console.log('⚠️ Token expired, attempting refresh...');
            const refreshSuccess = await refreshToken();
            if (!refreshSuccess) {
              console.log('❌ Refresh failed, clearing auth data');
              localStorage.removeItem('token');
              localStorage.removeItem('refreshToken');
              localStorage.removeItem('user');
              setToken(null);
              setUser(null);
              setIsAuthenticated(false);
              setIsLoading(false);
              return;
            }
          }

          // If we don't have user data or token was refreshed, fetch fresh profile
          if (!storedUser || decoded.exp <= currentTime) {
            try {
              console.log('📥 Fetching fresh user profile...');
              const userData = await AuthService.getCurrentUser();
              setUser(userData);
              setIsAuthenticated(true);
              localStorage.setItem('user', JSON.stringify(userData));
              console.log('✅ User profile updated:', { id: userData.id, email: userData.email });
            } catch (error: any) {
              console.error('❌ Failed to fetch user profile:', error);
              
              // Only clear auth state if it's a 401 (unauthorized) error
              if (error.response?.status === 401) {
                console.log('❌ Token invalid (401), clearing auth data');
                localStorage.removeItem('token');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem('user');
                setToken(null);
                setUser(null);
                setIsAuthenticated(false);
              } else {
                // For network errors, keep using cached data if available
                console.log('⚠️ Network error - maintaining session with cached data');
                if (storedUser && !user) {
                  try {
                    const parsedUser = JSON.parse(storedUser);
                    setUser(parsedUser);
                    setIsAuthenticated(true);
                    console.log('✅ Fallback to cached user data');
                  } catch (parseError) {
                    console.error('❌ Failed to parse cached user data:', parseError);
                    setIsAuthenticated(false);
                  }
                }
              }
            }
          }
        } catch (tokenError) {
          console.error('❌ Error decoding token:', tokenError);
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');
          setToken(null);
          setUser(null);
          setIsAuthenticated(false);
        }
      } else {
        console.log('ℹ️ No token found - user not authenticated');
      }
      
      setIsLoading(false);
      console.log('✅ Auth initialization complete');
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
      // Increased timeout for better reliability with slower connections
      const userPromise = AuthService.getCurrentUser();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
      );
      
      const userData = await Promise.race([userPromise, timeoutPromise]);
      setUser(userData as User);
      setIsAuthenticated(true);
      
      // Cache user data for offline/error scenarios
      localStorage.setItem('user', JSON.stringify(userData));
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
      console.log('🔐 Attempting login for:', identifier);
      const authData = await AuthService.login({ identifier, password });
      
      console.log('✅ Login successful:', { 
        userId: authData.user.id, 
        email: authData.user.email, 
        role: authData.user.role 
      });
      
      // Store tokens and set state
      localStorage.setItem('token', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      localStorage.setItem('user', JSON.stringify(authData.user));
      
      setToken(authData.access_token);
      setUser(authData.user);
      setIsAuthenticated(true);
      
      // Give the state a moment to properly update
      setTimeout(() => {
        setIsLoading(false);
      }, 100);
      
      return authData;
    } catch (error) {
      console.error('❌ Login failed:', error);
      setIsAuthenticated(false);
      setIsLoading(false);
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

  const logout = (message?: string) => {
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
    
    // Clear storage including cached user data and learning progress
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      
      // Clear all learning progress data
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('learn_progress_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      
      console.log('Cleared learning progress data from localStorage');
    } catch (error) {
      console.error('Error clearing localStorage:', error);
    }
    
    // Call logout endpoint (fire and forget - don't wait for it)
    AuthService.logout().catch(console.error);
    
    // Force navigation to login page (optionally explaining why)
    const params = message ? `?message=${encodeURIComponent(message)}` : '';
    window.location.href = `/auth/login${params}`;
  };

  // Always call the latest logout from timers/refs
  useEffect(() => {
    logoutRef.current = logout;
  });

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

  const updateUser = (userData: Partial<User>) => {
    if (user) {
      const updatedUser = { ...user, ...userData };
      setUser(updatedUser);
      localStorage.setItem('user', JSON.stringify(updatedUser));
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
      updateUser
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