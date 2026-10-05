"""In-app + email notification dispatch — the single front door for alerts.

`notify()` always creates a Notification row — it is both the in-app payload
and the *idempotency watermark* a scheduled rule looks for on its next run —
and, when the recipient's email is configured in the system *and* they have
opted in (master toggle + per-type NotificationPreference), also fires an email
via the background email service.

Processing order inside `notify()` is deliberate and enforced:

1. **recipient resolution** — the id must map to a real user;
2. **authorization**     — `can_receive()` decides whether this user may see
   this event at all (financial / shop / Service-Agent boundaries). Preferences
   are never consulted for a user that fails here, and no address is read;
3. **idempotency**       — a rule inside its de-duplication window, or an
   identical event re-fired within `EVENT_DEDUP_WINDOW_SECONDS` (double click,
   proxy retry, worker retry), produces no second row and no second email;
4. **policy/preferences** — `in_app_enabled` / `email_enabled` / `MANDATORY_TYPES`
   decide *channels*. Preferences can mute a channel; they can never override
   step 2. A muted in-app channel still writes the row (so step 3 keeps working
   for a recipient who reads by email only) but `notify()` reports "nothing to
   show" to the caller and `apply_visibility()` keeps the row out of that user's
   list and badge;
5. **delivery**          — the email send is wrapped so a transport failure is
   logged and swallowed: the business action that triggered the notification
   must never fail because of it.

Read paths (`routes/notifications.py`) run the same rules backwards through
`apply_visibility()` — authorization *and* the in-app preference — so rows
written before a permission change, rows written after the recipient muted a
type, or rows by a module that bypassed `notify()` still never appear in a list
or a badge.

Per-recipient defaults can be overridden per notification type through the
NotificationPreference table: a row with type='*' acts as the fallback for any
type without an explicit row.

Rows are *not* committed here — handlers commonly commit before calling
`notify()` (right after their own insert), so the app's `after_request` hook
persists whatever is still pending when the response succeeds. Repeated alert
rules also pass ``rule`` so a second run inside NOTIFY_RULE_DEDUP_HOURS does
not re-notify the same item.
"""
import re
import threading
from datetime import datetime, timedelta, timezone

from flask import current_app

from ..extensions import db
from ..models import (
    AdminRequest, Attendance, DailyClosing, Employee, FollowUp,
    Notification, NotificationPreference, PayrollItem, Task, User,
)
from ..auth.scope import (
    FINANCIAL_VIEW_PERMISSIONS, can_access_service_agents,
    is_service_agent_employee, service_agent_employee_ids,
)
from ..utils.datetime_utils import as_utc
from . import email as email_service
from .email import render_notification_email, render_plain_text

# Alert rules re-run on a schedule; skip an item already notified in this window.
NOTIFY_RULE_DEDUP_HOURS = 24

