# Email utility for Afritec Bridge LMS
from flask import current_app
from flask_mail import Mail, Message
import logging
import time
import threading

logger = logging.getLogger(__name__)

# This will be initialized in main.py
mail = Mail()

def send_email_async(app, to, subject, template=None, body=None, retries=3, retry_delay=2):
    """
    Send email in a separate thread to avoid blocking the main request
    """
    with app.app_context():
        _send_email_sync(to, subject, template, body, retries, retry_delay)

def send_email(to, subject, template=None, body=None, retries=3, retry_delay=2, async_send=True):
    """
    Send an email with the given subject and content to the recipient
    
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
        # Check if email configuration is available
        if not current_app.config.get('MAIL_USERNAME') or not current_app.config.get('MAIL_PASSWORD'):
            logger.warning(f"Email configuration not complete, skipping email send to {to}")
            logger.info(f"Would have sent: {subject}")
            return False
        
        # Convert to list if single email
        recipients = [to] if isinstance(to, str) else to
        
        # Validate recipients
        if not recipients or not any(recipients):
            logger.error("No valid email recipients provided")
            return False
        
        # Send email asynchronously to avoid blocking the request
        if async_send:
            app = current_app._get_current_object()
            thread = threading.Thread(
                target=send_email_async,
                args=(app, to, subject, template, body, retries, retry_delay)
            )
            thread.daemon = True
            thread.start()
            logger.info(f"📧 Email queued for async delivery to {', '.join(recipients)}")
            logger.info(f"   Subject: {subject}")
            return True
        else:
            # Synchronous send for critical emails
            return _send_email_sync(to, subject, template, body, retries, retry_delay)
            
    except Exception as e:
        logger.error(f"❌ Unexpected error queueing email to {to}: {str(e)}")
        return False

def _send_email_sync(to, subject, template=None, body=None, retries=3, retry_delay=2):
    """
    Internal synchronous email sending function
    """
    try:
        # Convert to list if single email
        recipients = [to] if isinstance(to, str) else to
            
        sender = current_app.config['MAIL_DEFAULT_SENDER']
        
        # Attempt to send email with retries and exponential backoff
        last_error = None
        for attempt in range(retries):
            try:
                msg = Message(
                    subject,
                    sender=sender,
                    recipients=recipients
                )
                
                # Set HTML template if provided, otherwise use plain text
                if template:
                    msg.html = template
                if body:
                    msg.body = body
                
                # Set a shorter timeout for email sending to prevent worker timeouts
                import socket
                original_timeout = socket.getdefaulttimeout()
                socket.setdefaulttimeout(8)  # Reduced to 8 seconds for faster failure detection
                
                try:
                    mail.send(msg)
                    logger.info(f"✉️ Email sent successfully to {', '.join(recipients)}")
                    logger.info(f"   Subject: {subject}")
                    if attempt > 0:
                        logger.info(f"   Succeeded after {attempt + 1} attempts")
                    return True
                finally:
                    socket.setdefaulttimeout(original_timeout)
                    
            except Exception as e:
                last_error = e
                error_msg = str(e).lower()
                logger.warning(f"Email attempt {attempt + 1}/{retries} failed: {str(e)}")
                
                # Check for specific SMTP issues
                if 'timed out' in error_msg:
                    logger.warning("⚠️ SMTP connection timeout - server may be unreachable")
                elif 'authentication' in error_msg or 'username' in error_msg or 'password' in error_msg:
                    logger.error("🔐 SMTP authentication failed - check credentials")
                    break  # Don't retry auth failures
                elif 'connection refused' in error_msg:
                    logger.error("🚫 SMTP connection refused - check server/port")
                
                if attempt < retries - 1:  # Don't sleep on last attempt
                    # Exponential backoff: 2s, 4s, 8s...
                    wait_time = retry_delay * (2 ** attempt)
                    logger.info(f"Retrying in {wait_time} seconds with exponential backoff...")
                    time.sleep(wait_time)
                    time.sleep(retry_delay)
                    logger.info(f"Retrying in {retry_delay} seconds...")
        
        # All retries failed
        logger.error(f"❌ Failed to send email after {retries} attempts")
        logger.error(f"   To: {to}")
        logger.error(f"   Subject: {subject}")
        logger.error(f"   Last error: {str(last_error)}")
        return False
        
    except Exception as e:
        logger.error(f"❌ Unexpected error sending email to {to}: {str(e)}")
        return False
        
def send_password_reset_email(user, reset_url):
    """
    Send a password reset email to the user
    
    Args:
        user: User object
        reset_url: URL for password reset
    """
    subject = "Afritec Bridge LMS - Password Reset"
    template = f"""
    <html>
        <body>
            <h2>Password Reset</h2>
            <p>Hello {user.username},</p>
            <p>You requested a password reset for your Afritec Bridge LMS account.</p>
            <p>Please click the link below to reset your password:</p>
            <p><a href="{reset_url}">{reset_url}</a></p>
            <p>This link will expire in 1 hour.</p>
            <p>If you didn't request this reset, please ignore this email.</p>
            <p>Regards,<br>The Afritec Bridge LMS Team</p>
        </body>
    </html>
    """
    return send_email(user.email, subject, template)