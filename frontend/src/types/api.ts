// User and Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  bio?: string;
  phone_number?: string;
  role: string;
  is_active?: boolean;
  must_change_password?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Role {
  id: number;
  name: string;
}

export interface LoginRequest {
  identifier: string; // username or email
  password: string;
}

export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

export interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  must_change_password?: boolean;
  message?: string;
}

export interface PasswordResetRequest {
  email: string;
}

export interface PasswordResetConfirm {
  token: string;
  new_password: string;
}

// Course-related Types
export interface Course {
  id: number;
  title: string;
  description: string;
  learning_objectives?: string;
  target_audience?: string;
  estimated_duration?: string;
  instructor_id: number;
  instructor_name?: string;
  created_at: string;
  updated_at: string;
  is_published: boolean;
  modules?: Module[];
  announcements?: Announcement[];
  // Module release settings
  start_date?: string;
  module_release_count?: number | null;
  module_release_interval?: string | null;
  module_release_interval_days?: number | null;
  // Module release metadata (when for_student=True)
  total_module_count?: number;
  released_module_count?: number;
}

export interface CreateCourseRequest {
  title: string;
  description: string;
  learning_objectives?: string;
  target_audience?: string;
  estimated_duration?: string;
  instructor_id?: number; // For admin use
}

export interface Module {
  id: number;
  title: string;
  description?: string;
  course_id: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  lessons?: Lesson[];
  // Module release fields
  is_released?: boolean;
  released_at?: string;
}

export interface CreateModuleRequest {
  title: string;
  description?: string;
  course_id: number;
  order_index: number;
}

export interface Lesson {
  id: number;
  title: string;
  content: string;
  module_id: number;
  order_index: number;
  video_url?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateLessonRequest {
  title: string;
  content: string;
  module_id: number;
  order_index: number;
  video_url?: string;
}

export interface Enrollment {
  id: number;
  student_id: number;
  course_id: number;
  enrolled_at: string;
  completed_at?: string;
  progress_percentage: number;
  student?: User;
  course?: Course;
}

export interface Quiz {
  id: number;
  title: string;
  description?: string;
  module_id?: number;
  lesson_id?: number;
  course_id?: number;
  course_title?: string;
  is_published?: boolean;
  time_limit?: number;
  max_attempts?: number;
  passing_score?: number;
  due_date?: string | null;
  points_possible?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
  created_at: string;
  updated_at?: string;
  questions?: Question[];
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  module_id?: number;
  lesson_id?: number;
  time_limit?: number;
  max_attempts?: number;
  is_published?: boolean;
  passing_score?: number;
  due_date?: string;
  points_possible?: number;
  shuffle_questions?: boolean;
  shuffle_answers?: boolean;
  show_correct_answers?: boolean;
  questions?: QuizQuestionPayload[];
}

export interface QuizAnswerPayload {
  id?: number;
  answer_text?: string;
  text?: string;
  is_correct?: boolean;
}

export interface QuizQuestionPayload {
  id?: number;
  question_text?: string;
  text?: string;
  question_type?: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points?: number;
  order_index?: number;
  order?: number;
  explanation?: string | null;
  answers?: QuizAnswerPayload[];
}

export interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  text?: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  order_index: number;
  order?: number;
  explanation?: string | null;
  created_at?: string;
  updated_at?: string;
  answers?: Answer[];
}

export interface CreateQuestionRequest {
  quiz_id?: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'essay';
  points: number;
  order_index: number;
  order?: number;
  explanation?: string | null;
  answers?: QuizAnswerPayload[];
}

