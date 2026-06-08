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
