/**
 * Payment & Scholarship API Service
 * Handles course enrollment, payments, and scholarship applications
 */

import BaseApiService, { ApiResponse } from './base.service';
import {
  EnrollmentRequest,
  ScholarshipApplication,
  PaymentDetails,
  Course,
} from './types';

class PaymentApiService extends BaseApiService {
  // ==================== ENROLLMENT ====================

  /**
   * Enroll in a course
   */
  async enrollInCourse(data: EnrollmentRequest): Promise<ApiResponse<{
    enrollment_id: number;
    status: 'enrolled' | 'pending_payment' | 'pending_scholarship';
    payment_required: boolean;
    payment_url?: string;
    checkout_session_id?: string;
  }>> {
    return this.post('/student/enroll', data);
  }

  /**
   * Get enrollment status
   */
  async getEnrollmentStatus(enrollmentId: number): Promise<{
    status: string;
    course: Course;
    payment_status?: string;
    scholarship_status?: string;
    enrolled_at?: string;
  }> {
    return this.get(`/student/enrollments/${enrollmentId}`);
  }

  /**
   * Cancel enrollment (if allowed)
   */
  async cancelEnrollment(enrollmentId: number, reason: string): Promise<ApiResponse> {
    return this.post(`/student/enrollments/${enrollmentId}/cancel`, {
      reason
    });
  }

  // ==================== PAYMENTS ====================

  /**
   * Create payment checkout session
   */
  async createCheckoutSession(courseId: number, paymentMethod: 'card' | 'mobile_money' | 'bank_transfer'): Promise<{
    checkout_url: string;
    session_id: string;
    amount: number;
    currency: string;
    expires_at: string;
  }> {
    return this.post('/payments/checkout', {
      course_id: courseId,
      payment_method: paymentMethod
    });
  }

  /**
   * Verify payment status
   */
  async verifyPayment(sessionId: string): Promise<{
    status: 'completed' | 'pending' | 'failed';
    transaction_id?: string;
    enrollment_id?: number;
    error?: string;
  }> {
    return this.get(`/payments/verify/${sessionId}`);
  }

  /**
   * Get payment history
   */
  async getPaymentHistory(): Promise<Array<{
    id: number;
    course_title: string;
    amount: number;
    currency: string;
    payment_method: string;
    status: string;
    transaction_id: string;
    paid_at: string;
    receipt_url?: string;
  }>> {
    return this.get('/student/payments/history');
  }

  /**
   * Download receipt
   */
  async downloadReceipt(paymentId: number): Promise<Blob> {
    const response = await this.api.get(`/payments/${paymentId}/receipt`, {
      responseType: 'blob'
    });
    return response.data;
  }

  // ==================== SCHOLARSHIPS ====================

  /**
   * Check scholarship eligibility
   */
  async checkScholarshipEligibility(courseId: number): Promise<{
    eligible: boolean;
    reason?: string;
    criteria: {
      academic_performance: {
        required: boolean;
        met: boolean;
        details: string;
      };
      financial_need: {
        required: boolean;
        met: boolean;
      };
      previous_courses: {
        required: number;
        completed: number;
        met: boolean;
      };
    };
    scholarship_types: Array<{
      id: number;
      name: string;
      coverage: 'full' | 'partial';
      percentage: number;
      requirements: string[];
    }>;
  }> {
    return this.get(`/scholarships/eligibility`, {
      params: { course_id: courseId }
    });
  }