# A plain event (no rule) re-fired with the exact same payload — double click,
# retried request, duplicated worker job — must not produce a second row.
EVENT_DEDUP_WINDOW_SECONDS = 60

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
    # Company Secretary coordination rules.
    'task_due_tomorrow': 'info',
    'meeting_reminder': 'info',
    'acknowledgement_pending': 'warning',
    'request_stale': 'warning',
    'task_awaiting_verification': 'info',
    # Task lifecycle (routes/tasks.py) and coordination updates.
    'task_submitted': 'info',
    'task_verified': 'info',
    'task_rejected': 'warning',
    'task_reopened': 'warning',
    'meeting_invited': 'info',
    'meeting_updated': 'warning',
    'meeting_cancelled': 'warning',
    'activity_reminder': 'info',
    'activity_updated': 'info',
    'attendance_alert': 'warning',
    'admin_request': 'info',
    'announcement': 'info',
    'escalation': 'warning',
    'followup': 'info',
    'leave_request': 'warning',
    'memo': 'info',
    # Electronics shop.
    'shop_low_stock': 'warning',
    'shop_out_of_stock': 'critical',
    'shop_purchase_approval': 'warning',
    'shop_goods_received': 'info',
    'shop_transfer_ready': 'info',
    'shop_return_approval': 'warning',
    'shop_return_completed': 'info',
    'shop_closing_approval': 'warning',
    'shop_discount_approval': 'warning',
    'shop_warranty_case': 'info',
    'shop_warranty_overdue': 'warning',
    'shop_dead_stock': 'info',
    'shop_sale': 'info',
    'shop_unknown_barcode': 'warning',
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
    'task_due_tomorrow': 'Task due tomorrow',
    'meeting_reminder': 'Meeting reminder',
    'acknowledgement_pending': 'Acknowledgement pending',
    'request_stale': 'Stale administrative request',
    'task_awaiting_verification': 'Task awaiting verification',
    'admin_request': 'Administrative request update',
    'escalation': 'Escalation update',
    'followup': 'Follow-up update',
    'leave_request': 'Leave request update',
    'announcement': 'New announcement',
    'memo': 'New memo',
    'task_submitted': 'Task submitted for review',
    'task_verified': 'Task verified',
    'task_rejected': 'Task needs changes',
    'task_reopened': 'Task reopened',
    'meeting_invited': 'Meeting invitation',
    'meeting_updated': 'Meeting changed',
    'meeting_cancelled': 'Meeting cancelled',
    'activity_reminder': 'Activity reminder',
    'activity_updated': 'Activity created or changed',
    'attendance_alert': 'Attendance alert',
    # Electronics shop.
    'shop_low_stock': 'Shop stock running low',
    'shop_out_of_stock': 'Shop item out of stock',
    'shop_purchase_approval': 'Shop purchase order awaiting approval',
    'shop_goods_received': 'Goods received into shop stock',
    'shop_transfer_ready': 'Shop stock transfer awaiting action',
    'shop_return_approval': 'Shop return awaiting approval',
    'shop_return_completed': 'Shop return completed',
    'shop_closing_approval': 'Shop cash closing awaiting approval',
    'shop_discount_approval': 'Shop discount awaiting approval',
    'shop_warranty_case': 'Shop warranty case update',
    'shop_warranty_overdue': 'Shop warranty case overdue',
    'shop_dead_stock': 'Shop slow-moving stock',
    'shop_sale': 'Shop sale recorded',
    'shop_unknown_barcode': 'Unknown barcode scanned in the shop',
}

# ── authorization (the security boundary of this layer) ──────────────────────
#
# Every notification is filtered *centrally*, here, before anything else
# happens: a module that raises an event cannot leak restricted information by
# picking the wrong recipient, because `notify()` re-checks the recipient
# against the event category. Preferences are evaluated afterwards and can only
# mute a channel — never grant visibility.

# Restricted event categories: the recipient must hold at least one of these
# permissions (super admins hold them all). The Company Secretary holds none of
# them, which is exactly the point — no commission, revenue, profit, payroll,
# salary, service-cost or shop-money event may reach that role.
TYPE_PERMISSIONS = {
    'cash_shortage': (
        'closings.view', 'closings.approve', 'expenses.view', 'reports.view',
        'payroll.view', 'employees.earnings.view_all',
        'shop.cash_closing.view', 'shop.cash_closing.approve',
    ),
    'closing_approval': ('closings.view', 'closings.approve', 'reports.view'),
    'closing_reviewed': (
        'closings.view', 'closings.approve',
        'shop.cash_closing.view', 'shop.cash_closing.approve',
        'shop.shifts.view', 'shop.shifts.manage',
    ),
    'expense_approval': ('expenses.view', 'expenses.approve', 'reports.view', 'reports.export'),
    'payroll_paid': (
        'payroll.view', 'payroll.manage', 'payroll.approve', 'payroll.mark_paid',
        'employees.earnings.view_all', 'employees.earnings.view_own',
    ),
}

