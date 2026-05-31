"""
✨ Email Template Helper Functions
Reusable components for cohort and payment information across all email templates
"""
from datetime import datetime


def get_cohort_info_card(cohort_label=None, cohort_start_date=None, cohort_end_date=None, 
                         timezone="UTC", include_duration=True):
    """
    📚 Generate a cohort information card for email templates
    
    Args:
        cohort_label: str - Cohort label/name (e.g., "Cohort 2025-Q1")
        cohort_start_date: datetime or str - Cohort start date
        cohort_end_date: datetime or str - Cohort end date
        timezone: str - Timezone for dates
        include_duration: bool - Whether to calculate and show duration
    
    Returns:
        str - HTML cohort information card
    """
    if not cohort_label and not cohort_start_date:
        return ""  # Return empty if no cohort info provided
    
    # Format dates
    start_str = ""
    end_str = ""
    duration_str = ""
    
    if cohort_start_date:
        if isinstance(cohort_start_date, str):
            start_str = cohort_start_date
        else:
            start_str = cohort_start_date.strftime('%b %d, %Y')
    
    if cohort_end_date:
        if isinstance(cohort_end_date, str):
            end_str = cohort_end_date
        else:
            end_str = cohort_end_date.strftime('%b %d, %Y')
        
        # Calculate duration if both dates provided
        if include_duration and cohort_start_date and cohort_end_date:
            if not isinstance(cohort_start_date, str) and not isinstance(cohort_end_date, str):
                delta = cohort_end_date - cohort_start_date
                weeks = delta.days // 7
                if weeks > 0:
                    duration_str = f" • {weeks} weeks"
    
    # Build table rows
    rows = ""
    
    if cohort_label:
        rows += f"""
        <tr>
            <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                <span style="margin-right: 8px;">🎯</span> Cohort
            </td>
            <td style="padding: 10px 0; color: #ffffff; font-size: 15px; font-weight: 700; text-align: right;">
                {cohort_label}
            </td>
        </tr>"""
    
    if start_str:
        rows += f"""
        <tr>
            <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                <span style="margin-right: 8px;">📅</span> Start Date
            </td>
            <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                {start_str}
            </td>
        </tr>"""
    
    if end_str:
        rows += f"""
        <tr>
            <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                <span style="margin-right: 8px;">🏁</span> End Date
            </td>
            <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                {end_str}{duration_str}
            </td>
        </tr>"""
    
    if timezone and timezone != "UTC":
        rows += f"""
        <tr>
            <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                <span style="margin-right: 8px;">🌍</span> Timezone
            </td>
            <td style="padding: 10px 0; color: #ffffff; font-size: 15px; text-align: right;">
                {timezone}
            </td>
        </tr>"""
    
    if not rows:
        return ""
    
    return f"""
    <!-- Cohort Information Card -->
    <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-left: 4px solid #667eea;">
        <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
            <span style="margin-right: 8px;">📚</span> Cohort Information
        </h3>
        
        <div style="background-color: #1a252f; border-radius: 12px; padding: 20px;">
            <table class="responsive-table" style="width: 100%;">
                {rows}
            </table>
        </div>
    </div>"""


