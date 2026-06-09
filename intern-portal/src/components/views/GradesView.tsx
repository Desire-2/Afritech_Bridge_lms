/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import { GradesSummary, TaskAssignment } from '../../types';
import { 
  Award, 
  Hourglass, 
  CheckCircle, 
  XOctagon, 
  Inbox, 
  Loader2,
  AlertCircle,
  HelpCircle,
  Code,
  FileText,
  BookOpen,
  ChevronRight
} from 'lucide-react';

interface GradesViewProps {
  onNavigate: (path: string) => void;
}

export const GradesView: React.FC<GradesViewProps> = ({ onNavigate }) => {
  const [data, setData] = useState<GradesSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGrades = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.getGrades();
      if (response.success) {
        setData(response.data);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed connecting to remote academic engines.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchGrades();

    const handleSandboxChange = () => {
      fetchGrades();
    };
    window.addEventListener('sandbox_mode_changed', handleSandboxChange);
    return () => {
      window.removeEventListener('sandbox_mode_changed', handleSandboxChange);
    };
  }, []);

  const getTaskIcon = (type: string) => {
    switch (type?.toLowerCase()) {
      case 'code':
        return <Code className="h-4.5 w-4.5 text-blue-400" />;
      case 'quiz':
        return <HelpCircle className="h-4.5 w-4.5 text-teal-400" />;
      case 'essay':
        return <FileText className="h-4.5 w-4.5 text-orange-400" />;
      default:
        return <BookOpen className="h-4.5 w-4.5 text-slate-400" />;
    }
  };

  const getPercentageColor = (pct: number) => {
    if (pct >= 85) return 'text-emerald-400';
    if (pct >= 70) return 'text-teal-400';
    if (pct >= 50) return 'text-amber-400';
    return 'text-rose-450';
  };

  const getProgressGaugeColor = (pct: number) => {
    if (pct >= 85) return 'bg-emerald-500';
    if (pct >= 70) return 'bg-teal-500';
    if (pct >= 50) return 'bg-amber-500';
    return 'bg-rose-500';
  };

  const formatSimpleDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4 font-sans">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Loading grades and tutor records...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 mt-12 font-sans">
        <AlertCircle className="h-10 w-10 text-rose-400 mx-auto" />
        <div>
          <h3 className="text-md font-bold text-white">Grades Synchronizing Alert</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'Your historical scores details could not be synchronous.'}
          </p>
        </div>
        <button
          onClick={fetchGrades}
          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-xl text-xs text-slate-300 font-semibold cursor-pointer"
        >
          Back to list
        </button>
      </div>
    );
  }

  // Segment tasks list
  const gradedList = data.list.filter(t => t.status === 'approved' || t.status === 'rejected');
  const awaitingList = data.list.filter(t => t.status === 'submitted');

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="grades-view-panel">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">Performance Book & Report</h1>
        <p className="text-xs text-slate-400 mt-1">
          Monitor your evaluated solutions, cumulative cohort averages, and instructor critiques.
        </p>
      </div>

      {/* 1. CORE PERFORMANCE SUMMARY CARD */}
      <section className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md grid grid-cols-1 md:grid-cols-3 gap-8 items-center">
        
        {/* Left segment: Ring progression details */}
        <div className="space-y-3 md:col-span-2">
          <div>
            <h3 className="text-sm font-bold text-slate-300">Cumulative Academic Progress</h3>
            <p className="text-[11px] text-slate-405">This score defines your current eligibility for graduation credentialing.</p>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-end text-xs font-mono">
              <span className="text-slate-500">Graduation Cutoff (75% Minimum Required)</span>
              <span className={`font-black text-sm ${getPercentageColor(data.overall_percentage)}`}>
                {data.overall_percentage}% Overall
              </span>
            </div>
            
            {/* Horizontal progress gauge */}
            <div className="w-full h-3 bg-slate-950 border border-slate-850 rounded-full overflow-hidden p-0.5">
              <div 
                className={`h-full rounded-full transition-all duration-1000 ${getProgressGaugeColor(data.overall_percentage)}`}
                style={{ width: `${Math.min(data.overall_percentage, 100)}%` }}
              />
            </div>
          </div>
        </div>

        {/* Right segment: Counter blocks */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 text-center space-y-0.5">
            <span className="block text-[8px] uppercase text-slate-500 font-mono">GRADED</span>
            <span className="text-md font-bold text-white font-mono">{data.total_graded}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 text-center space-y-0.5">
            <span className="block text-[8px] uppercase text-emerald-400 font-mono">APPROVED</span>
            <span className="text-md font-bold text-emerald-300 font-mono">{data.approved_count}</span>
          </div>
          <div className="bg-slate-950 p-3 rounded-2xl border border-slate-850 text-center space-y-0.5">
            <span className="block text-[8px] uppercase text-rose-450 font-mono">REJECTED</span>
            <span className="text-md font-bold text-rose-350 font-mono">{data.rejected_count}</span>
          </div>
        </div>
      </section>

      {/* Grid: Assignments and Pending Blocks */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* A. GRADED ASSIGNMENTS - LEFT SIDE (2/3 width) */}
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-md font-bold text-white">Graded evaluations ({gradedList.length})</h2>
            <span className="text-[10px] text-slate-500 font-mono">APPROVED MARKS</span>
          </div>

          {gradedList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs border-dashed">
              No assignments have been reviewed by tutors yet.
            </div>
          ) : (
            <div className="space-y-4">
              {gradedList.map((item) => {
                const percentage = Math.round(((item.score ?? 0) / (item.max_score || 100)) * 100);
                const isApp = item.status === 'approved';
                
                return (
                  <div
                    key={item.assignment_id}
                    onClick={() => onNavigate(`/intern/tasks/${item.assignment_id}`)}
                    className={`
                      group bg-slate-900 border hover:bg-slate-800/40 rounded-2xl p-4.5 transition-all cursor-pointer flex flex-col justify-between space-y-3.5
                      ${isApp ? 'border-slate-800 hover:border-slate-700' : 'border-rose-950 hover:border-rose-900/60'}
                    `}
                  >
                    <div className="flex justify-between items-start gap-4">
                      <div className="flex items-center space-x-3.5 min-w-0">
                        <div className="w-8.5 h-8.5 rounded-lg bg-slate-950 border border-slate-850 flex items-center justify-center shrink-0">
                          {getTaskIcon(item.task_type)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-slate-200 group-hover:text-teal-300 transition-all truncate leading-snug">
                            {item.title}
                          </h4>
                          <span className="text-[9px] text-slate-500 font-mono uppercase block mt-1">
                            Evaluated {formatSimpleDate(item.graded_at)}
                          </span>
                        </div>
                      </div>

                      {/* Score metrics */}
                      <div className="text-right shrink-0">
                        <div className="text-xs font-black text-white font-mono leading-none">
                          {item.score}<span className="text-slate-500 font-normal">/{item.max_score || 100}</span>
                        </div>
                        <span className={`text-[9px] font-mono font-bold block mt-1.5 ${getPercentageColor(percentage)}`}>
                          ({percentage}%)
                        </span>
                      </div>
                    </div>

                    {/* Feedback brief snippet */}
                    {item.feedback && (
                      <div className="bg-slate-950 p-2.5 rounded-xl border border-slate-900 text-[11px] text-slate-400 italic line-clamp-1">
                        "{item.feedback}"
                      </div>
                    )}

                    {/* Footer Row */}
                    <div className="pt-2 border-t border-slate-850 flex justify-between items-center text-[10px]">
                      <span className="text-slate-550 font-mono">STATUS:</span>
                      <span className={`px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase ${
                        isApp ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-300'
                      }`}>
                        {item.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* B. PENDING FEEDBACK - RIGHT SIDE (1/3 width) */}
        <div className="space-y-5">
          <div className="flex justify-between items-center sm:px-1">
            <h2 className="text-md font-bold text-white">Pending review ({awaitingList.length})</h2>
            <Hourglass className="h-4.5 w-4.5 text-amber-450 animate-pulse" />
          </div>

          {awaitingList.length === 0 ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center text-slate-500 text-xs text-slate-400">
              No tasks awaiting grading. Submit a solution to see it listed here!
            </div>
          ) : (
            <div className="space-y-4">
              {awaitingList.map((item) => (
                <div
                  key={item.assignment_id}
                  onClick={() => onNavigate(`/intern/tasks/${item.assignment_id}`)}
                  className="group bg-slate-900/60 hover:bg-slate-900 p-4 border border-slate-800 rounded-2xl transition-all cursor-pointer flex flex-col space-y-3"
                >
                  <div className="flex items-center space-x-3.5 min-w-0">
                    <div className="w-8 h-8 bg-slate-950 border border-slate-850 text-slate-400 rounded-lg flex items-center justify-center shrink-0">
                      {getTaskIcon(item.task_type)}
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-bold text-slate-350 truncate">
                        {item.title}
                      </h4>
                      <div className="text-[9px] text-slate-500 font-mono mt-1">
                        Submitted {formatSimpleDate(item.submitted_at)}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-2 border-t border-slate-850 text-[10px]">
                    <span className="text-slate-500 italic font-mono uppercase">Awaiting grade</span>
                    <span className="text-slate-400 flex items-center gap-1 group-hover:text-white transition-all">
                      <span>View details</span>
                      <ChevronRight className="h-3 w-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