export interface Answer {
  id: number;
  question_id: number;
  answer_text: string;
  text?: string;
  is_correct: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAnswerRequest {
  question_id: number;
  answer_text: string;
  is_correct: boolean;
}

export interface Submission {
  id: number;
  student_id: number;
  quiz_id: number;
  submitted_at: string;
  score?: number;
  total_points?: number;
  student?: User;
  quiz?: Quiz;
  responses?: SubmissionResponse[];
}

export interface SubmissionResponse {
  id: number;
  submission_id: number;
  question_id: number;
  answer_text: string;
  is_correct?: boolean;
  points_earned?: number;
  question?: Question;
}

export interface QuizSubmissionRequest {
  quiz_id: number;
  responses: {
    question_id: number;
    answer_text: string;
  }[];
}

export interface Announcement {
  id: number;
  course_id: number;
  instructor_id: number;
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  course?: Course;
  course_title?: string;
  instructor_name?: string;
}

export interface CreateAnnouncementRequest {
  course_id: number;
  title: string;
  content: string;
}

// Opportunity Types (from backend models)
export interface Opportunity {
  id: number;
  title: string;
  description: string;
  organization: string;
  location?: string;
  application_deadline: string;
  requirements?: string;
  benefits?: string;
  application_url?: string;
  contact_email?: string;
  opportunity_type: 'scholarship' | 'internship' | 'job' | 'fellowship' | 'grant' | 'other';
  created_at: string;
  updated_at: string;
}

export interface CreateOpportunityRequest {
  title: string;
  description: string;
  organization: string;
  location?: string;
  application_deadline: string;
  requirements?: string;
  benefits?: string;
  application_url?: string;
  contact_email?: string;
  opportunity_type: 'scholarship' | 'internship' | 'job' | 'fellowship' | 'grant' | 'other';
}

// API Response Types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

// Admin user list response (matches backend format)
export interface UserListResponse {
  users: User[];
  pagination: {
    current_page: number;
    per_page: number;
    total_pages: number;
    total_items: number;
    has_next: boolean;
    has_prev: boolean;
  };
  role_statistics: Record<string, number>;
  filters_applied: {
    role: string | null;
    search: string | null;
    status: string | null;
    date_from: string | null;
    date_to: string | null;
  };
}

// Error Types
export interface ApiError {
  message: string;
  status?: number;
  error_type?: 'validation_error' | 'authentication_error' | 'authorization_error' | 'server_error';
  details?: {
    // Validation errors
    identifier_missing?: boolean;
    password_missing?: boolean;
    invalid_email_format?: boolean;
    username_taken?: boolean;
    email_taken?: boolean;
    
    // Authentication errors
    user_not_found?: boolean;
    invalid_password?: boolean;
    
    // Generic details
    [key: string]: any;
  };
}

// Quiz Progress Types (from backend)
export interface QuizProgress {
  id: number;
  student_id: number;
  quiz_id: number;
  current_question_index: number;
  answers: Record<string, any>;
  start_time: string;
  end_time?: string;
  is_completed: boolean;
  created_at: string;
  updated_at: string;
  student?: User;
  quiz?: Quiz;
}

export interface QuizProgressResponse {
  question_id: number;
  answer: string;
  is_correct?: boolean;
}

export interface CreateQuizProgressRequest {
  quiz_id: number;
}

export interface UpdateQuizProgressRequest {
  current_question_index: number;
  answers: Record<string, any>;
  is_completed?: boolean;
}

// Enhanced Module and Lesson Types
export interface EnhancedModule extends Module {
  lessons?: EnhancedLesson[];
}

export interface CreateEnhancedModuleRequest {
  title: string;
  description?: string;
  learning_objectives?: string;
  course_id?: number;
  is_published?: boolean;
}

export interface EnhancedLesson extends Lesson {
  content_type?: 'text' | 'video' | 'pdf' | 'mixed';
  content_data: string;
  learning_objectives?: string;
  duration_minutes?: number;
}

export interface CreateEnhancedLessonRequest {
  title: string;
  content_type?: 'text' | 'video' | 'pdf' | 'mixed';
  content_data: string;
  description?: string;
  learning_objectives?: string;
  duration_minutes?: number;
  is_published?: boolean;
}

// Assignment Types
export interface Assignment {
  id: number;
  title: string;
  description: string;
  instructions?: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  assignment_type: 'file_upload' | 'text_response' | 'both';
  max_file_size_mb?: number;
  allowed_file_types?: string;
  due_date?: string;
  points_possible: number;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateAssignmentRequest {
  title: string;
  description: string;
  instructions?: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  assignment_type: 'file_upload' | 'text_response' | 'both';
  max_file_size_mb?: number;
  allowed_file_types?: string;
  due_date?: string;
  points_possible?: number;
  is_published?: boolean;
}

// Project Types
export interface Project {
  id: number;
  title: string;
  description: string;
  objectives?: string;
  course_id: number;
  module_ids: number[];
  due_date: string;
  points_possible: number;
  is_published: boolean;
  submission_format: 'file_upload' | 'text_response' | 'both' | 'presentation';
  max_file_size_mb?: number;
  allowed_file_types?: string;
  collaboration_allowed: boolean;
  max_team_size: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProjectRequest {
  title: string;
  description: string;
  objectives?: string;
  course_id: number;
  module_ids: number[];
  due_date: string;
  points_possible?: number;
  is_published?: boolean;
  submission_format?: 'file_upload' | 'text_response' | 'both' | 'presentation';
  max_file_size_mb?: number;
  allowed_file_types?: string;
  collaboration_allowed?: boolean;
  max_team_size?: number;
}

// Module and Lesson Ordering
export interface ModuleOrderUpdate {
  id: number;
  order: number;
}

export interface LessonOrderUpdate {
  id: number;
  order: number;
}