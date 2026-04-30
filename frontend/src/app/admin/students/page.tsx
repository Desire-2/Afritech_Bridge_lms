'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  AdminStudentService,
  StudentListItem,
  StudentDetailResponse,
  StudentStats,
  AvailableCourse,
  CourseStats,
  CohortStats,
} from '@/services/admin-student.service';
import waitlistService from '@/services/api/waitlist.service';
import { toast } from 'sonner';
import {
  RefreshCw, Search, Download, GraduationCap, Users, TrendingUp,
  Award, Clock, CheckCircle2, XCircle, AlertTriangle, ChevronLeft,
  ChevronRight, Eye, UserCheck, UserX, BookOpen, Filter, BarChart3,
  Mail, RotateCcw, MoreVertical, BookPlus, MessageSquare, UserPlus,
  Trash2, ChevronDown, Send, X, ShieldAlert, ArrowLeft, Calendar,
  Building2, Layers, Lock, Unlock, Users2, BadgeCheck, Phone, ArrowRightLeft,
  User, ExternalLink,
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1b2a] rounded-xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
        <p className="text-sm text-gray-500 mb-6">{description}</p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 rounded-lg border border-white/15 text-sm font-medium hover:bg-[#0a1628]">Cancel</button>
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1b2a] rounded-xl shadow-xl max-w-md w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2"><BookPlus className="w-5 h-5 text-[#0d1b2a]" />Enroll Student</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-sm text-gray-600">Enrolling: <strong>{student.first_name} {student.last_name || student.username}</strong></p>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Course *</label>
            <select value={courseId} onChange={e => setCourseId(e.target.value)}
              className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" required>
              <option value="">Select a course…</option>
              {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Cohort Label (optional)</label>
            <input type="text" value={cohortLabel} onChange={e => setCohortLabel(e.target.value)}
              placeholder="e.g. Cohort 2026-A"
              className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-[#0a1628]">Cancel</button>
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
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-[#0d1b2a] rounded-xl shadow-xl max-w-lg w-full">
        <div className="flex items-center justify-between p-5 border-b">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#0d1b2a]" />
            {isBulk ? `Message ${recipients.length} Students` : `Message ${recipients[0]?.name}`}
          </h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg"><X className="w-5 h-5" /></button>
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
            <label className="block text-sm font-medium text-gray-200 mb-1">Subject *</label>
            <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
              placeholder="Message subject"
              className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a]" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1">Message *</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={5}
              placeholder="Write your message…"
              className="w-full border border-white/15 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-[#0d1b2a] resize-none" required />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 border rounded-lg text-sm hover:bg-[#0a1628]">Cancel</button>
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

// ─── View Student Modal ────────────────────────────────────────────────────────
function ViewStudentModal({ studentId, listItem, allowEnrollAction, onClose, onToggleStatus, onEnroll, onMessage }: {
  studentId: number | null;
  listItem: StudentListItem | null;
  allowEnrollAction: boolean;
  onClose: () => void;
  onToggleStatus: (s: StudentListItem) => void;
  onEnroll: (s: StudentListItem) => void;
  onMessage: (s: StudentListItem) => void;
}) {
  const router = useRouter();
  const [detail, setDetail] = useState<StudentDetailResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'overview' | 'enrollments' | 'quiz' | 'achievements'>('overview');
  const [expandedEnrollment, setExpandedEnrollment] = useState<number | null>(null);

  useEffect(() => {
    if (!studentId) return;
    setDetail(null);
    setTab('overview');
    setExpandedEnrollment(null);
    setLoading(true);
    AdminStudentService.getStudentDetail(studentId)
      .then(setDetail)
      .catch(e => toast.error(e.message || 'Failed to load student'))
      .finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId || !listItem) return null;

  const name = listItem.first_name && listItem.last_name
    ? `${listItem.first_name} ${listItem.last_name}`
    : listItem.username;

  const perf = listItem.performance_level;
  const perfCls: Record<string, string> = {
    high: 'bg-emerald-900/40 text-emerald-300',
    medium: 'bg-amber-900/40 text-amber-300',
    low: 'bg-red-900/40 text-red-300',
  };

  const TABS = [
    { id: 'overview', label: 'Overview', icon: <User className="w-3.5 h-3.5" /> },
    { id: 'enrollments', label: 'Enrollments', icon: <BookOpen className="w-3.5 h-3.5" />, count: detail?.enrollments.length },
    { id: 'quiz', label: 'Quiz', icon: <BarChart3 className="w-3.5 h-3.5" />, count: detail?.quiz_performance.length },
    { id: 'achievements', label: 'Achievements', icon: <Award className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-[#0d1b2a] rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-white/10"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-start justify-between p-5 border-b border-white/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#162844] to-[#0a1628] border border-white/15 flex items-center justify-center text-white font-bold text-xl flex-shrink-0">
              {(listItem.first_name?.[0] || listItem.username[0]).toUpperCase()}
            </div>
            <div>
              <h2 className="text-xl font-bold text-white leading-tight">{name}</h2>
              <p className="text-sm text-gray-400">{listItem.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${listItem.is_active ? 'bg-emerald-900/40 text-emerald-300' : 'bg-red-900/40 text-red-300'}`}>
                  {listItem.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {listItem.is_active ? 'Active' : 'Inactive'}
                </span>
                {perf && (
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${perfCls[perf] || 'bg-white/10 text-gray-400'}`}>
                    {perf === 'high' ? <TrendingUp className="w-3 h-3" /> : perf === 'low' ? <AlertTriangle className="w-3 h-3" /> : <BarChart3 className="w-3 h-3" />}
                    {perf.charAt(0).toUpperCase() + perf.slice(1)} Performer
                  </span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 flex-shrink-0">
            <button onClick={() => onMessage(listItem)} title="Send Message"
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-purple-300 transition-colors">
              <Mail className="w-4 h-4" />
            </button>
            {allowEnrollAction && (
              <button onClick={() => onEnroll(listItem)} title="Enroll in course"
                className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-emerald-300 transition-colors">
                <BookPlus className="w-4 h-4" />
              </button>
            )}
            <button onClick={() => onToggleStatus(listItem)} title={listItem.is_active ? 'Deactivate' : 'Activate'}
              className={`p-2 hover:bg-white/10 rounded-lg transition-colors ${listItem.is_active ? 'text-gray-400 hover:text-orange-300' : 'text-gray-400 hover:text-emerald-300'}`}>
              {listItem.is_active ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
            </button>
            <button
              onClick={() => { onClose(); router.push(`/admin/students/${studentId}`); }}
              title="View full profile"
              className="hidden sm:flex items-center gap-1 px-3 py-1.5 bg-white/8 hover:bg-white/15 rounded-lg text-xs font-medium text-gray-200 transition-colors ml-1">
              <ExternalLink className="w-3.5 h-3.5" /> Full Profile
            </button>
            <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 ml-0.5">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-white/10 px-5 overflow-x-auto">
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id as typeof tab)}
              className={`flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors flex-shrink-0 ${tab === t.id ? 'border-white text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}>
              {t.icon} {t.label}
              {t.count !== undefined && t.count > 0 && (
                <span className="bg-white/15 text-gray-300 text-xs px-1.5 py-0.5 rounded-full ml-0.5">{t.count}</span>
              )}
            </button>
          ))}
        </div>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <RefreshCw className="w-6 h-6 animate-spin text-gray-400" />
              <p className="text-gray-500 text-sm">Loading student data…</p>
            </div>
          ) : !detail ? (
            <div className="text-center py-20 text-gray-500">
              <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p>Failed to load student details</p>
            </div>
          ) : (
            <>
              {/* ═══ OVERVIEW ═══ */}
              {tab === 'overview' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Enrollments', value: detail.enrollments.length, icon: <BookOpen className="w-4 h-4" />, color: 'text-blue-400' },
                      { label: 'Avg Progress', value: `${listItem.progress_summary.avg_progress}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400' },
                      { label: 'Quizzes', value: detail.quiz_performance.length, icon: <BarChart3 className="w-4 h-4" />, color: 'text-amber-400' },
                      { label: 'Points', value: detail.achievements.total_points.toLocaleString(), icon: <Award className="w-4 h-4" />, color: 'text-purple-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-[#162844] rounded-xl p-4 border border-white/8">
                        <span className={s.color}>{s.icon}</span>
                        <p className="text-xl font-bold text-white mt-1">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-[#162844] rounded-xl p-4 border border-white/8 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><User className="w-4 h-4" /> Contact Info</h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2 text-gray-300">
                          <Mail className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          <a href={`mailto:${listItem.email}`} className="hover:text-white truncate">{listItem.email}</a>
                        </div>
                        {listItem.phone_number && (
                          <div className="flex items-center gap-2 text-gray-300">
                            <Phone className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                            <a href={`tel:${listItem.phone_number}`} className="hover:text-white">{listItem.phone_number}</a>
                          </div>
                        )}
                        {listItem.whatsapp_number && (
                          <div className="flex items-center gap-2 text-gray-300">
                            <span className="text-[10px] font-bold bg-emerald-900/40 text-emerald-400 px-1.5 py-0.5 rounded flex-shrink-0">WA</span>
                            <a href={`https://wa.me/${listItem.whatsapp_number.replace(/\D/g,'')}`} target="_blank" rel="noopener noreferrer" className="hover:text-white">{listItem.whatsapp_number}</a>
                          </div>
                        )}
                        <div className="flex items-center gap-2 text-gray-400">
                          <Users className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                          <span>@{listItem.username}</span>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#162844] rounded-xl p-4 border border-white/8 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Clock className="w-4 h-4" /> Account Info</h4>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Joined', value: fmtDate(detail.account_info.created_at) || '—' },
                          { label: 'Last Login', value: fmtDate(detail.account_info.last_login) || 'Never' },
                          { label: 'Last Activity', value: detail.account_info.days_inactive === null ? 'Never' : detail.account_info.days_inactive === 0 ? 'Today' : `${detail.account_info.days_inactive}d ago` },
                          { label: 'Login Count', value: String(detail.analytics?.login_count ?? '—') },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-300 font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#162844] rounded-xl p-4 border border-white/8 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><Award className="w-4 h-4" /> Gamification</h4>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Current Streak', value: `${detail.achievements.current_streak} days` },
                          { label: 'Longest Streak', value: `${detail.achievements.longest_streak} days` },
                          { label: 'Total Achievements', value: String(detail.achievements.total_achievements) },
                          { label: 'Certificates', value: String(detail.certificates.length) },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-300 font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#162844] rounded-xl p-4 border border-white/8 space-y-3">
                      <h4 className="text-sm font-semibold text-gray-200 flex items-center gap-2"><BookOpen className="w-4 h-4" /> Study Materials</h4>
                      <div className="space-y-2 text-sm">
                        {[
                          { label: 'Notes Created', value: String(detail.study_materials.notes_count) },
                          { label: 'Bookmarks', value: String(detail.study_materials.bookmarks_count) },
                          { label: 'Total Points', value: detail.achievements.total_points.toLocaleString() },
                        ].map(row => (
                          <div key={row.label} className="flex items-center justify-between">
                            <span className="text-gray-500">{row.label}</span>
                            <span className="text-gray-300 font-medium">{row.value}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* ═══ ENROLLMENTS ═══ */}
              {tab === 'enrollments' && (
                <div className="space-y-3">
                  {detail.enrollments.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <BookOpen className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No enrollments found</p>
                    </div>
                  ) : detail.enrollments.map(enr => {
                    const isExpanded = expandedEnrollment === enr.id;
                    const progColor = enr.progress >= 75 ? 'bg-emerald-500' : enr.progress >= 40 ? 'bg-amber-400' : 'bg-red-400';
                    const statusCls: Record<string, string> = {
                      active: 'bg-emerald-900/40 text-emerald-300',
                      completed: 'bg-blue-900/40 text-blue-300',
                      terminated: 'bg-red-900/40 text-red-300',
                    };
                    return (
                      <div key={enr.id} className="bg-[#162844] rounded-xl border border-white/8 overflow-hidden">
                        <button className="w-full text-left p-4" onClick={() => setExpandedEnrollment(isExpanded ? null : enr.id)}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-white text-sm truncate">{enr.course_title}</p>
                              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${statusCls[enr.status] || 'bg-white/10 text-gray-400'}`}>{enr.status}</span>
                                {enr.cohort_label && (
                                  <span className="text-xs text-gray-400 flex items-center gap-1"><Layers className="w-3 h-3" />{enr.cohort_label}</span>
                                )}
                                <span className="text-xs text-gray-500">{fmtDate(enr.enrollment_date)}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-sm font-bold text-white">{enr.progress}%</p>
                                <p className="text-xs text-gray-400">{enr.lessons_completed}/{enr.total_lessons} lessons</p>
                              </div>
                              <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                            </div>
                          </div>
                          <div className="mt-3 h-1.5 bg-white/8 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${progColor}`} style={{ width: `${Math.min(enr.progress, 100)}%` }} />
                          </div>
                        </button>
                        {isExpanded && enr.module_progress.length > 0 && (
                          <div className="border-t border-white/8 px-4 pb-4">
                            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mt-3 mb-2">Module Progress</p>
                            <div className="space-y-2">
                              {enr.module_progress.map(m => (
                                <div key={m.module_id} className="flex items-center justify-between text-sm">
                                  <span className="text-gray-300 truncate flex-1 mr-2">{m.module_title}</span>
                                  <div className="flex items-center gap-2 flex-shrink-0">
                                    {m.module_score !== null && (
                                      <span className="text-xs text-gray-400">{m.module_score}%</span>
                                    )}
                                    <span className={`px-1.5 py-0.5 rounded text-xs ${m.is_completed ? 'bg-emerald-900/40 text-emerald-300' : 'bg-white/8 text-gray-400'}`}>
                                      {m.is_completed ? '✓ Done' : 'In Progress'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ═══ QUIZ ═══ */}
              {tab === 'quiz' && (
                <div className="space-y-2">
                  {detail.quiz_performance.length === 0 ? (
                    <div className="text-center py-16 text-gray-500">
                      <BarChart3 className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No quiz attempts found</p>
                    </div>
                  ) : detail.quiz_performance.map(q => {
                    const pct = q.max_score ? Math.round((q.score / q.max_score) * 100) : null;
                    const scoreCls = pct === null ? 'text-gray-400' : pct >= 75 ? 'text-emerald-400' : pct >= 50 ? 'text-amber-400' : 'text-red-400';
                    return (
                      <div key={q.id} className="bg-[#162844] rounded-xl p-4 border border-white/8 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm truncate">{q.quiz_title}</p>
                          <p className="text-xs text-gray-400 mt-0.5">{fmtDate(q.submitted_at || q.created_at)}</p>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <p className={`text-lg font-bold ${scoreCls}`}>{q.score}{q.max_score ? `/${q.max_score}` : ''}</p>
                          {pct !== null && <p className="text-xs text-gray-400">{pct}%</p>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ═══ ACHIEVEMENTS ═══ */}
              {tab === 'achievements' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Total Points', value: detail.achievements.total_points.toLocaleString(), icon: <Award className="w-4 h-4" />, color: 'text-yellow-400' },
                      { label: 'Achievements', value: String(detail.achievements.total_achievements), icon: <BadgeCheck className="w-4 h-4" />, color: 'text-purple-400' },
                      { label: 'Current Streak', value: `${detail.achievements.current_streak}d`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-emerald-400' },
                      { label: 'Longest Streak', value: `${detail.achievements.longest_streak}d`, icon: <Clock className="w-4 h-4" />, color: 'text-blue-400' },
                    ].map(s => (
                      <div key={s.label} className="bg-[#162844] rounded-xl p-4 border border-white/8 text-center">
                        <span className={`inline-block mb-1 ${s.color}`}>{s.icon}</span>
                        <p className="text-xl font-bold text-white">{s.value}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
                      </div>
                    ))}
                  </div>
                  {detail.certificates.length > 0 ? (
                    <div>
                      <h4 className="text-sm font-semibold text-gray-200 mb-3 flex items-center gap-2">
                        <Award className="w-4 h-4 text-yellow-400" /> Certificates ({detail.certificates.length})
                      </h4>
                      <div className="space-y-2">
                        {detail.certificates.map(cert => (
                          <div key={cert.id} className="bg-[#162844] rounded-xl p-4 border border-white/8 flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-white text-sm truncate">{cert.course_title}</p>
                              <p className="text-xs text-gray-400 mt-0.5">Issued {fmtDate(cert.issued_at || cert.created_at)}</p>
                            </div>
                            {cert.certificate_url && (
                              <a href={cert.certificate_url} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2.5 py-1.5 bg-yellow-900/30 border border-yellow-700/40 rounded-lg text-xs text-yellow-300 hover:bg-yellow-900/50 transition-colors flex-shrink-0">
                                <ExternalLink className="w-3 h-3" /> View
                              </a>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-10 text-gray-500">
                      <Award className="w-10 h-10 mx-auto mb-2 opacity-40" />
                      <p>No certificates yet</p>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Row Action Menu ───────────────────────────────────────────────────────────
function RowActionMenu({ student, allowEnrollAction, onView, onToggleStatus, onEnroll, onResetProgress, onMessage, onDeleteConfirm }: {
  student: StudentListItem; onView: () => void; onToggleStatus: () => void;
  allowEnrollAction: boolean;
  onEnroll: () => void; onResetProgress: () => void; onMessage: () => void; onDeleteConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  const btn = (icon: React.ReactNode, label: string, onClick: () => void, color = 'text-gray-200') => (
    <button onClick={() => { onClick(); setOpen(false); }}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm ${color} hover:bg-white/5 rounded-md`}>
      {icon} {label}
    </button>
  );
  return (
    <div className="relative" ref={ref}>
      <div className="flex items-center gap-1">
        <button onClick={onView} className="p-1.5 text-gray-500 hover:text-[#0d1b2a] hover:bg-[#0d1b2a]/5 rounded-lg" title="View"><Eye className="w-4 h-4" /></button>
        <button onClick={onMessage} className="p-1.5 text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg" title="Message"><Mail className="w-4 h-4" /></button>
        <button onClick={() => setOpen(!open)} className="p-1.5 text-gray-500 hover:text-gray-600 hover:bg-white/10 rounded-lg"><MoreVertical className="w-4 h-4" /></button>
      </div>
      {open && (
        <div className="absolute right-0 top-9 bg-[#162844] border border-white/20 rounded-xl shadow-lg z-20 min-w-[180px] py-1.5 px-1">
          {btn(<Eye className="w-4 h-4 text-[#0d1b2a]" />, 'View Profile', onView)}
          {allowEnrollAction && btn(<BookPlus className="w-4 h-4 text-green-500" />, 'Enroll in Course', onEnroll)}
          {btn(student.is_active ? <UserX className="w-4 h-4 text-orange-500" /> : <UserCheck className="w-4 h-4 text-green-500" />,
            student.is_active ? 'Deactivate' : 'Activate', onToggleStatus,
            student.is_active ? 'text-orange-700' : 'text-green-700')}
          <div className="border-t border-white/8 my-1" />
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
    closed: { cls: 'bg-white/10 text-gray-600', icon: <Lock className="w-3 h-3" />, label: 'Closed' },
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
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${map[type] || 'bg-white/10 text-gray-600'}`}>
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
  const [coursesError, setCoursesError] = useState<string | null>(null);
  const [courseSearch, setCourseSearch] = useState('');

  // ── Cohorts view state ─────────────────────────────────────────────
  const [selectedCourse, setSelectedCourse] = useState<CourseStats | null>(null);
  const [cohorts, setCohorts] = useState<CohortStats[]>([]);
  const [cohortsLoading, setCohortsLoading] = useState(false);
  const [cohortsError, setCohortsError] = useState<string | null>(null);

  // ── Students view state ────────────────────────────────────────────
  const [selectedCohort, setSelectedCohort] = useState<CohortStats | null>(null);
  const [students, setStudents] = useState<StudentListItem[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentsError, setStudentsError] = useState<string | null>(null);
  const [stats, setStats] = useState<StudentStats | null>(null);
  const [availableCourses, setAvailableCourses] = useState<AvailableCourse[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<number[]>([]);
  const [isExporting, setIsExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [cohortMigrationLoading, setCohortMigrationLoading] = useState(false);

  // Modals
  const [enrollModal, setEnrollModal] = useState<{ open: boolean; student: StudentListItem | null }>({ open: false, student: null });
  const [messageModal, setMessageModal] = useState<{ open: boolean; recipients: Array<{ id: number; name: string }> }>({ open: false, recipients: [] });
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean; title: string; description: string; confirmLabel?: string; danger?: boolean; onConfirm: () => void;
  }>({ open: false, title: '', description: '', onConfirm: () => {} });

  const [viewModal, setViewModal] = useState<{ studentId: number | null; student: StudentListItem | null }>({
    studentId: null, student: null,
  });

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
    setCoursesError(null);
    AdminStudentService.getCourses()
      .then(r => setCourses(r.courses))
      .catch(err => {
        const message = err.message || 'Failed to load courses';
        setCoursesError(message);
        toast.error(message);
      })
      .finally(() => setCoursesLoading(false));
    AdminStudentService.getStats().then(setStats).catch(console.error);
    AdminStudentService.getAvailableCourses().then(r => setAvailableCourses(r.courses)).catch(console.error);
  }, []);

  // ── Load cohorts when course selected ────────────────────────────
  const loadCohorts = useCallback(async (course: CourseStats) => {
    setCohortsLoading(true);
    setCohortsError(null);
    try {
      const res = await AdminStudentService.getCohortsForCourse(course.id);
      setCohorts(res.cohorts);
    } catch (err: any) {
      const message = err.message || 'Failed to load cohorts';
      setCohortsError(message);
      toast.error(message);
    } finally {
      setCohortsLoading(false);
    }
  }, []);

  // ── Load students when cohort selected ───────────────────────────
  const fetchStudents = useCallback(async () => {
    if (!selectedCourse || !selectedCohort) return;
    setStudentsLoading(true);
    setStudentsError(null);
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
      const message = err.message || 'Failed to load students';
      setStudentsError(message);
      toast.error(message);
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
    setSelectedCohort(null);
    setCohorts([]);
    setStudents([]);
    setSelectedStudents([]);
    setCohortsError(null);
    setStudentsError(null);
    setView('cohorts');
    loadCohorts(course);
  };

  const goToStudents = (cohort: CohortStats) => {
    setSelectedCohort(cohort);
    setStudents([]);
    setSelectedStudents([]);
    setStudentsError(null);
    setPagination(p => ({ ...p, current_page: 1 }));
    setView('students');
  };

  const goBackToCourses = () => {
    setView('courses');
    setSelectedCourse(null);
    setSelectedCohort(null);
    setStudents([]);
    setSelectedStudents([]);
  };

  const goBackToCohorts = () => {
    setView('cohorts');
    setSelectedCohort(null);
    setStudents([]);
    setSelectedStudents([]);
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

  // Compute previous migration target: find latest open/upcoming cohort before selected
  const previousMigrationTarget = selectedCohort && selectedCohort.status === 'closed'
    ? cohorts
        .filter(c => {
          const cStart = new Date(c.cohort_start || 0).getTime();
          const selectedStart = new Date(selectedCohort.cohort_start || 0).getTime();
          return cStart < selectedStart && (c.status === 'open' || c.status === 'upcoming');
        })
        .sort((a, b) => new Date(b.cohort_start || 0).getTime() - new Date(a.cohort_start || 0).getTime())
        [0] || null
    : null;

  const handleCohortEndMigration = async (direction: 'next' | 'previous') => {
    if (!selectedCohort || selectedCohort.status !== 'closed') {
      toast.error('Select a closed cohort to migrate incomplete students');
      return;
    }

    if (direction === 'previous' && !previousMigrationTarget) {
      toast.error('No previous open or upcoming cohort is available for migration');
      return;
    }

    const cohortLabel = selectedCohort.cohort_label || `Window #${selectedCohort.id}`;
    const targetLabel = direction === 'previous'
      ? (previousMigrationTarget?.cohort_label || 'previous available cohort')
      : 'next available cohort';
    if (!confirm(`Bulk migrate incomplete students from ${cohortLabel} to the ${targetLabel} and send emails?`)) {
      return;
    }

    try {
      setCohortMigrationLoading(true);
      const res = await waitlistService.triggerCohortEndMigration(selectedCohort.id, direction);
      toast.success(
        `Migrated ${res.data.migrated} student(s) from ${cohortLabel} to ${res.data.target_cohort_label || targetLabel}. ` +
        `Skipped completed: ${res.data.skipped_completed}. ` +
        `Emails sent: ${res.data.emails_sent ?? 0}.`
      );
      await fetchStudents();
    } catch (e: any) {
      toast.error(e?.response?.data?.error || e.message || 'Cohort migration failed');
    } finally {
      setCohortMigrationLoading(false);
    }
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
  const allowEnrollAction = selectedCohort?.status !== 'closed';
  const cohortStudents = students;
  const migratedInStudents = cohortStudents.filter(student => student.cohort_enrollment?.migrated_from_window_id != null);
  const cohortOriginalStudents = cohortStudents.filter(student => student.cohort_enrollment?.migrated_from_window_id == null);
  const hasClosedCohortGrouping = selectedCohort?.status === 'closed';

  const renderStudentRow = (student: StudentListItem) => {
    const perf = student.performance_level;
    const perfCls = { high: 'bg-emerald-100 text-emerald-700', medium: 'bg-amber-100 text-amber-700', low: 'bg-red-100 text-red-700' }[perf] || '';
    const progressValue = student.progress_summary.avg_progress;
    const progColor = progressValue >= 75 ? 'bg-emerald-500' : progressValue >= 40 ? 'bg-amber-400' : 'bg-red-400';
    const daysCls = student.activity.days_inactive === null ? 'text-gray-500' : student.activity.days_inactive === 0 ? 'text-emerald-600' : student.activity.days_inactive <= 7 ? 'text-green-600' : student.activity.days_inactive <= 14 ? 'text-orange-500' : 'text-red-500';

    return (
      <tr key={student.id}
        className={`hover:bg-white/5 transition-colors ${selectedStudents.includes(student.id) ? 'bg-white/8' : ''}`}>
        <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
          <input type="checkbox" checked={selectedStudents.includes(student.id)}
            onChange={() => setSelectedStudents(prev => prev.includes(student.id) ? prev.filter(id => id !== student.id) : [...prev, student.id])}
            className="rounded border-white/15 text-[#0d1b2a] focus:ring-[#0d1b2a]" />
        </td>
        <td className="px-4 py-3 cursor-pointer" onClick={() => setViewModal({ studentId: student.id, student })}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#162844] to-[#0d1b2a] flex items-center justify-center text-white font-semibold text-sm flex-shrink-0 shadow-sm">
              {(student.first_name?.[0] || student.username[0]).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white truncate">{getStudentName(student)}</p>
              <p className="text-xs text-gray-500 truncate">{student.email}</p>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {student.cohort_enrollment?.cohort_label && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-white/10 text-gray-200">
                    <Layers className="w-3 h-3" />
                    {student.cohort_enrollment.cohort_label}
                  </span>
                )}
                {student.cohort_enrollment?.migrated_from_window_id != null && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-900/40 text-blue-300">
                    <ArrowRightLeft className="w-3 h-3" />
                    Migrated in
                  </span>
                )}
              </div>
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
          <div className="flex flex-col gap-1">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${student.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
              {student.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
              {student.is_active ? 'Active' : 'Inactive'}
            </span>
            {student.cohort_enrollment?.migration_state === 'migrated_in' && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-blue-900/40 text-blue-300">
                <ArrowRightLeft className="w-3 h-3" />
                Migrated
              </span>
            )}
          </div>
        </td>
        <td className="px-4 py-3 text-center">
          <div className="flex flex-col items-center gap-1">
            <span className="text-sm font-semibold text-gray-100">{progressValue}%</span>
            <div className="w-20 h-1.5 bg-gray-200 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${progColor}`}
                style={{ width: `${Math.min(progressValue, 100)}%` }} />
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
            allowEnrollAction={allowEnrollAction}
            onView={() => setViewModal({ studentId: student.id, student })}
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
  };

  // ─────────────────────────────────────────────────────────────────
  // BREADCRUMB
  // ─────────────────────────────────────────────────────────────────
  const Breadcrumb = () => (
    <nav className="flex items-center gap-1.5 text-sm mb-1">
      <button onClick={goBackToCourses}
        className={`font-medium ${view === 'courses' ? 'text-white' : 'text-[#0d1b2a] hover:underline'}`}>
        Students
      </button>
      {selectedCourse && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          <button onClick={() => view !== 'cohorts' && goBackToCohorts()}
            className={`font-medium ${view === 'cohorts' ? 'text-white' : 'text-[#0d1b2a] hover:underline'} truncate max-w-[200px]`}>
            {selectedCourse.title}
          </button>
        </>
      )}
      {selectedCohort && (
        <>
          <ChevronRight className="w-3.5 h-3.5 text-gray-500" />
          <span className="font-medium text-white truncate max-w-[200px]">{selectedCohort.cohort_label}</span>
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
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
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
            <div key={s.label} className="bg-[#162844] rounded-xl p-4 border border-white/10 shadow-sm">
              <div className={`inline-flex p-1.5 rounded-lg ${s.bg} mb-2`}><span className={s.color}>{s.icon}</span></div>
              <p className="text-2xl font-bold text-white">{s.value.toLocaleString()}</p>
              <p className="text-xs text-gray-500 font-medium mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
        <input type="text" placeholder="Search courses…" value={courseSearch}
          onChange={e => setCourseSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2 border border-white/15 rounded-lg text-sm focus:ring-2 focus:ring-white/30 bg-[#162844] text-white placeholder:text-gray-500" />
      </div>

      {/* Course cards */}
      {coursesLoading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 animate-spin text-[#0d1b2a]" />
        </div>
      ) : coursesError ? (
        <div className="text-center py-16 bg-[#0d1b2a]/80 rounded-xl border border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-200 font-medium">Could not load courses</p>
          <p className="text-gray-400 text-sm mt-1">{coursesError}</p>
          <button onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 rounded-lg bg-[#162844] text-white text-sm font-medium hover:bg-[#0d2040]">
            Retry
          </button>
        </div>
      ) : filteredCourses.length === 0 ? (
        <div className="text-center py-16 bg-[#0d1b2a]/80 rounded-xl border border-white/10">
          <BookOpen className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No courses found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredCourses.map(course => (
            <button key={course.id} onClick={() => goToCohorts(course)}
              className="bg-[#0d1b2a]/80 rounded-xl border border-white/10 shadow-sm hover:shadow-md hover:border-white/25 transition-all text-left group p-5">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1 min-w-0 mr-2">
                  <h3 className="font-semibold text-white group-hover:text-[#0d1b2a] transition-colors line-clamp-2">{course.title}</h3>
                  <p className="text-xs text-gray-500 mt-1 truncate">{course.instructor_name}</p>
                </div>
                <EnrollTypeBadge type={course.enrollment_type} />
              </div>
              <div className="grid grid-cols-3 gap-2 mb-4">
                <div className="text-center">
                  <p className="text-lg font-bold text-white">{course.total_students}</p>
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
              <div className="flex items-center justify-between pt-3 border-t border-white/8">
                <span className={`inline-flex items-center gap-1 text-xs font-medium ${course.is_published ? 'text-emerald-600' : 'text-gray-500'}`}>
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Layers className="w-7 h-7 text-[#0d1b2a]" />{selectedCourse?.title}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">Select a cohort to manage its students</p>
        </div>
        <button onClick={goBackToCourses}
          className="bg-[#162844] border border-white/15 hover:bg-[#0d2040] text-gray-200 px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
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
      ) : cohortsError ? (
        <div className="text-center py-16 bg-[#0d1b2a]/80 rounded-xl border border-red-500/20">
          <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
          <p className="text-red-200 font-medium">Could not load cohorts</p>
          <p className="text-gray-400 text-sm mt-1">{cohortsError}</p>
          <button onClick={() => selectedCourse && loadCohorts(selectedCourse)}
            className="mt-4 px-4 py-2 rounded-lg bg-[#162844] text-white text-sm font-medium hover:bg-[#0d2040]">
            Retry
          </button>
        </div>
      ) : cohorts.length === 0 ? (
        <div className="text-center py-16 bg-[#0d1b2a]/80 rounded-xl border border-white/10">
          <Layers className="w-12 h-12 text-gray-600 mx-auto mb-3" />
          <p className="text-gray-600 font-medium">No cohorts found for this course</p>
          <p className="text-gray-500 text-sm mt-1">Students enrolled directly will appear in &quot;No Cohort&quot;</p>
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
                className="bg-[#0d1b2a]/80 rounded-xl border border-white/10 shadow-sm hover:shadow-md hover:border-white/25 transition-all text-left group p-5">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1 min-w-0 mr-2">
                    <h3 className="font-semibold text-white group-hover:text-[#0d1b2a] transition-colors">
                      {cohort.cohort_label}
                    </h3>
                    {cohort.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{cohort.description}</p>
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
                    <p className="text-base font-bold text-white">{cohort.total_students}</p>
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

                <div className="flex items-center justify-between pt-3 border-t border-white/8">
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Users className="w-7 h-7 text-[#0d1b2a]" />
            {selectedCohort?.cohort_label}
          </h1>
          {selectedCourse && (
            <p className="text-gray-500 mt-0.5 text-sm">{selectedCourse.title}</p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={goBackToCohorts}
            className="bg-[#162844] border border-white/15 hover:bg-[#0d2040] text-gray-200 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
            <ArrowLeft className="w-4 h-4" /> Cohorts
          </button>
          <button onClick={handleExport} disabled={isExporting}
            className="bg-[#162844] border border-white/15 hover:bg-[#0d2040] text-gray-200 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm disabled:opacity-50">
            {isExporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {selectedStudents.length > 0 ? `Export (${selectedStudents.length})` : 'Export CSV'}
          </button>
          <button onClick={() => fetchStudents()}
            className="bg-[#162844] border border-white/15 hover:bg-[#0d2040] text-gray-200 px-3.5 py-2 rounded-lg text-sm font-medium flex items-center gap-2 shadow-sm">
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
      <div className="bg-[#0d1b2a]/80 rounded-xl border border-white/10 shadow-sm">
        <button onClick={() => setShowFilters(!showFilters)}
          className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-200 hover:bg-white/5 rounded-xl">
          <span className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" /> Filters
            {activeFilterCount > 0 && (
              <span className="bg-[#0d1b2a] text-white text-xs px-2 py-0.5 rounded-full">{activeFilterCount}</span>
            )}
          </span>
          <ChevronDown className={`w-4 h-4 text-gray-500 transition-transform ${showFilters ? 'rotate-180' : ''}`} />
        </button>
        {showFilters && (
          <div className="px-5 pb-4 border-t border-white/8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 pt-4">
              <div className="relative lg:col-span-2">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 pointer-events-none" />
                <input type="text" placeholder="Search students…" value={filters.search}
                  onChange={e => handleFilterChange('search', e.target.value)}
                  className="w-full pl-9 pr-4 py-2 border border-white/15 rounded-lg text-sm focus:ring-2 focus:ring-[#0d1b2a]" />
              </div>
              {[
                { key: 'status', options: [['', 'All Statuses'], ['active', 'Active'], ['inactive', 'Inactive']] },
                { key: 'enrollment_status', options: [['', 'All Enrollment'], ['active', 'Active'], ['completed', 'Completed'], ['terminated', 'Terminated']] },
                { key: 'performance', options: [['', 'All Performance'], ['high', 'High'], ['medium', 'Medium'], ['low', 'Low']] },
              ].map(f => (
                <select key={f.key} value={(filters as any)[f.key]}
                  onChange={e => handleFilterChange(f.key, e.target.value)}
                  className="border border-white/15 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-white/30 bg-[#162844] text-white placeholder:text-gray-500">
                  {f.options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3 pt-3 border-t border-white/8">
              <select value={filters.sort_by} onChange={e => handleFilterChange('sort_by', e.target.value)}
                className="border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-[#162844] text-white focus:ring-2 focus:ring-white/30">
                <option value="created_at">Registered</option>
                <option value="username">Username</option>
                <option value="last_activity">Last Activity</option>
              </select>
              <button onClick={() => handleFilterChange('sort_order', filters.sort_order === 'desc' ? 'asc' : 'desc')}
                className="border border-white/10 rounded-lg px-2.5 py-1.5 text-xs hover:bg-[#0a1628]">
                {filters.sort_order === 'desc' ? '↓ Newest First' : '↑ Oldest First'}
              </button>
              <select value={pagination.per_page.toString()}
                onChange={e => setPagination(p => ({ ...p, per_page: parseInt(e.target.value), current_page: 1 }))}
                className="border border-white/10 rounded-lg px-2.5 py-1.5 text-xs bg-[#162844] text-white">
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
              className="text-sm text-gray-500 hover:text-gray-200 border border-white/10 px-3 py-1.5 rounded-lg">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Student results */}
      <div className="space-y-3">
        {hasClosedCohortGrouping && selectedCohort && (
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="bg-[#162844] rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400 mb-2">
                <Lock className="w-3.5 h-3.5" /> Closed cohort
              </div>
              <p className="text-lg font-bold text-white">{selectedCohort.cohort_label}</p>
              <p className="text-xs text-gray-400 mt-1">This cohort is closed. Student records below are grouped by migration state.</p>
            </div>
            <div className="bg-[#162844] rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400 mb-2">
                <ArrowRightLeft className="w-3.5 h-3.5" /> Migrated in
              </div>
              <p className="text-lg font-bold text-white">{migratedInStudents.length}</p>
              <p className="text-xs text-gray-400 mt-1">Students moved here from a previous cohort.</p>
            </div>
            <div className="bg-[#162844] rounded-xl p-4 border border-white/10">
              <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-gray-400 mb-2">
                <Users2 className="w-3.5 h-3.5" /> Original cohort members
              </div>
              <p className="text-lg font-bold text-white">{cohortOriginalStudents.length}</p>
              <p className="text-xs text-gray-400 mt-1">Students that remain tied to the closed cohort record.</p>
            </div>
          </div>
        )}

        {hasClosedCohortGrouping && selectedCohort && (
          <div className="bg-[#162844] rounded-xl p-4 border border-blue-500/20 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-wide text-blue-300 font-semibold">Bulk migrate incomplete students</p>
              <p className="text-sm text-gray-400 mt-1">
                Move students who have not completed this closed cohort to the next or previous available cohort and send migration emails.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => handleCohortEndMigration('next')}
                disabled={cohortMigrationLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {cohortMigrationLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                Migrate to Next Cohort
              </button>
              <button
                onClick={() => handleCohortEndMigration('previous')}
                disabled={cohortMigrationLoading}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-blue-300/40 bg-transparent px-4 py-2 text-sm font-medium text-blue-200 hover:bg-blue-500/10 disabled:opacity-50"
              >
                {cohortMigrationLoading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <ArrowRightLeft className="w-4 h-4" />
                )}
                Migrate to Previous Cohort
              </button>
            </div>
          </div>
        )}

        <div className="bg-[#0d1b2a]/80 rounded-xl border border-white/10 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-[#0a1628] border-b border-white/10">
                <tr>
                  <th className="px-4 py-3 w-10">
                    <input type="checkbox"
                      checked={selectedStudents.length === cohortStudents.length && cohortStudents.length > 0}
                      onChange={e => setSelectedStudents(e.target.checked ? cohortStudents.map(s => s.id) : [])}
                      className="rounded border-white/15 text-[#0d1b2a] focus:ring-[#0d1b2a]" />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Student</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Progress</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Performance</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">Activity</th>
                  <th className="px-4 py-3 text-center text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/8">
                {studentsError ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-3" />
                    <p className="text-red-200 font-medium">Could not load students</p>
                    <p className="text-gray-400 text-sm mt-1">{studentsError}</p>
                    <button onClick={() => fetchStudents()}
                      className="mt-4 px-4 py-2 rounded-lg bg-[#162844] text-white text-sm font-medium hover:bg-[#0d2040]">
                      Retry
                    </button>
                  </td></tr>
                ) : studentsLoading && cohortStudents.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <RefreshCw className="w-6 h-6 animate-spin text-[#0d1b2a] mx-auto mb-2" />
                    <p className="text-gray-500 text-sm">Loading students…</p>
                  </td></tr>
                ) : cohortStudents.length === 0 ? (
                  <tr><td colSpan={7} className="py-16 text-center">
                    <Users className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-600 font-medium">No students in this cohort</p>
                    {activeFilterCount > 0 && (
                      <button onClick={() => { setFilters({ search: '', status: '', enrollment_status: '', performance: '', sort_by: 'created_at', sort_order: 'desc' }); }}
                        className="mt-2 text-sm text-[#0d1b2a] hover:underline">Clear filters</button>
                    )}
                  </td></tr>
                ) : hasClosedCohortGrouping ? (
                  <>
                    <tr className="bg-[#0a1628]/90">
                      <td colSpan={7} className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">
                        Migrated into this closed cohort
                      </td>
                    </tr>
                    {migratedInStudents.length > 0 ? migratedInStudents.map(renderStudentRow) : (
                      <tr><td colSpan={7} className="py-10 text-center text-gray-500 text-sm">No migrated students found</td></tr>
                    )}
                    <tr className="bg-[#0a1628]/90">
                      <td colSpan={7} className="px-4 py-3 text-xs uppercase tracking-wide text-gray-400">
                        Original closed cohort members
                      </td>
                    </tr>
                    {cohortOriginalStudents.length > 0 ? cohortOriginalStudents.map(renderStudentRow) : (
                      <tr><td colSpan={7} className="py-10 text-center text-gray-500 text-sm">No original cohort members found</td></tr>
                    )}
                  </>
                ) : cohortStudents.map(renderStudentRow)}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.total_pages > 1 && (
            <div className="px-5 py-3.5 border-t border-white/10 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-500">
                Showing <span className="font-medium">{(pagination.current_page - 1) * pagination.per_page + 1}–{Math.min(pagination.current_page * pagination.per_page, pagination.total_items)}</span>
                {' '}of <span className="font-medium">{pagination.total_items.toLocaleString()}</span>
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPagination(p => ({ ...p, current_page: 1 }))} disabled={!pagination.has_prev}
                  className="px-2 py-1.5 text-xs rounded-lg hover:bg-white/10 disabled:opacity-40">«</button>
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page - 1 }))} disabled={!pagination.has_prev}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                {(() => {
                  const start = Math.max(1, Math.min(pagination.current_page - 2, pagination.total_pages - 4));
                  return Array.from({ length: Math.min(5, pagination.total_pages) }, (_, i) => {
                    const page = start + i;
                    if (page > pagination.total_pages) return null;
                    return (
                      <button key={page} onClick={() => setPagination(p => ({ ...p, current_page: page }))}
                        className={`w-8 h-8 rounded-lg text-sm font-medium ${page === pagination.current_page ? 'bg-[#0d1b2a] text-white' : 'hover:bg-white/10 text-gray-200'}`}>
                        {page}
                      </button>
                    );
                  });
                })()}
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.current_page + 1 }))} disabled={!pagination.has_next}
                  className="p-1.5 rounded-lg hover:bg-white/10 disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                <button onClick={() => setPagination(p => ({ ...p, current_page: p.total_pages }))} disabled={!pagination.has_next}
                  className="px-2 py-1.5 text-xs rounded-lg hover:bg-white/10 disabled:opacity-40">»</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-[#0a1628]">
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
      <ViewStudentModal
        studentId={viewModal.studentId}
        listItem={viewModal.student}
        allowEnrollAction={allowEnrollAction}
        onClose={() => setViewModal({ studentId: null, student: null })}
        onToggleStatus={(s) => { setViewModal({ studentId: null, student: null }); handleToggleStatus(s); }}
        onEnroll={(s) => { setViewModal({ studentId: null, student: null }); setEnrollModal({ open: true, student: s }); }}
        onMessage={(s) => { setViewModal({ studentId: null, student: null }); setMessageModal({ open: true, recipients: [{ id: s.id, name: getStudentName(s) }] }); }}
      />
      <ConfirmDialog
        open={confirmDialog.open} title={confirmDialog.title} description={confirmDialog.description}
        confirmLabel={confirmDialog.confirmLabel} danger={confirmDialog.danger}
        onConfirm={() => { confirmDialog.onConfirm(); setConfirmDialog(p => ({ ...p, open: false })); }}
        onCancel={() => setConfirmDialog(p => ({ ...p, open: false }))}
      />
    </div>
  );
}
