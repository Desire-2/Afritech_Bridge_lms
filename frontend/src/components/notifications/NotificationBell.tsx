'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Bell, Check, CheckCheck, Trash2, Sparkles, AlertTriangle,
  Megaphone, GraduationCap, MessageSquare, Trophy, BookOpen,
  Settings, RefreshCw, ExternalLink,
} from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import notificationService, {
  NotificationItem,
  NotificationCategory,
} from '@/services/notification.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// ── Category filter tabs ──
const CATEGORY_TABS: { key: NotificationCategory | 'all'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'announcements', label: 'Announcements' },
  { key: 'grades', label: 'Grades' },
  { key: 'forum', label: 'Forum' },
  { key: 'achievement', label: 'Achievements' },
  { key: 'system', label: 'System' },
];

/**
 * Role-aware icon for each notification type
 */
function getIcon(type: string) {
  if (type.startsWith('announcement')) return <Megaphone className="w-4 h-4 text-blue-500" />;
  if (type.startsWith('grade') || type.startsWith('grade_')) return <GraduationCap className="w-4 h-4 text-emerald-500" />;
  if (type.startsWith('forum')) return <MessageSquare className="w-4 h-4 text-violet-500" />;
  if (type.startsWith('achievement') || type.startsWith('badge') || type.startsWith('streak')) return <Trophy className="w-4 h-4 text-amber-500" />;
  if (type.startsWith('enrollment') || type.startsWith('module')) return <BookOpen className="w-4 h-4 text-indigo-500" />;
  if (type === 'ai_task_completed' || type === 'content_saved') return <Sparkles className="w-4 h-4 text-green-500" />;
  if (type === 'ai_task_failed') return <AlertTriangle className="w-4 h-4 text-red-500" />;
  return <Bell className="w-4 h-4 text-slate-500" />;
}

/**
 * Get priority-based border colour
 */
function priorityAccent(priority?: string) {
  switch (priority) {
    case 'urgent': return 'border-l-4 border-l-red-500';
    case 'high': return 'border-l-4 border-l-amber-400';
    default: return '';
  }
}

/**
 * Notification bell with dropdown panel.
 * Shows unread count badge and a scrollable list of recent notifications.
 * Supports category filtering and role-aware navigation.
 */
