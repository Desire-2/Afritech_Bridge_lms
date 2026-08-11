"use client";

/**
 * AI Grading Dashboard
 *
 * Aggregates all AI-powered Excel grading results across courses.
 * Shows:
 *   - Course selector
 *   - Aggregate stats cards (total graded, avg score, approval rate, pending review)
 *   - Grade distribution chart
 *   - Confidence breakdown
 *   - Rubric generation / learning stats
 *   - Recent grading results table with rubric metadata (task count, theory questions, formulas)
 *   - Drill-down to individual result detail
 */

import React, { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Brain,
  BarChart3,
  TrendingUp,
  Users,
  Shield,
  Layers,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Loader2,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  BookOpen,
  GraduationCap,
  Filter,
  ScanSearch,
  BadgeCheck,
  ListChecks,
} from "lucide-react";
import ExcelGradingService, {
  ExcelGradingResult,
  GradingStats,
  LearningStats,
  AssignmentAnalysis,
  AssessmentRequirement,
} from "@/services/excel-grading.service";
import InstructorService from "@/services/instructor.service";
import { Course } from "@/types/api";

// ─── Helpers ──────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  gradient,
  bgLight,
  iconColor,
  urgent,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ElementType;
  gradient: string;
  bgLight: string;
  iconColor: string;
  urgent?: boolean;
}) {
  return (
    <div className="relative bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-shadow h-full">
      <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${gradient}`} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between mb-3">
          <div className={`rounded-xl ${bgLight} p-2.5 sm:p-3`}>
            <Icon className={`h-5 w-5 sm:h-6 sm:w-6 ${iconColor}`} />
          </div>
          {urgent && (
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
            </span>
          )}
        </div>
        <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
          {value}
        </div>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
          {label}
        </p>
        {sub && (
          <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-1.5 truncate">
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}

function MiniProgressBar({ score, max, height = "h-2" }: { score: number; max: number; height?: string }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const color = pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className={`${height} bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden w-full`}>
      <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

function ConfidenceBadge(c: string) {
  const map: Record<string, string> = {
    high: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    medium: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
    low: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  };
  return map[c] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
}

function GradeCircle({ letter, size = "h-10 w-10" }: { letter: string; size?: string }) {
  const map: Record<string, string> = {
    A: "from-green-500 to-emerald-500",
    B: "from-blue-500 to-cyan-500",
    C: "from-yellow-500 to-amber-500",
    D: "from-orange-500 to-red-400",
    F: "from-red-500 to-rose-600",
  };
  const gradient = map[letter?.[0]] || "from-gray-400 to-gray-500";
  return (
    <div className={`${size} rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shadow-sm flex-shrink-0`}>
      <span className="text-xs font-extrabold text-white">{letter || "–"}</span>
    </div>
  );
}

function SkeletonBar({ className = "" }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded bg-gray-200 dark:bg-gray-700 ${className}`} />
  );
}

const REQ_TYPE_COLORS: Record<string, string> = {
  FUNCTION_REQUIREMENT: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  FORMULA_REQUIREMENT: "bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300",
  VBA_REQUIREMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  CODE_STRUCTURE_REQUIREMENT: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  POWER_QUERY_REQUIREMENT: "bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300",
  DAX_REQUIREMENT: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  CHART_REQUIREMENT: "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300",
  PIVOT_REQUIREMENT: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-300",
  SHEET_REQUIREMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  CELL_REQUIREMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  VALUE_REQUIREMENT: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300",
  DATA_VALIDATION_REQUIREMENT: "bg-lime-100 text-lime-800 dark:bg-lime-900/30 dark:text-lime-300",
  THEORY_REQUIREMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  REFLECTION_REQUIREMENT: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  BUSINESS_LOGIC_REQUIREMENT: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  WORKBOOK_BEHAVIOR_REQUIREMENT: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
  STRUCTURE_REQUIREMENT: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  FORMAT_REQUIREMENT: "bg-fuchsia-100 text-fuchsia-800 dark:bg-fuchsia-900/30 dark:text-fuchsia-300",
  DELIVERABLE_REQUIREMENT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
  DOCUMENTATION_REQUIREMENT: "bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300",
};

