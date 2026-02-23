"use client";

import React from 'react';
import InstructorSidebar from '@/components/instructor/InstructorSidebar';
import { InstructorGuard } from '@/components/guards/instructor-guard';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import NotificationBell from '@/components/notifications/NotificationBell';

function InstructorLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOpen, isMobile, isCollapsed, toggleSidebar, toggleCollapse } = useSidebar();

  const sidebarWidth = isCollapsed && !isMobile ? 'ml-16' : 'ml-64';
  const desktopSidebarWidth = isCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-950">
      <InstructorSidebar />
      <div className={`flex flex-col min-h-screen transition-all duration-300 ease-in-out ${
        isOpen && !isMobile ? sidebarWidth : 'ml-0'
      } ${desktopSidebarWidth}`}>
        <header className="bg-white dark:bg-slate-900 shadow-sm border-b border-slate-200 dark:border-slate-800 sticky top-0 z-10">
          <div className="mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                {/* Mobile menu button */}
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden mr-3 transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                
                {/* Desktop collapse button */}
                <button
                  onClick={toggleCollapse}
                  className="hidden lg:flex p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 mr-3 transition-colors"
                  aria-label="Toggle sidebar"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                
                <h1 className="text-lg sm:text-xl font-semibold text-slate-900 dark:text-white">
                  Instructor Dashboard
                </h1>
              </div>
              <div className="flex items-center">
                {/* Notification bell and profile actions */}
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 bg-slate-50 dark:bg-slate-900 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function InstructorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <InstructorGuard>
      <SidebarProvider>
        <InstructorLayoutContent>
          {children}
        </InstructorLayoutContent>
      </SidebarProvider>
    </InstructorGuard>
  );
}

