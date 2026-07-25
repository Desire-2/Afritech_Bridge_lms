'use client';
import React from 'react';
import Link from 'next/link';
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

export const CourseGrid: React.FC<CourseGridProps> = ({
  courses,
  totalCourses = 0,
  isLoading,
  error,
  onClearFilters,
  onRetry,
}) => {
  // Loading state
  if (isLoading) {
    return (
      <div className="py-12 sm:py-20 flex items-center justify-center">
        <div className="text-center px-4">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-10 sm:w-10 border-b-2 border-sky-500 mx-auto mb-3"></div>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400">Loading courses...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="py-12 sm:py-16">
        <div className="bg-red-50 border border-red-200 rounded-xl p-5 sm:p-6 max-w-sm mx-auto text-center dark:bg-red-900/20 dark:border-red-800">
          <div className="text-2xl sm:text-4xl mb-3">⚠️</div>
          <p className="text-xs sm:text-sm text-red-700 dark:text-red-300 mb-4">{error}</p>
          <button
            onClick={onRetry}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-red-600 hover:bg-red-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-[0.97]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Empty state - no courses at all
  if (totalCourses === 0 && courses.length === 0) {
    return (
      <div className="py-12 sm:py-16 px-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 max-w-sm mx-auto text-center dark:bg-zinc-800/50 dark:border-zinc-700">
          <div className="text-3xl sm:text-5xl mb-4">📚</div>
          <h3 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white mb-2">
            No Courses Available
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Check back soon or sign in to get notified!
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <Link
              href="/auth/login"
              className="px-4 py-2.5 sm:py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-[0.97]"
            >
              Sign In
            </Link>
            <Link
              href="/auth/register"
              className="px-4 py-2.5 sm:py-2 border border-sky-300 hover:bg-sky-50 text-sky-600 text-xs sm:text-sm font-medium rounded-lg transition-colors dark:border-sky-700 dark:hover:bg-sky-900/20 dark:text-sky-400 active:scale-[0.97]"
            >
              Create Account
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Empty search/filter results
  if (courses.length === 0) {
    return (
      <div className="py-12 sm:py-16 px-4">
        <div className="bg-white border border-zinc-200 rounded-xl p-6 sm:p-8 max-w-sm mx-auto text-center dark:bg-zinc-800/50 dark:border-zinc-700">
          <div className="text-2xl sm:text-4xl mb-3">🔍</div>
          <h3 className="text-sm sm:text-base font-bold text-zinc-900 dark:text-white mb-2">
            No matching courses
          </h3>
          <p className="text-xs sm:text-sm text-zinc-500 dark:text-zinc-400 mb-4">
            Try adjusting your search or filters.
          </p>
          <button
            onClick={onClearFilters}
            className="w-full sm:w-auto px-4 py-2.5 sm:py-2 bg-sky-100 text-sky-700 text-xs sm:text-sm font-medium rounded-lg hover:bg-sky-200 transition-colors dark:bg-sky-900/30 dark:text-sky-300 dark:hover:bg-sky-900/50 active:scale-[0.97]"
          >
            Clear all filters
          </button>
        </div>
      </div>
    );
  }

  // Course grid
  return (
    <div>
      {/* Header row */}
      <div className="flex items-center justify-between mb-3 sm:mb-5">
        <h2 className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white">
          Courses
          <span className="ml-1.5 sm:ml-2 text-xs sm:text-sm font-normal text-zinc-500 dark:text-zinc-400">
            ({courses.length})
          </span>
        </h2>
      </div>

      {/* Responsive grid: 1 col mobile, 2 cols sm, 3 cols lg, 4 cols xl */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {courses.map((course) => (
          <div key={course.id} className="flex flex-col">
            <CourseCard course={course} />
          </div>
        ))}
      </div>
    </div>
  );
};
