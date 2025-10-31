import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Course, User, Enrollment } from '@/types/api';

export interface InstructorDashboardData {
  taughtCourses: Course[];
  totalStudents: number;
  pendingGradingItems: number;
  recentEnrollments: Enrollment[];
  recentAnnouncements: Array<{
    id: number;
    title: string;
    course_title: string;
    created_at: string;
  }>;
}

export interface CourseAnalytics {
  course_id: number;
  total_enrolled: number;
  active_students: number;
  completion_rate: number;
  average_progress: number;
  total_quiz_submissions: number;
  pending_submissions: number;
}

export class InstructorService {
  private static readonly BASE_PATH = '/instructor';

  // Dashboard data
  static async getDashboardData(): Promise<InstructorDashboardData> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/dashboard`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get instructor's courses
  static async getMyCourses(): Promise<Course[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get course analytics
  static async getCourseAnalytics(courseId: number): Promise<CourseAnalytics> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/analytics`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get students enrolled in instructor's courses
  static async getMyStudents(courseId?: number): Promise<User[]> {
    try {
      const url = courseId 
        ? `${this.BASE_PATH}/students?course_id=${courseId}`
        : `${this.BASE_PATH}/students`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get course enrollments for instructor
  static async getCourseEnrollments(courseId: number): Promise<Enrollment[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/enrollments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Grade submission
  static async gradeSubmission(submissionId: number, grade: number, feedback?: string): Promise<void> {
    try {
      await apiClient.patch(`/v1/submissions/${submissionId}/grade`, {
        grade,
        feedback
      });
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get pending submissions for grading
  static async getPendingSubmissions(courseId?: number): Promise<any[]> {
    try {
      const url = courseId 
        ? `${this.BASE_PATH}/submissions/pending?course_id=${courseId}`
        : `${this.BASE_PATH}/submissions/pending`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default InstructorService;