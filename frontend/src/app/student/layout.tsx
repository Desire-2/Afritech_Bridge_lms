'use client';

import StudentSidebar from '@/components/student/StudentSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { StudentGuard } from '@/components/guards/student-guard';
import { AlertTriangle } from 'lucide-react';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentGuard>
      <ErrorBoundary>
        <div className="flex h-screen bg-gray-100">
          <StudentSidebar />
          <main className="flex-1 overflow-auto lg:ml-0">
            <div className="lg:hidden h-16"></div> {/* Space for mobile menu button */}
            <ErrorBoundary fallback={
              <div className="p-8 text-center">
                <AlertTriangle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Content Error</h2>
                <p className="text-gray-600">There was an error loading this page content.</p>
              </div>
            }>
              {children}
            </ErrorBoundary>
          </main>
        </div>
      </ErrorBoundary>
    </StudentGuard>
  );
}
