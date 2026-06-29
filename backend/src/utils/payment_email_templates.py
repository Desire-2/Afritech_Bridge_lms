"""
💰 Payment-Related Email Templates for Afritech Bridge LMS
Beautiful, responsive email designs for all payment-related actions
"""
import os
from datetime import datetime
from .email_templates import get_email_header, get_email_footer, _frontend_url
from .email_template_helpers import (
    get_cohort_info_card,
    get_payment_info_card,
    get_cohort_payment_combined_card,
    get_payment_deadline_warning
)


def _build_scholarship_badge_html(scholarship_type, scholarship_percentage, original_price, amount, currency):
    """
    🎓 Build a scholarship badge HTML snippet for use in email templates.
    Returns empty string if no scholarship info is available.

    Args:
        scholarship_type: str or None - 'full' or 'partial'
        scholarship_percentage: float or None - e.g. 95.0 for 95%
        original_price: float or None - pre-scholarship price
        amount: float - the effective (scholarship-adjusted) amount
        currency: str - currency code

    Returns:
        str - HTML badge or empty string
    """
    if scholarship_type == 'full':
        return '''
        <div style="background: linear-gradient(135deg, #059669, #047857); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #10b981;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                    <td style="width: 40px; vertical-align: middle;"><span style="font-size: 28px;">🎓</span></td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700;">Full Scholarship</p>
                        <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 13px;">100% tuition covered — no payment required</p>
                    </td>
                </tr>
            </table>
        </div>'''
    elif scholarship_type == 'partial' and scholarship_percentage and original_price and original_price > 0:
        discount_pct = float(scholarship_percentage)
        discount_amount = original_price * (discount_pct / 100.0)
        return f'''
        <div style="background: linear-gradient(135deg, #1e40af, #1d4ed8); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #3b82f6;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                    <td style="width: 40px; vertical-align: middle;"><span style="font-size: 28px;">🎓</span></td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700;">Partial Scholarship — {discount_pct:.0f}% Covered</p>
                        <p style="margin: 2px 0 0 0; color: #93c5fd; font-size: 13px;">
                            Original price: <span style="text-decoration: line-through; color: #bfdbfe;">{currency} {int(original_price):,}</span>
                            &nbsp;&nbsp;You pay: <strong style="color: #fbbf24;">{currency} {int(amount):,}</strong>
                            <span style="color: #93c5fd; font-size: 11px; margin-left: 8px;">(Saved {currency} {int(discount_amount):,})</span>
                        </p>
                    </td>
                </tr>
            </table>
        </div>'''
    return ""


