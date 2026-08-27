"""
Booking Routes for AfriTech Bridge LMS

API endpoints for the one-to-one session booking system.
Blueprint: booking_bp at /api/v1/bookings
"""

from functools import wraps
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime, date
import logging

from ..models.user_models import db, User
from ..models.booking_models import Booking, BookingStatus, InstructorAvailability, AvailabilityException
from ..services.booking_service import (
    create_booking, cancel_booking, reschedule_booking,
    complete_booking, mark_no_show, confirm_booking, decline_booking,
    update_meeting_link, MEETING_PROVIDERS,
    get_student_bookings, get_instructor_bookings, get_all_bookings,
    get_booking_stats, manage_availability, delete_availability,
    manage_exception, delete_exception, get_instructor_all_availability,
    get_eligible_instructors,
)
from ..services.availability_engine import get_available_slots, get_available_dates
from ..services.notification_service import (
    notify_booking_created, notify_booking_cancelled,
    notify_booking_rescheduled, notify_booking_completed,
    notify_booking_no_show, notify_booking_confirmed,
    notify_booking_declined,
)

logger = logging.getLogger(__name__)

booking_bp = Blueprint('booking_bp', __name__)


def _safe_send_email(fn, *args, **kwargs):
    """Fire-and-forget email dispatch. Email failure must never break the booking flow."""
    try:
        fn(*args, **kwargs)
    except Exception as e:
        logger.error(f"Email dispatch failed ({fn.__name__}): {e}")


# ── Auth Decorators ─────────────────────────────────────────────

def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'student':
            return jsonify({"error": "Student access required"}), 403
        return f(current_user_id=current_user_id, *args, **kwargs)
    return decorated_function


def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"error": "Instructor access required"}), 403
        return f(current_user_id=current_user_id, *args, **kwargs)
    return decorated_function


def admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = int(get_jwt_identity())
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name != 'admin':
            return jsonify({"error": "Admin access required"}), 403
        return f(current_user_id=current_user_id, *args, **kwargs)
    return decorated_function


# ══════════════════════════════════════════════════════════════════
#  STUDENT ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@booking_bp.route('/api/v1/student/booking-instructors', methods=['GET'])
@student_required
def get_booking_instructors(current_user_id):
    """Get instructors eligible for booking based on student's enrollments."""
    try:
        instructors = get_eligible_instructors(current_user_id)
        return jsonify({'instructors': instructors}), 200
    except Exception as e:
        logger.error(f"Error getting eligible instructors: {e}")
        return jsonify({'error': 'Failed to load instructors.'}), 500


@booking_bp.route('/api/v1/student/available-dates/<int:instructor_id>', methods=['GET'])
@student_required
def get_available_dates_endpoint(current_user_id, instructor_id):
    """Get available dates for a specific instructor in a given month."""
    try:
        year = request.args.get('year', type=int, default=date.today().year)
        month = request.args.get('month', type=int, default=date.today().month)
        slot_duration = request.args.get('duration', type=int, default=60)

        result = get_available_dates(instructor_id, year, month, slot_duration)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting available dates: {e}")
        return jsonify({'error': 'Failed to load available dates.'}), 500


@booking_bp.route('/api/v1/student/available-slots/<int:instructor_id>', methods=['GET'])
@student_required
def get_available_slots_endpoint(current_user_id, instructor_id):
    """Get available time slots for a specific instructor on a specific date."""
    try:
        date_str = request.args.get('date')
        if not date_str:
            return jsonify({'error': 'date parameter is required (YYYY-MM-DD).'}), 400

        try:
            target_date = date.fromisoformat(date_str)
        except ValueError:
            return jsonify({'error': 'Invalid date format. Use YYYY-MM-DD.'}), 400

        slot_duration = request.args.get('duration', type=int, default=60)
        timezone_str = request.args.get('timezone', 'UTC')

        slots = get_available_slots(
            instructor_id, target_date, slot_duration, timezone_str, current_user_id
        )
        return jsonify({
            'instructor_id': instructor_id,
            'date': date_str,
            'slots': slots,
            'slot_duration_minutes': slot_duration,
        }), 200
    except Exception as e:
        logger.error(f"Error getting available slots: {e}")
        return jsonify({'error': 'Failed to load available slots.'}), 500


