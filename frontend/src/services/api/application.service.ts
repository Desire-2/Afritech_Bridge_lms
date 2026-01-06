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
   * List applications with enhanced search and filters (Admin only)
   */
  async listApplications(params: {
    // Basic filters
    status?: string;
    course_id?: number;
    page?: number;
    per_page?: number;
    
    // Enhanced search
    search?: string;
    
    // Advanced filters
    country?: string;
    city?: string;
    education_level?: string;
    current_status?: string;
    excel_skill_level?: string;
    referral_source?: string;
    
    // Date range filters
    date_from?: string; // YYYY-MM-DD
    date_to?: string;   // YYYY-MM-DD
    
    // Score filters
    min_score?: number;
    max_score?: number;
    score_type?: 'application_score' | 'final_rank_score' | 'readiness_score' | 'commitment_score' | 'risk_score';
    
    // Sorting
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
  } = {}): Promise<{
    applications: CourseApplication[];
    total: number;
    pages: number;
    current_page: number;
    per_page: number;
  }> {
    // Clean up undefined values
    const cleanParams = Object.fromEntries(
      Object.entries(params).filter(([_, value]) => value !== undefined && value !== '')
    );
    
    return this.get(this.BASE_PATH, { params: cleanParams });
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
   * Get search statistics and filter options (Admin only)
   */
  async getSearchStatistics(course_id?: number): Promise<{
    filter_options: {
      countries: string[];
      cities: string[];
      education_levels: string[];
      current_statuses: string[];
      excel_skill_levels: string[];
      referral_sources: string[];
    };
    status_counts: Record<string, number>;
    score_statistics: Record<string, {
      min: number;
      max: number;
      avg: number;
    }>;
    date_range: {
      earliest: string | null;
      latest: string | null;
    };
    total_applications: number;
  }> {
    const params = course_id ? { course_id } : {};
    return this.get(`${this.BASE_PATH}/search-stats`, { params });
  }

  /**
   * Advanced search with complex queries and analytics (Admin only)
   */
  async advancedSearch(searchConfig: {
    text_search?: string;
    filters?: Record<string, any>;
    score_ranges?: Record<string, { min?: number; max?: number }>;
    date_ranges?: {
      created_from?: string;
      created_to?: string;
    };
    sort_config?: {
      field: string;
      order: 'asc' | 'desc';
    };
    pagination?: {
      page: number;
      per_page: number;
    };
    include_analytics?: boolean;
    save_search?: boolean;
    search_name?: string;
  }): Promise<{
    applications: CourseApplication[];
    total: number;
    pages: number;
    current_page: number;
    per_page: number;
    search_config: any;
    analytics?: any;
  }> {
    return this.post(`${this.BASE_PATH}/advanced-search`, searchConfig);
  }

  /**
   * Find similar applications to a given one (Admin only)
   */
  async findSimilarApplications(applicationId: number, limit: number = 10): Promise<{
    target_application: CourseApplication;
    similar_applications: Array<CourseApplication & {
      similarity_score: number;
      similarity_factors: string[];
    }>;
    total_found: number;
  }> {
    const params = { limit };
    return this.get(`${this.BASE_PATH}/${applicationId}/similar`, { params });
  }

  /**
   * Export search results with custom formatting (Admin only)
   */
  async exportSearchResults(config: {
    search_config?: any;
    format?: 'excel' | 'csv';
    fields?: string[];
    include_analytics?: boolean;
    filename?: string;
  }): Promise<{
    message: string;
    download_url?: string;
  }> {
    return this.post(`${this.BASE_PATH}/search-export`, config);
  }

  /**
   * Debug search functionality - returns detailed search information
   */
  async debugSearch(searchTerm: string): Promise<{
    debug: {
      search_term: string;
      search_patterns: Array<{ type: string; pattern?: string; word?: string }>;
      fields_searched: string[];
      word_breakdown: string[];
      query_details: string[];
      total_conditions: number;
      results_count: number;
      total_applications: number;
      sample_results: Array<{
        id: number;
        full_name: string;
        email: string;
        matched_fields: Array<{
          field: string;
          value: string;
          match_type: string;
          matched_word?: string;
        }>;
      }>;
    };
    message: string;
  }> {
    return this.post(`${this.BASE_PATH}/search-debug`, { search: searchTerm });
  }

  /**
   * Quick search across applications (simplified interface)
   */
  async quickSearch(query: string, filters?: {
    course_id?: number;
    status?: string;
    limit?: number;
  }): Promise<{
    applications: CourseApplication[];
    total: number;
    suggestions: string[];
  }> {
    const params = {
      search: query,
      per_page: filters?.limit || 20,
      ...(filters || {})
    };
    
    const result = await this.listApplications(params);
    
    // Extract search suggestions from results
    const suggestions = this.extractSearchSuggestions(result.applications, query);
    
    return {
      applications: result.applications,
      total: result.total,
      suggestions
    };
  }

  /**
   * Get search suggestions based on existing data
   */
  private extractSearchSuggestions(applications: CourseApplication[], query: string): string[] {
    const suggestions = new Set<string>();
    const queryLower = query.toLowerCase();
    
    applications.forEach(app => {
      // Add name suggestions
      if (app.full_name?.toLowerCase().includes(queryLower)) {
        suggestions.add(app.full_name);
      }
      
      // Add email domain suggestions
      if (app.email?.toLowerCase().includes(queryLower)) {
        const domain = app.email.split('@')[1];
        if (domain) {
          suggestions.add(domain);
        }
      }
      
      // Add country suggestions
      if (app.country?.toLowerCase().includes(queryLower)) {
        suggestions.add(app.country);
      }
      
      // Add field of study suggestions
      if (app.field_of_study?.toLowerCase().includes(queryLower)) {
        suggestions.add(app.field_of_study);
      }
    });
    
    return Array.from(suggestions).slice(0, 5); // Limit suggestions
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

  /**
   * Perform bulk action on multiple applications (Admin only)
   * Returns immediately with a task ID for background processing
   */
  async bulkAction(data: {
    action: 'approve' | 'reject' | 'waitlist';
    application_ids: number[];
    rejection_reason?: string;
    custom_message?: string;
    send_emails?: boolean;
  }): Promise<{
    task_id: string;
    message: string;
    status: string;
    status_url: string;
    total_applications: number;
    estimated_time: string;
    poll_interval_seconds: number;
  }> {
    return this.post(`${this.BASE_PATH}/bulk-action`, data);
  }

  /**
   * Check the status of a bulk action task
   */
  async getBulkActionStatus(taskId: string): Promise<{
    task_id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    progress: {
      processed: number;
      total: number;
    };
    started_at: string;
    completed_at?: string;
    action: string;
    results?: {
      success: Array<{ id: number; status: string; email: string }>;
      failed: Array<{ id: number; error: string }>;
    };
    summary?: {
      total_processed: number;
      successful: number;
      failed: number;
      action: string;
    };
    error?: string;
  }> {
    return this.get(`${this.BASE_PATH}/bulk-action/${taskId}/status`);
  }

  /**
   * Get courses for filtering dropdown (Admin/Instructor)
   */
  async getCoursesForFiltering(): Promise<{
    courses: Array<{
      id: number;
      title: string;
      applications_count: number;
    }>;
  }> {
    return this.get(`${this.BASE_PATH}/courses`);
  }

  /**
   * Resend approval email to already approved applicant (Admin only)
   */
  async resendApprovalEmail(id: number, data?: {
    custom_message?: string;
    include_credentials?: boolean;
  }): Promise<{
    message: string;
    email_sent: boolean;
    credentials_reset: boolean;
    username: string;
    new_password_generated: boolean;
  }> {
    return this.post(`${this.BASE_PATH}/${id}/resend-approval`, data || {});
  }

  /**
   * Promote waitlisted application back to pending (Admin only)
   */
  async promoteFromWaitlist(id: number): Promise<{
    message: string;
    application_id: number;
    new_status: string;
    email_sent: boolean;
  }> {
    return this.post(`${this.BASE_PATH}/${id}/promote`, {});
  }

  /**
   * Send custom update email to waitlisted applicant (Admin only)
   */
  async sendWaitlistUpdate(id: number, message: string): Promise<{
    message: string;
    email_sent: boolean;
  }> {
    return this.post(`${this.BASE_PATH}/${id}/waitlist-update`, { message });
  }

  /**
   * Change application status directly (Admin only)
   */
  async changeStatus(id: number, data: {
    status: 'pending' | 'approved' | 'rejected' | 'waitlisted' | 'withdrawn';
    reason?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: { id: number; old_status: string; new_status: string };
  }> {
    return this.put(`${this.BASE_PATH}/${id}/status`, data);
  }

  /**
   * Send custom email to applicants (Admin only) - Background processing
   */
  async sendCustomEmail(data: {
    subject: string;
    message: string;
    course_id?: number;
    status_filter?: string;
    include_all?: boolean;
  }): Promise<{
    task_id: string;
    message: string;
    status_url: string;
    total_applications: number;
    estimated_time: string;
  }> {
    return this.post(`${this.BASE_PATH}/send-custom-email`, data);
  }

  /**
   * Get custom email task status (Admin only)
   */
  async getCustomEmailTaskStatus(taskId: string): Promise<{
    task_id: string;
    status: 'started' | 'processing' | 'completed' | 'failed';
    progress: {
      processed: number;
      total: number;
    };
    results?: {
      sent_count: number;
      failed_count: number;
      total_applications: number;
      failed_emails: Array<{
        email: string;
        recipient_name: string;
        error: string;
        application_id?: number;
      }>;
    };
    error?: string;
  }> {
    return this.get(`${this.BASE_PATH}/custom-email/${taskId}/status`);
  }

  /**
   * Retry failed custom emails (Admin only) - Background processing
   */
  async retryFailedEmails(data: {
    failed_emails: Array<{
      email: string;
      recipient_name: string;
      application_id?: number;
    }>;
    subject: string;
    message: string;
  }): Promise<{
    task_id: string;
    message: string;
    status_url: string;
    total_emails: number;
    estimated_time: string;
  }> {
    return this.post(`${this.BASE_PATH}/retry-failed-emails`, data);
  }
}

// Export singleton instance
export const applicationService = new CourseApplicationService();
export default applicationService;
