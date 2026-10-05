from datetime import date

from flask import request, jsonify


def parse_pagination():
    page = request.args.get('page', 1, type=int)
    per_page = min(request.args.get('per_page', 50, type=int), 500)
    return page, per_page


def paginate(query):
    page, per_page = parse_pagination()
    p = query.paginate(page=page, per_page=per_page, error_out=False)
    return p


def paginate_response(items, pagination_obj):
    return jsonify({
        'items': items,
        'total': pagination_obj.total,
        'page': pagination_obj.page,
        'per_page': pagination_obj.per_page,
        'pages': pagination_obj.pages,
        'has_next': pagination_obj.has_next,
        'has_prev': pagination_obj.has_prev,
    })


def json_error(message, status=400, code=None):
    payload = {'error': message}
    if code:
        payload['code'] = code
    return jsonify(payload), status


def parse_json():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def required(data, *fields):
    missing = [f for f in fields if not data.get(f)]
    return missing


def to_decimal(value, default=None):
    from decimal import Decimal
    if value is None or value == '':
        return default
    try:
        return Decimal(str(value))
    except Exception:
        return default


# ── safe coercion of user-supplied values ─────────────────────────────────────
# `date.fromisoformat()` / `int()` raise on bad input, which turns a client typo
# into a 500. These helpers return (value, error_response) so routes can answer
# 400 instead.


def parse_date(value, field='date'):
    """Parse a user-supplied ISO date. Returns (date|None, error|None)."""
    if value is None or value == '':
        return None, None
    if isinstance(value, date):
        return value, None
    try:
        return date.fromisoformat(str(value)), None
    except (TypeError, ValueError):
        return None, json_error(f'Invalid {field} (expected YYYY-MM-DD)', 400)


def parse_id(value, field='id'):
    """Coerce a user-supplied id to int. Returns (int|None, error|None)."""
    if value is None or value == '':
        return None, None
    try:
        return int(value), None
    except (TypeError, ValueError):
        return None, json_error(f'Invalid {field}', 400)


def parse_id_list(values, field='ids'):
    """Coerce a list of user-supplied ids to unique ints.

    Returns (list[int], error|None). Rejects non-list input and non-numeric
    entries instead of raising.
    """
    if values is None:
        return [], None
    if not isinstance(values, (list, tuple)):
        return None, json_error(f'{field} must be a list of ids', 400)
    ids = []
    for value in values:
        parsed, err = parse_id(value, field)
        if err:
            return None, err
        ids.append(parsed)
    return list(dict.fromkeys(ids)), None


def parse_code_list(values, field='codes'):
    """Normalize a list of string codes: strip, drop blanks, dedupe.

    Returns (list[str], error|None). Duplicates matter here because the
    `user_roles` / `role_permissions` join tables have composite primary keys,
    so appending the same row twice would fail on flush.
    """
    if values is None:
        return [], None
    if not isinstance(values, (list, tuple)) or not all(isinstance(c, str) for c in values):
        return None, json_error(f'{field} must be a list of codes', 400)
    return list(dict.fromkeys(c.strip() for c in values if c and c.strip())), None