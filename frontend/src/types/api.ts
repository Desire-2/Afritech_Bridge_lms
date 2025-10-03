// User and Authentication Types
export interface User {
  id: number;
  username: string;
  email: string;
  first_name?: string;
  last_name?: string;
  profile_picture_url?: string;
  bio?: string;
  role: string;
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
  module_id: number;
  time_limit?: number;
  max_attempts?: number;
  created_at: string;
  updated_at: string;
  questions?: Question[];
}

export interface CreateQuizRequest {
  title: string;
  description?: string;
  module_id: number;
  time_limit?: number;
  max_attempts?: number;
}

export interface Question {
  id: number;
  quiz_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  order_index: number;
  created_at: string;
  updated_at: string;
  answers?: Answer[];
}

export interface CreateQuestionRequest {
  quiz_id: number;
  question_text: string;
  question_type: 'multiple_choice' | 'true_false' | 'short_answer';
  points: number;
  order_index: number;
}

export interface Answer {
  id: number;
  question_id: number;
  answer_text: string;
  is_correct: boolean;
  created_at: string;
  updated_at: string;
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
  title: string;
  content: string;
  created_at: string;
  updated_at: string;
  course?: Course;
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