from ..extensions import db
from ..models import Notification, User


def notify(recipient, notification_type, message, severity='info', related_type=None, related_id=None, rule=None):
    if isinstance(recipient, User):
        recipient = recipient.id
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
    return n


def notify_users_with_permission(permission, notification_type, message, severity='info', related_type=None, related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    sent = []
    for u in users:
        if u.has_permission(permission):
            sent.append(notify(u, notification_type, message, severity, related_type, related_id, rule))
    return sent


def notify_by_roles(role_codes, notification_type, message, severity='info', related_type=None, related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    sent = []
    for u in users:
        if set(role_codes).intersection(u.role_codes):
            sent.append(notify(u, notification_type, message, severity, related_type, related_id, rule))
    return sent


def notify_employee(employee, notification_type, message, severity='info', related_type=None, related_id=None, rule=None):
    if employee.user_id:
        return notify(employee.user_id, notification_type, message, severity, related_type, related_id, rule)
    return None