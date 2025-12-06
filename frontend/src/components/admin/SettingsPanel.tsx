'use client';

import React, { useState, useEffect } from 'react';
import AdminSidebar from './AdminSidebar';
import AdminBreadcrumb from './AdminBreadcrumb';

interface SystemSettings {
  email: {
    smtpHost: string;
    smtpPort: number;
    fromEmail: string;
    fromName: string;
    enableTls: boolean;
  };
  course: {
    maxStudentsPerCourse: number;
    minQuizDuration: number;
    maxQuizDuration: number;
    requireCertificate: boolean;
    enableForumModeration: boolean;
  };
  user: {
    enableUserRegistration: boolean;
    requireEmailVerification: boolean;
    maxLoginAttempts: number;
    sessionTimeout: number;
    enableOAuth: boolean;
  };
  general: {
    siteName: string;
    siteUrl: string;
    supportEmail: string;
    maintenanceMode: boolean;
    analyticsEnabled: boolean;
  };
}

const SettingsPanel = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    email: {
      smtpHost: 'smtp.gmail.com',
      smtpPort: 587,
      fromEmail: 'noreply@afritec.com',
      fromName: 'Afritec Bridge LMS',
      enableTls: true,
    },
    course: {
      maxStudentsPerCourse: 50,
      minQuizDuration: 5,
      maxQuizDuration: 120,
      requireCertificate: true,
      enableForumModeration: true,
    },
    user: {
      enableUserRegistration: true,
      requireEmailVerification: true,
      maxLoginAttempts: 5,
      sessionTimeout: 30,
      enableOAuth: false,
    },
    general: {
      siteName: 'Afritec Bridge LMS',
      siteUrl: 'https://afritec.com',
      supportEmail: 'support@afritec.com',
      maintenanceMode: false,
      analyticsEnabled: true,
    },
  });

  const [activeTab, setActiveTab] = useState<'general' | 'email' | 'course' | 'user'>('general');
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: '/admin/settings', active: true },
  ];

  const handleSaveSettings = async () => {
    try {
      // Validate settings
      const newErrors: Record<string, string> = {};

      if (!settings.general.siteName.trim()) {
        newErrors['siteName'] = 'Site name is required';
      }
      if (!settings.general.siteUrl.trim()) {
        newErrors['siteUrl'] = 'Site URL is required';
      }
      if (!settings.email.fromEmail.includes('@')) {
        newErrors['fromEmail'] = 'Invalid email address';
      }

      if (Object.keys(newErrors).length > 0) {
        setErrors(newErrors);
        return;
      }

      setErrors({});
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 500));
      
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50">
      <AdminSidebar />
      <main className="flex-1 overflow-auto">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 p-6">
          <AdminBreadcrumb items={breadcrumbs} />
          <h1 className="text-3xl font-bold text-gray-900 mt-2">System Settings</h1>
          <p className="text-gray-600 mt-1">Configure system preferences and integrations</p>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Tabs */}
          <div className="flex gap-2 border-b border-gray-200 mb-6 overflow-x-auto">
            {[
              { id: 'general', label: 'General' },
              { id: 'email', label: 'Email Configuration' },
              { id: 'course', label: 'Course Settings' },
              { id: 'user', label: 'User Settings' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Success Message */}
          {saved && (
            <div className="mb-4 p-4 bg-green-100 text-green-800 rounded-lg flex items-center gap-2">
              <span>✓</span>
              <span>Settings saved successfully!</span>
            </div>
          )}

          {/* General Settings Tab */}
          {activeTab === 'general' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">General Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Site Name</label>
                  <input
                    type="text"
                    value={settings.general.siteName}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        general: { ...prev.general, siteName: e.target.value },
                      }))
                    }
                    className={`w-full px-4 py-2 border rounded-lg ${
                      errors['siteName'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors['siteName'] && <p className="text-red-600 text-sm mt-1">{errors['siteName']}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Site URL</label>
                  <input
                    type="url"
                    value={settings.general.siteUrl}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        general: { ...prev.general, siteUrl: e.target.value },
                      }))
                    }
                    className={`w-full px-4 py-2 border rounded-lg ${
                      errors['siteUrl'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors['siteUrl'] && <p className="text-red-600 text-sm mt-1">{errors['siteUrl']}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Support Email</label>
                  <input
                    type="email"
                    value={settings.general.supportEmail}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        general: { ...prev.general, supportEmail: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="pt-4 space-y-3 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <label className="text-gray-700 font-medium">Maintenance Mode</label>
                    <input
                      type="checkbox"
                      checked={settings.general.maintenanceMode}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          general: { ...prev.general, maintenanceMode: e.target.checked },
                        }))
                      }
                      className="w-4 h-4"
                    />
                  </div>
                  <p className="text-sm text-gray-600">Enable maintenance mode to prevent user access</p>
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-gray-700 font-medium">Analytics</label>
                  <input
                    type="checkbox"
                    checked={settings.general.analyticsEnabled}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        general: { ...prev.general, analyticsEnabled: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Email Settings Tab */}
          {activeTab === 'email' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Email Configuration</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">SMTP Host</label>
                  <input
                    type="text"
                    value={settings.email.smtpHost}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: { ...prev.email, smtpHost: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    placeholder="smtp.gmail.com"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">SMTP Port</label>
                  <input
                    type="number"
                    value={settings.email.smtpPort}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: { ...prev.email, smtpPort: parseInt(e.target.value) },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">From Email</label>
                  <input
                    type="email"
                    value={settings.email.fromEmail}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: { ...prev.email, fromEmail: e.target.value },
                      }))
                    }
                    className={`w-full px-4 py-2 border rounded-lg ${
                      errors['fromEmail'] ? 'border-red-500' : 'border-gray-300'
                    }`}
                  />
                  {errors['fromEmail'] && <p className="text-red-600 text-sm mt-1">{errors['fromEmail']}</p>}
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">From Name</label>
                  <input
                    type="text"
                    value={settings.email.fromName}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: { ...prev.email, fromName: e.target.value },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.email.enableTls}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        email: { ...prev.email, enableTls: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700">Enable TLS</label>
                </div>

                <button className="mt-4 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                  Test Email Configuration
                </button>
              </div>
            </div>
          )}

          {/* Course Settings Tab */}
          {activeTab === 'course' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Settings</h2>
              <div className="space-y-4">
                <div>
                  <label className="block text-gray-700 font-medium mb-2">Max Students Per Course</label>
                  <input
                    type="number"
                    value={settings.course.maxStudentsPerCourse}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        course: { ...prev.course, maxStudentsPerCourse: parseInt(e.target.value) },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-sm text-gray-600 mt-1">Set 0 for unlimited</p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Min Quiz Duration (min)</label>
                    <input
                      type="number"
                      value={settings.course.minQuizDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          course: { ...prev.course, minQuizDuration: parseInt(e.target.value) },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                  <div>
                    <label className="block text-gray-700 font-medium mb-2">Max Quiz Duration (min)</label>
                    <input
                      type="number"
                      value={settings.course.maxQuizDuration}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          course: { ...prev.course, maxQuizDuration: parseInt(e.target.value) },
                        }))
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.course.requireCertificate}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        course: { ...prev.course, requireCertificate: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700">Require Certificate for Course Completion</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.course.enableForumModeration}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        course: { ...prev.course, enableForumModeration: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700">Enable Forum Moderation</label>
                </div>
              </div>
            </div>
          )}

          {/* User Settings Tab */}
          {activeTab === 'user' && (
            <div className="bg-white rounded-lg p-6 border border-gray-200 max-w-2xl">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">User Settings</h2>
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.user.enableUserRegistration}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        user: { ...prev.user, enableUserRegistration: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700 font-medium">Allow User Registration</label>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.user.requireEmailVerification}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        user: { ...prev.user, requireEmailVerification: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700 font-medium">Require Email Verification</label>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Max Login Attempts</label>
                  <input
                    type="number"
                    value={settings.user.maxLoginAttempts}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        user: { ...prev.user, maxLoginAttempts: parseInt(e.target.value) },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-sm text-gray-600 mt-1">Before account lockout</p>
                </div>

                <div>
                  <label className="block text-gray-700 font-medium mb-2">Session Timeout (minutes)</label>
                  <input
                    type="number"
                    value={settings.user.sessionTimeout}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        user: { ...prev.user, sessionTimeout: parseInt(e.target.value) },
                      }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={settings.user.enableOAuth}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        user: { ...prev.user, enableOAuth: e.target.checked },
                      }))
                    }
                    className="w-4 h-4"
                  />
                  <label className="text-gray-700 font-medium">Enable OAuth Login</label>
                </div>
              </div>
            </div>
          )}

          {/* Save Button */}
          <div className="fixed bottom-6 right-6">
            <button
              onClick={handleSaveSettings}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 shadow-lg transition"
            >
              Save Settings
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default SettingsPanel;
