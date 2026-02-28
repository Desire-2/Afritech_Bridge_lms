import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { User, PaginatedResponse, UserListResponse, Course } from '@/types/api';

export interface CourseListParams {
  search?: string;
  status?: 'all' | 'published' | 'unpublished';
  enrollment_type?: string;
  instructor_id?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
}

export interface CourseFormData {
  title: string;
  description: string;
  learning_objectives?: string;
  target_audience?: string;
  estimated_duration?: string;
  instructor_id: number | string;
  is_published?: boolean;
  enrollment_type?: 'free' | 'paid' | 'scholarship';
  price?: number | null;
  currency?: string;
  payment_mode?: 'full' | 'partial';
  partial_payment_amount?: number | null;
  partial_payment_percentage?: number | null;
  require_payment_before_application?: boolean;
  paypal_enabled?: boolean;
  mobile_money_enabled?: boolean;
  bank_transfer_enabled?: boolean;
  kpay_enabled?: boolean;
  flutterwave_enabled?: boolean;
  bank_transfer_details?: string | null;
  installment_enabled?: boolean;
  installment_count?: number | null;
  installment_interval_days?: number | null;
  payment_deadline_days?: number | null;
  application_start_date?: string | null;
  application_end_date?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  cohort_label?: string | null;
  application_timezone?: string;
  start_date?: string | null;
  module_release_count?: number | null;
  module_release_interval?: string | null;
  module_release_interval_days?: number | null;
}

export interface InstructorOption {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  email: string;
}

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

  // ==========================================
  // Course Management CRUD
  // ==========================================

  /** List all courses (admin) */
  static async getCourses(): Promise<Course[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Get single course by ID (uses the general /courses/:id which admin can access) */
  static async getCourse(courseId: number): Promise<Course> {
    try {
      const response = await apiClient.get(`/courses/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Create a new course (admin) */
  static async createCourse(data: CourseFormData): Promise<{ message: string; course: Course }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/courses`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Update a course (uses the general /courses/:id which admin can access) */
  static async updateCourse(courseId: number, data: Partial<CourseFormData>): Promise<Course> {
    try {
      const response = await apiClient.put(`/courses/${courseId}`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Delete a course (admin) */
  static async deleteCourse(courseId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/courses/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Publish a course */
  static async publishCourse(courseId: number): Promise<{ message: string; course: Course }> {
    try {
      const response = await apiClient.post(`/courses/${courseId}/publish`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Unpublish a course */
  static async unpublishCourse(courseId: number): Promise<{ message: string; course: Course }> {
    try {
      const response = await apiClient.post(`/courses/${courseId}/unpublish`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /** Get list of instructors for course assignment */
  static async getInstructors(): Promise<InstructorOption[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/users?role=instructor&per_page=100`);
      const data = response.data;
      // The users endpoint might return paginated or raw data
      const users = data.users || data.items || data;
      return (Array.isArray(users) ? users : []).map((u: any) => ({
        id: u.id,
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        username: u.username || '',
        email: u.email || '',
      }));
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
  static async getSystemSettings(category?: string, includeAudit: boolean = false): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (category) searchParams.set('category', category);
      if (includeAudit) searchParams.set('include_audit', 'true');
      
      const url = searchParams.toString()
        ? `/admin/settings?${searchParams.toString()}`
        : '/admin/settings';
        
      console.log('📡 Getting settings from:', url);
      const response = await apiClient.get(url);
      console.log('📋 Settings received:', response.data);
      return response.data;
    } catch (error) {
      console.error('❌ Get settings error:', error);
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Get specific setting
  static async getSetting(key: string): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/settings/${key}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Update specific setting
  static async updateSetting(key: string, value: any, changeReason?: string): Promise<any> {
    try {
      const payload: any = { key, value };
      if (changeReason) payload.change_reason = changeReason;
      
      const response = await apiClient.put(`${this.BASE_PATH}/settings/${key}`, payload);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Update multiple settings
  static async updateSystemSettings(settings: Record<string, any>, changeReason?: string): Promise<any> {
    try {
      const payload: any = { settings };
      if (changeReason) payload.change_reason = changeReason;
      
      console.log('🌐 Sending settings to backend:', payload);
      const response = await apiClient.put('/admin/settings/bulk', payload);
      console.log('✅ Backend response:', response);
      return response.data;
    } catch (error) {
      console.error('❌ API Error:', error);
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Create new setting
  static async createSetting(settingData: {
    key: string;
    value: any;
    data_type?: string;
    category: string;
    description?: string;
    is_public?: boolean;
    is_editable?: boolean;
    requires_restart?: boolean;
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/settings`, settingData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Delete setting
  static async deleteSetting(key: string): Promise<any> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/settings/${key}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Export settings
  static async exportSettings(): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/settings/export`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Import settings
  static async importSettings(settingsData: any): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/settings/import`, settingsData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Reset to defaults
  static async resetSettings(confirm: boolean = false): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/settings/reset`, { confirm });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Initialize default settings
  static async initializeSettings(): Promise<any> {
    try {
      const response = await apiClient.post('/admin/settings/initialize');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Get audit logs
  static async getSettingAuditLogs(params?: {
    page?: number;
    per_page?: number;
    setting_key?: string;
  }): Promise<any> {
    try {
      const searchParams = new URLSearchParams();
      if (params?.page) searchParams.set('page', params.page.toString());
      if (params?.per_page) searchParams.set('per_page', params.per_page.toString());
      if (params?.setting_key) searchParams.set('setting_key', params.setting_key);

      const url = searchParams.toString()
        ? `${this.BASE_PATH}/settings/audit?${searchParams.toString()}`
        : `${this.BASE_PATH}/settings/audit`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Clear settings cache
  static async clearSettingsCache(): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/settings/cache/clear`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Settings - Email settings (deprecated - use updateSetting instead)
  static async updateEmailSettings(emailConfig: any): Promise<any> {
    try {
      console.warn('updateEmailSettings is deprecated. Use updateSystemSettings instead.');
      const emailSettings: Record<string, any> = {};
      
      if (emailConfig.smtpHost) emailSettings['smtp_host'] = emailConfig.smtpHost;
      if (emailConfig.smtpPort) emailSettings['smtp_port'] = emailConfig.smtpPort;
      if (emailConfig.fromEmail) emailSettings['from_email'] = emailConfig.fromEmail;
      if (emailConfig.fromName) emailSettings['from_name'] = emailConfig.fromName;
      if (emailConfig.enableTls !== undefined) emailSettings['enable_tls'] = emailConfig.enableTls;
      
      return this.updateSystemSettings(emailSettings, 'Email settings update');
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