"use client";

/**
 * Student-facing AI grading result dispatcher.
 *
 * AAGE is the only engine; spreadsheet is a specialist inside it. Published
 * AAGE results are preferred, and historical Excel results stay readable via
 * the finalised-only legacy endpoint. The old UI called that endpoint
 * unconditionally, which produced a 404 for every other course.
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircle2, Lightbulb, Loader2, Sparkles, Target } from "lucide-react";
import AageService, {
  StudentGradingStatus,
  StudentPublishedResult,
  classifyStudentAageError,
  deriveGradingOutcome,
} from "@/services/aage.service";
import ExcelGradingService, {
  StudentGradingResult,
} from "@/services/excel-grading.service";
import StudentExcelGradingResult from "./StudentExcelGradingResult";
import MarkdownRenderer from "@/components/ui/MarkdownRenderer";

type View = "loading" | "aage" | "pending" | "legacy" | "none";

interface Props {
  submissionId: number;
  submissionType?: "assignment" | "project";
}

function isPublished(result: StudentPublishedResult | null): boolean {
  return Boolean(
    result && (result.is_official === true || result.status === "published")
  );
}

/** Only whitelisted, student-safe fields are rendered. */
function AageResultCard({ result }: { result: StudentPublishedResult }) {
  const score =
    typeof result.final_score === "number"
      ? `${result.final_score.toFixed(1)}%`
      : typeof result.points_awarded === "number" &&
          typeof result.total_possible === "number"
        ? `${result.points_awarded} / ${result.total_possible}`
        : null;
  const criteria = Array.isArray(result.criteria) ? result.criteria : [];
  const outcome = deriveGradingOutcome(result);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-xl p-5 border border-indigo-100 dark:border-indigo-900/50 bg-white dark:bg-slate-800 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          <Sparkles className="h-5 w-5 text-indigo-500" />
          <h4 className="font-bold text-gray-900 dark:text-white text-base">
            AI Grading Result
          </h4>
          {result.grade_letter && (
            <span className="ml-auto text-xs font-bold text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900/30 px-2 py-0.5 rounded-full">
              Grade {result.grade_letter}
            </span>
          )}
        </div>
        <div className="mb-3 flex flex-wrap gap-1.5 text-[11px] font-medium">
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Status: {outcome.status.replace(/_/g, " ")}
          </span>
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
            Progression: {outcome.progression.replace(/_/g, " ")}
          </span>
          {outcome.passed !== null ? (
            <span
              className={`rounded-full px-2 py-0.5 ${
                outcome.passed
                  ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"
              }`}
            >
              {outcome.passed ? "Pass" : "Below passing threshold"}
            </span>
          ) : (
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-500 dark:bg-slate-700 dark:text-slate-400">
              Pass/fail not supplied by this result
            </span>
          )}
        </div>
        {score && (
          <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
            {score}
          </p>
        )}
        {result.feedback && (
          <MarkdownRenderer
            content={result.feedback}
            variant="card"
            className="text-sm text-gray-600 dark:text-gray-300 mt-2 leading-relaxed"
          />
        )}
      </div>

      {criteria.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4">
            Criteria breakdown
          </h5>
          <div className="space-y-3">
            {criteria.map((criterion, index) => {
              const maximum = Number(criterion.maximum) || 0;
              const awarded = Number(criterion.awarded) || 0;
              const pct = maximum > 0 ? Math.round((awarded / maximum) * 100) : 0;
              return (
                <div key={`${criterion.criterion_key || criterion.name}-${index}`}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {criterion.name}
                    </span>
                    <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {awarded}/{maximum}
                    </span>
                  </div>
                  <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500"}`}
                      style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                    />
                  </div>
                  {criterion.feedback && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                      {criterion.feedback}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(result.strengths?.length > 0 || result.improvements?.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {result.strengths?.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <h5 className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <CheckCircle2 className="h-3.5 w-3.5" /> Strengths
              </h5>
              {result.strengths.map((item, i) => (
                <p key={i} className="text-sm text-green-700 dark:text-green-300">
                  {item}
                </p>
              ))}
            </div>
          )}
          {result.improvements?.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> Focus areas
              </h5>
              {result.improvements.map((item, i) => (
                <p key={i} className="text-sm text-amber-700 dark:text-amber-300">
                  {item}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function StudentAageGradingResult({
  submissionId,
  submissionType = "assignment",
}: Props) {
  const [view, setView] = useState<View>("loading");
  const [aageResult, setAageResult] = useState<StudentPublishedResult | null>(null);
  const [legacyResult, setLegacyResult] = useState<StudentGradingResult | null>(null);
  const pollsRef = useRef(0);

  const load = useCallback(
    async (silent = false): Promise<boolean> => {
      if (!silent) {
        setView("loading");
        setAageResult(null);
        setLegacyResult(null);
      }

      try {
        const raw = await AageService.getStudentPublishedResult(
          submissionId,
          submissionType
        );
        if (isPublished(raw)) {
          setAageResult(raw);
          setView("aage");
          return true;
        }
      } catch (err: unknown) {
        // A forbidden response is a real access problem, not "still grading".
        if (classifyStudentAageError(err) === "forbidden") {
          setView("none");
          return true;
        }
        // 404 (or a transient failure) is resolved by the status check below.
      }

      try {
        const status: StudentGradingStatus =
          await AageService.getStudentGradingStatus(submissionId, submissionType);

        // The legacy endpoint is finalised-only and prefers AAGE, so a published
        // historical grade remains visible even while a newer job is queued.
        try {
          const legacy = await ExcelGradingService.getMyResultBySubmission(
            submissionId,
            submissionType
          );
          if (legacy?.id) {
            setLegacyResult(legacy);
            setView("legacy");
            return true;
          }
        } catch {
          // No finalised legacy result; fall through to the status-based view.
        }

        if (status?.has_job) {
          if (!silent) setView("pending");
          return false;
        }
        setView("none");
        return false;
      } catch {
        // Keep the pending view during polling; a transient status failure is
        // not proof that grading stopped.
        if (!silent) setView("none");
        return false;
      }
    },
    [submissionId, submissionType]
  );

  useEffect(() => {
    pollsRef.current = 0;
    void load();
  }, [load]);

  // The page is often left open while the worker finishes. Poll the published
  // result endpoint so the score/feedback appears automatically, without a
  // browser reload. "none" and "legacy" also need a bounded poll because a
  // job can be queued after this component first settles.
  useEffect(() => {
    if (view === "loading" || view === "aage") return;
    const timer = window.setInterval(() => {
      if (pollsRef.current >= 15) return;
      pollsRef.current += 1;
      void load(true);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [view, load]);

  if (view === "loading") {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI analysis...
      </div>
    );
  }

  if (view === "pending") {
    return (
      <div className="mt-6 flex items-start gap-2 rounded-xl border border-indigo-100 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 text-sm text-indigo-800 dark:text-indigo-200">
        <Lightbulb className="h-4 w-4 mt-0.5 flex-shrink-0" />
        <span>
          AI grading is in progress. Your score and feedback will appear here
          automatically as soon as the result is ready.
        </span>
      </div>
    );
  }

  if (view === "aage" && aageResult) {
    return <AageResultCard result={aageResult} />;
  }

  if (view === "legacy" && legacyResult) {
    return (
      <StudentExcelGradingResult
        submissionId={submissionId}
        submissionType={submissionType}
        preloaded={legacyResult}
      />
    );
  }

  return null;
}
