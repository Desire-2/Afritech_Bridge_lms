"""In-app + email notification dispatch.

`notify()` always creates an in-app Notification row and, when the recipient's
email is configured in the system *and* they have opted in (master toggle +
per-type NotificationPreference), also fires an email via the background email
service.

Per-recipient defaults can be overridden per notification type through the
NotificationPreference table: a row with type='*' acts as the fallback for any
type without an explicit row.
"""
from flask import current_app

from ..extensions import db
from ..models import Notification, NotificationPreference, User
from . import email as email_service
from .email import render_notification_email, render_plain_text

SEVERITY_BY_TYPE = {
    'cash_shortage': 'critical',
    'closing_reviewed': 'warning',
    'closing_approval': 'warning',
    'expense_approval': 'warning',
    'task_overdue': 'warning',
    'payroll_paid': 'info',
    'task_assigned': 'info',
    'missing_weekly_plan': 'warning',
    'instructor_behind': 'warning',
    'grading_overdue': 'warning',
}

# Known notification types surfaced in the notification-preferences UI.
NOTIFICATION_TYPES = {
    'cash_shortage': 'Cash shortage alert',
    'closing_approval': 'Daily closing awaiting approval',
    'closing_reviewed': 'Closing review result',
    'expense_approval': 'Expense awaiting approval',
    'payroll_paid': 'Payroll paid',
    'task_assigned': 'Task assigned to you',
    'task_overdue': 'Task overdue',
    'missing_weekly_plan': 'Missing weekly plan',
    'instructor_behind': 'Instructor behind schedule',
    'grading_overdue': 'Unsubmitted grading overdue',
}


def _resolve_user(recipient):
    if isinstance(recipient, User):
        return recipient
    return User.query.get(recipient)


def _label(notification_type, severity):
    label = NOTIFICATION_TYPES.get(notification_type)
    if label:
        return label
    return notification_type.replace('_', ' ').title()


def get_notification_preference(user_id, notification_type):
    """Return (email_enabled, in_app_enabled) for a type, falling back to '*'."""
    explicit = (NotificationPreference.query
                .filter_by(user_id=user_id, type=notification_type).first())
    if explicit:
        return explicit.email_enabled, explicit.in_app_enabled
    default = (NotificationPreference.query
               .filter_by(user_id=user_id, type='*').first())
    if default:
        return default.email_enabled, default.in_app_enabled
    return True, True


def email_for_recipient(user, notification_type, message, severity):
    """Build and enqueue the notification email for a user.

    Returns True when an email was queued, False when the user is opted out or
    SMTP is not configured. Called from `notify()`.
    """
    if not user or not user.email:
        return False
    if not getattr(user, 'email_notifications', True):
        return False
    email_enabled, _ = get_notification_preference(user.id, notification_type)
    if not email_enabled:
        return False
    if not email_service.email_configured():
        return False
    subject = f'[AfriTech Bridge] {_label(notification_type, severity)}'
    frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000').rstrip('/')
    action_url = f'{frontend_url}/notifications'
    html = render_notification_email(
        _label(notification_type, severity), message, severity,
        action_url=action_url, action_label='View notifications')
    text = render_plain_text(_label(notification_type, severity), message, action_url=action_url)
    return email_service.send_email(user.email, subject, html, text=text)


def notify(recipient, notification_type, message, severity=None, related_type=None, related_id=None, rule=None):
    if isinstance(recipient, User):
        user = recipient
        recipient = recipient.id
    else:
        user = _resolve_user(recipient)

    if user is None:
        return None

    if severity is None:
        severity = SEVERITY_BY_TYPE.get(notification_type, 'info')

    # In-app notification unless the user disabled this type in-app.
    _, in_app_enabled = get_notification_preference(recipient, notification_type)
    n = None
    if in_app_enabled:
        n = Notification(
            recipient_id=recipient,
            type=notification_type,
            severity=severity,
            message=message,
            related_type=related_type,
            related_id=related_id,
            created_by_rule=rule,
        )
        db.session.add(n)

    # Fire the notification email (fire-and-forget, never fails the request).
    try:
        email_for_recipient(user, notification_type, message, severity)
    except Exception:
        current_app.logger.exception('Failed to dispatch notification email (type=%s)', notification_type)

    return n


def notify_users_with_permission(permission, notification_type, message, severity=None, related_type=None, related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    sent = []
    for u in users:
        if u.has_permission(permission):
            sent.append(notify(u, notification_type, message, severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                               related_type, related_id, rule))
    return [x for x in sent if x is not None]


def notify_by_roles(role_codes, notification_type, message, severity=None, related_type=None, related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    sent = []
    for u in users:
        if set(role_codes).intersection(u.role_codes):
            sent.append(notify(u, notification_type, message, severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                               related_type, related_id, rule))
    return [x for x in sent if x is not None]


def notify_employee(employee, notification_type, message, severity=None, related_type=None, related_id=None, rule=None):
    if employee.user_id:
        return notify(employee.user_id, notification_type, message,
                      severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                      related_type, related_id, rule)
    return None


def set_preferences(user, payload):
    """Apply the payload to the user's notification preferences.

    payload keys:
      email_notifications: bool   -> master email toggle on the User row
      preferences: list of {type, email_enabled, in_app_enabled}
        A preference with all values None/absent removes the row (back to '*'
        defaults). type='*' sets the global default.
    """
    if 'email_notifications' in payload:
        user.email_notifications = bool(payload['email_notifications'])

    for pref in payload.get('preferences') or []:
        ptype = str(pref.get('type', '*'))
        email_enabled = pref.get('email_enabled')
        in_app_enabled = pref.get('in_app_enabled')

        row = NotificationPreference.query.filter_by(user_id=user.id, type=ptype).first()

        if email_enabled is None and in_app_enabled is None:
            if row:
                db.session.delete(row)
            continue

        if row is None:
            row = NotificationPreference(user_id=user.id, type=ptype)
            db.session.add(row)
        if email_enabled is not None:
            row.email_enabled = bool(email_enabled)
        if in_app_enabled is not None:
            row.in_app_enabled = bool(in_app_enabled)
    return user


def preferences_to_dict(user):
    """Serialize the user's notification settings for the preferences UI."""
    rows = {p.type: p for p in NotificationPreference.query.filter_by(user_id=user.id).all()}
    prefs = []
    for key, label in [('*', 'All notifications')] + sorted(NOTIFICATION_TYPES.items()):
        row = rows.get(key)
        prefs.append({
            'type': key,
            'label': label,
            'email_enabled': row.email_enabled if row else True,
            'in_app_enabled': row.in_app_enabled if row else True,
        })
    return {
        'email_notifications': user.email_notifications,
        'preferences': prefs,
    }