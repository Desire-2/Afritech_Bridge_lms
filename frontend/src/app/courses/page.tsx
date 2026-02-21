'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Course } from '@/types/api';
import { CourseApiService } from '@/services/api';

// ── Payment tier helpers ──────────────────────────────────────────────────────

function getPaymentTier(course: Course): 'free' | 'scholarship' | 'partial_scholarship' | 'full_tuition' {
  if (course.enrollment_type === 'free') return 'free';
  if (course.enrollment_type === 'scholarship') return 'scholarship';
  if (course.enrollment_type === 'paid' && course.payment_mode === 'partial') return 'partial_scholarship';
  return 'full_tuition';
}

function getAmountDue(course: Course): number {
  const ps = course.payment_summary;
  if (ps?.amount_due_now != null) return ps.amount_due_now;
  if (course.partial_payment_amount != null) return course.partial_payment_amount;
  if (course.partial_payment_percentage != null && course.price)
    return Math.round(course.price * course.partial_payment_percentage / 100 * 100) / 100;
  return course.price ?? 0;
}

function getScholarshipCover(course: Course): number | null {
  const ps = course.payment_summary;
  if (ps?.remaining_balance != null) return ps.remaining_balance;
  const due = getAmountDue(course);
  if (course.price && due > 0) return Math.round((course.price - due) * 100) / 100;
  return null;
}

// ── Tier badge ────────────────────────────────────────────────────────────────

const TierBadge: React.FC<{ tier: ReturnType<typeof getPaymentTier> }> = ({ tier }) => {
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

// ── Payment info block shown inside the card ──────────────────────────────────

const PaymentInfoBlock: React.FC<{ course: Course }> = ({ course }) => {
  const tier = getPaymentTier(course);
  const currency = course.currency || 'USD';

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
    const amountDue = getAmountDue(course);
    const scholarshipCover = getScholarshipCover(course);
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
              {course.partial_payment_percentage != null && (
                <p className="text-xs text-indigo-500 mt-0.5">{course.partial_payment_percentage}% of total</p>
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
          {course.price != null && (
            <p className="text-xs text-gray-500 mt-2 pb-1">
              Total program cost: <span className="text-gray-400 font-medium">{currency} {course.price.toLocaleString()}</span>
            </p>
          )}
        </div>
      </div>
    );
  }

  // full_tuition
  const fullPrice = course.payment_summary?.amount_due_now ?? course.price;
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

function getApplyLabel(course: Course): string {
  const tier = getPaymentTier(course);
  const currency = course.currency || 'USD';
  if (tier === 'free') return 'Enroll Free';
  if (tier === 'scholarship') return 'Apply for Scholarship';
  if (tier === 'partial_scholarship') {
    const due = getAmountDue(course);
    return due > 0 ? `Apply & Pay ${currency} ${due.toLocaleString()}` : 'Apply & Pay';
  }
  const full = course.payment_summary?.amount_due_now ?? course.price;
  return full != null && full > 0 ? `Apply & Pay ${currency} ${full.toLocaleString()}` : 'Apply Now';
}

// ── Public Course Card ────────────────────────────────────────────────────────

const PublicCourseCard: React.FC<{ course: Course }> = ({ course }) => {
  const tier = getPaymentTier(course);

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
            {course.level && (
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-white/20 text-white shrink-0">
                {course.level}
              </span>
            )}
          </div>
          <h3 className="text-lg font-bold text-white line-clamp-2 leading-snug group-hover:text-white/90 transition-colors">
            {course.title}
          </h3>
        </div>
      </div>

      {/* Body */}
      <div className="px-5 py-4 flex-grow flex flex-col gap-4">
        <p className="text-gray-400 text-sm line-clamp-3 leading-relaxed">
          {course.description || 'No description available'}
        </p>

        {/* Meta */}
        <div className="space-y-1.5 text-sm text-gray-400">
          {course.instructor_name && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="truncate">{course.instructor_name}</span>
            </div>
          )}
          {course.estimated_duration && (
            <div className="flex items-center gap-2">
              <svg className="w-3.5 h-3.5 text-gray-500 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{course.estimated_duration}</span>
            </div>
          )}
        </div>

        {/* Payment info block */}
        <PaymentInfoBlock course={course} />
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
            <span>{getApplyLabel(course)}</span>
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
};

const PublicCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadCourses = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Fetching courses from:', process.env.NEXT_PUBLIC_API_URL);
        // Fetch courses from backend API
        const response = await CourseApiService.getCourses({
          page: 1,
          per_page: 100,
          sort_by: 'recent'
        });
        
        // Handle both array response and paginated response
        const fetchedCourses = Array.isArray(response) 
          ? response 
          : (response.items || []);
        
        console.log('Fetched courses:', fetchedCourses.length, 'courses');
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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
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

      <main className="py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Hero Section */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Explore Our Courses
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto mb-4">
              Browse our selection of tech courses and apply directly online. 
              Our AI-powered scoring system ensures fair evaluation for all applicants.
            </p>
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-full text-emerald-400 text-sm">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>Instant Application • AI-Fair Selection • Free Training</span>
            </div>
          </div>

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
            /* Show message when no courses available */
            <div className="text-center py-16">
              <div className="bg-white/5 backdrop-blur-sm border border-gray-700 rounded-xl p-8 max-w-md mx-auto">
                <div className="text-6xl mb-4">📚</div>
                <h3 className="text-2xl font-bold text-white mb-3">No Courses Available Yet</h3>
                <p className="text-gray-300 mb-6">
                  We're working on adding amazing courses for you. Check back soon or sign in to get notified when new courses are available!
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
                  <button
                    onClick={() => window.location.reload()}
                    className="block w-full px-6 py-3 border border-gray-600 hover:border-gray-500 text-gray-400 hover:text-white font-medium rounded-lg transition-colors"
                  >
                    🔄 Refresh Page
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Show courses if available */
            <>
              <div className="mb-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-white">
                    Available Courses
                    <span className="ml-3 text-lg font-normal text-gray-400">({courses.length} {courses.length === 1 ? 'course' : 'courses'})</span>
                  </h2>
                  <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-600 rounded-lg transition-all flex items-center gap-2"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>
              <div className="grid gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
                {courses.map((course) => (
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
                Click "Apply Now" on any course to get started - no registration required!
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
    </div>
  );
};

export default PublicCoursesPage;