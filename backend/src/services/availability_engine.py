"""
Availability Engine for AfriTech Bridge LMS

Generates available booking slots from instructor availability rules,
existing bookings, blocked periods, and exceptions.

The engine answers: "What slots can a student actually book for this instructor on this date?"
"""

from datetime import datetime, date, time, timedelta, timezone as tz
from typing import List, Dict, Optional, Tuple
import logging

from ..models.user_models import db, User
from ..models.booking_models import (
    InstructorAvailability, AvailabilityException, Booking, BookingStatus,
)

logger = logging.getLogger(__name__)

# Defaults — overridable via SystemSettings in the future
DEFAULT_SLOT_DURATION_MINUTES = 60
DEFAULT_MIN_BOOKING_NOTICE_MINUTES = 60
DEFAULT_MAX_BOOKING_HORIZON_DAYS = 90
DEFAULT_BUFFER_MINUTES = 0


def get_instructor_availability_for_date(
    instructor_id: int,
    target_date: date,
) -> List[Tuple[time, time]]:
    """Return the raw available time windows for an instructor on a specific date.

    Checks recurring availability and exception overrides.
    Returns list of (start_time, end_time) tuples representing available windows.
    """
    day_of_week = target_date.weekday()  # 0=Mon ... 6=Sun

    # Get recurring availability for this day
    recurring = InstructorAvailability.query.filter(
        InstructorAvailability.instructor_id == instructor_id,
        InstructorAvailability.day_of_week == day_of_week,
        InstructorAvailability.is_active == True,
    ).all()

    # Filter by effective date range
    windows = []
    for avail in recurring:
        if avail.effective_from and target_date < avail.effective_from:
            continue
        if avail.effective_until and target_date > avail.effective_until:
            continue
        windows.append((avail.start_time, avail.end_time))

    if not windows:
        return []

    # Check exceptions for this date
    exceptions = AvailabilityException.query.filter(
        AvailabilityException.instructor_id == instructor_id,
        AvailabilityException.date == target_date,
    ).all()

    for exc in exceptions:
        if exc.is_blocked:
            if exc.start_time is None and exc.end_time is None:
                # Full day block
                return []
            else:
                # Partial block — remove the blocked window from available windows
                windows = _subtract_windows(windows, exc.start_time, exc.end_time)
        else:
            # Special hours override — replace normal availability
            if exc.start_time and exc.end_time:
                windows = [(exc.start_time, exc.end_time)]

    return windows


def get_instructor_buffer_minutes(instructor_id: int) -> int:
    """Return the instructor's configured buffer period in minutes (time between sessions)."""
    instructor = User.query.get(instructor_id)
    if instructor and instructor.buffer_minutes is not None:
        return max(0, instructor.buffer_minutes)
    return 0


