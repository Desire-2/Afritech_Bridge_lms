"""Central Africa/Kigali time helpers.

The application stores timestamps directly in local (Africa/Kigali, UTC+2)
wall-clock time. `now_local()` returns a NAIVE datetime (no tzinfo) so it can
be dropped into any place that previously used `datetime.utcnow()`, which was
also naive. Aware helpers are provided for the few comparison/read paths that
normalize stored values to an aware frame.
"""
from datetime import datetime, date, timezone

IANA_TIMEZONE = "Africa/Kigali"


def _get_tz():
    from zoneinfo import ZoneInfo
    return ZoneInfo(IANA_TIMEZONE)


def now_local() -> datetime:
    """Current Africa/Kigali wall-clock time, NAIVE (matches old utcnow)."""
    return datetime.now(_get_tz()).replace(tzinfo=None)


def utc_now() -> datetime:
    """Current UTC wall-clock time, naive."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


def today_local() -> date:
    """Today's date in Africa/Kigali."""
    return now_local().date()


def to_local(dt: datetime | None) -> datetime | None:
    """Normalize a naive/aware datetime to naive Africa/Kigali wall clock."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt
    return dt.astimezone(_get_tz()).replace(tzinfo=None)


def aware_now_local() -> datetime:
    """Current Africa/Kigali wall-clock time, AWARE."""
    return datetime.now(_get_tz())


def make_aware_local(dt: datetime | None) -> datetime | None:
    """Normalize a stored (naive) datetime to the aware Kigali frame."""
    if dt is None:
        return None
    if dt.tzinfo is None:
        return dt.replace(tzinfo=_get_tz())
    return dt.astimezone(_get_tz())
