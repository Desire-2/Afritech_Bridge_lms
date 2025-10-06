'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, ComponentType } from 'react';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';

interface WithStudentAuthOptions {
  redirectTo?: string;
  allowedRoles?: string[];
  fallbackMessage?: string;
}

/**
 * Higher-order component that protects student routes
 * Ensures user is authenticated and has student role
 */
export function withStudentAuth<P extends object>(
  WrappedComponent: ComponentType<P>,
  options: WithStudentAuthOptions = {}
) {
  const {
    redirectTo = '/auth/login',
    allowedRoles = ['student'],
    fallbackMessage = 'You need student access to view this page.'
  } = options;

  return function StudentProtectedComponent(props: P) {
    const { user, isAuthenticated, isLoading } = useAuth();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);

    // Handle hydration
    useEffect(() => {
      setMounted(true);
    }, []);

    // Redirect if not authenticated
    useEffect(() => {
      if (mounted && !isLoading && !isAuthenticated) {
        const currentPath = window.location.pathname;
        router.push(`${redirectTo}?redirect=${encodeURIComponent(currentPath)}`);
      }
    }, [mounted, isAuthenticated, isLoading, router]);

    // Check user role permission
    useEffect(() => {
      if (mounted && !isLoading && isAuthenticated && user && !allowedRoles.includes(user.role)) {
        // Redirect to appropriate dashboard based on role
        const dashboardRoute = user.role === 'admin' 
          ? '/admin/dashboard' 
          : user.role === 'instructor' 
          ? '/instructor/dashboard' 
          : '/dashboard';
        router.push(dashboardRoute);
      }
    }, [mounted, isAuthenticated, isLoading, user, router]);

    // Loading state during hydration
    if (!mounted) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
            <p className="text-gray-600">Loading...</p>
          </div>
        </div>
      );
    }

    // Loading state during authentication check
    if (isLoading) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-indigo-600" />
            <p className="text-gray-600">Verifying authentication...</p>
          </div>
        </div>
      );
    }

    // Not authenticated
    if (!isAuthenticated) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <ShieldAlert className="w-16 h-16 mx-auto mb-4 text-red-500" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please log in to access this page.
            </p>
            <button
              onClick={() => {
                const currentPath = window.location.pathname;
                router.push(`${redirectTo}?redirect=${encodeURIComponent(currentPath)}`);
              }}
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      );
    }

    // Wrong role
    if (user && !allowedRoles.includes(user.role)) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <div className="text-center max-w-md mx-auto p-6">
            <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
            <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
            <p className="text-gray-600 mb-4">
              {fallbackMessage}
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Current role: <span className="font-medium capitalize">{user.role}</span>
            </p>
            <div className="space-y-3">
              <button
                onClick={() => {
                  const dashboardRoute = user.role === 'admin' 
                    ? '/admin/dashboard' 
                    : user.role === 'instructor' 
                    ? '/instructor/dashboard' 
                    : '/dashboard';
                  router.push(dashboardRoute);
                }}
                className="w-full px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Go to {user.role === 'admin' ? 'Admin' : user.role === 'instructor' ? 'Instructor' : 'Main'} Dashboard
              </button>
              <button
                onClick={() => router.push('/dashboard')}
                className="w-full px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Go to Home
              </button>
            </div>
          </div>
        </div>
      );
    }

    // Authenticated and authorized - render the component
    return <WrappedComponent {...props} />;
  };
}

/**
 * Hook for checking student authentication status
 */
export function useStudentAuth() {
  const { user, isAuthenticated, isLoading } = useAuth();
  
  const isStudent = user?.role === 'student';
  const hasAccess = isAuthenticated && isStudent;
  
  return {
    user,
    isAuthenticated,
    isLoading,
    isStudent,
    hasAccess,
    role: user?.role
  };
}

/**
 * Hook for requiring student access
 * Throws error if user is not a student
 */
export function useRequireStudentAuth() {
  const auth = useStudentAuth();
  const router = useRouter();
  
  useEffect(() => {
    if (!auth.isLoading && !auth.hasAccess) {
      if (!auth.isAuthenticated) {
        router.push('/auth/login?redirect=' + encodeURIComponent(window.location.pathname));
      } else if (!auth.isStudent) {
        const dashboardRoute = auth.user?.role === 'admin' 
          ? '/admin/dashboard' 
          : auth.user?.role === 'instructor' 
          ? '/instructor/dashboard' 
          : '/dashboard';
        router.push(dashboardRoute);
      }
    }
  }, [auth, router]);
  
  return auth;
}