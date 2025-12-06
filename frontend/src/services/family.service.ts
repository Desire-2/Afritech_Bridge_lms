/**
 * Family Management Service
 * Handles all family account operations, child management, and parent access control
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import {
  FamilyAccount,
  CreateFamilyAccountRequest,
  ChildProfile,
  UpdateChildProfileRequest,
  FamilyMember,
  AddFamilyMemberRequest,
  FamilyActivityLog,
  ChildProgressSummary,
  FamilyProgressReport,
  PermissionRule,
  AccessRequest,
  FamilyEnrollment,
  EnrollmentRequest,
  FamilyDashboardData,
  ChildDetailView,
  FamilyNotification,
  FamilyDevice,
  FamilySession,
  FamilyAnalytics,
  PaginatedFamilyResponse,
} from '@/types/family';

export class FamilyService {
  private static readonly BASE_PATH = '/family';

  // ========================================
  // Family Account Management
  // ========================================

  /**
   * Create a new family account
   */
  static async createFamilyAccount(
    request: CreateFamilyAccountRequest
  ): Promise<FamilyAccount> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/accounts`, request);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get family account details
   */
  static async getFamilyAccount(familyId: number): Promise<FamilyAccount> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/accounts/${familyId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update family account
   */
  static async updateFamilyAccount(
    familyId: number,
    updates: Partial<CreateFamilyAccountRequest>
  ): Promise<FamilyAccount> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/accounts/${familyId}`,
        updates
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get all family accounts for current user
   */
  static async getMyFamilyAccounts(): Promise<FamilyAccount[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/accounts/my-families`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Join existing family with family code
   */
  static async joinFamily(familyCode: string): Promise<FamilyAccount> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/accounts/join`, {
        family_code: familyCode,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Child Profile Management
  // ========================================

  /**
   * Add a new child to family
   */
  static async addChildToFamily(
    familyId: number,
    childData: ChildProfile
  ): Promise<ChildProfile> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/children`,
        childData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get all children in family
   */
  static async getFamilyChildren(familyId: number): Promise<ChildProfile[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/children`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get child profile details
   */
  static async getChildProfile(familyId: number, childId: number): Promise<ChildProfile> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/children/${childId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update child profile
   */
  static async updateChildProfile(
    familyId: number,
    childId: number,
    updates: UpdateChildProfileRequest
  ): Promise<ChildProfile> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/${familyId}/children/${childId}`,
        updates
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Deactivate child profile
   */
  static async deactivateChild(familyId: number, childId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/children/${childId}/deactivate`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Family Member Management
  // ========================================

  /**
   * Add a new family member (parent/guardian/teacher)
   */
  static async addFamilyMember(
    familyId: number,
    request: AddFamilyMemberRequest
  ): Promise<FamilyMember> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/members`,
        request
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get all family members
   */
  static async getFamilyMembers(familyId: number): Promise<FamilyMember[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${familyId}/members`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update family member permissions
   */
  static async updateMemberPermissions(
    familyId: number,
    memberId: number,
    permissions: Partial<FamilyMember>
  ): Promise<FamilyMember> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/${familyId}/members/${memberId}`,
        permissions
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Remove family member
   */
  static async removeFamilyMember(
    familyId: number,
    memberId: number
  ): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(
        `${this.BASE_PATH}/${familyId}/members/${memberId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Activity and Progress Tracking
  // ========================================

  /**
   * Get activity logs for family
   */
  static async getFamilyActivityLogs(
    familyId: number,
    options?: {
      childId?: number;
      activityType?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<PaginatedFamilyResponse<FamilyActivityLog>> {
    try {
      const params = new URLSearchParams();
      if (options?.childId) params.set('child_id', options.childId.toString());
      if (options?.activityType) params.set('activity_type', options.activityType);
      if (options?.limit) params.set('limit', options.limit.toString());
      if (options?.offset) params.set('offset', options.offset.toString());

      const queryString = params.toString()
        ? `?${params.toString()}`
        : '';

      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/activities${queryString}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get progress summary for a child
   */
  static async getChildProgressSummary(
    familyId: number,
    childId: number
  ): Promise<ChildProgressSummary> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/children/${childId}/progress`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get comprehensive family progress report
   */
  static async getFamilyProgressReport(
    familyId: number,
    period?: string
  ): Promise<FamilyProgressReport> {
    try {
      const params = period ? `?period=${period}` : '';
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/progress-report${params}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Enrollment Management
  // ========================================

  /**
   * Enroll child in course
   */
  static async enrollChildInCourse(
    familyId: number,
    enrollment: EnrollmentRequest
  ): Promise<FamilyEnrollment> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/enrollments`,
        enrollment
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get child enrollments
   */
  static async getChildEnrollments(
    familyId: number,
    childId: number
  ): Promise<FamilyEnrollment[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/children/${childId}/enrollments`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Approve pending enrollment
   */
  static async approveEnrollment(
    familyId: number,
    enrollmentId: number,
    reason?: string
  ): Promise<FamilyEnrollment> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/enrollments/${enrollmentId}/approve`,
        { reason }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Reject enrollment
   */
  static async rejectEnrollment(
    familyId: number,
    enrollmentId: number,
    reason: string
  ): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/enrollments/${enrollmentId}/reject`,
        { reason }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Access Control and Permissions
  // ========================================

  /**
   * Set permission rules for family members
   */
  static async setPermissionRule(
    familyId: number,
    rule: PermissionRule
  ): Promise<PermissionRule> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/permissions`,
        rule
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get permission rules
   */
  static async getPermissionRules(familyId: number): Promise<PermissionRule[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/permissions`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Check if member can perform action
   */
  static async checkPermission(
    familyId: number,
    memberId: number,
    action: string,
    resource: string,
    childId?: number
  ): Promise<{ allowed: boolean; reason?: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/permissions/check`,
        {
          member_id: memberId,
          action,
          resource,
          child_id: childId,
        }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Request access for specific permissions
   */
  static async requestAccess(
    familyId: number,
    request: Partial<AccessRequest>
  ): Promise<AccessRequest> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/access-requests`,
        request
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get pending access requests
   */
  static async getPendingAccessRequests(familyId: number): Promise<AccessRequest[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/access-requests/pending`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Approve access request
   */
  static async approveAccessRequest(
    familyId: number,
    requestId: number,
    reason?: string
  ): Promise<AccessRequest> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/access-requests/${requestId}/approve`,
        { reason }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Reject access request
   */
  static async rejectAccessRequest(
    familyId: number,
    requestId: number,
    reason: string
  ): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/access-requests/${requestId}/reject`,
        { reason }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Device and Session Management
  // ========================================

  /**
   * Register a device for family
   */
  static async registerDevice(
    familyId: number,
    device: FamilyDevice
  ): Promise<FamilyDevice> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/devices`,
        device
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get family devices
   */
  static async getFamilyDevices(familyId: number): Promise<FamilyDevice[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/devices`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Switch child context on device (for shared device scenarios)
   */
  static async switchChildContext(
    familyId: number,
    childId: number,
    deviceId: number
  ): Promise<{ message: string; session_token: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/devices/${deviceId}/switch-child`,
        { child_id: childId }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Notifications
  // ========================================

  /**
   * Get family notifications
   */
  static async getNotifications(familyId: number): Promise<FamilyNotification[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/notifications`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Mark notification as read
   */
  static async markNotificationAsRead(
    familyId: number,
    notificationId: number
  ): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/${familyId}/notifications/${notificationId}/read`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ========================================
  // Dashboard and Analytics
  // ========================================

  /**
   * Get complete family dashboard data
   */
  static async getFamilyDashboard(familyId: number): Promise<FamilyDashboardData> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/dashboard`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get child detail view (comprehensive child information)
   */
  static async getChildDetailView(
    familyId: number,
    childId: number
  ): Promise<ChildDetailView> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/children/${childId}/detail`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get family analytics
   */
  static async getFamilyAnalytics(familyId: number): Promise<FamilyAnalytics> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/analytics`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Export family progress report as PDF
   */
  static async exportProgressReportPDF(familyId: number): Promise<Blob> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/${familyId}/export/progress-report`,
        { responseType: 'blob' }
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}
