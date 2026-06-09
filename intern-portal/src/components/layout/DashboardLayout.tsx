/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/AuthContext';
import { api } from '../../lib/api';
import { TaskAssignment } from '../../types';
import {
  LayoutDashboard,
  CheckSquare,
  GraduationCap,
  Users,
  FileText,
  User,
  LogOut,
  Menu,
  X,
  Lock,
  Bell,
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
  currentPath: string;
  onNavigate: (path: string) => void;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children, currentPath, onNavigate }) => {
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [taskCount, setTaskCount] = useState<number | null>(null);

  // Load counter of active (pending + in_progress) tasks
  const fetchTaskCounts = async () => {
    try {
      const tasksData = await api.getTasks();
      if (tasksData && Array.isArray(tasksData)) {
        const count = tasksData.filter((t: TaskAssignment) => t.status === 'pending' || t.status === 'in_progress').length;
        setTaskCount(count);
      }
    } catch {
      // Quiet fail
    }
  };

  useEffect(() => {
    fetchTaskCounts();
    const id = setInterval(fetchTaskCounts, 20000);
    return () => clearInterval(id);
  }, []);

  const navItems = [
    { name: 'Dashboard', path: '/intern/dashboard', icon: LayoutDashboard },
    { name: 'My Tasks', path: '/intern/tasks', icon: CheckSquare, badge: taskCount },
    { name: 'My Grades', path: '/intern/grades', icon: GraduationCap },
    { name: 'My Cohort', path: '/intern/cohort', icon: Users },
    { name: 'My Offer', path: '/intern/offer', icon: FileText },
    { name: 'Profile & Settings', path: '/intern/profile', icon: User },
  ];

  const getInitials = (fullName?: string | null) => {
    if (!fullName) return '?';
    const parts = fullName.split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return fullName.substring(0, 2).toUpperCase();
  };

  const isCurrent = (itemPath: string) => currentPath === itemPath;

  const handleLogoutClick = () => {
    logout();
    onNavigate('/auth/login');
  };

  const handleNavClick = (path: string) => {
    onNavigate(path);
    setSidebarOpen(false);
  };

  const getBreadcrumb = () => {
    const found = navItems.find(item => item.path === currentPath);
    if (found) return found.name;
    if (currentPath.includes('/intern/tasks/')) return 'Task Workspace';
    if (currentPath.includes('/intern/change-password')) return 'Security Update';
    return 'Intern Portal';
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col md:flex-row font-sans" id="dashboard-layout">

      {/* MOBILE HEADER BAR */}
      <div className="md:hidden bg-slate-900 border-b border-slate-800 px-4 py-3.5 flex justify-between items-center shrink-0 z-30">
        <div className="flex items-center space-x-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-teal-600 to-orange-500 flex items-center justify-center font-bold text-white text-sm">
            AT
          </div>
          <div>
            <span className="font-bold tracking-tight text-white text-sm">AfriTech Bridge</span>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1 px-1.5 bg-slate-800 border border-slate-700 rounded text-slate-200"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* PERSISTENT SIDEBAR - DESKTOP & MOBILE TRANSITIONS */}
      <aside className={`
        fixed inset-y-0 left-0 bg-slate-900 w-64 border-r border-slate-800 transform z-40 transition-transform duration-200 ease-in-out md:relative md:transform-none md:flex md:flex-col justify-between shrink-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `} id="side-navigation-dock">

        {/* TOP SECTION: User Details & Logo */}
        <div className="flex flex-col flex-1 divide-y divide-slate-800/60 overflow-y-auto">

          {/* Brand Panel */}
          <div className="p-5 flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-teal-600 to-orange-500 flex items-center justify-center font-bold text-white shadow-md">
                AT
              </div>
              <div>
                <span className="font-bold tracking-tight text-white text-sm block">AfriTech Bridge</span>
                <span className="text-[9px] font-mono tracking-wider text-teal-400 uppercase">Intern Workspace</span>
              </div>
            </div>

            <button
              onClick={() => setSidebarOpen(false)}
              className="md:hidden p-1.5 text-slate-400 hover:text-white"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* User Profile Summary */}
          {user && (
            <div className="p-4 flex items-center space-x-3 bg-slate-900/40">
              <div className="w-10 h-10 rounded-full bg-teal-950 border border-teal-500/30 flex items-center justify-center text-teal-400 font-bold text-sm shrink-0 uppercase">
                {getInitials(user.full_name)}
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-xs font-semibold text-white block truncate">{user.full_name}</span>
                <span className="text-[10px] text-slate-400 truncate block">{user.email}</span>
                <div className="inline-flex items-center px-1.5 py-0.5 bg-slate-950 border border-slate-800 text-[9px] font-medium text-teal-300 rounded-full mt-1 font-mono">
                  Role: Intern
                </div>
              </div>
            </div>
          )}

          {/* Nav Items Linkages */}
          <nav className="p-4 space-y-1.5 flex-1 select-none">
            {navItems.map((item, idx) => {
              const Icon = item.icon;
              const current = isCurrent(item.path);
              return (
                <button
                  key={idx}
                  onClick={() => handleNavClick(item.path)}
                  className={`
                    w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all group cursor-pointer
                    ${current ? 'bg-teal-600 text-white shadow-lg shadow-teal-950/50' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'}
                  `}
                >
                  <div className="flex items-center space-x-3">
                    <Icon className={`h-4.5 w-4.5 group-hover:scale-105 transition-transform ${current ? 'text-white' : 'text-slate-500'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge !== undefined && item.badge !== null && item.badge > 0 && (
                    <span className={`px-2 py-0.5 text-[10px] font-bold font-mono rounded-full ${
                      current ? 'bg-white text-teal-700' : 'bg-teal-950/60 border border-teal-500/20 text-teal-400'
                    }`}>
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* BOTTOM SECTION: Logout */}
        <div className="p-4 border-t border-slate-800 shrink-0 space-y-4">
          <div className="space-y-1">
            {user?.must_change_password && (
              <button
                onClick={() => handleNavClick('/intern/change-password')}
                className="w-full flex items-center space-x-3 px-3.5 py-2 rounded-lg text-xs font-semibold bg-orange-950/40 border border-orange-500/20 text-orange-300 hover:bg-orange-900/30 transition-all cursor-pointer"
              >
                <Lock className="h-3.5 w-3.5 shrink-0" />
                <span>Fix Security Alert!</span>
              </button>
            )}

            <button
              onClick={handleLogoutClick}
              className="w-full flex items-center space-x-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-rose-400 hover:text-rose-300 hover:bg-rose-950/20 transition-all group cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5 text-rose-500/80 group-hover:translate-x-0.5 transition-all" />
              <span>Log out of portal</span>
            </button>
          </div>
        </div>
      </aside>

      {/* MOBILE SIDEBAR CLOSE MASK */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-30"
        />
      )}

      {/* MAIN LAYOUT CANVAS */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* DESKTOP TOP BAR */}
        <header className="hidden md:flex bg-slate-900/50 border-b border-slate-900 px-8 py-4 items-center justify-between shrink-0 z-20">
          <div className="flex items-center space-x-3">
            <span className="text-xs text-slate-500 font-mono">AFRITECH BRIDGE</span>
            <span className="text-slate-700">/</span>
            <span className="text-xs font-semibold text-slate-300 tracking-wide font-mono uppercase bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-md">
              {getBreadcrumb()}
            </span>
          </div>

          <div className="flex items-center space-x-5">
            {/* Notification bell */}
            <button className="relative p-1 px-1.5 bg-slate-900 border border-slate-850 hover:border-slate-800 text-slate-400 hover:text-slate-200 rounded-lg transition-all">
              <Bell className="h-4.5 w-4.5" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
            </button>
          </div>
        </header>

        {/* WORKSPACE CONTENT AREA */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 relative bg-slate-950/40">
          <div className="max-w-7xl mx-auto h-full" id="portal-inner-workspace">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
};
