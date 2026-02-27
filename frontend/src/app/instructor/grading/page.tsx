"use client";

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { useSearchParams, useRouter } from 'next/navigation';
import GradingService, {
  AssignmentSubmission,
  ProjectSubmission,
  GradingSummary,
  SubmissionFilters
} from '@/services/grading.service';
import { Course } from '@/types/api';
import {
  Clock, CheckCircle, AlertCircle, User, BookOpen, Calendar, Award,
  Search, Filter, RefreshCw, Repeat, AlertTriangle, FileEdit, Zap,
  Download, CheckSquare, Users, ChevronRight, ArrowLeft, GraduationCap,
  BarChart3, Layers
} from 'lucide-react';
import { QuickGradingModal } from '@/components/grading/QuickGradingModal';

// API Base URL
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5001/api/v1';

type GradingItem = {
  id: number;
  type: 'assignment' | 'project';
  title: string;
  course_title: string;
  course_id: number;
  student_name: string;
  student_id: number;
  submitted_at: string;
  due_date?: string;
  days_late: number;
  points_possible: number;
  grade?: number;
  graded_at?: string;
  is_resubmission?: boolean;
  resubmission_count?: number;
  submission_notes?: string;
  modification_requested?: boolean;
  modification_request_reason?: string;
  modification_requested_at?: string;
  modification_requested_by?: number;
  can_resubmit?: boolean;
  cohort_label?: string;
  application_window_id?: number;
};

// ═══════════════════════════════════════
// Wizard steps
// ═══════════════════════════════════════
type WizardStep = 'courses' | 'cohorts' | 'grading';