# Every `shop_*` event is shop money / stock information; a recipient must hold
# at least one `shop.*` permission to receive one.
SHOP_TYPE_PREFIX = 'shop_'
SHOP_PERMISSION_PREFIX = 'shop.'

# Types whose payload is coordination-only (task, meeting, announcement, …).
# They are allowed for every active recipient; a financial word inside a
# user-authored title is not financial *information* about the business.
COORDINATION_TYPES = {
    'task_assigned', 'task_overdue', 'task_submitted', 'task_verified',
    'task_rejected', 'task_reopened', 'task_due_tomorrow',
    'task_awaiting_verification', 'meeting_invited', 'meeting_updated',
    'meeting_cancelled', 'meeting_reminder', 'activity_reminder',
    'activity_updated', 'attendance_alert', 'announcement', 'memo',
    'admin_request', 'leave_request', 'escalation', 'followup',
    'missing_weekly_plan', 'instructor_behind', 'grading_overdue',
    'acknowledgement_pending', 'request_stale',
}

# Money vocabulary for *unknown* event types — the "another module created an
# event" case. Fail closed: a type nobody classified yet may not carry figures
# to a recipient that cannot read financial data.
MONEY_PATTERN = re.compile(
    r'(?i)\b(commissions?|revenue|profits?|salary|salaries|payroll|earnings|'
    r'dividends?)\b|\bRWF\b|\bUSD\b|\bEUR\b|\$\s?\d'
)

# Preferences may not mute these: hiding a cash shortage or a stock-out from
# the people accountable for it is not a preference, it is a blind spot.
MANDATORY_TYPES = {'cash_shortage', 'shop_out_of_stock'}

# Related records that belong to a single employee. Used for the Service-Agent
# boundary: a recipient that cannot reach Service Agent records may not be told
# about one — unless the record is theirs.
_AGENT_SCOPED_MODELS = {
    'task': (Task, Task.assigned_to),
    'daily_closing': (DailyClosing, DailyClosing.employee_id),
    'followup': (FollowUp, FollowUp.employee_id),
    'admin_request': (AdminRequest, AdminRequest.requested_by),
    'attendance': (Attendance, Attendance.employee_id),
}

# Serializing the checks per notify() call keeps concurrent bursts from racing
# each other inside one process; cross-process races still need a DB unique key
# (see handoff.md).
_dispatch_lock = threading.Lock()


def _resolve_user(recipient):
    if isinstance(recipient, User):
        return recipient
    return User.query.get(recipient)


def _label(notification_type, severity):
    label = NOTIFICATION_TYPES.get(notification_type)
    if label:
        return label
    return notification_type.replace('_', ' ').title()


def _has_any_permission(user, permissions):
    """True when the user holds at least one code (``'shop.*'`` = prefix)."""
    if user is None:
        return False
    codes = user.permissions
    if '*' in codes:
        return True
    for perm in permissions:
        if perm.endswith('.*'):
            if any(code.startswith(perm[:-1]) for code in codes):
                return True
        elif perm in codes:
            return True
    return False


def _required_permissions(notification_type):
    """Permissions that gate this type, or None when it is unrestricted."""
    perms = TYPE_PERMISSIONS.get(notification_type)
    if notification_type.startswith(SHOP_TYPE_PREFIX):
        shop = (SHOP_PERMISSION_PREFIX + '*',)
        perms = shop if perms is None else tuple(perms) + shop
    return perms


def _related_employee_id(related_type, related_id):
    """Employee that owns the record a notification is about (or None)."""
    spec = _AGENT_SCOPED_MODELS.get(related_type)
    if spec is None or related_id is None:
        return None
    model, column = spec
    try:
        return db.session.query(column).filter(model.id == related_id).scalar()
    except Exception:  # noqa: BLE001 - a broken lookup must not block delivery
        current_app.logger.debug('could not resolve owner for %s/%s',
                                 related_type, related_id, exc_info=True)
        return None


