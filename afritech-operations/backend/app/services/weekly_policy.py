"""Centralized weekly reporting policy — the only place date math lives.

All week boundaries, deadlines, late handling, expense eligibility and
commission treatment are read from the settings table here. Routes and services
must never compute a week boundary by hand.
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..extensions import db
from ..models import Setting

DEFAULTS = {
    'week_start_weekday': 5,       # Saturday (Python: Monday=0)
    'week_end_weekday': 4,         # Friday
    'submission_weekday': 5,       # Saturday after the week end
    'deadline_time': '17:00',
    'timezone': 'Africa/Kigali',
    'late_policy': 'allow_flagged',  # allow_flagged | block
    'allow_override': True,
    'deduct_verified_service_costs': True,
    'commission_retained': False,
    'collection_funded_payment_methods': ['cash'],
    'eligible_transaction_statuses': ['completed'],
    'ineligible_transaction_statuses': [
        'cancelled', 'failed', 'refunded', 'reversed', 'unpaid', 'pending_payment',
    ],
    'shortage_requires_evidence': True,
    'statement_items': 21,
}


def _setting(key, default=None):
    row = Setting.query.filter_by(key=f'weekly_reporting.{key}').first()
    if row and row.value not in (None, ''):
        return row.value
    if key == 'timezone':
        row = Setting.query.filter_by(key='timezone').first()
        if row and row.value:
            return row.value
    return default


def _as_int(value, default):
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _as_bool(value, default):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    return str(value).strip().lower() in ('1', 'true', 'yes', 'on')


def _as_list(value, default):
    if isinstance(value, list):
        return value
    if isinstance(value, str):
        return [v.strip() for v in value.split(',') if v.strip()]
    return list(default)


def get_policy():
    """Return the effective policy, always with every documented key present."""
    policy = dict(DEFAULTS)
    for key in DEFAULTS:
        raw = _setting(key)
        if raw is None:
            continue
        if key in ('week_start_weekday', 'week_end_weekday', 'submission_weekday'):
            policy[key] = min(6, max(0, _as_int(raw, DEFAULTS[key])))
        elif key in ('allow_override', 'deduct_verified_service_costs',
                     'commission_retained', 'shortage_requires_evidence'):
            policy[key] = _as_bool(raw, DEFAULTS[key])
        elif key in ('collection_funded_payment_methods',
                     'eligible_transaction_statuses',
                     'ineligible_transaction_statuses'):
            policy[key] = _as_list(raw, DEFAULTS[key])
        else:
            policy[key] = raw
    return policy


def business_timezone(name=None):
    try:
        return ZoneInfo(name or get_policy()['timezone'])
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo('Africa/Kigali')


def week_bounds(on_date=None, policy=None):
    """Return (start, end) for the configured reporting week containing a date."""
    policy = policy or get_policy()
    on_date = on_date or date.today()
    if isinstance(on_date, datetime):
        on_date = on_date.date()
    delta = (on_date.weekday() - policy['week_start_weekday']) % 7
    start = on_date - timedelta(days=delta)
    return start, start + timedelta(days=6)


def shift_week(week_start, weeks, policy=None):
    return week_start + timedelta(days=7 * int(weeks))


def submission_deadline(week_start, policy=None):
    """Return an aware UTC deadline for a report week."""
    policy = policy or get_policy()
    week_end = week_start + timedelta(days=6)
    delta = (policy['submission_weekday'] - week_end.weekday()) % 7
    due_date = week_end + timedelta(days=delta)
    hour, minute = _parse_time(policy['deadline_time'])
    local = datetime.combine(due_date, time(hour=hour, minute=minute),
                             tzinfo=business_timezone(policy['timezone']))
    return local.astimezone(timezone.utc)


def _parse_time(raw):
    try:
        parts = str(raw or '17:00').split(':')
        return int(parts[0]) % 24, int(parts[1]) % 60
    except (ValueError, IndexError):
        return 17, 0


def is_late(week_start, now=None, policy=None):
    now = now or datetime.now(timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return now > submission_deadline(week_start, policy)


def period_label(week_start, week_end=None):
    week_end = week_end or (week_start + timedelta(days=6))
    return f"{week_start.isoformat()} – {week_end.isoformat()}"


def available_weeks(reference=None, count=13, policy=None):
    """Current, previous and historical week starts (newest first)."""
    policy = policy or get_policy()
    current, _ = week_bounds(reference or date.today(), policy)
    return [shift_week(current, -i, policy) for i in range(max(1, count))]


def money(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))