// ═══════════════════════════════════════
// Summary Card sub-component
// ═══════════════════════════════════════
const colorMap: Record<string, { border: string; text: string; bg: string; iconBg: string }> = {
  blue:   { border: 'border-blue-500',   text: 'text-blue-600 dark:text-blue-400',     bg: 'bg-blue-100 dark:bg-blue-900/20',     iconBg: 'bg-blue-100 dark:bg-blue-900/20' },
  purple: { border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-100 dark:bg-purple-900/20', iconBg: 'bg-purple-100 dark:bg-purple-900/20' },
  orange: { border: 'border-orange-500', text: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-100 dark:bg-orange-900/20', iconBg: 'bg-orange-100 dark:bg-orange-900/20' },
  red:    { border: 'border-red-500',    text: 'text-red-600 dark:text-red-400',       bg: 'bg-red-100 dark:bg-red-900/20',       iconBg: 'bg-red-100 dark:bg-red-900/20' },
  green:  { border: 'border-green-500',  text: 'text-green-600 dark:text-green-400',   bg: 'bg-green-100 dark:bg-green-900/20',   iconBg: 'bg-green-100 dark:bg-green-900/20' },
};

function SummaryCard({ label, count, icon, color, subtitle, onClick }: {
  label: string; count: number; icon: React.ReactNode; color: string; subtitle: string; onClick?: () => void;
}) {
  const c = colorMap[color] || colorMap.blue;
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`bg-white dark:bg-slate-800 rounded-xl shadow-sm p-4 border-l-4 ${c.border} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow text-left w-full' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
          <p className={`text-2xl font-bold ${c.text} mt-0.5`}>{count}</p>
          <p className="text-[10px] text-slate-400 mt-0.5">{subtitle}</p>
        </div>
        <div className={`h-10 w-10 ${c.iconBg} rounded-lg flex items-center justify-center ${c.text}`}>
          {icon}
        </div>
      </div>
    </Tag>
  );
}

// ═══════════════════════════════════════
// Main Page Component
// ═══════════════════════════════════════
const GradingPage = () => {
  const { token, user } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();

  // ── Wizard step ────────────────────────
  const [step, setStep] = useState<WizardStep>('courses');

  // ── Data state ─────────────────────────
  const [courses, setCourses] = useState<Course[]>([]);
  const [cohorts, setCohorts] = useState<any[]>([]);
  const [modules, setModules] = useState<any[]>([]);
  const [lessons, setLessons] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [gradingItems, setGradingItems] = useState<GradingItem[]>([]);
  const [summary, setSummary] = useState<GradingSummary | null>(null);
  const [analytics, setAnalytics] = useState<any>(null);

  // ── Selection state ────────────────────
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedCohortId, setSelectedCohortId] = useState<number | null>(null);
  const [selectedCohortData, setSelectedCohortData] = useState<any>(null);
  const [selectedCourseData, setSelectedCourseData] = useState<Course | null>(null);

  // ── Grading view filters ───────────────
  const [selectedStatus, setSelectedStatus] = useState<'pending' | 'graded' | 'all' | 'resubmitted' | 'modification_requested'>('pending');
  const [selectedType, setSelectedType] = useState<'all' | 'assignment' | 'project'>('all');
  const [selectedModule, setSelectedModule] = useState<string>('all');
  const [selectedLesson, setSelectedLesson] = useState<string>('all');
  const [selectedStudent, setSelectedStudent] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // ── UI state ───────────────────────────
  const [loading, setLoading] = useState(true);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [gradingLoading, setGradingLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [refreshing, setRefreshing] = useState(false);

  const [statusCounts, setStatusCounts] = useState({
    pending: 0,
    resubmitted: 0,
    modification_requested: 0,
    graded: 0,
    overdue: 0
  });

  // ── Quick grading modal ────────────────
  const [quickGradeSubmission, setQuickGradeSubmission] = useState<GradingItem | null>(null);
  const [showQuickGrade, setShowQuickGrade] = useState(false);

  // ── Batch / export ─────────────────────
  const [selectedSubmissions, setSelectedSubmissions] = useState<Set<number>>(new Set());
  const [exporting, setExporting] = useState(false);

  // ══════════════════════════════════════
  // EFFECTS
  // ══════════════════════════════════════

  // Step 1: fetch courses on mount
  useEffect(() => {
    if (token) fetchCourses();
  }, [token]);

  // Restore from URL params on mount
  useEffect(() => {
    const courseParam = searchParams.get('course_id');
    const cohortParam = searchParams.get('cohort_id');
    if (courseParam) {
      const cId = parseInt(courseParam);
      setSelectedCourseId(cId);
      if (cohortParam) {
        setSelectedCohortId(parseInt(cohortParam));
        setStep('grading');
      } else {
        setStep('cohorts');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: fetch cohorts when entering cohorts step
  useEffect(() => {
    if (selectedCourseId && step === 'cohorts') {
      fetchCohorts(selectedCourseId);
      fetchModules(selectedCourseId);
      const course = courses.find(c => c.id === selectedCourseId);
      if (course) setSelectedCourseData(course);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, step, courses]);

  // Step 3: fetch grading data when course + cohort are both selected
  useEffect(() => {
    if (selectedCourseId && selectedCohortId && step === 'grading') {
      fetchGradingData();
      fetchSummary();
      fetchStudents(selectedCourseId, selectedCohortId);
      const cohort = cohorts.find(c => c.id === selectedCohortId);
      if (cohort) setSelectedCohortData(cohort);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCourseId, selectedCohortId, step, selectedStatus, selectedType, selectedModule, selectedLesson, selectedStudent, currentPage]);

  // Fetch lessons when module changes
  useEffect(() => {
    if (selectedModule !== 'all') {
      fetchLessons(parseInt(selectedModule));
    } else {
      setLessons([]);
      setSelectedLesson('all');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedModule]);

  // ══════════════════════════════════════
  // DATA FETCHING
  // ══════════════════════════════════════

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/instructor/courses`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json() as any[];
        setCourses(data);
      }
    } catch (err) {
      console.error('Failed to fetch courses:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchCohorts = async (courseId: number) => {
    setCohortsLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/instructor/courses/${courseId}/cohorts`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) {
        const data = await response.json() as any[];
        setCohorts(data);
      } else {
        setCohorts([]);
      }
    } catch (err) {
      console.error('Failed to fetch cohorts:', err);
      setCohorts([]);
    } finally {
      setCohortsLoading(false);
    }
  };

  const fetchModules = async (courseId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/courses/${courseId}/modules`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) setModules(await response.json() as any[]);
    } catch (err) {
      console.error('Failed to fetch modules:', err);
      setModules([]);
    }
  };

  const fetchLessons = async (moduleId: number) => {
    try {
      const response = await fetch(`${API_BASE_URL}/modules/${moduleId}/lessons`, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) setLessons(await response.json() as any[]);
    } catch (err) {
      console.error('Failed to fetch lessons:', err);
      setLessons([]);
    }
  };

  const fetchStudents = async (courseId: number, cohortId?: number) => {
    try {
      let url = `${API_BASE_URL}/instructor/courses/${courseId}/enrollments`;
      if (cohortId) url += `?cohort_id=${cohortId}`;
      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      if (response.ok) setStudents(await response.json() as any[]);
      else setStudents([]);
    } catch (err) {
      console.error('Failed to fetch students:', err);
      setStudents([]);
    }
  };

  const fetchGradingData = async () => {
    setGradingLoading(true);
    setError(null);

    try {
      const allFilters: SubmissionFilters = {
        status: 'all',
        page: 1,
        per_page: 200,
        search_query: searchQuery || undefined,
        sort_by: 'priority',
        sort_order: 'desc',
        course_id: selectedCourseId!,
        cohort_id: selectedCohortId!,
      };
      if (selectedModule !== 'all') allFilters.module_id = parseInt(selectedModule);
      if (selectedLesson !== 'all') allFilters.lesson_id = parseInt(selectedLesson);
      if (selectedStudent !== 'all') allFilters.student_id = parseInt(selectedStudent);

      const allItems: GradingItem[] = [];

      // Fetch assignments
      if (selectedType === 'all' || selectedType === 'assignment') {
        try {
          const assignmentData = await GradingService.getAssignmentSubmissions(allFilters);
          if (assignmentData.analytics) setAnalytics(assignmentData.analytics);
          allItems.push(...assignmentData.submissions.map(sub => ({
            id: sub.id,
            type: 'assignment' as const,
            title: sub.assignment_title,
            course_title: sub.course_title,
            course_id: sub.course_id,
            student_name: sub.student_name,
            student_id: sub.student_id,
            submitted_at: sub.submitted_at,
            due_date: sub.due_date,
            days_late: sub.days_late,
            points_possible: sub.assignment_points,
            grade: sub.grade,
            graded_at: sub.graded_at,
            is_resubmission: sub.is_resubmission,
            resubmission_count: sub.resubmission_count,
            submission_notes: sub.submission_notes,
            modification_requested: sub.modification_requested,
            modification_request_reason: sub.modification_request_reason,
            modification_requested_at: sub.modification_requested_at,
            modification_requested_by: sub.modification_requested_by,
            can_resubmit: sub.can_resubmit,
            cohort_label: sub.cohort_label,
            application_window_id: sub.application_window_id,
          })));
        } catch (err) {
          console.error('Failed to fetch assignment submissions:', err);
        }
      }

      // Fetch projects
      if (selectedType === 'all' || selectedType === 'project') {
        try {
          const projectData = await GradingService.getProjectSubmissions(allFilters);
          allItems.push(...projectData.submissions.map(sub => ({
            id: sub.id,
            type: 'project' as const,
            title: sub.project_title,
            course_title: sub.course_title,
            course_id: sub.course_id,
            student_name: sub.student_name,
            student_id: sub.student_id,
            submitted_at: sub.submitted_at,
            due_date: sub.due_date,
            days_late: sub.days_late,
            points_possible: sub.project_points,
            grade: sub.grade,
            graded_at: sub.graded_at,
            is_resubmission: sub.is_resubmission,
            resubmission_count: sub.resubmission_count,
            submission_notes: sub.submission_notes,
            modification_requested: sub.modification_requested,
            modification_request_reason: sub.modification_request_reason,
            modification_requested_at: sub.modification_requested_at,
            modification_requested_by: sub.modification_requested_by,
            can_resubmit: sub.can_resubmit,
            cohort_label: sub.cohort_label,
            application_window_id: sub.application_window_id,
          })));
        } catch (err) {
          console.error('Failed to fetch project submissions:', err);
        }
      }

      // Count statuses
      const counts = { pending: 0, resubmitted: 0, modification_requested: 0, graded: 0, overdue: 0 };
      allItems.forEach(item => {
        if (item.is_resubmission === true) counts.resubmitted++;
        else if (item.modification_requested === true) counts.modification_requested++;
        else if (item.grade !== undefined && item.grade !== null) counts.graded++;
        else counts.pending++;
        if (item.days_late > 0) counts.overdue++;
      });
      setStatusCounts(counts);

      // Client-side status filter
      let displayItems = allItems;
      if (selectedStatus !== 'all') {
        displayItems = allItems.filter(item => {
          switch (selectedStatus) {
            case 'resubmitted': return item.is_resubmission === true;
            case 'modification_requested': return item.modification_requested === true && !item.is_resubmission;
            case 'graded': return (item.grade !== undefined && item.grade !== null) && !item.is_resubmission && !item.modification_requested;
            case 'pending': return !item.grade && !item.is_resubmission && !item.modification_requested;
            default: return true;
          }
        });
      }

      // Sort by priority
      displayItems.sort((a, b) => {
        const aR = a.is_resubmission && !a.grade;
        const bR = b.is_resubmission && !b.grade;
        if (aR && !bR) return -1;
        if (!aR && bR) return 1;
        const aM = a.modification_requested && !a.grade;
        const bM = b.modification_requested && !b.grade;
        if (aM && !bM) return -1;
        if (!aM && bM) return 1;
        if (!a.grade && b.grade) return -1;
        if (a.grade && !b.grade) return 1;
        return new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime();
      });

      setGradingItems(displayItems);
    } catch (err: any) {
      setError(err.message || 'Failed to load grading data');
    } finally {
      setGradingLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const summaryData = await GradingService.getGradingSummary(selectedCourseId!, selectedCohortId!);
      setSummary(summaryData);
    } catch (err: any) {
      console.error('Failed to fetch grading summary:', err);
    }
  };

  // ══════════════════════════════════════
  // STEP NAVIGATION
  // ══════════════════════════════════════

  const selectCourse = (course: Course) => {
    setSelectedCourseId(course.id);
    setSelectedCourseData(course);
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setCohorts([]);
    setGradingItems([]);
    setSummary(null);
    setAnalytics(null);
    setStep('cohorts');
    router.push(`/instructor/grading?course_id=${course.id}`, { scroll: false });
  };

  const selectCohort = (cohort: any) => {
    setSelectedCohortId(cohort.id);
    setSelectedCohortData(cohort);
    setGradingItems([]);
    setSummary(null);
    setAnalytics(null);
    // Reset sub-filters
    setSelectedStatus('pending');
    setSelectedType('all');
    setSelectedModule('all');
    setSelectedLesson('all');
    setSelectedStudent('all');
    setSearchQuery('');
    setCurrentPage(1);
    setStep('grading');
    router.push(`/instructor/grading?course_id=${selectedCourseId}&cohort_id=${cohort.id}`, { scroll: false });
  };

  const goBackToCourses = () => {
    setSelectedCourseId(null);
    setSelectedCourseData(null);
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setCohorts([]);
    setGradingItems([]);
    setSummary(null);
    setAnalytics(null);
    setStep('courses');
    router.push('/instructor/grading', { scroll: false });
  };

  const goBackToCohorts = () => {
    setSelectedCohortId(null);
    setSelectedCohortData(null);
    setGradingItems([]);
    setSummary(null);
    setAnalytics(null);
    setStep('cohorts');
    router.push(`/instructor/grading?course_id=${selectedCourseId}`, { scroll: false });
  };

  // ══════════════════════════════════════
  // HELPERS
  // ══════════════════════════════════════

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-US', {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

  const getGradeColor = (grade: number, maxPoints: number) => {
    const pct = GradingService.calculatePercentage(grade, maxPoints);
    if (pct >= 90) return 'text-green-600 dark:text-green-400';
    if (pct >= 80) return 'text-blue-600 dark:text-blue-400';
    if (pct >= 70) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getStatusIcon = (item: GradingItem) => {
    if (item.grade !== undefined && item.grade !== null) return <CheckCircle className="w-4 h-4 text-green-600" />;
    if (item.is_resubmission) return <Repeat className="w-4 h-4 text-blue-600" />;
    if (item.modification_requested) return <FileEdit className="w-4 h-4 text-purple-600" />;
    if (item.days_late > 0) return <AlertTriangle className="w-4 h-4 text-red-600" />;
    return <Clock className="w-4 h-4 text-orange-600" />;
  };

  const getStatusText = (item: GradingItem) => {
    if (item.grade !== undefined && item.grade !== null) return `Graded on ${formatDate(item.graded_at!)}`;
    if (item.is_resubmission) {
      const t = (item.resubmission_count ?? 0) > 1 ? `Resubmission #${(item.resubmission_count ?? 0) + 1}` : 'Resubmission';
      return `${t} - Needs review`;
    }
    if (item.modification_requested && !item.is_resubmission) return 'Modification requested - Awaiting student';
    if (item.days_late > 0) return `${item.days_late} day${item.days_late > 1 ? 's' : ''} overdue`;
    return 'Awaiting grade';
  };

  const getSubmissionBadges = (item: GradingItem) => {
    const badges: React.ReactNode[] = [];
    if (item.is_resubmission) {
      badges.push(
        <span key="resub" className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400 flex items-center">
          <Repeat className="w-3 h-3 mr-1" />Resubmission
        </span>
      );
    }
    if (item.modification_requested) {
      badges.push(
        <span key="mod" className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400 flex items-center">
          <FileEdit className="w-3 h-3 mr-1" />Modification
        </span>
      );
    }
    if (item.days_late > 0 && !item.grade) {
      badges.push(
        <span key="late" className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400">
          {item.days_late}d late
        </span>
      );
    }
    return badges;
  };

  // ── Quick-grade helpers ────────────────
  const handleQuickGrade = (item: GradingItem) => { setQuickGradeSubmission(item); setShowQuickGrade(true); };

  const handleNextSubmission = () => {
    if (!quickGradeSubmission) return;
    const idx = gradingItems.findIndex(i => i.id === quickGradeSubmission.id && i.type === quickGradeSubmission.type);
    if (idx < gradingItems.length - 1) setQuickGradeSubmission(gradingItems[idx + 1]);
  };

  const handlePreviousSubmission = () => {
    if (!quickGradeSubmission) return;
    const idx = gradingItems.findIndex(i => i.id === quickGradeSubmission.id && i.type === quickGradeSubmission.type);
    if (idx > 0) setQuickGradeSubmission(gradingItems[idx - 1]);
  };

  const hasNextSubmission = () => {
    if (!quickGradeSubmission) return false;
    const idx = gradingItems.findIndex(i => i.id === quickGradeSubmission.id && i.type === quickGradeSubmission.type);
    return idx < gradingItems.length - 1;
  };

  const hasPreviousSubmission = () => {
    if (!quickGradeSubmission) return false;
    const idx = gradingItems.findIndex(i => i.id === quickGradeSubmission.id && i.type === quickGradeSubmission.type);
    return idx > 0;
  };

  const handleGradingComplete = () => { fetchGradingData(); fetchSummary(); };

  const toggleSelectSubmission = (itemId: number) => {
    setSelectedSubmissions(prev => {
      const s = new Set(prev);
      if (s.has(itemId)) s.delete(itemId); else s.add(itemId);
      return s;
    });
  };

  // ── Export ─────────────────────────────
  const handleExportGrades = async () => {
    setExporting(true);
    try {
      const result = await GradingService.exportGrades({
        type: selectedType as any,
        submission_ids: selectedSubmissions.size > 0 ? Array.from(selectedSubmissions) : undefined,
        course_id: selectedCourseId || undefined,
      });
      const csvContent = convertToCSV(result.data);
      downloadCSV(csvContent, `grades_${selectedCourseData?.title || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    } catch (error: any) {
      alert(error.message || 'Failed to export grades');
    } finally {
      setExporting(false);
    }
  };

  const convertToCSV = (data: any[]) => {
    if (data.length === 0) return '';
    const headers = Object.keys(data[0]);
    return [headers.join(','), ...data.map(row =>
      headers.map(h => { const v = row[h]; return typeof v === 'string' && v.includes(',') ? `"${v}"` : v; }).join(',')
    )].join('\n');
  };

  const downloadCSV = (content: string, filename: string) => {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await Promise.all([fetchGradingData(), fetchSummary()]);
    setRefreshing(false);
  };

  // ══════════════════════════════════════════════════════
  //  R E N D E R   H E L P E R S
  // ══════════════════════════════════════════════════════

  // ── Breadcrumb ─────────────────────────
  const renderBreadcrumb = () => (
    <nav className="flex items-center space-x-2 text-sm text-slate-500 dark:text-slate-400 mb-6">
      <button
        onClick={goBackToCourses}
        className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors ${step === 'courses' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
      >
        Grading Center
      </button>
      {(step === 'cohorts' || step === 'grading') && (
        <>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <button
            onClick={step === 'grading' ? goBackToCohorts : undefined}
            className={`hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate max-w-[200px] ${step === 'cohorts' ? 'text-blue-600 dark:text-blue-400 font-semibold' : ''}`}
          >
            {selectedCourseData?.title || 'Course'}
          </button>
        </>
      )}
      {step === 'grading' && (
        <>
          <ChevronRight className="w-4 h-4 flex-shrink-0" />
          <span className="text-blue-600 dark:text-blue-400 font-semibold truncate max-w-[200px]">
            {selectedCohortData?.cohort_label || 'Cohort'}
          </span>
        </>
      )}
    </nav>
  );

  // ══════════════════════════════════════
  //  STEP 1  —  COURSE SELECTION
  // ══════════════════════════════════════

  const renderCourseSelection = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading courses...</span>
        </div>
      );
    }

    return (
      <div>
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Grading Center</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Select a course to start grading assessments</p>
        </div>

        {courses.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
            <BookOpen className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No courses found</h3>
            <p className="text-slate-500 dark:text-slate-400">You don&apos;t have any courses assigned yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {courses.map((course) => (
              <button
                key={course.id}
                onClick={() => selectCourse(course)}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-left hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="h-12 w-12 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <GraduationCap className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-400 group-hover:text-blue-500 transition-colors" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                  {course.title}
                </h3>
                {course.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2 mb-3">{course.description}</p>
                )}
                <div className="flex items-center text-xs text-slate-400 dark:text-slate-500 space-x-3">
                  {course.is_published ? (
                    <span className="flex items-center text-green-600 dark:text-green-400"><CheckCircle className="w-3 h-3 mr-1" /> Published</span>
                  ) : (
                    <span className="flex items-center text-amber-600 dark:text-amber-400"><Clock className="w-3 h-3 mr-1" /> Draft</span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  //  STEP 2  —  COHORT SELECTION
  // ══════════════════════════════════════

  const renderCohortSelection = () => {
    if (cohortsLoading) {
      return (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-blue-500" />
          <span className="ml-3 text-slate-600 dark:text-slate-300">Loading cohorts...</span>
        </div>
      );
    }

    const statusColors: Record<string, string> = {
      open: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
      closed: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
      upcoming: 'bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-400',
      unknown: 'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400',
    };

    return (
      <div>
        <div className="mb-8">
          <button
            onClick={goBackToCourses}
            className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-1" /> Back to Courses
          </button>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{selectedCourseData?.title || 'Course'}</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">Select a cohort to view and grade assessments</p>
        </div>

        {cohorts.length === 0 ? (
          <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-12 text-center">
            <Users className="w-16 h-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-700 dark:text-slate-300 mb-2">No cohorts found</h3>
            <p className="text-slate-500 dark:text-slate-400 mb-4">This course doesn&apos;t have any cohorts configured yet.</p>
            <p className="text-sm text-slate-400 dark:text-slate-500">Set up application windows in course settings to create cohorts.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {cohorts.map((cohort, idx) => {
              const label = cohort.cohort_label || 'Unlabelled Cohort';
              const studentCount = cohort.student_count || 0;
              const status = cohort.status || cohort.computed_status || 'unknown';

              return (
                <button
                  key={cohort.id || `cohort-${idx}`}
                  onClick={() => cohort.id && selectCohort(cohort)}
                  disabled={!cohort.id}
                  className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 text-left hover:shadow-lg hover:border-indigo-300 dark:hover:border-indigo-600 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-900/50 transition-colors">
                      <Users className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[status] || statusColors.unknown}`}>
                      {status.charAt(0).toUpperCase() + status.slice(1)}
                    </span>
                  </div>

                  <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {label}
                  </h3>

                  <div className="space-y-2 text-sm text-slate-500 dark:text-slate-400">
                    <div className="flex items-center">
                      <User className="w-4 h-4 mr-2" />
                      <span>{studentCount} student{studentCount !== 1 ? 's' : ''} enrolled</span>
                    </div>
                    {cohort.cohort_start && (
                      <div className="flex items-center">
                        <Calendar className="w-4 h-4 mr-2" />
                        <span>
                          {new Date(cohort.cohort_start).toLocaleDateString()}
                          {cohort.cohort_end && ` – ${new Date(cohort.cohort_end).toLocaleDateString()}`}
                        </span>
                      </div>
                    )}
                    {cohort.max_students && (
                      <div className="flex items-center">
                        <BarChart3 className="w-4 h-4 mr-2" />
                        <span>{studentCount}/{cohort.max_students} capacity</span>
                      </div>
                    )}
                  </div>

                  {cohort.id && (
                    <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-end">
                      <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium group-hover:underline flex items-center">
                        View Assessments <ChevronRight className="w-3 h-3 ml-1" />
                      </span>
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // ══════════════════════════════════════
  //  STEP 3  —  GRADING DASHBOARD
  // ══════════════════════════════════════

  const renderGradingDashboard = () => (
    <div>
      {/* Back nav + header */}
      <div className="mb-6">
        <button
          onClick={goBackToCohorts}
          className="flex items-center text-sm text-slate-500 dark:text-slate-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors mb-4"
        >
          <ArrowLeft className="w-4 h-4 mr-1" /> Back to Cohorts
        </button>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {selectedCohortData?.cohort_label || 'Cohort'} — Assessments
            </h1>
            <p className="text-slate-600 dark:text-slate-400 mt-1 text-sm">
              {selectedCourseData?.title}
              {selectedCohortData && (
                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-700 dark:bg-indigo-900/20 dark:text-indigo-400">
                  <Users className="w-3 h-3 mr-1" />
                  {selectedCohortData.student_count || students.length} students
                </span>
              )}
            </p>
          </div>

          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors disabled:opacity-50 text-sm"
            >
              {refreshing ? (
                <span className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-b-2 border-slate-500" />
                  <span>Refreshing...</span>
                </span>
              ) : (
                <span className="flex items-center space-x-2">
                  <RefreshCw className="w-4 h-4" />
                  <span>Refresh</span>
                </span>
              )}
            </button>
            {selectedSubmissions.size > 0 && (
              <button
                onClick={handleExportGrades}
                disabled={exporting}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 text-sm"
              >
                <Download className="w-4 h-4 inline mr-1.5" />
                Export {selectedSubmissions.size}
              </button>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 rounded-lg mb-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
        <SummaryCard label="Resubmissions" count={statusCounts.resubmitted} icon={<Repeat className="w-5 h-5" />} color="blue" subtitle="Need review" onClick={() => setSelectedStatus('resubmitted')} />
        <SummaryCard label="Modifications" count={statusCounts.modification_requested} icon={<FileEdit className="w-5 h-5" />} color="purple" subtitle="Awaiting student" onClick={() => setSelectedStatus('modification_requested')} />
        <SummaryCard label="Pending" count={statusCounts.pending} icon={<Clock className="w-5 h-5" />} color="orange" subtitle="Initial submissions" onClick={() => setSelectedStatus('pending')} />
        <SummaryCard label="Overdue" count={statusCounts.overdue} icon={<AlertTriangle className="w-5 h-5" />} color="red" subtitle="Past due date" />
        <SummaryCard label="Graded" count={statusCounts.graded} icon={<CheckCircle className="w-5 h-5" />} color="green" subtitle="Complete" onClick={() => setSelectedStatus('graded')} />
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm p-5 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 uppercase tracking-wider">Filters</h2>
          {(selectedStatus !== 'pending' || selectedType !== 'all' || selectedModule !== 'all' || selectedStudent !== 'all' || searchQuery) && (
            <button
              onClick={() => {
                setSelectedStatus('pending');
                setSelectedType('all');
                setSelectedModule('all');
                setSelectedLesson('all');
                setSelectedStudent('all');
                setSearchQuery('');
              }}
              className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>

        {/* Search */}
        <div className="mb-4">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search submissions, students, assignments..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { setCurrentPage(1); fetchGradingData(); } }}
              className="w-full pl-10 pr-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {/* Status */}
          <select
            value={selectedStatus}
            onChange={(e) => { setSelectedStatus(e.target.value as any); setCurrentPage(1); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="pending">Pending ({statusCounts.pending})</option>
            <option value="resubmitted">Resubmitted ({statusCounts.resubmitted})</option>
            <option value="modification_requested">Modifications ({statusCounts.modification_requested})</option>
            <option value="graded">Graded ({statusCounts.graded})</option>
            <option value="all">All</option>
          </select>

          {/* Type */}
          <select
            value={selectedType}
            onChange={(e) => { setSelectedType(e.target.value as any); setCurrentPage(1); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Types</option>
            <option value="assignment">Assignments</option>
            <option value="project">Projects</option>
          </select>

          {/* Module */}
          <select
            value={selectedModule}
            onChange={(e) => { setSelectedModule(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Modules</option>
            {modules.map((m: any) => <option key={m.id} value={m.id}>{m.title}</option>)}
          </select>

          {/* Student */}
          <select
            value={selectedStudent}
            onChange={(e) => { setSelectedStudent(e.target.value); setCurrentPage(1); }}
            className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Students ({students.length})</option>
            {students.map((e: any) => {
              const name = e.student?.full_name || e.student_username || `Student ${e.student_id}`;
              return <option key={e.student_id} value={e.student_id}>{name}</option>;
            })}
          </select>
        </div>
      </div>

      {/* Submissions List */}
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm">
        <div className="p-5 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              Submissions ({gradingItems.length})
            </h2>
            {selectedStatus !== 'all' && (
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Showing {selectedStatus.replace('_', ' ')} submissions
              </p>
            )}
          </div>
          {gradingLoading && (
            <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-blue-500" />
          )}
        </div>

        {gradingLoading && gradingItems.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
            <span className="ml-3 text-slate-500 dark:text-slate-400">Loading assessments...</span>
          </div>
        ) : gradingItems.length === 0 ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-12 w-12 text-slate-300 dark:text-slate-600 mb-4">
              {selectedStatus === 'pending' && <Clock className="w-full h-full" />}
              {selectedStatus === 'resubmitted' && <Repeat className="w-full h-full" />}
              {selectedStatus === 'modification_requested' && <FileEdit className="w-full h-full" />}
              {selectedStatus === 'graded' && <CheckCircle className="w-full h-full" />}
              {selectedStatus === 'all' && <Layers className="w-full h-full" />}
            </div>
            <p className="text-slate-600 dark:text-slate-400 mb-1">
              {selectedStatus === 'pending' ? 'No pending submissions' :
               selectedStatus === 'resubmitted' ? 'No resubmissions to review' :
               selectedStatus === 'modification_requested' ? 'No modification requests' :
               selectedStatus === 'graded' ? 'No graded submissions yet' :
               'No submissions found'}
            </p>
            <p className="text-sm text-slate-400 dark:text-slate-500">
              {selectedStatus === 'pending' ? 'All caught up! Nothing needs grading.' : 'Try adjusting your filters.'}
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {gradingItems.map((item) => (
                <div key={`${item.type}-${item.id}`} className="p-5 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-3 flex-1 min-w-0">
                      <input
                        type="checkbox"
                        checked={selectedSubmissions.has(item.id)}
                        onChange={() => toggleSelectSubmission(item.id)}
                        className="mt-1 w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center flex-wrap gap-2 mb-2">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.type === 'assignment'
                              ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                              : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                          }`}>
                            {item.type === 'assignment' ? 'Assignment' : 'Project'}
                          </span>
                          {getSubmissionBadges(item)}
                          <div className="flex items-center space-x-1">
                            {getStatusIcon(item)}
                            <span className="text-xs text-slate-500 dark:text-slate-400">{getStatusText(item)}</span>
                          </div>
                        </div>

                        <h3 className="text-base font-medium text-slate-900 dark:text-white mb-2 truncate">
                          {item.title}
                        </h3>

                        {item.modification_requested && item.modification_request_reason && (
                          <div className="mb-2 p-2.5 bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 rounded-lg">
                            <p className="text-xs text-purple-700 dark:text-purple-400">
                              <span className="font-medium">Modification:</span> {item.modification_request_reason}
                            </p>
                          </div>
                        )}

                        {item.is_resubmission && item.submission_notes && (
                          <div className="mb-2 p-2.5 bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800 rounded-lg">
                            <p className="text-xs text-blue-700 dark:text-blue-400">
                              <span className="font-medium">Student notes:</span> {item.submission_notes}
                            </p>
                          </div>
                        )}

                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                          <span className="flex items-center"><User className="w-3.5 h-3.5 mr-1" />{item.student_name}</span>
                          <span className="flex items-center"><Calendar className="w-3.5 h-3.5 mr-1" />{formatDate(item.submitted_at)}</span>
                          {item.grade !== undefined && item.grade !== null ? (
                            <span className={`flex items-center font-medium ${getGradeColor(item.grade, item.points_possible)}`}>
                              <Award className="w-3.5 h-3.5 mr-1" />
                              {GradingService.formatGrade(item.grade, item.points_possible)}
                            </span>
                          ) : (
                            <span className="flex items-center text-orange-600 dark:text-orange-400 font-medium">
                              <Clock className="w-3.5 h-3.5 mr-1" />Pending
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2 ml-3 flex-shrink-0">
                      <button
                        onClick={() => handleQuickGrade(item)}
                        className="flex items-center space-x-1.5 px-3 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all shadow-sm text-xs font-medium"
                      >
                        <Zap className="w-3.5 h-3.5" /><span>Quick Grade</span>
                      </button>
                      <Link
                        href={`/instructor/grading/${item.type}/${item.id}`}
                        className="px-3 py-2 rounded-lg text-xs font-medium border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                      >
                        {item.grade !== undefined && item.grade !== null ? 'Details' : 'Full Review'}
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="p-5 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Previous
                </button>
                <span className="text-sm text-slate-500">Page {currentPage} of {totalPages}</span>
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                  className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Quick Grading Modal */}
      {showQuickGrade && quickGradeSubmission && (
        <QuickGradingModal
          submission={quickGradeSubmission}
          isOpen={showQuickGrade}
          onClose={() => setShowQuickGrade(false)}
          onGraded={handleGradingComplete}
          onNext={handleNextSubmission}
          onPrevious={handlePreviousSubmission}
          hasNext={hasNextSubmission()}
          hasPrevious={hasPreviousSubmission()}
        />
      )}
    </div>
  );

  // ══════════════════════════════════════
  //  MAIN RENDER
  // ══════════════════════════════════════

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      {renderBreadcrumb()}
      {step === 'courses' && renderCourseSelection()}
      {step === 'cohorts' && renderCohortSelection()}
      {step === 'grading' && renderGradingDashboard()}
    </div>
  );
};

export default GradingPage;
