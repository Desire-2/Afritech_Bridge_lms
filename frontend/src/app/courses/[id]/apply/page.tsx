'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import CourseApplicationForm from '@/components/applications/CourseApplicationForm';
import { CourseApiService } from '@/services/api';
import { Course } from '@/services/api/types';
import type { ApplicationWindowData } from '@/types/api';
import {
  normalizeApplicationWindows,
  formatDate,
} from '@/utils/cohort-utils';
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Check,
  Clock3,
  CreditCard,
  GraduationCap,
  Loader2,
  UserRound,
} from 'lucide-react';
import { CurrencySelector, ConvertedBadge } from '@/components/ui/CurrencyDisplay';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

function formatMoney(amount: number | null | undefined, currency: string): string {
  if (amount == null) return 'Not set';
  return `${currency} ${Number(amount).toLocaleString()}`;
}

function getWindowAmountDue(
  window: ApplicationWindowData,
  course: Course,
  isFullScholarship: boolean,
): number | null {
  const paymentSummary = window.payment_summary ?? course.payment_summary;
  if (paymentSummary?.amount_due_now != null) return paymentSummary.amount_due_now;
  if (isFullScholarship) return 0;
  return window.partial_payment_amount ?? course.partial_payment_amount ?? window.effective_price ?? window.price ?? course.price;
}

