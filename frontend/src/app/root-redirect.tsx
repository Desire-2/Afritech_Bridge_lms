'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * A component that redirects users to their appropriate dashboard based on authentication status and role
 */
export default function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Only redirect after authentication check is complete
    if (!isLoading) {
      if (isAuthenticated && user) {
        // Redirect based on user role
        switch (user.role) {
          case 'admin':
            router.push('/admin/dashboard');
            break;
          case 'instructor':
            router.push('/instructor/Dashboard'); // Updated to match the capital 'D'
            break;
          case 'student':
            router.push('/dashboard');
            break;
          default:
            // If role is not recognized, default to student dashboard
            router.push('/dashboard');
            break;
        }
      }
      // If not authenticated, the landing page will be shown
    }
  }, [isAuthenticated, isLoading, user, router]);

  // This component doesn't render anything as it's just for redirection
  return null;
}