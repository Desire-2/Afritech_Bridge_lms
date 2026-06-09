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
    
    def send_admin_application_accepted_alert(self, application, changed_by_name='Admin'):
        """
        Send notification to admin when an application is accepted so they can
        prepare onboarding materials, assign cohort, and generate offer letter.
        """
        try:
            subject = f'🎉 Application Accepted - {application.full_name} - {application.reference_code}'
            
            html_content = render_template_string(self._get_admin_accepted_alert_template(),
                reference_code=application.reference_code,
                full_name=application.full_name,
                email=application.email,
                phone=application.phone,
                track_name=application.track.name if application.track else 'Unknown',
                applicant_type=application.applicant_type.value.replace('_', ' ').title() if application.applicant_type else 'N/A',
                application_date=application.created_at.strftime('%d %B %Y'),
                accepted_date=application.reviewed_at.strftime('%d %B %Y %H:%M') if application.reviewed_at else datetime.utcnow().strftime('%d %B %Y %H:%M'),
                changed_by_name=changed_by_name,
                admin_link=f'{current_app.config.get("FRONTEND_URL", "")}/admin/internships/applications/{application.id}',
            )
            
            success = self.brevo_service.send_email(
                to_emails=[{'email': self.admin_email, 'name': 'AfriTech Bridge Admin'}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )
            
            if success:
                logger.info(f"Admin accepted alert sent for {application.reference_code}")
            else:
                logger.warning(f"Failed to send admin accepted alert for {application.reference_code}")
            
            return success
        except Exception as e:
            logger.error(f"Error sending admin accepted alert: {str(e)}")
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
        .header {
            background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 50%, #14b8a6 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(20,184,166,0.15) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 15px; }
        .body-content {
            padding: 36px;
            color: #334155;
        }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 12px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .accent { color: #14b8a6; font-weight: bold; }
        .reference-card {
            background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
            border: 2px solid #14b8a6;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
        }
        .reference-card .label {
            color: #64748b;
            font-size: 13px;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
        }
        .reference-card .code {
            font-size: 28px;
            font-weight: bold;
            color: #0f172a;
            font-family: 'Courier New', monospace;
            letter-spacing: 2px;
            margin: 8px 0;
        }
        .reference-card .hint { color: #64748b; font-size: 13px; }
        .details-grid {
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
        .detail-item .dlabel {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .detail-item .dvalue {
            font-size: 14px;
            color: #0f172a;
            font-weight: 600;
            margin-top: 4px;
        }
        .timeline {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        }
        .timeline h3 { color: #0f172a; font-size: 16px; margin-bottom: 16px; text-align: center; }
        .step {
            display: flex;
            align-items: flex-start;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid #e2e8f0;
        }
        .step:last-child { border-bottom: none; }
        .step-num {
            width: 28px; height: 28px;
            background: linear-gradient(135deg, #14b8a6, #0d9488);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            color: white; font-size: 13px; font-weight: 700;
            flex-shrink: 0;
        }
        .step-content { flex: 1; }
        .step-content .s-title { font-weight: 600; color: #0f172a; font-size: 14px; }
        .step-content .s-desc { color: #64748b; font-size: 13px; margin-top: 2px; }
        .status-track {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 16px;
            margin: 16px 0;
            text-align: center;
        }
        .status-track p { color: #92400e; font-size: 13px; margin: 0; }
        .footer {
            background: #0f172a;
            padding: 28px 36px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; margin: 0; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 8px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .details-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">🎉</span>
                <h1>Application Received!</h1>
                <p>Your journey with AfriTech Bridge begins here</p>
            </div>
        </div>
        <div class="body-content">
            <h2>Hi {{ full_name }},</h2>
            <p>Thank you for submitting your application to the <strong>{{ track_name }}</strong> internship program! We're thrilled about your interest and can't wait to review your profile.</p>

            <div class="reference-card">
                <div class="label">Your Application Reference Code</div>
                <div class="code">{{ reference_code }}</div>
                <div class="hint">📌 Save this code to check your application status anytime</div>
            </div>

            <div class="details-grid">
                <div class="detail-item">
                    <div class="dlabel">Program Track</div>
                    <div class="dvalue">{{ track_name }}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Submitted On</div>
                    <div class="dvalue">{{ application_date }}</div>
                </div>
            </div>

            <div class="timeline">
                <h3>🚀 What Happens Next?</h3>
                <div class="step">
                    <div class="step-num">1</div>
                    <div class="step-content">
                        <div class="s-title">Application Review</div>
                        <div class="s-desc">Our team carefully reviews your profile and motivation (1-2 weeks)</div>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">2</div>
                    <div class="step-content">
                        <div class="s-title">Shortlisting</div>
                        <div class="s-desc">If selected, you'll be invited to the next stage</div>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">3</div>
                    <div class="step-content">
                        <div class="s-title">Interview</div>
                        <div class="s-desc">Meet our team and discuss your potential</div>
                    </div>
                </div>
                <div class="step">
                    <div class="step-num">4</div>
                    <div class="step-content">
                        <div class="s-title">Final Decision</div>
                        <div class="s-desc">We'll notify you of the outcome via email</div>
                    </div>
                </div>
            </div>

            <div class="status-track">
                <p>🔍 <strong>Track your progress:</strong> Visit our portal and enter <strong>{{ reference_code }}</strong> to see your application status in real time.</p>
            </div>

            <p>If you have any questions, feel free to reach out to us at <a href="mailto:info@afritechbridge.online" style="color: #14b8a6;">info@afritechbridge.online</a>.</p>

            <p>Best regards,<br/>
            <strong style="color: #14b8a6;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 6px;">© 2026 AfriTech Bridge. All rights reserved.</p>
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
        .header {
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content { padding: 32px; color: #334155; }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 16px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .applicant-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .info-row {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: white;
            border-radius: 8px;
            margin-bottom: 6px;
        }
        .info-row .ilabel {
            font-weight: 600;
            color: #64748b;
            width: 100px;
            font-size: 13px;
        }
        .info-row .ivalue {
            color: #0f172a;
            font-weight: 500;
            font-size: 14px;
            flex: 1;
        }
        .cta-button {
            display: block;
            text-align: center;
            padding: 14px 24px;
            background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(245,158,11,0.3);
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .info-row .ilabel { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>⚡ New Application Received</h1>
            <p>{{ full_name }}</p>
        </div>
        <div class="body-content">
            <p>A new internship application requires your attention. Review the applicant details below.</p>

            <div class="applicant-card">
                <div class="info-row">
                    <span class="ilabel">👤 Name</span>
                    <span class="ivalue"><strong>{{ full_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📧 Email</span>
                    <span class="ivalue">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📞 Phone</span>
                    <span class="ivalue">{{ phone }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🎯 Track</span>
                    <span class="ivalue">{{ track_name }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📋 Type</span>
                    <span class="ivalue">{{ applicant_type }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🆔 Ref Code</span>
                    <span class="ivalue" style="font-family: monospace; font-weight: 700; color: #14b8a6;">{{ reference_code }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📅 Submitted</span>
                    <span class="ivalue">{{ application_date }}</span>
                </div>
            </div>

            <a href="{{ admin_link }}" class="cta-button">🔍 Review Application →</a>

            <p style="text-align: center; color: #94a3b8; font-size: 13px;">Log in to the admin panel to review, shortlist, or schedule an interview.</p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_admin_accepted_alert_template(self):
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
        .header {
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(16,185,129,0.2) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 48px; margin-bottom: 10px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content { padding: 32px; color: #334155; }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 16px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .celebration-banner {
            background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
            border: 2px solid #10b981;
            border-radius: 12px;
            padding: 24px;
            margin: 16px 0;
            text-align: center;
        }
        .celebration-banner .big {
            font-size: 20px;
            font-weight: 700;
            color: #065f46;
            margin-bottom: 6px;
        }
        .celebration-banner p { color: #065f46; font-size: 14px; margin: 0; }
        .applicant-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .info-row {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: white;
            border-radius: 8px;
            margin-bottom: 6px;
        }
        .info-row .ilabel {
            font-weight: 600;
            color: #64748b;
            width: 100px;
            font-size: 13px;
        }
        .info-row .ivalue {
            color: #0f172a;
            font-weight: 500;
            font-size: 14px;
            flex: 1;
        }
        .action-checklist {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        }
        .action-checklist h3 {
            color: #92400e;
            font-size: 15px;
            font-weight: 700;
            margin-bottom: 12px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .action-checklist .item {
            display: flex;
            align-items: center;
            gap: 10px;
            padding: 8px 12px;
            background: rgba(255,255,255,0.7);
            border-radius: 8px;
            margin-bottom: 6px;
        }
        .action-checklist .item:last-child { margin-bottom: 0; }
        .action-checklist .item .dot {
            width: 8px; height: 8px;
            border-radius: 50%;
            flex-shrink: 0;
        }
        .action-checklist .item .dot.assign { background: #3b82f6; }
        .action-checklist .item .dot.offer { background: #10b981; }
        .action-checklist .item .dot.onboard { background: #f59e0b; }
        .action-checklist .item-text { color: #78350f; font-size: 13px; }
        .cta-button {
            display: block;
            text-align: center;
            padding: 14px 24px;
            background: linear-gradient(135deg, #059669 0%, #10b981 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(5,150,105,0.3);
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .info-row .ilabel { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">🎉</span>
                <h1>Application Accepted!</h1>
                <p>Onboarding actions required for {{ full_name }}</p>
            </div>
        </div>
        <div class="body-content">
            <p>An internship applicant has been accepted. Please take the necessary steps to prepare onboarding materials.</p>

            <div class="celebration-banner">
                <div class="big">✅ Accepted by {{ changed_by_name }}</div>
                <p>{{ accepted_date }}</p>
            </div>

            <div class="applicant-card">
                <div class="info-row">
                    <span class="ilabel">👤 Name</span>
                    <span class="ivalue"><strong>{{ full_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📧 Email</span>
                    <span class="ivalue">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📞 Phone</span>
                    <span class="ivalue">{{ phone }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🎯 Track</span>
                    <span class="ivalue"><strong>{{ track_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📋 Type</span>
                    <span class="ivalue">{{ applicant_type }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🆔 Ref Code</span>
                    <span class="ivalue" style="font-family: monospace; font-weight: 700; color: #059669;">{{ reference_code }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📅 Applied</span>
                    <span class="ivalue">{{ application_date }}</span>
                </div>
            </div>

            <div class="action-checklist">
                <h3>📋 Next Steps — Prepare Onboarding</h3>
                <div class="item">
                    <span class="dot assign"></span>
                    <span class="item-text"><strong>Assign to a cohort</strong> — Select a cohort with available spots for this track</span>
                </div>
                <div class="item">
                    <span class="dot offer"></span>
                    <span class="item-text"><strong>Generate offer letter</strong> — Create a tamper-proof PDF offer with login credentials</span>
                </div>
                <div class="item">
                    <span class="dot onboard"></span>
                    <span class="item-text"><strong>Schedule orientation</strong> — Prepare onboarding materials and welcome the new intern</span>
                </div>
            </div>

            <a href="{{ admin_link }}" class="cta-button">🚀 Go to Application →</a>

            <p style="text-align: center; color: #94a3b8; font-size: 13px;">Open the application in the admin panel to assign cohort and generate offer letter.</p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_admin_interview_details_updated_template(self):
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
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #0891b2 100%);
            padding: 36px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(8,145,178,0.2) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 44px; margin-bottom: 10px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content { padding: 32px; color: #334155; }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 16px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .updated-by-banner {
            background: linear-gradient(135deg, #ecfeff 0%, #cffafe 100%);
            border: 2px solid #0891b2;
            border-radius: 12px;
            padding: 18px 24px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .updated-by-banner .avatar {
            width: 44px; height: 44px;
            background: linear-gradient(135deg, #0891b2, #0e7490);
            border-radius: 50%;
            display: flex; align-items: center; justify-content: center;
            font-size: 20px; flex-shrink: 0;
        }
        .updated-by-banner .info { flex: 1; }
        .updated-by-banner .info .who {
            font-weight: 700; color: #164e63; font-size: 15px;
        }
        .updated-by-banner .info .when {
            color: #0891b2; font-size: 13px; margin-top: 2px;
        }
        .applicant-card {
            background: #f8fafc; border: 1px solid #e2e8f0;
            border-radius: 12px; padding: 20px; margin: 16px 0;
        }
        .info-row {
            display: flex; align-items: center;
            padding: 10px 14px; background: white;
            border-radius: 8px; margin-bottom: 6px;
        }
        .info-row .ilabel {
            font-weight: 600; color: #64748b;
            width: 100px; font-size: 13px;
        }
        .info-row .ivalue {
            color: #0f172a; font-weight: 500;
            font-size: 14px; flex: 1;
        }
        .details-card {
            background: #f0fdfa; border: 2px solid #14b8a6;
            border-radius: 12px; padding: 20px; margin: 16px 0;
        }
        .details-card .details-header {
            display: flex; align-items: center; gap: 8px; margin-bottom: 12px;
        }
        .details-card .details-header h3 {
            color: #065f46; font-size: 15px; font-weight: 700;
        }
        .details-card .details-header .badge-updated {
            background: #14b8a6; color: white; font-size: 10px; font-weight: 700;
            padding: 2px 8px; border-radius: 10px; text-transform: uppercase; letter-spacing: 0.5px;
        }
        .detail-row {
            display: flex; align-items: center; gap: 10px;
            padding: 10px 14px; background: rgba(255,255,255,0.8);
            border-radius: 8px; margin-bottom: 6px;
        }
        .detail-row:last-child { margin-bottom: 0; }
        .detail-row .dicon { font-size: 16px; width: 24px; text-align: center; }
        .detail-row .dlabel { font-weight: 600; color: #065f46; width: 110px; font-size: 13px; }
        .detail-row .dvalue { color: #0f172a; font-weight: 500; font-size: 14px; flex: 1; }
        .detail-row .dvalue .link {
            color: #0891b2; font-weight: 600; word-break: break-all;
        }
        .detail-row .dvalue .na { color: #94a3b8; font-style: italic; }
        .cta-button {
            display: block; text-align: center;
            padding: 14px 24px;
            background: linear-gradient(135deg, #0891b2 0%, #0e7490 100%);
            color: #ffffff !important; text-decoration: none;
            border-radius: 10px; font-size: 15px; font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(8,145,178,0.3);
        }
        .footer {
            background: #0f172a; padding: 24px 32px; text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .info-row .ilabel { width: auto; }
            .updated-by-banner { flex-direction: column; text-align: center; }
            .detail-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .detail-row .dlabel { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">&#128197;</span>
                <h1>Interview Details Updated</h1>
                <p>{{ full_name }} &mdash; {{ track_name }}</p>
            </div>
        </div>
        <div class="body-content">
            <p>Interview details have been updated for an internship applicant. Review the latest information below.</p>
            <div class="updated-by-banner">
                <div class="avatar">&#9998;&#65039;</div>
                <div class="info">
                    <div class="who">Updated by {{ updated_by_name }}</div>
                    <div class="when">{{ updated_at }}</div>
                </div>
            </div>
            <div class="applicant-card">
                <div class="info-row">
                    <span class="ilabel">&#128100; Name</span>
                    <span class="ivalue"><strong>{{ full_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128231; Email</span>
                    <span class="ivalue">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128222; Phone</span>
                    <span class="ivalue">{{ phone }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#127919; Track</span>
                    <span class="ivalue">{{ track_name }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#128203; Type</span>
                    <span class="ivalue">{{ applicant_type }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">&#127987; Ref Code</span>
                    <span class="ivalue" style="font-family: monospace; font-weight: 700; color: #0891b2;">{{ reference_code }}</span>
                </div>
            </div>
            <div class="details-card">
                <div class="details-header">
                    <h3>&#128203; Interview Details</h3>
                    <span class="badge-updated">Updated</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128197;</span>
                    <span class="dlabel">Date &amp; Time</span>
                    <span class="dvalue">{{ interview_date }}</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128187;</span>
                    <span class="dlabel">Platform</span>
                    <span class="dvalue">{{ meeting_platform }}</span>
                </div>
                <div class="detail-row">
                    <span class="dicon">&#128279;</span>
                    <span class="dlabel">Meeting Link</span>
                    <span class="dvalue">
                        {% if meeting_link and meeting_link != 'Not provided' %}
                        <a href="{{ meeting_link }}" class="link" target="_blank">{{ meeting_link }}</a>
                        {% else %}
                        <span class="na">Not provided</span>
                        {% endif %}
                    </span>
                </div>
            </div>
            <a href="{{ admin_link }}" class="cta-button">&#128269; View Full Application</a>
            <p style="text-align: center; color: #94a3b8; font-size: 13px;">
                Open in admin panel to see the complete application and interview history.
            </p>
        </div>
        <div class="footer">
            <p class="brand">&#10026; AFRITECH BRIDGE &#10026;</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''


    def _get_admin_interview_notes_updated_template(self):
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
        .header {
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            padding: 36px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(99,102,241,0.2) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 44px; margin-bottom: 10px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content { padding: 32px; color: #334155; }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 16px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .updated-by-banner {
            background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%);
            border: 2px solid #6366f1;
            border-radius: 12px;
            padding: 18px 24px;
            margin: 16px 0;
            display: flex;
            align-items: center;
            gap: 14px;
        }
        .updated-by-banner .avatar {
            width: 44px;
            height: 44px;
            background: linear-gradient(135deg, #6366f1, #4f46e5);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
            flex-shrink: 0;
        }
        .updated-by-banner .info { flex: 1; }
        .updated-by-banner .info .who {
            font-weight: 700;
            color: #1e1b4b;
            font-size: 15px;
        }
        .updated-by-banner .info .when {
            color: #6366f1;
            font-size: 13px;
            margin-top: 2px;
        }
        .applicant-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .info-row {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: white;
            border-radius: 8px;
            margin-bottom: 6px;
        }
        .info-row .ilabel {
            font-weight: 600;
            color: #64748b;
            width: 100px;
            font-size: 13px;
        }
        .info-row .ivalue {
            color: #0f172a;
            font-weight: 500;
            font-size: 14px;
            flex: 1;
        }
        .notes-card {
            background: #fffbeb;
            border: 2px solid #f59e0b;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .notes-card .notes-header {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 12px;
        }
        .notes-card .notes-header h3 {
            color: #92400e;
            font-size: 15px;
            font-weight: 700;
        }
        .notes-card .notes-header .badge-new {
            background: #f59e0b;
            color: white;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 10px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }
        .notes-card .notes-content {
            background: rgba(255,255,255,0.8);
            border-radius: 8px;
            padding: 16px;
            color: #78350f;
            font-size: 14px;
            line-height: 1.7;
            white-space: pre-wrap;
        }
        .notes-card .notes-content .empty {
            color: #d97706;
            font-style: italic;
        }
        .cta-button {
            display: block;
            text-align: center;
            padding: 14px 24px;
            background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-size: 15px;
            font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(99,102,241,0.3);
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .info-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .info-row .ilabel { width: auto; }
            .updated-by-banner { flex-direction: column; text-align: center; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">📝</span>
                <h1>Interview Notes Updated</h1>
                <p>{{ full_name }} — {{ track_name }}</p>
            </div>
        </div>
        <div class="body-content">
            <p>Interview notes have been updated for an internship applicant. Review the latest notes below.</p>

            <div class="updated-by-banner">
                <div class="avatar">✍️</div>
                <div class="info">
                    <div class="who">Updated by {{ updated_by_name }}</div>
                    <div class="when">{{ updated_at }}</div>
                </div>
            </div>

            <div class="applicant-card">
                <div class="info-row">
                    <span class="ilabel">👤 Name</span>
                    <span class="ivalue"><strong>{{ full_name }}</strong></span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📧 Email</span>
                    <span class="ivalue">{{ email }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📞 Phone</span>
                    <span class="ivalue">{{ phone }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🎯 Track</span>
                    <span class="ivalue">{{ track_name }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📋 Type</span>
                    <span class="ivalue">{{ applicant_type }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">🆔 Ref Code</span>
                    <span class="ivalue" style="font-family: monospace; font-weight: 700; color: #6366f1;">{{ reference_code }}</span>
                </div>
                <div class="info-row">
                    <span class="ilabel">📅 Interview</span>
                    <span class="ivalue">{{ interview_date }}</span>
                </div>
            </div>

            <div class="notes-card">
                <div class="notes-header">
                    <h3>📋 Interview Notes</h3>
                    <span class="badge-new">Updated</span>
                </div>
                <div class="notes-content">
                    {{ interview_notes }}
                </div>
            </div>

            <a href="{{ admin_link }}" class="cta-button">🔍 View Full Application →</a>

            <p style="text-align: center; color: #94a3b8; font-size: 13px;">
                Open in admin panel to see the complete interview history and take action.
            </p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
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
        .header {
            background: linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);
            padding: 40px 30px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 70% 30%, rgba(168,85,247,0.2) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 52px; margin-bottom: 12px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 15px; }
        .body-content {
            padding: 36px;
            color: #334155;
        }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 12px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .accent { color: #7c3aed; font-weight: bold; }
        .celebration-box {
            background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
            border: 2px solid #7c3aed;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
        }
        .celebration-box .big {
            font-size: 18px;
            font-weight: 700;
            color: #6d28d9;
            margin-bottom: 8px;
        }
        .steps-list {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .steps-list h3 { color: #0f172a; font-size: 16px; margin-bottom: 12px; }
        .steps-list ul {
            padding-left: 20px;
            line-height: 2;
            color: #475569;
            font-size: 14px;
        }
        .footer {
            background: #0f172a;
            padding: 28px 36px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">🎉</span>
                <h1>Congratulations!</h1>
                <p>You've been shortlisted for {{ track_name }}</p>
            </div>
        </div>
        <div class="body-content">
            <h2>Great news, {{ full_name }}! 🎊</h2>
            <p>We're thrilled to let you know that you've been <span class="accent">shortlisted</span> for the <strong>{{ track_name }}</strong> internship track!</p>
            <p>Your application truly stood out among many qualified candidates. The next step is an interview where you'll get to meet our team and learn more about this exciting opportunity.</p>

            <div class="celebration-box">
                <div class="big">🌟 You're moving to the next stage!</div>
                <p style="color: #6d28d9; margin: 0;">Reference Code: <strong>{{ reference_code }}</strong></p>
            </div>

            <div class="steps-list">
                <h3>📋 What's Next?</h3>
                <ul>
                    <li>📅 <strong>Interview Scheduling</strong> — You'll receive interview details shortly</li>
                    <li>💼 <strong>Prepare</strong> — Review your experience and goals for the discussion</li>
                    <li>💬 <strong>Ask Questions</strong> — Reach out if you need any clarification</li>
                </ul>
            </div>

            <p>We're looking forward to getting to know you better. Get ready for an exciting conversation!</p>

            <p>Best regards,<br/>
            <strong style="color: #7c3aed;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 6px;">© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def _get_interview_scheduled_template(self):
        return self._get_interview_scheduled_enhanced_template()
    
    def _get_accepted_template(self):
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
        .header {
            background: linear-gradient(135deg, #059669 0%, #14b8a6 50%, #0f172a 100%);
            padding: 44px 30px 36px;
            text-align: center;
            position: relative;
            overflow: hidden;
        }
        .header::before {
            content: '';
            position: absolute;
            top: -50%; left: -50%;
            width: 200%; height: 200%;
            background: radial-gradient(circle at 30% 50%, rgba(20,184,166,0.2) 0%, transparent 50%);
        }
        .header-content { position: relative; z-index: 1; }
        .header .icon { font-size: 56px; margin-bottom: 12px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 30px;
            font-weight: 800;
            margin-bottom: 6px;
            letter-spacing: -0.5px;
        }
        .header p { color: rgba(255,255,255,0.9); font-size: 16px; }
        .header .badge {
            display: inline-block;
            background: rgba(255,255,255,0.15);
            border: 1px solid rgba(255,255,255,0.3);
            color: #ffffff;
            padding: 4px 16px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            letter-spacing: 1px;
            text-transform: uppercase;
            margin-top: 10px;
        }
        .body-content {
            padding: 36px;
            color: #334155;
        }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 12px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .accent { color: #059669; font-weight: bold; }
        .welcome-card {
            background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%);
            border: 2px solid #059669;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
        }
        .welcome-card .big {
            font-size: 18px;
            font-weight: 700;
            color: #065f46;
            margin-bottom: 8px;
        }
        .welcome-card p { color: #065f46; font-size: 14px; margin: 0; }
        .next-steps-box {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .next-steps-box h3 { color: #0f172a; font-size: 16px; margin-bottom: 12px; }
        .next-steps-box ul {
            padding-left: 20px;
            line-height: 2.2;
            color: #475569;
            font-size: 14px;
        }
        .detail-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 12px;
            margin: 16px 0;
        }
        .detail-item {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
        }
        .detail-item .dlabel {
            font-size: 11px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 600;
        }
        .detail-item .dvalue {
            font-size: 14px;
            color: #0f172a;
            font-weight: 600;
            margin-top: 4px;
        }
        .footer {
            background: #0f172a;
            padding: 28px 36px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 32px 20px; }
            .body-content { padding: 24px; }
            .detail-grid { grid-template-columns: 1fr; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="header-content">
                <span class="icon">🚀</span>
                <h1>Welcome to AfriTech Bridge!</h1>
                <p>You've been accepted into the <strong>{{ track_name }}</strong> internship program</p>
                <span class="badge">Ref: {{ reference_code }}</span>
            </div>
        </div>
        <div class="body-content">
            <h2>Dear {{ full_name }},</h2>
            <p>We are absolutely delighted to welcome you to the <span class="accent">{{ track_name }}</span> internship program! Your passion, skills, and potential truly impressed our team, and we can't wait to have you on board.</p>

            <div class="welcome-card">
                <div class="big">🎊 Congratulations on Your Acceptance!</div>
                <p>You're about to embark on an exciting journey to transform tech in Africa. Your future starts here!</p>
            </div>

            <div class="detail-grid">
                <div class="detail-item">
                    <div class="dlabel">Program Track</div>
                    <div class="dvalue">{{ track_name }}</div>
                </div>
                <div class="detail-item">
                    <div class="dlabel">Reference Code</div>
                    <div class="dvalue" style="font-family: monospace;">{{ reference_code }}</div>
                </div>
            </div>

            <div class="next-steps-box">
                <h3>📋 What Happens Next?</h3>
                <ul>
                    <li>📄 <strong>Offer Letter</strong> — You'll receive your official offer letter with login credentials</li>
                    <li>🎯 <strong>Cohort Assignment</strong> — You'll be assigned to a cohort with your fellow interns</li>
                    <li>📅 <strong>Orientation</strong> — An orientation session will be scheduled to get you started</li>
                    <li>💪 <strong>Make an Impact</strong> — Dive into projects and start transforming ideas into reality!</li>
                </ul>
            </div>

            {% if note %}
            <div style="background: #f0fdfa; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="color: #065f46; font-style: italic; margin: 0;">{{ note }}</p>
            </div>
            {% endif %}

            <p>If you have any questions before starting, feel free to reach out to us at <a href="mailto:info@afritechbridge.online" style="color: #059669; font-weight: 600;">info@afritechbridge.online</a>.</p>

            <p>Welcome aboard! We can't wait to see the incredible things you'll achieve.<br/><br/>
            <strong style="color: #059669;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 6px;">© 2026 AfriTech Bridge. All rights reserved.</p>
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
        .header {
            background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
            padding: 40px 30px;
            text-align: center;
        }
        .header .icon { font-size: 48px; margin-bottom: 12px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.7); font-size: 14px; }
        .body-content {
            padding: 36px;
            color: #334155;
        }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 12px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .feedback-box {
            background: #fef2f2;
            border: 2px solid #fca5a5;
            border-radius: 12px;
            padding: 20px;
            margin: 20px 0;
        }
        .feedback-box h3 { color: #b91c1c; font-size: 15px; margin-bottom: 8px; }
        .feedback-box p { color: #991b1b; font-size: 14px; margin: 0; }
        .encourage-box {
            background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
            border: 2px solid #3b82f6;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
            text-align: center;
        }
        .encourage-box .big { font-size: 18px; font-weight: 700; color: #1e40af; margin-bottom: 8px; }
        .encourage-box p { color: #1e40af; font-size: 14px; margin: 0; line-height: 1.6; }
        .footer {
            background: #0f172a;
            padding: 28px 36px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="icon">💙</span>
            <h1>Application Status Update</h1>
            <p>{{ track_name }} Internship Program</p>
        </div>
        <div class="body-content">
            <h2>Dear {{ full_name }},</h2>
            <p>Thank you for taking the time to apply for the <strong>{{ track_name }}</strong> internship program. We truly appreciate the effort you put into your application.</p>
            <p>After careful consideration, we regret to inform you that we are unable to move forward with your application at this time.</p>

            <div class="feedback-box">
                <h3>📝 Feedback</h3>
                <p>{{ rejection_reason }}</p>
            </div>

            <div class="encourage-box">
                <div class="big">🌟 This Is Not the End</div>
                <p>Many successful candidates don't make it on their first attempt. We encourage you to continue developing your skills and apply again for future opportunities. Your persistence will pay off!</p>
                <p style="margin-top: 12px;">If you'd like more detailed feedback, we're here to help — just reach out to us at <a href="mailto:info@afritechbridge.online" style="color: #3b82f6; font-weight: 600;">info@afritechbridge.online</a>.</p>
            </div>

            <p>We wish you the very best in your career journey and future endeavors!</p>

            <p>Best regards,<br/>
            <strong style="color: #14b8a6;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 6px;">© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''
    
    def send_offer_letter(self, application, offer, password=None, is_existing_user=False):
        """
        Send an internship offer letter email with credentials and next steps.
        
        Args:
            application: The InternshipApplication
            offer: The InternshipOfferLetter
            password: The clear-text password (None for existing users)
            is_existing_user: Whether this applicant already had an account
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
                password=password or 'Use your existing account password',
                login_url=f'{frontend_url}/auth/login',
                forgot_password_url=f'{frontend_url}/auth/forgot-password',
                cohort_name=application.cohort.cohort_name if application.cohort else 'Your Cohort',
                start_date=application.cohort.start_date.strftime('%d %B %Y') if application.cohort else 'TBD',
                share_url=InternshipOfferService.get_share_url(offer),
                verification_hash=offer.verification_hash,
                is_existing_user=is_existing_user,
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

            {% if is_existing_user %}
            <!-- Existing User - No New Credentials -->
            <div class="creds-box" style="border-color: #f59e0b;">
                <h3>🔑 Your Account</h3>
                <div class="creds-row">
                    <span class="creds-label">Username</span>
                    <span class="creds-value">{{ username }}</span>
                </div>
                <div class="creds-row" style="background: rgba(254,243,199,0.5);">
                    <span class="creds-label">Password</span>
                    <span class="creds-value" style="font-family: 'Segoe UI', sans-serif; letter-spacing: 0; font-size: 13px; color: #92400e;">
                        Use your existing password
                    </span>
                </div>
                <p style="text-align: center; margin-top: 12px;">
                    <a href="{{ forgot_password_url }}" style="display: inline-block; background: #f59e0b; color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700;">
                        🔑 Forgot Password? Reset It
                    </a>
                </p>
                <p class="creds-note" style="color: #92400e;">
                    ℹ️ You already have an account with us. Log in with your existing credentials.
                    If you've forgotten your password, click the button above to reset it.
                </p>
            </div>
            {% else %}
            <!-- New User - Show Credentials -->
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
            {% endif %}

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

    def send_admin_interview_details_updated(self, application, updated_by_name='Admin', interview_date=None, meeting_platform=None, meeting_link=None):
        """
        Send notification to admin when interview details (date, platform, link)
        are changed via the status update route, keeping all admins in the loop.
        """
        try:
            subject = f'📅 Interview Details Updated - {application.full_name} - {application.reference_code}'

            html_content = render_template_string(self._get_admin_interview_details_updated_template(),
                reference_code=application.reference_code,
                full_name=application.full_name,
                email=application.email,
                phone=application.phone,
                track_name=application.track.name if application.track else 'Unknown',
                applicant_type=application.applicant_type.value.replace('_', ' ').title() if application.applicant_type else 'N/A',
                interview_date=interview_date or application.interview_date.strftime('%d %B %Y at %I:%M %p') if application.interview_date else 'To be confirmed',
                meeting_platform=meeting_platform or 'Not specified',
                meeting_link=meeting_link or 'Not provided',
                updated_by_name=updated_by_name,
                updated_at=datetime.utcnow().strftime('%d %B %Y %H:%M'),
                admin_link=f'{current_app.config.get("FRONTEND_URL", "")}/admin/internships/applications/{application.id}',
            )

            success = self.brevo_service.send_email(
                to_emails=[{'email': self.admin_email, 'name': 'AfriTech Bridge Admin'}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Admin interview details alert sent for {application.reference_code}")
            else:
                logger.warning(f"Failed to send admin interview details alert for {application.reference_code}")

            return success
        except Exception as e:
            logger.error(f"Error sending admin interview details alert: {str(e)}")
            return False

    def send_admin_interview_notes_updated(self, application, updated_by_name='Admin'):
        """
        Send notification to admin when interview notes are updated on an application,
        to keep other admins in the loop about applicant interactions.
        """
        try:
            subject = f'📝 Interview Notes Updated - {application.full_name} - {application.reference_code}'

            html_content = render_template_string(self._get_admin_interview_notes_updated_template(),
                reference_code=application.reference_code,
                full_name=application.full_name,
                email=application.email,
                phone=application.phone,
                track_name=application.track.name if application.track else 'Unknown',
                applicant_type=application.applicant_type.value.replace('_', ' ').title() if application.applicant_type else 'N/A',
                interview_notes=application.interview_notes or 'No notes recorded',
                interview_date=application.interview_date.strftime('%d %B %Y at %I:%M %p') if application.interview_date else 'Not scheduled',
                updated_by_name=updated_by_name,
                updated_at=datetime.utcnow().strftime('%d %B %Y %H:%M'),
                admin_link=f'{current_app.config.get("FRONTEND_URL", "")}/admin/internships/applications/{application.id}',
            )

            success = self.brevo_service.send_email(
                to_emails=[{'email': self.admin_email, 'name': 'AfriTech Bridge Admin'}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Admin interview notes alert sent for {application.reference_code}")
            else:
                logger.warning(f"Failed to send admin interview notes alert for {application.reference_code}")

            return success
        except Exception as e:
            logger.error(f"Error sending admin interview notes alert: {str(e)}")
            return False

    def send_custom_email(self, application, subject, message):
        """
        Send a custom email to an applicant from the admin panel.
        """
        try:
            html_content = render_template_string(self._get_custom_email_template(),
                full_name=application.full_name.split()[0] if application.full_name else 'Applicant',
                reference_code=application.reference_code,
                track_name=application.track.name if application.track else 'Internship Program',
                message=message.replace('\n', '<br/>'),
            )

            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Custom email sent to {application.email}: {subject}")
            else:
                logger.warning(f"Failed to send custom email to {application.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending custom email: {str(e)}")
            return False

    def _get_custom_email_template(self):
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
        .header {
            background: #0f172a;
            padding: 24px 32px;
            border-bottom: 3px solid #14b8a6;
        }
        .header h1 { color: #ffffff; font-size: 20px; font-weight: 700; }
        .header .ref {
            color: #14b8a6;
            font-family: monospace;
            font-size: 12px;
            margin-top: 4px;
        }
        .body-content {
            padding: 32px;
            color: #334155;
        }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .message-box {
            background: #f8fafc;
            border-left: 4px solid #14b8a6;
            border-radius: 8px;
            padding: 20px;
            margin: 16px 0;
        }
        .message-box p { color: #0f172a; line-height: 1.8; margin: 0; }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AfriTech Bridge</h1>
            <div class="ref">Ref: {{ reference_code }}</div>
        </div>
        <div class="body-content">
            <p>Dear {{ full_name }},</p>
            <div class="message-box">
                <p>{{ message }}</p>
            </div>
            <p>If you have any questions, please don't hesitate to reach out to us at <a href="mailto:info@afritechbridge.online" style="color: #14b8a6;">info@afritechbridge.online</a>.</p>
            <p>Best regards,<br/><strong style="color: #14b8a6;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''

    def send_interview_scheduled(self, application, note=None):
        """
        Send interview scheduled email to applicant with meeting link and details.
        """
        try:
            meeting_platform_display = {
                'zoom': 'Zoom',
                'google_meet': 'Google Meet',
                'teams': 'Microsoft Teams',
                'whatsapp': 'WhatsApp Video',
                'other': 'Video Call',
            }
            platform_display = meeting_platform_display.get(
                application.interview_meeting_platform, 'Video Call'
            )

            subject = '📅 Interview Scheduled - AfriTech Bridge Internship'

            template_context = {
                'full_name': application.full_name.split()[0] if application.full_name else 'Applicant',
                'track_name': application.track.name if application.track else 'Unknown',
                'reference_code': application.reference_code,
                'interview_date': application.interview_date.strftime('%d %B %Y at %I:%M %p') if application.interview_date else 'To be confirmed',
                'meeting_link': application.interview_meeting_link or '',
                'meeting_platform': platform_display,
                'note': note or 'We look forward to speaking with you!',
            }

            html_content = render_template_string(self._get_interview_scheduled_enhanced_template(), **template_context)

            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Interview scheduled email sent to {application.email} with meeting link")
            else:
                logger.warning(f"Failed to send interview scheduled email to {application.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending interview scheduled email: {str(e)}")
            return False

    def send_task_assigned(self, intern, task_title, task_description=None, due_date=None, priority='medium', assigned_by_name='Instructor', cohort_name=None):
        """
        Send email notification when a task is assigned to an intern.
        """
        try:
            subject = f'📋 New Task Assigned: {task_title}'

            due_date_str = due_date.strftime('%d %B %Y at %I:%M %p') if due_date else 'No deadline'
            priority_display = priority.upper() if priority else 'MEDIUM'
            priority_color = {
                'low': '#22c55e',
                'medium': '#f59e0b',
                'high': '#ef4444',
                'urgent': '#dc2626',
            }.get(priority, '#f59e0b')

            template_context = {
                'full_name': intern.full_name.split()[0] if intern.full_name else 'Intern',
                'task_title': task_title,
                'task_description': task_description or 'No additional details provided.',
                'due_date': due_date_str,
                'priority': priority_display,
                'priority_color': priority_color,
                'assigned_by_name': assigned_by_name,
                'cohort_name': cohort_name or 'Your Cohort',
            }

            html_content = render_template_string(self._get_task_assigned_template(), **template_context)

            success = self.brevo_service.send_email(
                to_emails=[{'email': intern.email, 'name': intern.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Task assignment email sent to {intern.email}: {task_title}")
            else:
                logger.warning(f"Failed to send task assignment email to {intern.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending task assignment email: {str(e)}")
            return False

    def send_task_graded(self, intern, task_title, status, score=None, feedback=None, graded_by_name='Instructor'):
        """
        Send email notification when an intern's task submission is graded.
        """
        try:
            is_approved = status == 'approved'
            subject = f"{'✅' if is_approved else '📝'} Task {status.title()}: {task_title}"

            template_context = {
                'full_name': intern.full_name.split()[0] if intern.full_name else 'Intern',
                'task_title': task_title,
                'status': status.title(),
                'is_approved': is_approved,
                'score': score,
                'feedback': feedback or 'No feedback provided.',
                'graded_by_name': graded_by_name,
            }

            html_content = render_template_string(self._get_task_graded_template(), **template_context)

            success = self.brevo_service.send_email(
                to_emails=[{'email': intern.email, 'name': intern.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Task grading email sent to {intern.email}: {task_title} - {status}")
            else:
                logger.warning(f"Failed to send task grading email to {intern.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending task grading email: {str(e)}")
            return False

    def send_cohort_assigned(self, application, cohort_name, assigned_by_name='Admin'):
        """
        Send email notification when an applicant is assigned to a cohort.
        """
        try:
            subject = f'🎯 Cohort Assigned - {cohort_name}'

            start_date = application.cohort.start_date.strftime('%d %B %Y') if application.cohort and application.cohort.start_date else 'TBD'

            template_context = {
                'full_name': application.full_name.split()[0] if application.full_name else 'Applicant',
                'track_name': application.track.name if application.track else 'Program',
                'cohort_name': cohort_name,
                'start_date': start_date,
                'assigned_by_name': assigned_by_name,
                'reference_code': application.reference_code,
            }

            html_content = render_template_string(self._get_cohort_assigned_template(), **template_context)

            success = self.brevo_service.send_email(
                to_emails=[{'email': application.email, 'name': application.full_name}],
                subject=subject,
                html_content=html_content,
                sender_name=self.sender_name,
            )

            if success:
                logger.info(f"Cohort assignment email sent to {application.email}: {cohort_name}")
            else:
                logger.warning(f"Failed to send cohort assignment email to {application.email}")

            return success
        except Exception as e:
            logger.error(f"Error sending cohort assignment email: {str(e)}")
            return False

    # ============= ENHANCED EMAIL TEMPLATES =============

    def _get_interview_scheduled_enhanced_template(self):
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
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #14b8a6 100%);
            padding: 40px 30px 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 26px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p {
            color: rgba(255,255,255,0.85);
            font-size: 15px;
        }
        .body-content {
            padding: 36px;
            color: #334155;
        }
        .body-content h2 {
            color: #0f172a;
            font-size: 18px;
            margin-bottom: 14px;
        }
        .body-content p {
            line-height: 1.7;
            margin-bottom: 16px;
        }
        .interview-card {
            background: linear-gradient(135deg, #eff6ff 0%, #f0fdfa 100%);
            border: 2px solid #14b8a6;
            border-radius: 12px;
            padding: 24px;
            margin: 20px 0;
        }
        .interview-card h3 {
            color: #0f172a;
            font-size: 15px;
            margin-bottom: 16px;
            text-align: center;
        }
        .detail-row {
            display: flex;
            align-items: center;
            padding: 10px 14px;
            background: rgba(255,255,255,0.7);
            border-radius: 8px;
            margin-bottom: 8px;
        }
        .detail-row .icon { font-size: 18px; margin-right: 12px; }
        .detail-row .label {
            font-weight: 600;
            color: #1e3a8a;
            width: 110px;
            font-size: 13px;
        }
        .detail-row .value {
            color: #0f172a;
            font-weight: 500;
            font-size: 14px;
            flex: 1;
        }
        .meeting-link-btn {
            display: block;
            text-align: center;
            padding: 16px 24px;
            background: linear-gradient(135deg, #14b8a6 0%, #0d9488 100%);
            color: #ffffff !important;
            text-decoration: none;
            border-radius: 10px;
            font-size: 16px;
            font-weight: 700;
            margin: 20px 0;
            box-shadow: 0 4px 15px rgba(20,184,166,0.3);
        }
        .meeting-link-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(20,184,166,0.4);
        }
        .tips-box {
            background: #fffbeb;
            border: 1px solid #fde68a;
            border-radius: 8px;
            padding: 16px 20px;
            margin: 16px 0;
        }
        .tips-box h4 {
            color: #92400e;
            font-size: 14px;
            margin-bottom: 8px;
        }
        .tips-box ul {
            padding-left: 20px;
            color: #78350f;
            font-size: 13px;
            line-height: 1.8;
        }
        .footer {
            background: #0f172a;
            padding: 28px 36px;
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
            margin-bottom: 6px;
        }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
            .detail-row { flex-direction: column; align-items: flex-start; gap: 4px; }
            .detail-row .label { width: auto; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📅 Interview Scheduled</h1>
            <p>Your {{ track_name }} internship interview is confirmed</p>
        </div>

        <div class="body-content">
            <h2>Dear {{ full_name }},</h2>

            <p>
                Great news! We've reviewed your application and we're excited to move forward.
                Your interview for the <strong>{{ track_name }}</strong> internship has been scheduled.
            </p>

            <div class="interview-card">
                <h3>🎯 Interview Details</h3>
                <div class="detail-row">
                    <span class="icon">📅</span>
                    <span class="label">Date & Time</span>
                    <span class="value">{{ interview_date }}</span>
                </div>
                <div class="detail-row">
                    <span class="icon">💻</span>
                    <span class="label">Platform</span>
                    <span class="value">{{ meeting_platform }}</span>
                </div>
                <div class="detail-row">
                    <span class="icon">🆔</span>
                    <span class="label">Reference</span>
                    <span class="value">{{ reference_code }}</span>
                </div>
                <div class="detail-row">
                    <span class="icon">🎓</span>
                    <span class="label">Track</span>
                    <span class="value">{{ track_name }}</span>
                </div>
            </div>

            {% if meeting_link %}
            <a href="{{ meeting_link }}" class="meeting-link-btn" target="_blank">
                🚀 Join Meeting on {{ meeting_platform }}
            </a>
            {% endif %}

            <div class="tips-box">
                <h4>📋 Preparation Tips</h4>
                <ul>
                    <li>Review your application and motivation letter</li>
                    <li>Prepare questions about the internship and AfriTech Bridge</li>
                    <li>Test your internet connection, camera, and microphone</li>
                    <li>Find a quiet, well-lit space for the interview</li>
                    <li>Join 5 minutes early to ensure everything works</li>
                </ul>
            </div>

            {% if note %}
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="color: #475569; font-style: italic; margin: 0;">{{ note }}</p>
            </div>
            {% endif %}

            <p>
                If you need to reschedule or have any questions, please reply to this email
                or contact us at <a href="mailto:info@afritechbridge.online" style="color: #14b8a6;">info@afritechbridge.online</a>.
            </p>

            <p>
                Looking forward to meeting you!<br/>
                <strong style="color: #14b8a6;">AfriTech Bridge Team</strong>
            </p>
        </div>

        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
            <p style="margin-top: 6px;">© 2026 AfriTech Bridge. All rights reserved.</p>
        </div>
    </div>
</body>
</html>
'''

    def _get_task_assigned_template(self):
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
        .header {
            background: linear-gradient(135deg, #1e3a8a 0%, #7c3aed 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
        }
        .header p {
            color: rgba(255,255,255,0.85);
            font-size: 14px;
            margin-top: 6px;
        }
        .body-content {
            padding: 32px;
            color: #334155;
        }
        .body-content h2 {
            color: #0f172a;
            font-size: 18px;
            margin-bottom: 12px;
        }
        .body-content p {
            line-height: 1.7;
            margin-bottom: 14px;
        }
        .task-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
        }
        .task-title {
            font-size: 18px;
            font-weight: 700;
            color: #0f172a;
            margin-bottom: 10px;
        }
        .task-desc {
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
        }
        .meta-row {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-top: 12px;
            padding: 8px 12px;
            background: white;
            border-radius: 8px;
        }
        .priority-badge {
            display: inline-block;
            padding: 4px 12px;
            border-radius: 12px;
            font-size: 11px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
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
        }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>📋 New Task Assigned</h1>
            <p>{{ cohort_name }}</p>
        </div>

        <div class="body-content">
            <h2>Hi {{ full_name }},</h2>
            <p>A new task has been assigned to you by <strong>{{ assigned_by_name }}</strong>.</p>

            <div class="task-card">
                <div class="task-title">{{ task_title }}</div>
                <div class="task-desc">{{ task_description }}</div>

                <div class="meta-row">
                    <span>📅 Due:</span>
                    <strong>{{ due_date }}</strong>
                    <span style="margin-left: auto;">
                        <span class="priority-badge" style="background: {{ priority_color }}15; color: {{ priority_color }}; border: 1px solid {{ priority_color }}40;">
                            {{ priority }}
                        </span>
                    </span>
                </div>
            </div>

            <p>
                Log in to your account to view task details, submit your work, and track your progress.
            </p>

            <p>
                If you have questions about this task, please reach out to your instructor or team.
            </p>

            <p>
                Best regards,<br/>
                <strong style="color: #14b8a6;">AfriTech Bridge Team</strong>
            </p>
        </div>

        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''

    def _get_task_graded_template(self):
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
        .header {
            background: linear-gradient(135deg, #0f172a 0%, {% if is_approved %}#059669{% else %}#dc2626{% endif %} 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
        }
        .header p {
            color: rgba(255,255,255,0.85);
            font-size: 14px;
            margin-top: 6px;
        }
        .body-content {
            padding: 32px;
            color: #334155;
        }
        .body-content h2 {
            color: #0f172a;
            font-size: 18px;
            margin-bottom: 12px;
        }
        .body-content p {
            line-height: 1.7;
            margin-bottom: 14px;
        }
        .result-card {
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
            border: 2px solid {% if is_approved %}#059669{% else %}#dc2626{% endif %};
            background: {% if is_approved %}#f0fdf4{% else %}#fef2f2{% endif %};
        }
        .result-card .status {
            font-size: 16px;
            font-weight: 700;
            color: {% if is_approved %}#059669{% else %}#dc2626{% endif %};
            margin-bottom: 8px;
        }
        .result-card .score {
            font-size: 36px;
            font-weight: 800;
            text-align: center;
            color: {% if is_approved %}#059669{% else %}#dc2626{% endif %};
            margin: 12px 0;
        }
        .result-card .feedback {
            color: #475569;
            font-size: 14px;
            line-height: 1.6;
            background: white;
            padding: 12px;
            border-radius: 8px;
            margin-top: 8px;
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
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
        }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>{% if is_approved %}✅ Task Approved{% else %}📝 Task Reviewed{% endif %}</h1>
            <p>{{ task_title }}</p>
        </div>

        <div class="body-content">
            <h2>Hi {{ full_name }},</h2>
            <p>Your submission for <strong>{{ task_title }}</strong> has been reviewed by <strong>{{ graded_by_name }}</strong>.</p>

            <div class="result-card">
                <div class="status">
                    {% if is_approved %}✅ Approved{% else %}❌ Needs Revision{% endif %}
                </div>
                {% if score is not none %}
                <div class="score">{{ score }}%</div>
                {% endif %}
                <div class="feedback">
                    <strong>Feedback:</strong><br/>
                    {{ feedback }}
                </div>
            </div>

            <p>
                Log in to your account to view the full details and continue working on your tasks.
            </p>

            <p>
                Keep up the great work!<br/>
                <strong style="color: #14b8a6;">AfriTech Bridge Team</strong>
            </p>
        </div>

        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''

    def _get_cohort_assigned_template(self):
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
        .header {
            background: linear-gradient(135deg, #059669 0%, #14b8a6 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
        }
        .header p {
            color: rgba(255,255,255,0.85);
            font-size: 14px;
            margin-top: 6px;
        }
        .body-content {
            padding: 32px;
            color: #334155;
        }
        .body-content h2 {
            color: #0f172a;
            font-size: 18px;
            margin-bottom: 12px;
        }
        .body-content p {
            line-height: 1.7;
            margin-bottom: 14px;
        }
        .cohort-card {
            background: #f0fdfa;
            border: 2px solid #14b8a6;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
            text-align: center;
        }
        .cohort-card .name {
            font-size: 20px;
            font-weight: 700;
            color: #0f172a;
        }
        .cohort-card .detail {
            color: #475569;
            font-size: 14px;
            margin-top: 6px;
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
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
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🎯 Cohort Assigned</h1>
            <p>{{ track_name }} Internship Program</p>
        </div>

        <div class="body-content">
            <h2>Dear {{ full_name }},</h2>

            <p>
                You have been assigned to a cohort for the <strong>{{ track_name }}</strong> internship program!
            </p>

            <div class="cohort-card">
                <div class="name">{{ cohort_name }}</div>
                <div class="detail">📅 Start Date: {{ start_date }}</div>
                <div class="detail">🆔 Ref: {{ reference_code }}</div>
            </div>

            <p>
                You will receive further instructions about the program schedule, orientation,
                and next steps soon. The instructor will be reaching out to guide you through
                your internship journey.
            </p>

            <p>
                <strong>Next Steps:</strong>
            </p>
            <ul style="padding-left: 20px; line-height: 2; color: #475569;">
                <li>📋 Complete your profile and review program materials</li>
                <li>💬 Connect with your cohort members and instructor</li>
                <li>🎯 Start working on assigned tasks and projects</li>
            </ul>

            <p>
                Welcome to the team! We're excited to have you on board.
            </p>

            <p>
                Best regards,<br/>
                <strong style="color: #14b8a6;">AfriTech Bridge Team</strong>
            </p>
        </div>

        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
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
        .header {
            background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
            padding: 36px 30px;
            text-align: center;
        }
        .header .icon { font-size: 44px; margin-bottom: 10px; display: block; }
        .header h1 {
            color: #ffffff;
            font-size: 24px;
            font-weight: 800;
            margin-bottom: 6px;
        }
        .header p { color: rgba(255,255,255,0.85); font-size: 14px; }
        .body-content {
            padding: 32px;
            color: #334155;
        }
        .body-content h2 { color: #0f172a; font-size: 18px; margin-bottom: 12px; }
        .body-content p { line-height: 1.7; margin-bottom: 16px; }
        .status-card {
            background: #eff6ff;
            border: 2px solid #3b82f6;
            border-radius: 12px;
            padding: 20px;
            margin: 16px 0;
            text-align: center;
        }
        .status-card .status-icon { font-size: 36px; margin-bottom: 8px; display: block; }
        .status-card .status-text { font-size: 16px; font-weight: 700; color: #1d4ed8; }
        .status-card .status-info { color: #64748b; font-size: 13px; margin-top: 8px; }
        .reference-note {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 14px;
            margin: 16px 0;
            text-align: center;
        }
        .reference-note p { color: #64748b; font-size: 13px; margin: 0; }
        .reference-note .code {
            font-family: monospace;
            font-weight: 700;
            color: #2563eb;
            font-size: 15px;
        }
        .footer {
            background: #0f172a;
            padding: 24px 32px;
            text-align: center;
        }
        .footer p { color: #94a3b8; font-size: 12px; line-height: 1.6; }
        .footer .brand { color: #14b8a6; font-weight: 700; font-size: 14px; margin-bottom: 6px; }
        @media (max-width: 480px) {
            .header { padding: 28px 20px; }
            .body-content { padding: 24px; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <span class="icon">🔍</span>
            <h1>Your Application is Under Review</h1>
            <p>{{ track_name }} Internship Program</p>
        </div>
        <div class="body-content">
            <h2>Hi {{ full_name }},</h2>
            <p>Great news! We've started reviewing your application for the <strong>{{ track_name }}</strong> internship program. Our team is carefully evaluating your profile and will notify you as soon as a decision has been made.</p>

            <div class="status-card">
                <span class="status-icon">⏳</span>
                <div class="status-text">Under Review</div>
                <div class="status-info">The review process typically takes <strong>1-2 weeks</strong>. We appreciate your patience!</div>
            </div>

            <div class="reference-note">
                <p>Your Reference Code: <span class="code">{{ reference_code }}</span></p>
                <p style="margin-top: 6px;">Use this code to check your status anytime on our portal.</p>
            </div>

            {% if note %}
            <div style="background: #f8fafc; padding: 16px; border-radius: 8px; margin: 16px 0;">
                <p style="color: #475569; font-style: italic; margin: 0;">{{ note }}</p>
            </div>
            {% endif %}

            <p>Keep an eye on your inbox — we'll be in touch soon! 📬</p>

            <p>Best regards,<br/>
            <strong style="color: #2563eb;">AfriTech Bridge Team</strong></p>
        </div>
        <div class="footer">
            <p class="brand">✦ AFRITECH BRIDGE ✦</p>
            <p>Empowering the next generation of African tech leaders</p>
        </div>
    </div>
</body>
</html>
'''
