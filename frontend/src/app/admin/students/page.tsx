'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminStudentService,
  StudentListItem,
  StudentStats,
  AvailableCourse,
  CourseStats,
  CohortStats,
} from '@/services/admin-student.service';
import { toast } from 'sonner';
import {
  RefreshCw, Search, Download, GraduationCap, Users, TrendingUp,
  Award, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronLeft,
  ChevronRight, Eye, UserCheck, UserX, BookOpen, Filter, BarChart3,
  Mail, RotateCcw, MoreVertical, BookPlus, MessageSquare, UserPlus,
  Trash2, ChevronDown, Send, X, ShieldAlert, ArrowLeft, Calendar,
  Building2, Layers, Lock, Unlock, Users2, BadgeCheck, Phone,
} from 'lucide-react';

// ─── Debounce ──────────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Confirm Dialog ────────────────────────────────────────────────────────────
function ConfirmDialog({ open, title, description, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }: {
  open: boolean; title: string; description: string; confirmLabel?: string;
  danger?: boolean; onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0d1b2a] hover:bg-[#162844]'}`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enroll Modal ──────────────────────────────────────────────────────────────
function EnrollModal({ open, student, courses, onClose, onSuccess }: {
  open: boolean; student: StudentListItem | null; courses: AvailableCourse[];
  onClose: () => void; onSuccess: () => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [cohortLabel, setCohortLabel] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) { setCourseId(''); setCohortLabel(''); } }, [open]);
  if (!open || !student) return null;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) { toast.error('Please select a course'); return; }
    try {
      setLoading(true);
      await AdminStudentService.enrollStudent(student.id, {
        course_id: parseInt(courseId), payment_status: 'not_required',
        payment_verified: true, cohort_label: cohortLabel || undefined,
      });
      toast.success(`${student.username} enrolled successfully`);
      onSuccess(); onClose();
    } catch (e: any) { toast.error(e.message || 'Enrollment failed'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2"><BookPlus className="w-5 h-5 text-[#0d1b2a]" />Enroll Student</h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Enrolling: <strong>{student.first_name} {student.last_name || student.username}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" required>
              <option value="">Select a course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort Label (optional)</label>
            <input type="text" value={cohortLabel} onChange={e => setCohortLabel(e.target.value)}
              placeholder="e.g. Cohort 2026-A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-[#0d1b2a] hover:bg-[#162844] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />}Enroll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Message Modal ─────────────────────────────────────────────────────────────
function MessageModal({ open, recipients, onClose }: {
  open: boolean; recipients: Array<{ id: number; name: string }>; onClose: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  useEffect(() => { if (open) { setSubject(''); setMessage(''); } }, [open]);
  if (!open) return null;
  const isBulk = recipients.length > 1;
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { toast.error('Subject and message required'); return; }
    try {
      setLoading(true);
      if (isBulk) {
        const res = await AdminStudentService.bulkMessage({ student_ids: recipients.map(r => r.id), subject, message });
        toast.success(res.message);
      } else {
        const res = await AdminStudentService.sendMessage(recipients[0].id, { subject, message });
        toast.success(res.message);
      }
      onClose();
    } catch (e: any) { toast.error(e.message || 'Failed to send'); }
    finally { setLoading(false); }
  };
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#0d1b2a]" />
            {isBulk ? `Message ${recipients.length} Students` : `Message ${recipients[0]?.name}`}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isBulk && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {recipients.slice(0, 10).map(r => (
                <span key={r.id} className="bg-[#0d1b2a]/5 text-[#0d1b2a] text-xs px-2 py-0.5 rounded-full">{r.name}</span>
              ))}
              {recipients.length > 10 && <span className="text-xs text-gray-500">+{recipients.length - 10} more</span>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Message subject"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="Write your message…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a] resize-none" required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-[#0d1b2a] hover:bg-[#162844] text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}Send
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Row Action Menu ───────────────────────────────────────────────────────────
function RowActionMenu({ student, onView, onToggleStatus, onEnroll, onResetProgress, onMessage, onDeleteConfirm }: {
  student: StudentListItem; onView: () => void; onToggleStatus: () => void;
  onEnroll: () => void; onResetProgress: () => void; onMessage: () => void; onDeleteConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const btn = (icon: React.ReactNode, label: string, onClick: () => void, color = 'text-gray-700') => (
    <button onClick={() => { onClick(); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm ${color} hover:bg-gray-50 rounded-md`}>
      {icon} {label}
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button onClick={onView} className="p-1.5 text-gray-400 hover:text-[#0d1b2a] hover:bg-[#0d1b2a]/5 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
        <button onClick={onMessage} className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Message"><Mail className="w-4 h-4" /></button>
        <button onClick={() => setOpen(!open)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><MoreVertical className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[180px] py-1.5 px-1">
          {btn(<Eye className="w-4 h-4 text-[#0d1b2a]" />, 'View Profile', onView)}
          {btn(<BookPlus className="w-4 h-4 text-green-500" />, 'Enroll in Course', onEnroll)}
          {btn(student.is_active ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />,
            student.is_active ? 'Deactivate' : 'Activate', onToggleStatus,
            student.is_active ? 'text-orange-700' : 'text-green-700')}
          <div className="border-t border-gray-100 my-1" />
          {btn(<RotateCcw className="w-4 h-4 text-yellow-500" />, 'Reset Progress', onResetProgress, 'text-yellow-700')}
          {btn(<Trash2 className="w-4 h-4 text-red-500" />, 'Remove Student', onDeleteConfirm, 'text-red-700')}
        </div>
      )}
    </div>
  );
}

// ─── Cohort status badge ───────────────────────────────────────────────────────
function CohortStatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode; label: string }> = {
    open: { cls: 'bg-emerald-100 text-emerald-700', icon: <Unlock className="w-3 h-3" />, label: 'Open' },
    closed: { cls: 'bg-gray-100 text-gray-600', icon: <Lock className="w-3 h-3" />, label: 'Closed' },
    upcoming: { cls: 'bg-[#0d1b2a]/10 text-[#0d1b2a]', icon: <Clock className="w-3 h-3" />, label: 'Upcoming' },
  };
  const s = map[status] || map.closed;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.cls}`}>
      {s.icon}{s.label}
    </span>
  );
}

// ─── Enrollment type badge ─────────────────────────────────────────────────────
function EnrollTypeBadge({ type }: { type: string }) {
  const map: Record<string, string> = {
    free: 'bg-emerald-50 text-emerald-700',
    paid: 'bg-amber-50 text-amber-700',
    scholarship: 'bg-purple-50 text-purple-700',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[type] || 'bg-gray-100 text-gray-600'}`}>
      {type}
    </span>
  );
}

// ─── FORMAT DATE ──────────────────────────────────────────────────────────────
function fmtDate(s: string | null | undefined) {
  if (!s) return null;
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

// =====================================================================
// MAIN PAGE
// =====================================================================
type ViewState = 'courses' | 'cohorts' | 'students';

export default function StudentManagementPage() {
  const router = useRouter();
  const [view, setView] = useState<ViewState>('courses');

  // ── Courses view state ─────────────────────────────────────────────
  const [courses, setCourses] = useState<CourseStats[]>([]);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [courseSearch, setCourseSearch] = useState('');

  // ── Cohorts view state ─────────────────────────────────────────────
  const [selectedCourse, setSelectedCourse] = useState<CourseStats | null>(null);
  const [cohorts, setCohorts] = useState<CohortStats[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);

  // ── Students view state ────────────────────────────────────────────
  const [selectedCohort, setSelectedCohort] = useState<CohortStats | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Modals
  const [enrollModal, setEnrollModal] = useState<{ open: boolean; student: StudentListItem | null }>({ open: false, student: null });
  const [messageModal, setMessageModal] = useState<{ open: boolean; recipients: Array<{ id: number; name: string }> }>({ open: false, recipients: [] });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const [pagination, setPagination] = useState({
    current_page: 1, per_page: 20, total_pages: 1,
    total_items: 0, has_next: false, has_prev: false,
  });
  const [filters, setFilters] = useState({
    search: '', status: '', enrollment_status: '', performance: '',
    sort_by: 'created_at', sort_order: 'desc' as 'asc' | 'desc',
  });
  const debouncedSearch = useDebounce(filters.search, 350);
  const debouncedCourseSearch = useDebounce(courseSearch, 200);

  // ── Load courses on mount ─────────────────────────────────────────
  useEffect(() => {
    setCoursesLoading(true);
    AdminStudentService.getCourses()
      .then(r => setCourses(r.courses))
      .catch(err => toast.error(err.message || 'Failed to load courses'))
      .finally(() => setCoursesLoading(false));
    AdminStudentService.getStats().then(setStats).catch(console.error);
    AdminStudentService.getAvailableCourses().then(r => setAvailableCourses(r.courses)).catch(console.error);
  }, []);

  // ── Load cohorts when course selected ────────────────────────────
  const loadCohorts = useCallback(async (course: CourseStats) => {
    setCohortsLoading(true);
    try {
      const res = await AdminStudentService.getCohortsForCourse(course.id);
      setCohorts(res.cohorts);
    } catch (err: any) {
      toast.error(err.message || 'Failed to load cohorts');
    } finally {
      setCohortsLoading(false);
    }
  }, []);

  // ── Load students when cohort selected ───────────────────────────
  const fetchStudents = useCallback(async () => {
    if (!selectedCourse || !selectedCohort) return;
    setStudentsLoading(true);
    try {
      const res = await AdminStudentService.listStudents({
        page: pagination.current_page,
        per_page: pagination.per_page,
        course_id: selectedCourse.id,
        window_id: selectedCohort.id === null ? 'none' : selectedCohort.id,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        enrollment_status: filters.enrollment_status || undefined,
        performance: (filters.performance as any) || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
      });
      setStudents(res.students);
      setPagination(prev => ({ ...prev, ...res.pagination }));
    } catch (err: any) {
      toast.error(err.message || 'Failed to load students');
    } finally {
      setStudentsLoading(false);
    }
  }, [selectedCourse, selectedCohort, pagination.current_page, pagination.per_page,
      debouncedSearch, filters.status, filters.enrollment_status, filters.performance,
      filters.sort_by, filters.sort_order]);

  useEffect(() => {
    if (view === 'students') fetchStudents();
  }, [view, fetchStudents]);

  // ── Navigation helpers ───────────────────────────────────────────
  const goToCohorts = (course: CourseStats) => {
    setSelectedCourse(course);
    setCohorts([]);
    setView('cohorts');
    loadCohorts(course);
  };

  const goToStudents = (cohort: CohortStats) => {
    setSelectedCohort(cohort);
    setStudents([]);
    setSelectedStudents([]);
    setPagination(p => ({ ...p, current_page: 1 }));
    setView('students');
  };

  const goBackToCourses = () => {
    setView('courses');
    setSelectedCourse(null);
    setSelectedCohort(null);
  };

  const goBackToCohorts = () => {
    setView('cohorts');
    setSelectedCohort(null);
    setStudents([]);
  };

  // ── Student actions ───────────────────────────────────────────────
  const handleToggleStatus = (student: StudentListItem) => {
    setConfirmDialog({
      open: true,
      title: student.is_active ? 'Deactivate Student' : 'Activate Student',
      description: `${student.is_active ? 'Deactivate' : 'Activate'} ${student.username}?`,
      confirmLabel: student.is_active ? 'Deactivate' : 'Activate',
      danger: student.is_active,
      onConfirm: async () => {
        try {
          const res = await AdminStudentService.toggleStatus(student.id);
          toast.success(res.message);
          fetchStudents();
        } catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleResetProgress = (student: StudentListItem) => {
    setConfirmDialog({
      open: true,
      title: 'Reset Progress',
      description: `Reset all lesson/module progress for ${student.username}? This cannot be undone.`,
      confirmLabel: 'Reset', danger: true,
      onConfirm: async () => {
        try {
          const res = await AdminStudentService.resetProgress(student.id);
          toast.success(res.message);
          fetchStudents();
        } catch (e: any) { toast.error(e.message); }
      },
    });
  };

  const handleBulkAction = async (action: string) => {
    if (!selectedStudents.length) { toast.error('No students selected'); return; }
    try {
      const res = await AdminStudentService.bulkAction({ student_ids: selectedStudents, action: action as any });
      toast.success(res.message);
      setSelectedStudents([]);
      fetchStudents();
    } catch (e: any) { toast.error(e.message || 'Bulk action failed'); }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await AdminStudentService.exportCSV({
        course_id: selectedCourse?.id,
        window_id: selectedCohort?.id === null ? 'none' : selectedCohort?.id,
        student_ids: selectedStudents.length > 0 ? selectedStudents : undefined,
      });
      toast.success('Export downloaded');
    } catch { toast.error('Export failed'); } finally { setIsExporting(false); }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const getStudentName = (s: StudentListItem) =>
    s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.username;

  const selectedRecipients = students
    .filter(s => selectedStudents.includes(s.id))
    .map(s => ({ id: s.id, name: getStudentName(s) }));

  const filteredCourses = courses.filter(c =>
    !debouncedCourseSearch || c.title.toLowerCase().includes(debouncedCourseSearch.toLowerCase())
  );

  const activeFilterCount = [filters.search, filters.status, filters.enrollment_status, filters.performance].filter(Boolean).length;

  // ─────────────────────────────────────────────────────────────────
  // BREADCRUMB
  // ─────────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <nav className="flex items-center gap-1.5 text-sm mb-1">
      <button onClick={goBackToCourses}
        className={`font-medium ${view === 'courses' ? 'text-gray-900' : 'text-[#0d1b2a] hover:underline'}`}>
        Students
      </button>
      {selectedCourse && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          <button onClick={() => view !== 'cohorts' && goBackToCohorts()}
            className={`font-medium ${view === 'cohorts' ? 'text-gray-900' : 'text-[#0d1b2a] hover:underline'} truncate max-w-[200px]`}>
            {selectedCourse.title}
          </button>
        </>
      )}
      {selectedCohort && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
          <span className="font-medium text-gray-900 truncate max-w-[200px]">{selectedCohort.cohort_label}</span>
        </>
      )}
    </nav>
  );

  // ─────────────────────────────────────────────────────────────────
  // VIEW 1: COURSES
  // ─────────────────────────────────────────────────────────────────
  const CoursesView = () => (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#0d1b2a]" /> Student Management
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Select a course to manage its cohorts and students</p>
        </div>
        <button onClick={() => router.push('/admin/students/performance')}
          className="bg-[#0d1b2a] hover:bg-[#162844] text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
          <BarChart3 className="w-4 h-4" /> Performance Report
        </button>
      </div>

      {/* Global stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Students', value: stats.total_students, icon: <Users className="w-4 h-4" />, color: 'text-[#0d1b2a]', bg: 'bg-[#0d1b2a]/5' },
            { label: 'Active Students', value: stats.active_students, icon: <UserCheck className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Active 7 days', value: stats.active_last_7d, icon: <Clock className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50' },
            { label: 'Certificates Issued', value: stats.achievement_stats.certificates_issued, icon: <Award className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map(s => (
            <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
              <div className={`inline-flex p-1.5 rounded-lg ${s.bg} mb-2`}><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        <input type="text" placeholder="Search courses…" value={courseSearch}
          onChange={e => setCourseSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0d1b2a] bg-white" />
      </div>

      {/* Course cards */}
      {coursesLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0d1b2a]" />
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No courses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCourses.map(course => (
            <button key={course.id} onClick={() => goToCohorts(course)}
              className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#0d1b2a]/30 transition-all text-left group p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 mr-2">
                  <h3 className="font-semibold text-gray-900 group-hover:text-[#0d1b2a] transition-colors line-clamp-2">{course.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">{course.instructor_name}</p>
                </div>
                <EnrollTypeBadge type={course.enrollment_type} />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-gray-900">{course.total_students}</p>
                  <p className="text-xs text-gray-500">Students</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-emerald-600">{course.active_students}</p>
                  <p className="text-xs text-gray-500">Active</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-bold text-[#0d1b2a]">{course.cohort_count}</p>
                  <p className="text-xs text-gray-500">Cohorts</p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${course.is_published ? 'text-emerald-600' : 'text-gray-400'}`}>
                  {course.is_published ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {course.is_published ? 'Published' : 'Draft'}
                </span>
                <span className="text-xs text-[#0d1b2a] font-medium group-hover:underline flex items-center gap-1">
                  View Cohorts <ChevronRight className="w-3 h-3" />
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // VIEW 2: COHORTS
  // ─────────────────────────────────────────────────────────────────
  const CohortsView = () => (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Layers className="w-7 h-7 text-[#0d1b2a]" />{selectedCourse?.title}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Select a cohort to manage its students</p>
        </div>
        <button onClick={goBackToCourses}
          className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
          <ArrowLeft className="w-4 h-4" /> All Courses
        </button>
      </div>

      {/* Course summary */}
      {selectedCourse && (
        <div className="bg-[#0d1b2a]/5 border border-[#0d1b2a]/20 rounded-xl px-5 py-4 flex flex-wrap items-center gap-6">
          <div className="flex items-center gap-2 text-sm text-[#0d1b2a]">
            <Users2 className="w-4 h-4" />
            <strong>{selectedCourse.total_students}</strong> total students
          </div>
          <div className="flex items-center gap-2 text-sm text-[#0d1b2a]">
            <UserCheck className="w-4 h-4" />
            <strong>{selectedCourse.active_students}</strong> active
          </div>
          <div className="flex items-center gap-2 text-sm text-[#0d1b2a]">
            <BadgeCheck className="w-4 h-4" />
            <strong>{selectedCourse.completed_students}</strong> completed
          </div>
          <div className="flex items-center gap-2 text-sm text-[#0d1b2a]">
            <Layers className="w-4 h-4" />
            <strong>{selectedCourse.cohort_count}</strong> cohorts
          </div>
          <EnrollTypeBadge type={selectedCourse.enrollment_type} />
        </div>
      )}

      {cohortsLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0d1b2a]" />
        </div>
      ) : cohorts.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No cohorts found for this course</p>
          <p className="text-gray-400 text-sm mt-1">Students enrolled directly will appear in &quot;No Cohort&quot;</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {cohorts.map((cohort, idx) => {
            const fillPct = cohort.max_students
              ? Math.min(100, Math.round((cohort.total_students / cohort.max_students) * 100))
              : null;
            const isNoCohort = cohort.id === null;
            return (
              <button key={cohort.id ?? 'no-cohort'} onClick={() => goToStudents(cohort)}
                className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-[#0d1b2a]/30 transition-all text-left group p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold text-gray-900 group-hover:text-[#0d1b2a] transition-colors">
                      {cohort.cohort_label}
                    </h3>
                    {cohort.description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-1">{cohort.description}</p>
                    )}
                  </div>
                  {!isNoCohort && <CohortStatusBadge status={cohort.status} />}
                </div>

                {/* Dates */}
                {(cohort.cohort_start || cohort.cohort_end) && (
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-3">
                    <Calendar className="w-3 h-3 flex-shrink-0" />
                    <span>
                      {fmtDate(cohort.cohort_start) || '?'} – {fmtDate(cohort.cohort_end) || 'Ongoing'}
                    </span>
                  </div>
                )}

                {/* Student stats */}
                <div className="grid grid-cols-3 gap-2 mb-3">
                  <div className="text-center">
                    <p className="text-base font-bold text-gray-900">{cohort.total_students}</p>
                    <p className="text-xs text-gray-500">Total</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-emerald-600">{cohort.active_students}</p>
                    <p className="text-xs text-gray-500">Active</p>
                  </div>
                  <div className="text-center">
                    <p className="text-base font-bold text-[#0d1b2a]">{cohort.completed_students}</p>
                    <p className="text-xs text-gray-500">Done</p>
                  </div>
                </div>

                {/* Capacity bar */}
                {fillPct !== null && (
                  <div className="mb-3">
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
                      <span>Capacity</span>
                      <span>{cohort.total_students}/{cohort.max_students}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full ${fillPct >= 90 ? 'bg-red-500' : fillPct >= 70 ? 'bg-amber-400' : 'bg-emerald-500'}`}
                        style={{ width: `${fillPct}%` }} />
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                  <EnrollTypeBadge type={cohort.enrollment_type} />
                  <span className="text-xs text-[#0d1b2a] font-medium group-hover:underline flex items-center gap-1">
                    Manage <ChevronRight className="w-3 h-3" />
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  // VIEW 3: STUDENTS
  // ─────────────────────────────────────────────────────────────────
  const StudentsView = () => (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4">
        <div>
          <Breadcrumb />
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
            <Users className="w-7 h-7 text-[#0d1b2a]" />
            {selectedCohort?.cohort_label}
          </h1>
          {selectedCourse && (
            <p className="text-gray-500 mt-0.5 text-sm">{selectedCourse.title}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={goBackToCohorts}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Cohorts
          </button>
          <button onClick={handleExport} disabled={isExporting}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50">
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {selectedStudents.length > 0 ? `Export (${selectedStudents.length})` : 'Export CSV'}
          </button>
          <button onClick={() => fetchStudents()}
            className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <RefreshCw className={`w-4 h-4 ${studentsLoading ? 'animate-spin' : ''}`} />
          </button>
          {selectedCohort && selectedCohort.id !== null && (
            <button onClick={() => setMessageModal({ open: true, recipients: students.map(s => ({ id: s.id, name: getStudentName(s) })) })}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
              <Mail className="w-4 h-4" /> Message All
            </button>
          )}
        </div>
      </div>

      {/* Cohort info */}
      {selectedCohort && (
        <div className="bg-[#0d1b2a]/5 border border-[#0d1b2a]/20 rounded-xl px-5 py-3.5 flex flex-wrap items-center gap-5">
          <div className="flex items-center gap-2">
            {selectedCohort.id !== null && <CohortStatusBadge status={selectedCohort.status} />}
            <EnrollTypeBadge type={selectedCohort.enrollment_type} />
          </div>
          {(selectedCohort.cohort_start || selectedCohort.cohort_end) && (
            <span className="flex items-center gap-1.5 text-xs text-[#0d1b2a]">
              <Calendar className="w-3 h-3" />
              {fmtDate(selectedCohort.cohort_start) || '?'} – {fmtDate(selectedCohort.cohort_end) || 'Ongoing'}
            </span>
          )}
          <span className="flex items-center gap-1.5 text-xs text-[#0d1b2a]">
            <Users2 className="w-3 h-3" /> <strong>{selectedCohort.active_students}</strong> active /
            <strong>{selectedCohort.total_students}</strong> total
            {selectedCohort.max_students && <span>/ {selectedCohort.max_students} capacity</span>}
          </span>
        </div>
      )}

      {/* Filters toggle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <button onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl">
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#0d1b2a] text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        {showFilters && (
          <div className="px-5 pb-4 border-t border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                <input type="text" placeholder="Search students…" value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-[#0d1b2a]" />
              </div>
              {[
                { key: 'status', options: [['', 'All Statuses'], ['active', 'Active'], ['inactive', 'Inactive']] },
                { key: 'enrollment_status', options: [['', 'All Enrollment'], ['active', 'Active'], ['completed', 'Completed'], ['terminated', 'Terminated']] },
                { key: 'performance', options: [['', 'All Performance'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
              ].map(f => (
                <select key={f.key} value={(filters as any)[f.key]}
                  onChange={e => handleFilterChange(f.key, e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a] bg-white">
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
              <select value={filters.sort_by} onChange={e => handleFilterChange('sort_by', e.target.value)}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-[#0d1b2a]">
                <option value="created_at">Registered</option>
                <option value="username">Username</option>
                <option value="last_activity">Last Activity</option>
              </select>
              <button onClick={() => handleFilterChange('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs hover:bg-gray-50">
                {filters.sort_order === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
              </button>
              <select value={pagination.per_page.toString()}
                onChange={e => setPagination(p => ({ ...p, per_page: parseInt(e.target.value), current_page: 1 }))}
                className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white">
                {['10', '20', '50', '100'].map(v => <option key={v} value={v}>{v} per page</option>)}
              </select>
              {activeFilterCount > 0 && (
                <button onClick={() => { setFilters({ search: '', status: '', enrollment_status: '', performance: '', sort_by: 'created_at', sort_order: 'desc' }); setPagination(p => ({ ...p, current_page: 1 })); }}
                  className="text-xs text-red-600 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50 flex items-center gap-1">
                  <X className="w-3 h-3" /> Clear
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bulk actions */}
      {selectedStudents.length > 0 && (
        <div className="bg-[#0d1b2a]/5 border border-[#0d1b2a]/20 rounded-xl px-5 py-3 flex flex-wrap items-center justify-between gap-3">
          <span className="text-sm font-semibold text-[#0d1b2a]">{selectedStudents.length} selected</span>
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setMessageModal({ open: true, recipients: selectedRecipients })}
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5" /> Message
            </button>
            <button onClick={() => handleBulkAction('activate')}
              className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Activate
            </button>
            <button onClick={() => handleBulkAction('deactivate')}
              className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <UserX className="w-3.5 h-3.5" /> Deactivate
            </button>
            <button onClick={() => setConfirmDialog({
              open: true, title: 'Reset Progress', danger: true,
              description: `Reset progress for ${selectedStudents.length} students?`,
              confirmLabel: 'Reset', onConfirm: () => handleBulkAction('reset_progress'),
            })} className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
              <RotateCcw className="w-3.5 h-3.5" /> Reset Progress
            </button>
            <button onClick={() => setSelectedStudents([])}
              className="text-sm text-gray-500 hover:text-gray-700 border border-gray-200 px-3 py-1.5 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 w-10">
                  <input type="checkbox"
                    checked={selectedStudents.length === students.length && students.length > 0}
                    onChange={e => setSelectedStudents(e.target.checked ? students.map(s => s.id) : [])}
                    className="rounded border-gray-300 text-[#0d1b2a] focus:ring-[#0d1b2a]" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Activity</th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {studentsLoading && students.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#0d1b2a] mx-auto mb-2" />
                  <p className="text-gray-500 text-sm">Loading students…</p>
                </td></tr>
              ) : students.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center">
                  <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                  <p className="text-gray-600 font-medium">No students in this cohort</p>
                  {activeFilterCount > 0 && (
                    <button onClick={() => { setFilters({ search: '', status: '', enrollment_status: '', performance: '', sort_by: 'created_at', sort_order: 'desc' }); }}
                      className="mt-2 text-sm text-[#0d1b2a] hover:underline">Clear filters</button>
                  )}
                </td></tr>
              ) : students.map(student => {
                const perf = student.performance_level;
                const perfCls = { high: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-red-100 text-red-700' }[perf] || '';
                const progColor = student.progress_summary.avg_progress >= 75 ? 'bg-emerald-500' : student.progress_summary.avg_progress >= 40 ? 'bg-amber-400' : 'bg-red-400';
                const daysCls = student.activity.days_inactive === null ? 'text-gray-400' : student.activity.days_inactive === 0 ? 'text-emerald-600' : student.activity.days_inactive <= 7 ? 'text-green-600' : student.activity.days_inactive <= 14 ? 'text-orange-500' : 'text-red-500';
                return (
                  <tr key={student.id}
                    className={`hover:bg-gray-50/70 transition-colors ${selectedStudents.includes(student.id) ? 'bg-[#0d1b2a]/5/40' : ''}`}>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedStudents.includes(student.id)}
                        onChange={() => setSelectedStudents(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id])}
                        className="rounded border-gray-300 text-[#0d1b2a] focus:ring-[#0d1b2a]" />
                    </td>
                    <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/admin/students/${student.id}`)}>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#162844] to-[#0d1b2a] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
                          {(student.first_name?.[0] || student.username[0]).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-gray-900 truncate">{getStudentName(student)}</p>
                          <p className="text-xs text-gray-400 truncate">{student.email}</p>
                          {student.phone_number && (
                            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                              <a href={`tel:${student.phone_number}`}
                                onClick={e => e.stopPropagation()}
                                className="flex items-center gap-1 text-xs text-gray-500 hover:text-[#0d1b2a]">
                                <Phone className="w-3 h-3 flex-shrink-0" />
                                <span>{student.phone_number}</span>
                              </a>
                              {student.whatsapp_number && (
                                <a href={`https://wa.me/${student.whatsapp_number.replace(/\D/g,'')}`}
                                  target="_blank" rel="noopener noreferrer"
                                  onClick={e => e.stopPropagation()}
                                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700">
                                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-700 px-1 rounded">WA</span>
                                  {student.whatsapp_number !== student.phone_number && (
                                    <span>{student.whatsapp_number}</span>
                                  )}
                                </a>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${student.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                        {student.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {student.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className="text-sm font-semibold text-gray-800">{student.progress_summary.avg_progress}%</span>
                        <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full ${progColor}`}
                            style={{ width: `${Math.min(student.progress_summary.avg_progress, 100)}%` }} />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {perfCls && (
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${perfCls}`}>
                          {perf === 'high' ? <TrendingUp className="w-3 h-3" /> : perf === 'low' ? <AlertTriangle className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
                          {perf.charAt(0).toUpperCase() + perf.slice(1)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden md:table-cell">
                      <span className={`text-xs font-medium ${daysCls}`}>
                        {student.activity.days_inactive === null ? 'Never' : student.activity.days_inactive === 0 ? 'Today' : `${student.activity.days_inactive}d ago`}
                      </span>
                      {student.activity.days_inactive !== null && student.activity.days_inactive > 14 && (
                        <p className="text-xs text-red-400 flex items-center justify-center gap-0.5 mt-0.5">
                          <ShieldAlert className="w-3 h-3" /> At risk
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <RowActionMenu
                        student={student}
                        onView={() => router.push(`/admin/students/${student.id}`)}
                        onToggleStatus={() => handleToggleStatus(student)}
                        onEnroll={() => setEnrollModal({ open: true, student })}
                        onResetProgress={() => handleResetProgress(student)}
                        onMessage={() => setMessageModal({ open: true, recipients: [{ id: student.id, name: getStudentName(student) }] })}
                        onDeleteConfirm={() => setConfirmDialog({
                          open: true, title: 'Remove Student',
                          description: `Remove ${student.username} from the platform?`,
                          confirmLabel: 'Remove', danger: true,
                          onConfirm: async () => {
                            try { await AdminStudentService.toggleStatus(student.id); toast.info('Account deactivated'); fetchStudents(); }
                            catch (e: any) { toast.error(e.message); }
                          },
                        })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {pagination.total_pages > 1 && (
          <div className="px-5 py-3.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-gray-500">
              Showing <span className="font-medium">{(pagination.current_page - 1) * pagination.per_page + 1}–{Math.min(pagination.current_page * pagination.per_page, pagination.total_items)}</span>
              {' '}of <span className="font-medium">{pagination.total_items.toLocaleString()}</span>
            </p>
            <div className="flex items-center gap-1">
              <button onClick={() => setPagination(p => ({ ...p, current_page: 1 }))} disabled={!pagination.has_prev}
                className="px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-40">«</button>
              <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page - 1 }))} disabled={!pagination.has_prev}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
              {(() => {
                const start = Math.max(1, Math.min(pagination.current_page - 2, pagination.total_pages - 4));
                return Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                  const page = start + i;
                  if (page > pagination.total_pages) return null;
                  return (
                    <button key={page} onClick={() => setPagination(p => ({ ...p, current_page: page }))}
                      className={`w-8 h-8 rounded-lg text-sm font-medium ${page === pagination.current_page ? 'bg-[#0d1b2a] text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                      {page}
                    </button>
                  );
                });
              })()}
              <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page + 1 }))} disabled={!pagination.has_next}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
              <button onClick={() => setPagination(p => ({ ...p, current_page: p.total_pages }))} disabled={!pagination.has_next}
                className="px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-40">»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        {view === 'courses' && <CoursesView />}
        {view === 'cohorts' && <CohortsView />}
        {view === 'students' && <StudentsView />}
      </div>

      {/* Modals */}
      <EnrollModal open={enrollModal.open} student={enrollModal.student} courses={availableCourses}
        onClose={() => setEnrollModal({ open: false, student: null })} onSuccess={fetchStudents} />
      <MessageModal open={messageModal.open} recipients={messageModal.recipients}
        onClose={() => setMessageModal({ open: false, recipients: [] })} />
      <ConfirmDialog
        open={confirmDialog.open} title={confirmDialog.title} description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel} danger={confirmDialog.danger}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })); }}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
