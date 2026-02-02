import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import {
  Course,
  CreateCourseRequest,
  Module,
  CreateModuleRequest,
  Lesson,
  CreateLessonRequest,
  Enrollment,
  Quiz,
  CreateQuizRequest,
  Question,
  CreateQuestionRequest,
  Answer,
  CreateAnswerRequest,
  Submission,
  QuizSubmissionRequest,
  Announcement,
  CreateAnnouncementRequest,
  PaginatedResponse,
} from '@/types/api';

export class CourseService {
  private static readonly BASE_PATH = '/courses';

  // Course management
  static async getAllCourses(): Promise<Course[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getAllCoursesForAdmin(): Promise<Course[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/all`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCourse(courseId: number): Promise<Course> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCourseForInstructor(courseId: number): Promise<Course> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${courseId}/instructor-details`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createCourse(courseData: CreateCourseRequest): Promise<Course> {
    try {
      const response = await apiClient.post(this.BASE_PATH, courseData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateCourse(courseId: number, courseData: Partial<CreateCourseRequest>): Promise<Course> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${courseId}`, courseData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteCourse(courseId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async publishCourse(courseId: number): Promise<Course> {
    try {
      const response = await apiClient.patch(`${this.BASE_PATH}/${courseId}/publish`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async unpublishCourse(courseId: number): Promise<Course> {
    try {
      const response = await apiClient.patch(`${this.BASE_PATH}/${courseId}/unpublish`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Enrollment management
  static async enrollInCourse(courseId: number): Promise<Enrollment> {
    try {
      const response = await apiClient.post('/enrollments', { course_id: courseId });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getEnrollments(courseId?: number): Promise<Enrollment[]> {
    try {
      const url = courseId ? `/enrollments?course_id=${courseId}` : '/enrollments';
      const response = await apiClient.get(url);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCourseEnrollments(courseId: number): Promise<Enrollment[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${courseId}/enrollments`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async unenrollFromCourse(enrollmentId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`/enrollments/${enrollmentId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export class ModuleService {
  private static readonly BASE_PATH = '/modules';

  static async getModules(courseId: number): Promise<Module[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}?course_id=${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getModule(moduleId: number): Promise<Module> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${moduleId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createModule(moduleData: CreateModuleRequest): Promise<Module> {
    try {
      const response = await apiClient.post(this.BASE_PATH, moduleData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateModule(moduleId: number, moduleData: Partial<CreateModuleRequest>): Promise<Module> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${moduleId}`, moduleData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteModule(moduleId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${moduleId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async reorderModules(courseId: number, moduleIds: number[]): Promise<{ message: string }> {
    try {
      const response = await apiClient.patch(`/courses/${courseId}/modules/reorder`, { module_ids: moduleIds });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export class LessonService {
  private static readonly BASE_PATH = '/lessons';

  static async getLessons(moduleId: number): Promise<Lesson[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}?module_id=${moduleId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getLesson(lessonId: number): Promise<Lesson> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${lessonId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createLesson(lessonData: CreateLessonRequest): Promise<Lesson> {
    try {
      const response = await apiClient.post(this.BASE_PATH, lessonData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateLesson(lessonId: number, lessonData: Partial<CreateLessonRequest>): Promise<Lesson> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${lessonId}`, lessonData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteLesson(lessonId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${lessonId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async reorderLessons(moduleId: number, lessonIds: number[]): Promise<{ message: string }> {
    try {
      const response = await apiClient.patch(`/modules/${moduleId}/lessons/reorder`, { lesson_ids: lessonIds });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export class QuizService {
  private static readonly BASE_PATH = '/quizzes';

  static async getQuizzes(moduleId: number): Promise<Quiz[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}?module_id=${moduleId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getQuiz(quizId: number): Promise<Quiz> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${quizId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createQuiz(quizData: CreateQuizRequest): Promise<Quiz> {
    try {
      const response = await apiClient.post(this.BASE_PATH, quizData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateQuiz(quizId: number, quizData: Partial<CreateQuizRequest>): Promise<Quiz> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${quizId}`, quizData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteQuiz(quizId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${quizId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async submitQuiz(submissionData: QuizSubmissionRequest): Promise<Submission> {
    try {
      const response = await apiClient.post('/submissions', submissionData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getQuizSubmissions(quizId: number): Promise<Submission[]> {
    try {
      const response = await apiClient.get(`/submissions?quiz_id=${quizId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getSubmission(submissionId: number): Promise<Submission> {
    try {
      const response = await apiClient.get(`/submissions/${submissionId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async gradeSubmission(submissionId: number, score: number): Promise<Submission> {
    try {
      const response = await apiClient.patch(`/submissions/${submissionId}/grade`, { score });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export class QuestionService {
  static async createQuestion(questionData: CreateQuestionRequest): Promise<Question> {
    try {
      const response = await apiClient.post('/questions', questionData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateQuestion(questionId: number, questionData: Partial<CreateQuestionRequest>): Promise<Question> {
    try {
      const response = await apiClient.put(`/questions/${questionId}`, questionData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteQuestion(questionId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`/questions/${questionId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createAnswer(answerData: CreateAnswerRequest): Promise<Answer> {
    try {
      const response = await apiClient.post('/answers', answerData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateAnswer(answerId: number, answerData: Partial<CreateAnswerRequest>): Promise<Answer> {
    try {
      const response = await apiClient.put(`/answers/${answerId}`, answerData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteAnswer(answerId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`/answers/${answerId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getInstructorCourses(): Promise<Course[]> {
    try {
      const response = await apiClient.get('/instructor/courses');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export class AnnouncementService {
  private static readonly BASE_PATH = '/announcements';

  static async getAnnouncements(courseId: number): Promise<Announcement[]> {
    try {
      const response = await apiClient.get(`/courses/${courseId}/announcements`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createAnnouncement(announcementData: CreateAnnouncementRequest): Promise<Announcement> {
    try {
      const response = await apiClient.post(this.BASE_PATH, announcementData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateAnnouncement(announcementId: number, announcementData: Partial<CreateAnnouncementRequest>): Promise<Announcement> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${announcementId}`, announcementData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteAnnouncement(announcementId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${announcementId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // Instructor-specific methods
  static async getInstructorAnnouncements(): Promise<Announcement[]> {
    try {
      const response = await apiClient.get('/instructor/announcements');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createAnnouncementAsInstructor(announcementData: CreateAnnouncementRequest): Promise<Announcement> {
    try {
      const response = await apiClient.post('/instructor/announcements', announcementData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}