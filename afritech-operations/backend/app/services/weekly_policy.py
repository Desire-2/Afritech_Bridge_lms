"""Centralized weekly reporting policy — the only place date math lives.

The official reporting week is Sunday 00:00:00 through Saturday 23:59:59.999
in ``Africa/Kigali``. Weekday settings from the old Saturday–Friday policy are
deliberately overridden here: a settings row cannot silently change the legal
reporting period, and routes/services must never compute a boundary by hand.
"""
from datetime import date, datetime, time, timedelta, timezone
from decimal import Decimal
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from ..extensions import db
from ..models import Setting

# Python weekdays: Monday=0 … Sunday=6.
WEEK_START_WEEKDAY = 6       # Sunday
WEEK_END_WEEKDAY = 5         # Saturday
SUBMISSION_WEEKDAY = 6       # Sunday after the reporting week closes

DEFAULTS = {
    'week_start_weekday': WEEK_START_WEEKDAY,
    'week_end_weekday': WEEK_END_WEEKDAY,
    'submission_weekday': SUBMISSION_WEEKDAY,
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


class WeekPolicyError(ValueError):
    """Raised when a caller supplies a date that is not a reporting Sunday."""


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
            # Kept in the response for backwards compatibility, but the
            # Sunday–Saturday statutory window is not configurable.
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
    policy['week_start_weekday'] = WEEK_START_WEEKDAY
    policy['week_end_weekday'] = WEEK_END_WEEKDAY
    policy['submission_weekday'] = SUBMISSION_WEEKDAY
    return policy


def business_timezone(name=None):
    try:
        return ZoneInfo(name or get_policy()['timezone'])
    except (ZoneInfoNotFoundError, ValueError):
        return ZoneInfo('Africa/Kigali')


def local_date(value, policy=None):
    """Convert a date/datetime to its calendar day in the business timezone."""
    if isinstance(value, datetime):
        tz = business_timezone((policy or {}).get('timezone'))
        if value.tzinfo is None:
            value = value.replace(tzinfo=tz)
        return value.astimezone(tz).date()
    if isinstance(value, date):
        return value
    raise WeekPolicyError('A date is required')


def week_bounds(on_date=None, policy=None):
    """Return the (Sunday, Saturday) reporting week containing ``on_date``."""
    policy = policy or get_policy()
    day = local_date(on_date or date.today(), policy)
    delta = (day.weekday() - WEEK_START_WEEKDAY) % 7
    start = day - timedelta(days=delta)
    return start, start + timedelta(days=6)


def week_end_for(week_start, policy=None):
    """Return the inclusive Saturday end for a validated Sunday start."""
    return require_week_start(week_start, policy) + timedelta(days=6)


def is_valid_week_start(week_start, policy=None):
    """True only for a Sunday start date."""
    try:
        return local_date(week_start, policy).weekday() == WEEK_START_WEEKDAY
    except WeekPolicyError:
        return False


def require_week_start(week_start, policy=None):
    """Validate a caller-supplied report week and return the Sunday date."""
    try:
        value = local_date(week_start, policy)
    except WeekPolicyError as exc:
        raise WeekPolicyError('week_start must be a date') from exc
    if value.weekday() != WEEK_START_WEEKDAY:
        raise WeekPolicyError('A reporting week must start on Sunday in Africa/Kigali')
    return value


def shift_week(week_start, weeks, policy=None):
    return week_start + timedelta(days=7 * int(weeks))


def week_window(week_start, policy=None):
    """Return half-open UTC bounds: Sunday 00:00 to the next Sunday 00:00.

    The end of the displayed week is Saturday 23:59:59.999 local time; using
    the following midnight as an exclusive bound avoids fractional-second
    precision errors in databases and serializers.
    """
    policy = policy or get_policy()
    start = require_week_start(week_start, policy)
    tz = business_timezone(policy['timezone'])
    local_start = datetime.combine(start, time.min, tzinfo=tz)
    next_start = datetime.combine(start + timedelta(days=7), time.min, tzinfo=tz)
    return local_start.astimezone(timezone.utc), next_start.astimezone(timezone.utc)


def in_week(value, week_start, policy=None):
    """Whether a timestamp/date falls in the Sunday–Saturday local week."""
    if value is None:
        return False
    policy = policy or get_policy()
    day = local_date(value, policy)
    start = require_week_start(week_start, policy)
    return start <= day <= start + timedelta(days=6)


def week_for_submission(scope_date, policy=None):
    """Return the completed Sunday–Saturday week due on ``scope_date``.

    Reports are submitted on the Sunday immediately after Saturday 23:59:59.999,
    so the scope date belongs to the *next* reporting week. This is the single
    place scheduler rules translate a submission day into a report period.
    """
    policy = policy or get_policy()
    day = local_date(scope_date, policy)
    if day.weekday() != SUBMISSION_WEEKDAY:
        return None
    return week_bounds(day - timedelta(days=1), policy)


def submission_deadline(week_start, policy=None):
    """Return an aware UTC deadline (Sunday 17:00 after the Saturday close)."""
    policy = policy or get_policy()
    start = require_week_start(week_start, policy)
    hour, minute = _parse_time(policy['deadline_time'])
    due_date = start + timedelta(days=(SUBMISSION_WEEKDAY - WEEK_START_WEEKDAY) % 7 or 7)
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
    """Current, previous and historical Sunday week starts (newest first)."""
    policy = policy or get_policy()
    current, _ = week_bounds(reference or date.today(), policy)
    return [shift_week(current, -i, policy) for i in range(max(1, count))]


def money(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))