def _is_own_record(user, owner_employee_id):
    if owner_employee_id is None:
        return False
    me = user.employee
    return bool(me and me.id == owner_employee_id)


def _is_payroll_payee(user, related_type, related_id):
    """True when the user is paid by the payroll period this event is about."""
    if related_type != 'payroll_period' or related_id is None:
        return False
    me = user.employee
    if me is None:
        return False
    return (PayrollItem.query
            .filter_by(payroll_period_id=related_id, employee_id=me.id)
            .first()) is not None


def type_allowed(user, notification_type):
    """Authorization for the *category* of an event (no record context)."""
    perms = _required_permissions(notification_type)
    if perms is None:
        return True
    return _has_any_permission(user, perms)


def can_receive(user, notification_type, message=None, related_type=None, related_id=None):
    """Central authorization gate. True only when `user` may see this event.

    Order matters: category permission first, then the Service-Agent record
    boundary, then — for event types nobody classified — a money-content guard.
    Called by `notify()` before preferences or addresses are even looked at.
    """
    if user is None:
        return False

    governed = _required_permissions(notification_type) is not None
    type_ok = (not governed) or type_allowed(user, notification_type)
    if not type_ok and _is_payroll_payee(user, related_type, related_id):
        # Payroll is restricted, but a payee always reads their own payment.
        type_ok = True
    if not type_ok:
        return False

    owner_employee_id = _related_employee_id(related_type, related_id)

    # Service-Agent boundary: never tell a coordinator about an agent's work.
    if owner_employee_id is not None and not _is_own_record(user, owner_employee_id):
        if not can_access_service_agents(user):
            employee = Employee.query.get(owner_employee_id)
            if employee is not None and is_service_agent_employee(employee):
                return False

    if not message:
        return True
    if governed or notification_type in COORDINATION_TYPES:
        return True
    # Unknown type: fail closed when the payload carries money to a reader that
    # has no financial view anywhere in the app (the Company Secretary case).
    if _has_any_permission(user, FINANCIAL_VIEW_PERMISSIONS):
        return True
    if not MONEY_PATTERN.search(message):
        return True
    return _is_own_record(user, owner_employee_id)


def _in_app_muted_filter(user):
    """SQL criterion hiding rows whose in-app channel `user` has muted.

    Mirrors `get_notification_preference()`: an explicit row wins, `'*'` is the
    fallback, and a type with no row at all is enabled. `MANDATORY_TYPES` are
    never hidden — an alert somebody is accountable for is not a preference.
    Returns ``None`` when nothing is muted (the common case: no extra filter).
    """
    prefs = {p.type: p for p in NotificationPreference.query.filter_by(user_id=user.id).all()}
    star = prefs.get('*')
    if star is not None and not star.in_app_enabled:
        # Global mute: only types the user explicitly re-enabled still render.
        visible = {t for t, row in prefs.items() if t != '*' and row.in_app_enabled}
        visible |= MANDATORY_TYPES
        if not visible:
            return db.text('1 = 0')
        return Notification.type.in_(tuple(sorted(visible)))
    hidden = {t for t, row in prefs.items()
              if t != '*' and not row.in_app_enabled} - MANDATORY_TYPES
    if not hidden:
        return None
    return Notification.type.notin_(tuple(sorted(hidden)))


