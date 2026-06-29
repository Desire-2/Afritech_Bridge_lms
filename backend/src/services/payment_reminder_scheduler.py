"""
⏰ Automated Payment Reminder Scheduler for Afritech Bridge LMS
Sends scheduled payment reminders to ALL applicants who have not completed payment:

Category A: Draft applications with pending payments (existing behavior)
Category B: Submitted applications where payment is not yet approved
Category C: Students migrated between cohorts (enrollments with pending_payment)
"""
import logging
from datetime import datetime, timedelta
from typing import List, Dict, Tuple, Optional
from sqlalchemy import and_, or_

logger = logging.getLogger(__name__)


class PaymentReminderScheduler:
    """
    Automated scheduler for sending payment reminders to applicants
    with incomplete payments across three categories:

    1. Draft applications with pending payment (existing)
    2. Submitted (non-draft) applications with unapproved payment
    3. Enrollments in pending_payment status (including migrated students)
    """

    # Reminder schedule configuration (days before deadline)
    REMINDER_SCHEDULE = [
        {'days_before': 7, 'reminder_type': 'first'},
        {'days_before': 3, 'reminder_type': 'urgent'},
        {'days_before': 1, 'reminder_type': 'final'},
    ]

    # ─────────────────────────────────────────────────────────
    # CATEGORY A: Draft applications with pending payment
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def get_applications_needing_reminders() -> List[Tuple]:
        """
        Find all draft applications with pending payments that need reminders.

        Returns:
            List of tuples: (application, course, application_window, days_remaining, reminder_type)
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

            logger.info(f"📋 Category A: Found {len(query)} draft applications to check for reminders")

            for application in query:
                result = PaymentReminderScheduler._check_application_reminder(application, now)
                if result:
                    applications_to_remind.append(result)

            logger.info(f"📬 Category A: {len(applications_to_remind)} draft applications need reminders")
            return applications_to_remind

        except Exception as e:
            logger.error(f"❌ Error finding draft applications for reminders: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    @staticmethod
    def _check_application_reminder(application, now: datetime) -> Optional[Tuple]:
        """
        Check a single application for reminder eligibility.

        Returns:
            Tuple of (application, course, app_window, days_remaining, reminder_type) or None
        """
        from ..models.course_models import Course, ApplicationWindow

        course = Course.query.get(application.course_id)
        if not course:
            return None

        # Check if course requires payment
        if course.enrollment_type not in ['paid', 'scholarship']:
            return None

        app_window = ApplicationWindow.query.get(application.application_window_id)
        if not app_window:
            return None

        # Get deadline
        deadline = app_window.application_deadline
        if not deadline:
            deadline = app_window.cohort_start

        if not deadline:
            logger.warning(f"⚠️ No deadline found for application #{application.id}")
            return None

        # Calculate days remaining
        days_remaining = (deadline - now).days

        if days_remaining < 0:
            logger.debug(f"⏭️ Skipping application #{application.id} - deadline passed")
            return None

        needs_reminder, reminder_type = PaymentReminderScheduler._should_send_reminder(
            application, days_remaining
        )

        if needs_reminder:
            logger.info(
                f"✅ Application #{application.id} needs {reminder_type} reminder "
                f"({days_remaining} days remaining)"
            )
            return (application, course, app_window, days_remaining, reminder_type)

        return None

    # ─────────────────────────────────────────────────────────
    # CATEGORY B: Submitted applications with unapproved payment
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def get_submitted_unapproved_applications() -> List[Tuple]:
        """
        Find submitted (non-draft) applications where payment was initiated
        but has NOT been approved/completed by an administrator.

        These applicants need to be told to send payment proof on WhatsApp
        or pay now to proceed.

        Returns:
            List of tuples: (application, course, application_window, days_remaining, 'submitted_unapproved')
        """
        from ..models.course_application import CourseApplication
        from ..models.course_models import Course, ApplicationWindow

        try:
            now = datetime.utcnow()
            results = []

            # Query submitted applications with unapproved payment
            # These are non-draft applications where payment status is
            # still 'pending', 'pending_bank_transfer', or similar unapproved statuses
            query = CourseApplication.query.filter(
                and_(
                    CourseApplication.is_draft == False,
                    CourseApplication.payment_status.in_([
                        'pending', 'pending_bank_transfer', 'submitted', 'submitted_with_proof'
                    ]),
                    CourseApplication.application_window_id.isnot(None)
                )
            ).all()

            logger.info(f"📋 Category B: Found {len(query)} submitted applications with unapproved payment")

            for application in query:
                course = Course.query.get(application.course_id)
                if not course:
                    continue

                # Only process paid/scholarship courses
                if course.enrollment_type not in ['paid', 'scholarship']:
                    continue

                app_window = ApplicationWindow.query.get(application.application_window_id)
                if not app_window:
                    continue

                # Check if this application already has an enrollment with verified payment
                # (defense against race conditions)
                from ..models.course_models import Enrollment
                existing_enrollment = Enrollment.query.filter_by(
                    application_id=application.id,
                    payment_verified=True
                ).first()
                if existing_enrollment:
                    logger.debug(f"⏭️ Skipping application #{application.id} - already has verified enrollment")
                    continue

                # Check cooldown — don't send this type of reminder more than once every 7 days
                last_sent = getattr(application, 'last_payment_reminder_sent', None)
                if last_sent:
                    days_since_last = (now - last_sent).days
                    if days_since_last < 7:
                        logger.debug(
                            f"⏭️ Skipping submitted-unapproved reminder for app #{application.id} "
                            f"- last sent {days_since_last} days ago"
                        )
                        continue

                # Get deadline (for reference)
                deadline = app_window.application_deadline or app_window.cohort_start
                days_remaining = None
                if deadline:
                    days_remaining = max(0, (deadline - now).days)

                results.append((
                    application,
                    course,
                    app_window,
                    days_remaining,
                    'submitted_unapproved'
                ))
                logger.info(
                    f"✅ Application #{application.id} needs submitted-unapproved reminder "
                    f"({application.payment_status})"
                )

            logger.info(f"📬 Category B: {len(results)} submitted applications need reminders")
            return results

        except Exception as e:
            logger.error(f"❌ Error finding submitted-unapproved applications: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    # ─────────────────────────────────────────────────────────
    # CATEGORY C: Enrollments pending payment (migrated students)
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def get_pending_payment_enrollments() -> List[Tuple]:
        """
        Find enrollments where:
        - Status is 'pending_payment' (payment required but not yet verified)
        - Payment has not been verified by an admin
        - The course/cohort requires payment

        Special attention is given to students who were migrated from another cohort
        (migrated_from_window_id IS NOT NULL) — they receive a tailored message.

        Returns:
            List of tuples: (enrollment, course, student, application_window, is_migrated)
        """
        from ..models.course_models import Course, ApplicationWindow, Enrollment
        from ..models.user_models import User

        try:
            now = datetime.utcnow()
            results = []

            # Query enrollments with pending_payment status
            query = Enrollment.query.filter(
                and_(
                    Enrollment.status == 'pending_payment',
                    or_(
                        Enrollment.payment_verified == False,
                        Enrollment.payment_verified.is_(None)
                    ),
                    Enrollment.student_id.isnot(None)
                )
            ).all()

            logger.info(f"📋 Category C: Found {len(query)} enrollments with pending_payment status")

            for enrollment in query:
                course = Course.query.get(enrollment.course_id)
                if not course:
                    continue

                # Only process paid/scholarship courses
                if course.enrollment_type not in ['paid', 'scholarship']:
                    continue

                student = User.query.get(enrollment.student_id)
                if not student or not student.email:
                    continue

                app_window = enrollment.application_window
                if not app_window:
                    # Try to resolve window
                    app_window = ApplicationWindow.query.filter_by(
                        course_id=course.id
                    ).order_by(ApplicationWindow.id.desc()).first()
                    if not app_window:
                        continue

                # Check if cohort requires payment
                from ..services.waitlist_service import _cohort_requires_payment
                if not _cohort_requires_payment(app_window):
                    continue

                # Check cooldown — don't send this type more than once every 7 days
                last_sent = getattr(enrollment, 'last_payment_reminder_sent', None)
                if last_sent:
                    days_since_last = (now - last_sent).days
                    if days_since_last < 7:
                        logger.debug(
                            f"⏭️ Skipping enrollment #{enrollment.id} reminder "
                            f"- last sent {days_since_last} days ago"
                        )
                        continue

                is_migrated = enrollment.migrated_from_window_id is not None

                results.append((
                    enrollment,
                    course,
                    student,
                    app_window,
                    is_migrated
                ))
                logger.info(
                    f"✅ Enrollment #{enrollment.id} needs payment reminder "
                    f"(migrated={is_migrated})"
                )

            logger.info(f"📬 Category C: {len(results)} enrollments need payment reminders")
            return results

        except Exception as e:
            logger.error(f"❌ Error finding pending-payment enrollments: {str(e)}")
            import traceback
            traceback.print_exc()
            return []

    # ─────────────────────────────────────────────────────────
    # SHARED HELPERS
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def _should_send_reminder(application, days_remaining: int) -> Tuple[bool, str]:
        """
        Determine if a reminder should be sent based on days remaining and last reminder sent.

        Args:
            application: CourseApplication object
            days_remaining: Days until deadline

        Returns:
            Tuple of (should_send: bool, reminder_type: str)
        """
        last_reminder_sent = getattr(application, 'last_payment_reminder_sent', None)
        last_reminder_type = getattr(application, 'last_payment_reminder_type', None)

        for reminder_config in PaymentReminderScheduler.REMINDER_SCHEDULE:
            days_before = reminder_config['days_before']
            reminder_type = reminder_config['reminder_type']

            if days_remaining <= days_before:
                if last_reminder_type == reminder_type:
                    continue

                reminder_priority = ['first', 'urgent', 'final']
                if last_reminder_type:
                    last_priority_index = reminder_priority.index(last_reminder_type) if last_reminder_type in reminder_priority else -1
                    current_priority_index = reminder_priority.index(reminder_type) if reminder_type in reminder_priority else -1
                    if last_priority_index >= current_priority_index:
                        continue

                if last_reminder_sent:
                    hours_since_last = (datetime.utcnow() - last_reminder_sent).total_seconds() / 3600
                    if hours_since_last < 24:
                        logger.debug(
                            f"⏭️ Skipping reminder for application #{application.id} "
                            f"- last sent {hours_since_last:.1f} hours ago"
                        )
                        continue

                return True, reminder_type

        return False, ''

    # ─────────────────────────────────────────────────────────
    # SENDING METHODS
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def send_reminders(applications_to_remind: List[Tuple]) -> Dict[str, int]:
        """
        Send Category A payment reminders to the provided draft applications.

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

                # Get effective price from window (handles scholarships)
                effective_price = app_window.get_effective_price() or course.price or 0

                payment_info = {
                    'amount': effective_price,
                    'currency': app_window.get_effective_currency() or course.currency or 'USD',
                    'days_remaining': days_remaining,
                    'payment_deadline': app_window.application_deadline or app_window.cohort_start,
                    'payment_methods': app_window.get_effective_payment_methods(),
                }

                email_sent = send_payment_reminder_notification(
                    application=application,
                    course_title=course.title,
                    payment_info=payment_info
                )

                if email_sent:
                    application.last_payment_reminder_sent = datetime.utcnow()
                    application.last_payment_reminder_type = reminder_type
                    application.payment_reminder_count = (
                        getattr(application, 'payment_reminder_count', 0) + 1
                    )
                    db.session.commit()
                    results['sent'] += 1
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'application_id': application.id,
                        'email': application.email,
                        'error': 'Email send failed'
                    })

            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'application_id': application.id,
                    'email': application.email,
                    'error': str(e)
                })
                try:
                    db.session.rollback()
                except:
                    pass

        return results

    @staticmethod
    def send_submitted_unapproved_reminders(submitted_apps: List[Tuple]) -> Dict[str, int]:
        """
        Send Category B reminders to submitted applications with unapproved payment.
        Tells them to send proof on WhatsApp or pay now.

        Args:
            submitted_apps: List of (application, course, window, days, type) tuples

        Returns:
            Dict with counts
        """
        from ..models.user_models import db
        from ..utils.payment_notifications import send_submitted_unapproved_notification

        results = {'sent': 0, 'failed': 0, 'skipped': 0, 'errors': []}

        for item in submitted_apps:
            application, course, app_window, days_remaining, _ = item

            try:
                effective_price = app_window.get_effective_price() or course.price or 0

                payment_info = {
                    'amount': effective_price,
                    'currency': app_window.get_effective_currency() or course.currency or 'USD',
                    'payment_methods': app_window.get_effective_payment_methods(),
                }

                cohort_info = {
                    'cohort_label': app_window.cohort_label,
                    'cohort_start_date': app_window.cohort_start,
                    'cohort_end_date': app_window.cohort_end,
                    'timezone': 'UTC',
                }

                email_sent = send_submitted_unapproved_notification(
                    application=application,
                    course_title=course.title,
                    payment_info=payment_info,
                    cohort_info=cohort_info
                )

                if email_sent:
                    application.last_payment_reminder_sent = datetime.utcnow()
                    application.payment_reminder_count = (
                        getattr(application, 'payment_reminder_count', 0) + 1
                    )
                    db.session.commit()
                    results['sent'] += 1
                    logger.info(f"✅ Submitted-unapproved reminder sent to {application.email} (App #{application.id})")
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'application_id': application.id,
                        'email': application.email,
                        'error': 'Email send failed'
                    })

            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'application_id': getattr(item[0], 'id', 'N/A'),
                    'error': str(e)
                })
                try:
                    db.session.rollback()
                except:
                    pass

        return results

    @staticmethod
    def send_pending_enrollment_reminders(pending_enrollments: List[Tuple]) -> Dict[str, int]:
        """
        Send Category C reminders to enrollments with pending_payment status.
        For migrated students, sends a tailored "login and pay" message.
        For non-migrated students, sends a standard payment reminder.

        Args:
            pending_enrollments: List of (enrollment, course, student, window, is_migrated) tuples

        Returns:
            Dict with counts
        """
        from ..models.user_models import db
        from ..utils.payment_notifications import send_migrated_student_payment_notification, send_payment_reminder_notification

        results = {'sent': 0, 'failed': 0, 'skipped': 0, 'errors': []}

        for item in pending_enrollments:
            enrollment, course, student, app_window, is_migrated = item

            try:
                effective_price = app_window.get_effective_price() or course.price or 0

                cohort_info = {
                    'cohort_label': app_window.cohort_label,
                    'cohort_start_date': app_window.cohort_start,
                    'cohort_end_date': app_window.cohort_end,
                    'timezone': 'UTC',
                }

                # Get old cohort label if migrated
                original_cohort_label = 'Previous Cohort'
                if is_migrated and enrollment.migrated_from_window_id:
                    from ..models.course_models import ApplicationWindow
                    old_window = ApplicationWindow.query.get(enrollment.migrated_from_window_id)
                    if old_window:
                        original_cohort_label = old_window.cohort_label or 'Previous Cohort'

                payment_info = {
                    'amount': effective_price,
                    'currency': app_window.get_effective_currency() or course.currency or 'USD',
                    'student_name': f"{student.first_name} {student.last_name}".strip() or student.username,
                    'original_cohort': original_cohort_label,
                    'new_cohort': app_window.cohort_label or 'New Cohort',
                    'payment_methods': app_window.get_effective_payment_methods(),
                }

                student_name = f"{student.first_name} {student.last_name}".strip() or student.username

                if is_migrated:
                    # Tailored message for migrated students
                    email_sent = send_migrated_student_payment_notification(
                        student_email=student.email,
                        student_name=student_name,
                        course_title=course.title,
                        payment_info=payment_info,
                        cohort_info=cohort_info
                    )
                else:
                    # Standard payment reminder for pending-payment enrollments
                    # Mock an application object for the notification function
                    # Use enrollment.application_id if available, otherwise enrollment.id as fallback
                    app_id = enrollment.application_id or f"ENR-{enrollment.id}"
                    
                    class _AppLike:
                        def __init__(self, name, email, cid, wid, aid):
                            self.full_name = name
                            self.email = email
                            self.course_id = cid
                            self.id = aid
                            self.application_window_id = wid
                            self.amount_paid = None
                            self.payment_currency = None

                    mock_app = _AppLike(
                        student_name,
                        student.email,
                        course.id,
                        app_window.id,
                        app_id
                    )

                    email_sent = send_payment_reminder_notification(
                        application=mock_app,
                        course_title=course.title,
                        payment_info=payment_info
                    )

                if email_sent:
                    # Track reminder on enrollment
                    enrollment.last_payment_reminder_sent = datetime.utcnow()
                    enrollment.payment_reminder_count = (getattr(enrollment, 'payment_reminder_count', 0) or 0) + 1
                    db.session.commit()
                    results['sent'] += 1
                    logger.info(
                        f"✅ {'Migrated' if is_migrated else 'Pending-payment'} reminder "
                        f"sent to {student.email} (Enrollment #{enrollment.id})"
                    )
                else:
                    results['failed'] += 1
                    results['errors'].append({
                        'enrollment_id': enrollment.id,
                        'email': student.email,
                        'error': 'Email send failed'
                    })

            except Exception as e:
                results['failed'] += 1
                results['errors'].append({
                    'enrollment_id': getattr(item[0], 'id', 'N/A'),
                    'email': getattr(item[2], 'email', 'N/A'),
                    'error': str(e)
                })
                try:
                    db.session.rollback()
                except:
                    pass

        return results

    # ─────────────────────────────────────────────────────────
    # MAIN SCHEDULER
    # ─────────────────────────────────────────────────────────

    @staticmethod
    def run_scheduler(dry_run: bool = False, categories: Optional[List[str]] = None) -> Dict:
        """
        Main scheduler method - find and send all pending payment reminders
        across all categories.

        Args:
            dry_run: If True, only identify applications but don't send emails
            categories: Optional list of categories to process.
                        Default: ['drafts', 'submitted_unapproved', 'pending_enrollments']

        Returns:
            Dict with scheduler run statistics
        """
        if categories is None:
            categories = ['drafts', 'submitted_unapproved', 'pending_enrollments']

        logger.info("🚀 Starting payment reminder scheduler...")
        start_time = datetime.utcnow()

        result = {
            'status': 'success',
            'dry_run': dry_run,
            'categories_processed': categories,
            'duration_seconds': 0,
            'category_results': {}
        }

        try:
            # ── Category A: Draft applications ──
            if 'drafts' in categories:
                logger.info("=" * 60)
                logger.info("📋 Category A: Draft applications with pending payment")
                logger.info("=" * 60)

                draft_apps = PaymentReminderScheduler.get_applications_needing_reminders()

                if dry_run:
                    result['category_results']['drafts'] = {
                        'reminders_needed': len(draft_apps),
                        'applications': [
                            {
                                'application_id': app.id,
                                'email': app.email,
                                'course': course.title,
                                'days_remaining': days,
                                'reminder_type': rtype
                            }
                            for app, course, window, days, rtype in draft_apps
                        ]
                    }
                else:
                    draft_result = PaymentReminderScheduler.send_reminders(draft_apps)
                    result['category_results']['drafts'] = {
                        'total': len(draft_apps),
                        'sent': draft_result['sent'],
                        'failed': draft_result['failed'],
                        'errors': draft_result['errors'][:10],
                    }
                    logger.info(
                        f"📊 Category A: {draft_result['sent']} sent, {draft_result['failed']} failed"
                    )

            # ── Category B: Submitted applications with unapproved payment ──
            if 'submitted_unapproved' in categories:
                logger.info("=" * 60)
                logger.info("📋 Category B: Submitted applications with unapproved payment")
                logger.info("=" * 60)

                submitted_apps = PaymentReminderScheduler.get_submitted_unapproved_applications()

                if dry_run:
                    result['category_results']['submitted_unapproved'] = {
                        'reminders_needed': len(submitted_apps),
                        'applications': [
                            {
                                'application_id': app.id,
                                'email': app.email,
                                'course': course.title,
                                'payment_status': app.payment_status,
                            }
                            for app, course, window, days, _ in submitted_apps
                        ]
                    }
                else:
                    sub_result = PaymentReminderScheduler.send_submitted_unapproved_reminders(submitted_apps)
                    result['category_results']['submitted_unapproved'] = {
                        'total': len(submitted_apps),
                        'sent': sub_result['sent'],
                        'failed': sub_result['failed'],
                        'errors': sub_result['errors'][:10],
                    }
                    logger.info(
                        f"📊 Category B: {sub_result['sent']} sent, {sub_result['failed']} failed"
                    )

            # ── Category C: Pending-payment enrollments (migrated students) ──
            if 'pending_enrollments' in categories:
                logger.info("=" * 60)
                logger.info("📋 Category C: Enrollments pending payment (migrated students)")
                logger.info("=" * 60)

                pending_enrollments = PaymentReminderScheduler.get_pending_payment_enrollments()

                if dry_run:
                    result['category_results']['pending_enrollments'] = {
                        'reminders_needed': len(pending_enrollments),
                        'enrollments': [
                            {
                                'enrollment_id': enrollment.id,
                                'email': student.email,
                                'course': course.title,
                                'is_migrated': is_migrated,
                            }
                            for enrollment, course, student, window, is_migrated in pending_enrollments
                        ]
                    }
                else:
                    enr_result = PaymentReminderScheduler.send_pending_enrollment_reminders(pending_enrollments)
                    result['category_results']['pending_enrollments'] = {
                        'total': len(pending_enrollments),
                        'sent': enr_result['sent'],
                        'failed': enr_result['failed'],
                        'errors': enr_result['errors'][:10],
                    }
                    logger.info(
                        f"📊 Category C: {enr_result['sent']} sent, {enr_result['failed']} failed"
                    )

            # ── Summary ──
            elapsed = (datetime.utcnow() - start_time).total_seconds()
            result['duration_seconds'] = elapsed

            total_sent = sum(
                r.get('sent', 0) for r in result['category_results'].values()
            )
            total_failed = sum(
                r.get('failed', 0) for r in result['category_results'].values()
            )

            logger.info("=" * 60)
            logger.info(f"✨ Scheduler completed: {total_sent} sent, {total_failed} failed")
            logger.info(f"⏱️ Duration: {elapsed:.2f}s")
            logger.info("=" * 60)

            return result

        except Exception as e:
            logger.error(f"❌ Payment reminder scheduler failed: {str(e)}")
            import traceback
            traceback.print_exc()

            result['status'] = 'error'
            result['error'] = str(e)
            result['duration_seconds'] = (datetime.utcnow() - start_time).total_seconds()
            return result

    @staticmethod
    def send_single_reminder(application_id: int) -> Dict:
        """
        Send a payment reminder to a specific application (manual trigger).
        Works for both draft and submitted applications.

        Args:
            application_id: ID of the application

        Returns:
            Dict with send status
        """
        from ..models.course_application import CourseApplication
        from ..models.course_models import Course, ApplicationWindow
        from ..models.user_models import db
        from ..utils.payment_notifications import send_payment_reminder_notification, send_submitted_unapproved_notification

        try:
            application = CourseApplication.query.get(application_id)
            if not application:
                return {'status': 'error', 'error': 'Application not found'}

            course = Course.query.get(application.course_id)
            if not course:
                return {'status': 'error', 'error': 'Course not found'}

            app_window = None
            if application.application_window_id:
                app_window = ApplicationWindow.query.get(application.application_window_id)

            # Get payment info
            deadline = None
            days_remaining = None

            if app_window:
                deadline = app_window.application_deadline or app_window.cohort_start
                if deadline:
                    days_remaining = (deadline - datetime.utcnow()).days

                effective_price = app_window.get_effective_price() or course.price or 0
                currency = app_window.get_effective_currency() or course.currency or 'USD'
            else:
                effective_price = course.price or 0
                currency = course.currency or 'USD'

            payment_info = {
                'amount': effective_price,
                'currency': currency,
            }

            if deadline and days_remaining is not None:
                payment_info['payment_deadline'] = deadline
                payment_info['days_remaining'] = max(0, days_remaining)

            # Choose which notification to send based on application type
            if application.is_draft:
                email_sent = send_payment_reminder_notification(
                    application=application,
                    course_title=course.title,
                    payment_info=payment_info
                )
            else:
                # For submitted applications, send the unapproved payment message
                cohort_info = {}
                if app_window:
                    cohort_info = {
                        'cohort_label': app_window.cohort_label,
                        'cohort_start_date': app_window.cohort_start,
                        'cohort_end_date': app_window.cohort_end,
                        'timezone': 'UTC',
                    }

                email_sent = send_submitted_unapproved_notification(
                    application=application,
                    course_title=course.title,
                    payment_info=payment_info,
                    cohort_info=cohort_info
                )

            if email_sent:
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
