"use client";

import { useAuth } from '@/contexts/AuthContext';
import EnhancedLearningInterface from '@/components/student/EnhancedLearningInterface';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';
import { useParams } from 'next/navigation';

const LearningPage = () => {
  const { user, isAuthenticated } = useAuth();
  const isClient = useIsClient();
  const params = useParams();
  const courseId = parseInt(params.id as string);

  if (!isClient) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">Loading your enhanced learning experience...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-red-50 to-orange-50">
        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Access Denied</h2>
          <p className="text-muted-foreground">Please log in to access the enhanced learning interface with all its interactive features.</p>
        </div>
      </div>
    );
  }

  if (!courseId || isNaN(courseId)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-yellow-50 to-orange-50">
        <div className="text-center space-y-4 p-6 bg-white rounded-lg shadow-lg max-w-md">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-8 h-8 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.084 16.5c-.77.833.19 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold">Invalid Course</h2>
          <p className="text-muted-foreground">The course ID is invalid. Please check the URL and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <EnhancedLearningInterface courseId={courseId} />
    </ClientOnly>
  );
};

export default LearningPage;