# Email utility for Afritec Bridge LMS
from flask import current_app
from flask_mail import Mail, Message
import logging
import time
import threading
from typing import List, Dict, Tuple

logger = logging.getLogger(__name__)

# This will be initialized in main.py
mail = Mail()

# Rate limiting for email sending
EMAIL_RATE_LIMIT = 0.5  # Seconds between emails
last_email_time = 0
email_lock = threading.Lock()

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
        
def send_email_with_bcc(to, bcc, subject, template=None, body=None, retries=3, retry_delay=3, async_send=True):
    """
    Send an email with BCC recipients
    
    Args:
        to: Primary recipients (string or list)
        bcc: BCC recipients (string or list)
        subject: Email subject
        template: HTML content of the email (preferred)
        body: Plain text content (fallback)
        retries: Number of retry attempts (default: 3)
        retry_delay: Seconds to wait between retries (default: 3 - increased for stability)
        async_send: Send email asynchronously to avoid blocking (default: True)
    
    Returns:
        bool: True if email send was initiated successfully, False otherwise
    """
    try:
        # Check if email configuration is available
        if not current_app.config.get('MAIL_USERNAME') or not current_app.config.get('MAIL_PASSWORD'):
            logger.warning(f"Email configuration not complete, skipping email send")
            return False
        
        # Convert to lists
        to_list = [to] if isinstance(to, str) else (to or [])
        bcc_list = [bcc] if isinstance(bcc, str) else (bcc or [])
        
        if not to_list and not bcc_list:
            logger.error("No email recipients provided")
            return False
        
        # Ensure we have at least one direct recipient (email providers prefer this)
        if not to_list and bcc_list:
            logger.warning("BCC-only email detected, moving first BCC to direct recipient")
            to_list = [bcc_list[0]]
            bcc_list = bcc_list[1:]
        
        # Send email asynchronously to avoid blocking
        if async_send:
            app = current_app._get_current_object()
            thread = threading.Thread(
                target=send_email_bcc_async,
                args=(app, to_list, bcc_list, subject, template, body, retries, retry_delay)
            )
            thread.daemon = True
            thread.start()
            logger.info(f"📧 Email with BCC queued for async delivery")
            logger.info(f"   To: {', '.join(to_list) if to_list else 'None'}")
            logger.info(f"   BCC: {len(bcc_list)} recipients")
            logger.info(f"   Subject: {subject}")
            return True
        else:
            return _send_email_bcc_sync(to_list, bcc_list, subject, template, body, retries, retry_delay)
            
    except Exception as e:
        logger.error(f"❌ Unexpected error queueing BCC email: {str(e)}")
        return False

def send_email_bcc_async(app, to_list, bcc_list, subject, template=None, body=None, retries=3, retry_delay=2):
    """Send BCC email in a separate thread"""
    with app.app_context():
        _send_email_bcc_sync(to_list, bcc_list, subject, template, body, retries, retry_delay)

def _send_email_bcc_sync(to_list, bcc_list, subject, template=None, body=None, retries=3, retry_delay=3):
    """Internal synchronous BCC email sending function with improved error handling"""
    try:
        sender = current_app.config['MAIL_DEFAULT_SENDER']
        
        # Limit BCC recipients to avoid provider limits (max 50 BCC per email)
        max_bcc_per_email = 50
        if len(bcc_list) > max_bcc_per_email:
            logger.warning(f"BCC list too large ({len(bcc_list)}), splitting into chunks")
            # Split into multiple emails
            for i in range(0, len(bcc_list), max_bcc_per_email):
                chunk_bcc = bcc_list[i:i + max_bcc_per_email]
                result = _send_single_bcc_email(to_list, chunk_bcc, subject, template, body, retries, retry_delay)
                if not result:
                    return False
                # Delay between chunks
                time.sleep(2)
            return True
        else:
            return _send_single_bcc_email(to_list, bcc_list, subject, template, body, retries, retry_delay)
        
    except Exception as e:
        logger.error(f"❌ Unexpected error sending BCC email: {str(e)}")
        return False

# Rate limiting for email sending
EMAIL_RATE_LIMIT = 0.5  # Seconds between emails
last_email_time = 0
email_lock = threading.Lock()

def send_emails_batch(emails_data, subject, retries=3):
    """
    Send multiple emails with rate limiting and detailed error tracking
    
    Args:
        emails_data: List of {email, template, recipient_name} dicts
        subject: Email subject
        retries: Number of retry attempts
    
    Returns:
        Tuple of (successful_emails, failed_emails_with_details)
    """
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
            
        # Small delay between emails to prevent overwhelming SMTP server
        time.sleep(0.1)
    
    return successful_emails, failed_emails

def _send_single_bcc_email(to_list, bcc_list, subject, template, body, retries, retry_delay):
    """Send a single BCC email with retry logic"""
    sender = current_app.config['MAIL_DEFAULT_SENDER']
    
    # Attempt to send email with retries
    last_error = None
    for attempt in range(retries):
        try:
            msg = Message(
                subject,
                sender=sender,
                recipients=to_list,
                bcc=bcc_list
            )
            
            # Set HTML template if provided
            if template:
                msg.html = template
            if body:
                msg.body = body
            
            # Set shorter timeout with rate limiting
            import socket
            original_timeout = socket.getdefaulttimeout()
            socket.setdefaulttimeout(10)  # Increased timeout for BCC emails
            
            try:
                # Rate limiting for BCC emails
                time.sleep(1)  # 1 second delay before sending BCC
                mail.send(msg)
                logger.info(f"✉️ BCC Email sent successfully")
                logger.info(f"   To: {', '.join(to_list) if to_list else 'None'}")
                logger.info(f"   BCC: {len(bcc_list)} recipients")
                logger.info(f"   Subject: {subject}")
                if attempt > 0:
                    logger.info(f"   Succeeded after {attempt + 1} attempts")
                return True
            finally:
                socket.setdefaulttimeout(original_timeout)
                
        except Exception as e:
            last_error = e
            error_msg = str(e).lower()
            logger.warning(f"BCC Email attempt {attempt + 1}/{retries} failed: {str(e)}")
            
            # Check for specific errors
            if 'authentication' in error_msg or 'username' in error_msg:
                logger.error("🔐 SMTP authentication failed - stopping retries")
                break
            elif 'too many recipients' in error_msg or '554' in error_msg:
                logger.error("📧 Too many recipients - consider reducing BCC list")
                break
            
            if attempt < retries - 1:
                wait_time = retry_delay * (2 ** attempt)
                logger.info(f"Retrying BCC email in {wait_time} seconds...")
                time.sleep(wait_time)
    
    # All retries failed
    logger.error(f"❌ Failed to send BCC email after {retries} attempts")
    logger.error(f"   Last error: {str(last_error)}")
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