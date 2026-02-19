/**
 * TypeScript Type Definitions for API Services
 */

// ============== User & Authentication ==============
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'student' | 'instructor' | 'admin';
  profile_picture?: string;
  created_at: string;
  updated_at: string;
}

export interface AuthResponse {
  token: string;
  user: User;
}

// ============== Cohort / Application Window ==============
export type CohortStatus = 'open' | 'closed' | 'upcoming';

export interface ApplicationWindowData {
  id?: number | string;
  course_id?: number;
  status: CohortStatus;
  reason?: string | null;
  cohort_label?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  cohort_start?: string | null;
  cohort_end?: string | null;
  status_override?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface CohortOption {
  id: string;
  label: string;
  courseId: number | null;
  status: CohortStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  cohortStart?: string | null;
  cohortEnd?: string | null;
}

// ============== Course & Module ==============
export interface Course {
  id: number;
  title: string;
  description: string;
  instructor_id: number;
  instructor_name: string;
  thumbnail_url?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration: string;
  rating: number;
  enrollment_count: number;
  category: string;
  tags: string[];
  enrollment_type?: 'free' | 'paid' | 'scholarship';
  price?: number | null;
  currency?: string;
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
  application_timezone?: string;
  application_window?: ApplicationWindowData;
  application_windows?: ApplicationWindowData[];
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Module {
  id: number;
  title: string;
  description: string;
  course_id: number;
  order: number;
  duration: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface Lesson {
  id: number;
  title: string;
  description: string;
  module_id: number;
  order: number;
  content_type: 'video' | 'text' | 'quiz' | 'assignment' | 'interactive';
  content_url?: string;
  content_text?: string;
  duration: number;
  is_published: boolean;
  is_free_preview: boolean;
  created_at: string;
  updated_at: string;
}

// ============== Progress & Analytics ==============
export interface ModuleProgress {
  module_id: number;
  student_id: number;
  status: 'locked' | 'unlocked' | 'in_progress' | 'completed' | 'failed';
  attempts_count: number;
  max_attempts: number;
  module_score: number;  // NEW: Average of all lesson scores (0-100)
  course_contribution_score: number;
  lessons_average_score: number;  // Backwards compatibility
  quiz_score: number;
  assignment_score: number;
  final_assessment_score: number;
  weighted_score: number;  // NEW: Weighted score for passing (0-100)
  cumulative_score: number;  // Backwards compatibility (same as weighted_score)
  started_at?: string;
  completed_at?: string;
  failed_at?: string;
  last_activity: string;
}

export interface ModuleData {
  module: Module;
  progress: ModuleProgress;
  can_retake: boolean;
  lessons: Lesson[];
}

export interface CourseProgress {
  course_id: number;
  student_id: number;
  overall_progress: number;
  completed_modules: number;
  total_modules: number;
  modules: ModuleData[];
  suspension_status?: SuspensionStatus;
}

export interface SuspensionStatus {
  is_suspended: boolean;
  suspension_details?: {
    reason: string;
    failed_module_id: number;
    failed_module_title: string;
    suspended_at: string;
    total_attempts_made: number;
    can_submit_appeal: boolean;
    appeal_deadline?: string;
    appeal_submitted: boolean;
    appeal_submitted_at?: string;
    appeal_text?: string;
    review_status: 'pending' | 'approved' | 'rejected';
    reviewed_at?: string;
    review_notes?: string;
  };
}

export interface LearningAnalytics {
  overall_gpa: number;
  total_learning_hours: number;
  courses_completed: number;
  courses_in_progress: number;
  average_score: number;
  learning_streak: number;
  skill_breakdown: {
    [skill: string]: {
      proficiency: number;
      courses_completed: number;
      hours_spent: number;
    };
  };
  performance_trend: 'improving' | 'stable' | 'declining';
  strong_areas: string[];
  improvement_areas: string[];
}

export interface ProgressOverview {
  student_info: {
    id: number;
    name: string;
    email: string;
    profile_picture?: string;
    member_since: string;
  };
  overview: {
    total_courses: number;
    completed_courses: number;
    certificates_earned: number;
    badges_earned: number;
    total_learning_hours: number;
    learning_streak: number;
    current_level: {
      current_level: string;
      current_points: number;
      next_level_points: number;
      progress_to_next: number;
    };
  };
  learning_analytics: LearningAnalytics;
}

// ============== Assessments ==============
export interface Quiz {
  id: number;
  title: string;
  description: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  time_limit: number;
  passing_score: number;
  max_attempts: number;
  is_published: boolean;
  questions: Question[];
}

export interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  order: number;
  options?: string[];
  correct_answer?: string;
  explanation?: string;
}

export interface QuizAttempt {
  id: number;
  quiz_id: number;
  student_id: number;
  score: number;
  max_score: number;
  percentage: number;
  started_at: string;
  submitted_at?: string;
  time_taken: number;
  answers: QuizAnswer[];
}

export interface QuizAnswer {
  question_id: number;
  answer: string;
  is_correct: boolean;
  points_earned: number;
  feedback?: string;
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  course_id: number;
  module_id?: number;
  max_score: number;
  due_date?: string;
  submission_type: 'file' | 'text' | 'url' | 'code';
  instructions: string;
  rubric?: AssignmentRubric;
  is_published: boolean;
}

export interface AssignmentRubric {
  criteria: {
    name: string;
    description: string;
    max_points: number;
  }[];
}

export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  student_id: number;
  content?: string;
  file_url?: string;
  submitted_at: string;
  graded_at?: string;
  score?: number;
  feedback?: string;
  status: 'submitted' | 'graded' | 'returned';
}

// ============== Interactive Features ==============
export interface CodeSandboxConfig {
  language: 'python' | 'javascript' | 'java' | 'cpp' | 'html_css_js';
  template?: string;
  test_cases?: TestCase[];
  timeout: number;
}

export interface TestCase {
  id: string;
  input: string;
  expected_output: string;
  is_hidden: boolean;
}

export interface CodeExecutionResult {
  success: boolean;
  output: string;
  error?: string;
  execution_time: number;
  memory_used: number;
  test_results?: {
    test_case_id: string;
    passed: boolean;
    actual_output: string;
    expected_output: string;
  }[];
}

export interface LearningRecommendation {
  type: 'course' | 'skill' | 'practice' | 'review';
  title: string;
  description: string;
  reason: string;
  priority: 'high' | 'medium' | 'low';
  estimated_time: string;
  link?: string;
}

// ============== Payments & Enrollment ==============
export interface EnrollmentRequest {
  course_id: number;
  enrollment_type: 'free' | 'paid' | 'scholarship';
  payment_method?: 'card' | 'mobile_money' | 'paypal' | 'bank_transfer';
}

export interface ScholarshipApplication {
  id: number;
  course_id: number;
  student_id: number;
  status: 'pending' | 'approved' | 'rejected' | 'under_review';
  reason: string;
  supporting_documents?: string[];
  applied_at: string;
  reviewed_at?: string;
  review_notes?: string;
}

export interface PaymentDetails {
  amount: number;
  currency: string;
  payment_method: string;
  transaction_id?: string;
  status: 'pending' | 'completed' | 'failed';
}

// ============== Real-time Features ==============
export interface WebSocketMessage {
  type: 'progress_update' | 'notification' | 'quiz_result' | 'assignment_graded';
  data: any;
  timestamp: string;
}

export interface Notification {
  id: number;
  user_id: number;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  action_url?: string;
}

// ============== Certificates & Achievements ==============
export interface Certificate {
  id: number;
  student_id: number;
  course_id: number;
  certificate_number: string;
  issued_at: string;
  certificate_url: string;
  verification_code: string;
}

export interface Badge {
  id: number;
  name: string;
  description: string;
  icon_url: string;
  criteria: string;
  points: number;
}

export interface UserBadge {
  id: number;
  user_id: number;
  badge_id: number;
  badge: Badge;
  earned_at: string;
}

// ============== Course Applications ==============
export interface CourseApplication {
  id: number;
  course_id: number;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number?: string;
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say';
  age_range?: 'under_18' | '18_24' | '25_34' | '35_44' | '45_54' | '55_plus';
  country: string;
  city: string;
  education_level?: 'high_school' | 'diploma' | 'bachelors' | 'masters' | 'phd' | 'other';
  current_status?: 'student' | 'employed' | 'self_employed' | 'freelancer' | 'unemployed' | 'other';
  field_of_study?: string;
  has_used_excel: boolean;
  excel_skill_level: 'never_used' | 'beginner' | 'intermediate' | 'advanced' | 'expert';
  excel_tasks_done?: string[];
  motivation: string;
  learning_outcomes?: string;
  career_impact?: string;
  has_computer: boolean;
  internet_access_type?: 'stable_broadband' | 'mobile_data' | 'limited_access' | 'public_wifi' | 'other';
  preferred_learning_mode?: 'self_paced' | 'live_sessions' | 'hybrid';
  available_time?: string[];
  committed_to_complete: boolean;
  agrees_to_assessments: boolean;
  referral_source?: string;
  status: 'pending' | 'approved' | 'rejected' | 'waitlisted';
  admin_notes?: string;
  rejection_reason?: string;
  application_score?: number;
  readiness_score?: number;
  commitment_score?: number;
  risk_score?: number;
  final_rank?: number;
  submission_date: string;
  reviewed_date?: string;
  reviewed_by?: number;
}

export interface ApplicationSubmitData {
  course_id: number;
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number?: string;
  gender?: string;
  age_range?: string;
  country: string;
  city: string;
  education_level?: string;
  current_status?: string;
  field_of_study?: string;
  has_used_excel: boolean;
  excel_skill_level: string;
  excel_tasks_done?: string[];
  motivation: string;
  learning_outcomes?: string;
  career_impact?: string;
  has_computer: boolean;
  internet_access_type?: string;
  preferred_learning_mode?: string;
  available_time?: string[];
  committed_to_complete: boolean;
  agrees_to_assessments: boolean;
  referral_source?: string;
  payment_method?: 'mobile_money' | 'paypal';
  payment_phone_number?: string;
  payment_payer_name?: string;
  paypal_email?: string;
}

export interface ApplicationStatistics {
  total_applications: number;
  status_breakdown: {
    pending: number;
    approved: number;
    rejected: number;
    waitlisted: number;
  };
  high_risk_count: number;
  average_scores: {
    application_score: number;
    readiness_score: number;
    commitment_score: number;
    risk_score: number;
  };
}

// Enhanced search types for application management
export interface ApplicationSearchFilters {
  // Basic filters
  status?: string;
  course_id?: number;
  
