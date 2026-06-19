"""
💰 Payment Email Notification Service for Afritech Bridge LMS
Centralizes payment-related email notifications
"""
import hashlib
import logging
import os
import base64
from datetime import datetime
from typing import Optional, Dict
from .payment_email_templates import (
    application_saved_payment_pending_email,
    payment_confirmation_email,
    payment_failed_email,
    payment_reminder_email,
    payment_refund_email,
    enrollment_payment_confirmed_email,
    enrollment_payment_waived_email,
    enrollment_payment_failed_email,
)

# Import email service
try:
    from .brevo_email_service import brevo_service
    BREVO_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    brevo_service = None  # type: ignore
    BREVO_AVAILABLE = False

# Import payment slip service for PDF attachment
try:
    from ..services.payment_slip_service import generate_payment_slip_pdf
    PAYMENT_SLIP_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    generate_payment_slip_pdf = None  # type: ignore
    PAYMENT_SLIP_AVAILABLE = False

logger = logging.getLogger(__name__)


def send_payment_pending_notification(application, course_title: str, payment_info: Dict) -> bool:
    """
    Send email when applicant saves draft application for paid course
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_info: dict with payment details
            - amount: float
            - currency: str
            - payment_deadline: datetime (optional)
            - payment_methods: list (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send payment pending notification")
            return False
        
        # Build email content
        email_html = application_saved_payment_pending_email(
            application=application,
            course_title=course_title,
            payment_info=payment_info
        )
        
        # Send email
        success = brevo_service.send_email(
            to_emails=[application.email],
            subject=f"💳 Complete Your Payment - {course_title}",
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Payment pending email sent to {application.email} for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send payment pending email to {application.email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending payment pending notification: {str(e)}")
        return False


def send_payment_confirmation_notification(application, course_title: str, payment_details: Dict, cohort_info: Optional[Dict] = None) -> bool:
    """
    Send email when payment is successfully confirmed.
    Includes a PDF payment slip attachment.
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_details: dict with confirmation details
            - amount_paid: float
            - currency: str
            - payment_method: str
            - payment_reference: str
            - payment_date: datetime
        cohort_info: dict with cohort details (optional)
            - cohort_label: str
            - cohort_start_date: datetime
            - cohort_end_date: datetime
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send payment confirmation")
            return False

        # ── Resolve effective price and scholarship info from ApplicationWindow ──
        # The callers pass application.amount_paid which may be the full course price.
        # We override it with the cohort's effective price so the email and PDF slip
        # always show the scholarship-adjusted amount.
        window = getattr(application, 'application_window', None)
        if not window and application.application_window_id:
            from ..models.course_models import ApplicationWindow as AppWin
            window = AppWin.query.get(application.application_window_id)

        if window:
            effective_price = window.get_effective_price() or 0
            payment_details['amount_paid'] = float(effective_price)
            scholarship_type = getattr(window, 'scholarship_type', None)
            if scholarship_type:
                payment_details['scholarship_type'] = scholarship_type
                payment_details['scholarship_percentage'] = float(getattr(window, 'scholarship_percentage', 0) or 0)
                payment_details['original_price'] = float(getattr(window, 'price', 0) or (window.course.price if window.course else 0))
        
        # Resolve cohort info from application if not provided
        if not cohort_info:
            cohort_label = getattr(application, 'cohort_label', None)
            cohort_start = getattr(application, 'cohort_start_date', None)
            cohort_end = getattr(application, 'cohort_end_date', None)
            if cohort_label or cohort_start or cohort_end:
                cohort_info = {
                    'cohort_label': cohort_label,
                    'cohort_start_date': cohort_start,
                    'cohort_end_date': cohort_end,
                    'timezone': 'UTC',
                }
        # Ensure community_link is included in cohort_info if available from the application window
        if cohort_info and not cohort_info.get('community_link'):
            if window is None:
                window = getattr(application, 'application_window', None)
            if window:
                cohort_info['community_link'] = getattr(window, 'community_link', None)
                cohort_info['community_link_label'] = getattr(window, 'community_link_label', None)

        # Build email content
        email_html = payment_confirmation_email(
            application=application,
            course_title=course_title,
            payment_details=payment_details,
            cohort_info=cohort_info,
        )

        # Generate PDF payment slip attachment
        pdf_attachment = None
        if PAYMENT_SLIP_AVAILABLE and generate_payment_slip_pdf:
            try:
                student_name = application.full_name or "Student"
                student_phone = getattr(application, 'phone', None) or ""
                app_cohort_label = (cohort_info or {}).get('cohort_label') or getattr(application, 'cohort_label', None)
                app_cohort_start = (cohort_info or {}).get('cohort_start_date') or getattr(application, 'cohort_start_date', None)
                app_cohort_end = (cohort_info or {}).get('cohort_end_date') or getattr(application, 'cohort_end_date', None)
                # ── Compute and persist verification hash for application-level payment ──
                # This ensures the QR code on the PDF slip can be verified via the public endpoint.
                app_verif_hash = getattr(application, 'payment_verification_hash', None)
                if not app_verif_hash:
                    import hashlib
                    hash_raw = f"{application.id}-{student_name}-{payment_details.get('payment_reference', '')}"
                    app_verif_hash = hashlib.sha256(hash_raw.encode()).hexdigest()[:16]
                    application.payment_verification_hash = app_verif_hash
                    from ..models.user_models import db
                    db.session.add(application)
                    db.session.commit()
                    logger.info(f"🔐 Generated and stored payment_verification_hash for application #{application.id}")
                pdf_bytes, pdf_filename = generate_payment_slip_pdf(
                    student_name=student_name,
                    student_email=application.email,
                    student_phone=student_phone,
                    course_title=course_title,
                    cohort_label=app_cohort_label,
                    cohort_start_date=app_cohort_start,
                    cohort_end_date=app_cohort_end,
                    amount_paid=payment_details.get('amount_paid', 0),
                    currency=payment_details.get('currency', 'USD'),
                    payment_method=payment_details.get('payment_method', 'Payment Gateway'),
                    payment_reference=payment_details.get('payment_reference', ''),
                    payment_date=payment_details.get('payment_date'),
                    payment_status='completed',
                    application_id=application.id,
                    verification_hash=app_verif_hash,
                    admin_name='Payment System',
                    # ── Pass scholarship info for slip display (now populated above) ──
                    scholarship_type=payment_details.get('scholarship_type'),
                    scholarship_percentage=payment_details.get('scholarship_percentage'),
                    original_price=payment_details.get('original_price'),
                )
                # Base64 encode the PDF for Brevo attachment
                pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                pdf_attachment = [{
                    'name': pdf_filename,
                    'content': pdf_base64,
                }]
                logger.info(f"📄 Payment slip PDF generated: {pdf_filename} for application #{application.id}")
            except Exception as slip_err:
                logger.warning(f"⚠️ Failed to generate payment slip PDF for application #{application.id}: {slip_err}")
                pdf_attachment = None

        # Prepare email kwargs with optional PDF attachment
        email_kwargs = {
            'to_emails': [application.email],
            'subject': f"✅ Payment Confirmed - Welcome to {course_title}! 🎉",
            'html_content': email_html,
        }
        if pdf_attachment:
            email_kwargs['attachments'] = pdf_attachment

        success = brevo_service.send_email(**email_kwargs)
        
        if success:
            logger.info(f"📧 Payment confirmation email sent to {application.email} for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send payment confirmation email to {application.email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending payment confirmation notification: {str(e)}")
        return False


