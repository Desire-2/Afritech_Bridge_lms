"use client";

/**
 * ExcelGradingResultPanel
 *
 * Detailed instructor view of an AI Excel grading result.
 * Shows score, rubric breakdown, flagged issues, feedback,
 * and provides approve / override controls.
 */

import React, { useState } from "react";
import {
  Award,
  CheckCircle,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Clock,
  Shield,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Edit3,
  ThumbsUp,
  Brain,
  Sparkles,
} from "lucide-react";
import ExcelGradingService, {
  ExcelGradingResult,
  ReviewRequest,
} from "@/services/excel-grading.service";

// ─── Helpers ─────────────────────────────────────────────────

function confidenceBadge(c: string) {
  switch (c) {
    case "high":
      return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300";
    case "low":
      return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300";
    default:
      return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
  }
}

function gradeColorClass(letter: string) {
  switch (letter?.[0]) {
    case "A":
      return "from-green-500 to-emerald-500";
    case "B":
      return "from-blue-500 to-cyan-500";
    case "C":
      return "from-yellow-500 to-amber-500";
    case "D":
      return "from-orange-500 to-red-400";
    case "F":
      return "from-red-500 to-rose-600";
    default:
      return "from-gray-400 to-gray-500";
  }
}

function percentBar(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div
          className={`h-full ${color} rounded-full transition-all duration-500`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 w-10 text-right">
        {pct}%
      </span>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  result: ExcelGradingResult;
  /** Callback after instructor approves / overrides the grade */
  onReviewComplete?: (updated: ExcelGradingResult) => void;
  /** Hide approve/override controls (e.g. when already reviewed) */
  readOnly?: boolean;
}

// ─── Component ───────────────────────────────────────────────

export default function ExcelGradingResultPanel({
  result,
  onReviewComplete,
  readOnly = false,
}: Props) {
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideScore, setOverrideScore] = useState(
    result.total_score.toString()
  );
  const [overrideGrade, setOverrideGrade] = useState(result.grade_letter);
  const [notes, setNotes] = useState(result.instructor_notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct =
    result.max_score > 0
      ? Math.round((result.total_score / result.max_score) * 100)
      : 0;

  const rubricEntries = Object.entries(result.rubric_breakdown || {});

  // ─── Review handler ──────────────────────────────────────

  const handleReview = async (action: "approve" | "override") => {
    setSubmitting(true);
    setError(null);
    try {
      const payload: ReviewRequest = {
        action,
        instructor_notes: notes,
        apply_to_submission: true,
      };
      if (action === "override") {
        payload.adjusted_score = parseFloat(overrideScore);
        payload.adjusted_grade = overrideGrade;
      }
      const { result: updated } = await ExcelGradingService.reviewResult(
        result.id,
        payload
      );
      onReviewComplete?.(updated);
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* ── Header: Score + Grade ───────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-500" />
          <h3 className="font-bold text-lg text-gray-900 dark:text-white">
            AI Excel Grading Result
          </h3>
          <span
            className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadge(
              result.confidence
            )}`}
          >
            {result.confidence} confidence
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-center gap-6">
          {/* Large grade circle */}
          <div className="relative flex-shrink-0">
            <div
              className={`h-24 w-24 rounded-full bg-gradient-to-br ${gradeColorClass(
                result.grade_letter
              )} flex items-center justify-center shadow-lg`}
            >
              <span className="text-4xl font-extrabold text-white">
                {result.grade_letter || "–"}
              </span>
            </div>
            {result.instructor_reviewed && (
              <div className="absolute -bottom-1 -right-1 h-7 w-7 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            )}
          </div>

          {/* Score breakdown */}
          <div className="flex-1 space-y-2 text-center sm:text-left">
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {result.total_score}{" "}
              <span className="text-lg font-normal text-gray-500">
                / {result.max_score}
              </span>
            </p>
            <div className="w-full max-w-xs mx-auto sm:mx-0">
              {percentBar(result.total_score, result.max_score)}
            </div>
            <div className="flex flex-wrap gap-2 justify-center sm:justify-start text-xs text-gray-500 dark:text-gray-400">
              {result.file_name && (
                <span className="flex items-center gap-1">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {result.file_name}
                </span>
              )}
              {result.processing_time_seconds != null && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3.5 w-3.5" />
                  {result.processing_time_seconds.toFixed(1)}s
                </span>
              )}
              {result.graded_at && (
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" />
                  {new Date(result.graded_at).toLocaleString()}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Rubric Breakdown ────────────────────────── */}
      {rubricEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Rubric Breakdown
          </h4>
          <div className="space-y-3">
            {rubricEntries.map(([key, item]) => (
              <div key={key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                    {key.replace(/_/g, " ")}
                  </span>
                  <span className="text-sm font-bold text-gray-900 dark:text-white">
                    {item.score}/{item.max}
                  </span>
                </div>
                {percentBar(item.score, item.max)}
                {item.comment && (
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 italic">
                    {item.comment}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Flagged Issues ──────────────────────────── */}
      {result.flagged_issues && result.flagged_issues.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-5 border border-amber-200 dark:border-amber-700">
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Flagged Issues ({result.flagged_issues.length})
          </h4>
          <ul className="space-y-2">
            {result.flagged_issues.map((issue, i) => (
              <li
                key={i}
                className="text-sm text-amber-700 dark:text-amber-200 flex items-start gap-2"
              >
                <span className="font-semibold uppercase text-xs bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded mt-0.5">
                  {issue.type}
                </span>
                <span>{issue.description}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* ── Overall Feedback ────────────────────────── */}
      {result.overall_feedback && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-indigo-500" />
            AI Feedback
          </h4>
          <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
            {result.overall_feedback}
          </div>
        </div>
      )}

      {/* ── Detailed Analysis (collapsible) ─────────── */}
      {result.analysis_data && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          <button
            onClick={() => setShowAnalysis(!showAnalysis)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <span className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-500" />
              Detailed File Analysis
            </span>
            {showAnalysis ? (
              <ChevronUp className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            )}
          </button>
          {showAnalysis && (
            <div className="p-4 border-t border-gray-200 dark:border-gray-700">
              <pre className="text-xs text-gray-600 dark:text-gray-400 whitespace-pre-wrap overflow-x-auto max-h-96">
                {JSON.stringify(result.analysis_data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}

      {/* ── Instructor Review Controls ──────────────── */}
      {!readOnly && !result.instructor_reviewed && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Edit3 className="h-4 w-4 text-violet-500" />
            Instructor Review
          </h4>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Add notes about the AI grading..."
            />
          </div>

          {/* Override form */}
          {showOverrideForm && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Override Score
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="0"
                  max={result.max_score}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Override Grade
                </label>
                <select
                  value={overrideGrade}
                  onChange={(e) => setOverrideGrade(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  {["A+", "A", "A-", "B+", "B", "B-", "C+", "C", "C-", "D+", "D", "F"].map(
                    (g) => (
                      <option key={g} value={g}>
                        {g}
                      </option>
                    )
                  )}
                </select>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
          )}

          {/* Buttons */}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => handleReview("approve")}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              {submitting ? "Saving..." : "Approve AI Grade"}
            </button>

            {!showOverrideForm ? (
              <button
                onClick={() => setShowOverrideForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Edit3 className="h-4 w-4" />
                Override Grade
              </button>
            ) : (
              <button
                onClick={() => handleReview("override")}
                disabled={submitting}
                className="flex items-center gap-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Edit3 className="h-4 w-4" />
                {submitting ? "Saving..." : "Submit Override"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Already Reviewed Badge ──────────────────── */}
      {result.instructor_reviewed && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700 flex items-center gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">
              Reviewed by Instructor
            </p>
            {result.instructor_reviewed_at && (
              <p className="text-xs text-green-600 dark:text-green-400">
                {new Date(result.instructor_reviewed_at).toLocaleString()}
              </p>
            )}
            {result.instructor_notes && (
              <p className="text-xs text-green-700 dark:text-green-300 mt-1 italic">
                {result.instructor_notes}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
