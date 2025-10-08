'use client';

import StudentSidebar from '@/components/student/StudentSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/lib/permissions';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { 
    user, 
    isAuthenticated, 
    isLoading
  } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [permissionChecked, setPermissionChecked] = useState(false);

  // Handle hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Check permissions when mounted and auth state is ready
  useEffect(() => {
    if (!mounted || isLoading || permissionChecked) return;

    if (!isAuthenticated) {
      console.log('StudentLayout: User not authenticated, redirecting to login');
      window.location.href = '/auth/login';
      return;
    }

    if (user && user.role !== UserRole.STUDENT) {
      console.log(`StudentLayout: User role ${user.role} not authorized for student area, redirecting`);
      // Redirect non-students to their appropriate dashboard using window.location for reliability
      switch (user.role) {
        case UserRole.ADMIN:
          window.location.href = '/admin/dashboard';
          break;
        case UserRole.INSTRUCTOR:
          window.location.href = '/instructor/dashboard';
          break;
        default:
          window.location.href = '/auth/login';
      }
      return;
    }

    console.log('StudentLayout: Permission check passed for student');
    setPermissionChecked(true);
  }, [mounted, isAuthenticated, isLoading, user, permissionChecked, router]);

  // Don't render anything until mounted and auth is checked
  if (!mounted || isLoading || !permissionChecked) {
    return <LoadingSpinner fullScreen text="Initializing..." />;
  }

  // If not authenticated, redirect is happening in useEffect
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ShieldAlert className="h-12 w-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Access Denied</h2>
          <p className="text-gray-600">Please log in to continue.</p>
        </div>
      </div>
    );
  }

  // If wrong role, redirect is happening in useEffect
  if (user && user.role !== UserRole.STUDENT) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">Unauthorized</h2>
          <p className="text-gray-600">You don't have permission to access this page.</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-gray-100">
        <StudentSidebar />
        <main className="flex-1 overflow-auto lg:ml-0">
          <div className="lg:hidden h-16"></div> {/* Space for mobile menu button */}
          <ErrorBoundary fallback={
            <div className="p-8 text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Content Error</h2>
              <p className="text-gray-600">There was an error loading this page content.</p>
            </div>
          }>
            {children}
          </ErrorBoundary>
        </main>
      </div>
    </ErrorBoundary>
  );
}
