/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/AuthContext';
import { Lock, ArrowRight, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

interface ChangePasswordViewProps {
  onNavigate: (path: string) => void;
}

export const ChangePasswordView: React.FC<ChangePasswordViewProps> = ({ onNavigate }) => {
  const { user, updateMustChangePasswordState } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      setError('Please fill in all the required password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await api.changePassword(newPassword);
      if (response.success) {
        setSuccess(true);
        updateMustChangePasswordState(false);
        setTimeout(() => {
          onNavigate('/intern/dashboard');
        }, 1500);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update password. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative" id="change-pass-page">
      <div className="absolute top-1/4 left-1/3 w-96 h-96 bg-teal-950/15 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950 flex flex-col space-y-6 z-10 font-sans">
        
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-orange-950/50 border border-orange-500/30 flex items-center justify-center text-orange-400 mb-4 animate-pulse">
            <Lock className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            {user?.must_change_password ? 'Initialize Password' : 'Change Your Password'}
          </h1>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed text-center">
            {user?.must_change_password 
              ? 'To protect your intern profile, you are required to change your temporary offer letter password now.' 
              : 'Keep your workspace secure by updating your password.'}
          </p>
        </div>

        {success ? (
          <div className="p-4 bg-emerald-950/40 border border-emerald-500/20 rounded-xl flex flex-col items-center space-y-3.5 text-center text-emerald-300 animate-fadeIn">
            <CheckCircle2 className="h-10 w-10 text-emerald-400" />
            <div>
              <p className="text-sm font-semibold text-white">Password Changed Successfully</p>
              <p className="text-xs text-slate-400 mt-1">Redirecting you to dashboard...</p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="curr-pass" className="block text-xs font-medium text-slate-300 mb-1.5">
                Current Password
              </label>
              <input
                id="curr-pass"
                type="password"
                placeholder="••••••••"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div className="border-t border-slate-800/60 pt-3" />

            <div>
              <label htmlFor="new-pass" className="block text-xs font-medium text-slate-300 mb-1.5">
                New Password (min 8 chars)
              </label>
              <input
                id="new-pass"
                type="password"
                placeholder="••••••••"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>

            <div>
              <label htmlFor="new-pass-confirm" className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <input
                id="new-pass-confirm"
                type="password"
                placeholder="••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-teal-500 font-mono"
              />
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
              className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-teal-950/50 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Confirm New Security Code</span>
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </button>
          </form>
        )}

        {!user?.must_change_password && !success && (
          <div className="text-center">
            <button
              type="button"
              onClick={() => onNavigate('/intern/dashboard')}
              className="text-xs text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
            >
              Cancel and Return
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
