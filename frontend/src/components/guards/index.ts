// Enhanced role-based guards
export { RoleGuard, AdminGuard as EnhancedAdminGuard, InstructorGuard as EnhancedInstructorGuard, StudentGuard as EnhancedStudentGuard } from './RoleGuard';
export { UnauthorizedAccess } from './UnauthorizedAccess';

// Original guards (for backward compatibility)
export { AdminGuard } from './admin-guard';
export { InstructorGuard } from './instructor-guard';
export { StudentGuard } from './student-guard';
export { AuthGuard } from './auth-guard';
export { GuestGuard } from './guest-guard';