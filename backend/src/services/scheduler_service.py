"""
Background Task Scheduler for Afritec Bridge LMS
Handles automated cleanup of inactive users and students.

Uses APScheduler (already declared in requirements.txt) instead of the
third-party `schedule` package, which is not installed in the project
virtualenv and made this module un-importable.
"""

import atexit
import logging
from datetime import datetime, timedelta
from typing import Optional

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger

from ..services.inactivity_service import InactivityService
from ..models.user_models import db, User, Role

logger = logging.getLogger(__name__)

# Jobs are scheduled in the same local timezone the app stores timestamps in.
SCHEDULER_TIMEZONE = "Africa/Kigali"


class BackgroundTaskScheduler:
    """Manages background tasks for the LMS"""

    def __init__(self, app=None):
        self.app = app
        self.scheduler: Optional[BackgroundScheduler] = None

    @property
    def running(self) -> bool:
        return bool(self.scheduler and self.scheduler.running)

    def init_app(self, app):
        """Initialize with Flask app"""
        self.app = app

    def start_scheduler(self):
        """Start the background task scheduler"""
        if self.running:
            logger.warning("Scheduler is already running")
            return

        logger.info("Starting background task scheduler...")

        self.scheduler = BackgroundScheduler(timezone=SCHEDULER_TIMEZONE)
        self._schedule_tasks(self.scheduler)
        self.scheduler.start()

        logger.info("Background task scheduler started successfully")

    def stop_scheduler(self):
        """Stop the background task scheduler"""
        if not self.scheduler:
            return

        logger.info("Stopping background task scheduler...")
        try:
            self.scheduler.shutdown(wait=False)
        except Exception as e:
            logger.error(f"Error shutting down scheduler: {str(e)}")
        finally:
            self.scheduler = None

        logger.info("Background task scheduler stopped")

    def _schedule_tasks(self, scheduler: BackgroundScheduler):
        """Schedule all background tasks"""

        jobs = [
            # Daily cleanup check at 2 AM
            (CronTrigger(hour=2, minute=0), None, self._daily_cleanup_check, "daily_cleanup_check"),
            # Weekly comprehensive cleanup on Sundays at 3 AM
            (CronTrigger(day_of_week="sun", hour=3, minute=0), None,
             self._weekly_cleanup, "weekly_cleanup"),
            # Send inactivity warnings every 3 days at 10 AM
            (IntervalTrigger(days=3), self._next_run_at(hour=10),
             self._send_inactivity_warnings, "send_inactivity_warnings"),
            # Send account deactivation (pre-deletion) warnings weekly on Mondays at 9 AM
            (CronTrigger(day_of_week="mon", hour=9, minute=0), None,
             self._send_deletion_warnings, "send_deletion_warnings"),
            # Update user activity stats every 6 hours
            (IntervalTrigger(hours=6), None, self._update_activity_stats, "update_activity_stats"),
            # Send payment reminders (drafts / unapproved / pending-payment
            # enrollments) daily at 09:30 local time
            (CronTrigger(hour=9, minute=30), None,
             self._send_payment_reminders, "send_payment_reminders"),
        ]

        for trigger, next_run_time, func, job_id in jobs:
            scheduler.add_job(
                func=func,
                trigger=trigger,
                next_run_time=next_run_time,
                id=job_id,
                replace_existing=True,
                max_instances=1,
                coalesce=True,
            )

        logger.info("Background tasks scheduled successfully")

    @staticmethod
    def _next_run_at(hour: int, minute: int = 0):
        """Next local occurrence of HH:MM (used to anchor interval jobs)."""
        candidate = datetime.now().replace(hour=hour, minute=minute, second=0, microsecond=0)
        if candidate <= datetime.now():
            candidate += timedelta(days=1)
        return candidate

    def _daily_cleanup_check(self):
        """Daily check for cleanup candidates"""
        logger.info("Running daily cleanup check...")

        try:
            with self.app.app_context():
                # Get inactive users for deletion (14+ days)
                inactive_users = InactivityService.get_inactive_users(threshold_days=14)

                # Get inactive students for termination warning (5+ days)
                approaching_termination = InactivityService.get_inactive_students(threshold_days=5)

                # Log summary
                logger.info("Daily cleanup check completed:")
                logger.info(f"  - {len(inactive_users)} users inactive for 14+ days (deletion candidates)")
                logger.info(f"  - {len(approaching_termination)} students inactive for 5+ days (at risk of termination)")

                # Send admin notification if there are many inactive users
                if len(inactive_users) > 50:
                    self._send_admin_notification(
                        "High number of inactive users detected",
                        f"{len(inactive_users)} users are inactive for 14+ days and ready for deletion. "
                        "Please review the admin dashboard."
                    )

        except Exception as e:
            logger.error(f"Daily cleanup check failed: {str(e)}")

    def _weekly_cleanup(self):
        """Weekly comprehensive cleanup"""
        logger.info("Running weekly comprehensive cleanup...")

        # ⚠️ DATA SAFETY: automatic user deletion removes accounts (and their
        # enrollments, progress, certificates, etc.) without human review.
        # This is DISABLED unless explicitly enabled via the
        # AUTO_DELETE_INACTIVE_USERS=true configuration flag.
        app_config = getattr(self.app, 'config', {}) if self.app else {}
        if not app_config.get('AUTO_DELETE_INACTIVE_USERS', False):
            logger.info(
                "Weekly cleanup: automatic user deletion is disabled "
                "(set AUTO_DELETE_INACTIVE_USERS=true to enable)"
            )
            return

        try:
            with self.app.app_context():
                # Auto-delete users inactive for 30+ days (safety threshold)
                very_inactive_users = InactivityService.get_inactive_users(threshold_days=30)

                # Filter out admin accounts
                deletion_candidates = [u for u in very_inactive_users if u['role'] != 'admin']

                deletion_count = 0
                for user_data in deletion_candidates[:10]:  # Limit to 10 per week for safety
                    try:
                        # Use system admin account for automated deletions
                        admin_role = Role.query.filter_by(name='admin').first()
                        if admin_role:
                            admin_user = User.query.filter_by(
                                role_id=admin_role.id,
                                is_active=True
                            ).first()
                        else:
                            admin_user = None

                        if admin_user:
                            result = InactivityService.auto_delete_inactive_user(
                                user_id=user_data['user_id'],
                                admin_id=admin_user.id
                            )

                            if result['success']:
                                deletion_count += 1
                                logger.info(f"Auto-deleted user {user_data['username']} (inactive for 30+ days)")
                            else:
                                logger.warning(f"Failed to auto-delete user {user_data['username']}: {result['message']}")

                    except Exception as e:
                        logger.error(f"Error auto-deleting user {user_data['user_id']}: {str(e)}")

                logger.info(f"Weekly cleanup completed - deleted {deletion_count} users")

                if deletion_count > 0:
                    self._send_admin_notification(
                        "Weekly automated user cleanup completed",
                        f"Automatically deleted {deletion_count} users who were inactive for 30+ days."
                    )

        except Exception as e:
            logger.error(f"Weekly cleanup failed: {str(e)}")

    def _send_inactivity_warnings(self):
        """Send warnings to inactive students"""
        logger.info("Sending inactivity warnings...")

        try:
            with self.app.app_context():
                # Send warnings to students at the warning threshold
                warnings_sent = InactivityService.send_inactivity_warnings(
                    threshold_days=InactivityService.WARNING_THRESHOLD_DAYS
                )

                logger.info(f"Sent {warnings_sent} inactivity warnings")

        except Exception as e:
            logger.error(f"Failed to send inactivity warnings: {str(e)}")

    def _send_deletion_warnings(self):
        """Send advance account deactivation warnings to inactive users"""
        logger.info("Sending account deactivation warnings...")

        try:
            with self.app.app_context():
                warnings_sent = InactivityService.send_deletion_warnings()
                logger.info(f"Sent {warnings_sent} account deactivation warnings")

        except Exception as e:
            logger.error(f"Failed to send account deactivation warnings: {str(e)}")

    def _send_payment_reminders(self):
        """Send scheduled payment reminders for unpaid applications/enrollments"""
        logger.info("Sending payment reminders...")

        try:
            with self.app.app_context():
                from ..services.payment_reminder_scheduler import PaymentReminderScheduler

                result = PaymentReminderScheduler.run_scheduler()
                if result.get('status') != 'success':
                    logger.error(f"Payment reminder scheduler failed: {result.get('error')}")
                    return

                category_results = result.get('category_results') or {}
                sent = sum(r.get('sent', 0) for r in category_results.values())
                failed = sum(r.get('failed', 0) for r in category_results.values())
                logger.info(f"Sent {sent} payment reminders ({failed} failed)")

        except Exception as e:
            logger.error(f"Failed to send payment reminders: {str(e)}")

    def _update_activity_stats(self):
        """Update user activity statistics"""
        logger.info("Updating activity statistics...")

        try:
            with self.app.app_context():
                # Update learning streaks
                from ..models.achievement_models import LearningStreak

                # Reset streaks for users who haven't been active
                cutoff_date = datetime.utcnow().date() - timedelta(days=1)

                inactive_streaks = LearningStreak.query.filter(
                    LearningStreak.last_activity_date < cutoff_date,
                    LearningStreak.current_streak > 0
                ).all()

                for streak in inactive_streaks:
                    streak.current_streak = 0
                    logger.debug(f"Reset learning streak for user {streak.user_id}")

                db.session.commit()
                logger.info(f"Updated activity stats - reset {len(inactive_streaks)} learning streaks")

        except Exception as e:
            db.session.rollback()
            logger.error(f"Failed to update activity stats: {str(e)}")

    def _send_admin_notification(self, subject: str, message: str):
        """Send notification to admin users"""
        try:
            with self.app.app_context():
                from ..utils.email_utils import send_email

                # Get admin users
                admin_users = User.query.join(User.role).filter(
                    User.role.has(name='admin'),
                    User.is_active == True,
                    User.email_notifications == True
                ).all()

                html_body = f"""
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #333;">{subject}</h2>
                    <p>{message}</p>
                    <p>This is an automated notification from the Afritec Bridge LMS background task system.</p>
                    <p>Time: {datetime.utcnow().isoformat()}</p>
                </div>
                """

                for admin in admin_users:
                    try:
                        # email_utils.send_email(to, subject, template=None, body=None, ...)
                        send_email(
                            to=admin.email,
                            subject=f"[Afritec Bridge LMS] {subject}",
                            template=html_body,
                            async_send=True,
                        )
                    except Exception as e:
                        logger.error(f"Failed to send notification to admin {admin.email}: {str(e)}")

        except Exception as e:
            logger.error(f"Failed to send admin notification: {str(e)}")

    def run_task_now(self, task_name: str) -> bool:
        """Run a specific task immediately (for testing/manual execution)"""
        tasks = {
            'daily_cleanup': self._daily_cleanup_check,
            'weekly_cleanup': self._weekly_cleanup,
            'send_warnings': self._send_inactivity_warnings,
            'send_deletion_warnings': self._send_deletion_warnings,
            'send_payment_reminders': self._send_payment_reminders,
            'update_stats': self._update_activity_stats
        }

        if task_name not in tasks:
            logger.error(f"Unknown task: {task_name}")
            return False

        try:
            logger.info(f"Running task manually: {task_name}")
            tasks[task_name]()
            logger.info(f"Task {task_name} completed successfully")
            return True
        except Exception as e:
            logger.error(f"Failed to run task {task_name}: {str(e)}")
            return False


# Global scheduler instance
background_scheduler = BackgroundTaskScheduler()


def init_scheduler(app):
    """Initialize and start the background scheduler"""
    background_scheduler.init_app(app)

    # Start when explicitly enabled, or by default outside of local development
    # (mirrors ENABLE_SCHEDULERS so the inactivity jobs actually run in prod).
    start_scheduler = app.config.get(
        'START_BACKGROUND_SCHEDULER',
        app.config.get('ENABLE_SCHEDULERS', False)
    )

    if start_scheduler:
        try:
            background_scheduler.start_scheduler()
            atexit.register(background_scheduler.stop_scheduler)
            logger.info("Background scheduler initialized and started")
        except Exception as e:
            logger.error(f"Failed to start background scheduler: {str(e)}")
    else:
        logger.info("Background scheduler initialized but not started (disabled in config)")


def get_scheduler():
    """Get the global scheduler instance"""
    return background_scheduler
