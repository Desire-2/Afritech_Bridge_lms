"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
  shortLabel?: string;
}

const InstructorSidebar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const { isOpen, isMobile, isCollapsed, closeSidebar } = useSidebar();
  
  const navItems: NavItem[] = [
    { 
      href: '/instructor/dashboard', 
      label: 'Overview',
      shortLabel: 'Home',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" /></svg>
    },
    { 
      href: '/instructor/courses', 
      label: 'My Courses',
      shortLabel: 'Courses',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg>
    },
    { 
      href: '/instructor/applications', 
      label: 'Applications',
      shortLabel: 'Apps',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
    },
    {
      href: '/instructor/payments',
      label: 'Payments',
      shortLabel: 'Pay',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg>
    },
    { 
      href: '/instructor/grading', 
      label: 'Grading',
      shortLabel: 'Grade',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg>
    },
    { 
      href: '/instructor/announcements', 
      label: 'Announcements',
      shortLabel: 'News',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>
    },
    { 
      href: '/instructor/students', 
      label: 'Students',
      shortLabel: 'Students',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg>
    },
    { 
      href: '/instructor/forums', 
      label: 'Forums',
      shortLabel: 'Forums',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
    },
    { 
      href: '/instructor/assignments', 
      label: 'Assignments',
      shortLabel: 'Tasks',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg>
    },
    { 
      href: '/instructor/quizzes', 
      label: 'Quizzes',
      shortLabel: 'Quiz',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
    },
    { 
      href: '/instructor/profile', 
      label: 'My Profile',
      shortLabel: 'Profile',
      icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
    },
  ];

  const sidebarWidth = isCollapsed && !isMobile ? 'w-16' : 'w-64';

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-20 lg:hidden"
          onClick={closeSidebar}
        />
      )}
      
      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 ${sidebarWidth} bg-gradient-to-b from-slate-800 to-slate-900 text-white h-full overflow-y-auto shadow-lg z-30 transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Header */}
        <div className="p-4 lg:p-6">
          {/* Mobile close button */}
          {isMobile && (
            <button
              onClick={closeSidebar}
              className="absolute top-4 right-4 lg:hidden p-2 rounded-lg hover:bg-white/10 transition-colors"
              aria-label="Close sidebar"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
          
          {/* Logo and Title */}
          <div className="flex items-center gap-3 mb-4">
            <div className="shrink-0">
              <svg 
                className="w-8 h-8 text-sky-400"
                viewBox="0 0 64 64" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18ZM13.046 18L19.9742 42H6.11783L13.046 18ZM32 48L38.9282 72H25.0718L32 48Z" 
                  fill="currentColor"
                />
              </svg>
            </div>
            {(!isCollapsed || isMobile) && (
              <h2 className="text-xl lg:text-2xl font-semibold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                Instructor
              </h2>
            )}
          </div>
          
          {(!isCollapsed || isMobile) && (
            <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent"></div>
          )}
        </div>

        {/* Navigation */}
        <nav className="px-3 lg:px-4 flex-1">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => isMobile && closeSidebar()}
                  className={`group flex items-center px-3 py-3 rounded-lg transition-all duration-200 ${
                    pathname === item.href 
                      ? 'bg-sky-500/20 text-sky-400 border-l-2 border-sky-400' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white hover:translate-x-1'
                  }`}
                  title={isCollapsed && !isMobile ? item.label : undefined}
                >
                  <div className="shrink-0 mr-3">
                    {item.icon}
                  </div>
                  {(!isCollapsed || isMobile) && (
                    <span className="truncate font-medium">
                      {item.label}
                    </span>
                  )}
                  {isCollapsed && !isMobile && (
                    <div className="absolute left-16 bg-slate-800 text-white px-2 py-1 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50">
                      {item.label}
                    </div>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        
        {/* User info at bottom */}
        <div className={`p-4 lg:p-6 ${isCollapsed && !isMobile ? 'px-2' : ''}`}>
          {(!isCollapsed || isMobile) ? (
            <div className="p-4 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-slate-400 mb-1">Logged in as:</p>
              <p className="font-medium text-white text-sm truncate mb-2">
                {user?.first_name && user?.last_name 
                  ? `${user.first_name} ${user.last_name}` 
                  : user?.username || 'Instructor'}
              </p>
              <div className="flex justify-between items-center">
                <p className="text-xs text-sky-400">Instructor</p>
                <button 
                  onClick={logout} 
                  className="text-xs text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 bg-sky-500/20 rounded-full flex items-center justify-center mb-2">
                <span className="text-sky-400 text-sm font-semibold">
                  {user?.first_name?.charAt(0) || user?.username?.charAt(0) || 'I'}
                </span>
              </div>
              <button 
                onClick={logout} 
                className="text-xs text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
                title="Sign Out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
};

export default InstructorSidebar;

