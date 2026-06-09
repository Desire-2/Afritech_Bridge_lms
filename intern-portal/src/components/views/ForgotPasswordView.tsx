/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { Mail, ArrowLeft, Send, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';

interface ForgotPasswordViewProps {
  onNavigate: (path: string) => void;
}

export const ForgotPasswordView: React.FC<ForgotPasswordViewProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setError('Please fill in your active email address.');
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await api.forgotPassword(email);
      // Auth endpoints don't wrap in { success: true } — they return { message } directly
      // If fetchJson didn't throw (non-2xx), the request succeeded
      setSuccess(response.message || 'If an account exists with this email, a password reset link has been sent.');
    } catch (err: any) {
      setError(err?.message || 'Server error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative" id="forgot-password-page">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950 flex flex-col space-y-6">
        
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-teal-950 border border-teal-800 flex items-center justify-center text-teal-400 mb-4 animate-pulse">
            <Mail className="h-5.5 w-5.5" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Recover Password</h1>
          <p className="text-xs text-slate-400 mt-1">
            We will dispatch a secure link to restore your dashboard credentials.
          </p>
        </div>

        {success ? (
          <div className="space-y-4 text-center animate-fadeIn">
            <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex flex-col items-center space-y-2 text-emerald-300">
              <CheckCircle2 className="h-8 w-8 text-emerald-400" />
              <p className="text-sm font-semibold">Instructions Dispatched</p>
              <p className="text-xs text-slate-400 text-center leading-relaxed">
                {success}
              </p>
            </div>
            
            <button
              onClick={() => onNavigate('/auth/login')}
              className="w-full bg-slate-950 hover:bg-slate-850 text-slate-300 hover:text-white rounded-xl py-2.5 text-xs font-semibold border border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to login</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="forgot-email" className="block text-xs font-medium text-slate-300 mb-1.5">
                Your Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
                <input
                  id="forgot-email"
                  type="email"
                  placeholder="john@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="p-3.5 bg-rose-950/40 border border-rose-500/20 rounded-xl flex items-start space-x-2 text-rose-300 text-xs animate-fadeIn">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-rose-400" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-teal-950/50 flex justify-center items-center gap-2 cursor-pointer"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Send className="h-4.5 w-4.5" />
                  <span>Request Reset Link</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/auth/login')}
              className="w-full bg-slate-950 hover:bg-slate-850 text-slate-400 hover:text-slate-300 rounded-xl py-2.5 text-xs font-semibold border border-slate-800/80 hover:border-slate-800 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <ArrowLeft className="h-4 w-4" />
              <span>Back to Login</span>
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
