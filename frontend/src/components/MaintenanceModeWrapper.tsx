'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { maintenanceService } from '@/services/maintenance.service';

interface MaintenanceModeWrapperProps {
  children: React.ReactNode;
}

/**
 * MaintenanceModeWrapper
 * 
 * Checks maintenance mode status and redirects users accordingly.
 * Admins bypass maintenance mode automatically.
 */
export function MaintenanceModeWrapper({ children }: MaintenanceModeWrapperProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isChecking, setIsChecking] = useState(true);
  const [hasChecked, setHasChecked] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      await checkMaintenanceStatus();
      setHasChecked(true);
    };
    
    checkStatus();
    
    // Re-check every 2 minutes
    const interval = setInterval(checkStatus, 120000);
    return () => clearInterval(interval);
  }, [pathname, router]);

  const checkMaintenanceStatus = async () => {
    try {
      console.log('[MaintenanceWrapper] Checking maintenance status for path:', pathname);
      
      // Skip check if already on maintenance page
      if (pathname === '/maintenance') {
        console.log('[MaintenanceWrapper] Already on maintenance page, skipping check');
        setIsChecking(false);
        return;
      }

      // Check if route is exempt
      if (maintenanceService.isExemptRoute(pathname)) {
        console.log('[MaintenanceWrapper] Route is exempt:', pathname);
        setIsChecking(false);
        return;
      }

      // Check if user is admin
      const isAdmin = maintenanceService.isAdminUser();
      if (isAdmin) {
        console.log('[MaintenanceWrapper] User is admin, bypassing maintenance check');
        setIsChecking(false);
        return;
      }

      // Check maintenance status from API
      console.log('[MaintenanceWrapper] Fetching maintenance status from API...');
      const status = await maintenanceService.checkMaintenanceMode();
      console.log('[MaintenanceWrapper] Maintenance status:', status);

      if (status.maintenance_mode) {
        console.log('[MaintenanceWrapper] Maintenance mode is ON, redirecting to /maintenance');
        router.push('/maintenance');
        // Don't set isChecking to false here, let the redirect happen
      } else {
        console.log('[MaintenanceWrapper] Maintenance mode is OFF, allowing access');
        setIsChecking(false);
      }
    } catch (error) {
      console.error('[MaintenanceWrapper] Error checking maintenance status:', error);
      // On error, allow access
      setIsChecking(false);
    }
  };

  // Show loading while checking (only briefly)
  if (isChecking && !hasChecked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-slate-600 dark:text-slate-400">Checking system status...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
