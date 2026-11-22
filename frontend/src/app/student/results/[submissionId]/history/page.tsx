'use client';

/**
 * Student-visible grading history for one submission.
 *
 * Uses only the existing `/aage/grading/results` list API. That endpoint is
 * already scoped to the caller by the backend, and this page re-checks both
 * submission_id and student_id through `projectStudentHistory`. Instructor
 * fields (feedback, rationale, evidence, confidence, evaluator config) are
 * never read or rendered here.
 *
 * Browser E2E is not automated in this repo; the data contract is covered by
 * node:test adapters in `frontend/tests/aage-contracts.test.ts`.
 */

import React, { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  ArrowLeft,
  ClipboardList,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { UnauthorizedAccess } from '@/components/guards/UnauthorizedAccess';
import AageService, {
  StudentHistoryEntry,
  SubmissionType,
  classifyStudentAageError,
} from '@/services/aage.service';
import { formatDate, formatPercent } from '@/components/aage/format';

type ViewState = 'loading' | 'ready' | 'empty' | 'denied' | 'error';

export default function StudentGradingHistoryPage() {
  const params = useParams();
  const { user, isLoading: authLoading } = useAuth();
  const submissionIdRaw = params?.submissionId;
  const submissionId = Number(Array.isArray(submissionIdRaw) ? submissionIdRaw[0] : submissionIdRaw);

  // Read the optional type from the client only, matching the result page's
  // SSR-safe pattern (no useSearchParams in a statically rendered segment).
  const [submissionType, setSubmissionType] = useState<SubmissionType | undefined>(undefined);
  const [typeReady, setTypeReady] = useState(false);
  const [view, setView] = useState<ViewState>('loading');
  const [entries, setEntries] = useState<StudentHistoryEntry[]>([]);

  useEffect(() => {
    const rawType = new URLSearchParams(window.location.search).get('type');
    setSubmissionType(rawType === 'assignment' || rawType === 'project' ? rawType : undefined);
    setTypeReady(true);
  }, []);

  const load = useCallback(async () => {
    if (!Number.isFinite(submissionId) || !user?.id) {
      setView('denied');
      return;
    }
    setView('loading');
    setEntries([]);
    try {
      const history = await AageService.getStudentHistory(
        submissionId,
        user.id,
        submissionType
      );
      setEntries(history);
      setView(history.length ? 'ready' : 'empty');
    } catch (err: unknown) {
      // Structured codes only; backend prose is intentionally discarded.
      const kind = classifyStudentAageError(err);
      setView(kind === 'forbidden' || kind === 'not_found' ? 'denied' : 'error');
    }
  }, [submissionId, submissionType, user?.id]);

  useEffect(() => {
    if (!authLoading && typeReady) void load();
  }, [authLoading, load, typeReady]);

  if (authLoading) {
    return (
      <div className="flex justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user && user.role !== 'student') {
    return <UnauthorizedAccess requiredRole="student" pageName="grading history page" />;
  }

  const resultHref = `/student/results/${submissionId}${
    submissionType ? `?type=${encodeURIComponent(submissionType)}` : ''
  }`;

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={resultHref}
          className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 dark:text-slate-300"
        >
          <ArrowLeft className="h-4 w-4" /> Back to result
        </Link>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Grading history</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Status changes recorded for submission #{submissionId}. Only your own results are shown.
      </p>

      {view === 'loading' && (
        <div className="flex items-center justify-center rounded-xl border border-slate-200 bg-white py-16 dark:border-slate-700 dark:bg-slate-800">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
          <span className="ml-2 text-sm text-slate-500">Loading your grading history…</span>
        </div>
      )}

      {view === 'empty' && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            No grading history yet
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            A history entry appears once this submission has been graded.
          </p>
        </div>
      )}

      {view === 'denied' && (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center dark:border-slate-700 dark:bg-slate-800">
          <ClipboardList className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">
            No history available for this submission
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Check the submission link or contact your instructor if you expected a result here.
          </p>
        </div>
      )}

      {view === 'error' && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-8 text-center dark:border-amber-900/40 dark:bg-amber-900/20">
          <RefreshCw className="mx-auto h-10 w-10 text-amber-600" />
          <p className="mt-3 text-sm font-medium text-amber-900 dark:text-amber-200">
            We couldn’t load your grading history right now
          </p>
          <button
            type="button"
            onClick={() => void load()}
            className="mt-4 inline-flex items-center gap-1.5 rounded-md border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 hover:bg-amber-100 dark:border-amber-800 dark:bg-slate-800 dark:text-amber-300"
          >
            <RefreshCw className="h-4 w-4" /> Try again
          </button>
        </div>
      )}

      {view === 'ready' && (
        <ol className="space-y-3">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-700 dark:bg-slate-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    Result #{entry.id}
                  </p>
                  <p className="text-xs text-slate-400">{formatDate(entry.created_at)}</p>
                </div>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                  {entry.status.replace(/_/g, ' ')}
                </span>
              </div>
              <p className="mt-2 text-sm text-slate-700 dark:text-slate-200">
                {entry.is_official
                  ? `Published score: ${formatPercent(entry.final_score ?? undefined)}`
                  : 'Under review — no published score yet'}
              </p>
              {entry.is_official && entry.published_at && (
                <p className="mt-1 text-xs text-slate-400">
                  Published {formatDate(entry.published_at)}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
