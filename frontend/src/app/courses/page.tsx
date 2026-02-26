'use client';
import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { Course, ApplicationWindowData } from '@/types/api';
import { CourseApiService } from '@/services/api';
import {
  normalizeApplicationWindows,
  getPrimaryWindow,
  formatDate,
} from '@/utils/cohort-utils';

// ── Cohort-aware tier helpers ─────────────────────────────────────────────────

type PaymentTier = 'free' | 'scholarship' | 'partial_scholarship' | 'full_tuition';

function getCohortPaymentTier(window?: ApplicationWindowData | null, course?: Course): PaymentTier {
  // Use cohort effective values when available
  const enrollType = window?.effective_enrollment_type ?? window?.enrollment_type ?? course?.enrollment_type;
  if (enrollType === 'free') return 'free';
  if (enrollType === 'scholarship') {
    // Check if it's partial scholarship
    const scholarshipType = window?.scholarship_type;
    if (scholarshipType === 'partial') return 'partial_scholarship';
    return 'scholarship';
  }
  if (enrollType === 'paid') {
    const paymentMode = window?.payment_mode ?? course?.payment_mode;
    if (paymentMode === 'partial') return 'partial_scholarship';
    return 'full_tuition';
  }
  return 'full_tuition';
}

function getCohortAmountDue(window?: ApplicationWindowData | null, course?: Course): number {
  const ps = window?.payment_summary;
  if (ps?.amount_due_now != null) return ps.amount_due_now;
  const cps = course?.payment_summary;
  if (cps?.amount_due_now != null) return cps.amount_due_now;
  const partialAmt = window?.partial_payment_amount ?? course?.partial_payment_amount;
  if (partialAmt != null) return partialAmt;
  const pct = window?.partial_payment_percentage ?? course?.partial_payment_percentage;
  const price = window?.effective_price ?? window?.price ?? course?.price;
  if (pct != null && price) return Math.round(price * pct / 100 * 100) / 100;
  return price ?? 0;
}

function getCohortScholarshipCover(window?: ApplicationWindowData | null, course?: Course): number | null {
  // Use original (pre-scholarship) price so scholarship cover = originalPrice - amountDue
  const originalPrice = window?.payment_summary?.original_price ?? course?.price;
  const due = getCohortAmountDue(window, course);
  if (originalPrice && due > 0 && originalPrice > due) return Math.round((originalPrice - due) * 100) / 100;
  return null;
}

function getCohortCurrency(window?: ApplicationWindowData | null, course?: Course): string {
  return window?.effective_currency ?? window?.currency ?? course?.currency ?? 'USD';
}

