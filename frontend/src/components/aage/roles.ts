/**
 * Pure role helpers for the AAGE screens. Instructor/admin pages use the repo's
 * guards for redirects; these helpers provide the second, testable check that
 * no student-facing build renders instructor controls.
 */
export type AageRole = 'student' | 'instructor' | 'admin' | 'superadmin' | string | null | undefined;

function normalized(role: AageRole): string {
  return typeof role === 'string' ? role.toLowerCase() : '';
}

export function isAdminRole(role: AageRole): boolean {
  return ['admin', 'superadmin'].includes(normalized(role));
}

export function isInstructorRole(role: AageRole): boolean {
  return normalized(role) === 'instructor';
}

/** Students must never see instructor/admin AAGE pages or controls. */
export function canAccessInstructorAage(role: AageRole): boolean {
  return isInstructorRole(role) || isAdminRole(role);
}

/** Only admins may omit `course_id` from analytics; instructors must scope it. */
export function canViewAllCourses(role: AageRole): boolean {
  return isAdminRole(role);
}

/** Admin-only mutation controls inside the learning dashboard. */
export function canAdministerAage(role: AageRole): boolean {
  return isAdminRole(role);
}
