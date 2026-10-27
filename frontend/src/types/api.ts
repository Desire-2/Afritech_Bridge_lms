/**
 * Skill assessment profile returned by the course API for dynamic Section 3 rendering.
 */
export interface SkillAssessmentConfig {
  profile_key: string;             // e.g. "python", "web_development", "excel"
  subject_label: string;           // e.g. "Python Programming"
  tool_name: string;               // e.g. "Python"
  prior_use_question: string;      // "Have you used Python before?"
  skill_level_label: string;
  skill_level_options: string[];
  tasks_label: string;
  tasks_options: string[];
  open_question_label: string;
  open_question_placeholder: string;
}

export interface ApplicationWindowData {
  id?: number | string;
  course_id?: number;
  status: CohortStatus;
  effective_enrollment_type?: string | null;
  enrollment_type?: string | null;
  scholarship_type?: 'full' | 'partial' | null;
  payment_mode?: string | null;
  effective_price?: number | null;
  price?: number | null;
  currency?: string | null;
  effective_currency?: string | null;
  partial_payment_amount?: number | null;
  partial_payment_percentage?: number | null;
  scholarship_percentage?: number | null;
  payment_methods?: string[];
  payment_summary?: any;
  max_students?: number | null;
  enrollment_count?: number;
  reason?: string | null;
  description?: string | null;
  cohort_label?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  cohort_start?: string | null;
  cohort_end?: string | null;
  status_override?: string | null;
  payment_deadline_days?: number | null;
  require_payment_before_application?: boolean;
  installment_enabled?: boolean;
  installment_count?: number | null;
  installment_interval_days?: number | null;
  community_link?: string | null;
  community_link_label?: string | null;
  module_release_count?: number | null;
  module_release_interval?: string | null;
  module_release_interval_days?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
}

export type CohortStatus = 'open' | 'closed' | 'upcoming';

export interface CohortOption {
  id: string;
  label: string;
  courseId: number | null;
  status: CohortStatus;
  opensAt?: string | null;
  closesAt?: string | null;
  cohortStart?: string | null;
  cohortEnd?: string | null;
  courseTitle?: string;
  applicationWindowId?: number | string | null;
  applicationsCount?: number;
  [key: string]: unknown;
}

/**
 * Public Course interface used on browse/courses pages
 */
export interface Course {
  id: number;
  title: string;
  description: string;
  instructor_id: number;
  instructor_name: string;
  thumbnail_url?: string;
  difficulty_level?: string;
  target_audience?: string;
  learning_objectives?: string;
  category?: string;
  estimated_duration?: string;
  rating?: number;
  total_students?: number;
  enrollment_count?: number;
  modules?: { title: string; id: number }[];
  enrollment_type?: 'free' | 'paid' | 'scholarship';
  price?: number | null;
  currency?: string | null;
  payment_mode?: 'full' | 'partial';
  partial_payment_amount?: number | null;
  partial_payment_percentage?: number | null;
  payment_methods?: string[];
  paypal_enabled?: boolean;
  mobile_money_enabled?: boolean;
  bank_transfer_enabled?: boolean;
  kpay_enabled?: boolean;
  flutterwave_enabled?: boolean;
  momo_pay_code_enabled?: boolean;
  momo_ussd_code?: string | null;
  momo_recipient_name?: string | null;
  bank_transfer_details?: string | null;
  installment_enabled?: boolean;
  installment_count?: number | null;
  installment_interval_days?: number | null;
  payment_deadline_days?: number | null;
  module_release_count?: number | null;
  module_release_interval?: string | null;
  module_release_interval_days?: number | null;
  require_payment_before_application?: boolean;
  payment_summary?: any;
  skill_assessment_config?: SkillAssessmentConfig;
  // Application / cohort fields
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
  application_timezone?: string;
  application_window?: ApplicationWindowData | null;
  application_windows?: ApplicationWindowData[];
  is_published?: boolean;
  start_date?: string | null;
  created_at?: string;
  updated_at?: string;
  // Additional computed fields
  enrollment?: any;
  progress?: any;
}

