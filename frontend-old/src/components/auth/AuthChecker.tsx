'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { RolePermissions } from '@/lib/permissions';

interface AuthCheckerProps {
  redirectTo?: string;
  checkInterval?: number;
  timeoutMs?: number;
}

/**
 * A component that periodically checks authentication status and redirects if needed
 */
export default function AuthChecker({ 
  redirectTo = '/auth/login',
  checkInterval = 30000, // 30 seconds
  timeoutMs = 5000 // 5 seconds for each check
}: AuthCheckerProps) {
  const { isAuthenticated, user, validateSession, logout } = useAuth();
  const router = useRouter();
  const [lastCheck, setLastCheck] = useState<Date | null>(null);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    const performAuthCheck = async () => {
      if (!mounted || !isAuthenticated) return;

      try {
        const timeoutPromise = new Promise<boolean>((_, reject) => {
          setTimeout(() => reject(new Error('Auth check timed out')), timeoutMs);
        });

        const isValid = await Promise.race([validateSession(), timeoutPromise]);
        
        if (!isValid && mounted) {
          console.warn('Authentication check failed, redirecting to login');
          logout();
        } else if (mounted) {
          setLastCheck(new Date());
        }
      } catch (error) {
        if (mounted) {
          console.error('Auth check error:', error);
          if (error instanceof Error && error.message.includes('timed out')) {
            console.warn('Auth check timed out');
          }
        }
      }
    };

    // Initial check
    if (isAuthenticated) {
      performAuthCheck();
    }

    // Set up interval
    interval = setInterval(performAuthCheck, checkInterval);

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [isAuthenticated, validateSession, logout, checkInterval, timeoutMs]);

  // Don't render anything - this is just a background checker
  return null;
}

/**
 * Hook for manual authentication checks with timeout
 */
export function useAuthCheck() {
  const { validateSession, logout } = useAuth();
  const router = useRouter();

  const checkAuth = async (timeoutMs: number = 5000): Promise<boolean> => {
    try {
      const timeoutPromise = new Promise<boolean>((_, reject) => {
        setTimeout(() => reject(new Error('Auth check timed out')), timeoutMs);
      });

      return await Promise.race([validateSession(), timeoutPromise]);
    } catch (error) {
      console.error('Manual auth check failed:', error);
      if (error instanceof Error && error.message.includes('timed out')) {
        console.warn('Manual auth check timed out');
      }
      return false;
    }
  };

  const forceLogout = () => {
    logout();
  };

  return { checkAuth, forceLogout };
}