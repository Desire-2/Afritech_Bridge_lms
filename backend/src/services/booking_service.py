"""
Booking Service for AfriTech Bridge LMS

Handles all booking operations with proper transaction management
and double-booking prevention.

Key design: The backend is the final authority on slot availability.
"""

from datetime import datetime, date, time, timedelta
from typing import Optional, Dict, Tuple
from sqlalchemy import and_, or_, func, case
from sqlalchemy.orm import joinedload
import logging

from ..models.user_models import db, User
from ..models.course_models import Course, Enrollment
from ..models.booking_models import (
    InstructorAvailability, AvailabilityException, Booking, BookingStatus,
)
from .availability_engine import get_available_slots, DEFAULT_SLOT_DURATION_MINUTES

logger = logging.getLogger(__name__)


def create_booking(
    student_id: int,
    instructor_id: int,
    start_datetime: datetime,
    session_topic: str,
    course_id: Optional[int] = None,
    student_notes: Optional[str] = None,
    timezone_str: str = 'UTC',
) -> Tuple[Optional[Booking], str]:
    """Create a new booking with double-booking prevention.

    Uses serializable isolation via SELECT FOR UPDATE pattern.

    Returns (booking, error_message). If successful, error_message is empty.
    """
    # Validate student
    student = User.query.get(student_id)
    if not student or not student.is_active:
        return None, "Student account not found or inactive."

    # Validate instructor
    instructor = User.query.get(instructor_id)
    if not instructor or not instructor.is_active:
        return None, "Instructor not found or inactive."
    if not instructor.role or instructor.role.name != 'instructor':
        return None, "The selected user is not an instructor."

    # Validate course enrollment if course is specified
    if course_id:
        course = Course.query.get(course_id)
        if not course:
            return None, "Course not found."
        if course.instructor_id != instructor_id:
            return None, "This instructor does not teach this course."
        enrollment = Enrollment.query.filter_by(
            student_id=student_id,
            course_id=course_id,
            status='active',
        ).first()
        if not enrollment:
            return None, "You are not enrolled in this course."

    # Validate session topic
    if not session_topic or not session_topic.strip():
        return None, "Session topic is required."

    # Calculate end time
    slot_duration = timedelta(minutes=DEFAULT_SLOT_DURATION_MINUTES)
    end_datetime = start_datetime + slot_duration

    # Validate slot is in the future
    now = datetime.utcnow()
    min_notice = timedelta(minutes=60)
    if start_datetime - now < min_notice:
        return None, "Booking must be at least 1 hour in advance."

    # Validate slot is within booking horizon
    max_horizon = timedelta(days=90)
    if start_datetime.date() > (now.date() + max_horizon):
        return None, "Cannot book more than 90 days in advance."

    # Validate instructor has availability at this time
    target_date = start_datetime.date()
    day_of_week = target_date.weekday()
    slot_start_time = start_datetime.time()
    slot_end_time = end_datetime.time()

    # Buffer period (time between sessions) from the instructor's settings
    buffer = timedelta(minutes=instructor.buffer_minutes if instructor.buffer_minutes else 0)
    # The slot itself (plus its following buffer) must fit inside the window.
    # The first slot may start at the window start, so we only extend the end.
    buffered_end = (end_datetime + buffer).time()

    # Check recurring availability (slot + buffer must fit inside the window)
    availability = InstructorAvailability.query.filter(
        InstructorAvailability.instructor_id == instructor_id,
        InstructorAvailability.day_of_week == day_of_week,
        InstructorAvailability.is_active == True,
    ).all()

    has_availability = False
    for avail in availability:
        if avail.effective_from and target_date < avail.effective_from:
            continue
        if avail.effective_until and target_date > avail.effective_until:
            continue
        if avail.start_time <= slot_start_time and avail.end_time >= buffered_end:
            has_availability = True
            break

    if not has_availability:
        return None, "The instructor is not available at this time."

    # Check for exceptions
    exception = AvailabilityException.query.filter(
        AvailabilityException.instructor_id == instructor_id,
        AvailabilityException.date == target_date,
    ).first()

    if exception:
        if exception.is_blocked:
            if exception.start_time is None and exception.end_time is None:
                return None, "The instructor is unavailable on this date."
            elif exception.start_time and exception.end_time:
                if exception.start_time <= slot_start_time and exception.end_time >= buffered_end:
                    return None, "The instructor is unavailable during this time."

    # === CRITICAL SECTION: Double-booking prevention ===
    # Use pessimistic locking for concurrent booking prevention
    try:
        # Lock existing bookings for this instructor at this time.
        # The slot is expanded by the buffer on both ends so back-to-back
        # sessions with insufficient buffer time are rejected.
        buffered_start_dt = start_datetime - buffer
        buffered_end_dt = end_datetime + buffer

        existing = db.session.query(Booking).filter(
            Booking.instructor_id == instructor_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            Booking.start_datetime < buffered_end_dt,
            Booking.end_datetime > buffered_start_dt,
        ).with_for_update().first()

        if existing:
            return None, "This time slot is no longer available. It was just booked by another student. Please choose a different time."

        # Also check if the student already has a conflicting booking
        student_conflict = db.session.query(Booking).filter(
            Booking.student_id == student_id,
            Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            Booking.start_datetime < buffered_end_dt,
            Booking.end_datetime > buffered_start_dt,
        ).with_for_update().first()

        if student_conflict:
            return None, "You already have a booking during this time."

        # Create the booking with PENDING status (requires instructor confirmation)
        booking = Booking(
            student_id=student_id,
            instructor_id=instructor_id,
            course_id=course_id,
            start_datetime=start_datetime,
            end_datetime=end_datetime,
            timezone=timezone_str,
            status=BookingStatus.PENDING,
            session_topic=session_topic.strip(),
            student_notes=student_notes.strip() if student_notes else None,
        )
        db.session.add(booking)
        db.session.commit()

        logger.info(f"Booking created: id={booking.id} student={student_id} instructor={instructor_id} at {start_datetime}")
        return booking, ""

    except Exception as e:
        db.session.rollback()
        logger.error(f"Failed to create booking: {e}")
        return None, "An error occurred while creating your booking. Please try again."