def apply_visibility(query, user):
    """Restrict a Notification query to what `user` is allowed to see.

    Two independent gates, both expressed in SQL so lists, history pages and
    the unread badge stay cheap and never load rows the user cannot see:

    * **authorization** — the same rules as `can_receive()`, applied by type
      and by owning record (financial / shop / Service-Agent boundaries);
    * **preference**    — a type the user muted in-app is not rendered
      in-app, so it must not be counted either. `MANDATORY_TYPES` can never be
      muted, and turning a type back on makes its older rows visible again.
    """
    if user is None:
        return query.filter(db.text('1 = 0'))

    my_employee_id = user.employee.id if user.employee else None

    blocked = [t for t, perms in TYPE_PERMISSIONS.items()
               if t != 'payroll_paid' and not _has_any_permission(user, perms)]
    if not _has_any_permission(user, (SHOP_PERMISSION_PREFIX + '*',)):
        blocked.extend(t for t in NOTIFICATION_TYPES
                       if t.startswith(SHOP_TYPE_PREFIX) and t not in blocked)
    if blocked:
        query = query.filter(Notification.type.notin_(blocked))

    muted = _in_app_muted_filter(user)
    if muted is not None:
        query = query.filter(muted)

    # `payroll_paid` is restricted, except the row that pays *this* employee.
    if not _has_any_permission(user, TYPE_PERMISSIONS['payroll_paid']):
        if my_employee_id is None:
            query = query.filter(Notification.type != 'payroll_paid')
        else:
            my_periods = (db.session.query(PayrollItem.payroll_period_id)
                          .filter(PayrollItem.employee_id == my_employee_id)
                          .scalar_subquery())
            query = query.filter(db.or_(
                Notification.type != 'payroll_paid',
                Notification.related_id.in_(my_periods),
            ))

    if can_access_service_agents(user):
        return query
    agent_ids = service_agent_employee_ids()
    if not agent_ids:
        return query
    for related_type, (model, column) in _AGENT_SCOPED_MODELS.items():
        foreign = (db.session.query(model.id)
                   .filter(column.in_(agent_ids)).scalar_subquery())
        hidden = db.and_(
            Notification.related_type == related_type,
            Notification.related_id.isnot(None),
            Notification.related_id.in_(foreign),
        )
        if my_employee_id is not None:
            mine = (db.session.query(model.id)
                    .filter(column == my_employee_id).scalar_subquery())
            hidden = db.and_(hidden, ~Notification.related_id.in_(mine))
        query = query.filter(db.not_(hidden))
    return query


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


def email_for_recipient(user, notification_type, message, severity,
                        related_type=None, related_id=None):
    """Build and enqueue the notification email for a user.

    Policy order: the *full* authorization gate (`can_receive`, not just the
    category check — `notify()` already ran it, but this function is public and
    a direct call may not skip the Service-Agent or money-content rules), then
    the address, then the preferences, then the transport.
    Returns True when an email was queued, False otherwise. Never raises.
    """
    if not user or not user.email:
        return False
    if not can_receive(user, notification_type, message, related_type, related_id):
        return False
    if not getattr(user, 'email_notifications', True):
        return False
    email_enabled, _ = get_notification_preference(user.id, notification_type)
    if not email_enabled:
        return False
    if not email_service.email_configured():
        return False
    subject = f'[AfriTech Bridge] {_label(notification_type, severity)}'
    frontend_url = (current_app.config.get('FRONTEND_URL') or 'http://localhost:3001').rstrip('/')
    action_url = f'{frontend_url}/notifications'
    html = render_notification_email(
        _label(notification_type, severity), message, severity,
        action_url=action_url, action_label='View notifications')
    text = render_plain_text(_label(notification_type, severity), message, action_url=action_url)
    return email_service.send_email(user.email, subject, html, text=text)


