"""
💰 Payment Email Notification Service for Afritech Bridge LMS
Centralizes payment-related email notifications
"""
import logging
from datetime import datetime
from typing import Optional, Dict
from .payment_email_templates import (
    application_saved_payment_pending_email,
    payment_confirmation_email,
    payment_failed_email,
    payment_reminder_email,
    payment_refund_email
)

# Import email service
try:
    from .brevo_email_service import brevo_service
    BREVO_AVAILABLE = True
except (ImportError, ModuleNotFoundError) as e:
    brevo_service = None  # type: ignore
    BREVO_AVAILABLE = False

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


def send_payment_confirmation_notification(application, course_title: str, payment_details: Dict) -> bool:
    """
    Send email when payment is successfully confirmed
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_details: dict with confirmation details
            - amount_paid: float
            - currency: str
            - payment_method: str
            - payment_reference: str
            - payment_date: datetime
    
    Returns:
        bool: True if email sent successfully, False otherwise
    """
    try:
        if not BREVO_AVAILABLE or brevo_service is None:
            logger.warning("📧 Email service not available - cannot send payment confirmation")
            return False
        
        # Build email content
        email_html = payment_confirmation_email(
            application=application,
            course_title=course_title,
            payment_details=payment_details
        )
        
        # Send email
        success = brevo_service.send_email(
            to_emails=[application.email],
            subject=f"✅ Payment Confirmed - Welcome to {course_title}! 🎉",
            html_content=email_html
        )
        
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


def get_payment_info_from_application_window(application_window) -> Dict:
    """
    Extract payment information from ApplicationWindow for email templates
    
    Args:
        application_window: ApplicationWindow object
    
    Returns:
        dict: Payment information dictionary
    """
    try:
        payment_info = {}
        
        # Get enrollment type
        enrollment_type = getattr(application_window, 'enrollment_type', 'free')
        payment_info['enrollment_type'] = enrollment_type
        
        # Get pricing information
        if enrollment_type in ['paid', 'scholarship']:
                payment_info['amount'] = float(getattr(application_window, 'cohort_price', 0) or 0)
                payment_info['currency'] = getattr(application_window, 'cohort_currency', 'USD') or 'USD'
                payment_info['original_price'] = float(getattr(application_window, 'cohort_price', 0) or 0)
                
                # Check for scholarship
                scholarship_type = getattr(application_window, 'scholarship_type', None)
                scholarship_pct = float(getattr(application_window, 'scholarship_percentage', 0) or 0)
                
                if scholarship_type and scholarship_pct:
                    payment_info['scholarship_type'] = scholarship_type
                    payment_info['scholarship_percentage'] = scholarship_pct
                    
                    # Calculate effective price after scholarship
                    if scholarship_type == 'full':
                        payment_info['amount'] = 0.0
                    elif scholarship_type == 'partial' and scholarship_pct > 0:
                        original = float(payment_info['amount'])
        
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
