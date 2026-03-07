'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api/v1';

interface Preferences {
  email: string;
  email_notifications: boolean;
  marketing_emails: boolean;
  weekly_digest: boolean;
  email_enabled: boolean;
  category_settings: Record<string, boolean>;
  available_categories: string[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: string; desc: string }> = {
  announcements: { label: 'Course Announcements', icon: '📢', desc: 'Updates from instructors about your courses' },
  grades: { label: 'Grades & Feedback', icon: '📝', desc: 'Assignment, quiz, and project grading notifications' },
  forum: { label: 'Forum Activity', icon: '💬', desc: 'Replies, mentions, and likes on forum posts' },
  enrollment: { label: 'Enrollment & Payments', icon: '🎓', desc: 'Application status, payment confirmations' },
  achievement: { label: 'Achievements', icon: '🏆', desc: 'Badges, streaks, and milestone notifications' },
  system: { label: 'System & Maintenance', icon: '⚙️', desc: 'Platform updates and maintenance notices' },
};

export default function UnsubscribePage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const category = searchParams.get('category') || '';
  const manage = searchParams.get('manage') === 'true';

  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [showManage, setShowManage] = useState(manage);
  const [unsubscribed, setUnsubscribed] = useState(false);

  const fetchPrefs = useCallback(async () => {
    if (!token) {
      setError('Invalid or missing unsubscribe link.');
      setLoading(false);
      return;
    }
    try {
      const res = await fetch(`${API_URL}/email/unsubscribe/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token }),
      });
      if (!res.ok) {
        setError('This unsubscribe link is invalid or has expired.');
        setLoading(false);
        return;
      }
      const data = await res.json();
      setPrefs(data);
    } catch {
      setError('Unable to connect. Please try again later.');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const handleUnsubscribe = async (cat: string) => {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/email/unsubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, category: cat }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUnsubscribed(true);
        await fetchPrefs();
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Unable to connect. Please try again later.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleResubscribe = async (cat: string) => {
    setActionLoading(true);
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/email/resubscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, category: cat }),
      });
      const data = await res.json();
      if (res.ok) {
        setMessage(data.message);
        setUnsubscribed(false);
        await fetchPrefs();
      } else {
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setError('Unable to connect. Please try again later.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleToggleCategory = async (cat: string, enabled: boolean) => {
    if (enabled) {
      await handleResubscribe(cat);
    } else {
      await handleUnsubscribe(cat);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="animate-pulse text-gray-400 text-lg">Loading preferences...</div>
      </div>
    );
  }

  if (error && !prefs) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="text-5xl mb-4">⚠️</div>
          <h1 className="text-xl font-bold text-white mb-2">Invalid Link</h1>
          <p className="text-gray-400">{error}</p>
        </div>
      </div>
    );
  }

  // Quick unsubscribe view (one-click from email)
  if (!showManage && !unsubscribed && category) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="text-5xl mb-4">📧</div>
          <h1 className="text-2xl font-bold text-white mb-2">Unsubscribe</h1>
          <p className="text-gray-400 mb-2">
            Account: <span className="text-gray-300">{prefs?.email}</span>
          </p>
          <p className="text-gray-400 mb-6">
            You&apos;re about to unsubscribe from{' '}
            <span className="text-white font-medium">
              {CATEGORY_LABELS[category]?.label || category}
            </span>{' '}
            email notifications.
          </p>
          <button
            onClick={() => handleUnsubscribe(category)}
            disabled={actionLoading}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 mb-3"
          >
            {actionLoading ? 'Processing...' : 'Unsubscribe'}
          </button>
          <button
            onClick={() => setShowManage(true)}
            className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors"
          >
            Manage all email preferences instead →
          </button>
        </div>
      </div>
    );
  }

  // Unsubscribe confirmation
  if (unsubscribed && !showManage) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-gray-900 rounded-2xl p-8 text-center border border-gray-800">
          <div className="text-5xl mb-4">✅</div>
          <h1 className="text-2xl font-bold text-white mb-2">Unsubscribed</h1>
          <p className="text-green-400 mb-6">{message}</p>
          <p className="text-gray-400 text-sm mb-6">
            You can always re-enable notifications from your account settings.
          </p>
          <div className="space-y-3">
            <button
              onClick={() => handleResubscribe(category || 'all')}
              disabled={actionLoading}
              className="w-full bg-gray-800 hover:bg-gray-700 text-white font-medium py-3 px-6 rounded-xl transition-colors disabled:opacity-50"
            >
              {actionLoading ? 'Processing...' : 'Undo — Resubscribe'}
            </button>
            <button
              onClick={() => setShowManage(true)}
              className="w-full text-gray-400 hover:text-white text-sm py-2 transition-colors"
            >
              Manage all email preferences →
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Full preferences management page
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="max-w-lg w-full bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
        {/* Header */}
        <div className="bg-gray-800 p-6 text-center">
          <div className="text-4xl mb-2">🎓</div>
          <h1 className="text-xl font-bold text-white">Email Preferences</h1>
          <p className="text-gray-400 text-sm mt-1">
            Manage your notification settings for{' '}
            <span className="text-gray-300">{prefs?.email}</span>
          </p>
        </div>

        <div className="p-6">
          {message && (
            <div className="bg-green-900/30 border border-green-800 text-green-400 rounded-xl p-3 mb-4 text-sm text-center">
              {message}
            </div>
          )}
          {error && (
            <div className="bg-red-900/30 border border-red-800 text-red-400 rounded-xl p-3 mb-4 text-sm text-center">
              {error}
            </div>
          )}

          {/* Master toggle */}
          <div className="flex items-center justify-between bg-gray-800 rounded-xl p-4 mb-6">
            <div>
              <p className="text-white font-semibold">All Email Notifications</p>
              <p className="text-gray-400 text-xs mt-1">
                Master switch for all email notifications
              </p>
            </div>
            <button
              onClick={() =>
                prefs?.email_notifications
                  ? handleUnsubscribe('all')
                  : handleResubscribe('all')
              }
              disabled={actionLoading}
              className={`relative w-12 h-7 rounded-full transition-colors ${
                prefs?.email_notifications ? 'bg-violet-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform ${
                  prefs?.email_notifications ? 'left-[22px]' : 'left-0.5'
                }`}
              />
            </button>
          </div>

          {/* Category toggles */}
          <h2 className="text-white font-semibold text-sm mb-3 uppercase tracking-wider">
            Notification Categories
          </h2>
          <div className="space-y-2">
            {prefs?.available_categories.map((cat) => {
              const info = CATEGORY_LABELS[cat] || {
                label: cat,
                icon: '📌',
                desc: '',
              };
              const enabled = prefs.category_settings[cat] !== false;

              return (
                <div
                  key={cat}
                  className="flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 rounded-xl p-4 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{info.icon}</span>
                    <div>
                      <p className="text-white text-sm font-medium">{info.label}</p>
                      {info.desc && (
                        <p className="text-gray-500 text-xs mt-0.5">{info.desc}</p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => handleToggleCategory(cat, !enabled)}
                    disabled={actionLoading}
                    className={`relative w-10 h-6 rounded-full transition-colors ${
                      enabled ? 'bg-violet-600' : 'bg-gray-600'
                    }`}
                  >
                    <span
                      className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-transform ${
                        enabled ? 'left-[18px]' : 'left-0.5'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>

          {/* Footer note */}
          <div className="mt-6 pt-4 border-t border-gray-800">
            <p className="text-gray-500 text-xs text-center leading-relaxed">
              Important account emails (password resets, security alerts) will always be sent
              regardless of your preferences.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