def _is_duplicate(recipient, notification_type, message, related_type, related_id, rule):
    """True when this event has already been delivered for this recipient.

    Two windows:
      * a named ``rule`` inside ``NOTIFY_RULE_DEDUP_HOURS`` — scheduled alerts
        re-run every few minutes and must not re-notify the same item;
      * an identical payload (same message, same record) inside
        ``EVENT_DEDUP_WINDOW_SECONDS`` — double click, retried request,
        duplicated worker job.
    """
    if rule:
        cutoff = datetime.now(timezone.utc) - timedelta(hours=NOTIFY_RULE_DEDUP_HOURS)
        rows = (Notification.query
                .filter_by(recipient_id=recipient, type=notification_type,
                           related_type=related_type, related_id=related_id,
                           created_by_rule=rule)
                .limit(50).all())
        return any(as_utc(row.created_at) and as_utc(row.created_at) >= cutoff
                   for row in rows)

    cutoff = datetime.now(timezone.utc) - timedelta(seconds=EVENT_DEDUP_WINDOW_SECONDS)
    rows = (Notification.query
            .filter_by(recipient_id=recipient, type=notification_type,
                       related_type=related_type, related_id=related_id,
                       message=message)
            .limit(5).all())
    return any(as_utc(row.created_at) and as_utc(row.created_at) >= cutoff
               for row in rows)


def notify(recipient, notification_type, message, severity=None, related_type=None,
           related_id=None, rule=None):
    if isinstance(recipient, User):
        user = recipient
        recipient = recipient.id
    else:
        user = _resolve_user(recipient)

    if user is None:
        return None

    with _dispatch_lock:
        # 1. authorization — before preferences, before any email address.
        if not can_receive(user, notification_type, message, related_type, related_id):
            current_app.logger.debug(
                'notification suppressed (unauthorized): type=%s user=%s',
                notification_type, user.id)
            return None

        # 2. idempotency — same event, same recipient, inside its window.
        if _is_duplicate(recipient, notification_type, message,
                         related_type, related_id, rule):
            return None

        if severity is None:
            severity = SEVERITY_BY_TYPE.get(notification_type, 'info')

        # 3. policy/preferences decide the channels, never the visibility.
        # The row itself is written unconditionally: it is the watermark the
        # de-duplication in step 2 looks for, and it must exist even when the
        # recipient reads by email only — otherwise a scheduled rule re-runs
        # every interval and re-sends the same mail. `in_app_enabled` decides
        # whether the row is *shown* (`apply_visibility()`) and whether the
        # caller is told there is something to show.
        in_app_enabled = notification_type in MANDATORY_TYPES
        if not in_app_enabled:
            _, in_app_enabled = get_notification_preference(recipient, notification_type)

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

        # 4. delivery — fire-and-forget, never fails the business action.
        try:
            email_for_recipient(user, notification_type, message, severity,
                                related_type, related_id)
        except Exception:
            current_app.logger.exception(
                'Failed to dispatch notification email (type=%s)', notification_type)

        return n if in_app_enabled else None


def notify_users_with_permission(permission, notification_type, message, severity=None,
                                 related_type=None, related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    sent = []
    for u in users:
        if u.has_permission(permission):
            sent.append(notify(u, notification_type, message, severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                               related_type, related_id, rule))
    return [x for x in sent if x is not None]


def notify_by_roles(role_codes, notification_type, message, severity=None, related_type=None,
                    related_id=None, rule=None):
    users = User.query.filter(User.is_active.is_(True)).all()
    targets = set(role_codes)
    sent = []
    for u in users:
        # 'super_admin' targets the flag, not a role row.
        if ('super_admin' in targets and u.is_super_admin) or targets.intersection(u.role_codes):
            sent.append(notify(u, notification_type, message, severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                               related_type, related_id, rule))
    return [x for x in sent if x is not None]


def notify_employee(employee, notification_type, message, severity=None, related_type=None,
                    related_id=None, rule=None):
    if employee is None:
        return None
    if employee.user_id:
        return notify(employee.user_id, notification_type, message,
                      severity or SEVERITY_BY_TYPE.get(notification_type, 'info'),
                      related_type, related_id, rule)
    return None


def set_preferences(user, payload):
    """Apply the payload to the user's notification preferences.

    Preferences mute channels only — they are consulted after `can_receive()`
    has already decided that the user is allowed to see the event.

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
            'mandatory': key in MANDATORY_TYPES,
        })
    return {
        'email_notifications': user.email_notifications,
        'preferences': prefs,
    }
