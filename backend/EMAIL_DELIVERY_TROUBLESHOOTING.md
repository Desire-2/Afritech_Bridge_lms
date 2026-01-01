# Email Delivery Issues - Troubleshooting Guide

## Current Situation

✅ **Good News**: Async email sending is working perfectly!
- API responds immediately (no blocking)
- No more worker timeouts
- Requests complete successfully

❌ **Bad News**: Emails timing out when sending
- SMTP connection to Yahoo timing out
- 3 retry attempts all failing
- Background thread unable to deliver emails

## Root Cause Analysis

### Problem: Yahoo SMTP Timeouts

The logs show:
```
2026-01-01 21:46:11 - Email attempt 1/3 failed: timed out
2026-01-01 21:46:23 - Email attempt 2/3 failed: timed out
2026-01-01 21:46:35 - Email attempt 3/3 failed: timed out
```

**Likely Causes:**
1. **Yahoo SMTP Restrictions**: Yahoo has strict anti-spam measures and may block connections from cloud servers
2. **Network Issues**: Render's network may have issues reaching Yahoo's SMTP servers
3. **Port Blocking**: Port 587 (or 465) might be blocked or throttled
4. **Rate Limiting**: Yahoo may be rate-limiting connections from the server's IP

## Recommended Solutions

### Option 1: Switch to Gmail SMTP (Recommended for Testing)

Gmail SMTP is more reliable for development/testing:

**Render Environment Variables:**
```bash
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-app-password  # Not regular password!
MAIL_DEFAULT_SENDER=your-gmail@gmail.com
```

**Setup Steps:**
1. Go to Google Account Settings
2. Enable 2-Factor Authentication
3. Generate App Password (Security → App Passwords)
4. Use the generated 16-character password

### Option 2: Use SendGrid (Recommended for Production) ⭐

**Why SendGrid?**
- ✅ 100 free emails/day
- ✅ Excellent deliverability
- ✅ No SMTP timeout issues
- ✅ Detailed analytics
- ✅ Professional email service

**Setup:**
1. Sign up at https://sendgrid.com
2. Get your API key
3. Update Render environment variables:

```bash
MAIL_SERVER=smtp.sendgrid.net
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USE_SSL=False
MAIL_USERNAME=apikey  # Literally the word "apikey"
MAIL_PASSWORD=your-sendgrid-api-key
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
```

### Option 3: Use Mailgun

**Why Mailgun?**
- ✅ 5,000 free emails/month
- ✅ Great for transactional emails
- ✅ Simple API

**Setup:**
```bash
MAIL_SERVER=smtp.mailgun.org
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-mailgun-username
MAIL_PASSWORD=your-mailgun-password
MAIL_DEFAULT_SENDER=noreply@yourdomain.com
```

### Option 4: Fix Yahoo SMTP (Not Recommended)

If you must use Yahoo:

1. **Enable "Allow apps that use less secure sign in"** in Yahoo account settings
2. **Use App Password** instead of regular password
3. **Try alternate ports**:
   ```bash
   MAIL_PORT=465
   MAIL_USE_SSL=True
   MAIL_USE_TLS=False
   ```

## Testing Email Configuration

Run this from the backend directory:

```bash
python3 send_test_email.py
```

Or create a quick test script:

```python
from flask import Flask
from flask_mail import Mail, Message

app = Flask(__name__)
app.config['MAIL_SERVER'] = 'smtp.gmail.com'
app.config['MAIL_PORT'] = 587
app.config['MAIL_USE_TLS'] = True
app.config['MAIL_USERNAME'] = 'your-email@gmail.com'
app.config['MAIL_PASSWORD'] = 'your-app-password'
app.config['MAIL_DEFAULT_SENDER'] = 'your-email@gmail.com'

mail = Mail(app)

with app.app_context():
    msg = Message(
        'Test Email',
        sender=app.config['MAIL_DEFAULT_SENDER'],
        recipients=['test@example.com']
    )
    msg.body = 'This is a test email'
    mail.send(msg)
    print("Email sent successfully!")
```

## Current Email Improvements

✅ **Implemented:**
- Async email sending (no blocking)
- Reduced timeout from 30s → 8s
- Exponential backoff retry logic
- Better error logging
- Specific error detection (auth, timeout, connection refused)

## Monitoring Email Delivery

Check logs for:
- `✉️ Email sent successfully` - Email delivered
- `📧 Email queued for async delivery` - Email queued
- `⚠️ SMTP connection timeout` - Connection issues
- `🔐 SMTP authentication failed` - Credential issues
- `🚫 SMTP connection refused` - Port/server issues

## Quick Fix for Render

**Update these environment variables in Render Dashboard:**

1. Go to your Render service
2. Navigate to "Environment" tab
3. Update these variables:

```
MAIL_SERVER=smtp.gmail.com
MAIL_PORT=587
MAIL_USE_TLS=True
MAIL_USERNAME=your-gmail@gmail.com
MAIL_PASSWORD=your-app-password
MAIL_DEFAULT_SENDER=your-gmail@gmail.com
```

4. Click "Save Changes"
5. Render will automatically redeploy

## Long-term Recommendation

For production, use a dedicated email service:

**Priority Order:**
1. **SendGrid** (Best for transactional emails)
2. **Mailgun** (Great alternative)
3. **Amazon SES** (If using AWS)
4. **Gmail SMTP** (Development only)
5. **Yahoo SMTP** (Not recommended)

## Support

If emails still fail after trying these solutions:
1. Check Render logs for specific error messages
2. Verify environment variables are set correctly
3. Test SMTP connection from a different network
4. Consider using a different email provider
