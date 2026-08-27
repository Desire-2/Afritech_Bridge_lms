"""
Booking email templates for AfriTech Bridge LMS
Uses the same branding/layout as all other AfriTech Bridge emails.
"""
import os
from .email_templates import get_email_header, get_email_footer, _frontend_url


MEETING_PROVIDER_LABELS = {
    'zoom': 'Zoom',
    'google_meet': 'Google Meet',
    'microsoft_teams': 'Microsoft Teams',
    'other': 'Online Meeting',
}


def _booking_session_card(booking_data, recipient_type='student'):
    """Render a reusable session details card for booking emails.

    booking_data: dict with keys:
        student_name, instructor_name, course_name, session_topic,
        date_str, time_str, duration_str, timezone, status, meeting_url, meeting_provider
    recipient_type: 'student' or 'instructor' for context-appropriate labels
    """
    topic = booking_data.get('session_topic', 'Session')
    date_str = booking_data.get('date_str', '')
    time_str = booking_data.get('time_str', '')
    duration_str = booking_data.get('duration_str', '60 minutes')
    timezone = booking_data.get('timezone', 'UTC')
    status = booking_data.get('status', 'pending')
    student_name = booking_data.get('student_name', 'Student')
    instructor_name = booking_data.get('instructor_name', 'Instructor')
    course_name = booking_data.get('course_name')

    status_colors = {
        'pending': ('#f59e0b', '#fef3c7', 'Awaiting Confirmation'),
        'confirmed': ('#10b981', '#d1fae5', 'Confirmed'),
        'cancelled': ('#ef4444', '#fee2e2', 'Cancelled'),
        'completed': ('#6366f1', '#ede9fe', 'Completed'),
        'declined': ('#ef4444', '#fee2e2', 'Declined'),
        'no_show': ('#ef4444', '#fee2e2', 'No-Show'),
    }
    status_color, status_bg, status_label = status_colors.get(status, ('#6b7280', '#f3f4f6', status.title()))

    other_party = student_name if recipient_type == 'instructor' else instructor_name

    card = f"""
    <div style="background: #ffffff; border-radius: 16px; border: 1px solid #e5e7eb; padding: 28px; margin: 20px 0;">
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px;">
            <h3 style="margin: 0; font-size: 18px; color: #1f2937; font-weight: 700;">Session Details</h3>
            <span style="display: inline-block; background: {status_bg}; color: {status_color}; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600;">{status_label}</span>
        </div>

        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="margin-bottom: 16px;">
            <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; width: 120px; vertical-align: top;">Topic</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 600;">{topic}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">{'Student' if recipient_type == 'instructor' else 'Instructor'}</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{other_party}</td>
            </tr>
            {"<tr><td style='padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;'>Course</td><td style='padding: 8px 0; color: #1f2937; font-size: 14px;'>" + course_name + "</td></tr>" if course_name else ""}
            <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Date & Time</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px; font-weight: 500;">{date_str} at {time_str}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Duration</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">{duration_str}</td>
            </tr>
            <tr>
                <td style="padding: 8px 0; color: #6b7280; font-size: 13px; vertical-align: top;">Timezone</td>
                <td style="padding: 8px 0; color: #1f2937; font-size: 14px;">{timezone}</td>
            </tr>
        </table>
    </div>
    """
    return card


def _booking_cta_button(text, url, color='#667eea'):
    """Render a CTA button in the AfriTech Bridge style."""
    return f"""
    <div style="text-align: center; margin: 30px 0;">
        <a href="{url}" style="display: inline-block; background: {color}; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);">
            {text}
        </a>
    </div>
    """


def _booking_content_wrapper(content_html):
    """Wrap email content in the standard content section."""
    return f"""
    <div class="email-content" style="background: #34495e; padding: 10px 30px 30px 30px;">
        <div style="background: #ffffff; border-radius: 16px; padding: 30px; margin-bottom: 20px;">
            {content_html}
        </div>
    </div>
    """


def _format_booking_datetime(start_datetime, timezone_str='UTC'):
    """Format a booking datetime for display in emails."""
    if not start_datetime:
        return '', '', ''
    date_str = start_datetime.strftime('%A, %B %d, %Y')
    time_str = start_datetime.strftime('%I:%M %p')
    duration_str = '60 minutes'
    return date_str, time_str, duration_str


