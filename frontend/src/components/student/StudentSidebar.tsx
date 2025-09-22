"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, GraduationCap, LayoutDashboard, UserCircle, Briefcase, Bookmark } from 'lucide-react';

const StudentSidebar = () => {
  const pathname = usePathname();
  const { user } = useAuth();
  const iconSize = 20;

  const navItems = [
    { href: '/dashboard', label: 'Overview', icon: <LayoutDashboard size={iconSize} /> },
    { href: '/mylearning', label: 'My Learning', icon: <BookOpen size={iconSize} /> },
    { href: '/myprogress', label: 'My Progress', icon: <GraduationCap size={iconSize} /> },
    { href: '/courses', label: 'Browse Courses', icon: <Bookmark size={iconSize} /> },
    { href: '/opportunities', label: 'Opportunities', icon: <Briefcase size={iconSize} /> },
    { href: '/dashboard/profile', label: 'My Profile', icon: <UserCircle size={iconSize} /> },
    { href: '/dashboard/settings', label: 'Settings', icon: <UserCircle size={iconSize} /> },
    { href: '/dashboard/help', label: 'Help & Support', icon: <UserCircle size={iconSize} /> },
    { href: '/dashboard/logout', label: 'Logout', icon: <UserCircle size={iconSize} /> },
    {href: '/forums' , label: 'Forums', icon: <UserCircle size={iconSize} />},
  ];

  return (
    <aside className="w-64 bg-gray-800 text-white p-6 min-h-screen">
      {/* Header Section */}
      <div className="mb-8 px-2">
        <Link href="/dashboard" className="flex items-center gap-2">
          <GraduationCap className="text-indigo-400" size={28} />
          <h2 className="text-xl font-semibold text-gray-100">Student Portal</h2>
        </Link>
      </div>

      {/* User Profile Preview */}
      <div className="mb-6 px-2 py-3 rounded-lg bg-gray-800">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-indigo-500/20 text-indigo-400">
            <UserCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-medium text-gray-100">
              {user?.first_name || 'Student'} {user?.last_name}
            </p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
      </div>

      {/* Navigation Menu */}
      <nav className="flex-1">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = pathname === item.href || 
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${isActive 
                      ? 'bg-indigo-500/20 text-indigo-400' 
                      : 'hover:bg-gray-800/50 hover:text-gray-100 text-gray-300'
                    }`}
                >
                  <span className="text-gray-400">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer/Copyright */}
      <div className="mt-auto pt-6 border-t border-gray-800">
        <p className="text-xs text-gray-500 text-center">
          © {new Date().getFullYear()} Afritec Bridge LMS
        </p>
      </div>
    </aside>
  );
};

export default StudentSidebar;