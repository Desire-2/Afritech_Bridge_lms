'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissions, UserRole, canAccessRoute } from '@/lib/permissions';
import { jwtDecode } from 'jwt-decode';

interface TokenPayload {
  exp: number;
  iat: number;
  sub: number;
  role?: string;
}

interface SessionError {
  type: 'EXPIRED' | 'INVALID' | 'UNAUTHORIZED' | 'PERMISSION_DENIED' | 'TIMEOUT';
  message: string;
  redirect?: string;
}

// Configuration constants
const AUTH_TIMEOUT = 10000; // 10 seconds timeout for auth operations
const MAX_RETRY_ATTEMPTS = 2;
const RETRY_DELAY = 1500; // 1.5 seconds between retries

/**
 * Enhanced component that redirects users to their appropriate dashboard based on authentication status, role, and permissions
 * Handles page refresh, session validation, token expiration, and timeout scenarios
 */
export default function RootRedirect() {
  const { isAuthenticated, isLoading, user, token, refreshToken, fetchUserProfile } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  
  const [isValidating, setIsValidating] = useState(true);
  const [sessionError, setSessionError] = useState<SessionError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [timeoutReached, setTimeoutReached] = useState(false);
  
  // Refs for cleanup
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const validationStartTime = useRef<number>(Date.now());

  // Handle hydration
  useEffect(() => {
    setMounted(true);
    validationStartTime.current = Date.now();
  }, []);

  /**
   * Create a promise that rejects after a specified timeout
   */
  const withTimeout = useCallback(<T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error(`Operation timed out after ${ms}ms`));
      }, ms);

      promise
        .then(resolve)
        .catch(reject)
        .finally(() => clearTimeout(timeoutId));
    });
  }, []);

  /**
   * Force redirect to login with timeout message
   */
  const forceLoginRedirect = useCallback((reason: string = 'Authentication timeout') => {
    console.warn(`Forcing login redirect: ${reason}`);
    setSessionError({
      type: 'TIMEOUT',
      message: `${reason}. Redirecting to login...`,
      redirect: `/auth/login?redirect=${encodeURIComponent(pathname)}&reason=timeout`
    });
    
    // Immediate redirect for timeout scenarios
    setTimeout(() => {
      router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}&reason=timeout`);
    }, 1000);
  }, [pathname, router]);

  /**
   * Validate the current session and token with timeout protection
   */
  const validateSession = useCallback(async (): Promise<boolean> => {
    try {
      if (!token) {
        console.warn('No token found during session validation');
        return false;
      }

      // Create validation promise with timeout
      const validationPromise = new Promise<boolean>(async (resolve, reject) => {
        try {
          // Decode and check token expiration
          const decoded = jwtDecode<TokenPayload>(token);
          const now = Math.floor(Date.now() / 1000);
          const timeUntilExpiry = decoded.exp - now;

          // If token expires in less than 5 minutes, try to refresh
          if (timeUntilExpiry < 300 && timeUntilExpiry > 0) {
            console.log('Token expiring soon, attempting refresh...');
            const refreshed = await withTimeout(refreshToken(), 5000);
            if (!refreshed) {
              setSessionError({
                type: 'EXPIRED',
                message: 'Session expired. Please log in again.',
                redirect: `/auth/login?redirect=${encodeURIComponent(pathname)}`
              });
              resolve(false);
              return;
            }
          }

          // If token is expired
          if (decoded.exp <= now) {
            console.warn('Token has expired');
            setSessionError({
              type: 'EXPIRED',
              message: 'Session expired. Please log in again.',
              redirect: `/auth/login?redirect=${encodeURIComponent(pathname)}`
            });
            resolve(false);
            return;
          }

          // Validate user profile if not already loaded
          if (!user && isAuthenticated) {
            console.log('Fetching user profile for session validation...');
            await withTimeout(fetchUserProfile(), 5000);
          }

          resolve(true);
        } catch (error) {
          reject(error);
        }
      });

      return await withTimeout(validationPromise, AUTH_TIMEOUT);

    } catch (error) {
      console.error('Session validation failed:', error);
      
      if (error instanceof Error && error.message.includes('timed out')) {
        forceLoginRedirect('Session validation timed out');
        return false;
      }
      
      setSessionError({
        type: 'INVALID',
        message: 'Invalid session. Please log in again.',
        redirect: `/auth/login?redirect=${encodeURIComponent(pathname)}`
      });
      return false;
    }
  }, [token, refreshToken, user, isAuthenticated, fetchUserProfile, pathname, withTimeout, forceLoginRedirect]);

  /**
   * Check if the user has permission to access the current route with fallback
   */
  const checkRoutePermissions = useCallback((userRole: string, currentPath: string): boolean => {
    try {
      if (!userRole) {
        console.warn('No user role provided for permission check');
        return false;
      }

      if (!RolePermissions.isValidRole(userRole)) {
        console.warn(`Invalid user role: ${userRole}`);
        return false;
      }

      const hasAccess = canAccessRoute(userRole as UserRole, currentPath);
      console.log(`Permission check for ${userRole} on ${currentPath}: ${hasAccess}`);
      return hasAccess;
    } catch (error) {
      console.error('Error checking route permissions:', error);
      return false; // Fail safe - deny access on error
    }
  }, []);

  /**
   * Get the appropriate redirect URL based on user role and current path with fallback
   */
  const getRedirectUrl = useCallback((userRole: string, currentPath: string): string => {
    try {
      // If on the root path, redirect to dashboard
      if (currentPath === '/') {
        return RolePermissions.getDashboardRoute(userRole);
      }

      // If user doesn't have permission for current route, redirect to their dashboard
      if (!checkRoutePermissions(userRole, currentPath)) {
        console.log(`User ${userRole} doesn't have permission for ${currentPath}, redirecting to dashboard`);
        return RolePermissions.getDashboardRoute(userRole);
      }

      // User has permission for current route, stay here
      return currentPath;
    } catch (error) {
      console.error('Error determining redirect URL:', error);
      // Fallback to default dashboard or login
      return userRole ? RolePermissions.getDashboardRoute(userRole) : '/auth/login';
    }
  }, [checkRoutePermissions]);

  /**
   * Handle the redirect logic with comprehensive timeout and error handling
   */
  const handleRedirect = useCallback(async () => {
    try {
      setIsValidating(true);
      setSessionError(null);

      // Only proceed after mounting to avoid hydration issues
      if (!mounted) return;

      // Check for overall timeout
      const elapsed = Date.now() - validationStartTime.current;
      if (elapsed > AUTH_TIMEOUT * 2) {
        forceLoginRedirect('Authentication process timed out');
        return;
      }

      // Wait for auth loading to complete with timeout
      if (isLoading) {
        if (elapsed > AUTH_TIMEOUT) {
          forceLoginRedirect('Authentication loading timed out');
          return;
        }
        return; // Continue waiting
      }

      // If not authenticated, handle appropriately
      if (!isAuthenticated) {
        if (pathname === '/' || pathname.startsWith('/auth/') || pathname.startsWith('/courses')) {
          console.log('User not authenticated, allowing access to public route:', pathname);
          setIsValidating(false);
          return;
        }
        
        // For protected routes, redirect to login
        console.log('User not authenticated, redirecting to login from:', pathname);
        router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`);
        return;
      }

      // Validate the session with timeout protection
      const isValidSession = await validateSession();
      if (!isValidSession) {
        setIsValidating(false);
        return; // Error handling is done in validateSession
      }

      // Check if we have user data with retry logic
      if (!user) {
        if (retryCount < MAX_RETRY_ATTEMPTS) {
          console.log(`User data not available, retrying... (${retryCount + 1}/${MAX_RETRY_ATTEMPTS})`);
          setRetryCount(prev => prev + 1);
          
          // Retry after delay, but check for overall timeout
          setTimeout(() => {
            const totalElapsed = Date.now() - validationStartTime.current;
            if (totalElapsed < AUTH_TIMEOUT * 1.5) {
              handleRedirect();
            } else {
              forceLoginRedirect('User data loading timed out');
            }
          }, RETRY_DELAY);
          return;
        } else {
          forceLoginRedirect('Unable to load user information after multiple attempts');
          return;
        }
      }

      // Validate user role
      if (!user.role) {
        console.error('User has no role assigned');
        setSessionError({
          type: 'UNAUTHORIZED',
          message: 'User account is not properly configured. Please contact support.',
          redirect: '/auth/login'
        });
        setIsValidating(false);
        return;
      }

      // Check permissions and determine redirect
      const redirectUrl = getRedirectUrl(user.role, pathname);
      
      if (redirectUrl !== pathname) {
        console.log(`Redirecting from ${pathname} to ${redirectUrl} for user role: ${user.role}`);
        router.push(redirectUrl);
      } else {
        console.log(`User ${user.role} has permission for ${pathname}, staying on current page`);
      }

    } catch (error) {
      console.error('Error during redirect handling:', error);
      
      // Check if it's a timeout error
      if (error instanceof Error && error.message.includes('timed out')) {
        forceLoginRedirect('Redirect process timed out');
      } else {
        setSessionError({
          type: 'INVALID',
          message: 'An unexpected error occurred. Please try logging in again.',
          redirect: `/auth/login?redirect=${encodeURIComponent(pathname)}`
        });
      }
    } finally {
      setIsValidating(false);
    }
  }, [
    mounted,
    isLoading, 
    isAuthenticated, 
    user, 
    pathname, 
    router, 
    validateSession, 
    getRedirectUrl, 
    retryCount,
    forceLoginRedirect
  ]);

  // Handle session errors with faster redirect for timeouts
  useEffect(() => {
    if (sessionError?.redirect) {
      const isTimeout = sessionError.type === 'TIMEOUT';
      const delay = isTimeout ? 1000 : 2000; // Faster redirect for timeouts
      
      const timer = setTimeout(() => {
        router.push(sessionError.redirect!);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [sessionError, router]);

  // Global timeout effect to prevent infinite loading
  useEffect(() => {
    if (mounted && !timeoutReached) {
      timeoutRef.current = setTimeout(() => {
        if (isValidating || isLoading) {
          console.warn('Global timeout reached, forcing redirect to login');
          setTimeoutReached(true);
          forceLoginRedirect('Page load timed out');
        }
      }, AUTH_TIMEOUT * 2);

      return () => {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
      };
    }
  }, [mounted, timeoutReached, isValidating, isLoading, forceLoginRedirect]);

  // Main effect for handling redirects
  useEffect(() => {
    if (mounted && !timeoutReached) {
      handleRedirect();
    }
  }, [mounted, handleRedirect, timeoutReached]);

  // Reset retry count and timeout when authentication state changes
  useEffect(() => {
    setRetryCount(0);
    setTimeoutReached(false);
    validationStartTime.current = Date.now();
    
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, [isAuthenticated, user]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  // Show loading state with timeout warning
  if (!mounted || isLoading || (isValidating && !timeoutReached)) {
    const elapsed = Math.floor((Date.now() - validationStartTime.current) / 1000);
    const showTimeoutWarning = elapsed > 5;
    const showManualRedirect = elapsed > 8;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-center max-w-md mx-auto p-6">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg font-medium text-gray-700 mb-2">
            {!mounted ? 'Initializing...' : 
             isLoading ? 'Checking authentication...' : 
             'Redirecting to dashboard...'}
          </p>
          <p className="text-sm text-gray-500">
            {!mounted ? 'Please wait while we initialize the application' :
             isLoading ? 'Please wait while we verify your permissions' :
             'Taking you to your dashboard...'}
          </p>
          
          {showTimeoutWarning && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-700 mb-3">
                This is taking longer than usual. 
                {showManualRedirect && " Click below if you'd like to proceed manually."}
              </p>
              {showManualRedirect && user && (
                <div className="space-y-2">
                  <button
                    onClick={() => {
                      const dashboardRoute = RolePermissions.getDashboardRoute(user.role);
                      router.push(dashboardRoute);
                    }}
                    className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                  >
                    Go to Dashboard Now
                  </button>
                  <button
                    onClick={() => forceLoginRedirect('Manual redirect requested')}
                    className="w-full px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700 text-xs"
                  >
                    Go to Login Instead
                  </button>
                </div>
              )}
              {!showManualRedirect && (
                <button
                  onClick={() => forceLoginRedirect('Manual redirect requested')}
                  className="text-xs px-3 py-1 bg-yellow-600 text-white rounded hover:bg-yellow-700"
                >
                  Go to Login Now
                </button>
              )}
            </div>
          )}
          
          <div className="mt-4 text-xs text-gray-400">
            Elapsed: {elapsed}s
          </div>
        </div>
      </div>
    );
  }

  // Show error state with enhanced feedback
  if (sessionError || timeoutReached) {
    const isTimeout = sessionError?.type === 'TIMEOUT' || timeoutReached;
    const iconColor = isTimeout ? 'text-yellow-600' : 'text-red-600';
    const bgColor = isTimeout ? 'from-yellow-50 to-orange-100' : 'from-red-50 to-orange-100';
    
    return (
      <div className={`flex items-center justify-center min-h-screen bg-gradient-to-br ${bgColor}`}>
        <div className="text-center max-w-md mx-auto p-6">
          <div className={`w-16 h-16 mx-auto mb-4 ${isTimeout ? 'bg-yellow-100' : 'bg-red-100'} rounded-full flex items-center justify-center`}>
            {isTimeout ? (
              <svg className={`w-8 h-8 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg className={`w-8 h-8 ${iconColor}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            )}
          </div>
          
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            {isTimeout ? 'Connection Timeout' : 'Session Error'}
          </h2>
          
          <p className="text-gray-600 mb-4">
            {sessionError?.message || 'The authentication process timed out. Please try logging in again.'}
          </p>
          
          <div className="space-y-2">
            <button
              onClick={() => router.push(`/auth/login?redirect=${encodeURIComponent(pathname)}`)}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Go to Login
            </button>
            
            <button
              onClick={() => window.location.reload()}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Try Again
            </button>
          </div>
          
          {sessionError?.redirect && !isTimeout && (
            <p className="text-sm text-gray-500 mt-4">
              Redirecting automatically in a moment...
            </p>
          )}
        </div>
      </div>
    );
  }

  // Component doesn't render anything when everything is working correctly
  return null;
}