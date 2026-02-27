"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import InstructorService, { InstructorDashboardData, CourseAnalytics } from '@/services/instructor.service';
import { Course } from '@/types/api';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen, Users, ClipboardCheck, TrendingUp, Plus, Megaphone,
  Eye, Settings, BarChart3, Clock, CalendarDays, GraduationCap,
  ArrowRight, Sparkles, AlertCircle, RefreshCw, ChevronRight,
  Layers, FileText, Bell
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip as RechartsTooltip, Cell
} from 'recharts';

// ── Animated number counter ──────────────────────────────────────────
function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const end = value;
    if (end === 0) { setCount(0); return; }
    const stepTime = Math.max(Math.floor((duration * 1000) / end), 16);
    const timer = setInterval(() => {
      start += Math.ceil(end / (duration * 1000 / stepTime));
      if (start >= end) { setCount(end); clearInterval(timer); }
      else setCount(start);
    }, stepTime);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{count.toLocaleString()}</span>;
}

// ── Time-based greeting ──────────────────────────────────────────────
function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

// ── Stagger animation variants ──────────────────────────────────────
const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08 } }
};
const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring' as const, stiffness: 260, damping: 20 } }
};

// ── Color palette helper ────────────────────────────────────────────
const CHART_COLORS = ['#6366f1', '#06b6d4', '#f59e0b', '#10b981', '#f43f5e', '#8b5cf6'];

