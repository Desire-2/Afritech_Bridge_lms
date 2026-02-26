"""
💰 Payment-Related Email Templates for Afritech Bridge LMS
Beautiful, responsive email designs for all payment-related actions
"""
from datetime import datetime
from .email_templates import get_email_header, get_email_footer


def application_saved_payment_pending_email(application, course_title, payment_info):
    """
    📧 Email sent when applicant saves application for a course requiring payment
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_info: dict with payment details
            - amount: float
            - currency: str
            - payment_deadline: datetime (optional)
            - payment_methods: list (optional)
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    deadline = payment_info.get('payment_deadline')
    payment_methods = payment_info.get('payment_methods', ['Mobile Money', 'Bank Transfer', 'PayPal'])
    
    deadline_section = ""
    if deadline:
        if isinstance(deadline, str):
            deadline_str = deadline
        else:
            deadline_str = deadline.strftime('%b %d, %Y • %I:%M %p')
        deadline_section = f'''
        <div style="background-color: #7c2d12; border-left: 4px solid #f97316; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="vertical-align: top; padding-right: 12px;">
                        <span style="font-size: 24px;">⏰</span>
                    </td>
                    <td>
                        <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">Payment Deadline</p>
                        <p style="color: #fed7aa; margin: 5px 0 0 0; font-size: 14px; line-height: 1.6;">
                            Please complete your payment by <strong style="color: #ffffff;">{deadline_str}</strong> to secure your spot in the course.
                        </p>
                    </td>
                </tr>
            </table>
        </div>'''
    
    methods_html = ""
    for method in payment_methods:
        methods_html += f'''
        <div style="background-color: #34495e; padding: 12px 20px; border-radius: 8px; margin: 8px 0; border-left: 3px solid #8b5cf6;">
            <span style="color: #ffffff; font-size: 15px; font-weight: 600;">✓ {method}</span>
        </div>'''
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">💳</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #8b5cf6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Application Saved!
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Complete Your Payment to Finalize Enrollment
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Great news! Your application for <strong style="color: #8b5cf6; font-size: 16px;">{course_title}</strong> has been saved successfully. 🎉
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    To complete your enrollment and secure your spot in the course, please proceed with the payment using any of the available methods below.
                </p>
                
                <!-- Payment Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #8b5cf6;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 32px;">💰</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Payment Information</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px; margin: 20px 0;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="padding: 12px 0; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📚</span> Course
                                </td>
                                <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 600; text-align: right;">
                                    {course_title}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🆔</span> Application ID
                                </td>
                                <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 700; text-align: right; font-family: 'Courier New', monospace;">
                                    #{application.id}
                                </td>
                            </tr>
                            <tr style="border-top: 2px solid #8b5cf6;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                                    <span style="margin-right: 8px;">💵</span> Amount Due
                                </td>
                                <td style="padding: 15px 0; color: #8b5cf6; font-size: 24px; font-weight: 700; text-align: right;">
                                    {currency} {int(amount):,}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                {deadline_section}
                
                <!-- Payment Methods -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">💳</span> Available Payment Methods
                    </h3>
                    {methods_html}
                </div>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://study.Afritechhbridge.online/student/courses/apply?applicationId={application.id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4); transition: all 0.3s ease;">
                        💳 Complete Payment Now
                    </a>
                </div>
                
                <!-- Important Notes -->
                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
                    <h3 style="margin: 0 0 15px 0; color: #60a5fa; font-size: 18px; font-weight: 700;">
                        📌 Important Notes
                    </h3>
                    <ul style="color: #d1d5db; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                        <li style="margin: 8px 0;">Your application will remain saved and can be accessed anytime</li>
                        <li style="margin: 8px 0;">You'll receive a confirmation email once your payment is verified</li>
                        <li style="margin: 8px 0;">After payment confirmation, you'll get instant access to course materials</li>
                        <li style="margin: 8px 0;">Keep your application ID (#{application.id}) for reference</li>
                    </ul>
                </div>
                
                <!-- Need Help Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Need Help? We're Here! 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        If you have any questions about the payment process or need assistance,<br>
                        feel free to contact us at <a href="mailto:support@Afritechhbridge.online" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">support@Afritechhbridge.online</a>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    We're excited to have you join our learning community! 🚀
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer()}
    """


