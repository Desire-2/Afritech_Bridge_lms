# Email utility for Afritec Bridge LMS
from flask import current_app
from flask_mail import Mail, Message
import logging

logger = logging.getLogger(__name__)

# This will be initialized in main.py
mail = Mail()

def send_email(to, subject, template):
    """
    Send an email with the given subject and template to the recipient
    
    Args:
        to: Recipient email address
        subject: Email subject
        template: HTML content of the email
    """
    try:
        # Check if email configuration is available
        if not current_app.config.get('MAIL_USERNAME') or not current_app.config.get('MAIL_PASSWORD'):
            logger.warning("Email configuration not complete, skipping email send")
            return False
            
        sender = current_app.config['MAIL_DEFAULT_SENDER']
        msg = Message(
            subject,
            sender=sender,
            recipients=[to]
        )
        msg.html = template
        
        # Set a shorter timeout for email sending to prevent worker timeouts
        import socket
        original_timeout = socket.getdefaulttimeout()
        socket.setdefaulttimeout(30)  # 30 second timeout for email
        
        try:
            mail.send(msg)
            logger.info(f"Email sent to {to} with subject '{subject}'")
            return True
        finally:
            socket.setdefaulttimeout(original_timeout)
            
    except Exception as e:
        logger.error(f"Failed to send email to {to}: {str(e)}")
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