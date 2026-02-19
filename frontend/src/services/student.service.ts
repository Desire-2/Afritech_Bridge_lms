import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Announcement } from '@/types/api';

// Enhanced types for student services
export interface StudentDashboard {
  enrolled_courses: EnrolledCourse[];
  stats: {
    total_courses: number;
    completed_courses: number;
    hours_spent: number;
    achievements: number;
  };
  achievements: Achievement[];
  recent_activity: RecentActivity[];
}

export interface EnrolledCourse {
  id: number;
  title: string;
  description: string;
  progress: number;
  enrollment_date: string;
  enrollment_id?: number;
  current_lesson?: string;
  instructor_name: string;
  estimated_duration?: string;
  // Cohort separation
  cohort_label?: string | null;
  cohort_start_date?: string | null;
  cohort_end_date?: string | null;
  application_window_id?: number | null;
}

export interface CourseProgress {
  course: {
    id: number;
    title: string;
    description: string;
  };
  overall_progress: number;
  total_time_spent: number;
  last_accessed: string | null;
  current_lesson_id: number | null;
  modules: ModuleProgress[];
}

export interface ModuleProgress {
  id: number;
  title: string;
  description: string;
  order: number;
  lessons: LessonProgress[];
  completed_lessons: number;
  total_lessons: number;
  progress: number;
}

export interface LessonProgress {
  id: number;
  title: string;
  content_type: string;
  order: number;
  completed: boolean;
  completion_date?: string;
  time_spent?: number;
}

export interface StudentNote {
  id: number;
  lesson_id: number;
  content: string;
  created_at: string;
  updated_at: string;
  lesson_title: string;
}

export interface Achievement {
  id: number;
  badge_id: number;
  earned_at: string;
  badge: {
    id: number;
    name: string;
    description: string;
    icon_url?: string;
    points: number;
  };
}

export interface Assignment {
  id: number;
  title: string;
  description: string;
  course_id: number;
  due_date?: string;
  max_points: number;
  submission_type: string;
  submitted: boolean;
  submission?: AssignmentSubmission;
  course_title: string;
}

export interface AssignmentSubmission {
  id: number;
  content?: string;
  file_url?: string;
  external_url?: string;
  submitted_at: string;
  grade?: number;
  feedback?: string;
  graded_at?: string;
}

export interface Bookmark {
  id: number;
  course_id: number;
  created_at: string;
  course: {
    id: number;
    title: string;
    description: string;
    instructor_name: string;
  };
}

export interface StudentProfile {
  id: number;
  username: string;
  email: string;
  first_name: string;
  last_name: string;
  profile_picture_url?: string;
  bio?: string;
  learning_stats: {
    total_courses: number;
    completed_courses: number;
    hours_spent: number;
    badges_earned: number;
  };
}

export interface RecentActivity {
  type: string;
  lesson_title: string;
  course_title: string;
  completed_at: string;
}

export interface BrowseFilters {
  category?: string;
  level?: string;
  price?: string;
  search?: string;
}

export interface BrowseCourse {
  id: number;
  title: string;
  description: string;
  thumbnail?: string;
  instructor: string;
  instructorAvatar?: string;
  category: string;
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  price: number;
  originalPrice?: number;
  isFree: boolean;
  isScholarshipRequired: boolean;
  isEnrolled: boolean;
  studentsCount: number;
  rating: number;
  reviewsCount: number;
  duration: string;
  modules: number;
  certificateAvailable: boolean;
  prerequisites?: string[];
  learningOutcomes?: string[];
  tags?: string[];
  lastUpdated?: string;
}

export class StudentService {
  private static readonly BASE_PATH = '/student';

  // Dashboard
  static async getDashboard(): Promise<StudentDashboard> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/dashboard`);
      // Backend returns { enrolled_courses, stats, achievements, recent_activity }
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Browse Courses
  static async browseCourses(filters?: BrowseFilters): Promise<BrowseCourse[]> {
    try {
      const queryParams = new URLSearchParams();
      if (filters?.category && filters.category !== 'all') {
        queryParams.append('category', filters.category);
      }
      if (filters?.level && filters.level !== 'all') {
        queryParams.append('level', filters.level);
      }
      if (filters?.price && filters.price !== 'all') {
        queryParams.append('price', filters.price);
      }
      if (filters?.search) {
        queryParams.append('search', filters.search);
      }
      
      const url = queryParams.toString() 
        ? `${this.BASE_PATH}/courses/browse?${queryParams}`
        : `${this.BASE_PATH}/courses/browse`;
      
      const response = await apiClient.get(url);
      return response.data.courses || response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Enroll in Course
  static async enrollInCourse(courseId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/courses/${courseId}/enroll`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // My Learning
  static async getMyLearning(): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/learning`);
      // Backend returns { success: true, data: { active_courses, completed_courses, course_stats, ... } }
      if (response.data.success && response.data.data) {
        return response.data.data;
      }
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Get Course for Learning (detailed course data for enrolled students)
  static async getCourseForLearning(courseId: number): Promise<any> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/learning/courses/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCourseProgress(courseId: number): Promise<CourseProgress> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/learning/${courseId}/progress`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Lesson Completion
  static async completeLesson(lessonId: number, timeSpent: number = 0): Promise<{ message: string; progress: number }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/lessons/${lessonId}/complete`, {
        time_spent: timeSpent
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Notes
  static async getNotes(lessonId?: number): Promise<StudentNote[]> {
    try {
      const url = lessonId 
        ? `${this.BASE_PATH}/notes?lesson_id=${lessonId}`
        : `${this.BASE_PATH}/notes`;
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createNote(lessonId: number, content: string): Promise<StudentNote> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/notes`, {
        lesson_id: lessonId,
        content
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateNote(noteId: number, content: string): Promise<StudentNote> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/notes/${noteId}`, {
        content
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteNote(noteId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/notes/${noteId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Bookmarks
  static async getBookmarks(): Promise<Bookmark[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/bookmarks`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async addBookmark(courseId: number): Promise<Bookmark> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/bookmarks`, {
        course_id: courseId
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async removeBookmark(courseId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/bookmarks/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Announcements
  static async getAnnouncements(): Promise<Announcement[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/announcements`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Achievements
  static async getAchievements(): Promise<{ earned: Achievement[]; available: any[] }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/achievements`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Assignments
  static async getAssignments(): Promise<Assignment[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/assignments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async submitAssignment(
    assignmentId: number, 
    submission: {
      content?: string;
      file_url?: string;
      external_url?: string;
    }
  ): Promise<AssignmentSubmission> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/assignments/${assignmentId}/submit`, submission);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Profile
  static async getProfile(): Promise<StudentProfile> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/profile`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}