def payment_confirmation_email(application, course_title, payment_details):
    """
    ✅ Email sent when payment is successfully confirmed
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_details: dict with payment confirmation details
            - amount_paid: float
            - currency: str
            - payment_method: str
            - payment_reference: str
            - payment_date: datetime
    """
    amount = payment_details.get('amount_paid', 0)
    currency = payment_details.get('currency', 'USD')
    method = payment_details.get('payment_method', 'Payment Gateway')
    reference = payment_details.get('payment_reference', 'N/A')
    payment_date = payment_details.get('payment_date', datetime.utcnow())
    
    if isinstance(payment_date, str):
        date_str = payment_date
    else:
        date_str = payment_date.strftime('%b %d, %Y • %I:%M %p')
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Success Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 15px 40px rgba(16, 185, 129, 0.4); animation: pulse 2s infinite;">
                        <table width="120" height="120" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 60px;">✅</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #10b981; margin: 0; font-size: 36px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Confirmed! 🎉
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Welcome to the Course - Let's Start Learning!
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Excellent news! Your payment for <strong style="color: #10b981; font-size: 16px;">{course_title}</strong> has been successfully confirmed! 🚀
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    You now have full access to all course materials, and we're thrilled to have you as part of our learning community!
                </p>
                
                <!-- Payment Receipt Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #10b981;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 32px;">🧾</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Payment Receipt</h3>
                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 13px;">Keep this for your records</p>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px; margin: 20px 0;">
                        <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📚</span> Course
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">
                                    {course_title}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🆔</span> Application ID
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 700; text-align: right; font-family: 'Courier New', monospace;">
                                    #{application.id}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">💳</span> Payment Method
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                                    {method}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🔖</span> Reference
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; font-family: 'Courier New', monospace;">
                                    {reference}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📅</span> Date
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">
                                    {date_str}
                                </td>
                            </tr>
                            <tr style="border-top: 2px solid #10b981;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                                    <span style="margin-right: 8px;">💵</span> Amount Paid
                                </td>
                                <td style="padding: 15px 0; color: #10b981; font-size: 24px; font-weight: 700; text-align: right;">
                                    {currency} {int(amount):,}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Next Steps -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">🎯</span> What's Next?
                    </h3>
                    
                    <div style="margin: 15px 0;">
                        <div style="background-color: #064e3b; border-left: 4px solid #10b981; border-radius: 8px; padding: 15px; margin: 12px 0;">
                            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                                <span style="margin-right: 8px;">1️⃣</span> Access Your Dashboard
                            </p>
                            <p style="color: #a7f3d0; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                                Log in to your student dashboard to start exploring course modules and lessons
                            </p>
                        </div>
                        
                        <div style="background-color: #064e3b; border-left: 4px solid #10b981; border-radius: 8px; padding: 15px; margin: 12px 0;">
                            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                                <span style="margin-right: 8px;">2️⃣</span> Review Course Materials
                            </p>
                            <p style="color: #a7f3d0; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                                Familiarize yourself with the syllabus and download any required materials
                            </p>
                        </div>
                        
                        <div style="background-color: #064e3b; border-left: 4px solid #10b981; border-radius: 8px; padding: 15px; margin: 12px 0;">
                            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                                <span style="margin-right: 8px;">3️⃣</span> Start Learning!
                            </p>
                            <p style="color: #a7f3d0; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                                Begin with Module 1 and progress at your own pace
                            </p>
                        </div>
                    </div>
                </div>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://study.Afritechhbridge.online/student/dashboard" 
                       style="display: inline-block; background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4);">
                        🚀 Go to Dashboard
                    </a>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Questions or Need Support? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Our support team is always ready to help at<br>
                        <a href="mailto:support@Afritechhbridge.online" style="color: #10b981; text-decoration: none; font-weight: 600;">support@Afritechhbridge.online</a>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Welcome aboard! We're excited to support you on your learning journey! 🎓✨
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer()}
    """


def payment_failed_email(application, course_title, failure_reason=None):
    """
    ❌ Email sent when payment fails
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        failure_reason: str - Reason for payment failure (optional)
    """
    reason_section = ""
    if failure_reason:
        reason_section = f'''
        <div style="background-color: #7f1d1d; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                <span style="margin-right: 8px;">❗</span> Failure Reason
            </p>
            <p style="color: #fecaca; margin: 8px 0 0 0; font-size: 14px; line-height: 1.6;">
                {failure_reason}
            </p>
        </div>'''
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Alert Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⚠️</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #ef4444; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Failed
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Don't worry - You can try again
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    We wanted to notify you that your payment for <strong style="color: #ef4444; font-size: 16px;">{course_title}</strong> could not be processed.
                </p>
                
                {reason_section}
                
                <!-- Application Details -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">📋</span> Application Details
                    </h3>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 20px;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">🆔</span> Application ID
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 700; text-align: right; font-family: 'Courier New', monospace;">
                                    #{application.id}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">📚</span> Course
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                                    {course_title}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Common Issues & Solutions -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">💡</span> Common Issues & Solutions
                    </h3>
                    
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">Insufficient Funds</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px; line-height: 1.6;">
                            Please ensure you have sufficient balance in your account
                        </p>
                    </div>
                    
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">Incorrect Payment Details</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px; line-height: 1.6;">
                            Double-check your card number, expiry date, and CVV
                        </p>
                    </div>
                    
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">Network Issues</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px; line-height: 1.6;">
                            Try again with a stable internet connection
                        </p>
                    </div>
                </div>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://study.Afritechhbridge.online/student/courses/apply?applicationId={application.id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);">
                        🔄 Try Payment Again
                    </a>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Still Having Issues? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Our support team is here to help at<br>
                        <a href="mailto:support@Afritechhbridge.online" style="color: #f59e0b; text-decoration: none; font-weight: 600;">support@Afritechhbridge.online</a>
                        <br><br>
                        Or call us at: <strong style="color: #ffffff;">+237 XXX XXX XXX</strong>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Don't let this setback discourage you! We're here to help you complete your enrollment. 💪
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer()}
    """


