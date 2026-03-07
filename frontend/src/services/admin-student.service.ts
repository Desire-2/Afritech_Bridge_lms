import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

// ============================================================
// Types
// ============================================================

export interface StudentListParams {
  page?: number;
  per_page?: number;
  search?: string;
  status?: string;
  course_id?: number;
  enrollment_status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  performance?: 'high' | 'medium' | 'low';
  date_from?: string;
  date_to?: string;
}

export interface EnrollmentSummary {
  total: number;
  active: number;
  completed: number;
  terminated: number;
}

export interface ProgressSummary {
  avg_progress: number;
  avg_score: number;
  lessons_completed: number;
  quiz_submissions: number;
  certificates: number;
}

export interface StudentActivity {
  last_login: string | null;
  last_activity: string | null;
  days_inactive: number | null;
}

export interface StudentListItem {
  id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  is_active: boolean;
  created_at: string;
  role: string;
  enrollment_summary: EnrollmentSummary;
  progress_summary: ProgressSummary;
  activity: StudentActivity;
  performance_level: 'high' | 'medium' | 'low';
}

export interface StudentListResponse {
  students: StudentListItem[];
  pagination: {
    current_page: number;
    per_page: number;
    total_pages: number;
    total_items: number;
    has_next: boolean;
    has_prev: boolean;
  };
  summary: {
    total_students: number;
    active_students: number;
    inactive_students: number;
    recently_active_7d: number;
  };
}

export interface ModuleProgressItem {
  module_id: number;
  module_title: string;
  module_score: number | null;
  is_completed: boolean;
  completed_at: string | null;
}

export interface EnrollmentDetail {
  id: number;
  student_id: number;
  course_id: number;
  course_title: string;
  enrollment_date: string;
  progress: number;
  course_score: number;
  status: string;
  completed_at: string | null;
  terminated_at: string | null;
  termination_reason: string | null;
  cohort_label: string | null;
  payment_status: string | null;
  payment_verified: boolean;
  module_progress: ModuleProgressItem[];
  lessons_completed: number;
  total_lessons: number;
}

export interface QuizPerformance {
  id: number;
  quiz_id: number;
  quiz_title: string;
  score: number;
  max_score: number | null;
  submitted_at: string | null;
  created_at: string | null;
}

export interface CertificateItem {
  id: number;
  course_id: number;
  course_title: string;
  issued_at: string | null;
  created_at: string | null;
  certificate_url: string | null;
}

export interface StudentDetailResponse {
  student: Record<string, any>;
  enrollments: EnrollmentDetail[];
  quiz_performance: QuizPerformance[];
  certificates: CertificateItem[];
  analytics: {
    total_time_spent: number;
    avg_session_duration: number;
    login_count: number;
  } | null;
  achievements: {
    total_achievements: number;
    current_streak: number;
    longest_streak: number;
    total_points: number;
  };
  study_materials: {
    notes_count: number;
    bookmarks_count: number;
  };
  account_info: {
    created_at: string | null;
    last_login: string | null;
    last_activity: string | null;
    days_inactive: number | null;
    is_active: boolean;
  };
}

export interface StudentStats {
  total_students: number;
  active_students: number;
  inactive_students: number;
  new_students_7d: number;
  new_students_30d: number;
  active_last_7d: number;
  enrollment_stats: {
    total: number;
    active: number;
    completed: number;
  };
  achievement_stats: {
    certificates_issued: number;
    lessons_completed: number;
  };
}

export interface PerformanceReport {
  overview: {
    total_students: number;
    total_enrollments: number;
    active_enrollments: number;
    completed_enrollments: number;
    terminated_enrollments: number;
    avg_progress: number;
    completion_rate: number;
    total_lesson_completions: number;
  };
  top_students: Array<{
    id: number;
    username: string;
    full_name: string;
    email: string;
    avg_score: number;
    modules_completed: number;
  }>;
  at_risk_students: Array<{
    id: number;
    username: string;
    full_name: string;
    email: string;
    progress: number;
    course_title: string;
    enrolled_since: string | null;
  }>;
  course_performance: Array<{
    course_id: number;
    course_title: string;
    enrolled: number;
    completed: number;
    avg_progress: number;
    completion_rate: number;
  }>;
  period: string;
}

export interface AvailableCourse {
  id: number;
  title: string;
  instructor: string;
  enrollment_type: string;
  enrollments_count: number;
}

// ============================================================
// Service
// ============================================================

export class AdminStudentService {
  private static readonly BASE = '/admin/students';