def get_payment_info_card(amount=None, currency="USD", payment_required=False, 
                          payment_mode="full", payment_deadline=None, 
                          partial_amount=None, partial_percentage=None,
                          payment_methods=None, include_title=True):
    """
    💰 Generate a payment information card for email templates
    
    Args:
        amount: float - Full payment amount
        currency: str - Currency code (USD, EUR, etc.)
        payment_required: bool - Whether payment is required
        payment_mode: str - "full" or "partial"
        payment_deadline: datetime or str - Payment deadline
        partial_amount: float - Fixed partial payment amount
        partial_percentage: float - Partial payment percentage (e.g., 50.0 for 50%)
        payment_methods: list - Available payment methods
        include_title: bool - Include the card title
    
    Returns:
        str - HTML payment information card
    """
    if not payment_required or not amount:
        return ""
    
    # Format payment details
    total_display = f"{currency} {int(amount):,}" if amount else f"{currency} 0"
    
    # Calculate partial payment if applicable
    partial_display = ""
    if payment_mode == "partial":
        if partial_amount:
            partial_display = f"<tr><td style=\"padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;\"><span style=\"margin-right: 8px;\">💳</span> Partial Payment</td><td style=\"padding: 10px 0; color: #fbbf24; font-size: 15px; font-weight: 700; text-align: right;\">{currency} {int(partial_amount):,}</td></tr>"
        elif partial_percentage and amount:
            partial_amt = amount * (partial_percentage / 100)
            partial_display = f"<tr><td style=\"padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;\"><span style=\"margin-right: 8px;\">💳</span> Partial Payment ({partial_percentage:.0f}%)</td><td style=\"padding: 10px 0; color: #fbbf24; font-size: 15px; font-weight: 700; text-align: right;\">{currency} {int(partial_amt):,}</td></tr>"
    
    # Format deadline
    deadline_str = ""
    if payment_deadline:
        if isinstance(payment_deadline, str):
            deadline_str = payment_deadline
        else:
            deadline_str = payment_deadline.strftime('%b %d, %Y • %I:%M %p')
    
    deadline_section = ""
    if deadline_str:
        deadline_section = f"""
        <tr style="border-top: 2px solid #f59e0b;">
            <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                <span style="margin-right: 8px;">⏰</span> Payment Deadline
            </td>
            <td style="padding: 10px 0; color: #fbbf24; font-size: 15px; font-weight: 700; text-align: right;">
                {deadline_str}
            </td>
        </tr>"""
    
    # Format payment methods
    methods_list = ""
    if payment_methods:
        for method in payment_methods:
            method_emoji = "💳"
            if "mobile" in method.lower() or "momo" in method.lower():
                method_emoji = "📱"
            elif "bank" in method.lower():
                method_emoji = "🏦"
            elif "paypal" in method.lower():
                method_emoji = "🅿️"
            elif "card" in method.lower():
                method_emoji = "💳"
            
            methods_list += f"""
        <div style="background-color: #34495e; padding: 12px 20px; border-radius: 8px; margin: 8px 0; border-left: 3px solid #8b5cf6;">
            <span style="color: #ffffff; font-size: 15px; font-weight: 600;">{method_emoji} {method}</span>
        </div>"""
    
    title_section = ""
    if include_title:
        title_section = """
        <table cellpadding="0" cellspacing="0" border="0" style="margin-bottom: 20px;">
            <tr>
                <td style="vertical-align: middle; padding-right: 12px;">
                    <span style="font-size: 32px;">💰</span>
                </td>
                <td style="vertical-align: middle;">
                    <h3 style="margin: 0; color: #ffffff; font-size: 22px; font-weight: 700;">Payment Information</h3>
                </td>
            </tr>
        </table>"""
    
    return f"""
    <!-- Payment Information Card -->
    <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #f59e0b;">
        {title_section}
        
        <div style="background-color: #1a252f; border-radius: 12px; padding: 25px; margin: 20px 0;">
            <table class="responsive-table" style="width: 100%; border-collapse: separate; border-spacing: 0 8px;">
                <tr>
                    <td style="padding: 10px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;">
                        <span style="margin-right: 8px;">💵</span> Amount Due
                    </td>
                    <td style="padding: 10px 0; color: #f59e0b; font-size: 18px; font-weight: 700; text-align: right;">
                        {total_display}
                    </td>
                </tr>
                {partial_display}
                {deadline_section}
            </table>
        </div>
        {f'''
        <h3 style="margin: 25px 0 15px 0; color: #ffffff; font-size: 18px; font-weight: 700;">
            <span style="margin-right: 8px;">💳</span> Available Payment Methods
        </h3>
        {methods_list}
        ''' if methods_list else ''}
    </div>"""


