'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '@/services/auth.service';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, LoginRequest, RegisterRequest } from '@/types/api';
import { RolePermissions, UserRole } from '@/lib/permissions';

interface TokenPayload {
  exp: number;
  iat: number;
  jti: string;
  type: string;
  sub: number;
  nbf: number;
  fresh: boolean;
}

interface SessionError {
  type: 'UNAUTHORIZED' | 'FORBIDDEN' | 'SESSION_EXPIRED' | 'NETWORK_ERROR' | 'UNKNOWN';
  message: string;
  timestamp: number;
  path?: string;
  requiredRole?: string;
  userRole?: string;
}

interface SessionState {
  isValid: boolean;
  expiresAt: number | null;
  lastActivity: number;
  refreshCount: number;
  maxRefreshCount: number;
}

interface EnhancedAuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionState: SessionState;
  lastError: SessionError | null;
  
  // Auth methods
  login: (identifier: string, password: string) => Promise<void>;
  register: (userData: RegisterRequest) => Promise<void>;
  logout: (reason?: string) => void;
  fetchUserProfile: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  
  // Session methods
  validateSession: () => Promise<boolean>;
  checkPermission: (requiredRole: UserRole | UserRole[], path?: string) => boolean;
  clearError: () => void;
  recordActivity: () => void;
  
  // Error handlers
  handleUnauthorized: (path?: string) => void;
  handleForbidden: (requiredRole: string, path?: string) => void;
  handleSessionExpired: () => void;
}

const INITIAL_SESSION_STATE: SessionState = {
  isValid: false,
  expiresAt: null,
  lastActivity: Date.now(),
  refreshCount: 0,
  maxRefreshCount: 3
};

export const EnhancedAuthContext = createContext<EnhancedAuthContextType | undefined>(undefined);

