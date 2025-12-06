/**
 * Student Submission Service - Track assignment and project submissions
 */

import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';

export interface SubmissionStatus {
  id?: number;
  submitted: boolean;
  submitted_at?: string;
  status: 'not_submitted' | 'submitted' | 'graded' | 'late';
  grade?: number;
  feedback?: string;
  graded_at?: string;
  grader_name?: string;
  is_late: boolean;
  days_late?: number;
}

export interface AssignmentWithStatus {
  id: number;
  title: string;
  description: string;
  course_id: number;
  course_title: string;
  due_date?: string;
  points_possible: number;
  assignment_type: string;
  instructions?: string;
  allowed_file_types?: string;
  max_file_size_mb?: number;
  is_published: boolean;
  submission_status: SubmissionStatus;
}

export interface ProjectWithStatus {
  id: number;
  title: string;
  description: string;
  objectives?: string;
  course_id: number;
  course_title: string;
  due_date: string;
  points_possible: number;
  submission_format: string;
  collaboration_allowed: boolean;
  max_team_size: number;
  is_published: boolean;
  submission_status: SubmissionStatus;
}

export interface SubmissionDetail {
  assignment?: AssignmentWithStatus;
  project?: ProjectWithStatus;
  submission?: {
    id: number;
    content?: string;
    text_content?: string;
    file_url?: string;
    file_path?: string;
    file_name?: string;
    external_url?: string;
    submitted_at: string;
    grade?: number;
    feedback?: string;
    graded_at?: string;
    graded_by?: number;
    grader_name?: string;
    team_members?: number[];
  };
}

export class StudentSubmissionService {
  private static readonly BASE_PATH = '/student';

  /**
   * Get all assignments for enrolled courses with submission status
   */
  static async getAssignments(): Promise<AssignmentWithStatus[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/assignments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get assignment details with submission status
   */
  static async getAssignmentDetails(assignmentId: number): Promise<SubmissionDetail> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/assignments/${assignmentId}/details`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Submit an assignment
   */
  static async submitAssignment(
    assignmentId: number,
    data: {
      content?: string;
      file_url?: string;
      external_url?: string;
    }
  ): Promise<any> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/assignments/${assignmentId}/submit`,
        data
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get all projects for enrolled courses with submission status
   */
  static async getProjects(): Promise<ProjectWithStatus[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/projects`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get project details with submission status
   */
  static async getProjectDetails(projectId: number): Promise<SubmissionDetail> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/projects/${projectId}/details`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Submit a project
   */
  static async submitProject(
    projectId: number,
    data: {
      text_content?: string;
      file_url?: string;
      team_members?: number[];
    }
  ): Promise<any> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/projects/${projectId}/submit`,
        data
      );
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Get submission status badge info
   */
  static getStatusBadge(status: SubmissionStatus): {
    text: string;
    color: string;
    icon: string;
  } {
    if (status.status === 'graded') {
      return {
        text: 'Graded',
        color: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
        icon: 'check-circle'
      };
    }

    if (status.status === 'submitted') {
      return {
        text: 'Submitted - Pending Grade',
        color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
        icon: 'clock'
      };
    }

    if (status.status === 'late' || status.is_late) {
      return {
        text: 'Not Submitted - Overdue',
        color: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
        icon: 'exclamation'
      };
    }

    return {
      text: 'Not Submitted',
      color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
      icon: 'warning'
    };
  }

  /**
   * Calculate percentage grade
   */
  static calculatePercentage(grade?: number, maxPoints?: number): number {
    if (!grade || !maxPoints || maxPoints === 0) return 0;
    return (grade / maxPoints) * 100;
  }

  /**
   * Get letter grade
   */
  static getLetterGrade(percentage: number): string {
    if (percentage >= 90) return 'A';
    if (percentage >= 80) return 'B';
    if (percentage >= 70) return 'C';
    if (percentage >= 60) return 'D';
    return 'F';
  }

  /**
   * Check if overdue
   */
  static isOverdue(dueDate?: string): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
  }

  /**
   * Calculate days until due or days late
   */
  static getDaysUntilDue(dueDate?: string): number {
    if (!dueDate) return 0;
    const due = new Date(dueDate);
    const now = new Date();
    const diffTime = due.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  }
}

export default StudentSubmissionService;
