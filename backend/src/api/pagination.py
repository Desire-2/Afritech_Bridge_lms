"""Pagination, sorting and parameter parsing for the /api/v2 integration API."""

from __future__ import annotations

from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .constants import DEFAULT_PER_PAGE, MAX_PER_PAGE
from .errors import validation_error


def parse_paging(args, *, max_per_page: int = MAX_PER_PAGE) -> Tuple[int, int]:
    """Parse ``page`` (≥1) and ``per_page`` (1..max) query parameters."""
    page_raw = args.get("page", "1")
    per_page_raw = args.get("per_page", str(DEFAULT_PER_PAGE))
    try:
        page = int(page_raw)
    except (TypeError, ValueError):
        raise validation_error("Invalid pagination parameter.", [
            {"field": "page", "issue": "must be an integer ≥ 1"}
        ])
    try:
        per_page = int(per_page_raw)
    except (TypeError, ValueError):
        raise validation_error("Invalid pagination parameter.", [
            {"field": "per_page", "issue": "must be an integer ≥ 1"}
        ])
    if page < 1:
        raise validation_error("Invalid pagination parameter.", [
            {"field": "page", "issue": "must be ≥ 1"}
        ])
    if per_page < 1:
        raise validation_error("Invalid pagination parameter.", [
            {"field": "per_page", "issue": "must be ≥ 1"}
        ])
    if per_page > max_per_page:
        raise validation_error("Invalid pagination parameter.", [
            {"field": "per_page", "issue": f"must be ≤ {max_per_page}"}
        ])
    return page, per_page


def parse_sort(args, sort_whitelist: Dict[str, Any], default: str) -> Tuple[Any, str]:
    """Return ``(column, 'asc'|'desc')`` validating against a whitelist.

    ``sort_whitelist`` maps public field name -> column. Supports an optional
    leading ``-`` on ``sort`` for descending (``sort=-created_at``) as well as a
    separate ``order`` parameter.
    """
    raw = args.get("sort") or args.get("sort_by") or default
    order = (args.get("order") or "").strip().lower()
    field = str(raw).strip()
    descending = False
    if field.startswith("-"):
        descending = True
        field = field[1:]
    if field not in sort_whitelist:
        raise validation_error("Invalid sort parameter.", [
            {"field": "sort", "issue": f"must be one of: {', '.join(sorted(sort_whitelist))}"}
        ])
    if order in ("asc", "desc"):
        descending = order == "desc"
    elif order not in ("", None):
        raise validation_error("Invalid order parameter.", [
            {"field": "order", "issue": "must be 'asc' or 'desc'"}
        ])
    return sort_whitelist[field], ("desc" if descending else "asc")


def apply_sort(query, args, sort_whitelist: Dict[str, Any], default: str):
    column, order = parse_sort(args, sort_whitelist, default)
    return query.order_by(column.desc() if order == "desc" else column.asc())


def paginate_query(query, args, *, max_per_page: int = MAX_PER_PAGE):
    """Apply paging to a SQLAlchemy query; returns ``(items, pagination_dict)``."""
    page, per_page = parse_paging(args, max_per_page=max_per_page)
    total = query.count()
    total_pages = max(1, -(-total // per_page)) if total else 0
    items = query.offset((page - 1) * per_page).limit(per_page).all()
    return items, {
        "page": page,
        "per_page": per_page,
        "total_items": total,
        "total_pages": total_pages,
    }


def pagination_block(page: int, per_page: int, total: int) -> Dict[str, Any]:
    total_pages = max(1, -(-total // per_page)) if total else 0
    return {
        "page": page,
        "per_page": per_page,
        "total_items": total,
        "total_pages": total_pages,
    }


def require_fields(data: Dict[str, Any], fields: Sequence[str]) -> None:
    missing = [f for f in fields if data.get(f) in (None, "")]
    if missing:
        raise validation_error("The request contains missing required fields.", [
            {"field": f, "issue": "required"} for f in missing
        ])


def optional_str(data: Dict[str, Any], field: str, max_length: int = 10000,
                 default: Optional[str] = None) -> Optional[str]:
    value = data.get(field, default)
    if value is None:
        return None
    if not isinstance(value, str):
        raise validation_error("The request contains invalid fields.", [
            {"field": field, "issue": "must be a string"}
        ])
    if len(value) > max_length:
        raise validation_error("The request contains invalid fields.", [
            {"field": field, "issue": f"must be at most {max_length} characters"}
        ])
    return value


def parse_int_param(value: Any, field: str) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        raise validation_error("The request contains invalid fields.", [
            {"field": field, "issue": "must be an integer"}
        ])


def parse_iso_datetime(value: Any, field: str):
    """Parse an ISO-8601 timestamp (naive or offset-aware) for ``since`` filters."""
    from datetime import datetime
    if value in (None, ""):
        return None
    if isinstance(value, datetime):
        return value
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace("Z", "+00:00"))
    except ValueError:
        raise validation_error("The request contains invalid fields.", [
            {"field": field, "issue": "must be an ISO-8601 timestamp (e.g. 2026-10-18T09:00:00Z)"}
        ])
    if parsed.tzinfo is not None:
        # Store/compare in the app's naive Africa/Kigali wall-clock frame.
        from ..utils.time_utils import to_local
        return to_local(parsed)
    return parsed
