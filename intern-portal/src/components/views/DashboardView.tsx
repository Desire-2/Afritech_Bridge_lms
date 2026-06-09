/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useCallback } from 'react';
import { api, extractApiError } from '../../lib/api';
import { DashboardData } from '../../types';
import { 
  Calendar, 
  Clock, 
  Award, 
  ChevronRight, 
  BookOpen, 
  Code, 
  FileText, 
  HelpCircle,
  FileCheck2,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface DashboardViewProps {
  onNavigate: (path: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboardData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const dashData = await api.getDashboard();
      setData(dashData);
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Failed connecting to server.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchDashboardData, 30_000);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'urgent':
        return 'bg-rose-950 border-rose-500/25 text-rose-300';
      case 'high':
        return 'bg-orange-950 border-orange-500/25 text-orange-400';
      case 'medium':
        return 'bg-amber-950 border-amber-500/20 text-amber-400';
      default:
        return 'bg-emerald-950 border-emerald-500/20 text-emerald-400';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'bg-emerald-950/50 border border-emerald-500/30 text-emerald-400';
      case 'rejected':
        return 'bg-rose-950/50 border border-rose-500/30 text-rose-400';
      case 'submitted':
        return 'bg-blue-950/50 border border-blue-500/30 text-blue-400';
      case 'in_progress':
        return 'bg-amber-950/45 border border-amber-500/25 text-amber-400';
      default:
        return 'bg-slate-900 border border-slate-800 text-slate-400';
    }
  };

  const getTaskIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'code':
        return <Code className="h-4 w-4" />;
      case 'quiz':
        return <HelpCircle className="h-4 w-4" />;
      case 'essay':
        return <FileText className="h-4 w-4" />;
      default:
        return <BookOpen className="h-4 w-4" />;
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

  // Remaining days count helper
  const getDaysRemaining = (dueDateString: string) => {
    try {
      const diffTime = new Date(dueDateString).getTime() - new Date().getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays < 0) {
        return <span className="text-rose-400 font-semibold font-mono">Overdue</span>;
      }
      if (diffDays === 0) {
        return <span className="text-orange-400 font-semibold font-mono animate-pulse">Due today</span>;
      }
      if (diffDays === 1) {
        return <span className="text-amber-400 font-semibold font-mono">1 day remaining</span>;
      }
      return <span className="text-slate-400 font-mono text-xs">{diffDays} days left</span>;
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[450px] space-y-4 font-sans">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-400">Loading intern cockpit workspace...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center space-y-4 max-w-lg mx-auto mt-12 font-sans">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
        <div>
          <h3 className="text-lg font-bold text-white">Database Link Alert</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'Dashboard datasets could not be extracted.'}
          </p>
        </div>
        <div className="pt-2 flex justify-center space-x-3 text-xs">
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-slate-950 border border-slate-800 rounded-xl hover:border-slate-700 hover:bg-slate-800 text-slate-300 font-semibold transition-all cursor-pointer"
          >
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  const { intern, program, tasks, upcoming_deadlines, offer } = data;

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="dashboard-view-panel">
      
      {/* 1. WELCOME HERO BAR */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6 relative overflow-hidden shadow-lg shadow-slate-950">
        {/* Background glow decorator */}
        <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-teal-500/10 via-teal-900/5 to-transparent pointer-events-none rounded-full" />
        
        <div className="space-y-2 z-10">
          <div className="flex items-center space-x-2">
            <span className="px-2.5 py-0.5 rounded-full bg-teal-950 border border-teal-500/25 text-teal-400 text-[10px] font-semibold font-mono tracking-wider uppercase">
              {program.status} intern
            </span>
            <span className="text-[10px] text-slate-500 font-mono">REF: {intern.reference_code}</span>
          </div>
          <h1 className="text-25xl sm:text-3xl font-extrabold text-white tracking-tight leading-tight">
            Greetings, {intern.full_name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-400">
            Cohort assignment: <span className="text-teal-300 font-semibold">{program.cohort}</span> • Specializing in <span className="text-orange-400 font-semibold">{program.track}</span>
          </p>
        </div>

        <button 
          onClick={() => onNavigate('/intern/profile')}
          className="px-4 py-2 text-xs font-semibold bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-350 hover:text-white rounded-lg transition-all z-10 shrink-0 cursor-pointer"
        >
          Manage Profile Settings
        </button>
      </section>

      {/* Grid container */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* COLUMN 1 & COLUMN 2 BLOCK (LEFT: Task Progression & Deadlines) */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* A. Task Progress Ring Details */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md flex flex-col sm:flex-row gap-8 items-center">
            
            {/* SVG Interactive circular progress */}
            <div className="relative shrink-0 flex items-center justify-center">
              <svg className="w-32 h-32 transform -rotate-90">
                {/* Track circle */}
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  className="stroke-slate-800 fill-none"
                  strokeWidth="8"
                />
                {/* Ring progression */}
                <circle
                  cx="64"
                  cy="64"
                  r="52"
                  className="stroke-teal-500 fill-none transition-all duration-1000 ease-out"
                  strokeWidth="8"
                  strokeDasharray={2 * Math.PI * 52}
                  strokeDashoffset={2 * Math.PI * 52 * (1 - (tasks.progress_pct / 100))}
                  strokeLinecap="round"
                />
              </svg>
              
              <div className="absolute text-center">
                <span className="text-2xl font-black text-white font-mono">{tasks.progress_pct}%</span>
                <span className="block text-[9px] font-mono tracking-wider text-slate-400 uppercase">Completed</span>
              </div>
            </div>

            {/* Aggregated breakdown stats */}
            <div className="flex-1 space-y-5">
              <div>
                <h3 className="text-md font-bold text-slate-200">Task Performance Ledger</h3>
                <p className="text-[11px] text-slate-400">Automatic updates synchronized on instructor evaluations.</p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="block text-[10px] text-slate-500 font-semibold font-mono uppercase">Assigned</span>
                  <span className="text-lg font-bold text-white font-mono">{tasks.total_assigned}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="block text-[10px] text-teal-400 font-semibold font-mono uppercase">Approved</span>
                  <span className="text-lg font-bold text-teal-300 font-mono">{tasks.completed}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800/60">
                  <span className="block text-[10px] text-blue-400 font-semibold font-mono uppercase">Submitted</span>
                  <span className="text-lg font-bold text-blue-300 font-mono">{tasks.submitted}</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl text-center border border-slate-800/60 font-mono">
                  <span className="block text-[10px] text-amber-400 font-semibold uppercase">Pending</span>
                  <span className="text-lg font-bold text-amber-300">{tasks.pending + tasks.in_progress}</span>
                </div>
              </div>

              {tasks.avg_score !== undefined && tasks.avg_score > 0 && (
                <div className="flex items-center space-x-3 p-3 bg-emerald-950/20 border border-emerald-500/10 rounded-xl">
                  <Award className="h-5 w-5 text-emerald-400 shrink-0" />
                  <div className="text-xs">
                    <span className="text-slate-400">Cumulative average grade: </span>
                    <span className="text-emerald-400 font-bold font-mono">{tasks.avg_score}%</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* B. Upcoming Deadlines Register */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div className="flex justify-between items-center sm:px-1">
              <div>
                <h3 className="text-md font-bold text-white">Upcoming Target Deadlines</h3>
                <p className="text-[11px] text-slate-400">Chronologically mapped tasks requiring active input.</p>
              </div>

              <button
                onClick={() => onNavigate('/intern/tasks')}
                className="text-xs text-teal-400 hover:text-teal-300 font-semibold flex items-center gap-1 hover:underline cursor-pointer"
              >
                <span>All tasks ({tasks.total_assigned})</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            <div className="space-y-3">
              {upcoming_deadlines.length === 0 ? (
                <div className="text-center py-8 text-slate-500 text-xs border border-dashed border-slate-800 rounded-2xl">
                  All tasks are submitted or approved! Excellent job.
                </div>
              ) : (
                upcoming_deadlines.map((task) => (
                  <div
                    key={task.assignment_id}
                    onClick={() => onNavigate(`/intern/tasks/${task.assignment_id}`)}
                    className="group bg-slate-950 hover:bg-slate-800/40 p-4 border border-slate-800/80 hover:border-slate-700/80 rounded-2xl flex items-center justify-between gap-4 transition-all cursor-pointer"
                  >
                    <div className="flex items-center space-x-3.5 min-w-0">
                      <div className="w-8.5 h-8.5 rounded-lg bg-slate-900 border border-slate-800 text-slate-400 group-hover:text-teal-400 flex items-center justify-center shrink-0">
                        {getTaskIcon(task.task_type)}
                      </div>
                      
                      <div className="min-w-0">
                        <h4 className="text-xs font-bold text-slate-350 group-hover:text-white transition-all truncate">
                          {task.title}
                        </h4>
                        
                        <div className="flex flex-wrap items-center gap-2 mt-1.5 text-[10px] text-slate-400">
                          <span className={`${getPriorityColor(task.priority)} px-1.5 py-0.5 rounded border font-mono uppercase text-[9px]`}>
                            {task.priority}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3 text-slate-500" />
                            {formatSimpleDate(task.due_date)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] font-semibold mb-1">
                        {getDaysRemaining(task.due_date)}
                      </div>
                      <span className={`${getStatusColor(task.status)} px-2 py-0.5 rounded-full text-[9px] font-mono uppercase`}>
                        {task.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* COLUMN 3 BLOCK (RIGHT: Program Info & Offer Verification) */}
        <div className="space-y-6">
          
          {/* A. Program / Cohort Stats Panel */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4">
            <div>
              <h3 className="text-md font-bold text-white">Cohort Registration Information</h3>
              <p className="text-[11px] text-slate-400">Admissions registry dates and specifications.</p>
            </div>

            <div className="space-y-3.5">
              <div className="bg-slate-950 p-4 border border-slate-800 rounded-2xl space-y-1.5">
                <span className="text-[10px] text-slate-400 font-mono tracking-tight uppercase block leading-none">Registered track:</span>
                <span className="font-bold text-white text-md block leading-snug">{program.track}</span>
                <span className="text-xs text-teal-400 inline-block font-medium bg-teal-950/40 border border-teal-500/20 px-2 py-0.5 rounded-full">{program.cohort}</span>
              </div>

              <div className="grid grid-cols-2 gap-3.5">
                <div className="bg-slate-950 p-3 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-mono block">START DATE:</span>
                  <span className="text-xs font-bold text-slate-300 font-mono block">{formatSimpleDate(program.cohort_start)}</span>
                </div>
                <div className="bg-slate-950 p-3 border border-slate-850 rounded-xl space-y-1">
                  <span className="text-[9px] text-slate-500 font-mono block">GRADUATION DATE:</span>
                  <span className="text-xs font-bold text-slate-350 font-mono block">{formatSimpleDate(program.cohort_end)}</span>
                </div>
              </div>

              <div className="flex items-start gap-2.5 p-3.5 bg-slate-950 border border-slate-800/60 rounded-xl text-xs text-slate-400">
                <Calendar className="h-4.5 w-4.5 text-teal-400 shrink-0 mt-0.5" />
                <span className="leading-relaxed">
                  Your internship is active and online. All assignments must be completed on time to qualify for graduation certification.
                </span>
              </div>
            </div>
          </div>

          {/* B. Offer Letter Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
            {/* Visual glow decorator */}
            <div className="absolute bottom-0 right-0 w-44 h-44 bg-gradient-to-tl from-teal-500/10 to-transparent pointer-events-none rounded-full" />
            
            <div className="flex items-center space-x-3.5">
              <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-500/20 text-teal-400 flex items-center justify-center">
                <FileCheck2 className="h-5.5 w-5.5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white">Admissions Offer</h3>
                <span className="text-[10px] font-mono text-slate-500">{offer.offer_number || 'LOADING-OFFER'}</span>
              </div>
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Your formal internship offer has been issued and stored securely. You can verify and share your official credentials.
            </p>

            <div className="bg-slate-950 p-3 border border-slate-850 rounded-xl flex items-center justify-between text-xs font-mono">
              <span className="text-slate-500">Admissions Status:</span>
              <span className="text-emerald-400 font-bold uppercase">{offer.status}</span>
            </div>

            <button
              onClick={() => onNavigate('/intern/offer')}
              className="w-full bg-slate-950 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-teal-450 hover:text-white rounded-xl py-2.5 text-xs font-semibold font-sans flex items-center justify-center gap-1.5 transition-all text-center cursor-pointer"
            >
              <span>Verify & Share Offer Letter</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
