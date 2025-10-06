"use client";

import { useAuth } from '@/contexts/AuthContext';
import StudentDashboard from '@/components/student/StudentDashboard';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner, { SkeletonDashboard } from '@/components/LoadingSpinner';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const StudentDashboardPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isClient = useIsClient();

  if (!isClient) {
    return <LoadingSpinner fullScreen text="Loading application..." />;
  }

  if (isLoading) {
    return <SkeletonDashboard />;
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <ErrorBoundary>
        <div className="min-h-screen bg-background">
          <StudentDashboard />
        </div>
      </ErrorBoundary>
    </ClientOnly>
  );
};

export default StudentDashboardPage;