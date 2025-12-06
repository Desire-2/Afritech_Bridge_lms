/**
 * Grading Service - Handles all grading operations for instructors
 * Provides comprehensive grading functionality for assignments, projects, and quizzes
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

export interface SubmissionFilters {
  course_id?: number;
  assignment_id?: number;
  project_id?: number;
  status?: 'pending' | 'graded' | 'all';
  student_id?: number;
  page?: number;
  per_page?: number;
}

export interface AssignmentSubmission {
  id: number;
  assignment_id: number;
  assignment_title: string;
  assignment_points: number;
  student_id: number;
  student_name: string;
  course_id: number;
  course_title: string;
  content: string;
  file_url?: string;
  external_url?: string;
  submitted_at: string;
  due_date?: string;
  days_late: number;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: number;
  grader_name?: string;
}

export interface ProjectSubmission {
  id: number;
  project_id: number;
  project_title: string;
  project_points: number;
  student_id: number;
  student_name: string;
  course_id: number;
  course_title: string;
  text_content?: string;
  file_path?: string;
  file_name?: string;
  team_members?: number[];
  team_members_info?: Array<{
    id: number;
    name: string;
    email: string;
  }>;
  submitted_at: string;
  due_date: string;
  days_late: number;
  grade?: number;
  feedback?: string;
  graded_at?: string;
  graded_by?: number;
  grader_name?: string;
}

export interface SubmissionDetail extends AssignmentSubmission {
  assignment?: any;
  project?: any;
  course?: {
    id: number;
    title: string;
  };
  student_info?: {
    id: number;
    name: string;
    email: string;
    username: string;
  };
  previous_attempts?: Array<{
    id: number;
    submitted_at: string;
    grade?: number;
  }>;
}

export interface GradeRequest {
  grade: number;
  feedback?: string;
  rubric_scores?: {
    [key: string]: {
      score: number;
      max_score: number;
      feedback?: string;
    };
  };
}

export interface BulkGradeRequest {
  submissions: Array<{
    id: number;
    grade: number;
    feedback?: string;
  }>;
}

export interface GradingSummary {
  assignments: {
    pending: number;
    graded: number;
    total: number;
    recent_graded: number;
  };
  projects: {
    pending: number;
    graded: number;
    total: number;
    recent_graded: number;
  };
  total_pending: number;
  total_graded: number;
}

export interface GradeDistribution {
  assignments?: {
    average: number;
    median: number;
    min: number;
    max: number;
    count: number;
    distribution: {
      [key: string]: number;
    };
  };
  projects?: {
    average: number;
    median: number;
    min: number;
    max: number;
    count: number;
    distribution: {
      [key: string]: number;
    };
  };
}

export interface FeedbackTemplate {
  id: number;
  name: string;
  content: string;
}

export interface PaginatedSubmissions<T> {
  submissions: T[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    pages: number;
  };
}

export class GradingService {
  private static readonly BASE_PATH = '/grading';

  // =====================
  // ASSIGNMENT GRADING
  // =====================

  /**
   * Get assignment submissions with filtering and pagination
   */
  static async getAssignmentSubmissions(
    filters: SubmissionFilters = {}
  ): Promise<PaginatedSubmissions<AssignmentSubmission>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await apiClient.get(
        `${this.BASE_PATH}/assignments/submissions?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get detailed view of a single assignment submission
   */
  static async getAssignmentSubmissionDetail(
    submissionId: number
  ): Promise<SubmissionDetail> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Grade an assignment submission
   */
  static async gradeAssignment(
    submissionId: number,
    gradeData: GradeRequest
  ): Promise<{ message: string; submission: AssignmentSubmission }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/grade`,
        gradeData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing grade for an assignment
   */
  static async updateAssignmentGrade(
    submissionId: number,
    gradeData: GradeRequest
  ): Promise<{ message: string; submission: AssignmentSubmission }> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/assignments/submissions/${submissionId}/grade`,
        gradeData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Grade multiple assignment submissions at once
   */
  static async bulkGradeAssignments(
    bulkData: BulkGradeRequest
  ): Promise<{ message: string; graded_count: number; errors?: string[] }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/submissions/bulk-grade`,
        bulkData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // PROJECT GRADING
  // =====================

  /**
   * Get project submissions with filtering and pagination
   */
  static async getProjectSubmissions(
    filters: SubmissionFilters = {}
  ): Promise<PaginatedSubmissions<ProjectSubmission>> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await apiClient.get(
        `${this.BASE_PATH}/projects/submissions?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get detailed view of a single project submission
   */
  static async getProjectSubmissionDetail(
    submissionId: number
  ): Promise<SubmissionDetail> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/projects/submissions/${submissionId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Grade a project submission
   */
  static async gradeProject(
    submissionId: number,
    gradeData: GradeRequest
  ): Promise<{ message: string; submission: ProjectSubmission }> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/projects/submissions/${submissionId}/grade`,
        gradeData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing grade for a project
   */
  static async updateProjectGrade(
    submissionId: number,
    gradeData: GradeRequest
  ): Promise<{ message: string; submission: ProjectSubmission }> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/projects/submissions/${submissionId}/grade`,
        gradeData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // GRADING ANALYTICS
  // =====================

  /**
   * Get summary of grading workload and statistics
   */
  static async getGradingSummary(courseId?: number): Promise<GradingSummary> {
    try {
      const url = courseId
        ? `${this.BASE_PATH}/analytics/summary?course_id=${courseId}`
        : `${this.BASE_PATH}/analytics/summary`;

      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get grade distribution statistics
   */
  static async getGradeDistribution(filters: {
    course_id?: number;
    assignment_id?: number;
    project_id?: number;
  } = {}): Promise<GradeDistribution> {
    try {
      const params = new URLSearchParams();
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      });

      const response = await apiClient.get(
        `${this.BASE_PATH}/analytics/grade-distribution?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // FEEDBACK TEMPLATES
  // =====================

  /**
   * Get saved feedback templates for instructor
   */
  static async getFeedbackTemplates(): Promise<FeedbackTemplate[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/feedback-templates`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // UTILITY METHODS
  // =====================

  /**
   * Calculate grade percentage
   */
  static calculatePercentage(grade: number, maxPoints: number): number {
    if (maxPoints === 0) return 0;
    return (grade / maxPoints) * 100;
  }

  /**
   * Get letter grade from percentage
   */
  static getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Format grade display
   */
  static formatGrade(grade: number, maxPoints: number): string {
    const percentage = this.calculatePercentage(grade, maxPoints);
    const letter = this.getLetterGrade(percentage);
    return `${grade}/${maxPoints} (${percentage.toFixed(1)}% - ${letter})`;
  }

  /**
   * Check if submission is late
   */
  static isLate(submittedAt: string, dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(submittedAt) > new Date(dueDate);
  }

  /**
   * Calculate days late
   */
  static calculateDaysLate(submittedAt: string, dueDate?: string): number {
    if (!dueDate) return 0;
    const submitted = new Date(submittedAt);
    const due = new Date(dueDate);
    const diffTime = submitted.getTime() - due.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.max(0, diffDays);
  }
}

export default GradingService;
