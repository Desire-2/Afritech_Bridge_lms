// API Error Handler - Centralized error handling for API requests

export interface ApiError {
  message: string;
  status?: number;
  code?: string;
  details?: any;
  timestamp: string;
}

export class ApiErrorHandler {
  /**
   * Handle and normalize API errors
   */
  static handleError(error: any): ApiError {
    const timestamp = new Date().toISOString();

    // Network error
    if (!error.response) {
      return {
        message: 'Network error - please check your connection',
        status: 0,
        code: 'NETWORK_ERROR',
        timestamp
      };
    }

    const { status, data } = error.response;

    // Server error with structured response
    if (data && typeof data === 'object') {
      return {
        message: data.error || data.message || 'An error occurred',
        status,
        code: data.code || `HTTP_${status}`,
        details: data.details || data.data,
        timestamp
      };
    }

    // Server error with string response
    if (typeof data === 'string') {
      return {
        message: data,
        status,
        code: `HTTP_${status}`,
        timestamp
      };
    }

    // Generic HTTP error
    return {
      message: ApiErrorHandler.getHttpErrorMessage(status),
      status,
      code: `HTTP_${status}`,
      timestamp
    };
  }

  /**
   * Get user-friendly error messages for HTTP status codes
   */
  private static getHttpErrorMessage(status: number): string {
    const messages: Record<number, string> = {
      400: 'Invalid request data',
      401: 'Authentication required - please log in',
      403: 'You do not have permission to access this resource',
      404: 'The requested resource was not found',
      409: 'Conflict - the resource already exists or has been modified',
      422: 'The provided data is invalid',
      429: 'Too many requests - please try again later',
      500: 'Internal server error - please try again',
      502: 'Server temporarily unavailable',
      503: 'Service temporarily unavailable',
      504: 'Request timeout - please try again'
    };

    return messages[status] || `An error occurred (${status})`;
  }

  /**
   * Check if error is a specific type
   */
  static isNetworkError(error: ApiError): boolean {
    return error.code === 'NETWORK_ERROR';
  }

  static isAuthError(error: ApiError): boolean {
    return error.status === 401 || error.status === 403;
  }

  static isValidationError(error: ApiError): boolean {
    return error.status === 400 || error.status === 422;
  }

  static isServerError(error: ApiError): boolean {
    return (error.status || 0) >= 500;
  }

  /**
   * Get user-friendly error message for display
   */
  static getDisplayMessage(error: ApiError): string {
    // For validation errors, show details if available
    if (this.isValidationError(error) && error.details) {
      if (typeof error.details === 'object') {
        const messages = Object.values(error.details).flat();
        if (messages.length > 0) {
          return messages.join(', ');
        }
      }
    }

    return error.message;
  }
}