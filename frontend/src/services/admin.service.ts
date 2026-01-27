import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, PaginatedResponse, UserListResponse } from '@/types/api';

export interface UserListParams {
  page?: number;
  per_page?: number;
  role?: string;
  search?: string;
  status?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  date_from?: string;
  date_to?: string;
}

export class AdminService {
  private static readonly BASE_PATH = '/admin';

  // User management - Enhanced with all filter options
  static async getAllUsers(params?: UserListParams): Promise<UserListResponse> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.role) searchParams.set('role', params.role);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      if (params?.sort_by) searchParams.set('sort_by', params.sort_by);
      if (params?.sort_order) searchParams.set('sort_order', params.sort_order);
      if (params?.date_from) searchParams.set('date_from', params.date_from);
      if (params?.date_to) searchParams.set('date_to', params.date_to);

      const url = searchParams.toString() 
        ? `${this.BASE_PATH}/users?${searchParams.toString()}`
        : `${this.BASE_PATH}/users`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getUser(userId: number): Promise<User> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateUser(userId: number, userData: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/users/${userId}`, userData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteUser(userId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/users/${userId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createUser(userData: any): Promise<User> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/users`, userData);
      return response.data.user;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getUserStats(): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/users/stats`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getUserActivity(userId: number): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/users/${userId}/activity`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async bulkUserAction(data: {
    user_ids: number[];
    action: string;
    role_name?: string;
  }): Promise<{ 
    message: string; 
    affected_users: number;
    total_requested: number;
    errors?: string[];
    warnings?: string[];
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/users/bulk-action`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async exportUsers(params?: {
    role?: string;
    search?: string;
    status?: string;
    format?: 'csv' | 'json';
  }): Promise<Blob> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.role) searchParams.set('role', params.role);
      if (params?.search) searchParams.set('search', params.search);
      if (params?.status) searchParams.set('status', params.status);
      searchParams.set('format', params?.format || 'csv');

      const url = `${this.BASE_PATH}/users/export?${searchParams.toString()}`;
      const response = await apiClient.get(url, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getRoles(): Promise<{ roles: Array<{ id: number; name: string }> }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/roles`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateUserRole(userId: number, roleId: number): Promise<User> {
    try {
      const response = await apiClient.patch(`${this.BASE_PATH}/users/${userId}/role`, { role_id: roleId });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // System statistics
  static async getSystemStats(): Promise<{
    total_users: number;
    active_users: number;
    users_by_role: Record<string, number>;
    total_courses: number;
    published_courses: number;
    total_enrollments: number;
    total_opportunities: number;
    active_quizzes: number;
    recent_activity: any[];
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/stats`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get comprehensive dashboard analytics
  static async getDashboardAnalytics(): Promise<{
    user_stats: any;
    course_stats: any;
    enrollment_stats: any;
    growth_data: any[];
  }> {
    try {
      // Fetch multiple stats in parallel
      const [userStats, systemStats] = await Promise.all([
        this.getUserStats(),
        this.getSystemStats()
      ]);
      
      return {
        user_stats: userStats,
        course_stats: {
          total_courses: systemStats.total_courses,
          published_courses: systemStats.published_courses,
        },
        enrollment_stats: {
          total_enrollments: systemStats.total_enrollments
        },
        growth_data: userStats.user_growth || []
      };
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get enrollment analytics with breakdown
  static async getEnrollmentBreakdown(): Promise<{
    status_breakdown: Array<{ status: string; count: number }>;
    total: number;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/analytics/enrollment-breakdown`);
      return response.data;
    } catch (error) {
      // Fallback if endpoint doesn't exist
      console.warn('Enrollment breakdown endpoint not available, using fallback');
      return {
        status_breakdown: [
          { status: 'in_progress', count: 0 },
          { status: 'completed', count: 0 },
          { status: 'not_started', count: 0 }
        ],
        total: 0
      };
    }
  }

  // Get course analytics
  static async getCourseStats(): Promise<{
    total_courses: number;
    published_courses: number;
    draft_courses: number;
    courses_by_category: Record<string, number>;
    top_courses: Array<{ id: number; title: string; enrollments: number }>;
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/analytics/courses`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get inactivity analysis
  static async getInactivityAnalysis(): Promise<{
    analysis: {
      total_active_users: number;
      users_by_role: Record<string, number>;
      inactivity_rates: Record<string, { count: number; rate: number }>;
      deletion_candidates: Record<string, { count: number; users: any[] }>;
      recommendations: Array<{ type: string; title: string; message: string; action: string }>;
    };
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/users/inactivity-analysis`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation
  static async moderateContent(contentType: string, contentId: number, action: 'approve' | 'reject', reason?: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderate`, {
        content_type: contentType,
        content_id: contentId,
        action,
        reason,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // System logs
  static async getSystemLogs(params?: {
    page?: number;
    per_page?: number;
    level?: string;
    start_date?: string;
    end_date?: string;
  }): Promise<PaginatedResponse<any>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.level) searchParams.set('level', params.level);
      if (params?.start_date) searchParams.set('start_date', params.start_date);
      if (params?.end_date) searchParams.set('end_date', params.end_date);

      const url = searchParams.toString() 
        ? `${this.BASE_PATH}/logs?${searchParams.toString()}`
        : `${this.BASE_PATH}/logs`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Analytics - User metrics
  static async getUserAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.start_date) searchParams.set('start_date', params.start_date);
      if (params?.end_date) searchParams.set('end_date', params.end_date);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/analytics/users?${searchParams.toString()}`
        : `${this.BASE_PATH}/analytics/users`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Analytics - Course metrics
  static async getCourseAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.start_date) searchParams.set('start_date', params.start_date);
      if (params?.end_date) searchParams.set('end_date', params.end_date);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/analytics/courses?${searchParams.toString()}`
        : `${this.BASE_PATH}/analytics/courses`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Analytics - Enrollment metrics
  static async getEnrollmentAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.start_date) searchParams.set('start_date', params.start_date);
      if (params?.end_date) searchParams.set('end_date', params.end_date);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/analytics/enrollments?${searchParams.toString()}`
        : `${this.BASE_PATH}/analytics/enrollments`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Analytics - Revenue metrics
  static async getRevenueAnalytics(params?: {
    start_date?: string;
    end_date?: string;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.start_date) searchParams.set('start_date', params.start_date);
      if (params?.end_date) searchParams.set('end_date', params.end_date);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/analytics/revenue?${searchParams.toString()}`
        : `${this.BASE_PATH}/analytics/revenue`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Get all settings
  static async getSystemSettings(): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/settings`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Update settings
  static async updateSystemSettings(settings: any): Promise<any> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/settings`, settings);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Email settings
  static async updateEmailSettings(emailConfig: any): Promise<any> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/settings/email`, emailConfig);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Test email configuration
  static async testEmailConfiguration(): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/settings/email/test`, {});
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation - Get content queue
  static async getContentQueue(params?: {
    page?: number;
    per_page?: number;
    status?: string;
    type?: string;
  }): Promise<PaginatedResponse<any>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.status) searchParams.set('status', params.status);
      if (params?.type) searchParams.set('type', params.type);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/moderation/queue?${searchParams.toString()}`
        : `${this.BASE_PATH}/moderation/queue`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation - Approve content
  static async approveContent(contentId: number, contentType: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderation/approve`, {
        content_id: contentId,
        content_type: contentType,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation - Reject content
  static async rejectContent(contentId: number, contentType: string, reason?: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderation/reject`, {
        content_id: contentId,
        content_type: contentType,
        reason,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation - Get user reports
  static async getUserReports(params?: {
    page?: number;
    per_page?: number;
    status?: string;
  }): Promise<PaginatedResponse<any>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.status) searchParams.set('status', params.status);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/moderation/reports?${searchParams.toString()}`
        : `${this.BASE_PATH}/moderation/reports`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Content moderation - Handle user report
  static async handleUserReport(reportId: number, action: 'approve' | 'dismiss' | 'investigate', notes?: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/moderation/reports/${reportId}/handle`, {
        action,
        notes,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Inactive Users Management
  static async getInactiveUsers(params?: {
    threshold_days?: number;
    role?: string;
  }): Promise<{
    success: boolean;
    inactive_users: InactiveUser[];
    users_by_role: Record<string, InactiveUser[]>;
    threshold_days: number;
    total_count: number;
  }> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.threshold_days) searchParams.set('threshold_days', params.threshold_days.toString());
      if (params?.role) searchParams.set('role', params.role);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/users/inactive?${searchParams.toString()}`
        : `${this.BASE_PATH}/users/inactive`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async autoDeleteUser(userId: number): Promise<{
    success: boolean;
    message: string;
    user_info?: any;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/users/${userId}/auto-delete`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async bulkAutoDeleteUsers(userIds: number[]): Promise<{
    success: boolean;
    message: string;
    results: {
      successful: Array<{ user_id: number; user_info: any }>;
      failed: Array<{ user_id: number; error: string }>;
      total_requested: number;
    };
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/users/bulk-auto-delete`, {
        user_ids: userIds
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async runSystemCleanup(params?: {
    dry_run?: boolean;
    user_threshold_days?: number;
    student_threshold_days?: number;
  }): Promise<{
    success: boolean;
    cleanup_summary: any;
  }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/system/cleanup-inactive`, params || {});
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

// Types for inactive user management
export interface InactiveUser {
  user_id: number;
  username: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: string;
  last_activity: string | null;
  last_login: string | null;
  created_at: string;
  days_inactive: number;
  role_data: {
    enrollments_count?: number;
    lessons_completed?: number;
    courses_created?: number;
  };
}