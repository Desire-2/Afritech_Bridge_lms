"use client";

import React from 'react';
import InstructorSidebar from '@/components/instructor/InstructorSidebar';
import { InstructorGuard } from '@/components/guards/instructor-guard';

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstructorGuard>
      <div className="flex min-h-screen bg-slate-100 dark:bg-slate-950">
        <InstructorSidebar />
        <div className="flex-1 flex flex-col">
          <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800">
            <div className="mx-auto px-4 sm:px-6 lg:px-8">
              <div className="flex justify-between h-16">
                <div className="flex items-center">
                  <h1 className="text-xl font-semibold text-slate-900 dark:text-white">
                    Instructor Dashboard
                  </h1>
                </div>
                <div className="flex items-center">
                  {/* Could add notification bell, profile dropdown, etc. here */}
                </div>
              </div>
            </div>
          </header>
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900">
            {children}
          </main>
        </div>
      </div>
    </InstructorGuard>
  );
}

