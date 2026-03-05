'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Check, CheckCheck, Trash2, Sparkles, AlertTriangle,
  Megaphone, GraduationCap, MessageSquare, Trophy, BookOpen,
  Settings, RefreshCw, ChevronLeft, ChevronRight, Filter,
  ExternalLink, Trash, ToggleLeft, ToggleRight,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import notificationService, {
  NotificationItem,
  NotificationCategory,
  NotificationPreferences,
} from '@/services/notification.service';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

// ── Category config ──
const CATEGORIES: { key: NotificationCategory | 'all'; label: string; icon: React.ReactNode }[] = [
  { key: 'all', label: 'All', icon: <Bell className="w-4 h-4" /> },
  { key: 'announcements', label: 'Announcements', icon: <Megaphone className="w-4 h-4" /> },
  { key: 'grades', label: 'Grades', icon: <GraduationCap className="w-4 h-4" /> },
  { key: 'forum', label: 'Forum', icon: <MessageSquare className="w-4 h-4" /> },
  { key: 'enrollment', label: 'Enrollment', icon: <BookOpen className="w-4 h-4" /> },
  { key: 'achievement', label: 'Achievements', icon: <Trophy className="w-4 h-4" /> },
  { key: 'ai', label: 'AI Tasks', icon: <Sparkles className="w-4 h-4" /> },
  { key: 'system', label: 'System', icon: <Settings className="w-4 h-4" /> },
];

function getIcon(type: string) {
  if (type.startsWith('announcement')) return <Megaphone className="w-5 h-5 text-blue-500" />;
  if (type.startsWith('grade')) return <GraduationCap className="w-5 h-5 text-emerald-500" />;
  if (type.startsWith('forum')) return <MessageSquare className="w-5 h-5 text-violet-500" />;
  if (type.startsWith('achievement') || type.startsWith('badge') || type.startsWith('streak')) return <Trophy className="w-5 h-5 text-amber-500" />;
  if (type.startsWith('enrollment') || type === 'module_released') return <BookOpen className="w-5 h-5 text-indigo-500" />;
  if (type === 'ai_task_completed' || type === 'content_saved') return <Sparkles className="w-5 h-5 text-green-500" />;
  if (type === 'ai_task_failed') return <AlertTriangle className="w-5 h-5 text-red-500" />;
  return <Bell className="w-5 h-5 text-slate-500" />;
}

function priorityBadge(priority?: string) {
  switch (priority) {
    case 'urgent': return <Badge variant="destructive" className="text-[10px] px-1.5 py-0">urgent</Badge>;
    case 'high': return <Badge className="text-[10px] px-1.5 py-0 bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">high</Badge>;
    default: return null;
  }
}

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
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface NotificationCenterProps {
  basePath: string; // e.g. '/student', '/instructor', '/admin'
}

