'use client';

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, ArrowRight, BookOpen, SearchX } from 'lucide-react';
import { Course } from '@/types/api';
import { CourseCard } from './CourseCard';

interface CourseGridProps {
  courses: Course[];
  totalCourses?: number;
  isLoading: boolean;
  error: string | null;
  onClearFilters: () => void;
  onRetry: () => void;
}

const CourseSkeleton = () => (
  <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#0d131e]">
    <div className="aspect-[16/10] animate-pulse bg-white/[0.06]" />
    <div className="space-y-4 p-5">
      <div className="h-3 w-24 animate-pulse rounded bg-white/[0.08]" />
      <div className="h-6 w-4/5 animate-pulse rounded bg-white/[0.08]" />
      <div className="h-10 w-full animate-pulse rounded bg-white/[0.06]" />
      <div className="h-10 w-full animate-pulse rounded bg-white/[0.06]" />
      <div className="h-14 w-full animate-pulse rounded-xl bg-white/[0.06]" />
      <div className="h-11 w-full animate-pulse rounded-xl bg-white/[0.08]" />
    </div>
  </div>
);

export const CourseGrid: React.FC<CourseGridProps> = ({
  courses,
  totalCourses = 0,
  isLoading,
  error,
  onClearFilters,
  onRetry,
}) => {
  if (isLoading) {
    return (
      <div aria-label="Loading courses" className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => <CourseSkeleton key={index} />)}
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-rose-300/15 bg-rose-300/[0.06] px-6 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-rose-300/20 bg-rose-300/10 text-rose-200">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-white">Something went wrong while loading courses.</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-100 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
        >
          Try again
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  if (totalCourses === 0 && courses.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10 text-cyan-200">
          <BookOpen className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-white">No courses available yet.</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Check back soon or sign in to get notified about new learning paths.</p>
        <Link
          href="/auth/login"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-300 px-4 py-2.5 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-200 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
        >
          Sign in
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>
    );
  }

  if (courses.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl border border-white/[0.09] bg-white/[0.03] px-6 py-12 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.05] text-slate-300">
          <SearchX className="h-5 w-5" aria-hidden="true" />
        </span>
        <h3 className="mt-5 text-lg font-semibold text-white">No courses match your search.</h3>
        <p className="mt-2 text-sm leading-6 text-slate-400">Try a different skill, topic, or availability filter.</p>
        <button
          type="button"
          onClick={onClearFilters}
          className="mt-6 inline-flex items-center gap-2 rounded-xl border border-cyan-300/25 bg-cyan-300/10 px-4 py-2.5 text-sm font-semibold text-cyan-100 transition-colors hover:bg-cyan-300/15 focus:outline-none focus:ring-2 focus:ring-cyan-300/60"
        >
          Clear filters
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-white">Available courses</p>
          <p className="mt-1 text-xs text-slate-500">{courses.length} {courses.length === 1 ? 'result' : 'results'} in the library</p>
        </div>
        <span className="hidden h-1.5 w-1.5 rounded-full bg-cyan-300/70 shadow-[0_0_10px_rgba(103,232,249,0.75)] sm:block" aria-hidden="true" />
      </div>
      <div className="grid grid-cols-1 items-stretch gap-5 md:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {courses.map((course) => <CourseCard key={course.id} course={course} />)}
      </div>
    </div>
  );
};
