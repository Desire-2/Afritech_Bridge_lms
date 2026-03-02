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

      // The result could be nested or flat depending on status
      const gradingResult =
        response.status === "already_graded"
          ? (response as any).result
          : response;

      if (gradingResult?.id) {
        setResult(gradingResult);
        setExistingResult(gradingResult);
        onGradingComplete?.(gradingResult);
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
              AI Graded: {existingResult.total_score}/{existingResult.max_score} (
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