// ── Skeleton loader ─────────────────────────────────────────────────
function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Header skeleton */}
      <div className="flex justify-between items-center">
        <div className="space-y-2">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-10 w-36 rounded-lg" />
      </div>
      {/* Stat cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-xl" />
        ))}
      </div>
      {/* Content skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Skeleton className="xl:col-span-2 h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ════════════════════════════════════════════════════════════════════
const InstructorDashboardPage = () => {
  const [dashboardData, setDashboardData] = useState<InstructorDashboardData | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseAnalytics, setCourseAnalytics] = useState<Record<number, CourseAnalytics>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isClient, setIsClient] = useState(false);
  const { token, user } = useAuth();

  useEffect(() => { setIsClient(true); }, []);

  // ── Fetch all data ────────────────────────────────────────────────
  const fetchDashboardData = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const [dashboardResponse, coursesResponse] = await Promise.all([
        InstructorService.getDashboardData(),
        InstructorService.getMyCourses()
      ]);
      setDashboardData(dashboardResponse);
      const safeCourses = Array.isArray(coursesResponse) ? coursesResponse : [];
      setCourses(safeCourses);

      // Fetch analytics per course in background (non-blocking)
      const analyticsMap: Record<number, CourseAnalytics> = {};
      const analyticsPromises = safeCourses.slice(0, 6).map(async (c) => {
        try {
          const a = await InstructorService.getCourseAnalytics(c.id);
          analyticsMap[c.id] = a;
        } catch { /* skip if analytics unavailable */ }
      });
      await Promise.allSettled(analyticsPromises);
      setCourseAnalytics(analyticsMap);
    } catch (err: any) {
      console.error('Dashboard fetch error:', err);
      try {
        const coursesResponse = await InstructorService.getMyCourses();
        const safeCourses = Array.isArray(coursesResponse) ? coursesResponse : [];
        setCourses(safeCourses);
        setDashboardData({
          taughtCourses: safeCourses,
          totalStudents: 0,
          pendingGradingItems: 0,
          recentEnrollments: [],
          recentAnnouncements: []
        });
        setError(null);
      } catch {
        setError('Unable to load instructor data. Please try again.');
        setCourses([]);
      }
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchDashboardData(); }, [fetchDashboardData]);

  // ── Derived data ──────────────────────────────────────────────────
  const publishedCount = useMemo(() => courses.filter(c => c.is_published).length, [courses]);
  const draftCount = useMemo(() => courses.filter(c => !c.is_published).length, [courses]);

  const enrollmentChartData = useMemo(() => {
    return courses.slice(0, 6).map((c) => ({
      name: c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title,
      students: courseAnalytics[c.id]?.total_enrolled ?? 0,
      completion: courseAnalytics[c.id]?.completion_rate ?? 0
    }));
  }, [courses, courseAnalytics]);

  const totalPendingSubmissions = useMemo(() => {
    return Object.values(courseAnalytics).reduce((s, a) => s + (a.pending_submissions || 0), 0);
  }, [courseAnalytics]);

  // ── Render gates ──────────────────────────────────────────────────
  if (!isClient || loading) return <DashboardSkeleton />;

  if (error) return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center justify-center py-20 gap-4"
    >
      <div className="rounded-full bg-red-100 dark:bg-red-900/30 p-4">
        <AlertCircle className="h-8 w-8 text-red-500" />
      </div>
      <p className="text-red-600 dark:text-red-400 text-center max-w-md">{error}</p>
      <button
        onClick={() => fetchDashboardData()}
        className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors text-sm font-medium"
      >
        <RefreshCw className="h-4 w-4" /> Retry
      </button>
    </motion.div>
  );

  if (!dashboardData) return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <Layers className="h-10 w-10 text-slate-400" />
      <p className="text-slate-500 dark:text-slate-400">No dashboard data available.</p>
    </div>
  );

  // ── Main dashboard ────────────────────────────────────────────────
  return (
    <TooltipProvider delayDuration={200}>
      <motion.div
        variants={containerVariants} initial="hidden" animate="show"
        className="space-y-6 lg:space-y-8 pb-8"
      >
        {/* ─── Hero header ────────────────────────────────────────── */}
        <motion.div variants={itemVariants} className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-6 sm:p-8 text-white">
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YzMuMzE0IDAgNiAyLjY4NiA2IDZzLTIuNjg2IDYtNiA2LTYtMi42ODYtNi02IDIuNjg2LTYgNi02eiIvPjwvZz48L2c+PC9zdmc+')] opacity-40" />
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-yellow-300" />
                <span className="text-sm font-medium text-white/80">{getGreeting()}</span>
              </div>
              <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">
                {user?.first_name || 'Instructor'}
              </h1>
              <p className="mt-2 text-sm text-white/70 max-w-md">
                {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/instructor/courses/create"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-medium transition-all border border-white/20"
              >
                <Plus className="h-4 w-4" /> New Course
              </Link>
              <Link
                href="/instructor/announcements"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-white/15 hover:bg-white/25 backdrop-blur-sm rounded-xl text-sm font-medium transition-all border border-white/20"
              >
                <Megaphone className="h-4 w-4" /> Announce
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ─── Stat cards ─────────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {([
            {
              label: 'Total Courses',
              value: courses.length,
              icon: BookOpen,
              gradient: 'from-sky-500 to-cyan-400',
              bgLight: 'bg-sky-50 dark:bg-sky-950/30',
              iconColor: 'text-sky-600 dark:text-sky-400',
              sub: `${publishedCount} published · ${draftCount} draft`,
              href: '/instructor/courses'
            },
            {
              label: 'Total Students',
              value: dashboardData.totalStudents,
              icon: Users,
              gradient: 'from-emerald-500 to-teal-400',
              bgLight: 'bg-emerald-50 dark:bg-emerald-950/30',
              iconColor: 'text-emerald-600 dark:text-emerald-400',
              sub: 'Across all courses',
              href: '/instructor/students'
            },
            {
              label: 'Pending Grading',
              value: dashboardData.pendingGradingItems || totalPendingSubmissions,
              icon: ClipboardCheck,
              gradient: 'from-amber-500 to-orange-400',
              bgLight: 'bg-amber-50 dark:bg-amber-950/30',
              iconColor: 'text-amber-600 dark:text-amber-400',
              sub: (dashboardData.pendingGradingItems || totalPendingSubmissions) > 0 ? 'Needs attention' : 'All caught up!',
              href: '/instructor/grading',
              urgent: (dashboardData.pendingGradingItems || totalPendingSubmissions) > 5
            },
            {
              label: 'Announcements',
              value: dashboardData.recentAnnouncements?.length || 0,
              icon: Bell,
              gradient: 'from-violet-500 to-purple-400',
              bgLight: 'bg-violet-50 dark:bg-violet-950/30',
              iconColor: 'text-violet-600 dark:text-violet-400',
              sub: 'Recently posted',
              href: '/instructor/announcements'
            }
          ] as const).map((stat, i) => (
            <motion.div key={stat.label} variants={itemVariants}>
              <Link href={stat.href}>
                <Card className="group relative overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer border-0 shadow-sm h-full">
                  {/* Gradient top bar */}
                  <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${stat.gradient}`} />
                  <CardContent className="p-4 sm:p-5">
                    <div className="flex items-start justify-between mb-3">
                      <div className={`rounded-xl ${stat.bgLight} p-2.5 sm:p-3 transition-transform group-hover:scale-110`}>
                        <stat.icon className={`h-5 w-5 sm:h-6 sm:w-6 ${stat.iconColor}`} />
                      </div>
                      {'urgent' in stat && stat.urgent && (
                        <span className="relative flex h-3 w-3">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                          <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                        </span>
                      )}
                    </div>
                    <div className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                      <AnimatedCounter value={stat.value} />
                    </div>
                    <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-medium mt-0.5">
                      {stat.label}
                    </p>
                    <p className="text-[10px] sm:text-xs text-slate-400 dark:text-slate-500 mt-1.5 truncate">
                      {stat.sub}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>

        {/* ─── Main content grid ──────────────────────────────────── */}
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 sm:gap-6">

          {/* ── Left column (2/3) ────────────────────────────────── */}
          <div className="xl:col-span-2 space-y-4 sm:space-y-6">

            {/* Course enrollment chart */}
            {enrollmentChartData.length > 0 && (
              <motion.div variants={itemVariants}>
                <Card className="border-0 shadow-sm">
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-indigo-500" />
                        Enrollment Overview
                      </CardTitle>
                      <Badge variant="secondary" className="text-xs font-normal">
                        {courses.length} course{courses.length !== 1 ? 's' : ''}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="h-56 sm:h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={enrollmentChartData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border, #e2e8f0)" />
                          <XAxis
                            dataKey="name" tick={{ fontSize: 11 }} tickLine={false} axisLine={false}
                            interval={0} angle={-20} textAnchor="end" height={50}
                          />
                          <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                          <RechartsTooltip
                            contentStyle={{
                              backgroundColor: 'var(--popover, #fff)',
                              border: '1px solid var(--border, #e2e8f0)',
                              borderRadius: '12px',
                              fontSize: '13px',
                              boxShadow: '0 4px 12px rgba(0,0,0,0.08)'
                            }}
                            formatter={(val: number, name: string) => [val, name === 'students' ? 'Students Enrolled' : 'Completion %']}
                          />
                          <Bar dataKey="students" radius={[6, 6, 0, 0]} maxBarSize={48}>
                            {enrollmentChartData.map((_, idx) => (
                              <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {/* My courses list */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                      <GraduationCap className="h-5 w-5 text-indigo-500" />
                      My Courses
                    </CardTitle>
                    <Link href="/instructor/courses" className="text-xs sm:text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                      View all <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {Array.isArray(courses) && courses.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {courses.slice(0, 5).map((course, idx) => {
                        const analytics = courseAnalytics[course.id];
                        const completionRate = analytics?.completion_rate ?? 0;
                        return (
                          <motion.div
                            key={course.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.05 }}
                            className="group px-5 py-4 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                              {/* Course color dot + info */}
                              <div className="flex items-start gap-3 flex-1 min-w-0">
                                <div
                                  className="mt-1 h-3 w-3 rounded-full shrink-0 ring-4 ring-offset-2 ring-offset-white dark:ring-offset-slate-900"
                                  style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length], boxShadow: `0 0 8px ${CHART_COLORS[idx % CHART_COLORS.length]}40` }}
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 mb-1">
                                    <h3 className="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                      {course.title}
                                    </h3>
                                    <Badge
                                      variant={course.is_published ? 'default' : 'secondary'}
                                      className={`text-[10px] shrink-0 ${course.is_published ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 border-0'}`}
                                    >
                                      {course.is_published ? 'Live' : 'Draft'}
                                    </Badge>
                                  </div>
                                  <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400">
                                    <span className="flex items-center gap-1">
                                      <Users className="h-3 w-3" />
                                      {analytics?.total_enrolled ?? '—'}
                                    </span>
                                    <span className="flex items-center gap-1">
                                      <CalendarDays className="h-3 w-3" />
                                      {new Date(course.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                    </span>
                                    {analytics && (
                                      <span className="flex items-center gap-1">
                                        <TrendingUp className="h-3 w-3" />
                                        {completionRate}% complete
                                      </span>
                                    )}
                                  </div>
                                  {/* Mini progress bar */}
                                  {analytics && (
                                    <div className="mt-2 max-w-xs">
                                      <Progress value={completionRate} className="h-1.5" />
                                    </div>
                                  )}
                                </div>
                              </div>

                              {/* Action buttons */}
                              <div className="flex items-center gap-1.5 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link
                                      href={`/instructor/courses/${course.id}/preview`}
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>Preview</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link
                                      href={`/instructor/courses/${course.id}`}
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                                    >
                                      <Settings className="h-4 w-4" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>Manage</TooltipContent>
                                </Tooltip>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Link
                                      href={`/instructor/courses/${course.id}/analytics`}
                                      className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/50 transition-colors"
                                    >
                                      <BarChart3 className="h-4 w-4" />
                                    </Link>
                                  </TooltipTrigger>
                                  <TooltipContent>Analytics</TooltipContent>
                                </Tooltip>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center py-12 gap-3">
                      <div className="rounded-full bg-slate-100 dark:bg-slate-800 p-4">
                        <BookOpen className="h-8 w-8 text-slate-400" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 text-sm">No courses yet</p>
                      <Link
                        href="/instructor/courses/create"
                        className="text-sm text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
                      >
                        <Plus className="h-3.5 w-3.5" /> Create your first course
                      </Link>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* ── Right column (1/3) ───────────────────────────────── */}
          <div className="space-y-4 sm:space-y-6">

            {/* Quick actions */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-amber-500" />
                    Quick Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-2">
                  {([
                    { label: 'New Course', icon: Plus, href: '/instructor/courses/create', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-900/40' },
                    { label: 'Grade Work', icon: ClipboardCheck, href: '/instructor/grading', color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-900/40' },
                    { label: 'Announce', icon: Megaphone, href: '/instructor/announcements', color: 'text-purple-600 dark:text-purple-400', bg: 'bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40' },
                    { label: 'Students', icon: Users, href: '/instructor/students', color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-900/40' }
                  ] as const).map(action => (
                    <Link key={action.label} href={action.href}>
                      <div className={`flex flex-col items-center gap-2 p-3 sm:p-4 rounded-xl ${action.bg} transition-all cursor-pointer group`}>
                        <action.icon className={`h-5 w-5 ${action.color} transition-transform group-hover:scale-110`} />
                        <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{action.label}</span>
                      </div>
                    </Link>
                  ))}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent announcements */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Megaphone className="h-5 w-5 text-purple-500" />
                      Announcements
                    </CardTitle>
                    <Link href="/instructor/announcements" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                      All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {dashboardData.recentAnnouncements && dashboardData.recentAnnouncements.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dashboardData.recentAnnouncements.map((ann, idx) => (
                        <motion.div
                          key={ann.id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.06 }}
                          className="px-5 py-3.5 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <h4 className="text-sm font-medium text-slate-900 dark:text-white leading-snug mb-1 line-clamp-1">
                            {ann.title}
                          </h4>
                          <div className="flex items-center gap-2 text-[11px] text-slate-400 dark:text-slate-500">
                            <Badge variant="secondary" className="text-[10px] font-normal border-0 bg-slate-100 dark:bg-slate-800 px-1.5 py-0">
                              {ann.course_title}
                            </Badge>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(ann.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <Megaphone className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">No announcements yet</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            {/* Recent enrollments */}
            <motion.div variants={itemVariants}>
              <Card className="border-0 shadow-sm">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-5 w-5 text-emerald-500" />
                      Recent Enrollments
                    </CardTitle>
                    <Link href="/instructor/students" className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1">
                      All <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  {dashboardData.recentEnrollments && dashboardData.recentEnrollments.length > 0 ? (
                    <div className="divide-y divide-slate-100 dark:divide-slate-800">
                      {dashboardData.recentEnrollments.slice(0, 6).map((enrollment: any, idx: number) => (
                        <motion.div
                          key={enrollment.id || idx}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: idx * 0.05 }}
                          className="px-5 py-3 flex items-center gap-3 hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                            {(enrollment.student_name || enrollment.username || 'S')[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-white truncate">
                              {enrollment.student_name || enrollment.username || 'Student'}
                            </p>
                            <p className="text-[11px] text-slate-400 dark:text-slate-500 truncate">
                              {enrollment.course_title || 'Course'}
                            </p>
                          </div>
                          <span className="text-[10px] text-slate-400 dark:text-slate-500 shrink-0">
                            {enrollment.enrollment_date
                              ? new Date(enrollment.enrollment_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                              : ''}
                          </span>
                        </motion.div>
                      ))}
                    </div>
                  ) : (
                    <div className="px-5 py-8 text-center">
                      <Users className="h-8 w-8 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                      <p className="text-sm text-slate-400 dark:text-slate-500">No recent enrollments</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </TooltipProvider>
  );
};

export default InstructorDashboardPage;