def get_cohort_payment_combined_card(cohort_label=None, cohort_start_date=None, 
                                     cohort_end_date=None, timezone="UTC",
                                     amount=None, currency="USD", 
                                     payment_required=False, payment_mode="full",
                                     payment_deadline=None):
    """
    🎓💰 Generate a combined cohort and payment information card
    
    Combines cohort and payment info in one unified card for enrollment-related emails
    
    Args:
        cohort_label: str - Cohort label
        cohort_start_date: datetime or str - Cohort start date
        cohort_end_date: datetime or str - Cohort end date
        timezone: str - Timezone
        amount: float - Payment amount
        currency: str - Currency code
        payment_required: bool - Whether payment is required
        payment_mode: str - "full" or "partial"
        payment_deadline: datetime or str - Payment deadline
    
    Returns:
        str - HTML combined information card
    """
    if not cohort_label and not cohort_start_date and not (payment_required and amount):
        return ""
    
    # Format dates
    start_str = ""
    end_str = ""
    if cohort_start_date:
        if isinstance(cohort_start_date, str):
            start_str = cohort_start_date
        else:
            start_str = cohort_start_date.strftime('%b %d, %Y')
    
    if cohort_end_date:
        if isinstance(cohort_end_date, str):
            end_str = cohort_end_date
        else:
            end_str = cohort_end_date.strftime('%b %d, %Y')
    
    # Build rows
    rows = ""
    
    if cohort_label:
        rows += f"""<tr><td style="padding: 12px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;"><span style="margin-right: 8px;">🎯</span> Cohort</td><td style="padding: 12px 0; color: #ffffff; font-size: 15px; font-weight: 700; text-align: right;">{cohort_label}</td></tr>"""
    
    if start_str:
        rows += f"""<tr><td style="padding: 12px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;"><span style="margin-right: 8px;">📅</span> Starts</td><td style="padding: 12px 0; color: #ffffff; font-size: 15px; text-align: right;">{start_str}</td></tr>"""
    
    if end_str:
        rows += f"""<tr><td style="padding: 12px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;"><span style="margin-right: 8px;">🏁</span> Ends</td><td style="padding: 12px 0; color: #ffffff; font-size: 15px; text-align: right;">{end_str}</td></tr>"""
    
    if payment_required and amount:
        total_display = f"{currency} {int(amount):,}"
        rows += f"""<tr style="border-top: 2px solid #f59e0b; border-bottom: 2px solid #f59e0b;"><td style="padding: 12px 0; color: #bdc3c7; font-size: 14px; font-weight: 600;"><span style="margin-right: 8px;">💰</span> Amount</td><td style="padding: 12px 0; color: #f59e0b; font-size: 18px; font-weight: 700; text-align: right;">{total_display}</td></tr>"""
    
    if not rows:
        return ""
    
    return f"""
    <!-- Enrollment Information Card -->
    <div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-left: 4px solid #667eea;">
        <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
            <span style="margin-right: 8px;">📚</span> Enrollment Details
        </h3>
        
        <div style="background-color: #1a252f; border-radius: 12px; padding: 25px;">
            <table class="responsive-table" style="width: 100%;">
                {rows}
            </table>
        </div>
    </div>"""


def get_payment_deadline_warning(deadline, cohort_label=None):
    """
    ⏰ Generate a payment deadline warning/alert section
    
    Args:
        deadline: datetime or str - Payment deadline
        cohort_label: str - Cohort label (optional)
    
    Returns:
        str - HTML warning section
    """
    if not deadline:
        return ""
    
    if isinstance(deadline, str):
        deadline_str = deadline
    else:
        deadline_str = deadline.strftime('%b %d, %Y • %I:%M %p')
    
    cohort_text = f" for cohort <strong>{cohort_label}</strong>" if cohort_label else ""
    
    return f"""
    <!-- Payment Deadline Warning -->
    <div style="background-color: #7c2d12; border-left: 4px solid #f97316; border-radius: 8px; padding: 20px; margin: 25px 0;">
        <table cellpadding="0" cellspacing="0" border="0">
            <tr>
                <td style="vertical-align: top; padding-right: 12px;">
                    <span style="font-size: 24px;">⏰</span>
                </td>
                <td>
                    <p style="color: #ffffff; margin: 0; font-size: 15px; font-weight: 600;">Payment Deadline</p>
                    <p style="color: #fed7aa; margin: 5px 0 0 0; font-size: 14px; line-height: 1.6;">
                        Please complete your payment by <strong style="color: #ffffff;">{deadline_str}</strong>{cohort_text} to secure your spot.
                    </p>
                </td>
            </tr>
        </table>
    </div>"""