@booking_bp.route('/api/v1/student/bookings', methods=['POST'])
@student_required
def create_booking_endpoint(current_user_id):
    """Create a new booking (status: pending instructor confirmation)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        instructor_id = data.get('instructor_id')
        start_datetime_str = data.get('start_datetime')
        session_topic = data.get('session_topic')
        course_id = data.get('course_id')
        student_notes = data.get('student_notes')
        timezone_str = data.get('timezone', 'UTC')

        if not instructor_id:
            return jsonify({'error': 'instructor_id is required.'}), 400
        if not start_datetime_str:
            return jsonify({'error': 'start_datetime is required.'}), 400
        if not session_topic:
            return jsonify({'error': 'session_topic is required.'}), 400

        try:
            start_datetime = datetime.fromisoformat(start_datetime_str.replace('Z', '+00:00'))
            if start_datetime.tzinfo:
                start_datetime = start_datetime.replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': 'Invalid start_datetime format.'}), 400

        booking, error = create_booking(
            student_id=current_user_id,
            instructor_id=instructor_id,
            start_datetime=start_datetime,
            session_topic=session_topic,
            course_id=course_id,
            student_notes=student_notes,
            timezone_str=timezone_str,
        )

        if error:
            return jsonify({'error': error}), 400

        # In-app notifications (synchronous, non-critical)
        try:
            notify_booking_created(current_user_id, instructor_id, booking)
        except Exception as e:
            logger.error(f"Failed to send booking notifications: {e}")

        # Email notifications (fire-and-forget)
        from ..utils.email_notifications import (
            send_booking_request_student_email,
            send_booking_request_instructor_email,
        )
        _safe_send_email(send_booking_request_student_email, booking)
        _safe_send_email(send_booking_request_instructor_email, booking)

        return jsonify({
            'message': 'Booking request submitted! Awaiting instructor confirmation.',
            'booking': booking.to_dict(),
        }), 201

    except Exception as e:
        logger.error(f"Error creating booking: {e}")
        return jsonify({'error': 'Failed to create booking.'}), 500


@booking_bp.route('/api/v1/student/bookings', methods=['GET'])
@student_required
def get_my_bookings(current_user_id):
    """Get student's bookings."""
    try:
        booking_type = request.args.get('type', 'upcoming')
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        result = get_student_bookings(
            current_user_id, status=status,
            booking_type=booking_type, page=page, per_page=per_page,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting student bookings: {e}")
        return jsonify({'error': 'Failed to load bookings.'}), 500


@booking_bp.route('/api/v1/student/bookings/<int:booking_id>', methods=['GET'])
@student_required
def get_booking_detail(current_user_id, booking_id):
    """Get a specific booking's details."""
    try:
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'error': 'Booking not found.'}), 404
        if booking.student_id != current_user_id:
            return jsonify({'error': 'Access denied.'}), 403

        return jsonify({'booking': booking.to_dict()}), 200
    except Exception as e:
        logger.error(f"Error getting booking detail: {e}")
        return jsonify({'error': 'Failed to load booking details.'}), 500


@booking_bp.route('/api/v1/student/bookings/<int:booking_id>/cancel', methods=['POST'])
@student_required
def cancel_booking_endpoint(current_user_id, booking_id):
    """Cancel a booking."""
    try:
        data = request.get_json() or {}
        reason = data.get('reason')

        success, error = cancel_booking(booking_id, current_user_id, reason)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            # In-app notification
            try:
                notify_booking_cancelled(booking, current_user_id)
            except Exception as e:
                logger.error(f"Failed to send cancellation notification: {e}")

            # Email to instructor
            from ..utils.email_notifications import send_booking_cancelled_instructor_email
            canceller = User.query.get(current_user_id)
            canceller_name = f"{canceller.first_name} {canceller.last_name}" if canceller else "Student"
            _safe_send_email(send_booking_cancelled_instructor_email, booking, canceller_name)

        return jsonify({'message': 'Booking cancelled successfully.'}), 200
    except Exception as e:
        logger.error(f"Error cancelling booking: {e}")
        return jsonify({'error': 'Failed to cancel booking.'}), 500


