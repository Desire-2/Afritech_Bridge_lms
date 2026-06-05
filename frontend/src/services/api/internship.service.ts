/**
 * Internship API Service
 * Provides methods for internship application management, tracks, cohorts, and analytics
 */

import BaseApiService from './base.service';

// ═══════════ Types ═══════════

export interface InternshipTrack {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  icon_key: string | null;
  is_active: boolean;
  open_cohorts_count?: number;
  created_at: string;
  updated_at: string;
}

export interface InternshipCohort {
  id: string;
  track_id: string;
  track_name: string | null;
  cohort_name: string;
  cohort_code: string;
  start_date: string;
  end_date: string;
  capacity: number | null;
  is_accepting: boolean;
  accepted_count: number;
  spots_available: number | null;
  is_full: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface InternshipApplication {
  id: string;
  reference_code: string;
  applicant_type: 'graduate' | 'short_course_alumni' | 'external';
  full_name: string;
  email: string;
  phone: string;
  national_id: string | null;
  track_id: string;
  track_name: string | null;
  cohort_id: string | null;
  cohort_code: string | null;
  user_id: number | null;
  motivation_letter: string;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  cv_original_name: string;
  cv_file_path?: string;
  status: 'pending' | 'reviewing' | 'shortlisted' | 'interview_scheduled' | 'accepted' | 'rejected';
  reviewer_id: number | null;
  reviewer_name: string | null;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  interview_date: string | null;
  interview_notes: string | null;
  rejection_reason: string | null;
  status_logs?: ApplicationStatusLog[];
  created_at: string;
  updated_at: string;
}

export interface ApplicationStatusLog {
  id: string;
  application_id: string;
  changed_by_id: number;
  changed_by_name: string;
  old_status: string | null;
  new_status: string;
  note: string | null;
  changed_at: string;
}

export interface InternshipStats {
  total_applications: number;
  by_status: Record<string, number>;
  by_track: Record<string, number>;
  conversion_rates: {
    shortlist_rate: number;
    acceptance_rate: number;
    rejection_rate: number;
  };
  cohort_count: number;
  track_count: number;
}

export interface InternshipTask {
  id: string;
  cohort_id: string | null;
  cohort_name: string | null;
  cohort_code: string | null;
  assigned_by_id: number;
  assigned_by_name: string | null;
  title: string;
  description: string | null;
  task_type: string;
  priority: string;
  due_date: string | null;
  max_score: number | null;
  is_active: boolean;
  total_interns: number;
  completed_count: number;
  submitted_count: number;
  progress_pct: number;
  created_at: string;
  updated_at: string;
}

export interface InternshipTaskAssignment {
  id: string;
  task_id: string;
  task_title: string | null;
  intern_id: string;
  intern_name: string | null;
  intern_email: string | null;
  intern_reference: string | null;
  status: 'pending' | 'in_progress' | 'submitted' | 'approved' | 'rejected';
  submission_text: string | null;
  file_path: string | null;
  file_original_name: string | null;
  score: number | null;
  feedback: string | null;
  graded_by_id: number | null;
  graded_by_name: string | null;
  graded_at: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PaginatedResult<T> {
  data: T[];
  page: number;
  per_page: number;
  total: number;
  pages: number;
}

// ═══════════ Service Class ═══════════

class InternshipService extends BaseApiService {
  private readonly BASE = '/internships';

  // ═══════════ Public Endpoints ═══════════

  /** Get all active tracks with open cohort counts */
  async getTracks(includeCohorts = false): Promise<InternshipTrack[]> {
    return this.get(`${this.BASE}/tracks?include_cohorts=${includeCohorts}`);
  }

  /** Get track detail by slug */
  async getTrackDetail(slug: string): Promise<InternshipTrack & { cohorts: InternshipCohort[] }> {
    return this.get(`${this.BASE}/tracks/${slug}`);
  }

  /** Get all open cohorts with optional track filter */
  async getCohorts(params?: { track?: string; page?: number; per_page?: number }): Promise<PaginatedResult<InternshipCohort>> {
    const searchParams = new URLSearchParams();
    if (params?.track) searchParams.set('track', params.track);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.get(`${this.BASE}/cohorts${query}`);
  }

