"""APScheduler job that notifies enrolled students when their cohort starts."""

import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..models.user_models import db
from ..models.course_models import ApplicationWindow, Enrollment

logger = logging.getLogger(__name__)

cohort_start_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler_started = False


def _notify_cohort_start(app):
    """Find cohorts starting today and email all enrolled students."""
    with app.app_context():
        today = date.today()

        starting_windows = ApplicationWindow.query.filter(
            db.func.date(ApplicationWindow.cohort_start) == today
        ).all()

        if not starting_windows:
            logger.info("📬 No cohorts starting today (%s)", today)
            return

        logger.info("📬 Found %s cohort(s) starting today — sending notifications", len(starting_windows))

        from ..utils.email_notifications import send_cohort_start_notification

        for window in starting_windows:
            try:
                # Only send to enrollments that haven't been notified yet
                enrollments = Enrollment.query.filter_by(
                    application_window_id=window.id,
                    cohort_start_notified=False,
                ).all()

                if not enrollments:
                    logger.info(
                        "✅ Cohort '%s' (window %s): all enrollments already notified",
                        window.cohort_label or "N/A",
                        window.id,
                    )
                    continue

                sent = 0
                failed = 0
                for enrollment in enrollments:
                    try:
                        if send_cohort_start_notification(enrollment):
                            enrollment.cohort_start_notified = True
                            sent += 1
                        else:
                            failed += 1
                    except Exception as exc:
                        logger.error(
                            "❌ Cohort start notification failed for enrollment %s: %s",
                            enrollment.id,
                            exc,
                        )
                        failed += 1

                try:
                    db.session.commit()
                except Exception as exc:
                    logger.error("❌ Failed to commit cohort_start_notified flags: %s", exc)
                    db.session.rollback()

                logger.info(
                    "✅ Cohort '%s' (window %s): %s sent, %s failed out of %s enrollments",
                    window.cohort_label or "N/A",
                    window.id,
                    sent,
                    failed,
                    len(enrollments),
                )
            except Exception as exc:
                logger.error(
                    "❌ Cohort start notification job failed for window %s: %s",
                    window.id,
                    exc,
                )


def start_cohort_start_notification_scheduler(app):
    """Start the daily cohort-start notification scheduler once."""
    global _scheduler_started

    if _scheduler_started:
        return

    enabled = app.config.get("ENABLE_SCHEDULERS", False)
    if not enabled:
        logger.info("Cohort start notification scheduler is disabled")
        return

    cohort_start_scheduler.add_job(
        func=lambda: _notify_cohort_start(app),
        trigger=CronTrigger(hour=8, minute=0),
        id="cohort_start_notification_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    cohort_start_scheduler.start()
    _scheduler_started = True
    logger.info("✅ Cohort start notification scheduler started (daily 08:00 UTC)")
