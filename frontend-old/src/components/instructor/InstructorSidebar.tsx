"use client";

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const InstructorSidebar = () => {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const navItems = [
    { href: '/instructor/dashboard', label: 'Overview' },
    { href: '/instructor/courses', label: 'My Courses' },
    { href: '/instructor/grading', label: 'Grading' },
    { href: '/instructor/announcements', label: 'Announcements' },
    { href: '/instructor/students', label: 'Students' },
    { href: '/instructor/assignments', label: 'Assignments' },
    { href: '/instructor/quizzes', label: 'Quizzes' },
    { href: '/instructor/profile', label: 'My Profile' },
  ];

  return (
    <aside className="w-64 bg-gradient-to-b from-slate-800 to-slate-900 text-white p-6 min-h-screen shadow-lg">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
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
          <h2 className="text-2xl font-semibold bg-gradient-to-r from-sky-400 to-blue-500 bg-clip-text text-transparent">
            Instructor
          </h2>
        </div>
        <div className="h-px bg-gradient-to-r from-transparent via-slate-600 to-transparent my-4"></div>
      </div>
      <nav>
        <ul className="space-y-1">
          {navItems.map((item) => (
            <li key={item.href}>
              <Link href={item.href} legacyBehavior>
                <a
                  className={`flex items-center py-2.5 px-4 rounded-lg transition-all duration-200 ${
                    pathname === item.href 
                      ? 'bg-sky-500/20 text-sky-400 border-l-2 border-sky-400' 
                      : 'text-slate-300 hover:bg-white/5 hover:text-white hover:translate-x-1'
                  }`}
                >
                  {item.label}
                </a>
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      
      <div className="absolute bottom-8 left-0 w-64 px-6">
        <div className="p-4 bg-white/5 rounded-lg border border-white/10">
          <p className="text-sm text-slate-400">Logged in as:</p>
          <p className="font-medium text-white">
            {user?.first_name && user?.last_name 
              ? `${user.first_name} ${user.last_name}` 
              : user?.username || 'Instructor'}
          </p>
          <div className="flex justify-between items-center">
            <p className="text-xs text-sky-400">Instructor</p>
            <button 
              onClick={logout} 
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              Sign Out
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default InstructorSidebar;