export default function NotificationBell() {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const prevCountRef = useRef(0);

  // Determine user role
  const userRole = (user as any)?.role?.name || (user as any)?.role || 'student';

  // Subscribe to unread count polling
  useEffect(() => {
    if (!isAuthenticated) return;

    const unsub = notificationService.onUnreadCountChange((count, catCounts) => {
      if (count > prevCountRef.current && prevCountRef.current >= 0) {
        const bell = document.getElementById('notification-bell-icon');
        if (bell) {
          bell.classList.add('animate-bounce');
          setTimeout(() => bell.classList.remove('animate-bounce'), 1000);
        }
      }
      prevCountRef.current = count;
      setUnreadCount(count);
      if (catCounts) setCategoryCounts(catCounts);
    });

    return unsub;
  }, [isAuthenticated]);

  // Fetch full notifications when panel opens or category changes
  const fetchNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const resp = await notificationService.getNotifications({
        page: 1,
        per_page: 30,
        category: activeCategory === 'all' ? undefined : activeCategory,
      });
      setNotifications(resp.data ?? []);
      setUnreadCount(resp.unread_count ?? 0);
      if (resp.category_counts) setCategoryCounts(resp.category_counts);
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, activeCategory]);

  useEffect(() => {
    if (isOpen) {
      fetchNotifications();
    }
  }, [isOpen, fetchNotifications]);

  // Mark single as read
  const handleMarkRead = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  // Mark all as read
  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead(activeCategory === 'all' ? undefined : activeCategory);
      if (activeCategory === 'all') {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      } else {
        setNotifications((prev) =>
          prev.map((n) =>
            n.category === activeCategory ? { ...n, is_read: true } : n
          )
        );
        fetchNotifications();
      }
    } catch { /* ignore */ }
  };

  // Delete notification
  const handleDelete = async (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await notificationService.deleteNotification(id);
      const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
    } catch { /* ignore */ }
  };

  // Navigate when clicking a notification
  const handleClick = async (notification: NotificationItem) => {
    if (!notification.is_read) {
      await notificationService.markAsRead(notification.id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    }

    // Use explicit action_url if available, otherwise build a contextual route
    const url = notification.action_url || buildFallbackUrl(notification, userRole);
    if (url) {
      setIsOpen(false);
      router.push(url);
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
      <PopoverContent className="w-[420px] p-0" align="end" sideOffset={8}>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h3 className="text-sm font-semibold text-slate-900 dark:text-white">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-xs font-normal text-slate-500">
                {unreadCount} unread
              </span>
            )}
          </h3>
          <div className="flex items-center gap-1">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-7 px-2" onClick={handleMarkAllRead}>
                <CheckCheck className="w-3.5 h-3.5 mr-1" />
                Mark all read
              </Button>
            )}
          </div>
        </div>

        {/* Category filter tabs */}
        <div className="flex gap-1 px-3 py-2 overflow-x-auto border-b border-slate-100 dark:border-slate-800">
          {CATEGORY_TABS.map((tab) => {
            const count = tab.key === 'all' ? undefined : categoryCounts[tab.key];
            return (
              <button
                key={tab.key}
                onClick={() => setActiveCategory(tab.key)}
                className={`flex-shrink-0 text-xs px-2.5 py-1 rounded-full transition-colors ${
                  activeCategory === tab.key
                    ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                    : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                {tab.label}
                {count && count > 0 && (
                  <span className="ml-1 text-[10px] bg-red-500 text-white rounded-full px-1.5 py-0.5 leading-none">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Notification list */}
        <ScrollArea className="max-h-[400px]">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-slate-500">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Loading...
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-sm text-slate-500">
              <Bell className="w-8 h-8 mb-2 opacity-30" />
              <p>No notifications{activeCategory !== 'all' ? ` in ${activeCategory}` : ''}</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors ${priorityAccent(notification.priority)} ${
                    notification.is_read
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
                    <div className="flex items-center gap-2 mt-1">
                      {notification.actor_name && (
                        <span className="text-[10px] text-slate-400">
                          by {notification.actor_name}
                        </span>
                      )}
                      {notification.category && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                          {notification.category}
                        </Badge>
                      )}
                      {notification.action_url && (
                        <ExternalLink className="w-3 h-3 text-slate-300" />
                      )}
                    </div>
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
          <div className="border-t border-slate-200 dark:border-slate-700 px-4 py-2 flex justify-between items-center">
            <button
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
              onClick={() => {
                setIsOpen(false);
                const basePath = userRole === 'instructor' ? '/instructor' : userRole === 'admin' ? '/admin' : '/student';
                router.push(`${basePath}/notifications`);
              }}
            >
              View all notifications
            </button>
            <button
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1"
              onClick={() => {
                setIsOpen(false);
                const basePath = userRole === 'instructor' ? '/instructor' : userRole === 'admin' ? '/admin' : '/student';
                router.push(`${basePath}/notifications?tab=settings`);
              }}
            >
              <Settings className="w-3 h-3" />
              Settings
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ── Helpers ──

function formatTime(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

function buildFallbackUrl(n: NotificationItem, role: string): string {
  const prefix = role === 'instructor' ? '/instructor' : role === 'admin' ? '/admin' : '/student';

  // Course-related
  if (n.course_id && n.notification_type.startsWith('announcement')) return `${prefix}/announcements`;
  if (n.course_id && n.notification_type.startsWith('grade')) return `${prefix === '/student' ? '/student/assessments' : '/instructor/grading'}`;
  if (n.notification_type.startsWith('forum')) return `${prefix}/forums`;
  if (n.notification_type.startsWith('achievement') || n.notification_type.startsWith('badge') || n.notification_type.startsWith('streak')) return `/student/achievements`;
  if (n.notification_type.startsWith('enrollment') || n.notification_type === 'module_released') return `${prefix}/courses${n.course_id ? `/${n.course_id}` : ''}`;
  if (n.course_id) return `${prefix}/courses/${n.course_id}/edit`;

  return `${prefix}/notifications`;
}
