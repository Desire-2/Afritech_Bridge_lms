"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  href: string;
  label: string;
  icon: JSX.Element;
  shortLabel?: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const InstructorSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isOpen, isMobile, isCollapsed, closeSidebar } = useSidebar();

  const navSections: NavSection[] = [
    {
      title: 'Dashboard',
      items: [
        { href: '/instructor/dashboard', label: 'Overview', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 21v-4a2 2 0 012-2h4a2 2 0 012 2v4" /></svg> },
      ],
    },
    {
      title: 'Teaching',
      items: [
        { href: '/instructor/courses', label: 'My Courses', shortLabel: 'Courses', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" /></svg> },
        { href: '/instructor/applications', label: 'Applications', shortLabel: 'Apps', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg> },
        { href: '/instructor/grading', label: 'Grading', shortLabel: 'Grade', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" /></svg> },
        { href: '/instructor/assignments', label: 'Assignments', shortLabel: 'Tasks', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" /></svg> },
        { href: '/instructor/quizzes', label: 'Quizzes', shortLabel: 'Quiz', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
      ],
    },
    {
      title: 'Management',
      items: [
        { href: '/instructor/payments', label: 'Payments', shortLabel: 'Pay', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" /></svg> },
        { href: '/instructor/students', label: 'Students', shortLabel: 'Students', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" /></svg> },
        { href: '/instructor/internships', label: 'Internships', shortLabel: 'Interns', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg> },
      ],
    },
    {
      title: 'Communication',
      items: [
        { href: '/instructor/announcements', label: 'Announcements', shortLabel: 'News', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg> },
        { href: '/instructor/forums', label: 'Forums', shortLabel: 'Forums', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg> },
      ],
    },
    {
      title: 'Account',
      items: [
        { href: '/instructor/profile', label: 'My Profile', shortLabel: 'Profile', icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg> },
      ],
    },
    {
      title: 'Settings',
      items: [
        { 
          href: '/instructor/settings', 
          label: 'Settings',
          shortLabel: 'Settings',
          icon: <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
        },
      ],
    },
  ];

  const sidebarWidth = isCollapsed && !isMobile ? 'w-16' : 'w-64';
  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside className={`
        fixed left-0 top-0 ${sidebarWidth} h-screen
        bg-gradient-to-b from-slate-800 to-slate-900 text-white
        overflow-y-auto shadow-lg
        transition-all duration-300 ease-in-out
        z-40
        ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        lg:translate-x-0
      `}>
        {/* Header */}
        <div className={`${isCollapsed && !isMobile ? 'p-4' : 'p-5 lg:p-6'}`}>
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

          {/* Logo */}
          {isCollapsed && !isMobile ? (
            <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">I</span>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-4">
              <div className="w-9 h-9 shrink-0 rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-xs">I</span>
              </div>
              <div>
                <h2 className="text-xl font-semibold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
                  Instructor
                </h2>
                <p className="text-[10px] text-slate-400 mt-0.5">Teaching Portal</p>
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent" />
        </div>

        {/* Navigation */}
        <nav className={`${isCollapsed && !isMobile ? 'px-2' : 'px-3 lg:px-4'} flex-1 pb-4`}>
          {navSections.map((section) => (
            <div key={section.title} className={`${isCollapsed && !isMobile ? 'mb-6' : 'mb-8'}`}>
              {!isCollapsed || isMobile ? (
                <h3 className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-3 px-1">
                  {section.title}
                </h3>
              ) : (
                <div className="flex justify-center mb-3">
                  <div className="w-6 h-px bg-white/10" />
                </div>
              )}
              <ul className="space-y-1">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => isMobile && closeSidebar()}
                        className={`
                          flex items-center gap-3 px-3 py-2.5 rounded-lg
                          transition-all duration-200
                          relative group
                          ${isCollapsed && !isMobile ? 'justify-center' : ''}
                          ${
                            active
                              ? 'bg-sky-500/20 text-sky-400 border-l-2 border-sky-400 shadow-sm'
                              : 'text-slate-300 hover:bg-white/5 hover:text-white'
                          }
                        `}
                        title={isCollapsed && !isMobile ? item.label : undefined}
                      >
                        <span className="shrink-0">{item.icon}</span>
                        {(!isCollapsed || isMobile) && (
                          <span className="ml-2 truncate text-sm font-medium">
                            {item.label}
                          </span>
                        )}
                        {item.badge && (
                          <span className="bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-auto">
                            {item.badge}
                          </span>
                        )}
                        {/* Collapsed tooltip */}
                        {isCollapsed && !isMobile && (
                          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                            <p className="font-medium">{item.label}</p>
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>

        {/* User info at bottom */}
        <div className={`border-t border-white/10 ${isCollapsed && !isMobile ? 'p-3' : 'p-4 lg:p-6'}`}>
          {(!isCollapsed || isMobile) ? (
            <div className="p-3 bg-white/5 rounded-lg border border-white/10">
              <p className="text-xs text-slate-400 mb-1">Logged in as:</p>
              <p className="font-medium text-white text-sm truncate">
                {user?.first_name && user?.last_name
                  ? `${user.first_name} ${user.last_name}`
                  : user?.username || 'Instructor'}
              </p>
              <div className="flex justify-between items-center mt-2 pt-2 border-t border-white/10">
                <p className="text-[11px] text-sky-400 font-medium">Instructor</p>
                <button
                  onClick={() => { logout?.(); router.push('/auth/login'); }}
                  className="text-[11px] text-slate-400 hover:text-white transition-colors px-2 py-1 rounded hover:bg-white/10"
                >
                  Sign Out
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center relative group">
              <div className="w-9 h-9 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white font-semibold text-sm">
                {user?.first_name?.charAt(0) || user?.username?.charAt(0) || 'I'}
              </div>
              {/* Collapsed tooltip */}
              <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                <p className="font-medium">{user?.first_name || user?.username || 'Instructor'}</p>
                <p className="text-slate-400 text-[10px]">Instructor</p>
                <button
                  onClick={() => { logout?.(); router.push('/auth/login'); }}
                  className="mt-1.5 text-[10px] text-red-400 hover:text-red-300 transition-colors"
                >
                  Sign Out
                </button>
              </div>
              <button
                onClick={() => { logout?.(); router.push('/auth/login'); }}
                className="mt-2 text-slate-400 hover:text-white transition-colors p-1 rounded hover:bg-white/10"
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
