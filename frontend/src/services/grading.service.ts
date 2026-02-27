/**
 * Grading Service - Handles all grading operations for instructors
 * Provides comprehensive grading functionality for assignments, projects, and quizzes
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

export interface SubmissionFilters {
  course_id?: number;
  cohort_id?: number;  // application_window_id for cohort filtering
  module_id?: number;
  lesson_id?: number;
  assignment_id?: number;
  project_id?: number;
  status?: 'pending' | 'graded' | 'all' | 'resubmitted' | 'modification_requested';
  student_id?: number;
  page?: number;
  per_page?: number;
  search_query?: string;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  date_start?: string;
  date_end?: string;
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
  is_resubmission?: boolean;
  resubmission_count?: number;
  submission_notes?: string;
  // Assignment-level modification request fields
  modification_requested?: boolean;
  modification_request_reason?: string;
  modification_requested_at?: string;
  modification_requested_by?: number;
  can_resubmit?: boolean;
  // Enhanced fields
  student_email?: string;
  word_count?: number;
  reading_time?: number;
  priority_level?: 'low' | 'medium' | 'high';
  estimated_grading_time?: number;
  // Cohort fields
  cohort_label?: string;
  application_window_id?: number;
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
  is_resubmission?: boolean;
  resubmission_count?: number;
  submission_notes?: string;
  // Project-level modification request fields
  modification_requested?: boolean;
  modification_request_reason?: string;
  modification_requested_at?: string;
  modification_requested_by?: number;
  can_resubmit?: boolean;
  // Cohort fields
  cohort_label?: string;
  application_window_id?: number;
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
  team_members_info?: Array<{
    id: number;
    name: string;
    email: string;
  }>;
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
  analytics?: {
    summary: {
      total_pending: number;
      total_graded: number;
      average_grade: number;
      completion_rate: number;
      overdue_count: number;
      due_soon_count: number;
    };
    insights: {
      suggested_actions: string[];
      priority_items: Array<{
        id: number;
        title: string;
        student_name: string;
        days_late: number;
        priority: 'low' | 'medium' | 'high';
      }>;
    };
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
  static async getGradingSummary(courseId?: number, cohortId?: number): Promise<GradingSummary> {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', String(courseId));
      if (cohortId) params.append('cohort_id', String(cohortId));
      const queryString = params.toString();
      const url = queryString
        ? `${this.BASE_PATH}/analytics/summary?${queryString}`
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
    if (grade === null || grade === undefined || maxPoints === null || maxPoints === undefined) return 0;
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

  /**
   * Get submission priority based on status
   */
  static getSubmissionPriority(submission: AssignmentSubmission | ProjectSubmission): 'high' | 'medium' | 'low' {
    // Resubmissions have highest priority
    if (submission.is_resubmission && !submission.grade) {
      return 'high';
    }
    
    // Modification requests waiting for student response
    if (submission.submission_status?.modification_requested && !submission.is_resubmission) {
      return 'medium';
    }
    
    // Overdue submissions
    const daysLate = this.calculateDaysLate(submission.submitted_at, submission.due_date);
    if (daysLate > 0 && !submission.grade) {
      return 'high';
    }
    
    // Regular pending submissions
    if (!submission.grade) {
      return 'medium';
    }
    
    return 'low';
  }

  /**
   * Get status description for submission
   */
  static getSubmissionStatusDescription(submission: AssignmentSubmission | ProjectSubmission): string {
    if (submission.grade !== undefined) {
      return 'Graded';
    }
    
    if (submission.is_resubmission) {
      const count = submission.resubmission_count || 0;
      return count > 1 ? `Resubmission #${count + 1}` : 'Resubmission';
    }
    
    if (submission.submission_status?.modification_requested) {
      return 'Modification Requested';
    }
    
    const daysLate = this.calculateDaysLate(submission.submitted_at, submission.due_date);
    if (daysLate > 0) {
      return `${daysLate} day${daysLate > 1 ? 's' : ''} overdue`;
    }
    
    return 'Pending Review';
  }

  /**
   * Check if submission needs immediate attention
   */
  static needsImmediateAttention(submission: AssignmentSubmission | ProjectSubmission): boolean {
    return this.getSubmissionPriority(submission) === 'high';
  }

  // =====================
  // RUBRIC MANAGEMENT
  // =====================

  /**
   * Get all rubrics for the instructor
   */
  static async getRubrics(courseId?: number, includeTemplates: boolean = true): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (courseId) params.append('course_id', courseId.toString());
      params.append('include_templates', includeTemplates.toString());

      const response = await apiClient.get(
        `${this.BASE_PATH}/rubrics?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Create a new rubric
   */
  static async createRubric(rubricData: any): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/rubrics`, rubricData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing rubric
   */
  static async updateRubric(rubricId: number, rubricData: any): Promise<any> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/rubrics/${rubricId}`, rubricData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete a rubric
   */
  static async deleteRubric(rubricId: number): Promise<any> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/rubrics/${rubricId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // ENHANCED FEEDBACK TEMPLATES
  // =====================

  /**
   * Get enhanced feedback templates with filtering
   */
  static async getEnhancedFeedbackTemplates(
    category?: string,
    tags?: string[],
    includePublic: boolean = true
  ): Promise<any[]> {
    try {
      const params = new URLSearchParams();
      if (category) params.append('category', category);
      if (tags && tags.length > 0) params.append('tags', tags.join(','));
      params.append('include_public', includePublic.toString());

      const response = await apiClient.get(
        `${this.BASE_PATH}/feedback-templates/enhanced?${params.toString()}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Create a new feedback template
   */
  static async createFeedbackTemplate(templateData: any): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/feedback-templates`, templateData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update a feedback template
   */
  static async updateFeedbackTemplate(templateId: number, templateData: any): Promise<any> {
    try {
      const response = await apiClient.put(
        `${this.BASE_PATH}/feedback-templates/${templateId}`,
        templateData
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete a feedback template
   */
  static async deleteFeedbackTemplate(templateId: number): Promise<any> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/feedback-templates/${templateId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Track template usage
   */
  static async useFeedbackTemplate(templateId: number): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/feedback-templates/${templateId}/use`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // GRADING HISTORY
  // =====================

  /**
   * Get grading history for a submission
   */
  static async getGradingHistory(
    submissionType: 'assignment' | 'project',
    submissionId: number
  ): Promise<any[]> {
    try {
      const response = await apiClient.get(
        `${this.BASE_PATH}/history/${submissionType}/${submissionId}`
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // QUICK GRADING
  // =====================

  /**
   * Quick grade a submission
   */
  static async quickGrade(gradeData: {
    type: 'assignment' | 'project';
    submission_id: number;
    grade: number;
    feedback?: string;
    rubric_scores?: any;
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/quick-grade`, gradeData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // BATCH OPERATIONS
  // =====================

  /**
   * Export grades for submissions
   */
  static async exportGrades(params: {
    type: 'assignment' | 'project';
    submission_ids?: number[];
    course_id?: number;
  }): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/export`, params);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default GradingService;
