import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Course, User, Enrollment } from '@/types/api';

export interface StudentPerformanceAnalytics {
  overview: {
    total_students: number;
    active_students: number;
    total_courses: number;
    activity_rate: number;
  };
  course_analytics: Array<{
    course: Course;
    total_enrolled: number;
    completion_rate: number;
    average_progress: number;
    modules_performance: Array<{
      module: any;
      students_enrolled: number;
      completion_rate: number;
      average_score: number;
      performance_breakdown: {
        excellent: number;
        good: number;
        average: number;
        poor: number;
      };
    }>;
    assignments_performance: {
      total_assignments: number;
      performance: Array<{
        assignment: any;
        submissions: number;
        submission_rate: number;
        average_grade: number;
        grade_distribution: Record<string, number>;
      }>;
    };
    quizzes_performance: {
      total_quizzes: number;
      performance: Array<{
        quiz: any;
        submissions: number;
        completion_rate: number;
        average_score: number;
        score_distribution: Record<string, number>;
      }>;
    };
    grade_distribution: Record<string, number>;
  }>;
  students_performance: Array<{
    student: User;
    overall_average: number;
    courses_enrolled: number;
    recent_activity: number;
    course_performance: Array<{
      course: Course;
      progress: number;
      average_score: number;
      modules_completed: number;
      total_modules: number;
    }>;
    status: 'excellent' | 'good' | 'average' | 'inactive' | 'struggling';
  }>;
  struggling_students: Array<any>;
  top_performers: Array<any>;
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    actions: string[];
  }>;
}

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
  static async getMyStudents(courseId?: number, cohortId?: number, cohortLabel?: string): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (courseId) params.set('course_id', String(courseId));
      if (cohortId) params.set('cohort_id', String(cohortId));
      if (cohortLabel) params.set('cohort_label', cohortLabel);
      const qs = params.toString();
      const url = `${this.BASE_PATH}/students${qs ? `?${qs}` : ''}`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get course enrollments for instructor
  static async getCourseEnrollments(courseId: number, cohortId?: number, cohortLabel?: string): Promise<Enrollment[]> {
    try {
      const params = new URLSearchParams();
      if (cohortId) params.set('cohort_id', String(cohortId));
      if (cohortLabel) params.set('cohort_label', cohortLabel);
      const qs = params.toString();
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/enrollments${qs ? `?${qs}` : ''}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get cohorts for a specific course
  static async getCourseCohorts(courseId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/cohorts`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Unenroll a student from a course
  static async unenrollStudent(enrollmentId: number): Promise<{ message: string; success: boolean }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/enrollments/${enrollmentId}`);
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

  // Get student performance analytics
  static async getStudentPerformanceAnalytics(courseId?: number): Promise<StudentPerformanceAnalytics> {
    try {
      const url = courseId 
        ? `${this.BASE_PATH}/students/analytics?course_id=${courseId}`
        : `${this.BASE_PATH}/students/analytics`;
      const response = await apiClient.get(url);
      return response.data;
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

  // Give full credit to student for a specific module
  static async giveStudentFullCredit(studentId: number, moduleId: number): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/students/${studentId}/modules/${moduleId}/full-credit`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get module components summary
  static async getModuleComponents(moduleId: number): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/modules/${moduleId}/components`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get course students
  static async getCourseStudents(courseId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/students`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get course modules
  static async getCourseModules(courseId: number): Promise<any[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/modules`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default InstructorService;