def payment_reminder_email(application, course_title, payment_info):
    """
    ⏰ Payment reminder email for pending payments
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_info: dict with payment details
            - amount: float
            - currency: str
            - days_remaining: int (optional)
            - payment_deadline: datetime (optional)
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    days_remaining = payment_info.get('days_remaining', None)
    deadline = payment_info.get('payment_deadline')
    
    urgency_section = ""
    if deadline:
        if isinstance(deadline, str):
            deadline_str = deadline
        else:
            deadline_str = deadline.strftime('%b %d, %Y')
        
        if days_remaining is not None:
            if days_remaining <= 1:
                urgency_color = "#dc2626"
                urgency_icon = "🚨"
                urgency_text = "URGENT - Payment due very soon!"
            elif days_remaining <= 3:
                urgency_color = "#f59e0b"
                urgency_icon = "⚠️"
                urgency_text = "Payment deadline approaching"
            else:
                urgency_color = "#3b82f6"
                urgency_icon = "ℹ️"
                urgency_text = "Friendly payment reminder"
            
            urgency_section = f'''
            <div style="background: linear-gradient(135deg, {urgency_color} 0%, {urgency_color}dd 100%); border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center; box-shadow: 0 8px 20px rgba(0,0,0,0.3);">
                <p style="color: #ffffff; margin: 0; font-size: 32px; font-weight: 700;">
                    {urgency_icon}
                </p>
                <p style="color: #ffffff; margin: 15px 0 0 0; font-size: 18px; font-weight: 700;">
                    {urgency_text}
                </p>
                <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">
                    Only <strong style="font-size: 20px;">{days_remaining}</strong> day{"s" if days_remaining != 1 else ""} remaining
                </p>
                <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0 0; font-size: 14px;">
                    Deadline: {deadline_str}
                </p>
            </div>'''
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⏰</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Reminder
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Complete Your Enrollment Today
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    This is a friendly reminder that your payment for <strong style="color: #f59e0b; font-size: 16px;">{course_title}</strong> is still pending.
                </p>
                
                {urgency_section}
                
                <!-- Payment Details -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #f59e0b;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">💰</span> Payment Summary
                    </h3>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="padding: 12px 0; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📚</span> Course
                                </td>
                                <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 600; text-align: right;">
                                    {course_title}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 12px 0; color: #bdc3c7; font-size: 15px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🆔</span> Application ID
                                </td>
                                <td style="padding: 12px 0; color: #ffffff; font-size: 16px; font-weight: 700; text-align: right; font-family: 'Courier New', monospace;">
                                    #{application.id}
                                </td>
                            </tr>
                            <tr style="border-top: 2px solid #f59e0b;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                                    <span style="margin-right: 8px;">💵</span> Amount Due
                                </td>
                                <td style="padding: 15px 0; color: #f59e0b; font-size: 24px; font-weight: 700; text-align: right;">
                                    {currency} {int(amount):,}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Benefits Reminder -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">🎁</span> What You'll Get
                    </h3>
                    
                    <div style="margin: 12px 0; padding: 12px 15px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 15px;">✓ Full access to all course materials</span>
                    </div>
                    <div style="margin: 12px 0; padding: 12px 15px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 15px;">✓ Interactive lessons and exercises</span>
                    </div>
                    <div style="margin: 12px 0; padding: 12px 15px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 15px;">✓ Direct support from instructors</span>
                    </div>
                    <div style="margin: 12px 0; padding: 12px 15px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 15px;">✓ Certificate upon completion</span>
                    </div>
                </div>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="https://study.Afritechhbridge.online/student/courses/apply?applicationId={application.id}" 
                       style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.4);">
                        💳 Complete Payment Now
                    </a>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Need Help with Payment? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Contact us at <a href="mailto:support@Afritechhbridge.online" style="color: #f59e0b; text-decoration: none; font-weight: 600;">support@Afritechhbridge.online</a>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    We're looking forward to having you in the course! 🚀
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer()}
    """