@booking_bp.route('/api/v1/student/bookings/<int:booking_id>/reschedule', methods=['POST'])
@student_required
def reschedule_booking_endpoint(current_user_id, booking_id):
    """Reschedule a booking to a new time."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        new_start_str = data.get('new_start_datetime')
        if not new_start_str:
            return jsonify({'error': 'new_start_datetime is required.'}), 400

        try:
            new_start = datetime.fromisoformat(new_start_str.replace('Z', '+00:00'))
            if new_start.tzinfo:
                new_start = new_start.replace(tzinfo=None)
        except ValueError:
            return jsonify({'error': 'Invalid date format.'}), 400

        new_booking, error = reschedule_booking(booking_id, current_user_id, new_start)
        if error:
            return jsonify({'error': error}), 400

        old_booking = Booking.query.get(booking_id)
        if old_booking:
            try:
                notify_booking_rescheduled(old_booking, new_booking)
            except Exception as e:
                logger.error(f"Failed to send reschedule notification: {e}")

        return jsonify({
            'message': 'Booking rescheduled successfully!',
            'booking': new_booking.to_dict(),
        }), 200
    except Exception as e:
        logger.error(f"Error rescheduling booking: {e}")
        return jsonify({'error': 'Failed to reschedule booking.'}), 500


@booking_bp.route('/api/v1/student/bookings/calendar', methods=['GET'])
@student_required
def student_bookings_calendar(current_user_id):
    """Get bookings for calendar view (date range query)."""
    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        status = request.args.get('status')

        query = Booking.query.filter(Booking.student_id == current_user_id)

        if start_str:
            try:
                query = query.filter(Booking.start_datetime >= datetime.fromisoformat(start_str))
            except ValueError:
                pass
        if end_str:
            try:
                query = query.filter(Booking.end_datetime <= datetime.fromisoformat(end_str))
            except ValueError:
                pass
        if status:
            query = query.filter(Booking.status == status)
        else:
            query = query.filter(Booking.status.in_([
                BookingStatus.CONFIRMED, BookingStatus.PENDING,
            ]))

        bookings = query.order_by(Booking.start_datetime.asc()).limit(100).all()

        events = []
        for b in bookings:
            events.append({
                'id': b.id,
                'title': f"{b.session_topic} - {b.instructor.first_name} {b.instructor.last_name}" if b.instructor else b.session_topic,
                'start': b.start_datetime.isoformat() if b.start_datetime else None,
                'end': b.end_datetime.isoformat() if b.end_datetime else None,
                'status': b.status,
                'meeting_url': b.meeting_url,
                'booking': b.to_dict(),
            })

        return jsonify({'events': events}), 200
    except Exception as e:
        logger.error(f"Error getting student calendar: {e}")
        return jsonify({'error': 'Failed to load calendar.'}), 500


# ══════════════════════════════════════════════════════════════════
#  INSTRUCTOR ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@booking_bp.route('/api/v1/instructor/my-availability', methods=['GET'])
@instructor_required
def get_my_availability(current_user_id):
    """Get instructor's availability and exceptions."""
    try:
        result = get_instructor_all_availability(current_user_id)
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting instructor availability: {e}")
        return jsonify({'error': 'Failed to load availability.'}), 500


@booking_bp.route('/api/v1/instructor/buffer', methods=['GET', 'PUT'])
@instructor_required
def instructor_buffer(current_user_id):
    """Get or update the instructor's buffer period (time between sessions)."""
    from ..models.user_models import User as _User
    try:
        instructor = _User.query.get(current_user_id)
        if not instructor:
            return jsonify({'error': 'Instructor not found.'}), 404

        if request.method == 'GET':
            return jsonify({
                'buffer_minutes': instructor.buffer_minutes or 0,
            }), 200

        # PUT — update buffer
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        raw = data.get('buffer_minutes')
        if raw is None:
            return jsonify({'error': 'buffer_minutes is required.'}), 400

        try:
            buffer_minutes = int(raw)
        except (TypeError, ValueError):
            return jsonify({'error': 'buffer_minutes must be an integer.'}), 400

        if buffer_minutes < 0:
            return jsonify({'error': 'Buffer period cannot be negative.'}), 400
        if buffer_minutes > 120:
            return jsonify({'error': 'Buffer period cannot exceed 120 minutes.'}), 400

        instructor.buffer_minutes = buffer_minutes
        db.session.commit()

        return jsonify({
            'message': 'Buffer period updated successfully.',
            'buffer_minutes': buffer_minutes,
        }), 200
    except Exception as e:
        logger.error(f"Error managing buffer: {e}")
        return jsonify({'error': 'Failed to manage buffer period.'}), 500


