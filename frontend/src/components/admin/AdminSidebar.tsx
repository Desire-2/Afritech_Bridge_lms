"use client";

import React, { useContext, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { AuthContext } from '@/contexts/AuthContext';

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
  const authContext = useContext(AuthContext);
  const [isOpen, setIsOpen] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setIsOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Verify admin role
  useEffect(() => {
    if (authContext?.user && authContext.user.role !== 'admin') {
      router.push('/dashboard');
    }
  }, [authContext?.user, router]);

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
        { href: '/admin/courses', label: 'Course Management', icon: '📚', description: 'Manage courses' },
        { href: '/admin/applications', label: 'Applications', icon: '📝', description: 'Review applications' },
        {
          href: '/admin/opportunities',
          label: 'Opportunity Management',
          icon: '🎯',
          description: 'Manage opportunities',
        },
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

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + '/');

  return (
    <>
      {/* Mobile Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 p-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700"
      >
        {isOpen ? '✕' : '☰'}
      </button>

      {/* Overlay for mobile */}
      {isOpen && isMobile && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed
          left-0 top-0
          h-screen
          bg-gray-900 text-gray-100
          overflow-y-auto
          transition-all duration-300 ease-in-out
          z-40
          ${isOpen ? 'w-64' : 'w-0'}
          ${isMobile ? '' : 'w-64'}
        `}
      >
        <div className="p-6">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-white">Afritec Admin</h1>
            <p className="text-xs text-gray-400 mt-1">Learning Management System</p>
          </div>

          {/* User Info */}
          {authContext?.user && (
            <div className="mb-8 pb-8 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center text-white font-semibold">
                  {authContext.user.first_name?.charAt(0) || authContext.user.username.charAt(0)}
                </div>
                <div>
                  <p className="text-sm font-medium">{authContext.user.first_name || authContext.user.username}</p>
                  <p className="text-xs text-gray-400">{authContext.user.role}</p>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Sections */}
          {navSections.map((section) => (
            <div key={section.title} className="mb-8">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <ul className="space-y-2">
                {section.items.map((item) => {
                  const active = isActive(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        onClick={() => isMobile && setIsOpen(false)}
                        className={`
                          flex items-center gap-3 px-4 py-3 rounded-lg
                          transition-all duration-200
                          ${
                            active
                              ? 'bg-blue-600 text-white shadow-lg'
                              : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                          }
                        `}
                      >
                        <span className="text-lg">{item.icon}</span>
                        <div className="flex-1">
                          <p className="text-sm font-medium">{item.label}</p>
                          {item.description && (
                            <p className="text-xs text-gray-400 hidden lg:block">{item.description}</p>
                          )}
                        </div>
                        {item.badge && (
                          <span className="bg-red-600 text-white text-xs font-semibold px-2 py-1 rounded-full">
                            {item.badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}

          {/* Logout Button */}
          <div className="mt-8 pt-8 border-t border-gray-700">
            <button
              onClick={() => {
                authContext?.logout?.();
                router.push('/auth/login');
              }}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-300 hover:bg-red-600 hover:text-white transition-all duration-200"
            >
              <span className="text-lg">🚪</span>
              <span className="text-sm font-medium">Logout</span>
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};

export default AdminSidebar;

