/**
 * Instructor Assignment API Service
 * Handles assignment management for instructors
 */

import BaseApiService, { ApiResponse } from './base.service';
import { Assignment, CreateAssignmentRequest } from '@/types/api';

interface AssignmentWithStats extends Assignment {
  total_submissions?: number;
  pending_grading?: number;
  average_score?: number;
  on_time_submissions?: number;
  late_submissions?: number;
}

interface AssignmentSubmissionStats {
  assignment_id: number;
  assignment_title: string;
  total_submissions: number;
  pending_grading: number;
  graded: number;
  average_score: number;
  on_time_submissions: number;
  late_submissions: number;
  submissions: {
    id: number;
    student_name: string;
    student_email: string;
    submitted_at: string;
    grade: number | null;
    status: 'pending' | 'graded' | 'late';
  }[];
}

class InstructorAssignmentService extends BaseApiService {
  /**
   * Get all assignments for instructor's courses
   */
  async getInstructorAssignments(): Promise<AssignmentWithStats[]> {
    return this.get<AssignmentWithStats[]>('/instructor/assessments/assignments');
  }

  /**
   * Get assignments for a specific course
   */
  async getCourseAssignments(courseId: number): Promise<Assignment[]> {
    const data = await this.get<{ assignments: Assignment[] }>(`/instructor/assessments/courses/${courseId}/overview`);
    return data.assignments || [];
  }

  /**
   * Create a new assignment
   */
  async createAssignment(data: CreateAssignmentRequest): Promise<ApiResponse<Assignment>> {
    return this.post('/instructor/assessments/assignments', data);
  }

  /**
   * Update an existing assignment
   */
  async updateAssignment(assignmentId: number, data: Partial<CreateAssignmentRequest>): Promise<ApiResponse<Assignment>> {
    return this.put(`/instructor/assessments/assignments/${assignmentId}`, data);
  }

  /**
   * Delete an assignment
   */
  async deleteAssignment(assignmentId: number): Promise<ApiResponse> {
    return this.delete(`/instructor/assessments/assignments/${assignmentId}`);
  }

  /**
   * Get assignment with submission statistics
   */
  async getAssignmentStats(assignmentId: number): Promise<AssignmentSubmissionStats> {
    return this.get<AssignmentSubmissionStats>(`/instructor/assessments/assignments/${assignmentId}/stats`);
  }

  /**
   * Publish/unpublish assignment
   */
  async togglePublishAssignment(assignmentId: number, isPublished: boolean): Promise<ApiResponse<Assignment>> {
    return this.put(`/instructor/assessments/assignments/${assignmentId}`, {
      is_published: isPublished
    });
  }

  /**
   * Get all submissions for an assignment
   */
  async getAssignmentSubmissions(assignmentId: number): Promise<any[]> {
    return this.get(`/grading/assignments/submissions?assignment_id=${assignmentId}`);
  }

  /**
   * Bulk grade assignments
   */
  async bulkGradeAssignments(data: {
    submission_ids: number[];
    grade: number;
    feedback?: string;
  }): Promise<ApiResponse> {
    return this.post('/grading/assignments/bulk-grade', data);
  }

  /**
   * Export assignment data to CSV
   */
  async exportAssignmentData(assignmentId: number): Promise<Blob> {
    return this.get(`/instructor/assessments/assignments/${assignmentId}/export`, {
      responseType: 'blob'
    });
  }

  /**
   * Clone/duplicate an assignment
   */
  async cloneAssignment(assignmentId: number, newCourseId?: number): Promise<ApiResponse<Assignment>> {
    return this.post(`/instructor/assessments/assignments/${assignmentId}/clone`, {
      course_id: newCourseId
    });
  }

  /**
   * Get assignment analytics
   */
  async getAssignmentAnalytics(assignmentId: number): Promise<{
    submission_rate: number;
    average_grade: number;
    grade_distribution: {
      range: string;
      count: number;
    }[];
    time_to_complete: {
      average_hours: number;
      median_hours: number;
    };
    common_issues: string[];
  }> {
    return this.get(`/instructor/assessments/assignments/${assignmentId}/analytics`);
  }
}

export default new InstructorAssignmentService();
