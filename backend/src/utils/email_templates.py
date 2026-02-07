"""
✨ Modern & Creative Email Templates for Afritech Bridge LMS
Beautiful, responsive, and engaging email designs
"""
from datetime import datetime

def get_email_header():
    """Modern email header with gradient and branding"""
    return """
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <meta http-equiv="X-UA-Compatible" content="IE=edge">
        <style type="text/css">
            /* Mobile Responsive Styles */
            @media only screen and (max-width: 600px) {
                .email-container {
                    width: 100% !important;
                    max-width: 100% !important;
                    margin: 0 !important;
                    border-radius: 0 !important;
                }
                .email-header {
                    padding: 30px 20px !important;
                }
                .email-content {
                    padding: 30px 20px !important;
                }
                .email-footer {
                    padding: 30px 20px !important;
                }
                h1 {
                    font-size: 24px !important;
                }
                h2 {
                    font-size: 20px !important;
                }
                h3 {
                    font-size: 18px !important;
                }
                .mobile-hide {
                    display: none !important;
                }
                .mobile-full-width {
                    width: 100% !important;
                }
                .mobile-padding {
                    padding: 15px !important;
                }
                .mobile-text-center {
                    text-align: center !important;
                }
                /* Table responsiveness */
                table[class="responsive-table"] {
                    width: 100% !important;
                }
                td[class="responsive-cell"] {
                    display: block !important;
                    width: 100% !important;
                    text-align: center !important;
                    padding: 10px 0 !important;
                }
                /* Font size adjustments */
                .large-text {
                    font-size: 18px !important;
                }
                .medium-text {
                    font-size: 16px !important;
                }
                .small-text {
                    font-size: 14px !important;
                }
                /* Icon sizes */
                .icon-large {
                    font-size: 50px !important;
                }
                .icon-medium {
                    font-size: 35px !important;
                }
                /* Button adjustments */
                .mobile-button {
                    width: 100% !important;
                    display: block !important;
                    padding: 15px 20px !important;
                }
            }
            /* Ensure proper rendering */
            body, table, td, a {
                -webkit-text-size-adjust: 100%;
                -ms-text-size-adjust: 100%;
            }
            table, td {
                mso-table-lspace: 0pt;
                mso-table-rspace: 0pt;
            }
            img {
                -ms-interpolation-mode: bicubic;
                border: 0;
                height: auto;
                line-height: 100%;
                outline: none;
                text-decoration: none;
            }
        </style>
    </head>
    <body style="margin: 0; padding: 0; background-color: #2c3e50; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale; width: 100% !important; height: 100% !important;">
        <!-- Full-width table wrapper -->
        <table role="presentation" border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #2c3e50;">
            <tr>
                <td align="center" style="padding: 20px 10px;">
                    <!-- Main email container -->
                    <div class="email-container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #34495e; border-radius: 20px; overflow: hidden; box-shadow: 0 20px 60px rgba(0,0,0,0.5);">
                        <!-- Header -->
                        <div class="email-header" style="background-color: #2c3e50; padding: 40px 30px; text-align: center; position: relative;">
                            <div style="background: rgba(255,255,255,0.1); border-radius: 50%; width: 80px; height: 80px; margin: 0 auto 20px; border: 3px solid rgba(255,255,255,0.3);">
                                <table width="80" height="80" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="text-align: center; vertical-align: middle; font-size: 40px;">🎓</td>
                                    </tr>
                                </table>
                            </div>
                            <h1 style="color: white; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 0 2px 10px rgba(0,0,0,0.2);">
                                Afritech Bridge
                            </h1>
                            <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0 0; font-size: 15px; font-weight: 500; letter-spacing: 2px; text-transform: uppercase;">
                                Learning Management System
                            </p>
                        </div>
    """

def get_email_footer():
    """Modern email footer with social links"""
    year = datetime.now().year
    return f"""
            <!-- Footer -->
            <div class="email-footer" style="background-color: #2c3e50; color: #e5e7eb; padding: 40px 30px; text-align: center;">
                <div style="margin-bottom: 25px;">
                    <span class="icon-medium" style="font-size: 32px; margin: 0 15px;">🎓</span>
                </div>
                
                <p style="color: #ffffff; margin: 0 0 20px 0; font-size: 16px; font-weight: 600;">
                    Afritech Bridge LMS
                </p>
                
                <div style="margin: 25px 0; padding: 20px 0; border-top: 1px solid rgba(255,255,255,0.1); border-bottom: 1px solid rgba(255,255,255,0.1);">
                    <a href="mailto:Afritechh.bridge@yahoo.com" class="mobile-full-width" style="display: inline-block; background-color: #e5e7eb; background: rgba(102, 126, 234, 0.2); color: #60a5fa; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin: 5px; font-size: 13px; font-weight: 500;">
                        📧 Support
                    </a>
                    <a href="https://wa.me/250780784924" class="mobile-full-width" style="display: inline-block; background-color: #e5e7eb; background: rgba(37, 211, 102, 0.2); color: #25d366; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin: 5px; font-size: 13px; font-weight: 500;">
                        💬 WhatsApp Help
                    </a>
                    <a href="#" class="mobile-full-width" style="display: inline-block; background-color: #e5e7eb; background: rgba(102, 126, 234, 0.2); color: #60a5fa; padding: 10px 20px; text-decoration: none; border-radius: 8px; margin: 5px; font-size: 13px; font-weight: 500;">
                        🔒 Privacy
                    </a>
                </div>
                
                <p class="small-text" style="color: #d1d5db; margin: 15px 0 5px 0; font-size: 12px; line-height: 1.6;">
                    © {year} Afritech Bridge LMS. All rights reserved.<br>
                    Building Africa's Digital Future Through Education
                </p>
                
                <p class="small-text" style="color: #9ca3af; margin: 15px 0 0 0; font-size: 11px; font-style: italic;">
                    You're receiving this email because you're part of our learning community.<br>
                    This is an automated message - please don't reply directly.
                </p>
            </div>
        </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """

def application_received_email(application, course_title):
    """✨ Creative email template for application confirmation"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Success Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.3);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">✅</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #059669; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Application Received!
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        We're excited to review your application
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Thank you for applying to <strong style="color: #667eea; font-size: 16px;">{course_title}</strong>! 🎉 We've successfully received your application and are thrilled about your interest in joining our learning community.
                </p>
                
                <!-- Application Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">📋</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Application Summary</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600; width: 45%;">
                                <span style="margin-right: 8px;">🆔</span> Application ID
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 700;">
                                #{application.id}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📚</span> Course
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                                {course_title}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📧</span> Email
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px;">
                                {application.email}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📅</span> Submitted
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px;">
                                {application.created_at.strftime('%b %d, %Y • %I:%M %p')}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">⚡</span> Status
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0;">
                                <span style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; box-shadow: 0 2px 8px rgba(251, 191, 36, 0.3);">
                                    🔍 Under Review
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Timeline -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td>
                                <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                                    <tr>
                                        <td style="vertical-align: middle; padding-right: 12px;">
                                            <span style="font-size: 28px;">⏱️</span>
                                        </td>
                                        <td style="vertical-align: middle;">
                                            <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">What Happens Next?</h3>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                        
                        <!-- Timeline Steps -->
                        <tr>
                            <td style="padding-top: 10px;">
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                                    <tr>
                                        <td width="50" style="vertical-align: top; padding-right: 15px;">
                                            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);">
                                                <span style="color: white; font-weight: 700; font-size: 14px;">1</span>
                                            </div>
                                        </td>
                                        <td style="vertical-align: top;">
                                            <div style="background-color: #34495e; padding: 15px 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                                <p style="margin: 0; color: #60a5fa; font-size: 15px; font-weight: 600;">Review Process</p>
                                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 14px; line-height: 1.6;">Our team will carefully review your application within 2-3 business days</p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                                    <tr>
                                        <td width="50" style="vertical-align: top; padding-right: 15px;">
                                            <div style="width: 36px; height: 36px; background-color: #667eea; border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);">
                                                <span style="color: white; font-weight: 700; font-size: 14px;">2</span>
                                            </div>
                                        </td>
                                        <td style="vertical-align: top;">
                                            <div style="background-color: #34495e; padding: 15px 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                                <p style="margin: 0; color: #60a5fa; font-size: 15px; font-weight: 600;">Decision Notification</p>
                                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 14px; line-height: 1.6;">You'll receive an email with our decision and next steps</p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                                    <tr>
                                        <td width="50" style="vertical-align: top; padding-right: 15px;">
                                            <div style="width: 36px; height: 36px; background-color: #667eea; border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(102, 126, 234, 0.3);">
                                                <span style="color: white; font-weight: 700; font-size: 14px;">3</span>
                                            </div>
                                        </td>
                                        <td style="vertical-align: top;">
                                            <div style="background-color: #34495e; padding: 15px 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                                <p style="margin: 0; color: #60a5fa; font-size: 15px; font-weight: 600;">Account Setup</p>
                                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 14px; line-height: 1.6;">If approved, you'll get instant access with login credentials</p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                
                                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td width="50" style="vertical-align: top; padding-right: 15px;">
                                            <div style="width: 36px; height: 36px; background-color: #10b981; border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                                                <span style="color: white; font-weight: 700; font-size: 14px;">4</span>
                                            </div>
                                        </td>
                                        <td style="vertical-align: top;">
                                            <div style="background-color: #34495e; padding: 15px 20px; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.3);">
                                                <p style="margin: 0; color: #10b981; font-size: 15px; font-weight: 600;">Start Learning! 🚀</p>
                                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 14px; line-height: 1.6;">Begin your educational journey immediately after approval</p>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Need Help Section -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 25px; margin: 30px 0; border: 2px dashed #f59e0b;">
                    <div style="text-align: center;">
                        <span class="icon-medium" style="font-size: 40px; display: block; margin-bottom: 15px;">💬</span>
                        <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                            Have Questions?
                        </h3>
                        <p style="color: #bdc3c7; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
                            Our support team is here to help you every step of the way!
                        </p>
                        <a href="mailto:afritech.bridge@yahoo.com" style="display: inline-block; background-color: #f59e0b; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); border: 2px solid #f59e0b;">
                            📧 Contact Support
                        </a>
                    </div>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 35px 0 10px 0; text-align: center;">
                    We're excited about your interest and look forward to<br>having you in our learning community! 🌟
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 20px 0 0 0; text-align: center;">
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong><br>
                    <span style="font-size: 13px; color: #bdc3c7;">Empowering Africa Through Digital Education</span>
                </p>
            </div>
            
    {get_email_footer()}
    """

