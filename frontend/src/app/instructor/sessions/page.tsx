"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, CheckCircle, XCircle, AlertCircle, Loader2,
  FileText, UserX, Video, LinkIcon
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { BookingService } from '@/services/booking.service';
import type { Booking } from '@/types/booking';

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  declined: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
  rescheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
};

const MEETING_PROVIDERS = [
  { value: 'zoom', label: 'Zoom' },
  { value: 'google_meet', label: 'Google Meet' },
  { value: 'microsoft_teams', label: 'Microsoft Teams' },
  { value: 'other', label: 'Other' },
];

export default function InstructorSessionsPage() {
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  // Action forms
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [notes, setNotes] = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [declineReason, setDeclineReason] = useState('');

  // Meeting link form
  const [meetingUrl, setMeetingUrl] = useState('');
  const [meetingProvider, setMeetingProvider] = useState('zoom');
  const [editingMeetingId, setEditingMeetingId] = useState<number | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const res = await BookingService.getMySessions(activeTab);
      setSessions(res.bookings);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load sessions.');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  const handleConfirm = async (id: number) => {
    setActionLoading(id);
    try {
      await BookingService.confirmSession(id);
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to confirm session.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDecline = async (id: number) => {
    setActionLoading(id);
    try {
      await BookingService.declineSession(id, declineReason || undefined);
      setExpandedId(null);
      setDeclineReason('');
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to decline session.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleComplete = async (id: number) => {
    setActionLoading(id);
    try {
      await BookingService.completeSession(id, notes || undefined);
      setExpandedId(null);
      setNotes('');
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleNoShow = async (id: number) => {
    if (!confirm('Mark this student as no-show?')) return;
    setActionLoading(id);
    try {
      await BookingService.markNoShow(id);
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (id: number) => {
    setActionLoading(id);
    try {
      await BookingService.cancelInstructorSession(id, cancelReason || undefined);
      setExpandedId(null);
      setCancelReason('');
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveNotes = async (id: number) => {
    setActionLoading(id);
    try {
      await BookingService.updateSessionNotes(id, notes);
      setExpandedId(null);
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveMeetingLink = async (id: number) => {
    if (!meetingUrl.trim()) return;
    setActionLoading(id);
    try {
      await BookingService.updateMeetingLink(id, meetingUrl.trim(), meetingProvider);
      setEditingMeetingId(null);
      setMeetingUrl('');
      setMeetingProvider('zoom');
      fetchSessions();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save meeting link.');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Sessions</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Manage your upcoming and past one-to-one sessions</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">Dismiss</Button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6 w-fit">
        {(['upcoming', 'past'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              activeTab === tab
                ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      ) : sessions.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No {activeTab} sessions
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              {activeTab === 'upcoming' ? 'No upcoming sessions scheduled.' : 'No past sessions yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session, idx) => {
            const dt = formatDateTime(session.start_datetime);
            const et = formatDateTime(session.end_datetime);
            const isExpanded = expandedId === session.id;
            const isPending = session.status === 'pending';
            const isConfirmed = session.status === 'confirmed';
            const isActive = isConfirmed || isPending;
            const isCompleted = session.status === 'completed';

            return (
              <motion.div
                key={session.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card className={`transition-shadow ${isExpanded ? 'shadow-md' : 'hover:shadow-md'}`}>
                  <CardContent className="p-5">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-green-500 to-blue-500 flex items-center justify-center text-white font-semibold text-sm shrink-0">
                          {session.student_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'ST'}
                        </div>
                        <div className="min-w-0">
                          <h3 className="font-semibold text-gray-900 dark:text-white truncate">{session.session_topic}</h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {session.student_name}
                            {session.course_name && <span className="ml-1">· {session.course_name}</span>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3 text-sm text-gray-500 shrink-0">
                        <div className="flex items-center gap-1">
                          <Calendar className="w-4 h-4" />
                          <span>{dt.date}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          <span>{dt.time} - {et.time}</span>
                        </div>
                        <Badge className={statusColors[session.status] || 'bg-gray-100 text-gray-800'}>
                          {session.status.replace('_', ' ')}
                        </Badge>
                      </div>
                    </div>

                    {/* Pending booking: Confirm / Decline actions */}
                    {isPending && (
                      <div className="mt-4 pt-4 border-t border-yellow-100 dark:border-yellow-900/30">
                        <div className="flex items-center gap-2 mb-3">
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Awaiting your confirmation</span>
                        </div>
                        {!isExpanded || expandedId !== session.id ? (
                          <div className="flex flex-wrap gap-2">
                            <Button size="sm" onClick={() => handleConfirm(session.id)} disabled={actionLoading === session.id} className="bg-green-600 hover:bg-green-700">
                              {actionLoading === session.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                              Confirm
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setExpandedId(session.id); setDeclineReason(''); }}>
                              <XCircle className="w-4 h-4 mr-1" /> Decline
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label>Decline Reason (optional)</Label>
                              <Input
                                value={declineReason}
                                onChange={e => setDeclineReason(e.target.value)}
                                placeholder="Reason for declining..."
                                className="mt-1"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button size="sm" variant="destructive" onClick={() => handleDecline(session.id)} disabled={actionLoading === session.id}>
                                {actionLoading === session.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <XCircle className="w-4 h-4 mr-1" />}
                                Confirm Decline
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Confirmed session: Meeting link + actions */}
                    {isConfirmed && (
                      <div className="mt-4 pt-4 border-t border-gray-100 dark:border-gray-800">
                        {/* Meeting link display */}
                        {session.meeting_url && editingMeetingId !== session.id && (
                          <div className="flex items-center gap-2 mb-3 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                            <Video className="w-4 h-4 text-green-600" />
                            <a href={session.meeting_url} target="_blank" rel="noopener noreferrer"
                              className="text-sm font-medium text-green-700 dark:text-green-300 hover:underline truncate">
                              {session.meeting_url}
                            </a>
                            <Badge variant="secondary" className="text-xs ml-1 shrink-0">
                              {session.meeting_provider || 'Meeting'}
                            </Badge>
                          </div>
                        )}

                        {!isExpanded ? (
                          <div className="flex flex-wrap gap-2">
                            {session.meeting_url && (
                              <a href={session.meeting_url} target="_blank" rel="noopener noreferrer">
                                <Button size="sm" className="bg-green-600 hover:bg-green-700">
                                  <Video className="w-4 h-4 mr-1" /> Join Session
                                </Button>
                              </a>
                            )}
                            <Button size="sm" onClick={() => { setExpandedId(session.id); setNotes(session.instructor_notes || ''); }}>
                              <CheckCircle className="w-4 h-4 mr-1" /> Complete
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => {
                              setEditingMeetingId(session.id);
                              setMeetingUrl(session.meeting_url || '');
                              setMeetingProvider(session.meeting_provider || 'zoom');
                            }}>
                              <LinkIcon className="w-4 h-4 mr-1" /> {session.meeting_url ? 'Edit Link' : 'Add Meeting Link'}
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => { setExpandedId(session.id); setNotes(session.instructor_notes || ''); }}>
                              <FileText className="w-4 h-4 mr-1" /> Notes
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleNoShow(session.id)} disabled={actionLoading === session.id}>
                              <UserX className="w-4 h-4 mr-1" /> No-Show
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => { setExpandedId(session.id); setCancelReason(''); }}>
                              <XCircle className="w-4 h-4 mr-1" /> Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <div>
                              <Label>Instructor Notes</Label>
                              <Textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                placeholder="Add notes about this session..."
                                rows={2}
                                className="mt-1"
                              />
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button size="sm" onClick={() => handleComplete(session.id)} disabled={actionLoading === session.id}>
                                {actionLoading === session.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                Mark Completed
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => handleSaveNotes(session.id)} disabled={actionLoading === session.id}>
                                Save Notes
                              </Button>
                              <Button size="sm" variant="destructive" onClick={() => { setCancelReason(''); setExpandedId(null); }}>
                                Cancel Session
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setExpandedId(null)}>Close</Button>
                            </div>
                            {session.status === 'confirmed' && (
                              <div className="mt-3">
                                <Label>Cancel Reason</Label>
                                <Input
                                  value={cancelReason}
                                  onChange={e => setCancelReason(e.target.value)}
                                  placeholder="Reason for cancellation..."
                                  className="mt-1"
                                />
                                <Button size="sm" variant="destructive" className="mt-2" onClick={() => handleCancel(session.id)} disabled={actionLoading === session.id}>
                                  Confirm Cancellation
                                </Button>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Meeting link edit form */}
                        {editingMeetingId === session.id && (
                          <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg space-y-2">
                            <Label>Meeting Link</Label>
                            <Input
                              value={meetingUrl}
                              onChange={e => setMeetingUrl(e.target.value)}
                              placeholder="https://zoom.us/j/..."
                              className="mt-1"
                            />
                            <Label className="mt-2">Provider</Label>
                            <select
                              value={meetingProvider}
                              onChange={e => setMeetingProvider(e.target.value)}
                              className="mt-1 w-full border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
                            >
                              {MEETING_PROVIDERS.map(p => (
                                <option key={p.value} value={p.value}>{p.label}</option>
                              ))}
                            </select>
                            <div className="flex gap-2 mt-2">
                              <Button size="sm" onClick={() => handleSaveMeetingLink(session.id)} disabled={actionLoading === session.id || !meetingUrl.trim()}>
                                {actionLoading === session.id ? <Loader2 className="w-4 h-4 animate-spin mr-1" /> : <CheckCircle className="w-4 h-4 mr-1" />}
                                Save Link
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setEditingMeetingId(null)}>Cancel</Button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Notes display for past/completed */}
                    {!isActive && session.instructor_notes && (
                      <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800">
                        <p className="text-xs text-gray-400 mb-1">Instructor Notes</p>
                        <p className="text-sm text-gray-600 dark:text-gray-300">{session.instructor_notes}</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
