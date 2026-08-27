export interface BookingInstructor {
  id: number;
  name: string;
  email: string;
  profile_picture: string | null;
  bio: string | null;
  has_availability: boolean;
  buffer_minutes: number;
  courses: { id: number; title: string }[];
}

export interface BookingSlot {
  start_time: string;
  end_time: string;
  start_datetime: string;
  end_datetime: string;
  is_available: boolean;
  student_has_booking: boolean;
  timezone: string;
}

export interface AvailableDate {
  date: string;
  available_slots: number;
  day_of_week: string;
}

export interface Booking {
  id: number;
  student_id: number;
  instructor_id: number;
  course_id: number | null;
  start_datetime: string;
  end_datetime: string;
  timezone: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed' | 'no_show' | 'rescheduled' | 'declined';
  session_topic: string;
  student_notes: string | null;
  instructor_notes: string | null;
  cancellation_reason: string | null;
  cancelled_by: number | null;
  cancelled_at: string | null;
  completed_at: string | null;
  no_show_marked_at: string | null;
  confirmed_at: string | null;
  confirmed_by: number | null;
  declined_at: string | null;
  declined_by: number | null;
  meeting_url: string | null;
  meeting_provider: string | null;
  reminder_24h_sent: boolean;
  reminder_1h_sent: boolean;
  created_at: string;
  updated_at: string;
  student_name: string | null;
  student_email: string | null;
  student_avatar: string | null;
  instructor_name: string | null;
  instructor_email: string | null;
  instructor_avatar: string | null;
  course_name: string | null;
  cancelled_by_name: string | null;
  confirmed_by_name: string | null;
  declined_by_name: string | null;
}

export interface InstructorAvailability {
  id: number;
  instructor_id: number;
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  timezone: string;
  is_active: boolean;
  effective_from: string | null;
  effective_until: string | null;
  created_at: string;
  updated_at: string;
}

export interface AvailabilityException {
  id: number;
  instructor_id: number;
  date: string;
  is_blocked: boolean;
  start_time: string | null;
  end_time: string | null;
  reason: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface BookingStats {
  total_bookings: number;
  upcoming_bookings: number;
  completed_sessions: number;
  cancelled_sessions: number;
  no_shows: number;
  active_instructors: number;
  active_students: number;
  completion_rate: number;
  cancellation_rate: number;
  no_show_rate: number;
  instructor_stats: {
    instructor_id: number;
    instructor_name: string;
    buffer_minutes: number;
    total_bookings: number;
    completed: number;
    cancelled: number;
    no_shows: number;
    completion_rate: number;
  }[];
  recent_by_status: Record<string, number>;
}

export interface BookingsResponse {
  bookings: Booking[];
  total: number;
  page: number;
  per_page: number;
  pages: number;
}

export interface CalendarEvent {
  id: number;
  title: string;
  start: string;
  end: string;
  status: string;
  meeting_url: string | null;
  booking: Booking;
}
