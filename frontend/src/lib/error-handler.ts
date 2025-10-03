import { AxiosError } from 'axios';
import { ApiError } from '@/types/api';

export class ApiErrorHandler {
  static handleError(error: unknown): ApiError {
    if (error instanceof AxiosError) {
      const status = error.response?.status;
      const message = error.response?.data?.message || error.message;
      const details = error.response?.data?.details || {};
      const errorType = error.response?.data?.error_type;

      // Handle specific status codes with enhanced login error handling
      switch (status) {
        case 400:
          return {
            message: message || 'Bad request. Please check your input.',
            status,
            error_type: errorType || 'validation_error',
            details,
          };
        case 401:
          // Enhanced handling for authentication errors
          if (errorType === 'authentication_error') {
            return {
              message,
              status,
              error_type: 'authentication_error',
              details,
            };
          }
          return {
            message: 'Unauthorized. Please log in again.',
            status,
            error_type: 'authentication_error',
            details,
          };
        case 403:
          return {
            message: 'Forbidden. You do not have permission to perform this action.',
            status,
            error_type: 'authorization_error',
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
            error_type: 'validation_error',
            details,
          };
        case 422:
          return {
            message: 'Validation error. Please check your input.',
            status,
            error_type: 'validation_error',
            details,
          };
        case 500:
          return {
            message: 'Internal server error. Please try again later.',
            status,
            error_type: 'server_error',
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
        details: { originalError: error },
      };
    }

    return {
      message: 'An unknown error occurred.',
      details: { originalError: error },
    };
  }

  /**
   * Get user-friendly error message for login-specific errors
   */
  static getLoginErrorMessage(error: ApiError): string {
    if (error.error_type === 'validation_error' && error.details) {
      if (error.details.identifier_missing && error.details.password_missing) {
        return 'Please enter your email/username and password.';
      }
      if (error.details.identifier_missing) {
        return 'Please enter your email or username.';
      }
      if (error.details.password_missing) {
        return 'Please enter your password.';
      }
      if (error.details.invalid_email_format) {
        return 'Please enter a valid email address.';
      }
    }
    
    if (error.error_type === 'authentication_error' && error.details) {
      if (error.details.user_not_found) {
        return 'No account found with this email or username. Please check your credentials or create a new account.';
      }
      if (error.details.invalid_password) {
        return 'Incorrect password. Please try again or reset your password.';
      }
    }
    
    return error.message || 'Login failed. Please try again.';
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