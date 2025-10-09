import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import {
  QuizProgress,
  CreateQuizProgressRequest,
  UpdateQuizProgressRequest,
} from '@/types/api';

export class QuizProgressService {
  private static readonly BASE_PATH = '/v1/quiz-progress';

  static async getQuizProgress(quizId: number): Promise<QuizProgress | null> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}?quiz_id=${quizId}`);
      return response.data;
    } catch (error) {
      if (ApiErrorHandler.handleError(error).status === 404) {
        return null; // No progress found
      }
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async createQuizProgress(progressData: CreateQuizProgressRequest): Promise<QuizProgress> {
    try {
      const response = await apiClient.post(this.BASE_PATH, progressData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateQuizProgress(progressId: number, progressData: UpdateQuizProgressRequest): Promise<QuizProgress> {
    try {
      const response = await apiClient.put(`${this.BASE_PATH}/${progressId}`, progressData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async deleteQuizProgress(progressId: number): Promise<{ message: string }> {
    try {
      const response = await apiClient.delete(`${this.BASE_PATH}/${progressId}`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getUserQuizProgresses(): Promise<QuizProgress[]> {
    try {
      const response = await apiClient.get(`${this.BASE_PATH}/user`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async saveCurrentAnswer(progressId: number, questionId: number, answer: any): Promise<QuizProgress> {
    try {
      const response = await apiClient.patch(`${this.BASE_PATH}/${progressId}/answer`, {
        question_id: questionId,
        answer,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async completeQuiz(progressId: number): Promise<QuizProgress> {
    try {
      const response = await apiClient.patch(`${this.BASE_PATH}/${progressId}/complete`);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}