import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, PaginatedResponse } from '@/types/api';

export class AdminService {
  private static readonly BASE_PATH = '/admin';

  // User management
  static async getAllUsers(params?: {
    page?: number;
    per_page?: number;
    role?: string;
    search?: string;
  }): Promise<PaginatedResponse<User>> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.role) searchParams.set('role', params.role);
      if (params?.search) searchParams.set('search', params.search);

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
    total_courses: number;
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
}