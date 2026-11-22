'use client';

import React from 'react';
import {
  Activity,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  RefreshCcw,
  TrendingDown,
  Users,
} from 'lucide-react';
import type { AageAnalytics, EvaluatorMetric } from '@/services/aage.service';
import {
  AagePanel,
  EmptyState,
  ErrorState,
  LoadingState,
  formatDuration,
  formatNumber,
  formatPercent,
} from './shared';

function StatTile({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string;
  value: string;
  hint?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple' | 'slate';
}) {
  const palette: Record<string, string> = {
    blue: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
    green: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
    amber: 'text-amber-600 dark:text-amber-400 bg-amber-100 dark:bg-amber-900/30',
    red: 'text-red-600 dark:text-red-400 bg-red-100 dark:bg-red-900/30',
    purple: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
    slate: 'text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-700',
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</p>
          <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
          {hint && <p className="mt-0.5 text-[11px] text-slate-400">{hint}</p>}
        </div>
        <div className={`rounded-lg p-2 ${palette[color]}`}>{icon}</div>
      </div>
    </div>
  );
}

export default function StatsCards({
  stats,
  loading,
  error,
  onRetry,
}: {
  stats: AageAnalytics | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  if (loading && !stats) return <LoadingState label="Loading assessment intelligence…" />;
  if (error && !stats) return <ErrorState message={error} onRetry={onRetry} />;
  if (!stats) return <EmptyState title="No analytics available yet" />;

  const evaluators: EvaluatorMetric[] = Array.isArray(stats.evaluator_performance)
    ? stats.evaluator_performance
    : [];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatTile
          label="Total submissions"
          value={formatNumber(stats.total_submissions)}
          hint="Seen by the engine"
          color="blue"
          icon={<Users className="h-5 w-5" />}
        />
        <StatTile
          label="Auto-graded"
          value={formatNumber(stats.auto_graded)}
          hint="Completed without review"
          color="green"
          icon={<CheckCircle2 className="h-5 w-5" />}
        />
        <StatTile
          label="Pending reviews"
          value={formatNumber(stats.pending_reviews)}
          hint="Awaiting instructor"
          color="amber"
          icon={<ListChecks className="h-5 w-5" />}
        />
        <StatTile
          label="Failed jobs"
          value={formatNumber(stats.failed)}
          hint="Need attention"
          color="red"
          icon={<RefreshCcw className="h-5 w-5" />}
        />
        <StatTile
          label="Avg processing time"
          value={formatDuration(stats.avg_processing_time_ms)}
          hint="Per grading job"
          color="purple"
          icon={<Clock3 className="h-5 w-5" />}
        />
        <StatTile
          label="Correction rate"
          value={stats.correction_counts?.resolved === 0 ? '—' : formatPercent(stats.correction_rate)}
          hint={
            stats.correction_counts?.resolved === undefined
              ? 'Instructor overrides'
              : `${stats.correction_counts.corrected ?? 0} of ${stats.correction_counts.resolved} resolved reviews`
          }
          color="slate"
          icon={<TrendingDown className="h-5 w-5" />}
        />
      </div>

      <AagePanel
        title="Evaluator performance"
        description="Benchmark-derived evaluator metrics. Rates are converted from backend 0-1 ratios to percentages; per-evaluator timings and failure rates are not published by the API."
        icon={<Activity className="h-4 w-4" />}
      >
        {evaluators.length === 0 ? (
          <EmptyState title="No evaluator metrics yet" description="Metrics appear after the first grading runs." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4">Evaluator</th>
                  <th className="py-2 pr-4">Version</th>
                  <th className="py-2 pr-4 text-right">Benchmark cases</th>
                  <th className="py-2 pr-4 text-right">MAE</th>
                  <th className="py-2 pr-4 text-right">Criterion agreement</th>
                  <th className="py-2 text-right">Override rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {evaluators.map((evaluator, index) => (
                  <tr key={`${evaluator.name}-${evaluator.version || index}`}>
                    <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">
                      {evaluator.name}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-500">{evaluator.version || '—'}</td>
                    <td className="py-2.5 pr-4 text-right text-slate-700 dark:text-slate-200">
                      {formatNumber(evaluator.sample_count)}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-700 dark:text-slate-200">
                      {evaluator.mae === undefined || evaluator.mae === null
                        ? '—'
                        : `${evaluator.mae.toFixed(1)}%`}
                    </td>
                    <td className="py-2.5 pr-4 text-right text-slate-700 dark:text-slate-200">
                      {formatPercent(evaluator.criterion_agreement, 0)}
                    </td>
                    <td className="py-2.5 text-right text-slate-700 dark:text-slate-200">
                      {formatPercent(evaluator.override_rate, 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AagePanel>
    </div>
  );
}