// ── Tier badge ────────────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: PaymentTier }> = ({ tier }) => {
  const map = {
    free:                { label: '✨ Free',               cls: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' },
    scholarship:         { label: '🎓 Scholarship',        cls: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
    partial_scholarship: { label: '🎓 Partial Scholarship', cls: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40' },
    full_tuition:        { label: '💳 Full Tuition',       cls: 'bg-blue-500/20 text-blue-300 border-blue-500/40' },
  };
  const { label, cls } = map[tier];
  return (
    <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${cls}`}>
      {label}
    </span>
  );
};

const StatusDot: React.FC<{ status: string }> = ({ status }) => {
  const cls = status === 'open' ? 'bg-emerald-400' : status === 'upcoming' ? 'bg-blue-400' : 'bg-gray-500';
  return <span className={`w-2 h-2 rounded-full ${cls} shrink-0`} />;
};

// ── Payment info block using cohort-aware data ────────────────────────────────

const PaymentInfoBlock: React.FC<{ course: Course; window?: ApplicationWindowData | null }> = ({ course, window: win }) => {
  const tier = getCohortPaymentTier(win, course);
  const currency = getCohortCurrency(win, course);

  if (tier === 'free') {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/20 rounded-xl">
        <span className="text-emerald-400 font-bold text-base">Free Enrollment</span>
        <span className="text-emerald-500/70 text-xs">· No payment required</span>
      </div>
    );
  }

  if (tier === 'scholarship') {
    return (
      <div className="px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-xl space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-amber-400 font-bold text-base">Fully Covered</span>
          <span className="text-amber-500/70 text-xs">· Competitive selection</span>
        </div>
        <p className="text-gray-400 text-xs leading-relaxed">
          Apply and our team will review your application. No payment required if selected.
        </p>
      </div>
    );
  }

  if (tier === 'partial_scholarship') {
    const amountDue = getCohortAmountDue(win, course);
    const scholarshipCover = getCohortScholarshipCover(win, course);
    const scholarshipType = win?.scholarship_type;
    const scholarshipPct = win?.scholarship_percentage ?? win?.payment_summary?.scholarship_percentage;
    const isScholarshipPartial = (win?.effective_enrollment_type ?? win?.enrollment_type) === 'scholarship' && scholarshipType === 'partial';
    // For scholarship: student pays (100 - scholarship_percentage)%; for paid partial: use partial_payment_percentage directly
    const pct = isScholarshipPartial && scholarshipPct != null
      ? Math.round((100 - scholarshipPct) * 100) / 100
      : (win?.partial_payment_percentage ?? course?.partial_payment_percentage);
    return (
      <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-xl overflow-hidden">
        <div className="px-3 pt-2 pb-1">
          <p className="text-xs font-semibold text-indigo-400 uppercase tracking-wide mb-2">Partial Scholarship</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-white/5 rounded-lg p-2">
              <p className="text-xs text-gray-400 mb-0.5">Your Contribution</p>
              <p className="text-base font-bold text-indigo-300">
                {amountDue > 0 ? `${currency} ${amountDue.toLocaleString()}` : 'TBD'}
              </p>
              {pct != null && pct > 0 && (
                <p className="text-xs text-indigo-500 mt-0.5">
                  {isScholarshipPartial ? `${pct}% of total` : `${pct}% payment now`}
                </p>
              )}
            </div>
            <div className="bg-emerald-500/10 rounded-lg p-2 border border-emerald-500/20">
              <p className="text-xs text-gray-400 mb-0.5">Covered by Scholarship</p>
              <p className="text-base font-bold text-emerald-400">
                {scholarshipCover != null && scholarshipCover > 0
                  ? `${currency} ${scholarshipCover.toLocaleString()}`
                  : '—'}
              </p>
              <p className="text-xs text-emerald-600 mt-0.5">Scholarship covers</p>
            </div>
          </div>
          {(() => {
            const totalPrice = win?.payment_summary?.original_price ?? course?.price;
            return totalPrice != null ? (
              <p className="text-xs text-gray-500 mt-2 pb-1">
                Total program cost: <span className="text-gray-400 font-medium">{currency} {totalPrice.toLocaleString()}</span>
              </p>
            ) : null;
          })()}
        </div>
      </div>
    );
  }

  // full_tuition
  const fullPrice = win?.payment_summary?.amount_due_now ?? win?.effective_price ?? course?.payment_summary?.amount_due_now ?? course?.price;
  return (
    <div className="flex items-center justify-between px-3 py-2 bg-blue-500/10 border border-blue-500/20 rounded-xl">
      <div>
        <p className="text-xs font-semibold text-blue-400 uppercase tracking-wide">Full Tuition</p>
        <p className="text-base font-bold text-blue-300">
          {fullPrice != null && fullPrice > 0
            ? `${currency} ${fullPrice.toLocaleString()}`
            : 'Price on request'}
        </p>
        <p className="text-xs text-gray-500 mt-0.5">One-time payment · Lifetime access</p>
      </div>
      <div className="text-2xl opacity-40">💳</div>
    </div>
  );
};

// ── Apply button label ────────────────────────────────────────────────────────

function getApplyLabel(course: Course, win?: ApplicationWindowData | null): string {
  const tier = getCohortPaymentTier(win, course);
  const currency = getCohortCurrency(win, course);
  if (tier === 'free') return 'Enroll Free';
  if (tier === 'scholarship') return 'Apply for Scholarship';
  if (tier === 'partial_scholarship') {
    const due = getCohortAmountDue(win, course);
    return due > 0 ? `Apply & Pay ${currency} ${due.toLocaleString()}` : 'Apply & Pay';
  }
  const full = win?.payment_summary?.amount_due_now ?? win?.effective_price ?? course?.payment_summary?.amount_due_now ?? course?.price;
  return full != null && full > 0 ? `Apply & Pay ${currency} ${full.toLocaleString()}` : 'Apply Now';
}

// ── Public Course Card ────────────────────────────────────────────────────────

const PublicCourseCard: React.FC<{ course: Course }> = ({ course }) => {
  const windows = useMemo(() => normalizeApplicationWindows(course), [course]);
  const primaryWindow = useMemo(() => getPrimaryWindow(windows), [windows]);
  const tier = getCohortPaymentTier(primaryWindow, course);
  const openWindows = windows.filter(w => w.status === 'open');
  const upcomingWindows = windows.filter(w => w.status === 'upcoming');

  const headerGradient =
    tier === 'free'                ? 'from-emerald-600 via-teal-600 to-cyan-700'
    : tier === 'scholarship'       ? 'from-amber-600 via-orange-600 to-amber-700'
    : tier === 'partial_scholarship' ? 'from-indigo-600 via-purple-600 to-indigo-700'
    :                                  'from-sky-600 via-blue-600 to-indigo-700';

  return (
    <div className="bg-gray-900/60 backdrop-blur-sm border border-gray-700/60 shadow-xl overflow-hidden rounded-2xl hover:shadow-2xl hover:border-gray-600 transition-all duration-300 h-full flex flex-col group">
      {/* Header */}
      <div className={`bg-gradient-to-br ${headerGradient} p-5 relative overflow-hidden`}>
        <div className="absolute top-0 right-0 w-28 h-28 bg-white/5 rounded-full -mr-14 -mt-14" />
        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full -ml-10 -mb-10" />
        <div className="relative z-10">
          <div className="flex items-start justify-between gap-2 mb-3">
            <TierBadge tier={tier} />
            {course.estimated_duration && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white/20 text-white shrink-0">
                {course.estimated_duration}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white line-clamp-2 leading-snug group-hover:text-white/90 transition-colors">
            {course.title}
          </h3>
          {course.instructor_name && (
            <p className="text-sm text-white/70 mt-1.5 flex items-center gap-1.5">
              <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{course.instructor_name}</span>
            </p>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-grow flex flex-col gap-3">
        <p className="text-gray-400 text-sm line-clamp-2 leading-relaxed">
          {course.description || 'No description available'}
        </p>

        {/* Active cohort info */}
        {windows.length > 0 && (
          <div className="space-y-1.5">
            {primaryWindow && (
              <div className="flex items-center gap-2 text-xs">
                <StatusDot status={primaryWindow.status} />
                <span className="text-gray-300 font-medium truncate">
                  {primaryWindow.cohort_label || 'Current Cohort'}
                </span>
                <span className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider ${
                  primaryWindow.status === 'open' ? 'bg-emerald-500/20 text-emerald-400' :
                  primaryWindow.status === 'upcoming' ? 'bg-blue-500/20 text-blue-400' :
                  'bg-gray-500/20 text-gray-400'
                }`}>
                  {primaryWindow.status}
                </span>
              </div>
            )}
            {primaryWindow?.status === 'open' && primaryWindow.closes_at && (
              <p className="text-[11px] text-gray-500 pl-4">
                Deadline: {formatDate(primaryWindow.closes_at)}
              </p>
            )}
            {primaryWindow?.status !== 'open' && upcomingWindows.length > 0 && (
              <p className="text-[11px] text-blue-400/80 pl-4">
                Next opens: {formatDate(upcomingWindows[0].opens_at)}
              </p>
            )}
            {windows.length > 1 && (
              <p className="text-[11px] text-gray-500 pl-4">
                {openWindows.length > 0 ? `${openWindows.length} open` : ''}
                {openWindows.length > 0 && upcomingWindows.length > 0 ? ' · ' : ''}
                {upcomingWindows.length > 0 ? `${upcomingWindows.length} upcoming` : ''}
                {' '}cohort{windows.length > 1 ? 's' : ''}
              </p>
            )}
            {/* Enrollment capacity */}
            {primaryWindow?.max_students && (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pl-4">
                <svg className="w-3 h-3 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>{primaryWindow.enrollment_count ?? 0} / {primaryWindow.max_students} enrolled</span>
              </div>
            )}
          </div>
        )}

        {/* Payment info block */}
        <div className="mt-auto">
          <PaymentInfoBlock course={course} window={primaryWindow} />
        </div>
      </div>

      {/* Actions */}
      <div className="px-5 pb-5 mt-auto">
        <div className="flex gap-2">
          <Link
            href={`/courses/${course.id}`}
            className="flex-none px-3 py-2.5 border border-gray-600 hover:border-gray-400 text-gray-400 hover:text-white font-medium rounded-xl transition-all duration-200 text-sm text-center whitespace-nowrap"
          >
            Details
          </Link>
          <Link
            href={`/courses/${course.id}/apply`}
            className={`flex-1 px-4 py-2.5 font-semibold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-center text-sm flex items-center justify-center gap-1.5 ${
              tier === 'free'
                ? 'bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white'
                : tier === 'scholarship'
                ? 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white'
                : 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white'
            }`}
          >
            <span>{getApplyLabel(course, primaryWindow)}</span>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

