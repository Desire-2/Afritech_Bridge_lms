/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Axios-based API client for the AfriTech Bridge Intern Portal.
 * Matches the pattern used by the main frontend (frontend/src/services/api/base.service.ts):
 *  - axios with request/response interceptors
 *  - Auto‑unwraps { success: true, data: ... } → returns data directly
 *  - 401 interceptor with token refresh
 *  - Pre‑emptive refresh via jwt-decode
 */

import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { jwtDecode } from 'jwt-decode';
import {
  ApplicationStatus,
  DashboardData,
  TaskAssignment,
  GradesSummary,
  CohortData,
  OfferData,
  InternProfile,
  UserSession,
} from '../types';

// ---------------------------------------------------------------------------
// Backend URL configuration
// ---------------------------------------------------------------------------
const DEFAULT_BACKEND_URL = 'https://study.afritechbridge.online';

export function getBackendUrl(): string {
  return (import.meta as any).env.VITE_BACKEND_URL || DEFAULT_BACKEND_URL;
}

// ---------------------------------------------------------------------------
// Storage keys
// ---------------------------------------------------------------------------
const STORAGE_KEYS = {
  TOKEN: 'token',
  REFRESH_TOKEN: 'refreshToken',   // Matches main frontend naming
  USER: 'user',
} as const;

// ---------------------------------------------------------------------------
// Error handler — mirrors main frontend's ApiErrorHandler
// ---------------------------------------------------------------------------
export interface ApiError {
  message: string;
  status?: number;
  error_type?: string;
  details?: any;
}

export function extractApiError(err: unknown): ApiError {
  if (axios.isAxiosError(err)) {
    const axiosErr = err as AxiosError<{ message?: string; error?: string; error_type?: string; details?: any }>;
    const data = axiosErr.response?.data;
    const status = axiosErr.response?.status;
    const message = data?.message || data?.error || axiosErr.message;

    return {
      message,
      status,
      error_type: data?.error_type,
      details: data?.details,
    };
  }
  if (err instanceof Error) {
    return { message: err.message };
  }
  return { message: 'An unknown error occurred' };
}

/** User-friendly error message for login failures */
export function getLoginErrorMessage(error: ApiError): string {
  if (error.error_type === 'validation_error' && error.details) {
    const d = error.details;
    if (d.identifier_missing && d.password_missing) return 'Please enter your email/username and password.';
    if (d.identifier_missing) return 'Please enter your email or username.';
    if (d.password_missing) return 'Please enter your password.';
    if (d.invalid_email_format) return 'Please enter a valid email address.';
  }
  if (error.error_type === 'authentication_error' && error.details) {
    if (error.details.user_not_found) return 'No account found with this email or username. Please check your credentials.';
    if (error.details.invalid_password) return 'Incorrect password. Please try again or reset your password.';
  }
  // Network error (no response from server)
  if (!error.status && (!error.message || error.message === 'Network Error')) {
    return 'Cannot reach the server. Please check your internet connection and make sure the backend is running.';
  }
  if (error.status === 422) {
    return 'Invalid login data. Please check your input and try again.';
  }
  if (error.status === 429) {
    return 'Too many login attempts. Please wait a moment before trying again.';
  }
  return error.message || 'Login failed. Please try again.';
}

/** User-friendly error message for application status check failures */
export function getStatusCheckErrorMessage(error: ApiError, refCode?: string): string {
  // 404 = Application not found
  if (error.status === 404) {
    return refCode
      ? `No application found with reference code "${refCode}". Please double-check your reference code and email.`
      : 'No application found. Please double-check your reference code and email.';
  }
  // 400 = Missing required params
  if (error.status === 400) {
    return 'Please enter both your reference code and email address.';
  }
  // Network error (no response from server)
  if (!error.status && (!error.message || error.message === 'Network Error')) {
    return 'Cannot reach the server. Please check your internet connection and make sure the backend is running.';
  }
  // Fallback: use the backend message if available
  if (error.message && error.message !== 'Request failed with status code 404') {
    return error.message;
  }
  return 'Failed to check application status. Please try again later.';
}

// ---------------------------------------------------------------------------
// Session helpers
// ---------------------------------------------------------------------------
function getStoredToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.TOKEN);
}

function getStoredRefreshToken(): string | null {
  // Read new key first, then fall back to legacy snake_case key
  return localStorage.getItem(STORAGE_KEYS.REFRESH_TOKEN)
    || localStorage.getItem('refresh_token');
}

function clearSession(): void {
  localStorage.removeItem(STORAGE_KEYS.TOKEN);
  localStorage.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
  localStorage.removeItem('refresh_token');  // legacy compat
  localStorage.removeItem(STORAGE_KEYS.USER);
}

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------
interface JwtPayload {
  exp: number;
  sub: string;
  [key: string]: any;
}

export function isTokenExpired(token: string | null | undefined): boolean {
  if (!token) return true;
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return Date.now() >= decoded.exp * 1000;
  } catch {
    return true;
  }
}

