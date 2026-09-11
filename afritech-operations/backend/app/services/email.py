"""Email delivery for notifications.

Mirrors the Afritech Bridge LMS conventions: SMTP credentials come from the
environment, mail is composed as inline HTML, and sends are fire-and-forget so
a slow/failed email never breaks the request that triggered it.

Emails are enqueued on a background queue and delivered by a daemon worker
thread; if SMTP is not configured the send is skipped (in-app notifications
are unaffected).
"""
import logging
import queue
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from email.utils import formataddr
from datetime import date

from flask import current_app

logger = logging.getLogger(__name__)

_email_queue = queue.Queue()
_worker_started = False
_STOP = '__email_stop__'


def email_settings():
    cfg = current_app.config
    return {
        'server': cfg.get('MAIL_SERVER', 'smtp.gmail.com'),
        'port': int(cfg.get('MAIL_PORT', 587)),
        'use_tls': bool(cfg.get('MAIL_USE_TLS', True)),
        'use_ssl': bool(cfg.get('MAIL_USE_SSL', False)),
        'username': cfg.get('MAIL_USERNAME'),
        'password': cfg.get('MAIL_PASSWORD'),
        'sender_email': cfg.get('MAIL_DEFAULT_SENDER', 'noreply@afritecbridge.online'),
        'sender_name': cfg.get('MAIL_SENDER_NAME', 'AfriTech Bridge'),
    }


def email_configured():
    """True when SMTP credentials are present; otherwise email is disabled."""
    s = email_settings()
    return bool(s['username'] and s['password'])


def render_notification_email(notification_type_label, message, severity='info',
                              action_url=None, action_label='View in app',
                              business_name='AfriTech Bridge'):
    """Build the branded notification email as a full HTML document."""
    colors = {
        'critical': '#b02a37',
        'warning': '#b3700a',
        'info': '#2c3e50',
    }
    accent = colors.get(severity or 'info', colors['info'])
    url_block = ''
    if action_url:
        url_block = f'''
        <tr>
          <td align="center" style="padding:12px 32px 4px;">
            <a href="{action_url}" style="background:{accent};color:#ffffff;text-decoration:none;
               padding:10px 26px;border-radius:6px;font-size:14px;font-weight:600;display:inline-block;">{action_label}</a>
          </td>
        </tr>'''
    footer_urls = ''
    if action_url:
        footer_urls = f'<a href="{action_url}">View in app</a>'
    return f'''<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#f3f5f7;font-family:Segoe UI,Roboto,Arial,sans-serif;color:#2c3e50;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f3f5f7;padding:24px 12px;">
  <tr><td align="center">
    <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e3e8ee;">
      <tr>
        <td style="background:#2c3e50;padding:20px 28px;">
          <div style="color:#ffffff;font-size:18px;font-weight:700;">{business_name}</div>
          <div style="color:#aeb9c5;font-size:12px;margin-top:2px;">Operations Notification</div>
        </td>
      </tr>
      <tr>
        <td style="padding:28px 28px 8px;border-bottom:3px solid {accent};">
          <div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;color:{accent};font-weight:600;">{notification_type_label}</div>
          <div style="font-size:15px;line-height:1.5;color:#3a4a5c;margin-top:12px;">{message}</div>
        </td>
      </tr>
      {url_block}
      <tr>
        <td style="padding:22px 28px;background:#f8fafb;border-top:1px solid #e3e8ee;">
          <div style="font-size:12px;color:#7d8ca0;line-height:1.6;">
            You are receiving this because you have email notifications enabled in AfriTech Bridge.
            {footer_urls}
          </div>
          <div style="font-size:11px;color:#a6b1bd;margin-top:10px;">{business_name} &middot; {date.today().year}</div>
        </td>
      </tr>
    </table>
  </td></tr>
</table>
</body></html>'''


def render_plain_text(notification_type_label, message, action_url=None, business_name='AfriTech Bridge'):
    lines = [f'{business_name} - Operations Notification', '']
    lines.append(f'[{notification_type_label.upper()}]')
    lines.append(message)
    lines.append('')
    if action_url:
        lines.append(f'View in app: {action_url}')
    return '\n'.join(lines)


def send_email(to, subject, html, text=None):
    """Enqueue an email for background delivery.

    `to` may be a single address string or a list. Settings are captured at
    enqueue time inside the current app context so the worker needs none.
    """
    if not to:
        return False
    try:
        settings = email_settings()
    except RuntimeError:  # called outside an app context - nothing configured
        return False
    if not settings['username'] or not settings['password']:
        if settings['server'] == 'console' or (settings['username'] is None and settings['password'] is None):
            logger.info('Email delivery not configured; skipping send of "%s" to %s', subject, to)
        else:
            logger.warning('Email delivery not configured; skipping send of "%s" to %s', subject, to)
        return False
    _ensure_worker()
    _email_queue.put({
        'to': [to] if isinstance(to, str) else to,
        'subject': subject,
        'html': html,
        'text': text,
        'settings': settings,
    })
    return True


def send_email_now(to, subject, html, text=None):
    """Synchronously deliver an email (used by tests and the worker)."""
    settings = email_settings()
    return _deliver({'to': [to] if isinstance(to, str) else to, 'subject': subject,
                     'html': html, 'text': text, 'settings': settings})


def _deliver(payload):
    s = payload['settings']
    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = payload['subject']
        msg['From'] = formataddr((s['sender_name'], s['sender_email']))
        msg['To'] = ', '.join(payload['to'])
        if payload.get('text'):
            msg.attach(MIMEText(payload['text'], 'plain'))
        msg.attach(MIMEText(payload['html'], 'html'))

        if s['use_ssl']:
            server = smtplib.SMTP_SSL(s['server'], s['port'], timeout=15)
        else:
            server = smtplib.SMTP(s['server'], s['port'], timeout=15)
            if s['use_tls']:
                server.starttls()
        try:
            server.login(s['username'], s['password'])
            server.sendmail(s['sender_email'], payload['to'], msg.as_string())
        finally:
            server.quit()
        logger.info('Email sent: %s -> %s', payload['subject'], payload['to'])
        return True
    except Exception as e:
        logger.error('Email sending failed (%s): %s', payload['subject'], e)
        return False


def _worker():
    while True:
        payload = _email_queue.get()
        if payload is _STOP:
            break
        try:
            _deliver(payload)
        except Exception:
            logger.exception('Email worker error')


def _ensure_worker():
    global _worker_started
    if _worker_started:
        return
    _worker_started = True
    threading.Thread(target=_worker, name='email-worker', daemon=True).start()


def flush_emails():
    """Deliver all queued emails synchronously (test helper)."""
    messages = []
    while True:
        try:
            payload = _email_queue.get_nowait()
        except queue.Empty:
            break
        messages.append(payload)
    sent = 0
    for m in messages:
        try:
            if _deliver(m):
                sent += 1
        except Exception:
            logger.exception('Email worker error')
    return sent