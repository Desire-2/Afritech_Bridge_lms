// Certificate generation service — thin normalization layer over the
// canonical certificate API. All eligibility decisions are made by the
// backend (CertificateService); this module only unwraps envelopes and
// shapes data for UI components.

import {
  StudentApiService,
  Certificate,
  CertificateEligibilityRequirements,
  CertificateEligibilityResult,
} from '@/services/studentApi';

export interface CertificateCheckResponse {
  success: boolean;
  eligible: boolean;
  error_code?: string | null;
  message: string;
  summary?: string;
  requirements?: CertificateEligibilityRequirements;
  next_steps?: string[];
  certificate?: Certificate;
  /** True when a new certificate row was created; false when reusing an existing one. */
  created?: boolean;
}

export class CertificateGenerationService {
  /**
   * Check certificate eligibility (canonical flat result).
   */
  static async checkEligibility(courseId: number): Promise<CertificateCheckResponse> {
    try {
      const result: CertificateEligibilityResult =
        await StudentApiService.checkCertificateEligibility(courseId);

      return {
        success: true,
        eligible: result.eligible,
        error_code: result.error_code,
        message: result.summary || result.reason || 'Eligibility check completed',
        summary: result.summary,
        requirements: result.requirements,
        next_steps: result.next_steps,
      };
    } catch (error: any) {
      const errorMessage =
        error?.response?.data?.error || error?.message || 'Failed to check eligibility';
      return {
        success: false,
        eligible: false,
        error_code: error?.response?.data?.error_code || 'SERVER_ERROR',
        message: errorMessage,
      };
    }
  }

  /**
   * Generate a certificate via the canonical generation endpoint.
   * Returns the existing certificate (created=false) when one is already issued.
   */
  static async generateCertificate(courseId: number): Promise<CertificateCheckResponse> {
    try {
      const response = await StudentApiService.generateCertificate(courseId);

      if (response.success) {
        return {
          success: true,
          eligible: true,
          message: response.message || 'Certificate generated successfully!',
          created: response.created,
          certificate: response.certificate,
          requirements: response.requirements,
        } as CertificateCheckResponse & { created?: boolean };
      }

      // Ordinary eligibility failure — the backend supplies a structured
      // error_code (INCOMPLETE_MODULES / INSUFFICIENT_SCORE / ...) plus a
      // canonical requirements payload. Never surface these as
      // GENERATION_ERROR.
      return {
        success: false,
        eligible: false,
        error_code: response.error_code || 'REQUIREMENTS_NOT_MET',
        message: response.message || 'Requirements not met',
        summary: response.summary,
        requirements: response.requirements,
        next_steps: response.next_steps || [],
      };
    } catch (error: any) {
      const responseData = error?.response?.data || {};
      const errorMessage =
        responseData.message || responseData.error || error?.message || 'Failed to generate certificate';

      // Axios throws on 400; the body still carries the canonical payload.
      return {
        success: false,
        eligible: false,
        error_code: responseData.error_code || 'SERVER_ERROR',
        message: errorMessage,
        summary: responseData.summary,
        requirements: responseData.requirements,
        next_steps: responseData.next_steps || [],
      };
    }
  }

  /** Safe display title for a certificate (orphaned course records). */
  static displayCourseTitle(certificate: Partial<Certificate> | null | undefined): string {
    const title = certificate?.course_title;
    return typeof title === 'string' && title.trim() ? title : 'Course';
  }

  /** Public verification URL for a certificate number (single convention). */
  static verificationUrl(certificateNumber: string): string {
    const base = (
      process.env.NEXT_PUBLIC_VERIFY_BASE_URL ||
      'https://study.afritechbridge.online'
    ).replace(/\/$/, '');
    return `${base}/verify/${certificateNumber}`;
  }
}