def application_approved_email(application, course, username, temp_password, custom_message="", is_new_account=True, password_reset_link=None):
    """🎉 Creative celebration email template for application approval"""
    
    # Determine account type message and credentials display
    account_type_msg = ""
    credentials_section = ""
    
    if not is_new_account and not temp_password and password_reset_link:
        # Existing user - show reset link instead of password
        account_type_msg = f'''<div style="background-color: #2c3e50; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
            <p style="color: #e5e7eb; margin: 0; font-size: 14px; line-height: 1.6;">
                <strong style="color: #ffffff;">👋 Welcome Back!</strong> You already have an account with us. 
                If you don't remember your password, <strong style="color: #60a5fa;">you can set a new one using the link below</strong>.
            </p>
        </div>'''
        
        credentials_section = f'''
        <div style="background-color: #2c3e50; border: 2px solid #3b82f6; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="icon-medium" style="font-size: 40px; display: block; margin-bottom: 10px;">🔐</span>
                <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                    Your Account Information
                </h2>
                <p style="color: #e5e7eb; margin: 8px 0 0 0; font-size: 14px;">
                    Use your existing credentials to log in
                </p>
            </div>
            
            <div style="background-color: #2c3e50; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <table class="responsive-table" style="width: 100%; color: #e5e7eb;">
                    <tr>
                        <td style="padding: 12px 0; font-weight: 600; color: #e5e7eb;"><span style="margin-right: 8px;">👤</span> Username:</td>
                        <td style="padding: 12px 0; font-family: 'Courier New', monospace; font-weight: 700; color: #60a5fa;">{username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; font-weight: 600; color: #e5e7eb;"><span style="margin-right: 8px;">🌐</span> Login URL:</td>
                        <td style="padding: 12px 0;">
                            <a href="https://study.Afritechhbridge.online/auth/login" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
                                study.Afritechhbridge.online
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #2c3e50; border: 2px solid #22c55e; border-radius: 8px; padding: 20px; margin-top: 20px;">
                <p style="color: #e5e7eb; font-size: 15px; margin: 0 0 15px 0; text-align: center;">
                    <strong style="color: #ffffff;">🔑 Don't Remember Your Password?</strong><br>
                    No problem! Set a new password using the button below:
                </p>
                <div style="text-align: center;">
                    <a href="{password_reset_link}" style="display: inline-block; background-color: #22c55e; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px;">
                        🔐 Set New Password
                    </a>
                </div>
                <p style="color: #bdc3c7; font-size: 12px; margin: 15px 0 0 0; text-align: center;">
                    This link will expire in 3 days for security reasons.
                </p>
            </div>
        </div>'''
    
    elif temp_password:
        # New account or existing with temp password
        if not is_new_account:
            account_type_msg = f'''<div style="background-color: #2c3e50; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #e5e7eb; margin: 0; font-size: 14px; line-height: 1.6;">
                    <strong style="color: #ffffff;">🔄 Account Update:</strong> We've generated a new temporary password for your existing account. 
                    Please use the credentials below to log in and <strong style="color: #60a5fa;">change your password</strong> immediately for security.
                </p>
            </div>'''
        else:
            account_type_msg = f'''<div style="background-color: #2c3e50; border-left: 4px solid #22c55e; border-radius: 8px; padding: 15px; margin: 20px 0;">
                <p style="color: #e5e7eb; margin: 0; font-size: 14px; line-height: 1.6;">
                    <strong style="color: #ffffff;">✨ New Account Created:</strong> We've created a new student account for you. 
                    Use the credentials below to access your dashboard and start your learning journey!
                </p>
            </div>'''
        
        credentials_section = f'''
        <div style="background-color: #2c3e50; border: 2px solid #3b82f6; border-radius: 8px; padding: 25px; margin: 25px 0;">
            <div style="text-align: center; margin-bottom: 20px;">
                <span class="icon-medium" style="font-size: 40px; display: block; margin-bottom: 10px;">🔐</span>
                <h2 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                    Your Login Credentials
                </h2>
                <p style="color: #e5e7eb; margin: 8px 0 0 0; font-size: 14px;">
                    Save these details securely!
                </p>
            </div>
            
            <div style="background-color: #2c3e50; border-radius: 8px; padding: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                <table class="responsive-table" style="width: 100%; color: #e5e7eb;">
                    <tr>
                        <td style="padding: 12px 0; font-weight: 600; color: #e5e7eb;"><span style="margin-right: 8px;">👤</span> Username:</td>
                        <td style="padding: 12px 0; font-family: 'Courier New', monospace; font-weight: 700; color: #60a5fa;">{username}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; font-weight: 600; color: #e5e7eb;"><span style="margin-right: 8px;">🔑</span> Password:</td>
                        <td style="padding: 12px 0; font-family: 'Courier New', monospace; font-weight: 700; color: #60a5fa;">{temp_password}</td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; font-weight: 600; color: #e5e7eb;"><span style="margin-right: 8px;">🌐</span> Login URL:</td>
                        <td style="padding: 12px 0;">
                            <a href="https://study.Afritechhbridge.online/auth/login" style="color: #60a5fa; text-decoration: none; font-weight: 600;">
                                study.Afritechhbridge.online
                            </a>
                        </td>
                    </tr>
                </table>
            </div>
            
            <div style="background-color: #2c3e50; border: 1px solid #ef4444; border-radius: 8px; padding: 15px; margin-top: 20px;">
                <p style="color: #f87171; font-size: 14px; margin: 0; text-align: center;">
                    <strong style="color: #ffffff;">⚠️ Security Reminder:</strong> Please change your password after your first login.
                </p>
            </div>
        </div>'''
    
    return f"""
    {get_email_header()}
    <div style="background-color: #2c3e50; padding: 30px;">
        <!-- Celebration Header -->
        <div style="text-align: center; margin-bottom: 30px;">
            <div class="icon-large" style="font-size: 60px; margin-bottom: 15px;">🎉</div>
            <h1 style="color: #059669; margin: 0; font-size: 28px; font-weight: 700;">
                Congratulations!
            </h1>
            <p style="color: #059669; margin: 10px 0 0 0; font-size: 16px; font-weight: 600;">
                Your Application Has Been Approved!
            </p>
        </div>
        
        <!-- Greeting -->
        <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px;">
            Dear <strong style="color: #ffffff;">{application.full_name}</strong>,
        </p>
        
        <p style="color: #e5e7eb; line-height: 1.6; font-size: 16px;">
            We're thrilled to inform you that your application for <strong>{course.title}</strong> has been <strong style="color: #059669;">approved</strong>! Welcome to the Afritech Bridge learning community! 🎓✨
        </p>
        
        <div style="background-color: #2c3e50; border: 3px solid #10b981; border-radius: 8px; padding: 25px; margin: 25px 0; color: white; text-align: center;">
            <h2 style="margin: 0 0 10px 0; font-size: 24px; color: white;">Welcome to {course.title}!</h2>
            <p style="margin: 0; font-size: 16px; color: #e5e7eb;">
                Your learning journey starts now. We can't wait to see what you'll achieve! 🚀
            </p>
        </div>
                
                {account_type_msg}
        
        {f'''<div style="background-color: #2c3e50; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px;">💌 Personal Message from Your Instructor</h3>
            <p style="color: #e5e7eb; margin: 0; line-height: 1.6; font-style: italic; background-color: #2c3e50; padding: 15px; border-radius: 6px;">
                "{custom_message}"
            </p>
        </div>''' if custom_message else ''}
                
                {credentials_section}
        
        <!-- Community Section -->
        <div style="background-color: #2c3e50; border: 3px solid #25D366; border-radius: 8px; padding: 25px; margin: 25px 0; color: white;">
            <div style="text-align: center; margin-bottom: 15px;">
                <span style="font-size: 40px; display: block; margin-bottom: 10px;">📱</span>
                <h2 style="margin: 0; color: white; font-size: 20px; font-weight: 700;">
                    Join Our Learning Community!
                </h2>
                <p style="color: #e5e7eb; margin: 8px 0 0 0; font-size: 14px;">
                    Connect with fellow students and get course updates
                </p>
            </div>
            
            <div style="text-align: center; margin-top: 20px;">
                <a href="https://chat.whatsapp.com/I1oZ8GhZS0Q4VoRU5lK11f" style="display: inline-block; background-color: #25D366; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 25px; font-weight: 600; font-size: 14px; border: 2px solid #25D366;">
                    💬 Join WhatsApp Group
                </a>
            </div>
        </div>
        
        <!-- Course Information -->
        <div style="background-color: #2c3e50; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">📚 Course Information</h3>
            <table class="responsive-table" style="width: 100%; color: #e5e7eb;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;">Course:</td>
                    <td style="padding: 8px 0;">{course.title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;">Instructor:</td>
                    <td style="padding: 8px 0;">{course.instructor.first_name} {course.instructor.last_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;">Enrollment Date:</td>
                    <td style="padding: 8px 0;">{datetime.now().strftime('%B %d, %Y')}</td>
                </tr>
            </table>
        </div>
        
        <!-- Tips for Success -->
        <div style="background-color: #2c3e50; border-left: 4px solid #22c55e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">💡 Tips for Success</h3>
            <ul style="color: #e5e7eb; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li><strong>Update your password</strong> after first login</li>
                <li><strong>Complete your profile</strong> with a photo and bio</li>
                <li><strong>Set learning goals</strong> and track your progress</li>
                <li><strong>Engage with instructors and peers</strong> through discussions</li>
                <li><strong>Follow a consistent schedule</strong> for optimal learning</li>
            </ul>
        </div>
        
        <!-- Call to Action -->
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://study.Afritechhbridge.online/auth/login" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; mobile-button">
                🚀 Access Your Dashboard
            </a>
        </div>
        
        <!-- Support Section -->
        <div style="background-color: #2c3e50; border: 2px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 20px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px;">💬 Need Help?</h3>
            <p style="color: #e5e7eb; margin: 0 0 15px 0; line-height: 1.6;">
                Our support team is here to help you succeed!
            </p>
            <a href="mailto:afritech.bridge@yahoo.com" style="display: inline-block; background-color: #3b82f6; color: white; padding: 10px 25px; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px;">
                📧 Contact Support
            </a>
        </div>
        
        <p style="color: #e5e7eb; line-height: 1.6; text-align: center; margin: 30px 0 20px 0;">
            We're excited to have you in our learning community!<br>
            Your success is our priority. 🌟
        </p>
        
        <p style="color: #e5e7eb; line-height: 1.6; text-align: center;">
            Best regards,<br>
            <strong style="color: #ffffff;">The Afritech Bridge Team</strong><br>
            <span style="font-size: 13px; color: #bdc3c7; font-style: italic;">Empowering Africa Through Digital Education</span>
        </p>
    </div>
            
    {get_email_footer()}
    """

