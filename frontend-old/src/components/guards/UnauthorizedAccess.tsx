'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

interface UnauthorizedAccessProps {
  requiredRole: 'admin' | 'instructor' | 'student';
  pageName?: string;
}

export function UnauthorizedAccess({ requiredRole, pageName = 'page' }: UnauthorizedAccessProps) {
  const { user } = useAuth();

  const getRoleName = (role: string) => {
    switch (role) {
      case 'admin': return 'Administrator';
      case 'instructor': return 'Instructor';
      case 'student': return 'Student';
      default: return 'User';
    }
  };

  const getRoleDashboard = (role: string) => {
    switch (role) {
      case 'admin': return '/admin/dashboard';
      case 'instructor': return '/instructor/dashboard';
      case 'student': return '/dashboard';
      default: return '/dashboard';
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'from-purple-500 to-purple-600';
      case 'instructor': return 'from-sky-500 to-blue-600';
      case 'student': return 'from-green-500 to-green-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800 px-4">
      <div className="max-w-md w-full text-center space-y-6">
        {/* Icon */}
        <div className="w-24 h-24 mx-auto rounded-full bg-red-500/20 flex items-center justify-center">
          <svg className="w-12 h-12 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
        </div>

        {/* Error Message */}
        <div className="space-y-3">
          <h1 className="text-4xl font-bold text-red-600 dark:text-red-400">Access Denied</h1>
          <h2 className="text-xl font-semibold text-slate-800 dark:text-slate-200">
            Unauthorized Access Attempt
          </h2>
          <div className="text-slate-600 dark:text-slate-400 space-y-2">
            <p>
              This {pageName} requires <span className="font-semibold text-slate-800 dark:text-slate-200">{getRoleName(requiredRole)}</span> privileges.
            </p>
            <p>
              You are currently logged in as: <span className="font-semibold text-slate-800 dark:text-slate-200">{getRoleName(user?.role || 'unknown')}</span>
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-3">
          <Link 
            href={getRoleDashboard(user?.role || 'student')}
            className={`inline-flex items-center justify-center w-full px-6 py-3 text-white font-medium rounded-lg shadow-lg transition-all duration-200 bg-gradient-to-r ${getRoleColor(user?.role || 'student')} hover:shadow-xl transform hover:-translate-y-0.5`}
          >
            Return to My Dashboard
          </Link>
          
          <Link 
            href="/auth/login"
            className="inline-flex items-center justify-center w-full px-6 py-3 text-slate-700 dark:text-slate-300 font-medium rounded-lg border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors duration-200"
          >
            Login with Different Account
          </Link>
        </div>

        {/* Additional Info */}
        <div className="text-sm text-slate-500 dark:text-slate-400 mt-6">
          <p>
            If you believe you should have access to this {pageName}, please contact your administrator.
          </p>
        </div>
      </div>
    </div>
  );
}