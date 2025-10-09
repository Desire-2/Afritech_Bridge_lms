import axios from 'axios';

// Create axios instance with default configuration
const apiClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1',
  timeout: 8000, // Reduced timeout to 8 seconds for faster refresh experience
  withCredentials: true, // Enable sending cookies and credentials with CORS requests
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
apiClient.interceptors.request.use(
  (config) => {
    // Get token from localStorage if available
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and token refresh
apiClient.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    const originalRequest = error.config;

    // Log errors for debugging
    if (error.response) {
      console.log('API Error:', {
        status: error.response.status,
        url: originalRequest.url,
        data: error.response.data
      });
    } else if (error.request) {
      console.error('Network Error: No response received', {
        url: originalRequest.url,
        baseURL: originalRequest.baseURL
      });
    }

    // Don't redirect for login/auth requests - let them handle their own errors
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Try to refresh token
        const refreshToken = localStorage.getItem('refreshToken');
        if (refreshToken) {
          const response = await axios.post(
            `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1'}/auth/refresh`,
            {},
            {
              headers: {
                Authorization: `Bearer ${refreshToken}`,
              },
              timeout: 3000, // 3 second timeout for refresh requests
              withCredentials: true, // Include credentials for refresh
            }
          );

          const { access_token } = response.data;
          localStorage.setItem('token', access_token);

          // Update the axios instance authorization header for future requests
          apiClient.defaults.headers.Authorization = `Bearer ${access_token}`;

          // Retry the original request
          originalRequest.headers.Authorization = `Bearer ${access_token}`;
          return apiClient(originalRequest);
        } else {
          // No refresh token available, emit custom event for auth context to handle
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('auth:token-expired'));
          }
          return Promise.reject(error);
        }
      } catch (refreshError) {
        // Refresh failed, emit custom event for auth context to handle logout
        console.warn('Token refresh failed');
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('auth:refresh-failed'));
        }
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

export default apiClient;