  // ═══════════ Admin Endpoints ═══════════

  /** Get internship stats */
  async getStats(): Promise<InternshipStats> {
    return this.get(`${this.BASE}/admin/stats`);
  }

  /** Get all applications with advanced filtering */
  async getApplications(params?: {
    status?: string;
    track_id?: string;
    cohort_id?: string;
    search?: string;
    start_date?: string;
    end_date?: string;
    page?: number;
    per_page?: number;
    sort_by?: string;
    sort_order?: string;
  }): Promise<PaginatedResult<InternshipApplication>> {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.track_id) searchParams.set('track_id', params.track_id);
    if (params?.cohort_id) searchParams.set('cohort_id', params.cohort_id);
    if (params?.search) searchParams.set('search', params.search);
    if (params?.start_date) searchParams.set('start_date', params.start_date);
    if (params?.end_date) searchParams.set('end_date', params.end_date);
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
    if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.get(`${this.BASE}/admin/applications${query}`);
  }

  /** Get single application detail */
  async getApplication(id: string): Promise<InternshipApplication> {
    return this.get(`${this.BASE}/admin/applications/${id}`);
  }

  /** Update application status */
  async updateStatus(id: string, data: {
    status: string;
    note?: string;
    interview_date?: string;
  }): Promise<{ success: boolean; message: string; data: InternshipApplication }> {
    return this.patch(`${this.BASE}/admin/applications/${id}/status`, data);
  }

  /** Assign cohort to accepted application */
  async assignCohort(id: string, cohortId: string): Promise<{ success: boolean; message: string; data: InternshipApplication }> {
    return this.patch(`${this.BASE}/admin/applications/${id}/assign-cohort`, { cohort_id: cohortId });
  }

  /** Download CV file (returns a blob URL) */
  getCvDownloadUrl(appId: string): string {
    const token = this.getToken();
    return `${this.getBaseUrl()}${this.BASE}/admin/applications/${appId}/cv?token=${token}`;
  }

  // ═══════════ Batch Operations ═══════════

  /** Batch update status for multiple applications */
  async batchUpdateStatus(data: {
    application_ids: string[];
    status: string;
    note?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      updated: { id: string; name: string; old_status: string; new_status: string }[];
      skipped: { id: string; name: string; reason: string }[];
      errors: { id: string; reason: string }[];
    };
  }> {
    return this.post(`${this.BASE}/admin/applications/batch/status`, data);
  }

  /** Batch assign cohort for multiple accepted applications */
  async batchAssignCohort(data: {
    application_ids: string[];
    cohort_id: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      updated: { id: string; name: string; cohort_code: string }[];
      skipped: { id: string; name: string; reason: string }[];
      errors: { id: string; reason: string }[];
    };
  }> {
    return this.post(`${this.BASE}/admin/applications/batch/assign-cohort`, data);
  }

  /** Batch generate offer letters for multiple accepted applications */
  async batchGenerateOffers(data: {
    application_ids: string[];
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      sent: { id: string; name: string; offer_number: string; username: string }[];
      skipped: { id: string; name: string; reason: string }[];
      errors: { id: string; reason: string }[];
    };
  }> {
    return this.post(`${this.BASE}/admin/applications/batch/offer`, data);
  }

  // ═══════════ Track Admin ═══════════

  /** Get all tracks (admin view - includes inactive) */
  async getAdminTracks(): Promise<InternshipTrack[]> {
    return this.get(`${this.BASE}/admin/tracks`);
  }

  /** Create a new track */
  async createTrack(data: {
    name: string;
    slug: string;
    description?: string;
    icon_key?: string;
  }): Promise<InternshipTrack> {
    return this.post(`${this.BASE}/admin/tracks`, data);
  }