def cancel_booking(
    booking_id: int,
    user_id: int,
    reason: Optional[str] = None,
) -> Tuple[bool, str]:
    """Cancel a booking. Students can cancel up to 24h before. Instructors/Admins can cancel anytime."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING]:
        return False, "This booking cannot be cancelled."

    user = User.query.get(user_id)
    if not user:
        return False, "User not found."

    # Check cancellation policy
    now = datetime.utcnow()
    is_instructor_or_admin = user.role and user.role.name in ['instructor', 'admin']
    is_student = user.role and user.role.name == 'student'

    if is_student and user_id != booking.student_id:
        return False, "You can only cancel your own bookings."

    if is_instructor_or_admin and user_id != booking.instructor_id and user.role.name != 'admin':
        return False, "You can only cancel your own sessions."

    if is_student:
        cancellation_notice = timedelta(hours=24)
        if booking.start_datetime - now < cancellation_notice:
            return False, "Bookings must be cancelled at least 24 hours in advance."

    booking.status = BookingStatus.CANCELLED
    booking.cancellation_reason = reason
    booking.cancelled_by = user_id
    booking.cancelled_at = now

    db.session.commit()
    logger.info(f"Booking cancelled: id={booking_id} by user={user_id}")
    return True, ""


def reschedule_booking(
    booking_id: int,
    student_id: int,
    new_start_datetime: datetime,
) -> Tuple[Optional[Booking], str]:
    """Reschedule an existing booking to a new time."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return None, "Booking not found."

    if booking.student_id != student_id:
        return None, "You can only reschedule your own bookings."

    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING]:
        return None, "This booking cannot be rescheduled."

    # Check rescheduling policy (24h notice)
    now = datetime.utcnow()
    if booking.start_datetime - now < timedelta(hours=24):
        return None, "Bookings must be rescheduled at least 24 hours in advance."

    # Cancel old booking
    booking.status = BookingStatus.RESCHEDULED
    booking.cancelled_by = student_id
    booking.cancelled_at = now
    booking.cancellation_reason = "Rescheduled by student"

    # Create new booking
    new_booking, error = create_booking(
        student_id=student_id,
        instructor_id=booking.instructor_id,
        start_datetime=new_start_datetime,
        session_topic=booking.session_topic,
        course_id=booking.course_id,
        student_notes=booking.student_notes,
        timezone_str=booking.timezone,
    )

    if error:
        db.session.rollback()
        return None, f"Could not reschedule: {error}"

    db.session.commit()
    logger.info(f"Booking rescheduled: old_id={booking_id} new_id={new_booking.id}")
    return new_booking, ""