def application_rejected_email(application, course_title, reason=None, reapply_info=True):
    """💙 Empathetic and encouraging email template for application rejection"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div class="icon-large" style="font-size: 70px; margin-bottom: 15px;">💙</div>
                    <h1 style="color: #6366f1; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px;">
                        Thank You for Your Interest
                    </h1>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Regarding Your Application for {course_title}
                    </p>
                </div>
                
                <!-- Greeting -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0;">
                        Dear <strong style="color: #ffffff;">{application.full_name}</strong>,
                    </p>
                    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 15px 0 0 0;">
                        Thank you for taking the time to apply for <strong>{course_title}</strong>. 
                        We truly appreciate your interest in Afritech Bridge LMS and the effort you put into your application.
                    </p>
                </div>
                
                <!-- Decision Notice -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; border: 3px solid #f59e0b;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span class="icon-medium" style="font-size: 40px; display: block; margin-bottom: 10px;">📋</span>
                        <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 700;">
                            Application Decision
                        </h2>
                    </div>
                    
                    <div style="background-color: #34495e; border-radius: 12px; padding: 25px; text-align: center;">
                        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0;">
                            After carefully reviewing all applications, we regret to inform you that we are <strong>unable to accept your application</strong> for this course at this time.
                        </p>
                    </div>
                </div>
                
                {f'''<div style="background-color: #2c3e50; border-left: 5px solid #ef4444; border-radius: 12px; padding: 30px; margin: 30px 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 28px;">💬</span>
                            </td>
                            <td style="vertical-align: top;">
                                <h3 style="margin: 0; color: #fca5a5; font-size: 20px; font-weight: 700;">Feedback on Your Application</h3>
                            </td>
                        </tr>
                    </table>
                    <div style="background-color: #34495e; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.05);">
                        <p style="color: #f87171; margin: 0; font-size: 15px; line-height: 1.8;">
                            {reason}
                        </p>
                    </div>
                </div>''' if reason else ''}
                
                <!-- Not the End -->
                <div style="background-color: #2c3e50; border-radius: 20px; padding: 35px; margin: 35px 0; text-align: center; border: 3px solid #3b82f6;">
                    <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 15px;">🌟</span>
                    <h2 style="margin: 0 0 15px 0; color: #ffffff; font-size: 26px; font-weight: 800;">
                        This Isn't the End!
                    </h2>
                    <p style="color: #bdc3c7; font-size: 16px; line-height: 1.8; margin: 0; max-width: 600px; margin: 0 auto;">
                        Every successful learner faces setbacks. What matters most is your determination to keep growing 
                        and learning. We believe in your potential! 💪
                    </p>
                </div>
                
                {f'''<div style="background-color: #34495e; border: 3px solid #667eea; border-radius: 16px; padding: 35px; margin: 35px 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 32px;">🔄</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Ways to Strengthen Your Next Application</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px;">
                        <ul style="color: #e5e7eb; line-height: 2.2; margin: 0; padding-left: 25px; font-size: 15px;">
                            <li><strong style="color: #ffffff;">📚 Review Prerequisites</strong> – Ensure you meet all course requirements</li>
                            <li><strong style="color: #ffffff;">💼 Build Relevant Experience</strong> – Gain practical skills aligned with the course</li>
                            <li><strong style="color: #ffffff;">📝 Enhance Your Application</strong> – Provide detailed, specific information</li>
                            <li><strong style="color: #ffffff;">🎯 Show Your Motivation</strong> – Clearly articulate your learning goals</li>
                            <li><strong style="color: #ffffff;">🌱 Start with Fundamentals</strong> – Consider beginner courses if this was advanced</li>
                            <li><strong style="color: #ffffff;">💡 Seek Feedback</strong> – Contact our support team for guidance</li>
                        </ul>
                    </div>
                    
                    <div style="background-color: #2c3e50; border-radius: 12px; padding: 20px; margin-top: 20px; text-align: center;">
                        <p style="color: #ffffff; font-size: 15px; margin: 0; line-height: 1.7;">
                            <strong style="font-size: 16px;">✨ You're Welcome to Reapply!</strong><br>
                            We encourage you to apply again in the future after addressing the areas above.
                        </p>
                    </div>
                </div>''' if reapply_info else ''}
                
                <!-- Alternative Opportunities -->
                <div style="background-color: #2c3e50; border-radius: 20px; padding: 35px; margin: 35px 0; border: 3px solid #22c55e;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 10px;">🚀</span>
                        <h3 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                            Explore Other Amazing Courses!
                        </h3>
                        <p style="color: #e5e7eb; margin: 10px 0 0 0; font-size: 15px;">
                            Don't let this stop your learning journey
                        </p>
                    </div>
                    
                    <div style="background-color: #34495e; border-radius: 14px; padding: 25px; margin-bottom: 25px;">
                        <p style="color: #ffffff; font-size: 16px; line-height: 1.8; margin: 0; text-align: center;">
                            We offer <strong>dozens of courses</strong> across various subjects and skill levels. 
                            Find the perfect match for your current goals and experience! 📚✨
                        </p>
                    </div>
                    
                    <div style="text-align: center;">
                        <a href="https://study.Afritechhbridge.online/courses" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 18px 45px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4); text-transform: uppercase; letter-spacing: 1px; mobile-button">
                            🔍 Browse All Courses
                        </a>
                        <p style="color: #bdc3c7; margin: 15px 0 0 0; font-size: 13px;">
                            Discover courses that match your interests and goals
                        </p>
                    </div>
                </div>
                
                <!-- Resources Section -->
                <div style="background-color: #34495e; border: 3px solid #667eea; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 32px;">📖</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Free Learning Resources</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px;">
                        <p style="color: #e5e7eb; font-size: 15px; line-height: 1.8; margin: 0 0 15px 0;">
                            While you prepare for your next application, explore our <strong>free resources</strong> to build your skills:
                        </p>
                        <ul style="color: #e5e7eb; line-height: 2; margin: 0; padding-left: 25px; font-size: 14px;">
                            <li>Blog articles and tutorials</li>
                            <li>Community forums and discussions</li>
                            <li>Webinars and live sessions</li>
                            <li>Sample course materials</li>
                        </ul>
                    </div>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
                    <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 15px;">💬</span>
                    <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        Need Guidance or Have Questions?
                    </h3>
                    <p style="color: #e5e7eb; margin: 0 0 20px 0; font-size: 15px; line-height: 1.7;">
                        Our support team is here to help you navigate your learning path.<br>
                        We can provide advice on course selection and application improvement!
                    </p>
                    <a href="mailto:afritech.bridge@yahoo.com" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 15px; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);">
                        📧 Contact Support Team
                    </a>
                </div>
                
                <!-- Closing Message -->
                <div style="text-align: center; margin: 40px 0 20px 0; padding: 30px; background-color: #2c3e50; border-radius: 16px;">
                    <p style="color: #d1d5db; font-size: 16px; line-height: 1.8; margin: 0 0 20px 0;">
                        <strong style="color: #ffffff; font-size: 18px;">Remember:</strong><br>
                        Every expert was once a beginner. Every master started with a first step.<br>
                        Your learning journey is unique, and we're here to support you! 🌈
                    </p>
                    
                    <div style="background-color: #34495e; border-radius: 12px; padding: 25px; margin: 20px 0;">
                        <p style="color: #bdc3c7; font-size: 15px; line-height: 1.8; margin: 0 0 15px 0; font-style: italic;">
                            "Success is not final, failure is not fatal: it is the courage to continue that counts."
                        </p>
                        <p style="color: #bdc3c7; font-size: 13px; margin: 0;">— Winston Churchill</p>
                    </div>
                    
                    <p style="color: #ffffff; font-size: 15px; font-weight: 700; margin: 20px 0 5px 0;">
                        With warm regards,<br>
                        The Afritech Bridge Team
                    </p>
                    <p style="color: #bdc3c7; font-size: 13px; margin: 0; font-style: italic;">
                        Empowering Africa Through Digital Education
                    </p>
                </div>
            </div>
            
    {get_email_footer()}
    """

