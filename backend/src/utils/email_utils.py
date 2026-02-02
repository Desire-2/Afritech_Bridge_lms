# Enhanced Email utility for Afritec Bridge LMS
# Now powered by Brevo API for reliable email delivery
from flask import current_app
import logging
import time
import threading
from typing import List, Dict, Tuple, Optional, Union
from .brevo_email_service import brevo_service

logger = logging.getLogger(__name__)

# Rate limiting for email sending (legacy support)
EMAIL_RATE_LIMIT = 0.1  # 100ms between emails - optimized for Brevo
last_email_time = 0
email_lock = threading.Lock()

def send_email_async(app, to, subject, template=None, body=None, retries=3, retry_delay=2):
    """
    Send email in a separate thread to avoid blocking the main request
    (Legacy function - now uses Brevo service internally)
    """
    with app.app_context():
        _send_email_sync(to, subject, template, body, retries, retry_delay)

def send_email(to, subject, template=None, body=None, retries=3, retry_delay=2, async_send=True):
    """
    Send an email with the given subject and content to the recipient
    Enhanced with Brevo API for improved reliability and deliverability
    
    Args:
        to: Recipient email address (string or list)
        subject: Email subject
        template: HTML content of the email (preferred)
        body: Plain text content (fallback)
        retries: Number of retry attempts (default: 3)
        retry_delay: Seconds to wait between retries (default: 2)
        async_send: Send email asynchronously to avoid blocking (default: True)
    
    Returns:
        bool: True if email send was initiated successfully, False otherwise
    """
    try:
        # Check if Brevo service is configured
        if not brevo_service.is_configured:
            # Fallback: check for basic email config
            if current_app and (not current_app.config.get('BREVO_API_KEY') and 
                              not current_app.config.get('MAIL_USERNAME')):
                logger.warning(f"Email service not configured, skipping email send to {to}")
                logger.info(f"Would have sent: {subject}")
                return False
        
        # Convert to list if single email
        recipients = [to] if isinstance(to, str) else to
        
        # Validate recipients
        if not recipients or not any(recipients):
            logger.error("No valid email recipients provided")
            return False
        
        # Use Brevo service for sending
        return brevo_service.send_email(
            to_emails=recipients,
            subject=subject,
            html_content=template,
            text_content=body
        )
            
    except Exception as e:
        logger.error(f"❌ Unexpected error queueing email to {to}: {str(e)}")
        return False

def _send_email_sync(to, subject, template=None, body=None, retries=3, retry_delay=2):
    """
    Internal synchronous email sending function
    Enhanced with Brevo API integration
    """
    try:
        # Convert to list if single email
        recipients = [to] if isinstance(to, str) else to
        
        # Use Brevo service for synchronous sending
        return brevo_service.send_email(
            to_emails=recipients,
            subject=subject,
            html_content=template,
            text_content=body
        )
        
    except Exception as e:
        logger.error(f"❌ Unexpected error sending email to {to}: {str(e)}")
        return False
        
def send_email_with_bcc(to, bcc, subject, template=None, body=None, retries=3, retry_delay=3, async_send=True):
    """
    Send an email with BCC recipients
    Enhanced with Brevo API for improved deliverability
    
    Args:
        to: Primary recipients (string or list)
        bcc: BCC recipients (string or list)
        subject: Email subject
        template: HTML content of the email (preferred)
        body: Plain text content (fallback)
        retries: Number of retry attempts (default: 3)
        retry_delay: Seconds to wait between retries (default: 3)
        async_send: Send email asynchronously to avoid blocking (default: True)
    
    Returns:
        bool: True if email send was initiated successfully, False otherwise
    """
    try:
        # Check if Brevo service is configured
        if not brevo_service.is_configured:
            if current_app and not current_app.config.get('BREVO_API_KEY'):
                logger.warning("Brevo email service not configured, skipping BCC email send")
                return False
        
        # Convert to lists
        to_list = [to] if isinstance(to, str) else (to or [])
        bcc_list = [bcc] if isinstance(bcc, str) else (bcc or [])
        
        if not to_list and not bcc_list:
            logger.error("No email recipients provided")
            return False
        
        # For BCC-only emails, move first BCC to direct recipient for better delivery
        if not to_list and bcc_list:
            logger.warning("BCC-only email detected, moving first BCC to direct recipient")
            to_list = [bcc_list[0]]
            bcc_list = bcc_list[1:]
        
        # Use Brevo service for BCC emails
        return brevo_service.send_email(
            to_emails=to_list,
            bcc=bcc_list,
            subject=subject,
            html_content=template,
            text_content=body
        )
            
    except Exception as e:
        logger.error(f"❌ Unexpected error queueing BCC email: {str(e)}")
        return False

