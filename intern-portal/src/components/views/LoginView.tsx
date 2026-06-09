/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { Mail, Lock, Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';

interface LoginViewProps {
  onNavigate: (path: string) => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onNavigate }) => {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      setError('Please provide your email address and password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(email, password);
      // AuthProvider handles updating the session state
      // The router in App.tsx will redirect appropriately
      onNavigate('/intern/dashboard');
    } catch (err: any) {
      setError(err?.message || 'Invalid email or password. Please verify credentials.');
    } finally {
      setLoading(false);
    }
  };

  const autofillIntern = () => {
    setEmail('john@example.com');
    setPassword('intern2026!');
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-center items-center px-6 relative" id="login-page">
      {/* Visual background lights */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-900/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-950/10 rounded-full blur-3xl pointer-events-none" />

      {/* Main card */}
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 sm:p-8 shadow-2xl shadow-slate-950 flex flex-col space-y-6 z-10">
        
        {/* LOGO Header */}
        <div className="text-center flex flex-col items-center">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-teal-600 to-orange-500 flex items-center justify-center font-bold text-white shadow-lg text-xl mb-4">
            AT
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">Welcome Back, Intern</h1>
          <p className="text-xs text-slate-400 mt-1">
            Access your AfriTech Bridge dashboard and tasks.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="login-email" className="block text-xs font-medium text-slate-300 mb-1.5">
              Email Address / Username
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                id="login-email"
                type="email"
                placeholder="john@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label htmlFor="login-password" className="block text-xs font-medium text-slate-300">
                Password
              </label>
              <button
                type="button"
                onClick={() => onNavigate('/auth/forgot-password')}
                className="text-xs text-teal-400 hover:text-teal-300 hover:underline cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-500" />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-10 pr-12 py-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-3.5 text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
              </button>
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
            className="w-full bg-teal-600 hover:bg-teal-500 text-white rounded-xl py-3 text-sm font-semibold transition-all shadow-lg shadow-teal-950/50 flex justify-center items-center gap-2 cursor-pointer disabled:opacity-50"
            id="login-submit-btn"
          >
            {loading ? (
              <>
                <Loader2 className="h-4.5 w-4.5 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : (
              <span>Sign In to Portal</span>
            )}
          </button>
        </form>

        {/* Testing helper tool */}
        <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 flex flex-col space-y-1.5 text-center">
          <span className="text-[11px] text-slate-400">
            Evaluating this interface offline or with Render slow starts?
          </span>
          <button
            type="button"
            onClick={autofillIntern}
            className="text-xs bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-teal-400 font-semibold py-1.5 rounded-lg transition-all cursor-pointer"
          >
            Use Sandbox Intern Demo Account
          </button>
        </div>

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onNavigate('/intern')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-all cursor-pointer"
          >
            &larr; Return to Status Tracker
          </button>
        </div>
      </div>
    </div>
  );
};
