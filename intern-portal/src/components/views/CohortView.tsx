/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { api, extractApiError } from '../../lib/api';
import { CohortData } from '../../types';
import { 
  Users, 
  Terminal, 
  Calendar, 
  Layers, 
  Compass, 
  ArrowRight,
  Shield, 
  Code, 
  Inbox, 
  Loader2,
  AlertCircle
} from 'lucide-react';

export const CohortView: React.FC = () => {
  const [data, setData] = useState<CohortData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchCohort = async () => {
    setLoading(true);
    setError(null);
    try {
      const cohortData = await api.getCohort();
      if (cohortData && cohortData.cohort) {
        setData(cohortData);
      }
    } catch (err: any) {
      const apiErr = extractApiError(err);
      setError(apiErr.message || 'Failed to load cohort data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCohort();
  }, []);

  const formatSimpleDate = (isoString?: string) => {
    if (!isoString) return '';
    try {
      const d = new Date(isoString);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return isoString;
    }
  };

  // Generate color seeds for initials avatars
  const getAvatarBg = (name: string) => {
    const sum = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = [
      'bg-teal-900 border-teal-500/30 text-teal-300',
      'bg-indigo-900 border-indigo-500/30 text-indigo-300',
      'bg-emerald-900 border-emerald-500/30 text-emerald-300',
      'bg-purple-900 border-purple-500/30 text-purple-300',
      'bg-orange-900 border-orange-500/30 text-orange-300',
      'bg-sky-900 border-sky-500/30 text-sky-300'
    ];
    return colors[sum % colors.length];
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
        <Loader2 className="h-8 w-8 text-teal-400 animate-spin" />
        <p className="text-xs text-slate-500 font-mono">Loading cohort register records...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center max-w-lg mx-auto space-y-4 mt-12">
        <AlertCircle className="h-10 w-10 text-rose-455 mx-auto" />
        <div>
          <h3 className="text-md font-bold text-white">Cohort Synchronized Alert</h3>
          <p className="text-xs text-slate-400 mt-1 leading-relaxed">
            {error || 'Cohort peer directories are momentarily unavailable.'}
          </p>
        </div>
        <button
          onClick={fetchCohort}
          className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-xl text-xs text-slate-305 font-semibold cursor-pointer"
        >
          Check Connection
        </button>
      </div>
    );
  }

  const { cohort, track, fellow_interns: fellows } = data;

  return (
    <div className="space-y-8 font-sans animate-fadeIn" id="cohort-view-card">
      
      {/* Header */}
      <div>
        <h1 className="text-2xl font-extrabold text-white tracking-tight">My Cohort & Specialization</h1>
        <p className="text-xs text-slate-400 mt-1">
          Explore your active class peers, academic timeline milestones, and specialized curricula.
        </p>
      </div>

      {/* 2-Column top section: Cohort Info vs Track Info */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Card A: Cohort profile */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 pointer-events-none rounded-full" />
          
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-teal-950 border border-teal-500/20 text-teal-400 flex items-center justify-center">
              <Compass className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-200 text-sm leading-snug">Registration profile</h3>
              <span className="text-[10px] font-mono text-slate-500">{cohort.cohort_code}</span>
            </div>
          </div>

          <p className="text-xs text-slate-400 leading-relaxed">
            {cohort.description}
          </p>

          <div className="grid grid-cols-2 gap-3.5 pt-2">
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
              <span className="block text-[8px] text-slate-500 font-mono">ENROLLMENT MATRIX</span>
              <span className="text-sm font-bold text-white font-mono mt-1 block">Active</span>
            </div>
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-850">
              <span className="block text-[8px] text-slate-500 font-mono">COHORT CAPACITY</span>
              <span className="text-sm font-bold text-teal-300 font-mono mt-1 block">{cohort.capacity} Interns</span>
            </div>
          </div>

          {/* Timeline range inline strip */}
          <div className="p-3 bg-slate-950 rounded-xl border border-slate-850 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-2">
              <Calendar className="h-3.5 w-3.5 text-slate-500" />
              <span className="text-slate-400 text-[10px]">{formatSimpleDate(cohort.start_date)}</span>
            </div>
            <ArrowRight className="h-3.5 w-3.5 text-slate-700" />
            <span className="text-teal-400 text-[10px]">{formatSimpleDate(cohort.end_date)}</span>
          </div>
        </div>

        {/* Card B: Track Details */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-md space-y-4 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/5 pointer-events-none rounded-full" />
          
          <div className="flex items-center space-x-3.5">
            <div className="w-10 h-10 rounded-xl bg-orange-950/45 border border-orange-500/20 text-orange-400 flex items-center justify-center">
              <Terminal className="h-5.5 w-5.5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-205 text-sm leading-snug">Specialization track</h3>
              <span className="text-[10px] font-mono text-orange-450 uppercase">SOFTWARE SCIENCE</span>
            </div>
          </div>

          <div className="bg-slate-950 p-4 border border-slate-855 rounded-2xl">
            <h4 className="text-xs font-bold text-white">{track.name}</h4>
            <p className="text-[11px] text-slate-400 mt-2 leading-relaxed">
              {track.description}
            </p>
          </div>

          <div className="bg-slate-950 p-3 rounded-xl border border-slate-850 flex items-center space-x-2.5 text-[11px] text-slate-405">
            <Layers className="h-4 w-4 text-orange-400 shrink-0" />
            <span>Covers Express microservice APIs, relational index normalization, React/Vite layout architectures, and Git structures.</span>
          </div>
        </div>
      </div>

      {/* Fellow Interns Section */}
      <div className="space-y-4">
        <div>
          <h2 className="text-md font-bold text-white">Fellow class interns ({fellows.length})</h2>
          <p className="text-[11px] text-slate-400">Classmates assigned to your track and cohort projects.</p>
        </div>

        {fellows.length === 0 ? (
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-12 text-center text-slate-500 text-xs text-slate-400">
            No classmates found inside this cohort yet.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4" id="fellow-interns-grid">
            {fellows.map((fellow, idx) => {
              const initials = fellow.avatar || fellow.full_name.substring(0, 2).toUpperCase();
              return (
                <div
                  key={idx}
                  className="bg-slate-900 border border-slate-800 hover:border-slate-700 p-4 rounded-2xl flex items-center space-x-3.5 transition-all select-none"
                >
                  <div className={`w-9 h-9 rounded-full border ${getAvatarBg(fellow.full_name)} flex items-center justify-center font-bold text-xs shrink-0`}>
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <span className="text-xs font-semibold text-white block truncate">{fellow.full_name}</span>
                    <span className="text-[9px] font-mono text-slate-500 tracking-wider inline-block bg-slate-955 border border-slate-850 px-1.5 py-0.5 rounded mt-1">
                      {fellow.reference_code}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
