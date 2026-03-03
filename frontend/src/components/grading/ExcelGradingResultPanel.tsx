"use client";

/**
 * ExcelGradingResultPanel
 *
 * Detailed instructor view of an AI Excel grading result.
 * Shows score, rubric breakdown, structured analysis,
 * flagged issues, feedback, and approve / override controls.
 */

import React, { useState } from "react";
import {
  CheckCircle,
  AlertTriangle,
  BarChart3,
  FileSpreadsheet,
  Clock,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  Edit3,
  ThumbsUp,
  Brain,
  Sparkles,
  Code2,
  PieChart,
  Table2,
  Palette,
  Shield,
  Zap,
  Database,
  Layers,
  TrendingUp,
  Hash,
  LayoutGrid,
  X,
} from "lucide-react";
import ExcelGradingService, {
  ExcelGradingResult,
  ReviewRequest,
} from "@/services/excel-grading.service";

// ─── Helpers ─────────────────────────────────────────────────

function confidenceBadge(c: string) {
  const map: Record<string, string> = {
    high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return map[c] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function gradeColorClass(letter: string) {
  const map: Record<string, string> = {
    A: "from-green-500 to-emerald-500",
    B: "from-blue-500 to-cyan-500",
    C: "from-yellow-500 to-amber-500",
    D: "from-orange-500 to-red-400",
    F: "from-red-500 to-rose-600",
  };
  return map[letter?.[0]] || "from-gray-400 to-gray-500";
}

function percentBar(score: number, max: number, height = "h-2") {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 ${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden`}>
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

/** Stat pill used inside analysis cards */
function StatPill({ label, value, variant = "default" }: {
  label: string;
  value: string | number;
  variant?: "default" | "success" | "warning" | "danger";
}) {
  const bg: Record<string, string> = {
    default: "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300",
    success: "bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300",
    warning: "bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300",
    danger: "bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300",
  };
  return (
    <div className={`px-2.5 py-1.5 rounded-lg ${bg[variant]} text-center`}>
      <p className="text-lg font-bold leading-tight">{value}</p>
      <p className="text-[10px] uppercase font-semibold tracking-wide opacity-70">{label}</p>
    </div>
  );
}

// ─── Analysis Sub-Components ─────────────────────────────────

function WorkbookOverview({ data }: { data: any }) {
  if (!data) return null;
  const sheets = data.workbook_sheets_summary || [];
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <FileSpreadsheet className="h-4 w-4 text-emerald-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Workbook Structure</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Sheets" value={data.workbook?.total_sheets ?? sheets.length} />
        <StatPill label="Total Rows" value={data.workbook?.total_rows ?? "—"} />
        <StatPill label="Total Cols" value={data.workbook?.total_columns ?? "—"} />
      </div>
      {sheets.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700">
                <th className="pb-1.5 font-medium">Sheet</th>
                <th className="pb-1.5 font-medium text-center">Rows</th>
                <th className="pb-1.5 font-medium text-center">Cols</th>
                <th className="pb-1.5 font-medium text-center">Formulas</th>
                <th className="pb-1.5 font-medium text-center">Charts</th>
                <th className="pb-1.5 font-medium text-center">Pivots</th>
              </tr>
            </thead>
            <tbody className="text-gray-700 dark:text-gray-300">
              {sheets.map((s: any, i: number) => (
                <tr key={i} className="border-b border-gray-100 dark:border-gray-800 last:border-0">
                  <td className="py-1.5 font-medium">{s.name}</td>
                  <td className="py-1.5 text-center">{s.rows}</td>
                  <td className="py-1.5 text-center">{s.cols}</td>
                  <td className="py-1.5 text-center">{s.formulas || 0}</td>
                  <td className="py-1.5 text-center">{s.charts || 0}</td>
                  <td className="py-1.5 text-center">{s.pivots || 0}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function FormulaAnalysis({ data }: { data: any }) {
  if (!data) return null;
  const hasAdvanced = data.advanced?.length > 0;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Code2 className="h-4 w-4 text-blue-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Formulas</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Total" value={data.count ?? 0} variant={data.count > 0 ? "success" : "default"} />
        <StatPill label="Complexity" value={`${data.complexity ?? 0}/10`} variant={
          (data.complexity ?? 0) >= 7 ? "success" : (data.complexity ?? 0) >= 4 ? "warning" : "danger"
        } />
        <StatPill label="Categories" value={data.categories?.length ?? 0} />
      </div>
      {data.categories?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.categories.map((cat: string) => (
            <span key={cat} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[11px] rounded-full font-medium">
              {cat}
            </span>
          ))}
        </div>
      )}
      {hasAdvanced && (
        <div>
          <p className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">Advanced Functions</p>
          <div className="flex flex-wrap gap-1.5">
            {data.advanced.map((fn: string) => (
              <span key={fn} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[11px] rounded-full font-medium font-mono">
                {fn}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChartAnalysis({ data }: { data: any }) {
  if (!data || data.count === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <PieChart className="h-4 w-4 text-orange-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Charts</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Total" value={data.count} variant="success" />
      </div>
      {data.types?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.types.map((type: string) => (
            <span key={type} className="px-2 py-0.5 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300 text-[11px] rounded-full font-medium">
              {type}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function PivotAnalysis({ data }: { data: any }) {
  if (!data || data.count === 0) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Table2 className="h-4 w-4 text-violet-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">PivotTables</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Total" value={data.count} variant="success" />
        <StatPill label="Slicers" value={data.has_slicers ? "Yes" : "No"} variant={data.has_slicers ? "success" : "default"} />
        <StatPill label="Calc Fields" value={data.has_calculated_fields ? "Yes" : "No"} variant={data.has_calculated_fields ? "success" : "default"} />
      </div>
    </div>
  );
}

function VBAAnalysis({ data }: { data: any }) {
  if (!data || !data.has_vba) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Zap className="h-4 w-4 text-amber-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">VBA Macros</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Modules" value={data.modules || 0} variant="success" />
        <StatPill label="Procedures" value={data.procedures || 0} />
        <StatPill label="Security" value={data.security_risk || "none"} variant={
          data.security_risk === "none" || data.security_risk === "low" ? "success" : "danger"
        } />
      </div>
    </div>
  );
}

function PowerQueryAnalysis({ data }: { data: any }) {
  if (!data || !data.has_pq) return null;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Database className="h-4 w-4 text-teal-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Power Query</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Queries" value={data.queries || 0} variant="success" />
      </div>
      {data.transformations?.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.transformations.slice(0, 8).map((t: string) => (
            <span key={t} className="px-2 py-0.5 bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-300 text-[11px] rounded-full font-medium">
              {t}
            </span>
          ))}
          {data.transformations.length > 8 && (
            <span className="text-[11px] text-gray-400">+{data.transformations.length - 8} more</span>
          )}
        </div>
      )}
    </div>
  );
}

function FormattingAnalysis({ data }: { data: any }) {
  if (!data) return null;
  const features = [
    { label: "Conditional Formatting", active: data.has_cf },
    { label: "Data Validation", active: data.has_dv },
    { label: "Named Ranges", active: data.has_named_ranges },
  ];
  const activeCount = features.filter((f) => f.active).length;
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-pink-500" />
        <h5 className="text-sm font-semibold text-gray-800 dark:text-gray-200">Formatting &amp; Structure</h5>
      </div>
      <div className="flex gap-2 flex-wrap">
        <StatPill label="Score" value={`${data.score ?? 0}/10`} variant={
          (data.score ?? 0) >= 7 ? "success" : (data.score ?? 0) >= 4 ? "warning" : "default"
        } />
        <StatPill label="Features" value={`${activeCount}/3`} variant={activeCount >= 2 ? "success" : "default"} />
      </div>
      <div className="flex flex-wrap gap-2">
        {features.map((f) => (
          <span
            key={f.label}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium ${
              f.active
                ? "bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300"
                : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-500"
            }`}
          >
            {f.active ? <CheckCircle className="h-3 w-3" /> : <X className="h-3 w-3" />}
            {f.label}
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Props ───────────────────────────────────────────────────

interface Props {
  result: ExcelGradingResult;
  onReviewComplete?: (updated: ExcelGradingResult) => void;
  readOnly?: boolean;
}

// ─── Component ───────────────────────────────────────────────

export default function ExcelGradingResultPanel({
  result,
  onReviewComplete,
  readOnly = false,
}: Props) {
  const [activeTab, setActiveTab] = useState<"rubric" | "analysis" | "feedback">("rubric");
  const [showOverrideForm, setShowOverrideForm] = useState(false);
  const [overrideScore, setOverrideScore] = useState(result.total_score.toString());
  const [overrideGrade, setOverrideGrade] = useState(result.grade_letter);
  const [notes, setNotes] = useState(result.instructor_notes || "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pct = result.max_score > 0 ? Math.round((result.total_score / result.max_score) * 100) : 0;
  const rubricEntries = Object.entries(result.rubric_breakdown || {});
  const ad = result.analysis_data || {} as any;

  // Count analysis features present
  const analysisFeatures = [
    ad.formula_summary?.count > 0,
    ad.charts?.count > 0,
    ad.pivots?.count > 0,
    ad.vba?.has_vba,
    ad.power_query?.has_pq,
  ].filter(Boolean).length;

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
      const { result: updated } = await ExcelGradingService.reviewResult(result.id, payload);
      onReviewComplete?.(updated);
    } catch (err: any) {
      setError(err.message || "Failed to submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ── Score Header ─────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md border border-gray-200 dark:border-gray-700 overflow-hidden">
        {/* Gradient top bar */}
        <div className={`h-1.5 bg-gradient-to-r ${gradeColorClass(result.grade_letter)}`} />

        <div className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="h-5 w-5 text-purple-500" />
            <h3 className="font-bold text-lg text-gray-900 dark:text-white">AI Grading Result</h3>
            <span className={`ml-auto text-xs font-semibold px-2.5 py-0.5 rounded-full ${confidenceBadge(result.confidence)}`}>
              {result.confidence} confidence
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-center gap-5">
            {/* Grade circle */}
            <div className="relative flex-shrink-0">
              <div className={`h-20 w-20 rounded-full bg-gradient-to-br ${gradeColorClass(result.grade_letter)} flex items-center justify-center shadow-lg`}>
                <span className="text-3xl font-extrabold text-white">{result.grade_letter || "–"}</span>
              </div>
              {result.instructor_reviewed && (
                <div className="absolute -bottom-1 -right-1 h-6 w-6 bg-green-500 rounded-full flex items-center justify-center ring-2 ring-white dark:ring-slate-800">
                  <CheckCircle className="h-3.5 w-3.5 text-white" />
                </div>
              )}
            </div>

            {/* Score + meta */}
            <div className="flex-1 space-y-2 text-center sm:text-left w-full">
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {result.total_score}
                <span className="text-base font-normal text-gray-500"> / {result.max_score}</span>
              </p>
              <div className="w-full max-w-sm mx-auto sm:mx-0">
                {percentBar(result.total_score, result.max_score)}
              </div>
              <div className="flex flex-wrap gap-3 justify-center sm:justify-start text-xs text-gray-500 dark:text-gray-400">
                {result.file_name && (
                  <span className="flex items-center gap-1">
                    <FileSpreadsheet className="h-3 w-3" /> {result.file_name}
                  </span>
                )}
                {result.processing_time_seconds != null && (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {result.processing_time_seconds.toFixed(1)}s
                  </span>
                )}
                {result.graded_at && (
                  <span className="flex items-center gap-1">
                    <Sparkles className="h-3 w-3" /> {new Date(result.graded_at).toLocaleString()}
                  </span>
                )}
                {analysisFeatures > 0 && (
                  <span className="flex items-center gap-1">
                    <Layers className="h-3 w-3" /> {analysisFeatures} feature{analysisFeatures > 1 ? "s" : ""} detected
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tabs ─────────────────────────────────────── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {([
            { id: "rubric" as const, label: "Rubric", icon: BarChart3 },
            { id: "analysis" as const, label: "Analysis", icon: Layers },
            { id: "feedback" as const, label: "Feedback", icon: MessageSquare },
          ]).map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-3 text-sm font-medium transition-colors
                ${activeTab === tab.id
                  ? "text-purple-600 dark:text-purple-400 border-b-2 border-purple-600 dark:border-purple-400 bg-purple-50/50 dark:bg-purple-900/10"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700/50"
                }`}
            >
              <tab.icon className="h-4 w-4" />
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-5">
          {/* ── Rubric Tab ─────────────── */}
          {activeTab === "rubric" && rubricEntries.length > 0 && (
            <div className="space-y-4">
              {rubricEntries.map(([key, item]) => (
                <div key={key} className="group">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <div className={`h-2 w-2 rounded-full ${
                        item.max > 0 && item.score / item.max >= 0.8
                          ? "bg-green-500"
                          : item.max > 0 && item.score / item.max >= 0.6
                          ? "bg-yellow-500"
                          : item.max === 0
                          ? "bg-gray-300 dark:bg-gray-600"
                          : "bg-red-500"
                      }`} />
                      <span className="text-sm font-medium text-gray-800 dark:text-gray-200 capitalize">
                        {key.replace(/_/g, " ")}
                      </span>
                    </div>
                    <span className="text-sm font-bold text-gray-900 dark:text-white tabular-nums">
                      {item.score}/{item.max}
                    </span>
                  </div>
                  {percentBar(item.score, item.max)}
                  {item.comment && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5 pl-4 border-l-2 border-gray-200 dark:border-gray-700 italic">
                      {item.comment}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {activeTab === "rubric" && rubricEntries.length === 0 && (
            <p className="text-sm text-gray-400 text-center py-6">No rubric data available.</p>
          )}

          {/* ── Analysis Tab ──────────── */}
          {activeTab === "analysis" && (
            <div className="space-y-6">
              {Object.keys(ad).length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-6">No analysis data available.</p>
              ) : (
                <>
                  <WorkbookOverview data={ad} />
                  {ad.formula_summary && <FormulaAnalysis data={ad.formula_summary} />}
                  {ad.charts && ad.charts.count > 0 && <ChartAnalysis data={ad.charts} />}
                  {ad.pivots && ad.pivots.count > 0 && <PivotAnalysis data={ad.pivots} />}
                  {ad.vba && ad.vba.has_vba && <VBAAnalysis data={ad.vba} />}
                  {ad.power_query && ad.power_query.has_pq && <PowerQueryAnalysis data={ad.power_query} />}
                  {ad.formatting && <FormattingAnalysis data={ad.formatting} />}
                </>
              )}
            </div>
          )}

          {/* ── Feedback Tab ──────────── */}
          {activeTab === "feedback" && (
            <div className="space-y-5">
              {result.overall_feedback ? (
                <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                  {result.overall_feedback}
                </div>
              ) : (
                <p className="text-sm text-gray-400 text-center py-6">No feedback generated.</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Flagged Issues ──────────────────────────── */}
      {result.flagged_issues && result.flagged_issues.length > 0 && (
        <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-700">
          <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3 flex items-center gap-2 text-sm">
            <AlertTriangle className="h-4 w-4" />
            Flagged Issues ({result.flagged_issues.length})
          </h4>
          <div className="space-y-2">
            {result.flagged_issues.map((issue, i) => (
              <div key={i} className="flex items-start gap-2 text-sm text-amber-700 dark:text-amber-200">
                <span className="font-bold uppercase text-[10px] bg-amber-200 dark:bg-amber-800 px-1.5 py-0.5 rounded mt-0.5 flex-shrink-0">
                  {issue.type}
                </span>
                <span>{issue.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Instructor Review Controls ──────────────── */}
      {!readOnly && !result.instructor_reviewed && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 border border-gray-200 dark:border-gray-700 space-y-4">
          <h4 className="font-semibold text-gray-900 dark:text-white flex items-center gap-2 text-sm">
            <Edit3 className="h-4 w-4 text-violet-500" />
            Instructor Review
          </h4>

          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 resize-none"
            placeholder="Add review notes (optional)..."
          />

          {showOverrideForm && (
            <div className="grid grid-cols-2 gap-3 p-3 bg-orange-50 dark:bg-orange-900/10 rounded-lg border border-orange-200 dark:border-orange-800">
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Score</label>
                <input
                  type="number" step="0.5" min="0" max={result.max_score}
                  value={overrideScore}
                  onChange={(e) => setOverrideScore(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">Grade</label>
                <select
                  value={overrideGrade}
                  onChange={(e) => setOverrideGrade(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2 text-sm"
                >
                  {["A+","A","A-","B+","B","B-","C+","C","C-","D+","D","F"].map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => handleReview("approve")}
              disabled={submitting}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ThumbsUp className="h-4 w-4" />
              {submitting ? "Saving..." : "Approve"}
            </button>
            {!showOverrideForm ? (
              <button
                onClick={() => setShowOverrideForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Edit3 className="h-4 w-4" /> Override
              </button>
            ) : (
              <>
                <button
                  onClick={() => handleReview("override")}
                  disabled={submitting}
                  className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                >
                  <Edit3 className="h-4 w-4" />
                  {submitting ? "Saving..." : "Submit Override"}
                </button>
                <button
                  onClick={() => setShowOverrideForm(false)}
                  className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── Already Reviewed Badge ──────────────────── */}
      {result.instructor_reviewed && (
        <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700 flex items-start gap-3">
          <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
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
                &ldquo;{result.instructor_notes}&rdquo;
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
