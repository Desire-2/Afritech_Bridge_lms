'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UnauthorizedAccess } from './UnauthorizedAccess';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRole: 'admin' | 'instructor' | 'student';
  redirectOnFail?: boolean; // If true, redirects immediately. If false, shows unauthorized page
  pageName?: string;
}

/**
 * Enhanced role-based guard component that can either redirect or show unauthorized page
 */
export function RoleGuard({ 
  children, 
  requiredRole, 
  redirectOnFail = true, 
  pageName = 'page' 
}: RoleGuardProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [showUnauthorized, setShowUnauthorized] = useState(false);

  const getRoleDashboard = (role: string) => {
    switch (role) {
      case 'admin': return '/admin/dashboard';
      case 'instructor': return '/instructor/dashboard';
      case 'student': return '/dashboard';
      default: return '/dashboard';
    }
  };

  useEffect(() => {
    // Wait for authentication to complete
    if (!isLoading) {
      // If not authenticated, redirect to login
      if (!isAuthenticated) {
        router.push('/auth/login');
        return;
      }

      // If authenticated but doesn't have the required role
      if (user?.role !== requiredRole) {
        if (redirectOnFail) {
          // Redirect to the appropriate dashboard based on role
          const targetDashboard = getRoleDashboard(user?.role || 'student');
          router.push(targetDashboard);
        } else {
          // Show unauthorized access page
          setShowUnauthorized(true);
        }
      }
    }
  }, [isAuthenticated, isLoading, router, user, requiredRole, redirectOnFail]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-lg">Checking permissions...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, show loading (will redirect via useEffect)
  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-lg">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  // If user doesn't have required role and we're not redirecting, show unauthorized page
  if (user?.role !== requiredRole && showUnauthorized) {
    return <UnauthorizedAccess requiredRole={requiredRole} pageName={pageName} />;
  }

  // If user doesn't have required role and we're redirecting, show loading
  if (user?.role !== requiredRole && redirectOnFail) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-green-500 mx-auto mb-4"></div>
          <p className="text-lg">Redirecting...</p>
        </div>
      </div>
    );
  }

  // User has the required role, render children
  return <>{children}</>;
}

// Convenience components for specific roles
export function AdminGuard({ children, redirectOnFail = true, pageName = 'admin page' }: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole="admin" redirectOnFail={redirectOnFail} pageName={pageName}>
      {children}
    </RoleGuard>
  );
}

export function InstructorGuard({ children, redirectOnFail = true, pageName = 'instructor page' }: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole="instructor" redirectOnFail={redirectOnFail} pageName={pageName}>
      {children}
    </RoleGuard>
  );
}

export function StudentGuard({ children, redirectOnFail = true, pageName = 'student page' }: Omit<RoleGuardProps, 'requiredRole'>) {
  return (
    <RoleGuard requiredRole="student" redirectOnFail={redirectOnFail} pageName={pageName}>
      {children}
    </RoleGuard>
  );
}