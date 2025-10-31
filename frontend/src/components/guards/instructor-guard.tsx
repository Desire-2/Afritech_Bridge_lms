'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A utility component to protect routes that require instructor role
 * @param children The components to render if the user has instructor role
 */
export function InstructorGuard({ children }: { children: React.ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [hasCheckedPermissions, setHasCheckedPermissions] = useState(false);

  useEffect(() => {
    // Wait for authentication to complete
    if (!isLoading && !hasCheckedPermissions) {
      // If not authenticated, redirect to login with current path
      if (!isAuthenticated) {
        console.log('InstructorGuard: Not authenticated, redirecting to login');
        setHasCheckedPermissions(true);
        const currentPath = pathname || '/';
        const redirectUrl = `/auth/login?redirect=${encodeURIComponent(currentPath)}`;
        router.push(redirectUrl);
        return;
      } 
      // If authenticated but not an instructor, redirect to their appropriate dashboard
      else if (user?.role !== 'instructor') {
        console.log('InstructorGuard: User role is', user?.role, ', redirecting to appropriate dashboard');
        setHasCheckedPermissions(true);
        if (user?.role === 'admin') {
          router.push('/admin/dashboard');
        } else if (user?.role === 'student') {
          router.push('/student/dashboard');
        } else {
          // Fallback to student dashboard for unknown roles
          router.push('/student/dashboard');
        }
        return;
      } else {
        // User is instructor, allow access
        setHasCheckedPermissions(true);
      }
    }
  }, [isAuthenticated, isLoading, router, user, hasCheckedPermissions]);

  // Show loading screen only during initial load
  if (isLoading && !hasCheckedPermissions) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:to-gray-800">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-sky-500 mx-auto mb-4"></div>
          <p className="text-lg text-gray-700 dark:text-gray-300">Loading instructor dashboard...</p>
        </div>
      </div>
    );
  }

  // Don't show anything if we're redirecting
  if (!isAuthenticated || user?.role !== 'instructor') {
    return null;
  }

  return <>{children}</>;
}