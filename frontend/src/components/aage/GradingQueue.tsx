'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import {
  AlertCircle,
  Ban,
  CheckCircle2,
  Eye,
  Filter,
  Loader2,
  Play,
  RefreshCw,
  RotateCcw,
  Send,
} from 'lucide-react';
import { Course } from '@/types/api';
import GradingService, { AssignmentSubmission, ProjectSubmission } from '@/services/grading.service';
import AageService, {
  GradingJob,
  GradingQueueFilters,
  GradingResult,
  Review,
  SubmissionType,
} from '@/services/aage.service';
import {
  AagePanel,
  EmptyState,
  ErrorState,
  Field,
  PrimaryButton,
  SecondaryButton,
  StatusBadge,
  formatDate,
  formatPercent,
  inputClass,
} from './shared';

interface QueueRow {
  key: string;
  jobId?: number;
  resultId?: number;
  reviewId?: number;
  submissionId: number;
  submissionType: SubmissionType;
  assessmentId?: number;
  courseId?: number;
  studentId?: number;
  status: string;
  confidence?: number;
  requiresReview?: boolean;
  evaluator?: string;
  submittedAt?: string;
  source: 'aage' | 'legacy';
}

type ConfidenceFilter = 'all' | 'high' | 'medium' | 'low';

const terminalStatuses = new Set(['succeeded', 'failed', 'cancelled', 'timed_out', 'published']);

/** Backend confidence is already a 0-100 percentage. */
function confidenceBand(value: number | undefined): ConfidenceFilter {
  if (value === undefined || !Number.isFinite(value)) return 'low';
  if (value >= 80) return 'high';
  if (value >= 50) return 'medium';
  return 'low';
}