/** Returns seconds until token expiry, or 0 if already expired */
function secondsUntilExpiry(token: string): number {
  try {
    const decoded = jwtDecode<JwtPayload>(token);
    return Math.max(0, decoded.exp - Date.now() / 1000);
  } catch {
    return 0;
  }
}

// ---------------------------------------------------------------------------
// Token refresh
// ---------------------------------------------------------------------------
let refreshPromise: Promise<boolean> | null = null;

export async function trySilentRefresh(): Promise<boolean> {
  const refreshToken = getStoredRefreshToken();
  if (!refreshToken) return false;
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const response = await fetch(`${getBackendUrl()}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${refreshToken}`,
        },
        body: JSON.stringify({}),
      });
      if (!response.ok) return false;
      const body = await response.json();
      if (body.access_token) {
        localStorage.setItem(STORAGE_KEYS.TOKEN, body.access_token);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

// ---------------------------------------------------------------------------
// Axios instance with interceptors
// ---------------------------------------------------------------------------
const apiClient: AxiosInstance = axios.create({
  baseURL: `${getBackendUrl()}/api/v1`,     // Matches main frontend: baseURL includes /api/v1
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Request interceptor: attach Bearer token ──
apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Response interceptor: auto-unwrap + 401 handling + error normalization ──
let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

apiClient.interceptors.response.use(
  (response) => {
    // Auto-unwrap { success: true, data: ... } → return data directly
    // (matches main frontend's base.service.ts)
    if (
      response.data &&
      typeof response.data === 'object' &&
      'success' in response.data &&
      response.data.success === true &&
      'data' in response.data
    ) {
      response.data = response.data.data;
    }
    return response;
  },
  async (error: AxiosError) => {
    const status = error.response?.status;
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // ── Handle 401 / 422 — attempt token refresh ──
    if ((status === 401 || status === 422) && originalRequest && !originalRequest._retry) {
      // If there's no stored token, the user isn't logged in.
      // Don't try to refresh — just reject so the caller can handle it.
      // This is critical for login/forgot-password endpoints where
      // 401 is expected (invalid credentials), NOT a stale session.
      if (!getStoredToken()) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        // Queue the request until the refresh completes
        return new Promise((resolve) => {
          pendingRequests.push((token: string) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            resolve(apiClient(originalRequest));
          });
        });
      }

      originalRequest._retry = true;
      isRefreshing = true;

      const refreshed = await trySilentRefresh();
      if (refreshed) {
        const newToken = getStoredToken()!;
        // Retry queued requests
        pendingRequests.forEach((cb) => cb(newToken));
        pendingRequests = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        isRefreshing = false;
        return apiClient(originalRequest);
      }

      // Refresh failed — clear & redirect
      pendingRequests = [];
      isRefreshing = false;
      clearSession();
      window.location.href = '/auth/login';
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

// ── Pre-emptive token refresh: refresh when < 5 minutes remain ──
export function scheduleTokenRefresh(): () => void {
  const token = getStoredToken();
  if (!token) return () => {};

  const secondsLeft = secondsUntilExpiry(token);
  const refreshAt = Math.max(10_000, (secondsLeft - 300) * 1000); // 5 min before expiry, min 10s

  if (refreshAt <= 0) {
    // Already expired or expiring very soon
    trySilentRefresh();
    return () => {};
  }

  const timer = setTimeout(() => {
    trySilentRefresh();
  }, refreshAt);

  return () => clearTimeout(timer);
}

// ---------------------------------------------------------------------------
// API namespace
// ---------------------------------------------------------------------------
export const api = {
  // ===================================================================
  // 1. PUBLIC — Track Application Status
  // ===================================================================
  async checkApplicationStatus(ref: string, email: string): Promise<ApplicationStatus> {
    const response = await apiClient.get<ApplicationStatus>(
      `/internships/apply/status?ref=${encodeURIComponent(ref)}&email=${encodeURIComponent(email)}`
    );
    // response.data is already unwrapped by interceptor → ApplicationStatus directly
    return response.data as ApplicationStatus;
  },

  // ===================================================================
  // 2. AUTH — Login
  // ===================================================================
  async login(email: string, password: string): Promise<UserSession> {
    const response = await apiClient.post('/auth/login', { identifier: email, password });

    // The interceptor may or may not unwrap this (no `success` field on auth routes)
    const data = response.data as any;

    const session: UserSession = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user: {
        id: String(data.user?.id ?? ''),
        full_name: data.user?.first_name
          ? `${data.user.first_name} ${data.user.last_name || ''}`.trim()
          : data.user?.username ?? '',
        email: data.user?.email ?? '',
        role: data.user?.role ?? '',
        must_change_password: data.user?.must_change_password ?? false,
      },
    };

    localStorage.setItem(STORAGE_KEYS.TOKEN, session.access_token);
    localStorage.setItem(STORAGE_KEYS.REFRESH_TOKEN, session.refresh_token || '');
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(session.user));

    return session;
  },

  // ===================================================================
  // 3. AUTH — Logout
  // ===================================================================
  logout(): void {
    clearSession();
  },

  // ===================================================================
  // 4. AUTH — Forgot Password
  // ===================================================================
  async forgotPassword(email: string): Promise<{ message: string; status?: string }> {
    const response = await apiClient.post('/auth/forgot-password', { email });
    return response.data as { message: string; status?: string };
  },

  // ===================================================================
  // 5. AUTH — Change Password (intern-specific)
  // ===================================================================
  async changePassword(
    currentPassword: string,
    newPassword: string,
    confirmPassword: string
  ): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.put('/internships/intern/change-password', {
      current_password: currentPassword,
      new_password: newPassword,
      confirm_password: confirmPassword,
    });
    // Unwrapped by interceptor if backend returns { success, data }
    return response.data as { success: boolean; message: string };
  },

  // ===================================================================
  // 6. INTERN — Dashboard
  // ===================================================================
  async getDashboard(): Promise<DashboardData> {
    const response = await apiClient.get('/internships/intern/dashboard');
    return response.data as DashboardData;
  },

  // ===================================================================
  // 7. INTERN — Tasks List
  // ===================================================================
  async getTasks(filters: {
    status?: string;
    task_type?: string;
    sort_by?: string;
    sort_order?: string;
  } = {}): Promise<TaskAssignment[]> {
    const q = new URLSearchParams();
    if (filters.status && filters.status !== 'all') q.append('status', filters.status);
    if (filters.task_type && filters.task_type !== 'all') q.append('task_type', filters.task_type);
    if (filters.sort_by) q.append('sort_by', filters.sort_by);
    if (filters.sort_order) q.append('sort_order', filters.sort_order);

    const response = await apiClient.get(`/internships/intern/tasks?${q.toString()}`);
    return response.data as TaskAssignment[];
  },

  // ===================================================================
  // 8. INTERN — Task Detail
  // ===================================================================
  async getTaskDetail(assignmentId: string): Promise<TaskAssignment> {
    const response = await apiClient.get(`/internships/intern/tasks/${assignmentId}`);
    return response.data as TaskAssignment;
  },

  // ===================================================================
  // 9. INTERN — Submit Task
  // ===================================================================
  async submitTask(
    assignmentId: string,
    payload: { submission_text: string; submission_file?: File }
  ): Promise<any> {
    if (payload.submission_file) {
      // Build FormData fresh each time (avoids ReadableStream-once issue on retry)
      const buildFormData = () => {
        const fd = new FormData();
        fd.append('submission_text', payload.submission_text);
        fd.append('submission_file', payload.submission_file!);
        return fd;
      };

      const doFetch = (token: string | null) =>
        fetch(
          `${getBackendUrl()}/api/v1/internships/intern/tasks/${assignmentId}/submit`,
          {
            method: 'POST',
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            body: buildFormData(),
          }
        );

      let response = await doFetch(getStoredToken());

      // 401 interceptor for file uploads
      if (response.status === 401) {
        const refreshed = await trySilentRefresh();
        if (refreshed) {
          response = await doFetch(getStoredToken());
        } else {
          clearSession();
          window.location.href = '/auth/login';
          throw new Error('Session expired. Please log in again.');
        }
      }

      if (!response.ok) {
        const errBody = await response.json().catch(() => ({}));
        throw new Error(errBody.message || `Request failed with status ${response.status}`);
      }
      return response.json();
    }

    const response = await apiClient.post(`/internships/intern/tasks/${assignmentId}/submit`, {
      submission_text: payload.submission_text,
    });
    return response.data;
  },

  // ===================================================================
  // 10. INTERN — Grades
  // ===================================================================
  async getGrades(): Promise<GradesSummary> {
    const response = await apiClient.get('/internships/intern/grades');
    return response.data as GradesSummary;
  },

  // ===================================================================
  // 11. INTERN — Cohort
  // ===================================================================
  async getCohort(): Promise<CohortData> {
    const response = await apiClient.get('/internships/intern/cohort');
    return response.data as CohortData;
  },

  // ===================================================================
  // 12. INTERN — Offer Letter
  // ===================================================================
  async getOffer(): Promise<OfferData> {
    const response = await apiClient.get('/internships/intern/offer');
    return response.data as OfferData;
  },

  // ===================================================================
  // 13. INTERN — Profile
  // ===================================================================
  async getProfile(): Promise<InternProfile> {
    const response = await apiClient.get('/internships/intern/profile');
    return response.data as InternProfile;
  },

  async updateProfile(payload: Partial<InternProfile>): Promise<InternProfile> {
    const response = await apiClient.put('/internships/intern/profile', payload);
    return response.data as InternProfile;
  },

  // ===================================================================
  // 14. AUTH — Silent Token Refresh
  // ===================================================================
  async trySilentRefresh(): Promise<boolean> {
    return trySilentRefresh();
  },
};
