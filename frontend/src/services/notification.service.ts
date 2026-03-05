/**
 * Notification Service for Afritec Bridge LMS
 *
 * Provides methods for fetching, managing, and polling user notifications.
 * Supports category filtering, batch operations, and preferences.
 */

import apiClient from '@/lib/api-client';

// ------------------------------------------------------------------
// Types
// ------------------------------------------------------------------

export type NotificationCategory =
  | 'announcements'
  | 'grades'
  | 'forum'
  | 'enrollment'
  | 'achievement'
  | 'ai'
  | 'system';

export type NotificationType =
  // Announcements
  | 'announcement_new'
  | 'announcement_updated'
  // Grading
  | 'grade_assignment'
  | 'grade_project'
  | 'grade_quiz'
  | 'grade_modification_requested'
  | 'grade_resubmission_received'
  | 'grade_full_credit'
  // Forum
  | 'forum_new_reply'
  | 'forum_post_liked'
  | 'forum_mention'
  | 'forum_post_flagged'
  | 'forum_new_thread'
  // Enrollment
  | 'enrollment_confirmed'
  | 'enrollment_application_status'
  // Achievement
  | 'achievement_unlocked'
  | 'streak_milestone'
  | 'badge_earned'
  // AI
  | 'ai_task_completed'
  | 'ai_task_failed'
  | 'content_saved'
  // System
  | 'system'
  | 'course_update'
  | 'module_released'
  | string;

export type NotificationPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface NotificationItem {
  id: number;
  user_id: number;
  notification_type: NotificationType;
  category?: NotificationCategory;
  priority?: NotificationPriority;
  title: string;
  message: string;
  is_read: boolean;
  task_id?: string;
  task_type?: string;
  course_id?: number;
  module_id?: number;
  lesson_id?: number;
  assignment_id?: number;
  project_id?: number;
  quiz_id?: number;
  submission_id?: number;
  forum_id?: number;
  post_id?: number;
  announcement_id?: number;
  achievement_id?: number;
  actor_id?: number;
  actor_name?: string;
  action_url?: string;
  metadata?: Record<string, any>;
  created_at: string;
  expires_at?: string;
}

export interface NotificationsResponse {
  success: boolean;
  data: NotificationItem[];
  unread_count: number;
  category_counts?: Record<NotificationCategory, number>;
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface UnreadCountResponse {
  success: boolean;
  unread_count: number;
  category_counts?: Record<NotificationCategory, number>;
}

export interface NotificationPreferences {
  user_id: number;
  category_settings: Record<string, boolean>;
  in_app_enabled: boolean;
  email_enabled: boolean;
  quiet_start_hour: number | null;
  quiet_end_hour: number | null;
}

// ------------------------------------------------------------------
// Service
// ------------------------------------------------------------------

class NotificationService {
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(count: number, categoryCounts?: Record<string, number>) => void> = new Set();

  /**
   * Fetch paginated notifications for the current user.
   */
  async getNotifications(params?: {
    page?: number;
    per_page?: number;
    unread_only?: boolean;
    type?: string;
    category?: NotificationCategory;
  }): Promise<NotificationsResponse> {
    const query = new URLSearchParams();
    if (params?.page) query.set('page', String(params.page));
    if (params?.per_page) query.set('per_page', String(params.per_page));
    if (params?.unread_only) query.set('unread_only', 'true');
    if (params?.type) query.set('type', params.type);
    if (params?.category) query.set('category', params.category);

    const resp = await apiClient.get(`/notifications?${query.toString()}`);
    return resp.data;
  }

  /**
   * Lightweight endpoint — total + per-category unread counts.
   */
  async getUnreadCount(): Promise<{ total: number; categoryCounts: Record<string, number> }> {
    try {
      const resp = await apiClient.get('/notifications/unread-count');
      return {
        total: resp.data?.unread_count ?? 0,
        categoryCounts: resp.data?.category_counts ?? {},
      };
    } catch {
      return { total: 0, categoryCounts: {} };
    }
  }

  /**
   * Mark a single notification as read.
   */
  async markAsRead(notificationId: number): Promise<void> {
    await apiClient.patch(`/notifications/${notificationId}/read`);
  }

  /**
   * Mark all notifications as read. Optionally scoped to a category.
   */
  async markAllAsRead(category?: NotificationCategory): Promise<void> {
    const query = category ? `?category=${category}` : '';
    await apiClient.patch(`/notifications/mark-all-read${query}`);
  }

  /**
   * Delete a notification.
   */
  async deleteNotification(notificationId: number): Promise<void> {
    await apiClient.delete(`/notifications/${notificationId}`);
  }

  /**
   * Delete multiple notifications by IDs.
   */
  async batchDelete(ids: number[]): Promise<{ deleted_count: number }> {
    const resp = await apiClient.post('/notifications/batch-delete', { ids });
    return resp.data;
  }

  /**
   * Delete all read notifications.
   */
  async clearAll(): Promise<{ deleted_count: number }> {
    const resp = await apiClient.delete('/notifications/clear-all');
    return resp.data;
  }

  // ----------------------------------------------------------------
  // Preferences
  // ----------------------------------------------------------------

  async getPreferences(): Promise<{ data: NotificationPreferences; available_categories: string[] }> {
    const resp = await apiClient.get('/notifications/preferences');
    return resp.data;
  }

  async updatePreferences(prefs: Partial<NotificationPreferences>): Promise<void> {
    await apiClient.put('/notifications/preferences', prefs);
  }

  // ----------------------------------------------------------------
  // Polling for real-time-ish unread count
  // ----------------------------------------------------------------

  /**
   * Subscribe to unread-count updates. Returns an unsubscribe function.
   */
  onUnreadCountChange(callback: (count: number, categoryCounts?: Record<string, number>) => void): () => void {
    this.listeners.add(callback);
    if (this.listeners.size === 1) {
      this._startPolling();
    }
    // Fire immediately with current count
    this.getUnreadCount().then(({ total, categoryCounts }) => callback(total, categoryCounts));

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
      const { total, categoryCounts } = await this.getUnreadCount();
      this.listeners.forEach((cb) => cb(total, categoryCounts));
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