def _parse_booking_for_email(booking):
    """Extract common booking data for email templates."""
    from datetime import datetime as dt
    start = booking.start_datetime
    end = booking.end_datetime
    duration_minutes = int((end - start).total_seconds() / 60) if start and end else 60

    return {
        'student_name': f"{booking.student.first_name} {booking.student.last_name}" if booking.student else 'Student',
        'student_email': booking.student.email if booking.student else '',
        'instructor_name': f"{booking.instructor.first_name} {booking.instructor.last_name}" if booking.instructor else 'Instructor',
        'instructor_email': booking.instructor.email if booking.instructor else '',
        'course_name': booking.course.title if booking.course else None,
        'session_topic': booking.session_topic or 'Session',
        'date_str': start.strftime('%A, %B %d, %Y') if start else '',
        'time_str': start.strftime('%I:%M %p') if start else '',
        'end_time_str': end.strftime('%I:%M %p') if end else '',
        'duration_str': f'{duration_minutes} minutes',
        'timezone': booking.timezone or 'UTC',
        'status': booking.status,
        'meeting_url': booking.meeting_url,
        'meeting_provider': booking.meeting_provider,
        'booking_id': booking.id,
    }


# ══════════════════════════════════════════════════════════════════
#  EMAIL TEMPLATES
# ══════════════════════════════════════════════════════════════════

def booking_request_student_email(booking, unsub_token=None):
    """Sent to student immediately after booking: 'Your request has been received'."""
    data = _parse_booking_for_email(booking)
    view_url = _frontend_url(f"student/bookings/{booking.id}")

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">📅</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Booking Request Received</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            Your one-to-one session request has been submitted successfully.
        </p>

        {_booking_session_card(data, 'student')}

        <div style="background: #fef3c7; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <p style="margin: 0; color: #92400e; font-size: 14px; font-weight: 500;">
                ⏳ <strong>Status:</strong> Awaiting Instructor Confirmation
            </p>
            <p style="margin: 8px 0 0 0; color: #78350f; font-size: 13px;">
                {data['instructor_name']} will review your request. You'll receive an email once they confirm or decline. You can also track the status in your dashboard.
            </p>
        </div>

        {_booking_cta_button('View Booking', view_url)}

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
            You can cancel this session up to 24 hours before the scheduled time.
        </p>
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')


def booking_request_instructor_email(booking, unsub_token=None):
    """Sent to instructor immediately when a student books: 'New Session Request'."""
    data = _parse_booking_for_email(booking)
    review_url = _frontend_url(f"instructor/sessions")

    student_notes = booking.student_notes
    notes_html = ""
    if student_notes:
        notes_html = f"""
        <div style="background: #f9fafb; border-left: 3px solid #667eea; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px;">Student Notes</p>
            <p style="margin: 6px 0 0 0; color: #374151; font-size: 14px; font-style: italic;">"{student_notes}"</p>
        </div>
        """

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">📩</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">New Session Request</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            A student has requested a one-to-one session with you.
        </p>

        {_booking_session_card(data, 'instructor')}

        {notes_html}

        <p style="color: #374151; font-size: 14px; line-height: 1.6;">
            Please review this request and confirm the session. Once confirmed, the student will be notified and you can add a meeting link.
        </p>

        {_booking_cta_button('Review & Confirm Session', review_url)}
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')


def booking_confirmed_student_email(booking, unsub_token=None):
    """Sent to student when instructor confirms: 'Your Session Has Been Confirmed'."""
    data = _parse_booking_for_email(booking)
    view_url = _frontend_url(f"student/bookings/{booking.id}")

    meeting_section = ""
    if data['meeting_url']:
        provider_label = MEETING_PROVIDER_LABELS.get(data['meeting_provider'], 'Online Meeting')
        meeting_section = f"""
        <div style="background: #ecfdf5; border-radius: 12px; padding: 16px 20px; margin: 20px 0; text-align: center;">
            <p style="margin: 0; color: #065f46; font-size: 14px; font-weight: 500;">
                🎥 <strong>{provider_label} Link Available</strong>
            </p>
            <a href="{data['meeting_url']}" style="display: inline-block; margin-top: 10px; background: #10b981; color: #ffffff; padding: 10px 24px; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 600;">
                Join Session
            </a>
        </div>
        """
    else:
        meeting_section = """
        <div style="background: #eff6ff; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <p style="margin: 0; color: #1e40af; font-size: 14px;">
                ℹ️ Your instructor has confirmed the session. The meeting link will appear in your dashboard once it has been added.
            </p>
        </div>
        """

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">✅</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Session Confirmed!</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            Great news! {data['instructor_name']} has confirmed your session.
        </p>

        {_booking_session_card(data, 'student')}

        {meeting_section}

        {_booking_cta_button('View Session Details', view_url)}
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')


