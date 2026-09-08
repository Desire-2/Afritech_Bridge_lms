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


def json_error(message, status=400):
    return jsonify({'error': message}), status


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