def application_waitlisted_email(application, course_title, position=None, estimated_wait="2-4 weeks"):
    """⏳ Modern waitlist email template with engaging design"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div class="icon-large" style="font-size: 70px; margin-bottom: 15px;">⏳</div>
                    <h1 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 800; letter-spacing: -1px;">
                        You're on the Waitlist!
                    </h1>
                    <p style="color: #ffffff; margin: 10px 0 0 0; font-size: 17px; font-weight: 600;">
                        Almost There – A Spot Might Open Up Soon! 🎯
                    </p>
                </div>
                
                <!-- Greeting -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; border: 3px solid #f59e0b;">
                    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0;">
                        Dear <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong>,
                    </p>
                    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 15px 0 0 0;">
                        Thank you for your interest in <strong style="color: #ffffff;">{course_title}</strong>!<br>
                        While the course is currently at capacity, we've placed you on our <strong style="color: #f59e0b;">waitlist</strong>. 
                        This means you're in a great position if a spot opens up! 🌟
                    </p>
                </div>
                
                <!-- Waitlist Status Card -->
                <div style="background-color: #34495e; border: 3px solid #667eea; border-radius: 20px; padding: 35px; margin: 35px 0; box-shadow: 0 10px 30px rgba(0,0,0,0.1);">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 10px;">📊</span>
                        <h2 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                            Your Waitlist Status
                        </h2>
                    </div>
                    
                    <div style="background-color: #2c3e50; border-radius: 14px; padding: 30px; text-align: center;">
                        {f'''<div style="margin-bottom: 20px;">
                            <p style="color: #e5e7eb; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px;">
                                Your Position
                            </p>
                            <div style="background-color: #34495e; border-radius: 50%; width: 120px; height: 120px; margin: 0 auto; box-shadow: 0 8px 20px rgba(0,0,0,0.15);">
                                <table width="120" height="120" cellpadding="0" cellspacing="0" border="0">
                                    <tr>
                                        <td style="text-align: center; vertical-align: middle; font-size: 48px; font-weight: 900; color: #f59e0b;">
                                            #{position}
                                        </td>
                                    </tr>
                                </table>
                            </div>
                            <p style="color: #ffffff; margin: 12px 0 0 0; font-size: 13px; font-style: italic;">
                                in the waiting queue
                            </p>
                        </div>''' if position else ''}
                        
                        <div style="background-color: #34495e; border-radius: 12px; padding: 20px; margin-top: 20px;">
                            <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                                <tr>
                                    <td style="color: #bdc3c7; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: left;">
                                        <span style="margin-right: 8px;">⏰</span> Estimated Wait Time
                                    </td>
                                    <td style="color: #f59e0b; font-size: 16px; font-weight: 700; padding: 8px 0; text-align: right;">
                                        {estimated_wait}
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #bdc3c7; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: left;">
                                        <span style="margin-right: 8px;">📧</span> Notification Method
                                    </td>
                                    <td style="color: #ffffff; font-size: 15px; font-weight: 600; padding: 8px 0; text-align: right;">
                                        Email
                                    </td>
                                </tr>
                                <tr>
                                    <td style="color: #bdc3c7; font-size: 14px; font-weight: 600; padding: 8px 0; text-align: left;">
                                        <span style="margin-right: 8px;">✅</span> Application Status
                                    </td>
                                    <td style="padding: 8px 0; text-align: right;">
                                        <span style="background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%); color: white; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">
                                            Waitlisted
                                        </span>
                                    </td>
                                </tr>
                            </table>
                        </div>
                    </div>
                </div>
                
                <!-- What Happens Next -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 35px; margin: 35px 0; border: 3px solid #3b82f6;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 32px;">🔔</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 800;">What Happens Next?</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #34495e; border-radius: 12px; padding: 30px;">
                        <div style="border-left: 4px solid #3b82f6; padding-left: 20px; margin-bottom: 20px;">
                            <h4 style="color: #ffffff; margin: 0 0 10px 0; font-size: 16px; font-weight: 700;">
                                📬 If a Spot Opens Up
                            </h4>
                            <p style="color: #bdc3c7; margin: 0; font-size: 14px; line-height: 1.8;">
                                We'll send you an <strong>instant email notification</strong>. You'll have <strong>48 hours</strong> 
                                to confirm your enrollment before the spot is offered to the next person on the waitlist.
                            </p>
                        </div>
                        
                        <div style="border-left: 4px solid #10b981; padding-left: 20px; margin-bottom: 20px;">
                            <h4 style="color: #059669; margin: 0 0 10px 0; font-size: 16px; font-weight: 700;">
                                ⏰ Keep Your Contact Info Updated
                            </h4>
                            <p style="color: #ffffff; margin: 0; font-size: 14px; line-height: 1.8;">
                                Make sure to <strong>check your email regularly</strong> and keep your contact information current. 
                                Missing our notification could mean losing your spot!
                            </p>
                        </div>
                        
                        <div style="border-left: 4px solid #f59e0b; padding-left: 20px;">
                            <h4 style="color: #d97706; margin: 0 0 10px 0; font-size: 16px; font-weight: 700;">
                                🔄 Position Updates
                            </h4>
                            <p style="color: #ffffff; margin: 0; font-size: 14px; line-height: 1.8;">
                                As others confirm or decline their spots, your position may move forward. 
                                We'll keep you updated if there are significant changes!
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Stay Active Section -->
                <div style="background-color: #2c3e50; border-radius: 20px; padding: 35px; margin: 35px 0; border: 3px solid #22c55e;">
                    <div style="text-align: center; margin-bottom: 25px;">
                        <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 10px;">🚀</span>
                        <h3 style="margin: 0; color: #ffffff; font-size: 24px; font-weight: 800;">
                            Stay Active While You Wait!
                        </h3>
                        <p style="color: #e5e7eb; margin: 10px 0 0 0; font-size: 15px;">
                            Make the most of your waiting time
                        </p>
                    </div>
                    
                    <div style="background-color: #34495e; border-radius: 14px; padding: 30px;">
                        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                            <tr>
                                <td width="50%" style="padding-right: 10px; vertical-align: top;">
                                    <div style="background-color: #2c3e50; border-radius: 10px; padding: 20px; text-align: center;">
                                        <span style="font-size: 32px; display: block; margin-bottom: 8px;">📚</span>
                                        <p style="color: #ffffff; margin: 0; font-size: 14px; font-weight: 600;">
                                            Explore Other<br>Courses
                                        </p>
                                    </div>
                                </td>
                                <td width="50%" style="padding-left: 10px; vertical-align: top;">
                                    <div style="background: linear-gradient(135deg, #e0e7ff 0%, #c7d2fe 100%); border-radius: 10px; padding: 20px; text-align: center;">
                                        <span style="font-size: 32px; display: block; margin-bottom: 8px;">🎓</span>
                                        <p style="color: #3730a3; margin: 0; font-size: 14px; font-weight: 600;">
                                            Start Free<br>Resources
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                        
                        <div style="background-color: #2c3e50; border-radius: 10px; padding: 20px;">
                            <p style="color: #e5e7eb; font-size: 15px; line-height: 1.8; margin: 0 0 15px 0;">
                                <strong style="color: #ffffff;">Don't Put Your Learning on Hold!</strong><br>
                                We have many other excellent courses available right now. Plus, taking another course 
                                can strengthen your background for this one! 💪
                            </p>
                            <div style="text-align: center;">
                                <a href="https://study.Afritechhbridge.online/courses" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 30px; font-weight: 700; font-size: 15px; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3); mobile-button">
                                    🔍 Browse Available Courses
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
                
                <!-- Important Reminders -->
                <div style="background-color: #2c3e50; border: 3px dashed #ef4444; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 15px;">
                                <span class="icon-medium" style="font-size: 40px;">⚠️</span>
                            </td>
                            <td style="vertical-align: top;">
                                <h3 style="margin: 0 0 15px 0; color: #fca5a5; font-size: 20px; font-weight: 700;">
                                    Important Reminders
                                </h3>
                                <ul style="color: #f87171; line-height: 2; margin: 0; padding-left: 20px; font-size: 15px;">
                                    <li><strong>Check your email</strong> (including spam folder) regularly for updates</li>
                                    <li><strong>Respond within 48 hours</strong> if you receive an enrollment offer</li>
                                    <li><strong>Keep your profile active</strong> – inactive applications may be removed</li>
                                    <li><strong>Contact us</strong> if your plans change and you no longer need a spot</li>
                                </ul>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #34495e; border: 3px solid #667eea; border-radius: 16px; padding: 30px; margin: 30px 0; text-align: center;">
                    <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 15px;">💬</span>
                    <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        Questions About Your Waitlist Status?
                    </h3>
                    <p style="color: #bdc3c7; margin: 0 0 20px 0; font-size: 15px; line-height: 1.7;">
                        Our team is here to help! Contact us anytime for updates or assistance.
                    </p>
                    <a href="mailto:afritech.bridge@yahoo.com" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 30px; font-weight: 600; font-size: 15px; box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);">
                        📧 Contact Support Team
                    </a>
                </div>
                
                <!-- Closing -->
                <div style="text-align: center; margin: 40px 0 20px 0; padding: 30px; background-color: #2c3e50; border-radius: 16px;">
                    <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 15px 0;">
                        We appreciate your patience and interest in <strong style="color: #ffffff;">{course_title}</strong>!<br>
                        We're hopeful that a spot will open up for you soon. 🤞✨
                    </p>
                    
                    <p style="color: #ffffff; font-size: 15px; font-weight: 700; margin: 20px 0 5px 0;">
                        With warm regards,<br>
                        The Afritech Bridge Team
                    </p>
                    <p style="color: #f59e0b; font-size: 13px; margin: 0; font-style: italic;">
                        Empowering Africa Through Digital Education
                    </p>
                </div>
            </div>
            
    {get_email_footer()}
    """

