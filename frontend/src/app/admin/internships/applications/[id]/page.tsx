'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import internshipService, { type InternshipApplication, type InternshipCohort, type InternshipOfferLetter } from '@/services/api/internship.service';
import { ArrowLeft, Download, Calendar, Mail, Phone, Globe, Github, Linkedin, FileText, Clock, User, MessageSquare, CheckCircle, XCircle, ChevronRight, Send, Award, Share2, Shield, Eye, Copy, Check, Edit3, AlertTriangle } from 'lucide-react';

const StatusBadge = ({ status }: { status: string }) => {
  const colors: Record<string, string> = {
    pending: 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40',
    reviewing: 'bg-blue-900/40 text-blue-300 border-blue-700/40',
    shortlisted: 'bg-purple-900/40 text-purple-300 border-purple-700/40',
    interview_scheduled: 'bg-indigo-900/40 text-indigo-300 border-indigo-700/40',
    accepted: 'bg-green-900/40 text-green-300 border-green-700/40',
    rejected: 'bg-red-900/40 text-red-300 border-red-700/40',
  };
  return (
    <span className={`px-3 py-1.5 rounded-full text-sm font-medium border ${colors[status] || 'bg-gray-900/40 text-gray-300'}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

const ApplicationDetailPage = () => {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [application, setApplication] = useState<InternshipApplication | null>(null);
  const [cohorts, setCohorts] = useState<InternshipCohort[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Status management
  const [selectedStatus, setSelectedStatus] = useState('');
  const [statusNote, setStatusNote] = useState('');
  const [interviewDate, setInterviewDate] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [meetingPlatform, setMeetingPlatform] = useState('');
  const [updating, setUpdating] = useState(false);

  // Cohort assignment
  const [selectedCohort, setSelectedCohort] = useState('');
  const [assigning, setAssigning] = useState(false);

  // Quick notification helper
  const showNotification = (type: 'success' | 'error', message: string) => {
    setNotification({ type, message });
    setTimeout(() => setNotification(null), 4000);
  };

  // Interview notes
  const [interviewNotes, setInterviewNotes] = useState('');
  const [editingNotes, setEditingNotes] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  // Send email modal
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailForm, setEmailForm] = useState({ subject: '', message: '' });
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailResult, setEmailResult] = useState<{ success: boolean; message: string } | null>(null);

  // Alert/notification state
  const [notification, setNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Offer letter
  const [offerLetter, setOfferLetter] = useState<InternshipOfferLetter | null>(null);
  const [offerLoading, setOfferLoading] = useState(false);
  const [generatingOffer, setGeneratingOffer] = useState(false);
  const [resendingOfferEmail, setResendingOfferEmail] = useState(false);
  const [regeneratingOffer, setRegeneratingOffer] = useState(false);
  const [showRegenerateConfirm, setShowRegenerateConfirm] = useState(false);
  const [generatedUsername, setGeneratedUsername] = useState<string | null>(null);
  const [showOfferConfirm, setShowOfferConfirm] = useState(false);
  const [copiedField, setCopiedField] = useState<'username' | null>(null);

  const fetchApplication = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const app = await internshipService.getApplication(id);
      setApplication(app);
      setSelectedStatus(app.status);
      setInterviewNotes(app.interview_notes || '');

      // Fetch available cohorts for this track
      if (app.track_id) {
        try {
          const result = await internshipService.getAdminCohorts({ per_page: 50, track_id: app.track_id });
          setCohorts(Array.isArray(result.data) ? result.data : []);
        } catch { /* ignore */ }
      }

      // Fetch offer letter if status is accepted
      if (app.status === 'accepted') {
        try {
          const offerResult = await internshipService.getOffer(id);
          if (offerResult) {
            setOfferLetter(offerResult);
          }
        } catch { /* not yet issued — ignore */ }
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to load application');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === application?.status) return;
    try {
      setUpdating(true);
      await internshipService.updateStatus(id, {
        status: selectedStatus,
        note: statusNote || undefined,
        interview_date: interviewDate || undefined,
        interview_meeting_link: meetingLink || undefined,
        interview_meeting_platform: meetingPlatform || undefined,
      });
      await fetchApplication();
      setStatusNote('');
      setInterviewDate('');
      setMeetingLink('');
      setMeetingPlatform('');
      showNotification('success', 'Status updated successfully');
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const handleAssignCohort = async () => {
    if (!selectedCohort) return;
    try {
      setAssigning(true);
      await internshipService.assignCohort(id, selectedCohort);
      await fetchApplication();
      showNotification('success', 'Cohort assigned successfully');
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to assign cohort');
    } finally {
      setAssigning(false);
    }
  };

  const handleGenerateOffer = async () => {
    try {
      setGeneratingOffer(true);
      const result = await internshipService.generateOffer(id);
      setOfferLetter(result.offer);
      setGeneratedUsername(result.username);
      setShowOfferConfirm(true);
      await fetchApplication();
      showNotification('success', 'Offer letter generated and sent successfully');
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to generate offer letter');
    } finally {
      setGeneratingOffer(false);
    }
  };

  const handleSaveInterviewNotes = async () => {
    try {
      setSavingNotes(true);
      await internshipService.updateInterviewNotes(id, interviewNotes);
      setEditingNotes(false);
      setNotesSaved(true);
      showNotification('success', 'Interview notes saved');
      setTimeout(() => setNotesSaved(false), 3000);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  };

  const handleSendEmail = async () => {
    if (!emailForm.subject || !emailForm.message) return;
    try {
      setSendingEmail(true);
      setEmailResult(null);
      await internshipService.sendApplicantEmail(id, emailForm);
      setEmailResult({ success: true, message: 'Email sent successfully!' });
      showNotification('success', `Email sent to ${application?.email}`);
      setTimeout(() => {
        setShowEmailModal(false);
        setEmailForm({ subject: '', message: '' });
        setEmailResult(null);
      }, 2000);
    } catch (err: any) {
      setEmailResult({ success: false, message: err?.message || 'Failed to send email' });
      showNotification('error', 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  const handleCopyUsername = async () => {
    if (offerLetter?.generated_username) {
      try {
        await navigator.clipboard.writeText(offerLetter.generated_username);
        setCopiedField('username');
        setTimeout(() => setCopiedField(null), 2000);
      } catch { /* ignore */ }
    }
  };

  const handleResendOfferEmail = async () => {
    if (!offerLetter) return;
    try {
      setResendingOfferEmail(true);
      await internshipService.resendOfferEmail(id);
      showNotification('success', `Offer email resent to ${application?.email}`);
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to resend offer email');
    } finally {
      setResendingOfferEmail(false);
    }
  };

  const handleRegenerateOffer = async () => {
    if (!offerLetter) return;
    try {
      setRegeneratingOffer(true);
      setShowRegenerateConfirm(false);
      const result = await internshipService.regenerateOffer(id);
      setOfferLetter(result.offer);
      setGeneratedUsername(result.username);
      setShowOfferConfirm(true);
      showNotification('success', 'Offer letter regenerated successfully. New email sent.');
    } catch (err: any) {
      showNotification('error', err?.message || 'Failed to regenerate offer letter');
    } finally {
      setRegeneratingOffer(false);
    }
  };

  const handleVerifyOffer = async () => {
    if (!offerLetter) return;
    try {
      const result = await internshipService.verifyOffer(offerLetter.id);
      const msg = result.data.is_authentic
        ? `✅ Offer is AUTHENTIC. The PDF has not been tampered with.`
        : `⚠️ WARNING: The offer PDF has been modified since issuance!`;
      showNotification(
        result.data.is_authentic ? 'success' : 'error',
        `${msg}\n\nHash: ${result.data.pdf_hash?.slice(0, 20)}...`
      );
    } catch (err: any) {
      showNotification('error', 'Verification failed: ' + (err?.message || 'Unknown error'));
    }
  };

  const statusTransitions: Record<string, string[]> = {
    pending: ['reviewing', 'rejected'],
    reviewing: ['shortlisted', 'rejected'],
    shortlisted: ['interview_scheduled', 'rejected'],
    interview_scheduled: ['accepted', 'rejected'],
    accepted: [],
    rejected: [],
  };

  const isValidTransition = (current: string, next: string) => {
    return statusTransitions[current]?.includes(next) || false;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4" />
          <p className="text-gray-400">Loading application details...</p>
        </div>
      </div>
    );
  }

  if (error || !application) {
    return (
      <div className="bg-red-900/20 border border-red-200 rounded-xl p-6">
        <p className="text-red-300">{error || 'Application not found'}</p>
        <Link href="/admin/internships/applications" className="mt-4 inline-flex items-center gap-2 text-blue-400 hover:text-blue-300">
          <ArrowLeft className="h-4 w-4" /> Back to Applications
        </Link>
      </div>
    );
  }

  const availableTransitions = statusTransitions[application.status] || [];
  const logs = application.status_logs || [];

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      {notification && (
        <div className={`fixed top-4 right-4 z-[100] px-5 py-3 rounded-xl shadow-2xl border transition-all duration-300 animate-in slide-in-from-top-2 ${
          notification.type === 'success'
            ? 'bg-green-900/90 border-green-700/50 text-green-200'
            : 'bg-red-900/90 border-red-700/50 text-red-200'
        }`}>
          <div className="flex items-center gap-2">
            {notification.type === 'success' ? (
              <CheckCircle className="h-5 w-5 text-green-400" />
            ) : (
              <XCircle className="h-5 w-5 text-red-400" />
            )}
            <p className="text-sm font-medium whitespace-pre-line">{notification.message}</p>
            <button onClick={() => setNotification(null)} className="ml-2 p-1 hover:bg-white/10 rounded transition">
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Back navigation */}
      <Link href="/admin/internships/applications" className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition text-sm">
        <ArrowLeft className="h-4 w-4" /> Back to Applications
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content - Left 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* Applicant Profile Card */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-16 h-16 rounded-full bg-blue-900/40 border border-blue-700/40 flex items-center justify-center">
                  <span className="text-2xl font-bold text-blue-400">
                    {application.full_name.charAt(0)}
                  </span>
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-white">{application.full_name}</h1>
                  <p className="text-gray-400 text-sm mt-1">
                    {application.applicant_type.replace('_', ' ')} · Ref: <span className="font-mono text-blue-400">{application.reference_code}</span>
                  </p>
                  <div className="flex flex-wrap gap-2 mt-3">
                    <StatusBadge status={application.status} />
                    {application.track_name && (
                      <span className="px-3 py-1.5 bg-green-900/40 text-green-300 border border-green-700/40 rounded-full text-sm font-medium">
                        {application.track_name}
                      </span>
                    )}
                    {application.cohort_code && (
                      <span className="px-3 py-1.5 bg-purple-900/40 text-purple-300 border border-purple-700/40 rounded-full text-sm font-medium">
                        {application.cohort_code}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="text-right text-sm text-gray-400">
                <p>Submitted: {new Date(application.created_at).toLocaleDateString()}</p>
                <p>Updated: {new Date(application.updated_at).toLocaleDateString()}</p>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 p-4 bg-[#0a1628] rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-gray-400" />
                <a href={`mailto:${application.email}`} className="text-blue-400 hover:text-blue-300 text-sm">{application.email}</a>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-gray-400" />
                <span className="text-gray-300 text-sm">{application.phone}</span>
              </div>
              {application.portfolio_url && (
                <div className="flex items-center gap-3">
                  <Globe className="h-4 w-4 text-gray-400" />
                  <a href={application.portfolio_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">Portfolio</a>
                </div>
              )}
              {application.github_url && (
                <div className="flex items-center gap-3">
                  <Github className="h-4 w-4 text-gray-400" />
                  <a href={application.github_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">GitHub</a>
                </div>
              )}
              {application.linkedin_url && (
                <div className="flex items-center gap-3">
                  <Linkedin className="h-4 w-4 text-gray-400" />
                  <a href={application.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate">LinkedIn</a>
                </div>
              )}
              {application.national_id && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-300 text-sm">ID: {application.national_id}</span>
                </div>
              )}
            </div>

            {/* CV Download */}
            <div className="mt-4">
              <button
                onClick={async () => {
                  try {
                    const blob = await internshipService.downloadCv(application.id);
                    const url = window.URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = application.cv_original_name;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    window.URL.revokeObjectURL(url);
                  } catch (err: any) {
                    alert('Failed to download CV: ' + (err?.message || 'Unknown error'));
                  }
                }}
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
              >
                <Download className="h-4 w-4" />
                Download CV: {application.cv_original_name}
              </button>
            </div>
          </div>

          {/* Motivation Letter */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Motivation Letter</h2>
            <div className="bg-[#0a1628] rounded-lg p-4">
              <p className="text-gray-300 whitespace-pre-wrap leading-relaxed text-sm">
                {application.motivation_letter}
              </p>
            </div>
          </div>

          {/* Interview Notes - Editable */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-white">Interview Notes</h2>
              {!editingNotes ? (
                <button
                  onClick={() => setEditingNotes(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-400 hover:text-white transition text-xs"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Notes
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  {notesSaved && (
                    <span className="text-green-400 text-xs flex items-center gap-1">
                      <CheckCircle className="h-3.5 w-3.5" /> Saved
                    </span>
                  )}
                  <button
                    onClick={() => { setEditingNotes(false); setInterviewNotes(application.interview_notes || ''); }}
                    className="px-3 py-1.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-400 hover:text-white transition text-xs"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveInterviewNotes}
                    disabled={savingNotes}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white rounded-lg transition text-xs"
                  >
                    {savingNotes ? 'Saving...' : <><CheckCircle className="h-3.5 w-3.5" /> Save</>}
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={interviewNotes}
                onChange={e => setInterviewNotes(e.target.value)}
                placeholder="Add interview notes, observations, and feedback..."
                rows={5}
                className="w-full px-4 py-3 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
              />
            ) : (
              <div className="bg-[#0a1628] rounded-lg p-4 min-h-[80px]">
                {interviewNotes ? (
                  <p className="text-gray-300 text-sm whitespace-pre-wrap">{interviewNotes}</p>
                ) : (
                  <p className="text-gray-500 text-sm italic">No interview notes recorded yet.</p>
                )}
              </div>
            )}
          </div>

          {/* Status History */}
          {logs.length > 0 && (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Status History</h2>
              <div className="space-y-3">
                {logs.map((log, i) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 bg-[#0a1628] rounded-lg">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                      log.new_status === 'accepted' ? 'bg-green-900/40 text-green-400' :
                      log.new_status === 'rejected' ? 'bg-red-900/40 text-red-400' :
                      'bg-blue-900/40 text-blue-400'
                    }`}>
                      <Clock className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-white font-medium text-sm">{log.changed_by_name}</span>
                        <span className="text-gray-500 text-xs">changed status from</span>
                        <span className="text-gray-400 text-xs">{log.old_status || '—'}</span>
                        <ChevronRight className="h-3 w-3 text-gray-500" />
                        <StatusBadge status={log.new_status} />
                      </div>
                      {log.note && (
                        <p className="text-gray-400 text-sm mt-1">{log.note}</p>
                      )}
                      <p className="text-gray-500 text-xs mt-1">{new Date(log.changed_at).toLocaleString()}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar - Right 1/3 */}
        <div className="space-y-6">
          {/* Status Management */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Update Status</h2>
            <p className="text-gray-400 text-sm mb-4">
              Current: <StatusBadge status={application.status} />
            </p>

            {availableTransitions.length > 0 ? (
              <div className="space-y-3">
                {/* Status Select */}
                <select
                  value={selectedStatus}
                  onChange={e => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                >
                  <option value={application.status}>Select new status...</option>
                  {availableTransitions.map(status => (
                    <option key={status} value={status}>
                      → {status.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>

                {/* Interview Date (for interview_scheduled) */}
                {selectedStatus === 'interview_scheduled' && (
                  <>
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Interview Date & Time</label>
                      <input
                        type="datetime-local"
                        value={interviewDate}
                        onChange={e => setInterviewDate(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                      />
                    </div>

                    {/* Meeting Platform */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Meeting Platform</label>
                      <select
                        value={meetingPlatform}
                        onChange={e => setMeetingPlatform(e.target.value)}
                        className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                      >
                        <option value="">Select platform...</option>
                        <option value="zoom">Zoom</option>
                        <option value="google_meet">Google Meet</option>
                        <option value="teams">Microsoft Teams</option>
                        <option value="whatsapp">WhatsApp Video</option>
                        <option value="other">Other</option>
                      </select>
                    </div>

                    {/* Meeting Link */}
                    <div>
                      <label className="text-gray-400 text-xs mb-1 block">Meeting Link</label>
                      <input
                        type="url"
                        value={meetingLink}
                        onChange={e => setMeetingLink(e.target.value)}
                        placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                        className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                      />
                    </div>
                  </>
                )}

                {/* Admin Note */}
                <div>
                  <label className="text-gray-400 text-xs mb-1 block">Reviewer Note (optional)</label>
                  <textarea
                    value={statusNote}
                    onChange={e => setStatusNote(e.target.value)}
                    placeholder="Add a note about this status change..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                  />
                </div>

                {/* Submit Button */}
                <button
                  onClick={handleStatusUpdate}
                  disabled={!selectedStatus || selectedStatus === application.status || updating}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                >
                  {updating ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Updating...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Update Status</>
                  )}
                </button>
              </div>
            ) : (
              <div className="bg-[#0a1628] rounded-lg p-4 text-center">
                <p className="text-gray-400 text-sm">
                  {application.status === 'accepted' ? 'Application has been accepted' :
                   application.status === 'rejected' ? 'Application has been rejected' :
                   'No further transitions available'}
                </p>
              </div>
            )}
          </div>

          {/* Offer Letter Section */}
          {application.status === 'accepted' && (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-yellow-400" />
                Internship Offer
              </h2>

              {offerLetter ? (
                /* ── Offer Already Sent ── */
                <div className="space-y-4">
                  {/* Status badge */}
                  <div className="flex items-center gap-2">
                    <span className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                      offerLetter.status === 'accepted'
                        ? 'bg-green-900/40 text-green-300 border-green-700/40'
                        : offerLetter.status === 'sent'
                        ? 'bg-blue-900/40 text-blue-300 border-blue-700/40'
                        : 'bg-yellow-900/40 text-yellow-300 border-yellow-700/40'
                    }`}>
                      {offerLetter.status.toUpperCase()}
                    </span>
                    <span className="text-gray-400 text-xs font-mono">{offerLetter.offer_number}</span>
                    {offerLetter.is_authentic === false && (
                      <span className="text-red-400 text-xs flex items-center gap-1">
                        <XCircle className="h-3 w-3" /> Tampered
                      </span>
                    )}
                  </div>

                  {/* Credentials */}
                  {offerLetter.generated_username && (
                    <div className="bg-[#0a1628] rounded-lg p-4 border border-white/5">
                      <p className="text-gray-400 text-xs mb-2 uppercase tracking-wider font-semibold">Login Credentials</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-teal-400" />
                          <span className="text-teal-300 font-mono text-sm">{offerLetter.generated_username}</span>
                        </div>
                        <button
                          onClick={handleCopyUsername}
                          className="p-1.5 bg-[#162844] border border-white/10 rounded-lg hover:bg-white/5 transition text-gray-400 hover:text-white"
                          title="Copy username"
                        >
                          {copiedField === 'username' ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                      <p className="text-gray-500 text-xs mt-2">
                        Password was sent to the applicant via email. They'll be prompted to change it on first login.
                      </p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Download PDF */}
                    <button
                      onClick={async () => {
                        try {
                          const blob = await internshipService.downloadOfferPdf(offerLetter.id);
                          const url = window.URL.createObjectURL(blob);
                          const a = document.createElement('a');
                          a.href = url;
                          a.download = `Offer_Letter_${application.reference_code}.pdf`;
                          document.body.appendChild(a);
                          a.click();
                          document.body.removeChild(a);
                          window.URL.revokeObjectURL(url);
                        } catch (err: any) {
                          showNotification('error', 'Failed to download: ' + (err?.message || 'Unknown error'));
                        }
                      }}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition text-sm font-medium"
                    >
                      <Download className="h-4 w-4" />
                      Download PDF
                    </button>

                    {/* Verify Integrity */}
                    <button
                      onClick={handleVerifyOffer}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0a1628] border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg transition text-sm font-medium"
                    >
                      <Shield className="h-4 w-4 text-green-400" />
                      Verify Integrity
                    </button>

                    {/* Resend Offer Email */}
                    <button
                      onClick={handleResendOfferEmail}
                      disabled={resendingOfferEmail}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-[#0a1628] border border-white/10 hover:bg-white/5 text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm font-medium col-span-2"
                    >
                      {resendingOfferEmail ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-400" /> Resending...</>
                      ) : (
                        <><Mail className="h-4 w-4 text-orange-400" /> Resend Offer Email</>
                      )}
                    </button>

                    {/* Regenerate Offer */}
                    <button
                      onClick={() => setShowRegenerateConfirm(true)}
                      disabled={regeneratingOffer}
                      className="flex items-center justify-center gap-2 px-4 py-2.5 bg-red-900/40 hover:bg-red-900/60 border border-red-700/40 text-red-300 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition text-sm font-medium col-span-2"
                    >
                      {regeneratingOffer ? (
                        <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-400" /> Regenerating...</>
                      ) : (
                        <><FileText className="h-4 w-4" /> Regenerate Offer Letter</>
                      )}
                    </button>
                  </div>

                  {/* Social Share */}
                  <div className="bg-[#0a1628] rounded-lg p-4 border border-white/5">
                    <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider font-semibold flex items-center gap-1.5">
                      <Share2 className="h-3.5 w-3.5" /> Share on Social Media
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { name: 'LinkedIn', color: 'bg-[#0a66c2] hover:bg-[#0a66c2]/80', icon: 'in' },
                        { name: 'Twitter', color: 'bg-[#1da1f2] hover:bg-[#1da1f2]/80', icon: '𝕏' },
                        { name: 'Facebook', color: 'bg-[#1877f2] hover:bg-[#1877f2]/80', icon: 'f' },
                        { name: 'WhatsApp', color: 'bg-[#25d366] hover:bg-[#25d366]/80', icon: 'WA' },
                      ].map(platform => (
                        <button
                          key={platform.name}
                          onClick={async () => {
                            try {
                              const result = await internshipService.getShareContent(offerLetter.id, platform.name.toLowerCase());
                              const shareUrl = result.data.share_url;
                              const text = encodeURIComponent(result.data.text);
                              const urls: Record<string, string> = {
                                linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
                                twitter: `https://twitter.com/intent/tweet?text=${text}&url=${encodeURIComponent(shareUrl)}`,
                                facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,
                                whatsapp: `https://wa.me/?text=${text}%20${encodeURIComponent(shareUrl)}`,
                              };
                              window.open(urls[platform.name.toLowerCase()] || shareUrl, '_blank', 'noopener,noreferrer,width=600,height=400');
                            } catch (err: any) {
                              showNotification('error', 'Sharing failed: ' + (err?.message || 'Unable to generate share link'));
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 ${platform.color} text-white rounded-lg transition text-xs font-medium`}
                        >
                          <span className="font-bold">{platform.icon}</span>
                          {platform.name}
                        </button>
                      ))}
                    </div>
                    {offerLetter.social_shares > 0 && (
                      <p className="text-gray-500 text-xs mt-2">Shared {offerLetter.social_shares} time(s)</p>
                    )}
                  </div>

                  {/* Verification Link */}
                  <div className="bg-yellow-900/10 border border-yellow-700/30 rounded-lg p-3">
                    <p className="text-yellow-300/70 text-xs flex items-center gap-1.5">
                      <Shield className="h-3.5 w-3.5" />
                      <span>
                        Tamper-proof SHA-256 hash:{' '}
                        <span className="font-mono">{offerLetter.pdf_hash?.slice(0, 24) || 'N/A'}...</span>
                      </span>
                    </p>
                  </div>
                </div>
              ) : (
                /* ── No Offer Yet — Show Generate Button ── */
                <div className="space-y-4">
                  <div className="bg-blue-900/10 border border-blue-700/30 rounded-lg p-4">
                    <p className="text-blue-300 text-sm">
                      This applicant has been accepted but hasn't received an offer letter yet.
                      Generate a tamper-proof offer letter with auto-created login credentials.
                    </p>
                  </div>

                  <button
                    onClick={handleGenerateOffer}
                    disabled={generatingOffer || !application.cohort_id}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-500 hover:to-blue-500 disabled:from-gray-600 disabled:to-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm shadow-lg shadow-teal-900/30"
                  >
                    {generatingOffer ? (
                      <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Generating Offer...</>
                    ) : (
                      <><Award className="h-5 w-5" /> Generate & Send Offer Letter</>
                    )}
                  </button>

                  {!application.cohort_id && (
                    <p className="text-yellow-400 text-xs text-center">
                      ⚠️ Assign this applicant to a cohort first before generating the offer letter.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Cohort Assignment (only for accepted applications) */}
          {application.status === 'accepted' && (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Assign Cohort</h2>
              {application.cohort_id ? (
                <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4 text-center">
                  <CheckCircle className="h-6 w-6 text-green-400 mx-auto mb-2" />
                  <p className="text-green-300 font-medium">{application.cohort_code}</p>
                  <p className="text-green-500 text-xs mt-1">Already assigned to this cohort</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <select
                    value={selectedCohort}
                    onChange={e => setSelectedCohort(e.target.value)}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 focus:outline-none focus:border-blue-500 transition text-sm"
                  >
                    <option value="">Select a cohort...</option>
                    {cohorts.filter(c => !c.is_full).map(cohort => (
                      <option key={cohort.id} value={cohort.id}>
                        {cohort.cohort_name} ({cohort.cohort_code}) — {cohort.spots_available ?? '∞'} spots
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={handleAssignCohort}
                    disabled={!selectedCohort || assigning}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                  >
                    {assigning ? 'Assigning...' : 'Assign to Cohort'}
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Send Email to Applicant */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Mail className="h-5 w-5 text-blue-400" />
              Contact Applicant
            </h2>
            <button
              onClick={() => {
                setEmailForm({ subject: '', message: '' });
                setEmailResult(null);
                setShowEmailModal(true);
              }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition font-medium text-sm"
            >
              <Send className="h-4 w-4" />
              Send Email
            </button>
            <a
              href={`mailto:${application.email}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 mt-2 bg-[#0a1628] border border-white/10 hover:bg-white/5 text-gray-300 rounded-lg transition text-sm"
            >
              <Mail className="h-4 w-4" />
              Open in Mail Client
            </a>
          </div>

          {/* Application Metadata */}
          <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Details</h2>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">Applicant Type</span>
                <span className="text-white text-sm capitalize">{application.applicant_type.replace('_', ' ')}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">Track</span>
                <span className="text-white text-sm">{application.track_name}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-white/5">
                <span className="text-gray-400 text-sm">Cohort</span>
                <span className="text-white text-sm">{application.cohort_code || 'Not assigned'}</span>
              </div>
              {application.reviewer_name && (
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Reviewed By</span>
                  <span className="text-white text-sm">{application.reviewer_name}</span>
                </div>
              )}
              {application.interview_date && (
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Interview Date</span>
                  <span className="text-white text-sm">{new Date(application.interview_date).toLocaleString()}</span>
                </div>
              )}
              {application.interview_meeting_platform && (
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Meeting Platform</span>
                  <span className="text-white text-sm capitalize">{application.interview_meeting_platform.replace('_', ' ')}</span>
                </div>
              )}
              {application.interview_meeting_link && (
                <div className="flex justify-between py-2 border-b border-white/5">
                  <span className="text-gray-400 text-sm">Meeting Link</span>
                  <a href={application.interview_meeting_link} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 text-sm truncate max-w-[200px] ml-2">
                    {application.interview_meeting_link}
                  </a>
                </div>
              )}
              <div className="flex justify-between py-2">
                <span className="text-gray-400 text-sm">Created</span>
                <span className="text-white text-sm">{new Date(application.created_at).toLocaleString()}</span>
              </div>
            </div>
          </div>

          {/* Reviewer Notes */}
          {application.reviewer_notes && (
            <div className="bg-[#162844] rounded-xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-3">Reviewer Notes</h2>
              <div className="bg-[#0a1628] rounded-lg p-4">
                <p className="text-gray-300 text-sm whitespace-pre-wrap">{application.reviewer_notes}</p>
              </div>
            </div>
          )}
        </div>
      </div>
      {/* ═══════════ Regenerate Offer Confirmation Modal ═══════════ */}
      {showRegenerateConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowRegenerateConfirm(false)} />
          <div className="relative bg-[#1a2d5a] rounded-2xl border border-red-700/30 shadow-2xl w-full max-w-md">
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full bg-red-900/40 border border-red-700/40 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="h-8 w-8 text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">Regenerate Offer Letter?</h2>
              <p className="text-gray-300 text-sm leading-relaxed">
                This will <strong className="text-red-400">revoke the current offer</strong> and generate a
                brand new one with a different offer number, new PDF, and new login credentials.
              </p>
              <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-3 mt-4 text-left">
                <p className="text-red-300 text-xs flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                  <span>
                    The previous offer will be marked as revoked and can no longer be used.
                    The applicant will receive a new email with updated credentials.
                  </span>
                </p>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10">
              <button
                onClick={() => setShowRegenerateConfirm(false)}
                className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRegenerateOffer}
                disabled={regeneratingOffer}
                className="flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
              >
                {regeneratingOffer ? (
                  <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Regenerating...</>
                ) : (
                  <><FileText className="h-4 w-4" /> Yes, Regenerate</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ Send Email Modal ═══════════ */}
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => { setShowEmailModal(false); setEmailResult(null); }} />
          <div className="relative bg-[#162844] rounded-2xl border border-white/10 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b border-white/10">
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                <Send className="h-5 w-5 text-blue-400" />
                Send Email to {application?.full_name?.split(' ')[0]}
              </h2>
              <button onClick={() => { setShowEmailModal(false); setEmailResult(null); }} className="p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition">
                <XCircle className="h-5 w-5" />
              </button>
            </div>

            {emailResult && emailResult.success ? (
              <div className="p-6">
                <div className="bg-green-900/20 border border-green-700/40 rounded-lg p-4 text-center">
                  <CheckCircle className="h-10 w-10 text-green-400 mx-auto mb-2" />
                  <p className="text-green-300 font-medium">Email Sent Successfully</p>
                  <p className="text-green-500 text-sm mt-1">To: {application?.email}</p>
                </div>
              </div>
            ) : (
              <div className="p-6 space-y-5">
                <div className="bg-blue-900/20 border border-blue-700/40 rounded-lg p-3">
                  <p className="text-blue-300 text-sm">
                    Sending email to <strong>{application?.email}</strong>
                  </p>
                </div>

                {emailResult && !emailResult.success && (
                  <div className="bg-red-900/20 border border-red-700/40 rounded-lg p-3">
                    <p className="text-red-300 text-sm">{emailResult.message}</p>
                  </div>
                )}

                {/* Subject */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Subject *</label>
                  <input
                    type="text"
                    value={emailForm.subject}
                    onChange={e => setEmailForm(prev => ({ ...prev, subject: e.target.value }))}
                    placeholder="e.g., Follow-up on your application"
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm"
                  />
                </div>

                {/* Message */}
                <div>
                  <label className="block text-sm text-gray-300 mb-1.5 font-medium">Message *</label>
                  <textarea
                    value={emailForm.message}
                    onChange={e => setEmailForm(prev => ({ ...prev, message: e.target.value }))}
                    placeholder="Type your message here..."
                    rows={6}
                    className="w-full px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition text-sm resize-none"
                  />
                </div>
              </div>
            )}

            {!emailResult?.success && (
              <div className="flex items-center justify-end gap-3 p-6 border-t border-white/10">
                <button
                  onClick={() => { setShowEmailModal(false); setEmailResult(null); }}
                  className="px-4 py-2.5 bg-[#0a1628] border border-white/10 rounded-lg text-gray-300 hover:text-white transition text-sm"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSendEmail}
                  disabled={!emailForm.subject || !emailForm.message || sendingEmail}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded-lg transition font-medium text-sm"
                >
                  {sendingEmail ? (
                    <><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" /> Sending...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Send Email</>
                  )}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ApplicationDetailPage;
