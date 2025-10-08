'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissions } from '@/lib/permissions';

/**
 * A utility component to protect guest routes (like login, register) from authenticated users
 * Enhanced with proper timeout handling and role-based redirects using the permissions system
 * @param children The components to render if the user is not authenticated
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user, refreshToken } = useAuth();
  const router = useRouter();
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [redirectStartTime, setRedirectStartTime] = useState<number>(0);

  const handleRedirect = useCallback(async () => {
    if (!isAuthenticated || !user) return;

    try {
      setIsRedirecting(true);
      setError(null);
      setRedirectStartTime(Date.now());

      // Get the appropriate dashboard route using our permissions utility
      const dashboardRoute = RolePermissions.getDashboardRoute(user.role);
      
      console.log(`GuestGuard: Redirecting authenticated ${user.role} user to ${dashboardRoute}`);
      
      // Use window.location.href for reliable redirect
      window.location.href = dashboardRoute;
    } catch (err) {
      console.error('GuestGuard: Error during redirect:', err);
      setError('Failed to redirect. Please try again.');
      setIsRedirecting(false);
    }
  }, [isAuthenticated, user, router]);

  useEffect(() => {
    // Don't redirect if we're already in the process of redirecting
    if (isRedirecting) return;

    // Create a timeout for authentication checking
    const authTimeout = setTimeout(() => {
      if (isLoading && retryCount < 2) {
        console.log(`GuestGuard: Authentication taking too long, retry ${retryCount + 1}/3`);
        setRetryCount(prev => prev + 1);
      } else if (isLoading && retryCount >= 2) {
        console.warn('GuestGuard: Authentication timeout, showing children');
        setError('Authentication check timed out. Please refresh if you\'re having issues.');
      }
    }, 5000); // 5 second timeout

    // Wait for authentication to complete
    if (!isLoading && isAuthenticated && user) {
      clearTimeout(authTimeout);
      handleRedirect();
    } else if (!isLoading && !isAuthenticated) {
      clearTimeout(authTimeout);
      setIsRedirecting(false);
      setError(null);
    }

    return () => clearTimeout(authTimeout);
  }, [isAuthenticated, isLoading, user, handleRedirect, retryCount, isRedirecting]);

  // Show loading while checking authentication
  if (isLoading || isRedirecting) {
    const elapsed = isRedirecting && redirectStartTime > 0 
      ? Math.floor((Date.now() - redirectStartTime) / 1000) 
      : 0;
    const showManualRedirect = elapsed > 5;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-lg text-white mb-2">
            {isLoading ? 'Checking authentication...' : 'Redirecting to dashboard...'}
          </p>
          <p className="text-sm text-slate-400 mb-4">
            {isLoading ? 'Please wait while we verify your session' : 'Taking you to your dashboard'}
          </p>
          
          {isRedirecting && elapsed > 0 && (
            <div className="text-xs text-slate-500 mb-4">
              Elapsed: {elapsed}s
            </div>
          )}
          
          {showManualRedirect && user && (
            <div className="mt-4 p-4 bg-slate-800/50 border border-slate-700 rounded-lg max-w-sm mx-auto">
              <p className="text-sm text-slate-300 mb-3">
                Taking longer than expected?
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const dashboardRoute = RolePermissions.getDashboardRoute(user.role);
                    window.location.href = dashboardRoute; // Force redirect
                  }}
                  className="w-full px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-lg transition-colors text-sm"
                >
                  Click here to go to Dashboard
                </button>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full px-3 py-1 bg-slate-600 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
                >
                  Refresh Page
                </button>
                <button
                  onClick={() => {
                    localStorage.removeItem('token');
                    localStorage.removeItem('refreshToken');
                    window.location.href = '/auth/login';
                  }}
                  className="w-full px-3 py-1 bg-red-600 hover:bg-red-700 text-red-200 rounded text-xs transition-colors"
                >
                  Return to Login
                </button>
              </div>
            </div>
          )}
          
          {error && (
            <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg max-w-md mx-auto">
              <p className="text-amber-200 text-sm">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // If not authenticated, render the children (login form)
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback while redirecting (should rarely be seen due to isRedirecting state)
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500 mx-auto mb-4"></div>
        <p className="text-lg text-white mb-2">Redirecting...</p>
        <p className="text-sm text-slate-400">Taking you to your dashboard</p>
        {error && (
          <div className="mt-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg max-w-md mx-auto">
            <p className="text-red-200 text-sm">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-2 px-3 py-1 bg-red-500/30 hover:bg-red-500/40 text-red-200 rounded text-xs transition-colors"
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}