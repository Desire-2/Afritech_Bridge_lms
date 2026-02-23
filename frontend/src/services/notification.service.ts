/**
 * Notification Service for Afritec Bridge LMS
 *
 * Provides methods for fetching, managing, and polling user notifications.
 * Works with the backend /api/v1/notifications endpoints.
 */

import apiClient from '@/lib/api-client';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export interface NotificationItem {
  id: number;
  user_id: number;
  notification_type: 'ai_task_completed' | 'ai_task_failed' | 'content_saved' | 'system' | string;
  title: string;
  message: string;
  is_read: boolean;
  task_id?: string;
  task_type?: string;
  course_id?: number;
  module_id?: number;
  lesson_id?: number;
  metadata?: Record<string, any>;
  created_at: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: NotificationItem[];
  unread_count: number;
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UnreadCountResponse {
  success: boolean;
  unread_count: number;
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

class NotificationService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(count: number) => void> = new Set();

  /**
   * Fetch paginated notifications for the current user.
   */
  async getNotifications(params?: {
    page?: number;
    per_page?: number;
    unread_only?: boolean;
    type?: string;
  }): Promise<NotificationsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.unread_only) query.set('unread_only', 'true');
    if (params?.type) query.set('type', params.type);

    const resp = await apiClient.get(`/notifications?${query.toString()}`);
    return resp.data;
  }

  /**
   * Lightweight endpoint to get just the unread count (for the bell badge).
   */
  async getUnreadCount(): Promise<number> {
    try {
      const resp = await apiClient.get('/notifications/unread-count');
      return resp.data?.unread_count ?? 0;
    } catch {
      return 0;
    }
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: number): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read.
   */
  async markAllAsRead(): Promise<void> {
    await apiClient.patch('/notifications/mark-all-read');
  }

  /**
   * Delete a notification.
   */
  async deleteNotification(notificationId: number): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
  }

  // ----------------------------------------------------------------
  // Polling for real-time-ish unread count
  // ----------------------------------------------------------------

  /**
   * Subscribe to unread-count updates. Returns an unsubscribe function.
   * Automatically starts polling when the first listener is added
   * and stops when the last listener is removed.
   */
  onUnreadCountChange(callback: (count: number) => void): () => void {
    this.listeners.add(callback);
    if (this.listeners.size === 1) {
      this._startPolling();
    }
    // Fire immediately with current count
    this.getUnreadCount().then((c) => callback(c));

    return () => {
      this.listeners.delete(callback);
      if (this.listeners.size === 0) {
        this._stopPolling();
      }
    };
  }

  private _startPolling() {
    if (this.pollTimer) return;
    // Poll every 15 seconds
    this.pollTimer = setInterval(async () => {
      const count = await this.getUnreadCount();
      this.listeners.forEach((cb) => cb(count));
    }, 15_000);
  }

  private _stopPolling() {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