def complete_booking(
    booking_id: int,
    instructor_id: int,
    notes: Optional[str] = None,
) -> Tuple[bool, str]:
    """Mark a booking as completed by the instructor."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.instructor_id != instructor_id:
        return False, "You can only complete your own sessions."

    if booking.status != BookingStatus.CONFIRMED:
        return False, "Only confirmed bookings can be marked as completed."

    booking.status = BookingStatus.COMPLETED
    booking.completed_at = datetime.utcnow()
    if notes:
        booking.instructor_notes = notes

    db.session.commit()
    return True, ""


def confirm_booking(
    booking_id: int,
    instructor_id: int,
) -> Tuple[bool, str]:
    """Instructor confirms a pending booking request."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.instructor_id != instructor_id:
        return False, "You can only confirm your own sessions."

    if booking.status != BookingStatus.PENDING:
        return False, "Only pending bookings can be confirmed."

    if booking.start_datetime < datetime.utcnow():
        return False, "Cannot confirm a booking that has already passed."

    booking.status = BookingStatus.CONFIRMED
    booking.confirmed_at = datetime.utcnow()
    booking.confirmed_by = instructor_id

    db.session.commit()
    logger.info(f"Booking confirmed: id={booking_id} by instructor={instructor_id}")
    return True, ""


def decline_booking(
    booking_id: int,
    instructor_id: int,
    reason: Optional[str] = None,
) -> Tuple[bool, str]:
    """Instructor declines a pending booking request."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.instructor_id != instructor_id:
        return False, "You can only decline your own sessions."

    if booking.status != BookingStatus.PENDING:
        return False, "Only pending bookings can be declined."

    booking.status = BookingStatus.DECLINED
    booking.declined_at = datetime.utcnow()
    booking.declined_by = instructor_id
    if reason:
        booking.cancellation_reason = reason

    db.session.commit()
    logger.info(f"Booking declined: id={booking_id} by instructor={instructor_id}")
    return True, ""


MEETING_PROVIDERS = {'zoom', 'google_meet', 'microsoft_teams', 'other'}
VALID_MEETING_PROTOCOLS = {'https:'}


def update_meeting_link(
    booking_id: int,
    user_id: int,
    meeting_url: Optional[str],
    meeting_provider: Optional[str],
) -> Tuple[bool, str]:
    """Add or update a meeting link for a booking. Only the assigned instructor can do this."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.instructor_id != user_id:
        return False, "Only the assigned instructor can add a meeting link."

    if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING]:
        return False, "Meeting links can only be added to active bookings."

    if meeting_url is None and meeting_provider is None:
        booking.meeting_url = None
        booking.meeting_provider = None
        db.session.commit()
        return True, ""

    if meeting_url and not meeting_provider:
        return False, "meeting_provider is required when meeting_url is provided."

    if meeting_provider and not meeting_url:
        return False, "meeting_url is required when meeting_provider is provided."

    if meeting_url:
        from urllib.parse import urlparse
        parsed = urlparse(meeting_url)
        if parsed.scheme and parsed.scheme.lower() not in [p.rstrip(':') for p in VALID_MEETING_PROTOCOLS]:
            return False, "Invalid meeting URL protocol. Only HTTP/HTTPS URLs are accepted."
        if not parsed.netloc:
            return False, "Invalid meeting URL."

    if meeting_provider and meeting_provider.lower() not in MEETING_PROVIDERS:
        return False, f"Invalid meeting provider. Supported: {', '.join(sorted(MEETING_PROVIDERS))}"

    booking.meeting_url = meeting_url
    booking.meeting_provider = meeting_provider.lower() if meeting_provider else None
    db.session.commit()
    logger.info(f"Meeting link updated: booking={booking_id} provider={meeting_provider}")
    return True, ""


def mark_no_show(
    booking_id: int,
    instructor_id: int,
) -> Tuple[bool, str]:
    """Mark a booking as no-show by the instructor."""
    booking = Booking.query.get(booking_id)
    if not booking:
        return False, "Booking not found."

    if booking.instructor_id != instructor_id:
        return False, "You can only mark no-show for your own sessions."

    if booking.status != BookingStatus.CONFIRMED:
        return False, "Only confirmed bookings can be marked as no-show."

    booking.status = BookingStatus.NO_SHOW
    booking.no_show_marked_at = datetime.utcnow()

    db.session.commit()
    return True, ""


