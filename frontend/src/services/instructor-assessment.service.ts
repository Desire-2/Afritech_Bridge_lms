import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { Quiz, Question, Assignment, CreateQuizRequest } from '@/types/api';

export interface CreateAssignmentRequest {
  title: string;
  description?: string;
  course_id: number;
  module_id?: number;
  lesson_id?: number;
  due_date?: string;
  points_possible?: number;
  assignment_type?: string;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  is_published?: boolean;
  allow_late_submission?: boolean;
  late_penalty?: number;
}

export interface CreateProjectRequest {
  title: string;
  description?: string;
  course_id: number;
  module_ids?: number[];
  due_date?: string;
  points_possible?: number;
  is_published?: boolean;
  submission_format?: string;
  max_file_size_mb?: number;
  allowed_file_types?: string;
  collaboration_allowed?: boolean;
  max_team_size?: number;
}

export interface AddQuestionRequest {
  text?: string;  // Preferred field name matching backend model
  question_text?: string;  // Alternative field name for compatibility
  question_type?: string;
  order?: number;
  answers: {
    text?: string;  // Preferred field name matching backend model
    answer_text?: string;  // Alternative field name for compatibility
    is_correct: boolean;
  }[];
}

export class InstructorAssessmentService {
  private static readonly BASE_PATH = '/instructor/assessments';

  // =====================
  // QUIZ MANAGEMENT
  // =====================

  /**
   * Get all quizzes for instructor's courses
   */
  static async getAllQuizzes(): Promise<Quiz[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/quizzes`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Create a new quiz for a course
   */
  static async createQuiz(quizData: CreateQuizRequest & { course_id: number }): Promise<Quiz> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/quizzes`, quizData);
      return response.data.quiz;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing quiz
   */
  static async updateQuiz(quizId: number, quizData: Partial<CreateQuizRequest>): Promise<Quiz> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/quizzes/${quizId}`, quizData);
      return response.data.quiz;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete a quiz
   */
  static async deleteQuiz(quizId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/quizzes/${quizId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Add a question to a quiz
   */
  static async addQuizQuestion(quizId: number, questionData: AddQuestionRequest): Promise<Question> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/quizzes/${quizId}/questions`,
        questionData
      );
      return response.data.question;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Add multiple questions to a quiz at once
   */
  static async addBulkQuizQuestions(quizId: number, questions: AddQuestionRequest[]): Promise<Question[]> {
    try {
      const response = await apiClient.post(
        `${this.BASE_PATH}/quizzes/${quizId}/questions/bulk`,
        { questions }
      );
      return response.data.questions;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // ASSIGNMENT MANAGEMENT
  // =====================

  /**
   * Create a new assignment for a course
   */
  static async createAssignment(assignmentData: CreateAssignmentRequest): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/assignments`, assignmentData);
      return response.data.assignment;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing assignment
   */
  static async updateAssignment(assignmentId: number, assignmentData: Partial<CreateAssignmentRequest>): Promise<any> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/assignments/${assignmentId}`, assignmentData);
      return response.data.assignment;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete an assignment
   */
  static async deleteAssignment(assignmentId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/assignments/${assignmentId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // PROJECT MANAGEMENT
  // =====================

  /**
   * Create a new project for a course
   */
  static async createProject(projectData: CreateProjectRequest): Promise<any> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/projects`, projectData);
      return response.data.project;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Update an existing project
   */
  static async updateProject(projectId: number, projectData: Partial<CreateProjectRequest>): Promise<any> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/projects/${projectId}`, projectData);
      return response.data.project;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  /**
   * Delete a project
   */
  static async deleteProject(projectId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/projects/${projectId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  // =====================
  // ASSESSMENT OVERVIEW
  // =====================

  /**
   * Get overview of all assessments for a course
   */
  static async getAssessmentsOverview(courseId: number): Promise<{
    quizzes: Quiz[];
    assignments: any[];
    projects: any[];
  }> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/courses/${courseId}/overview`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}

export default InstructorAssessmentService;