  /** Update a track */
  async updateTrack(id: string, data: Partial<{
    name: string;
    slug: string;
    description: string;
    icon_key: string;
    is_active: boolean;
  }>): Promise<InternshipTrack> {
    return this.patch(`${this.BASE}/admin/tracks/${id}`, data);
  }

  /** Delete a track */
  async deleteTrack(id: string): Promise<{ success: boolean; message: string }> {
    return this.delete(`${this.BASE}/admin/tracks/${id}`);
  }

  // ═══════════ Cohort Admin ═══════════

  /** Get all cohorts (admin view) */
  async getAdminCohorts(params?: {
    page?: number;
    per_page?: number;
    track_id?: string;
  }): Promise<PaginatedResult<InternshipCohort>> {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set('page', params.page.toString());
    if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
    if (params?.track_id) searchParams.set('track_id', params.track_id);
    const query = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return this.get(`${this.BASE}/admin/cohorts${query}`);
  }

  /** Create a new cohort */
  async createCohort(data: {
    track_id: string;
    cohort_name: string;
    cohort_code: string;
    start_date: string;
    end_date: string;
    capacity?: number;
    description?: string;
  }): Promise<InternshipCohort> {
    return this.post(`${this.BASE}/admin/cohorts`, data);
  }

  /** Update a cohort */
  async updateCohort(id: string, data: Partial<{
    cohort_name: string;
    capacity: number;
    is_accepting: boolean;
    description: string;
    end_date: string;
  }>): Promise<InternshipCohort> {
    return this.patch(`${this.BASE}/admin/cohorts/${id}`, data);
  }

  /** Delete a cohort */
  async deleteCohort(id: string): Promise<{ success: boolean; message: string }> {
    return this.delete(`${this.BASE}/admin/cohorts/${id}`);
  }

  // ═══════════ Instructor Routes (Task Management & Progress) ═══════════

  /** Get instructor dashboard stats */
  async getInstructorStats(): Promise<{
    total_interns: number;
    unassigned_interns: number;
    active_cohorts: number;
    total_cohorts: number;
    total_tasks: number;
    active_tasks: number;
    pending_review: number;
    overdue_tasks: number;
    task_types: Record<string, number>;
  }> {
    return this.get(`${this.BASE}/instructor/stats`);
  }

  /** Get cohorts for instructor view */
  async getInstructorCohorts(params?: {
    page?: number;
    per_page?: number;
    track_id?: string;
  }): Promise<PaginatedResult<InternshipCohort & { intern_count: number; task_count: number }>> {
    const q = new URLSearchParams();
    if (params?.page) q.set('page', params.page.toString());
    if (params?.per_page) q.set('per_page', params.per_page.toString());
    if (params?.track_id) q.set('track_id', params.track_id);
    const query = q.toString() ? `?${q.toString()}` : '';
    return this.get(`${this.BASE}/instructor/cohorts${query}`);
  }

  /** Get interns in a cohort with task progress */
  async getCohortInterns(cohortId: string): Promise<(InternshipApplication & { task_stats: {
    total_assigned: number;
    completed: number;
    submitted: number;
    pending: number;
    progress_pct: number;
  } })[]> {
    return this.get(`${this.BASE}/instructor/cohorts/${cohortId}/interns`);
  }