def assignment_graded_email(student_name, student_email, assignment_title, course_title, grade, points_possible, feedback, passed=True):
    """Email template for graded assignment notification"""
    percentage = (grade / points_possible * 100) if points_possible > 0 else 0
    status_color = "#059669" if passed else "#dc2626"
    status_bg = "#f0fdf4" if passed else "#fef2f2"
    status_text = "Passed" if passed else "Needs Improvement"
    status_icon = "✅" if passed else "📝"
    
    return f"""
    {get_email_header()}
    <div style="background-color: white; padding: 30px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <div class="icon-medium" style="font-size: 50px; margin-bottom: 10px;">{status_icon}</div>
            <h2 style="color: {status_color}; margin: 0;">Assignment Graded</h2>
        </div>
        
        <p style="color: #4a5568; line-height: 1.6;">
            Dear <strong>{student_name}</strong>,
        </p>
        
        <p style="color: #4a5568; line-height: 1.6;">
            Your assignment <strong>"{assignment_title}"</strong> for <strong>{course_title}</strong> has been graded.
        </p>
        
        <div style="background-color: {status_bg}; border: 2px solid {status_color}; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: {status_color}; font-size: 18px;">Your Score</h3>
            <div style="font-size: 48px; font-weight: bold; color: {status_color}; margin: 10px 0;">
                {grade:.1f} / {points_possible}
            </div>
            <div style="font-size: 24px; color: {status_color}; margin: 5px 0;">
                {percentage:.1f}%
            </div>
            <div style="background-color: white; color: {status_color}; display: inline-block; padding: 8px 20px; border-radius: 20px; margin-top: 10px; font-weight: 600;">
                {status_text}
            </div>
        </div>
        
        {f'''<div style="background-color: #f8fafc; border-left: 4px solid #667eea; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #2d3748; font-size: 16px;">💬 Instructor Feedback</h3>
            <p style="color: #4a5568; margin: 0; line-height: 1.6; white-space: pre-wrap;">{feedback}</p>
        </div>''' if feedback else ''}
        
        <div style="background-color: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">📚 Assignment Details</h3>
            <table class="responsive-table" style="width: 100%; color: #4a5568;">
                <tr>
                    <td style="padding: 8px 0;"><strong>Assignment:</strong></td>
                    <td>{assignment_title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Course:</strong></td>
                    <td>{course_title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Points Earned:</strong></td>
                    <td>{grade:.1f} / {points_possible}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Percentage:</strong></td>
                    <td>{percentage:.1f}%</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0;"><strong>Graded:</strong></td>
                    <td>{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                </tr>
            </table>
        </div>
        
        {'''<div style="background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #fca5a5; font-size: 16px;">💡 Tips for Improvement</h3>
            <ul style="color: #fca5a5; line-height: 1.8; margin: 0; padding-left: 20px;">
                <li>Review the instructor's feedback carefully</li>
                <li>Revisit the course materials related to this assignment</li>
                <li>Reach out to your instructor if you have questions</li>
                <li>Apply this feedback to future assignments</li>
            </ul>
        </div>''' if not passed else '''<div style="background-color: #f0fdf4; border-left: 4px solid #22c55e; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 10px 0; color: #ffffff; font-size: 16px;">🎉 Great Job!</h3>
            <p style="color: #ffffff; margin: 0; line-height: 1.6;">
                Keep up the excellent work! Continue to engage with the course materials and complete the remaining assignments.
            </p>
        </div>'''}
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://study.Afritechhbridge.online/student/courses" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; mobile-button">
                View Full Details
            </a>
        </div>
        
        <p style="color: #4a5568; line-height: 1.6;">
            Keep up the great work!<br><br>
            Best regards,<br>
            <strong>The Afritech Bridge Team</strong>
        </p>
    </div>
    {get_email_footer()}
    """

def course_announcement_email(student_name, course_title, announcement_title, announcement_content, instructor_name):
    """Email template for course announcements"""
    # Clean and format the content (strip HTML if needed, truncate if too long)
    clean_content = announcement_content[:500] + "..." if len(announcement_content) > 500 else announcement_content
    
    return f"""
    {get_email_header()}
    <div style="background-color: #2c3e50; padding: 30px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <div class="icon-medium" style="font-size: 50px; margin-bottom: 10px;">📢</div>
            <h2 style="color: #ffffff; margin: 0;">New Announcement</h2>
        </div>
        
        <p style="color: #e5e7eb; line-height: 1.6;">
            Dear <strong style="color: #ffffff;">{student_name}</strong>,
        </p>
        
        <p style="color: #e5e7eb; line-height: 1.6;">
            Your instructor has posted a new announcement for <strong style="color: #ffffff;">{course_title}</strong>.
        </p>
        
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 8px; padding: 25px; margin: 25px 0; color: white;">
            <h3 style="margin: 0 0 15px 0; font-size: 20px; color: white;">{announcement_title}</h3>
            <div style="background-color: rgba(255,255,255,0.1); border-radius: 6px; padding: 15px;">
                <p style="color: white; margin: 0; line-height: 1.8; white-space: pre-wrap;">{clean_content}</p>
            </div>
            <p style="margin: 15px 0 0 0; font-size: 14px; color: #e0e7ff;">
                Posted by <strong>{instructor_name}</strong> • {datetime.now().strftime('%B %d, %Y')}
            </p>
        </div>
        
        <div style="background-color: #34495e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">ℹ️ Course Information</h3>
            <table class="responsive-table" style="width: 100%; color: #e5e7eb;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Course:</strong></td>
                    <td style="color: #ffffff;">{course_title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Instructor:</strong></td>
                    <td style="color: #ffffff;">{instructor_name}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Posted:</strong></td>
                    <td style="color: #ffffff;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://study.Afritechhbridge.online/student/courses" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; mobile-button">
                View Full Announcement
            </a>
        </div>
        
        <p style="color: #e5e7eb; line-height: 1.6; text-align: center;">
            Stay engaged and check your course regularly for updates!<br><br>
            Best regards,<br>
            <strong style="color: #ffffff;">The Afritech Bridge Team</strong>
        </p>
    </div>
    {get_email_footer()}
    """

def quiz_graded_email(student_name, quiz_title, course_title, score, total_points, percentage, passed=True):
    """Email template for quiz grade notification"""
    status_color = "#059669" if passed else "#dc2626"
    status_bg = "#34495e" if passed else "#34495e"
    status_text = "Passed" if passed else "Failed"
    status_icon = "✅" if passed else "❌"
    
    return f"""
    {get_email_header()}
    <div style="background-color: #2c3e50; padding: 30px;">
        <div style="text-align: center; margin-bottom: 20px;">
            <div class="icon-medium" style="font-size: 50px; margin-bottom: 10px;">{status_icon}</div>
            <h2 style="color: {status_color}; margin: 0;">Quiz Results Available</h2>
        </div>
        
        <p style="color: #e5e7eb; line-height: 1.6;">
            Dear <strong style="color: #ffffff;">{student_name}</strong>,
        </p>
        
        <p style="color: #e5e7eb; line-height: 1.6;">
            Your quiz <strong style="color: #ffffff;">"{quiz_title}"</strong> for <strong style="color: #ffffff;">{course_title}</strong> has been graded.
        </p>
        
        <div style="background-color: {status_bg}; border: 2px solid {status_color}; border-radius: 8px; padding: 20px; margin: 25px 0; text-align: center;">
            <h3 style="margin: 0 0 10px 0; color: {status_color}; font-size: 18px;">Your Score</h3>
            <div style="font-size: 48px; font-weight: bold; color: {status_color}; margin: 10px 0;">
                {score} / {total_points}
            </div>
            <div style="font-size: 24px; color: {status_color}; margin: 5px 0;">
                {percentage:.1f}%
            </div>
            <div style="background-color: #2c3e50; color: {status_color}; display: inline-block; padding: 8px 20px; border-radius: 20px; margin-top: 10px; font-weight: 600;">
                {status_text}
            </div>
        </div>
        
        <div style="background-color: #34495e; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #ffffff; font-size: 16px;">📊 Quiz Details</h3>
            <table class="responsive-table" style="width: 100%; color: #e5e7eb;">
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Quiz:</strong></td>
                    <td style="color: #ffffff;">{quiz_title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Course:</strong></td>
                    <td style="color: #ffffff;">{course_title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Score:</strong></td>
                    <td style="color: #ffffff;">{score} / {total_points}</td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; font-weight: 600;"><strong>Percentage:</strong></td>
                    <td style="color: #ffffff;">{percentage:.1f}%</td>
                </tr>
            </table>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="https://study.Afritechhbridge.online/student/courses" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 40px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px; mobile-button">
                View Detailed Results
            </a>
        </div>
        
        <p style="color: #e5e7eb; line-height: 1.6; text-align: center;">
            Keep learning and improving!<br><br>
            Best regards,<br>
            <strong style="color: #ffffff;">The Afritech Bridge Team</strong>
        </p>
    </div>
    {get_email_footer()}
    """

def application_status_pending_email(application, course_title, reason=None):
    """✨ Professional email template for status change to pending"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Status Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.3);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⏳</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #3b82f6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Application Under Review
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your application status has been updated
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    We're writing to inform you that your application for <strong style="color: #667eea; font-size: 16px;">{course_title}</strong> has been moved to <strong style="color: #3b82f6;">Pending</strong> status for further review.
                </p>
                
                <!-- Status Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">📋</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Status Update Details</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600; width: 45%;">
                                <span style="margin-right: 8px;">🆔</span> Application ID
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 700;">
                                #{application.id}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📚</span> Course
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                                {course_title}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📊</span> New Status
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0;">
                                <span style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                    ⏳ Pending Review
                                </span>
                            </td>
                        </tr>
                    </table>
                    
                    {f'''
                    <div style="margin-top: 25px; padding: 20px; background-color: #34495e; border-left: 4px solid #3b82f6; border-radius: 8px;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.7;">
                            <strong style="color: #3b82f6; font-size: 16px;">📝 Note:</strong><br>
                            {reason}
                        </p>
                    </div>
                    ''' if reason else ''}
                </div>
                
                <!-- Info Section -->
                <div style="background-color: rgba(59, 130, 246, 0.1); border-radius: 12px; padding: 25px; margin: 30px 0; border: 2px dashed #3b82f6;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 10px;">
                                <span style="font-size: 24px;">ℹ️</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #3b82f6; font-size: 18px; font-weight: 700;">What This Means</h3>
                            </td>
                        </tr>
                    </table>
                    <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0;">
                        Your application is currently under review by our admissions team. We will carefully evaluate your qualifications and notify you once a decision has been made. This process typically takes 2-3 business days.
                    </p>
                </div>
                
                <!-- Next Steps -->
                <div style="margin: 35px 0;">
                    <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 20px 0; font-weight: 700;">
                        <span style="margin-right: 8px;">🎯</span> What Happens Next
                    </h3>
                    <table class="responsive-table" style="width: 100%;">
                        <tr>
                            <td style="padding: 15px; background-color: #2c3e50; border-radius: 10px; margin-bottom: 12px; display: block; margin-bottom: 12px;">
                                <span style="font-size: 22px; margin-right: 10px;">1️⃣</span>
                                <span style="color: #e5e7eb; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #ffffff;">Our team will review your application</strong><br>
                                    <span style="color: #bdc3c7; font-size: 14px;">We'll assess your qualifications and experience</span>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px; background-color: #2c3e50; border-radius: 10px; display: block; margin-bottom: 12px;">
                                <span style="font-size: 22px; margin-right: 10px;">2️⃣</span>
                                <span style="color: #e5e7eb; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #ffffff;">You'll receive a decision notification</strong><br>
                                    <span style="color: #bdc3c7; font-size: 14px;">We'll email you with the outcome</span>
                                </span>
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 15px; background-color: #2c3e50; border-radius: 10px; display: block;">
                                <span style="font-size: 22px; margin-right: 10px;">3️⃣</span>
                                <span style="color: #e5e7eb; font-size: 15px; line-height: 1.6;">
                                    <strong style="color: #ffffff;">If approved, you'll get instant access</strong><br>
                                    <span style="color: #bdc3c7; font-size: 14px;">Start learning immediately!</span>
                                </span>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Contact Section -->
                <div style="text-align: center; margin: 40px 0 20px 0; padding: 30px 20px; background-color: #2c3e50; border-radius: 12px;">
                    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                        Have questions about your application?
                    </p>
                    <a href="mailto:afritech.bridge@yahoo.com" class="mobile-button" style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.3);">
                        📧 Contact Support
                    </a>
                </div>
                
                <p style="color: #bdc3c7; font-size: 14px; line-height: 1.7; text-align: center; margin: 30px 0 0 0;">
                    Thank you for your patience.<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 🎓
                </p>
            </div>
    {get_email_footer()}
    """