  // Enhanced search
  search?: string;
  
  // Advanced filters
  country?: string;
  city?: string;
  education_level?: string;
  current_status?: string;
  excel_skill_level?: string;
  referral_source?: string;
  
  // Date range filters
  date_from?: string;
  date_to?: string;
  
  // Score filters
  min_score?: number;
  max_score?: number;
  score_type?: 'application_score' | 'final_rank_score' | 'readiness_score' | 'commitment_score' | 'risk_score';
  
  // Sorting and pagination
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  page?: number;
  per_page?: number;
}

export interface ApplicationSearchStatistics {
  filter_options: {
    countries: string[];
    cities: string[];
    education_levels: string[];
    current_statuses: string[];
    excel_skill_levels: string[];
    referral_sources: string[];
  };
  status_counts: Record<string, number>;
  score_statistics: Record<string, {
    min: number;
    max: number;
    avg: number;
  }>;
  date_range: {
    earliest: string | null;
    latest: string | null;
  };
  total_applications: number;
}

export interface AdvancedSearchConfig {
  text_search?: string;
  filters?: Record<string, any>;
  score_ranges?: Record<string, { min?: number; max?: number }>;
  date_ranges?: {
    created_from?: string;
    created_to?: string;
  };
  sort_config?: {
    field: string;
    order: 'asc' | 'desc';
  };
  pagination?: {
    page: number;
    per_page: number;
  };
  include_analytics?: boolean;
  save_search?: boolean;
  search_name?: string;
}

export interface SimilarApplication extends CourseApplication {
  similarity_score: number;
  similarity_factors: string[];
}

export interface ApplicationExportConfig {
  search_config?: any;
  format?: 'excel' | 'csv';
  fields?: string[];
  include_analytics?: boolean;
  filename?: string;
}
