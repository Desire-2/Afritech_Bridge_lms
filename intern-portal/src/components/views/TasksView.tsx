/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api, extractApiError } from '../../lib/api';
import { TaskAssignment } from '../../types';
import { 
  Filter, 
  ArrowUpDown, 
  Search, 
  Clock, 
  CheckCircle, 
  XOctagon, 
  Inbox, 
  Loader2,
  ChevronRight,
  Code,
  FileText,
  HelpCircle,
  BookOpen
} from 'lucide-react';

interface TasksViewProps {
  onNavigate: (path: string) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({ onNavigate }) => {
  const [tasks, setTasks] = useState<TaskAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters state
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortBy, setSortBy] = useState('due_date');
  const [sortOrder, setSortOrder] = useState('asc');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchTasks = async () => {
    setLoading(true);
    setError(null);
    try {
      const tasksData = await api.getTasks({
        status: statusFilter,
        task_type: typeFilter,
        sort_by: sortBy,
        sort_order: sortOrder
      });
      if (tasksData && Array.isArray(tasksData)) {
        setTasks(tasksData);
      }
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Failed connecting to remote tasks engine.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTasks();
  }, [statusFilter, typeFilter, sortBy, sortOrder]);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-rose-950 border-rose-500/30 text-rose-300';
      case 'high':
        return 'bg-orange-950 border-orange-500/25 text-orange-400';
      case 'medium':
        return 'bg-amber-950 border-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-950 border-emerald-500/20 text-emerald-400';
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono uppercase font-bold">
            <CheckCircle className="h-3 w-3 text-emerald-400" />
            <span>Approved</span>
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-500/30 text-rose-300 text-[10px] font-mono uppercase font-bold">
            <XOctagon className="h-3 w-3 text-rose-400" />
            <span>Rejected</span>
          </span>
        );
      case 'submitted':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-blue-950 border border-blue-500/30 text-blue-300 text-[10px] font-mono uppercase">
            <Clock className="h-3 w-3 text-blue-400" />
            <span>Submitted</span>
          </span>
        );
      case 'in_progress':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-950 border border-amber-500/25 text-amber-300 text-[10px] font-mono uppercase font-semibold">
            <Clock className="h-3 w-3 text-amber-450 animate-spin" />
            <span>In Progress</span>
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 text-[10px] font-mono uppercase">
            <span>Pending</span>
          </span>
        );
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'code':
        return <Code className="h-4.5 w-4.5" />;
      case 'quiz':
        return <HelpCircle className="h-4.5 w-4.5" />;
      case 'essay':
        return <FileText className="h-4.5 w-4.5" />;
      default:
        return <BookOpen className="h-4.5 w-4.5" />;
    }
  };

  const formatSimpleDate = (isoString: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  const isOverdue = (dueDateString: string, status: string) => {
    if (status === 'approved' || status === 'submitted') return false;
    try {
      return new Date(dueDateString).getTime() < new Date().getTime();
    } catch {
      return false;
    }
  };

  // Local filter for search text
  const filteredTasks = tasks.filter(task => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      task.title.toLowerCase().includes(term) ||
      task.description.toLowerCase().includes(term) ||
      task.task_id.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="tasks-master-view">
      
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Internship Assignments Workspace</h1>
        <p className="text-xs text-slate-400 mt-1">
          Review, write solutions, and track grades for your technical assignments.
        </p>
      </div>

      {/* FILTERS TOOLBAR */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col xl:flex-row xl:items-center justify-between gap-4 shadow-md">
        
        {/* Left Side Inputs (Search & Drops) */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3.5 flex-1 min-w-0">
          
          {/* Search bar */}
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search assignments..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-slate-550 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3.5">
            {/* Status Drop */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-550 font-mono">STATUS:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="rejected">Rejected</option>
              </select>
            </div>

            {/* Type Drop */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-550 font-mono">TYPE:</span>
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
              >
                <option value="all">All Types</option>
                <option value="code">Code Project</option>
                <option value="quiz">Interactive Quiz</option>
                <option value="essay">Thematic Essay</option>
                <option value="report">Analytic Report</option>
              </select>
            </div>
          </div>
        </div>

        {/* Right Side sorting trigger */}
        <div className="flex items-center justify-end gap-3.5">
          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-slate-550 font-mono">SORT BY:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-teal-500"
            >
              <option value="due_date">Due Date</option>
              <option value="priority">Priority Weight</option>
              <option value="title">Assignment Name</option>
            </select>
          </div>

          <button
            onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            className="p-1.5 px-2.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-white rounded-xl transition-all cursor-pointer flex items-center space-x-1.5"
          >
            <ArrowUpDown className="h-3.5 w-3.5" />
            <span className="text-[10px] font-mono tracking-wider font-semibold uppercase">{sortOrder}</span>
          </button>
        </div>
      </div>

      {/* CORE ASSIGNMENT ROW CARDS */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-3">
          <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
          <p className="text-xs text-slate-500 font-mono">Loading corresponding tasks database...</p>
        </div>
      ) : filteredTasks.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800/80 rounded-2xl p-16 text-center max-w-xl mx-auto space-y-4">
          <div className="w-12 h-12 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-center mx-auto text-slate-500">
            <Inbox className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-md font-bold text-slate-200">No Assignments Discovered</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              No tasks matched your current search filters. Try updating your statuses or search strings.
            </p>
          </div>
          <button
            onClick={() => {
              setStatusFilter('all');
              setTypeFilter('all');
              setSearchTerm('');
            }}
            className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 rounded-xl text-teal-400 text-xs font-semibold cursor-pointer"
          >
            Reset Filters Setup
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTasks.map((task) => {
            const overdue = isOverdue(task.due_date, task.status);
            return (
              <div
                key={task.assignment_id}
                onClick={() => onNavigate(`/intern/tasks/${task.assignment_id}`)}
                className="group bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 rounded-2xl p-5 shadow-sm transition-all cursor-pointer hover:shadow-lg hover:shadow-slate-950 flex flex-col justify-between space-y-4"
              >
                {/* Visual Accent */}
                <div className="space-y-3">
                  <div className="flex justify-between items-start gap-4">
                    {/* Title & Priority */}
                    <div className="min-w-0">
                      <h3 className="text-xs font-bold text-slate-200 group-hover:text-teal-300 transition-all font-mono leading-tight truncate">
                        {task.task_id}: {task.title}
                      </h3>
                      
                      <div className="flex items-center space-x-2 mt-2">
                        <span className={`${getPriorityColor(task.priority)} text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded border`}>
                          {task.priority} Priority
                        </span>
                        
                        <span className="text-[10px] text-slate-500 bg-slate-950 border border-slate-850 px-2 py-0.5 rounded font-mono capitalize">
                          {task.task_type}
                        </span>
                      </div>
                    </div>

                    {/* Icon identifier */}
                    <div className="p-2 bg-slate-950 border border-slate-855 rounded-xl text-slate-400 group-hover:text-teal-400 group-hover:border-teal-500/20 shrink-0 select-none">
                      {getTaskIcon(task.task_type)}
                    </div>
                  </div>

                  {/* Body description truncation */}
                  <p className="text-slate-400 text-xs leading-relaxed line-clamp-2">
                    {task.description.replace(/[#*`[\]]/g, '')}
                  </p>
                </div>

                {/* Bottom line: status badge, deadline, score */}
                <div className="pt-4 border-t border-slate-800/80 flex justify-between items-center text-xs">
                  <div className="flex items-center space-x-3 text-[11px] text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-slate-500" />
                      <span className={overdue ? 'text-rose-450 font-bold font-mono' : ''}>
                        {overdue ? 'Overdue' : formatSimpleDate(task.due_date)}
                      </span>
                    </span>

                    {task.score !== undefined && task.status === 'approved' && (
                      <>
                        <span>•</span>
                        <span className="font-bold text-emerald-450 font-mono">
                          Score: {task.score}/{task.max_score || 100}
                        </span>
                      </>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    {getStatusBadge(task.status)}
                    <ChevronRight className="h-4 w-4 text-slate-655 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
