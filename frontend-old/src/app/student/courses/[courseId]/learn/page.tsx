"use client";

import { useAuth } from '@/contexts/AuthContext';
import { useParams } from 'next/navigation';
import LearningInterface from '@/components/student/LearningInterface';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const LearningPage = () => {
  const { user, isAuthenticated } = useAuth();
  const params = useParams();
  const isClient = useIsClient();
  const courseId = params?.courseId as string;

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access course content.</p>
        </div>
      </div>
    );
  }

  if (!courseId) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Course Not Found</h2>
          <p className="text-muted-foreground">Invalid course ID provided.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen bg-background">
        <LearningInterface courseId={parseInt(courseId)} />
      </div>
    </ClientOnly>
  );
};

export default LearningPage;