def application_status_withdrawn_email(application, course_title, reason=None):
    """✨ Professional email template for withdrawn status"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Status Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(107, 114, 128, 0.3);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⊗</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #9ca3af; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Application Withdrawn
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your application has been withdrawn
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    This email confirms that your application for <strong style="color: #667eea; font-size: 16px;">{course_title}</strong> has been marked as <strong style="color: #9ca3af;">Withdrawn</strong>.
                </p>
                
                <!-- Status Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">📋</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Withdrawal Details</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600; width: 45%;">
                                <span style="margin-right: 8px;">🆔</span> Application ID
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 700;">
                                #{application.id}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📚</span> Course
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 15px; font-weight: 600;">
                                {course_title}
                            </td>
                        </tr>
                        <tr>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                <span style="margin-right: 8px;">📊</span> Status
                            </td>
                            <td style="padding: 12px 15px; background-color: #34495e; border-radius: 0 8px 8px 0;">
                                <span style="display: inline-block; background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%); color: #ffffff; padding: 6px 16px; border-radius: 20px; font-size: 14px; font-weight: 600;">
                                    ⊗ Withdrawn
                                </span>
                            </td>
                        </tr>
                    </table>
                    
                    {f'''
                    <div style="margin-top: 25px; padding: 20px; background-color: #34495e; border-left: 4px solid #6b7280; border-radius: 8px;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.7;">
                            <strong style="color: #9ca3af; font-size: 16px;">📝 Reason:</strong><br>
                            {reason}
                        </p>
                    </div>
                    ''' if reason else ''}
                </div>
                
                <!-- Important Notice -->
                <div style="background-color: rgba(239, 68, 68, 0.1); border-radius: 12px; padding: 25px; margin: 30px 0; border: 2px solid #ef4444;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 10px;">
                                <span style="font-size: 24px;">⚠️</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ef4444; font-size: 18px; font-weight: 700;">Important Notice</h3>
                            </td>
                        </tr>
                    </table>
                    <p style="color: #d1d5db; font-size: 14px; line-height: 1.7; margin: 0;">
                        If this withdrawal was done in error or without your knowledge, please contact our support team immediately. We're here to help resolve any issues.
                    </p>
                </div>
                
                <!-- Reapply Section -->
                <div style="margin: 35px 0; padding: 30px; background-color: #2c3e50; border-radius: 12px;">
                    <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; font-weight: 700; text-align: center;">
                        <span style="margin-right: 8px;">🔄</span> Want to Reapply?
                    </h3>
                    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0; text-align: center;">
                        You're always welcome to submit a new application if you'd like to join this course in the future.
                    </p>
                    <div style="text-align: center;">
                        <a href="https://study.Afritechhbridge.online/courses" class="mobile-button" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);">
                            📚 Browse Courses
                        </a>
                    </div>
                </div>
                
                <!-- Contact Section -->
                <div style="text-align: center; margin: 40px 0 20px 0; padding: 30px 20px; background-color: #2c3e50; border-radius: 12px;">
                    <p style="color: #d1d5db; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                        Questions or concerns about this withdrawal?
                    </p>
                    <a href="mailto:afritech.bridge@yahoo.com" class="mobile-button" style="display: inline-block; background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3);">
                        🆘 Contact Support Urgently
                    </a>
                </div>
                
                <p style="color: #bdc3c7; font-size: 14px; line-height: 1.7; text-align: center; margin: 30px 0 0 0;">
                    We hope to see you again soon.<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 🎓
                </p>
            </div>
    {get_email_footer()}
    """

