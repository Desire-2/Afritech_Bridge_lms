"""
⏰ Automated Payment Reminder Scheduler for Afritech Bridge LMS
Sends scheduled payment reminders based on application window deadlines
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from sqlalchemy import and_, or_

logger = logging.getLogger(__name__)


class PaymentReminderScheduler:
    """
    Automated scheduler for sending payment reminders to applicants
    with draft applications and pending payments
    """
    
    # Reminder schedule configuration (days before deadline)
    REMINDER_SCHEDULE = [
        {'days_before': 7, 'reminder_type': 'first'},
        {'days_before': 3, 'reminder_type': 'urgent'},
        {'days_before': 1, 'reminder_type': 'final'},
    ]
    
    @staticmethod
    def get_applications_needing_reminders() -> List[Tuple]:
        """
        Find all draft applications with pending payments that need reminders
        
        Returns:
            List of tuples: (application, course, application_window, days_remaining)
        """
        from ..models.course_application import CourseApplication
        from ..models.course_models import Course, ApplicationWindow
        
        try:
            now = datetime.utcnow()
            applications_to_remind = []
            
            # Query draft applications with payment required
            query = CourseApplication.query.filter(
                and_(
                    CourseApplication.is_draft == True,
                    CourseApplication.payment_status.in_([
                        'pending', 'pending_bank_transfer', None
                    ]),
                    CourseApplication.application_window_id.isnot(None)
                )
            ).all()
            
            logger.info(f"📋 Found {len(query)} draft applications to check for reminders")
            
            for application in query:
                # Get associated course and application window
                course = Course.query.get(application.course_id)
                if not course:
                    continue
                
                # Check if course requires payment
                if course.enrollment_type not in ['paid', 'scholarship']:
                    continue
                
                # Get application window with deadline
                app_window = ApplicationWindow.query.get(application.application_window_id)
                if not app_window:
                    continue
                
                # Get deadline from application window
                deadline = app_window.application_deadline
                if not deadline:
                    # Fall back to cohort start date if no application deadline
                    deadline = app_window.cohort_start
                
                if not deadline:
                    logger.warning(f"⚠️ No deadline found for application #{application.id}")
                    continue
                
                # Calculate days remaining
                days_remaining = (deadline - now).days
                
                # Only process if deadline is in the future
                if days_remaining < 0:
                    logger.debug(f"⏭️ Skipping application #{application.id} - deadline passed")
                    continue
                
                # Check if this application needs a reminder
                needs_reminder, reminder_type = PaymentReminderScheduler._should_send_reminder(
                    application, days_remaining
                )
                
                if needs_reminder:
                    applications_to_remind.append((
                        application,
                        course,
                        app_window,
                        days_remaining,
                        reminder_type
                    ))
                    logger.info(
                        f"✅ Application #{application.id} needs {reminder_type} reminder "
                        f"({days_remaining} days remaining)"
                    )
            
            logger.info(f"📬 {len(applications_to_remind)} applications need reminders")
            return applications_to_remind
            
        except Exception as e:
            logger.error(f"❌ Error finding applications for reminders: {str(e)}")
            import traceback
            traceback.print_exc()
            return []
    
    @staticmethod
    def _should_send_reminder(application, days_remaining: int) -> Tuple[bool, str]:
        """
        Determine if a reminder should be sent based on days remaining and last reminder sent
        
        Args:
            application: CourseApplication object
            days_remaining: Days until deadline
            
        Returns:
            Tuple of (should_send: bool, reminder_type: str)
        """
        # Get last reminder info
        last_reminder_sent = getattr(application, 'last_payment_reminder_sent', None)
        last_reminder_type = getattr(application, 'last_payment_reminder_type', None)
        
        # Check each reminder threshold
        for reminder_config in PaymentReminderScheduler.REMINDER_SCHEDULE:
            days_before = reminder_config['days_before']
            reminder_type = reminder_config['reminder_type']
            
            # If we're within this threshold
            if days_remaining <= days_before:
                # Check if we've already sent this type of reminder
                if last_reminder_type == reminder_type:
                    # Already sent this reminder type
                    continue
                
                # Check if we've sent a higher priority reminder
                reminder_priority = ['first', 'urgent', 'final']
                if last_reminder_type:
                    last_priority_index = reminder_priority.index(last_reminder_type) if last_reminder_type in reminder_priority else -1
                    current_priority_index = reminder_priority.index(reminder_type) if reminder_type in reminder_priority else -1
                    
                    if last_priority_index >= current_priority_index:
                        # Already sent a same or higher priority reminder
                        continue
                
                # Check if we've sent a reminder recently (avoid spam)
                if last_reminder_sent:
                    hours_since_last = (datetime.utcnow() - last_reminder_sent).total_seconds() / 3600
                    if hours_since_last < 24:  # At least 24 hours between reminders
                        logger.debug(
                            f"⏭️ Skipping reminder for application #{application.id} "
                            f"- last sent {hours_since_last:.1f} hours ago"
                        )
                        continue
                
                return True, reminder_type
        
        return False, ''
    
    @staticmethod
    def send_reminders(applications_to_remind: List[Tuple]) -> Dict[str, int]:
        """
        Send payment reminders to the provided applications
        
        Args:
            applications_to_remind: List of (application, course, window, days, type) tuples
            
        Returns:
            Dict with counts of sent, failed, and skipped reminders
        """
        from ..models.user_models import db
        from ..utils.payment_notifications import send_payment_reminder_notification
        
        results = {
            'sent': 0,
            'failed': 0,
            'skipped': 0,
            'errors': []
        }
        
        for item in applications_to_remind:
            application, course, app_window, days_remaining, reminder_type = item
            
            try:
                logger.info(
                    f"📧 Sending {reminder_type} payment reminder to {application.email} "
                    f"for application #{application.id}"
                )
                
                # Prepare payment info
                payment_info = {
                    'amount': application.amount_paid or app_window.cohort_price or course.price or 0,
                    'currency': application.payment_currency or app_window.cohort_currency or course.currency or 'USD',
                    'days_remaining': days_remaining,
                    'payment_deadline': app_window.application_deadline or app_window.cohort_start,
                }
                
                # Send reminder email
                email_sent = send_payment_reminder_notification(
                    application=application,
                    course_title=course.title,
                    payment_info=payment_info
                )
                
                if email_sent:
                    # Update reminder tracking
                    application.last_payment_reminder_sent = datetime.utcnow()
                    application.last_payment_reminder_type = reminder_type
                    application.payment_reminder_count = (
                        getattr(application, 'payment_reminder_count', 0) + 1
                    )
                    
                    db.session.commit()
                    
                    results['sent'] += 1
                    logger.info(
                        f"✅ Reminder sent successfully to {application.email} "
                        f"(Application #{application.id})"
                    )
                else:
                    results['failed'] += 1
                    logger.warning(
                        f"⚠️ Failed to send reminder to {application.email} "
                        f"(Application #{application.id})"
                    )
                    results['errors'].append({
                        'application_id': application.id,
                        'email': application.email,
                        'error': 'Email send failed'
                    })
                    
            except Exception as e:
                results['failed'] += 1
                error_msg = str(e)
                logger.error(
                    f"❌ Error sending reminder for application #{application.id}: {error_msg}"
                )
                results['errors'].append({
                    'application_id': application.id,
                    'email': application.email,
                    'error': error_msg
                })
                
                # Rollback this application's changes but continue with others
                try:
                    db.session.rollback()
                except:
                    pass
        
        return results
    
    @staticmethod
    def run_scheduler(dry_run: bool = False) -> Dict:
        """
        Main scheduler method - find and send all pending payment reminders
        
        Args:
            dry_run: If True, only identify applications but don't send emails
            
        Returns:
            Dict with scheduler run statistics
        """
        logger.info("🚀 Starting payment reminder scheduler...")
        start_time = datetime.utcnow()
        
        try:
            # Get applications needing reminders
            applications_to_remind = PaymentReminderScheduler.get_applications_needing_reminders()
            
            if not applications_to_remind:
                logger.info("ℹ️ No applications need payment reminders at this time")
                return {
                    'status': 'success',
                    'total_checked': 0,
                    'reminders_needed': 0,
                    'sent': 0,
                    'failed': 0,
                    'dry_run': dry_run,
                    'duration_seconds': (datetime.utcnow() - start_time).total_seconds()
                }
            
            if dry_run:
                logger.info(f"🔍 DRY RUN: Would send reminders to {len(applications_to_remind)} applications")
                return {
                    'status': 'success',
                    'dry_run': True,
                    'reminders_needed': len(applications_to_remind),
                    'applications': [
                        {
                            'application_id': app.id,
                            'email': app.email,
                            'course': course.title,
                            'days_remaining': days,
                            'reminder_type': rtype
                        }
                        for app, course, window, days, rtype in applications_to_remind
                    ]
                }
            
            # Send reminders
            results = PaymentReminderScheduler.send_reminders(applications_to_remind)
            
            # Log summary
            logger.info(
                f"✨ Payment reminder scheduler completed: "
                f"{results['sent']} sent, {results['failed']} failed, "
                f"Duration: {(datetime.utcnow() - start_time).total_seconds():.2f}s"
            )
            
            return {
                'status': 'success',
                'total_checked': len(applications_to_remind),
                'reminders_needed': len(applications_to_remind),
                'sent': results['sent'],
                'failed': results['failed'],
                'skipped': results['skipped'],
                'errors': results['errors'],
                'dry_run': dry_run,
                'duration_seconds': (datetime.utcnow() - start_time).total_seconds()
            }
            
        except Exception as e:
            logger.error(f"❌ Payment reminder scheduler failed: {str(e)}")
            import traceback
            traceback.print_exc()
            
            return {
                'status': 'error',
                'error': str(e),
                'duration_seconds': (datetime.utcnow() - start_time).total_seconds()
            }
    
    @staticmethod
    def send_single_reminder(application_id: int) -> Dict:
        """
        Send a payment reminder to a specific application (manual trigger)
        
        Args:
            application_id: ID of the application
            
        Returns:
            Dict with send status
        """
        from ..models.course_application import CourseApplication
        from ..models.course_models import Course, ApplicationWindow
        from ..models.user_models import db
        from ..utils.payment_notifications import send_payment_reminder_notification
        
        try:
            application = CourseApplication.query.get(application_id)
            if not application:
                return {'status': 'error', 'error': 'Application not found'}
            
            course = Course.query.get(application.course_id)
            if not course:
                return {'status': 'error', 'error': 'Course not found'}
            
            # Get deadline
            deadline = None
            days_remaining = None
            
            if application.application_window_id:
                app_window = ApplicationWindow.query.get(application.application_window_id)
                if app_window:
                    deadline = app_window.application_deadline or app_window.cohort_start
                    if deadline:
                        days_remaining = (deadline - datetime.utcnow()).days
            
            # Prepare payment info
            payment_info = {
                'amount': application.amount_paid or course.price or 0,
                'currency': application.payment_currency or course.currency or 'USD',
            }
            
            if deadline and days_remaining is not None:
                payment_info['payment_deadline'] = deadline
                payment_info['days_remaining'] = max(0, days_remaining)
            
            # Send reminder
            email_sent = send_payment_reminder_notification(
                application=application,
                course_title=course.title,
                payment_info=payment_info
            )
            
            if email_sent:
                # Update tracking
                application.last_payment_reminder_sent = datetime.utcnow()
                application.payment_reminder_count = (
                    getattr(application, 'payment_reminder_count', 0) + 1
                )
                db.session.commit()
                
                return {
                    'status': 'success',
                    'message': f'Payment reminder sent to {application.email}',
                    'application_id': application_id
                }
            else:
                return {
                    'status': 'error',
                    'error': 'Failed to send email'
                }
                
        except Exception as e:
            logger.error(f"❌ Error sending single reminder: {str(e)}")
            return {'status': 'error', 'error': str(e)}
