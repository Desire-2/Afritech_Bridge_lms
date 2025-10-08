'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A utility component to protect routes that require student role
 * @param children The components to render if the user has student role
 */
export function StudentGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated, logout } = useAuth();
  const router = useRouter();
  const [loadingStartTime] = useState(Date.now());
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);

  useEffect(() => {
    // Check for loading timeout (15 seconds)
    const timeoutCheck = setInterval(() => {
      if (isLoading) {
        const elapsed = Date.now() - loadingStartTime;
        if (elapsed > 15000) {
          console.warn('StudentGuard: Loading timeout, forcing logout');
          logout();
          clearInterval(timeoutCheck);
        }
      } else {
        clearInterval(timeoutCheck);
      }
    }, 1000);

    // Wait for authentication to complete
    if (!isLoading && !hasCheckedPermissions) {
      clearInterval(timeoutCheck);
      
      // If not authenticated, redirect to login
      if (!isAuthenticated) {
        console.log('StudentGuard: Not authenticated, redirecting to login');
        setHasCheckedPermissions(true);
        router.push('/auth/login');
        return;
      } 
      // If authenticated but not a student, redirect to their appropriate dashboard
      else if (user?.role !== 'student') {
        console.log('StudentGuard: User role is', user?.role, ', redirecting to appropriate dashboard');
        setHasCheckedPermissions(true);
        // Redirect to the appropriate dashboard based on role
        if (user?.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (user?.role === 'instructor') {
          router.push('/instructor/dashboard');
        } else {
          // Fallback for unknown roles
          router.push('/auth/login');
        }
        return;
      } else {
        // User is student, allow access
        setHasCheckedPermissions(true);
      }
    }

    return () => clearInterval(timeoutCheck);
  }, [isAuthenticated, isLoading, router, user, logout, loadingStartTime, hasCheckedPermissions]);

  // Show loading with timeout info
  if (isLoading || !isAuthenticated) {
    const elapsed = Math.floor((Date.now() - loadingStartTime) / 1000);
    const showTimeoutWarning = elapsed > 8;
    
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center max-w-md">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-lg mb-2">Checking permissions...</p>
          {elapsed > 3 && (
            <p className="text-sm text-slate-400">Loading: {elapsed}s</p>
          )}
          {showTimeoutWarning && (
            <div className="mt-4 p-3 bg-amber-500/20 border border-amber-500/30 rounded-lg">
              <p className="text-amber-200 text-sm mb-2">Taking longer than expected</p>
              <button
                onClick={logout}
                className="px-3 py-1 bg-red-600 hover:bg-red-700 text-red-200 rounded text-sm transition-colors"
              >
                Return to Login
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}