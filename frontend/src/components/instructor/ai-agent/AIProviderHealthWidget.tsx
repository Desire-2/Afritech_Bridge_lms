"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Cpu,
  Globe,
  Activity,
  CheckCircle2,
  AlertTriangle,
  TimerReset,
  RefreshCw,
  Zap,
  Shield,
  AlertCircle,
  Loader2,
  ArrowUpDown,
  Clock,
  XCircle,
} from 'lucide-react';
import aiAgentService from '@/services/ai-agent.service';

interface ProviderInfo {
  configured: boolean;
  current: boolean;
  is_cooling_down: boolean;
  cooldown_remaining_seconds: number;
  requests_this_minute: number;
  rpm_limit: number;
  failure_count: number;
}

interface HealthResponse {
  status: string;
  api_configured: boolean;
  message: string;
  providers: {
    openrouter: ProviderInfo;
    gemini: ProviderInfo;
  };
  features?: Record<string, boolean>;
}

function formatTimeAgo(seconds: number): string {
  if (seconds <= 0) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const mins = Math.floor(seconds / 60);
  return `${mins}m ${seconds % 60}s ago`;
}

interface ProviderCardProps {
  name: string;
  info: ProviderInfo | undefined;
  isActive: boolean;
  waitRemaining: number;
}

