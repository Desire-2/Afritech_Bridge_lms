/**
 * Excel AI Grading Service
 * Frontend API client for the AI-powered Excel grading agent.
 *
 * Instructor endpoints ─ grade, batch-grade, review, preview, stats
 * Student endpoints    ─ view own AI grading results
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

// ─── Types ───────────────────────────────────────────────────

export interface RubricItem {
  score: number;
  max: number;
  comment: string;
}

export interface FlaggedIssue {
  type: string;
  description: string;
}

/** Full AI grading result (instructor view) */
export interface ExcelGradingResult {
  id: number;
  submission_type: 'assignment' | 'project';
  assignment_submission_id?: number;
  project_submission_id?: number;
  student_id: number;
  student_name?: string;
  course_id: number;
  file_id?: string;
  file_name?: string;
  file_size?: number;
  total_score: number;
  max_score: number;
  grade_letter: string;
  rubric_breakdown: Record<string, RubricItem>;
  analysis_data?: Record<string, any>;
  overall_feedback: string;
  confidence: 'high' | 'medium' | 'low';
  manual_review_required: boolean;
  flagged_issues?: FlaggedIssue[];
  graded_at?: string;
  ai_provider?: string;
  processing_time_seconds?: number;
  instructor_reviewed: boolean;
  instructor_id?: number;
  instructor_reviewed_at?: string;
  instructor_override_score?: number;
  instructor_notes?: string;
  status: string;
}

/** Student-safe subset */
export interface StudentGradingResult {
  id: number;
  submission_type: 'assignment' | 'project';
  assignment_submission_id?: number;
  project_submission_id?: number;
  course_id: number;
  file_name?: string;
  total_score: number;
  max_score: number;
  grade_letter: string;
  rubric_breakdown: Record<string, RubricItem>;
  overall_feedback: string;
  confidence: string;
  graded_at?: string;
  instructor_reviewed: boolean;
  status: string;
}

export interface GradeSubmissionRequest {
  submission_type?: 'assignment' | 'project';
  force?: boolean;
}

export interface ReviewRequest {
  action: 'approve' | 'override';
  adjusted_score?: number;
  adjusted_grade?: string;
  instructor_notes?: string;
  apply_to_submission?: boolean;
}

export interface GradingStats {
  total_graded: number;
  average_score: number;
  average_percentage: number;
  grade_distribution: Record<string, number>;
  confidence_breakdown: Record<string, number>;
  review_status: { reviewed: number; pending_review: number };
  highest_score: number;
  lowest_score: number;
}

export interface LearningStats {
  course_id: number;
  total_reviews: number;
  approval_rate: number;
  average_override_delta: number;
  generated_rubrics: number;
  approved_rubrics: number;
  confidence_trend: string;
  recent_overrides: Array<{
    assignment_id: number;
    ai_score: number;
    instructor_score: number;
    delta: number;
    date: string;
  }>;
}

export interface GradeableSubmission {
  submission_id: number;
  assignment_id: number;
  assignment_title?: string;
  student_id: number;
  student_name?: string;
  submitted_at?: string;
  manual_grade?: number;
  ai_graded: boolean;
  ai_score?: number;
  ai_grade?: string;
}

export interface PaginatedResults<T> {
  results: T[];
  total: number;
  page: number;
  pages: number;
  per_page?: number;
}

export interface PaginatedSubmissions {
  submissions: GradeableSubmission[];
  total: number;
  page: number;
  pages: number;
  per_page: number;
}

export interface PreviewResult {
  preview: true;
  file_name: string;
  file_size: number;
  workbook: Record<string, any>;
  formulas: Record<string, any>;
  charts: Record<string, any>;
  formatting: Record<string, any>;
}

// ─── Service ─────────────────────────────────────────────────

const BASE = '/excel-grading';

export class ExcelGradingService {
  // ╔═════════════════════════════════════╗
  // ║   INSTRUCTOR ENDPOINTS             ║
  // ╚═════════════════════════════════════╝