def application_saved_payment_pending_email(application, course_title, payment_info, cohort_info=None, unsubscribe_token=None):
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
        cohort_info: dict with cohort details (optional)
            - cohort_label: str
            - cohort_start_date: datetime or str
            - cohort_end_date: datetime or str
            - timezone: str
        unsubscribe_token: str - User's unsubscribe token
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    deadline = payment_info.get('payment_deadline')
    payment_methods = payment_info.get('payment_methods', ['Mobile Money', 'Bank Transfer', 'PayPal'])

    # ── Resolve scholarship info from application's cohort window ──
    scholarship_type = None
    scholarship_percentage = None
    original_price = None
    try:
        if application.application_window_id:
            window = __import__('src.models.course_models', fromlist=['ApplicationWindow']).ApplicationWindow.query.get(application.application_window_id)
            if window:
                scholarship_type = getattr(window, 'scholarship_type', None)
                scholarship_percentage = getattr(window, 'scholarship_percentage', None)
                original_price = float(getattr(window, 'price', 0) or (getattr(window.course, 'price', 0) if getattr(window, 'course', None) else 0))
    except Exception:
        pass
    scholarship_badge = _build_scholarship_badge_html(scholarship_type, scholarship_percentage, original_price, amount, currency)
    
    # Extract cohort info if provided
    cohort_label = ""
    cohort_start = ""
    cohort_end = ""
    if cohort_info:
        cohort_label = cohort_info.get('cohort_label', '')
        cohort_start = cohort_info.get('cohort_start_date')
        cohort_end = cohort_info.get('cohort_end_date')
    
    # Generate cohort information card
    cohort_card = get_cohort_info_card(
        cohort_label=cohort_label,
        cohort_start_date=cohort_start,
        cohort_end_date=cohort_end,
        timezone=cohort_info.get('timezone', 'UTC') if cohort_info else 'UTC'
    )
    
    # Generate deadline warning
    deadline_warning = get_payment_deadline_warning(deadline, cohort_label)
    
    methods_html = ""
    for method in payment_methods:
        method_emoji = "💳"
        if "mobile" in method.lower() or "momo" in method.lower():
            method_emoji = "📱"
        elif "bank" in method.lower():
            method_emoji = "🏦"
        elif "paypal" in method.lower():
            method_emoji = "🅿️"
        methods_html += f'''
        <div style="background-color: #34495e; padding: 12px 20px; border-radius: 8px; margin: 8px 0; border-left: 3px solid #8b5cf6;">
            <span style="color: #ffffff; font-size: 15px; font-weight: 600;">{method_emoji} {method}</span>
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
                
                {cohort_card}
                
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
                    <!-- Scholarship info badge -->
                    {scholarship_badge}
                </div>
                
                {deadline_warning}
                
                <!-- Payment Methods -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">💳</span> Available Payment Methods
                    </h3>
                    {methods_html}
                </div>
                
                <!-- Action Button -->
                <div style="text-align: center; margin: 40px 0;">
                    <a href="{_frontend_url(f'courses/{application.course_id}/apply')}" 
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
                        feel free to contact us at <a href="mailto:afritech.bridge@yahoo.com" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
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
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def payment_confirmation_email(application, course_title, payment_details, cohort_info=None, unsubscribe_token=None, application_end_date=None):
    """
    ✅ Email sent when payment is successfully confirmed (CourseApplication level)

    Includes the cohort enrollment timeline explaining:
    - Payment confirmed
    - Student will be enrolled in the cohort after the application period
    - Login credentials will be sent before the cohort starts

    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_details: dict with payment confirmation details
            - amount_paid: float
            - currency: str
            - payment_method: str
            - payment_reference: str
            - payment_date: datetime
        cohort_info: dict with cohort details (optional)
            - cohort_label: str
            - cohort_start_date: datetime or str
            - cohort_end_date: datetime or str
            - timezone: str
        unsubscribe_token: str - User's unsubscribe token
        application_end_date: datetime or str - When the application period ends (optional)
    """
    amount = payment_details.get('amount_paid', 0)
    currency = payment_details.get('currency', 'USD')
    method = payment_details.get('payment_method', 'Payment Gateway')
    reference = payment_details.get('payment_reference', 'N/A')
    payment_date = payment_details.get('payment_date', datetime.utcnow())

    # ── Resolve scholarship info from application's cohort window ──
    scholarship_type = None
    scholarship_percentage = None
    original_price = None
    try:
        if application.application_window_id:
            window = __import__('src.models.course_models', fromlist=['ApplicationWindow']).ApplicationWindow.query.get(application.application_window_id)
            if window:
                scholarship_type = getattr(window, 'scholarship_type', None)
                scholarship_percentage = getattr(window, 'scholarship_percentage', None)
                original_price = float(getattr(window, 'price', 0) or (getattr(window.course, 'price', 0) if getattr(window, 'course', None) else 0))
    except Exception:
        pass
    scholarship_badge = _build_scholarship_badge_html(scholarship_type, scholarship_percentage, original_price, amount, currency)

    if isinstance(payment_date, str):
        date_str = payment_date
    else:
        date_str = payment_date.strftime('%b %d, %Y • %I:%M %p')
    
    # Generate cohort information card
    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )

    # Build the enrollment journey timeline
    enrollment_journey = _format_cohort_enrollment_timeline(cohort_info, application_end_date)
    
    # Extract community link from cohort_info for the 'While You Wait' section
    _community_link = 'https://chat.whatsapp.com/I1oZ8GhZS0Q4VoRU5lK11f'
    _community_label = 'WhatsApp community'
    if cohort_info:
        if cohort_info.get('community_link'):
            _community_link = cohort_info['community_link']
        if cohort_info.get('community_link_label'):
            _community_label = cohort_info['community_link_label']

    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Success Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 15px 40px rgba(16, 185, 129, 0.4);">
                        <table width="120" height="120" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 60px;">✅</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #10b981; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Confirmed! 🎉
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your Spot is Secured
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
                    Your spot is now <strong style="color: #10b981;">secured</strong>. Your enrollment will be activated in the cohort you applied for. 
                    Please review the timeline below for the next steps.
                </p>
                
                {cohort_card}
                
                <!-- Payment Receipt Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #10b981;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">🧾</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Payment Receipt</h3>
                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 12px;">Keep this for your records</p>
                            </td>
                        </tr>
                    </table>
                    
                    <!-- Scholarship info badge -->
                    {scholarship_badge}
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
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

                <!-- Enrollment Journey Timeline -->
                {enrollment_journey}

                <!-- While You Wait -->
                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 24px;">💡</span>
                            </td>
                            <td>
                                <p style="color: #60a5fa; margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">While You Wait</p>
                                <ul style="color: #bfdbfe; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                                    <li>Ensure your email address is accessible — login credentials will be sent there</li>
                                    <li>Add <strong>afritech.bridge@yahoo.com</strong> to your contacts to avoid missing emails</li>
                                    <li>Prepare a quiet study space with a reliable internet connection</li>
                                    <li>Join our <a href="{_community_link}" style="color: #34d399; text-decoration: underline;">{_community_label}</a> to connect with fellow learners</li>
                                </ul>
                            </td>
                        </tr>
                    </table>
                </div>
                
                <!-- Payment slip attached note - enhanced -->
                <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-radius: 16px; padding: 24px; margin: 25px 0; border: 1px solid #10b981; box-shadow: 0 4px 15px rgba(16,185,129,0.15);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; width: 100%;">
                        <tr>
                            <td style="text-align: center; padding-bottom: 15px;">
                                <span style="font-size: 48px;">📄</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: center;">
                                <p style="color: #6ee7b7; margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
                                    ✅ Payment Slip Ready
                                </p>
                                <p style="color: #a7f3d0; margin: 0; font-size: 14px; font-weight: 500;">
                                    Your official payment receipt is attached to this email
                                </p>
                                <div style="display: inline-block; background: rgba(16,185,129,0.15); border: 1px solid #10b981; border-radius: 10px; padding: 10px 24px; margin-top: 14px;">
                                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                                        <tr>
                                            <td style="vertical-align: middle; padding-right: 10px;">
                                                <span style="font-size: 20px;">📎</span>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                <p style="color: #d1fae5; margin: 0; font-size: 13px;">
                                                    <strong style="color: #6ee7b7;">Payment_Slip</strong> — PDF attachment<br>
                                                    <span style="color: #6ee7b7; font-size: 11px;">Keep this for your records</span>
                                                </p>
                                            </td>
                                        </tr>
                                    </table>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Questions or Need Support? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Our support team is always ready to help at<br>
                        <a href="mailto:afritech.bridge@yahoo.com" style="color: #10b981; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Thank you for choosing Afritech Bridge! We're excited to have you on board 
                    and look forward to supporting you throughout your learning journey! 🎓✨
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def payment_failed_email(application, course_title, failure_reason=None, cohort_info=None, unsubscribe_token=None):
    """
    ❌ Email sent when payment fails
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        failure_reason: str - Reason for payment failure (optional)
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
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
    
    # Generate cohort card
    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )
    
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
                
                {cohort_card}
                
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
                    <a href="{_frontend_url(f'courses/{application.course_id}/apply')}" 
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
                        <a href="mailto:afritech.bridge@yahoo.com" style="color: #f59e0b; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
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
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def payment_reminder_email(application, course_title, payment_info, cohort_info=None, unsubscribe_token=None):
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
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    days_remaining = payment_info.get('days_remaining', None)
    deadline = payment_info.get('payment_deadline')

    # ── Resolve scholarship info from application's cohort window ──
    scholarship_type = None
    scholarship_percentage = None
    original_price = None
    try:
        if application.application_window_id:
            window = __import__('src.models.course_models', fromlist=['ApplicationWindow']).ApplicationWindow.query.get(application.application_window_id)
            if window:
                scholarship_type = getattr(window, 'scholarship_type', None)
                scholarship_percentage = getattr(window, 'scholarship_percentage', None)
                original_price = float(getattr(window, 'price', 0) or (getattr(window.course, 'price', 0) if getattr(window, 'course', None) else 0))
    except Exception:
        pass
    scholarship_badge = _build_scholarship_badge_html(scholarship_type, scholarship_percentage, original_price, amount, currency)
    
    # Generate cohort card
    cohort_card = ""
    cohort_label = ""
    if cohort_info:
        cohort_label = cohort_info.get('cohort_label', '')
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_label,
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )
    
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
                    Only <strong style="font-size: 20px;">{days_remaining}</strong> day{"s" if days_remaining != 1 else ""} remaining{f" for {cohort_label}" if cohort_label else ""}
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
                
                {cohort_card}
                
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
                    <!-- Scholarship info badge -->
                    {scholarship_badge}
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
                    <a href="{_frontend_url(f'courses/{application.course_id}/apply')}" 
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
                        Contact us at <a href="mailto:afritech.bridge@yahoo.com" style="color: #f59e0b; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
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
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def _format_cohort_enrollment_timeline(cohort_info, application_end_date):
    """
    📅 Build the cohort enrollment timeline section explaining the process
    after payment is confirmed.
    """
    cohort_label = cohort_info.get('cohort_label', '') if cohort_info else ''
    cohort_start = cohort_info.get('cohort_start_date') if cohort_info else None
    cohort_end = cohort_info.get('cohort_end_date') if cohort_info else None

    # Format dates
    cohort_start_str = ""
    if cohort_start:
        if isinstance(cohort_start, str):
            cohort_start_str = cohort_start
        else:
            cohort_start_str = cohort_start.strftime('%B %d, %Y')

    cohort_end_str = ""
    if cohort_end:
        if isinstance(cohort_end, str):
            cohort_end_str = cohort_end
        else:
            cohort_end_str = cohort_end.strftime('%B %d, %Y')

    app_end_str = ""
    if application_end_date:
        if isinstance(application_end_date, str):
            app_end_str = application_end_date
        else:
            app_end_str = application_end_date.strftime('%B %d, %Y')

    has_cohort_info = bool(cohort_label or cohort_start_str or cohort_end_str)

    if not has_cohort_info:
        # Generic timeline without cohort specifics
        return f"""
        <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
            <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                <span style="margin-right: 8px;">📋</span> What Happens Next?
            </h3>

            <div style="margin: 15px 0;">
                <div style="background-color: #1e3a5f; border-left: 4px solid #10b981; border-radius: 8px; padding: 15px; margin: 12px 0;">
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">✅</span> Payment Confirmed
                    </p>
                    <p style="color: #bfdbfe; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                        Your payment has been verified. You are now confirmed for the program.
                    </p>
                </div>

                <div style="background-color: #1e3a5f; border-left: 4px solid #f59e0b; border-radius: 8px; padding: 15px; margin: 12px 0;">
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">⏳</span> Enrolling in Cohort
                    </p>
                    <p style="color: #bfdbfe; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                        You will be enrolled in the cohort you applied for once the application period ends. 
                        Our team is processing all applications and will assign you to your cohort.
                    </p>
                </div>

                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">📧</span> Enrollment Email with Login Credentials
                    </p>
                    <p style="color: #bfdbfe; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                        Before the cohort starts, you will receive an enrollment email containing your 
                        <strong style="color: #60a5fa;">login credentials</strong> to access the course platform. 
                        Please watch your inbox (including spam folder) for this important message.
                    </p>
                </div>

                <div style="background-color: #064e3b; border-left: 4px solid #22c55e; border-radius: 8px; padding: 15px; margin: 12px 0;">
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">
                        <span style="margin-right: 8px;">🚀</span> Start Learning!
                    </p>
                    <p style="color: #a7f3d0; margin: 8px 0 0 28px; font-size: 14px; line-height: 1.6;">
                        Once the cohort begins, log in with your credentials and start your learning journey!
                    </p>
                </div>
            </div>
        </div>"""

    return f"""
    <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
        <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
            <span style="margin-right: 8px;">📋</span> Your Enrollment Journey
        </h3>

        <!-- Timeline Steps -->
        <div style="margin: 15px 0;">
            <!-- Step 1: Payment Confirmed -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                <tr>
                    <td width="50" style="vertical-align: top; padding-right: 15px;">
                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #10b981 0%, #059669 100%); border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.3);">
                            <span style="color: white; font-weight: 700; font-size: 14px;">✅</span>
                        </div>
                        <div style="width: 2px; height: 100%; background: #10b981; margin: 5px auto;"></div>
                    </td>
                    <td style="vertical-align: top;">
                        <div style="background-color: #064e3b; padding: 15px 20px; border-radius: 10px;">
                            <p style="margin: 0; color: #34d399; font-size: 15px; font-weight: 600;">Payment Confirmed ✅</p>
                            <p style="margin: 5px 0 0 0; color: #a7f3d0; font-size: 13px; line-height: 1.6;">
                                Your payment has been verified. You are confirmed for <strong>{cohort_label}.</strong>
                            </p>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- Step 2: Enrollment Processing -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                <tr>
                    <td width="50" style="vertical-align: top; padding-right: 15px;">
                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(245, 158, 11, 0.3);">
                            <span style="color: white; font-weight: 700; font-size: 14px;">⏳</span>
                        </div>
                        <div style="width: 2px; height: 100%; background: #475569; margin: 5px auto;"></div>
                    </td>
                    <td style="vertical-align: top;">
                        <div style="background-color: #1e3a5f; padding: 15px 20px; border-radius: 10px;">
                            <p style="margin: 0; color: #fbbf24; font-size: 15px; font-weight: 600;">Enrollment Processing</p>
                            <p style="margin: 5px 0 0 0; color: #bfdbfe; font-size: 13px; line-height: 1.6;">
                                {"Applications close on <strong>" + app_end_str + "</strong>. " if app_end_str else ""}
                                After that, our team will process enrollments and assign you to <strong>{cohort_label}</strong>.
                            </p>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- Step 3: Credentials Email -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 15px;">
                <tr>
                    <td width="50" style="vertical-align: top; padding-right: 15px;">
                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(59, 130, 246, 0.3);">
                            <span style="color: white; font-weight: 700; font-size: 14px;">📧</span>
                        </div>
                        <div style="width: 2px; height: 100%; background: #475569; margin: 5px auto;"></div>
                    </td>
                    <td style="vertical-align: top;">
                        <div style="background-color: #1e3a5f; padding: 15px 20px; border-radius: 10px;">
                            <p style="margin: 0; color: #60a5fa; font-size: 15px; font-weight: 600;">Receive Login Credentials</p>
                            <p style="margin: 5px 0 0 0; color: #bfdbfe; font-size: 13px; line-height: 1.6;">
                                {"Before the cohort starts on <strong>" + cohort_start_str + "</strong>, " if cohort_start_str else "Before the cohort begins, "}
                                you will receive an email with your <strong style="color: #93c5fd;">username and password</strong> 
                                to access the learning platform. 
                                <span style="color: #fca5a5;">⚠️ Check your spam folder if you don't see it!</span>
                            </p>
                        </div>
                    </td>
                </tr>
            </table>

            <!-- Step 4: Start Learning -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td width="50" style="vertical-align: top; padding-right: 15px;">
                        <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); border-radius: 50%; text-align: center; line-height: 36px; box-shadow: 0 4px 10px rgba(139, 92, 246, 0.3);">
                            <span style="color: white; font-weight: 700; font-size: 14px;">🚀</span>
                        </div>
                    </td>
                    <td style="vertical-align: top;">
                        <div style="background-color: #2c3e50; padding: 15px 20px; border-radius: 10px; border: 1px solid #8b5cf6;">
                            <p style="margin: 0; color: #a78bfa; font-size: 15px; font-weight: 600;">Start Learning!</p>
                            <p style="margin: 5px 0 0 0; color: #e5e7eb; font-size: 13px; line-height: 1.6;">
                                {"Beginning <strong>" + cohort_start_str + "</strong>" if cohort_start_str else "Once the cohort starts"} — 
                                log in with your credentials and begin your learning journey! 🎓
                            </p>
                        </div>
                    </td>
                </tr>
            </table>
        </div>

        <!-- Duration Badge -->
        {f'''<div style="display: inline-block; background-color: #374151; padding: 8px 18px; border-radius: 20px; margin-top: 20px;">
            <span style="color: #94a3b8; font-size: 12px;">📅 Cohort Duration: </span>
            <span style="color: #ffffff; font-size: 13px; font-weight: 600;">{cohort_start_str}</span>
            <span style="color: #94a3b8;"> → </span>
            <span style="color: #ffffff; font-size: 13px; font-weight: 600;">{cohort_end_str}</span>
        </div>''' if cohort_start_str and cohort_end_str else ''}
    </div>"""


def enrollment_payment_confirmed_email(enrollment, course_title, payment_details, cohort_info=None, unsubscribe_token=None, application_end_date=None):
    """
    ✅ Email sent when enrollment-level payment is confirmed by admin

    Now includes a clear timeline explaining the cohort enrollment process:
    - Payment is confirmed
    - Student will be enrolled in their chosen cohort after the application period
    - Before cohort starts, they'll receive login credentials via email

    Args:
        enrollment: Enrollment object
        course_title: str - Course title
        payment_details: dict with confirmation details
            - amount_paid: float
            - currency: str
            - payment_method: str
            - payment_reference: str
            - payment_date: datetime
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
        application_end_date: datetime or str - When the application period ends (optional)
    """
    amount = payment_details.get('amount_paid', 0)
    currency = payment_details.get('currency', 'USD')
    method = payment_details.get('payment_method', 'Manual Payment')
    reference = payment_details.get('payment_reference', 'N/A')
    payment_date = payment_details.get('payment_date', datetime.utcnow())

    # ── Extract scholarship info from payment_details (now includes it from _get_payment_info_from_enrollment) ──
    scholarship_type = payment_details.get('scholarship_type')
    scholarship_percentage = payment_details.get('scholarship_percentage')
    original_price = payment_details.get('original_price')

    # Build scholarship badge HTML for the email
    scholarship_email_html = ""
    if scholarship_type == 'full':
        scholarship_email_html = '''
        <div style="background: linear-gradient(135deg, #059669, #047857); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #10b981;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                    <td style="width: 40px; vertical-align: middle;"><span style="font-size: 28px;">🎓</span></td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700;">Full Scholarship</p>
                        <p style="margin: 2px 0 0 0; color: #a7f3d0; font-size: 13px;">100% tuition covered — no payment required</p>
                    </td>
                </tr>
            </table>
        </div>'''
    elif scholarship_type == 'partial' and scholarship_percentage and original_price and original_price > 0:
        discount_pct = float(scholarship_percentage)
        discount_amount = original_price * (discount_pct / 100.0)
        scholarship_email_html = f'''
        <div style="background: linear-gradient(135deg, #1e40af, #1d4ed8); border-radius: 10px; padding: 16px 20px; margin-bottom: 20px; border: 1px solid #3b82f6;">
            <table cellpadding="0" cellspacing="0" border="0" style="width: 100%;">
                <tr>
                    <td style="width: 40px; vertical-align: middle;"><span style="font-size: 28px;">🎓</span></td>
                    <td style="vertical-align: middle;">
                        <p style="margin: 0; color: #ffffff; font-size: 15px; font-weight: 700;">Partial Scholarship — {discount_pct:.0f}% Covered</p>
                        <p style="margin: 2px 0 0 0; color: #93c5fd; font-size: 13px;">
                            Original price: <span style="text-decoration: line-through; color: #bfdbfe;">{currency} {int(original_price):,}</span>
                            &nbsp;&nbsp;You pay: <strong style="color: #fbbf24;">{currency} {int(amount):,}</strong>
                            <span style="color: #93c5fd; font-size: 11px; margin-left: 8px;">(Saved {currency} {int(discount_amount):,})</span>
                        </p>
                    </td>
                </tr>
            </table>
        </div>'''

    if isinstance(payment_date, str):
        date_str = payment_date
    else:
        date_str = payment_date.strftime('%b %d, %Y • %I:%M %p')

    student_name = enrollment.student.full_name or enrollment.student.username if enrollment.student else "Student"

    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )

    # Build the enrollment journey timeline
    enrollment_journey = _format_cohort_enrollment_timeline(cohort_info, application_end_date)

    # Extract community link from cohort_info for the 'While You Wait' section
    _community_link = 'https://chat.whatsapp.com/I1oZ8GhZS0Q4VoRU5lK11f'
    _community_label = 'WhatsApp community'
    if cohort_info:
        if cohort_info.get('community_link'):
            _community_link = cohort_info['community_link']
        if cohort_info.get('community_link_label'):
            _community_label = cohort_info['community_link_label']

    return f"""
    {get_email_header()}

            <div class="email-content" style="padding: 50px 35px;">
                <!-- Success Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); width: 120px; height: 120px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 15px 40px rgba(16, 185, 129, 0.4);">
                        <table width="120" height="120" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 60px;">✅</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #10b981; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Verified! 🎉
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Your Spot is Secured
                    </p>
                </div>

                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{student_name}</strong> 👋
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Great news! Your payment for <strong style="color: #10b981; font-size: 16px;">{course_title}</strong> 
                    has been verified by an administrator! 🚀
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Your spot in the program is now <strong style="color: #10b981;">confirmed</strong>. 
                    Your enrollment will be activated in the cohort you applied for. 
                    Please review the timeline below for the next steps.
                </p>

                {cohort_card}

                <!-- Payment Receipt Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #10b981;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">🧾</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Payment Receipt</h3>
                                <p style="margin: 5px 0 0 0; color: #bdc3c7; font-size: 12px;">Keep this for your records</p>
                            </td>
                        </tr>
                    </table>
                    <!-- Scholarship info badge -->
                    {scholarship_email_html}
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
                        <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">📚 Course</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">{course_title}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">💳 Method</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">{method}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">🔖 Reference</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; font-family: 'Courier New', monospace;">{reference}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">📅 Date</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right;">{date_str}</td>
                            </tr>
                            <tr style="border-top: 2px solid #10b981;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">💵 Amount Paid</td>
                                <td style="padding: 15px 0; color: #10b981; font-size: 24px; font-weight: 700; text-align: right;">{currency} {int(amount):,}</td>
                            </tr>
                        </table>
                    </div>
                </div>

                <!-- Enrollment Journey Timeline -->
                {enrollment_journey}

                <!-- While You Wait -->
                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 24px;">💡</span>
                            </td>
                            <td>
                                <p style="color: #60a5fa; margin: 0 0 8px 0; font-size: 15px; font-weight: 600;">While You Wait</p>
                                <ul style="color: #bfdbfe; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                                    <li>Ensure your email address is accessible — login credentials will be sent there</li>
                                    <li>Add <strong>afritech.bridge@yahoo.com</strong> to your contacts to avoid missing emails</li>
                                    <li>Prepare a quiet study space with a reliable internet connection</li>
                                    <li>Review any pre-course materials shared by the instructor</li>
                                    <li>Join our <a href="{_community_link}" style="color: #34d399; text-decoration: underline;">{_community_label}</a> to connect with fellow learners</li>
                                </ul>
                            </td>
                        </tr>
                    </table>
                </div>

                <!-- Payment slip attached note - enhanced -->
                <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-radius: 16px; padding: 24px; margin: 25px 0; border: 1px solid #10b981; box-shadow: 0 4px 15px rgba(16,185,129,0.15);">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto; width: 100%;">
                        <tr>
                            <td style="text-align: center; padding-bottom: 15px;">
                                <span style="font-size: 48px;">📄</span>
                            </td>
                        </tr>
                        <tr>
                            <td style="text-align: center;">
                                <p style="color: #6ee7b7; margin: 0 0 4px 0; font-size: 18px; font-weight: 700; letter-spacing: 0.5px;">
                                    ✅ Payment Slip Ready
                                </p>
                                <p style="color: #a7f3d0; margin: 0; font-size: 14px; font-weight: 500;">
                                    Your official payment receipt is attached to this email
                                </p>
                                <div style="display: inline-block; background: rgba(16,185,129,0.15); border: 1px solid #10b981; border-radius: 10px; padding: 10px 24px; margin-top: 14px;">
                                    <table cellpadding="0" cellspacing="0" border="0" style="margin: 0 auto;">
                                        <tr>
                                            <td style="vertical-align: middle; padding-right: 10px;">
                                                <span style="font-size: 20px;">📎</span>
                                            </td>
                                            <td style="vertical-align: middle;">
                                                <p style="color: #d1fae5; margin: 0; font-size: 13px;">
                                                    <strong style="color: #6ee7b7;">Payment_Slip</strong> — PDF attachment<br>
                                                    <span style="color: #6ee7b7; font-size: 11px;">Keep this for your records</span>
                                                </p>
                                            </td>
                        </tr>
                    </table>
                                </div>
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Thank you for choosing Afritech Bridge! We're excited to have you on board and 
                    look forward to supporting you throughout your learning journey! 🎓✨
                </p>
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br><strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def enrollment_payment_waived_email(enrollment, course_title, waiver_details=None, cohort_info=None, unsubscribe_token=None):
    """
    ✅ Email sent when enrollment payment is waived by admin

    Args:
        enrollment: Enrollment object
        course_title: str - Course title
        waiver_details: dict with waiver info (optional)
            - reason: str
            - waived_by: str
            - date: datetime
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
    """
    student_name = enrollment.student.full_name or enrollment.student.username if enrollment.student else "Student"
    reason = waiver_details.get('reason', '') if waiver_details else ''

    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )

    waiver_reason_section = ""
    if reason:
        waiver_reason_section = f'''
        <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 30px 0;">
            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">Waiver Reason</p>
            <p style="color: #bfdbfe; margin: 8px 0 0 0; font-size: 14px;">{reason}</p>
        </div>'''

    return f"""
    {get_email_header()}

            <div class="email-content" style="padding: 50px 35px;">
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(59, 130, 246, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">🎉</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #3b82f6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">Payment Waived! 🎉</h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">Course Access Activated</p>
                </div>

                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{student_name}</strong> 👋
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Great news! The payment requirement for <strong style="color: #3b82f6; font-size: 16px;">{course_title}</strong> has been waived! 🚀
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Your course access is now <strong style="color: #3b82f6;">active</strong>. You can start learning immediately.
                </p>

                {cohort_card}

                {waiver_reason_section}

                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">🎯 What's Next?</h3>
                    <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">1️⃣ Access Your Course</p>
                        <p style="color: #bfdbfe; margin: 8px 0 0 28px; font-size: 14px;">Log in and start exploring course modules.</p>
                    </div>
                    <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">2️⃣ Begin Learning</p>
                        <p style="color: #bfdbfe; margin: 8px 0 0 28px; font-size: 14px;">Progress through the course at your own pace.</p>
                    </div>
                </div>

                <div style="text-align: center; margin: 40px 0;">
                    <a href="{_frontend_url('student/mylearning')}"
                       style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);">
                        🚀 Go to My Learning
                    </a>
                </div>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Welcome aboard! 🎓✨
                </p>
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br><strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def enrollment_payment_failed_email(enrollment, course_title, failure_reason=None, cohort_info=None, unsubscribe_token=None):
    """
    ❌ Email sent when enrollment payment verification fails

    Args:
        enrollment: Enrollment object
        course_title: str - Course title
        failure_reason: str - Reason for failure (optional)
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
    """
    student_name = enrollment.student.full_name or enrollment.student.username if enrollment.student else "Student"

    reason_section = ""
    if failure_reason:
        reason_section = f'''
        <div style="background-color: #7f1d1d; border-left: 4px solid #ef4444; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">❗ Reason</p>
            <p style="color: #fecaca; margin: 8px 0 0 0; font-size: 14px;">{failure_reason}</p>
        </div>'''

    return f"""
    {get_email_header()}

            <div class="email-content" style="padding: 50px 35px;">
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(239, 68, 68, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⚠️</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #ef4444; margin: 0; font-size: 32px; font-weight: 700;">Payment Not Approved</h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">Your payment verification was not successful</p>
                </div>

                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{student_name}</strong> 👋
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    We wanted to let you know that your payment verification for <strong style="color: #ef4444; font-size: 16px;">{course_title}</strong> could not be approved.
                </p>

                {reason_section}

                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">💡 Next Steps</h3>
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">1. Review the reason above</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Understand why the payment could not be verified.</p>
                    </div>
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">2. Submit a new payment proof</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Upload a clear screenshot or receipt of your payment.</p>
                    </div>
                    <div style="background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 8px; padding: 15px; margin: 12px 0;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px; font-weight: 600;">3. Contact support if needed</p>
                        <p style="color: #d1d5db; margin: 5px 0 0 0; font-size: 13px;">Reach out to us for assistance.</p>
                    </div>
                </div>

                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">Need Help? 🤝</p>
                    <p style="color: #bdc3c7; font-size: 14px;">
                        Contact us at <a href="mailto:afritech.bridge@yahoo.com" style="color: #f59e0b; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
                    </p>
                </div>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    We're here to help you resolve this. 💪
                </p>
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br><strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def payment_submitted_unapproved_email(application, course_title, payment_info, cohort_info=None, unsubscribe_token=None):
    """
    📧 Email sent to applicants whose application was submitted but payment
    has not yet been approved by an administrator.
    
    Instructs them to send proof of payment on WhatsApp OR pay now.
    
    Args:
        application: CourseApplication object
        course_title: str - Course title
        payment_info: dict with payment details
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    deadline = payment_info.get('payment_deadline')
    payment_methods = payment_info.get('payment_methods', ['Mobile Money', 'Bank Transfer', 'PayPal'])
    
    # WhatsApp support number
    whatsapp_number = os.environ.get('WHATSAPP_SUPPORT_NUMBER', '+250780784924')
    whatsapp_link = f"https://wa.me/{whatsapp_number.replace('+', '')}?text=Payment%20Proof%20-%20Application%20%23{application.id}"
    
    # Generate cohort card
    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )
    
    # Methods HTML
    methods_html = ""
    for method in payment_methods:
        method_emoji = "💳"
        if "mobile" in method.lower() or "momo" in method.lower():
            method_emoji = "📱"
        elif "bank" in method.lower():
            method_emoji = "🏦"
        elif "paypal" in method.lower():
            method_emoji = "🅿️"
        methods_html += f'''
        <div style="background-color: #34495e; padding: 12px 20px; border-radius: 8px; margin: 8px 0; border-left: 3px solid #3b82f6;">
            <span style="color: #ffffff; font-size: 15px; font-weight: 600;">{method_emoji} {method}</span>
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
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">⏳</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Payment Action Required
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Complete Your Payment to Proceed
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{application.full_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    Your application for <strong style="color: #f59e0b; font-size: 16px;">{course_title}</strong> has been submitted successfully, 
                    but your payment has <strong style="color: #ef4444;">not yet been approved</strong>. 
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 25px 0;">
                    To proceed with your enrollment, please choose one of the following options:
                </p>
                
                <!-- Option 1: Pay Now -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 25px 0; border: 2px solid #3b82f6;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="font-size: 48px; display: block; margin-bottom: 10px;">💳</span>
                        <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Option 1: Pay Online Now</h3>
                        <p style="color: #bdc3c7; margin: 8px 0 0 0; font-size: 14px;">
                            Complete your payment instantly using any of the methods below
                        </p>
                    </div>
                    
                    <!-- Amount Card -->
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">📚 Course</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">{course_title}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">🆔 Application ID</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; font-family: 'Courier New', monospace; text-align: right;">#{application.id}</td>
                            </tr>
                            <tr style="border-top: 2px solid #3b82f6;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">💵 Amount Due</td>
                                <td style="padding: 15px 0; color: #3b82f6; font-size: 24px; font-weight: 700; text-align: right;">{currency} {int(amount):,}</td>
                            </tr>
                        </table>
                    </div>
                    
                    {methods_html}
                    
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="{_frontend_url(f'courses/{application.course_id}/apply')}" 
                           style="display: inline-block; background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(59, 130, 246, 0.4);">
                            💳 Pay Now
                        </a>
                    </div>
                </div>
                
                <!-- Option 2: Send Proof on WhatsApp -->
                <div style="background: linear-gradient(135deg, #064e3b 0%, #065f46 100%); border-radius: 16px; padding: 30px; margin: 25px 0; border: 2px solid #10b981;">
                    <div style="text-align: center; margin-bottom: 20px;">
                        <span style="font-size: 48px; display: block; margin-bottom: 10px;">📱</span>
                        <h3 style="margin: 0; color: #6ee7b7; font-size: 20px; font-weight: 700;">Option 2: Send Payment Proof via WhatsApp</h3>
                        <p style="color: #a7f3d0; margin: 8px 0 0 0; font-size: 14px;">
                            Already made a payment? Send us the proof on WhatsApp!
                        </p>
                    </div>
                    
                    <div style="background-color: rgba(0,0,0,0.2); border-radius: 12px; padding: 20px; margin-bottom: 20px;">
                        <p style="color: #d1fae5; margin: 0 0 15px 0; font-size: 14px; line-height: 1.7;">
                            <strong style="color: #6ee7b7;">📸 Steps:</strong>
                        </p>
                        <ol style="color: #d1fae5; margin: 0; padding-left: 20px; font-size: 14px; line-height: 2;">
                            <li>Make your payment via Mobile Money, Bank Transfer, or any method</li>
                            <li>Take a screenshot or photo of your payment confirmation</li>
                            <li>Send it to us on WhatsApp with your <strong style="color: #6ee7b7;">Application ID #{application.id}</strong></li>
                            <li>Our team will verify and approve your payment within 24 hours</li>
                        </ol>
                    </div>
                    
                    <div style="text-align: center; margin-top: 25px;">
                        <a href="{whatsapp_link}" 
                           style="display: inline-block; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(37, 211, 102, 0.4);" target="_blank">
                            💬 Send Proof on WhatsApp
                        </a>
                    </div>
                </div>
                
                {cohort_card}
                
                <!-- Important Notes -->
                <div style="background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 20px; margin: 25px 0;">
                    <h3 style="margin: 0 0 12px 0; color: #60a5fa; font-size: 16px; font-weight: 600;">📌 Important Notes</h3>
                    <ul style="color: #bfdbfe; margin: 0; padding-left: 20px; font-size: 13px; line-height: 1.8;">
                        <li>Your application is on hold pending payment approval</li>
                        <li>Once payment is approved, you'll get immediate access to the course</li>
                        <li>Include your Application ID when sending proof to help us process faster</li>
                        <li>Payment is processed within 24 hours of receiving proof</li>
                    </ul>
                </div>
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Need Help? We're Here! 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Contact us on WhatsApp or at 
                        <a href="mailto:afritech.bridge@yahoo.com" style="color: #3b82f6; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
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
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def payment_migrated_student_email(application, course_title, payment_info, cohort_info=None, unsubscribe_token=None):
    """
    📧 Email sent to students who were migrated from one cohort to another
    and need to pay to continue their learning.
    
    Tells them to login and pay an affordable price to proceed.
    
    Args:
        application: CourseApplication object (can be None for enrollment-based reminders)
        course_title: str - Course title
        payment_info: dict with payment details
            - amount: float
            - currency: str
            - original_cohort: str - Previous cohort name
            - new_cohort: str - New cohort name
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
        
    OR can be called with dict-based student info:
        student_name, student_email
    """
    amount = payment_info.get('amount', 0)
    currency = payment_info.get('currency', 'USD')
    original_cohort = payment_info.get('original_cohort', 'Previous Cohort')
    new_cohort = payment_info.get('new_cohort', 'New Cohort')
    
    student_name = payment_info.get('student_name', application.full_name if application else 'Student')
    
    # WhatsApp support number
    whatsapp_number = os.environ.get('WHATSAPP_SUPPORT_NUMBER', '+250780784924')
    whatsapp_link = f"https://wa.me/{whatsapp_number.replace('+', '')}?text=Payment%20-%20Migrated%20Student"
    
    # Generate cohort card
    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )
    
    return f"""
    {get_email_header()}
            
            <!-- Main Content -->
            <div class="email-content" style="padding: 50px 35px;">
                <!-- Header Icon & Title -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(139, 92, 246, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">🔄</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #8b5cf6; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        Cohort Update - Action Required!
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        Continue Your Learning Journey
                    </p>
                </div>
                
                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi <strong style="color: #ffffff; font-size: 17px;">{student_name}</strong> 👋
                </p>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    We've moved you from <strong style="color: #f59e0b;">{original_cohort}</strong> to 
                    <strong style="color: #10b981;">{new_cohort}</strong> to ensure you can continue your learning without interruption. 🎉
                </p>
                
                <!-- Migration Info Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 25px 0; border-left: 4px solid #8b5cf6;">
                    <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
                        <tr>
                            <td style="vertical-align: middle; padding-right: 12px;">
                                <span style="font-size: 28px;">🔄</span>
                            </td>
                            <td style="vertical-align: middle;">
                                <h3 style="margin: 0; color: #ffffff; font-size: 20px; font-weight: 700;">Migration Details</h3>
                            </td>
                        </tr>
                    </table>
                    
                    <div style="background-color: #1a252f; border-radius: 12px; padding: 20px;">
                        <table class="responsive-table" style="width: 100%;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">📚 Course</td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">{course_title}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">➡️ Previous Cohort</td>
                                <td style="padding: 10px 0; color: #f59e0b; font-size: 15px; text-align: right;">{original_cohort}</td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">🎯 New Cohort</td>
                                <td style="padding: 10px 0; color: #10b981; font-size: 15px; font-weight: 700; text-align: right;">{new_cohort}</td>
                            </tr>
                            <tr style="border-top: 2px solid #8b5cf6;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">💵 Amount Due</td>
                                <td style="padding: 15px 0; color: #8b5cf6; font-size: 24px; font-weight: 700; text-align: right;">{currency} {int(amount):,}</td>
                            </tr>
                        </table>
                    </div>
                </div>
                
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 20px 0;">
                    To continue accessing your course materials and proceed with your learning, 
                    please <strong style="color: #ffffff;">log into your account</strong> and complete the payment.
                </p>
                
                <!-- CTA: Login and Pay -->
                <div style="text-align: center; margin: 35px 0;">
                    <a href="{_frontend_url('auth/login')}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%); color: #ffffff; padding: 18px 45px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 17px; box-shadow: 0 8px 20px rgba(139, 92, 246, 0.4);">
                        🔐 Login &amp; Pay Now
                    </a>
                    <p style="color: #94a3b8; margin-top: 12px; font-size: 13px;">
                        Or visit <a href="{_frontend_url()}" style="color: #8b5cf6; text-decoration: underline;">{_frontend_url()}</a> and log into your account
                    </p>
                </div>
                
                <!-- What You Need to Know -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 25px 0;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                        <span style="margin-right: 8px;">📋</span> What You Need to Know
                    </h3>
                    
                    <div style="margin: 10px 0; padding: 12px 16px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 14px;">
                            ✓ Your learning progress has been <strong>preserved</strong> in the new cohort
                        </span>
                    </div>
                    <div style="margin: 10px 0; padding: 12px 16px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 14px;">
                            ✓ The new cohort offers an <strong>affordable payment option</strong> to continue
                        </span>
                    </div>
                    <div style="margin: 10px 0; padding: 12px 16px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 14px;">
                            ✓ Once payment is confirmed, you'll get <strong>full access</strong> to all course materials
                        </span>
                    </div>
                    <div style="margin: 10px 0; padding: 12px 16px; background-color: #1e3a5f; border-left: 3px solid #3b82f6; border-radius: 6px;">
                        <span style="color: #ffffff; font-size: 14px;">
                            ✓ You can send payment proof on <strong>WhatsApp</strong> for faster processing
                        </span>
                    </div>
                </div>
                
                <div style="text-align: center; margin: 20px 0;">
                    <a href="{whatsapp_link}" 
                       style="display: inline-block; background: linear-gradient(135deg, #25D366 0%, #128C7E 100%); color: #ffffff; padding: 14px 35px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; box-shadow: 0 6px 15px rgba(37, 211, 102, 0.3);" target="_blank">
                        💬 Send Proof on WhatsApp
                    </a>
                </div>
                
                {cohort_card}
                
                <!-- Support Section -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 25px; margin: 30px 0; text-align: center;">
                    <p style="color: #ffffff; font-size: 16px; font-weight: 600; margin: 0 0 10px 0;">
                        Questions About Your Cohort Change? 🤝
                    </p>
                    <p style="color: #bdc3c7; font-size: 14px; line-height: 1.6; margin: 0;">
                        Contact us at <a href="mailto:afritech.bridge@yahoo.com" style="color: #8b5cf6; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
                        or call <strong style="color: #ffffff;">+250 780 784 924</strong>
                    </p>
                </div>
                
                <!-- Closing -->
                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    We're committed to helping you succeed! 🚀
                </p>
                
                <p style="color: #bdc3c7; font-size: 14px; margin: 15px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """


