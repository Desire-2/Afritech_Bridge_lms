"use client";

import { useAuth } from '@/contexts/AuthContext';
import StudentDashboard from '@/components/student/StudentDashboard';
import { ClientOnly, useIsClient } from '@/lib/hydration-helper';

const StudentHomePage = () => {
  const { user, isAuthenticated } = useAuth();
  const isClient = useIsClient();

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
          <p className="text-muted-foreground">Please log in to access your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <ClientOnly>
      <div className="min-h-screen bg-background">
        <StudentDashboard />
      </div>
    </ClientOnly>
  );
};

export default StudentHomePage;