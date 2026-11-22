'use client';

/**
 * Course-scoped grading/review report for instructors and administrators.
 * Uses only existing AAGE endpoints:
 *  - `/aage/analytics?course_id=…` for aggregate counts and review status;
 *  - `/aage/grading/results?course_id=…` for the result history;
 *  - `/aage/reviews/pending?course_id=…` for the open-review count.
 * No endpoint is invented, and no student artifacts or evaluator internals are
 * requested for this report.
 */

import React, { useCallback, useEffect, useState } from 'react';
import type { Course } from '@/types/api';
import { UnauthorizedAccess } from '@/components/guards/UnauthorizedAccess';
import AageService, {
  isAageNotFound,
} from '@/services/aage.service';
import type { AageAnalytics } from '@/services/aage.service';
import {
  AagePanel,
  EmptyState,
  ErrorState,
  Field,
  LoadingState,
  SecondaryButton,
  StatusBadge,
  formatDate,
  formatNumber,
  formatPercent,
  inputClass,
} from './shared';
import { canAccessInstructorAage, canViewAllCourses } from './roles';
import type { AageRole } from './roles';
import { projectReportRow } from './reports';
import type { ReportRow } from './reports';

export default function GradingReports({
  courses,
  role,
}: {
  courses: Course[];
  role: AageRole;
}) {
  const [courseId, setCourseId] = useState<number | undefined>(() =>
    canViewAllCourses(role) ? undefined : courses[0]?.id
  );
  const [stats, setStats] = useState<AageAnalytics | null>(null);
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (scope?: number) => {
    if (!canViewAllCourses(role) && scope === undefined) {
      setLoading(false);
      setError('Select one of your courses to view its report.');
      return;
    }
    setLoading(true);
    setError(null);
    const [analyticsResult, resultsResult, reviewsResult] = await Promise.allSettled([
      AageService.getAnalytics(scope),
      AageService.getGradingResultsPage({ course_id: scope, per_page: 100 }),
      AageService.getPendingReviews({ course_id: scope, per_page: 1 }),
    ]);

    const failures = [analyticsResult, resultsResult, reviewsResult]
      .filter((result) => result.status === 'rejected');
    if (failures.length === 3) {
      const reason = (failures[0] as PromiseRejectedResult).reason;
      setError(
        isAageNotFound(reason)
          ? 'No report data is available for this course.'
          : 'This report could not be loaded right now. Try again.'
      );
    }
    if (analyticsResult.status === 'fulfilled') setStats(analyticsResult.value);
    else {
      setStats(null);
    }
    if (resultsResult.status === 'fulfilled') {
      setRows(
        resultsResult.value.items
          .map((item) => projectReportRow(item))
          .filter((item): item is ReportRow => item !== null)
      );
    } else {
      setRows([]);
    }
    setPendingCount(
      reviewsResult.status === 'fulfilled' ? reviewsResult.value.total ?? null : null
    );
    setLoading(false);
  }, [role]);

  useEffect(() => {
    void load(courseId);
  }, [courseId, load]);

  useEffect(() => {
    if (!canViewAllCourses(role) && courseId === undefined && courses.length > 0) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId, role]);

  if (!canAccessInstructorAage(role)) {
    return <UnauthorizedAccess requiredRole="instructor" pageName="grading reports" />;
  }

  const resolved = stats?.correction_counts?.resolved;

  return (
    <div className="space-y-6">
      <AagePanel
        title="Grading & review report"
        description="Course-scoped aggregate counts from the analytics, result-history and pending-review APIs."
        action={
          <SecondaryButton onClick={() => void load(courseId)} disabled={loading}>
            Refresh
          </SecondaryButton>
        }
      >
        <div className="flex flex-wrap items-end gap-3">
          <Field label="Report scope">
            <select
              className={inputClass}
              value={courseId ?? ''}
              onChange={(event) =>
                setCourseId(event.target.value ? Number(event.target.value) : undefined)
              }
            >
              {canViewAllCourses(role) && <option value="">All courses</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </Field>
          {!canViewAllCourses(role) && (
            <p className="pb-2 text-xs text-slate-400">
              Instructors can only report on courses they own.
            </p>
          )}
        </div>
        {error && <div className="mt-4"><ErrorState message={error} onRetry={() => void load(courseId)} /></div>}
      </AagePanel>

      {loading ? (
        <LoadingState label="Loading grading report…" />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { label: 'Submissions seen', value: formatNumber(stats?.total_submissions) },
              { label: 'Auto-graded', value: formatNumber(stats?.auto_graded) },
              { label: 'Pending reviews', value: formatNumber(pendingCount ?? stats?.pending_reviews) },
              { label: 'Failed jobs', value: formatNumber(stats?.failed) },
              {
                label: 'Correction rate',
                value: resolved === 0 ? '—' : formatPercent(stats?.correction_rate),
              },
              {
                label: 'Corrections / resolved',
                value: resolved === undefined
                  ? '—'
                  : `${stats?.correction_counts?.corrected ?? 0} / ${resolved}`,
              },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-800"
              >
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">{tile.label}</p>
                <p className="mt-1 text-xl font-bold text-slate-900 dark:text-white">{tile.value}</p>
              </div>
            ))}
          </div>

          <AagePanel
            title="Review status breakdown"
            description="Counts are taken from the backend analytics response; missing keys stay blank."
          >
            {!stats?.review_status_counts ||
            Object.keys(stats.review_status_counts).length === 0 ? (
              <EmptyState
                title="No reviews recorded"
                description="Review status counts appear after the first instructor review."
              />
            ) : (
              <div className="flex flex-wrap gap-3">
                {Object.entries(stats.review_status_counts).map(([status, count]) => (
                  <div key={status} className="rounded-lg border border-slate-200 px-4 py-2 text-sm dark:border-slate-700">
                    <StatusBadge status={status} />
                    <span className="ml-2 font-semibold text-slate-800 dark:text-slate-100">
                      {formatNumber(count)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </AagePanel>

          <AagePanel
            title="Score distribution"
            description="Backend buckets are counts of results in each score range (0-100)."
          >
            {!stats?.score_distribution || stats.score_distribution.length === 0 ? (
              <EmptyState title="No score data yet" />
            ) : (
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {stats.score_distribution.map((bucket) => (
                  <div key={`${bucket.min}-${bucket.max}`} className="rounded-lg bg-slate-50 p-3 text-xs dark:bg-slate-700/40">
                    <span className="block text-slate-400">{bucket.min}–{bucket.max}%</span>
                    <span className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                      {formatNumber(bucket.count)}
                    </span>
                    <span className="ml-1 text-slate-500">results</span>
                  </div>
                ))}
              </div>
            )}
          </AagePanel>

          <AagePanel
            title="Result history"
            description="Published scores only; draft results are shown as under review."
          >
            {rows.length === 0 ? (
              <EmptyState
                title="No results in this scope"
                description="Results appear once grading jobs have completed for this course."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700">
                      <th className="py-2 pr-4">Result</th>
                      <th className="py-2 pr-4">Submission</th>
                      <th className="py-2 pr-4">Type</th>
                      <th className="py-2 pr-4">Status</th>
                      <th className="py-2 pr-4 text-right">Score</th>
                      <th className="py-2 text-right">Created</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rows.map((row) => (
                      <tr key={row.id}>
                        <td className="py-2.5 pr-4 font-medium text-slate-800 dark:text-slate-100">#{row.id}</td>
                        <td className="py-2.5 pr-4 text-slate-600 dark:text-slate-300">#{row.submission_id}</td>
                        <td className="py-2.5 pr-4 capitalize text-slate-600 dark:text-slate-300">{row.submission_type}</td>
                        <td className="py-2.5 pr-4"><StatusBadge status={row.status} /></td>
                        <td className="py-2.5 pr-4 text-right text-slate-700 dark:text-slate-200">
                          {row.is_official ? formatPercent(row.final_score) : '—'}
                        </td>
                        <td className="py-2.5 text-right text-xs text-slate-500">{formatDate(row.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </AagePanel>
        </>
      )}
    </div>
  );
}
