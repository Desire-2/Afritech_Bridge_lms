'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Bell, Check, CheckCheck, Trash2, Sparkles, AlertTriangle, X } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import notificationService, { NotificationItem } from '@/services/notification.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Notification bell with dropdown panel.
 * Shows unread count badge and a scrollable list of recent notifications.
 * Polls the backend every 15s for new notifications.
 */
export default function NotificationBell() {
  const { isAuthenticated } = useAuth();
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const prevCountRef = useRef(0);

  // Subscribe to unread count polling
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsub = notificationService.onUnreadCountChange((count) => {
      // Show a subtle animation when count increases
      if (count > prevCountRef.current && prevCountRef.current >= 0) {
        // Trigger CSS animation by toggling a class
        const bell = document.getElementById('notification-bell-icon');
        if (bell) {
          bell.classList.add('animate-bounce');
          setTimeout(() => bell.classList.remove('animate-bounce'), 1000);
        }
      }
      prevCountRef.current = count;
      setUnreadCount(count);
    });

    return unsub;
  }, [isAuthenticated]);

  // Fetch full notifications when panel opens
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const resp = await notificationService.getNotifications({
        page: 1,
        per_page: 20,
      });
      setNotifications(resp.data ?? []);
      setUnreadCount(resp.unread_count ?? 0);
    } catch {
      // Silently fail — user will see stale list
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Handle marking a single notification as read
  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  // Handle marking all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  // Handle deleting a notification
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // ignore
    }
  };

  // Navigate to the relevant page when clicking a notification
  const handleClick = async (notification: NotificationItem) => {
    // Mark as read
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // Navigate to course editor if we have a course_id
    if (notification.course_id) {
      setIsOpen(false);
      router.push(`/instructor/courses/${notification.course_id}/edit`);
    }
  };

  // Format relative time
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    const diffDay = Math.floor(diffHr / 24);
    return `${diffDay}d ago`;
  };

  // Get icon for notification type
  const getIcon = (type: string) => {
    switch (type) {
      case 'ai_task_completed':
        return <Sparkles className="w-4 h-4 text-green-500" />;
      case 'ai_task_failed':
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'content_saved':
        return <Check className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  if (!isAuthenticated) return null;

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          aria-label="Notifications"
        >
          <Bell id="notification-bell-icon" className="w-5 h-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-red-500 rounded-full leading-none">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        className="w-96 p-0"
        align="end"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Notifications
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-7 px-2"
                onClick={handleMarkAllRead}
              >
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-500">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors 
                    ${notification.is_read
                      ? 'bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800'
                      : 'bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50 dark:hover:bg-blue-950/30'
                    }`}
                  onClick={() => handleClick(notification)}
                >
                  {/* Icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getIcon(notification.notification_type)}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className={`text-sm leading-tight ${
                        notification.is_read
                          ? 'text-slate-700 dark:text-slate-300'
                          : 'text-slate-900 dark:text-white font-medium'
                      }`}>
                        {notification.title}
                      </p>
                      <span className="text-[10px] text-slate-400 whitespace-nowrap flex-shrink-0 mt-0.5">
                        {formatTime(notification.created_at)}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                      {notification.message}
                    </p>
                    {notification.task_type && (
                      <Badge
                        variant="secondary"
                        className="mt-1 text-[10px] px-1.5 py-0"
                      >
                        {notification.task_type.replace(/-/g, ' ')}
                      </Badge>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    {!notification.is_read && (
                      <button
                        onClick={(e) => handleMarkRead(notification.id, e)}
                        className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                        title="Mark as read"
                      >
                        <Check className="w-3 h-3 text-slate-400" />
                      </button>
                    )}
                    <button
                      onClick={(e) => handleDelete(notification.id, e)}
                      className="p-1 rounded hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3 text-slate-400 hover:text-red-500" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        {notifications.length > 0 && (
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2">
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center"
              onClick={() => {
                setIsOpen(false);
                router.push('/instructor/notifications');
              }}
            >
              View all notifications
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
