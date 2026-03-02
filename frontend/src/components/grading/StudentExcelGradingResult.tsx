"use client";

/**
 * StudentExcelGradingResult
 *
 * Student-facing component that fetches and displays AI grading results
 * for their own submission. Shows score, rubric, and feedback in a
 * clean read-only format.
 */

import React, { useEffect, useState } from "react";
import {
  Award,
  Brain,
  BarChart3,
  MessageSquare,
  CheckCircle,
  Clock,
  Sparkles,
  Loader2,
  FileSpreadsheet,
} from "lucide-react";
import ExcelGradingService, {
  StudentGradingResult,
} from "@/services/excel-grading.service";

// ─── Helpers ─────────────────────────────────────────────────

function gradeColor(letter: string) {
  switch (letter?.[0]) {
    case "A": return "from-green-500 to-emerald-500";
    case "B": return "from-blue-500 to-cyan-500";
    case "C": return "from-yellow-500 to-amber-500";
    case "D": return "from-orange-500 to-red-400";
    case "F": return "from-red-500 to-rose-600";
    default:  return "from-gray-400 to-gray-500";
  }
}

function miniBar(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const bg = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-medium text-gray-500 dark:text-gray-400 w-8 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  submissionId: number;
  submissionType?: "assignment" | "project";
  /** Optional: if the parent already has the data, pass it in */
  preloaded?: StudentGradingResult;
}

// ─── Component ───────────────────────────────────────────────

export default function StudentExcelGradingResult({
  submissionId,
  submissionType = "assignment",
  preloaded,
}: Props) {
  const [result, setResult] = useState<StudentGradingResult | null>(
    preloaded || null
  );
  const [loading, setLoading] = useState(!preloaded);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (preloaded) return;
    fetchResult();
  }, [submissionId, submissionType]);

  const fetchResult = async () => {
    setLoading(true);
    try {
      const data = await ExcelGradingService.getMyResultBySubmission(
        submissionId,
        submissionType
      );
      if (data && data.id) {
        setResult(data);
      } else {
        setNotFound(true);
      }
    } catch {
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  // ── Loading state ───────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-4 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI analysis...
      </div>
    );
  }

  // ── No result ───────────────────────────────────

  if (notFound || !result) {
    return null; // Don't show anything if no AI result exists
  }

  // ── Result ──────────────────────────────────────

  const pct =
    result.max_score > 0
      ? Math.round((result.total_score / result.max_score) * 100)
      : 0;
  const rubricEntries = Object.entries(result.rubric_breakdown || {});

  return (
    <div className="mt-6 space-y-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-50 via-indigo-50 to-blue-50 dark:from-purple-950/30 dark:via-indigo-950/30 dark:to-blue-950/30 rounded-xl p-5 border border-purple-200 dark:border-purple-700 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-500" />
          <h4 className="font-bold text-gray-900 dark:text-white text-base">
            AI Excel Analysis
          </h4>
          {result.instructor_reviewed && (
            <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Instructor Verified
            </span>
          )}
        </div>

        {/* Score + Grade */}
        <div className="flex items-center gap-5">
          <div
            className={`h-16 w-16 rounded-full bg-gradient-to-br ${gradeColor(
              result.grade_letter
            )} flex items-center justify-center shadow-md flex-shrink-0`}
          >
            <span className="text-2xl font-extrabold text-white">
              {result.grade_letter || "–"}
            </span>
          </div>
          <div className="flex-1">
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {result.total_score}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                {" "}/ {result.max_score} ({pct}%)
              </span>
            </p>
            {result.graded_at && (
              <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-1">
                <Sparkles className="h-3 w-3" />
                Analyzed {new Date(result.graded_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Rubric Breakdown */}
      {rubricEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Score Breakdown
          </h5>
          <div className="space-y-3">
            {rubricEntries.map(([key, item]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-xs font-bold text-gray-900 dark:text-white">
                    {item.score}/{item.max}
                  </span>
                </div>
                {miniBar(item.score, item.max)}
                {item.comment && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 italic">
                    {item.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Feedback */}
      {result.overall_feedback && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2 flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            Feedback
          </h5>
          <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {result.overall_feedback}
          </p>
        </div>
      )}
    </div>
  );
}