def send_email_bcc_async(app, to_list, bcc_list, subject, template=None, body=None, retries=3, retry_delay=2):
    """Send BCC email in a separate thread (legacy compatibility)"""
    with app.app_context():
        send_email_with_bcc(to_list, bcc_list, subject, template, body, retries, retry_delay, async_send=False)

def _send_email_bcc_sync(to_list, bcc_list, subject, template=None, body=None, retries=3, retry_delay=3):
    """Internal synchronous BCC email sending function (legacy compatibility)"""
    return send_email_with_bcc(to_list, bcc_list, subject, template, body, retries, retry_delay, async_send=False)

def _send_single_bcc_email(to_list, bcc_list, subject, template, body, retries, retry_delay):
    """Send a single BCC email (legacy compatibility)"""
    return send_email_with_bcc(to_list, bcc_list, subject, template, body, retries, retry_delay, async_send=False)

def send_emails_batch(emails_data, subject, retries=3):
    """
    Send multiple emails with rate limiting and detailed error tracking
    Enhanced with Brevo API for improved reliability
    
    Args:
        emails_data: List of {email, template, recipient_name} dicts
        subject: Email subject
        retries: Number of retry attempts
    
    Returns:
        Tuple of (successful_emails, failed_emails_with_details)
    """
    if not brevo_service.is_configured:
        logger.warning("Brevo service not configured - falling back to individual sends")
        return _send_emails_batch_fallback(emails_data, subject, retries)
    
    # Use Brevo batch service for better performance
    try:
        # Transform data format for Brevo service
        brevo_emails_data = []
        for email_data in emails_data:
            brevo_emails_data.append({
                'email': email_data['email'],
                'name': email_data.get('recipient_name', email_data['email'].split('@')[0]),
                'html_content': email_data['template'],
                'text_content': email_data.get('body', '')
            })
        
        # Use Brevo batch sending
        successful_emails, failed_emails = brevo_service.send_batch_emails(
            brevo_emails_data, subject, retries=retries
        )
        
        return successful_emails, failed_emails
        
    except Exception as e:
        logger.error(f"Error in batch email sending: {e}")
        return _send_emails_batch_fallback(emails_data, subject, retries)

def _send_emails_batch_fallback(emails_data, subject, retries=3):
    """Fallback batch email sending using individual sends"""
    successful_emails = []
    failed_emails = []
    
    global last_email_time
    
    for email_data in emails_data:
        email = email_data['email']
        template = email_data['template']
        recipient_name = email_data.get('recipient_name', 'Applicant')
        
        try:
            # Rate limiting
            with email_lock:
                current_time = time.time()
                time_since_last = current_time - last_email_time
                if time_since_last < EMAIL_RATE_LIMIT:
                    sleep_time = EMAIL_RATE_LIMIT - time_since_last
                    time.sleep(sleep_time)
                last_email_time = time.time()
            
            success = _send_email_sync(email, subject, template, retries=retries)
            
            if success:
                successful_emails.append(email)
                logger.info(f"✅ Email sent successfully to {email} ({recipient_name})")
            else:
                failed_emails.append({
                    'email': email,
                    'recipient_name': recipient_name,
                    'error': 'Email sending failed after retries',
                    'retry_count': retries
                })
                logger.error(f"❌ Failed to send email to {email} ({recipient_name})")
                
        except Exception as e:
            failed_emails.append({
                'email': email,
                'recipient_name': recipient_name,
                'error': str(e),
                'retry_count': 0
            })
            logger.error(f"❌ Exception sending email to {email}: {str(e)}")
            
        # Small delay between emails
        time.sleep(0.1)
    
    return successful_emails, failed_emails

