"use client";

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { BookOpen, GraduationCap, LayoutDashboard, UserCircle, Briefcase, Award, HelpCircle, MessageSquare, Menu, X, LogOut, FileText, AlertTriangle } from 'lucide-react';

const StudentSidebar = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const iconSize = 20;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect screen size
  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth >= 1024) {
        setIsMobileMenuOpen(false);
      }
    };

    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Close mobile menu when route changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [pathname]);

  const navSections = [
    {
      title: 'MAIN',
      items: [
        { 
          href: '/student/dashboard', 
          label: 'Dashboard', 
          description: 'Overview & Statistics',
          icon: <LayoutDashboard size={iconSize} /> 
        },
      ]
    },
    {
      title: 'LEARNING',
      items: [
        { 
          href: '/student/mylearning', 
          label: 'My Learning', 
          description: 'Active courses',
          icon: <BookOpen size={iconSize} /> 
        },
        { 
          href: '/student/courses/myprogress', 
          label: 'My Progress', 
          description: 'Track progress',
          icon: <GraduationCap size={iconSize} /> 
        },
      ]
    },
    {
      title: 'ASSESSMENTS',
      items: [
        { 
          href: '/student/assessments?tab=assignments', 
          label: 'Assignments', 
          description: 'View & submit assignments',
          icon: <FileText size={iconSize} /> 
        },
        { 
          href: '/student/modifications', 
          label: 'Modifications', 
          description: 'Review change requests',
          icon: <AlertTriangle size={iconSize} /> 
        },
      ]
    },
    {
      title: 'ACHIEVEMENTS',
      items: [
        { 
          href: '/student/certificates', 
          label: 'Certifications', 
          description: 'View certificates',
          icon: <Award size={iconSize} /> 
        },
        { 
          href: '/student/opportunities', 
          label: 'Opportunities', 
          description: 'Career paths',
          icon: <Briefcase size={iconSize} /> 
        },
      ]
    },
    {
      title: 'COMMUNITY',
      items: [
        { 
          href: '/student/forums', 
          label: 'Forums', 
          description: 'Discussions',
          icon: <MessageSquare size={iconSize} /> 
        },
      ]
    },
    {
      title: 'ACCOUNT',
      items: [
        { 
          href: '/student/dashboard/profile', 
          label: 'My Profile', 
          description: 'Personal info & settings',
          icon: <UserCircle size={iconSize} /> 
        },
        { 
          href: '/student/dashboard/help', 
          label: 'Help & Support', 
          description: 'Get assistance',
          icon: <HelpCircle size={iconSize} /> 
        },
      ]
    }
  ];

  // Get user initials for avatar
  const getInitials = () => {
    if (user?.first_name && user?.last_name) {
      return `${user.first_name[0]}${user.last_name[0]}`.toUpperCase();
    }
    if (user?.first_name) {
      return user.first_name[0].toUpperCase();
    }
    return 'S';
  };

  // Handle logout
  const handleLogout = () => {
    logout();
    router.push('/auth/login');
  };

  return (
    <>
      {/* Mobile Menu Button - Fixed at top */}
      {isMobile && (
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="fixed top-4 left-4 z-50 lg:hidden bg-[#0f172a] text-white p-2 rounded-lg shadow-lg hover:bg-[#1e293b] transition-colors"
          aria-label="Toggle menu"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      )}

      {/* Overlay for mobile */}
      {isMobile && isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
          bg-[#0f172a] text-white flex flex-col
          fixed lg:static inset-y-0 left-0 z-40
          w-64 sm:w-72 lg:w-64 xl:w-72
          transform transition-transform duration-300 ease-in-out
          ${isMobile && !isMobileMenuOpen ? '-translate-x-full' : 'translate-x-0'}
          lg:translate-x-0
          min-h-screen overflow-hidden
        `}
      >
        {/* Header Section */}
        <div className="p-4 sm:p-6 pb-4 flex-shrink-0">
          <div className="mb-4 sm:mb-6">
            <h1 className="text-lg sm:text-xl font-bold text-white mb-1">Afritec Student</h1>
            <p className="text-xs sm:text-sm text-slate-400">Learning Management System</p>
          </div>

        {/* User Profile Card */}
        <div className="bg-[#1e293b] rounded-lg p-2.5 sm:p-3 mb-4 sm:mb-6">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-blue-600 text-white font-semibold text-xs sm:text-sm flex-shrink-0">
              {getInitials()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs sm:text-sm font-semibold text-white truncate">
                {user?.first_name ? `${user.first_name} ${user.last_name || ''}`.trim() : 'Student'}
              </p>
              <p className="text-[10px] sm:text-xs text-slate-400 lowercase">student</p>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Menu - Scrollable */}
      <nav className="flex-1 px-3 sm:px-4 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-700 scrollbar-track-transparent">
        {navSections.map((section, sectionIndex) => (
          <div key={section.title} className={sectionIndex > 0 ? 'mt-4 sm:mt-6' : ''}>
            <h3 className="text-[10px] sm:text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 px-2">
              {section.title}
            </h3>
            <ul className="space-y-0.5 sm:space-y-1">
              {section.items.map((item) => {
                const isActive = pathname === item.href || 
                  (item.href !== '/student/dashboard' && pathname.startsWith(item.href));

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      onClick={() => isMobile && setIsMobileMenuOpen(false)}
                      className={`group flex items-start gap-2 sm:gap-3 px-2 sm:px-3 py-2 sm:py-2.5 rounded-lg transition-all duration-200
                        ${isActive 
                          ? 'bg-blue-600 text-white' 
                          : 'text-slate-300 hover:bg-[#1e293b] hover:text-white'
                        }`}
                    >
                      <span className={`mt-0.5 flex-shrink-0 ${isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-300'}`}>
                        {item.icon}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="text-xs sm:text-sm font-medium leading-tight">
                          {item.label}
                        </div>
                        <div className={`text-[10px] sm:text-xs mt-0.5 ${isActive ? 'text-blue-100' : 'text-slate-500 group-hover:text-slate-400'}`}>
                          {item.description}
                        </div>
                      </div>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="p-3 sm:p-4 border-t border-slate-800 flex-shrink-0">
        <button
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-2 px-3 py-2.5 mb-3 rounded-lg bg-red-600 hover:bg-red-700 text-white transition-colors duration-200 text-sm font-medium"
        >
          <LogOut size={18} />
          <span>Logout</span>
        </button>
        <p className="text-[10px] sm:text-xs text-slate-500 text-center">
          © {new Date().getFullYear()} Afritec Bridge
        </p>
      </div>
    </aside>
    </>
  );
};

export default StudentSidebar;