import apiClient from '@/lib/api-client';
import type {
  BookingInstructor,
  BookingSlot,
  AvailableDate,
  Booking,
  InstructorAvailability,
  AvailabilityException,
  BookingStats,
  BookingsResponse,
  CalendarEvent,
} from '@/types/booking';

export class BookingService {
  // ── Student Endpoints ────────────────────────────────────────

  static async getBookingInstructors(): Promise<{ instructors: BookingInstructor[] }> {
    const response = await apiClient.get('/student/booking-instructors');
    return response.data;
  }

  static async getAvailableDates(
    instructorId: number,
    year: number,
    month: number,
    duration?: number
  ): Promise<{ available_dates: AvailableDate[]; total_available_dates: number }> {
    const params: Record<string, any> = { year, month };
    if (duration) params.duration = duration;
    const response = await apiClient.get(`/student/available-dates/${instructorId}`, { params });
    return response.data;
  }

  static async getAvailableSlots(
    instructorId: number,
    date: string,
    duration?: number,
    timezone?: string
  ): Promise<{ slots: BookingSlot[]; slot_duration_minutes: number }> {
    const params: Record<string, any> = { date };
    if (duration) params.duration = duration;
    if (timezone) params.timezone = timezone;
    const response = await apiClient.get(`/student/available-slots/${instructorId}`, { params });
    return response.data;
  }