def get_student_bookings(
    student_id: int,
    status: Optional[str] = None,
    booking_type: str = 'upcoming',
    page: int = 1,
    per_page: int = 20,
) -> Dict:
    """Get paginated bookings for a student."""
    query = Booking.query.filter(Booking.student_id == student_id)

    if status:
        query = query.filter(Booking.status == status)
    else:
        if booking_type == 'upcoming':
            query = query.filter(
                Booking.start_datetime >= datetime.utcnow(),
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            )
        elif booking_type == 'past':
            query = query.filter(
                Booking.start_datetime < datetime.utcnow(),
            )
        elif booking_type == 'cancelled':
            query = query.filter(Booking.status == BookingStatus.CANCELLED)

    query = query.order_by(Booking.start_datetime.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'bookings': [b.to_dict() for b in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }


def get_instructor_bookings(
    instructor_id: int,
    status: Optional[str] = None,
    booking_type: str = 'upcoming',
    page: int = 1,
    per_page: int = 20,
) -> Dict:
    """Get paginated bookings for an instructor."""
    query = Booking.query.filter(Booking.instructor_id == instructor_id)

    if status:
        query = query.filter(Booking.status == status)
    else:
        if booking_type == 'upcoming':
            query = query.filter(
                Booking.start_datetime >= datetime.utcnow(),
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
            )
        elif booking_type == 'past':
            query = query.filter(Booking.start_datetime < datetime.utcnow())

    query = query.order_by(Booking.start_datetime.desc())

    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'bookings': [b.to_dict() for b in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }


def get_all_bookings(
    status: Optional[str] = None,
    instructor_id: Optional[int] = None,
    student_id: Optional[int] = None,
    course_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    search: Optional[str] = None,
    page: int = 1,
    per_page: int = 20,
) -> Dict:
    """Get paginated bookings for admin with filters."""
    query = Booking.query

    if status:
        query = query.filter(Booking.status == status)
    if instructor_id:
        query = query.filter(Booking.instructor_id == instructor_id)
    if student_id:
        query = query.filter(Booking.student_id == student_id)
    if course_id:
        query = query.filter(Booking.course_id == course_id)
    if date_from:
        try:
            dt = datetime.fromisoformat(date_from)
            query = query.filter(Booking.start_datetime >= dt)
        except ValueError:
            pass
    if date_to:
        try:
            dt = datetime.fromisoformat(date_to)
            query = query.filter(Booking.start_datetime <= dt)
        except ValueError:
            pass
    if search:
        search_term = f"%{search}%"
        student_alias = db.aliased(User)
        query = query.join(Booking.student, student_alias).filter(
            or_(
                Booking.session_topic.ilike(search_term),
                student_alias.first_name.ilike(search_term),
                student_alias.last_name.ilike(search_term),
                student_alias.email.ilike(search_term),
            )
        )

    query = query.order_by(Booking.start_datetime.desc())
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)

    return {
        'bookings': [b.to_dict() for b in pagination.items],
        'total': pagination.total,
        'page': page,
        'per_page': per_page,
        'pages': pagination.pages,
    }