// ─── Main Component ───────────────────────────────────────────

export default function AIGradingDashboardPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | "all">("all");
  const [stats, setStats] = useState<GradingStats | null>(null);
  const [learningStats, setLearningStats] = useState<LearningStats | null>(null);
  const [recentResults, setRecentResults] = useState<ExcelGradingResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [expandedResult, setExpandedResult] = useState<number | null>(null);
  const perPage = 10;

  // ── Assessment Contract Preview state ─────────────────────────
  const [assignmentIdInput, setAssignmentIdInput] = useState("");
  const [analysis, setAnalysis] = useState<AssignmentAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [approveMsg, setApproveMsg] = useState<string | null>(null);

  const handleAnalyze = async () => {
    const id = parseInt(assignmentIdInput.trim(), 10);
    if (!id || Number.isNaN(id)) {
      setAnalyzeError("Enter a valid assignment ID.");
      return;
    }
    setAnalysisLoading(true);
    setAnalyzeError(null);
    setApproveMsg(null);
    setAnalysis(null);
    try {
      const data = await ExcelGradingService.analyzeAssignment(id);
      setAnalysis(data);
    } catch (err: any) {
      setAnalyzeError(err.message || "Failed to analyze assignment.");
    } finally {
      setAnalysisLoading(false);
    }
  };

  const handleApproveRubric = async () => {
    // Prefer the analyzed assignment id so an edited input can never approve
    // a different assignment than the one being previewed.
    const id = analysis?.assignment?.id || parseInt(assignmentIdInput.trim(), 10);
    if (!id) return;
    setApproving(true);
    setApproveMsg(null);
    try {
      const res = await ExcelGradingService.approveRubric(id);
      setApproveMsg(res.message || "Rubric approved successfully.");
      setAnalysis((prev) =>
        prev
          ? { ...prev, rubric_generated: { ...prev.rubric_generated, approved: true } }
          : prev,
      );
    } catch (err: any) {
      setApproveMsg(err.message || "Rubric approval failed.");
    } finally {
      setApproving(false);
    }
  };

  // ── Fetch courses on mount ──────────────────────────────────
  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const data = await InstructorService.getMyCourses();
      setCourses(Array.isArray(data) ? data : []);
    } catch {
      setCourses([]);
    }
  };

  // ── Fetch stats + history when course selection changes ────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const courseIdNum = typeof selectedCourseId === "number" ? selectedCourseId : 0;

      // Fetch stats, learning stats, and history in parallel
      const [statsData, learningData, historyData] = await Promise.all([
        courseIdNum > 0
          ? ExcelGradingService.getStats(courseIdNum).catch(() => null)
          : Promise.resolve(null),
        courseIdNum > 0
          ? ExcelGradingService.getLearningStats(courseIdNum).catch(() => null)
          : Promise.resolve(null),
        ExcelGradingService.getHistory({
          course_id: courseIdNum > 0 ? courseIdNum : undefined,
          page: 1,
          per_page: perPage,
        }).catch(() => null),
      ]);

      setStats(statsData);
      setLearningStats(learningData);
      setRecentResults(historyData?.results || []);
      setPage(1);
    } catch (err: any) {
      setError(err.message || "Failed to load AI grading data");
    } finally {
      setLoading(false);
    }
  }, [selectedCourseId]);

  useEffect(() => {
    if (courses.length > 0) {
      fetchData();
    }
  }, [fetchData, courses.length]);

  // ── Derived data ────────────────────────────────────────────
  const pendingReviewCount = useMemo(() => {
    return recentResults.filter((r) => r.manual_review_required && !r.instructor_reviewed).length;
  }, [recentResults]);

  const totalTheoryTasks = useMemo(() => {
    let count = 0;
    for (const r of recentResults) {
      const meta = r.rubric_data?.rubric_metadata;
      if (meta) {
        count += meta.theory_tasks || 0;
      }
    }
    return count;
  }, [recentResults]);

  // Points per requirement id from the generated rubric (hoisted out of the row map).
  const rubricPointsById = useMemo(() => {
    const map: Record<string, number> = {};
    for (const c of analysis?.rubric_generated?.criteria || []) map[c.id] = c.max_points;
    return map;
  }, [analysis]);

  // ── Render ──────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-600 via-purple-600 to-indigo-500 p-6 sm:p-8 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="h-5 w-5 text-violet-200" />
            <span className="text-sm font-medium text-white/80">AI-Powered Grading</span>
          </div>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
            AI Grading Dashboard
          </h1>
          <p className="mt-2 text-sm text-white/70 max-w-2xl">
            Aggregate view of all AI-graded Excel submissions across your courses.
            Monitor scores, review flagged items, and track rubric generation.
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <GraduationCap className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <select
            value={selectedCourseId === "all" ? "all" : selectedCourseId}
            onChange={(e) => {
              const val = e.target.value;
              setSelectedCourseId(val === "all" ? "all" : parseInt(val));
            }}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-800 text-gray-900 dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-purple-500 appearance-none cursor-pointer"
          >
            <option value="all">All Courses</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-700">
          <AlertTriangle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-800 dark:text-red-300">{error}</p>
            <button onClick={fetchData} className="text-xs text-red-600 dark:text-red-400 hover:underline mt-1">
              Try again
            </button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-5">
                <SkeletonBar className="h-6 w-6 rounded-xl mb-3" />
                <SkeletonBar className="h-7 w-20 mb-1" />
                <SkeletonBar className="h-4 w-24 mb-1" />
                <SkeletonBar className="h-3 w-16" />
              </div>
            ))}
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <SkeletonBar className="h-5 w-48 mb-4" />
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-gray-700 last:border-0">
                <SkeletonBar className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <SkeletonBar className="h-4 w-40" />
                  <SkeletonBar className="h-3 w-24" />
                </div>
                <SkeletonBar className="h-5 w-16 rounded-full" />
                <SkeletonBar className="h-5 w-12 rounded" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Stats Cards */}
      {!loading && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <StatCard
            label="Total Graded"
            value={stats?.total_graded ?? recentResults.length}
            sub={selectedCourseId === "all" ? "Across all courses" : undefined}
            icon={BarChart3}
            gradient="from-violet-500 to-purple-400"
            bgLight="bg-violet-50 dark:bg-violet-950/30"
            iconColor="text-violet-600 dark:text-violet-400"
          />
          <StatCard
            label="Average Score"
            value={stats?.average_percentage != null ? `${Math.round(stats.average_percentage)}%` : "—"}
            sub={stats?.average_score != null ? `${stats.average_score.toFixed(1)} pts` : undefined}
            icon={TrendingUp}
            gradient="from-emerald-500 to-teal-400"
            bgLight="bg-emerald-50 dark:bg-emerald-950/30"
            iconColor="text-emerald-600 dark:text-emerald-400"
          />
          <StatCard
            label="Approval Rate"
            value={learningStats?.approval_rate != null ? `${Math.round(learningStats.approval_rate * 100)}%` : "—"}
            sub={learningStats ? `${learningStats.total_reviews} reviews` : undefined}
            icon={Shield}
            gradient="from-blue-500 to-cyan-400"
            bgLight="bg-blue-50 dark:bg-blue-950/30"
            iconColor="text-blue-600 dark:text-blue-400"
          />
          <StatCard
            label="Pending Review"
            value={pendingReviewCount}
            sub={`${totalTheoryTasks} theory questions flagged`}
            icon={AlertTriangle}
            gradient={`from-${pendingReviewCount > 0 ? "amber-500 to-orange-400" : "green-500 to-emerald-400"}`}
            bgLight={pendingReviewCount > 0 ? "bg-amber-50 dark:bg-amber-950/30" : "bg-green-50 dark:bg-green-950/30"}
            iconColor={pendingReviewCount > 0 ? "text-amber-600 dark:text-amber-400" : "text-green-600 dark:text-green-400"}
            urgent={pendingReviewCount > 0}
          />
        </div>
      )}

      {/* Secondary Stats Row: Rubric generation + Confidence */}
      {!loading && learningStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Rubrics Generated
            </p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">
              {learningStats.generated_rubrics || 0}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {learningStats.approved_rubrics || 0} approved
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Avg Override Delta
            </p>
            <p className={`text-xl font-bold ${(learningStats.average_override_delta || 0) !== 0 ? "text-amber-600 dark:text-amber-400" : "text-gray-900 dark:text-white"}`}>
              {learningStats.average_override_delta != null
                ? `${learningStats.average_override_delta >= 0 ? "+" : ""}${learningStats.average_override_delta.toFixed(1)} pts`
                : "—"}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Instructor vs AI
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Confidence Trend
            </p>
            <p className={`text-xl font-bold ${learningStats.confidence_trend === "increasing" ? "text-green-600 dark:text-green-400" : learningStats.confidence_trend === "decreasing" ? "text-red-600 dark:text-red-400" : "text-gray-900 dark:text-white"}`}>
              {learningStats.confidence_trend
                ? learningStats.confidence_trend.charAt(0).toUpperCase() + learningStats.confidence_trend.slice(1)
                : "—"}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              Over last {learningStats.total_reviews || 0} reviews
            </p>
          </div>
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <p className="text-[10px] uppercase font-semibold tracking-wide text-gray-500 dark:text-gray-400 mb-1">
              Grade Distribution
            </p>
            <p className="text-lg font-bold text-gray-900 dark:text-white">
              {stats?.grade_distribution
                ? Object.entries(stats.grade_distribution)
                    .sort(([a], [b]) => b.localeCompare(a))
                    .slice(0, 3)
                    .map(([g, c]) => `${g}: ${c}`)
                    .join(" · ")
                : "—"}
            </p>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              {stats ? `${Object.values(stats.grade_distribution).reduce((s, v) => s + v, 0)} total` : ""}
            </p>
          </div>
        </div>
      )}

      {/* Grade Distribution Chart */}
      {!loading && stats?.grade_distribution && Object.keys(stats.grade_distribution).length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">Grade Distribution</h3>
          </div>
          <div className="flex items-end gap-2 h-32">
            {Object.entries(stats.grade_distribution)
              .sort(([a], [b]) => b.localeCompare(a))
              .map(([grade, count]) => {
                const maxCount = Math.max(...Object.values(stats!.grade_distribution));
                const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
                const colorMap: Record<string, string> = {
                  A: "bg-green-500", B: "bg-blue-500", C: "bg-yellow-500",
                  D: "bg-orange-500", F: "bg-red-500",
                };
                return (
                  <div key={grade} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-xs font-bold text-gray-600 dark:text-gray-400">{count}</span>
                    <div className="w-full rounded-t-md overflow-hidden" style={{ height: `${Math.max(pct, 4)}%` }}>
                      <div className={`h-full w-full ${colorMap[grade] || "bg-gray-400"}`} />
                    </div>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">{grade}</span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Recent Results Table */}
      {!loading && (
        <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Table header */}
          <div className="p-5 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-purple-500" />
                <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
                  Recent AI Grading Results
                </h3>
                <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  ({recentResults.length} result{recentResults.length !== 1 ? "s" : ""})
                </span>
              </div>
            </div>
          </div>

          {recentResults.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <div className="rounded-full bg-gray-100 dark:bg-gray-800 p-4">
                <Brain className="h-8 w-8 text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No AI grading results yet.</p>
              {selectedCourseId === "all" ? (
                <p className="text-xs text-gray-400 dark:text-gray-500">Grade an Excel submission to see results here.</p>
              ) : (
                <p className="text-xs text-gray-400 dark:text-gray-500">No results for this course. Try a different course or grade some submissions.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/80">
                    <th className="px-5 py-3 font-semibold tracking-wide">Student</th>
                    <th className="px-4 py-3 font-semibold tracking-wide">Score</th>
                    <th className="px-4 py-3 font-semibold tracking-wide">Confidence</th>
                    <th className="px-4 py-3 font-semibold tracking-wide">Tasks</th>
                    <th className="px-4 py-3 font-semibold tracking-wide">Rubric</th>
                    <th className="px-4 py-3 font-semibold tracking-wide">Status</th>
                    <th className="px-4 py-3 font-semibold tracking-wide text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                  {recentResults.map((r) => {
                    const pct = r.max_score > 0 ? Math.round((r.total_score / r.max_score) * 100) : 0;
                    const meta = r.rubric_data?.rubric_metadata;
                    const needsReview = r.manual_review_required && !r.instructor_reviewed;
                    const isExpanded = expandedResult === r.id;

                    return (
                      <React.Fragment key={r.id}>
                        <tr
                          className={`hover:bg-gray-50 dark:hover:bg-slate-700/50 transition-colors cursor-pointer ${
                            needsReview ? "bg-amber-50/40 dark:bg-amber-900/5" : ""
                          }`}
                          onClick={() => setExpandedResult(isExpanded ? null : r.id)}
                        >
                          {/* Student */}
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-3">
                              <GradeCircle letter={r.grade_letter} size="h-9 w-9" />
                              <div>
                                <p className="font-medium text-gray-900 dark:text-white text-sm">
                                  {r.student_name || `Student #${r.student_id}`}
                                </p>
                                {r.file_name && (
                                  <p className="text-[11px] text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                                    <FileSpreadsheet className="h-3 w-3" />
                                    {r.file_name}
                                  </p>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* Score */}
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col gap-1 min-w-[100px]">
                              <span className="font-bold text-gray-900 dark:text-white tabular-nums">
                                {r.total_score}/{r.max_score}
                              </span>
                              <MiniProgressBar score={r.total_score} max={r.max_score} height="h-1.5" />
                              <span className="text-[11px] text-gray-500 dark:text-gray-400">{pct}%</span>
                            </div>
                          </td>

                          {/* Confidence */}
                          <td className="px-4 py-3.5">
                            <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${ConfidenceBadge(r.confidence)}`}>
                              {r.confidence}
                            </span>
                          </td>

                          {/* Tasks */}
                          <td className="px-4 py-3.5">
                            {meta ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {meta.total_tasks} tasks
                                </span>
                                {meta.theory_tasks > 0 && (
                                  <span className="text-[10px] text-amber-600 dark:text-amber-400 flex items-center gap-1">
                                    <BookOpen className="h-3 w-3" />
                                    {meta.theory_tasks} theory
                                  </span>
                                )}
                                {meta.all_formulas && meta.all_formulas.length > 0 && (
                                  <span className="text-[10px] text-blue-600 dark:text-blue-400 flex items-center gap-1">
                                    <Filter className="h-3 w-3" />
                                    {meta.all_formulas.length} formulas
                                  </span>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>

                          {/* Rubric */}
                          <td className="px-4 py-3.5">
                            {meta ? (
                              <div className="flex flex-col gap-0.5">
                                <span className="text-xs text-gray-700 dark:text-gray-300">
                                  {meta.auto_gradable_tasks}/{meta.total_tasks} auto
                                </span>
                                {meta.total_deliverables_requested > 0 && (
                                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                                    {meta.total_deliverables_requested} deliverables
                                  </span>
                                )}
                              </div>
                            ) : r.manual_review_required ? (
                              <span className="text-xs text-amber-600 dark:text-amber-400">Manual review</span>
                            ) : (
                              <span className="text-xs text-gray-400">—</span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="px-4 py-3.5">
                            {r.instructor_reviewed ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-green-700 dark:text-green-400">
                                <CheckCircle className="h-3.5 w-3.5" /> Reviewed
                              </span>
                            ) : needsReview ? (
                              <span className="flex items-center gap-1 text-xs font-medium text-amber-700 dark:text-amber-400">
                                <AlertTriangle className="h-3.5 w-3.5" /> Needs Review
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400">
                                <Clock className="h-3.5 w-3.5" /> Pending
                              </span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3.5 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Link
                                href={`/instructor/grading/${r.submission_type}/${r.assignment_submission_id || r.project_submission_id}`}
                                className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Link>
                              {isExpanded ? (
                                <ChevronUp className="h-4 w-4 text-gray-400" />
                              ) : (
                                <ChevronDown className="h-4 w-4 text-gray-400" />
                              )}
                            </div>
                          </td>
                        </tr>

                        {/* Expanded Row: Rubric Metadata Detail */}
                        {isExpanded && meta && (
                          <tr className="bg-gray-50/50 dark:bg-slate-800/40">
                            <td colSpan={7} className="px-5 py-4">
                              <div className="space-y-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                <div className="flex items-center gap-2 mb-2">
                                  <Brain className="h-4 w-4 text-purple-500" />
                                  <h4 className="text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                                    Rubric Metadata — Task Checklist
                                  </h4>
                                  <span className="ml-auto text-[10px] text-gray-400">
                                    Generated via {r.rubric_data?.generation_method || "instruction analysis"}
                                  </span>
                                </div>

                                {/* Summary badges */}
                                <div className="flex flex-wrap gap-1.5 mb-3">
                                  <span className="px-2 py-0.5 bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 text-[10px] rounded-full font-semibold">
                                    {meta.total_tasks} Tasks
                                  </span>
                                  <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[10px] rounded-full font-semibold">
                                    {meta.all_formulas?.length || 0} Formulas
                                  </span>
                                  {meta.theory_tasks > 0 && (
                                    <span className="px-2 py-0.5 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 text-[10px] rounded-full font-semibold">
                                      {meta.theory_tasks} Theory
                                    </span>
                                  )}
                                  <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-[10px] rounded-full font-semibold">
                                    {meta.auto_gradable_tasks} Auto-gradable
                                  </span>
                                </div>

                                {/* Formulas list */}
                                {meta.all_formulas && meta.all_formulas.length > 0 && (
                                  <div className="flex flex-wrap gap-1.5 items-center">
                                    <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Expected Formulas:</span>
                                    {meta.all_formulas.map((f: string) => (
                                      <span key={f} className="px-1.5 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 text-[10px] rounded font-mono border border-blue-200 dark:border-blue-800">
                                        {f}
                                      </span>
                                    ))}
                                  </div>
                                )}

                                {/* Tasks summary list */}
                                {meta.tasks_summary && meta.tasks_summary.length > 0 && (
                                  <div className="space-y-1.5 mt-2">
                                    {meta.tasks_summary.map((t: any) => (
                                      <div key={t.number} className={`flex items-start gap-2 px-3 py-2 rounded-lg border text-xs ${
                                        t.is_theory
                                          ? "bg-amber-50/50 dark:bg-amber-900/10 border-amber-200/50 dark:border-amber-700/30"
                                          : "bg-white dark:bg-slate-800/60 border-gray-200 dark:border-gray-700"
                                      }`}>
                                        <span className={`flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center text-[9px] font-bold ${
                                          t.is_theory
                                            ? "bg-amber-200 dark:bg-amber-700 text-amber-800 dark:text-amber-200"
                                            : "bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300"
                                        }`}>
                                          {t.number}
                                        </span>
                                        <div className="flex-1 min-w-0">
                                          <p className="text-gray-700 dark:text-gray-300">{t.text}</p>
                                          {t.formulas && t.formulas.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                              {t.formulas.map((f: string) => (
                                                <span key={f} className="px-1 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 text-[9px] rounded font-mono">{f}</span>
                                              ))}
                                            </div>
                                          )}
                                          {t.is_theory && (
                                            <span className="inline-block mt-0.5 px-1.5 py-0.5 bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[9px] font-bold rounded-full">
                                              MANUAL REVIEW
                                            </span>
                                          )}
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {/* Theory questions */}
                                {meta.theory_questions && meta.theory_questions.length > 0 && (
                                  <div className="bg-amber-50 dark:bg-amber-900/10 rounded-lg p-3 border border-amber-200 dark:border-amber-700 mt-2">
                                    <p className="text-xs font-bold text-amber-800 dark:text-amber-300 flex items-center gap-1.5 mb-1">
                                      <BookOpen className="h-3.5 w-3.5" />
                                      {meta.theory_questions.length} Theory Question(s) — Manual Review Required
                                    </p>
                                    {meta.theory_questions.map((tq: any) => (
                                      <p key={tq.task_number} className="text-[11px] text-amber-700 dark:text-amber-300 ml-5">
                                        Task {tq.task_number}: {tq.text}
                                      </p>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Assessment Contract Preview (dry-run, spec 36-37) ──── */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-5 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <ScanSearch className="h-5 w-5 text-purple-500" />
            <h3 className="font-semibold text-gray-900 dark:text-white text-sm">
              Assessment Contract Preview
            </h3>
            <span className="text-[10px] text-gray-400 ml-1">
              Dry-run interpretation — no submission is graded
            </span>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
            See how the engine reads an assignment&apos;s instructions: detected requirements, generated rubric, selected analyzers, and ambiguities — then approve the rubric for reuse.
          </p>
        </div>

        <div className="p-5 space-y-4">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row gap-2.5">
            <input
              type="number"
              min="1"
              value={assignmentIdInput}
              onChange={(e) => setAssignmentIdInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              placeholder="Assignment ID (e.g. 6)"
              className="flex-1 max-w-[220px] rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-slate-900 text-gray-900 dark:text-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <button
              onClick={handleAnalyze}
              disabled={analysisLoading}
              className="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-sm font-medium transition-colors disabled:opacity-50"
            >
              <ScanSearch className="h-4 w-4" />
              {analysisLoading ? "Analyzing..." : "Analyze"}
            </button>
            {analysis?.rubric_generated && (
              <button
                onClick={handleApproveRubric}
                disabled={approving || analysis.rubric_generated.approved}
                className={`flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-colors disabled:opacity-50 ${
                  analysis.rubric_generated.approved
                    ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 cursor-default"
                    : "bg-green-600 hover:bg-green-700 text-white"
                }`}
              >
                <BadgeCheck className="h-4 w-4" />
                {analysis.rubric_generated.approved
                  ? "Rubric Approved"
                  : approving
                  ? "Approving..."
                  : "Approve Rubric"}
              </button>
            )}
          </div>

          {analyzeError && (
            <p className="text-sm text-red-600 dark:text-red-400">{analyzeError}</p>
          )}
          {approveMsg && (
            <p className="text-sm text-green-600 dark:text-green-400">{approveMsg}</p>
          )}

          {/* Analysis result */}
          {analysis && (
            <div className="space-y-4 animate-in fade-in slide-in-from-top-2 duration-200">
              {/* Header: title + difficulty */}
              <div className="flex flex-wrap items-center gap-2.5 p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-900/50">
                <BookOpen className="h-4 w-4 text-purple-500" />
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {analysis.assignment.title || `Assignment #${analysis.assignment.id}`}
                </p>
                <span className="px-2 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[11px] font-bold">
                  {analysis.difficulty.level} · {Math.round(analysis.difficulty.confidence * 100)}% confidence
                </span>
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] font-mono">
                  {analysis.source_hash.slice(0, 12)}…
                </span>
              </div>

              {/* Scope chips from requirement categories */}
              {analysis.requirements_detected.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {Array.from(new Set(analysis.requirements_detected.map((r) => r.category))).map((cat) => (
                    <span key={cat} className="px-2 py-0.5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 text-[11px] rounded-full font-medium">
                      {cat}
                    </span>
                  ))}
                  <span className="px-2 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 text-[11px] rounded-full font-medium">
                    {analysis.requirements_detected.length} requirements
                  </span>
                </div>
              )}

              {/* Analyzers selected */}
              {analysis.analyzers_selected.length > 0 && (
                <div className="flex flex-wrap gap-1.5 items-center">
                  <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400 uppercase">Analyzers:</span>
                  {analysis.analyzers_selected.map((a) => (
                    <span key={a} className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-[11px] rounded-full font-medium">
                      {a}
                    </span>
                  ))}
                </div>
              )}

              {/* Requirements table */}
              {analysis.requirements_detected.length > 0 && (
                <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-slate-800/80">
                        <th className="px-3 py-2.5 font-semibold">ID</th>
                        <th className="px-3 py-2.5 font-semibold">Type</th>
                        <th className="px-3 py-2.5 font-semibold">Requirement</th>
                        <th className="px-3 py-2.5 font-semibold">Criticality</th>
                        <th className="px-3 py-2.5 font-semibold">Method</th>
                        <th className="px-3 py-2.5 font-semibold text-right">Points</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {analysis.requirements_detected.map((req: AssessmentRequirement) => {
                        return (
                          <tr key={req.id} className="align-top">
                            <td className="px-3 py-2.5 font-mono text-gray-500 dark:text-gray-400">{req.id}</td>
                            <td className="px-3 py-2.5">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${REQ_TYPE_COLORS[req.type] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"}`}>
                                {req.type.replace(/_/g, " ")}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-gray-700 dark:text-gray-300">
                              {req.requirement}
                              {req.verification?.target_cells?.length > 0 && (
                                <span className="block text-[10px] font-mono text-emerald-600 dark:text-emerald-400 mt-0.5">
                                  {req.verification.expected_functions?.join(", ") || ""}
                                  {req.verification.expected_functions?.length ? " → " : ""}
                                  {req.verification.target_cells.map((t) => t.cell).join(", ")}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded-full ${
                                req.criticality === "critical"
                                  ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                                  : req.criticality === "major"
                                  ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}>
                                {req.criticality}
                              </span>
                            </td>
                            <td className="px-3 py-2.5">
                              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                req.method_constraint === "strict"
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                                  : req.method_constraint === "preferred"
                                  ? "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300"
                                  : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                              }`}>
                                {req.method_constraint}
                              </span>
                            </td>
                            <td className="px-3 py-2.5 text-right font-bold text-gray-800 dark:text-gray-200 tabular-nums">
                              {rubricPointsById[req.id] != null ? rubricPointsById[req.id] : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Ambiguities + evidence strategies */}
              {(analysis.potential_ambiguities.length > 0 || analysis.evidence_strategies.length > 0) && (
                <div className="grid sm:grid-cols-2 gap-3">
                  {analysis.potential_ambiguities.length > 0 && (
                    <div className="rounded-xl border border-amber-200 dark:border-amber-700 bg-amber-50 dark:bg-amber-900/10 p-3">
                      <p className="text-[11px] font-bold text-amber-800 dark:text-amber-300 mb-1.5 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        Potential Ambiguities ({analysis.potential_ambiguities.length})
                      </p>
                      <ul className="space-y-1">
                        {analysis.potential_ambiguities.slice(0, 8).map((a, i) => (
                          <li key={i} className="text-[11px] text-amber-700 dark:text-amber-300">• {a}</li>
                        ))}
                        {analysis.potential_ambiguities.length > 8 && (
                          <li className="text-[11px] text-amber-600 dark:text-amber-400">+{analysis.potential_ambiguities.length - 8} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                  {analysis.evidence_strategies.length > 0 && (
                    <div className="rounded-xl border border-gray-200 dark:border-gray-700 p-3">
                      <p className="text-[11px] font-bold text-gray-600 dark:text-gray-300 mb-1.5 flex items-center gap-1">
                        <ListChecks className="h-3.5 w-3.5" />
                        Evidence Strategies ({analysis.evidence_strategies.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {analysis.evidence_strategies.map((s) => (
                          <span key={s} className="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-[10px] rounded font-mono">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