def enrollment_payment_admin_alert_email(
    student_name,
    student_email,
    course_title,
    enrollment_id,
    amount,
    currency,
    payment_method,
    payment_status,
    admin_panel_url=None,
    screenshot_available=False,
):
    """
    🏪 Email sent to admin when a student submits a payment from the learning interface.

    Args:
        student_name: str - Student's name
        student_email: str - Student's email address
        course_title: str - Course title
        enrollment_id: int - Enrollment ID
        amount: float - Payment amount
        currency: str - Currency code (USD, RWF, etc.)
        payment_method: str - Payment method used (bank_transfer, momo_pay_code, etc.)
        payment_status: str - New payment status (submitted, submitted_with_proof)
        admin_panel_url: str - URL to admin payments panel
        screenshot_available: bool - Whether a screenshot was uploaded
    """
    method_labels = {
        'bank_transfer': 'Bank Transfer',
        'momo_pay_code': 'MoMo Pay Code (USSD)',
        'mobile_money': 'Mobile Money',
        'paypal': 'PayPal',
        'kpay': 'K-Pay',
        'flutterwave': 'Flutterwave',
        'stripe': 'Stripe',
    }
    method_label = method_labels.get(payment_method, payment_method.replace('_', ' ').title())
    status_label = 'With Proof (Screenshot)' if screenshot_available else 'Submitted'

    review_url = admin_panel_url or _frontend_url('admin/payments')

    screenshot_badge = ""
    if screenshot_available:
        screenshot_badge = '''
        <div style="margin-top: 15px; background-color: #1e3a5f; border-left: 4px solid #3b82f6; border-radius: 8px; padding: 12px 20px;">
            <table cellpadding="0" cellspacing="0" border="0">
                <tr>
                    <td style="vertical-align: middle; padding-right: 10px;">
                        <span style="font-size: 24px;">📎</span>
                    </td>
                    <td style="vertical-align: middle;">
                        <p style="color: #60a5fa; margin: 0; font-size: 14px;">
                            <strong>Payment screenshot uploaded</strong> — view in admin panel
                        </p>
                    </td>
                </tr>
            </table>
        </div>'''

    return f"""
    {get_email_header()}

            <div class="email-content" style="padding: 50px 35px;">
                <!-- Alert Header -->
                <div style="text-align: center; margin-bottom: 35px;">
                    <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 25px; box-shadow: 0 10px 30px rgba(245, 158, 11, 0.4);">
                        <table width="100" height="100" cellpadding="0" cellspacing="0" border="0">
                            <tr>
                                <td style="text-align: center; vertical-align: middle; font-size: 50px;">🏦</td>
                            </tr>
                        </table>
                    </div>
                    <h2 style="color: #f59e0b; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.5px;">
                        New Payment Submission
                    </h2>
                    <p style="color: #bdc3c7; margin: 10px 0 0 0; font-size: 16px;">
                        A student has submitted a payment — action required
                    </p>
                </div>

                <!-- Greeting -->
                <p style="color: #e5e7eb; font-size: 16px; line-height: 1.8; margin: 0 0 25px 0;">
                    Hi Admin 👋
                </p>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 0 0 30px 0;">
                    A payment has been submitted by <strong style="color: #ffffff;">{student_name}</strong> for <strong style="color: #f59e0b;">{course_title}</strong>.
                    Please review and verify the payment in the admin panel.
                </p>

                <!-- Payment Details Card -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #f59e0b;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
                        <span style="margin-right: 8px;">📋</span> Payment Details
                    </h3>

                    <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
                        <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 10px;">
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">👤</span> Student
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">
                                    {student_name}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">📧</span> Email
                                </td>
                                <td style="padding: 10px 0; color: #60a5fa; font-size: 15px; text-align: right;">
                                    {student_email}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">📚</span> Course
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 600; text-align: right;">
                                    {course_title}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">🆔</span> Enrollment ID
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 14px; text-align: right; font-family: 'Courier New', monospace;">
                                    #{enrollment_id}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">💳</span> Payment Method
                                </td>
                                <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                                    {method_label}
                                </td>
                            </tr>
                            <tr>
                                <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px;">
                                    <span style="margin-right: 8px;">📊</span> Status
                                </td>
                                <td style="padding: 10px 0; text-align: right;">
                                    <span style="background: #3b82f6; color: #ffffff; padding: 4px 14px; border-radius: 12px; font-size: 13px; font-weight: 700;">
                                        {status_label}
                                    </span>
                                </td>
                            </tr>
                            <tr style="border-top: 2px solid #f59e0b;">
                                <td style="padding: 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                                    <span style="margin-right: 8px;">💵</span> Amount
                                </td>
                                <td style="padding: 15px 0; color: #f59e0b; font-size: 24px; font-weight: 700; text-align: right;">
                                    {currency} {int(amount):,}
                                </td>
                            </tr>
                        </table>
                    </div>

                    {screenshot_badge}
                </div>

                <!-- Action Required -->
                <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; border: 2px solid #3b82f6;">
                    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
                        <span style="margin-right: 8px;">🎯</span> Action Required
                    </h3>
                    <ol style="color: #d1d5db; font-size: 15px; line-height: 2; margin: 0; padding-left: 25px;">
                        <li>Log into the <strong style="color: #ffffff;">admin payments panel</strong></li>
                        <li>Review the payment details submitted by the student</li>
                        <li>Verify the payment method and amount match</li>
                        <li>Confirm or reject the payment</li>
                    </ol>

                    <div style="text-align: center; margin: 25px 0 10px 0;">
                        <a href="{review_url}" 
                           style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 16px; box-shadow: 0 8px 20px rgba(245, 158, 11, 0.3);">
                            🚀 Open Admin Payments Panel
                        </a>
                    </div>
                </div>

                <!-- Quick Summary -->
                <div style="background-color: #2c3e50; border-radius: 12px; padding: 20px; margin: 30px 0;">
                    <table cellpadding="0" cellspacing="0" border="0">
                        <tr>
                            <td style="vertical-align: top; padding-right: 12px;">
                                <span style="font-size: 24px;">ℹ️</span>
                            </td>
                            <td style="vertical-align: top;">
                                <p style="color: #bdc3c7; margin: 0; font-size: 13px; line-height: 1.7;">
                                    This is an automatic notification sent when a student initiates or submits
                                    a payment from the learning interface. The payment will not be active until
                                    an admin reviews and confirms it.
                                </p>
                            </td>
                        </tr>
                    </table>
                </div>

                <p style="color: #d1d5db; font-size: 15px; line-height: 1.8; margin: 30px 0 0 0;">
                    Best regards,<br>
                    <strong style="color: #ffffff;">The Afritech Bridge Team</strong> 💙
                </p>
            </div>

    {get_email_footer(email_category='system')}
    """


def payment_refund_email(application, course_title, refund_details, cohort_info=None, unsubscribe_token=None):
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
        cohort_info: dict with cohort details (optional)
        unsubscribe_token: str - User's unsubscribe token
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
    
    # Generate cohort card
    cohort_card = ""
    if cohort_info:
        cohort_card = get_cohort_info_card(
            cohort_label=cohort_info.get('cohort_label', ''),
            cohort_start_date=cohort_info.get('cohort_start_date'),
            cohort_end_date=cohort_info.get('cohort_end_date'),
            timezone=cohort_info.get('timezone', 'UTC')
        )
    
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
                
                {cohort_card}
                
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
                        <a href="mailto:afritech.bridge@yahoo.com" style="color: #3b82f6; text-decoration: none; font-weight: 600;">afritech.bridge@yahoo.com</a>
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
            
    {get_email_footer(unsubscribe_token=unsubscribe_token, email_category='enrollment')}
    """
