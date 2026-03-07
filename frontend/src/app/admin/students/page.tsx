'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminStudentService,
  StudentListItem,
  StudentListResponse,
  StudentStats,
  AvailableCourse,
} from '@/services/admin-student.service';
import { toast } from 'sonner';
import {
  RefreshCw, Search, Download, GraduationCap, Users, TrendingUp,
  Award, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronLeft,
  ChevronRight, Eye, UserCheck, UserX, BookOpen, Filter, BarChart3,
  Mail, RotateCcw, MoreVertical, BookPlus, MessageSquare, UserPlus,
  Trash2, ChevronDown, Send, X, Plus, ShieldAlert,
} from 'lucide-react';

// ─── Debounce hook ────────────────────────────────────────────────────────────
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debouncedValue;
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────
function ConfirmDialog({
  open, title, description, confirmLabel = 'Confirm', danger = false,
  onConfirm, onCancel,
}: {
  open: boolean; title: string; description: string;
  confirmLabel?: string; danger?: boolean;
  onConfirm: () => void; onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium hover:bg-gray-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium text-white ${danger ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Enroll Modal ─────────────────────────────────────────────────────────────
function EnrollModal({
  open, student, courses, onClose, onSuccess,
}: {
  open: boolean;
  student: StudentListItem | null;
  courses: AvailableCourse[];
  onClose: () => void;
  onSuccess: () => void;
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
        course_id: parseInt(courseId),
        payment_status: 'not_required',
        payment_verified: true,
        cohort_label: cohortLabel || undefined,
      });
      toast.success(`${student.username} enrolled successfully`);
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Enrollment failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-blue-600" /> Enroll Student
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Enrolling: <strong>{student.first_name} {student.last_name || student.username}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required>
              <option value="">Select a course…</option>
              {courses.map(c => (
                <option key={c.id} value={c.id}>{c.title}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort Label (optional)</label>
            <input type="text" value={cohortLabel} onChange={e => setCohortLabel(e.target.value)}
              placeholder="e.g. Cohort 2026-A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {loading && <RefreshCw className="w-4 h-4 animate-spin" />} Enroll
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Send Message Modal ───────────────────────────────────────────────────────
function MessageModal({
  open, recipients, onClose, onSuccess,
}: {
  open: boolean;
  recipients: Array<{ id: number; name: string }>;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { if (open) { setSubject(''); setMessage(''); } }, [open]);

  if (!open) return null;

  const isBulk = recipients.length > 1;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) { toast.error('Subject and message are required'); return; }
    try {
      setLoading(true);
      if (isBulk) {
        const res = await AdminStudentService.bulkMessage({
          student_ids: recipients.map(r => r.id),
          subject, message,
        });
        toast.success(res.message);
      } else {
        const res = await AdminStudentService.sendMessage(recipients[0].id, { subject, message });
        toast.success(res.message);
      }
      onSuccess();
      onClose();
    } catch (e: any) {
      toast.error(e.message || 'Failed to send message');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            {isBulk ? `Message ${recipients.length} Students` : `Message ${recipients[0]?.name}`}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {isBulk && (
            <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
              {recipients.slice(0, 10).map(r => (
                <span key={r.id} className="bg-blue-50 text-blue-700 text-xs px-2 py-0.5 rounded-full">{r.name}</span>
              ))}
              {recipients.length > 10 && <span className="text-xs text-gray-500">+{recipients.length - 10} more</span>}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Subject *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Message subject"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)}
              rows={5} placeholder="Write your message…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 resize-none" required />
            <p className="text-xs text-gray-400 mt-1">{message.length}/5000</p>
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={loading}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 flex items-center gap-2">
              {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Send Message
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Bulk Enroll Modal ────────────────────────────────────────────────────────
function BulkEnrollModal({
  open, count, courses, onClose, onConfirm,
}: {
  open: boolean; count: number; courses: AvailableCourse[];
  onClose: () => void;
  onConfirm: (courseId: number, cohortLabel?: string) => void;
}) {
  const [courseId, setCourseId] = useState('');
  const [cohortLabel, setCohortLabel] = useState('');

  useEffect(() => { if (open) { setCourseId(''); setCohortLabel(''); } }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookPlus className="w-5 h-5 text-blue-600" /> Bulk Enroll {count} Students
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Course *</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500">
              <option value="">Select a course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Cohort Label (optional)</label>
            <input type="text" value={cohortLabel} onChange={e => setCohortLabel(e.target.value)}
              placeholder="e.g. 2026-A"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-gray-50">Cancel</button>
            <button onClick={() => { if (courseId) { onConfirm(parseInt(courseId), cohortLabel || undefined); onClose(); } else toast.error('Select a course'); }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-2">
              <BookPlus className="w-4 h-4" /> Enroll All
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Action Dropdown per row ──────────────────────────────────────────────────
function RowActionMenu({
  student, courses,
  onView, onToggleStatus, onEnroll, onResetProgress, onMessage, onDeleteConfirm,
}: {
  student: StudentListItem; courses: AvailableCourse[];
  onView: () => void; onToggleStatus: () => void; onEnroll: () => void;
  onResetProgress: () => void; onMessage: () => void; onDeleteConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const btn = (icon: React.ReactNode, label: string, onClick: () => void, color = 'text-gray-700') => (
    <button
      onClick={() => { onClick(); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm ${color} hover:bg-gray-50 rounded-md transition-colors`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button onClick={onView}
          className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg" title="View Profile">
          <Eye className="w-4 h-4" />
        </button>
        <button onClick={onMessage}
          className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Send Message">
          <Mail className="w-4 h-4" />
        </button>
        <button onClick={() => setOpen(!open)}
          className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg" title="More actions">
          <MoreVertical className="w-4 h-4" />
        </button>
      </div>
      {open && (
        <div className="absolute right-0 top-9 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-[180px] py-1.5 px-1">
          {btn(<Eye className="w-4 h-4 text-blue-500" />, 'View Profile', onView)}
          {btn(<BookPlus className="w-4 h-4 text-green-500" />, 'Enroll in Course', onEnroll)}
          {btn(student.is_active
            ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />,
            student.is_active ? 'Deactivate Account' : 'Activate Account',
            onToggleStatus,
            student.is_active ? 'text-orange-700' : 'text-green-700'
          )}
          <div className="border-t border-gray-100 my-1" />
          {btn(<RotateCcw className="w-4 h-4 text-yellow-500" />, 'Reset Progress', onResetProgress, 'text-yellow-700')}
          {btn(<Trash2 className="w-4 h-4 text-red-500" />, 'Remove Student', onDeleteConfirm, 'text-red-700')}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function StudentManagementPage() {
  const router = useRouter();
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [courses, setCourses] = useState<AvailableCourse[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(true);

  // Modals
  const [enrollModal, setEnrollModal] = useState<{ open: boolean; student: StudentListItem | null }>({ open: false, student: null });
  const [messageModal, setMessageModal] = useState<{ open: boolean; recipients: Array<{ id: number; name: string }> }>({ open: false, recipients: [] });
  const [bulkEnrollModal, setBulkEnrollModal] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; confirmLabel?: string;
    danger?: boolean; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const [pagination, setPagination] = useState({
    current_page: 1, per_page: 20, total_pages: 1,
    total_items: 0, has_next: false, has_prev: false,
  });

  const [filters, setFilters] = useState({
    search: '', status: '', course_id: '', enrollment_status: '',
    performance: '', sort_by: 'created_at', sort_order: 'desc' as 'asc' | 'desc',
    date_from: '', date_to: '',
  });

  const debouncedSearch = useDebounce(filters.search, 350);

  const fetchStudents = useCallback(async () => {
    try {
      setLoading(true);
      const response = await AdminStudentService.listStudents({
        page: pagination.current_page,
        per_page: pagination.per_page,
        search: debouncedSearch || undefined,
        status: filters.status || undefined,
        course_id: filters.course_id ? parseInt(filters.course_id) : undefined,
        enrollment_status: filters.enrollment_status || undefined,
        performance: (filters.performance as any) || undefined,
        sort_by: filters.sort_by,
        sort_order: filters.sort_order,
        date_from: filters.date_from || undefined,
        date_to: filters.date_to || undefined,
      });
      setStudents(response.students);
      setPagination(prev => ({ ...prev, ...response.pagination }));
    } catch (error: any) {
      toast.error(error.message || 'Failed to load students');
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, [pagination.current_page, pagination.per_page, debouncedSearch, filters.status,
      filters.course_id, filters.enrollment_status, filters.performance,
      filters.sort_by, filters.sort_order, filters.date_from, filters.date_to]);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => {
    AdminStudentService.getStats().then(setStats).catch(console.error);
    AdminStudentService.getAvailableCourses().then(r => setCourses(r.courses)).catch(console.error);
  }, []);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    if (!['sort_by', 'sort_order'].includes(key)) {
      setPagination(prev => ({ ...prev, current_page: 1 }));
    }
  };

  const resetFilters = () => {
    setFilters({ search: '', status: '', course_id: '', enrollment_status: '',
      performance: '', sort_by: 'created_at', sort_order: 'desc', date_from: '', date_to: '' });
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const activeFilterCount = [filters.search, filters.status, filters.course_id,
    filters.enrollment_status, filters.performance, filters.date_from, filters.date_to
  ].filter(Boolean).length;

  // ─── Actions ─────────────────────────────────────────────────────────────
  const handleToggleStatus = async (student: StudentListItem) => {
    setConfirmDialog({
      open: true,
      title: student.is_active ? 'Deactivate Student' : 'Activate Student',
      description: `Are you sure you want to ${student.is_active ? 'deactivate' : 'activate'} ${student.username}?`,
      confirmLabel: student.is_active ? 'Deactivate' : 'Activate',
      danger: student.is_active,
      onConfirm: async () => {
        try {
          const res = await AdminStudentService.toggleStatus(student.id);
          toast.success(res.message);
          fetchStudents();
          AdminStudentService.getStats().then(setStats);
        } catch (e: any) { toast.error(e.message || 'Failed'); }
      },
    });
  };

  const handleResetProgress = (student: StudentListItem) => {
    setConfirmDialog({
      open: true,
      title: 'Reset Student Progress',
      description: `This will reset all lesson completions and module progress for ${student.username}. Quiz submissions will be kept. This cannot be undone.`,
      confirmLabel: 'Reset Progress',
      danger: true,
      onConfirm: async () => {
        try {
          const res = await AdminStudentService.resetProgress(student.id);
          toast.success(res.message);
          fetchStudents();
        } catch (e: any) { toast.error(e.message || 'Failed to reset'); }
      },
    });
  };

  const handleBulkAction = async (action: string, extraData?: any) => {
    if (selectedStudents.length === 0) { toast.error('No students selected'); return; }
    try {
      const result = await AdminStudentService.bulkAction({
        student_ids: selectedStudents,
        action: action as any,
        ...extraData,
      });
      toast.success(result.message);
      setSelectedStudents([]);
      fetchStudents();
      AdminStudentService.getStats().then(setStats);
    } catch (e: any) { toast.error(e.message || 'Bulk action failed'); }
  };

  const handleBulkEnroll = async (courseId: number, cohortLabel?: string) => {
    if (selectedStudents.length === 0) { toast.error('No students selected'); return; }
    try {
      const res = await AdminStudentService.bulkEnroll({
        student_ids: selectedStudents,
        course_id: courseId,
        payment_verified: true,
        payment_status: 'not_required',
        cohort_label: cohortLabel,
      });
      toast.success(`${res.enrolled} students enrolled in ${res.course}`);
      if (res.skipped > 0) toast.info(`${res.skipped} already enrolled (skipped)`);
      setSelectedStudents([]);
      fetchStudents();
    } catch (e: any) { toast.error(e.message || 'Bulk enroll failed'); }
  };

  const handleExport = async () => {
    try {
      setIsExporting(true);
      await AdminStudentService.exportCSV({
        search: filters.search || undefined,
        status: filters.status || undefined,
        course_id: filters.course_id ? parseInt(filters.course_id) : undefined,
        student_ids: selectedStudents.length > 0 ? selectedStudents : undefined,
      });
      toast.success('Export downloaded');
    } catch (e: any) { toast.error('Export failed'); }
    finally { setIsExporting(false); }
  };

  const handleSelectAll = (checked: boolean) => setSelectedStudents(checked ? students.map(s => s.id) : []);
  const handleSelectStudent = (id: number) =>
    setSelectedStudents(prev => prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]);

  const getStudentName = (s: StudentListItem) =>
    s.first_name && s.last_name ? `${s.first_name} ${s.last_name}` : s.username;

  const getPerformanceBadge = (level: string) => {
    const map: Record<string, string> = {
      high: 'bg-emerald-100 text-emerald-700',
      medium: 'bg-amber-100 text-amber-700',
      low: 'bg-red-100 text-red-700',
    };
    const icons: Record<string, React.ReactNode> = {
      high: <TrendingUp className="w-3 h-3" />,
      medium: <BarChart3 className="w-3 h-3" />,
      low: <AlertTriangle className="w-3 h-3" />,
    };
    const labels: Record<string, string> = { high: 'High', medium: 'Medium', low: 'Low' };
    if (!map[level]) return null;
    return (
      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${map[level]}`}>
        {icons[level]} {labels[level]}
      </span>
    );
  };

  const getActivityColor = (days: number | null) => {
    if (days === null) return 'text-gray-400';
    if (days === 0) return 'text-emerald-600';
    if (days <= 3) return 'text-emerald-500';
    if (days <= 7) return 'text-green-600';
    if (days <= 14) return 'text-orange-500';
    return 'text-red-500';
  };

  const selectedStudentRecipients = students
    .filter(s => selectedStudents.includes(s.id))
    .map(s => ({ id: s.id, name: getStudentName(s) }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <GraduationCap className="w-8 h-8 text-blue-600" /> Student Management
            </h1>
            <p className="text-gray-500 mt-1 text-sm">
              Manage students, enrollments, and track performance
              {pagination.total_items > 0 && <span className="ml-2 font-medium text-gray-700">· {pagination.total_items.toLocaleString()} students</span>}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                setIsRefreshing(true);
                fetchStudents();
                AdminStudentService.getStats().then(setStats);
              }}
              disabled={isRefreshing}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={handleExport}
              disabled={isExporting}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 shadow-sm"
            >
              {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {selectedStudents.length > 0 ? `Export (${selectedStudents.length})` : 'Export CSV'}
            </button>
            <button
              onClick={() => router.push('/admin/users/create')}
              className="bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            >
              <UserPlus className="w-4 h-4" /> Add Student
            </button>
            <button
              onClick={() => router.push('/admin/students/performance')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm"
            >
              <BarChart3 className="w-4 h-4" /> Performance Report
            </button>
          </div>
        </div>

        {/* ── Stats Cards ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: 'Total', value: stats.total_students, icon: <Users className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50' },
              { label: 'Active', value: stats.active_students, icon: <UserCheck className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
              { label: 'Active 7d', value: stats.active_last_7d, icon: <Clock className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50' },
              { label: 'New 30d', value: stats.new_students_30d, icon: <UserPlus className="w-4 h-4" />, color: 'text-violet-600', bg: 'bg-violet-50' },
              { label: 'Enrollments', value: stats.enrollment_stats.total, icon: <BookOpen className="w-4 h-4" />, color: 'text-sky-600', bg: 'bg-sky-50' },
              { label: 'Certificates', value: stats.achievement_stats.certificates_issued, icon: <Award className="w-4 h-4" />, color: 'text-amber-600', bg: 'bg-amber-50' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm">
                <div className={`inline-flex p-1.5 rounded-lg ${s.bg} mb-2`}>
                  <span className={s.color}>{s.icon}</span>
                </div>
                <p className="text-2xl font-bold text-gray-900">{s.value.toLocaleString()}</p>
                <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── Filters ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-gray-700 hover:bg-gray-50 rounded-xl"
          >
            <span className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              Filters
              {activeFilterCount > 0 && (
                <span className="bg-blue-600 text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>
              )}
            </span>
            <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>

          {showFilters && (
            <div className="px-5 pb-4 border-t border-gray-100">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-3 pt-4">
                <div className="relative xl:col-span-2">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
                  <input type="text" placeholder="Search name, email, username…"
                    value={filters.search} onChange={e => handleFilterChange('search', e.target.value)}
                    className="w-full pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500" />
                </div>
                {[
                  { key: 'status', label: 'Status', options: [['', 'All Statuses'], ['active', 'Active'], ['inactive', 'Inactive']] },
                  { key: 'enrollment_status', label: 'Enrollment', options: [['', 'All Enrollment'], ['active', 'Active'], ['completed', 'Completed'], ['terminated', 'Terminated']] },
                  { key: 'performance', label: 'Performance', options: [['', 'All Performance'], ['high', 'High Performers'], ['medium', 'Medium'], ['low', 'Low Performers']] },
                ].map(f => (
                  <select key={f.key} value={(filters as any)[f.key]}
                    onChange={e => handleFilterChange(f.key, e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                    {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                ))}
                <select value={filters.course_id} onChange={e => handleFilterChange('course_id', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 bg-white">
                  <option value="">All Courses</option>
                  {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                </select>
                <input type="date" value={filters.date_from}
                  onChange={e => handleFilterChange('date_from', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  title="Registered from" placeholder="From date" />
                <input type="date" value={filters.date_to}
                  onChange={e => handleFilterChange('date_to', e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  title="Registered to" placeholder="To date" />
              </div>

              <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-gray-100">
                <span className="text-xs text-gray-500">Sort:</span>
                <select value={filters.sort_by} onChange={e => handleFilterChange('sort_by', e.target.value)}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="created_at">Registration Date</option>
                  <option value="username">Username</option>
                  <option value="email">Email</option>
                  <option value="last_activity">Last Activity</option>
                  <option value="last_login">Last Login</option>
                </select>
                <button onClick={() => handleFilterChange('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs hover:bg-gray-50">
                  {filters.sort_order === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
                </button>
                <select value={pagination.per_page.toString()}
                  onChange={e => setPagination(prev => ({ ...prev, per_page: parseInt(e.target.value), current_page: 1 }))}
                  className="border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs bg-white focus:ring-2 focus:ring-blue-500">
                  <option value="10">10 per page</option>
                  <option value="20">20 per page</option>
                  <option value="50">50 per page</option>
                  <option value="100">100 per page</option>
                </select>
                {activeFilterCount > 0 && (
                  <button onClick={resetFilters}
                    className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1 border border-red-200 px-2.5 py-1.5 rounded-lg hover:bg-red-50">
                    <X className="w-3 h-3" /> Clear filters
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Bulk Actions Bar ── */}
        {selectedStudents.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="text-sm font-semibold text-blue-800">
                {selectedStudents.length} student{selectedStudents.length > 1 ? 's' : ''} selected
              </span>
              <button onClick={() => setSelectedStudents([])}
                className="text-xs text-blue-600 hover:text-blue-700 flex items-center gap-1"><X className="w-3 h-3" /> Clear</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button onClick={() => setMessageModal({ open: true, recipients: selectedStudentRecipients })}
                className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Message
              </button>
              <button onClick={() => setBulkEnrollModal(true)}
                className="bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <BookPlus className="w-3.5 h-3.5" /> Enroll
              </button>
              <button onClick={() => setConfirmDialog({
                open: true, title: 'Activate Selected Students',
                description: `Activate ${selectedStudents.length} selected student(s)?`,
                confirmLabel: 'Activate',
                onConfirm: () => handleBulkAction('activate')
              })}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <UserCheck className="w-3.5 h-3.5" /> Activate
              </button>
              <button onClick={() => setConfirmDialog({
                open: true, title: 'Deactivate Selected Students',
                description: `Deactivate ${selectedStudents.length} student(s)?`, confirmLabel: 'Deactivate', danger: true,
                onConfirm: () => handleBulkAction('deactivate')
              })}
                className="bg-orange-600 hover:bg-orange-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <UserX className="w-3.5 h-3.5" /> Deactivate
              </button>
              <button onClick={() => setConfirmDialog({
                open: true, title: 'Reset Progress',
                description: `Reset all progress for ${selectedStudents.length} student(s)? This cannot be undone.`,
                confirmLabel: 'Reset', danger: true,
                onConfirm: () => handleBulkAction('reset_progress')
              })}
                className="bg-red-100 hover:bg-red-200 text-red-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Reset Progress
              </button>
              <button onClick={handleExport} disabled={isExporting}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50">
                <Download className="w-3.5 h-3.5" /> Export
              </button>
            </div>
          </div>
        )}

        {/* ── Table ── */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox"
                      checked={selectedStudents.length === students.length && students.length > 0}
                      onChange={e => handleSelectAll(e.target.checked)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Enrollments</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden lg:table-cell">Lessons</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Activity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading && students.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <RefreshCw className="w-6 h-6 animate-spin text-blue-500 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">Loading students…</p>
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-16 text-center">
                      <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                      <p className="text-gray-600 font-medium">No students found</p>
                      <p className="text-gray-400 text-sm mt-1">Try adjusting your filters</p>
                      {activeFilterCount > 0 && (
                        <button onClick={resetFilters} className="mt-3 text-sm text-blue-600 hover:text-blue-700">
                          Clear all filters
                        </button>
                      )}
                    </td>
                  </tr>
                ) : (
                  students.map(student => (
                    <tr key={student.id}
                      className={`hover:bg-gray-50/70 transition-colors ${selectedStudents.includes(student.id) ? 'bg-blue-50/40' : ''}`}>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <input type="checkbox"
                          checked={selectedStudents.includes(student.id)}
                          onChange={() => handleSelectStudent(student.id)}
                          className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                      </td>
                      <td className="px-4 py-3 cursor-pointer" onClick={() => router.push(`/admin/students/${student.id}`)}>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
                            {(student.first_name?.[0] || student.username[0]).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-gray-900 truncate">{getStudentName(student)}</p>
                            <p className="text-xs text-gray-400 truncate">{student.email}</p>
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
                        <div className="text-sm">
                          <span className="font-semibold text-gray-900">{student.enrollment_summary.active}</span>
                          <span className="text-gray-400 text-xs"> of {student.enrollment_summary.total}</span>
                        </div>
                        {student.enrollment_summary.completed > 0 && (
                          <p className="text-xs text-emerald-600 font-medium">{student.enrollment_summary.completed} done</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className="text-sm font-semibold text-gray-800">{student.progress_summary.avg_progress}%</span>
                          <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                student.progress_summary.avg_progress >= 75 ? 'bg-emerald-500' :
                                student.progress_summary.avg_progress >= 40 ? 'bg-amber-400' : 'bg-red-400'
                              }`}
                              style={{ width: `${Math.min(student.progress_summary.avg_progress, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {getPerformanceBadge(student.performance_level)}
                        {student.progress_summary.avg_score > 0 && (
                          <p className="text-xs text-gray-400 mt-0.5">{student.progress_summary.avg_score} pts</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden lg:table-cell">
                        <span className="text-sm font-medium text-gray-700">{student.progress_summary.lessons_completed}</span>
                        {student.progress_summary.certificates > 0 && (
                          <p className="text-xs text-amber-600 flex items-center justify-center gap-0.5 mt-0.5">
                            <Award className="w-3 h-3" /> {student.progress_summary.certificates}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center hidden md:table-cell">
                        <span className={`text-xs font-medium ${getActivityColor(student.activity.days_inactive)}`}>
                          {student.activity.days_inactive === null ? 'Never' :
                           student.activity.days_inactive === 0 ? 'Today' :
                           `${student.activity.days_inactive}d ago`}
                        </span>
                        {student.activity.days_inactive !== null && student.activity.days_inactive > 14 && (
                          <p className="text-xs text-red-400 mt-0.5 flex items-center justify-center gap-0.5">
                            <ShieldAlert className="w-3 h-3" /> At risk
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                        <RowActionMenu
                          student={student}
                          courses={courses}
                          onView={() => router.push(`/admin/students/${student.id}`)}
                          onToggleStatus={() => handleToggleStatus(student)}
                          onEnroll={() => setEnrollModal({ open: true, student })}
                          onResetProgress={() => handleResetProgress(student)}
                          onMessage={() => setMessageModal({ open: true, recipients: [{ id: student.id, name: getStudentName(student) }] })}
                          onDeleteConfirm={() => setConfirmDialog({
                            open: true,
                            title: 'Remove Student',
                            description: `Remove ${student.username} from the platform? This will soft-delete the account.`,
                            confirmLabel: 'Remove', danger: true,
                            onConfirm: async () => {
                              try {
                                await AdminStudentService.toggleStatus(student.id);
                                toast.info(`Account deactivated (soft-delete)`);
                                fetchStudents();
                              } catch (e: any) { toast.error(e.message); }
                            },
                          })}
                        />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          {pagination.total_pages > 1 && (
            <div className="px-5 py-3.5 border-t border-gray-200 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium text-gray-700">{(pagination.current_page - 1) * pagination.per_page + 1}–{Math.min(pagination.current_page * pagination.per_page, pagination.total_items)}</span>{' '}
                of <span className="font-medium text-gray-700">{pagination.total_items.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagination(p => ({ ...p, current_page: 1 }))} disabled={!pagination.has_prev}
                  className="px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">«</button>
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page - 1 }))}
                  disabled={!pagination.has_prev} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {(() => {
                  const start = Math.max(1, Math.min(pagination.current_page - 2, pagination.total_pages - 4));
                  return Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    const page = start + i;
                    if (page > pagination.total_pages) return null;
                    return (
                      <button key={page} onClick={() => setPagination(p => ({ ...p, current_page: page }))}
                        className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${page === pagination.current_page ? 'bg-blue-600 text-white' : 'hover:bg-gray-100 text-gray-700'}`}>
                        {page}
                      </button>
                    );
                  });
                })()}
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page + 1 }))}
                  disabled={!pagination.has_next} className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.total_pages }))} disabled={!pagination.has_next}
                  className="px-2 py-1.5 text-xs rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Modals ── */}
      <EnrollModal
        open={enrollModal.open}
        student={enrollModal.student}
        courses={courses}
        onClose={() => setEnrollModal({ open: false, student: null })}
        onSuccess={fetchStudents}
      />
      <MessageModal
        open={messageModal.open}
        recipients={messageModal.recipients}
        onClose={() => setMessageModal({ open: false, recipients: [] })}
        onSuccess={() => {}}
      />
      <BulkEnrollModal
        open={bulkEnrollModal}
        count={selectedStudents.length}
        courses={courses}
        onClose={() => setBulkEnrollModal(false)}
        onConfirm={handleBulkEnroll}
      />
      <ConfirmDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel}
        danger={confirmDialog.danger}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })); }}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
