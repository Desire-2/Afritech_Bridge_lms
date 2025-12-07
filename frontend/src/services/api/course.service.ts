/**
 * Course API Service
 * Handles course browsing, enrollment, and module access
 */

import BaseApiService, { ApiResponse, PaginatedResponse } from './base.service';
import {
  Course,
  Module,
  Lesson,
  ModuleData,
  CourseProgress,
  EnrollmentRequest,
} from './types';

class CourseApiService extends BaseApiService {
  /**
   * Get all available courses with filters
   */
  async getCourses(filters?: {
    category?: string;
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    search?: string;
    sort_by?: 'rating' | 'enrollment' | 'recent' | 'title';
    page?: number;
    per_page?: number;
  }): Promise<PaginatedResponse<Course>> {
    return this.get<PaginatedResponse<Course>>('/courses', {
      params: filters
    });
  }

  /**
   * Get student's enrolled courses
   */
  async getEnrolledCourses(): Promise<{
    courses: Array<Course & { 
      progress: number;
      enrollment_date: string;
      last_accessed: string;
      current_lesson?: {
        id: number;
        title: string;
        module_title: string;
      };
    }>;
  }> {
    return this.get('/student/learning');
  }

  /**
   * Get course details with modules
   */
  async getCourseDetails(courseId: number): Promise<Course & {
    modules: Module[];
    instructor: {
      id: number;
      name: string;
      bio: string;
      rating: number;
    };
    prerequisites: Course[];
    what_you_will_learn: string[];
    requirements: string[];
  }> {
    return this.get(`/courses/${courseId}`);
  }

  /**
   * Get course modules with progression status
   */
  async getCourseModules(courseId: number): Promise<{
    modules: ModuleData[];
    course_progress: CourseProgress;
    can_proceed: boolean;
    next_unlockable_module?: Module;
  }> {
    return this.get(`/student/learning/course/${courseId}/modules`);
  }

  /**
   * Check if module can be unlocked
   */
  async checkModuleUnlock(courseId: number, moduleId: number): Promise<{
    can_unlock: boolean;
    reason?: string;
    requirements: {
      previous_module_passed: boolean;
      score_threshold_met: boolean;
      attempts_remaining: boolean;
    };
  }> {
    return this.get(`/courses/${courseId}/modules/${moduleId}/unlock-status`);
  }

  /**
   * Get module details with lessons
   */
  async getModuleDetails(moduleId: number): Promise<ModuleData & {
    lessons: Lesson[];
    assessments: {
      quizzes: any[];
      assignments: any[];
      final_assessment?: any;
    };
  }> {
    return this.get(`/student/modules/${moduleId}`);
  }

  /**
   * Get lesson content
   */
  async getLessonContent(lessonId: number): Promise<Lesson & {
    content: string;
    resources: Array<{
      id: number;
      title: string;
      type: 'pdf' | 'video' | 'link' | 'document';
      url: string;
    }>;
    next_lesson?: {
      id: number;
      title: string;
    };
    previous_lesson?: {
      id: number;
      title: string;
    };
  }> {
    return this.get(`/student/lessons/${lessonId}`);
  }

  /**
   * Enroll in a course
   */
  async enrollInCourse(data: EnrollmentRequest): Promise<ApiResponse<{
    enrollment_id: number;
    status: string;
    message: string;
    payment_required: boolean;
    payment_url?: string;
  }>> {
    return this.post('/student/enroll', data);
  }

  /**
   * Check enrollment eligibility
   */
  async checkEnrollmentEligibility(courseId: number): Promise<{
    eligible: boolean;
    reason?: string;
    options: {
      free_available: boolean;
      paid_available: boolean;
      scholarship_available: boolean;
      price?: number;
      scholarship_criteria?: string;
    };
  }> {
    return this.get(`/courses/${courseId}/enrollment-eligibility`);
  }

  /**
   * Search courses
   */
  async searchCourses(query: string, filters?: {
    category?: string;
    difficulty?: string;
    max_price?: number;
  }): Promise<Course[]> {
    return this.get('/courses/search', {
      params: { q: query, ...filters }
    });
  }

  /**
   * Get course recommendations
   */
  async getCourseRecommendations(limit: number = 6): Promise<Course[]> {
    return this.get('/student/recommendations/courses', {
      params: { limit }
    });
  }

  /**
   * Get trending courses
   */
  async getTrendingCourses(limit: number = 10): Promise<Course[]> {
    return this.get('/courses/trending', {
      params: { limit }
    });
  }

  /**
   * Rate a course
   */
  async rateCourse(courseId: number, rating: number, review?: string): Promise<ApiResponse> {
    return this.post(`/courses/${courseId}/rate`, {
      rating,
      review
    });
  }

  /**
   * Get course reviews
   */
  async getCourseReviews(courseId: number, page: number = 1): Promise<PaginatedResponse<{
    id: number;
    student_name: string;
    rating: number;
    review: string;
    created_at: string;
    helpful_count: number;
  }>> {
    return this.get(`/courses/${courseId}/reviews`, {
      params: { page }
    });
  }
}

export default new CourseApiService();
