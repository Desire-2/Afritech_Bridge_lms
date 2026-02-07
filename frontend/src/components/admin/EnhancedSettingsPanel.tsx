'use client';

import React, { useState, useEffect } from 'react';
import { AdminService } from '@/services/admin.service';
import AdminSidebar from './AdminSidebar';
import AdminBreadcrumb from './AdminBreadcrumb';
import { SettingsValidator, SettingsSecurityValidator, ValidationUtils } from '@/utils/settingsValidator';
import { toast } from 'sonner';
import { 
  Settings, 
  Mail, 
  Users, 
  Book, 
  Shield,
  Download,
  Upload,
  RotateCcw,
  Save,
  TestTube,
  AlertTriangle,
  CheckCircle,
  Info,
  Loader2,
  Eye,
  EyeOff,
  History
} from 'lucide-react';

interface SystemSettings {
  general: {
    site_name: string;
    site_url: string;
    support_email: string;
    maintenance_mode: boolean;
    maintenance_message: string;
    maintenance_start_time: string;
    maintenance_end_time: string;
    maintenance_show_countdown: boolean;
    analytics_enabled: boolean;
  };
  email: {
    smtp_host: string;
    smtp_port: number;
    from_email: string;
    from_name: string;
    enable_tls: boolean;
  };
  course: {
    max_students_per_course: number;
    min_quiz_duration: number;
    max_quiz_duration: number;
    require_certificate: boolean;
    enable_forum_moderation: boolean;
  };
  user: {
    enable_user_registration: boolean;
    require_email_verification: boolean;
    max_login_attempts: number;
    session_timeout: number;
    enable_oauth: boolean;
  };
  security: {
    password_min_length: number;
    password_require_uppercase: boolean;
    password_require_numbers: boolean;
    password_require_special: boolean;
    enable_two_factor: boolean;
  };
  ai: {
    ai_agent_enabled: boolean;
    ai_max_requests_per_day: number;
  };
}

interface SettingDetail {
  id: number;
  key: string;
  value: any;
  data_type: string;
  category: string;
  description: string;
  is_public: boolean;
  is_editable: boolean;
  requires_restart: boolean;
  default_value: any;
  created_at: string;
  updated_at: string;
}

interface AuditLog {
  id: number;
  setting_key: string;
  old_value: string;
  new_value: string;
  changed_by: number;
  changed_at: string;
  change_reason: string;
  ip_address?: string;
}

type TabType = 'general' | 'email' | 'course' | 'user' | 'security' | 'ai';

