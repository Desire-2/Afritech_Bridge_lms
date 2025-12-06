/**
 * Family Management Types and Interfaces
 * For rural/shared device scenarios where one family shares a single phone
 */

// ============================================
// Family Account Types
// ============================================

export interface FamilyAccount {
  id: number;
  family_code: string; // Unique identifier for the family
  family_name: string;
  description?: string;
  primary_contact_id: number; // Primary parent/guardian
  primary_contact_name: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  subscription_status: 'trial' | 'active' | 'inactive' | 'suspended';
  max_children: number;
  total_children: number;
  profile_picture_url?: string;
}

export interface CreateFamilyAccountRequest {
  family_name: string;
  description?: string;
  contact_email: string;
  contact_phone?: string;
  address?: string;
  city?: string;
  country?: string;
  max_children?: number;
}

// ============================================
// Child Profile Types
// ============================================

export interface ChildProfile {
  id: number;
  family_id: number;
  user_id?: number; // Links to User account if child has one
  first_name: string;
  last_name: string;
  date_of_birth: string;
  grade_level?: string;
  school_name?: string;
  profile_picture_url?: string;
  bio?: string;
  learning_goals?: string;
  interests?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  phone_verified: boolean;
  email_verified: boolean;
}

export interface UpdateChildProfileRequest {
  first_name?: string;
  last_name?: string;
  date_of_birth?: string;
  grade_level?: string;
  school_name?: string;
  profile_picture_url?: string;
  bio?: string;
  learning_goals?: string;
  interests?: string[];
}

// ============================================
// Family Member (Parent/Guardian) Types
// ============================================

export interface FamilyMember {
  id: number;
  family_id: number;
  user_id: number;
  relationship: 'parent' | 'guardian' | 'teacher' | 'sibling' | 'other';
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  role_in_family: 'primary_parent' | 'secondary_parent' | 'guardian' | 'trusted_adult';
  permission_level: 'full_access' | 'limited_access' | 'view_only' | 'activity_monitor';
  can_manage_children: boolean;
  can_view_progress: boolean;
  can_edit_settings: boolean;
  can_approve_enrollments: boolean;
  created_at: string;
  updated_at: string;
  is_active: boolean;
  last_login?: string;
}

export interface AddFamilyMemberRequest {
  email: string;
  relationship: 'parent' | 'guardian' | 'teacher' | 'sibling' | 'other';
  role_in_family: 'primary_parent' | 'secondary_parent' | 'guardian' | 'trusted_adult';
  permission_level: 'full_access' | 'limited_access' | 'view_only' | 'activity_monitor';
}

// ============================================
// Child-Parent Relationship Types
// ============================================

