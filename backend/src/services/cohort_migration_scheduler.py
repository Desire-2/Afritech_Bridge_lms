"""APScheduler job for cohort-end auto migration."""

import logging
from datetime import date

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from ..models.user_models import db
from ..models.course_models import ApplicationWindow
from .waitlist_service import WaitlistService

logger = logging.getLogger(__name__)

cohort_migration_scheduler = BackgroundScheduler(timezone="UTC")
_scheduler_started = False


def check_cohort_end_migrations(app):
    """Runs daily at 21:59 and migrates students from cohorts ending today."""
    with app.app_context():
        today = date.today()
        ending_windows = ApplicationWindow.query.filter(
            db.func.date(ApplicationWindow.cohort_end) == today
        ).all()

        logger.info("⏰ Cohort migration check found %s ending window(s) for %s", len(ending_windows), today)

        for window in ending_windows:
            try:
                WaitlistService.auto_migrate_cohort_end_students(window.id)
            except Exception as exc:
                logger.error("❌ Cohort migration job failed for window %s: %s", window.id, exc)


def start_cohort_migration_scheduler(app):
    """Start the daily cohort migration scheduler once."""
    global _scheduler_started

    if _scheduler_started:
        return

    enabled = app.config.get("ENABLE_SCHEDULERS", False)
    if not enabled:
        logger.info("Cohort migration scheduler is disabled")
        return

    cohort_migration_scheduler.add_job(
        func=lambda: check_cohort_end_migrations(app),
        trigger=CronTrigger(hour=21, minute=59),
        id="cohort_end_migration_job",
        replace_existing=True,
        max_instances=1,
        coalesce=True,
    )
    cohort_migration_scheduler.start()
    _scheduler_started = True
    logger.info("✅ Cohort migration scheduler started (daily 21:59 UTC)")