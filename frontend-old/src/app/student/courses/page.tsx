"use client";

import { useAuth } from '@/contexts/AuthContext';
import CourseBrowse from '@/components/student/CourseEnrollment';
import ErrorBoundary from '@/components/ErrorBoundary';
import LoadingSpinner, { SkeletonCard } from '@/components/LoadingSpinner';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const CourseBrowserPage = () => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const isClient = useIsClient();

  if (!isClient) {
    return <LoadingSpinner fullScreen text="Loading course browser..." />;
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="mb-6">
          <div className="h-8 bg-gray-300 rounded w-1/3 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-300 rounded w-1/2 animate-pulse"></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonCard key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to browse courses.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <ErrorBoundary>
        <div className="min-h-screen bg-background p-6">
          <CourseBrowse />
        </div>
      </ErrorBoundary>
    </ClientOnly>
  );
};

export default CourseBrowserPage;
