'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowUpRight, Check, ChevronRight } from 'lucide-react';
import { Course } from '@/types/api';
import { CourseApiService } from '@/services/api';
import { normalizeApplicationWindows, getPrimaryWindow } from '@/utils/cohort-utils';
import { getCohortPaymentTier, PaymentTier } from '@/types/course-tiers';
import { CourseFilters } from '@/components/courses/CourseFilters';
import { CourseGrid } from '@/components/courses/CourseGrid';

type TierFilter = 'all' | PaymentTier;
type StatusFilter = 'all' | 'open' | 'upcoming' | 'closed';

const PublicCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const loadCourses = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await CourseApiService.getCourses({
        page: 1,
        per_page: 100,
        sort_by: 'recent',
      });

      const fetchedCourses = Array.isArray(response) ? response : response.items || [];
      setCourses(fetchedCourses);
    } catch (err: any) {
      console.error('Error loading courses:', err);
      setError(err.message || 'Failed to load courses. Please try again later.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadCourses();
  }, []);

  const filteredCourses = useMemo(() => {
    return courses.filter((course) => {
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchesSearch = [
          course.title,
          course.description,
          course.instructor_name,
          course.category,
          course.target_audience,
        ].some((value) => value?.toLowerCase().includes(query));

        if (!matchesSearch) return false;
      }

      const windows = normalizeApplicationWindows(course);
      const primaryWindow = getPrimaryWindow(windows);

      if (tierFilter !== 'all') {
        const tier = getCohortPaymentTier(primaryWindow, course);
        const isScholarshipFilter = tierFilter === 'scholarship';
        const matchesTier = isScholarshipFilter
          ? tier === 'scholarship' || tier === 'partial_scholarship'
          : tier === tierFilter;

        if (!matchesTier) return false;
      }

      if (statusFilter !== 'all') {
        if (!windows.length || !windows.some((window) => window.status === statusFilter)) {
          return false;
        }
      }

      return true;
    });
  }, [courses, searchQuery, tierFilter, statusFilter]);

  const stats = useMemo(() => {
    let open = 0;
    let upcoming = 0;
    let closed = 0;
    let scholarship = 0;

    courses.forEach((course) => {
      const windows = normalizeApplicationWindows(course);
      if (windows.some((window) => window.status === 'open')) open += 1;
      if (windows.some((window) => window.status === 'upcoming')) upcoming += 1;
      if (windows.some((window) => window.status === 'closed')) closed += 1;

      const tier = getCohortPaymentTier(getPrimaryWindow(windows), course);
      if (tier === 'scholarship' || tier === 'partial_scholarship') scholarship += 1;
    });

    return { total: courses.length, open, upcoming, closed, scholarship };
  }, [courses]);

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="catalog-page min-h-screen overflow-x-hidden bg-[#080b12] text-slate-100">
      <header className="sticky top-0 z-50 border-b border-white/[0.08] bg-[#080b12]/90 backdrop-blur-xl">
        <div className="catalog-container flex h-[72px] items-center justify-between">
          <Link href="/" className="group flex items-center gap-3" aria-label="Afritech Bridge home">
            <span className="relative flex h-9 w-9 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-white shadow-[0_0_24px_rgba(34,211,238,0.12)]">
              <Image
                src="/logo.jpg"
                alt=""
                width={36}
                height={36}
                priority
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </span>
            <span className="text-sm font-semibold tracking-[-0.02em] text-white sm:text-base">
              Afritech <span className="text-cyan-300">Bridge</span>
            </span>
          </Link>

          <nav className="hidden items-center gap-7 text-sm md:flex" aria-label="Primary navigation">
            <Link href="/courses" className="font-medium text-white">
              Courses
            </Link>
          </nav>

          <Link
            href="/auth/login"
            className="inline-flex items-center gap-2 rounded-lg border border-cyan-300/20 bg-cyan-300 px-3.5 py-2 text-xs font-semibold text-slate-950 shadow-[0_0_20px_rgba(103,232,249,0.14)] transition-all hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/70 focus:ring-offset-2 focus:ring-offset-[#080b12] sm:text-sm"
          >
            Sign in
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </header>

      <section className="relative isolate overflow-hidden border-b border-white/[0.08]">
        <div
          className="pointer-events-none absolute inset-0 opacity-50"
          style={{
            backgroundImage:
              'linear-gradient(rgba(148,163,184,0.055) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.055) 1px, transparent 1px)',
            backgroundSize: '56px 56px',
            maskImage: 'linear-gradient(to bottom, black, transparent 92%)',
          }}
        />
        <div className="pointer-events-none absolute -left-24 top-0 h-80 w-80 rounded-full bg-blue-600/20 blur-[110px]" />
        <div className="pointer-events-none absolute right-[18%] top-12 h-64 w-64 rounded-full bg-violet-600/15 blur-[100px]" />

        <div className="catalog-container relative grid gap-12 py-16 sm:py-20 lg:grid-cols-[1.12fr_0.88fr] lg:items-center lg:gap-16 lg:py-24">
          <div className="max-w-3xl">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.07] px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-cyan-200">
              
            </div>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.98] tracking-[-0.065em] text-white sm:text-6xl lg:text-[5.35rem]">
              Build skills that move you forward.
            </h1>
            <p className="mt-6 max-w-2xl text-base leading-7 text-slate-300 sm:text-lg sm:leading-8">
              Practical technology courses, real projects, and AI-powered evaluation designed for the next generation of digital professionals.
            </p>
            <div className="mt-8 flex flex-wrap gap-x-6 gap-y-3 text-sm text-slate-300">
              {['Project-led learning', 'AI-powered evaluation', 'Career-ready skills'].map((item) => (
                <span key={item} className="inline-flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-300">
                    <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:ml-auto">
            <div className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-cyan-300/10 via-blue-500/5 to-violet-500/10 blur-2xl" />
            <div className="relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#0d1420]/90 p-5 shadow-2xl shadow-black/30 sm:p-6">
              <div className="flex items-start justify-between border-b border-white/[0.08] pb-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-cyan-300/75">Your next move</p>
                  <p className="mt-2 text-xl font-semibold tracking-[-0.03em] text-white">Learn. Build. Demonstrate.</p>
                </div>
              </div>
              <div className="relative mt-6 space-y-5">
                <div className="absolute left-[13px] top-4 h-[calc(100%-32px)] w-px bg-gradient-to-b from-cyan-300/60 via-blue-400/35 to-transparent" />
                {[
                  ['01', 'Choose a practical path', 'Built around skills you can use.'],
                  ['02', 'Work through real projects', 'Turn concepts into visible progress.'],
                  ['03', 'Show what you can do', 'Assessment that keeps the signal clear.'],
                ].map(([number, title, description]) => (
                  <div key={number} className="relative flex gap-4">
                    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-cyan-300/30 bg-[#101b2a] font-mono text-[10px] font-semibold text-cyan-200">
                      {number}
                    </span>
                    <div className="pt-0.5">
                      <p className="text-sm font-medium text-white">{title}</p>
                      <p className="mt-1 text-xs leading-5 text-slate-400">{description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-7 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.03] px-3.5 py-3 text-xs">
                <span className="text-slate-400">Learning library</span>
                <span className="font-semibold text-cyan-200">Open for discovery</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <main className="catalog-container py-14 sm:py-20">
        <div className="mb-9 flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-cyan-300/80">Learning library</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.045em] text-white sm:text-4xl">
              Find the right course for your next move.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
              Explore focused paths, compare what matters, and apply when you’re ready.
            </p>
          </div>
          <div className="inline-flex w-fit items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-medium text-slate-300">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 shadow-[0_0_10px_rgba(110,231,183,0.8)]" />
            {isLoading ? 'Loading library' : `${courses.length} ${courses.length === 1 ? 'course' : 'courses'} available`}
          </div>
        </div>

        <CourseFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          stats={stats}
        />

        <div className="mt-8">
          <CourseGrid
            courses={filteredCourses}
            totalCourses={courses.length}
            isLoading={isLoading}
            error={error}
            onClearFilters={clearFilters}
            onRetry={loadCourses}
          />
        </div>
      </main>

      <footer className="border-t border-white/[0.08] bg-[#06080e]">
        <div className="catalog-container flex flex-col gap-6 py-8 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <Image src="/logo.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
            <div>
              <p className="text-sm font-semibold text-white">Afritech Bridge</p>
              <p className="mt-1 text-xs text-slate-500">Practical technology education for the digital future.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-slate-500">
            <Link href="/courses" className="transition-colors hover:text-white">Courses</Link>
            <Link href="/opportunities" className="transition-colors hover:text-white">Opportunities</Link>
            <Link href="/privacy" className="transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="transition-colors hover:text-white">Terms</Link>
            <Link href="/auth/login" className="inline-flex items-center gap-1 transition-colors hover:text-white">
              Sign in
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
        <div className="border-t border-white/[0.06]">
          <div className="catalog-container py-4 text-xs text-slate-600">© {new Date().getFullYear()} Afritech Bridge</div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCoursesPage;