  /**
   * Grade a single submission via AI.
   */
  static async gradeSubmission(
    submissionId: number,
    options: GradeSubmissionRequest = {},
  ): Promise<ExcelGradingResult & { status: string; error?: string; message?: string; reason?: string }> {
    try {
      const response = await apiClient.post(`${BASE}/grade/${submissionId}`, options);
      return response.data;
    } catch (error: any) {
      // Extract backend response data for 4xx errors so caller can read reason/message
      if (error?.response?.data && error.response.status >= 400 && error.response.status < 500) {
        return error.response.data;
      }
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Batch-grade all ungraded submissions for an assignment.
   */
  static async gradeBatch(
    assignmentId: number,
    options: GradeSubmissionRequest = {},
  ): Promise<{
    total: number;
    graded: number;
    skipped: number;
    failed: number;
    results: Array<{ submission_id: number; status: string; score?: number }>;
  }> {
    try {
      const response = await apiClient.post(`${BASE}/grade-batch/${assignmentId}`, options);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get a grading result by its own ID.
   */
  static async getResult(
    resultId: number,
    format: 'full' | 'strict' = 'full',
  ): Promise<ExcelGradingResult> {
    try {
      const response = await apiClient.get(`${BASE}/results/${resultId}`, {
        params: { format },
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get the latest grading result for a submission.
   */
  static async getResultBySubmission(
    submissionId: number,
    submissionType: 'assignment' | 'project' = 'assignment',
  ): Promise<ExcelGradingResult> {
    try {
      const response = await apiClient.get(`${BASE}/results/submission/${submissionId}`, {
        params: { submission_type: submissionType },
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Instructor review / override of AI grade.
   */
  static async reviewResult(
    resultId: number,
    review: ReviewRequest,
  ): Promise<{ message: string; result: ExcelGradingResult }> {
    try {
      const response = await apiClient.post(`${BASE}/review/${resultId}`, review);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * List gradeable Excel submissions for a course.
   */
  static async listSubmissions(params: {
    course_id: number;
    assignment_id?: number;
    status?: 'pending' | 'graded' | 'all';
    page?: number;
    per_page?: number;
  }): Promise<PaginatedSubmissions> {
    try {
      const response = await apiClient.get(`${BASE}/submissions`, { params });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * AI grading history.
   */
  static async getHistory(params: {
    course_id?: number;
    student_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResults<ExcelGradingResult>> {
    try {
      const response = await apiClient.get(`${BASE}/history`, { params });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * AI grading stats for a course.
   */
  static async getStats(courseId: number): Promise<GradingStats> {
    try {
      const response = await apiClient.get(`${BASE}/stats/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Preview file analysis without saving (instructor tool).
   */
  static async previewAnalysis(file: File): Promise<PreviewResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      const response = await apiClient.post(`${BASE}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get AI learning stats for a course (shows calibration, rubric generation, etc.).
   */
  static async getLearningStats(courseId: number): Promise<LearningStats> {
    try {
      const response = await apiClient.get(`${BASE}/learning/stats`, {
        params: { course_id: courseId },
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // ╔═════════════════════════════════════╗
  // ║   STUDENT ENDPOINTS                ║
  // ╚═════════════════════════════════════╝

  /**
   * Get the current student's own AI grading results.
   */
  static async getMyResults(params?: {
    course_id?: number;
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResults<StudentGradingResult>> {
    try {
      const response = await apiClient.get(`${BASE}/my-results`, { params });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get the student's AI result for a specific submission.
   */
  static async getMyResultBySubmission(
    submissionId: number,
    submissionType: 'assignment' | 'project' = 'assignment',
  ): Promise<StudentGradingResult> {
    try {
      const response = await apiClient.get(`${BASE}/my-results/${submissionId}`, {
        params: { submission_type: submissionType },
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default ExcelGradingService;
