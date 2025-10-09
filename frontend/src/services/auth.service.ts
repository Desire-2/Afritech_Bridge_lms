import apiClient from '@/lib/api-client';
import { ApiErrorHandler } from '@/lib/error-handler';
import { AxiosError } from 'axios';
import {
  LoginRequest,
  RegisterRequest,
  AuthResponse,
  User,
  PasswordResetRequest,
  PasswordResetConfirm,
} from '@/types/api';

export class AuthService {
  private static readonly BASE_PATH = '/v1/auth';

  static async login(credentials: LoginRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/login`, credentials);
      return response.data;
    } catch (error) {
      const processedError = ApiErrorHandler.handleError(error);
      throw processedError;
    }
  }

  static async register(userData: RegisterRequest): Promise<AuthResponse> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/register`, userData);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async logout(): Promise<void> {
    try {
      await apiClient.post(`${this.BASE_PATH}/logout`);
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async refreshToken(): Promise<{ access_token: string }> {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (!refreshToken) {
        throw new Error('No refresh token available');
      }
      
      const response = await apiClient.post(`${this.BASE_PATH}/refresh`, {}, {
        headers: {
          Authorization: `Bearer ${refreshToken}`,
        },
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async requestPasswordReset(data: PasswordResetRequest): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/request-password-reset`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async confirmPasswordReset(data: PasswordResetConfirm): Promise<{ message: string }> {
    try {
      const response = await apiClient.post(`${this.BASE_PATH}/reset-password`, data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async getCurrentUser(): Promise<User> {
    try {
      const response = await apiClient.get('/v1/users/me');
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async updateProfile(data: Partial<User>): Promise<User> {
    try {
      const response = await apiClient.put('/v1/users/me', data);
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }

  static async changePassword(oldPassword: string, newPassword: string): Promise<{ message: string }> {
    try {
      const response = await apiClient.put('/v1/users/me/password', {
        old_password: oldPassword,
        new_password: newPassword,
      });
      return response.data;
    } catch (error) {
      throw ApiErrorHandler.handleError(error);
    }
  }
}