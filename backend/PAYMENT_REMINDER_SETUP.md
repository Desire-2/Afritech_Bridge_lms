# ⏰ Automated Payment Reminder System

## Overview

The Payment Reminder System automatically sends scheduled email reminders to applicants who have saved draft applications but haven't completed their payment before the application window deadline.

## Features

✨ **Intelligent Scheduling**
- Sends reminders at 7 days, 3 days, and 1 day before deadline
- Prevents duplicate reminders (24-hour cooldown between emails)
- Tracks reminder history per application

📧 **Beautiful Email Templates**
- Professional, mobile-responsive design
- Urgency indicators based on days remaining
- Clear payment instructions and deadline information

🎯 **Flexible Execution**
- Manual trigger via API endpoints (admin/instructor)
- Command-line script for cron jobs
- Dry-run mode for testing

## Database Schema

New fields added to `course_applications` table:

```sql
-- Track when last reminder was sent
last_payment_reminder_sent TIMESTAMP

-- Type of last reminder: 'first' | 'urgent' | 'final'
last_payment_reminder_type VARCHAR(20)

-- Total count of reminders sent
payment_reminder_count INTEGER DEFAULT 0
```

## Setup Instructions

### 1. Run Database Migration

```bash
cd /path/to/backend
python migrate_add_payment_reminder_fields.py
```

This adds the required tracking fields to the database.

### 2. Test the Scheduler

Run in dry-run mode to preview which applications would receive reminders:

```bash
python run_payment_reminders.py --dry-run
```

### 3. Manual Test Run

Send a reminder to a specific application:

```bash
python run_payment_reminders.py --application-id 123
```

### 4. Set Up Automated Scheduling

#### Option A: Cron Job (Linux/Unix)

Edit crontab:
```bash
crontab -e
```

Add daily schedule (9 AM every day):
```cron
# Payment reminders - daily at 9 AM
0 9 * * * cd /path/to/backend && /path/to/python run_payment_reminders.py >> logs/payment_reminders.log 2>&1
```

Multiple times per day (9 AM, 2 PM, 6 PM):
```cron
# Payment reminders - three times daily
0 9,14,18 * * * cd /path/to/backend && /path/to/python run_payment_reminders.py >> logs/payment_reminders.log 2>&1
```

#### Option B: systemd Timer (Linux)

Create `/etc/systemd/system/payment-reminders.service`:
```ini
[Unit]
Description=Payment Reminder Scheduler
After=network.target

[Service]
Type=oneshot
User=www-data
WorkingDirectory=/path/to/backend
ExecStart=/path/to/python run_payment_reminders.py
StandardOutput=append:/var/log/payment-reminders.log
StandardError=append:/var/log/payment-reminders.log
```

Create `/etc/systemd/system/payment-reminders.timer`:
```ini
[Unit]
Description=Run Payment Reminders Daily
Requires=payment-reminders.service

[Timer]
OnCalendar=daily
OnCalendar=09:00
Persistent=true

[Install]
WantedBy=timers.target
```

Enable and start:
```bash
sudo systemctl daemon-reload
sudo systemctl enable payment-reminders.timer
sudo systemctl start payment-reminders.timer
```

#### Option C: Task Scheduler (Windows)

1. Open Task Scheduler
2. Create Basic Task
3. Set trigger: Daily at 9:00 AM
4. Action: Start a program
   - Program: `C:\path\to\python.exe`
   - Arguments: `run_payment_reminders.py`
   - Start in: `C:\path\to\backend`

## API Endpoints (Admin/Instructor Only)

### Run Scheduler Manually

```http
POST /api/v1/applications/payment-reminders/run
Authorization: Bearer <jwt_token>
Content-Type: application/json

{
  "dry_run": false
}
```

Response:
```json
{
  "message": "Payment reminder scheduler completed successfully",
  "dry_run": false,
  "summary": {
    "total_checked": 45,
    "reminders_needed": 12,
    "sent": 10,
    "failed": 2,
    "skipped": 0,
    "duration_seconds": 8.5
  },
  "errors": []
}
```

### Preview Reminders

```http
GET /api/v1/applications/payment-reminders/preview
Authorization: Bearer <jwt_token>
```

