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

export interface CohortStatus {
  status: 'open' | 'closed' | 'upcoming';
  reason?: string | null;
  opens_at?: string | null;
  closes_at?: string | null;
  cohort_start?: string | null;
  cohort_end?: string | null;
  cohort_label?: string | null;
}

export type CohortStatus = 'open' | 'closed' | 'upcoming';

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
  category?: string;
  estimated_duration?: string;
  rating?: number;
  total_students?: number;
  enrollment_count?: number;
  modules?: { title: string; id: number }[];
  enrollment_type?: string;
  price?: number | null;
  currency?: string | null;
  payment_mode?: string;
  partial_payment_amount?: number | null;
  partial_payment_percentage?: number | null;
  payment_methods?: string[];
  paypal_enabled?: boolean;
  mobile_money_enabled?: boolean;
  bank_transfer_enabled?: boolean;
  require_payment_before_application?: boolean;
  payment_summary?: any;
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
