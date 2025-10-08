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
      <div className="p-6 animate-pulse">
        <div className="mb-8">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-2"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2"></div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-300 rounded mb-4"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <div className="h-6 bg-gray-300 rounded mb-4"></div>
            <div className="h-64 bg-gray-300 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to view your progress.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <ErrorBoundary>
        <div className="min-h-screen bg-background">
          <ProgressAnalytics />
        </div>
      </ErrorBoundary>
    </ClientOnly>
  );
};

export default ProgressPage;