  // --- List students with enriched data ---
  static async listStudents(params?: StudentListParams): Promise<StudentListResponse> {
    try {
      const sp = new URLSearchParams();
      if (params?.page) sp.set('page', params.page.toString());
      if (params?.per_page) sp.set('per_page', params.per_page.toString());
      if (params?.search) sp.set('search', params.search);
      if (params?.status) sp.set('status', params.status);
      if (params?.course_id) sp.set('course_id', params.course_id.toString());
      if (params?.enrollment_status) sp.set('enrollment_status', params.enrollment_status);
      if (params?.sort_by) sp.set('sort_by', params.sort_by);
      if (params?.sort_order) sp.set('sort_order', params.sort_order);
      if (params?.performance) sp.set('performance', params.performance);
      if (params?.date_from) sp.set('date_from', params.date_from);
      if (params?.date_to) sp.set('date_to', params.date_to);

      const url = sp.toString() ? `${this.BASE}?${sp.toString()}` : this.BASE;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Get student detail ---
  static async getStudentDetail(studentId: number): Promise<StudentDetailResponse> {
    try {
      const response = await apiClient.get(`${this.BASE}/${studentId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Get student enrollments ---
  static async getStudentEnrollments(studentId: number): Promise<{
    student: { id: number; username: string; full_name: string };
    enrollments: EnrollmentDetail[];
    total: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE}/${studentId}/enrollments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Enroll student in course ---
  static async enrollStudent(studentId: number, data: {
    course_id: number;
    payment_status?: string;
    payment_verified?: boolean;
    cohort_label?: string;
  }): Promise<{ message: string; enrollment: EnrollmentDetail }> {
    try {
      const response = await apiClient.post(`${this.BASE}/${studentId}/enroll`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Update enrollment (terminate, reactivate, complete, suspend) ---
  static async updateEnrollment(studentId: number, enrollmentId: number, data: {
    action: 'terminate' | 'reactivate' | 'complete' | 'suspend' | 'update_payment';
    reason?: string;
    payment_status?: string;
    payment_verified?: boolean;
  }): Promise<{ message: string; enrollment: EnrollmentDetail }> {
    try {
      const response = await apiClient.put(
        `${this.BASE}/${studentId}/enrollments/${enrollmentId}`,
        data
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Remove enrollment ---
  static async removeEnrollment(studentId: number, enrollmentId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(
        `${this.BASE}/${studentId}/enrollments/${enrollmentId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Bulk enroll students ---
  static async bulkEnroll(data: {
    student_ids: number[];
    course_id: number;
    payment_status?: string;
    payment_verified?: boolean;
    cohort_label?: string;
  }): Promise<{
    message: string;
    enrolled: number;
    skipped: number;
    errors: string[];
    course: string;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE}/bulk-enroll`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Reset student progress ---
  static async resetProgress(studentId: number, data?: {
    course_id?: number;
    reset_type?: 'progress' | 'full';
  }): Promise<{ message: string; reset_type: string }> {
    try {
      const response = await apiClient.post(`${this.BASE}/${studentId}/reset-progress`, data || {});
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Toggle student status ---
  static async toggleStatus(studentId: number): Promise<{ message: string; is_active: boolean }> {
    try {
      const response = await apiClient.post(`${this.BASE}/${studentId}/toggle-status`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Student stats ---
  static async getStats(): Promise<StudentStats> {
    try {
      const response = await apiClient.get(`${this.BASE}/stats`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Performance report ---
  static async getPerformanceReport(params?: {
    course_id?: number;
    period?: string;
  }): Promise<PerformanceReport> {
    try {
      const sp = new URLSearchParams();
      if (params?.course_id) sp.set('course_id', params.course_id.toString());
      if (params?.period) sp.set('period', params.period);

      const url = sp.toString()
        ? `${this.BASE}/performance-report?${sp.toString()}`
        : `${this.BASE}/performance-report`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Bulk student action ---
  static async bulkAction(data: {
    student_ids: number[];
    action: 'activate' | 'deactivate' | 'enroll' | 'unenroll' | 'reset_progress';
    course_id?: number;
  }): Promise<{
    message: string;
    affected: number;
    total_requested: number;
    errors?: string[];
  }> {
    try {
      const response = await apiClient.post(`${this.BASE}/bulk-action`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Available courses for enrollment ---
  static async getAvailableCourses(): Promise<{ courses: AvailableCourse[] }> {
    try {
      const response = await apiClient.get(`${this.BASE}/available-courses`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Send message to a student ---
  static async sendMessage(studentId: number, data: {
    subject: string;
    message: string;
  }): Promise<{ message: string; email_sent: boolean; notification_sent: boolean }> {
    try {
      const response = await apiClient.post(`${this.BASE}/${studentId}/send-message`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Send bulk message to students ---
  static async bulkMessage(data: {
    student_ids: number[];
    subject: string;
    message: string;
  }): Promise<{ message: string; sent: number; total_requested: number; errors?: string[] | null }> {
    try {
      const response = await apiClient.post(`${this.BASE}/bulk-message`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // --- Export students as CSV ---
  static async exportCSV(params?: {
    search?: string;
    status?: string;
    course_id?: number;
    student_ids?: number[];
  }): Promise<void> {
    const sp = new URLSearchParams();
    if (params?.search) sp.set('search', params.search);
    if (params?.status) sp.set('status', params.status);
    if (params?.course_id) sp.set('course_id', params.course_id.toString());
    if (params?.student_ids?.length) sp.set('student_ids', params.student_ids.join(','));

    const url = `/admin/students/export${sp.toString() ? `?${sp.toString()}` : ''}`;
    const response = await apiClient.get(url, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'text/csv' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `students_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  // --- Update student notes (admin note) ---
  static async updateAdminNote(studentId: number, note: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.patch(`${this.BASE}/${studentId}/admin-note`, { note });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}
