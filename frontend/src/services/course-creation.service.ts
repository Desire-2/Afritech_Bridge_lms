import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import {
  Course,
  CreateCourseRequest,
  EnhancedModule,
  CreateEnhancedModuleRequest,
  EnhancedLesson,
  CreateEnhancedLessonRequest,
  Assignment,
  CreateAssignmentRequest,
  Project,
  CreateProjectRequest,
  Quiz,
  CreateQuizRequest,
  Question,
  QuizQuestionPayload,
  QuizAnswerPayload,
  ModuleOrderUpdate,
  LessonOrderUpdate,
} from '@/types/api';

export class CourseCreationService {
  private static readonly BASE_PATH = '/instructor/courses';
  private static readonly ASSESSMENT_PATH = '/instructor/assessments';

  // =====================
  // COURSE MANAGEMENT
  // =====================

  static async createCourse(courseData: CreateCourseRequest): Promise<Course> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}`, courseData);
      return response.data.course;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateCourse(courseId: number, courseData: Partial<CreateCourseRequest>): Promise<Course> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${courseId}`, courseData);
      return response.data.course;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCourseDetails(courseId: number): Promise<Course & {
    assignments: Assignment[];
    quizzes: Quiz[];
    projects: Project[];
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/${courseId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // MODULE MANAGEMENT
  // =====================

  static async createModule(courseId: number, moduleData: CreateEnhancedModuleRequest): Promise<EnhancedModule> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/${courseId}/modules`, moduleData);
      return response.data.module;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateModule(courseId: number, moduleId: number, moduleData: Partial<CreateEnhancedModuleRequest>): Promise<EnhancedModule> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${courseId}/modules/${moduleId}`, moduleData);
      return response.data.module;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteModule(courseId: number, moduleId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.BASE_PATH}/${courseId}/modules/${moduleId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async reorderModules(courseId: number, moduleOrders: ModuleOrderUpdate[]): Promise<void> {
    try {
      await apiClient.put(`${this.BASE_PATH}/${courseId}/modules/reorder`, {
        module_orders: moduleOrders
      });
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // LESSON MANAGEMENT
  // =====================

  static async createLesson(courseId: number, moduleId: number, lessonData: CreateEnhancedLessonRequest): Promise<EnhancedLesson> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/${courseId}/modules/${moduleId}/lessons`, lessonData);
      return response.data.lesson;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateLesson(courseId: number, moduleId: number, lessonId: number, lessonData: Partial<CreateEnhancedLessonRequest>): Promise<EnhancedLesson> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${courseId}/modules/${moduleId}/lessons/${lessonId}`, lessonData);
      return response.data.lesson;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteLesson(courseId: number, moduleId: number, lessonId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.BASE_PATH}/${courseId}/modules/${moduleId}/lessons/${lessonId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async reorderLessons(courseId: number, moduleId: number, lessonOrders: LessonOrderUpdate[]): Promise<void> {
    try {
      await apiClient.put(`${this.BASE_PATH}/${courseId}/modules/${moduleId}/lessons/reorder`, {
        lesson_orders: lessonOrders
      });
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // QUIZ MANAGEMENT
  // =====================

  static async createQuiz(quizData: CreateQuizRequest & { course_id: number }): Promise<Quiz> {
    try {
      console.log('[CourseCreationService] Creating quiz at:', `${this.ASSESSMENT_PATH}/quizzes`);
      console.log('[CourseCreationService] Quiz data BEFORE sending:', quizData);
      console.log('[CourseCreationService] Questions in data:', quizData.questions);
      console.log('[CourseCreationService] Questions count:', quizData.questions?.length || 0);
      console.log('[CourseCreationService] Stringified data:', JSON.stringify(quizData, null, 2));
      
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/quizzes`, quizData);
      
      console.log('[CourseCreationService] Quiz created response:', response.data);
      console.log('[CourseCreationService] Response has questions?:', !!response.data.quiz?.questions);
      console.log('[CourseCreationService] Response questions:', response.data.quiz?.questions);
      
      return response.data.quiz;
    } catch (error: any) {
      console.error('[CourseCreationService] Error creating quiz:', error);
      console.error('[CourseCreationService] Error response:', error?.response?.data);
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateQuiz(quizId: number, quizData: Partial<CreateQuizRequest>): Promise<Quiz> {
    try {
      console.log('[CourseCreationService] Updating quiz at:', `${this.ASSESSMENT_PATH}/quizzes/${quizId}`);
      console.log('[CourseCreationService] Update data:', quizData);
      const response = await apiClient.put(`${this.ASSESSMENT_PATH}/quizzes/${quizId}`, quizData);
      console.log('[CourseCreationService] Quiz updated response:', response.data);
      return response.data.quiz;
    } catch (error: any) {
      console.error('[CourseCreationService] Error updating quiz:', error);
      console.error('[CourseCreationService] Error response:', error?.response?.data);
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteQuiz(quizId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.ASSESSMENT_PATH}/quizzes/${quizId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async addQuizQuestion(quizId: number, questionData: QuizQuestionPayload): Promise<Question> {
    try {
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/quizzes/${quizId}/questions`, questionData);
      return response.data.question;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async addBulkQuizQuestions(quizId: number, questions: QuizQuestionPayload[]): Promise<Question[]> {
    try {
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/quizzes/${quizId}/questions/bulk`, { questions });
      return response.data.questions;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateQuizQuestion(quizId: number, questionId: number, questionData: QuizQuestionPayload): Promise<Question> {
    try {
      const response = await apiClient.put(`${this.ASSESSMENT_PATH}/quizzes/${quizId}/questions/${questionId}`, questionData);
      return response.data.question;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteQuizQuestion(quizId: number, questionId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.ASSESSMENT_PATH}/quizzes/${quizId}/questions/${questionId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async reorderQuizQuestions(quizId: number, questionIds: number[]): Promise<Question[]> {
    try {
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/quizzes/${quizId}/questions/reorder`, {
        order: questionIds
      });
      return response.data.questions;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // ASSIGNMENT MANAGEMENT
  // =====================

  static async createAssignment(assignmentData: CreateAssignmentRequest & { course_id: number }): Promise<Assignment> {
    try {
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/assignments`, assignmentData);
      return response.data.assignment;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateAssignment(assignmentId: number, assignmentData: Partial<CreateAssignmentRequest>): Promise<Assignment> {
    try {
      const response = await apiClient.put(`${this.ASSESSMENT_PATH}/assignments/${assignmentId}`, assignmentData);
      return response.data.assignment;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteAssignment(assignmentId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.ASSESSMENT_PATH}/assignments/${assignmentId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // PROJECT MANAGEMENT
  // =====================

  static async createProject(projectData: CreateProjectRequest): Promise<Project> {
    try {
      const response = await apiClient.post(`${this.ASSESSMENT_PATH}/projects`, projectData);
      return response.data.project;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateProject(projectId: number, projectData: Partial<CreateProjectRequest>): Promise<Project> {
    try {
      const response = await apiClient.put(`${this.ASSESSMENT_PATH}/projects/${projectId}`, projectData);
      return response.data.project;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteProject(projectId: number): Promise<void> {
    try {
      await apiClient.delete(`${this.ASSESSMENT_PATH}/projects/${projectId}`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // ASSESSMENT OVERVIEW
  // =====================

  static async getAssessmentsOverview(courseId: number): Promise<{
    quizzes: Quiz[];
    assignments: Assignment[];
    projects: Project[];
  }> {
    try {
      const response = await apiClient.get(`${this.ASSESSMENT_PATH}/courses/${courseId}/overview`);
      console.log('[CourseCreationService] API Response received:', response.data);
      console.log(`[CourseCreationService] Quizzes count: ${response.data.quizzes?.length}`);
      if (response.data.quizzes && response.data.quizzes.length > 0) {
        response.data.quizzes.forEach((quiz: Quiz, idx: number) => {
          console.log(`  └─ Quiz ${idx + 1} (ID: ${quiz.id}): "${quiz.title}" - ${quiz.questions?.length || 0} questions`);
          if (quiz.questions && quiz.questions.length > 0) {
            console.log(`     └─ First question: "${quiz.questions[0].question_text || quiz.questions[0].text}"`);
          }
        });
      }
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default CourseCreationService;