export default function GradingQueue({
  courses,
  onOpenReview,
}: {
  courses: Course[];
  onOpenReview?: (reviewId: number) => void;
}) {
  const [filters, setFilters] = useState<GradingQueueFilters>({});
  const [confidence, setConfidence] = useState<ConfidenceFilter>('all');
  const [requiresReview, setRequiresReview] = useState<'all' | 'yes' | 'no'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [selectedResult, setSelectedResult] = useState<GradingResult | null>(null);
  const [reviewMap, setReviewMap] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [usingFallback, setUsingFallback] = useState(false);

  const setFilter = <K extends keyof GradingQueueFilters>(key: K, value: GradingQueueFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const loadReviews = useCallback(async (courseId?: number) => {
    try {
      const response = await AageService.getPendingReviews({ course_id: courseId, per_page: 200 });
      const mapping: Record<number, number> = {};
      response.reviews.forEach((review: Review) => {
        if (review.result_id) mapping[review.result_id] = review.id;
      });
      setReviewMap(mapping);
    } catch {
      setReviewMap({});
    }
  }, []);

  const load = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      else setRefreshing(true);
      setError(null);
      try {
        let loadedRows: QueueRow[] = [];
        setUsingFallback(false);

        try {
          const jobs = await AageService.listJobs({
            course_id: filters.course_id,
            submission_type: filters.submission_type,
            status: filters.status,
            evaluator: filters.evaluator,
            per_page: 200,
          });
          loadedRows = jobs.map((job: GradingJob) => ({
            key: `job-${job.id}`,
            jobId: job.id,
            resultId: job.result_id ?? undefined,
            submissionId: job.submission_id,
            submissionType: job.submission_type,
            assessmentId: job.assessment_id,
            courseId: job.course_id ?? undefined,
            studentId: job.student_id ?? undefined,
            status: job.status,
            evaluator: Array.isArray(job.evaluators) ? job.evaluators.join(', ') : undefined,
            submittedAt: job.queued_at || job.created_at || undefined,
            source: 'aage',
          }));

          // Enrich a bounded number of jobs with result confidence / review flags.
          const withResults = loadedRows.filter((row) => row.resultId).slice(0, 25);
          const results = await Promise.all(
            withResults.map(async (row) => {
              try {
                return { key: row.key, result: await AageService.getResult(row.resultId!) };
              } catch {
                return { key: row.key, result: null };
              }
            })
          );
          const resultByKey = new Map(results.filter((item) => item.result).map((item) => [item.key, item.result!]));
          loadedRows = loadedRows.map((row) => {
            const result = resultByKey.get(row.key);
            if (!result) return row;
            return {
              ...row,
              confidence: result.confidence,
              requiresReview: result.requires_review,
              status: result.is_official ? 'published' : row.status,
            };
          });
        } catch {
          // Deployment may only expose the single-resource contract. Fall back
          // to the existing submission lists so instructors can still start jobs.
          setUsingFallback(true);
          const submissionFilters = {
            course_id: filters.course_id,
            status: 'all' as const,
            page: 1,
            per_page: 100,
          };
          const submissions: Array<AssignmentSubmission | ProjectSubmission> = [];
          if (!filters.submission_type || filters.submission_type === 'assignment') {
            try {
              submissions.push(
                ...(await GradingService.getAssignmentSubmissions(submissionFilters)).submissions
              );
            } catch {
              /* handled by empty state */
            }
          }
          if (!filters.submission_type || filters.submission_type === 'project') {
            try {
              submissions.push(
                ...(await GradingService.getProjectSubmissions(submissionFilters)).submissions
              );
            } catch {
              /* handled by empty state */
            }
          }
          loadedRows = submissions.map((submission) => ({
            key: `submission-${submission.id}`,
            submissionId: submission.id,
            submissionType: ('assignment_id' in submission ? 'assignment' : 'project') as SubmissionType,
            assessmentId: ('assignment_id' in submission ? submission.assignment_id : submission.project_id),
            courseId: submission.course_id,
            studentId: submission.student_id,
            status: 'not_started',
            submittedAt: submission.submitted_at,
            source: 'legacy',
          }));
        }

        setRows(loadedRows);
        void loadReviews(filters.course_id);
      } catch (err: unknown) {
        setError((err as { message?: string })?.message || 'Unable to load the grading queue.');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [filters, loadReviews]
  );

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.course_id, filters.submission_type, filters.status, filters.evaluator, filters.assessment_id]);

  // Poll active jobs so status changes appear without a manual refresh.
  useEffect(() => {
    const activeJobs = rows.filter(
      (row) => row.jobId && !terminalStatuses.has(row.status)
    );
    if (activeJobs.length === 0) return;

    const poll = async () => {
      const updates = await Promise.all(
        activeJobs.map(async (row) => {
          try {
            const job = await AageService.getJob(row.jobId!);
            return { key: row.key, job };
          } catch {
            return null;
          }
        })
      );
      const byKey = new Map<string, GradingJob>(
        updates.filter(Boolean).map((item) => [item!.key, item!.job] as [string, GradingJob])
      );
      setRows((current) =>
        current.map((row) => {
          const job = byKey.get(row.key);
          return job
            ? { ...row, status: job.status, resultId: job.result_id ?? row.resultId }
            : row;
        })
      );
    };

    const interval = window.setInterval(poll, 15_000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void poll();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [rows]);

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.course_id && row.courseId !== filters.course_id) return false;
      if (filters.assessment_id && row.assessmentId !== filters.assessment_id) return false;
      if (filters.submission_type && row.submissionType !== filters.submission_type) return false;
      if (filters.evaluator && !(row.evaluator || '').toLowerCase().includes(filters.evaluator.toLowerCase()))
        return false;
      if (filters.status && row.status !== filters.status) return false;
      if (confidence !== 'all' && confidenceBand(row.confidence) !== confidence) return false;
      if (requiresReview === 'yes' && row.requiresReview !== true) return false;
      if (requiresReview === 'no' && row.requiresReview === true) return false;
      if (dateFrom && row.submittedAt && new Date(row.submittedAt) < new Date(dateFrom)) return false;
      if (dateTo && row.submittedAt && new Date(row.submittedAt) > new Date(`${dateTo}T23:59:59`))
        return false;
      return true;
    });
  }, [rows, filters, confidence, requiresReview, dateFrom, dateTo]);

  const runAction = async (row: QueueRow, action: 'start' | 'retry' | 'cancel' | 'publish') => {
    setBusyKey(row.key);
    setError(null);
    try {
      if (action === 'start') {
        const job = await AageService.startGrading({
          submission_type: row.submissionType,
          submission_id: row.submissionId,
        });
        toast.success(`Grading job #${job.id} queued.`);
      } else if (action === 'retry' && row.jobId) {
        await AageService.retryJob(row.jobId);
        toast.success('Job queued for retry.');
      } else if (action === 'cancel' && row.jobId) {
        await AageService.cancelJob(row.jobId);
        toast.success('Job cancelled.');
      } else if (action === 'publish' && row.resultId) {
        await AageService.publishResult(row.resultId);
        toast.success('Result published to the student.');
      }
      await load(true);
    } catch (err: unknown) {
      const message = (err as { message?: string })?.message || `Unable to ${action} this job.`;
      setError(message);
      toast.error(message);
    } finally {
      setBusyKey(null);
    }
  };

  const viewResult = async (row: QueueRow) => {
    if (!row.resultId) return;
    try {
      setSelectedResult(await AageService.getResult(row.resultId));
    } catch (err: unknown) {
      toast.error((err as { message?: string })?.message || 'Unable to load the result.');
    }
  };

  const clearFilters = () => {
    setFilters({});
    setConfidence('all');
    setRequiresReview('all');
    setDateFrom('');
    setDateTo('');
  };

  return (
    <div className="space-y-6">
      <AagePanel
        title="Grading Queue"
        description="Start, monitor and publish AI grading jobs. Active jobs are polled automatically."
        action={
          <SecondaryButton onClick={() => void load()} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Refresh
          </SecondaryButton>
        }
      >
        <div className="grid gap-3 md:grid-cols-3 lg:grid-cols-4">
          <Field label="Course">
            <select
              className={inputClass}
              value={filters.course_id ?? ''}
              onChange={(event) =>
                setFilter('course_id', event.target.value ? Number(event.target.value) : undefined)
              }
            >
              <option value="">All courses</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </Field>
          <Field label="Submission type">
            <select
              className={inputClass}
              value={filters.submission_type ?? ''}
              onChange={(event) =>
                setFilter('submission_type', (event.target.value || undefined) as SubmissionType | undefined)
              }
            >
              <option value="">All types</option>
              <option value="assignment">Assignment</option>
              <option value="project">Project</option>
            </select>
          </Field>
          <Field label="Assessment ID">
            <input
              className={inputClass}
              type="number"
              placeholder="Any"
              value={filters.assessment_id ?? ''}
              onChange={(event) =>
                setFilter('assessment_id', event.target.value ? Number(event.target.value) : undefined)
              }
            />
          </Field>
          <Field label="Status">
            <select
              className={inputClass}
              value={filters.status ?? ''}
              onChange={(event) => setFilter('status', event.target.value || undefined)}
            >
              <option value="">All statuses</option>
              <option value="queued">Queued</option>
              <option value="running">Running</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="cancelled">Cancelled</option>
              <option value="published">Published</option>
              <option value="not_started">Not started</option>
            </select>
          </Field>
          <Field label="Evaluator">
            <select
              className={inputClass}
              value={filters.evaluator ?? ''}
              onChange={(event) => setFilter('evaluator', event.target.value || undefined)}
            >
              <option value="">All evaluators</option>
              {Array.from(new Set(rows.map((row) => row.evaluator).filter(Boolean))).map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>
          <Field label="Confidence">
            <select
              className={inputClass}
              value={confidence}
              onChange={(event) => setConfidence(event.target.value as ConfidenceFilter)}
            >
              <option value="all">Any confidence</option>
              <option value="high">High (≥ 80%)</option>
              <option value="medium">Medium (50–79%)</option>
              <option value="low">Low (&lt; 50%)</option>
            </select>
          </Field>
          <Field label="Review required">
            <select
              className={inputClass}
              value={requiresReview}
              onChange={(event) => setRequiresReview(event.target.value as 'all' | 'yes' | 'no')}
            >
              <option value="all">Any</option>
              <option value="yes">Requires review</option>
              <option value="no">No review needed</option>
            </select>
          </Field>
          <Field label="Submitted from">
            <input
              className={inputClass}
              type="date"
              value={dateFrom}
              onChange={(event) => setDateFrom(event.target.value)}
            />
          </Field>
          <Field label="Submitted to">
            <input
              className={inputClass}
              type="date"
              value={dateTo}
              onChange={(event) => setDateTo(event.target.value)}
            />
          </Field>
        </div>
        <div className="mt-3 flex justify-end">
          <button type="button" onClick={clearFilters} className="text-xs text-blue-600 hover:underline">
            Clear filters
          </button>
        </div>

        {usingFallback && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            Job listing is unavailable on this deployment. Showing submissions from the existing grading
            service; you can still start a job. Status and publish actions appear once a job exists.
          </div>
        )}
        {error && (
          <div className="mt-4"><ErrorState message={error} onRetry={() => void load()} /></div>
        )}
      </AagePanel>

      <AagePanel
        title={`Jobs (${visibleRows.length})`}
        description="Select a result to inspect its instructor-facing summary."
        icon={<Filter className="h-4 w-4 text-slate-500" />}
      >
        {loading ? (
          <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-blue-600" /></div>
        ) : visibleRows.length === 0 ? (
          <EmptyState title="No matching jobs" description="Adjust the filters or start a grading job." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-700 dark:text-slate-400">
                  <th className="py-2 pr-4">Submission</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2 pr-4">Confidence</th>
                  <th className="py-2 pr-4">Review</th>
                  <th className="py-2 pr-4">Submitted</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {visibleRows.map((row) => {
                  const busy = busyKey === row.key;
                  return (
                    <tr key={row.key} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                      <td className="py-3 pr-4">
                        <div className="font-medium text-slate-800 dark:text-slate-100">
                          #{row.submissionId}
                        </div>
                        <div className="text-[11px] text-slate-400">
                          {row.jobId ? `Job #${row.jobId}` : 'No job yet'}
                          {row.assessmentId ? ` · Assessment #${row.assessmentId}` : ''}
                        </div>
                      </td>
                      <td className="py-3 pr-4 capitalize text-slate-600 dark:text-slate-300">
                        {row.submissionType}
                      </td>
                      <td className="py-3 pr-4"><StatusBadge status={row.status} /></td>
                      <td className="py-3 pr-4 text-slate-600 dark:text-slate-300">
                        {formatPercent(row.confidence, 0)}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-600 dark:text-slate-300">
                        {row.requiresReview === undefined ? '—' : row.requiresReview ? 'Required' : 'Not needed'}
                      </td>
                      <td className="py-3 pr-4 text-xs text-slate-500">{formatDate(row.submittedAt)}</td>
                      <td className="py-3">
                        <div className="flex flex-wrap justify-end gap-1.5">
                          {row.status === 'not_started' && (
                            <PrimaryButton className="px-2 py-1 text-xs" disabled={busy} onClick={() => void runAction(row, 'start')}>
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                              Start
                            </PrimaryButton>
                          )}
                          {['failed', 'timed_out', 'cancelled'].includes(row.status) && (
                            <SecondaryButton className="px-2 py-1 text-xs" disabled={busy || !row.jobId} onClick={() => void runAction(row, 'retry')}>
                              <RotateCcw className="h-3.5 w-3.5" /> Retry
                            </SecondaryButton>
                          )}
                          {['queued', 'running'].includes(row.status) && (
                            <SecondaryButton className="px-2 py-1 text-xs" disabled={busy || !row.jobId} onClick={() => void runAction(row, 'cancel')}>
                              <Ban className="h-3.5 w-3.5" /> Cancel
                            </SecondaryButton>
                          )}
                          {row.resultId && (
                            <SecondaryButton className="px-2 py-1 text-xs" onClick={() => void viewResult(row)}>
                              <Eye className="h-3.5 w-3.5" /> Result
                            </SecondaryButton>
                          )}
                          {row.resultId && !row.reviewId && reviewMap[row.resultId] && (
                            <SecondaryButton
                              className="px-2 py-1 text-xs"
                              onClick={() => onOpenReview?.(reviewMap[row.resultId!])}
                            >
                              Review
                            </SecondaryButton>
                          )}
                          {row.resultId && row.status !== 'published' && (
                            <PrimaryButton
                              className="bg-green-600 px-2 py-1 text-xs hover:bg-green-700"
                              disabled={busy}
                              onClick={() => void runAction(row, 'publish')}
                            >
                              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                              Publish
                            </PrimaryButton>
                          )}
                          {row.status === 'published' && (
                            <span className="inline-flex items-center gap-1 text-xs text-green-600">
                              <CheckCircle2 className="h-3.5 w-3.5" /> Published
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </AagePanel>

      {selectedResult && (
        <AagePanel
          title={`Result #${selectedResult.id}`}
          description="Instructor-facing summary. Internal prompts and other students' evidence are not displayed."
          action={
            <div className="flex gap-2">
              {reviewMap[selectedResult.id] && (
                <SecondaryButton onClick={() => onOpenReview?.(reviewMap[selectedResult.id])}>
                  Open review workspace
                </SecondaryButton>
              )}
              <SecondaryButton onClick={() => setSelectedResult(null)}>Close</SecondaryButton>
            </div>
          }
        >
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
              <p className="text-xs text-slate-500">Final score</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatPercent(selectedResult.final_score)}
              </p>
              <p className="text-xs text-slate-500">
                {selectedResult.total_awarded}/{selectedResult.total_possible} points
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
              <p className="text-xs text-slate-500">Confidence</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatPercent(selectedResult.confidence, 0)}
              </p>
              <p className="text-xs text-slate-500">
                {selectedResult.requires_review ? 'Review required' : 'No review required'}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 p-4 dark:bg-slate-700/40">
              <p className="text-xs text-slate-500">Status</p>
              <div className="mt-1"><StatusBadge status={selectedResult.status} /></div>
              <p className="mt-1 text-xs text-slate-500">
                Published {formatDate(selectedResult.published_at)}
              </p>
            </div>
          </div>
          {selectedResult.feedback && (
            <div className="mt-4 rounded-lg border border-slate-200 p-4 text-sm text-slate-700 dark:border-slate-700 dark:text-slate-200">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">Feedback</p>
              {selectedResult.feedback}
            </div>
          )}
        </AagePanel>
      )}
    </div>
  );
}
