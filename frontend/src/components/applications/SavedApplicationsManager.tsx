'use client';

import React, { useState, useEffect, useCallback } from 'react';
import applicationService from '@/services/api/application.service';
import { CourseApplication } from '@/services/api/types';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Clock,
  Download,
  Eye,
  Search,
  Users,
  AlertCircle,
  RefreshCw,
  FileText,
  Send,
  Mail,
  Phone,
  CalendarDays,
  GraduationCap,
  Layers,
  AlertTriangle,
} from 'lucide-react';

// ─── Types ──────────────────────────────────────────────────────────────
interface DraftStatistics {
  total_drafts: number;
  payment_breakdown: Record<string, number>;
  age_breakdown: {
    last_24h: number;
    last_7d: number;
    last_30d: number;
    stale_30d_plus: number;
  };
  course_breakdown: Array<{
    course_id: number;
    course_title: string;
    draft_count: number;
  }>;
}

/** Draft record enriched with course info from the backend */
interface DraftRecord extends CourseApplication {
  course_title?: string;
  course_price?: number;
  course_currency?: string;
}

interface Props {
  instructorId?: number; // If set, restrict to instructor's courses
}

export default function SavedApplicationsManager({ instructorId }: Props) {
  // Data
  const [drafts, setDrafts] = useState<DraftRecord[]>([]);
  const [statistics, setStatistics] = useState<DraftStatistics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [courseFilter, setCourseFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [submissionStatusFilter, setSubmissionStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const perPage = 20;

  // Detail modal
  const [selectedDraft, setSelectedDraft] = useState<CourseApplication | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);

  // Remind modal
  const [remindModalOpen, setRemindModalOpen] = useState(false);
  const [remindMessage, setRemindMessage] = useState('');
  const [remindLoading, setRemindLoading] = useState(false);

  // Contact modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [contactSubject, setContactSubject] = useState('');
  const [contactMessage, setContactMessage] = useState('');
  const [contactLoading, setContactLoading] = useState(false);

  const [actionError, setActionError] = useState<string | null>(null);

  // Bulk remind
  const [bulkRemindLoading, setBulkRemindLoading] = useState(false);
  const [bulkRemindConfirmOpen, setBulkRemindConfirmOpen] = useState(false);
  const [bulkRemindResult, setBulkRemindResult] = useState<{ sent: number; failed: number; total_stale: number; stale_days: number } | null>(null);
  const [bulkRemindResultOpen, setBulkRemindResultOpen] = useState(false);

  // Single remind result
  const [remindResult, setRemindResult] = useState<{ success: boolean; message: string } | null>(null);
  const [remindResultOpen, setRemindResultOpen] = useState(false);

  // Contact result
  const [contactResult, setContactResult] = useState<{ success: boolean; message: string } | null>(null);
  const [contactResultOpen, setContactResultOpen] = useState(false);

  // ─── Load data ─────────────────────────────────────────────────────
  const loadDrafts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: any = {
        page: currentPage,
        per_page: perPage,
      };
      if (searchInput) params.search = searchInput;
      if (courseFilter !== 'all') params.course_id = parseInt(courseFilter);
      if (paymentStatusFilter !== 'all') params.payment_status = paymentStatusFilter;
      if (submissionStatusFilter !== 'all') params.submission_status = submissionStatusFilter;
      if (instructorId) params.instructor_id = instructorId;

      const response = await applicationService.listDrafts(params);
      setDrafts((response.applications || []) as DraftRecord[]);
      setTotalPages(response.pages || 1);
    } catch (err: any) {
      setError(err.message || 'Failed to load saved applications');
    } finally {
      setLoading(false);
    }
  }, [currentPage, searchInput, courseFilter, paymentStatusFilter, instructorId]);

  const loadStatistics = useCallback(async () => {
    try {
      const params: any = {};
      if (instructorId) params.instructor_id = instructorId;
      const stats = await applicationService.getDraftStatistics(params);
      setStatistics(stats);
    } catch (err) {
      console.error('Failed to load draft statistics:', err);
    }
  }, [instructorId]);

  useEffect(() => {
    loadDrafts();
  }, [loadDrafts]);

  useEffect(() => {
    loadStatistics();
  }, [loadStatistics]);

  // ─── Actions ───────────────────────────────────────────────────────
  const handleBulkRemind = async () => {
    setBulkRemindConfirmOpen(false);
    setBulkRemindLoading(true);
    setActionError(null);
    try {
      const params: any = { stale_days: 3 };
      if (instructorId) params.instructor_id = instructorId;
      const result = await applicationService.bulkRemindDrafts(params);
      setBulkRemindResult(result);
      setBulkRemindResultOpen(true);
      loadDrafts();
      loadStatistics();
    } catch (err: any) {
      setActionError(err.message || 'Failed to send bulk reminders');
    } finally {
      setBulkRemindLoading(false);
    }
  };

  const handleRemind = async () => {
    if (!selectedDraft) return;
    setRemindLoading(true);
    setActionError(null);
    try {
      const result = await applicationService.remindDraftApplicant(selectedDraft.id, {
        message: remindMessage || undefined,
      });
      setRemindResult({
        success: result.email_sent,
        message: result.email_sent
          ? `Payment reminder sent to ${selectedDraft.email} (reminder #${result.reminder_count})`
          : 'Failed to send reminder. Please try again.',
      });
      setRemindResultOpen(true);
      setRemindModalOpen(false);
      setRemindMessage('');
      loadDrafts();
    } catch (err: any) {
      setActionError(err.message || 'Failed to send reminder');
    } finally {
      setRemindLoading(false);
    }
  };

  const handleContact = async () => {
    if (!selectedDraft || !contactSubject.trim() || !contactMessage.trim()) return;
    setContactLoading(true);
    setActionError(null);
    try {
      const result = await applicationService.contactDraftApplicant(selectedDraft.id, {
        subject: contactSubject.trim(),
        message: contactMessage.trim(),
      });
      setContactResult({
        success: result.email_sent,
        message: result.email_sent
          ? `Email sent to ${selectedDraft.email}`
          : 'Failed to send email. Please try again.',
      });
      setContactResultOpen(true);
      setContactModalOpen(false);
      setContactSubject('');
      setContactMessage('');
    } catch (err: any) {
      setActionError(err.message || 'Failed to send email');
    } finally {
      setContactLoading(false);
    }
  };

  // ─── Helpers ───────────────────────────────────────────────────────
  const formatShortDate = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
  };

  const getPaymentBadge = (status?: string | null) => {
    if (!status) return <Badge variant="outline" className="bg-gray-100 text-gray-600">No payment info</Badge>;
    const map: Record<string, { className: string; label: string }> = {
      pending: { className: 'bg-yellow-100 text-yellow-700 border-yellow-200', label: 'Payment Pending' },
      completed: { className: 'bg-green-100 text-green-700 border-green-200', label: 'Paid' },
      failed: { className: 'bg-red-100 text-red-700 border-red-200', label: 'Payment Failed' },
      pending_bank_transfer: { className: 'bg-blue-100 text-blue-700 border-blue-200', label: 'Awaiting Bank Transfer' },
      confirmed: { className: 'bg-green-100 text-green-700 border-green-200', label: 'Payment Confirmed' },
    };
    const cfg = map[status] || { className: 'bg-gray-100 text-gray-600', label: status };
    return <Badge variant="outline" className={cfg.className}>{cfg.label}</Badge>;
  };

  const getAgeBadge = (updatedAt?: string | null) => {
    if (!updatedAt) return null;
    const days = Math.floor((Date.now() - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24));
    if (days <= 1) return <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs">New</Badge>;
    if (days <= 7) return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200 text-xs">{days}d ago</Badge>;
    if (days <= 30) return <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200 text-xs">{days}d ago</Badge>;
    return <Badge variant="destructive" className="text-xs">{days}d stale</Badge>;
  };

  // ─── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Statistics Cards */}
      {statistics && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Total Saved</p>
                  <p className="text-2xl font-bold mt-1">{statistics.total_drafts}</p>
                </div>
                <FileText className="w-8 h-8 text-brand-accent opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Last 24h</p>
                  <p className="text-2xl font-bold mt-1 text-green-600">{statistics.age_breakdown.last_24h}</p>
                </div>
                <Clock className="w-8 h-8 text-green-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">7–30 days</p>
                  <p className="text-2xl font-bold mt-1 text-yellow-600">
                    {statistics.age_breakdown.last_7d + statistics.age_breakdown.last_30d}
                  </p>
                </div>
                <CalendarDays className="w-8 h-8 text-yellow-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase tracking-wide">Stale (30d+)</p>
                  <p className="text-2xl font-bold mt-1 text-red-600">{statistics.age_breakdown.stale_30d_plus}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500 opacity-80" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main card */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-brand-accent" />
                Saved Applications (Drafts)
              </CardTitle>
              <CardDescription>
                Applications saved by students but not yet submitted — typically awaiting payment completion.
              </CardDescription>
            </div>
            {statistics && statistics.age_breakdown.stale_30d_plus > 0 && (
              <Button
                variant="outline"
                className="bg-brand/5 hover:bg-brand/10 border-brand/20 text-brand-accent"
                onClick={() => setBulkRemindConfirmOpen(true)}
                disabled={bulkRemindLoading}
              >
                {bulkRemindLoading ? (
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Send className="w-4 h-4 mr-2" />
                )}
                Remind All Stale ({statistics.age_breakdown.stale_30d_plus})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <Input
                  placeholder="Search by name, email, or phone..."
                  value={searchInput}
                  onChange={(e) => {
                    setSearchInput(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-10"
                />
              </div>
            </div>

            <Select
              value={submissionStatusFilter}
              onValueChange={(v) => { setSubmissionStatusFilter(v); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Submission Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="draft">Draft (Not Submitted)</SelectItem>
                <SelectItem value="processing">In Progress</SelectItem>
              </SelectContent>
            </Select>

            <Select
              value={paymentStatusFilter}
              onValueChange={(v) => { setPaymentStatusFilter(v); setCurrentPage(1); }}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Payment Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Payment Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="failed">Failed</SelectItem>
                <SelectItem value="pending_bank_transfer">Awaiting Bank Transfer</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Error */}
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Content */}
          {loading ? (
            <div className="text-center py-12">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto text-gray-400" />
              <p className="text-gray-500 mt-2">Loading saved applications...</p>
            </div>
          ) : drafts.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 mx-auto text-gray-300" />
              <p className="text-gray-500 mt-2 font-medium">No saved applications found</p>
              <p className="text-gray-400 text-sm mt-1">
                When students save an application draft (before completing payment), it will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {drafts.map((draft) => (
                <div
                  key={draft.id}
                  className="border rounded-lg p-4 hover:shadow-md transition-shadow bg-brand/5 border-brand/20 hover:border-brand/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <h3 className="font-semibold text-base">{draft.full_name}</h3>
                        <Badge variant="outline" className="bg-brand/10 text-brand border-brand/20">
                          Draft
                        </Badge>
                        {getPaymentBadge(draft.payment_status)}
                        {getAgeBadge(draft.updated_at)}
                        {draft.cohort_label && (
                          <Badge variant="outline" className="bg-brand-accent/10 text-brand-accent border-brand-accent/20 text-xs">
                            {draft.cohort_label}
                          </Badge>
                        )}
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-1 text-sm text-gray-600 mb-2">
                        <div className="truncate">
                          <span className="font-medium text-gray-500">Email:</span> {draft.email}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Phone:</span> {draft.phone}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Location:</span>{' '}
                          {[draft.city, draft.country].filter(Boolean).join(', ') || '—'}
                        </div>
                        <div>
                          <span className="font-medium text-gray-500">Saved:</span>{' '}
                          {formatDateTime(draft.updated_at)}
                        </div>
                      </div>

                      {draft.course_title && (
                        <p className="text-xs text-gray-500">
                          Course: <strong>{draft.course_title}</strong>
                          {draft.course_price ? ` — ${draft.course_currency || 'USD'} ${draft.course_price}` : ''}
                        </p>
                      )}

                      {draft.payment_reminder_count != null && draft.payment_reminder_count > 0 && (
                        <p className="text-xs text-brand-accent mt-1">
                          📧 {draft.payment_reminder_count} reminder(s) sent
                        </p>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 ml-4 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setSelectedDraft(draft);
                          setDetailModalOpen(true);
                        }}
                      >
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-brand/5 hover:bg-brand/10 border-brand/20 text-brand-accent"
                        onClick={() => {
                          setSelectedDraft(draft);
                          setRemindModalOpen(true);
                        }}
                      >
                        <Send className="w-4 h-4 mr-1" />
                        Remind
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="bg-blue-50 hover:bg-blue-100 border-blue-200 text-blue-700"
                        onClick={() => {
                          setSelectedDraft(draft);
                          setContactModalOpen(true);
                        }}
                      >
                        <Mail className="w-4 h-4 mr-1" />
                        Contact
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {drafts.length > 0 && (
            <div className="flex justify-center items-center gap-2 mt-6">
              <Button
                variant="outline" size="sm"
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline" size="sm"
                onClick={() => setCurrentPage(p => p + 1)}
                disabled={currentPage >= totalPages}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Detail Modal ── */}
      <Dialog open={detailModalOpen} onOpenChange={setDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          {selectedDraft && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  Draft Application Details
                  <Badge variant="outline" className="bg-brand/10 text-brand border-brand/20">Draft</Badge>
                </DialogTitle>
                <DialogDescription>
                  {selectedDraft.full_name} — {selectedDraft.email}
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-4">
                {([
                  ['Full Name', selectedDraft.full_name],
                  ['Email', selectedDraft.email],
                  ['Phone', selectedDraft.phone],
                  ['WhatsApp', selectedDraft.whatsapp_number || 'N/A'],
                  ['Gender', selectedDraft.gender || 'N/A'],
                  ['Age Range', selectedDraft.age_range || 'N/A'],
                  ['Country', selectedDraft.country || '—'],
                  ['City', selectedDraft.city || '—'],
                  ['Education', selectedDraft.education_level || 'N/A'],
                  ['Current Status', selectedDraft.current_status || 'N/A'],
                  ['Field of Study', selectedDraft.field_of_study || 'N/A'],
                  ['Motivation', selectedDraft.motivation || '—'],
                ] as [string, string | null | undefined][]).map(([label, value]) => (
                  <div key={label}>
                    <Label className="text-xs text-gray-500">{label}</Label>
                    <p className="font-medium text-sm">{value || 'N/A'}</p>
                  </div>
                ))}
              </div>

              {/* Payment Info */}
              <div className="mt-4 pt-4 border-t">
                <Label className="text-xs text-gray-500 uppercase tracking-wide">Payment Information</Label>
                <div className="grid grid-cols-3 gap-3 mt-2">
                  <div>
                    <p className="text-xs text-gray-500">Status</p>
                    {getPaymentBadge(selectedDraft.payment_status)}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Method</p>
                    <p className="text-sm font-medium">{selectedDraft.payment_method || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Reminders Sent</p>
                    <p className="text-sm font-medium">{selectedDraft.payment_reminder_count || 0}</p>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 mt-4 pt-4 border-t">
                <Button
                  size="sm"
                  onClick={() => { setDetailModalOpen(false); setRemindModalOpen(true); }}
                  className="bg-amber-500 hover:bg-amber-600 text-white"
                >
                  <Send className="w-4 h-4 mr-1" />
                  Send Payment Reminder
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { setDetailModalOpen(false); setContactModalOpen(true); }}
                >
                  <Mail className="w-4 h-4 mr-1" />
                  Contact Applicant
                </Button>
                {selectedDraft.phone && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.open(`https://wa.me/${selectedDraft.phone?.replace(/[^0-9]/g, '')}`, '_blank')}
                  >
                    <Phone className="w-4 h-4 mr-1" />
                    WhatsApp
                  </Button>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Remind Modal ── */}
      <Dialog open={remindModalOpen} onOpenChange={setRemindModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="w-5 h-5 text-brand-accent" />
              Send Payment Reminder
            </DialogTitle>
            <DialogDescription>
              Send a payment reminder to {selectedDraft?.full_name} ({selectedDraft?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <Alert className="bg-brand/5 border-brand/20">
              <AlertCircle className="h-4 w-4 text-brand-accent" />
              <AlertDescription className="text-brand">
                This will send a payment reminder email to the applicant. They saved their application but haven&apos;t completed payment yet.
              </AlertDescription>
            </Alert>

            <div>
              <Label htmlFor="remind_message">Custom Message (Optional)</Label>
              <Textarea
                id="remind_message"
                value={remindMessage}
                onChange={(e) => setRemindMessage(e.target.value)}
                rows={4}
                placeholder="Add a personal note to the reminder email (optional)..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => { setRemindModalOpen(false); setRemindMessage(''); setActionError(null); }} disabled={remindLoading}>
                Cancel
              </Button>
              <Button onClick={handleRemind} disabled={remindLoading} className="bg-brand-accent hover:bg-brand-accent/90 text-white">
                {remindLoading ? 'Sending...' : 'Send Reminder'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Contact Modal ── */}
      <Dialog open={contactModalOpen} onOpenChange={setContactModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="w-5 h-5 text-blue-500" />
              Contact Applicant
            </DialogTitle>
            <DialogDescription>
              Send a custom email to {selectedDraft?.full_name} ({selectedDraft?.email})
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div>
              <Label htmlFor="contact_subject">Subject *</Label>
              <Input
                id="contact_subject"
                value={contactSubject}
                onChange={(e) => setContactSubject(e.target.value)}
                placeholder="e.g. Follow up on your application"
              />
            </div>

            <div>
              <Label htmlFor="contact_message">Message *</Label>
              <Textarea
                id="contact_message"
                value={contactMessage}
                onChange={(e) => setContactMessage(e.target.value)}
                rows={6}
                placeholder="Write your message to the applicant..."
              />
            </div>

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => { setContactModalOpen(false); setContactSubject(''); setContactMessage(''); setActionError(null); }} disabled={contactLoading}>
                Cancel
              </Button>
              <Button onClick={handleContact} disabled={contactLoading || !contactSubject.trim() || !contactMessage.trim()}>
                {contactLoading ? 'Sending...' : 'Send Email'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
      {/* ── Bulk Remind Confirmation Modal ── */}
      <Dialog open={bulkRemindConfirmOpen} onOpenChange={setBulkRemindConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-500" />
              Send Bulk Payment Reminders
            </DialogTitle>
            <DialogDescription>
              This will send payment reminder emails to all stale draft applicants.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert className="bg-brand/5 border-brand/20">
              <AlertCircle className="h-4 w-4 text-brand-accent" />
              <AlertDescription className="text-brand">
                <strong>{statistics?.age_breakdown.stale_30d_plus || 0}</strong> draft applicant(s) haven&apos;t updated their application in 3+ days.
                Each will receive a payment reminder email.
              </AlertDescription>
            </Alert>

            {actionError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{actionError}</AlertDescription>
              </Alert>
            )}

            <div className="flex gap-2 justify-end pt-4 border-t">
              <Button variant="outline" onClick={() => setBulkRemindConfirmOpen(false)} disabled={bulkRemindLoading}>
                Cancel
              </Button>
              <Button onClick={handleBulkRemind} disabled={bulkRemindLoading} className="bg-red-500 hover:bg-red-600 text-white">
                {bulkRemindLoading ? 'Sending...' : 'Send Reminders'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Remind Result Modal ── */}
      <Dialog open={bulkRemindResultOpen} onOpenChange={setBulkRemindResultOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {bulkRemindResult && bulkRemindResult.sent > 0 ? (
                <Send className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-gray-500" />
              )}
              Bulk Reminders Sent
            </DialogTitle>
          </DialogHeader>

          {bulkRemindResult && (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-green-600">{bulkRemindResult.sent}</p>
                  <p className="text-xs text-green-700">Sent</p>
                </div>
                <div className="bg-red-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-red-600">{bulkRemindResult.failed}</p>
                  <p className="text-xs text-red-700">Failed</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-2xl font-bold text-gray-600">{bulkRemindResult.total_stale}</p>
                  <p className="text-xs text-gray-700">Total Stale</p>
                </div>
              </div>
              <p className="text-sm text-gray-500 text-center">
                Drafts older than {bulkRemindResult.stale_days} days were targeted.
              </p>
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={() => setBulkRemindResultOpen(false)}>Done</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ── Single Remind Result Modal ── */}
      <Dialog open={remindResultOpen} onOpenChange={setRemindResultOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {remindResult?.success ? (
                <Send className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              {remindResult?.success ? 'Reminder Sent' : 'Reminder Failed'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">{remindResult?.message}</p>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setRemindResultOpen(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Contact Result Modal ── */}
      <Dialog open={contactResultOpen} onOpenChange={setContactResultOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {contactResult?.success ? (
                <Mail className="w-5 h-5 text-green-500" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-500" />
              )}
              {contactResult?.success ? 'Email Sent' : 'Email Failed'}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">{contactResult?.message}</p>
          <div className="flex justify-end pt-4 border-t">
            <Button onClick={() => setContactResultOpen(false)}>OK</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
