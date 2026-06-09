/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Type definitions aligned with the AfriTech Bridge backend API responses.
 */

export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'code' | 'quiz' | 'essay' | 'report' | string;

// ---------------------------------------------------------------------------
// Application Status (from GET /apply/status)
// ---------------------------------------------------------------------------
export interface ApplicationStatus {
  status: string;
  submittedAt: string;
  review_stage: string;
  full_name: string;
  email: string;
  reference_code: string;
  track_name: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// Session (from POST /auth/login)
// ---------------------------------------------------------------------------
export interface UserSession {
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    full_name: string;
    email: string;
    role: string;
    must_change_password: boolean;
  };
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export interface DashboardData {
  intern: {
    full_name: string;
    email: string;
    phone: string;
    reference_code: string;
    username: string;
  };
  program: {
    track: string;
    cohort: string;
    cohort_start: string;
    cohort_end: string;
    status: string;
  };
  tasks: {
    total_assigned: number;
    completed: number;
    submitted: number;
    in_progress: number;
    pending: number;
    progress_pct: number;
    avg_score: number | null;
  };
  upcoming_deadlines: UpcomingDeadline[];
  offer: {
    id: string;
    offer_number: string;
    status: string;
    sent_at: string;
  };
}

export interface UpcomingDeadline {
  assignment_id: string;
  task_id: string;
  title: string;
  task_type: TaskType;
  priority: TaskPriority;
  due_date: string;
  status: TaskStatus;
}

// ---------------------------------------------------------------------------
// Task Assignment
// ---------------------------------------------------------------------------
export interface TaskAssignment {
  assignment_id: string;
  task_id: string;
  title: string;
  description: string;
  task_type: TaskType;
  priority: TaskPriority;
  due_date: string;
  status: TaskStatus;
  score?: number;
  max_score?: number;
  submitted_at?: string;
  graded_at?: string;
  submission_text?: string;
  submission_file_path?: string;
  feedback?: string;
}

// ---------------------------------------------------------------------------
// Grades Summary
// ---------------------------------------------------------------------------
export interface GradesSummary {
  summary: {
    total_graded: number;
    approved: number;
    rejected: number;
    pending_review: number;
    overall_score_pct: number | null;
    total_score: number;
    max_total: number;
  };
  graded: GradedEntry[];
  pending_review: PendingEntry[];
}

export interface GradedEntry {
  assignment_id: string;
  task_title: string;
  task_type: TaskType;
  status: string;
  score: number;
  max_score: number;
  feedback: string;
  submitted_at: string;
  graded_at: string;
}

export interface PendingEntry {
  assignment_id: string;
  task_title: string;
  task_type: TaskType;
  submitted_at: string;
}

// ---------------------------------------------------------------------------
// Cohort
// ---------------------------------------------------------------------------
export interface CohortData {
  cohort: {
    cohort_name: string;
    cohort_code: string;
    description: string;
    start_date: string;
    end_date: string;
    capacity: number;
    is_accepting: boolean;
  };
  track: {
    name: string;
    description: string;
  };
  fellow_interns: FellowIntern[];
  total_interns: number;
}

export interface FellowIntern {
  id: string;
  full_name: string;
  email: string;
  reference_code: string;
}

// ---------------------------------------------------------------------------
// Offer Letter
// ---------------------------------------------------------------------------
export interface OfferData {
  id: string;
  offer_number: string;
  status: string;
  sent_at: string;
  verification_url: string;
  share_url: string;
  is_authentic: boolean;
  verification_message?: string;
}

// ---------------------------------------------------------------------------
// Intern Profile
// ---------------------------------------------------------------------------
export interface InternProfile {
  first_name: string;
  last_name: string;
  full_name: string;
  email: string;
  username: string;
  reference_code: string;
  phone: string;
  portfolio_url: string;
  github_url: string;
  linkedin_url: string;
  must_change_password: boolean;
}
