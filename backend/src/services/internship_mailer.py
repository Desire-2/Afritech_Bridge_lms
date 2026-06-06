# Email Service for Internship Application System

import logging
from flask import render_template_string, current_app
from datetime import datetime
from src.utils.brevo_email_service import brevo_service
from src.services.internship_offer_service import InternshipOfferService

logger = logging.getLogger(__name__)


class InternshipMailer:
    """Handle email notifications for internship applications"""
    
    def __init__(self):
        self.brevo_service = brevo_service
        self.admin_email = 'info@afritechbridge.online'
        self.sender_name = 'AfriTech Bridge Team'
    
    def send_application_confirmation(self, application):
        """
        Send confirmation email to applicant after successful submission.
        Includes reference code and next steps.
        """
        try:
            subject = f'Application Received - Reference Code {application.reference_code}'
            
            html_content = render_template_string(self._get_confirmation_template(), 
                reference_code=application.reference_code,
                full_name=application.full_name.split()[0] if application.full_name else 'Applicant',
                track_name=application.track.name if application.track else 'Unknown',
                application_date=application.created_at.strftime('%d %B %Y'),
            )
            
            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )
            
            if success:
                logger.info(f"Confirmation email sent to {application.email}")
            else:
                logger.warning(f"Failed to send confirmation email to {application.email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending confirmation email: {str(e)}")
            return False
    
    def send_admin_new_application_alert(self, application):
        """
        Send notification to admin when new application is received.
        Includes application summary and link to admin panel.
        """
        try:
            subject = f'New Internship Application - {application.full_name}'
            
            html_content = render_template_string(self._get_admin_alert_template(),
                reference_code=application.reference_code,
                full_name=application.full_name,
                email=application.email,
                phone=application.phone,
                track_name=application.track.name if application.track else 'Unknown',
                applicant_type=application.applicant_type.value.replace('_', ' ').title(),
                application_date=application.created_at.strftime('%d %B %Y %H:%M'),
                admin_link=f'{current_app.config.get("FRONTEND_URL", "")}/admin/internships/applications/{application.id}',
            )
            
            success = self.brevo_service.send_email(
                to_emails=[{'email': self.admin_email, 'name': 'AfriTech Bridge Admin'}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )
            
            if success:
                logger.info(f"Admin alert sent for application {application.reference_code}")
            else:
                logger.warning(f"Failed to send admin alert for {application.reference_code}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending admin alert: {str(e)}")
            return False
    
    def send_status_update(self, application, old_status, new_status, note=None):
        """
        Send status update email to applicant.
        Content and tone vary based on new status.
        """
        try:
            status_messages = {
                'shortlisted': {
                    'subject': 'Great News! You\'ve Been Shortlisted',
                    'template': self._get_shortlisted_template(),
                },
                'interview_scheduled': {
                    'subject': 'Interview Scheduled for Your Application',
                    'template': self._get_interview_scheduled_template(),
                },
                'accepted': {
                    'subject': 'Congratulations! You\'ve Been Accepted',
                    'template': self._get_accepted_template(),
                },
                'rejected': {
                    'subject': 'Application Status Update',
                    'template': self._get_rejected_template(),
                },
                'reviewing': {
                    'subject': 'Your Application is Under Review',
                    'template': self._get_reviewing_template(),
                },
            }
            
            status_key = new_status.value if hasattr(new_status, 'value') else str(new_status)
            status_key = status_key.replace('_', '_').lower()
            
            if status_key not in status_messages:
                logger.warning(f"No template for status: {status_key}")
                return False
            
            message_info = status_messages[status_key]
            
            template_context = {
                'reference_code': application.reference_code,
                'full_name': application.full_name.split()[0] if application.full_name else 'Applicant',
                'track_name': application.track.name if application.track else 'Unknown',
                'interview_date': application.interview_date.strftime('%d %B %Y at %I:%M %p') if application.interview_date else 'TBA',
                'note': note or 'Thank you for your interest in AfriTech Bridge.',
                'rejection_reason': application.rejection_reason or 'We had a large number of qualified applicants.',
            }
            
            html_content = render_template_string(message_info['template'], **template_context)
            
            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=message_info['subject'],
                html_content=html_content,
                sender_name=self.sender_name,
            )
            
            if success:
                logger.info(f"Status update email sent to {application.email} - {status_key}")
            else:
                logger.warning(f"Failed to send status update email to {application.email}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending status update: {str(e)}")
            return False
    
    # ============= EMAIL TEMPLATES =============
    
    def _get_confirmation_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #1a2d5a; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { color: #333; line-height: 1.6; }
        .reference-box { background-color: #e8f4f8; border-left: 4px solid #1ab3a8; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .reference-box .label { color: #666; font-size: 14px; }
        .reference-box .code { font-size: 24px; font-weight: bold; color: #1ab3a8; font-family: 'Courier New', monospace; }
        .details { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .detail-row { margin: 10px 0; }
        .detail-label { color: #666; font-weight: bold; }
        .detail-value { color: #333; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
        .button { display: inline-block; background-color: #1ab3a8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .accent { color: #1ab3a8; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Received! 🎉</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>Thank you for submitting your internship application to AfriTech Bridge! We're excited to review your profile.</p>
            
            <div class="reference-box">
                <div class="label">Your Application Reference Code:</div>
                <div class="code">{{ reference_code }}</div>
                <p style="margin: 10px 0 0 0; color: #666; font-size: 13px;">Save this code to check your application status anytime</p>
            </div>
            
            <div class="details">
                <div class="detail-row">
                    <span class="detail-label">Track Applied For:</span>
                    <span class="detail-value">{{ track_name }}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Application Date:</span>
                    <span class="detail-value">{{ application_date }}</span>
                </div>
            </div>
            
            <h3 style="color: #1a2d5a;">What Happens Next?</h3>
            <ol>
                <li><span class="accent">Review (1-2 weeks)</span> - Our team will review your application</li>
                <li><span class="accent">Shortlisting</span> - If selected, you'll be notified to proceed to interviews</li>
                <li><span class="accent">Interview</span> - Meet our team members</li>
                <li><span class="accent">Final Decision</span> - We'll inform you of the outcome</li>
            </ol>
            
            <p><strong>Check your application status:</strong></p>
            <p style="background-color: #f0f0f0; padding: 10px; border-radius: 4px;">
                Visit our portal and enter your reference code <span class="accent">{{ reference_code }}</span> to track your progress.
            </p>
            
            <p style="margin-top: 30px;">If you have any questions, don't hesitate to reach out to us.</p>
            
            <p>Best regards,<br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
            <p>This is an automated email. Please do not reply directly to this message.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_admin_alert_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #f47c20; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .details { background-color: #f9f9f9; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .detail-row { margin: 10px 0; display: flex; }
        .detail-label { color: #666; font-weight: bold; width: 120px; }
        .detail-value { color: #333; flex: 1; }
        .button { display: inline-block; background-color: #1ab3a8; color: white; padding: 12px 30px; text-decoration: none; border-radius: 4px; margin: 20px 0; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 30px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ New Application Received</h1>
        </div>
        
        <div class="details">
            <div class="detail-row">
                <span class="detail-label">Name:</span>
                <span class="detail-value">{{ full_name }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Email:</span>
                <span class="detail-value">{{ email }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">{{ phone }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Track:</span>
                <span class="detail-value">{{ track_name }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Type:</span>
                <span class="detail-value">{{ applicant_type }}</span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Ref Code:</span>
                <span class="detail-value"><strong>{{ reference_code }}</strong></span>
            </div>
            <div class="detail-row">
                <span class="detail-label">Submitted:</span>
                <span class="detail-value">{{ application_date }}</span>
            </div>
        </div>
        
        <p style="text-align: center;">
            <a href="{{ admin_link }}" class="button">Review Application →</a>
        </p>
        
        <div class="footer">
            <p>Log in to the admin panel to review, shortlist, or schedule an interview.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_shortlisted_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #1ab3a8; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { color: #333; line-height: 1.6; }
        .accent { color: #1ab3a8; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎉 Congratulations!</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>We're thrilled to let you know that you've been <span class="accent">shortlisted</span> for the {{ track_name }} internship track!</p>
            
            <p>Your application stood out among many qualified candidates. The next step is an interview where you'll get to meet our team and learn more about the opportunity.</p>
            
            <h3>Next Steps:</h3>
            <ul>
                <li>You'll receive interview details shortly</li>
                <li>Prepare to discuss your experience and goals</li>
                <li>Reach out if you have any questions</li>
            </ul>
            
            <p>Your Reference Code: <span class="accent">{{ reference_code }}</span></p>
            
            <p>Thank you for your interest in AfriTech Bridge. We're looking forward to learning more about you!</p>
            
            <p>Best regards,<br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_interview_scheduled_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #1a2d5a; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 28px; }
        .content { color: #333; line-height: 1.6; }
        .interview-box { background-color: #fff3cd; border-left: 4px solid #f47c20; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .interview-box h3 { margin: 0 0 10px 0; color: #f47c20; }
        .accent { color: #1ab3a8; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Your Interview is Scheduled</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>We're excited to move forward with your application! Your interview has been scheduled.</p>
            
            <div class="interview-box">
                <h3>Interview Details:</h3>
                <p><strong>Date & Time:</strong> {{ interview_date }}</p>
                <p><strong>Track:</strong> {{ track_name }}</p>
                <p><strong>Reference Code:</strong> {{ reference_code }}</p>
            </div>
            
            <h3>Preparation Tips:</h3>
            <ul>
                <li>Review your motivation letter and projects</li>
                <li>Prepare questions about the internship and AfriTech Bridge</li>
                <li>Test your internet connection and audio/video setup</li>
                <li>Be ready 5 minutes before the scheduled time</li>
            </ul>
            
            <p>{{ note }}</p>
            
            <p>If you have any questions or need to reschedule, please reach out as soon as possible.</p>
            
            <p>Looking forward to meeting you!<br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_accepted_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { background: linear-gradient(135deg, #1ab3a8 0%, #1a2d5a 100%); color: white; text-align: center; margin: -40px -40px 30px -40px; padding: 40px 20px; border-radius: 8px 8px 0 0; }
        .header h1 { margin: 0; font-size: 32px; }
        .content { color: #333; line-height: 1.6; }
        .accent { color: #1ab3a8; font-weight: bold; }
        .next-steps { background-color: #e8f4f8; border-left: 4px solid #1ab3a8; padding: 20px; margin: 20px 0; border-radius: 4px; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🚀 Welcome to AfriTech Bridge!</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>We're delighted to offer you a position in our <span class="accent">{{ track_name }}</span> internship program!</p>
            
            <p>Your passion, skills, and potential impressed our team, and we can't wait to have you join us on this journey to transform tech in Africa.</p>
            
            <div class="next-steps">
                <h3 style="margin-top: 0; color: #1ab3a8;">What Happens Next?</h3>
                <ul style="padding-left: 20px;">
                    <li>You'll receive onboarding details shortly</li>
                    <li>Internship orientation will be scheduled</li>
                    <li>Get ready to make an impact!</li>
                </ul>
            </div>
            
            <p><strong>Your Details:</strong></p>
            <ul>
                <li>Program: {{ track_name }}</li>
                <li>Reference Code: <span class="accent">{{ reference_code }}</span></li>
            </ul>
            
            <p>{{ note }}</p>
            
            <p>If you have any questions, we're here to help. Welcome aboard!<br/><br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_rejected_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #1a2d5a; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { color: #333; line-height: 1.6; }
        .accent { color: #1ab3a8; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>Application Status Update</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>Thank you for your interest in the {{ track_name }} internship program at AfriTech Bridge. We appreciate the time and effort you invested in your application.</p>
            
            <p>After careful consideration, we regret to inform you that we have decided not to move forward with your application at this time.</p>
            
            <p><strong>Feedback:</strong> {{ rejection_reason }}</p>
            
            <p>We encourage you to apply again in the future. Many exceptional candidates don't make it on the first try, but their persistence pays off. Continue developing your skills, and we'd love to see you apply for future opportunities.</p>
            
            <p>If you'd like feedback on your application, feel free to reach out to us. We're here to support your growth.</p>
            
            <p>Best of luck with your career journey!<br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def send_offer_letter(self, application, offer, password=None):
        """
        Send an internship offer letter email with credentials and next steps.
        """
        try:
            frontend_url = current_app.config.get('FRONTEND_URL', 'https://study.afritechbridge.online')
            subject = f"🎉 Congratulations! Your Internship Offer from AfriTech Bridge"

            html_content = render_template_string(self._get_offer_letter_template(),
                full_name=application.full_name.split()[0] if application.full_name else 'Applicant',
                track_name=application.track.name if application.track else 'Internship Program',
                reference_code=application.reference_code,
                offer_number=offer.offer_number,
                username=offer.generated_username,
                password=password or 'Use your existing password (or use Forgot Password to reset it)',
                login_url=f'{frontend_url}/auth/login',
                cohort_name=application.cohort.cohort_name if application.cohort else 'Your Cohort',
                start_date=application.cohort.start_date.strftime('%d %B %Y') if application.cohort else 'TBD',
                share_url=InternshipOfferService.get_share_url(offer),
                verification_hash=offer.verification_hash,
            )

            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Offer letter email sent to {application.email} (offer={offer.offer_number})")
            else:
                logger.warning(f"Failed to send offer letter email to {application.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending offer letter email: {str(e)}")
            return False

    def _get_offer_letter_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%);
            padding: 20px;
        }
        .container {
            max-width: 600px;
            margin: 0 auto;
            background: #ffffff;
            border-radius: 16px;
            overflow: hidden;
            box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        /* Header with gradient */
        .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #14b8a6 100%);
            padding: 48px 40px 36px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(20,184,166,0.15) 0%, transparent 50%),
                        radial-gradient(circle at 70% 30%, rgba(249,115,22,0.1) 0%, transparent 50%);
            animation: pulse 4s ease-in-out infinite;
        }
        @keyframes pulse {
            0%, 100% { transform: scale(1); opacity: 0.5; }
            50% { transform: scale(1.05); opacity: 0.8; }
        }
        .header-content { position: relative; z-index: 1; }
        .confetti-icon { font-size: 48px; margin-bottom: 16px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            letter-spacing: -0.5px;
        }
        .header p {
            color: rgba(255,255,255,0.85);
            font-size: 16px;
            line-height: 1.5;
        }
        .header .offer-badge {
            display: inline-block;
            background: rgba(20,184,166,0.2);
            border: 1px solid rgba(20,184,166,0.4);
            color: #5eead4;
            padding: 6px 20px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-top: 12px;
        }
        /* Body */
        .body-content {
            padding: 40px;
            color: #334155;
        }
        .body-content h2 {
            color: #0f172a;
            font-size: 20px;
            margin-bottom: 16px;
        }
        .body-content p {
            line-height: 1.7;
            margin-bottom: 16px;
        }
        /* Credentials Box */
        .creds-box {
            background: linear-gradient(135deg, #f0fdfa 0%, #fef2f2 100%);
            border: 2px solid #14b8a6;
            border-radius: 12px;
            padding: 24px;
            margin: 24px 0;
        }
        .creds-box h3 {
            color: #0f172a;
            font-size: 16px;
            margin-bottom: 16px;
            text-align: center;
        }
        .creds-box .creds-row {
            display: flex;
            align-items: center;
            padding: 10px 16px;
            background: rgba(255,255,255,0.7);
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .creds-box .creds-label {
            font-weight: 700;
            color: #1e3a8a;
            width: 100px;
            font-size: 13px;
        }
        .creds-box .creds-value {
            font-family: 'Courier New', monospace;
            font-weight: 700;
            color: #0f172a;
            font-size: 15px;
            letter-spacing: 1px;
            flex: 1;
        }
        .creds-box .creds-note {
            text-align: center;
            color: #ef4444;
            font-size: 12px;
            margin-top: 12px;
            font-weight: 600;
        }
        /* Detail Grid */
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 20px 0;
        }
        .detail-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
        }
        .detail-item .label {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .detail-item .value {
            font-size: 14px;
            color: #0f172a;
            font-weight: 600;
            margin-top: 4px;
        }
        /* CTA Button */
        .cta-button {
            display: block;
            width: 100%;
            padding: 16px 24px;
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            text-align: center;
            margin: 24px 0;
            transition: all 0.3s ease;
            box-shadow: 0 4px 15px rgba(20,184,166,0.3);
        }
        .cta-button:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(20,184,166,0.4);
        }
        /* Social Share */
        .social-share {
            text-align: center;
            padding: 24px;
            background: #f8fafc;
            border-radius: 12px;
            margin: 24px 0;
            border: 1px solid #e2e8f0;
        }
        .social-share p {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 12px;
        }
        .social-links {
            display: flex;
            justify-content: center;
            gap: 12px;
        }
        .social-btn {
            display: inline-block;
            padding: 10px 24px;
            border-radius: 8px;
            text-decoration: none;
            font-size: 13px;
            font-weight: 600;
            color: #fff !important;
            transition: all 0.2s;
        }
        .social-btn.linkedin { background: #0a66c2; }
        .social-btn.twitter { background: #1da1f2; }
        .social-btn.facebook { background: #1877f2; }
        .social-btn.whatsapp { background: #25d366; }
        .social-btn:hover { transform: translateY(-2px); opacity: 0.9; }
        /* Verification */
        .verify-section {
            text-align: center;
            padding: 16px;
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            margin: 16px 0;
        }
        .verify-section p {
            color: #92400e;
            font-size: 12px;
            margin-bottom: 0;
        }
        /* Footer */
        .footer {
            background: #0f172a;
            padding: 32px 40px;
            text-align: center;
        }
        .footer p {
            color: #94a3b8;
            font-size: 12px;
            line-height: 1.6;
        }
        .footer .brand {
            color: #14b8a6;
            font-weight: 700;
            font-size: 14px;
            margin-bottom: 8px;
        }
        /* Mobile */
        @media (max-width: 480px) {
            .header { padding: 32px 20px; }
            .body-content { padding: 24px; }
            .header h1 { font-size: 22px; }
            .detail-grid { grid-template-columns: 1fr; }
            .social-links { flex-wrap: wrap; }
            .creds-box .creds-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .creds-box .creds-label { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <!-- Header -->
        <div class="header">
            <div class="header-content">
                <span class="confetti-icon">🎉</span>
                <h1>Welcome to AfriTech Bridge!</h1>
                <p>We're thrilled to have you join our internship program</p>
                <span class="offer-badge">Offer No: {{ offer_number }}</span>
            </div>
        </div>

        <!-- Body -->
        <div class="body-content">
            <h2>Dear {{ full_name }},</h2>

            <p>
                Congratulations! We are delighted to officially offer you a position in the
                <strong>{{ track_name }}</strong> internship program at
                <strong>AfriTech Bridge</strong>. Your application, skills, and passion
                impressed our team, and we are confident you will make a significant impact.
            </p>

            <!-- Offer Details -->
            <div class="detail-grid">
                <div class="detail-item">
                    <div class="label">Program Track</div>
                    <div class="value">{{ track_name }}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Cohort</div>
                    <div class="value">{{ cohort_name }}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Start Date</div>
                    <div class="value">{{ start_date }}</div>
                </div>
                <div class="detail-item">
                    <div class="label">Reference Code</div>
                    <div class="value" style="font-family:monospace;">{{ reference_code }}</div>
                </div>
            </div>

            <!-- Credentials Box -->
            <div class="creds-box">
                <h3>🔑 Your Login Credentials</h3>
                <div class="creds-row">
                    <span class="creds-label">Username</span>
                    <span class="creds-value">{{ username }}</span>
                </div>
                <div class="creds-row">
                    <span class="creds-label">Password</span>
                    <span class="creds-value" style="letter-spacing: 2px;">{{ password }}</span>
                </div>
                <p class="creds-note">⚠️ For security, you will be required to change your password on first login.</p>
            </div>

            <!-- Call to Action -->
            <a href="{{ login_url }}" class="cta-button">
                🚀 Log In to Your Account
            </a>

            <p>
                Once logged in, you will be able to:
            </p>
            <ul style="padding-left: 20px; margin-bottom: 20px; line-height: 2;">
                <li>📋 <strong>View and complete assigned tasks</strong></li>
                <li>📈 <strong>Track your progress and performance</strong></li>
                <li>💬 <strong>Communicate with your mentor and team</strong></li>
                <li>🏆 <strong>Earn badges and certificates of completion</strong></li>
            </ul>

            <!-- Social Share -->
            <div class="social-share">
                <p>🎯 Share your achievement with friends and family!</p>
                <div class="social-links">
                    <a href="https://www.linkedin.com/sharing/share-offsite/?url={{ share_url }}" class="social-btn linkedin" target="_blank">LinkedIn</a>
                    <a href="https://twitter.com/intent/tweet?text=I%27m%20thrilled%20to%20share%20that%20I%20received%20an%20internship%20offer%20from%20%40AfriTechBridge%20%F0%9F%8E%89&url={{ share_url }}" class="social-btn twitter" target="_blank">Twitter</a>
                    <a href="https://www.facebook.com/sharer/sharer.php?u={{ share_url }}" class="social-btn facebook" target="_blank">Facebook</a>
                    <a href="https://wa.me/?text=I%20received%20an%20internship%20offer%20from%20AfriTech%20Bridge%21%20Check%20it%20out%3A%20{{ share_url }}" class="social-btn whatsapp" target="_blank">WhatsApp</a>
                </div>
            </div>

            <!-- Verification -->
            <div class="verify-section">
                <p>
                    🔒 <strong>Tamper-Proof Verification:</strong> This offer letter is protected by blockchain-grade
                    SHA-256 hashing. Verify its authenticity at
                    <a href="https://study.afritechbridge.online/verify-offer/{{ verification_hash }}" style="color: #14b8a6; font-weight: 600;">study.afritechbridge.online/verify-offer</a>
                </p>
            </div>

            <p>
                If you have any questions or need assistance getting started,
                please don't hesitate to reach out to our team at
                <a href="mailto:info@afritechbridge.online" style="color: #14b8a6;">info@afritechbridge.online</a>.
            </p>

            <p>
                Welcome aboard! We can't wait to see what you'll achieve.
            </p>

            <p style="margin-top: 24px;">
                Best regards,<br>
                <strong style="color: #14b8a6; font-size: 16px;">The AfriTech Bridge Team</strong>
            </p>
        </div>

        <!-- Footer -->
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 8px;">
                © 2026 AfriTech Bridge. All rights reserved.<br>
                Offer No: {{ offer_number }} | This is an official communication.
            </p>
        </div>
    </div>
</body>
</html>
'''

    def _get_reviewing_template(self):
        return '''
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background-color: white; padding: 40px; border-radius: 8px; }
        .header { color: #1a2d5a; text-align: center; margin-bottom: 30px; }
        .header h1 { margin: 0; font-size: 24px; }
        .content { color: #333; line-height: 1.6; }
        .accent { color: #1ab3a8; font-weight: bold; }
        .footer { text-align: center; color: #999; font-size: 12px; margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 Your Application is Under Review</h1>
        </div>
        
        <div class="content">
            <p>Hi {{ full_name }},</p>
            
            <p>Thank you for your interest in the {{ track_name }} internship program. We've started reviewing your application and will notify you of our decision soon.</p>
            
            <p>The review process typically takes 1-2 weeks. Your Reference Code is <span class="accent">{{ reference_code }}</span>.</p>
            
            <p>{{ note }}</p>
            
            <p>Keep an eye on your inbox for updates!</p>
            
            <p>Best regards,<br/>
            <span class="accent">AfriTech Bridge Team</span></p>
        </div>
        
        <div class="footer">
            <p>© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
