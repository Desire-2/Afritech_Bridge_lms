'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import CourseApplicationForm from '@/components/applications/CourseApplicationForm';
import { CourseApiService } from '@/services/api';
import { Course } from '@/services/api/types';
import type { ApplicationWindowData } from '@/types/api';
import {
  normalizeApplicationWindows,
  getPrimaryWindow,
  formatDate,
  formatDateTime,
} from '@/utils/cohort-utils';
import { Loader2, AlertCircle, CheckCircle2, BookOpen, Clock, User, ArrowLeft, CreditCard, GraduationCap, Shield } from 'lucide-react';
import { CurrencySelector, ConvertedBadge } from '@/components/ui/CurrencyDisplay';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

export default function CourseApplicationPage() {
  const params = useParams();
  const router = useRouter();
  const courseId = parseInt(params.id as string);
  
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checkingExisting, setCheckingExisting] = useState(false);
  const [existingApplication, setExistingApplication] = useState<any>(null);
  const [selectedWindowId, setSelectedWindowId] = useState<string | null>(null);

  // Normalise all windows from the course
  const allWindows = useMemo(() => {
    if (!course) return [];
    return normalizeApplicationWindows(course);
  }, [course]);

  // Determine the active/selected window
  const selectedWindow = useMemo<ApplicationWindowData | undefined>(() => {
    if (!allWindows.length) return undefined;
    if (selectedWindowId) {
      const match = allWindows.find((w) => String(w.id) === selectedWindowId);
      if (match) return match;
    }
    return getPrimaryWindow(allWindows);
  }, [allWindows, selectedWindowId]);

  useEffect(() => {
    const loadCourse = async () => {
      try {
        const course = await CourseApiService.getCourseDetails(courseId);
        setCourse(course);
      } catch (err: any) {
        setError(err.message || 'Failed to load course');
      } finally {
        setLoading(false);
      }
    };

    if (courseId) {
      loadCourse();
    }
  }, [courseId]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800">
        <Loader2 className="w-12 h-12 animate-spin text-sky-600 mb-4" />
        <p className="text-gray-600 dark:text-gray-400">Loading course details...</p>
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-gray-900 dark:to-gray-800 py-12">
        <div className="container mx-auto px-4 max-w-2xl">
          <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-900">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5" />
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-red-900 dark:text-red-200 mb-2">
                    Unable to Load Course
                  </h3>
                  <p className="text-red-700 dark:text-red-300 mb-4">
                    {error || 'Course not found'}
                  </p>
                  <div className="flex gap-3">
                    <Button
                      variant="outline"
                      onClick={() => router.back()}
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Go Back
                    </Button>
                    <Button
                      onClick={() => router.push('/courses')}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      Browse Courses
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-slate-100 to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 py-12">
      <div className="container mx-auto px-4 max-w-4xl">
        {allWindows.length > 0 && (
          <div className="mb-6 space-y-4">
            {/* Cohort picker — shown when multiple windows exist */}
            {allWindows.length > 1 && (
              <Card className="border-blue-100 dark:border-blue-900 bg-blue-50/40 dark:bg-blue-950/30">
                <CardContent className="pt-5 pb-4">
                  <label className="block text-sm font-semibold text-blue-900 dark:text-blue-100 mb-3">
                    Select a cohort to apply for
                  </label>
                  <div className="space-y-2">
                    {allWindows.map((win) => {
                      const isSelected = String(win.id) === String(selectedWindow?.id);
                      const statusColor =
                        win.status === 'open'
                          ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                          : win.status === 'upcoming'
                          ? 'bg-blue-100 text-blue-800 border-blue-300'
                          : 'bg-amber-100 text-amber-800 border-amber-300';

                      // Cohort-specific tier
                      const winEffType = win.effective_enrollment_type ?? win.enrollment_type ?? course.enrollment_type;
                      const winScholarshipType = win.scholarship_type;
                      const isFree = winEffType === 'free';
                      const isScholarship = winEffType === 'scholarship' && winScholarshipType !== 'partial';
                      const isPartial = (winEffType === 'scholarship' && winScholarshipType === 'partial') ||
                                        (winEffType === 'paid' && (win.payment_mode ?? course.payment_mode) === 'partial');
                      const tierBadge = isFree
                        ? { label: '✨ Free', cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' }
                        : isScholarship
                        ? { label: '🎓 Full Scholarship', cls: 'bg-amber-100 text-amber-700 border-amber-300' }
                        : isPartial
                        ? { label: '🎓 Partial Scholarship', cls: 'bg-indigo-100 text-indigo-700 border-indigo-300' }
                        : { label: '💳 Paid', cls: 'bg-blue-100 text-blue-700 border-blue-300' };

                      const winPs = win.payment_summary;
                      const winPrice = winPs?.amount_due_now ?? win.effective_price ?? win.price;
                      const winCurrency = win.effective_currency ?? win.currency ?? course.currency ?? 'USD';

                      return (
                        <button
                          key={String(win.id)}
                          onClick={() => setSelectedWindowId(String(win.id))}
                          className={`w-full text-left rounded-xl p-3 border-2 transition-all ${
                            isSelected
                              ? 'border-blue-500 bg-white dark:bg-slate-700 shadow-md'
                              : 'border-transparent bg-white/60 dark:bg-slate-800/60 hover:bg-white dark:hover:bg-slate-700'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-slate-900 dark:text-white">
                                {win.cohort_label || `Cohort ${win.id}`}
                              </span>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${statusColor}`}>
                                {win.status}
                              </Badge>
                              <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${tierBadge.cls}`}>
                                {tierBadge.label}
                              </Badge>
                            </div>
                            {!isFree && !isScholarship && winPrice != null && winPrice > 0 && (
                              <span className="text-sm font-bold text-indigo-700 dark:text-indigo-300 whitespace-nowrap">
                                {winCurrency} {winPrice.toLocaleString()}
                              </span>
                            )}
                          </div>
                          {win.description && (
                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{win.description}</p>
                          )}
                          <div className="flex items-center gap-3 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
                            {win.closes_at && (
                              <span>Deadline: {formatDate(win.closes_at)}</span>
                            )}
                            {win.cohort_start && (
                              <span>Starts: {formatDate(win.cohort_start)}</span>
                            )}
                            {win.max_students && (
                              <span>{win.enrollment_count ?? 0}/{win.max_students} seats</span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Selected window info banner */}
            {selectedWindow && (
              <Alert className="border-sky-200 dark:border-sky-900 bg-white dark:bg-slate-800">
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-md bg-sky-100 dark:bg-sky-900">
                    <Clock className="w-5 h-5 text-sky-700 dark:text-sky-300" />
                  </div>
                  <div className="flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white uppercase">
                        Application window: {selectedWindow.status}
                      </p>
                      {selectedWindow.cohort_label && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-600">
                          {selectedWindow.cohort_label}
                        </span>
                      )}
                    </div>
                    <div className="text-sm text-slate-700 dark:text-slate-300">
                      {selectedWindow.status === 'open' && (
                        <span>Apply now before the deadline below. Late submissions are not accepted.</span>
                      )}
                      {selectedWindow.status === 'upcoming' && (
                        <span>Applications are not open yet. You can review details now and return when the window opens.</span>
                      )}
                      {selectedWindow.status === 'closed' && (
                        <span>The window has closed. New applications cannot be submitted for this cohort.</span>
                      )}
                    </div>
                    {selectedWindow.description && (
                      <p className="text-sm text-slate-600 dark:text-slate-400 italic">{selectedWindow.description}</p>
                    )}
                    <div className="text-xs text-slate-500 dark:text-slate-400 flex flex-wrap gap-3">
                      <span>
                        Opens: {formatDateTime(selectedWindow.opens_at || course?.application_start_date) || 'Not set'}
                      </span>
                      <span>
                        Closes: {formatDateTime(selectedWindow.closes_at || course?.application_end_date) || 'Not set'}
                      </span>
                      <span>
                        Cohort Start: {formatDate(selectedWindow.cohort_start || course?.cohort_start_date) || 'Not set'}
                      </span>
                      {(selectedWindow.cohort_end || course?.cohort_end_date) && (
                        <span>
                          Cohort End: {formatDate(selectedWindow.cohort_end || course?.cohort_end_date)}
                        </span>
                      )}
                      {selectedWindow.max_students && (
                        <span>Capacity: {selectedWindow.enrollment_count ?? 0}/{selectedWindow.max_students} enrolled</span>
                      )}
                      {selectedWindow.reason && (
                        <span className="text-amber-700 dark:text-amber-300">Note: {selectedWindow.reason}</span>
                      )}
                    </div>
                  </div>
                </div>
              </Alert>
            )}
          </div>
        )}

        {/* Back Button */}
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => router.back()}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Course
          </Button>
        </div>

        {/* Course Information Card */}
        <Card className="mb-8 border-sky-200 dark:border-sky-900 shadow-lg">
          <CardHeader className="bg-gradient-to-r from-sky-500 to-blue-600 text-white rounded-t-lg">
            <div className="flex items-start gap-4">
              <div className="p-3 bg-white/20 rounded-lg backdrop-blur-sm">
                <BookOpen className="w-6 h-6" />
              </div>
              <div className="flex-1">
                <CardTitle className="text-2xl mb-2">Apply for Course</CardTitle>
                <CardDescription className="text-sky-100 text-base">
                  {course.title}
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {course.instructor_name && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-sky-100 dark:bg-sky-900 rounded-lg">
                    <User className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Instructor</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{course.instructor_name}</p>
                  </div>
                </div>
              )}
              {course.estimated_duration && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                    <Clock className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Duration</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{course.estimated_duration}</p>
                  </div>
                </div>
              )}
              {course.level && (
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg">
                    <CheckCircle2 className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Level</p>
                    <p className="font-semibold text-gray-900 dark:text-white capitalize">{course.level}</p>
                  </div>
                </div>
              )}
            </div>
            
            {course.description && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">About this course</h4>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {course.description.substring(0, 300)}{course.description.length > 300 ? '...' : ''}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Payment Information Card (cohort-aware) ─────────────────────────── */}
        {(() => {
          // Derive effective payment info from selected cohort window
          const effType = selectedWindow?.effective_enrollment_type ?? selectedWindow?.enrollment_type ?? course.enrollment_type;
          const effPrice = selectedWindow?.effective_price ?? selectedWindow?.price ?? course.price;
          const effCurrency = selectedWindow?.effective_currency ?? selectedWindow?.currency ?? course.currency ?? 'USD';
          const effPaymentMode = selectedWindow?.payment_mode ?? course.payment_mode;
          const effScholarshipType = selectedWindow?.scholarship_type;
          const effPartialAmount = selectedWindow?.partial_payment_amount ?? course.partial_payment_amount;
          const isScholarshipPartial = effType === 'scholarship' && effScholarshipType === 'partial';
          const scholarshipPct = selectedWindow?.scholarship_percentage;
          // For scholarship: student pays (100 - scholarship_percentage)%; for paid partial: use partial_payment_percentage directly
          const effStudentPct = isScholarshipPartial && scholarshipPct != null
            ? Math.round((100 - scholarshipPct) * 100) / 100
            : (selectedWindow?.partial_payment_percentage ?? course.partial_payment_percentage);
          const effPaymentMethods = selectedWindow?.payment_methods ?? course.payment_methods;
          const ps = selectedWindow?.payment_summary ?? course.payment_summary;
          const originalPrice = ps?.original_price ?? course.price; // Pre-scholarship total

          const isFree = effType === 'free';
          const isScholarship = effType === 'scholarship' && effScholarshipType !== 'partial';
          const isPartial = (effType === 'scholarship' && effScholarshipType === 'partial') ||
                            (effType === 'paid' && effPaymentMode === 'partial');
          const isPaid = effType === 'paid' && !isPartial;

          if (isFree) return null; // No payment card for free courses

          return (
            <Card className={`mb-8 overflow-hidden shadow-lg ${
              isScholarship ? 'border-amber-200' : 'border-indigo-200'
            }`}>
              <CardHeader className={`py-4 px-6 ${
                isScholarship
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
                  : isPartial
                  ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 text-white'
              }`}>
                <CardTitle className="flex items-center gap-2 text-lg">
                  {isScholarship ? (
                    <GraduationCap className="w-5 h-5" />
                  ) : (
                    <CreditCard className="w-5 h-5" />
                  )}
                  {isScholarship
                    ? 'Scholarship Enrollment'
                    : isPartial
                    ? 'Partial Scholarship'
                    : 'Full Tuition — Payment Details'}
                </CardTitle>
                {selectedWindow?.cohort_label && allWindows.length > 1 && (
                  <CardDescription className="text-white/80 text-sm mt-1">
                    For {selectedWindow.cohort_label}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-6 px-6 pb-6">
                {isScholarship ? (
                  /* ── Full Scholarship ── */
                  <div className="space-y-4">
                    <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
                      <GraduationCap className="w-6 h-6 text-amber-600 mt-0.5 shrink-0" />
                      <div className="space-y-1">
                        <p className="font-semibold text-amber-900">Merit-Based Scholarship</p>
                        <p className="text-sm text-amber-700 leading-relaxed">
                          This course is offered through a competitive scholarship program. Complete and submit
                          your application — our admissions team will review your submission and notify you
                          of your scholarship status by email within 2–3 business days.
                        </p>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                      <div className="bg-gray-50 rounded-xl p-3 border">
                        <p className="text-gray-500 text-xs mb-1">Tuition Cost</p>
                        <p className="font-bold text-emerald-700 text-lg">Fully Covered</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border">
                        <p className="text-gray-500 text-xs mb-1">Selection</p>
                        <p className="font-bold text-gray-900">Competitive</p>
                      </div>
                      <div className="bg-gray-50 rounded-xl p-3 border">
                        <p className="text-gray-500 text-xs mb-1">Response Time</p>
                        <p className="font-bold text-gray-900">2–3 business days</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* ── Paid course (full or partial) ── */
                  <div className="space-y-5">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-500">
                        {selectedWindow?.cohort_label ? `${selectedWindow.cohort_label} fees` : 'Course fees'}
                      </p>
                      <CurrencySelector compact />
                    </div>
                    {/* Price breakdown */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      {isPartial ? (
                        <>
                          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 sm:col-span-1">
                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Your Contribution</p>
                            <p className="text-2xl font-bold text-indigo-700">
                              {(() => {
                                const amt = ps?.amount_due_now ?? effPartialAmount;
                                return amt != null
                                  ? `${effCurrency} ${Number(amt).toLocaleString()}`
                                  : 'TBD';
                              })()}
                            </p>
                            <ConvertedBadge
                              amount={ps?.amount_due_now ?? effPartialAmount ?? undefined}
                              currency={effCurrency}
                              className="text-sm block mt-0.5"
                            />
                            {effStudentPct != null && effStudentPct > 0 && (
                              <p className="text-xs text-indigo-400 mt-0.5">
                                {isScholarshipPartial
                                  ? `${effStudentPct}% of total — rest covered by scholarship`
                                  : `${effStudentPct}% payment now`}
                              </p>
                            )}
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 sm:col-span-1">
                            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Covered by Scholarship</p>
                            <p className="text-2xl font-bold text-emerald-700">
                              {(() => {
                                const amtDue = ps?.amount_due_now ?? effPartialAmount ?? 0;
                                if (originalPrice && amtDue > 0) {
                                  return `${effCurrency} ${(originalPrice - amtDue).toLocaleString()}`;
                                }
                                return '—';
                              })()}
                            </p>
                            <ConvertedBadge
                              amount={originalPrice && (ps?.amount_due_now ?? effPartialAmount) ? originalPrice - (ps?.amount_due_now ?? effPartialAmount ?? 0) : undefined}
                              currency={effCurrency}
                              className="text-sm block"
                            />
                            <p className="text-xs text-emerald-500 mt-0.5">Scholarship covers this amount</p>
                          </div>
                          <div className="bg-gray-50 rounded-xl p-4 border sm:col-span-1">
                            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Total Program Cost</p>
                            <p className="text-2xl font-bold text-gray-700">
                              {originalPrice ? `${effCurrency} ${originalPrice.toLocaleString()}` : '—'}
                            </p>
                            <ConvertedBadge amount={originalPrice ?? undefined} currency={effCurrency} className="text-sm block" />
                            <p className="text-xs text-gray-400 mt-0.5">You only pay your contribution</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-200 sm:col-span-2">
                            <p className="text-xs font-semibold text-indigo-500 uppercase tracking-wide mb-1">Full Tuition</p>
                            <p className="text-3xl font-bold text-indigo-700">
                              {effPrice
                                ? `${effCurrency} ${effPrice.toLocaleString()}`
                                : 'Price on request'}
                            </p>
                            <ConvertedBadge amount={effPrice ?? undefined} currency={effCurrency} className="text-sm block mt-0.5" />
                            <p className="text-xs text-indigo-400 mt-1">One-time payment · Lifetime course access</p>
                          </div>
                          <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-200 sm:col-span-1">
                            <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide mb-1">Includes</p>
                            <ul className="text-xs text-emerald-700 space-y-1">
                              <li>✓ All modules &amp; lessons</li>
                              <li>✓ Assessments</li>
                              <li>✓ Certificate</li>
                              <li>✓ Lifetime access</li>
                            </ul>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Payment methods */}
                    {effPaymentMethods && effPaymentMethods.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Accepted Payment Methods</p>
                        <div className="flex flex-wrap gap-2">
                          {effPaymentMethods.includes('kpay') && (
                            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-violet-500" />
                              <span className="text-sm font-medium text-violet-700">K-Pay</span>
                              <span className="text-xs text-violet-400">· MoMo, Visa, SPENN</span>
                            </div>
                          )}
                          {effPaymentMethods.includes('paypal') && (
                            <div className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-blue-500" />
                              <span className="text-sm font-medium text-blue-700">PayPal</span>
                              <span className="text-xs text-blue-400">· Credit/Debit card</span>
                            </div>
                          )}
                          {effPaymentMethods.includes('stripe') && (
                            <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-violet-500" />
                              <span className="text-sm font-medium text-violet-700">Card (Stripe)</span>
                              <span className="text-xs text-violet-400">· Visa, MC, Amex</span>
                            </div>
                          )}
                          {effPaymentMethods.includes('mobile_money') && (
                            <div className="flex items-center gap-2 bg-yellow-50 border border-yellow-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-yellow-500" />
                              <span className="text-sm font-medium text-yellow-700">Mobile Money</span>
                              <span className="text-xs text-yellow-500">· MTN, Airtel</span>
                            </div>
                          )}
                          {effPaymentMethods.includes('flutterwave') && (
                            <div className="flex items-center gap-2 bg-orange-50 border border-orange-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-orange-500" />
                              <span className="text-sm font-medium text-orange-700">Flutterwave</span>
                              <span className="text-xs text-orange-400">· Card, MoMo, Bank, USSD</span>
                            </div>
                          )}
                          {effPaymentMethods.includes('bank_transfer') && (
                            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                              <div className="w-2 h-2 rounded-full bg-emerald-500" />
                              <span className="text-sm font-medium text-emerald-700">Bank Transfer</span>
                              <span className="text-xs text-emerald-400">· Wire / SWIFT</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-xs text-gray-400 border-t pt-4">
                      <Shield className="w-3 h-3 shrink-0" />
                      <span>Payment is processed securely. A 30-day refund policy applies for full-payment enrollments.</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })()}
        {selectedWindow?.status === 'closed' || selectedWindow?.status === 'upcoming' ? (
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40">
            <CardContent className="py-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-6 h-6 text-amber-600 dark:text-amber-300 mt-1" />
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
                    Applications are {selectedWindow?.status}
                    {selectedWindow?.cohort_label ? ` for ${selectedWindow.cohort_label}` : ''}
                  </h3>
                  {selectedWindow?.reason && (
                    <p className="text-sm text-amber-800 dark:text-amber-200">{selectedWindow.reason}</p>
                  )}
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    You will not be able to submit this form while the window is {selectedWindow?.status}.
                    {allWindows.some(w => w.status === 'open') 
                      ? ' Try selecting a different cohort above.'
                      : ' Please check the dates above and return when it is open.'}
                  </p>
                  <div className="flex gap-3">
                    <Button onClick={() => router.push('/courses')} variant="outline" className="border-amber-300 text-amber-800">
                      <ArrowLeft className="w-4 h-4 mr-2" />
                      Browse other courses
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <CourseApplicationForm
            courseId={courseId}
            courseTitle={course.title}
            courseData={course}
            selectedWindow={selectedWindow}
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
        )}
      </div>
    </div>
  );
}