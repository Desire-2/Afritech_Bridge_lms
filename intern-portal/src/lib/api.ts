/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { 
  ApplicationStatus, 
  DashboardData, 
  TaskAssignment, 
  GradesSummary, 
  CohortData, 
  OfferData, 
  InternProfile,
  UserSession,
  TaskStatus,
  TaskPriority,
  TaskType,
  UpcomingDeadline
} from '../types';

// The developer can configure this via VITE_API_URL or use the default Render base URL
const DEFAULT_API_URL = 'https://study.afritechbridge.online/api/v1/internships';

export function getApiBaseUrl(): string {
  return (import.meta as any).env.VITE_API_URL || DEFAULT_API_URL;
}

// Sandbox Mode state helper
export function isSandboxMode(): boolean {
  const mode = localStorage.getItem('atb_sandbox_mode');
  // For easy preview/evaluation, default to true if no preference is saved
  return mode !== 'false'; 
}

export function setSandboxMode(enabled: boolean): void {
  localStorage.setItem('atb_sandbox_mode', String(enabled));
  window.dispatchEvent(new Event('sandbox_mode_changed'));
}

// --- SEED SANDBOX DATA ---
const SEED_INTERN = {
  first_name: 'John',
  last_name: 'Doe',
  full_name: 'John Doe',
  email: 'john@example.com',
  username: 'john.doe.a1b2c3',
  reference_code: 'ATB-26-A3F2',
  phone: '+250 788 123 456',
  portfolio_url: 'https://johndoe.dev',
  github_url: 'https://github.com/johndoe',
  linkedin_url: 'https://linkedin.com/in/johndoe',
  must_change_password: true
};

const SEED_PROGRAM = {
  track: 'Software Engineering',
  cohort: 'Cohort 3 - 2026',
  cohort_start: '2026-07-01T00:00:00Z',
  cohort_end: '2026-12-31T00:00:00Z',
  status: 'accepted'
};

const SEED_OFFER: OfferData = {
  offer_number: 'OFR-2026-0001',
  status: 'sent',
  sent_at: '2026-06-10T10:30:00Z',
  share_url: 'https://study.afritechbridge.online/verify/OFR-2026-0001',
  verification_url: 'https://study.afritechbridge.online/verify/OFR-2026-0001',
  download_url: 'https://afritech-bridge-lms-pc6f.onrender.com/api/v1/internships/offer/pdf'
};

const SEED_COHORT_DETAILS = {
  name: 'Cohort 3 - 2026',
  code: 'COH-2026-C3',
  description: 'Socio-economic impact building through advanced hands-on technology software tracks.',
  start_date: '2026-07-01T00:00:00Z',
  end_date: '2026-12-31T00:00:00Z',
  capacity: 45
};

const SEED_TRACK_DETAILS = {
  name: 'Software Engineering',
  description: 'Deep stack architecture, API development with Node/Express, and robust single page React apps.',
  icon: 'Terminal'
};

const SEED_FELLOWS = [
  { full_name: 'Amani Rukundo', reference_code: 'ATB-26-E38B', avatar: 'AR' },
  { full_name: 'Kezia Umutoni', reference_code: 'ATB-26-M49F', avatar: 'KU' },
  { full_name: 'David Ntwali', reference_code: 'ATB-26-Q10K', avatar: 'DN' },
  { full_name: 'Grace Mutoni', reference_code: 'ATB-26-B83P', avatar: 'GM' },
  { full_name: 'Olivier Mugisha', reference_code: 'ATB-26-T92L', avatar: 'OM' },
  { full_name: 'Angelique Ishimwe', reference_code: 'ATB-26-W37V', avatar: 'AI' }
];

