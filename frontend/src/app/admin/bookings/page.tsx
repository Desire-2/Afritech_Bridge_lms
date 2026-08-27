"use client";
import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Calendar, Clock, Users, TrendingUp, AlertCircle, CheckCircle, XCircle,
  UserX, Search, Filter, ChevronLeft, ChevronRight, LayoutGrid, List, Timer
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { BookingService } from '@/services/booking.service';
import type { Booking, BookingStats, CalendarEvent } from '@/types/booking';

const statusColors: Record<string, string> = {
  confirmed: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  completed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  no_show: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  rescheduled: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  declined: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200',
};

export default function AdminBookingsPage() {
  const [stats, setStats] = useState<BookingStats | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [totalPages, setTotalPages] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);

  // Calendar view
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [calendarEvents, setCalendarEvents] = useState<CalendarEvent[]>([]);
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  });

  const fetchStats = useCallback(async () => {
    try {
      setStatsLoading(true);
      const res = await BookingService.adminGetBookingStats();
      setStats(res);
    } catch (err: any) {
      console.error('Failed to load stats:', err);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchBookings = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, any> = { page, per_page: 15 };
      if (statusFilter) params.status = statusFilter;
      if (search) params.search = search;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      const res = await BookingService.adminGetAllBookings(params);
      setBookings(res.bookings);
      setTotalPages(res.pages);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load bookings.');
    } finally {
      setLoading(false);
    }
  }, [page, statusFilter, search, dateFrom, dateTo]);

  useEffect(() => { fetchStats(); }, [fetchStats]);
  useEffect(() => { fetchBookings(); }, [fetchBookings]);

  const fetchCalendar = useCallback(async () => {
    try {
      const start = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-01`;
      const lastDay = new Date(calendarMonth.year, calendarMonth.month, 0).getDate();
      const end = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      const res = await BookingService.getAdminCalendar({ start, end });
      setCalendarEvents(res.events);
    } catch (err: any) {
      console.error('Failed to load calendar:', err);
    }
  }, [calendarMonth]);

  useEffect(() => { if (viewMode === 'calendar') fetchCalendar(); }, [viewMode, fetchCalendar]);

  const handleCancelBooking = async (id: number) => {
    const reason = prompt('Reason for cancellation:');
    if (reason === null) return;
    try {
      await BookingService.adminCancelBooking(id, reason || 'Cancelled by admin');
      fetchBookings();
      fetchStats();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to cancel.');
    }
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return {
      date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      time: d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Booking Management</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">View and manage all one-to-one session bookings</p>
      </div>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500 shrink-0" />
          <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
          <Button variant="ghost" size="sm" onClick={() => setError(null)} className="ml-auto">Dismiss</Button>
        </div>
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 mb-8">
          {[
            { label: 'Total Bookings', value: stats.total_bookings, icon: Calendar, color: 'text-blue-600', bg: 'bg-blue-50 dark:bg-blue-900/30' },
            { label: 'Upcoming', value: stats.upcoming_bookings, icon: Clock, color: 'text-green-600', bg: 'bg-green-50 dark:bg-green-900/30' },
            { label: 'Completed', value: stats.completed_sessions, icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50 dark:bg-purple-900/30' },
            { label: 'Cancelled', value: stats.cancelled_sessions, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 dark:bg-red-900/30' },
            { label: 'No-Shows', value: stats.no_shows, icon: UserX, color: 'text-orange-600', bg: 'bg-orange-50 dark:bg-orange-900/30' },
            { label: 'Active Instructors', value: stats.active_instructors, icon: Users, color: 'text-indigo-600', bg: 'bg-indigo-50 dark:bg-indigo-900/30' },
          ].map((stat, idx) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stat.bg}`}>
                      <stat.icon className={`w-5 h-5 ${stat.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold text-gray-900 dark:text-white">{stat.value}</p>
                      <p className="text-xs text-gray-500">{stat.label}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Rates */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-green-600">{stats.completion_rate}%</p>
              <p className="text-sm text-gray-500 mt-1">Completion Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-red-600">{stats.cancellation_rate}%</p>
              <p className="text-sm text-gray-500 mt-1">Cancellation Rate</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-orange-600">{stats.no_show_rate}%</p>
              <p className="text-sm text-gray-500 mt-1">No-Show Rate</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Instructor Utilization */}
      {stats && stats.instructor_stats.length > 0 && (
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-blue-500" /> Instructor Utilization
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {stats.instructor_stats.map(inst => (
                <div key={inst.instructor_id} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-semibold shrink-0">
                    {inst.instructor_name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white text-sm">{inst.instructor_name}</p>
                    <div className="flex gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{inst.total_bookings} total</span>
                      <span>{inst.completed} completed</span>
                      <span>{inst.cancelled} cancelled</span>
                      <span>{inst.no_shows} no-shows</span>
                      <span className={`flex items-center gap-1 ${inst.buffer_minutes > 0 ? 'text-indigo-500 font-medium' : 'text-gray-400'}`}>
                        <Timer className="w-3 h-3" />
                        {inst.buffer_minutes > 0 ? `${inst.buffer_minutes}min buffer` : 'no buffer'}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-lg font-bold ${inst.completion_rate >= 80 ? 'text-green-600' : inst.completion_rate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {inst.completion_rate}%
                    </p>
                    <p className="text-xs text-gray-400">completion</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filters */}
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Search by topic, student name, or email..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="pl-9"
            />
          </div>
          <Button variant="outline" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="w-4 h-4 mr-2" /> Filters
          </Button>
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg">
            <button
              onClick={() => setViewMode('list')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('calendar')}
              className={`px-3 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'calendar'
                  ? 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
        </div>
        {showFilters && (
          <div className="flex flex-wrap gap-3 mt-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <select
              className="border rounded-lg px-3 py-2 text-sm dark:bg-gray-700 dark:border-gray-600"
              value={statusFilter}
              onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
            >
              <option value="">All Statuses</option>
              <option value="confirmed">Confirmed</option>
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
              <option value="no_show">No Show</option>
              <option value="declined">Declined</option>
              <option value="rescheduled">Rescheduled</option>
            </select>
            <Input type="date" value={dateFrom} onChange={e => { setDateFrom(e.target.value); setPage(1); }} className="w-auto" placeholder="From" />
            <Input type="date" value={dateTo} onChange={e => { setDateTo(e.target.value); setPage(1); }} className="w-auto" placeholder="To" />
            <Button variant="ghost" size="sm" onClick={() => { setSearch(''); setStatusFilter(''); setDateFrom(''); setDateTo(''); setPage(1); }}>
              Clear Filters
            </Button>
          </div>
        )}
      </div>

      {/* Bookings Table or Calendar View */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-20 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
        </div>
      ) : viewMode === 'calendar' ? (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(m => {
                const newMonth = m.month === 1 ? 12 : m.month - 1;
                const newYear = m.month === 1 ? m.year - 1 : m.year;
                return { year: newYear, month: newMonth };
              })}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <CardTitle className="text-base">
                {new Date(calendarMonth.year, calendarMonth.month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setCalendarMonth(m => {
                const newMonth = m.month === 12 ? 1 : m.month + 1;
                const newYear = m.month === 12 ? m.year + 1 : m.year;
                return { year: newYear, month: newMonth };
              })}>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-7 gap-1 text-center mb-2">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => (
                <div key={d} className="text-[10px] font-semibold text-gray-400 uppercase">{d}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {(() => {
                const firstDay = new Date(calendarMonth.year, calendarMonth.month - 1, 1);
                const lastDay = new Date(calendarMonth.year, calendarMonth.month, 0);
                const startDow = (firstDay.getDay() + 6) % 7;
                const days: (number | null)[] = [];
                for (let i = 0; i < startDow; i++) days.push(null);
                for (let d = 1; d <= lastDay.getDate(); d++) days.push(d);
                return days.map((day, idx) => {
                  if (day === null) return <div key={`empty-${idx}`} />;
                  const dateStr = `${calendarMonth.year}-${String(calendarMonth.month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                  const dayEvents = calendarEvents.filter(e => e.start?.startsWith(dateStr));
                  return (
                    <div key={day} className="min-h-[80px] p-1 border dark:border-gray-700 rounded text-left">
                      <div className={`text-xs font-medium mb-1 ${dayEvents.length > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>
                        {day}
                      </div>
                      {dayEvents.slice(0, 3).map(event => (
                        <div key={event.id} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${
                          event.status === 'confirmed' ? 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300' :
                          event.status === 'pending' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300' :
                          event.status === 'completed' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300' :
                          event.status === 'cancelled' ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' :
                          'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300'
                        }`}>
                          {event.title?.substring(0, 20)}
                        </div>
                      ))}
                      {dayEvents.length > 3 && (
                        <div className="text-[10px] text-gray-400">+{dayEvents.length - 3} more</div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          </CardContent>
        </Card>
      ) : bookings.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center">
            <Calendar className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">No bookings found</h3>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              {statusFilter || search || dateFrom || dateTo ? 'Try adjusting your filters.' : 'No bookings have been made yet.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="bg-white dark:bg-gray-900 rounded-lg border dark:border-gray-800 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Session</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Student</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Instructor</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Date & Time</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase">Status</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y dark:divide-gray-800">
                  {bookings.map(booking => {
                    const dt = formatDateTime(booking.start_datetime);
                    return (
                      <tr key={booking.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-medium text-gray-900 dark:text-white text-sm truncate max-w-[200px]">{booking.session_topic}</p>
                          {booking.course_name && <p className="text-xs text-gray-400 mt-0.5">{booking.course_name}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 dark:text-white">{booking.student_name}</p>
                          <p className="text-xs text-gray-400">{booking.student_email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 dark:text-white">{booking.instructor_name}</p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-gray-900 dark:text-white">{dt.date}</p>
                          <p className="text-xs text-gray-400">{dt.time}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statusColors[booking.status] || 'bg-gray-100 text-gray-800'}>
                            {booking.status.replace('_', ' ')}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {(booking.status === 'confirmed' || booking.status === 'pending') && (
                            <Button
                              variant="ghost" size="sm"
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Cancel
                            </Button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-6">
              <p className="text-sm text-gray-500">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="w-4 h-4" /> Previous
                </Button>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  Next <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