@booking_bp.route('/api/v1/instructor/my-availability', methods=['POST'])
@instructor_required
def create_or_update_availability(current_user_id):
    """Create or update availability slot."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        avail, error = manage_availability(current_user_id, data)
        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'message': 'Availability saved successfully.',
            'availability': avail.to_dict(),
        }), 200
    except Exception as e:
        logger.error(f"Error managing availability: {e}")
        return jsonify({'error': 'Failed to save availability.'}), 500


@booking_bp.route('/api/v1/instructor/my-availability/<int:availability_id>', methods=['DELETE'])
@instructor_required
def delete_availability_endpoint(current_user_id, availability_id):
    """Delete an availability slot."""
    try:
        success, error = delete_availability(availability_id, current_user_id)
        if not success:
            return jsonify({'error': error}), 400

        return jsonify({'message': 'Availability deleted.'}), 200
    except Exception as e:
        logger.error(f"Error deleting availability: {e}")
        return jsonify({'error': 'Failed to delete availability.'}), 500


@booking_bp.route('/api/v1/instructor/my-exceptions', methods=['POST'])
@instructor_required
def create_or_update_exception(current_user_id):
    """Create or update an availability exception (block/special hours)."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        exc, error = manage_exception(current_user_id, data)
        if error:
            return jsonify({'error': error}), 400

        return jsonify({
            'message': 'Exception saved successfully.',
            'exception': exc.to_dict(),
        }), 200
    except Exception as e:
        logger.error(f"Error managing exception: {e}")
        return jsonify({'error': 'Failed to save exception.'}), 500


@booking_bp.route('/api/v1/instructor/my-exceptions/<int:exception_id>', methods=['DELETE'])
@instructor_required
def delete_exception_endpoint(current_user_id, exception_id):
    """Delete an availability exception."""
    try:
        success, error = delete_exception(exception_id, current_user_id)
        if not success:
            return jsonify({'error': error}), 400

        return jsonify({'message': 'Exception deleted.'}), 200
    except Exception as e:
        logger.error(f"Error deleting exception: {e}")
        return jsonify({'error': 'Failed to delete exception.'}), 500