def custom_application_email(recipient_name, subject, message):
    """✨ Custom email template for application management announcements"""
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">📧</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 700; letter-spacing: -0.5px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3);">
                        {subject}
                    </h2>
                </div>
                
                <!-- Personal Greeting -->
                <div style="margin-bottom: 30px;">
                    <p style="color: #ffffff; font-size: 18px; margin: 0; font-weight: 600; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">
                        Hello {recipient_name},
                    </p>
                </div>
                
                <!-- Custom Message -->
                <div style="margin: 30px 0; padding: 30px; background: #4a5568; border-radius: 12px; border-left: 5px solid #667eea;">
                    <div style="color: #ffffff; font-size: 16px; line-height: 1.8; white-space: pre-line;">
                        {message}
                    </div>
                </div>
                
                <!-- WhatsApp Community Section -->
                <div style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); border-radius: 20px; padding: 35px; margin: 35px 0; box-shadow: 0 10px 30px rgba(37, 211, 102, 0.3); border: 3px solid #25D366;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span class="icon-medium" style="font-size: 50px; display: block; margin-bottom: 15px;">📱</span>
                        <h2 style="margin: 0; color: #ffffff; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">
                            Join Our Community!
                        </h2>
                        <p style="color: rgba(255,255,255,0.95); margin: 10px 0 0 0; font-size: 15px; line-height: 1.6;">
                            Connect with fellow students, get instant updates, and collaborate with your peers
                        </p>
                    </div>
                    
                    <div style="background-color: rgba(255,255,255,0.15); backdrop-filter: blur(10px); border-radius: 16px; padding: 25px; margin: 25px 0;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="text-align: center; padding: 10px 0;">
                                    <div style="background-color: rgba(255,255,255,0.2); border-radius: 12px; padding: 20px; margin-bottom: 10px;">
                                        <p style="color: #ffffff; font-size: 15px; margin: 0 0 8px 0; font-weight: 600;">
                                            💬 WhatsApp Communication Channel
                                        </p>
                                        <p style="color: rgba(255,255,255,0.9); font-size: 13px; margin: 0; line-height: 1.6;">
                                            • Share resources and study materials<br>
                                            • Get quick answers to your questions<br>
                                            • Network with instructors and peers<br>
                                            • Stay updated on course announcements
                                        </p>
                                    </div>
                                </td>
                            </tr>
                        </table>
                    </div>
                    
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="https://chat.whatsapp.com/I1oZ8GhZS0Q4VoRU5lK11f" style="display: inline-block; background-color: #ffffff; color: #128C7E; padding: 18px 45px; text-decoration: none; border-radius: 50px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.3); text-transform: uppercase; letter-spacing: 0.5px; mobile-button; border: 3px solid rgba(255,255,255,0.3);">
                            <span style="font-size: 20px; margin-right: 8px;">💬</span> Join WhatsApp Group
                        </a>
                        <p style="color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 13px; font-weight: 500;">
                            Click to join our active learning community
                        </p>
                    </div>
                    
                    <div style="background-color: rgba(255,255,255,0.1); border: 2px dashed rgba(255,255,255,0.4); border-radius: 12px; padding: 18px; margin-top: 25px;">
                        <p style="color: rgba(255,255,255,0.95); font-size: 13px; margin: 0; line-height: 1.6; text-align: center;">
                            <strong style="font-size: 14px;">📋 Group Guidelines:</strong><br>
                            Be respectful, stay on topic, and help create a positive learning environment for everyone!
                        </p>
                    </div>
                </div>
                
                <!-- Need Help Section -->
                <div style="text-align: center; margin: 40px 0 20px 0; padding: 30px 20px; background: linear-gradient(135deg, #3a4c5c 0%, #455a6a 100%); border-radius: 12px;">
                    <h3 style="color: #ffffff; font-size: 20px; margin: 0 0 15px 0; font-weight: 700;">
                        💬 Need Quick Help?
                    </h3>
                    <p style="color: #ffffff; font-size: 15px; line-height: 1.7; margin: 0 0 20px 0;">
                        Get instant support through WhatsApp for any questions or concerns.
                    </p>
                    <a href="https://wa.me/250780784924" class="mobile-button" style="display: inline-block; background: rgba(255,255,255,0.2); color: white; padding: 14px 32px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 15px; border: 2px solid rgba(255,255,255,0.3);">
                        💬 Chat on WhatsApp
                    </a>
                </div>
                
                <p style="color: #ffffff; font-size: 14px; line-height: 1.7; text-align: center; margin: 30px 0 0 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.4);">
                    Best regards,<br>
                    <strong style="color: #ffffff; text-shadow: 1px 1px 2px rgba(0,0,0,0.5);">The Afritech Bridge Team</strong> 🎓
                </p>
            </div>
    {get_email_footer()}
    """

def full_credit_awarded_email(student_name, module_title, course_title, instructor_name, reason=None, details=None):
    """✨ Email template for full credit award notification"""
    # Process details for display
    components_text = ""
    if details:
        components_list = []
        if details.get('lessons_updated', 0) > 0:
            components_list.append(f"{details['lessons_updated']} lesson(s)")
        if details.get('quizzes_updated', 0) > 0:
            components_list.append(f"{details['quizzes_updated']} quiz(es)")
        if details.get('assignments_updated', 0) > 0:
            components_list.append(f"{details['assignments_updated']} assignment(s)")
        
        if components_list:
            components_text = f"This includes: {', '.join(components_list)}"
    
    reason_section = f'''
        <!-- Instructor Note -->
        <div style="background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); border-radius: 15px; padding: 30px; margin: 30px 0; color: white; box-shadow: 0 8px 25px rgba(59, 130, 246, 0.3);">
            <div style="text-align: center; margin-bottom: 20px;">
                <span style="font-size: 40px; display: block; margin-bottom: 10px;">📝</span>
                <h3 style="margin: 0; color: white; font-size: 20px; font-weight: 700;">Instructor Note</h3>
            </div>
            <div style="background-color: rgba(255,255,255,0.15); border-radius: 10px; padding: 20px;">
                <p style="color: white; margin: 0; line-height: 1.8; white-space: pre-wrap; text-align: center; font-style: italic;">{reason}</p>
            </div>
        </div>
    ''' if reason and reason.strip() else ''
    
    return f"""
    {get_email_header()}
    <!-- Main Content -->
    <div class="email-content" style="padding: 50px 35px;">
        <!-- Celebration Header -->
        <div style="text-align: center; margin-bottom: 40px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 15px 40px rgba(16, 185, 129, 0.4); position: relative; overflow: hidden;">
                <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); font-size: 60px; animation: bounce 2s infinite;">🏆</div>
            </div>
            <h1 style="color: #ffffff; margin: 0 0 10px 0; font-size: 32px; font-weight: 800; letter-spacing: -1px; text-shadow: 2px 2px 8px rgba(0,0,0,0.3);">
                Full Credit Awarded!
            </h1>
            <p style="color: rgba(255,255,255,0.9); margin: 0; font-size: 18px; font-weight: 500; text-shadow: 1px 1px 3px rgba(0,0,0,0.4);">
                Outstanding achievement recognized ✨
            </p>
        </div>
        
        <!-- Personal Greeting -->
        <div style="margin-bottom: 35px; text-align: center;">
            <p style="color: #ffffff; font-size: 20px; margin: 0; font-weight: 600; text-shadow: 1px 1px 3px rgba(0,0,0,0.5);">
                Dear <strong style="color: #fbbf24;">{student_name}</strong>,
            </p>
        </div>
        
        <!-- Main Message -->
        <div style="background: rgba(255,255,255,0.1); backdrop-filter: blur(10px); border-radius: 20px; padding: 35px; margin: 35px 0; border: 2px solid rgba(255,255,255,0.2);">
            <p style="color: #ffffff; line-height: 1.8; font-size: 17px; margin: 0; text-shadow: 1px 1px 2px rgba(0,0,0,0.4); text-align: center;">
                🎉 <strong>Congratulations!</strong> Your instructor <strong style="color: #fbbf24;">{instructor_name}</strong> has awarded you 
                <strong style="color: #10b981;">full credit</strong> for the module 
                <strong style="color: #fbbf24;">"{module_title}"</strong> in <strong>{course_title}</strong>.
            </p>
        </div>
        
        <!-- Achievement Badge -->
        <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 20px; padding: 40px; margin: 35px 0; color: white; text-align: center; box-shadow: 0 15px 50px rgba(16, 185, 129, 0.4); border: 3px solid rgba(255,255,255,0.2);">
            <div style="margin-bottom: 25px;">
                <span style="font-size: 80px; display: block; margin-bottom: 15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));">🎉</span>
                <h2 style="margin: 0; font-size: 28px; color: white; font-weight: 800; letter-spacing: -0.5px;">
                    Full Credit Achieved
                </h2>
            </div>
            
            <div style="background: rgba(255,255,255,0.2); border-radius: 15px; padding: 30px; margin: 25px 0; backdrop-filter: blur(10px);">
                <div style="font-size: 64px; font-weight: 900; color: white; margin: 15px 0; text-shadow: 2px 2px 8px rgba(0,0,0,0.3);">
                    100%
                </div>
                <div style="font-size: 20px; color: #d1fae5; margin: 10px 0; font-weight: 600;">
                    Module Complete
                </div>
                <div style="background: rgba(255,255,255,0.3); border-radius: 25px; padding: 12px 30px; margin: 20px auto; display: inline-block; backdrop-filter: blur(5px);">
                    <span style="font-weight: 700; font-size: 16px; color: white;">✨ Excellence Recognized ✨</span>
                </div>
            </div>
        </div>
        
        {reason_section}
        
        <!-- Module Details Card -->
        <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border-radius: 20px; padding: 35px; margin: 35px 0; border: 3px solid #bbf7d0; box-shadow: 0 10px 30px rgba(187, 247, 208, 0.3);">
            <div style="text-align: center; margin-bottom: 25px;">
                <span style="font-size: 50px; display: block; margin-bottom: 10px;">📊</span>
                <h3 style="margin: 0; color: #166534; font-size: 24px; font-weight: 700;">Module Details</h3>
            </div>
            
            <div style="background: white; border-radius: 15px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
                <table class="responsive-table" style="width: 100%; color: #166534; line-height: 2;">
                    <tr style="border-bottom: 2px solid #f0fdf4;">
                        <td style="padding: 12px 0; font-weight: 700; font-size: 16px; width: 35%;">📚 Module:</td>
                        <td style="padding: 12px 0; font-size: 16px;">{module_title}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #f0fdf4;">
                        <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">🎓 Course:</td>
                        <td style="padding: 12px 0; font-size: 16px;">{course_title}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #f0fdf4;">
                        <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">👨‍🏫 Instructor:</td>
                        <td style="padding: 12px 0; font-size: 16px;">{instructor_name}</td>
                    </tr>
                    <tr style="border-bottom: 2px solid #f0fdf4;">
                        <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">📈 Status:</td>
                        <td style="padding: 12px 0;">
                            <span style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 8px 20px; border-radius: 20px; font-weight: 700; display: inline-block; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);">
                                ✅ Complete
                            </span>
                        </td>
                    </tr>
                    <tr>
                        <td style="padding: 12px 0; font-weight: 700; font-size: 16px;">📅 Awarded:</td>
                        <td style="padding: 12px 0; font-size: 16px;">{datetime.now().strftime('%B %d, %Y at %I:%M %p')}</td>
                    </tr>
                </table>
                
                {f'<div style="background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%); border-radius: 10px; padding: 20px; margin-top: 20px; border-left: 5px solid #3b82f6;"><p style="color: #1e40af; margin: 0; font-style: italic; font-weight: 600; text-align: center;">📋 {components_text}</p></div>' if components_text else ''}
            </div>
        </div>
        
        <!-- What This Means Section -->
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 20px; padding: 35px; margin: 35px 0; border: 3px solid #f59e0b; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.3);">
            <div style="text-align: center; margin-bottom: 25px;">
                <span style="font-size: 50px; display: block; margin-bottom: 10px;">🌟</span>
                <h3 style="margin: 0; color: #92400e; font-size: 24px; font-weight: 700;">What This Means</h3>
            </div>
            
            <div style="background: white; border-radius: 15px; padding: 25px; box-shadow: 0 5px 20px rgba(0,0,0,0.1);">
                <ul style="color: #92400e; line-height: 2; margin: 0; padding-left: 0; list-style: none; font-size: 16px;">
                    <li style="margin: 15px 0; padding-left: 0;">
                        <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">✅</span>
                        <strong>Complete Module Mastery:</strong> You've successfully completed all components
                    </li>
                    <li style="margin: 15px 0; padding-left: 0;">
                        <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">📈</span>
                        <strong>Progress Updated:</strong> Your course progress reflects full completion
                    </li>
                    <li style="margin: 15px 0; padding-left: 0;">
                        <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">🎯</span>
                        <strong>Grade Contribution:</strong> This achievement counts toward your final grade
                    </li>
                    <li style="margin: 15px 0; padding-left: 0;">
                        <span style="color: #f59e0b; font-size: 20px; margin-right: 10px;">🚀</span>
                        <strong>Ready to Advance:</strong> Proceed to the next module when available
                    </li>
                </ul>
            </div>
        </div>
        
        <!-- Encouragement Section -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 40px; margin: 35px 0; color: white; text-align: center; box-shadow: 0 15px 50px rgba(102, 126, 234, 0.4);">
            <div style="margin-bottom: 20px;">
                <span style="font-size: 60px; display: block; margin-bottom: 15px; filter: drop-shadow(0 5px 15px rgba(0,0,0,0.3));">🎯</span>
                <h3 style="margin: 0; color: white; font-size: 26px; font-weight: 700;">Keep Up the Great Work!</h3>
            </div>
            <div style="background: rgba(255,255,255,0.15); border-radius: 15px; padding: 25px; backdrop-filter: blur(10px);">
                <p style="color: white; margin: 0; line-height: 1.8; font-size: 17px;">
                    This recognition of your <strong>dedication</strong> and <strong>hard work</strong> is well-deserved. 
                    Continue applying yourself with the same commitment, and you'll achieve great success in your learning journey! 🌟
                </p>
            </div>
        </div>
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="https://study.Afritechhbridge.online/student/courses" style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px 50px; text-decoration: none; border-radius: 15px; font-weight: 700; font-size: 18px; mobile-button; box-shadow: 0 10px 30px rgba(16, 185, 129, 0.4); border: 3px solid rgba(255,255,255,0.2); text-transform: uppercase; letter-spacing: 1px;">
                📊 View Course Progress
            </a>
            <p style="color: rgba(255,255,255,0.8); margin: 15px 0 0 0; font-size: 14px;">
                Track your achievements and continue your learning journey
            </p>
        </div>
        
        <!-- WhatsApp Community -->
        <div style="background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); border-radius: 20px; padding: 35px; margin: 35px 0; text-align: center; box-shadow: 0 10px 30px rgba(37, 211, 102, 0.3);">
            <div style="margin-bottom: 20px;">
                <span style="font-size: 50px; display: block; margin-bottom: 10px;">💬</span>
                <h3 style="margin: 0; color: white; font-size: 22px; font-weight: 700;">Share Your Success!</h3>
            </div>
            <p style="color: rgba(255,255,255,0.95); margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">
                Join our WhatsApp community to celebrate your achievement with fellow students
            </p>
            <a href="https://chat.whatsapp.com/I1oZ8GhZS0Q4VoRU5lK11f" style="display: inline-block; background: white; color: #128C7E; padding: 15px 35px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.2);">
                🎉 Join Community
            </a>
        </div>
        
        <!-- Closing -->
        <p style="color: #ffffff; font-size: 16px; line-height: 1.8; text-align: center; margin: 40px 0 0 0; text-shadow: 1px 1px 3px rgba(0,0,0,0.4);">
            Congratulations once again on this outstanding achievement! 🎊<br><br>
            Best regards,<br>
            <strong style="color: #fbbf24;">The Afritech Bridge Team</strong> 🎓
        </p>
    </div>
    {get_email_footer()}
    """


def maintenance_notification_email(recipient_name, maintenance_message, start_time=None, end_time=None, duration=None, show_countdown=True):
    """
    Maintenance notification email template
    
    Args:
        recipient_name: str - Name of the recipient
        maintenance_message: str - Custom maintenance message
        start_time: datetime - When maintenance starts
        end_time: datetime - Estimated completion time
        duration: str - Human-readable duration (e.g., "2 hours")
        show_countdown: bool - Whether to emphasize the timeline
    
    Returns:
        HTML email content
    """
    from datetime import datetime
    
    # Format dates if provided
    start_time_str = start_time.strftime('%B %d, %Y at %I:%M %p') if start_time else "Shortly"
    end_time_str = end_time.strftime('%B %d, %Y at %I:%M %p') if end_time else "As soon as possible"
    
    # Calculate duration if both times provided
    if start_time and end_time and not duration:
        time_diff = end_time - start_time
        hours = time_diff.total_seconds() / 3600
        if hours < 1:
            minutes = time_diff.total_seconds() / 60
            duration = f"approximately {int(minutes)} minutes"
        else:
            duration = f"approximately {int(hours)} hours"
    
    duration_str = duration or "a few hours"
    
    return f"""
    {get_email_header()}
    <div class="email-content">
        <!-- Icon and Title -->
        <div style="text-align: center; margin-bottom: 35px;">
            <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100px; height: 100px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 10px 40px rgba(245, 158, 11, 0.4);">
                <span style="font-size: 50px;">🔧</span>
            </div>
            <h1 style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0 0 15px 0; text-shadow: 2px 2px 8px rgba(0,0,0,0.3);">
                Scheduled System Maintenance
            </h1>
            <p style="color: #fbbf24; font-size: 18px; font-weight: 600; margin: 0;">
                Important Update from Afritech Bridge LMS
            </p>
        </div>
        
        <!-- Greeting -->
        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
            Hi <strong style="color: #ffffff; font-size: 17px;">{recipient_name}</strong> 👋
        </p>
        
        <!-- Main Message -->
        <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 16px; padding: 30px; margin: 30px 0; border-left: 6px solid #f59e0b; box-shadow: 0 8px 25px rgba(245, 158, 11, 0.2);">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                        <span style="font-size: 28px;">⚠️</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <h3 style="margin: 0; color: #92400e; font-size: 20px; font-weight: 700;">Maintenance Alert</h3>
                    </td>
                </tr>
            </table>
            <p style="color: #78350f; font-size: 16px; line-height: 1.8; margin: 0;">
                {maintenance_message}
            </p>
        </div>
        
        <!-- Maintenance Schedule Details -->
        <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 8px 25px rgba(0,0,0,0.3);">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                        <span style="font-size: 28px;">📅</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Maintenance Schedule</h3>
                    </td>
                </tr>
            </table>
            
            <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 12px;">
                <tr>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 15px; font-weight: 600; width: 45%;">
                        <span style="margin-right: 8px;">🕐</span> Start Time
                    </td>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                        {start_time_str}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">✅</span> Est. Completion
                    </td>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                        {end_time_str}
                    </td>
                </tr>
                <tr>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 8px 0 0 8px; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">⏱️</span> Duration
                    </td>
                    <td style="padding: 15px 20px; background-color: #34495e; border-radius: 0 8px 8px 0; color: #ffffff; font-size: 16px; font-weight: 600;">
                        {duration_str}
                    </td>
                </tr>
            </table>
        </div>
        
        <!-- What to Expect -->
        <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 25px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                        <span style="font-size: 28px;">ℹ️</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">What to Expect</h3>
                    </td>
                </tr>
            </table>
            
            <div style="margin-top: 20px;">
                <div style="background-color: #34495e; padding: 18px 20px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #ef4444;">
                    <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.6;">
                        <span style="margin-right: 10px;">🚫</span>
                        <strong>System will be temporarily unavailable</strong> - You won't be able to access the platform during this time
                    </p>
                </div>
                
                <div style="background-color: #34495e; padding: 18px 20px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #3b82f6;">
                    <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.6;">
                        <span style="margin-right: 10px;">💾</span>
                        <strong>Your data is safe</strong> - All your progress, courses, and achievements are securely backed up
                    </p>
                </div>
                
                <div style="background-color: #34495e; padding: 18px 20px; border-radius: 10px; margin-bottom: 12px; border-left: 4px solid #10b981;">
                    <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.6;">
                        <span style="margin-right: 10px;">🎉</span>
                        <strong>Improved experience</strong> - We're working to make the platform better for you
                    </p>
                </div>
                
                <div style="background-color: #34495e; padding: 18px 20px; border-radius: 10px; border-left: 4px solid #8b5cf6;">
                    <p style="margin: 0; color: #ffffff; font-size: 15px; line-height: 1.6;">
                        <span style="margin-right: 10px;">🔔</span>
                        <strong>We'll notify you</strong> - You'll receive an email when the system is back online
                    </p>
                </div>
            </div>
        </div>
        
        <!-- Call to Action -->
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 20px; padding: 35px; text-align: center; margin: 35px 0; box-shadow: 0 10px 40px rgba(102, 126, 234, 0.3);">
            <span style="font-size: 50px; display: block; margin-bottom: 15px;">💡</span>
            <h3 style="margin: 0 0 20px 0; color: white; font-size: 22px; font-weight: 700;">Need Help?</h3>
            <p style="color: rgba(255,255,255,0.95); margin: 0 0 25px 0; font-size: 16px; line-height: 1.6;">
                If you have any urgent questions or concerns, please contact our support team
            </p>
            <a href="mailto:afritech.bridge@yahoo.com" style="display: inline-block; background: white; color: #667eea; padding: 15px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 25px rgba(0,0,0,0.2); transition: transform 0.2s;">
                📧 Contact Support
            </a>
        </div>
        
        <!-- Thank You Message -->
        <div style="text-align: center; margin-top: 40px;">
            <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 15px 0;">
                Thank you for your patience and understanding. We're committed to providing you with the best learning experience possible! 🚀
            </p>
            <p style="color: #d1d5db; font-size: 15px; margin: 20px 0 0 0;">
                Best regards,<br>
                <strong style="color: #fbbf24; font-size: 16px;">The Afritech Bridge Team</strong> 🎓
            </p>
        </div>
    </div>
    {get_email_footer()}
    """


def maintenance_completed_email(recipient_name, downtime_duration=None, improvements=None):
    """
    Maintenance completed notification email
    
    Args:
        recipient_name: str - Name of the recipient
        downtime_duration: str - How long the maintenance took
        improvements: list - List of improvements made (optional)
    
    Returns:
        HTML email content
    """
    downtime_str = downtime_duration or "the scheduled time"
    
    improvements_html = ""
    if improvements and isinstance(improvements, list):
        improvements_html = '<div style="margin-top: 20px;">'
        for improvement in improvements:
            improvements_html += f'''
                <div style="background-color: #34495e; padding: 15px 20px; border-radius: 10px; margin-bottom: 10px; border-left: 4px solid #10b981;">
                    <p style="margin: 0; color: #ffffff; font-size: 15px;">
                        <span style="margin-right: 10px;">✨</span>{improvement}
                    </p>
                </div>
            '''
        improvements_html += '</div>'
    
    return f"""
    {get_email_header()}
    <div class="email-content">
        <!-- Icon and Title -->
        <div style="text-align: center; margin-bottom: 35px;">
            <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 100px; height: 100px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 25px; box-shadow: 0 10px 40px rgba(16, 185, 129, 0.4);">
                <span style="font-size: 50px;">✅</span>
            </div>
            <h1 style="color: #ffffff; font-size: 32px; font-weight: 700; margin: 0 0 15px 0; text-shadow: 2px 2px 8px rgba(0,0,0,0.3);">
                We're Back Online!
            </h1>
            <p style="color: #10b981; font-size: 18px; font-weight: 600; margin: 0;">
                System Maintenance Completed Successfully
            </p>
        </div>
        
        <!-- Greeting -->
        <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
            Hi <strong style="color: #ffffff; font-size: 17px;">{recipient_name}</strong> 👋
        </p>
        
        <!-- Success Message -->
        <div style="background: linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%); border-radius: 16px; padding: 30px; margin: 30px 0; border-left: 6px solid #10b981; box-shadow: 0 8px 25px rgba(16, 185, 129, 0.2);">
            <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                <tr>
                    <td style="vertical-align: middle; padding-right: 12px;">
                        <span style="font-size: 28px;">🎉</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <h3 style="margin: 0; color: #065f46; font-size: 20px; font-weight: 700;">Great News!</h3>
                    </td>
                </tr>
            </table>
            <p style="color: #064e3b; font-size: 16px; line-height: 1.8; margin: 0;">
                Our scheduled maintenance has been completed successfully! The Afritech Bridge LMS is now back online and ready for you to continue your learning journey.
            </p>
        </div>
        
        {improvements_html if improvements_html else ""}
        
        <!-- CTA Button -->
        <div style="text-align: center; margin: 40px 0;">
            <a href="https://study.afritechbridge.online" style="display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 18px 50px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 18px; box-shadow: 0 10px 30px rgba(102, 126, 234, 0.4);">
                🚀 Resume Learning
            </a>
        </div>
        
        <!-- Thank You -->
        <div style="text-align: center; margin-top: 40px;">
            <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 15px 0;">
                Thank you for your patience during the maintenance period. We appreciate your understanding! 💙
            </p>
            <p style="color: #d1d5db; font-size: 15px; margin: 20px 0 0 0;">
                Best regards,<br>
                <strong style="color: #fbbf24; font-size: 16px;">The Afritech Bridge Team</strong> 🎓
            </p>
        </div>
    </div>
    {get_email_footer()}
    """