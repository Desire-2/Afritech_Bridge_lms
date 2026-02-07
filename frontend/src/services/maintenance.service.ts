/**
 * Maintenance Mode Service
 * 
 * Handles checking and managing maintenance mode status
 */

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

export interface MaintenanceStatus {
  maintenance_mode: boolean;
  message?: string;
  start_time?: string;
  estimated_end_time?: string;
  show_countdown?: boolean;
  current_time: string;
}

class MaintenanceService {
  /**
   * Check if the system is in maintenance mode
   */
  async checkMaintenanceMode(): Promise<MaintenanceStatus> {
    try {
      const url = `${API_URL}/maintenance/status`;
      console.log('[MaintenanceService] Checking maintenance mode from:', url);
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('[MaintenanceService] Response status:', response.status, response.statusText);

      if (!response.ok) {
        console.warn('[MaintenanceService] API request failed, assuming not in maintenance');
        // If endpoint fails, assume not in maintenance
        return {
          maintenance_mode: false,
          current_time: new Date().toISOString(),
        };
      }

      const data = await response.json() as MaintenanceStatus;
      console.log('[MaintenanceService] Maintenance status data:', data);
      return data;
    } catch (error) {
      console.error('[MaintenanceService] Error checking maintenance mode:', error);
      // On error, assume not in maintenance to allow access
      return {
        maintenance_mode: false,
        current_time: new Date().toISOString(),
      };
    }
  }

  /**
   * Get detailed maintenance information
   */
  async getMaintenanceInfo(): Promise<MaintenanceStatus> {
    try {
      const response = await fetch(`${API_URL}/maintenance/info`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          maintenance_mode: false,
          current_time: new Date().toISOString(),
        };
      }

      const data = await response.json() as MaintenanceStatus;
      return data;
    } catch (error) {
      console.error('Error getting maintenance info:', error);
      return {
        maintenance_mode: false,
        current_time: new Date().toISOString(),
      };
    }
  }

  /**
   * Check if current user is admin (can bypass maintenance)
   */
  isAdminUser(): boolean {
    try {
      const userStr = localStorage.getItem('user');
      console.log('[MaintenanceService] Checking admin status, user data:', userStr ? 'exists' : 'not found');
      
      if (!userStr) return false;

      const user = JSON.parse(userStr);
      const isAdmin = user?.role?.name?.toLowerCase() === 'admin';
      console.log('[MaintenanceService] User role:', user?.role?.name, 'isAdmin:', isAdmin);
      
      return isAdmin;
    } catch (error) {
      console.error('[MaintenanceService] Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Check if current route should be accessible during maintenance
   */
  isExemptRoute(pathname: string): boolean {
    const exemptRoutes = [
      '/login',
      '/auth/login',
      '/maintenance',
      '/admin', // All admin routes
    ];

    const isExempt = exemptRoutes.some(route => pathname.startsWith(route));
    console.log('[MaintenanceService] Checking if', pathname, 'is exempt:', isExempt);
    return isExempt;
  }
}

export const maintenanceService = new MaintenanceService();