const EnhancedSettingsPanel: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    general: {
      site_name: '',
      site_url: '',
      support_email: '',
      maintenance_mode: false,
      maintenance_message: 'The system is currently undergoing maintenance. We apologize for any inconvenience. Please check back later.',
      maintenance_start_time: '',
      maintenance_end_time: '',
      maintenance_show_countdown: true,
      analytics_enabled: true,
    },
    email: {
      smtp_host: '',
      smtp_port: 587,
      from_email: '',
      from_name: '',
      enable_tls: true,
    },
    course: {
      max_students_per_course: 50,
      min_quiz_duration: 5,
      max_quiz_duration: 120,
      require_certificate: true,
      enable_forum_moderation: true,
    },
    user: {
      enable_user_registration: true,
      require_email_verification: true,
      max_login_attempts: 5,
      session_timeout: 30,
      enable_oauth: false,
    },
    security: {
      password_min_length: 8,
      password_require_uppercase: true,
      password_require_numbers: true,
      password_require_special: true,
      enable_two_factor: false,
    },
    ai: {
      ai_agent_enabled: true,
      ai_max_requests_per_day: 100,
    }
  });

  const [settingsDetails, setSettingsDetails] = useState<Record<string, SettingDetail>>({});
  const [activeTab, setActiveTab] = useState<TabType>('general');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingEmail, setTestingEmail] = useState(false);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [securityWarnings, setSecurityWarnings] = useState<string[]>([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [showAudit, setShowAudit] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [initialSettings, setInitialSettings] = useState<SystemSettings | null>(null);

  // Centralized input change handler for all settings
  const handleInputChange = (category: keyof SystemSettings, field: string, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [category]: { ...prev[category], [field]: value },
    }));
    setUnsavedChanges(true);

    // Real-time validation
    setTimeout(() => {
      const result = SettingsValidator.validateSetting(field, value);
      // You could trigger validation state updates here if needed
    }, 300);
  };

  // Load settings from backend
  useEffect(() => {
    loadSettings();
  }, []);

  // Track unsaved changes by comparing current settings with initial loaded settings
  useEffect(() => {
    if (initialSettings && initialized) {
      const hasChanges = JSON.stringify(settings) !== JSON.stringify(initialSettings);
      setUnsavedChanges(hasChanges);
    }
  }, [settings, initialSettings, initialized]);

  const breadcrumbs = [
    { label: 'Admin', href: '/admin' },
    { label: 'Settings', href: '/admin/settings', active: true },
  ];

  const loadSettings = async () => {
    try {
      setLoading(true);
      const response = await AdminService.getSystemSettings(undefined, true);
      
      if (response.success) {
        const { settings: backendSettings, details, recent_changes } = response.data;
        
        if (backendSettings) {
          const transformedSettings = transformBackendSettings(backendSettings);
          setSettings(transformedSettings);
          setInitialSettings(transformedSettings); // Store initial state for comparison
        }
        
        if (details) {
          setSettingsDetails(details);
        }
        
        if (recent_changes) {
          setAuditLogs(recent_changes);
        }
        
        setInitialized(true);
        setUnsavedChanges(false);
      }
    } catch (error: any) {
      console.error('Error loading settings:', error);
      
      // Try to initialize if settings don't exist
      if (error.message?.includes('not found') || error.status === 404) {
        await initializeDefaultSettings();
      } else {
        toast.error('Failed to load system settings: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const initializeDefaultSettings = async () => {
    try {
      const response = await AdminService.initializeSettings();
      if (response.success) {
        toast.success(response.message);
        await loadSettings(); // Reload after initialization
      }
    } catch (error: any) {
      toast.error('Failed to initialize settings: ' + error.message);
    }
  };

  const transformBackendSettings = (backendSettings: any): SystemSettings => {
    const transformed: SystemSettings = {
      general: {
        site_name: backendSettings.general?.site_name || '',
        site_url: backendSettings.general?.site_url || '',
        support_email: backendSettings.general?.support_email || '',
        maintenance_mode: backendSettings.general?.maintenance_mode || false,
        maintenance_message: backendSettings.general?.maintenance_message || 'The system is currently undergoing maintenance. We apologize for any inconvenience. Please check back later.',
        maintenance_start_time: backendSettings.general?.maintenance_start_time || '',
        maintenance_end_time: backendSettings.general?.maintenance_end_time || '',
        maintenance_show_countdown: backendSettings.general?.maintenance_show_countdown !== undefined ? backendSettings.general.maintenance_show_countdown : true,
        analytics_enabled: backendSettings.general?.analytics_enabled || true,
      },
      email: {
        smtp_host: backendSettings.email?.smtp_host || '',
        smtp_port: backendSettings.email?.smtp_port || 587,
        from_email: backendSettings.email?.from_email || '',
        from_name: backendSettings.email?.from_name || '',
        enable_tls: backendSettings.email?.enable_tls || true,
      },
      course: {
        max_students_per_course: backendSettings.course?.max_students_per_course || 50,
        min_quiz_duration: backendSettings.course?.min_quiz_duration || 5,
        max_quiz_duration: backendSettings.course?.max_quiz_duration || 120,
        require_certificate: backendSettings.course?.require_certificate || true,
        enable_forum_moderation: backendSettings.course?.enable_forum_moderation || true,
      },
      user: {
        enable_user_registration: backendSettings.user?.enable_user_registration || true,
        require_email_verification: backendSettings.user?.require_email_verification || true,
        max_login_attempts: backendSettings.user?.max_login_attempts || 5,
        session_timeout: backendSettings.user?.session_timeout || 30,
        enable_oauth: backendSettings.user?.enable_oauth || false,
      },
      security: {
        password_min_length: backendSettings.security?.password_min_length || 8,
        password_require_uppercase: backendSettings.security?.password_require_uppercase || true,
        password_require_numbers: backendSettings.security?.password_require_numbers || true,
        password_require_special: backendSettings.security?.password_require_special || true,
        enable_two_factor: backendSettings.security?.enable_two_factor || false,
      },
      ai: {
        ai_agent_enabled: backendSettings.ai?.ai_agent_enabled || true,
        ai_max_requests_per_day: backendSettings.ai?.ai_max_requests_per_day || 100,
      }
    };

    return transformed;
  };

  const transformSettingsForBackend = (settings: SystemSettings) => {
    const flattened: Record<string, any> = {};
    
    // Flatten nested structure for backend
    Object.entries(settings).forEach(([category, categorySettings]) => {
      Object.entries(categorySettings).forEach(([key, value]) => {
        flattened[key] = value;
      });
    });
    
    return flattened;
  };

  const handleSaveSettings = async () => {
    console.log('🚀 Save button clicked!', { saving, unsavedChanges, initialized });
    
    if (saving) {
      console.warn('⚠️ Save already in progress, ignoring click');
      return;
    }
    
    try {
      setSaving(true);
      setErrors({});
      setValidationErrors({});
      setSecurityWarnings([]);

      console.log('📋 Current settings:', settings);

      // Transform settings for validation
      const flattenedSettings = transformSettingsForBackend(settings);
      console.log('📋 Flattened settings for backend:', flattenedSettings);
      
      // Comprehensive validation using the validator
      const validationResult = ValidationUtils.validateSettingsWithMessages(flattenedSettings);
      
      if (!validationResult.isValid) {
        setValidationErrors(validationResult.errors);
        toast.error('Please fix validation errors before saving');
        setSaving(false); // Ensure we reset saving state
        return;
      }

      // Show security warnings if any
      if (validationResult.warnings.length > 0) {
        setSecurityWarnings(validationResult.warnings);
        // Allow saving but warn the user
        toast.warning(`Security warnings: ${validationResult.warnings.length} issues found`);
      }

      // Check for settings requiring admin confirmation
      const requiresConfirmation = Object.entries(flattenedSettings).some(([key, value]) => {
        const oldValue = settingsDetails[key]?.value;
        return SettingsSecurityValidator.requiresAdminConfirmation(key, oldValue, value);
      });

      if (requiresConfirmation) {
        const confirmed = window.confirm(
          'Some changes have significant security implications. Are you sure you want to proceed?'
        );
        if (!confirmed) {
          toast.info('Changes cancelled');
          setSaving(false); // Ensure we reset saving state
          return;
        }
      }

      console.log('🌐 About to call AdminService.updateSystemSettings...');
      
      // Add timeout wrapper
      const saveWithTimeout = new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
          reject(new Error('Save operation timed out after 30 seconds'));
        }, 30000);

        AdminService.updateSystemSettings(
          flattenedSettings,
          'Settings updated via admin panel'
        )
        .then((response) => {
          clearTimeout(timeoutId);
          resolve(response);
        })
        .catch((error) => {
          clearTimeout(timeoutId);
          reject(error);
        });
      });

      const response = await saveWithTimeout;
      
      console.log('✅ Save response:', response);
      
      if (response.success) {
        toast.success('Settings saved successfully!');
        setUnsavedChanges(false);
        setValidationErrors({});
        setSecurityWarnings([]);
        
        // Update initial settings to current state after successful save
        setInitialSettings({ ...settings });
        
        // Check if restart is required
        const requiresRestart = response.data?.requires_restart;
        if (requiresRestart) {
          toast.warning('Some changes require a system restart to take effect', {
            duration: 5000
          });
        }
        
        // Reload settings to get updated data
        await loadSettings();
      } else {
        throw new Error(response.message || 'Save failed');
      }
    } catch (error: any) {
      console.error('❌ Error saving settings:', error);
      
      // Handle specific error types
      if (error.message?.includes('timeout')) {
        toast.error('Save operation timed out. Please check your connection and try again.');
        setErrors({ general: 'Operation timed out' });
      } else if (error.details?.validation_errors) {
        setValidationErrors(error.details.validation_errors);
        toast.error('Validation failed: Please check the errors');
      } else if (error.response?.status === 401) {
        toast.error('Authentication failed. Please log in again.');
        setErrors({ general: 'Authentication failed' });
      } else if (error.response?.status === 403) {
        toast.error('Access denied. Admin privileges required.');
        setErrors({ general: 'Access denied' });
      } else {
        const errorMsg = error.message || error.response?.data?.message || 'Unknown error occurred';
        setErrors({ general: errorMsg });
        toast.error('Failed to save settings: ' + errorMsg);
      }
    } finally {
      console.log('🔄 Setting saving to false');
      setSaving(false);
    }
  };

  const handleTestEmail = async () => {
    try {
      setTestingEmail(true);
      const response = await AdminService.testEmailConfiguration();
      
      if (response.success || response.message) {
        toast.success(response.message || 'Test email sent successfully!');
      }
    } catch (error: any) {
      toast.error('Email test failed: ' + error.message);
    } finally {
      setTestingEmail(false);
    }
  };

  const handleExportSettings = async () => {
    try {
      const response = await AdminService.exportSettings();
      
      if (response.success) {
        // Create download link
        const blob = new Blob([JSON.stringify(response.data, null, 2)], {
          type: 'application/json'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lms-settings-export-${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Settings exported successfully');
      }
    } catch (error: any) {
      toast.error('Failed to export settings: ' + error.message);
    }
  };

  const handleResetSettings = async () => {
    if (!confirm('Are you sure you want to reset all settings to their default values? This action cannot be undone.')) {
      return;
    }
    
    try {
      const response = await AdminService.resetSettings(true);
      
      if (response.success) {
        toast.success(response.message);
        await loadSettings();
      }
    } catch (error: any) {
      toast.error('Failed to reset settings: ' + error.message);
    }
  };

  const loadAuditLogs = async () => {
    try {
      const response = await AdminService.getSettingAuditLogs({ page: 1, per_page: 20 });
      
      if (response.success) {
        setAuditLogs(response.data.logs);
      }
    } catch (error: any) {
      toast.error('Failed to load audit logs: ' + error.message);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-slate-900">
        <AdminSidebar />
        <main className="flex-1 ml-64">
          <div className="flex items-center justify-center h-64">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin text-blue-400" />
              <span className="text-slate-300">Loading system settings...</span>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!initialized) {
    return (
      <div className="flex min-h-screen bg-slate-900">
        <AdminSidebar />
        <main className="flex-1 ml-64">
          <div className="p-6">
            <div className="max-w-2xl mx-auto text-center">
              <AlertTriangle className="h-12 w-12 text-yellow-400 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2 text-white">System Settings Not Initialized</h2>
              <p className="text-slate-400 mb-6">
                System settings need to be initialized before you can configure them.
              </p>
              <button
                onClick={initializeDefaultSettings}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-500 transition"
              >
                Initialize Default Settings
              </button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const tabs = [
    { id: 'general', label: 'General', icon: Settings },
    { id: 'email', label: 'Email', icon: Mail },
    { id: 'course', label: 'Course', icon: Book },
    { id: 'user', label: 'User', icon: Users },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'ai', label: 'AI Agent', icon: TestTube },
  ];

  return (
    <div className="flex min-h-screen bg-slate-900">
      <AdminSidebar />
      <main className="flex-1 ml-64">
        {/* Header */}
        <div className="bg-slate-800 border-b border-slate-700 p-6">
          <AdminBreadcrumb items={breadcrumbs} />
          <div className="flex items-center justify-between mt-2">
            <div>
              <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                <Settings className="h-8 w-8 text-blue-400" />
                System Settings
              </h1>
              <p className="text-slate-300 mt-1">Configure system preferences and integrations</p>
            </div>
            
            <div className="flex items-center gap-3">
              {showAdvanced && (
                <button
                  onClick={() => setShowAudit(!showAudit)}
                  className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
                >
                  <History className="h-4 w-4" />
                  {showAudit ? 'Hide' : 'Show'} Audit Log
                </button>
              )}
              
              <button
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 px-3 py-2 text-sm bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition"
              >
                {showAdvanced ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </button>
              
              {showAdvanced && (
                <>
                  <button
                    onClick={handleExportSettings}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-green-600 hover:bg-green-500 text-white rounded-lg transition"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  
                  <button
                    onClick={handleResetSettings}
                    className="flex items-center gap-2 px-3 py-2 text-sm bg-red-600 hover:bg-red-500 text-white rounded-lg transition"
                  >
                    <RotateCcw className="h-4 w-4" />
                    Reset All
                  </button>
                </>
              )}
            </div>
          </div>
          
          {unsavedChanges && (
            <div className="mt-4 p-3 bg-yellow-900/20 border border-yellow-600 rounded-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-400" />
              <span className="text-yellow-300">You have unsaved changes</span>
            </div>
          )}

          {/* Security Warnings */}
          {securityWarnings.length > 0 && (
            <div className="mt-4 p-4 bg-orange-900/20 border border-orange-600 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Shield className="h-5 w-5 text-orange-400" />
                <h3 className="font-medium text-orange-300">Security Considerations</h3>
              </div>
              <ul className="text-sm text-orange-200 space-y-1">
                {securityWarnings.map((warning, index) => (
                  <li key={index} className="flex items-start gap-1">
                    <span className="text-orange-400 mt-0.5">•</span>
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Validation Errors Summary */}
          {Object.keys(validationErrors).length > 0 && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-600 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-5 w-5 text-red-400" />
                <h3 className="font-medium text-red-300">Validation Errors</h3>
              </div>
              <ul className="text-sm text-red-200 space-y-1">
                {Object.entries(validationErrors).map(([field, error]) => (
                  <li key={field} className="flex items-start gap-1">
                    <span className="text-red-400 mt-0.5">•</span>
                    <strong>{field}:</strong> {error}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div className="p-6 bg-slate-900">
          {/* Audit Log Panel */}
          {showAudit && showAdvanced && (
            <div className="mb-6 bg-slate-800 rounded-lg border border-slate-700 overflow-hidden">
              <div className="px-4 py-3 bg-slate-700 border-b border-slate-600">
                <h3 className="font-medium text-white">Recent Setting Changes</h3>
              </div>
              <div className="max-h-64 overflow-y-auto">
                {auditLogs.length > 0 ? (
                  <div className="divide-y divide-slate-600">
                    {auditLogs.map((log) => (
                      <div key={log.id} className="p-4 text-sm">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="font-medium text-white">{log.setting_key}</span>
                            <span className="text-slate-400 mx-2">→</span>
                            <span className="text-blue-400">{log.new_value}</span>
                          </div>
                          <div className="text-slate-400 text-xs">
                            {new Date(log.changed_at).toLocaleString()}
                          </div>
                        </div>
                        {log.change_reason && (
                          <div className="text-gray-600 mt-1">{log.change_reason}</div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 text-gray-500 text-center">No recent changes</div>
                )}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 border-b border-slate-600 mb-6 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`flex items-center gap-2 px-6 py-3 font-medium border-b-2 transition whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-blue-400 text-blue-400'
                    : 'border-transparent text-slate-400 hover:text-white'
                }`}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          <div className="bg-slate-800 rounded-lg border border-slate-700">
            {/* General Settings Tab */}
            {activeTab === 'general' && (
              <GeneralSettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                settingsDetails={settingsDetails}
              />
            )}

            {/* Email Settings Tab */}
            {activeTab === 'email' && (
              <EmailSettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                testingEmail={testingEmail}
                onTestEmail={handleTestEmail}
                settingsDetails={settingsDetails}
              />
            )}

            {/* Course Settings Tab */}
            {activeTab === 'course' && (
              <CourseSettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                settingsDetails={settingsDetails}
              />
            )}

            {/* User Settings Tab */}
            {activeTab === 'user' && (
              <UserSettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                settingsDetails={settingsDetails}
              />
            )}

            {/* Security Settings Tab */}
            {activeTab === 'security' && (
              <SecuritySettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                settingsDetails={settingsDetails}
              />
            )}

            {/* AI Settings Tab */}
            {activeTab === 'ai' && (
              <AISettingsTab
                settings={settings}
                handleInputChange={handleInputChange}
                errors={errors}
                validationErrors={validationErrors}
                settingsDetails={settingsDetails}
              />
            )}
          </div>

          {/* Save Button */}
          <div className="mt-6 flex justify-end gap-4">
            {/* API Test button */}
            <button
              onClick={async () => {
                try {
                  console.log('🧪 Testing API endpoint...');
                  const response = await fetch('/api/v1/admin/settings', {
                    method: 'GET',
                    headers: {
                      'Authorization': `Bearer ${localStorage.getItem('token')}`,
                      'Content-Type': 'application/json',
                    },
                  });
                  console.log('📡 Direct fetch response:', {
                    status: response.status,
                    statusText: response.statusText,
                    url: response.url
                  });
                  if (response.ok) {
                    const data = await response.json();
                    console.log('✅ API Test Success:', data);
                    alert('API Test Success! Check console for details.');
                  } else {
                    console.error('❌ API Test Failed:', response.status, response.statusText);
                    alert(`API Test Failed: ${response.status} ${response.statusText}`);
                  }
                } catch (error) {
                  console.error('❌ API Test Error:', error);
                  alert(`API Test Error: ${error}`);
                }
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg text-sm"
            >
              Test API
            </button>
            
            {/* Debug button for testing */}
            <button
              onClick={() => {
                console.log('🧪 Debug: Current state:', {
                  unsavedChanges,
                  saving,
                  initialized,
                  settingsCount: Object.keys(settings.general).length
                });
                alert(`Debug Info:\nUnsaved Changes: ${unsavedChanges}\nSaving: ${saving}\nInitialized: ${initialized}`);
              }}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-500 text-white rounded-lg text-sm"
            >
              Debug Info
            </button>
            
            <button
              onClick={handleSaveSettings}
              disabled={saving}
              className={`flex items-center gap-2 px-6 py-3 rounded-lg transition ${
                saving 
                  ? 'bg-gray-600 cursor-not-allowed' 
                  : unsavedChanges 
                    ? 'bg-blue-600 hover:bg-blue-500 text-white' 
                    : 'bg-green-600 hover:bg-green-500 text-white'
              }`}
              title={unsavedChanges ? 'Save changes' : 'No changes to save'}
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : unsavedChanges ? (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  Up to Date
                </>
              )}
            </button>
            
            {/* Emergency Cancel Save Button */}
            {saving && (
              <button
                onClick={() => {
                  console.log('🛑 Emergency stop saving...');
                  setSaving(false);
                  toast.info('Save operation cancelled');
                }}
                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm"
                title="Cancel the current save operation"
              >
                Cancel Save
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

// Individual tab components would be implemented here
// For brevity, I'll create a basic structure

const GeneralSettingsTab: React.FC<{
  settings: SystemSettings;
  handleInputChange: (category: keyof SystemSettings, field: string, value: any) => void;
  errors: Record<string, string>;
  validationErrors: Record<string, string>;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, handleInputChange, errors, validationErrors, settingsDetails }) => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-white mb-4">General Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-slate-300 font-medium mb-2">Site Name</label>
          <input
            type="text"
            value={settings.general.site_name}
            onChange={(e) => handleInputChange('general', 'site_name', e.target.value)}
            className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-700 text-white ${
              (errors['site_name'] || validationErrors['site_name']) ? 'border-red-400' : 'border-slate-600'
            }`}
            placeholder="Afritec Bridge LMS"
          />
          {(errors['site_name'] || validationErrors['site_name']) && (
            <p className="text-red-400 text-sm mt-1">{errors['site_name'] || validationErrors['site_name']}</p>
          )}
          {settingsDetails['site_name'] && (
            <p className="text-slate-400 text-sm mt-1">{settingsDetails['site_name'].description}</p>
          )}
        </div>

        <div>
          <label className="block text-slate-300 font-medium mb-2">Site URL</label>
          <input
            type="url"
            value={settings.general.site_url}
            onChange={(e) => handleInputChange('general', 'site_url', e.target.value)}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-700 text-white"
            placeholder="https://study.afritechbridge.online"
          />
          {errors['site_url'] && <p className="text-red-400 text-sm mt-1">{errors['site_url']}</p>}
        </div>

        <div>
          <label className="block text-slate-300 font-medium mb-2">Support Email</label>
          <input
            type="email"
            value={settings.general.support_email}
            onChange={(e) => handleInputChange('general', 'support_email', e.target.value)}
            className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-blue-400 focus:border-blue-400 bg-slate-700 text-white"
            placeholder="support@afritechbridge.online"
          />
          {errors['support_email'] && <p className="text-red-400 text-sm mt-1">{errors['support_email']}</p>}
        </div>

        <div className="pt-4 space-y-3 border-t border-slate-600">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-slate-300 font-medium">Maintenance Mode</label>
              <p className="text-sm text-slate-400">Enable maintenance mode to prevent user access</p>
            </div>
            <input
              type="checkbox"
              checked={settings.general.maintenance_mode}
              onChange={(e) => handleInputChange('general', 'maintenance_mode', e.target.checked)}
              className="w-4 h-4 text-blue-400 bg-slate-700 border-slate-600 rounded focus:ring-blue-400"
            />
          </div>

          {/* Maintenance Mode Details - Shows when maintenance is enabled */}
          {settings.general.maintenance_mode && (
            <div className="ml-4 space-y-4 pt-2 pl-4 border-l-2 border-yellow-500/50 bg-yellow-500/5 p-4 rounded-r-lg">
              <div>
                <label className="block text-slate-300 font-medium mb-2">
                  Maintenance Message
                  <span className="text-slate-400 text-sm font-normal ml-2">(Shown to users)</span>
                </label>
                <textarea
                  value={settings.general.maintenance_message}
                  onChange={(e) => handleInputChange('general', 'maintenance_message', e.target.value)}
                  className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-slate-700 text-white resize-none"
                  rows={3}
                  placeholder="The system is currently undergoing maintenance..."
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-300 font-medium mb-2">
                    Start Time
                    <span className="text-slate-400 text-sm font-normal ml-2">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={settings.general.maintenance_start_time}
                    onChange={(e) => handleInputChange('general', 'maintenance_start_time', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-slate-700 text-white"
                  />
                </div>

                <div>
                  <label className="block text-slate-300 font-medium mb-2">
                    Estimated End Time
                    <span className="text-slate-400 text-sm font-normal ml-2">(Optional)</span>
                  </label>
                  <input
                    type="datetime-local"
                    value={settings.general.maintenance_end_time}
                    onChange={(e) => handleInputChange('general', 'maintenance_end_time', e.target.value)}
                    className="w-full px-4 py-2 border border-slate-600 rounded-lg focus:ring-2 focus:ring-yellow-400 focus:border-yellow-400 bg-slate-700 text-white"
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <label className="text-slate-300 font-medium">Show Countdown Timer</label>
                  <p className="text-sm text-slate-400">Display countdown to estimated end time</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.general.maintenance_show_countdown}
                  onChange={(e) => handleInputChange('general', 'maintenance_show_countdown', e.target.checked)}
                  className="w-4 h-4 text-yellow-400 bg-slate-700 border-slate-600 rounded focus:ring-yellow-400"
                />
              </div>

              <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-3">
                <p className="text-yellow-200 text-sm flex items-start gap-2">
                  <svg className="w-5 h-5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                  <span><strong>Admin Bypass:</strong> As an admin, you can still access the system while maintenance mode is active. Regular users will be redirected to the maintenance page.</span>
                </p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <div>
              <label className="text-slate-300 font-medium">Analytics</label>
              <p className="text-sm text-slate-400">Enable analytics tracking and reporting</p>
            </div>
            <input
              type="checkbox"
              checked={settings.general.analytics_enabled}
              onChange={(e) => handleInputChange('general', 'analytics_enabled', e.target.checked)}
              className="w-4 h-4 text-blue-400 bg-slate-700 border-slate-600 rounded focus:ring-blue-400"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const EmailSettingsTab: React.FC<{
  settings: SystemSettings;
  handleInputChange: (category: keyof SystemSettings, field: string, value: any) => void;
  errors: Record<string, string>;
  validationErrors: Record<string, string>;
  testingEmail: boolean;
  onTestEmail: () => void;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, handleInputChange, errors, validationErrors, testingEmail, onTestEmail, settingsDetails }) => {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Email Configuration</h2>
        <button
          onClick={onTestEmail}
          disabled={testingEmail}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition"
        >
          {testingEmail ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Testing...
            </>
          ) : (
            <>
              <TestTube className="h-4 w-4" />
              Test Email
            </>
          )}
        </button>
      </div>
      
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-gray-700 font-medium mb-2">SMTP Host</label>
          <input
            type="text"
            value={settings.email.smtp_host}
            onChange={(e) => handleInputChange('email', 'smtp_host', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="smtp.mail.yahoo.com"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">SMTP Port</label>
          <input
            type="number"
            min="1"
            max="65535"
            value={settings.email.smtp_port}
            onChange={(e) => handleInputChange('email', 'smtp_port', parseInt(e.target.value) || 587)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors['smtp_port'] && <p className="text-red-600 text-sm mt-1">{errors['smtp_port']}</p>}
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">SMTP Username</label>
          <input
            type="text"
            value={settings.email.smtp_username}
            onChange={(e) => handleInputChange('email', 'smtp_username', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="your-email@mail.yahoo.com"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">SMTP Password</label>
          <input
            type="password"
            value={settings.email.smtp_password}
            onChange={(e) => handleInputChange('email', 'smtp_password', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="App password or SMTP password"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">From Email</label>
          <input
            type="email"
            value={settings.email.from_email}
            onChange={(e) => handleInputChange('email', 'from_email', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="noreply@afritechbridge.online"
          />
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">From Name</label>
          <input
            type="text"
            value={settings.email.from_name}
            onChange={(e) => handleInputChange('email', 'from_name', e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            placeholder="Afritec Bridge LMS"
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div>
            <label className="text-gray-700 font-medium">Enable TLS</label>
            <p className="text-sm text-gray-600">Use Transport Layer Security for secure email sending</p>
          </div>
          <input
            type="checkbox"
            checked={settings.email.enable_tls}
            onChange={(e) => handleInputChange('email', 'enable_tls', e.target.checked)}
            className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
          />
        </div>
      </div>
    </div>
  );
};

// Additional tab components would be implemented similarly
// For now, creating complete implementations

const CourseSettingsTab: React.FC<{
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  errors: Record<string, string>;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, setSettings, errors, settingsDetails }) => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Course Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Maximum Students Per Course</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={settings.course.max_students_per_course}
            onChange={(e) => handleInputChange('course', 'max_students_per_course', parseInt(e.target.value) || 50)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors['max_students_per_course'] && <p className="text-red-600 text-sm mt-1">{errors['max_students_per_course']}</p>}
          <p className="text-sm text-gray-600 mt-1">Default enrollment limit for new courses</p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Minimum Quiz Duration (minutes)</label>
          <input
            type="number"
            min="1"
            max="60"
            value={settings.course.min_quiz_duration}
            onChange={(e) => handleInputChange('course', 'min_quiz_duration', parseInt(e.target.value) || 5)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-600 mt-1">Shortest allowed quiz duration</p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Maximum Quiz Duration (minutes)</label>
          <input
            type="number"
            min="5"
            max="480"
            value={settings.course.max_quiz_duration}
            onChange={(e) => handleInputChange('course', 'max_quiz_duration', parseInt(e.target.value) || 120)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-600 mt-1">Longest allowed quiz duration</p>
        </div>

        <div className="pt-4 space-y-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Require Certificate for Course Completion</label>
              <p className="text-sm text-gray-600">Students must earn a certificate to complete courses</p>
            </div>
            <input
              type="checkbox"
              checked={settings.course.require_certificate}
              onChange={(e) => handleInputChange('course', 'require_certificate', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Enable Forum Moderation</label>
              <p className="text-sm text-gray-600">Moderate forum posts before they are published</p>
            </div>
            <input
              type="checkbox"
              checked={settings.course.enable_forum_moderation}
              onChange={(e) => handleInputChange('course', 'enable_forum_moderation', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const UserSettingsTab: React.FC<{
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  errors: Record<string, string>;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, setSettings, errors, settingsDetails }) => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">User Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Maximum Login Attempts</label>
          <input
            type="number"
            min="1"
            max="20"
            value={settings.user.max_login_attempts}
            onChange={(e) => handleInputChange('user', 'max_login_attempts', parseInt(e.target.value) || 5)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors['max_login_attempts'] && <p className="text-red-600 text-sm mt-1">{errors['max_login_attempts']}</p>}
          <p className="text-sm text-gray-600 mt-1">Number of failed login attempts before account lockout</p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Session Timeout (minutes)</label>
          <input
            type="number"
            min="5"
            max="1440"
            value={settings.user.session_timeout}
            onChange={(e) => handleInputChange('user', 'session_timeout', parseInt(e.target.value) || 30)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-600 mt-1">Automatic logout after inactivity</p>
        </div>

        <div className="pt-4 space-y-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Allow User Registration</label>
              <p className="text-sm text-gray-600">Allow new users to register accounts</p>
            </div>
            <input
              type="checkbox"
              checked={settings.user.enable_user_registration}
              onChange={(e) => handleInputChange('user', 'enable_user_registration', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Require Email Verification</label>
              <p className="text-sm text-gray-600">New users must verify their email address</p>
            </div>
            <input
              type="checkbox"
              checked={settings.user.require_email_verification}
              onChange={(e) => handleInputChange('user', 'require_email_verification', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Enable OAuth Login</label>
              <p className="text-sm text-gray-600">Allow social media and OAuth authentication</p>
            </div>
            <input
              type="checkbox"
              checked={settings.user.enable_oauth}
              onChange={(e) => handleInputChange('user', 'enable_oauth', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const SecuritySettingsTab: React.FC<{
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  errors: Record<string, string>;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, setSettings, errors, settingsDetails }) => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Security Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <div>
          <label className="block text-gray-700 font-medium mb-2">Minimum Password Length</label>
          <input
            type="number"
            min="4"
            max="64"
            value={settings.security.password_min_length}
            onChange={(e) => handleInputChange('security', 'password_min_length', parseInt(e.target.value) || 8)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          {errors['password_min_length'] && <p className="text-red-600 text-sm mt-1">{errors['password_min_length']}</p>}
          <p className="text-sm text-gray-600 mt-1">Minimum number of characters required for passwords</p>
        </div>

        <div className="pt-4 space-y-3 border-t border-gray-200">
          <h3 className="text-lg font-medium text-gray-800 mb-3">Password Requirements</h3>
          
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Require Uppercase Letters</label>
              <p className="text-sm text-gray-600">Passwords must contain at least one uppercase letter</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.password_require_uppercase}
              onChange={(e) => handleInputChange('security', 'password_require_uppercase', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Require Numbers</label>
              <p className="text-sm text-gray-600">Passwords must contain at least one number</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.password_require_numbers}
              onChange={(e) => handleInputChange('security', 'password_require_numbers', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Require Special Characters</label>
              <p className="text-sm text-gray-600">Passwords must contain at least one special character</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.password_require_special}
              onChange={(e) => handleInputChange('security', 'password_require_special', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-gray-200">
            <div>
              <label className="text-gray-700 font-medium">Enable Two-Factor Authentication</label>
              <p className="text-sm text-gray-600">Require 2FA for enhanced security (coming soon)</p>
            </div>
            <input
              type="checkbox"
              checked={settings.security.enable_two_factor}
              onChange={(e) => handleInputChange('security', 'enable_two_factor', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
              disabled
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const AISettingsTab: React.FC<{
  settings: SystemSettings;
  setSettings: React.Dispatch<React.SetStateAction<SystemSettings>>;
  errors: Record<string, string>;
  settingsDetails: Record<string, SettingDetail>;
}> = ({ settings, setSettings, errors, settingsDetails }) => {
  return (
    <div className="p-6">
      <h2 className="text-xl font-semibold text-gray-900 mb-4">AI Agent Settings</h2>
      <div className="space-y-4 max-w-2xl">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2">
            <Info className="h-5 w-5 text-blue-600" />
            <p className="text-blue-800 font-medium">AI-Powered Learning Assistant</p>
          </div>
          <p className="text-blue-700 text-sm mt-1">
            Configure the AI agent that helps students with questions, provides explanations, and offers personalized learning support.
          </p>
        </div>

        <div>
          <label className="block text-gray-700 font-medium mb-2">Maximum AI Requests Per Day (Per User)</label>
          <input
            type="number"
            min="1"
            max="1000"
            value={settings.ai.ai_max_requests_per_day}
            onChange={(e) => handleInputChange('ai', 'ai_max_requests_per_day', parseInt(e.target.value) || 100)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
          <p className="text-sm text-gray-600 mt-1">Limit daily AI requests to manage costs and prevent abuse</p>
        </div>

        <div className="pt-4 space-y-3 border-t border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-gray-700 font-medium">Enable AI Agent</label>
              <p className="text-sm text-gray-600">Allow students to interact with the AI learning assistant</p>
            </div>
            <input
              type="checkbox"
              checked={settings.ai.ai_agent_enabled}
              onChange={(e) => handleInputChange('ai', 'ai_agent_enabled', e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
            />
          </div>
        </div>

        {!settings.ai.ai_agent_enabled && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-yellow-800 font-medium">AI Agent Disabled</p>
            </div>
            <p className="text-yellow-700 text-sm mt-1">
              Students will not be able to access AI-powered learning assistance when this is disabled.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default EnhancedSettingsPanel;