@booking_bp.route('/api/v1/instructor/sessions', methods=['GET'])
@instructor_required
def get_my_sessions(current_user_id):
    """Get instructor's sessions."""
    try:
        booking_type = request.args.get('type', 'upcoming')
        status = request.args.get('status')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        result = get_instructor_bookings(
            current_user_id, status=status,
            booking_type=booking_type, page=page, per_page=per_page,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting instructor sessions: {e}")
        return jsonify({'error': 'Failed to load sessions.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/confirm', methods=['POST'])
@instructor_required
def confirm_session_endpoint(current_user_id, booking_id):
    """Instructor confirms a pending booking request."""
    try:
        success, error = confirm_booking(booking_id, current_user_id)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            # In-app notification to student
            try:
                notify_booking_confirmed(booking)
            except Exception as e:
                logger.error(f"Failed to send confirmation notification: {e}")

            # Email to student
            from ..utils.email_notifications import send_booking_confirmed_student_email
            _safe_send_email(send_booking_confirmed_student_email, booking)

        return jsonify({
            'message': 'Session confirmed successfully.',
            'booking': booking.to_dict() if booking else None,
        }), 200
    except Exception as e:
        logger.error(f"Error confirming session: {e}")
        return jsonify({'error': 'Failed to confirm session.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/decline', methods=['POST'])
@instructor_required
def decline_session_endpoint(current_user_id, booking_id):
    """Instructor declines a pending booking request."""
    try:
        data = request.get_json() or {}
        reason = data.get('reason')

        success, error = decline_booking(booking_id, current_user_id, reason)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            # In-app notification to student
            try:
                notify_booking_declined(booking)
            except Exception as e:
                logger.error(f"Failed to send decline notification: {e}")

            # Email to student
            from ..utils.email_notifications import send_booking_declined_student_email
            _safe_send_email(send_booking_declined_student_email, booking)

        return jsonify({
            'message': 'Session request declined.',
            'booking': booking.to_dict() if booking else None,
        }), 200
    except Exception as e:
        logger.error(f"Error declining session: {e}")
        return jsonify({'error': 'Failed to decline session.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/meeting', methods=['POST'])
@instructor_required
def update_meeting_link_endpoint(current_user_id, booking_id):
    """Add or update a meeting link for a booking."""
    try:
        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        meeting_url = data.get('meeting_url')
        meeting_provider = data.get('meeting_provider')

        if meeting_url and not meeting_provider:
            return jsonify({'error': 'meeting_provider is required when meeting_url is provided.'}), 400

        success, error = update_meeting_link(
            booking_id, current_user_id,
            meeting_url, meeting_provider,
        )
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        return jsonify({
            'message': 'Meeting link updated successfully.',
            'booking': booking.to_dict() if booking else None,
        }), 200
    except Exception as e:
        logger.error(f"Error updating meeting link: {e}")
        return jsonify({'error': 'Failed to update meeting link.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/complete', methods=['POST'])
@instructor_required
def complete_session_endpoint(current_user_id, booking_id):
    """Mark a session as completed."""
    try:
        data = request.get_json() or {}
        notes = data.get('notes')

        success, error = complete_booking(booking_id, current_user_id, notes)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            try:
                notify_booking_completed(booking)
            except Exception as e:
                logger.error(f"Failed to send completion notification: {e}")

        return jsonify({'message': 'Session marked as completed.'}), 200
    except Exception as e:
        logger.error(f"Error completing session: {e}")
        return jsonify({'error': 'Failed to complete session.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/no-show', methods=['POST'])
@instructor_required
def mark_no_show_endpoint(current_user_id, booking_id):
    """Mark a session as no-show."""
    try:
        success, error = mark_no_show(booking_id, current_user_id)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            try:
                notify_booking_no_show(booking)
            except Exception as e:
                logger.error(f"Failed to send no-show notification: {e}")

        return jsonify({'message': 'Session marked as no-show.'}), 200
    except Exception as e:
        logger.error(f"Error marking no-show: {e}")
        return jsonify({'error': 'Failed to mark no-show.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/notes', methods=['PUT'])
@instructor_required
def update_session_notes(current_user_id, booking_id):
    """Update instructor notes on a session."""
    try:
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'error': 'Booking not found.'}), 404
        if booking.instructor_id != current_user_id:
            return jsonify({'error': 'Access denied.'}), 403

        data = request.get_json()
        if not data:
            return jsonify({'error': 'Request body is required.'}), 400

        booking.instructor_notes = data.get('instructor_notes', booking.instructor_notes)
        db.session.commit()

        return jsonify({'message': 'Notes updated.', 'booking': booking.to_dict()}), 200
    except Exception as e:
        logger.error(f"Error updating notes: {e}")
        return jsonify({'error': 'Failed to update notes.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/<int:booking_id>/cancel', methods=['POST'])
@instructor_required
def instructor_cancel_endpoint(current_user_id, booking_id):
    """Instructor cancels a session."""
    try:
        data = request.get_json() or {}
        reason = data.get('reason')

        success, error = cancel_booking(booking_id, current_user_id, reason)
        if not success:
            return jsonify({'error': error}), 400

        booking = Booking.query.get(booking_id)
        if booking:
            try:
                notify_booking_cancelled(booking, current_user_id)
            except Exception as e:
                logger.error(f"Failed to send cancellation notification: {e}")

            # Email to student
            from ..utils.email_notifications import send_booking_cancelled_student_email
            canceller = User.query.get(current_user_id)
            canceller_name = f"{canceller.first_name} {canceller.last_name}" if canceller else "Instructor"
            _safe_send_email(send_booking_cancelled_student_email, booking, canceller_name)

        return jsonify({'message': 'Session cancelled.'}), 200
    except Exception as e:
        logger.error(f"Error cancelling session: {e}")
        return jsonify({'error': 'Failed to cancel session.'}), 500


@booking_bp.route('/api/v1/instructor/sessions/calendar', methods=['GET'])
@instructor_required
def instructor_sessions_calendar(current_user_id):
    """Get sessions for instructor calendar view (date range query)."""
    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        status = request.args.get('status')

        query = Booking.query.filter(Booking.instructor_id == current_user_id)

        if start_str:
            try:
                query = query.filter(Booking.start_datetime >= datetime.fromisoformat(start_str))
            except ValueError:
                pass
        if end_str:
            try:
                query = query.filter(Booking.end_datetime <= datetime.fromisoformat(end_str))
            except ValueError:
                pass
        if status:
            query = query.filter(Booking.status == status)
        else:
            query = query.filter(Booking.status.in_([
                BookingStatus.CONFIRMED, BookingStatus.PENDING,
            ]))

        bookings = query.order_by(Booking.start_datetime.asc()).limit(100).all()

        events = []
        for b in bookings:
            events.append({
                'id': b.id,
                'title': f"{b.session_topic} - {b.student.first_name} {b.student.last_name}" if b.student else b.session_topic,
                'start': b.start_datetime.isoformat() if b.start_datetime else None,
                'end': b.end_datetime.isoformat() if b.end_datetime else None,
                'status': b.status,
                'meeting_url': b.meeting_url,
                'booking': b.to_dict(),
            })

        return jsonify({'events': events}), 200
    except Exception as e:
        logger.error(f"Error getting instructor calendar: {e}")
        return jsonify({'error': 'Failed to load calendar.'}), 500


# ══════════════════════════════════════════════════════════════════
#  ADMIN ENDPOINTS
# ══════════════════════════════════════════════════════════════════

@booking_bp.route('/api/v1/admin/bookings', methods=['GET'])
@admin_required
def admin_get_all_bookings(current_user_id):
    """Get all bookings with filters (admin only)."""
    try:
        status = request.args.get('status')
        instructor_id = request.args.get('instructor_id', type=int)
        student_id = request.args.get('student_id', type=int)
        course_id = request.args.get('course_id', type=int)
        date_from = request.args.get('date_from')
        date_to = request.args.get('date_to')
        search = request.args.get('search')
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)

        result = get_all_bookings(
            status=status, instructor_id=instructor_id,
            student_id=student_id, course_id=course_id,
            date_from=date_from, date_to=date_to, search=search,
            page=page, per_page=per_page,
        )
        return jsonify(result), 200
    except Exception as e:
        logger.error(f"Error getting admin bookings: {e}")
        return jsonify({'error': 'Failed to load bookings.'}), 500


@booking_bp.route('/api/v1/admin/bookings/stats', methods=['GET'])
@admin_required
def admin_booking_stats(current_user_id):
    """Get booking statistics (admin only)."""
    try:
        stats = get_booking_stats()
        return jsonify(stats), 200
    except Exception as e:
        logger.error(f"Error getting booking stats: {e}")
        return jsonify({'error': 'Failed to load statistics.'}), 500


@booking_bp.route('/api/v1/admin/bookings/<int:booking_id>', methods=['GET'])
@admin_required
def admin_get_booking_detail(current_user_id, booking_id):
    """Get booking detail (admin only)."""
    try:
        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'error': 'Booking not found.'}), 404
        return jsonify({'booking': booking.to_dict()}), 200
    except Exception as e:
        logger.error(f"Error getting booking detail: {e}")
        return jsonify({'error': 'Failed to load booking.'}), 500


@booking_bp.route('/api/v1/admin/bookings/<int:booking_id>/cancel', methods=['POST'])
@admin_required
def admin_cancel_booking(current_user_id, booking_id):
    """Admin cancels a booking (no restrictions)."""
    try:
        data = request.get_json() or {}
        reason = data.get('reason', 'Cancelled by administrator')

        booking = Booking.query.get(booking_id)
        if not booking:
            return jsonify({'error': 'Booking not found.'}), 404

        if booking.status not in [BookingStatus.CONFIRMED, BookingStatus.PENDING]:
            return jsonify({'error': 'This booking cannot be cancelled.'}), 400

        booking.status = BookingStatus.CANCELLED
        booking.cancellation_reason = reason
        booking.cancelled_by = current_user_id
        booking.cancelled_at = datetime.utcnow()
        db.session.commit()

        try:
            notify_booking_cancelled(booking, current_user_id)
        except Exception as e:
            logger.error(f"Failed to send cancellation notification: {e}")

        # Email both parties
        from ..utils.email_notifications import (
            send_booking_cancelled_student_email,
            send_booking_cancelled_instructor_email,
        )
        admin_user = User.query.get(current_user_id)
        admin_name = f"{admin_user.first_name} {admin_user.last_name}" if admin_user else "Administrator"
        _safe_send_email(send_booking_cancelled_student_email, booking, admin_name)
        _safe_send_email(send_booking_cancelled_instructor_email, booking, admin_name)

        return jsonify({'message': 'Booking cancelled by admin.'}), 200
    except Exception as e:
        logger.error(f"Error cancelling booking: {e}")
        return jsonify({'error': 'Failed to cancel booking.'}), 500


@booking_bp.route('/api/v1/admin/bookings/calendar', methods=['GET'])
@admin_required
def admin_bookings_calendar(current_user_id):
    """Get all bookings for admin calendar view."""
    try:
        start_str = request.args.get('start')
        end_str = request.args.get('end')
        status = request.args.get('status')
        instructor_id = request.args.get('instructor_id', type=int)
        student_id = request.args.get('student_id', type=int)

        query = Booking.query

        if start_str:
            try:
                query = query.filter(Booking.start_datetime >= datetime.fromisoformat(start_str))
            except ValueError:
                pass
        if end_str:
            try:
                query = query.filter(Booking.end_datetime <= datetime.fromisoformat(end_str))
            except ValueError:
                pass
        if status:
            query = query.filter(Booking.status == status)
        if instructor_id:
            query = query.filter(Booking.instructor_id == instructor_id)
        if student_id:
            query = query.filter(Booking.student_id == student_id)

        bookings = query.order_by(Booking.start_datetime.asc()).limit(200).all()

        events = []
        for b in bookings:
            events.append({
                'id': b.id,
                'title': f"{b.session_topic}",
                'start': b.start_datetime.isoformat() if b.start_datetime else None,
                'end': b.end_datetime.isoformat() if b.end_datetime else None,
                'status': b.status,
                'meeting_url': b.meeting_url,
                'booking': b.to_dict(),
            })

        return jsonify({'events': events}), 200
    except Exception as e:
        logger.error(f"Error getting admin calendar: {e}")
        return jsonify({'error': 'Failed to load calendar.'}), 500


@booking_bp.route('/api/v1/admin/instructors', methods=['GET'])
@admin_required
def admin_get_instructors(current_user_id):
    """Get all instructors for admin booking management."""
    try:
        instructors = User.query.join(User.role).filter(
            User.role.has(name='instructor'),
            User.is_active == True,
        ).all()

        result = []
        for instructor in instructors:
            has_availability = InstructorAvailability.query.filter_by(
                instructor_id=instructor.id, is_active=True
            ).first() is not None

            total_sessions = Booking.query.filter_by(instructor_id=instructor.id).count()
            active_sessions = Booking.query.filter(
                Booking.instructor_id == instructor.id,
                Booking.status.in_([BookingStatus.CONFIRMED, BookingStatus.PENDING]),
                Booking.start_datetime >= datetime.utcnow(),
            ).count()

            result.append({
                'id': instructor.id,
                'name': f"{instructor.first_name} {instructor.last_name}",
                'email': instructor.email,
                'profile_picture': instructor.profile_picture_url,
                'has_availability': has_availability,
                'buffer_minutes': instructor.buffer_minutes or 0,
                'total_sessions': total_sessions,
                'active_sessions': active_sessions,
            })

        return jsonify({'instructors': result}), 200
    except Exception as e:
        logger.error(f"Error getting instructors: {e}")
        return jsonify({'error': 'Failed to load instructors.'}), 500
