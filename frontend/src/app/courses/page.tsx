'use client';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Course } from '@/types/api';
import { CourseApiService } from '@/services/api';
import { normalizeApplicationWindows, getPrimaryWindow } from '@/utils/cohort-utils';
import { getCohortPaymentTier, PaymentTier } from '@/types/course-tiers';
import { CourseFilters } from '@/components/courses/CourseFilters';
import { CourseGrid } from '@/components/courses/CourseGrid';

// ── Filter types ──────────────────────────────────────────────────────────────

type TierFilter = 'all' | PaymentTier;
type StatusFilter = 'all' | 'open' | 'upcoming' | 'closed';

// ── Page Component ────────────────────────────────────────────────────────────

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
        sort_by: 'recent'
      });
      
      const fetchedCourses = Array.isArray(response) 
        ? response 
        : (response.items || []);
      
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

  // Filtered courses
  const filteredCourses = useMemo(() => {
    return courses.filter(course => {
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = course.title?.toLowerCase().includes(q);
        const matchDesc = course.description?.toLowerCase().includes(q);
        const matchInstructor = course.instructor_name?.toLowerCase().includes(q);
        if (!matchTitle && !matchDesc && !matchInstructor) return false;
      }

      const windows = normalizeApplicationWindows(course);
      const primaryWin = getPrimaryWindow(windows);

      // Tier filter
      if (tierFilter !== 'all') {
        const tier = getCohortPaymentTier(primaryWin, course);
        if (tier !== tierFilter) return false;
      }

      // Status filter — check if the course has any window matching
      if (statusFilter !== 'all') {
        if (windows.length === 0) return false;
        const hasMatchingStatus = windows.some(w => w.status === statusFilter);
        if (!hasMatchingStatus) return false;
      }

      return true;
    });
  }, [courses, searchQuery, tierFilter, statusFilter]);

  // Stats for filter chips
  const stats = useMemo(() => {
    let open = 0, upcoming = 0, scholarship = 0;
    courses.forEach(c => {
      const wins = normalizeApplicationWindows(c);
      if (wins.some(w => w.status === 'open')) open++;
      if (wins.some(w => w.status === 'upcoming')) upcoming++;
      const pw = getPrimaryWindow(wins);
      const tier = getCohortPaymentTier(pw, c);
      if (tier === 'scholarship' || tier === 'partial_scholarship') scholarship++;
    });
    return { open, upcoming, scholarship };
  }, [courses]);

  const hasActiveFilter = searchQuery.trim() !== '' || tierFilter !== 'all' || statusFilter !== 'all';

  const clearFilters = () => {
    setSearchQuery('');
    setTierFilter('all');
    setStatusFilter('all');
  };

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 flex flex-col">
      {/* Compact Header */}
      <header className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-2 sm:gap-2.5 min-w-0">
              <Image
                src="/logo.jpg"
                alt="Afritec Bridge"
                width={28}
                height={28}
                priority
                className="w-6 h-6 sm:w-7 sm:h-7 rounded-full object-cover shrink-0"
              />
              <span className="text-sm sm:text-lg font-bold text-zinc-900 dark:text-white truncate">Afritec Bridge</span>
            </Link>
            <Link 
              href="/auth/login" 
              className="shrink-0 px-3 sm:px-3.5 py-1.5 sm:py-1.5 bg-sky-600 hover:bg-sky-700 text-white text-xs sm:text-sm font-medium rounded-lg transition-colors active:scale-95"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      {/* Compact Hero */}
      <div className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-5 sm:py-8 text-center">
          <h1 className="text-xl sm:text-2xl md:text-4xl font-bold text-zinc-900 dark:text-white mb-1 sm:mb-2 px-2">
            Explore Our Courses
          </h1>
          <p className="text-xs sm:text-sm md:text-base text-zinc-500 dark:text-zinc-400 max-w-2xl mx-auto px-2">
            Browse tech courses and apply directly. AI-powered evaluation for fair assessment.
          </p>
        </div>
      </div>

      {/* Sticky Filters — always show while loaded, or while any filter is active */}
      {(!isLoading || hasActiveFilter) && (
        <CourseFilters
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          tierFilter={tierFilter}
          onTierFilterChange={setTierFilter}
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          stats={stats}
        />
      )}

      {/* Main Content */}
      <main className="flex-1">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
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

      {/* Compact Footer */}
      <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Image
                src="/logo.jpg"
                alt="Afritec Bridge"
                width={20}
                height={20}
                className="w-4 h-4 sm:w-5 sm:h-5 rounded-full object-cover shrink-0"
              />
              <span className="text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
                © {new Date().getFullYear()} Afritec Bridge
              </span>
            </div>
            <div className="flex items-center gap-3 sm:gap-4 text-[10px] sm:text-xs text-zinc-500 dark:text-zinc-400">
              <Link href="/privacy" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Terms</Link>
              <Link href="/auth/login" className="hover:text-zinc-700 dark:hover:text-zinc-200 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCoursesPage;
