"use client";

import React, { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UnauthorizedAccess } from '@/components/guards/UnauthorizedAccess';
import { Course } from '@/types/api';
import apiClient from '@/lib/api-client';
import AageService, { AageAnalytics, unwrapList } from '@/services/aage.service';
import { canAccessInstructorAage, canViewAllCourses, isAdminRole } from '@/components/aage/roles';
import {
  BarChart3,
  BookOpenCheck,
  BrainCircuit,
  ClipboardCheck,
  LayoutDashboard,
  ListChecks,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import StatsCards from '@/components/aage/StatsCards';
import RubricBuilder from '@/components/aage/RubricBuilder';
import GradingQueue from '@/components/aage/GradingQueue';
import ReviewWorkspace from '@/components/aage/ReviewWorkspace';
import LearningDashboard from '@/components/aage/LearningDashboard';
import GradingReports from '@/components/aage/GradingReports';
import GradingSubNavigation from '@/components/instructor/GradingSubNavigation';

type TabKey = 'overview' | 'rubric' | 'queue' | 'reviews' | 'reports' | 'learning';

const TAB_META: Array<{ key: TabKey; label: string; shortLabel: string; icon: React.ReactNode }> = [
  { key: 'overview', label: 'Overview', shortLabel: 'Overview', icon: <LayoutDashboard className="h-4 w-4" /> },
  { key: 'rubric', label: 'Rubric Builder', shortLabel: 'Rubrics', icon: <BookOpenCheck className="h-4 w-4" /> },
  { key: 'queue', label: 'Grading Queue', shortLabel: 'Queue', icon: <ListChecks className="h-4 w-4" /> },
  { key: 'reviews', label: 'Review Workspace', shortLabel: 'Reviews', icon: <ClipboardCheck className="h-4 w-4" /> },
  { key: 'reports', label: 'Grading Reports', shortLabel: 'Reports', icon: <BarChart3 className="h-4 w-4" /> },
  { key: 'learning', label: 'Learning & Calibration', shortLabel: 'Learning', icon: <BrainCircuit className="h-4 w-4" /> },
];

function AssessmentIntelligenceInner() {
  const { user, isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [tab, setTab] = useState<TabKey>('overview');
  const [courses, setCourses] = useState<Course[]>([]);
  const [analyticsCourseId, setAnalyticsCourseId] = useState<number | undefined>(undefined);
  const [stats, setStats] = useState<AageAnalytics | null>(null);
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState<string | null>(null);
  const [initialReviewId, setInitialReviewId] = useState<number | null>(null);

  // Derived before the early role guard so the callbacks below can use them.
  const canScopeAllCourses = canViewAllCourses(user?.role);
  const canAdminister = isAdminRole(user?.role);

  // Read deep-link params (e.g. ?tab=reviews&review=12) safely.
  useEffect(() => {
    const requestedTab = searchParams.get('tab') as TabKey | null;
    if (requestedTab && TAB_META.some((item) => item.key === requestedTab)) {
      setTab(requestedTab);
    }
    const review = searchParams.get('review');
    if (review && /^\d+$/.test(review)) {
      setInitialReviewId(Number(review));
      setTab('reviews');
    }
  }, [searchParams]);

  const loadCourses = useCallback(async (): Promise<Course[]> => {
    setCoursesLoading(true);
    try {
      const response = await apiClient.get('/instructor/courses');
      const list = unwrapList<Course>(response.data, 'courses');
      setCourses(list);
      return list;
    } catch {
      setCourses([]);
      return [];
    } finally {
      setCoursesLoading(false);
    }
  }, []);

  const loadStats = useCallback(async (courseId?: number) => {
    setStatsLoading(true);
    setStatsError(null);
    try {
      setStats(await AageService.getAnalytics(courseId));
    } catch (err: unknown) {
      setStatsError(
        (err as { message?: string })?.message ||
          'Analytics are unavailable for this deployment. Other tools remain usable.'
      );
    } finally {
      setStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCourses().then((list) => {
      // Instructors must be scoped to one of their own courses; admins may
      // request the unscoped aggregate.
      const initial = canScopeAllCourses ? undefined : list[0]?.id;
      setAnalyticsCourseId(initial);
      void loadStats(initial);
    });
  }, [canScopeAllCourses, loadCourses, loadStats]);

  const openReview = (reviewId: number) => {
    setInitialReviewId(reviewId);
    setTab('reviews');
    router.replace('/instructor/assessment-intelligence?tab=reviews');
  };

  // Defensive role check in addition to the layout-level InstructorGuard.
  if (authLoading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!user) return null;

  // Students (and any other non-instructor/admin role) never see this page,
  // its tabs or its controls. This complements the layout-level guard.
  if (!canAccessInstructorAage(user.role)) {
    return <UnauthorizedAccess requiredRole="instructor" pageName="Assessment Intelligence page" />;
  }

  return (
    <div className="space-y-6">
      <GradingSubNavigation />
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-900/30 dark:text-purple-300">
              <BrainCircuit className="h-5 w-5" />
            </span>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              Assessment Intelligence
            </h1>
          </div>
          <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
            AI-assisted rubric design, grading operations, instructor review and evaluator learning —
            with student data and internal evaluator details kept out of view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/instructor/grading"
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            Submissions
          </Link>
          <button
            type="button"
            onClick={() => {
              void loadCourses().then((list) => {
                const next = canScopeAllCourses
                  ? analyticsCourseId
                  : analyticsCourseId ?? list[0]?.id;
                setAnalyticsCourseId(next);
                void loadStats(next);
              });
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-200"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>
      </div>

      {coursesLoading && (
        <p className="text-xs text-slate-400">Loading your courses…</p>
      )}

      <Tabs value={tab} onValueChange={(value) => setTab(value as TabKey)} className="w-full">
        <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0 dark:bg-transparent">
          {TAB_META.map((item) => (
            <TabsTrigger
              key={item.key}
              value={item.key}
              className="gap-1.5 border border-slate-200 bg-white data-[state=active]:border-blue-400 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-700 dark:border-slate-700 dark:bg-slate-800 dark:data-[state=active]:bg-blue-900/30 dark:data-[state=active]:text-blue-300"
            >
              <span className="hidden sm:inline">{item.icon}</span>
              <span className="sm:hidden">{item.icon}</span>
              <span className="hidden sm:inline">{item.label}</span>
              <span className="sm:hidden">{item.shortLabel}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview" className="mt-6">
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <label htmlFor="aage-analytics-course" className="text-sm font-medium text-slate-600 dark:text-slate-300">
              Analytics scope
            </label>
            <select
              id="aage-analytics-course"
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100"
              value={analyticsCourseId ?? ''}
              onChange={(event) => {
                const next = event.target.value ? Number(event.target.value) : undefined;
                setAnalyticsCourseId(next);
                void loadStats(next);
              }}
            >
              {canScopeAllCourses && <option value="">All courses</option>}
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.title}</option>
              ))}
            </select>
          </div>
          <StatsCards
            stats={stats}
            loading={statsLoading}
            error={statsError}
            onRetry={() => void loadStats(analyticsCourseId)}
          />
        </TabsContent>

        <TabsContent value="rubric" className="mt-6">
          <RubricBuilder courses={courses} />
        </TabsContent>

        <TabsContent value="queue" className="mt-6">
          <GradingQueue courses={courses} onOpenReview={openReview} />
        </TabsContent>

        <TabsContent value="reviews" className="mt-6">
          <ReviewWorkspace courses={courses} initialReviewId={initialReviewId} />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <GradingReports courses={courses} role={user.role} />
        </TabsContent>

        <TabsContent value="learning" className="mt-6">
          <LearningDashboard canAdminister={canAdminister} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function AssessmentIntelligencePage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
        </div>
      }
    >
      <AssessmentIntelligenceInner />
    </Suspense>
  );
}