export default function NotificationCenter({ basePath }: NotificationCenterProps) {
  const { isAuthenticated, user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'settings' ? 'settings' : 'inbox';

  const [activeTab, setActiveTab] = useState<'inbox' | 'settings'>(initialTab);
  const [activeCategory, setActiveCategory] = useState<NotificationCategory | 'all'>('all');
  const [onlyUnread, setOnlyUnread] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [unreadCount, setUnreadCount] = useState(0);
  const [categoryCounts, setCategoryCounts] = useState<Record<string, number>>({});

  // Preferences state
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [availableCategories, setAvailableCategories] = useState<string[]>([]);

  // Fetch notifications
  const fetchList = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const resp = await notificationService.getNotifications({
        page,
        per_page: 20,
        unread_only: onlyUnread,
        category: activeCategory === 'all' ? undefined : activeCategory,
      });
      setNotifications(resp.data ?? []);
      setTotalPages(resp.pages ?? 1);
      setUnreadCount(resp.unread_count ?? 0);
      if (resp.category_counts) setCategoryCounts(resp.category_counts);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, page, onlyUnread, activeCategory]);

  useEffect(() => { fetchList(); }, [fetchList]);

  // Fetch preferences
  const fetchPrefs = useCallback(async () => {
    if (!isAuthenticated) return;
    setPrefsLoading(true);
    try {
      const resp = await notificationService.getPreferences();
      setPrefs(resp.data);
      setAvailableCategories(resp.available_categories ?? []);
    } catch { /* ignore */ }
    finally { setPrefsLoading(false); }
  }, [isAuthenticated]);

  useEffect(() => { if (activeTab === 'settings') fetchPrefs(); }, [activeTab, fetchPrefs]);

  // Handlers
  const markAsRead = async (id: number) => {
    await notificationService.markAsRead(id);
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await notificationService.markAllAsRead(activeCategory === 'all' ? undefined : activeCategory);
    fetchList();
  };

  const deleteNotification = async (id: number) => {
    const wasUnread = notifications.find((n) => n.id === id && !n.is_read);
    await notificationService.deleteNotification(id);
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (wasUnread) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const clearAll = async () => {
    await notificationService.clearAll();
    fetchList();
  };

  const handleClick = async (n: NotificationItem) => {
    if (!n.is_read) await markAsRead(n.id);
    const url = n.action_url || `${basePath}/notifications`;
    router.push(url);
  };

  const savePrefs = async (updates: Partial<NotificationPreferences>) => {
    const merged = { ...prefs, ...updates } as NotificationPreferences;
    setPrefs(merged);
    await notificationService.updatePreferences(updates);
  };

  if (!isAuthenticated) return null;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Notifications</h1>
          <p className="text-sm text-slate-500 mt-1">
            {unreadCount > 0 ? `${unreadCount} unread` : 'All caught up!'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={activeTab === 'inbox' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('inbox')}
          >
            <Bell className="w-4 h-4 mr-1" /> Inbox
          </Button>
          <Button
            variant={activeTab === 'settings' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setActiveTab('settings')}
          >
            <Settings className="w-4 h-4 mr-1" /> Settings
          </Button>
        </div>
      </div>

      {activeTab === 'inbox' ? (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* Sidebar categories */}
          <aside className="lg:w-56 flex-shrink-0">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {CATEGORIES.map((cat) => {
                const count = cat.key === 'all' ? unreadCount : (categoryCounts[cat.key] || 0);
                return (
                  <button
                    key={cat.key}
                    onClick={() => { setActiveCategory(cat.key); setPage(1); }}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-sm transition-colors border-b border-slate-100 dark:border-slate-800 last:border-0 ${
                      activeCategory === cat.key
                        ? 'bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 font-medium'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    {cat.icon}
                    <span className="flex-1 text-left">{cat.label}</span>
                    {count > 0 && (
                      <span className="text-[11px] bg-red-500 text-white rounded-full px-2 py-0.5 leading-none">
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Actions */}
            <div className="mt-4 space-y-2">
              <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={() => setOnlyUnread(!onlyUnread)}>
                <Filter className="w-3.5 h-3.5 mr-2" />
                {onlyUnread ? 'Show all' : 'Unread only'}
              </Button>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" className="w-full justify-start text-xs" onClick={markAllRead}>
                  <CheckCheck className="w-3.5 h-3.5 mr-2" />
                  Mark all read
                </Button>
              )}
              <Button variant="outline" size="sm" className="w-full justify-start text-xs text-red-500 hover:text-red-600" onClick={clearAll}>
                <Trash className="w-3.5 h-3.5 mr-2" />
                Clear read
              </Button>
            </div>
          </aside>

          {/* Main list */}
          <div className="flex-1">
            <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-16 text-slate-500">
                  <RefreshCw className="w-5 h-5 mr-2 animate-spin" /> Loading…
                </div>
              ) : notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Bell className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No notifications{onlyUnread ? ' (unread)' : ''}</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-slate-800">
                  {notifications.map((n) => (
                    <div
                      key={n.id}
                      className={`flex items-start gap-4 px-5 py-4 cursor-pointer transition-colors ${
                        n.priority === 'urgent' ? 'border-l-4 border-l-red-500' :
                        n.priority === 'high' ? 'border-l-4 border-l-amber-400' : ''
                      } ${
                        n.is_read
                          ? 'hover:bg-slate-50 dark:hover:bg-slate-800'
                          : 'bg-blue-50/40 dark:bg-blue-950/10 hover:bg-blue-50 dark:hover:bg-blue-950/20'
                      }`}
                      onClick={() => handleClick(n)}
                    >
                      <div className="flex-shrink-0 mt-1">{getIcon(n.notification_type)}</div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-3">
                          <h3 className={`text-sm leading-tight ${n.is_read ? 'text-slate-700 dark:text-slate-300' : 'text-slate-900 dark:text-white font-semibold'}`}>
                            {n.title}
                          </h3>
                          <span className="text-[11px] text-slate-400 whitespace-nowrap flex-shrink-0">
                            {formatTime(n.created_at)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 line-clamp-2">
                          {n.message}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          {n.actor_name && <span className="text-[11px] text-slate-400">by {n.actor_name}</span>}
                          {n.category && (
                            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                              {n.category}
                            </Badge>
                          )}
                          {priorityBadge(n.priority)}
                          {n.action_url && <ExternalLink className="w-3 h-3 text-slate-300" />}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 flex-shrink-0">
                        {!n.is_read && (
                          <button
                            onClick={(e) => { e.stopPropagation(); markAsRead(n.id); }}
                            className="p-1.5 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700"
                            title="Mark as read"
                          >
                            <Check className="w-3.5 h-3.5 text-slate-400" />
                          </button>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                          className="p-1.5 rounded-lg hover:bg-red-100 dark:hover:bg-red-900/30"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-slate-400 hover:text-red-500" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-slate-500">
                  Page {page} of {totalPages}
                </span>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ── Settings tab ── */
        <div className="bg-white dark:bg-slate-900 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-6 max-w-2xl">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">Notification Preferences</h2>

          {prefsLoading ? (
            <div className="flex items-center py-8 text-slate-500">
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> Loading…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Global toggles */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Delivery channels</h3>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">In-app notifications</p>
                    <p className="text-xs text-slate-500">Show notifications inside the platform</p>
                  </div>
                  <Switch
                    checked={prefs?.in_app_enabled ?? true}
                    onCheckedChange={(v) => savePrefs({ in_app_enabled: v })}
                  />
                </div>
                <div className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-slate-800 dark:text-slate-200">Email notifications</p>
                    <p className="text-xs text-slate-500">Receive email for important events</p>
                  </div>
                  <Switch
                    checked={prefs?.email_enabled ?? true}
                    onCheckedChange={(v) => savePrefs({ email_enabled: v })}
                  />
                </div>
              </div>

              {/* Per-category toggles */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Categories</h3>
                <p className="text-xs text-slate-500">Choose which categories to receive</p>
                {availableCategories.map((cat) => {
                  const catInfo = CATEGORIES.find((c) => c.key === cat);
                  const enabled = prefs?.category_settings?.[cat] ?? true;
                  return (
                    <div key={cat} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-800 last:border-0">
                      <div className="flex items-center gap-3">
                        {catInfo?.icon || <Bell className="w-4 h-4" />}
                        <span className="text-sm capitalize text-slate-700 dark:text-slate-300">{cat}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={(v) => {
                          const updated = { ...(prefs?.category_settings ?? {}), [cat]: v };
                          savePrefs({ category_settings: updated });
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
