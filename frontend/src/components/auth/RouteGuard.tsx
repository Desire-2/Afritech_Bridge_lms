'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect, useState, ReactNode } from 'react';
import { Loader2, ShieldAlert, AlertTriangle } from 'lucide-react';
import { RolePermissions, UserRole } from '@/lib/permissions';

interface RouteGuardProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  fallbackRoute?: string;
  customMessage?: string;
  requireAuth?: boolean;
}

/**
 * Route guard component that protects routes based on authentication and roles
 */
export function RouteGuard({
  children,
  requiredRoles = [],
  fallbackRoute,
  customMessage,
  requireAuth = true
}: RouteGuardProps) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Authentication and authorization checks
  useEffect(() => {
    if (!mounted || isLoading) return;

    const currentPath = window.location.pathname;

    // Check authentication
    if (requireAuth && !isAuthenticated) {
      router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }

    // Check role permissions
    if (requiredRoles.length > 0 && user) {
      const hasPermission = requiredRoles.includes(user.role as UserRole);
      
      if (!hasPermission) {
        const redirectTo = fallbackRoute || RolePermissions.getDashboardRoute(user.role);
        router.push(redirectTo);
        return;
      }
    }
  }, [mounted, isAuthenticated, isLoading, user, router, requiredRoles, fallbackRoute, requireAuth]);

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
          <p className="text-gray-600">Verifying permissions...</p>
        </div>
      </div>
    );
  }

  // Not authenticated
  if (requireAuth && !isAuthenticated) {
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
              router.push(`/auth/login?redirect=${encodeURIComponent(currentPath)}`);
            }}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // Insufficient permissions
  if (requiredRoles.length > 0 && user && !requiredRoles.includes(user.role as UserRole)) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-center max-w-md mx-auto p-6">
          <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-amber-500" />
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
          <p className="text-gray-600 mb-4">
            {customMessage || `You don't have permission to access this page.`}
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Current role: <span className="font-medium capitalize">{user.role}</span>
            <br />
            Required roles: <span className="font-medium">{requiredRoles.join(', ')}</span>
          </p>
          <div className="space-y-3">
            <button
              onClick={() => {
                const redirectTo = fallbackRoute || RolePermissions.getDashboardRoute(user.role);
                router.push(redirectTo);
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

  // All checks passed - render children
  return <>{children}</>;
}

/**
 * Specific route guards for different roles
 */
export function StudentRouteGuard({ children }: { children: ReactNode }) {
  return (
    <RouteGuard
      requiredRoles={[UserRole.STUDENT]}
      customMessage="Student access required to view this page."
    >
      {children}
    </RouteGuard>
  );
}

export function InstructorRouteGuard({ children }: { children: ReactNode }) {
  return (
    <RouteGuard
      requiredRoles={[UserRole.INSTRUCTOR, UserRole.ADMIN]}
      customMessage="Instructor access required to view this page."
    >
      {children}
    </RouteGuard>
  );
}

export function AdminRouteGuard({ children }: { children: ReactNode }) {
  return (
    <RouteGuard
      requiredRoles={[UserRole.ADMIN]}
      customMessage="Admin access required to view this page."
    >
      {children}
    </RouteGuard>
  );
}