// ── Filter types ──────────────────────────────────────────────────────────────

type TierFilter = 'all' | PaymentTier;
type StatusFilter = 'all' | 'open' | 'upcoming' | 'closed';

const PublicCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [tierFilter, setTierFilter] = useState<TierFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  useEffect(() => {
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

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sky-400 mx-auto mb-4"></div>
          <p className="text-white">Loading courses...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3">
              <svg 
                className="w-8 h-8 text-sky-400"
                viewBox="0 0 64 64" 
                fill="none" 
                xmlns="http://www.w3.org/2000/svg"
              >
                <path 
                  d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18Z" 
                  fill="currentColor"
                />
              </svg>
              <span className="text-xl font-bold text-white">Afritec Bridge</span>
            </Link>
            <Link 
              href="/auth/login" 
              className="px-4 py-2 bg-sky-500 hover:bg-sky-600 text-white font-medium rounded-lg transition-colors"
            >
              Sign In
            </Link>
          </div>
        </div>
      </header>

      <main className="py-12 flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-10">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Explore Our Courses
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-5">
              Browse our selection of tech courses and apply directly online. 
              Our AI-powered scoring system ensures fair evaluation for all applicants.
            </p>
            {/* Quick stats chips */}
            <div className="flex flex-wrap items-center justify-center gap-3">
              {stats.open > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  {stats.open} accepting applications
                </span>
              )}
              {stats.upcoming > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-full text-blue-400 text-sm">
                  <span className="w-2 h-2 rounded-full bg-blue-400" />
                  {stats.upcoming} upcoming
                </span>
              )}
              {stats.scholarship > 0 && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-amber-400 text-sm">
                  🎓 {stats.scholarship} with scholarships
                </span>
              )}
            </div>
          </div>

          {/* Search & Filters Bar */}
          {courses.length > 0 && (
            <div className="mb-8 space-y-4">
              {/* Search */}
              <div className="relative max-w-xl mx-auto">
                <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search courses by title, description, or instructor..."
                  className="w-full pl-12 pr-4 py-3 bg-white/5 border border-gray-700 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Filter chips */}
              <div className="flex flex-wrap items-center justify-center gap-2">
                <span className="text-xs text-gray-500 uppercase tracking-wider mr-1">Filter:</span>
                {/* Status filters */}
                {(['all', 'open', 'upcoming'] as StatusFilter[]).map(s => (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      statusFilter === s
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {s === 'all' ? 'All Status' : s === 'open' ? '🟢 Open' : '🔵 Upcoming'}
                  </button>
                ))}
                <span className="w-px h-5 bg-gray-700 mx-1" />
                {/* Tier filters */}
                {([
                  { v: 'all' as TierFilter, l: 'All Types' },
                  { v: 'free' as TierFilter, l: '✨ Free' },
                  { v: 'scholarship' as TierFilter, l: '🎓 Scholarship' },
                  { v: 'partial_scholarship' as TierFilter, l: '🎓 Partial' },
                  { v: 'full_tuition' as TierFilter, l: '💳 Paid' },
                ]).map(({ v, l }) => (
                  <button
                    key={v}
                    onClick={() => setTierFilter(v)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      tierFilter === v
                        ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                        : 'bg-white/5 text-gray-400 border border-gray-700 hover:border-gray-500'
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error ? (
            <div className="text-center py-12">
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6 max-w-md mx-auto">
                <p className="text-red-300 mb-4">Error: {error}</p>
                <button 
                  onClick={() => window.location.reload()} 
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : courses.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-2xl font-bold text-white mb-3">No Courses Available Yet</h3>
                <p className="text-gray-300 mb-6">
                  We&apos;re working on adding amazing courses. Check back soon or sign in to get notified!
                </p>
                <div className="space-y-3">
                  <Link 
                    href="/auth/login"
                    className="block w-full px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all shadow-lg"
                  >
                    Sign In
                  </Link>
                  <Link 
                    href="/auth/register"
                    className="block w-full px-6 py-3 border-2 border-sky-500 hover:bg-sky-500/10 text-sky-400 font-semibold rounded-lg transition-all"
                  >
                    Create Account
                  </Link>
                </div>
              </div>
            </div>
          ) : filteredCourses.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-5xl mb-4">🔍</div>
                <h3 className="text-xl font-bold text-white mb-2">No matching courses</h3>
                <p className="text-gray-400 mb-4 text-sm">
                  Try adjusting your search or filters to find what you&apos;re looking for.
                </p>
                <button
                  onClick={() => { setSearchQuery(''); setTierFilter('all'); setStatusFilter('all'); }}
                  className="px-4 py-2 bg-sky-500/20 text-sky-300 border border-sky-500/40 rounded-lg text-sm hover:bg-sky-500/30 transition-all"
                >
                  Clear all filters
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="mb-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    Available Courses
                    <span className="ml-3 text-lg font-normal text-gray-400">
                      ({filteredCourses.length}{filteredCourses.length !== courses.length ? ` of ${courses.length}` : ''} {filteredCourses.length === 1 ? 'course' : 'courses'})
                    </span>
                  </h2>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {filteredCourses.map((course) => (
                  <PublicCourseCard key={course.id} course={course} />
                ))}
              </div>
            </>
          )}

          {/* Call to Action */}
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-sky-500/10 to-blue-500/10 border border-sky-500/20 rounded-xl p-8">
              <h2 className="text-2xl font-bold text-white mb-3">Ready to Apply?</h2>
              <p className="text-gray-300 mb-6 max-w-2xl mx-auto">
                Our application process is designed to identify motivated learners from all backgrounds. 
                Click &quot;Apply Now&quot; on any course to get started — no registration required!
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <Link 
                  href="#courses"
                  onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  className="inline-flex items-center px-6 py-3 bg-gradient-to-r from-sky-500 to-blue-600 hover:from-sky-600 hover:to-blue-700 text-white font-semibold rounded-lg transition-all duration-300"
                >
                  Browse Courses
                </Link>
                <Link 
                  href="/auth/login"
                  className="inline-flex items-center px-6 py-3 border border-sky-500 hover:bg-sky-500/10 text-sky-400 font-semibold rounded-lg transition-all duration-300"
                >
                  Already Applied? Sign In
                </Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <svg className="w-6 h-6 text-sky-400" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M32 0L38.9282 24H25.0718L32 0ZM50.954 18L57.8822 42H44.0258L50.954 18Z" fill="currentColor" />
              </svg>
              <span className="text-sm text-gray-400">
                &copy; {new Date().getFullYear()} Afritec Bridge. All rights reserved.
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <Link href="/privacy" className="hover:text-gray-300 transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-gray-300 transition-colors">Terms</Link>
              <Link href="/auth/login" className="hover:text-gray-300 transition-colors">Sign In</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default PublicCoursesPage;