def send_payment_failed_notification(application, course_title: str, failure_reason: Optional[str] = None) -> bool:
    """
    Send email when payment fails
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        failure_reason: str - Reason for payment failure (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send payment failure notification")
            return False
        
        # Build email content
        email_html = payment_failed_email(
            application=application,
            course_title=course_title,
            failure_reason=failure_reason
        )
        
        # Send email
        success = brevo_service.send_email(
            to_emails=[application.email],
            subject=f"⚠️ Payment Failed - {course_title}",
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Payment failure email sent to {application.email} for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send payment failure email to {application.email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending payment failure notification: {str(e)}")
        return False


def send_payment_reminder_notification(application, course_title: str, payment_info: Dict) -> bool:
    """
    Send reminder email for pending payments
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_info: dict with payment details
            - amount: float
            - currency: str
            - days_remaining: int (optional)
            - payment_deadline: datetime (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send payment reminder")
            return False
        
        # Build email content
        email_html = payment_reminder_email(
            application=application,
            course_title=course_title,
            payment_info=payment_info
        )
        
        # Send email
        success = brevo_service.send_email(
            to_emails=[application.email],
            subject=f"⏰ Payment Reminder - {course_title}",
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Payment reminder email sent to {application.email} for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send payment reminder email to {application.email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending payment reminder notification: {str(e)}")
        return False


def send_payment_refund_notification(application, course_title: str, refund_details: Dict) -> bool:
    """
    Send email when payment is refunded
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        refund_details: dict with refund information
            - refund_amount: float
            - currency: str
            - refund_reference: str
            - refund_reason: str
            - refund_date: datetime
            - processing_days: str/int (optional)
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send refund notification")
            return False
        
        # Build email content
        email_html = payment_refund_email(
            application=application,
            course_title=course_title,
            refund_details=refund_details
        )
        
        # Send email
        success = brevo_service.send_email(
            to_emails=[application.email],
            subject=f"💸 Refund Processed - {course_title}",
            html_content=email_html
        )
        
        if success:
            logger.info(f"📧 Refund notification email sent to {application.email} for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send refund notification email to {application.email}")
        
        return success
        
    except Exception as e:
        logger.error(f"❌ Error sending refund notification: {str(e)}")
        return False


def _get_payment_info_from_enrollment(enrollment):
    """
    Extract payment information from an enrollment object for email templates
    and payment slips.

    PRIORITY for amount_paid:
      1. enrollment.amount_paid (the actual amount recorded when admin verified payment)
      2. window.get_effective_price() (cohort-level price, accounting for scholarships)
      3. course.price (fallback when no window is linked)

    Also extracts scholarship info (type, percentage, original price) for display
    on payment slips, emails, and the verification page.

    Args:
        enrollment: Enrollment object

    Returns:
        dict with payment details (amount_paid, currency, payment_method, etc.)
    """
    course = enrollment.course
    window = enrollment.application_window

    # Priority 1: Use stored amount_paid on the enrollment (set by admin at verification time)
    stored_amount = getattr(enrollment, 'amount_paid', None)
    stored_currency = getattr(enrollment, 'payment_currency', None)

    if stored_amount is not None:
        amount = float(stored_amount)
        currency = stored_currency or 'USD'
    elif window:
        amount = window.get_effective_price() or 0
        currency = window.get_effective_currency() or 'USD'
    elif course:
        amount = course.price or 0
        currency = course.currency or 'USD'
    else:
        amount = 0
        currency = 'USD'

    # ── Extract scholarship info from application window ──
    scholarship_type = None
    scholarship_percentage = None
    original_price = None
    enrollment_type = None
    if window:
        scholarship_type = getattr(window, 'scholarship_type', None)
        scholarship_percentage = getattr(window, 'scholarship_percentage', None)
        enrollment_type = window.get_effective_enrollment_type() if hasattr(window, 'get_effective_enrollment_type') else getattr(window, 'enrollment_type', 'free')
        original_price = float(getattr(window, 'price', 0) or (getattr(window.course, 'price', 0) if getattr(window, 'course', None) else 0))
    elif course:
        scholarship_type = getattr(course, 'scholarship_type', None)
        scholarship_percentage = getattr(course, 'scholarship_percentage', None)
        enrollment_type = getattr(course, 'enrollment_type', 'free')
        original_price = float(getattr(course, 'price', 0) or 0)

    # If no stored amount_paid, the effective price already accounts for scholarship.
    # The 'amount' above is the scholarship-adjusted price.
    # original_price is the pre-scholarship price.
    # If they're the same, there's no active discount.
    has_scholarship = bool(scholarship_type) and (original_price is not None and amount < original_price)

    # Resolve payment method from enrollment
    payment_method = getattr(enrollment, 'payment_method', None) or 'Manual Payment'
    payment_reference = getattr(enrollment, 'payment_reference', None) or ''
    payment_status = getattr(enrollment, 'payment_status', None) or 'completed'
    # Use verification time — this function is always called at payment verification time
    payment_date = datetime.utcnow()

    return {
        'amount_paid': amount,
        'currency': currency,
        'payment_method': payment_method,
        'payment_reference': payment_reference or f'ENR-{enrollment.id}',
        'payment_date': payment_date,
        'payment_status': payment_status,
        # Scholarship info for display
        'scholarship_type': scholarship_type,
        'scholarship_percentage': float(scholarship_percentage) if scholarship_percentage else None,
        'original_price': original_price,
        'enrollment_type': enrollment_type,
        'has_scholarship': has_scholarship,
    }


def send_enrollment_payment_notification(
    enrollment,
    payment_status: str,
    notes: Optional[str] = None
) -> bool:
    """
    Send email notification for enrollment-level payment status changes.
    Called when an admin verifies/updates payment for an enrollment.

    Args:
        enrollment: Enrollment object
        payment_status: str - New payment status ('completed', 'waived', 'failed')
        notes: str - Optional admin notes/reason

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send enrollment payment notification")
            return False

        student = enrollment.student
        if not student or not student.email:
            logger.warning(f"Cannot send enrollment payment email: enrollment {enrollment.id} has no student email")
            return False

        course = enrollment.course
        course_title = course.title if course else "Course"

        # Build cohort info for email template
        cohort_info = None
        application_end_date = None
        window = enrollment.application_window
        if window:
            cohort_info = {
                'cohort_label': window.cohort_label,
                'cohort_start_date': window.cohort_start,
                'cohort_end_date': window.cohort_end,
                'timezone': 'UTC',
                'community_link': getattr(window, 'community_link', None),
                'community_link_label': getattr(window, 'community_link_label', None),
            }
            # Get application window close date (when application period ends)
            application_end_date = window.closes_at

        if payment_status == 'completed':
            payment_details = _get_payment_info_from_enrollment(enrollment)

            email_html = enrollment_payment_confirmed_email(
                enrollment=enrollment,
                course_title=course_title,
                payment_details=payment_details,
                cohort_info=cohort_info,
                application_end_date=application_end_date,
            )
            subject = f"✅ Payment Verified - Your Spot in {course_title} is Confirmed! 🎉"

            # Generate PDF payment slip attachment
            pdf_attachment = None
            if PAYMENT_SLIP_AVAILABLE and generate_payment_slip_pdf:
                try:
                    student_name = f"{student.first_name} {student.last_name}".strip() if student else "Student"
                    student_phone = getattr(student, 'phone_number', None) or ""
                    window = enrollment.application_window
                    cohort_label = window.cohort_label if window else None
                    cohort_start = window.cohort_start if window else None
                    cohort_end = window.cohort_end if window else None
                    admin_name = "Administrator"

                    # Use the stored verification hash from enrollment for QR code consistency
                    # If no hash is stored yet, compute and persist one so the QR code can be verified
                    stored_verif_hash = getattr(enrollment, 'payment_verification_hash', None)
                    if not stored_verif_hash:
                        # Use same formula as waitlist_routes.py for consistency
                        hash_raw = f"{enrollment.id}-{student_name}"
                        stored_verif_hash = hashlib.sha256(hash_raw.encode()).hexdigest()[:16]
                        enrollment.payment_verification_hash = stored_verif_hash
                        from ..models.user_models import db
                        db.session.commit()
                        logger.info(f"🔐 Generated and stored payment_verification_hash={stored_verif_hash} for enrollment #{enrollment.id}")
                    pdf_bytes, pdf_filename = generate_payment_slip_pdf(
                        student_name=student_name,
                        student_email=student.email,
                        student_phone=student_phone,
                        course_title=course_title,
                        cohort_label=cohort_label,
                        cohort_start_date=cohort_start,
                        cohort_end_date=cohort_end,
                        amount_paid=payment_details.get('amount_paid', 0),
                        currency=payment_details.get('currency', 'USD'),
                        payment_method=payment_details.get('payment_method', 'Manual Payment'),
                        payment_reference=payment_details.get('payment_reference', ''),
                        payment_date=payment_details.get('payment_date'),
                        payment_status='completed',
                        enrollment_id=enrollment.id,
                        verification_hash=stored_verif_hash,
                        admin_name=admin_name,
                        # ── Pass scholarship info for slip display ──
                        scholarship_type=payment_details.get('scholarship_type'),
                        scholarship_percentage=payment_details.get('scholarship_percentage'),
                        original_price=payment_details.get('original_price'),
                    )
                    # Base64 encode the PDF for Brevo attachment
                    pdf_base64 = base64.b64encode(pdf_bytes).decode('utf-8')
                    pdf_attachment = [{
                        'name': pdf_filename,
                        'content': pdf_base64,
                    }]
                    logger.info(f"📄 Payment slip PDF generated: {pdf_filename} for enrollment #{enrollment.id}")
                except Exception as slip_err:
                    logger.warning(f"⚠️ Failed to generate payment slip PDF: {slip_err}")
                    pdf_attachment = None

        elif payment_status == 'waived':
            waiver_details = {'reason': notes or ''} if notes else {}
            email_html = enrollment_payment_waived_email(
                enrollment=enrollment,
                course_title=course_title,
                waiver_details=waiver_details,
                cohort_info=cohort_info,
            )
            subject = f"🎉 Payment Waived - Welcome to {course_title}!"

        elif payment_status == 'failed':
            failure_reason = notes or "Payment verification could not be completed. Please contact support."
            email_html = enrollment_payment_failed_email(
                enrollment=enrollment,
                course_title=course_title,
                failure_reason=failure_reason,
                cohort_info=cohort_info,
            )
            subject = f"⚠️ Payment Not Approved - {course_title}"

        else:
            logger.info(f"No email template for enrollment payment status '{payment_status}' - skipping")
            return False

        # Prepare email kwargs with optional PDF attachment
        email_kwargs = {
            'to_emails': [student.email],
            'subject': subject,
            'html_content': email_html,
        }
        if payment_status == 'completed' and pdf_attachment:
            email_kwargs['attachments'] = pdf_attachment

        success = brevo_service.send_email(**email_kwargs)

        if success:
            logger.info(f"📧 Enrollment payment '{payment_status}' email sent to {student.email} for enrollment #{enrollment.id}")
        else:
            logger.error(f"❌ Failed to send enrollment payment '{payment_status}' email to {student.email}")

        return success

    except Exception as e:
        logger.error(f"❌ Error sending enrollment payment notification: {str(e)}")
        return False


def send_application_submission_admin_alert(
    application,
    course,
    amount: float,
    currency: str,
    payment_method: str,
) -> bool:
    """
    🏪 Send email alert to admins and course instructor when a student
    submits a paid application.

    Args:
        application: CourseApplication object
        course: Course object
        amount: float - Payment amount
        currency: str - Currency code
        payment_method: str - Payment method used

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send application submission admin alert")
            return False

        student_name = application.full_name or "Student"
        student_email = application.email or ""
        course_title = course.title if course else "Course"

        # Build the admin panel URL
        frontend_base = os.environ.get('FRONTEND_URL', 'https://study.afritechbridge.online').rstrip('/')
        admin_panel_url = f"{frontend_base}/admin/applications"

        # Generate email HTML using the admin alert template
        from .payment_email_templates import enrollment_payment_admin_alert_email
        email_html = enrollment_payment_admin_alert_email(
            student_name=student_name,
            student_email=student_email,
            course_title=course_title,
            enrollment_id=application.id,
            amount=amount,
            currency=currency,
            payment_method=payment_method,
            payment_status='submitted',
            admin_panel_url=admin_panel_url,
            screenshot_available=False,
        )

        # Collect recipients: course instructor + all platform admins
        recipients = []

        # Course instructor
        if course and course.instructor and course.instructor.email:
            recipients.append(course.instructor.email)

        # All platform admins
        try:
            from ..models.user_models import User, Role
            admin_role = Role.query.filter_by(name='admin').first()
            if admin_role:
                admins = User.query.filter_by(role_id=admin_role.id, is_active=True).all()
                for admin in admins:
                    if admin.email and admin.email not in recipients:
                        recipients.append(admin.email)
        except Exception as role_err:
            logger.warning(f"Could not fetch admin users: {role_err}")

        if not recipients:
            logger.warning(f"No admin/instructor recipients found for application submission alert #{application.id}")
            return False

        method_labels = {
            'bank_transfer': 'Bank Transfer',
            'momo_pay_code': 'MoMo Pay Code',
            'mobile_money': 'Mobile Money',
            'paypal': 'PayPal',
            'kpay': 'K-Pay',
            'flutterwave': 'Flutterwave',
            'stripe': 'Stripe',
        }
        method_label = method_labels.get(payment_method, payment_method.replace('_', ' ').title())
        subject = f"📝 New Application: {student_name} - {course_title} ({method_label})"

        success = brevo_service.send_email(
            to_emails=recipients,
            subject=subject,
            html_content=email_html,
        )

        if success:
            logger.info(f"📧 Application submission admin alert sent to {len(recipients)} recipients for application #{application.id}")
        else:
            logger.error(f"❌ Failed to send application submission admin alert for application #{application.id}")

        return success

    except Exception as e:
        logger.error(f"❌ Error sending application submission admin alert: {str(e)}")
        return False


def send_enrollment_payment_admin_alert(
    enrollment,
    amount: float,
    currency: str,
    payment_method: str,
    payment_status: str,
) -> bool:
    """
    🏪 Send email alert to admins and course instructor when a student
    submits a payment from the learning interface.

    Args:
        enrollment: Enrollment object
        amount: float - Payment amount
        currency: str - Currency code
        payment_method: str - Payment method used
        payment_status: str - New payment status ('submitted', 'submitted_with_proof')

    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send enrollment payment admin alert")
            return False

        student = enrollment.student
        if not student:
            logger.warning(f"Cannot send admin alert: enrollment {enrollment.id} has no student")
            return False

        course = enrollment.course
        course_title = course.title if course else "Course"

        student_name = student.full_name or student.username or "Student"
        student_email = student.email or ""

        screenshot_available = payment_status == 'submitted_with_proof'

        # Build the admin panel URL
        frontend_base = os.environ.get('FRONTEND_URL', 'https://study.afritechbridge.online').rstrip('/')
        admin_panel_url = f"{frontend_base}/admin/payments"

        # Generate email HTML
        from .payment_email_templates import enrollment_payment_admin_alert_email
        email_html = enrollment_payment_admin_alert_email(
            student_name=student_name,
            student_email=student_email,
            course_title=course_title,
            enrollment_id=enrollment.id,
            amount=amount,
            currency=currency,
            payment_method=payment_method,
            payment_status=payment_status,
            admin_panel_url=admin_panel_url,
            screenshot_available=screenshot_available,
        )

        # Collect recipients: course instructor + all admin users
        recipients = []

        # Course instructor
        if course and course.instructor and course.instructor.email:
            recipients.append(course.instructor.email)

        # All platform admins
        try:
            from ..models.user_models import User, Role
            admin_role = Role.query.filter_by(name='admin').first()
            if admin_role:
                admins = User.query.filter_by(role_id=admin_role.id, is_active=True).all()
                for admin in admins:
                    if admin.email and admin.email not in recipients:
                        recipients.append(admin.email)
        except Exception as role_err:
            logger.warning(f"Could not fetch admin users: {role_err}")

        if not recipients:
            logger.warning(f"No admin/instructor recipients found for enrollment payment alert #{enrollment.id}")
            return False

        method_labels = {
            'bank_transfer': 'Bank Transfer',
            'momo_pay_code': 'MoMo Pay Code',
            'mobile_money': 'Mobile Money',
            'paypal': 'PayPal',
            'kpay': 'K-Pay',
            'flutterwave': 'Flutterwave',
            'stripe': 'Stripe',
        }
        method_label = method_labels.get(payment_method, payment_method.replace('_', ' ').title())
        subject = f"💳 New Payment: {student_name} - {course_title} ({method_label})"

        success = brevo_service.send_email(
            to_emails=recipients,
            subject=subject,
            html_content=email_html,
        )

        if success:
            logger.info(f"📧 Enrollment payment admin alert sent to {len(recipients)} recipients for enrollment #{enrollment.id}")
        else:
            logger.error(f"❌ Failed to send enrollment payment admin alert for enrollment #{enrollment.id}")

        return success

    except Exception as e:
        logger.error(f"❌ Error sending enrollment payment admin alert: {str(e)}")
        return False


def get_payment_info_from_application_window(application_window) -> Dict:
    """
    Extract payment information from ApplicationWindow for email templates.
    Properly handles cohort-level pricing and scholarship discounts.

    Args:
        application_window: ApplicationWindow object

    Returns:
        dict: Payment information dictionary
    """
    try:
        payment_info = {}

        # Get enrollment type (cohort-level override or inherit from course)
        enrollment_type = application_window.get_effective_enrollment_type() if hasattr(application_window, 'get_effective_enrollment_type') else getattr(application_window, 'enrollment_type', 'free')
        payment_info['enrollment_type'] = enrollment_type

        # Get pricing using ApplicationWindow's effective methods (handles scholarship)
        if enrollment_type in ['paid', 'scholarship']:
            effective_price = application_window.get_effective_price() if hasattr(application_window, 'get_effective_price') else 0
            effective_currency = application_window.get_effective_currency() if hasattr(application_window, 'get_effective_currency') else 'USD'

            payment_info['amount'] = float(effective_price or 0)
            payment_info['currency'] = effective_currency or 'USD'
            payment_info['original_price'] = float(getattr(application_window, 'price', 0) or (application_window.course.price if application_window.course else 0))

            # Attach scholarship metadata for email templates
            scholarship_type = getattr(application_window, 'scholarship_type', None)
            scholarship_pct = getattr(application_window, 'scholarship_percentage', None)
            if scholarship_type:
                payment_info['scholarship_type'] = scholarship_type
                payment_info['scholarship_percentage'] = float(scholarship_pct or 0)
        
        # Get deadline if available
        application_deadline = getattr(application_window, 'application_deadline', None)
        if application_deadline:
            payment_info['payment_deadline'] = application_deadline
            
            # Calculate days remaining
            if isinstance(application_deadline, datetime):
                now = datetime.utcnow()
                delta = application_deadline - now
                payment_info['days_remaining'] = max(0, delta.days)
        
        # Payment methods (could be stored in ApplicationWindow or Course)
        payment_info['payment_methods'] = ['Mobile Money', 'Bank Transfer', 'PayPal', 'Credit/Debit Card']
        
        return payment_info
        
    except Exception as e:
        logger.error(f"❌ Error extracting payment info from application window: {str(e)}")
        return {
            'amount': 0,
            'currency': 'USD',
            'enrollment_type': 'free',
            'payment_methods': ['Mobile Money', 'Bank Transfer']
        }


def get_payment_info_from_course(course) -> Dict:
    """
    Extract payment information from Course for email templates
    
    Args:
        course: Course object
    
    Returns:
        dict: Payment information dictionary
    """
    try:
        payment_info = {}
        
        # Get enrollment type from course
        enrollment_type = getattr(course, 'enrollment_type', 'free')
        payment_info['enrollment_type'] = enrollment_type
        
        # Get pricing information
        if enrollment_type in ['paid', 'scholarship']:
            payment_info['amount'] = getattr(course, 'price', 0) or 0
            payment_info['currency'] = getattr(course, 'currency', 'USD') or 'USD'
            payment_info['original_price'] = getattr(course, 'price', 0)
        
        # Payment methods
        payment_info['payment_methods'] = ['Mobile Money', 'Bank Transfer', 'PayPal', 'Credit/Debit Card']
        
        return payment_info
        
    except Exception as e:
        logger.error(f"❌ Error extracting payment info from course: {str(e)}")
        return {
            'amount': 0,
            'currency': 'USD',
            'enrollment_type': 'free',
            'payment_methods': ['Mobile Money', 'Bank Transfer']
        }
