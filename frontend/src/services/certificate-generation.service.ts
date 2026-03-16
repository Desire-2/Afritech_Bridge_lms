// Enhanced certificate-generation service with detailed error handling

import { StudentApiService } from '@/services/studentApi';

export interface CertificateRequirementStatus {
  passing_score: number;
  overall_score: number;
  completed_modules: number;
  total_modules: number;
  failed_modules: number;
  module_details: Array<{
    module_id?: number;
    module_name: string;
    status: string;
    score: number;
    passing: boolean;
  }>;
}

export interface CertificateFailureReason {
  incomplete_modules?: {
    remaining: number;
    message?: string;
    modules_list: Array<{ module_name: string; status: string; score: number }>;
  };
  failed_modules?: {
    count: number;
    message?: string;
    failed_modules_list: Array<{ name: string; score: number; gap: number }>;
  };
  insufficient_score?: {
    current_score: number;
    required_score: number;
    gap: number;
    message?: string;
  };
}

export interface CertificateCheckResponse {
  success: boolean;
  eligible: boolean;
  error_code?: string;
  message: string;
  summary?: string;
  requirements?: CertificateRequirementStatus;
  failure_reasons?: CertificateFailureReason;
  next_steps?: string[];
  certificate?: any;
}

export class CertificateGenerationService {
  /**
   * Check certificate eligibility with detailed requirement breakdown
   */
  static async checkEligibility(courseId: number): Promise<CertificateCheckResponse> {
    try {
      const response = await StudentApiService.checkCertificateEligibility(courseId);

      // Ensure we have the expected structure
      if (typeof response === 'object' && response !== null) {
        return {
          success: true,
          eligible: response.data?.eligible || false,
          message: response.data?.reason || response.message || 'Eligibility check completed',
          summary: this._buildSummary(response.data),
          requirements: response.data?.requirements || {},
          failure_reasons: response.data?.details || {},
          next_steps: response.data?.details?.module_breakdown 
            ? this._extractNextSteps(response.data.details)
            : []
        };
      }

      return {
        success: false,
        eligible: false,
        message: 'Unable to check eligibility',
        error_code: 'UNKNOWN_ERROR'
      };
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to check eligibility';
      return {
        success: false,
        eligible: false,
        message: errorMessage,
        error_code: 'CHECK_ERROR'
      };
    }
  }

  /**
   * Attempt to generate certificate with detailed error handling
   */
  static async generateCertificate(courseId: number): Promise<CertificateCheckResponse> {
    try {
      const response = await StudentApiService.generateCertificate(courseId);

      // Success case
      if (response.success) {
        return {
          success: true,
          eligible: true,
          message: response.message || 'Certificate generated successfully!',
          certificate: response.certificate || response.data,
          requirements: response.requirements
        };
      }

      // Failure case with detailed error information
      if (response.error_code || response.failure_reasons) {
        return {
          success: false,
          eligible: false,
          error_code: response.error_code || 'REQUIREMENTS_NOT_MET',
          message: response.message || 'Requirements not met',
          summary: response.summary,
          requirements: response.requirements,
          failure_reasons: this._parseFailureReasons(response),
          next_steps: response.next_steps || this._extractNextSteps(response)
        };
      }

      // Generic failure
      return {
        success: false,
        eligible: false,
        message: response.message || 'Unable to generate certificate',
        error_code: 'GENERATION_ERROR'
      };
    } catch (error: any) {
      const responseData = error?.response?.data || {};
      const errorMessage = responseData.message || error?.message || 'Failed to generate certificate';

      return {
        success: false,
        eligible: false,
        message: errorMessage,
        error_code: responseData.error_code || 'GENERATION_ERROR',
        requirements: responseData.requirements,
        failure_reasons: this._parseFailureReasons(responseData),
        next_steps: responseData.next_steps || []
      };
    }
  }

  /**
   * Parse failure reasons from response
   */
  private static _parseFailureReasons(response: any): CertificateFailureReason {
    if (response.failure_reasons) {
      return response.failure_reasons;
    }

    if (response.details?.incomplete_modules || response.details?.failed_modules) {
      return response.details;
    }

    // Fallback: construct from requirements data
    const requirements = response.requirements || {};
    const failures: CertificateFailureReason = {};

    if (requirements.completed_modules < requirements.total_modules) {
      failures.incomplete_modules = {
        remaining: requirements.total_modules - requirements.completed_modules,
        modules_list: (requirements.module_details || [])
          .filter((m: any) => m.status !== 'completed')
          .map((m: any) => ({
            module_name: m.module_name || m.module || '',
            status: m.status || 'unknown',
            score: m.score || 0
          }))
      };
    }

    if (requirements.failed_modules > 0) {
      failures.failed_modules = {
        count: requirements.failed_modules,
        failed_modules_list: (requirements.module_details || [])
          .filter((m: any) => !m.passing && m.score > 0)
          .map((m: any) => ({
            name: m.module_name || m.module || '',
            score: m.score || 0,
            gap: Math.max(0, 80 - (m.score || 0))
          }))
      };
    }

    if (requirements.overall_score < (requirements.passing_score || 80)) {
      failures.insufficient_score = {
        current_score: requirements.overall_score || 0,
        required_score: requirements.passing_score || 80,
        gap: Math.max(0, (requirements.passing_score || 80) - (requirements.overall_score || 0))
      };
    }

    return failures;
  }