Response:
```json
{
  "total_count": 12,
  "applications": [
    {
      "application_id": 123,
      "applicant_name": "John Doe",
      "email": "john@example.com",
      "course_title": "Excel Mastery",
      "days_remaining": 3,
      "reminder_type": "urgent",
      "deadline": "2026-03-05T23:59:59",
      "amount_due": 5000,
      "currency": "XAF",
      "last_reminder_sent": "2026-02-20T09:00:00",
      "reminder_count": 1
    }
  ]
}
```

### Send Single Reminder

```http
POST /api/v1/applications/123/send-payment-reminder
Authorization: Bearer <jwt_token>
```

## Reminder Schedule

| Days Before Deadline | Reminder Type | Email Tone |
|---------------------|---------------|------------|
| 7 days              | `first`       | Friendly reminder |
| 3 days              | `urgent`      | Approaching deadline |
| 1 day               | `final`       | Final notice |

## Command-Line Options

```bash
python run_payment_reminders.py [options]

Options:
  --dry-run              Preview without sending emails
  --force                Override 24h cooldown
  --application-id ID    Send to specific application
  --verbose              Enable detailed logging
```

## Monitoring & Logs

### Log Files

Logs are stored in `backend/logs/payment_reminders.log`

### View Recent Activity

```bash
tail -f logs/payment_reminders.log
```

### Check Scheduler Status

```bash
# For cron
grep -i "payment reminder" /var/log/syslog

# For systemd
systemctl status payment-reminders.timer
journalctl -u payment-reminders.service -f
```

## Troubleshooting

### No Reminders Being Sent

1. **Check draft applications exist:**
   ```sql
   SELECT COUNT(*) FROM course_applications 
   WHERE is_draft = TRUE 
   AND payment_status IN ('pending', 'pending_bank_transfer');
   ```

2. **Verify application windows have deadlines:**
   ```sql
   SELECT id, course_id, cohort_label, application_deadline, cohort_start 
   FROM application_windows 
   WHERE application_deadline IS NOT NULL OR cohort_start IS NOT NULL;
   ```

3. **Check email service configuration:**
   - Ensure `BREVO_API_KEY` is set
   - Verify Brevo account has available email quota

### Duplicate Reminders

The system has built-in safeguards:
- 24-hour cooldown between reminders
- Tracks last reminder type to prevent duplicates
- Only sends higher priority reminders

To override cooldown (testing only):
```bash
python run_payment_reminders.py --force
```

### Performance Issues

For large databases:
- Run scheduler during off-peak hours
- Monitor duration in logs
- Consider increasing `REMINDER_SCHEDULE` intervals

## Email Template Customization

Templates are in: `backend/src/utils/payment_email_templates.py`

Key template: `payment_reminder_email()`

Customize:
- Urgency colors
- Deadline messaging
- Support contact information
- Payment method instructions

## Best Practices

✅ **Do:**
- Run scheduler at least once daily
- Monitor logs regularly
- Test with dry-run before deployment
- Keep application windows updated with deadlines

❌ **Don't:**
- Run scheduler more than 3-4 times per day (spam risk)
- Modify reminder tracking fields manually
- Send reminders to applications with completed payments

## Integration with Frontend

### Display Reminder Status

```javascript
// In admin dashboard
const application = await api.get(`/applications/${id}`);
const reminderInfo = {
  lastSent: application.last_payment_reminder_sent,
  type: application.last_payment_reminder_type,
  count: application.payment_reminder_count
};
```

### Manual Trigger Button

```javascript
// Admin can trigger reminder for specific application
const sendReminder = async (applicationId) => {
  const response = await api.post(
    `/applications/${applicationId}/send-payment-reminder`
  );
  // Show success message
};
```

## Maintenance

### Monthly Review

1. Check total reminders sent
2. Analyze conversion rates (draft → paid)
3. Review failed reminder logs
4. Adjust schedule if needed

### Quarterly Cleanup

Remove old reminder tracking from completed applications:

```sql
UPDATE course_applications 
SET last_payment_reminder_sent = NULL,
    last_payment_reminder_type = NULL,
    payment_reminder_count = 0
WHERE payment_status IN ('completed', 'confirmed') 
AND last_payment_reminder_sent < NOW() - INTERVAL '90 days';
```

## Support

For issues or questions:
- Check logs: `logs/payment_reminders.log`
- Review application window deadlines
- Verify email service configuration
- Test with single application first

---

**Last Updated:** February 26, 2026
**Version:** 1.0.0
