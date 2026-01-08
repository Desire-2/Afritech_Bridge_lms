"""
Background Task Scheduler for Afritec Bridge LMS
Handles automated cleanup of inactive users and students
"""

import schedule
import time
import threading
import logging
from datetime import datetime, timedelta
from typing import Optional

from ..services.inactivity_service import InactivityService
from ..models.user_models import db, User

logger = logging.getLogger(__name__)

class BackgroundTaskScheduler:
    """Manages background tasks for the LMS"""
    
    def __init__(self, app=None):
        self.app = app
        self.scheduler_thread = None
        self.running = False
        
    def init_app(self, app):
        """Initialize with Flask app"""
        self.app = app
        
    def start_scheduler(self):
        """Start the background task scheduler"""
        if self.running:
            logger.warning("Scheduler is already running")
            return
            
        logger.info("Starting background task scheduler...")
        
        # Schedule tasks
        self._schedule_tasks()
        
        # Start scheduler in background thread
        self.running = True
        self.scheduler_thread = threading.Thread(target=self._run_scheduler, daemon=True)
        self.scheduler_thread.start()
        
        logger.info("Background task scheduler started successfully")
    
    def stop_scheduler(self):
        """Stop the background task scheduler"""
        if not self.running:
            return
            
        logger.info("Stopping background task scheduler...")
        self.running = False
        
        # Clear scheduled jobs
        schedule.clear()
        
        if self.scheduler_thread and self.scheduler_thread.is_alive():
            self.scheduler_thread.join(timeout=5)
        
        logger.info("Background task scheduler stopped")
    
    def _schedule_tasks(self):
        """Schedule all background tasks"""
        
        # Daily cleanup check at 2 AM
        schedule.every().day.at("02:00").do(self._daily_cleanup_check)
        
        # Weekly comprehensive cleanup on Sundays at 3 AM
        schedule.every().sunday.at("03:00").do(self._weekly_cleanup)
        
        # Send inactivity warnings every 3 days at 10 AM
        schedule.every(3).days.at("10:00").do(self._send_inactivity_warnings)
        
        # Update user activity stats every 6 hours
        schedule.every(6).hours.do(self._update_activity_stats)
        
        logger.info("Background tasks scheduled successfully")
    
    def _run_scheduler(self):
        """Run the scheduler loop"""
        while self.running:
            try:
                schedule.run_pending()
                time.sleep(60)  # Check every minute
            except Exception as e:
                logger.error(f"Scheduler error: {str(e)}")
                time.sleep(300)  # Wait 5 minutes on error before retrying
    
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
                logger.info(f"Daily cleanup check completed:")
                logger.info(f"  - {len(inactive_users)} users ready for deletion (14+ days inactive)")
                logger.info(f"  - {len(approaching_termination)} students at risk of termination (5+ days inactive)")
                
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
        
        try:
            with self.app.app_context():
                # Auto-delete users inactive for 30+ days (safety threshold)
                very_inactive_users = InactivityService.get_inactive_users(threshold_days=30)
                
                # Filter out admin accounts
                deletion_candidates = [u for u in very_inactive_users if u['role'] != 'admin']
                
                deletion_count = 0
                for user_data in deletion_candidates[:10]:  # Limit to 10 per week for safety
                    try:
                        # Use system admin account (ID 1) for automated deletions
                        admin_user = User.query.filter_by(role_id=db.session.query(
                            db.session.query(User).join(User.role).filter(
                                User.role.has(name='admin')
                            ).first().id
                        )).first()
                        
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
                # Send warnings to students inactive for 5+ days
                warnings_sent = InactivityService.send_inactivity_warnings(threshold_days=5)
                
                logger.info(f"Sent {warnings_sent} inactivity warnings")
                
        except Exception as e:
            logger.error(f"Failed to send inactivity warnings: {str(e)}")
    
    def _update_activity_stats(self):
        """Update user activity statistics"""
        logger.info("Updating activity statistics...")
        
        try:
            with self.app.app_context():
                # Update learning streaks
                from ..models.achievement_models import LearningStreak
                from ..services.achievement_service import AchievementService
                
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
                
                for admin in admin_users:
                    try:
                        send_email(
                            to_email=admin.email,
                            subject=f"[Afritec Bridge LMS] {subject}",
                            html_body=f"""
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                                <h2 style="color: #333;">{subject}</h2>
                                <p>{message}</p>
                                <p>This is an automated notification from the Afritec Bridge LMS background task system.</p>
                                <p>Time: {datetime.utcnow().isoformat()}</p>
                            </div>
                            """
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
    
    # Only start scheduler in production or when explicitly enabled
    start_scheduler = app.config.get('START_BACKGROUND_SCHEDULER', False)
    
    if start_scheduler:
        background_scheduler.start_scheduler()
        
        # Register shutdown handler
        import atexit
        atexit.register(background_scheduler.stop_scheduler)
        
        logger.info("Background scheduler initialized and started")
    else:
        logger.info("Background scheduler initialized but not started (disabled in config)")

def get_scheduler():
    """Get the global scheduler instance"""
    return background_scheduler