  /**
   * Build summary message from response
   */
  private static _buildSummary(data: any): string {
    if (data?.summary) {
      return data.summary;
    }

    if (data?.eligible) {
      return `All requirements met! Your overall score is ${(data.overall_score || 0).toFixed(1)}%`;
    }

    const issues = [];

    if (data?.completed_modules && data?.total_modules && data.completed_modules < data.total_modules) {
      const remaining = data.total_modules - data.completed_modules;
      issues.push(`Complete ${remaining} more module(s)`);
    }

    if (data?.failed_modules && data.failed_modules > 0) {
      issues.push(`Fix ${data.failed_modules} failing module(s)`);
    }

    if (data?.overall_score && data.overall_score < 80) {
      const gap = 80 - data.overall_score;
      issues.push(`Improve overall score by ${gap.toFixed(1)}%`);
    }

    return issues.length > 0
      ? issues.join(' • ')
      : 'Requirements not fully met';
  }

  /**
   * Extract next steps from response data
   */
  private static _extractNextSteps(data: any): string[] {
    if (data?.next_steps && Array.isArray(data.next_steps)) {
      return data.next_steps;
    }

    const steps: string[] = [];
    const requirements = data?.requirements || data;

    // Build next steps from modules
    const modules = data?.module_breakdown || requirements?.module_details || [];

    // Add incomplete modules
    const incomplete = modules.filter((m: any) => m.status === 'not_started');
    if (incomplete.length > 0) {
      const names = incomplete.slice(0, 2).map((m: any) => m.module_name || m.module);
      steps.push(`Start module${incomplete.length > 1 ? 's' : ''}: ${names.join(', ')}`);
    }

    // Add failing modules
    const failing = modules.filter((m: any) => !m.passing && m.score > 0);
    if (failing.length > 0) {
      const names = failing.slice(0, 2).map((m: any) => m.module_name || m.module);
      steps.push(`Improve ${names.join(', ')}: ${failing[0]?.gap?.toFixed(1) || ''} % gap`);
    }

    // Add overall score improvement if needed
    if (requirements.overall_score && requirements.overall_score < 80) {
      const gap = 80 - requirements.overall_score;
      steps.push(`Overall score needs ${gap.toFixed(1)}% improvement`);
    }

    return steps.length > 0
      ? steps
      : ['Review course materials and complete all assessments'];
  }

  /**
   * Format requirements for display
   */
  static formatRequirements(requirements: CertificateRequirementStatus): CertificateRequirementStatus {
    return {
      ...requirements,
      overall_score: Math.round(requirements.overall_score * 10) / 10,
      module_details: requirements.module_details.map(m => ({
        ...m,
        score: Math.round(m.score * 10) / 10
      }))
    };
  }

  /**
   * Get human-readable failure message
   */
  static getFailureMessage(failures: CertificateFailureReason): string {
    const messages: string[] = [];

    if (failures.incomplete_modules) {
      messages.push(
        `Complete ${failures.incomplete_modules.remaining} more module(s): ` +
        failures.incomplete_modules.modules_list.map(m => m.module_name).join(', ')
      );
    }

    if (failures.failed_modules) {
      messages.push(
        `Fix ${failures.failed_modules.count} failing module(s): ` +
        failures.failed_modules.failed_modules_list
          .map(m => `${m.name} (need ${m.gap.toFixed(1)}% more)`)
          .join(', ')
      );
    }

    if (failures.insufficient_score) {
      messages.push(
        `Improve overall score from ${failures.insufficient_score.current_score.toFixed(1)}% ` +
        `to ${failures.insufficient_score.required_score}% (${failures.insufficient_score.gap.toFixed(1)}% gap)`
      );
    }

    return messages.join(' | ');
  }

  /**
   * Check if student can retry (has made progress)
   */
  static canRetry(requirements: CertificateRequirementStatus): boolean {
    return requirements && (
      requirements.completed_modules > 0 ||
      requirements.overall_score > 0
    );
  }

  /**
   * Estimate progress towards completion
   */
  static estimateProgress(requirements: CertificateRequirementStatus): {
    percentage: number;
    status: string;
    estimatedDaysRemaining?: number;
  } {
    const moduleProgress = requirements.completed_modules / Math.max(requirements.total_modules, 1);
    const scoreProgress = requirements.overall_score / 80; // 80% is required
    const averageProgress = (moduleProgress + scoreProgress) / 2;

    return {
      percentage: Math.round(averageProgress * 100),
      status: averageProgress >= 0.75
        ? 'Almost there!'
        : averageProgress >= 0.5
        ? 'Good progress'
        : averageProgress > 0
        ? 'Getting started'
        : 'Not started'
    };
  }
}