def booking_declined_student_email(booking, unsub_token=None):
    """Sent to student when instructor declines: 'Session Request Declined'."""
    data = _parse_booking_for_email(booking)
    browse_url = _frontend_url(f"student/bookings/new")

    reason = booking.cancellation_reason
    reason_html = ""
    if reason:
        reason_html = f"""
        <div style="background: #fef2f2; border-left: 3px solid #ef4444; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #991b1b; font-size: 14px;">"{reason}"</p>
        </div>
        """

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">😔</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Session Request Declined</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            {data['instructor_name']} is unable to attend this session.
        </p>

        {_booking_session_card(data, 'student')}

        {reason_html}

        <p style="color: #374151; font-size: 14px; line-height: 1.6; text-align: center;">
            Don't worry! You can try booking a different time slot or reach out to your instructor for alternative arrangements.
        </p>

        {_booking_cta_button('Book Another Session', browse_url)}
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')


def booking_cancelled_email(booking, cancelled_by_name, recipient_type='student', unsub_token=None):
    """Sent to the affected party when a booking is cancelled."""
    data = _parse_booking_for_email(booking)
    other_party = data['student_name'] if recipient_type == 'instructor' else data['instructor_name']

    reason = booking.cancellation_reason
    reason_html = ""
    if reason:
        reason_html = f"""
        <div style="background: #f9fafb; border-left: 3px solid #ef4444; padding: 12px 16px; margin: 12px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; color: #6b7280; font-size: 12px; font-weight: 600; text-transform: uppercase;">Reason</p>
            <p style="margin: 6px 0 0 0; color: #374151; font-size: 14px;">{reason}</p>
        </div>
        """

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">❌</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Session Cancelled</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            {other_party} has cancelled the scheduled session.
        </p>

        {_booking_session_card(data, recipient_type)}

        {reason_html}

        <p style="color: #9ca3af; font-size: 12px; text-align: center; margin-top: 20px;">
            This booking has been cancelled and is no longer active.
        </p>
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')


def booking_reminder_email(booking, hours_before, recipient_type='student', unsub_token=None):
    """Session reminder sent to both student and instructor."""
    data = _parse_booking_for_email(booking)
    time_label = f"{hours_before} hour{'s' if hours_before != 1 else ''}" if hours_before < 24 else "24 hours"

    meeting_section = ""
    if data['meeting_url']:
        provider_label = MEETING_PROVIDER_LABELS.get(data['meeting_provider'], 'Online Meeting')
        meeting_section = f"""
        <div style="text-align: center; margin: 20px 0;">
            <a href="{data['meeting_url']}" style="display: inline-block; background: #10b981; color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.4);">
                Join {provider_label}
            </a>
        </div>
        """
    else:
        meeting_section = """
        <div style="background: #eff6ff; border-radius: 12px; padding: 12px 16px; margin: 16px 0; text-align: center;">
            <p style="margin: 0; color: #1e40af; font-size: 13px;">Meeting link will appear in your dashboard once added.</p>
        </div>
        """

    content = f"""
        <div style="text-align: center; margin-bottom: 20px;">
            <span style="font-size: 48px;">⏰</span>
        </div>
        <h2 style="color: #1f2937; margin: 0 0 10px 0; font-size: 22px; text-align: center;">Session Starting in {time_label}</h2>
        <p style="color: #6b7280; text-align: center; margin: 0 0 24px 0;">
            This is a friendly reminder about your upcoming session.
        </p>

        {_booking_session_card(data, recipient_type)}

        {meeting_section}

        <div style="background: #f0fdf4; border-radius: 12px; padding: 16px 20px; margin: 20px 0;">
            <p style="margin: 0; color: #166534; font-size: 14px; font-weight: 500;">💡 Preparation Tips</p>
            <ul style="margin: 8px 0 0 0; padding-left: 20px; color: #15803d; font-size: 13px;">
                <li>Review your notes or questions for this session</li>
                <li>Ensure you have a stable internet connection</li>
                <li>Find a quiet space for the session</li>
            </ul>
        </div>
    """
    return get_email_header() + _booking_content_wrapper(content) + get_email_footer(unsub_token, 'booking')
