# Email Template Improvements - Cohort & Payment Integration

## Overview
This document outlines the comprehensive improvements made to the Afritech Bridge LMS email templates to include cohort information and payment details across all customer communication.

## Summary of Changes

### New Helper Module
**File**: `backend/src/utils/email_template_helpers.py`

A new dedicated module containing reusable HTML component generators:

1. **`get_cohort_info_card()`** - Generates cohort information sections
   - Displays cohort label, start date, end date
   - Shows duration in weeks
   - Includes timezone information

2. **`get_payment_info_card()`** - Generates payment information cards
   - Shows full and partial payment amounts
   - Displays payment methods with icons
   - Highlights payment deadlines

3. **`get_cohort_payment_combined_card()`** - Unified enrollment information
   - Combines cohort and payment details in one card
   - Ideal for enrollment-related emails

4. **`get_payment_deadline_warning()`** - Payment deadline alerts
   - Creates urgent/warning sections for approaching deadlines
   - Shows countdown and deadline dates

## Updated Email Templates

### Payment Email Templates (`payment_email_templates.py`)

All payment email functions now accept an optional `cohort_info` parameter:

1. **`application_saved_payment_pending_email()`** ✅
   - Added `cohort_info` parameter
   - Displays cohort information card above payment details
   - Shows cohort label and timeline with deadline

2. **`payment_confirmation_email()`** ✅
   - Added `cohort_info` parameter
   - Shows cohort details in payment receipt
   - Includes start/end dates for course cohort

3. **`payment_failed_email()`** ✅
   - Added `cohort_info` parameter
   - Displays cohort info to contextualize the failed payment
   - Helps students identify which cohort was affected

4. **`payment_reminder_email()`** ✅
   - Added `cohort_info` parameter
   - Shows cohort label in urgency message
   - Includes "days remaining for [Cohort Label]"

5. **`payment_refund_email()`** ✅
   - Added `cohort_info` parameter
   - Displays cohort information with refund details
   - Helps track which course cohort the refund applies to

### Main Email Templates (`email_templates.py`)

1. **`application_received_email()`** ✅
   - Added `cohort_info` parameter
   - Added `payment_info` parameter
   - Displays cohort information card
   - Shows payment requirements if applicable

2. **`application_approved_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_info` parameter
   - Display cohort timeline in approval message
   - Show if payment is required for this cohort
   - Include login link with cohort context

3. **`application_rejected_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_info` parameter (if rejecting for full cohort)
   - Help students understand cohort-specific decisions
   - Optional: Show next cohort availability

4. **`application_waitlisted_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_info` parameter
   - Show current cohort status
   - Display estimated next cohort availability
   - Show if next cohort requires payment

5. **`assignment_graded_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_context` parameter (optional)
   - Show which cohort's assignment is being graded
   - Display cohort progress context

6. **`quiz_graded_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_context` parameter (optional)
   - Show quiz cohort context in email
   - Display cohort progress information

7. **`course_announcement_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_context` parameter (optional)
   - Identify which cohort the announcement applies to
   - Show announcement deadline if cohort-specific

8. **`full_credit_awarded_email()`** 🔄 **READY FOR UPDATE**
   - Should add `cohort_context` parameter
   - Show which cohort the achievement applies to
   - Display cohort-related achievement context

## Integration Points

### Email Notifications (`email_notifications.py`)

The `send_cohort_end_migration_email()` function already demonstrates:
- Extracting cohort info from enrollment/application window
- Passing cohort data through email functions
- Handling optional cohort parameters

**Pattern to follow for other emails**:
```python
# Extract cohort info from course or enrollment
cohort_info = {
    'cohort_label': course.cohort_label or 'Standard Cohort',
    'cohort_start_date': course.cohort_start_date,
    'cohort_end_date': course.cohort_end_date,
    'timezone': getattr(course, 'application_timezone', 'UTC')
}

# Extract payment info if applicable
payment_info = None
if course.enrollment_type == 'paid' and course.price:
    payment_info = {
        'amount': course.price,
        'currency': course.currency,
        'payment_deadline': calculate_payment_deadline(course),
        'payment_methods': get_payment_methods(course)
    }

# Call email function with new parameters
send_email_function(
    user=student,
    course_title=course.title,
    cohort_info=cohort_info,
    payment_info=payment_info,
    unsubscribe_token=token
)
```