def get_booking_stats() -> Dict:
    """Get system-wide booking statistics for admin dashboard."""
    now = datetime.utcnow()

    total = Booking.query.count()
    upcoming = Booking.query.filter(
        Booking.start_datetime >= now,
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
    ).count()
    completed = Booking.query.filter(Booking.status == BookingStatus.COMPLETED).count()
    cancelled = Booking.query.filter(Booking.status == BookingStatus.CANCELLED).count()
    no_show = Booking.query.filter(Booking.status == BookingStatus.NO_SHOW).count()

    active_instructors = db.session.query(
        func.count(func.distinct(Booking.instructor_id))
    ).filter(
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        Booking.start_datetime >= now,
    ).scalar() or 0

    active_students = db.session.query(
        func.count(func.distinct(Booking.student_id))
    ).filter(
        Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
        Booking.start_datetime >= now,
    ).scalar() or 0

    # Bookings per instructor
    instructor_stats = db.session.query(
        Booking.instructor_id,
        func.count(Booking.id).label('total_bookings'),
        func.sum(case((Booking.status == BookingStatus.COMPLETED, 1), else_=0)).label('completed'),
        func.sum(case((Booking.status == BookingStatus.CANCELLED, 1), else_=0)).label('cancelled'),
        func.sum(case((Booking.status == BookingStatus.NO_SHOW, 1), else_=0)).label('no_shows'),
    ).group_by(Booking.instructor_id).all()

    # Instructor info
    instructor_map = {}
    instructor_ids = [s.instructor_id for s in instructor_stats]
    if instructor_ids:
        instructors = User.query.filter(User.id.in_(instructor_ids)).all()
        instructor_map = {
            i.id: {
                'name': f"{i.first_name} {i.last_name}",
                'buffer_minutes': i.buffer_minutes or 0,
            }
            for i in instructors
        }

    instructors_data = []
    for s in instructor_stats:
        total_b = s.total_bookings or 0
        completed_b = s.completed or 0
        info = instructor_map.get(s.instructor_id, {})
        instructors_data.append({
            'instructor_id': s.instructor_id,
            'instructor_name': info.get('name', 'Unknown'),
            'buffer_minutes': info.get('buffer_minutes', 0),
            'total_bookings': total_b,
            'completed': completed_b,
            'cancelled': s.cancelled or 0,
            'no_shows': s.no_shows or 0,
            'completion_rate': round(completed_b / total_b * 100, 1) if total_b > 0 else 0,
        })

    # Bookings by status over last 30 days
    thirty_days_ago = now - timedelta(days=30)
    recent_by_status = db.session.query(
        Booking.status,
        func.count(Booking.id),
    ).filter(
        Booking.created_at >= thirty_days_ago,
    ).group_by(Booking.status).all()

    return {
        'total_bookings': total,
        'upcoming_bookings': upcoming,
        'completed_sessions': completed,
        'cancelled_sessions': cancelled,
        'no_shows': no_show,
        'active_instructors': active_instructors,
        'active_students': active_students,
        'completion_rate': round(completed / total * 100, 1) if total > 0 else 0,
        'cancellation_rate': round(cancelled / total * 100, 1) if total > 0 else 0,
        'no_show_rate': round(no_show / total * 100, 1) if total > 0 else 0,
        'instructor_stats': instructors_data,
        'recent_by_status': {s[0]: s[1] for s in recent_by_status},
    }


def manage_availability(
    instructor_id: int,
    availability_data: Dict,
) -> Tuple[Optional[InstructorAvailability], str]:
    """Create or update instructor availability."""
    day_of_week = availability_data.get('day_of_week')
    start_time_str = availability_data.get('start_time')
    end_time_str = availability_data.get('end_time')
    timezone_str = availability_data.get('timezone', 'UTC')

    if day_of_week is None or not start_time_str or not end_time_str:
        return None, "day_of_week, start_time, and end_time are required."

    if day_of_week < 0 or day_of_week > 6:
        return None, "day_of_week must be between 0 (Monday) and 6 (Sunday)."

    try:
        start_time = time.fromisoformat(start_time_str)
        end_time = time.fromisoformat(end_time_str)
    except ValueError:
        return None, "Invalid time format. Use HH:MM (24-hour)."

    if start_time >= end_time:
        return None, "start_time must be before end_time."

    effective_from = None
    effective_until = None
    if availability_data.get('effective_from'):
        try:
            effective_from = date.fromisoformat(availability_data['effective_from'])
        except ValueError:
            return None, "Invalid effective_from date."
    if availability_data.get('effective_until'):
        try:
            effective_until = date.fromisoformat(availability_data['effective_until'])
        except ValueError:
            return None, "Invalid effective_until date."

    avail_id = availability_data.get('id')
    if avail_id:
        avail = InstructorAvailability.query.get(avail_id)
        if not avail or avail.instructor_id != instructor_id:
            return None, "Availability not found."
        avail.day_of_week = day_of_week
        avail.start_time = start_time
        avail.end_time = end_time
        avail.timezone = timezone_str
        avail.effective_from = effective_from
        avail.effective_until = effective_until
        avail.is_active = availability_data.get('is_active', True)
    else:
        avail = InstructorAvailability(
            instructor_id=instructor_id,
            day_of_week=day_of_week,
            start_time=start_time,
            end_time=end_time,
            timezone=timezone_str,
            effective_from=effective_from,
            effective_until=effective_until,
            is_active=availability_data.get('is_active', True),
        )
        db.session.add(avail)

    db.session.commit()
    return avail, ""


