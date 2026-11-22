"use client";

/**
 * UniversalAIGradingButton
 *
 * The single grading-detail affordance for every assignment/project submission.
 * AAGE is the only engine; `specialist` merely hints which evaluator family
 * will run. Historical Excel results are shown read-only, never run from here.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Brain,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import AageService, {
  type ExcelGradingResultSummary,
  type GradingResult,
  type SubmissionType,
  type UnifiedGradingStatus,
  deriveGradingOutcome,
  isSpreadsheetSpecialist,
  publishedAageResult,
} from "@/services/aage.service";
import type { ExcelGradingResult } from "@/services/excel-grading.service";
import ExcelAIGradingButton from "./ExcelAIGradingButton";

interface Props {
  submissionId: number;
  submissionType: SubmissionType;
  /** Keeps the existing detail-page behaviour of pre-filling the grade form. */
  onGradingComplete?: (result: ExcelGradingResult) => void;
  /** Real pass threshold from the assignment/project being graded. */
  passingScore?: number | null;
}

const ACTIVE_JOB_STATUSES = new Set(["queued", "running"]);
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 120; // 4 minutes; the detail page can always be refreshed.

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** AAGE results are 0-100, so they can feed the existing form prefill safely. */
function toFormResult(result: GradingResult): ExcelGradingResult {
  return {
    id: result.id,
    submission_type: result.submission_type,
    assignment_submission_id:
      result.submission_type === "assignment" ? result.submission_id : null,
    project_submission_id:
      result.submission_type === "project" ? result.submission_id : null,
    total_score: result.final_score ?? 0,
    max_score: 100,
    grade_letter: result.grade_letter ?? undefined,
    overall_feedback: result.feedback ?? undefined,
    status: result.status,
    confidence: String(result.confidence ?? ""),
    manual_review_required: Boolean(result.requires_review),
  } as unknown as ExcelGradingResult;
}

/**
 * The unified status endpoint already returns the Excel summary. Hand it to
 * the Excel button as its initial state so it does not call the legacy result
 * endpoint again on mount. Full detail is loaded on demand from that button.
 */
function toExcelButtonResult(
  summary: ExcelGradingResultSummary | null | undefined,
): ExcelGradingResult | null {
  if (!summary?.id) return null;
  return {
    ...summary,
    total_score: summary.total_score ?? 0,
    max_score: summary.max_score ?? 0,
    grade_letter: summary.grade_letter ?? '',
    overall_feedback: summary.overall_feedback ?? '',
    status: summary.status ?? '',
    instructor_reviewed: summary.instructor_reviewed ?? false,
    rubric_breakdown: {},
  } as unknown as ExcelGradingResult;
}

function outcomeLabel(outcome: ReturnType<typeof deriveGradingOutcome>): string {
  switch (outcome.progression) {
    case 'published': return 'Published · progression recorded';
    case 'awaiting_review': return 'Awaiting instructor review';
    case 'draft': return 'Draft result';
    default: return 'Status unavailable';
  }
}

function reviewHref(status: UnifiedGradingStatus): string {
  if (status.review_id) {
    return `/instructor/assessment-intelligence?tab=reviews&review=${status.review_id}`;
  }
  return "/instructor/assessment-intelligence?tab=queue";
}