const SEED_TASKS: TaskAssignment[] = [
  {
    assignment_id: 'task-1',
    task_id: 't-101',
    title: 'Git & Version Control Mastery',
    description: 'Complete the Git branches, merge conflicts, and rebasing exercise. Submit screenshot evidence of a clean git log showing branch integration and feature rebasing.\n\n### Objectives:\n- Create a private repo\n- Demonstrate feature branch workflow\n- Perform a clean interactive rebase (`git rebase -i`)\n- Push your work and submit the workspace link or command logs below.',
    task_type: 'report',
    priority: 'low',
    due_date: '2026-07-05T23:59:59Z',
    status: 'approved',
    score: 95,
    max_score: 100,
    submitted_at: '2026-06-05T14:22:00Z',
    graded_at: '2026-06-07T10:15:00Z',
    submission_text: 'Successfully resolved merge conflict. Repo URL: github.com/johndoe/git-exercise',
    feedback: 'Excellent execution. Your commit history is pristine, showing proper interactive rebasing with squashed intermediate commits. Keep this professional workflow up!'
  },
  {
    assignment_id: 'task-2',
    task_id: 't-102',
    title: 'Modern Responsive Layout Project',
    description: 'Build a mobile-first responsive landing page for an agritech business using HTML and custom Tailwind CSS. Must look gorgeous on 4K displays as well as older devices.\n\n### Instructions & Checklist:\n1. Incorporate CSS transitions and subtle animation delays.\n2. Ensure strong typographic contrast (pair Plus Jakarta Sans or Inter headings with clean body layouts).\n3. Keep your HTML completely clean with meaningful IDs for automation.',
    task_type: 'code',
    priority: 'medium',
    due_date: '2026-07-10T23:59:59Z',
    status: 'approved',
    score: 88,
    max_score: 100,
    submitted_at: '2026-06-08T18:45:00Z',
    graded_at: '2026-06-09T08:20:00Z',
    submission_text: 'Live preview of deployment is hosted at: dynamicagri-landing.pages.dev',
    feedback: 'Splendid choices in color theme & responsive fluidity. Review contrast levels on secondary button labels; they are slightly hard to read but the overall layout is industry-class.'
  },
  {
    assignment_id: 'task-3',
    task_id: 't-103',
    title: 'Database Modelling with Relational Schemas',
    description: 'Model a relational Database Schema for a standard LMS. Support cohorts, tracks, users, tasks, and grades with cascade rules and proper constraint index matrices.\n\nProvide deep SQL query blueprints for querying an intern\'s current average grade in less than 5ms.',
    task_type: 'quiz',
    priority: 'high',
    due_date: '2026-07-12T23:59:59Z',
    status: 'approved',
    score: 73,
    max_score: 100,
    submitted_at: '2026-06-07T09:30:00Z',
    graded_at: '2026-06-08T14:40:00Z',
    submission_text: 'CREATE TABLE cohorts (id UUID PRIMARY KEY, name VARCHAR...); -- submitted files contain the entity relation diagram PDF',
    feedback: 'Good logical division on relation metrics. However, you missed adding a composite index on `(intern_id, status)` for faster dashboard aggregation. Try to build optimal physical queries.'
  },
  {
    assignment_id: 'task-4',
    task_id: 't-104',
    title: 'Build a REST API for E-commerce',
    description: 'Create a fully secure Express + TypeScript REST API supporting user authorization, inventory indexing, and secure orders processing.\n\n### Criteria:\n- Validate inputs with JSON-Schema or Zod.\n- Handle errors beautifully via a central Express error handler.',
    task_type: 'code',
    priority: 'high',
    due_date: '2026-06-12T23:59:59Z',
    status: 'submitted',
    submitted_at: '2026-06-09T05:10:00Z',
    submission_text: 'Completed Express REST API with typescript. Configured schema-validator middleware and unified database connectivity.'
  },
  {
    assignment_id: 'task-5',
    task_id: 't-105',
    title: 'Write a React Task Manager with Offline Syncing',
    description: 'Build a fully reactive Task Manager. Integrate IndexDB or LocalStorage to support offline creation and automatic syncing once connectivity returns.',
    task_type: 'code',
    priority: 'medium',
    due_date: '2026-06-20T23:59:59Z',
    status: 'in_progress',
    submission_text: 'Working on IndexDB database adapters and sync status states.'
  },
  {
    assignment_id: 'task-6',
    task_id: 't-106',
    title: 'Prepare Cohort Agri-Tech Research Report',
    description: 'Draft a critical essay on the digital adoption of Fintech micro-credits in African agricultural sectors, focusing on current bottlenecks in East Africa.',
    task_type: 'essay',
    priority: 'low',
    due_date: '2026-06-26T23:59:59Z',
    status: 'in_progress'
  },
  {
    assignment_id: 'task-7',
    task_id: 't-107',
    title: 'Agile Scrum Methodologies Performance review',
    description: 'Multiple choice quiz on Agile frameworks, Sprint goals tracking, Scrum master leadership style, and retrospectives execution.',
    task_type: 'quiz',
    priority: 'low',
    due_date: '2026-06-30T23:59:59Z',
    status: 'pending'
  },
  {
    assignment_id: 'task-8',
    task_id: 't-108',
    title: 'Final Capstone Project Architecture Design',
    description: 'Establish the core database designs, cloud infrastructure outline, scaling methodologies, and final system architecture proposal for your capstone project.',
    task_type: 'report',
    priority: 'urgent',
    due_date: '2026-07-15T23:59:59Z',
    status: 'pending'
  }
];

