'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A utility component to protect guest routes (like login, register) from authenticated users
 * @param children The components to render if the user is not authenticated
 */
export function GuestGuard({ children }: { children: React.ReactNode }) {
  const { isLoading, isAuthenticated, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Wait for authentication to complete
    if (!isLoading && isAuthenticated && user) {
      // If authenticated, redirect based on role
      switch (user.role) {
        case 'admin':
          router.push('/admin/dashboard');
          break;
        case 'instructor':
          router.push('/instructor/Dashboard'); // Updated to match the capital 'D'
          break;
        case 'student':
        default:
          router.push('/dashboard');
          break;
      }
    }
  }, [isAuthenticated, isLoading, router, user]);

  // Show loading while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-lg">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, render the children
  if (!isAuthenticated) {
    return <>{children}</>;
  }

  // Fallback while redirecting
  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-900 text-white">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-lg">Redirecting...</p>
      </div>
    </div>
  );
}