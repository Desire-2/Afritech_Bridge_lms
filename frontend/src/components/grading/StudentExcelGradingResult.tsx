"use client";

/**
 * StudentExcelGradingResult
 *
 * Student-facing view of their AI grading result. Shows score,
 * rubric breakdown with improvement tips, skill radar, and
 * actionable feedback. Clean, motivating design.
 */

import React, { useEffect, useState } from "react";
import {
  Brain,
  BarChart3,
  MessageSquare,
  CheckCircle,
  Sparkles,
  Loader2,
  Target,
  TrendingUp,
  Lightbulb,
  ArrowRight,
  Star,
  AlertCircle,
} from "lucide-react";
import ExcelGradingService, {
  StudentGradingResult,
} from "@/services/excel-grading.service";

// ─── Helpers ─────────────────────────────────────────────────

function gradeColor(letter: string) {
  const map: Record<string, string> = {
    A: "from-green-500 to-emerald-500",
    B: "from-blue-500 to-cyan-500",
    C: "from-yellow-500 to-amber-500",
    D: "from-orange-500 to-red-400",
    F: "from-red-500 to-rose-600",
  };
  return map[letter?.[0]] || "from-gray-400 to-gray-500";
}

function gradeBg(letter: string) {
  const map: Record<string, string> = {
    A: "bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800",
    B: "bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800",
    C: "bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800",
    D: "bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800",
    F: "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800",
  };
  return map[letter?.[0]] || "bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-700";
}

function gradeMessage(letter: string, pct: number) {
  if (pct >= 90) return "Outstanding work! You've demonstrated excellent Excel skills.";
  if (pct >= 80) return "Great job! You have a strong grasp of the required concepts.";
  if (pct >= 70) return "Good effort! There are a few areas you can strengthen.";
  if (pct >= 60) return "Decent work. Focus on the improvement areas below to boost your grade.";
  if (pct >= 50) return "Keep going! Review the feedback below and work on the weak areas.";
  return "This needs more work. Carefully review the feedback and try again.";
}

function categoryTip(key: string, pct: number): string | null {
  if (pct >= 80) return null; // No tip needed for strong areas
  const tips: Record<string, string> = {
    formula_accuracy: "Practice using VLOOKUP, INDEX/MATCH, and nested IF functions.",
    formula_complexity: "Try combining multiple functions — e.g., IF with AND/OR, or SUMIFS.",
    chart_quality: "Ensure charts have proper titles, axis labels, and use appropriate chart types.",
    pivot_tables: "Create PivotTables with calculated fields, slicers, and proper grouping.",
    data_organization: "Use consistent headers, proper data types, and structured table formats.",
    formatting: "Apply conditional formatting, data validation, and named ranges.",
    vba_macros: "Write clean Sub/Function procedures with proper error handling.",
    power_query: "Build multi-step queries with filtering, merging, and data type transformations.",
    overall_structure: "Organize your workbook with clear sheet names and logical data flow.",
  };
  return tips[key] || "Review the assignment requirements and ensure all criteria are met.";
}

