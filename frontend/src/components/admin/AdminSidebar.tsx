"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { useSidebar } from '@/contexts/SidebarContext';

interface NavItem {
  href: string;
  label: string;
  icon: string;
  description?: string;
  badge?: number;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const AdminSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isOpen, isMobile, isCollapsed, closeSidebar } = useSidebar();

  const navSections: NavSection[] = [
    {
      title: 'Main',
      items: [
        { href: '/admin', label: 'Dashboard', icon: '📊', description: 'Overview & Statistics' },
      ],
    },
    {
      title: 'Management',
      items: [
        { href: '/admin/users', label: 'User Management', icon: '👥', description: 'Manage users' },
        { href: '/admin/students', label: 'Student Management', icon: '🎓', description: 'Manage students & enrollments' },
        { href: '/admin/courses', label: 'Course Management', icon: '📚', description: 'Manage courses' },
        { href: '/admin/forums', label: 'Forum Management', icon: '💬', description: 'Manage forums & moderation' },
        { href: '/admin/applications', label: 'Applications', icon: '📝', description: 'Review applications' },
        { href: '/admin/payments', label: 'Payments', icon: '💰', description: 'Track & manage payments' },
        {
          href: '/admin/opportunities',
          label: 'Opportunity Management',
          icon: '🎯',
          description: 'Manage opportunities',
        },
      ],
    },
    {
      title: 'Internships',
      items: [
        { href: '/admin/internships', label: 'Dashboard', icon: '📋', description: 'Overview & stats' },
        { href: '/admin/internships/applications', label: 'Applications', icon: '📝', description: 'Review applicants' },
        { href: '/admin/internships/tracks', label: 'Tracks', icon: '🛤️', description: 'Manage internship tracks' },
        { href: '/admin/internships/interns', label: 'Interns', icon: '🎓', description: 'Manage accepted interns' },
        { href: '/admin/internships/cohorts', label: 'Cohorts', icon: '👥', description: 'Manage cohorts' },
      ],
    },
    {
      title: 'Analytics & Reports',
      items: [
        { href: '/admin/analytics', label: 'Analytics', icon: '📈', description: 'System analytics' },
        { href: '/admin/moderation', label: 'Content Moderation', icon: '⚖️', description: 'Moderate content' },
      ],
    },
    {
      title: 'System',
      items: [
        { href: '/admin/settings', label: 'Settings', icon: '⚙️', description: 'System settings' },
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
          onClick={closeSidebar}
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed left-0 top-0 ${sidebarWidth} h-screen
          bg-[#0d1b2a] text-gray-100
          overflow-y-auto
          transition-all duration-300 ease-in-out
          z-40
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          lg:translate-x-0
        `}
      >
        <div className={`${isCollapsed && !isMobile ? 'p-3' : 'p-6'}`}>
          {/* Logo */}
          <div className={`${isCollapsed && !isMobile ? 'mb-6 text-center' : 'mb-8'}`}>
            {isCollapsed && !isMobile ? (
              <div className="w-10 h-10 mx-auto rounded-full bg-gradient-to-br from-sky-400 to-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-sm">AB</span>
              </div>
            ) : (
              <>
                <h1 className="text-xl font-bold text-white">Afritec Admin</h1>
                <p className="text-[10px] text-gray-400 mt-0.5">Learning Management System</p>
              </>
            )}
          </div>

          {/* User Info */}
          {user && (
            <div className={`mb-6 pb-6 border-b border-white/10 ${isCollapsed && !isMobile ? 'text-center' : ''}`}>
              {isCollapsed && !isMobile ? (
                <div className="relative group">
                  <div className="w-9 h-9 mx-auto rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white font-semibold text-sm">
                    {user.first_name?.charAt(0) || user.username?.charAt(0)}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                    <p className="font-medium">{user.first_name || user.username}</p>
                    <p className="text-gray-400">{user.role}</p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 shrink-0 rounded-full bg-white/15 border border-white/20 flex items-center justify-center text-white font-semibold">
                    {user.first_name?.charAt(0) || user.username?.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{user.first_name || user.username}</p>
                    <p className="text-xs text-gray-400">{user.role}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Navigation Sections */}
          {navSections.map((section) => (
            <div key={section.title} className={`${isCollapsed && !isMobile ? 'mb-6' : 'mb-8'}`}>
              {!isCollapsed || isMobile ? (
                <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-3 px-1">
                  {section.title}
                </h3>
              ) : (
                <div className="flex justify-center mb-3">
                  <div className="w-6 h-px bg-white/10"></div>
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
                              ? 'bg-white/15 text-white shadow-sm border border-white/10'
                              : 'text-gray-300 hover:bg-white/8 hover:text-white'
                          }
                        `}
                        title={isCollapsed && !isMobile ? item.label : undefined}
                      >
                        <span className="text-lg shrink-0">{item.icon}</span>
                        {(!isCollapsed || isMobile) && (
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium truncate">{item.label}</p>
                            {item.description && (
                              <p className="text-[11px] text-gray-400 truncate hidden lg:block">{item.description}</p>
                            )}
                          </div>
                        )}
                        {item.badge && (
                          <span className="bg-red-600 text-white text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0">
                            {item.badge}
                          </span>
                        )}
                        {/* Collapsed tooltip */}
                        {isCollapsed && !isMobile && (
                          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-slate-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                            <p className="font-medium">{item.label}</p>
                            {item.description && <p className="text-gray-400 text-[10px]">{item.description}</p>}
                          </div>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Logout Button */}
          <div className="mt-6 pt-6 border-t border-white/10">
            {isCollapsed && !isMobile ? (                <button
                  onClick={() => { logout?.(); router.push('/auth/login'); }}
                  className="w-full flex justify-center items-center px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200 group relative"
                title="Logout"
              >
                <span className="text-lg">🚪</span>
                <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-red-800 text-white text-xs px-3 py-2 rounded-lg shadow-lg whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 pointer-events-none z-50">
                  Logout
                </div>
              </button>
            ) : (                <button
                  onClick={() => { logout?.(); router.push('/auth/login'); }}
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-300 hover:bg-red-600/20 hover:text-red-400 transition-all duration-200"
              >
                <span className="text-lg">🚪</span>
                <span className="text-sm font-medium">Logout</span>
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

