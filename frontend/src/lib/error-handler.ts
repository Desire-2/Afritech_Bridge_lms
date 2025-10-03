import { AxiosError } from 'axios';
import { ApiError } from '@/types/api';

export class ApiErrorHandler {
  static handleError(error: unknown): ApiError {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      const details = error.response?.data;

      // Handle specific status codes
      switch (status) {
        case 400:
          return {
            message: message || 'Bad request. Please check your input.',
            status,
            details,
          };
        case 401:
          return {
            message: 'Unauthorized. Please log in again.',
            status,
            details,
          };
        case 403:
          return {
            message: 'Forbidden. You do not have permission to perform this action.',
            status,
            details,
          };
        case 404:
          return {
            message: 'Resource not found.',
            status,
            details,
          };
        case 409:
          return {
            message: message || 'Conflict. The resource already exists.',
            status,
            details,
          };
        case 422:
          return {
            message: 'Validation error. Please check your input.',
            status,
            details,
          };
        case 500:
          return {
            message: 'Internal server error. Please try again later.',
            status,
            details,
          };
        default:
          return {
            message: message || 'An unexpected error occurred.',
            status,
            details,
          };
      }
    }

    if (error instanceof Error) {
      return {
        message: error.message,
        details: error,
      };
    }

    return {
      message: 'An unknown error occurred.',
      details: error,
    };
  }

  static isNetworkError(error: unknown): boolean {
    return error instanceof AxiosError && !error.response;
  }

  static isAuthError(error: unknown): boolean {
    return error instanceof AxiosError && error.response?.status === 401;
  }

  static isValidationError(error: unknown): boolean {
    return error instanceof AxiosError && (
      error.response?.status === 400 || 
      error.response?.status === 422
    );
  }

  static getErrorMessage(error: unknown): string {
    return this.handleError(error).message;
  }
}

// Custom error classes for specific use cases
export class AuthenticationError extends Error {
  constructor(message: string = 'Authentication failed') {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class ValidationError extends Error {
  public details: any;

  constructor(message: string = 'Validation failed', details?: any) {
    super(message);
    this.name = 'ValidationError';
    this.details = details;
  }
}

export class NotFoundError extends Error {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}

export class PermissionError extends Error {
  constructor(message: string = 'You do not have permission to perform this action') {
    super(message);
    this.name = 'PermissionError';
  }
}