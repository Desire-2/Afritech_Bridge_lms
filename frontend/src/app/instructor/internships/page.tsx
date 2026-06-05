'use client';

import React, { useEffect, useState, useCallback } from 'react';
import internshipService, {
  type InternshipTask, type InternshipTaskAssignment,
  type InternshipCohort, type InternshipApplication,
} from '@/services/api/internship.service';
import {
  Users, Briefcase, ClipboardCheck, Clock, Plus, RefreshCw,
  ChevronDown, ChevronRight, X, Save, Send, CheckCircle, XCircle,
  AlertTriangle, FileText, Calendar, TrendingUp, Eye, Edit3,
  Trash2, Filter, Search, BarChart3, BookOpen, GraduationCap,
  Award, ArrowUpDown, Activity, Sparkles
} from 'lucide-react';

// ── Helpers ──────────────────────────────────────────────────────────

const PRIORITY_COLORS: Record<string, string> = {
  low: 'bg-slate-900/40 text-slate-300 border-slate-700/40',
  medium: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
  high: 'bg-amber-900/40 text-amber-300 border-amber-700/40',
  urgent: 'bg-red-900/40 text-red-300 border-red-700/40',
};

const TASK_STATUS_COLORS: Record<string, string> = {
  pending: 'bg-slate-900/40 text-slate-300',
  in_progress: 'bg-blue-900/40 text-blue-300',
  submitted: 'bg-purple-900/40 text-purple-300',
  approved: 'bg-green-900/40 text-green-300',
  rejected: 'bg-red-900/40 text-red-300',
};

const TASK_TYPES = [
  { value: 'document', label: 'Document' },
  { value: 'presentation', label: 'Presentation' },
  { value: 'code', label: 'Code' },
  { value: 'research', label: 'Research' },
  { value: 'assignment', label: 'Assignment' },
  { value: 'project', label: 'Project' },
  { value: 'report', label: 'Report' },
  { value: 'quiz', label: 'Quiz' },
  { value: 'other', label: 'Other' },
];

const PRIORITIES = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

// ── Stat Card ────────────────────────────────────────────────────────

const StatCard = ({ title, value, icon, color, bgColor, sub }: {
  title: string; value: number | string; icon: React.ReactNode;
  color: string; bgColor: string; sub?: string;
}) => (
  <div className="bg-[#162844] rounded-xl border border-white/10 p-5 hover:shadow-lg transition-all duration-200">
    <div className="flex items-center justify-between mb-3">
      <div className={`p-2.5 rounded-lg ${bgColor}`}>
        <span className={color}>{icon}</span>
      </div>
    </div>
    <h3 className="text-gray-400 text-xs font-medium uppercase tracking-wide">{title}</h3>
    <p className="text-2xl font-bold text-white mt-1">{typeof value === 'number' ? value.toLocaleString() : value}</p>
    {sub && <p className="text-gray-500 text-xs mt-1">{sub}</p>}
  </div>
);

// ═════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═════════════════════════════════════════════════════════════════════

const InstructorInternshipsPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'tasks' | 'interns'>('overview');

  // Stats
  const [stats, setStats] = useState<{
    total_interns: number; unassigned_interns: number;
    active_cohorts: number; total_cohorts: number;
    total_tasks: number; active_tasks: number;
    pending_review: number; overdue_tasks: number;
    task_types: Record<string, number>;
  } | null>(null);

  // Cohorts
  const [cohorts, setCohorts] = useState<(InternshipCohort & { intern_count: number; task_count: number })[]>([]);
  const [selectedCohortId, setSelectedCohortId] = useState<string>('');

  // Tasks
  const [tasks, setTasks] = useState<InternshipTask[]>([]);
  const [taskFilter, setTaskFilter] = useState('');

  // Interns
  const [interns, setInterns] = useState<(InternshipApplication & { task_stats: any })[]>([]);
  const [internSearch, setInternSearch] = useState('');

  // Task creation modal
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [taskForm, setTaskForm] = useState({
    title: '', description: '', task_type: 'assignment', priority: 'medium',
    due_date: '', max_score: 100, assign_to_all: false, cohort_id: '',
  });
  const [saving, setSaving] = useState(false);

  // Task detail / grade modal
  const [selectedTask, setSelectedTask] = useState<(InternshipTask & { assignments: InternshipTaskAssignment[] }) | null>(null);
  const [gradeData, setGradeData] = useState<{ assignment_id: string; status: string; score: number; feedback: string } | null>(null);
  const [showGradeModal, setShowGradeModal] = useState(false);
  const [grading, setGrading] = useState(false);

  // ── Data Fetching ──────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [statsData, cohortsResult] = await Promise.all([
        internshipService.getInstructorStats(),
        internshipService.getInstructorCohorts({ per_page: 100 }),
      ]);

      const statsObj = statsData as any;
      setStats(statsObj.data || statsObj);
      setCohorts(Array.isArray(cohortsResult.data) ? cohortsResult.data : []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchTasks = useCallback(async (cohortId?: string) => {
    try {
      const result = await internshipService.getInstructorTasks({
        cohort_id: cohortId || undefined,
        per_page: 100,
      });
      setTasks(Array.isArray(result.data) ? result.data : []);
    } catch (err) {
      console.error('Failed to fetch tasks:', err);
    }
  }, []);

  const fetchInterns = useCallback(async (cohortId: string) => {
    if (!cohortId) { setInterns([]); return; }
    try {
      const raw = await internshipService.getCohortInterns(cohortId);
      const list = (raw as any)?.data ?? raw;
      setInterns(Array.isArray(list) ? list : []);
    } catch (err) {
      console.error('Failed to fetch interns:', err);
      setInterns([]);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (activeTab === 'tasks') fetchTasks(selectedCohortId);
  }, [activeTab, selectedCohortId, fetchTasks]);

  useEffect(() => {
    if (activeTab === 'interns' && selectedCohortId) fetchInterns(selectedCohortId);
  }, [activeTab, selectedCohortId, fetchInterns]);

  // ── Task Creation ──────────────────────────────────────────────────

  const openCreateTask = (cohortId?: string) => {
    setTaskForm({
      title: '', description: '', task_type: 'assignment', priority: 'medium',
      due_date: '', max_score: 100, assign_to_all: true, cohort_id: cohortId || selectedCohortId || '',
    });
    setShowTaskModal(true);
  };

  const handleCreateTask = async () => {
    if (!taskForm.title || !taskForm.cohort_id) return;
    try {
      setSaving(true);
      await internshipService.createTask({
        cohort_id: taskForm.cohort_id,
        title: taskForm.title,
        description: taskForm.description || undefined,
        task_type: taskForm.task_type,
        priority: taskForm.priority,
        due_date: taskForm.due_date ? new Date(taskForm.due_date).toISOString() : undefined,
        max_score: taskForm.max_score,
        assign_to_all: taskForm.assign_to_all,
      });
      setShowTaskModal(false);
      fetchTasks(taskForm.cohort_id);
    } catch (err: any) {
      console.error('Failed to create task:', err);
    } finally {
      setSaving(false);
    }
  };

  // ── Grading ────────────────────────────────────────────────────────

  const openGradeModal = (assignment: InternshipTaskAssignment) => {
    setGradeData({
      assignment_id: assignment.id,
      status: assignment.status,
      score: assignment.score || 0,
      feedback: assignment.feedback || '',
    });
    setShowGradeModal(true);
  };

  const handleGrade = async () => {
    if (!gradeData) return;
    try {
      setGrading(true);
      await internshipService.gradeAssignment(gradeData.assignment_id, {
        status: gradeData.status,
        score: gradeData.status === 'approved' ? gradeData.score : undefined,
        feedback: gradeData.feedback || undefined,
      });
      setShowGradeModal(false);
      if (selectedTask) {
        const updated = await internshipService.getTaskDetail(selectedTask.id);
        setSelectedTask(updated);
      }
    } catch (err: any) {
      console.error('Failed to grade:', err);
    } finally {
      setGrading(false);
    }
  };

  // ── Filtering ──────────────────────────────────────────────────────

  const filteredInterns = interns.filter(i =>
    !internSearch || i.full_name.toLowerCase().includes(internSearch.toLowerCase()) ||
    i.email?.toLowerCase().includes(internSearch.toLowerCase())
  );

  const filteredTasks = tasks.filter(t =>
    !taskFilter || t.title.toLowerCase().includes(taskFilter.toLowerCase()) ||
    t.task_type?.toLowerCase().includes(taskFilter.toLowerCase())
  );

  // ── Loading ────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading internship dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-900/20 border border-red-200 rounded-xl p-6">
        <p className="text-red-300 mb-4">{error}</p>
        <button onClick={fetchData} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">
          Try Again
        </button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════════════
  // RENDER
  // ════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Internships</h1>
          <p className="text-gray-400 mt-1">Manage interns, assign tasks, and track progress</p>
        </div>
        <div className="mt-4 md:mt-0 flex items-center gap-3">
          <button
            onClick={fetchData}
            className="flex items-center gap-2 px-4 py-2 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition text-gray-300 text-sm"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
          <button
            onClick={() => openCreateTask()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
          >
            <Plus className="h-4 w-4" /> New Task
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Total Interns" value={stats.total_interns} icon={<Users className="h-5 w-5" />} color="text-blue-400" bgColor="bg-blue-900/40" sub={`${stats.unassigned_interns} unassigned`} />
          <StatCard title="Active Cohorts" value={stats.active_cohorts} icon={<GraduationCap className="h-5 w-5" />} color="text-green-400" bgColor="bg-green-900/40" sub={`${stats.total_cohorts} total`} />
          <StatCard title="Active Tasks" value={stats.active_tasks} icon={<ClipboardCheck className="h-5 w-5" />} color="text-purple-400" bgColor="bg-purple-900/40" sub={`${stats.pending_review} pending review`} />
          <StatCard title="Overdue" value={stats.overdue_tasks} icon={<Clock className="h-5 w-5" />} color="text-red-400" bgColor="bg-red-900/40" sub={stats.overdue_tasks > 0 ? 'Needs attention' : 'All on track'} />
        </div>
      )}

      {/* Cohort Selector */}
      {cohorts.length > 0 && (
        <div className="flex items-center gap-3 overflow-x-auto pb-2">
          <button
            onClick={() => setSelectedCohortId('')}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
              !selectedCohortId
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-[#162844] text-gray-300 border-white/10 hover:bg-white/5'
            }`}
          >
            All Cohorts
          </button>
          {cohorts.map(c => (
            <button
              key={c.id}
              onClick={() => setSelectedCohortId(c.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition border ${
                selectedCohortId === c.id
                  ? 'bg-blue-600 text-white border-blue-500'
                  : 'bg-[#162844] text-gray-300 border-white/10 hover:bg-white/5'
              }`}
            >
              {c.cohort_name} ({c.intern_count})
            </button>
          ))}
        </div>
      )}

      {/* Tab Navigation */}
      <div className="flex gap-1 bg-[#162844] rounded-xl p-1 border border-white/10 w-fit">
        {([
          { key: 'overview', label: 'Overview', icon: BarChart3 },
          { key: 'tasks', label: 'Tasks', icon: ClipboardCheck },
          { key: 'interns', label: 'Interns', icon: Users },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition ${
              activeTab === tab.key ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          OVERVIEW TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Quick Actions */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <button onClick={() => openCreateTask()} className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm">
              <Plus className="h-4 w-4" /> Create Task
            </button>
            <button onClick={() => setActiveTab('tasks')} className="flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm">
              <ClipboardCheck className="h-4 w-4" /> View Tasks
            </button>
            <button onClick={() => setActiveTab('interns')} className="flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm">
              <Users className="h-4 w-4" /> View Interns
            </button>
            <button onClick={() => setActiveTab('overview')} className="flex items-center justify-center gap-2 bg-amber-600 hover:bg-amber-700 text-white font-medium py-3 px-4 rounded-xl transition-all text-sm">
              <TrendingUp className="h-4 w-4" /> Dashboard
            </button>
          </div>

          {/* Active Cohorts overview */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Cohort Overview</h2>
            {cohorts.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10">
                      <th className="text-left py-3 px-3 font-semibold text-gray-400">Cohort</th>
                      <th className="text-left py-3 px-3 font-semibold text-gray-400">Track</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-400">Interns</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-400">Tasks</th>
                      <th className="text-center py-3 px-3 font-semibold text-gray-400">Status</th>
                      <th className="text-right py-3 px-3 font-semibold text-gray-400">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cohorts.slice(0, 10).map(c => (
                      <tr key={c.id} className="border-b border-white/5 hover:bg-white/5 transition">
                        <td className="py-3 px-3"><span className="text-white font-medium">{c.cohort_name}</span></td>
                        <td className="py-3 px-3 text-gray-400">{c.track_name || '—'}</td>
                        <td className="py-3 px-3 text-center"><span className="text-blue-400 font-semibold">{c.intern_count}</span></td>
                        <td className="py-3 px-3 text-center"><span className="text-purple-400 font-semibold">{c.task_count}</span></td>
                        <td className="py-3 px-3 text-center">
                          {c.is_full ? <span className="text-red-400 text-xs">Full</span> : c.is_accepting ? <span className="text-green-400 text-xs">Active</span> : <span className="text-gray-500 text-xs">Closed</span>}
                        </td>
                        <td className="py-3 px-3 text-right text-gray-400 text-xs">
                          {new Date(c.start_date).toLocaleDateString()} — {new Date(c.end_date).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12 text-gray-400">No cohorts found</div>
            )}
          </div>

          {/* Task type distribution */}
          {stats?.task_types && Object.keys(stats.task_types).length > 0 && (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Task Distribution by Type</h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(stats.task_types).map(([type, count]) => (
                  <div key={type} className="bg-[#0a1628] rounded-lg p-3 text-center">
                    <p className="text-2xl font-bold text-white">{count}</p>
                    <p className="text-gray-400 text-xs capitalize">{type.replace('_', ' ')}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Unassigned Interns Alert */}
          {stats && stats.unassigned_interns > 0 && (
            <div className="bg-amber-900/20 border border-amber-700/40 rounded-xl p-4">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-400" />
                <div>
                  <p className="text-amber-300 font-medium">{stats.unassigned_interns} intern(s) not assigned to any cohort</p>
                  <p className="text-amber-400/70 text-sm">Please assign accepted interns to cohorts for better tracking.</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TASKS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'tasks' && (
        <div className="space-y-4">
          {/* Task Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={taskFilter} onChange={e => setTaskFilter(e.target.value)}
              placeholder="Search tasks..." className="w-full max-w-md pl-10 pr-4 py-2.5 bg-[#162844] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          {filteredTasks.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredTasks.map(task => (
                <div
                  key={task.id}
                  className="bg-[#162844] rounded-xl border border-white/10 hover:border-blue-500/30 transition-all duration-200 overflow-hidden cursor-pointer"
                  onClick={() => {
                    internshipService.getTaskDetail(task.id).then(setSelectedTask);
                  }}
                >
                  <div className={`h-1.5 w-full ${task.priority === 'urgent' ? 'bg-red-500' : task.priority === 'high' ? 'bg-amber-500' : task.priority === 'medium' ? 'bg-blue-500' : 'bg-slate-500'}`} />
                  <div className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-white font-semibold text-sm truncate flex-1">{task.title}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ml-2 ${PRIORITY_COLORS[task.priority] || ''}`}>{task.priority}</span>
                    </div>
                    {task.description && <p className="text-gray-400 text-xs line-clamp-2 mb-3">{task.description}</p>}
                    <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                      <span className="capitalize">{task.task_type?.replace('_', ' ')}</span>
                      {task.due_date && <><span>•</span><span>Due: {new Date(task.due_date).toLocaleDateString()}</span></>}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-xs text-gray-500">
                        <Users className="h-3 w-3" />
                        <span>{task.submitted_count}/{task.total_interns} done</span>
                      </div>
                      <span className={`text-xs font-medium ${task.progress_pct >= 80 ? 'text-green-400' : task.progress_pct >= 50 ? 'text-amber-400' : 'text-gray-400'}`}>
                        {task.progress_pct}%
                      </span>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-1.5 mt-2">
                      <div className={`h-1.5 rounded-full transition-all ${task.progress_pct >= 80 ? 'bg-green-500' : task.progress_pct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${task.progress_pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
              <ClipboardCheck className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Tasks Yet</h3>
              <p className="text-gray-400 mb-6">Create your first task to start tracking intern progress</p>
              <button onClick={() => openCreateTask()} className="inline-flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium">
                <Plus className="h-4 w-4" /> Create Task
              </button>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          INTERNS TAB
      ═══════════════════════════════════════════════════════════════ */}
      {activeTab === 'interns' && (
        <div className="space-y-4">
          {/* Cohort selector for interns tab */}
          <select
            value={selectedCohortId}
            onChange={e => setSelectedCohortId(e.target.value)}
            className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
          >
            <option value="">Select a cohort to view interns...</option>
            {cohorts.map(c => (
              <option key={c.id} value={c.id}>{c.cohort_name} ({c.intern_count} interns)</option>
            ))}
          </select>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text" value={internSearch} onChange={e => setInternSearch(e.target.value)}
              placeholder="Search interns..." className="w-full max-w-md pl-10 pr-4 py-2.5 bg-[#162844] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
            />
          </div>

          {selectedCohortId && filteredInterns.length > 0 ? (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
              {filteredInterns.map(intern => {
                const ts = intern.task_stats || {};
                const pct = ts.progress_pct || 0;
                return (
                  <div key={intern.id} className="bg-[#162844] rounded-xl border border-white/10 p-5 hover:border-blue-500/30 transition-all">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
                          <span className="text-sm font-bold text-blue-400">{intern.full_name?.charAt(0) || '?'}</span>
                        </div>
                        <div>
                          <h3 className="text-white font-semibold text-sm">{intern.full_name}</h3>
                          <p className="text-gray-400 text-xs">{intern.email}</p>
                        </div>
                      </div>
                      <span className="text-xs text-gray-500 font-mono">{intern.reference_code}</span>
                    </div>

                    {/* Task stats */}
                    <div className="grid grid-cols-3 gap-2 mb-3">
                      <div className="bg-[#0a1628] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-blue-400">{ts.total_assigned || 0}</p>
                        <p className="text-[10px] text-gray-500">Assigned</p>
                      </div>
                      <div className="bg-[#0a1628] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-green-400">{ts.completed || 0}</p>
                        <p className="text-[10px] text-gray-500">Done</p>
                      </div>
                      <div className="bg-[#0a1628] rounded-lg p-2 text-center">
                        <p className="text-lg font-bold text-amber-400">{ts.submitted || 0}</p>
                        <p className="text-[10px] text-gray-500">Pending</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-2">
                        <div className={`h-2 rounded-full ${pct >= 80 ? 'bg-green-500' : pct >= 50 ? 'bg-amber-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                      </div>
                      <span className="text-xs font-medium text-gray-400">{pct}%</span>
                    </div>

                    {/* View tasks button */}
                    <div className="mt-3 flex justify-end">
                      <button
                        onClick={async () => {
                          const assignments = await internshipService.getInternTasks(intern.id);
                          const taskData = await internshipService.getTaskDetail(assignments[0]?.task_id || '');
                          if (assignments.length > 0) {
                            setSelectedTask({ ...taskData, assignments });
                          }
                        }}
                        className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
                      >
                        View Tasks <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : selectedCohortId ? (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
              <Users className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Interns Found</h3>
              <p className="text-gray-400">No accepted interns in this cohort yet</p>
            </div>
          ) : (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-16 text-center">
              <Users className="h-16 w-16 text-gray-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">Select a Cohort</h3>
              <p className="text-gray-400">Choose a cohort from the dropdown to view its interns</p>
            </div>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          TASK DETAIL / GRADE MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {selectedTask && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setSelectedTask(null); setShowGradeModal(false); }} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-lg font-semibold text-white">{selectedTask.title}</h2>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-medium border ${PRIORITY_COLORS[selectedTask.priority] || ''}`}>{selectedTask.priority}</span>
                </div>
                <p className="text-gray-400 text-sm">{selectedTask.cohort_name || 'No cohort'} • <span className="capitalize">{selectedTask.task_type?.replace('_', ' ')}</span></p>
              </div>
              <button onClick={() => { setSelectedTask(null); setShowGradeModal(false); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Description */}
              {selectedTask.description && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 mb-2">Description</h3>
                  <p className="text-gray-400 text-sm">{selectedTask.description}</p>
                </div>
              )}

              {/* Task Info */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-[#0a1628] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-blue-400">{selectedTask.total_interns}</p>
                  <p className="text-[10px] text-gray-500">Assigned</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-green-400">{selectedTask.completed_count}</p>
                  <p className="text-[10px] text-gray-500">Approved</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-purple-400">{selectedTask.submitted_count}</p>
                  <p className="text-[10px] text-gray-500">Submitted</p>
                </div>
                <div className="bg-[#0a1628] rounded-lg p-3 text-center">
                  <p className="text-lg font-bold text-gray-400">{selectedTask.max_score || '—'}</p>
                  <p className="text-[10px] text-gray-500">Max Score</p>
                </div>
              </div>

              {/* Intern Assignments */}
              <div>
                <h3 className="text-sm font-semibold text-gray-300 mb-3">Intern Progress ({selectedTask.assignments?.length || 0})</h3>
                {selectedTask.assignments?.length > 0 ? (
                  <div className="space-y-2">
                    {selectedTask.assignments.map(a => (
                      <div key={a.id} className="bg-[#0a1628] rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-blue-900/40 flex items-center justify-center">
                            <span className="text-xs font-bold text-blue-400">{a.intern_name?.charAt(0) || '?'}</span>
                          </div>
                          <div>
                            <p className="text-white text-sm font-medium">{a.intern_name || 'Unknown'}</p>
                            <p className="text-gray-500 text-xs">{a.intern_reference || ''}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${TASK_STATUS_COLORS[a.status] || ''}`}>
                            {a.status.replace('_', ' ')}
                          </span>
                          {a.score !== null && <span className="text-white font-semibold text-sm">{a.score}/{selectedTask.max_score || '?'}</span>}
                          {a.status === 'submitted' && (
                            <button
                              onClick={() => openGradeModal(a)}
                              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-xs"
                            >
                              Grade
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 text-sm">No interns assigned yet</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          GRADE MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showGradeModal && gradeData && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowGradeModal(false)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Grade Submission</h2>

            <div className="space-y-4">
              {/* Status */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Decision</label>
                <div className="flex gap-2">
                  {(['approved', 'rejected'] as const).map(s => (
                    <button
                      key={s}
                      onClick={() => setGradeData(prev => prev ? { ...prev, status: s } : null)}
                      className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition border ${
                        gradeData.status === s
                          ? s === 'approved' ? 'bg-green-600 border-green-500 text-white' : 'bg-red-600 border-red-500 text-white'
                          : 'bg-[#0a1628] border-white/10 text-gray-400 hover:text-white'
                      }`}
                    >
                      {s === 'approved' ? '✓ Approve' : '✗ Reject'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Score */}
              {gradeData.status === 'approved' && (
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Score</label>
                  <input
                    type="number" value={gradeData.score} min={0} max={100}
                    onChange={e => setGradeData(prev => prev ? { ...prev, score: parseInt(e.target.value) || 0 } : null)}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>
              )}

              {/* Feedback */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Feedback</label>
                <textarea
                  value={gradeData.feedback} rows={3}
                  onChange={e => setGradeData(prev => prev ? { ...prev, feedback: e.target.value } : null)}
                  placeholder="Provide feedback for the intern..."
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 mt-6 pt-4 border-t border-white/10">
              <button onClick={() => setShowGradeModal(false)} className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm">Cancel</button>
              <button
                onClick={handleGrade} disabled={grading}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {grading ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Saving...</> : <><Send className="h-4 w-4" /> Save Grade</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          CREATE TASK MODAL
      ═══════════════════════════════════════════════════════════════ */}
      {showTaskModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowTaskModal(false)} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white">Create New Task</h2>
              <button onClick={() => setShowTaskModal(false)} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Cohort */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Cohort *</label>
                <select
                  value={taskForm.cohort_id} onChange={e => setTaskForm(prev => ({ ...prev, cohort_id: e.target.value }))}
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                >
                  <option value="">Select cohort...</option>
                  {cohorts.map(c => (
                    <option key={c.id} value={c.id}>{c.cohort_name} ({c.cohort_code})</option>
                  ))}
                </select>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Task Title *</label>
                <input
                  type="text" value={taskForm.title} onChange={e => setTaskForm(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="e.g., Research Report on Mobile Trends" className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm text-gray-300 mb-1.5 font-medium">Description</label>
                <textarea
                  value={taskForm.description} onChange={e => setTaskForm(prev => ({ ...prev, description: e.target.value }))}
                  rows={3} placeholder="Describe what the intern needs to do..." className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                />
              </div>

              {/* Task Type & Priority */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Type</label>
                  <select value={taskForm.task_type} onChange={e => setTaskForm(prev => ({ ...prev, task_type: e.target.value }))} className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm">
                    {TASK_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Priority</label>
                  <select value={taskForm.priority} onChange={e => setTaskForm(prev => ({ ...prev, priority: e.target.value }))} className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm">
                    {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Due Date & Max Score */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Due Date</label>
                  <input type="date" value={taskForm.due_date} onChange={e => setTaskForm(prev => ({ ...prev, due_date: e.target.value }))} className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm" />
                </div>
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Max Score</label>
                  <input type="number" value={taskForm.max_score} min={1} max={1000} onChange={e => setTaskForm(prev => ({ ...prev, max_score: parseInt(e.target.value) || 100 }))} className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white focus:outline-none focus:border-blue-500 transition text-sm" />
                </div>
              </div>

              {/* Assign to all */}
              <div className="flex items-center gap-3">
                <input
                  type="checkbox" id="assign_all" checked={taskForm.assign_to_all}
                  onChange={e => setTaskForm(prev => ({ ...prev, assign_to_all: e.target.checked }))}
                  className="w-4 h-4 rounded border-white/10 bg-[#0a1628] text-blue-600 focus:ring-blue-500"
                />
                <label htmlFor="assign_all" className="text-sm text-gray-300">Assign to all interns in this cohort</label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
              <button onClick={() => setShowTaskModal(false)} className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm">Cancel</button>
              <button
                onClick={handleCreateTask} disabled={!taskForm.title || !taskForm.cohort_id || saving}
                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {saving ? <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Creating...</> : <><Save className="h-4 w-4" /> Create Task</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstructorInternshipsPage;
