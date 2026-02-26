'use client';

import React, { useState, useEffect, useCallback } from 'react';
import waitlistService, {
  WaitlistMigrationSummary,
  UnpaidEnrollment,
} from '@/services/api/waitlist.service';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  ArrowRightLeft,
  CreditCard,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Users,
  Clock,
  ShieldCheck,
  XCircle,
  Ban,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────
interface CourseOption {
  id: number;
  title: string;
}

// ─── Component ──────────────────────────────────────────────────────
export default function AdminWaitlistPage() {
  // State
  const [courses, setCourses] = useState<CourseOption[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [summary, setSummary] = useState<WaitlistMigrationSummary | null>(null);
  const [unpaidEnrollments, setUnpaidEnrollments] = useState<UnpaidEnrollment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Verify payment dialog state
  const [verifyDialogOpen, setVerifyDialogOpen] = useState(false);
  const [verifyEnrollmentId, setVerifyEnrollmentId] = useState<number | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'completed' | 'waived' | 'failed'>('completed');
  const [verifyNotes, setVerifyNotes] = useState('');
  const [verifyLoading, setVerifyLoading] = useState(false);

  // Bulk migrate state
  const [migrateLoading, setMigrateLoading] = useState(false);

  // Load course list from the summary or a generic endpoint
  // For now we'll use an API call via waitlistService to detect courses with waitlisted apps
  useEffect(() => {
    // Load unpaid enrollments on mount (all courses)
    loadUnpaidEnrollments();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      loadSummary(parseInt(selectedCourseId));
    } else {
      setSummary(null);
    }
  }, [selectedCourseId]);

  const loadSummary = async (courseId: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await waitlistService.getMigrationSummary(courseId);
      setSummary(res.data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load migration summary');
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  const loadUnpaidEnrollments = async (courseId?: number) => {
    try {
      const res = await waitlistService.listUnpaidEnrollments(
        courseId ? { course_id: courseId } : undefined
      );
      setUnpaidEnrollments(res.data || []);

      // Extract unique courses from unpaid list for course selector
      const courseMap = new Map<number, string>();
      (res.data || []).forEach((e: UnpaidEnrollment) => {
        if (!courseMap.has(e.course_id)) {
          courseMap.set(e.course_id, e.course_title);
        }
      });
      setCourses(Array.from(courseMap, ([id, title]) => ({ id, title })));
    } catch {
      // Silently fail — unpaid may just be empty
    }
  };

  const handleBulkMigrate = async () => {
    if (!selectedCourseId) return;
    if (!confirm('Migrate all waitlisted applications to the next available cohort?')) return;
    setMigrateLoading(true);
    setError(null);
    try {
      const res = await waitlistService.bulkMigrateWaitlist({
        course_id: parseInt(selectedCourseId),
        send_emails: true,
      });
      alert(
        `Migrated ${res.data.migrated_count} application(s) to ${res.data.target_cohort_label}.\n` +
        `Failed: ${res.data.failed_count}`
      );
      loadSummary(parseInt(selectedCourseId));
      loadUnpaidEnrollments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Bulk migration failed');
    } finally {
      setMigrateLoading(false);
    }
  };

  const openVerifyDialog = (enrollmentId: number) => {
    setVerifyEnrollmentId(enrollmentId);
    setVerifyStatus('completed');
    setVerifyNotes('');
    setVerifyDialogOpen(true);
  };

  const handleVerifyPayment = async () => {
    if (!verifyEnrollmentId) return;
    setVerifyLoading(true);
    try {
      await waitlistService.verifyEnrollmentPayment(verifyEnrollmentId, {
        payment_status: verifyStatus,
        notes: verifyNotes || undefined,
      });
      setVerifyDialogOpen(false);
      loadUnpaidEnrollments(selectedCourseId ? parseInt(selectedCourseId) : undefined);
      if (selectedCourseId) loadSummary(parseInt(selectedCourseId));
      alert('Payment status updated successfully.');
    } catch (err: any) {
      alert(`Failed: ${err.response?.data?.error || err.message}`);
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <ArrowRightLeft className="w-6 h-6 text-blue-600" />
            Waitlist & Payment Management
          </h1>
          <p className="text-muted-foreground mt-1">
            Migrate waitlisted applications and verify enrollment payments
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="unpaid" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unpaid" className="flex items-center gap-1.5">
            <CreditCard className="w-4 h-4" />
            Unpaid Enrollments
            {unpaidEnrollments.length > 0 && (
              <Badge variant="destructive" className="ml-1 text-xs">
                {unpaidEnrollments.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="migration" className="flex items-center gap-1.5">
            <ArrowRightLeft className="w-4 h-4" />
            Cohort Migration
          </TabsTrigger>
        </TabsList>

        {/* ── Unpaid Enrollments Tab ─────────────────────────────────── */}
        <TabsContent value="unpaid">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                Enrollments Pending Payment
              </CardTitle>
              <CardDescription>
                Students approved in paid cohorts whose payment hasn&apos;t been verified yet.
                They cannot access course content until payment is confirmed.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {unpaidEnrollments.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="w-10 h-10 mx-auto mb-2 text-green-500" />
                  <p>All enrollments are up to date — no pending payments.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {unpaidEnrollments.map((enrollment) => (
                    <div
                      key={enrollment.enrollment_id}
                      className="flex items-center justify-between p-4 rounded-lg border bg-white hover:shadow-sm transition-shadow"
                    >
                      <div className="flex-1 min-w-0 mr-4">
                        <p className="font-medium text-sm truncate">{enrollment.student_name}</p>
                        <p className="text-xs text-muted-foreground truncate">{enrollment.student_email}</p>
                        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                          <Badge variant="outline" className="text-xs">
                            {enrollment.course_title}
                          </Badge>
                          {enrollment.cohort_label && (
                            <Badge variant="secondary" className="text-xs">
                              {enrollment.cohort_label}
                            </Badge>
                          )}
                          <Badge
                            variant={enrollment.payment_status === 'pending' ? 'destructive' : 'outline'}
                            className="text-xs"
                          >
                            {enrollment.payment_status === 'pending' ? 'Unpaid' : enrollment.payment_status}
                          </Badge>
                          {enrollment.cohort_enrollment_type === 'scholarship' && enrollment.cohort_scholarship_type === 'partial' && (
                            <Badge variant="outline" className="text-xs border-purple-200 text-purple-700">
                              Partial Scholarship{enrollment.cohort_scholarship_percentage ? ` (${enrollment.cohort_scholarship_percentage}%)` : ''}
                            </Badge>
                          )}
                          {enrollment.cohort_effective_price != null && enrollment.cohort_effective_price > 0 && (
                            <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">
                              {enrollment.cohort_currency || 'USD'} {enrollment.cohort_effective_price.toLocaleString()}
                            </Badge>
                          )}
                          {enrollment.migrated_from_window_id && (
                            <Badge variant="outline" className="text-xs border-blue-200 text-blue-700">
                              Migrated
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          onClick={() => openVerifyDialog(enrollment.enrollment_id)}
                          className="bg-green-600 hover:bg-green-700"
                        >
                          <ShieldCheck className="w-4 h-4 mr-1" />
                          Verify
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Cohort Migration Tab ───────────────────────────────────── */}
        <TabsContent value="migration">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <ArrowRightLeft className="w-5 h-5 text-blue-600" />
                    Waitlist Migration Summary
                  </CardTitle>
                  <CardDescription>
                    Select a course to see waitlisted applications and migrate them to the next cohort.
                  </CardDescription>
                </div>
                {selectedCourseId && (
                  <Button
                    onClick={handleBulkMigrate}
                    disabled={migrateLoading || !summary?.total_waitlisted}
                    className="bg-blue-600 hover:bg-blue-700"
                  >
                    {migrateLoading ? (
                      <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <ArrowRightLeft className="w-4 h-4 mr-2" />
                    )}
                    Bulk Migrate All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Course selector — type course ID for now; could be enhanced with a search */}
              <div>
                <Label>Course ID</Label>
                <div className="flex gap-2 mt-1">
                  <input
                    type="number"
                    placeholder="Enter course ID..."
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                  />
                  <Button
                    variant="outline"
                    onClick={() => selectedCourseId && loadSummary(parseInt(selectedCourseId))}
                    disabled={loading || !selectedCourseId}
                  >
                    {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Load'}
                  </Button>
                </div>
              </div>

              {/* Summary Data */}
              {summary && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground">Course</div>
                      <div className="font-semibold mt-1 truncate">{summary.course_title}</div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground">Total Waitlisted</div>
                      <div className="text-2xl font-bold text-amber-600 mt-1">
                        {summary.total_waitlisted}
                      </div>
                    </Card>
                    <Card className="p-4">
                      <div className="text-sm text-muted-foreground">Next Cohort</div>
                      <div className="font-semibold mt-1 truncate">
                        {summary.next_available_cohort
                          ? summary.next_available_cohort.cohort_label
                          : 'None available'}
                      </div>
                      {summary.next_available_cohort?.requires_payment && (
                        <Badge variant="outline" className="mt-1 text-xs border-amber-200 text-amber-700">
                          <CreditCard className="w-3 h-3 mr-1" /> Paid
                        </Badge>
                      )}
                    </Card>
                  </div>

                  {/* Cohort breakdown */}
                  {summary.cohorts.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium">Cohorts</h3>
                      {summary.cohorts.map((cohort) => (
                        <div
                          key={cohort.window_id}
                          className="p-4 rounded-lg border bg-white"
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium">{cohort.cohort_label || `Window #${cohort.window_id}`}</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">
                                {cohort.status}
                              </Badge>
                              {cohort.requires_payment && (
                                <Badge variant="outline" className="text-xs border-amber-200 text-amber-700">
                                  Paid ({cohort.effective_price} {cohort.effective_currency})
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm text-muted-foreground">
                            <div>
                              <Users className="w-3.5 h-3.5 inline mr-1" />
                              Enrolled: <strong className="text-foreground">{cohort.enrollment_count}{cohort.max_students ? `/${cohort.max_students}` : ''}</strong>
                            </div>
                            <div>
                              <Clock className="w-3.5 h-3.5 inline mr-1" />
                              Waitlisted: <strong className="text-foreground">{cohort.waitlisted_count}</strong>
                            </div>
                            <div>
                              <ArrowRightLeft className="w-3.5 h-3.5 inline mr-1" />
                              Migrated In: <strong className="text-foreground">{cohort.migrated_in_count}</strong>
                            </div>
                            {cohort.available_spots !== null && (
                              <div>
                                Available: <strong className="text-foreground">{cohort.available_spots}</strong>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {!summary && !loading && selectedCourseId && (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                  <p>No data available. Check the course ID and try again.</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ── Verify Payment Dialog ─────────────────────────────────── */}
      <Dialog open={verifyDialogOpen} onOpenChange={setVerifyDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              Verify Payment
            </DialogTitle>
            <DialogDescription>
              Update the payment status for this enrollment. This controls whether the student can access the course.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label htmlFor="verify_status">Payment Status</Label>
              <Select
                value={verifyStatus}
                onValueChange={(v) => setVerifyStatus(v as 'completed' | 'waived' | 'failed')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="completed">
                    <span className="flex items-center gap-1.5">
                      <CheckCircle className="w-3.5 h-3.5 text-green-600" />
                      Completed — Payment received
                    </span>
                  </SelectItem>
                  <SelectItem value="waived">
                    <span className="flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                      Waived — Scholarship / waiver
                    </span>
                  </SelectItem>
                  <SelectItem value="failed">
                    <span className="flex items-center gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-red-600" />
                      Failed — Payment rejected
                    </span>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="verify_notes">Notes (optional)</Label>
              <Textarea
                id="verify_notes"
                value={verifyNotes}
                onChange={(e) => setVerifyNotes(e.target.value)}
                rows={3}
                placeholder="Transaction reference, waiver reason, etc."
              />
            </div>

            {verifyStatus === 'completed' && (
              <Alert className="bg-green-50 border-green-200">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <AlertDescription className="text-green-800 text-sm">
                  This will grant the student full access to the course content.
                </AlertDescription>
              </Alert>
            )}

            {verifyStatus === 'failed' && (
              <Alert variant="destructive">
                <Ban className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  The student will remain blocked from accessing course content.
                </AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button
                variant="outline"
                onClick={() => setVerifyDialogOpen(false)}
                disabled={verifyLoading}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyPayment}
                disabled={verifyLoading}
                className={
                  verifyStatus === 'completed' || verifyStatus === 'waived'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }
              >
                {verifyLoading ? 'Saving...' : 'Update Payment Status'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