export default function UniversalAIGradingButton({
  submissionId,
  submissionType,
  onGradingComplete,
  passingScore,
}: Props) {
  const [status, setStatus] = useState<UnifiedGradingStatus | null>(null);
  const [checking, setChecking] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const aageJob = status?.aage_job ?? null;
  const aageResult = status?.aage_result ?? null;
  const officialResult = status?.official_aage_result ?? null;
  // Published grade wins for form prefill, pass/fail and progression.
  const publishedResult = publishedAageResult(status);
  const jobActive = Boolean(aageJob && ACTIVE_JOB_STATUSES.has(aageJob.status));
  const outcome = deriveGradingOutcome(publishedResult, passingScore);
  const draftIsNewer = Boolean(
    aageResult && officialResult && aageResult.id !== officialResult.id,
  );
  const resultToShow = aageResult ?? publishedResult;

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const loadStatus = useCallback(
    async (silent = false): Promise<UnifiedGradingStatus | null> => {
      if (!silent) setChecking(true);
      setError(null);
      try {
        const data = await AageService.getUnifiedGradingStatus(
          submissionType,
          submissionId
        );
        if (mountedRef.current) setStatus(data);
        return data;
      } catch (err: any) {
        if (mountedRef.current) {
          setError(err?.message || "Unable to check AI grading status");
        }
        return null;
      } finally {
        if (mountedRef.current) setChecking(false);
      }
    },
    [submissionId, submissionType]
  );

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleViewExisting = () => {
    const published = publishedAageResult(status);
    if (!published) return;
    onGradingComplete?.(toFormResult(published));
    void loadStatus(true);
  };

  const handleStart = async (force = false) => {
    setStarting(true);
    setError(null);
    try {
      const started = await AageService.startUnifiedGrading({
        submission_type: submissionType,
        submission_id: submissionId,
        force,
      });

      // The backend returns the stored published result when the submitted
      // files have not changed. Do not start/poll another model run then.
      if (started.result) {
        onGradingComplete?.(toFormResult(started.result as GradingResult));
        await loadStatus(true);
        return;
      }

      let job = started.job;
      for (
        let attempt = 0;
        attempt < MAX_POLLS && mountedRef.current;
        attempt += 1
      ) {
        if (!job || !ACTIVE_JOB_STATUSES.has(job.status)) break;
        await wait(POLL_INTERVAL_MS);
        if (!mountedRef.current) return;
        const fresh = await loadStatus(true);
        if (!mountedRef.current) return;
        job = fresh?.aage_job ?? null;
      }

      if (!mountedRef.current) return;
      const fresh = await loadStatus(true);
      if (!mountedRef.current) return;
      const completed = publishedAageResult(fresh);
      if (completed) {
        onGradingComplete?.(toFormResult(completed));
      }
    } catch (err: any) {
      if (mountedRef.current) {
        setError(err?.message || "AI grading request failed");
      }
    } finally {
      if (mountedRef.current) setStarting(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center gap-2 text-slate-500 text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking AI grading status...
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {status && (
        <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium dark:bg-slate-700">
            {isSpreadsheetSpecialist(status)
              ? "AAGE · Spreadsheet specialist"
              : "AAGE"}
          </span>
          <span>Selected automatically for this submission</span>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <p>{error}</p>
            <button
              type="button"
              onClick={() => void loadStatus()}
              className="text-xs font-semibold underline underline-offset-2"
            >
              Retry status check
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {!jobActive ? (
              <>
                <button
                  type="button"
                  onClick={publishedResult ? handleViewExisting : () => void handleStart(false)}
                  disabled={starting}
                  className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-md transition-all hover:from-purple-700 hover:to-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {starting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Analyzing submission...
                    </>
                  ) : (
                    <>
                      {publishedResult ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Brain className="h-4 w-4" />
                      )}
                      <Sparkles className="h-3.5 w-3.5" />
                      {publishedResult ? "View AI result" : "Run AI Grading"}
                    </>
                  )}
                </button>
                {publishedResult && (
                  <button
                    type="button"
                    disabled={starting}
                    onClick={() => {
                      if (window.confirm(
                        "Run a new AI evaluation? The published grade stays unchanged until you approve a new result."
                      )) {
                        void handleStart(true);
                      }
                    }}
                    className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Re-run AI
                  </button>
                )}
              </>
            ) : (
              <span className="inline-flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2 text-sm font-medium text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                <Loader2 className="h-4 w-4 animate-spin" />
                AI grading {aageJob?.status}...
              </span>
            )}

            {status && (
              <Link
                href={reviewHref(status)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                Assessment Intelligence
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {aageJob && !jobActive && aageJob.status === "failed" && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/50 dark:bg-amber-900/20 dark:text-amber-300">
              {aageJob.error || "The AI grading job failed. You can retry it."}
            </div>
          )}

          {resultToShow && (
            <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center gap-2">
                {resultToShow.is_official ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                ) : (
                  <Clock3 className="h-4 w-4 text-amber-600" />
                )}
                <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                  {(draftIsNewer ? publishedResult : resultToShow)?.final_score != null
                    ? `${Number((draftIsNewer ? publishedResult : resultToShow)?.final_score).toFixed(1)}%`
                    : "Result available"}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">
                  {draftIsNewer
                    ? `new draft ${aageResult?.final_score != null ? `${Number(aageResult?.final_score).toFixed(1)}%` : "available"} — published grade unchanged`
                    : resultToShow.status?.replace(/_/g, " ")}
                </span>
                {resultToShow.requires_review && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                    Review required
                  </span>
                )}
              </div>
              {outcome.status !== 'unknown' && (
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 font-medium text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                    {outcomeLabel(outcome)}
                  </span>
                  {outcome.passed !== null && (
                    <span
                      className={`rounded-full px-2 py-0.5 font-medium ${
                        outcome.passed
                          ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300'
                          : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
                      }`}
                    >
                      {outcome.passed ? 'Pass' : 'Below pass threshold'}
                    </span>
                  )}
                </div>
              )}
              {resultToShow.feedback && (
                <p className="whitespace-pre-wrap text-sm text-slate-600 dark:text-slate-300">
                  {resultToShow.feedback}
                </p>
              )}
              {status && status.review_id && (
                <Link
                  href={reviewHref(status)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-purple-700 hover:underline dark:text-purple-300"
                >
                  Open review workspace
                  <ExternalLink className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}
      </div>

      {status?.excel_result && (
        <div className="space-y-2 rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Historical spreadsheet result · read only
          </p>
          <ExcelAIGradingButton
            submissionId={submissionId}
            submissionType={submissionType}
            initialResult={toExcelButtonResult(status.excel_result)}
            readOnly
          />
        </div>
      )}
    </div>
  );
}
