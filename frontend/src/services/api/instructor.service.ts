/**
 * Instructor API Service
 * Handles instructor-specific operations
 */

import BaseApiService from './base.service';
import { Course } from './types';

class InstructorApiService extends BaseApiService {
  /**
   * Get courses taught by the current instructor
   */
  async getInstructorCourses(): Promise<{ courses: Course[] }> {
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
}

export default new InstructorApiService();
