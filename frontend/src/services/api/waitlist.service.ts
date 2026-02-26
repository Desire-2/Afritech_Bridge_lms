/**
 * Waitlist Management API Service
 * Handles waitlist migration, payment verification, and access status checking
 */

import BaseApiService from './base.service';

export interface WaitlistMigrationSummary {
  course_id: number;
  course_title: string;
  total_waitlisted: number;
  next_available_cohort: {
    window_id: number;
    cohort_label: string;
    requires_payment: boolean;
  } | null;
  cohorts: Array<{
    window_id: number;
    cohort_label: string;
    status: string;
    waitlisted_count: number;
    migrated_in_count: number;
    enrollment_count: number;
    max_students: number | null;
    available_spots: number | null;
    requires_payment: boolean;
    effective_enrollment_type: string;
    effective_price: number;
    effective_currency: string;
  }>;
}

export interface NextCohortInfo {
  window_id: number;
  cohort_label: string;
  status: string;
  opens_at: string | null;
  cohort_start: string | null;
  max_students: number | null;
  enrollment_count: number;
  requires_payment: boolean;
  effective_enrollment_type: string;
  effective_price: number;
  effective_currency: string;
}

export interface UnpaidEnrollment {
  enrollment_id: number;
  student_id: number;
  student_name: string;
  student_email: string;
  course_id: number;
  course_title: string;
  cohort_label: string;
  application_window_id: number;
  enrollment_date: string;
  status: string;
  payment_status: string;
  payment_verified: boolean;
  migrated_from_window_id: number | null;
  // Cohort-level payment details
  cohort_enrollment_type?: string;        // 'paid' | 'scholarship'
  cohort_scholarship_type?: string | null; // 'full' | 'partial'
  cohort_scholarship_percentage?: number | null;
  cohort_effective_price?: number | null;
  cohort_currency?: string;
}

export interface PaymentStatusInfo {
  enrollment_id: number;
  course_id: number;
  course_title: string;
  cohort_label: string;
  enrollment_status: string;
  access_allowed: boolean;
  access_reason: string;
  payment_status: string;
  payment_verified: boolean;
  requires_payment: boolean;
}

class WaitlistApiService extends BaseApiService {
  private readonly BASE_PATH = '/admin/waitlist';

  // =============================================
  // MIGRATION SUMMARY
  // =============================================

  /**
   * Get waitlist migration summary for a course
   */
  async getMigrationSummary(courseId: number): Promise<{
    success: boolean;
    data: WaitlistMigrationSummary;
  }> {
    return this.get(`${this.BASE_PATH}/summary/${courseId}`);
  }

  // =============================================
  // MIGRATION ACTIONS
  // =============================================

  /**
   * Migrate a single waitlisted application to a target cohort
   */
  async migrateApplication(applicationId: number, params: {
    target_window_id: number;
    notes?: string;
    send_email?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      application_id: number;
      original_window_id: number;
      target_window_id: number;
      new_status: string;
      cohort_label: string;
      requires_payment: boolean;
      email_sent: boolean;
    };
  }> {
    return this.post(`${this.BASE_PATH}/migrate/${applicationId}`, params);
  }

  /**
   * Bulk migrate all waitlisted applications to next cohort
   */
  async bulkMigrateWaitlist(params: {
    course_id: number;
    source_window_id?: number;
    target_window_id?: number;
    max_count?: number;
    notes?: string;
    send_emails?: boolean;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      migrated_count: number;
      failed_count: number;
      total_waitlisted: number;
      target_window_id: number;
      target_cohort_label: string;
      requires_payment: boolean;
      migrated: Array<{
        application_id: number;
        original_window_id: number;
        target_window_id: number;
        requires_payment: boolean;
      }>;
      failed: Array<{
        application_id: number;
        error: string;
      }>;
    };
  }> {
    return this.post(`${this.BASE_PATH}/migrate-bulk`, params);
  }

  /**
   * Get next available cohort for a course
   */
  async getNextCohort(courseId: number, currentWindowId?: number): Promise<{
    success: boolean;
    data: NextCohortInfo | null;
    message?: string;
  }> {
    const params: Record<string, string> = {};
    if (currentWindowId) params.current_window_id = String(currentWindowId);
    return this.get(`${this.BASE_PATH}/next-cohort/${courseId}`, { params });
  }

  // =============================================
  // PAYMENT VERIFICATION
  // =============================================

  /**
   * Get payment status for an enrollment
   */
  async getEnrollmentPaymentStatus(enrollmentId: number): Promise<{
    success: boolean;
    data: {
      enrollment_id: number;
      requires_payment: boolean;
      payment_status: string;
      payment_verified: boolean;
      access_allowed: boolean;
      migrated_from_window_id?: number;
    };
  }> {
    return this.get(`${this.BASE_PATH}/enrollment/${enrollmentId}/payment`);
  }

  /**
   * Verify/update payment status for an enrollment (Admin only)
   */
  async verifyEnrollmentPayment(enrollmentId: number, params: {
    payment_status: 'completed' | 'waived' | 'pending' | 'failed';
    notes?: string;
  }): Promise<{
    success: boolean;
    message: string;
    data: {
      enrollment_id: number;
      payment_status: string;
      payment_verified: boolean;
      enrollment_status: string;
    };
  }> {
    return this.post(`${this.BASE_PATH}/enrollment/${enrollmentId}/verify-payment`, params);
  }

  /**
   * List all unpaid enrollments that require payment
   */
  async listUnpaidEnrollments(params?: {
    course_id?: number;
    window_id?: number;
  }): Promise<{
    success: boolean;
    data: UnpaidEnrollment[];
    count: number;
  }> {
    return this.get(`${this.BASE_PATH}/enrollments/unpaid`, { params });
  }

  // =============================================
  // STUDENT SELF-CHECK
  // =============================================

  /**
   * Get current student's payment/access status for all enrollments
   */
  async getMyPaymentStatus(): Promise<{
    success: boolean;
    data: PaymentStatusInfo[];
  }> {
    return this.get(`${this.BASE_PATH}/my-payment-status`);
  }
}

const waitlistService = new WaitlistApiService();
export default waitlistService;
