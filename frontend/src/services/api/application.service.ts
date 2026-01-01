/**
 * Course Application API Service
 * Handles all course application-related API calls
 */

import BaseApiService from './base.service';
import { CourseApplication, ApplicationSubmitData, ApplicationStatistics } from './types';

class CourseApplicationService extends BaseApiService {
  private readonly BASE_PATH = '/applications';

  /**
   * Check if user has already applied for a course
   * Public endpoint - no auth required
   */
  async checkDuplicate(courseId: number, email: string): Promise<{
    exists: boolean;
    application?: {
      id: number;
      status: string;
      submitted_at: string;
      application_score: number;
      readiness_score: number;
      commitment_score: number;
      final_rank: number;
    };
  }> {
    return this.get(`${this.BASE_PATH}/check-duplicate`, {
      params: { course_id: courseId, email: email.trim().toLowerCase() }
    });
  }

  /**
   * Submit a new course application (Public endpoint - no auth required)
   */
  async submitApplication(data: ApplicationSubmitData): Promise<{
    message: string;
    application_id: number;
    status: string;
    scores: {
      application_score: number;
      readiness_score: number;
      commitment_score: number;
      risk_score: number;
      final_rank: number;
    };
  }> {
    return this.post(this.BASE_PATH, data);
  }

  /**
   * List applications with filters (Admin only)
   */
  async listApplications(
    status?: string,
    course_id?: number,
    search?: string,
    sort_by?: string,
    sort_order?: 'asc' | 'desc',
    page?: number,
    per_page?: number
  ): Promise<{
    applications: CourseApplication[];
    total: number;
    pages: number;
    current_page: number;
    per_page: number;
  }> {
    const params: any = {};
    if (status) params.status = status;
    if (course_id) params.course_id = course_id;
    if (search) params.search = search;
    if (sort_by) params.sort_by = sort_by;
    if (sort_order) params.sort_order = sort_order;
    if (page) params.page = page;
    if (per_page) params.per_page = per_page;

    return this.get(this.BASE_PATH, { params });
  }

  /**
   * Get a specific application by ID (Admin only)
   */
  async getApplication(id: number): Promise<CourseApplication> {
    return this.get(`${this.BASE_PATH}/${id}`);
  }

  /**
   * Approve an application (Admin only)
   * Creates user account and enrolls in course
   */
  async approveApplication(id: number, admin_notes?: string): Promise<{
    message: string;
    user_id: number;
    username: string;
    temp_password: string;
  }> {
    const data = admin_notes ? { admin_notes } : {};
    return this.post(`${this.BASE_PATH}/${id}/approve`, data);
  }

  /**
   * Reject an application (Admin only)
   */
  async rejectApplication(id: number, data: {
    rejection_reason: string;
    admin_notes?: string;
  }): Promise<{
    message: string;
  }> {
    return this.post(`${this.BASE_PATH}/${id}/reject`, data);
  }

  /**
   * Move application to waitlist (Admin only)
   */
  async waitlistApplication(id: number, admin_notes?: string): Promise<{
    message: string;
  }> {
    return this.post(`${this.BASE_PATH}/${id}/waitlist`, { admin_notes });
  }

  /**
   * Update admin notes for an application (Admin only)
   */
  async updateNotes(id: number, data: { admin_notes: string }): Promise<{
    message: string;
  }> {
    return this.put(`${this.BASE_PATH}/${id}/notes`, data);
  }

  /**
   * Recalculate all scores for an application (Admin only)
   */
  async recalculateScores(id: number): Promise<{
    message: string;
    scores: {
      application_score: number;
      readiness_score: number;
      commitment_score: number;
      risk_score: number;
      final_rank: number;
    };
  }> {
    return this.post(`${this.BASE_PATH}/${id}/recalculate`, {});
  }

  /**
   * Get application statistics (Admin only)
   */
  async getStatistics(course_id?: number): Promise<ApplicationStatistics> {
    const params = course_id ? { course_id } : {};
    return this.get(`${this.BASE_PATH}/statistics`, { params });
  }

  /**
   * Download applications as CSV (Admin only)
   */
  async downloadExport(status?: string, course_id?: string): Promise<void> {
    const params = new URLSearchParams();
    if (status) params.append('status', status);
    if (course_id) params.append('course_id', course_id);

    const token = this.getToken();
    const exportUrl = `${this.api.defaults.baseURL}${this.BASE_PATH}/export?${params.toString()}&token=${token}`;
    
    // Open in new window to trigger download
    window.open(exportUrl, '_blank');
  }
}

// Export singleton instance
export const applicationService = new CourseApplicationService();
export default applicationService;
