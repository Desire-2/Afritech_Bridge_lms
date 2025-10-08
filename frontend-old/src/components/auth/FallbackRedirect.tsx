'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { RolePermissions } from '@/lib/permissions';

interface FallbackRedirectProps {
  onFallbackActivated?: () => void;
  timeoutMs?: number;
}

/**
 * A fallback component that provides manual navigation options when authentication takes too long
 */
export default function FallbackRedirect({ 
  onFallbackActivated, 
  timeoutMs = 8000 
}: FallbackRedirectProps) {
  const { isAuthenticated, user, logout } = useAuth();
  const router = useRouter();
  const [showFallback, setShowFallback] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let mounted = true;
    let interval: NodeJS.Timeout;

    // Start the timer
    const startTime = Date.now();
    interval = setInterval(() => {
      if (mounted) {
        const elapsedSeconds = Math.floor((Date.now() - startTime) / 1000);
        setElapsed(elapsedSeconds);
        
        if (elapsedSeconds >= timeoutMs / 1000) {
          setShowFallback(true);
          onFallbackActivated?.();
        }
      }
    }, 1000);

    return () => {
      mounted = false;
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [timeoutMs, onFallbackActivated]);

  const handleManualRedirect = () => {
    if (isAuthenticated && user?.role) {
      const dashboardRoute = RolePermissions.getDashboardRoute(user.role);
      router.push(dashboardRoute);
    } else {
      router.push('/auth/login');
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleRetry = () => {
    setShowFallback(false);
    setElapsed(0);
    window.location.reload();
  };

  if (!showFallback) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-500/20 border border-yellow-500/30 rounded-lg p-4 max-w-sm shadow-lg backdrop-blur-sm">
      <div className="flex items-start gap-3">
        <svg className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div className="flex-1">
          <h4 className="text-yellow-300 text-sm font-medium mb-1">
            Taking Too Long?
          </h4>
          <p className="text-yellow-400/70 text-xs mb-3">
            Authentication has been running for {elapsed}s. You can try these options:
          </p>
          <div className="space-y-2">
            {isAuthenticated && user && (
              <button
                onClick={handleManualRedirect}
                className="w-full px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 text-white rounded text-xs transition-colors"
              >
                Go to Dashboard
              </button>
            )}
            <button
              onClick={handleRetry}
              className="w-full px-3 py-1.5 bg-slate-600 hover:bg-slate-700 text-slate-200 rounded text-xs transition-colors"
            >
              Refresh Page
            </button>
            <button
              onClick={handleLogout}
              className="w-full px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded text-xs transition-colors"
            >
              Logout & Try Again
            </button>
          </div>
        </div>
        <button
          onClick={() => setShowFallback(false)}
          className="text-yellow-400 hover:text-yellow-300 text-sm"
        >
          ×
        </button>
      </div>
    </div>
  );
}