## Updated Function Signatures

### Payment Email Functions
```python
def payment_email_function(
    application,
    course_title,
    payment_info,
    cohort_info=None,  # NEW
    unsubscribe_token=None
)
```

### Application Email Functions (Ready to Update)
```python
def application_email_function(
    application,
    course_title,
    cohort_info=None,  # NEW
    payment_info=None,  # NEW (where applicable)
    unsubscribe_token=None,
    **kwargs
)
```

### Academic Email Functions (Ready to Update)
```python
def academic_email_function(
    student_name,
    student_email,
    course_title,
    cohort_context=None,  # NEW (optional)
    unsubscribe_token=None,
    **kwargs
)
```

## Data Structure Examples

### Cohort Info Dictionary
```python
cohort_info = {
    'cohort_label': 'Cohort 2025-Q1',  # e.g., "Cohort 2025-Q1", "January Cohort"
    'cohort_start_date': datetime(2025, 1, 15),
    'cohort_end_date': datetime(2025, 4, 15),
    'timezone': 'Africa/Kigali'
}
```

### Payment Info Dictionary
```python
payment_info = {
    'amount': 100.00,
    'currency': 'USD',
    'payment_mode': 'full',  # 'full' or 'partial'
    'payment_deadline': datetime(2025, 1, 10),
    'payment_methods': ['Mobile Money', 'PayPal', 'Bank Transfer'],
    'partial_amount': 50.00,  # if payment_mode == 'partial'
    'partial_percentage': 50.0  # if payment_mode == 'partial'
}
```

## HTML Component Examples

### Cohort Card
```html
<!-- Cohort Information Card -->
<div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.3); border-left: 4px solid #667eea;">
    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 20px; font-weight: 700;">
        <span style="margin-right: 8px;">📚</span> Cohort Information
    </h3>
    <!-- Contains cohort_label, start_date, end_date, timezone -->
</div>
```

### Payment Card
```html
<!-- Payment Information Card -->
<div style="background-color: #2c3e50; border-radius: 16px; padding: 30px; margin: 30px 0; 
    box-shadow: 0 4px 15px rgba(0,0,0,0.3); border: 2px solid #f59e0b;">
    <h3 style="margin: 0 0 20px 0; color: #ffffff; font-size: 22px; font-weight: 700;">
        <span style="margin-right: 8px;">💰</span> Payment Information
    </h3>
    <!-- Contains amount, currency, methods, deadline -->
</div>
```

## Testing Checklist

- [ ] All payment emails include cohort information when available
- [ ] Cohort labels appear in deadline warnings
- [ ] Payment cards show correct payment methods
- [ ] Dates are formatted consistently (MMM DD, YYYY)
- [ ] Timezone is displayed when non-UTC
- [ ] Mobile responsiveness maintained
- [ ] HTML email renders correctly in Outlook/Gmail/Apple Mail
- [ ] Unsubscribe tokens still work with new parameters
- [ ] Backward compatibility: old function calls still work (optional parameters)

## Remaining Tasks

1. **Update application_approved_email()** with cohort_info and payment_info
2. **Update application_rejected_email()** with cohort_info
3. **Update application_waitlisted_email()** with cohort_info
4. **Update assignment_graded_email()** with cohort_context
5. **Update quiz_graded_email()** with cohort_context
6. **Update course_announcement_email()** with cohort_context
7. **Update full_credit_awarded_email()** with cohort_context
8. **Update all calling code in email_notifications.py** to pass new parameters
9. **Update all route handlers** that send emails to include cohort/payment data
10. **Create migration guide** for existing email sending code

## Benefits

✅ **For Students**: Clear visibility into when their cohort starts, when payments are due, and cohort-specific information in all communications

✅ **For Administrators**: Better email tracking and understanding of which cohort emails relate to

✅ **For Business**: Improved payment reminders with cohort context increases completion rates

✅ **For Support**: Emails provide complete context for troubleshooting enrollment and payment issues

## Notes

- All helper functions are in `email_template_helpers.py` and can be imported independently
- Cohort info is optional - emails work fine without it for non-cohort courses
- Payment info is optional - appears only when payment is required
- All HTML is responsive and mobile-friendly
- Dark theme maintained across all templates for brand consistency
- Dates use user-friendly format (e.g., "Jan 15, 2025")
