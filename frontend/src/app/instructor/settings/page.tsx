'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import instructorSettingsService from '@/services/instructor-settings.service';
import { AISettingItem, ProviderStats } from '@/services/instructor-settings.service';
import {
  Key,
  Globe,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  Zap,
  Wifi,
  WifiOff,
  Clock,
} from 'lucide-react';

type TabType = 'ai-keys';

const InstructorAISettingsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, AISettingItem>>({});
  const [formValues, setFormValues] = useState<Record<string, string>>({});
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [providerStats, setProviderStats] = useState<{
    openrouter: ProviderStats;
    gemini: ProviderStats;
    current_provider: string;
  } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const loadSettings = useCallback(async () => {
    try {
      setLoading(true);
      const response = await instructorSettingsService.getAISettings();

      if (response.success) {
        const { settings: settingsData, provider_stats } = response.data;
        setSettings(settingsData);
        setProviderStats(provider_stats);

        // Initialize form values from settings
        const values: Record<string, string> = {};
        Object.entries(settingsData).forEach(([key, item]) => {
          values[key] = item.value;
        });
        setFormValues(values);
        setHasChanges(false);
      }
    } catch (error: any) {
      toast.error('Failed to load AI settings: ' + error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Activate the user's personal AI provider context on page load
  // so their API keys and model names are loaded for the session.
  useEffect(() => {
    instructorSettingsService.activateAIContext().catch(() => {
      // Non-critical — activation is a best-effort warm-up
    });
  }, []);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  const handleValueChange = (key: string, value: string) => {
    setFormValues((prev) => ({
      ...prev,
      [key]: value,
    }));
    setHasChanges(true);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Only send changed API key values (skip masked unchanged ones)
      const settingsToSave: Record<string, any> = {};
      Object.entries(formValues).forEach(([key, value]) => {
        const original = settings[key]?.value || '';
        // If it's an API key field and hasn't changed from masked value, skip
        if (
          (key === 'openrouter_api_key' || key === 'gemini_api_key') &&
          value.includes('*') &&
          value === original
        ) {
          return;
        }
        // Convert boolean-like values
        if (key === 'ai_agent_enabled') {
          settingsToSave[key] = value === 'true' || value === true;
        } else if (key === 'ai_max_requests_per_day') {
          settingsToSave[key] = parseInt(value) || 100;
        } else {
          settingsToSave[key] = value;
        }
      });

      if (Object.keys(settingsToSave).length === 0) {
        toast.info('No changes to save');
        return;
      }

      const response = await instructorSettingsService.updateAISettings(
        settingsToSave
      );

      if (response.success) {
        toast.success(response.message || 'Settings saved successfully');
        setHasChanges(false);
        // Reload to get updated masked values and provider status
        await loadSettings();
      }
    } catch (error: any) {
      toast.error('Failed to save settings: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async (provider: 'openrouter' | 'gemini') => {
    try {
      setTesting(provider);
      const response = await instructorSettingsService.testAIConnection(provider);

      if (response.success) {
        toast.success(
          `${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} connection successful!`
        );
        // Reload provider stats
        await loadSettings();
      } else {
        toast.error(
          `${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} test failed: ${response.message}`
        );
      }
    } catch (error: any) {
      toast.error(
        `Connection test failed: ${error.message}`
      );
    } finally {
      setTesting(null);
    }
  };

  const toggleShowKey = (key: string) => {
    setShowKeys((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
        <span className="ml-3 text-slate-400">Loading AI settings...</span>
      </div>
    );
  }

  const apiKeySettings = ['openrouter_api_key', 'gemini_api_key'];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-sm">
          <Key className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            AI Provider Settings
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Configure API keys for AI content generation. Keys are stored securely
            and override .env configuration.
          </p>
        </div>
      </div>

      {/* Provider Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* OpenRouter Card */}
        <ProviderStatusCard
          name="OpenRouter"
          icon={<Globe className="w-5 h-5" />}
          stats={providerStats?.openrouter}
          isActive={providerStats?.current_provider === 'openrouter'}
          gradient="from-orange-500 to-red-500"
        />

        {/* Gemini Card */}
        <ProviderStatusCard
          name="Gemini"
          icon={<Zap className="w-5 h-5" />}
          stats={providerStats?.gemini}
          isActive={providerStats?.current_provider === 'gemini'}
          gradient="from-blue-500 to-cyan-500"
        />
      </div>

      {/* API Key Form */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/80">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Key className="w-4 h-4" />
            API Keys
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* OpenRouter API Key */}
          <ApiKeyField
            label="OpenRouter API Key"
            keyName="openrouter_api_key"
            value={formValues['openrouter_api_key'] || ''}
            onChange={(val) => handleValueChange('openrouter_api_key', val)}
            showKey={showKeys['openrouter_api_key'] || false}
            onToggleShow={() => toggleShowKey('openrouter_api_key')}
            hasValue={settings['openrouter_api_key']?.has_value || false}
            description="Used as the primary AI provider for content generation"
            provider="openrouter"
            testing={testing}
            onTestConnection={handleTestConnection}
          />

          {/* Gemini API Key */}
          <ApiKeyField
            label="Gemini API Key"
            keyName="gemini_api_key"
            value={formValues['gemini_api_key'] || ''}
            onChange={(val) => handleValueChange('gemini_api_key', val)}
            showKey={showKeys['gemini_api_key'] || false}
            onToggleShow={() => toggleShowKey('gemini_api_key')}
            hasValue={settings['gemini_api_key']?.has_value || false}
            description="Used as a fallback AI provider when OpenRouter is unavailable"
            provider="gemini"
            testing={testing}
            onTestConnection={handleTestConnection}
          />

          {/* OpenRouter Model Name */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-orange-500" />
              OpenRouter Model Name
              {settings['openrouter_model_name']?.has_value && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                  Set
                </span>
              )}
            </label>
            <input
              type="text"
              value={formValues['openrouter_model_name'] || ''}
              onChange={(e) => handleValueChange('openrouter_model_name', e.target.value)}
              placeholder="meta-llama/llama-3.3-70b-instruct:free"
              className="w-full max-w-md px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent transition"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              OpenRouter model identifier used for AI content generation
            </p>
          </div>

          {/* Gemini Model Name */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1.5 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              Gemini Model Name
              {settings['gemini_model_name']?.has_value && (
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
                  Set
                </span>
              )}
            </label>
            <input
              type="text"
              value={formValues['gemini_model_name'] || ''}
              onChange={(e) => handleValueChange('gemini_model_name', e.target.value)}
              placeholder="gemini-2.5-flash-preview-09-2025"
              className="w-full max-w-md px-3 py-2.5 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent transition"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Gemini model identifier used for AI content generation
            </p>
          </div>

          {/* AI Agent Enable/Disable */}
          <div className="pt-4 border-t border-slate-200 dark:border-slate-700">
            <label className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">
                  Enable AI Agent
                </span>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Allow AI-powered content generation features
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={formValues['ai_agent_enabled'] === 'true'}
                  onChange={(e) =>
                    handleValueChange('ai_agent_enabled', e.target.checked ? 'true' : 'false')
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-slate-600 peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-slate-500 peer-checked:bg-purple-600"></div>
              </label>
            </label>
          </div>

          {/* Max Requests Per Day */}
          <div>
            <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1.5">
              Max AI Requests Per Day (Per User)
            </label>
            <input
              type="number"
              min="1"
              max="10000"
              value={formValues['ai_max_requests_per_day'] || '100'}
              onChange={(e) =>
                handleValueChange('ai_max_requests_per_day', e.target.value)
              }
              className="w-full max-w-xs px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
            />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Limit daily AI requests per user to manage API costs
            </p>
          </div>
        </div>
      </div>

      {/* Save / Actions */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {hasChanges
            ? 'You have unsaved changes'
            : 'All settings are up to date'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={() => {
              setFormValues(
                Object.fromEntries(
                  Object.entries(settings).map(([k, v]) => [k, v.value])
                )
              );
              setHasChanges(false);
              toast.info('Changes reverted');
            }}
            disabled={!hasChanges || saving}
            className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            Reset
          </button>

          <button
            onClick={handleSave}
            disabled={!hasChanges || saving}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-medium text-white rounded-lg transition ${
              saving
                ? 'bg-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 shadow-sm'
            }`}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

// ===== Sub-components =====

interface ProviderStatusCardProps {
  name: string;
  icon: React.ReactNode;
  stats?: ProviderStats;
  isActive: boolean;
  gradient: string;
}

const ProviderStatusCard: React.FC<ProviderStatusCardProps> = ({
  name,
  icon,
  stats,
  isActive,
  gradient,
}) => {
  const isAvailable = stats?.available ?? false;
  const isCoolingDown = stats?.is_cooling_down ?? false;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-5 transition ${
        isActive
          ? 'border-purple-300 dark:border-purple-700 bg-purple-50/50 dark:bg-purple-900/10'
          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'
      }`}
    >
      {/* Gradient bar */}
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />

      <div className="flex items-start justify-between mt-1">
        <div className="flex items-center gap-3">
          <div
            className={`w-9 h-9 rounded-lg flex items-center justify-center bg-gradient-to-br ${gradient} shadow-sm`}
          >
            {icon}
          </div>
          <div>
            <h3 className="font-semibold text-slate-900 dark:text-white text-sm">{name}</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              {isAvailable ? (
                <>
                  <Wifi className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                    Configured
                  </span>
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 text-slate-400" />
                  <span className="text-xs text-slate-400">Not configured</span>
                </>
              )}
            </div>
          </div>
        </div>
        {isActive && (
          <span className="px-2 py-0.5 text-[10px] font-bold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full uppercase tracking-wider">
            Active
          </span>
        )}
      </div>

      {stats && (
        <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-slate-100 dark:border-slate-700">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              RPM Used
            </p>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">
              {stats.requests_this_minute}/{stats.rpm_limit}
            </p>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-slate-400">
              Status
            </p>
            <div className="flex items-center gap-1">
              {isCoolingDown ? (
                <>
                  <Clock className="w-3 h-3 text-amber-500" />
                  <span className="text-xs text-amber-600 dark:text-amber-400">Cooling down</span>
                </>
              ) : stats.failure_count > 0 ? (
                <>
                  <AlertCircle className="w-3 h-3 text-red-500" />
                  <span className="text-xs text-red-600 dark:text-red-400">
                    {stats.failure_count} failures
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                  <span className="text-xs text-emerald-600 dark:text-emerald-400">Healthy</span>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

interface ApiKeyFieldProps {
  label: string;
  keyName: string;
  value: string;
  onChange: (value: string) => void;
  showKey: boolean;
  onToggleShow: () => void;
  hasValue: boolean;
  description: string;
  provider: 'openrouter' | 'gemini';
  testing: string | null;
  onTestConnection: (provider: 'openrouter' | 'gemini') => void;
}

const ApiKeyField: React.FC<ApiKeyFieldProps> = ({
  label,
  keyName,
  value,
  onChange,
  showKey,
  onToggleShow,
  hasValue,
  description,
  provider,
  testing,
  onTestConnection,
}) => {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-900 dark:text-white mb-1.5">
        {label}
        {hasValue && (
          <span className="ml-2 text-[10px] text-emerald-600 dark:text-emerald-400 font-normal bg-emerald-50 dark:bg-emerald-900/20 px-1.5 py-0.5 rounded">
            Configured
          </span>
        )}
      </label>

      <div className="flex gap-2">
        <div className="relative flex-1">
          <input
            type={showKey ? 'text' : 'password'}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={`Enter your ${provider === 'openrouter' ? 'OpenRouter' : 'Gemini'} API key`}
            className="w-full px-3 py-2.5 pr-10 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
          />
          <button
            type="button"
            onClick={onToggleShow}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition"
          >
            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>

        <button
          onClick={() => onTestConnection(provider)}
          disabled={testing === provider}
          className={`flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-lg border transition ${
            testing === provider
              ? 'bg-slate-100 dark:bg-slate-700 text-slate-400 cursor-not-allowed'
              : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          {testing === provider ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          Test
        </button>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">{description}</p>
    </div>
  );
};

export default InstructorAISettingsPage;