export const EnhancedAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [sessionState, setSessionState] = useState<SessionState>(INITIAL_SESSION_STATE);
  const [lastError, setLastError] = useState<SessionError | null>(null);
  const [mounted, setMounted] = useState(false);
  
  const router = useRouter();
  const pathname = usePathname();

  // Mount detection
  useEffect(() => {
    setMounted(true);
  }, []);

  // Session validation timer
  useEffect(() => {
    if (!mounted) return;

    const interval = setInterval(async () => {
      if (isAuthenticated && token) {
        const isValid = await validateSession();
        if (!isValid) {
          handleSessionExpired();
        }
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [isAuthenticated, token, mounted]);

  // Activity tracking
  useEffect(() => {
    if (!mounted) return;

    const handleActivity = () => recordActivity();
    
    // Track user activity
    window.addEventListener('click', handleActivity);
    window.addEventListener('keydown', handleActivity);
    window.addEventListener('scroll', handleActivity);
    
    return () => {
      window.removeEventListener('click', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('scroll', handleActivity);
    };
  }, [mounted]);

  // Initialize auth on mount
  useEffect(() => {
    if (!mounted) return;
    initializeAuth();
  }, [mounted]);

  const recordActivity = () => {
    setSessionState(prev => ({
      ...prev,
      lastActivity: Date.now()
    }));
  };

  const clearError = () => {
    setLastError(null);
  };

  const createError = (
    type: SessionError['type'], 
    message: string, 
    additionalData?: Partial<SessionError>
  ): SessionError => ({
    type,
    message,
    timestamp: Date.now(),
    path: pathname,
    ...additionalData
  });

  const handleUnauthorized = (path?: string) => {
    const error = createError(
      'UNAUTHORIZED', 
      'Authentication required to access this resource.',
      { path }
    );
    setLastError(error);
    
    // Clear auth state
    clearAuthState();
    
    // Redirect to login with return path
    const redirectPath = path || pathname;
    router.push(`/auth/login?redirect=${encodeURIComponent(redirectPath)}&error=unauthorized`);
  };

  const handleForbidden = (requiredRole: string, path?: string) => {
    const error = createError(
      'FORBIDDEN',
      `Access denied. Required role: ${requiredRole}`,
      { path, requiredRole, userRole: user?.role }
    );
    setLastError(error);
    
    // Redirect to appropriate dashboard
    const dashboardRoute = RolePermissions.getDashboardRoute(user?.role);
    router.push(`${dashboardRoute}?error=forbidden&required=${requiredRole}`);
  };

  const handleSessionExpired = () => {
    const error = createError(
      'SESSION_EXPIRED',
      'Your session has expired. Please log in again.'
    );
    setLastError(error);
    
    // Clear auth state
    clearAuthState();
    
    // Redirect to login
    router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}&error=expired`);
  };

  const clearAuthState = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('refreshToken');
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setSessionState(INITIAL_SESSION_STATE);
  };

  const validateSession = async (): Promise<boolean> => {
    if (!token) return false;

    try {
      // Decode token to check expiration
      const decoded = jwtDecode<TokenPayload>(token);
      const now = Math.floor(Date.now() / 1000);
      
      // Check if token is expired
      if (decoded.exp < now) {
        // Try to refresh token
        const refreshed = await refreshToken();
        if (!refreshed) {
          return false;
        }
      }

      // Update session state
      setSessionState(prev => ({
        ...prev,
        isValid: true,
        expiresAt: decoded.exp * 1000,
        lastActivity: Date.now()
      }));

      return true;
    } catch (error) {
      console.error('Session validation failed:', error);
      return false;
    }
  };

  const checkPermission = (
    requiredRole: UserRole | UserRole[], 
    path?: string
  ): boolean => {
    if (!isAuthenticated || !user) {
      handleUnauthorized(path);
      return false;
    }

    const userRole = user.role as UserRole;
    const requiredRoles = Array.isArray(requiredRole) ? requiredRole : [requiredRole];
    
    if (!requiredRoles.includes(userRole)) {
      handleForbidden(requiredRoles.join(' or '), path);
      return false;
    }

    return true;
  };

  const initializeAuth = async () => {
    setIsLoading(true);
    
    try {
      const storedToken = localStorage.getItem('token');
      if (storedToken) {
        setToken(storedToken);
        
        // Validate session
        const isValid = await validateSession();
        if (isValid) {
          await fetchUserProfile();
          setIsAuthenticated(true);
        } else {
          clearAuthState();
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
      clearAuthState();
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUserProfile = async () => {
    if (!token) {
      setIsAuthenticated(false);
      return;
    }

    try {
      const userData = await AuthService.getCurrentUser();
      setUser(userData);
      setIsAuthenticated(true);
      recordActivity();
    } catch (error) {
      console.error('Failed to fetch user profile:', error);
      
      if (error instanceof Error && error.message.includes('401')) {
        handleUnauthorized();
      } else {
        const sessionError = createError(
          'NETWORK_ERROR',
          'Failed to fetch user profile. Please check your connection.'
        );
        setLastError(sessionError);
      }
      
      throw error;
    }
  };

  const login = async (identifier: string, password: string) => {
    setIsLoading(true);
    clearError();
    
    try {
      const authData = await AuthService.login({ identifier, password });
      
      // Store tokens
      localStorage.setItem('token', authData.access_token);
      localStorage.setItem('refreshToken', authData.refresh_token);
      
      // Update state
      setToken(authData.access_token);
      setUser(authData.user);
      setIsAuthenticated(true);
      
      // Initialize session
      const decoded = jwtDecode<TokenPayload>(authData.access_token);
      setSessionState({
        isValid: true,
        expiresAt: decoded.exp * 1000,
        lastActivity: Date.now(),
        refreshCount: 0,
        maxRefreshCount: 3
      });
      
      // Redirect to appropriate dashboard
      const dashboardRoute = RolePermissions.getDashboardRoute(authData.user.role);
      
      setTimeout(() => {
        setIsLoading(false);
        router.push(dashboardRoute);
      }, 300);
      
    } catch (error) {
      setIsLoading(false);
      
      const sessionError = createError(
        'UNAUTHORIZED',
        error instanceof Error ? error.message : 'Login failed'
      );
      setLastError(sessionError);
      
      throw error;
    }
  };

  const register = async (userData: RegisterRequest) => {
    setIsLoading(true);
    clearError();
    
    try {
      await AuthService.register(userData);
      router.push('/auth/login?registered=true');
    } catch (error) {
      const sessionError = createError(
        'NETWORK_ERROR',
        error instanceof Error ? error.message : 'Registration failed'
      );
      setLastError(sessionError);
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = (reason?: string) => {
    // Call logout endpoint
    AuthService.logout().catch(console.error);
    
    // Clear state
    clearAuthState();
    clearError();
    
    // Redirect with reason
    const params = reason ? `?reason=${encodeURIComponent(reason)}` : '';
    router.push(`/auth/login${params}`);
  };

  const refreshToken = async (): Promise<boolean> => {
    if (sessionState.refreshCount >= sessionState.maxRefreshCount) {
      handleSessionExpired();
      return false;
    }

    try {
      const response = await AuthService.refreshToken();
      
      // Update tokens
      localStorage.setItem('token', response.access_token);
      setToken(response.access_token);
      
      // Update session state
      const decoded = jwtDecode<TokenPayload>(response.access_token);
      setSessionState(prev => ({
        ...prev,
        isValid: true,
        expiresAt: decoded.exp * 1000,
        refreshCount: prev.refreshCount + 1
      }));
      
      return true;
    } catch (error) {
      console.error('Token refresh failed:', error);
      handleSessionExpired();
      return false;
    }
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const updatedUser = await AuthService.updateProfile(userData);
      setUser(updatedUser);
      recordActivity();
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      await AuthService.changePassword(oldPassword, newPassword);
      recordActivity();
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  };

  const contextValue: EnhancedAuthContextType = {
    user,
    token,
    isLoading,
    isAuthenticated,
    sessionState,
    lastError,
    login,
    register,
    logout,
    fetchUserProfile,
    refreshToken,
    updateProfile,
    changePassword,
    validateSession,
    checkPermission,
    clearError,
    recordActivity,
    handleUnauthorized,
    handleForbidden,
    handleSessionExpired
  };

  return (
    <EnhancedAuthContext.Provider value={contextValue}>
      {children}
    </EnhancedAuthContext.Provider>
  );
};

export const useEnhancedAuth = (): EnhancedAuthContextType => {
  const context = useContext(EnhancedAuthContext);
  if (context === undefined) {
    throw new Error('useEnhancedAuth must be used within an EnhancedAuthProvider');
  }
  return context;
};