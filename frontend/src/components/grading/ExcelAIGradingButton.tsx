"use client";

/**
 * ExcelAIGradingButton
 *
 * Trigger button for instructors to run AI Excel grading on a submission.
 * Shows loading state, then displays the result panel on completion.
 */

import React, { useState, useEffect } from "react";
import {
  Brain,
  Sparkles,
  Loader2,
  AlertCircle,
  RefreshCw,
  Zap,
  FileX,
  FileWarning,
  Info,
} from "lucide-react";
import ExcelGradingService, {
  ExcelGradingResult,
} from "@/services/excel-grading.service";
import ExcelGradingResultPanel from "./ExcelGradingResultPanel";

// Map backend reason codes to user-friendly messages and icons
const ERROR_DISPLAY: Record<string, { icon: React.ElementType; className: string }> = {
  no_files:        { icon: FileX,       className: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700" },
  no_excel_files:  { icon: FileWarning, className: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700" },
  not_excel_course:{ icon: Info,        className: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700" },
  download_failed: { icon: AlertCircle, className: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700" },
  default:         { icon: AlertCircle, className: "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700" },
};

// ─── Loading Skeleton ────────────────────────────────────────

/** Shimmer bar — animated placeholder for text/block content */
function ShimmerBar({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-gray-700 dark:via-gray-600 dark:to-gray-700 bg-[length:200%_100%] animate-shimmer ${className}`}
    />
  );
}

/** Circle shimmer for the grade circle */
function ShimmerCircle({ size = "h-20 w-20" }: { size?: string }) {
  return (
    <div
      className={`${size} rounded-full animate-pulse bg-gradient-to-br from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600`}
    />
  );
}

/** Skeleton for the full grading result panel while AI is processing */
function GradingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* ── Score Header Skeleton ────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="h-1.5 bg-gray-200 dark:bg-gray-700" />
        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 rounded bg-gray-200 dark:bg-gray-700" />
            <ShimmerBar className="h-5 w-40" />
            <div className="ml-auto">
              <ShimmerBar className="h-5 w-24 rounded-full" />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Grade circle skeleton */}
            <ShimmerCircle size="h-20 w-20" />

            {/* Score + meta skeleton */}
            <div className="flex-1 space-y-3 w-full">
              <ShimmerBar className="h-7 w-60" />
              <ShimmerBar className="h-2 w-full max-w-sm" />
              <div className="flex gap-3">
                <ShimmerBar className="h-4 w-28" />
                <ShimmerBar className="h-4 w-20" />
                <ShimmerBar className="h-4 w-32" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Bar Skeleton ────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex-1 px-4 py-3">
              <ShimmerBar className="h-4 w-20 mx-auto" />
            </div>
          ))}
        </div>

        <div className="p-5 space-y-5">
          {/* ── Category Score Bars Skeleton ────── */}
          <div className="space-y-4">
            <ShimmerBar className="h-4 w-32" />
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="space-y-1.5">
                <div className="flex justify-between">
                  <ShimmerBar className="h-4 w-24" />
                  <ShimmerBar className="h-4 w-16" />
                </div>
                <ShimmerBar className="h-2 w-full" />
              </div>
            ))}
          </div>

          {/* ── Task Checklist Skeleton ─────────── */}
          <div className="border-t border-gray-200 dark:border-gray-700 pt-5 space-y-4">
            <div className="flex items-center">
              <ShimmerBar className="h-5 w-5 rounded mr-2" />
              <ShimmerBar className="h-4 w-48" />
            </div>

            {/* Summary stat badges */}
            <div className="flex gap-2">
              <ShimmerBar className="h-6 w-20 rounded-lg" />
              <ShimmerBar className="h-6 w-28 rounded-lg" />
              <ShimmerBar className="h-6 w-24 rounded-lg" />
            </div>

            {/* Formula badges */}
            <div className="flex gap-1.5">
              <ShimmerBar className="h-5 w-16 rounded-full" />
              <ShimmerBar className="h-5 w-20 rounded-full" />
              <ShimmerBar className="h-5 w-14 rounded-full" />
              <ShimmerBar className="h-5 w-18 rounded-full" />
            </div>

            {/* Task cards */}
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${
                  i % 3 === 0
                    ? 'bg-amber-50/50 dark:bg-amber-900/5 border-amber-200/50 dark:border-amber-700/30'
                    : 'bg-gray-50/50 dark:bg-slate-800/30 border-gray-200/50 dark:border-gray-700/30'
                }`}
              >
                <div className="flex items-start gap-2">
                  {/* Task number circle */}
                  <ShimmerBar className="h-6 w-6 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 space-y-1.5">
                    <ShimmerBar className="h-3 w-full" />
                    <ShimmerBar className="h-3 w-3/4" />
                    {/* Formula badges */}
                    <div className="flex gap-1 mt-1">
                      <ShimmerBar className="h-4 w-14 rounded" />
                      <ShimmerBar className="h-4 w-18 rounded" />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Progress indicator at the bottom ──── */}
      <div className="flex items-center justify-center gap-2 py-3">
        <Loader2 className="h-4 w-4 animate-spin text-purple-500" />
        <span className="text-sm text-purple-600 dark:text-purple-400 font-medium">
          AI is analyzing the Excel file...
        </span>
      </div>
    </div>
  );
}

interface Props {
  submissionId: number;
  submissionType?: "assignment" | "project";
  /** Called when grading completes (e.g. to refresh the parent page) */
  onGradingComplete?: (result: ExcelGradingResult) => void;
  /** Compact mode: just the button, no embedded result panel */
  compact?: boolean;
}

export default function ExcelAIGradingButton({
  submissionId,
  submissionType = "assignment",
  onGradingComplete,
  compact = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorReason, setErrorReason] = useState<string | null>(null);
  const [result, setResult] = useState<ExcelGradingResult | null>(null);
  const [existingResult, setExistingResult] =
    useState<ExcelGradingResult | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(true);

  // Check for existing AI grading result on mount
  useEffect(() => {
    checkExistingResult();
  }, [submissionId, submissionType]);

  const checkExistingResult = async () => {
    setCheckingExisting(true);
    try {
      const existing = await ExcelGradingService.getResultBySubmission(
        submissionId,
        submissionType
      );
      if (existing && existing.id) {
        setExistingResult(existing);
        setResult(existing);
      }
    } catch {
      // No existing result — that's fine
    } finally {
      setCheckingExisting(false);
    }
  };

  const handleGrade = async (force = false) => {
    setLoading(true);
    setError(null);
    setErrorReason(null);
    try {
      const response = await ExcelGradingService.gradeSubmission(submissionId, {
        submission_type: submissionType,
        force,
      });

      if (response.status === "failed" || response.status === "skipped") {
        setError(response.message || response.error || "AI grading failed");
        setErrorReason(response.reason || null);
        return;
      }

      // The grading result may be nested under response.result
      // (status=completed wraps it) or flat (already_graded / direct).
      const gradingResult =
        (response as any).result?.id
          ? (response as any).result
          : response;

      if (gradingResult?.id) {
        setResult(gradingResult);
        setExistingResult(gradingResult);
        onGradingComplete?.(gradingResult);
      } else {
        // Result saved on backend — re-fetch to get the full object
        await checkExistingResult();
        if (existingResult) {
          onGradingComplete?.(existingResult);
        }
      }
    } catch (err: any) {
      setError(err.message || "AI grading request failed");
    } finally {
      setLoading(false);
    }
  };

  const handleReviewComplete = (updated: ExcelGradingResult) => {
    setResult(updated);
    setExistingResult(updated);
    onGradingComplete?.(updated);
  };

  if (checkingExisting) {
    return (
      <div className="flex items-center gap-2 text-gray-500 text-sm py-2">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking AI grading status...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Trigger Buttons ────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        {!existingResult ? (
          <button
            onClick={() => handleGrade(false)}
            disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-lg text-sm font-semibold shadow-md hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Analyzing Excel file...
              </>
            ) : (
              <>
                <Brain className="h-4 w-4" />
                <Sparkles className="h-3.5 w-3.5" />
                Run AI Grading
              </>
            )}
          </button>
        ) : (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 rounded-lg text-sm font-medium">
              <Zap className="h-4 w-4" />
              AI Graded: {existingResult.max_score > 0 ? Math.round((existingResult.total_score / existingResult.max_score) * 100) : 0}% (
              {existingResult.grade_letter})
            </div>
            <button
              onClick={() => handleGrade(true)}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
              Re-grade
            </button>
          </div>
        )}
      </div>

      {/* ── Error ──────────────────────────────── */}
      {error && (() => {
        const display = ERROR_DISPLAY[errorReason || 'default'] || ERROR_DISPLAY.default;
        const Icon = display.icon;
        const textColor = errorReason === 'no_files' || errorReason === 'no_excel_files' || errorReason === 'not_excel_course'
          ? 'text-amber-700 dark:text-amber-300'
          : 'text-red-700 dark:text-red-300';
        const iconColor = errorReason === 'no_files' || errorReason === 'no_excel_files' || errorReason === 'not_excel_course'
          ? 'text-amber-600 dark:text-amber-400'
          : 'text-red-600 dark:text-red-400';
        return (
          <div className={`flex items-start gap-2 p-3 rounded-lg border ${display.className}`}>
            <Icon className={`h-4 w-4 ${iconColor} mt-0.5 flex-shrink-0`} />
            <p className={`text-sm ${textColor}`}>{error}</p>
          </div>
        );
      })()}

      {/* ── Loading Skeleton ────────────────────── */}
      {loading && !result && !compact && <GradingSkeleton />}

      {/* ── Result Panel ───────────────────────── */}
      {!compact && result && result.id && (
        <ExcelGradingResultPanel
          result={result}
          onReviewComplete={handleReviewComplete}
        />
      )}
    </div>
  );
}
