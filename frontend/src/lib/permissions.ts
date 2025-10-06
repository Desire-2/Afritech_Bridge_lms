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
