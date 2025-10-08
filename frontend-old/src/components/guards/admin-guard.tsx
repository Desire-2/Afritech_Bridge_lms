'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A utility component to protect routes that require admin role
 * @param children The components to render if the user has admin role
 */
export function AdminGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for authentication to complete
    if (!isLoading) {
      // If not authenticated, redirect to login
      if (!isAuthenticated) {
        console.log('AdminGuard: Not authenticated, redirecting to login');
        window.location.href = '/auth/login';
        return;
      } 
      // If authenticated but not an admin, redirect to dashboard
      else if (user?.role !== 'admin') {
        console.log('AdminGuard: User role is', user?.role, ', redirecting to dashboard');
        window.location.href = '/dashboard';
        return;
      }
    }
  }, [isAuthenticated, isLoading, router, user]);

  // Show nothing while checking authentication
  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-lg">Checking permissions...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}