function miniBar(score: number, max: number) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const bg = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className={`h-full ${bg} rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs font-bold text-gray-600 dark:text-gray-400 w-8 text-right tabular-nums">
        {pct}%
      </span>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  submissionId: number;
  submissionType?: "assignment" | "project";
  preloaded?: StudentGradingResult;
}

// ─── Component ───────────────────────────────────────────────

export default function StudentExcelGradingResult({
  submissionId,
  submissionType = "assignment",
  preloaded,
}: Props) {
  const [result, setResult] = useState<StudentGradingResult | null>(preloaded || null);
  const [loading, setLoading] = useState(!preloaded);
  const [notFound, setNotFound] = useState(false);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    if (preloaded) return;
    fetchResult();
  }, [submissionId, submissionType]);

  const fetchResult = async () => {
    setLoading(true);
    try {
      const data = await ExcelGradingService.getMyResultBySubmission(submissionId, submissionType);
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

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-gray-400 text-sm py-6 justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
        Loading AI analysis...
      </div>
    );
  }

  if (notFound || !result) return null;

  const pct = result.max_score > 0 ? Math.round((result.total_score / result.max_score) * 100) : 0;
  const rubricEntries = Object.entries(result.rubric_breakdown || {});
  const strongAreas = rubricEntries.filter(([, item]) => item.max > 0 && (item.score / item.max) >= 0.8);
  const weakAreas = rubricEntries.filter(([, item]) => item.max > 0 && (item.score / item.max) < 0.6);

  return (
    <div className="mt-6 space-y-4">
      {/* ── Score Card ─────────────────────────── */}
      <div className={`rounded-xl p-5 border shadow-sm ${gradeBg(result.grade_letter)}`}>
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-purple-500" />
          <h4 className="font-bold text-gray-900 dark:text-white text-base">AI Excel Analysis</h4>
          {result.instructor_reviewed && (
            <span className="ml-auto text-xs font-medium text-green-700 dark:text-green-400 bg-green-100 dark:bg-green-900/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> Verified
            </span>
          )}
        </div>

        <div className="flex items-center gap-5">
          {/* Grade circle */}
          <div className={`h-18 w-18 rounded-full bg-gradient-to-br ${gradeColor(result.grade_letter)} flex items-center justify-center shadow-lg flex-shrink-0`}
               style={{ height: "72px", width: "72px" }}>
            <span className="text-2xl font-extrabold text-white">{result.grade_letter || "–"}</span>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-2xl font-bold text-gray-900 dark:text-white tabular-nums">
              {result.total_score}
              <span className="text-sm font-normal text-gray-500 dark:text-gray-400"> / {result.max_score} ({pct}%)</span>
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 leading-snug">
              {gradeMessage(result.grade_letter, pct)}
            </p>
            {result.graded_at && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500 mt-1.5 flex items-center gap-1">
                <Sparkles className="h-3 w-3" />
                Analyzed {new Date(result.graded_at).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* ── Score Breakdown ────────────────────── */}
      {rubricEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-4 flex items-center gap-1.5">
            <BarChart3 className="h-4 w-4 text-blue-500" />
            Score Breakdown
          </h5>
          <div className="space-y-4">
            {rubricEntries.map(([key, item]) => {
              const catPct = item.max > 0 ? Math.round((item.score / item.max) * 100) : 0;
              const isStrong = catPct >= 80;
              const isWeak = catPct < 60 && item.max > 0;
              const tip = categoryTip(key, catPct);

              return (
                <div key={key}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {isStrong && <Star className="h-3.5 w-3.5 text-green-500 fill-green-500" />}
                      {isWeak && <AlertCircle className="h-3.5 w-3.5 text-red-400" />}
                      {!isStrong && !isWeak && <Target className="h-3.5 w-3.5 text-gray-400" />}
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {item.score}/{item.max}
                    </span>
                  </div>
                  {miniBar(item.score, item.max)}
                  {item.comment && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-5 italic">
                      {item.comment}
                    </p>
                  )}
                  {isWeak && tip && (
                    <div className="mt-1.5 ml-5 flex items-start gap-1.5 text-xs text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-1.5 rounded-lg">
                      <Lightbulb className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                      <span>{tip}</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick Summary: Strengths & Areas to Improve ── */}
      {(strongAreas.length > 0 || weakAreas.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Strengths */}
          {strongAreas.length > 0 && (
            <div className="bg-green-50 dark:bg-green-900/10 rounded-xl p-4 border border-green-200 dark:border-green-800">
              <h5 className="text-xs font-bold text-green-800 dark:text-green-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Strengths
              </h5>
              <div className="space-y-1">
                {strongAreas.map(([key, item]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-green-700 dark:text-green-300">
                    <CheckCircle className="h-3 w-3 flex-shrink-0" />
                    <span className="capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-xs opacity-70 tabular-nums">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Needs Work */}
          {weakAreas.length > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/10 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
              <h5 className="text-xs font-bold text-amber-800 dark:text-amber-300 uppercase tracking-wide mb-2 flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> Focus Areas
              </h5>
              <div className="space-y-1">
                {weakAreas.map(([key, item]) => (
                  <div key={key} className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-300">
                    <ArrowRight className="h-3 w-3 flex-shrink-0" />
                    <span className="capitalize">{key.replace(/_/g, " ")}</span>
                    <span className="ml-auto text-xs opacity-70 tabular-nums">{item.score}/{item.max}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Feedback ───────────────────────────── */}
      {result.overall_feedback && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="w-full flex items-center justify-between p-4 hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors"
          >
            <span className="text-sm font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-1.5">
              <MessageSquare className="h-4 w-4 text-indigo-500" />
              Detailed Feedback
            </span>
            <span className="text-xs text-gray-400">{showDetails ? "Hide" : "Show"}</span>
          </button>
          {showDetails && (
            <div className="px-5 pb-5 border-t border-gray-100 dark:border-gray-700 pt-3">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                {result.overall_feedback}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