// ---------------------------------------------------------------------------
// Course creation / content authoring contracts
// These mirror the Course.model.to_dict() response shapes and the create
// payloads accepted by /api/v1/courses and /api/v1/instructor/courses.
// ---------------------------------------------------------------------------

export interface CreateCourseRequest {
  title: string;
  description: string;
  learning_objectives?: string;
  target_audience?: string;
  estimated_duration?: string;
  thumbnail_url?: string | null;
  difficulty_level?: string;
  is_published?: boolean;
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
  application_timezone?: string;
}

export interface Module {
  id: number;
  title: string;
  description?: string | null;
  learning_objectives?: string | null;
  course_id: number;
  order: number;
  is_published: boolean;
  is_released: boolean;
  released_at?: string | null;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
}

export interface EnhancedModule extends Module {
  lessons: Lesson[];
}

export interface CreateEnhancedModuleRequest {
  title: string;
  description?: string;
  learning_objectives?: string;
  order?: number;
  is_published?: boolean;
  ai_generated?: boolean;
}

export interface Lesson {
  id: number;
  title: string;
  content_type: string;
  content_data: string;
  description?: string | null;
  learning_objectives?: string | null;
  module_id: number;
  order: number;
  duration_minutes?: number | null;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface EnhancedLesson extends Lesson {}

export interface CreateEnhancedLessonRequest {
  title: string;
  content_type?: string;
  content_data?: string;
  description?: string;
  learning_objectives?: string;
  order?: number;
  duration_minutes?: number;
  is_published?: boolean;
  ai_generated?: boolean;
}

export interface ModuleOrderUpdate {
  id: number;
  order: number;
}

export interface LessonOrderUpdate {
  id: number;
  order: number;
}

export interface Answer {
  id: number;
  question_id: number;
  text: string;
  answer_text: string;
  is_correct?: boolean;
}

export interface Question {
  id: number;
  quiz_id: number;
  text: string;
  question_text: string;
  question_type: string;
  order: number;
  order_index: number;
  points: number;
  explanation?: string | null;
  answers?: Answer[];
}

export interface Quiz {
  id: number;
  title: string;
  description?: string;
  course_id: number;
  module_id?: number | null;
  lesson_id?: number | null;
  is_published: boolean;
  created_at: string;
  time_limit?: number | null;
  max_attempts?: number | null;
  passing_score: number;
  due_date?: string | null;
  points_possible: number;
  shuffle_questions: boolean;
  shuffle_answers: boolean;
  show_correct_answers: boolean;
  questions?: Question[];
}

export interface QuizAnswerPayload {
  text?: string;
  answer_text?: string;
  is_correct?: boolean;
}

export interface QuizQuestionPayload {
  text?: string;
  question_text?: string;
  question_type?: string;
  points?: number;
  explanation?: string;
  answers?: QuizAnswerPayload[];
  options?: QuizAnswerPayload[];
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  course_id: number;
  module_id?: number | null;
  lesson_id?: number | null;
  is_published?: boolean;
  time_limit?: number | null;
  max_attempts?: number | null;
  passing_score?: number;
  due_date?: string | null;
  points_possible?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
  questions?: QuizQuestionPayload[];
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  instructions?: string | null;
  course_id?: number | null;
  module_id?: number | null;
  lesson_id?: number | null;
  instructor_id: number;
  assignment_type: string;
  max_file_size_mb?: number;
  allowed_file_types?: string | null;
  due_date?: string | null;
  points_possible: number;
  passing_score?: number | null;
  is_published?: boolean;
  rubric_id?: number | null;
  created_at: string;
  updated_at: string;
  modification_requested: boolean;
  modification_request_reason?: string | null;
  can_resubmit: boolean;
  max_resubmissions: number;
  resubmission_count: number;
}

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  due_date?: string;
  points_possible?: number;
  assignment_type?: string;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  is_published?: boolean;
}