def delete_availability(availability_id: int, instructor_id: int) -> Tuple[bool, str]:
    """Delete an instructor's availability slot."""
    avail = InstructorAvailability.query.get(availability_id)
    if not avail or avail.instructor_id != instructor_id:
        return False, "Availability not found."

    db.session.delete(avail)
    db.session.commit()
    return True, ""


def manage_exception(
    instructor_id: int,
    exception_data: Dict,
) -> Tuple[Optional[AvailabilityException], str]:
    """Create or update an availability exception (block or special hours)."""
    date_str = exception_data.get('date')
    if not date_str:
        return None, "date is required."

    try:
        exc_date = date.fromisoformat(date_str)
    except ValueError:
        return None, "Invalid date format. Use YYYY-MM-DD."

    is_blocked = exception_data.get('is_blocked', True)
    start_time = None
    end_time = None

    if not is_blocked and exception_data.get('start_time') and exception_data.get('end_time'):
        try:
            start_time = time.fromisoformat(exception_data['start_time'])
            end_time = time.fromisoformat(exception_data['end_time'])
        except ValueError:
            return None, "Invalid time format. Use HH:MM."

    exc_id = exception_data.get('id')
    if exc_id:
        exc = AvailabilityException.query.get(exc_id)
        if not exc or exc.instructor_id != instructor_id:
            return None, "Exception not found."
        exc.date = exc_date
        exc.is_blocked = is_blocked
        exc.start_time = start_time
        exc.end_time = end_time
        exc.reason = exception_data.get('reason')
    else:
        exc = AvailabilityException(
            instructor_id=instructor_id,
            date=exc_date,
            is_blocked=is_blocked,
            start_time=start_time,
            end_time=end_time,
            reason=exception_data.get('reason'),
            timezone=exception_data.get('timezone', 'UTC'),
        )
        db.session.add(exc)

    db.session.commit()
    return exc, ""


def delete_exception(exception_id: int, instructor_id: int) -> Tuple[bool, str]:
    """Delete an availability exception."""
    exc = AvailabilityException.query.get(exception_id)
    if not exc or exc.instructor_id != instructor_id:
        return False, "Exception not found."

    db.session.delete(exc)
    db.session.commit()
    return True, ""


def get_instructor_all_availability(instructor_id: int) -> Dict:
    """Get all availability and exceptions for an instructor."""
    availability = InstructorAvailability.query.filter_by(
        instructor_id=instructor_id,
    ).order_by(
        InstructorAvailability.day_of_week,
        InstructorAvailability.start_time,
    ).all()

    exceptions = AvailabilityException.query.filter_by(
        instructor_id=instructor_id,
    ).filter(
        AvailabilityException.date >= date.today(),
    ).order_by(
        AvailabilityException.date,
    ).all()

    instructor = User.query.get(instructor_id)
    buffer_minutes = instructor.buffer_minutes if instructor and instructor.buffer_minutes else 0

    return {
        'availability': [a.to_dict() for a in availability],
        'exceptions': [e.to_dict() for e in exceptions],
        'buffer_minutes': buffer_minutes,
    }


def get_eligible_instructors(student_id: int) -> list:
    """Get instructors that a student can book based on their enrollments."""
    enrollments = Enrollment.query.filter_by(
        student_id=student_id,
        status='active',
    ).all()

    instructor_ids = set()
    for enrollment in enrollments:
        course = Course.query.get(enrollment.course_id)
        if course and course.instructor_id:
            instructor_ids.add(course.instructor_id)

    if not instructor_ids:
        return []

    instructors = User.query.filter(
        User.id.in_(instructor_ids),
        User.is_active == True,
    ).all()

    result = []
    for instructor in instructors:
        has_availability = InstructorAvailability.query.filter_by(
            instructor_id=instructor.id,
            is_active=True,
        ).first() is not None

        courses_taught = Course.query.filter(
            Course.instructor_id == instructor.id,
        ).all()

        enrolled_courses = Course.query.join(Enrollment).filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id == Course.id,
            Course.instructor_id == instructor.id,
            Enrollment.status == 'active',
        ).all()

        result.append({
            'id': instructor.id,
            'name': f"{instructor.first_name} {instructor.last_name}",
            'email': instructor.email,
            'profile_picture': instructor.profile_picture_url,
            'bio': instructor.bio,
            'has_availability': has_availability,
            'buffer_minutes': instructor.buffer_minutes or 0,
            'courses': [{'id': c.id, 'title': c.title} for c in enrolled_courses],
        })

    return result
