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
  // NEW: requirement-level assessment fields (assignment-aware engine)
  status?: "SATISFIED" | "PARTIAL" | "FAILED" | "NOT_FOUND" | "MANUAL_REVIEW" | "EXCEEDED" | "NOT_APPLICABLE";
  confidence?: number;
  evidence?: string[];
  missing?: string[];
  fix?: string;
  requirement?: string;
  criticality?: "critical" | "major" | "normal" | "minor";
}

export interface FlaggedIssue {
  type: string;
  description: string;
}

// ─── NEW: Rubric metadata types (from backend RubricGenerator) ─────────────

export interface RubricTaskChecklistItem {
  task_number: number;
  task_text: string;
  task_type: string;
  is_theory: boolean;
  deliverables: string[];
  formulas: string[];
  expected_sheets: string[];
}

export interface TasksSummaryItem {
  number: number;
  text: string;
  type: string;
  is_theory: boolean;
  formulas: string[];
  deliverables: string[];
}

export interface TheoryQuestion {
  task_number: number;
  text: string;
}

export interface RubricMetadata {
  total_tasks: number;
  theory_tasks: number;
  auto_gradable_tasks: number;
  total_formulas_requested: number;
  total_deliverables_requested: number;
  all_formulas: string[];
  all_deliverables: string[];
  tasks_summary: TasksSummaryItem[];
  theory_questions: TheoryQuestion[];
}

export interface RubricCriterion {
  name: string;
  description: string;
  category: string;
  expected_elements: string[];
  max_points: number;
  task_count: number;
  concept_count: number;
  raw_weight: number;
  task_checklist: RubricTaskChecklistItem[];
  all_formulas: string[];
  all_deliverables: string[];
  theory_questions: TheoryQuestion[];
  theory_count: number;
}

export interface RubricData {
  criteria: RubricCriterion[];
  total_points: number;
  parts: any[];
  scope: Record<string, boolean>;
  generation_method: string;
  task_count: number;
  concept_count: number;
  rubric_metadata: RubricMetadata;
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
  // NEW: Full rubric data from the AI RubricGenerator
  rubric_data?: RubricData;
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
  // NEW: Full rubric data from the AI RubricGenerator
  rubric_data?: RubricData;
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

// ─── NEW: Assignment analysis (dry-run) types ─────────────────

export interface AssessmentRequirement {
  id: string;
  requirement: string;
  type: string;
  category: string;
  evidence_source: string;
  verification: {
    type: string;
    expected_functions: string[];
    target_cells: Array<{ sheet: string | null; cell: string }>;
    required_sheets: string[];
    expected?: any;
  };
  method_constraint: "strict" | "preferred" | "flexible";
  criticality: "critical" | "major" | "normal" | "minor";
  depends_on: string[];
  manual_review?: boolean;
  max_points?: number;
}

export interface AssessmentRubricCriterion {
  id: string;
  name: string;
  max_points: number;
  criticality: string;
  method_constraint: string;
  type: string;
}

export interface AssignmentAnalysis {
  dry_run: boolean;
  assignment: { id: number; title: string; description: string; instructions: string };
  assignment_interpretation: Record<string, any>;
  requirements_detected: AssessmentRequirement[];
  rubric_generated: {
    rubric_type: string;
    total_points: number;
    requirement_count: number;
    requirement_level: boolean;
    approved: boolean;
    criteria: AssessmentRubricCriterion[];
    rubric_metadata: Record<string, any>;
  };
  analyzers_selected: string[];
  evidence_strategies: string[];
  potential_ambiguities: string[];
  difficulty: { level: string; confidence: number; signals: Record<string, number> };
  source_hash: string;
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

  /**
   * Dry-run assignment interpretation: shows the generated assessment
   * contract (requirements, rubric, analyzers, ambiguities) without
   * grading any submission. (spec 36-37)
   */
  static async analyzeAssignment(assignmentId: number): Promise<AssignmentAnalysis> {
    try {
      const response = await apiClient.get(`${BASE}/analyze-assignment/${assignmentId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Explicitly approve a generated rubric so it is reused with higher
   * confidence in future grading runs. (spec 37)
   */
  static async approveRubric(assignmentId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${BASE}/learning/rubric/${assignmentId}/approve`);
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