  static async createBooking(data: {
    instructor_id: number;
    start_datetime: string;
    session_topic: string;
    course_id?: number;
    student_notes?: string;
    timezone?: string;
  }): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.post('/student/bookings', data);
    return response.data;
  }

  static async getStudentBookings(
    type: 'upcoming' | 'past' | 'cancelled' = 'upcoming',
    status?: string,
    page = 1,
    perPage = 20
  ): Promise<BookingsResponse> {
    const params: Record<string, any> = { type, page, per_page: perPage };
    if (status) params.status = status;
    const response = await apiClient.get('/student/bookings', { params });
    return response.data;
  }

  static async getStudentBookingDetail(bookingId: number): Promise<{ booking: Booking }> {
    const response = await apiClient.get(`/student/bookings/${bookingId}`);
    return response.data;
  }

  static async cancelBooking(
    bookingId: number,
    reason?: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(`/student/bookings/${bookingId}/cancel`, { reason });
    return response.data;
  }

  static async rescheduleBooking(
    bookingId: number,
    newStartDatetime: string
  ): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.post(`/student/bookings/${bookingId}/reschedule`, {
      new_start_datetime: newStartDatetime,
    });
    return response.data;
  }

  // ── Instructor Endpoints ─────────────────────────────────────

  static async getMyAvailability(): Promise<{
    availability: InstructorAvailability[];
    exceptions: AvailabilityException[];
    buffer_minutes?: number;
  }> {
    const response = await apiClient.get('/instructor/my-availability');
    return response.data;
  }

  static async getInstructorBuffer(): Promise<{ buffer_minutes: number }> {
    const response = await apiClient.get('/instructor/buffer');
    return response.data;
  }

  static async updateInstructorBuffer(bufferMinutes: number): Promise<{ message: string; buffer_minutes: number }> {
    const response = await apiClient.put('/instructor/buffer', { buffer_minutes: bufferMinutes });
    return response.data;
  }

  static async saveAvailability(data: {
    id?: number;
    day_of_week: number;
    start_time: string;
    end_time: string;
    timezone?: string;
    is_active?: boolean;
    effective_from?: string;
    effective_until?: string;
  }): Promise<{ message: string; availability: InstructorAvailability }> {
    const response = await apiClient.post('/instructor/my-availability', data);
    return response.data;
  }

  static async deleteAvailability(availabilityId: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/instructor/my-availability/${availabilityId}`);
    return response.data;
  }

  static async saveException(data: {
    id?: number;
    date: string;
    is_blocked: boolean;
    start_time?: string;
    end_time?: string;
    reason?: string;
    timezone?: string;
  }): Promise<{ message: string; exception: AvailabilityException }> {
    const response = await apiClient.post('/instructor/my-exceptions', data);
    return response.data;
  }

  static async deleteException(exceptionId: number): Promise<{ message: string }> {
    const response = await apiClient.delete(`/instructor/my-exceptions/${exceptionId}`);
    return response.data;
  }

  static async getMySessions(
    type: 'upcoming' | 'past' = 'upcoming',
    status?: string,
    page = 1,
    perPage = 20
  ): Promise<BookingsResponse> {
    const params: Record<string, any> = { type, page, per_page: perPage };
    if (status) params.status = status;
    const response = await apiClient.get('/instructor/sessions', { params });
    return response.data;
  }

  static async completeSession(
    bookingId: number,
    notes?: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/complete`, { notes });
    return response.data;
  }

  static async markNoShow(bookingId: number): Promise<{ message: string }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/no-show`);
    return response.data;
  }

  static async updateSessionNotes(
    bookingId: number,
    instructorNotes: string
  ): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.put(`/instructor/sessions/${bookingId}/notes`, {
      instructor_notes: instructorNotes,
    });
    return response.data;
  }

  static async cancelInstructorSession(
    bookingId: number,
    reason?: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/cancel`, { reason });
    return response.data;
  }

  static async confirmSession(
    bookingId: number
  ): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/confirm`);
    return response.data;
  }

  static async declineSession(
    bookingId: number,
    reason?: string
  ): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/decline`, { reason });
    return response.data;
  }

  static async updateMeetingLink(
    bookingId: number,
    meetingUrl: string,
    meetingProvider: string
  ): Promise<{ message: string; booking: Booking }> {
    const response = await apiClient.post(`/instructor/sessions/${bookingId}/meeting`, {
      meeting_url: meetingUrl,
      meeting_provider: meetingProvider,
    });
    return response.data;
  }

  static async getStudentCalendar(params: {
    start?: string;
    end?: string;
    status?: string;
  } = {}): Promise<{ events: CalendarEvent[] }> {
    const response = await apiClient.get('/student/bookings/calendar', { params });
    return response.data;
  }

  static async getInstructorCalendar(params: {
    start?: string;
    end?: string;
    status?: string;
  } = {}): Promise<{ events: CalendarEvent[] }> {
    const response = await apiClient.get('/instructor/sessions/calendar', { params });
    return response.data;
  }

  static async getAdminCalendar(params: {
    start?: string;
    end?: string;
    status?: string;
    instructor_id?: number;
    student_id?: number;
  } = {}): Promise<{ events: CalendarEvent[] }> {
    const response = await apiClient.get('/admin/bookings/calendar', { params });
    return response.data;
  }

  // ── Admin Endpoints ──────────────────────────────────────────

  static async adminGetAllBookings(params: {
    status?: string;
    instructor_id?: number;
    student_id?: number;
    course_id?: number;
    date_from?: string;
    date_to?: string;
    search?: string;
    page?: number;
    per_page?: number;
  } = {}): Promise<BookingsResponse> {
    const response = await apiClient.get('/admin/bookings', { params });
    return response.data;
  }

  static async adminGetBookingStats(): Promise<BookingStats> {
    const response = await apiClient.get('/admin/bookings/stats');
    return response.data;
  }

  static async adminGetBookingDetail(bookingId: number): Promise<{ booking: Booking }> {
    const response = await apiClient.get(`/admin/bookings/${bookingId}`);
    return response.data;
  }

  static async adminCancelBooking(
    bookingId: number,
    reason?: string
  ): Promise<{ message: string }> {
    const response = await apiClient.post(`/admin/bookings/${bookingId}/cancel`, { reason });
    return response.data;
  }

  static async adminGetInstructors(): Promise<{
    instructors: (BookingInstructor & { total_sessions: number; active_sessions: number })[];
  }> {
    const response = await apiClient.get('/admin/instructors');
    return response.data;
  }
}
