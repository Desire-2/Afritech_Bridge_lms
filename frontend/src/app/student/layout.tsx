'use client';

import StudentSidebar from '@/components/student/StudentSidebar';
import ErrorBoundary from '@/components/ErrorBoundary';
import { StudentGuard } from '@/components/guards/student-guard';
import NotificationBell from '@/components/notifications/NotificationBell';
import { AlertTriangle } from 'lucide-react';

export default function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentGuard>
      <ErrorBoundary>
        <div className="flex h-screen bg-gray-100 dark:bg-slate-950">
          <StudentSidebar />
          <div className="flex-1 flex flex-col overflow-hidden lg:ml-0">
            {/* Top header with notification bell */}
            <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
              <div className="mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex justify-between h-16 items-center">
                  <div className="flex items-center">
                    {/* Spacer for mobile menu (hamburger is in StudentSidebar) */}
                    <div className="lg:hidden w-10" />
                    <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                      Student Portal
                    </h1>
                  </div>
                  <div className="flex items-center">
                    <NotificationBell />
                  </div>
                </div>
              </div>
            </header>
            <main className="flex-1 overflow-auto">
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
        </div>
      </ErrorBoundary>
    </StudentGuard>
  );
}