def send_password_reset_email(user, reset_url):
    """
    Send a password reset email to the user
    Enhanced with Brevo API for better deliverability
    
    Args:
        user: User object
        reset_url: URL for password reset
    """
    subject = "Afritec Bridge LMS - Password Reset Request"
    
    # Enhanced HTML template with better styling
    template = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body {{ font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; }}
            .container {{ max-width: 600px; margin: 0 auto; padding: 20px; }}
            .header {{ background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }}
            .content {{ background: #f8f9fa; padding: 30px; border-radius: 0 0 8px 8px; }}
            .btn {{ display: inline-block; padding: 12px 30px; background: #007bff; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }}
            .warning {{ background: #fff3cd; border: 1px solid #ffeaa7; padding: 15px; border-radius: 4px; margin: 20px 0; }}
            .footer {{ color: #6c757d; font-size: 12px; text-align: center; margin-top: 20px; }}
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h2>🔐 Password Reset Request</h2>
            </div>
            <div class="content">
                <p>Hello <strong>{user.username}</strong>,</p>
                <p>You requested a password reset for your Afritec Bridge LMS account. We're here to help you get back into your learning journey!</p>
                
                <div class="warning">
                    <strong>⚠️ Security Notice:</strong> This link will expire in <strong>1 hour</strong> for your security.
                </div>
                
                <p>Click the button below to reset your password:</p>
                <a href="{reset_url}" class="btn">Reset My Password</a>
                
                <p>Or copy and paste this link into your browser:<br>
                <small><a href="{reset_url}">{reset_url}</a></small></p>
                
                <hr>
                <p><strong>Didn't request this reset?</strong> No worries! You can safely ignore this email. Your password will remain unchanged.</p>
                
                <p>Best regards,<br>
                <strong>The Afritec Bridge LMS Team</strong></p>
            </div>
            <div class="footer">
                <p>This is an automated message from Afritec Bridge LMS. Please do not reply to this email.</p>
            </div>
        </div>
    </body>
    </html>
    """
    
    # Plain text fallback
    text_content = f"""
    Password Reset - Afritec Bridge LMS
    
    Hello {user.username},
    
    You requested a password reset for your Afritec Bridge LMS account.
    
    Please click the link below to reset your password:
    {reset_url}
    
    This link will expire in 1 hour for security reasons.
    
    If you didn't request this reset, please ignore this email.
    
    Best regards,
    The Afritec Bridge LMS Team
    """
    
    return send_email(
        to=user.email, 
        subject=subject, 
        template=template,
        body=text_content,
        async_send=False  # Password resets should be synchronous for immediate delivery
    )


# Legacy compatibility functions for smooth migration
def init_mail_service(app):
    """Legacy mail service initialization (now uses Brevo)"""
    from .brevo_email_service import brevo_service
    return brevo_service.init_app(app)


# Export the mail instance for backward compatibility
class LegacyMailWrapper:
    """Wrapper to maintain Flask-Mail compatibility during migration"""
    def __init__(self):
        pass
    
    def init_app(self, app):
        """Initialize with app - now uses Brevo"""
        return init_mail_service(app)
    
    def send(self, message):
        """Legacy send method - not recommended for new code"""
        logger.warning("Using legacy mail.send() - consider migrating to send_email()")
        # Could implement conversion from Flask-Mail Message to Brevo if needed
        pass

# Create legacy mail instance
mail = LegacyMailWrapper()