"use client";
import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Calendar, Clock, AlertCircle, CheckCircle, ExternalLink, Clock3, AlertTriangle, XCircle, Video } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookingService } from '@/services/booking.service';
import type { Booking } from '@/types/booking';

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  rescheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  declined: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

const statusLabels: Record<string, string> = {
  confirmed: 'Confirmed',
  pending: 'Awaiting confirmation',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'No-show',
  rescheduled: 'Rescheduled',
  declined: 'Declined',
};

const statusIcons: Record<string, React.ReactNode> = {
  pending: <Clock3 className="w-3 h-3" />,
  confirmed: <CheckCircle className="w-3 h-3" />,
  declined: <XCircle className="w-3 h-3" />,
  cancelled: <AlertTriangle className="w-3 h-3" />,
};

export default function StudentBookingsPage() {
  const { user } = useAuth();
  const [upcoming, setUpcoming] = useState<Booking[]>([]);
  const [past, setPast] = useState<Booking[]>([]);
  const [activeTab, setActiveTab] = useState<'upcoming' | 'past'>('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [upcomingRes, pastRes] = await Promise.all([
        BookingService.getStudentBookings('upcoming'),
        BookingService.getStudentBookings('past'),
      ]);
      setUpcoming(upcomingRes.bookings);
      setPast(pastRes.bookings);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const bookings = activeTab === 'upcoming' ? upcoming : past;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-8 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Sessions</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage your one-to-one sessions</p>
        </div>
        <Link href="/student/bookings/new">
          <Button className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700">
            <Calendar className="w-4 h-4 mr-2" />
            Book New Session
          </Button>
        </Link>
      </div>

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
            {tab} ({tab === 'upcoming' ? upcoming.length : past.length})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <div key={i} className="h-32 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400">{error}</p>
            <Button variant="outline" onClick={fetchData} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              No {activeTab} sessions
            </h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">
              {activeTab === 'upcoming'
                ? "You don't have any upcoming sessions. Book your first one-to-one session!"
                : "You haven't attended any sessions yet."}
            </p>
            {activeTab === 'upcoming' && (
              <Link href="/student/bookings/new">
                <Button>Book Your First Session</Button>
              </Link>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {bookings.map((booking, idx) => (
            <motion.div
              key={booking.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card className="hover:shadow-md transition-shadow">
                <CardContent className="p-5">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white font-semibold shrink-0">
                        {booking.instructor_name?.split(' ').map(n => n[0]).join('').slice(0, 2) || 'IN'}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                          {booking.session_topic}
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          with {booking.instructor_name}
                          {booking.course_name && <span className="ml-1">· {booking.course_name}</span>}
                        </p>
                        {/* Status sub-label */}
                        <p className={`text-xs mt-0.5 ${
                          booking.status === 'pending' ? 'text-yellow-600 dark:text-yellow-400' :
                          booking.status === 'confirmed' && booking.meeting_url ? 'text-green-600 dark:text-green-400' :
                          booking.status === 'declined' ? 'text-gray-500 dark:text-gray-400' :
                          'text-gray-400 dark:text-gray-500'
                        }`}>
                          {statusLabels[booking.status] || booking.status.replace('_', ' ')}
                          {booking.status === 'confirmed' && booking.meeting_url && ' · Meeting link available'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Calendar className="w-4 h-4" />
                        <span>{formatDate(booking.start_datetime)}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4" />
                        <span>{formatTime(booking.start_datetime)} - {formatTime(booking.end_datetime)}</span>
                      </div>
                      <Badge className={statusColors[booking.status] || 'bg-gray-100 text-gray-800'}>
                        {statusIcons[booking.status]}
                        <span className="ml-1">{booking.status.replace('_', ' ')}</span>
                      </Badge>
                    </div>
                  </div>

                  {/* Action buttons row */}
                  <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-800 flex flex-wrap gap-2">
                    {/* Join meeting button for confirmed sessions with link */}
                    {booking.status === 'confirmed' && booking.meeting_url && (
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" asChild>
                        <a href={booking.meeting_url} target="_blank" rel="noopener noreferrer">
                          <Video className="w-4 h-4 mr-1" /> Join Meeting <ExternalLink className="w-3 h-3 ml-1" />
                        </a>
                      </Button>
                    )}

                    {/* Pending status: show waiting message */}
                    {booking.status === 'pending' && (
                      <div className="flex items-center gap-2 text-sm text-yellow-600 dark:text-yellow-400">
                        <Clock3 className="w-4 h-4" />
                        <span>Waiting for instructor to confirm</span>
                      </div>
                    )}

                    {/* Declined status: show declined message */}
                    {booking.status === 'declined' && (
                      <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                        <XCircle className="w-4 h-4" />
                        <span>This request was declined by the instructor</span>
                      </div>
                    )}

                    {/* Link to new booking for declined */}
                    {booking.status === 'declined' && activeTab === 'upcoming' && (
                      <Link href="/student/bookings/new">
                        <Button size="sm" variant="outline">Book Another Session</Button>
                      </Link>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
