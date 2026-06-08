'use client';

import React from 'react';
import { AdminGuard } from '@/components/guards/AdminGuard';
import AdminSidebar from '@/components/admin/AdminSidebar';
import { SidebarProvider, useSidebar } from '@/contexts/SidebarContext';
import NotificationBell from '@/components/notifications/NotificationBell';

function AdminLayoutContent({
  children,
}: {
  children: React.ReactNode;
}) {
  const { isOpen, isMobile, isCollapsed, toggleSidebar, toggleCollapse } = useSidebar();

  const sidebarWidth = isCollapsed && !isMobile ? 'ml-16' : 'ml-64';
  const desktopSidebarWidth = isCollapsed ? 'lg:ml-16' : 'lg:ml-64';

  return (
    <div className="min-h-screen bg-gray-100">
      <AdminSidebar />
      <div className={`
        flex flex-col min-h-screen
        transition-all duration-300 ease-in-out
        ${isOpen && !isMobile ? sidebarWidth : 'ml-0'}
        ${desktopSidebarWidth}
      `}>
        {/* Sticky header with mobile menu button */}
        <header className="sticky top-0 z-10 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-sm border-b border-slate-200 dark:border-slate-800">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16 items-center">
              <div className="flex items-center">
                {/* Mobile hamburger */}
                <button
                  onClick={toggleSidebar}
                  className="p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 lg:hidden mr-3 transition-colors"
                  aria-label="Toggle mobile menu"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                </button>
                {/* Desktop collapse toggle */}
                <button
                  onClick={toggleCollapse}
                  className="hidden lg:flex p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 mr-3 transition-colors"
                  aria-label="Toggle sidebar collapse"
                  title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                >
                  <svg className={`w-5 h-5 transition-transform duration-300 ${isCollapsed ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
                  </svg>
                </button>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Admin Panel
                </h1>
              </div>
              <div className="flex items-center">
                <NotificationBell />
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <SidebarProvider>
        <AdminLayoutContent>
          {children}
        </AdminLayoutContent>
      </SidebarProvider>
    </AdminGuard>
  );
}