// Initialize local storage database with seed values if empty
function initSandboxDb() {
  if (!localStorage.getItem('atb_sb_intern')) {
    localStorage.setItem('atb_sb_intern', JSON.stringify(SEED_INTERN));
  }
  if (!localStorage.getItem('atb_sb_program')) {
    localStorage.setItem('atb_sb_program', JSON.stringify(SEED_PROGRAM));
  }
  if (!localStorage.getItem('atb_sb_offer')) {
    localStorage.setItem('atb_sb_offer', JSON.stringify(SEED_OFFER));
  }
  if (!localStorage.getItem('atb_sb_tasks')) {
    localStorage.setItem('atb_sb_tasks', JSON.stringify(SEED_TASKS));
  }
}

initSandboxDb();

// --- HELPER WRAPPERS ---
async function fetchWithHeaders(url: string, options: RequestInit = {}): Promise<any> {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  
  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.message || `Request failed with status ${response.status}`);
  }
  
  return response.json();
}

export const api = {
  /**
   * 1. Public Track Application Status
   */
  async checkApplicationStatus(ref: string, email: string): Promise<ApplicationStatus> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 600)); // Simulate delay
      
      const isMatch = ref.trim().toUpperCase() === 'ATB-26-A3F2' && email.trim().toLowerCase() === 'john@example.com';
      if (!isMatch) {
        return {
          success: false,
          data: {
            reference_code: ref,
            email: email,
            full_name: '',
            status: 'pending',
            track: 'Software Engineering',
            cohort_name: 'Cohort 3 - 2026',
            applied_at: new Date().toISOString(),
            timeline: []
          }
        };
      }

      return {
        success: true,
        data: {
          reference_code: 'ATB-26-A3F2',
          email: 'john@example.com',
          full_name: 'John Doe',
          status: 'accepted',
          track: 'Software Engineering',
          cohort_name: 'Cohort 3 - 2026',
          applied_at: '2026-05-15T09:00:00Z',
          timeline: [
            { step: 'Applied', date: '2026-05-15', completed: true, active: false },
            { step: 'Technical Screening', date: '2026-05-24', completed: true, active: false },
            { step: 'Interview Panel', date: '2026-06-02', completed: true, active: false },
            { step: 'Accepted Offered Letter', date: '2026-06-08', completed: true, active: true }
          ]
        }
      };
    }

    const res = await fetch(`${getApiBaseUrl()}/apply/status?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`);
    if (!res.ok) throw new Error('Could not find application matching those credentials.');
    return res.json();
  },

  /**
   * 2. Login Endpoint
   */
  async login(email: string, password: string): Promise<UserSession> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 800));
      
      // Sandbox logins are: email: john@example.com / password: any (or admin)
      if (email.trim() === '' || password.trim() === '') {
        throw new Error('Email and password must not be empty.');
      }

      const internStr = localStorage.getItem('atb_sb_intern');
      const intern = internStr ? JSON.parse(internStr) : SEED_INTERN;

      // Create session
      const session: UserSession = {
        access_token: 'sandbox-jwt-web-token-xyz-12345',
        refresh_token: 'sandbox-refresh-xyz-12345',
        user: {
          id: 'usr-johndoe-987',
          full_name: intern.full_name,
          email: intern.email,
          role: 'intern',
          must_change_password: intern.must_change_password
        }
      };

      localStorage.setItem('token', session.access_token);
      localStorage.setItem('user', JSON.stringify(session.user));
      return session;
    }

    const data = await fetchWithHeaders(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });

    if (data.access_token) {
      localStorage.setItem('token', data.access_token);
      localStorage.setItem('user', JSON.stringify(data.user));
    }
    return data;
  },

  /**
   * Logout
   */
  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  /**
   * 3. Forgot Password
   */
  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { success: true, message: 'Password reset link dispatched to email.' };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email })
    });
  },

  /**
   * 4. Change Password
   */
  async changePassword(password: string): Promise<{ success: boolean }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 700));
      const internStr = localStorage.getItem('atb_sb_intern');
      if (internStr) {
        const intern = JSON.parse(internStr);
        intern.must_change_password = false;
        localStorage.setItem('atb_sb_intern', JSON.stringify(intern));
        
        const userStr = localStorage.getItem('user');
        if (userStr) {
          const userObj = JSON.parse(userStr);
          userObj.must_change_password = false;
          localStorage.setItem('user', JSON.stringify(userObj));
        }
      }
      return { success: true };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/change-password`, {
      method: 'PUT',
      body: JSON.stringify({ password })
    });
  },

  /**
   * 5. Dashboard Data
   */
  async getDashboard(): Promise<{ success: boolean; data: DashboardData }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const internStr = localStorage.getItem('atb_sb_intern') || JSON.stringify(SEED_INTERN);
      const tasksStr = localStorage.getItem('atb_sb_tasks') || JSON.stringify(SEED_TASKS);
      const offerStr = localStorage.getItem('atb_sb_offer') || JSON.stringify(SEED_OFFER);
      
      const intern = JSON.parse(internStr);
      const tasks: TaskAssignment[] = JSON.parse(tasksStr);
      const offer = JSON.parse(offerStr);

      // Compute aggregates
      const total = tasks.length;
      const completed = tasks.filter(t => t.status === 'approved').length;
      const submitted = tasks.filter(t => t.status === 'submitted').length;
      const inProgress = tasks.filter(t => t.status === 'in_progress').length;
      const pending = tasks.filter(t => t.status === 'pending').length;
      
      const gradedTasks = tasks.filter(t => t.status === 'approved' && t.score !== undefined);
      const avgScore = gradedTasks.length > 0 
        ? gradedTasks.reduce((sum, t) => sum + ((t.score! / (t.max_score || 100)) * 100), 0) / gradedTasks.length 
        : 0;

      const progressPct = Math.round((completed / total) * 100) || 0;

      // Filter upcoming deadlines (sort closer due date first)
      const upcomingDeadlines: UpcomingDeadline[] = tasks
        .filter(t => t.status === 'pending' || t.status === 'in_progress' || t.status === 'submitted')
        .map(t => ({
          assignment_id: t.assignment_id,
          task_id: t.task_id,
          title: t.title,
          task_type: t.task_type,
          priority: t.priority,
          due_date: t.due_date,
          status: t.status
        }))
        .sort((a, b) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime())
        .slice(0, 5);

      return {
        success: true,
        data: {
          intern: {
            full_name: intern.full_name,
            email: intern.email,
            phone: intern.phone,
            reference_code: intern.reference_code,
            username: intern.username
          },
          program: {
            track: SEED_PROGRAM.track,
            cohort: SEED_PROGRAM.cohort,
            cohort_start: SEED_PROGRAM.cohort_start,
            cohort_end: SEED_PROGRAM.cohort_end,
            status: SEED_PROGRAM.status
          },
          tasks: {
            total_assigned: total,
            completed,
            submitted,
            in_progress: inProgress,
            pending,
            progress_pct: progressPct,
            avg_score: Math.round(avgScore * 10) / 10
          },
          upcoming_deadlines: upcomingDeadlines,
          offer: {
            id: 'o-483f3g',
            offer_number: offer.offer_number,
            status: offer.status,
            sent_at: offer.sent_at
          }
        }
      };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/dashboard`);
  },

  /**
   * 6. Tasks List
   */
  async getTasks(filters: { 
    status?: string; 
    task_type?: string; 
    sort_by?: string; 
    sort_order?: string; 
  } = {}): Promise<{ success: boolean; data: TaskAssignment[] }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const tasksStr = localStorage.getItem('atb_sb_tasks') || JSON.stringify(SEED_TASKS);
      let list: TaskAssignment[] = JSON.parse(tasksStr);

      // Filters
      if (filters.status && filters.status !== 'all') {
        list = list.filter(t => t.status === filters.status);
      }
      if (filters.task_type && filters.task_type !== 'all') {
        list = list.filter(t => t.task_type.toLowerCase() === filters.task_type!.toLowerCase());
      }

      // Sorting
      const sortBy = filters.sort_by || 'due_date';
      const order = filters.sort_order || 'asc';
      
      list.sort((a, b) => {
        let valA: any = a[sortBy as keyof TaskAssignment];
        let valB: any = b[sortBy as keyof TaskAssignment];

        if (sortBy === 'priority') {
          const priorityWeights = { urgent: 4, high: 3, medium: 2, low: 1 };
          valA = priorityWeights[a.priority as keyof typeof priorityWeights] || 0;
          valB = priorityWeights[b.priority as keyof typeof priorityWeights] || 0;
        } else if (sortBy === 'due_date' || sortBy === 'created_at' || sortBy === 'submitted_at') {
          valA = valA ? new Date(valA).getTime() : 0;
          valB = valB ? new Date(valB).getTime() : 0;
        } else if (typeof valA === 'string') {
          return order === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        if (valA < valB) return order === 'asc' ? -1 : 1;
        if (valA > valB) return order === 'asc' ? 1 : -1;
        return 0;
      });

      return { success: true, data: list };
    }

    const q = new URLSearchParams();
    if (filters.status) q.append('status', filters.status);
    if (filters.task_type) q.append('task_type', filters.task_type);
    if (filters.sort_by) q.append('sort_by', filters.sort_by);
    if (filters.sort_order) q.append('sort_order', filters.sort_order);

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/tasks?${q.toString()}`);
  },

  /**
   * 7. Task Detail
   */
  async getTaskDetail(assignmentId: string): Promise<{ success: boolean; data: TaskAssignment }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const tasksStr = localStorage.getItem('atb_sb_tasks') || JSON.stringify(SEED_TASKS);
      const list: TaskAssignment[] = JSON.parse(tasksStr);
      const task = list.find(t => t.assignment_id === assignmentId);
      
      if (!task) {
        throw new Error(`Task with assignment ID ${assignmentId} could not be found.`);
      }
      return { success: true, data: task };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/tasks/${assignmentId}`);
  },

  /**
   * Submit Task Work
   */
  async submitTask(
    assignmentId: string, 
    payload: { submission_text: string; submission_file?: string }
  ): Promise<{ success: boolean; data: TaskAssignment }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const tasksStr = localStorage.getItem('atb_sb_tasks') || JSON.stringify(SEED_TASKS);
      const list: TaskAssignment[] = JSON.parse(tasksStr);
      
      const index = list.findIndex(t => t.assignment_id === assignmentId);
      if (index === -1) {
        throw new Error(`Task ${assignmentId} not found.`);
      }

      list[index].status = 'submitted';
      list[index].submitted_at = new Date().toISOString();
      list[index].submission_text = payload.submission_text;
      if (payload.submission_file) {
        list[index].submission_file = payload.submission_file;
      }

      localStorage.setItem('atb_sb_tasks', JSON.stringify(list));
      return { success: true, data: list[index] };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/tasks/${assignmentId}/submit`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  /**
   * 8. My Grades
   */
  async getGrades(): Promise<{ success: boolean; data: GradesSummary }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const tasksStr = localStorage.getItem('atb_sb_tasks') || JSON.stringify(SEED_TASKS);
      const list: TaskAssignment[] = JSON.parse(tasksStr);

      const approved = list.filter(t => t.status === 'approved');
      const rejected = list.filter(t => t.status === 'rejected');
      const totalGraded = approved.length + rejected.length;
      const pendingReview = list.filter(t => t.status === 'submitted').length;

      // Overall Score percentage across approved graded tasks
      const gradedApproved = approved.filter(t => t.score !== undefined);
      const totalScoreSum = gradedApproved.reduce((sum, t) => sum + (t.score || 0), 0);
      const totalMaxSum = gradedApproved.reduce((sum, t) => sum + (t.max_score || 100), 0);
      const overallPct = totalMaxSum > 0 ? (totalScoreSum / totalMaxSum) * 100 : 0;

      return {
        success: true,
        data: {
          total_graded: totalGraded,
          approved_count: approved.length,
          rejected_count: rejected.length,
          overall_percentage: Math.round(overallPct * 10) / 10,
          pending_review_count: pendingReview,
          list: list.filter(t => t.status === 'approved' || t.status === 'rejected' || t.status === 'submitted')
        }
      };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/grades`);
  },

  /**
   * 9. Cohort
   */
  async getCohort(): Promise<{ success: boolean; data: CohortData }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return {
        success: true,
        data: {
          cohort: SEED_COHORT_DETAILS,
          track: SEED_TRACK_DETAILS,
          fellows: SEED_FELLOWS
        }
      };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/cohort`);
  },

  /**
   * 10. Offer Letter
   */
  async getOffer(): Promise<{ success: boolean; data: OfferData }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const offerStr = localStorage.getItem('atb_sb_offer') || JSON.stringify(SEED_OFFER);
      return {
        success: true,
        data: JSON.parse(offerStr)
      };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/offer`);
  },

  /**
   * 11. Profile & Settings
   */
  async getProfile(): Promise<{ success: boolean; data: InternProfile }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const internStr = localStorage.getItem('atb_sb_intern') || JSON.stringify(SEED_INTERN);
      return {
        success: true,
        data: JSON.parse(internStr)
      };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/profile`);
  },

  async updateProfile(payload: Partial<InternProfile>): Promise<{ success: boolean; data: InternProfile }> {
    if (isSandboxMode()) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const internStr = localStorage.getItem('atb_sb_intern') || JSON.stringify(SEED_INTERN);
      const current = JSON.parse(internStr);
      
      const updated = {
        ...current,
        ...payload,
        // Composite full name if parts changed
        full_name: `${payload.first_name || current.first_name} ${payload.last_name || current.last_name}`.trim()
      };

      localStorage.setItem('atb_sb_intern', JSON.stringify(updated));

      // Also update stored user session details
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const userObj = JSON.parse(userStr);
        userObj.full_name = updated.full_name;
        localStorage.setItem('user', JSON.stringify(userObj));
      }

      return { success: true, data: updated };
    }

    return fetchWithHeaders(`${getApiBaseUrl()}/intern/profile`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });
  }
};
