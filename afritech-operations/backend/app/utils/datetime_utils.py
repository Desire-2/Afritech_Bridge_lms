"""Timezone helpers shared by routes and services."""
from datetime import datetime, timezone

__all__ = ['as_utc']


def as_utc(value):
    """Normalize a datetime to timezone-aware UTC.

    Columns declared as `DateTime(timezone=True)` come back aware from
    PostgreSQL but **naive** from SQLite (dev/tests) — the driver drops the
    offset. Mixing the two raises
    `TypeError: can't subtract offset-naive and offset-aware datetimes`
    (clock-out, password-reset expiry, automation cutoffs). Treating every
    stored datetime as UTC keeps arithmetic and comparisons valid on both.
    """
    if value is None:
        return None
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)