def payment_refund_email(application, course_title, refund_details):
    """
    💸 Email sent when a payment is refunded
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        refund_details: dict with refund information
            - refund_amount: float
            - currency: str
            - refund_reference: str
            - refund_reason: str
            - refund_date: datetime
            - processing_days: int (optional)
    """
    amount = refund_details.get('refund_amount', 0)
    currency = refund_details.get('currency', 'USD')
    reference = refund_details.get('refund_reference', 'N/A')
    reason = refund_details.get('refund_reason', 'As requested')
    refund_date = refund_details.get('refund_date', datetime.utcnow())
    processing_days = refund_details.get('processing_days', '5-10 business days')
    
    if isinstance(refund_date, str):
        date_str = refund_date
    else:
        date_str = refund_date.strftime('%b %d, %Y • %I:%M %p')
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">💸</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #3b82f6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Refund Processed
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your payment has been refunded
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Your payment for <strong style="color: #3b82f6; font-size: 16px;">{course_title}</strong> has been refunded.
                </p>
                
                <!-- Refund Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #3b82f6;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 700;">
                        <span style="margin-right: 8px;">🧾</span> Refund Details
                    </h3>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
                        <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🆔</span> Application ID
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 700; text-align: right; font-family: 'Courier New', monospace;">
                                    #{application.id}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">🔖</span> Refund Reference
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; font-family: 'Courier New', monospace;">
                                    {reference}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📅</span> Processed Date
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">
                                    {date_str}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                                    <span style="margin-right: 8px;">📝</span> Reason
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">
                                    {reason}
                                </td>
                            </tr>
                            <tr style="border-top: 2px solid #3b82f6;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                                    <span style="margin-right: 8px;">💵</span> Refund Amount
                                </td>
                                <td style="padding: 15px 0; color: #3b82f6; font-size: 24px; font-weight: 700; text-align: right;">
                                    {currency} {int(amount):,}
                                </td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <!-- Processing Info -->
                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 24px;">ℹ️</span>
                            </td>
                            <td>
                                <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">Processing Time</p>
                                <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px; line-height: 1.6;">
                                    Your refund will appear in your original payment method within <strong style="color: #ffffff;">{processing_days}</strong>.
                                    The exact timing may vary depending on your bank or payment provider.
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Questions About Your Refund? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Our support team is here to help at<br>
                        <a href="mailto:support@Afritechhbridge.online" style="color: #3b82f6; text-decoration: none; font-weight: 600;">support@Afritechhbridge.online</a>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    We're sorry to see you go, but we hope to have you back in future courses! 💙
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong>
                </p>
            </div>
            
    {get_email_footer()}
    """
