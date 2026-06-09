/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type TaskStatus = 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
export type TaskPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TaskType = 'code' | 'quiz' | 'essay' | 'report' | string;

export interface ApplicationStatus {
  success: boolean;
  data: {
    reference_code: string;
    email: string;
    full_name: string;
    status: 'pending' | 'accepted' | 'rejected' | 'waitlisted';
    track: string;
    cohort_name: string;
    applied_at: string;
    timeline: {
      step: string;
      date: string | null;
      completed: boolean;
      active: boolean;
    }[];
  };
}

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
    avg_score: number;
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
  submission_file?: string;
  feedback?: string;
}

export interface GradesSummary {
  total_graded: number;
  approved_count: number;
  rejected_count: number;
  overall_percentage: number;
  pending_review_count: number;
  list: TaskAssignment[];
}

export interface FellowIntern {
  full_name: string;
  reference_code: string;
  avatar?: string;
  role?: string;
}

export interface CohortData {
  cohort: {
    name: string;
    code: string;
    description: string;
    start_date: string;
    end_date: string;
    capacity: number;
  };
  track: {
    name: string;
    description: string;
    icon?: string;
  };
  fellows: FellowIntern[];
}

export interface OfferData {
  offer_number: string;
  status: 'sent' | 'accepted' | 'declined' | 'verified';
  sent_at: string;
  share_url: string;
  verification_url: string;
  download_url: string;
}

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
