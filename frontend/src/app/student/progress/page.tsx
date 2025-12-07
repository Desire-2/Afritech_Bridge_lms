"use client";

import { useAuth } from '@/contexts/AuthContext';
import ProgressAnalytics from '@/components/student/ProgressAnalytics';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner from '@/components/LoadingSpinner';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const ProgressPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isClient = useIsClient();

  if (!isClient) {
    return <LoadingSpinner fullScreen text="Loading progress analytics..." />;
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#1e293b] p-6 animate-pulse">
        <div className="mb-8">
          <div className="h-8 bg-slate-700 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-slate-700 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-slate-800 rounded-xl shadow-sm"></div>
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl shadow p-6">
            <div className="h-6 bg-slate-700 rounded mb-4"></div>
            <div className="h-64 bg-slate-700 rounded"></div>
          </div>
          <div className="bg-slate-800 rounded-xl shadow p-6">
            <div className="h-6 bg-slate-700 rounded mb-4"></div>
            <div className="h-64 bg-slate-700 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#1e293b]">
        <div className="text-center bg-slate-800 p-8 rounded-xl shadow-lg border border-slate-700">
          <h2 className="text-xl font-semibold mb-2 text-white">Access Denied</h2>
          <p className="text-slate-400">Please log in to view your progress.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <ErrorBoundary>
        <div className="min-h-screen bg-[#1e293b]">
          <ProgressAnalytics />
        </div>
      </ErrorBoundary>
    </ClientOnly>
  );
};

export default ProgressPage;