export interface Project {
  id: number;
  title: string;
  description: string;
  objectives?: string;
  course_id?: number;
  module_ids: number[];
  due_date?: string;
  points_possible?: number;
  passing_score?: number;
  is_published?: boolean;
  rubric_id?: number | null;
  submission_format?: string;
  max_file_size_mb?: number;
  allowed_file_types?: string | null;
  collaboration_allowed?: boolean;
  max_team_size?: number;
  created_at: string;
  updated_at: string;
  tasks?: any[];
  modules?: Module[];
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  course_id: number;
  module_ids?: number[];
  due_date?: string;
  points_possible?: number;
  is_published?: boolean;
  submission_format?: string;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  collaboration_allowed?: boolean;
  max_team_size?: number;
  objectives?: string;
  passing_score?: number;
}

export interface CreateQuestionRequest {
  text?: string;
  question_text?: string;
  question_type?: string;
  points?: number;
  explanation?: string;
  answers?: QuizAnswerPayload[];
}

export interface CreateAnswerRequest {
  text?: string;
  answer_text?: string;
  is_correct?: boolean;
}

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  enrollment_date: string;
  progress: number;
  completed_at?: string | null;
  status?: string;
  payment_status?: string | null;
}

export interface Submission {
  id: number;
  student_id: number;
  quiz_id?: number | null;
  lesson_id?: number | null;
  submission_content?: string | null;
  submitted_at: string;
  grade?: number | null;
  feedback?: string | null;
  student_username?: string | null;
  quiz_title?: string | null;
  lesson_title?: string | null;
}

export interface QuizSubmissionRequest {
  quiz_id: number;
  answers: Record<number, number | string>;
}

export interface Announcement {
  id: number;
  course_id: number;
  title?: string;
  content?: string;
  message?: string;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface CreateAnnouncementRequest {
  title?: string;
  content?: string;
  message?: string;
  is_published?: boolean;
  [key: string]: unknown;
}

export interface PaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  pages: number;
}

// ============== Auth (user.to_dict / login response shapes) ==============
export interface User {
  id: number;
  username?: string;
  email: string;
  first_name?: string | null;
  last_name?: string | null;
  profile_picture_url?: string | null;
  bio?: string | null;
  phone_number?: string | null;
  role: 'student' | 'instructor' | 'admin' | string | null;
  is_active?: boolean;
  must_change_password?: boolean;
  created_at?: string;
  updated_at?: string;
  portfolio_url?: string | null;
  github_username?: string | null;
  linkedin_url?: string | null;
  twitter_username?: string | null;
  website_url?: string | null;
  location?: string | null;
  timezone?: string | null;
  job_title?: string | null;
  company?: string | null;
  industry?: string | null;
  experience_level?: string | null;
  skills?: string[];
  interests?: string[];
  [key: string]: unknown;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest {
  username?: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
  role?: string;
  [key: string]: unknown;
}

export interface AuthResponse {
  message?: string;
  access_token: string;
  refresh_token?: string;
  user: User;
  must_change_password?: boolean;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
  [key: string]: unknown;
}

export interface ApiError {
  message: string;
  status?: number;
  error_type?: string;
  [key: string]: unknown;
}

export interface UserListResponse {
  users: User[];
  total?: number;
  page?: number;
  per_page?: number;
  pages?: number;
  [key: string]: unknown;
}

// ============== Opportunities ==============
export interface Opportunity {
  id: number;
  title: string;
  description: string;
  type: string;
  location?: string | null;
  company_name?: string | null;
  application_link: string;
  application_deadline?: string | null;
  posted_by_id?: number;
  posted_by_username?: string | null;
  created_at?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

export interface CreateOpportunityRequest {
  title: string;
  description: string;
  type: string;
  location?: string;
  company_name?: string;
  application_link: string;
  application_deadline?: string;
  is_active?: boolean;
  [key: string]: unknown;
}

// ============== Missing create requests ==============
export interface CreateModuleRequest {
  title: string;
  description?: string;
  order?: number;
  is_published?: boolean;
  [key: string]: unknown;
}

export interface CreateLessonRequest {
  title: string;
  content_type?: string;
  content_data?: string;
  order?: number;
  is_published?: boolean;
  module_id?: number;
  [key: string]: unknown;
}
