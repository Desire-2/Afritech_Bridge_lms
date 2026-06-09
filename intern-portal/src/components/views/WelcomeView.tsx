/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { ApplicationStatus } from '../../types';
import { Check, Clipboard, Search, AlertCircle, Loader2 } from 'lucide-react';

interface WelcomeViewProps {
  onNavigate: (path: string) => void;
}

export const WelcomeView: React.FC<WelcomeViewProps> = ({ onNavigate }) => {
  const [refCode, setRefCode] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusResult, setStatusResult] = useState<ApplicationStatus['data'] | null>(null);

  const handleTrackStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refCode.trim() || !email.trim()) {
      setError('Please provide both your reference code and email.');
      return;
    }

    setLoading(true);
    setError(null);
    setStatusResult(null);

    try {
      const response = await api.checkApplicationStatus(refCode, email);
      if (response.success && response.data.full_name) {
        setStatusResult(response.data);
      } else {
        setError('No active application found matching this reference code and email combined.');
      }
    } catch (err: any) {
      setError(err?.message || 'Failed connecting to server. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const loadSandboxTester = () => {
    setRefCode('ATB-26-A3F2');
    setEmail('john@example.com');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between" id="welcome-page">
      {/* Background glowing effects */}
      <div className="absolute top-0 left-0 w-full h-[500px] bg-gradient-to-b from-teal-950/20 to-transparent pointer-events-none" />
      
      {/* Top Header */}
      <header className="relative max-w-7xl mx-auto w-full px-6 py-6 flex justify-between items-center z-10">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-teal-600 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg shadow-teal-950/45">
            AT
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-lg">AfriTech Bridge</span>
            <span className="block text-[10px] font-mono tracking-widest text-teal-400 uppercase">Intern-Suite</span>
          </div>
        </div>
        
        <button
          onClick={() => onNavigate('/auth/login')}
          className="px-4 py-2 text-sm bg-slate-900 border border-slate-800 hover:border-slate-700 hover:bg-slate-800 rounded-lg text-slate-200 hover:text-white transition-all shadow-sm"
          id="login-redirect-btn"
        >
          Intern Log In
        </button>
      </header>

      {/* Main Container */}
      <main className="relative max-w-5xl mx-auto w-full px-6 py-12 flex-1 flex flex-col lg:flex-row items-center justify-center gap-12 z-10">
        
        {/* Left Side: Branding / Hook */}
        <div className="flex-1 text-center lg:text-left space-y-6 max-w-lg">
          <div className="inline-flex items-center space-x-2 px-3 py-1 bg-teal-950/50 border border-teal-500/30 text-teal-300 text-xs font-medium rounded-full">
            <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            <span>Admissions Portal Open</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight">
            Bridge the Gap to <br />
            <span className="bg-gradient-to-r from-teal-400 via-emerald-400 to-orange-400 bg-clip-text text-transparent">
              Global Tech Opportunities
            </span>
          </h1>
          <p className="text-slate-400 leading-relaxed text-sm sm:text-base">
            AfriTech Bridge empowers local developers with world-class technical skills, practical workflows, and remote industrial experience in collaboration with industry pioneers.
          </p>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center lg:justify-start gap-4">
            <div className="text-left bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center space-x-3 w-full sm:w-auto">
              <div className="text-teal-400 font-mono text-2xl font-bold">100%</div>
              <div className="text-xs text-slate-400">Remote Mentorship<br />& Collaboration</div>
            </div>
            <div className="text-left bg-slate-900/60 p-4 rounded-xl border border-slate-800 flex items-center space-x-3 w-full sm:w-auto">
              <div className="text-orange-400 font-mono text-2xl font-bold">6+</div>
              <div className="text-xs text-slate-400">Months Intensive<br />Specialization Track</div>
            </div>
          </div>
        </div>

        {/* Right Side: Tracker Card */}
        <div className="w-full max-w-md bg-slate-900/80 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950 flex flex-col space-y-6" id="tracker-card">
          <div>
            <h2 className="text-xl font-bold text-white">Track Application Status</h2>
            <p className="text-xs text-slate-400 mt-1">
              Enter your unique reference code and email listed in your invitation letter.
            </p>
          </div>

          <form onSubmit={handleTrackStatus} className="space-y-4">
            <div>
              <label htmlFor="ref-code" className="block text-xs font-medium text-slate-300 mb-1.5">
                Reference Code
              </label>
              <div className="relative">
                <Clipboard className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="ref-code"
                  type="text"
                  placeholder="e.g. ATB-26-A3F2"
                  value={refCode}
                  onChange={(e) => setRefCode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono"
                />
              </div>
            </div>

            <div>
              <label htmlFor="track-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Search className="absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
                <input
                  id="track-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-2.5 text-sm font-semibold transition-all shadow-lg shadow-teal-950/50 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
              id="track-submit-btn"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Verifying status...</span>
                </>
              ) : (
                <span>Fetch Status Timeline</span>
              )}
            </button>
          </form>

          {/* Sandbox Helper Hint */}
          <div className="text-center">
            <span className="text-[11px] text-slate-500">
              Testing? {' '}
              <button 
                onClick={loadSandboxTester}
                className="text-teal-400 font-medium hover:underline focus:outline-none"
              >
                Auto-fill sandbox criteria
              </button>
            </span>
          </div>

          {/* Status Result View */}
          {statusResult && (
            <div className="pt-4 border-t border-slate-800 animate-fadeIn space-y-4">
              <div className="flex justify-between items-center">
                <div>
                  <h4 className="text-sm font-semibold text-slate-200">{statusResult.full_name}</h4>
                  <p className="text-[11px] font-mono text-slate-500">{statusResult.reference_code}</p>
                </div>
                <span className="px-3 py-1 bg-emerald-950 border border-emerald-500/30 text-emerald-300 text-xs font-semibold rounded-full uppercase">
                  {statusResult.status}
                </span>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-1">
                <div className="text-xs text-slate-400">Assigned Cohort Track:</div>
                <div className="text-sm font-bold text-white">{statusResult.track}</div>
                <div className="text-[11px] text-teal-400/85">{statusResult.cohort_name}</div>
              </div>

              {/* Status Stepper Timeline */}
              <div className="space-y-3.5 pl-2 pt-1">
                {statusResult.timeline.map((step, idx) => (
                  <div key={idx} className="flex space-x-3.5 relative">
                    {idx < statusResult.timeline.length - 1 && (
                      <div className={`absolute left-2.5 top-6 bottom-[-16px] w-[2px] ${step.completed ? 'bg-teal-500' : 'bg-slate-800'}`} />
                    )}
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 z-10 ${
                      step.completed ? 'bg-teal-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}>
                      <Check className="h-3 w-3" />
                    </div>
                    <div>
                      <h5 className={`text-xs font-semibold ${step.active ? 'text-teal-400' : 'text-slate-300'}`}>
                        {step.step}
                      </h5>
                      {step.date && <p className="text-[10px] text-slate-500">{step.date}</p>}
                    </div>
                  </div>
                ))}
              </div>

              <div className="pt-1.5">
                <button
                  onClick={() => onNavigate('/auth/login')}
                  className="w-full bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-white rounded-xl py-2 text-xs font-semibold transition-all border border-slate-800 hover:border-slate-700 cursor-pointer"
                >
                  Retrieve Offer & Login Now
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-6 border-t border-slate-900 bg-slate-950/40 text-center relative z-10 text-xs text-slate-600">
        &copy; {new Date().getFullYear()} AfriTech Bridge. All rights reserved. Professional Intern Lifecycle Platform.
      </footer>
    </div>
  );
};