export interface ChildParentRelationship {
  id: number;
  child_id: number;
  parent_id: number;
  relationship_type: 'biological_parent' | 'adoptive_parent' | 'guardian' | 'foster_parent' | 'other';
  is_primary: boolean;
  verified: boolean;
  verified_at?: string;
  approval_status: 'pending' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

// ============================================
// Activity and Progress Types
// ============================================

export interface FamilyActivityLog {
  id: number;
  family_id: number;
  child_id: number;
  activity_type: 'enrollment' | 'quiz_submission' | 'lesson_completion' | 'assignment_submission' | 'profile_update' | 'login' | 'achievement_unlocked';
  activity_description: string;
  course_id?: number;
  course_title?: string;
  quiz_id?: number;
  quiz_title?: string;
  related_data?: Record<string, any>;
  created_at: string;
}

export interface ChildProgressSummary {
  child_id: number;
  child_name: string;
  total_courses_enrolled: number;
  total_courses_completed: number;
  courses_in_progress: number;
  average_completion_percentage: number;
  total_quizzes_taken: number;
  average_quiz_score: number;
  total_assignments_submitted: number;
  last_activity_at: string;
  achievements_unlocked: number;
  total_learning_hours: number;
  learning_streak_days: number;
}

export interface FamilyProgressReport {
  family_id: number;
  reporting_period: string; // e.g., "2025-10-01 to 2025-10-31"
  children_summaries: ChildProgressSummary[];
  total_family_learning_hours: number;
  family_engagement_score: number; // 0-100
  top_performer: ChildProgressSummary | null;
  average_progress_percentage: number;
  recommendations: string[];
}

// ============================================
// Access Control and Permissions Types
// ============================================

export interface PermissionRule {
  id: number;
  family_id: number;
  member_id?: number; // If null, applies to all members with this role
  child_id?: number; // If null, applies to all children
  resource_type: 'child_profile' | 'course_enrollment' | 'quiz_results' | 'assignments' | 'settings' | 'family_account';
  action: 'view' | 'edit' | 'delete' | 'approve' | 'manage';
  is_allowed: boolean;
  conditions?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface ApprovalWorkflow {
  id: number;
  family_id: number;
  workflow_type: 'enrollment' | 'content_purchase' | 'data_access_request' | 'profile_change';
  requires_approval: boolean;
  approval_roles: string[]; // ['primary_parent', 'secondary_parent', etc.]
  approvers: number[]; // user_ids of approvers
  created_at: string;
  updated_at: string;
}

export interface AccessRequest {
  id: number;
  family_id: number;
  member_id: number;
  child_id: number;
  request_type: 'data_access' | 'permission_upgrade' | 'emergency_access';
  description?: string;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  requested_permissions?: string[];
  approver_id?: number;
  approval_reason?: string;
  created_at: string;
  updated_at: string;
  expires_at?: string;
}

// ============================================
// Enrollment and Content Management Types
// ============================================

export interface FamilyEnrollment {
  id: number;
  family_id: number;
  child_id: number;
  course_id: number;
  course_title: string;
  enroll_status: 'pending_approval' | 'active' | 'completed' | 'dropped';
  enrolled_by_parent_id: number;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approved_by?: number;
  approved_at?: string;
  enrolled_at: string;
  completion_date?: string;
  completion_percentage: number;
  is_required_course: boolean;
}

export interface EnrollmentRequest {
  course_id: number;
  child_id: number;
  reason?: string;
  require_approval?: boolean;
  set_goals?: string;
}

// ============================================
// Device and Session Management Types
// ============================================

export interface FamilyDevice {
  id: number;
  family_id: number;
  device_id: string; // Unique device identifier
  device_type: 'phone' | 'tablet' | 'laptop' | 'desktop' | 'other';
  device_name: string;
  os_type: string; // iOS, Android, Windows, macOS
  os_version: string;
  last_login_member_id: number;
  last_login_member_name: string;
  last_login_at: string;
  is_trusted: boolean;
  location?: string;
  created_at: string;
  updated_at: string;
}

export interface FamilySession {
  id: number;
  device_id: number;
  family_id: number;
  current_member_id: number;
  current_child_viewing?: number; // Which child's profile is being viewed
  login_time: string;
  last_activity_time: string;
  is_active: boolean;
  session_token: string;
  ip_address?: string;
  expires_at: string;
}

// ============================================
// Notification and Communication Types
// ============================================

export interface FamilyNotification {
  id: number;
  family_id: number;
  target_member_id?: number; // If null, notify all members
  notification_type: 'achievement' | 'milestone' | 'alert' | 'reminder' | 'system_update';
  title: string;
  message: string;
  child_id?: number;
  related_data?: Record<string, any>;
  is_read: boolean;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  created_at: string;
  read_at?: string;
}

// ============================================
// Analytics and Reporting Types
// ============================================

export interface FamilyAnalytics {
  family_id: number;
  reporting_date: string;
  total_family_members: number;
  total_active_children: number;
  average_daily_active_children: number;
  device_usage_hours: number;
  total_courses_enrolled: number;
  average_completion_rate: number;
  total_quizzes_completed: number;
  average_quiz_score: number;
  feature_usage: Record<string, number>; // Feature usage counts
  engagement_trend: 'increasing' | 'stable' | 'declining';
}

// ============================================
// Helper/Aggregate Types
// ============================================

export interface FamilyDashboardData {
  family: FamilyAccount;
  members: FamilyMember[];
  children: ChildProfile[];
  recent_activities: FamilyActivityLog[];
  progress_report: FamilyProgressReport;
  pending_approvals: AccessRequest[];
  notifications: FamilyNotification[];
  total_learning_hours: number;
  engagement_score: number;
}

export interface ChildDetailView {
  child: ChildProfile;
  progress: ChildProgressSummary;
  enrolled_courses: FamilyEnrollment[];
  recent_activities: FamilyActivityLog[];
  achievements: any[];
  current_goals: string[];
}

// ============================================
// API Request/Response Types
// ============================================

export interface FamilyApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  errors?: Record<string, string[]>;
}

export interface PaginatedFamilyResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}