  /** Get tasks with optional filters */
  async getInstructorTasks(params?: {
    cohort_id?: string;
    task_type?: string;
    priority?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResult<InternshipTask>> {
    const q = new URLSearchParams();
    if (params?.cohort_id) q.set('cohort_id', params.cohort_id);
    if (params?.task_type) q.set('task_type', params.task_type);
    if (params?.priority) q.set('priority', params.priority);
    if (params?.status) q.set('status', params.status);
    if (params?.page) q.set('page', params.page.toString());
    if (params?.per_page) q.set('per_page', params.per_page.toString());
    const query = q.toString() ? `?${q.toString()}` : '';
    return this.get(`${this.BASE}/instructor/tasks${query}`);
  }

  /** Get task detail with all assignments */
  async getTaskDetail(taskId: string): Promise<InternshipTask & { assignments: InternshipTaskAssignment[] }> {
    return this.get(`${this.BASE}/instructor/tasks/${taskId}`);
  }

  /** Create a new task */
  async createTask(data: {
    cohort_id?: string;
    title: string;
    description?: string;
    task_type?: string;
    priority?: string;
    due_date?: string;
    max_score?: number;
    intern_ids?: string[];
    assign_to_all?: boolean;
  }): Promise<InternshipTask> {
    return this.post(`${this.BASE}/instructor/tasks`, data);
  }

  /** Update a task */
  async updateTask(id: string, data: Partial<{
    title: string;
    description: string;
    task_type: string;
    priority: string;
    due_date: string;
    max_score: number;
    is_active: boolean;
  }>): Promise<InternshipTask> {
    return this.patch(`${this.BASE}/instructor/tasks/${id}`, data);
  }

  /** Delete a task */
  async deleteTask(id: string): Promise<{ success: boolean; message: string }> {
    return this.delete(`${this.BASE}/instructor/tasks/${id}`);
  }

  /** Assign task to interns */
  async assignTaskToInterns(taskId: string, data: {
    intern_ids?: string[];
    assign_to_all?: boolean;
  }): Promise<{ assigned_count: number }> {
    return this.post(`${this.BASE}/instructor/tasks/${taskId}/assign`, data);
  }

  /** Grade an intern's task submission */
  async gradeAssignment(assignmentId: string, data: {
    status: string;
    score?: number;
    feedback?: string;
  }): Promise<InternshipTaskAssignment> {
    return this.patch(`${this.BASE}/instructor/assignments/${assignmentId}/grade`, data);
  }

  /** Get tasks for a specific intern */
  async getInternTasks(internId: string): Promise<InternshipTaskAssignment[]> {
    return this.get(`${this.BASE}/instructor/interns/${internId}/tasks`);
  }

  // ═══════════ Offer Letter Routes ═══════════

  /** Generate an offer letter for an accepted application */
  async generateOffer(appId: string): Promise<{
    offer: InternshipOfferLetter;
    username: string;
    message: string;
  }> {
    return this.post(`${this.BASE}/admin/applications/${appId}/offer`, {});
  }

  /** Get offer letter details for an application */
  async getOffer(appId: string): Promise<InternshipOfferLetter & {
    is_authentic?: boolean;
    verification_message?: string;
  }> {
    return this.get(`${this.BASE}/admin/applications/${appId}/offer`);
  }

  /** Download offer letter PDF URL */
  getOfferDownloadUrl(offerId: string): string {
    const token = this.getToken();
    return `${this.getBaseUrl()}${this.BASE}/admin/offers/${offerId}/download?token=${token}`;
  }

  /** Verify offer letter integrity (tamper-proof check) */
  async verifyOffer(offerId: string): Promise<{
    success: boolean;
    message: string;
    data: {
      is_authentic: boolean;
      message: string;
      offer_number: string;
      pdf_hash: string;
      pdf_exists: boolean;
    };
  }> {
    return this.get(`${this.BASE}/admin/offers/${offerId}/verify`);
  }

  /** Get social media share content for an offer letter */
  async getShareContent(offerId: string, platform?: string): Promise<{
    success: boolean;
    message: string;
    data: {
      platform: string;
      text: string;
      share_url: string;
      total_shares: number;
      platforms: string[];
    };
  }> {
    return this.post(`${this.BASE}/admin/offers/${offerId}/share`, { platform });
  }
}

export interface InternshipOfferLetter {
  id: string;
  application_id: string;
  offer_number: string;
  pdf_path: string | null;
  pdf_hash: string | null;
  verification_hash: string;
  generated_username: string | null;
  status: 'sent' | 'accepted' | 'declined' | 'revoked';
  sent_at: string;
  accepted_at: string | null;
  accepted_by_user_id: number | null;
  share_token: string | null;
  social_shares: number;
  created_by_id: number;
  created_at: string;
  updated_at: string;
  // Optional fields from server
  is_authentic?: boolean;
  verification_message?: string;
}

const internshipService = new InternshipService();
export default internshipService;
