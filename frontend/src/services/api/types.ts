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
  course_contribution_score: number;
  quiz_score: number;
  assignment_score: number;
  final_assessment_score: number;
  cumulative_score: number;
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
  payment_method?: 'card' | 'mobile_money' | 'bank_transfer';
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