  /**
   * Apply for scholarship
   */
  async applyForScholarship(data: {
    course_id: number;
    scholarship_type_id?: number;
    reason: string;
    financial_need_statement: string;
    supporting_documents?: File[];
  }): Promise<ApiResponse<{
    application_id: number;
    status: string;
    estimated_review_time: string;
  }>> {
    const formData = new FormData();
    formData.append('course_id', data.course_id.toString());
    if (data.scholarship_type_id) {
      formData.append('scholarship_type_id', data.scholarship_type_id.toString());
    }
    formData.append('reason', data.reason);
    formData.append('financial_need_statement', data.financial_need_statement);
    
    if (data.supporting_documents) {
      data.supporting_documents.forEach((file, index) => {
        formData.append(`documents[${index}]`, file);
      });
    }

    return this.post('/scholarships/apply', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Get scholarship applications
   */
  async getScholarshipApplications(): Promise<ScholarshipApplication[]> {
    return this.get<ScholarshipApplication[]>('/student/scholarships/applications');
  }

  /**
   * Get scholarship application details
   */
  async getScholarshipApplication(applicationId: number): Promise<ScholarshipApplication & {
    review_timeline: Array<{
      stage: string;
      status: string;
      date: string;
      notes?: string;
    }>;
  }> {
    return this.get(`/scholarships/applications/${applicationId}`);
  }

  /**
   * Update scholarship application
   */
  async updateScholarshipApplication(applicationId: number, data: {
    reason?: string;
    financial_need_statement?: string;
    additional_documents?: File[];
  }): Promise<ApiResponse> {
    const formData = new FormData();
    
    if (data.reason) {
      formData.append('reason', data.reason);
    }
    if (data.financial_need_statement) {
      formData.append('financial_need_statement', data.financial_need_statement);
    }
    if (data.additional_documents) {
      data.additional_documents.forEach((file, index) => {
        formData.append(`documents[${index}]`, file);
      });
    }

    return this.put(`/scholarships/applications/${applicationId}`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
  }

  /**
   * Withdraw scholarship application
   */
  async withdrawScholarshipApplication(applicationId: number, reason: string): Promise<ApiResponse> {
    return this.post(`/scholarships/applications/${applicationId}/withdraw`, {
      reason
    });
  }

  // ==================== COURSE PRICING ====================

  /**
   * Get course pricing options
   */
  async getCoursePricing(courseId: number): Promise<{
    base_price: number;
    currency: string;
    discount_available: boolean;
    discount_percentage?: number;
    discounted_price?: number;
    payment_plans: Array<{
      id: number;
      name: string;
      installments: number;
      installment_amount: number;
      total_cost: number;
    }>;
    scholarship_available: boolean;
  }> {
    return this.get(`/courses/${courseId}/pricing`);
  }

  /**
   * Compare course prices
   */
  async compareCoursePrices(courseIds: number[]): Promise<Array<{
    course_id: number;
    course_title: string;
    price: number;
    discount_available: boolean;
    scholarship_available: boolean;
    value_rating: number;
    enrollment_count: number;
    completion_rate: number;
  }>> {
    return this.post('/courses/compare-pricing', {
      course_ids: courseIds
    });
  }

  // ==================== PAYMENT PLANS ====================

  /**
   * Enroll with payment plan
   */
  async enrollWithPaymentPlan(courseId: number, planId: number): Promise<{
    enrollment_id: number;
    payment_schedule: Array<{
      installment_number: number;
      amount: number;
      due_date: string;
      status: 'pending' | 'paid' | 'overdue';
    }>;
  }> {
    return this.post('/payments/payment-plan/enroll', {
      course_id: courseId,
      plan_id: planId
    });
  }

  /**
   * Make payment plan installment
   */
  async payInstallment(enrollmentId: number, installmentNumber: number): Promise<{
    payment_url: string;
    amount: number;
    due_date: string;
  }> {
    return this.post(`/payments/payment-plan/${enrollmentId}/pay-installment`, {
      installment_number: installmentNumber
    });
  }

  /**
   * Get payment plan status
   */
  async getPaymentPlanStatus(enrollmentId: number): Promise<{
    total_amount: number;
    paid_amount: number;
    remaining_amount: number;
    installments: Array<{
      number: number;
      amount: number;
      due_date: string;
      paid_date?: string;
      status: string;
    }>;
    is_current: boolean;
    overdue_count: number;
  }> {
    return this.get(`/payments/payment-plan/${enrollmentId}/status`);
  }

  // ==================== FINANCIAL ASSISTANCE ====================

  /**
   * Calculate scholarship eligibility score
   */
  async calculateEligibilityScore(courseId: number): Promise<{
    score: number;
    max_score: number;
    breakdown: {
      academic: number;
      financial_need: number;
      prior_performance: number;
      essay_quality: number;
    };
    likelihood: 'high' | 'medium' | 'low';
    recommendations: string[];
  }> {
    return this.get(`/scholarships/calculate-score`, {
      params: { course_id: courseId }
    });
  }

  /**
   * Get available financial assistance programs
   */
  async getFinancialAssistancePrograms(): Promise<Array<{
    id: number;
    name: string;
    type: 'scholarship' | 'grant' | 'loan' | 'work_study';
    description: string;
    coverage_percentage: number;
    eligibility_criteria: string[];
    application_deadline: string;
    available_slots: number;
  }>> {
    return this.get('/financial-assistance/programs');
  }
}

export default new PaymentApiService();
