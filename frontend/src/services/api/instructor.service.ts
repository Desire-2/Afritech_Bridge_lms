/**
 * Instructor API Service
 * Handles instructor-specific operations
 */

import BaseApiService from './base.service';
import { Course } from './types';

class InstructorApiService extends BaseApiService {
  /**
   * Get courses taught by the current instructor
   * Backend returns Course[] directly
   */
  async getInstructorCourses(): Promise<Course[]> {
    return this.get('/instructor/courses');
  }

  /**
   * Get instructor dashboard statistics
   */
  async getDashboardStats(): Promise<any> {
    return this.get('/instructor/dashboard');
  }

  /**
   * Get course analytics
   */
  async getCourseAnalytics(courseId: number): Promise<any> {
    return this.get(`/instructor/courses/${courseId}/analytics`);
  }

  /**
   * Get all students across instructor's courses
   */
  async getStudents(): Promise<any> {
    return this.get('/instructor/students');
  }

  /**
   * Get enrollments for a specific course
   */
  async getCourseEnrollments(courseId: number): Promise<any> {
    return this.get(`/instructor/courses/${courseId}/enrollments`);
  }

  /**
   * Remove student enrollment
   */
  async removeEnrollment(enrollmentId: number): Promise<any> {
    return this.delete(`/instructor/enrollments/${enrollmentId}`);
  }

  /**
   * Get pending submissions
   */
  async getPendingSubmissions(): Promise<any> {
    return this.get('/instructor/submissions/pending');
  }

  /**
   * Get student activity analysis
   */
  async getStudentAnalysis(): Promise<any> {
    return this.get('/instructor/students/analysis');
  }

  /**
   * Get student activity analysis status (for async tasks)
   */
  async getStudentAnalysisStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/analysis/status/${taskId}`);
  }

  /**
   * Get inactive students
   */
  async getInactiveStudents(): Promise<any> {
    return this.get('/instructor/students/inactive');
  }

  /**
   * Get inactive students status (for async tasks)
   */
  async getInactiveStudentsStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/inactive/status/${taskId}`);
  }

  /**
   * Terminate a student enrollment
   */
  async terminateStudent(studentId: number, reason: string): Promise<any> {
    return this.post(`/instructor/students/${studentId}/terminate`, { reason });
  }

  /**
   * Bulk terminate students
   */
  async bulkTerminateStudents(studentIds: number[], reason: string): Promise<any> {
    return this.post('/instructor/bulk-terminate', { student_ids: studentIds, reason });
  }

  /**
   * Send warning emails to inactive students
   */
  async sendInactivityWarnings(thresholdDays: number = 5): Promise<any> {
    return this.post('/instructor/students/send-warnings', { threshold_days: thresholdDays });
  }

  /**
   * Get send warnings status (for async tasks)
   */
  async getSendWarningsStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/send-warnings/status/${taskId}`);
  }
}

export default new InstructorApiService();
