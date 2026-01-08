# src/utils/brevo_email_service.py
import os
import logging
import sib_api_v3_sdk
from sib_api_v3_sdk.rest import ApiException

logger = logging.getLogger(__name__)

class BrevoEmailService:
    def __init__(self, app=None):
        self.app = app
        self.api_instance = None
        self.sender_email = None
        self.sender_name = None
        self.is_configured = False
        
        if app is not None:
            self.init_app(app)
    
    def init_app(self, app):
        """Initialize the Brevo email service with Flask app"""
        self.app = app
        
        # Get configuration from environment
        api_key = os.environ.get('BREVO_API_KEY')
        self.sender_email = os.environ.get('BREVO_SENDER_EMAIL')
        self.sender_name = os.environ.get('BREVO_SENDER_NAME', 'Your App')
        
        # Check if we have the required configuration
        if not api_key:
            logger.warning("Brevo email service not configured - missing API key")
            return
        
        if not self.sender_email:
            logger.warning("Brevo email service not configured - missing sender email")
            return
        
        try:
            # Configure API client
            configuration = sib_api_v3_sdk.Configuration()
            configuration.api_key['api-key'] = api_key
            self.api_instance = sib_api_v3_sdk.TransactionalEmailsApi(
                sib_api_v3_sdk.ApiClient(configuration)
            )
            
            # Test the API key by getting account info
            account_api = sib_api_v3_sdk.AccountApi(sib_api_v3_sdk.ApiClient(configuration))
            account_info = account_api.get_account()
            
            self.is_configured = True
            logger.info(f"Brevo API client configured successfully for account: {account_info.email}")
            
        except ApiException as e:
            logger.error(f"Failed to initialize Brevo API client: {e}")
            self.is_configured = False
        except Exception as e:
            logger.error(f"Unexpected error initializing Brevo: {str(e)}")
            self.is_configured = False
    
    def send_email(self, to_emails, subject, html_content=None, text_content=None, 
                   template_id=None, params=None, cc=None, bcc=None, reply_to=None):
        """Send email using Brevo API"""
        if not self.is_configured:
            logger.warning("Brevo email service not configured - skipping email send")
            logger.info(f"Would have sent email: {subject} to {to_emails}")
            return False
        
        try:
            # Prepare recipients
            recipients = self._prepare_recipients(to_emails)
            if not recipients:
                logger.error("No valid recipients provided")
                return False
            
            # Create email object
            email_data = {
                "to": recipients,
                "sender": {
                    "email": self.sender_email,
                    "name": self.sender_name
                },
                "subject": subject
            }
            
            # Add optional recipients
            if cc:
                email_data["cc"] = self._prepare_recipients(cc)
            if bcc:
                email_data["bcc"] = self._prepare_recipients(bcc)
            if reply_to:
                email_data["reply_to"] = {"email": reply_to}
            
            # Add template or content
            if template_id:
                email_data["template_id"] = template_id
                if params:
                    email_data["params"] = params
            else:
                if html_content:
                    email_data["html_content"] = html_content
                if text_content:
                    email_data["text_content"] = text_content
                
                # If no content provided, create basic content
                if not html_content and not text_content:
                    email_data["text_content"] = "This email was sent from your application."
            
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(**email_data)
            
            # Send the email
            api_response = self.api_instance.send_transac_email(send_smtp_email)
            logger.info(f"✅ Email sent successfully via Brevo API. Message ID: {api_response.message_id}")
            return True
            
        except ApiException as e:
            logger.error(f"❌ Brevo API error: {e}")
            if hasattr(e, 'body'):
                logger.error(f"Error details: {e.body}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error sending email: {str(e)}")
            return False
    
    def _prepare_recipients(self, emails):
        """Convert email addresses to Brevo API format"""
        if not emails:
            return []
        
        recipients = []
        
        # Handle single email string
        if isinstance(emails, str):
            recipients = [{"email": emails}]
        
        # Handle list of emails
        elif isinstance(emails, list):
            for email in emails:
                if isinstance(email, str):
                    recipients.append({"email": email})
                elif isinstance(email, dict):
                    # Already in correct format
                    recipients.append(email)
        
        # Handle dict (single recipient with name)
        elif isinstance(emails, dict):
            recipients = [emails]
        
        return recipients
    
    def send_template_email(self, to_emails, template_id, params=None, subject=None):
        """Send email using a Brevo template"""
        return self.send_email(
            to_emails=to_emails,
            subject=subject or "Email from Your App",  # Fallback subject
            template_id=template_id,
            params=params
        )
    
    def send_batch_emails(self, message_versions, base_subject=None, base_params=None, template_id=None):
        """Send batch emails with different content per recipient"""
        if not self.is_configured:
            logger.warning("Brevo email service not configured - skipping batch email send")
            return False
        
        try:
            email_data = {
                "sender": {
                    "email": self.sender_email,
                    "name": self.sender_name
                },
                "messageVersions": message_versions
            }
            
            # Add base configuration
            if base_subject:
                email_data["subject"] = base_subject
            if base_params:
                email_data["params"] = base_params
            if template_id:
                email_data["templateId"] = template_id
            
            send_smtp_email = sib_api_v3_sdk.SendSmtpEmail(**email_data)
            api_response = self.api_instance.send_transac_email(send_smtp_email)
            
            logger.info(f"✅ Batch emails sent successfully. Message IDs: {api_response.message_ids}")
            return True
            
        except ApiException as e:
            logger.error(f"❌ Brevo batch email API error: {e}")
            return False
        except Exception as e:
            logger.error(f"❌ Unexpected error sending batch emails: {str(e)}")
            return False

# Global instance
brevo_service = BrevoEmailService()