export default function CourseApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.id as string, 10);

  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  const allWindows = useMemo(() => {
    if (!course) return [];
    return normalizeApplicationWindows(course);
  }, [course]);

  // Only application windows whose live/backend status is open are eligible here.
  const openWindows = useMemo(
    () => allWindows.filter((window) => window.status === 'open'),
    [allWindows],
  );

  const upcomingWindow = useMemo(
    () => allWindows.find((window) => window.status === 'upcoming'),
    [allWindows],
  );

  const selectedWindow = useMemo<ApplicationWindowData | undefined>(() => {
    if (!openWindows.length) return undefined;
    if (selectedWindowId) {
      const match = openWindows.find((window) => String(window.id) === selectedWindowId);
      if (match) return match;
    }
    return openWindows[0];
  }, [openWindows, selectedWindowId]);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const courseData = await CourseApiService.getCourseDetails(courseId);
        setCourse(courseData);
      } catch (err: any) {
        setError(err.message || 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) loadCourse();
  }, [courseId]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#070a11] text-slate-100">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-300" aria-hidden="true" />
          <p className="text-sm text-slate-400">Loading application details…</p>
        </div>
      </main>
    );
  }

  if (error || !course) {
    return (
      <main className="min-h-screen bg-[#070a11] px-4 py-12 text-slate-100">
        <div className="mx-auto max-w-xl rounded-2xl border border-red-300/20 bg-red-950/20 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-300" aria-hidden="true" />
            <div>
              <h1 className="text-lg font-semibold">Unable to load this application</h1>
              <p className="mt-2 text-sm text-red-100/75">{error || 'Course not found'}</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Button variant="outline" onClick={() => router.back()} className="border-white/15 bg-transparent text-slate-200 hover:bg-white/10">
                  <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                  Go back
                </Button>
                <Button onClick={() => router.push('/courses')} className="bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                  Browse courses
                </Button>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const paymentSummary = selectedWindow?.payment_summary ?? course.payment_summary;
  const enrollmentType = selectedWindow?.effective_enrollment_type ?? selectedWindow?.enrollment_type ?? course.enrollment_type;
  const scholarshipType = selectedWindow?.scholarship_type;
  const isFullScholarship = enrollmentType === 'scholarship' && scholarshipType !== 'partial';
  const isPartialScholarship = enrollmentType === 'scholarship' && scholarshipType === 'partial';
  const isPartialPayment = enrollmentType === 'paid' && (selectedWindow?.payment_mode ?? course.payment_mode) === 'partial';
  const effectiveCurrency = selectedWindow?.effective_currency ?? selectedWindow?.currency ?? course.currency ?? 'USD';
  const originalPrice = paymentSummary?.original_price
    ?? selectedWindow?.effective_price
    ?? selectedWindow?.price
    ?? course.price;
  const amountDue = selectedWindow
    ? getWindowAmountDue(selectedWindow, course, isFullScholarship)
    : null;
  const coveredAmount = originalPrice != null && amountDue != null && originalPrice > amountDue
    ? originalPrice - amountDue
    : null;
  const applicationDeadline = selectedWindow?.closes_at ?? course.application_end_date;
  const cohortStart = selectedWindow?.cohort_start ?? course.cohort_start_date;
  const isFree = enrollmentType === 'free';

  return (
    <main className="min-h-screen bg-[#070a11] text-slate-100">
      <div className="mx-auto w-full max-w-[1180px] px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <Button
          variant="ghost"
          onClick={() => router.back()}
          className="mb-7 -ml-3 text-slate-400 hover:bg-white/[0.06] hover:text-white"
        >
          <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
          Back to course
        </Button>

        {openWindows.length === 0 ? (
          <section className="rounded-2xl border border-white/[0.1] bg-[#0d131e] p-6 shadow-2xl shadow-black/20 sm:p-8">
            <div className="max-w-2xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">Course application</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">{course.title}</h1>
              <div className="mt-8 flex items-start gap-3 rounded-xl border border-amber-300/20 bg-amber-300/[0.06] p-4">
                <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-200" aria-hidden="true" />
                <div>
                  <h2 className="font-semibold text-amber-100">Applications are not open</h2>
                  <p className="mt-1 text-sm leading-6 text-amber-100/70">
                    There are no open cohorts for this course right now. Please check back when a new application window opens.
                  </p>
                  {upcomingWindow?.opens_at && (
                    <p className="mt-3 text-sm font-medium text-amber-100">
                      Next application window: {formatDate(upcomingWindow.opens_at) || 'Date to be announced'}
                    </p>
                  )}
                </div>
              </div>
              <Button onClick={() => router.push('/courses')} className="mt-6 bg-cyan-300 text-slate-950 hover:bg-cyan-200">
                <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
                Browse available courses
              </Button>
            </div>
          </section>
        ) : (
          <>
            <header className="max-w-3xl">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-cyan-300/75">Course application</p>
              <h1 className="mt-3 text-3xl font-semibold tracking-[-0.05em] text-white sm:text-5xl">{course.title}</h1>
              {course.description && (
                <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400 sm:text-base">
                  {course.description.length > 220 ? `${course.description.slice(0, 220).trim()}…` : course.description}
                </p>
              )}
              <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs text-slate-400">
                {course.instructor_name && (
                  <span className="inline-flex items-center gap-1.5">
                    <UserRound className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {course.instructor_name}
                  </span>
                )}
                {course.estimated_duration && (
                  <span className="inline-flex items-center gap-1.5">
                    <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {course.estimated_duration}
                  </span>
                )}
                {course.level && (
                  <span className="inline-flex items-center gap-1.5 capitalize">
                    <BookOpen className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                    {course.level}
                  </span>
                )}
              </div>
            </header>

            <div className="mt-8 grid gap-5 lg:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)] lg:items-start">
              <section aria-labelledby="cohort-heading" className="rounded-2xl border border-white/[0.1] bg-[#0d131e] p-5 sm:p-6">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Available cohorts</p>
                    <h2 id="cohort-heading" className="mt-2 text-xl font-semibold text-white">Select a cohort</h2>
                  </div>
                  {openWindows.length > 1 && (
                    <span className="text-right text-xs text-slate-500">{openWindows.length} options available</span>
                  )}
                </div>

                <div className="mt-5 space-y-3">
                  {openWindows.map((window) => {
                    const isSelected = String(window.id) === String(selectedWindow?.id);
                    const windowType = window.effective_enrollment_type ?? window.enrollment_type ?? course.enrollment_type;
                    const windowIsScholarship = windowType === 'scholarship';
                    const windowIsFullScholarship = windowIsScholarship && window.scholarship_type !== 'partial';
                    const windowCurrency = window.effective_currency ?? window.currency ?? course.currency ?? 'USD';
                    const windowAmount = getWindowAmountDue(window, course, windowIsFullScholarship);

                    return (
                      <button
                        key={String(window.id)}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setSelectedWindowId(String(window.id))}
                        className={`w-full rounded-xl border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-cyan-300/70 ${
                          isSelected
                            ? 'border-cyan-300/70 bg-cyan-300/[0.08]'
                            : 'border-white/[0.1] bg-white/[0.02] hover:border-white/25 hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-semibold text-white">{window.cohort_label || 'Available cohort'}</span>
                              <Badge className="border-emerald-300/20 bg-emerald-300/10 text-emerald-200">Applications open</Badge>
                            </div>
                            <div className="mt-3 grid gap-2 text-xs text-slate-400 sm:grid-cols-2">
                              <span className="inline-flex items-center gap-1.5">
                                <Clock3 className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                Deadline: {formatDate(window.closes_at) || 'Not set'}
                              </span>
                              <span className="inline-flex items-center gap-1.5">
                                <CalendarDays className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                                Starts: {formatDate(window.cohort_start) || 'Not set'}
                              </span>
                            </div>
                          </div>
                          <span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                            isSelected ? 'border-cyan-200 bg-cyan-200 text-slate-950' : 'border-white/20 text-transparent'
                          }`} aria-hidden="true">
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-white/[0.08] pt-3 text-xs">
                          <span className="inline-flex items-center gap-1.5 text-slate-400">
                            <CreditCard className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
                            {windowIsFullScholarship ? 'Full scholarship' : windowAmount != null ? formatMoney(windowAmount, windowCurrency) : 'Payment details available below'}
                          </span>
                          {window.max_students && (
                            <span className="text-slate-500">{window.enrollment_count ?? 0}/{window.max_students} seats</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              <aside className="space-y-5">
                <section className="rounded-2xl border border-emerald-300/20 bg-emerald-300/[0.06] p-5 sm:p-6" aria-labelledby="deadline-heading">
                  <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-emerald-200">
                    <span className="h-2 w-2 rounded-full bg-emerald-300" aria-hidden="true" />
                    Applications open
                  </div>
                  <h2 id="deadline-heading" className="mt-4 text-sm font-medium text-slate-300">Application deadline</h2>
                  <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-white">
                    {formatDate(applicationDeadline) || 'Not set'}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-emerald-200/10 pt-4 text-xs">
                    <div>
                      <p className="text-emerald-100/50">Cohort starts</p>
                      <p className="mt-1 font-medium text-emerald-50">{formatDate(cohortStart) || 'Not set'}</p>
                    </div>
                    <div>
                      <p className="text-emerald-100/50">Selected cohort</p>
                      <p className="mt-1 truncate font-medium text-emerald-50">{selectedWindow?.cohort_label || 'Available cohort'}</p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-white/[0.1] bg-[#0d131e] p-5 sm:p-6" aria-labelledby="payment-heading">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Payment</p>
                      <h2 id="payment-heading" className="mt-2 text-xl font-semibold text-white">Payment overview</h2>
                    </div>
                    <CurrencySelector compact />
                  </div>

                  {isFree ? (
                    <div className="mt-5 rounded-xl border border-emerald-300/20 bg-emerald-300/[0.06] p-4">
                      <p className="text-xs text-emerald-200/70">Enrollment cost</p>
                      <p className="mt-1 text-xl font-semibold text-emerald-100">No payment required</p>
                    </div>
                  ) : isFullScholarship ? (
                    <div className="mt-5 rounded-xl border border-violet-300/20 bg-violet-300/[0.06] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
                        <GraduationCap className="h-4 w-4" aria-hidden="true" />
                        Full scholarship
                      </div>
                      {originalPrice != null && (
                        <p className="mt-3 text-sm text-violet-100/75">
                          Program cost: <span className="font-semibold text-violet-50">{formatMoney(originalPrice, effectiveCurrency)}</span>
                        </p>
                      )}
                    </div>
                  ) : isPartialScholarship || isPartialPayment ? (
                    <div className="mt-5 space-y-3">
                      <div className="rounded-xl border border-cyan-300/25 bg-cyan-300/[0.09] p-4">
                        <p className="text-xs font-semibold uppercase tracking-[0.14em] text-cyan-100/70">You contribute</p>
                        <p className="mt-1 text-2xl font-semibold tracking-[-0.03em] text-cyan-50">{formatMoney(amountDue, effectiveCurrency)}</p>
                        {amountDue != null && <ConvertedBadge amount={amountDue} currency={effectiveCurrency} className="mt-1 text-xs" />}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                          <p className="text-slate-500">{isPartialScholarship ? 'Scholarship covers' : 'Remaining balance'}</p>
                          <p className="mt-1 font-semibold text-slate-200">{formatMoney(coveredAmount, effectiveCurrency)}</p>
                        </div>
                        <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                          <p className="text-slate-500">Total program cost</p>
                          <p className="mt-1 font-semibold text-slate-200">{formatMoney(originalPrice, effectiveCurrency)}</p>
                        </div>
                      </div>
                      {selectedWindow?.scholarship_percentage != null && (
                        <p className="text-xs text-slate-500">Scholarship covers {selectedWindow.scholarship_percentage}% of the program cost.</p>
                      )}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl border border-white/[0.1] bg-white/[0.025] p-4">
                      <p className="text-xs text-slate-500">Amount due</p>
                      <p className="mt-1 text-2xl font-semibold text-white">{formatMoney(amountDue ?? originalPrice, effectiveCurrency)}</p>
                      {(amountDue ?? originalPrice) != null && (
                        <ConvertedBadge amount={amountDue ?? originalPrice ?? undefined} currency={effectiveCurrency} className="mt-1 text-xs" />
                      )}
                    </div>
                  )}
                </section>
              </aside>
            </div>

            <section className="mt-8 overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0d131e]" aria-labelledby="application-form-heading">
              <div className="flex flex-col gap-3 border-b border-white/[0.08] px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-cyan-300/70">Application</p>
                  <h2 id="application-form-heading" className="mt-2 text-2xl font-semibold text-white">Complete your application</h2>
                  <p className="mt-1 text-sm text-slate-400">Your selected cohort is shown below. Complete the form to submit your application.</p>
                </div>
                <Badge className="w-fit border-cyan-300/20 bg-cyan-300/10 text-cyan-100">
                  {selectedWindow?.cohort_label || 'Selected cohort'}
                </Badge>
              </div>

              <div className="bg-white p-3 text-slate-900 sm:p-6">
                {/* PROTECTED APPLICATION FORM: keep this component and its props/functionality unchanged. */}
                <CourseApplicationForm
                  courseId={courseId}
                  courseTitle={course.title}
                  courseData={course}
                  selectedWindow={selectedWindow}
                  skillAssessmentConfig={(course as any).skill_assessment_config}
                  onSuccess={(applicationId) => {
                    console.log('Application submitted:', applicationId);
                    setTimeout(() => {
                      router.push('/courses');
                    }, 5000);
                  }}
                  onCancel={() => {
                    router.back();
                  }}
                />
              </div>
            </section>
          </>
        )}
      </div>
    </main>
  );
}
