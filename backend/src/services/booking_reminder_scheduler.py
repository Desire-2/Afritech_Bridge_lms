"""
APScheduler job that sends reminder notifications for upcoming confirmed sessions.

Runs every 15 minutes and checks for bookings needing 24h or 1h reminders.
Uses idempotency flags (reminder_24h_sent / reminder_1h_sent) on the Booking model
to prevent duplicate sends.
"""

import logging
from datetime import datetime, timedelta

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.interval import IntervalTrigger

from ..models.user_models import db
from ..models.booking_models import Booking, BookingStatus

logger = logging.getLogger(__name__)

booking_reminder_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler_started = False


def _send_reminders(app):
    """Check for bookings needing reminders and dispatch them."""
    with app.app_context():
        now = datetime.utcnow()

        # ── 24-hour reminders ───────────────────────────────────
        window_24h_start = now + timedelta(hours=23)
        window_24h_end = now + timedelta(hours=25)

        bookings_24h = Booking.query.filter(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.reminder_24h_sent == False,
            Booking.start_datetime >= window_24h_start,
            Booking.start_datetime <= window_24h_end,
        ).all()

        if bookings_24h:
            logger.info("📬 Found %s booking(s) needing 24h reminders", len(bookings_24h))

        sent_24h = 0
        failed_24h = 0
        for booking in bookings_24h:
            try:
                _send_reminder_for_booking(app, booking, hours_before=24)
                booking.reminder_24h_sent = True
                sent_24h += 1
            except Exception as exc:
                logger.error(
                    "❌ 24h reminder failed for booking %s: %s",
                    booking.id,
                    exc,
                )
                failed_24h += 1

        # ── 1-hour reminders ────────────────────────────────────
        window_1h_start = now + timedelta(minutes=30)
        window_1h_end = now + timedelta(hours=1, minutes=30)

        bookings_1h = Booking.query.filter(
            Booking.status == BookingStatus.CONFIRMED,
            Booking.reminder_1h_sent == False,
            Booking.start_datetime >= window_1h_start,
            Booking.start_datetime <= window_1h_end,
        ).all()

        if bookings_1h:
            logger.info("📬 Found %s booking(s) needing 1h reminders", len(bookings_1h))

        sent_1h = 0
        failed_1h = 0
        for booking in bookings_1h:
            try:
                _send_reminder_for_booking(app, booking, hours_before=1)
                booking.reminder_1h_sent = True
                sent_1h += 1
            except Exception as exc:
                logger.error(
                    "❌ 1h reminder failed for booking %s: %s",
                    booking.id,
                    exc,
                )
                failed_1h += 1

        # ── Commit flag updates ─────────────────────────────────
        if sent_24h or failed_24h or sent_1h or failed_1h:
            try:
                db.session.commit()
            except Exception as exc:
                logger.error("❌ Failed to commit reminder flags: %s", exc)
                db.session.rollback()

        if sent_24h or failed_24h:
            logger.info(
                "📬 24h reminders: %s sent, %s failed",
                sent_24h,
                failed_24h,
            )
        if sent_1h or failed_1h:
            logger.info(
                "📬 1h reminders: %s sent, %s failed",
                sent_1h,
                failed_1h,
            )
        if not (bookings_24h or bookings_1h):
            logger.debug("📬 No booking reminders due")


def _send_reminder_for_booking(app, booking, hours_before):
    """Send both in-app notification and email for a single booking reminder."""
    from ..services.notification_service import notify_booking_reminder
    from ..utils.email_notifications import send_booking_reminder_email

    notify_booking_reminder(booking, hours_before)
    send_booking_reminder_email(booking, hours_before)


def start_booking_reminder_scheduler(app):
    """Start the booking reminder scheduler once.

    Runs every 15 minutes to check for upcoming confirmed sessions
    that need 24-hour or 1-hour reminders.
    """
    global _scheduler_started

    if _scheduler_started:
        return

    enabled = app.config.get("ENABLE_SCHEDULERS", False)
    if not enabled:
        logger.info("Booking reminder scheduler is disabled")
        return

    booking_reminder_scheduler.add_job(
        func=lambda: _send_reminders(app),
        trigger=IntervalTrigger(minutes=15),
        id="booking_reminder_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    booking_reminder_scheduler.start()
    _scheduler_started = True
    logger.info("✅ Booking reminder scheduler started (every 15 min)")
