// User roles enumeration
export enum UserRole {
  ADMIN = 'admin',
  INSTRUCTOR = 'instructor',
  STUDENT = 'student'
}

// Permission types
export type Permission = 
  | 'read_courses'
  | 'write_courses'
  | 'delete_courses'
  | 'read_users'
  | 'write_users'
  | 'delete_users'
  | 'read_analytics'
  | 'manage_system'
  | 'grade_assignments'
  | 'create_content';

// Role-based permissions mapping
export const rolePermissions: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: [
    'read_courses',
    'write_courses', 
    'delete_courses',
    'read_users',
    'write_users',
    'delete_users',
    'read_analytics',
    'manage_system',
    'grade_assignments',
    'create_content'
  ],
  [UserRole.INSTRUCTOR]: [
    'read_courses',
    'write_courses',
    'read_users',
    'grade_assignments',
    'create_content'
  ],
  [UserRole.STUDENT]: [
    'read_courses'
  ]
};

// Check if user has specific permission
export function hasPermission(userRole: UserRole, permission: Permission): boolean {
  return rolePermissions[userRole]?.includes(permission) ?? false;
}

// Check if user can access a specific route
export function canAccessRoute(userRole: UserRole, route: string): boolean {
  if (route.startsWith('/admin')) {
    return userRole === UserRole.ADMIN;
  }
  if (route.startsWith('/instructor')) {
    return userRole === UserRole.INSTRUCTOR || userRole === UserRole.ADMIN;
  }
  if (route.startsWith('/student')) {
    return userRole === UserRole.STUDENT || userRole === UserRole.ADMIN;
  }
  return true; // Public routes
}

// Get the appropriate dashboard route for a user role
export function getDashboardRoute(userRole?: string): string {
  switch (userRole?.toLowerCase()) {
    case UserRole.ADMIN:
      return '/admin/dashboard';
    case UserRole.INSTRUCTOR:
      return '/instructor/dashboard';
    case UserRole.STUDENT:
      return '/student/dashboard';
    default:
      return '/student/dashboard'; // Default to student dashboard for unknown roles
  }
}

// Role permissions utility class for easier access
export class RolePermissions {
  static hasPermission(userRole: UserRole, permission: Permission): boolean {
    return hasPermission(userRole, permission);
  }

  static canAccessRoute(userRole: UserRole, route: string): boolean {
    return canAccessRoute(userRole, route);
  }

  static getDashboardRoute(userRole?: string): string {
    return getDashboardRoute(userRole);
  }

  static isValidRole(role: string): role is UserRole {
    return Object.values(UserRole).includes(role as UserRole);
  }

  static getRoleDisplayName(role: string): string {
    switch (role?.toLowerCase()) {
      case UserRole.ADMIN:
        return 'Administrator';
      case UserRole.INSTRUCTOR:
        return 'Instructor';
      case UserRole.STUDENT:
        return 'Student';
      default:
        return 'User';
    }
  }
}