def get_available_slots(
    instructor_id: int,
    target_date: date,
    slot_duration_minutes: int = DEFAULT_SLOT_DURATION_MINUTES,
    timezone_str: str = 'UTC',
    student_id: Optional[int] = None,
) -> List[Dict]:
    """Generate bookable time slots for a specific instructor on a specific date.

    Returns a list of slot dicts with start, end, and availability status.
    Only returns slots that are actually bookable (not past, not booked, not blocked).

    The instructor's buffer period is respected: offered slots start at the
    window start and are spaced by (session duration + buffer), so no slot is
    bookable during another session's buffer. Existing bookings also block
    their surrounding buffer so offered slots never encroach on them.
    """
    now = datetime.utcnow()
    min_notice = timedelta(minutes=DEFAULT_MIN_BOOKING_NOTICE_MINUTES)
    max_horizon = timedelta(days=DEFAULT_MAX_BOOKING_HORIZON_DAYS)

    # Buffer period (time between sessions), applied on both ends
    buffer = timedelta(minutes=get_instructor_buffer_minutes(instructor_id))

    # Check if date is within booking horizon
    if target_date < now.date():
        return []
    if target_date > (now.date() + max_horizon):
        return []

    # Get available windows for this date (already accounting for exceptions)
    windows = get_instructor_availability_for_date(instructor_id, target_date)
    if not windows:
        return []

    # Get existing bookings for this instructor on this date
    day_start = datetime.combine(target_date, time.min)
    day_end = datetime.combine(target_date, time.max)
    existing_bookings = Booking.query.filter(
        Booking.instructor_id == instructor_id,
        Booking.start_datetime >= day_start,
        Booking.start_datetime <= day_end,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
    ).all()

    # Booked intervals expanded by the buffer on both ends: a session occupies
    # [start - buffer, end + buffer] so no other session can be booked nearby.
    booked_intervals = [
        (
            (b.start_datetime - buffer).time(),
            (b.end_datetime + buffer).time(),
        )
        for b in existing_bookings
    ]

    # Generate slots from windows
    slots = []
    slot_delta = timedelta(minutes=slot_duration_minutes)

    for win_start, win_end in windows:
        # Offered slots start right at the window start (e.g. 9:00) and each
        # subsequent slot is spaced by (duration + buffer), e.g. a 60-minute
        # session with a 30-minute buffer yields 9:00-10:00, then 10:30-11:30.
        current = datetime.combine(target_date, win_start)
        end_dt = datetime.combine(target_date, win_end)

        while current + slot_delta <= end_dt:
            slot_start = current.time()
            slot_end = (current + slot_delta).time()

            # Check minimum notice
            slot_datetime = datetime.combine(target_date, slot_start)
            if slot_datetime - now < min_notice:
                current += slot_delta
                continue

            # Check if slot (including its buffer) overlaps with any existing booking
            # booked_intervals are buffer-expanded: [start - buffer, end + buffer]
            is_booked = any(
                _times_overlap(slot_start, slot_end, bk_start, bk_end)
                for bk_start, bk_end in booked_intervals
            )

            # Determine if this specific student already has a booking at this time
            student_has_booking = False
            if student_id and is_booked:
                student_has_booking = any(
                    b.student_id == student_id and
                    _times_overlap(slot_start, slot_end, b.start_datetime.time(), b.end_datetime.time())
                    for b in existing_bookings
                )

            slots.append({
                'start_time': slot_start.strftime('%H:%M'),
                'end_time': slot_end.strftime('%H:%M'),
                'start_datetime': datetime.combine(target_date, slot_start).isoformat(),
                'end_datetime': datetime.combine(target_date, slot_end).isoformat(),
                'is_available': not is_booked,
                'student_has_booking': student_has_booking,
                'timezone': timezone_str,
            })

            # Next slot starts after the current session plus the buffer period
            current = current + slot_delta + buffer

    return slots


def get_available_dates(
    instructor_id: int,
    year: int,
    month: int,
    slot_duration_minutes: int = DEFAULT_SLOT_DURATION_MINUTES,
) -> Dict[str, any]:
    """Get a month overview of available dates for an instructor.

    Returns dict with available_dates list and summary info.
    """
    from calendar import monthrange
    import calendar

    _, days_in_month = monthrange(year, month)
    today = date.today()

    available_dates = []
    for day in range(1, days_in_month + 1):
        check_date = date(year, month, day)
        if check_date < today:
            continue

        windows = get_instructor_availability_for_date(instructor_id, check_date)
        if windows:
            # Check if there are any non-booked slots
            slots = get_available_slots(
                instructor_id, check_date, slot_duration_minutes
            )
            available_count = sum(1 for s in slots if s['is_available'])
            if available_count > 0:
                available_dates.append({
                    'date': check_date.isoformat(),
                    'available_slots': available_count,
                    'day_of_week': calendar.day_name[check_date.weekday()],
                })

    return {
        'year': year,
        'month': month,
        'instructor_id': instructor_id,
        'available_dates': available_dates,
        'total_available_dates': len(available_dates),
    }


def _times_overlap(
    start1: time, end1: time,
    start2: time, end2: time,
) -> bool:
    """Check if two time intervals overlap."""
    return start1 < end2 and start2 < end1


def _subtract_windows(
    windows: List[Tuple[time, time]],
    block_start: time,
    block_end: time,
) -> List[Tuple[time, time]]:
    """Subtract a blocked time window from a list of available windows."""
    result = []
    for win_start, win_end in windows:
        if block_start <= win_start and block_end >= win_end:
            # Block covers entire window — skip
            continue
        elif block_start > win_start and block_end < win_end:
            # Block is in the middle — split
            result.append((win_start, block_start))
            result.append((block_end, win_end))
        elif block_start <= win_start and block_end < win_end and block_end > win_start:
            # Block covers start of window
            result.append((block_end, win_end))
        elif block_start > win_start and block_end >= win_end and block_start < win_end:
            # Block covers end of window
            result.append((win_start, block_start))
        else:
            # No overlap
            result.append((win_start, win_end))
    return result
