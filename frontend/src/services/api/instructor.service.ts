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
   * Get student activity analysis (optionally scoped to a course / cohort)
   */
  async getStudentAnalysis(courseId?: number, applicationWindowId?: number): Promise<any> {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', String(courseId));
    if (applicationWindowId) params.set('application_window_id', String(applicationWindowId));
    const qs = params.toString();
    return this.get(`/instructor/students/analysis${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get student activity analysis status (for async tasks)
   */
  async getStudentAnalysisStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/analysis/status/${taskId}`);
  }

  /**
   * Get inactive students (optionally scoped to a course / cohort)
   */
  async getInactiveStudents(courseId?: number, applicationWindowId?: number): Promise<any> {
    const params = new URLSearchParams();
    if (courseId) params.set('course_id', String(courseId));
    if (applicationWindowId) params.set('application_window_id', String(applicationWindowId));
    const qs = params.toString();
    return this.get(`/instructor/students/inactive${qs ? `?${qs}` : ''}`);
  }

  /**
   * Get inactive students status (for async tasks)
   */
  async getInactiveStudentsStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/inactive/status/${taskId}`);
  }

  /**
   * Terminate a student enrollment (optionally scoped to a course / cohort)
   */
  async terminateStudent(studentId: number, reason: string, courseId?: number, applicationWindowId?: number): Promise<any> {
    return this.post(`/instructor/students/${studentId}/terminate`, { reason, course_id: courseId, application_window_id: applicationWindowId });
  }

  /**
   * Bulk terminate students (optionally scoped to a course / cohort)
   */
  async bulkTerminateStudents(studentIds: number[], reason: string, courseId?: number, applicationWindowId?: number): Promise<any> {
    return this.post('/instructor/bulk-terminate', { student_ids: studentIds, reason, course_id: courseId, application_window_id: applicationWindowId });
  }

  /**
   * Send warning emails to inactive students (optionally scoped to a course / cohort)
   */
  async sendInactivityWarnings(thresholdDays: number = 5, courseId?: number, applicationWindowId?: number): Promise<any> {
    return this.post('/instructor/students/send-warnings', { threshold_days: thresholdDays, course_id: courseId, application_window_id: applicationWindowId });
  }

  /**
   * Get send warnings status (for async tasks)
   */
  async getSendWarningsStatus(taskId: string): Promise<any> {
    return this.get(`/instructor/students/send-warnings/status/${taskId}`);
  }
}

export default new InstructorApiService();