const ProviderCard: React.FC<ProviderCardProps> = ({ name, info, isActive, waitRemaining }) => {
  if (!info) {
    return (
      <div className="p-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          Loading {name}...
        </div>
      </div>
    );
  }

  if (!info.configured) {
    return (
      <div className="p-4 border border-dashed border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50/50 dark:bg-slate-800/30">
        <div className="flex items-center gap-2 text-sm text-slate-400 mb-2">
          <Cpu className="w-4 h-4" />
          <span className="font-medium capitalize">{name}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <XCircle className="w-3 h-3" />
          Not configured
        </div>
      </div>
    );
  }

  const rpmPercent = info.rpm_limit > 0 ? (info.requests_this_minute / info.rpm_limit) * 100 : 0;
  const rpmColor = rpmPercent >= 90 ? 'bg-red-500' : rpmPercent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const rpmBgColor = rpmPercent >= 90 ? 'bg-red-100 dark:bg-red-950/40' : rpmPercent >= 70 ? 'bg-amber-100 dark:bg-amber-950/40' : 'bg-emerald-100 dark:bg-emerald-950/40';

  return (
    <div className={`p-4 rounded-xl border transition-all ${
      isActive
        ? 'border-purple-300 dark:border-purple-600 bg-gradient-to-br from-purple-50/80 to-indigo-50/50 dark:from-purple-950/20 dark:to-indigo-950/10 ring-1 ring-purple-200 dark:ring-purple-800'
        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900/50'
    }`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
            isActive
              ? 'bg-gradient-to-br from-purple-500 to-indigo-600 text-white'
              : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400'
          }`}>
            <Cpu className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="text-sm font-semibold capitalize">{name}</span>
            {isActive && (
              <span className="ml-2 inline-flex items-center gap-1 px-1.5 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-full text-[10px] font-medium">
                <Zap className="w-2.5 h-2.5" />
                primary
              </span>
            )}
          </div>
        </div>
        <Badge variant={info.is_cooling_down ? 'destructive' : isActive ? 'default' : 'secondary'} className="text-[10px] px-2 py-0">
          {info.is_cooling_down ? 'cooling' : isActive ? 'active' : 'standby'}
        </Badge>
      </div>

      {/* RPM Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-slate-500 dark:text-slate-400">RPM</span>
          <span className={`font-mono font-medium ${
            rpmPercent >= 90 ? 'text-red-600 dark:text-red-400' :
            rpmPercent >= 70 ? 'text-amber-600 dark:text-amber-400' :
            'text-emerald-600 dark:text-emerald-400'
          }`}>
            {info.requests_this_minute} / {info.rpm_limit}
          </span>
        </div>
        <div className={`h-2 ${rpmBgColor} rounded-full overflow-hidden`}>
          <div
            className={`h-full ${rpmColor} rounded-full transition-all duration-700 ease-out`}
            style={{ width: `${Math.min(100, rpmPercent)}%` }}
          />
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <Activity className="w-3 h-3" />
          <span>Failures:</span>
          <span className={`font-medium ${
            info.failure_count > 3 ? 'text-red-600 dark:text-red-400' :
            info.failure_count > 0 ? 'text-amber-600 dark:text-amber-400' :
            'text-slate-700 dark:text-slate-300'
          }`}>
            {info.failure_count}
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
          <TimerReset className="w-3 h-3" />
          <span>Cooldown:</span>
          <span className="font-medium text-slate-700 dark:text-slate-300">
            {info.is_cooling_down ? `${info.cooldown_remaining_seconds}s` : '—'}
          </span>
        </div>
      </div>

      {/* Live countdown when cooling down */}
      {info.is_cooling_down && waitRemaining > 0 && (
        <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-200 dark:border-amber-800/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
              <TimerReset className="w-3 h-3" />
              <span>Rate limit cooldown</span>
            </div>
            <span className="text-lg font-bold text-amber-800 dark:text-amber-300 tabular-nums">
              {Math.floor(waitRemaining / 60)}:{String(waitRemaining % 60).padStart(2, '0')}
            </span>
          </div>
          <div className="mt-1.5 h-1 bg-amber-200 dark:bg-amber-800/40 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-1000 ease-linear"
              style={{ width: info.cooldown_remaining_seconds > 0 ? `${(waitRemaining / info.cooldown_remaining_seconds) * 100}%` : '0%' }}
            />
          </div>
        </div>
      )}
    </div>
  );
};

interface AIProviderHealthWidgetProps {
  onRefresh?: () => void;
  autoRefreshInterval?: number; // in seconds, default 10
  /** If provided, uses external health data instead of polling */
  externalHealth?: HealthResponse | null;
}

export const AIProviderHealthWidget: React.FC<AIProviderHealthWidgetProps> = ({
  onRefresh,
  autoRefreshInterval = 10,
  externalHealth,
}) => {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownRemaining, setCooldownRemaining] = useState<{ [key: string]: number }>({});
  const [lastRefreshAt, setLastRefreshAt] = useState<Date>(new Date());

  const fetchHealth = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) setRefreshing(true);
    try {
      const health = await aiAgentService.healthCheck();
      setHealthData(health as HealthResponse);
      setLastRefreshAt(new Date());

      // Initialize cooldown timers
      if (health.providers) {
        const timers: { [key: string]: number } = {};
        for (const [name, info] of Object.entries(health.providers)) {
          const p = info as ProviderInfo;
          if (p.is_cooling_down && p.cooldown_remaining_seconds > 0) {
            timers[name] = p.cooldown_remaining_seconds;
          }
        }
        if (Object.keys(timers).length > 0) {
          setCooldownRemaining(timers);
        }
      }

      onRefresh?.();
    } catch (error) {
      console.error('Health fetch failed:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [onRefresh]);

  // Initial load (skip if externalHealth is provided)
  useEffect(() => {
    if (externalHealth) return;
    fetchHealth();
  }, [fetchHealth, externalHealth]);

  // Auto-refresh
  useEffect(() => {
    if (externalHealth) return; // Don't auto-refresh if using external data
    const interval = setInterval(() => fetchHealth(), autoRefreshInterval * 1000);
    return () => clearInterval(interval);
  }, [fetchHealth, autoRefreshInterval, externalHealth]);

  // Live cooldown countdown
  useEffect(() => {
    if (Object.keys(cooldownRemaining).length === 0) return;
    const interval = setInterval(() => {
      setCooldownRemaining(prev => {
        const next: { [key: string]: number } = {};
        let hasActive = false;
        for (const [key, val] of Object.entries(prev)) {
          const newVal = Math.max(0, val - 1);
          if (newVal > 0) {
            next[key] = newVal;
            hasActive = true;
          }
        }
        return hasActive ? next : {};
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownRemaining]);

  // Use external data if provided
  const resolvedData = externalHealth ?? healthData;
  const providers = resolvedData?.providers;
  const features = resolvedData?.features;

  const isAnyCooling = providers
    ? Object.values(providers).some((p: ProviderInfo) => p.is_cooling_down)
    : false;

  const isAnyFailing = providers
    ? Object.values(providers).some((p: ProviderInfo) => p.failure_count > 0)
    : false;

  const activeProvider = providers
    ? Object.entries(providers).find(([, p]) => (p as ProviderInfo).current)?.[0]
    : null;

  return (
    <Card className="overflow-hidden border-slate-200 dark:border-slate-700">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
              isAnyCooling
                ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400'
                : isAnyFailing
                ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                : 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400'
            }`}>
              <Shield className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base">Provider Health</CardTitle>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {resolvedData?.api_configured
                  ? `Last updated ${lastRefreshAt.toLocaleTimeString()}`
                  : 'AI not configured'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isAnyCooling && (
              <Badge variant="destructive" className="text-[10px] px-2 py-0 gap-1">
                <TimerReset className="w-2.5 h-2.5" />
                Rate Limited
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => fetchHealth(true)}
              disabled={refreshing}
              className="h-8 w-8 p-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <Loader2 className="w-4 h-4 animate-spin" />
              Checking provider health...
            </div>
          </div>
        ) : !resolvedData?.api_configured ? (
          <div className="flex items-center gap-2 p-4 bg-amber-50 dark:bg-amber-950/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-300">
              <p className="font-medium">AI providers not configured</p>
              <p className="text-amber-600 dark:text-amber-400 mt-0.5">
                {resolvedData?.message || 'Configure API keys in Settings &gt; AI Configuration'}
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Provider cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <ProviderCard
                name="openrouter"
                info={providers?.openrouter}
                isActive={activeProvider === 'openrouter'}
                waitRemaining={cooldownRemaining['openrouter'] ?? 0}
              />
              <ProviderCard
                name="gemini"
                info={providers?.gemini}
                isActive={activeProvider === 'gemini'}
                waitRemaining={cooldownRemaining['gemini'] ?? 0}
              />
            </div>

            {/* Features */}
            {features && Object.keys(features).length > 0 && (
              <>
                <Separator />
                <div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Features</p>
                  <div className="flex flex-wrap gap-1.5">
                    {Object.entries(features).map(([key, enabled]) => (
                      <span
                        key={key}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          enabled
                            ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800'
                            : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 border border-slate-200 dark:border-slate-700'
                        }`}
                      >
                        {enabled ? <CheckCircle2 className="w-2.5 h-2.5" /> : <XCircle className="w-2.5 h-2.5" />}
                        {key.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Quick summary row */}
            <div className="flex flex-wrap items-center gap-3 text-[10px] text-slate-400 dark:text-slate-500">
              <span className="inline-flex items-center gap-1">
                <Activity className="w-3 h-3" />
                Total RPM: {Object.values(providers || {}).reduce((sum, p: ProviderInfo) => sum + (p.requests_this_minute || 0), 0)} / {Object.values(providers || {}).reduce((sum, p: ProviderInfo) => sum + (p.rpm_limit || 0), 0)}
              </span>
              <span className="inline-flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" />
                Total failures: {Object.values(providers || {}).reduce((sum, p: ProviderInfo) => sum + (p.failure_count || 0), 0)}
              </span>
              {resolvedData?.status && (
                <span className={`inline-flex items-center gap-1 ${
                  resolvedData.status === 'healthy' ? 'text-emerald-500' : 'text-amber-500'
                }`}>
                  <CheckCircle2 className="w-3 h-3" />
                  Status: {resolvedData.status}
                </span>
              )}
            </div>
          </>
        )}

        {resolvedData?.message && resolvedData.api_configured && (
          <p className="text-[10px] text-slate-400 dark:text-slate-500 leading-relaxed">
            {resolvedData.message}
          </p>
        )}
      </CardContent>
    </Card>
  );
};

export default AIProviderHealthWidget;
