"""Shop-specific settings: costing method, discount limits, loyalty, numbering."""
import json

from flask import Blueprint, jsonify, request

from ...extensions import db
from ...models import Setting, PaymentMethod
from ...auth.auth import require_permission, require_any_permission
from ...auth.shop_scope import DEFAULT_DISCOUNT_THRESHOLDS, SHOP_COST_PERMISSIONS
from ...services.audit import audit
from ...services.shop_series import preview, PREFIXES
from ..helpers import json_error, parse_json

bp = Blueprint('shop_settings', __name__, url_prefix='/api/shop')

# key -> (value_type, allowed values or None for free-form JSON)
EDITABLE = {
    'shop.inventory.costing_method': ('string', {'wac', 'fifo'}),
    'shop.discount.thresholds': ('json', None),
    'shop.loyalty.earn_rate': ('float', None),
    'shop.alerts.dead_stock_days': ('int', None),
    'shop.alerts.low_stock_days': ('int', None),
    'shop.scanner': ('json', None),
}

# How the till talks to a barcode scanner (stored under `shop.scanner`).
SCANNER_DEFAULTS = {
    'preferred_input': 'hardware',
    'auto_add': True,
    'increment_repeat': True,
    'sound': True,
    'vibration': True,
    'autofocus': True,
    'scan_timeout_ms': 800,
    'dedupe_window_ms': 1200,
}
SCANNER_INPUTS = {'camera', 'hardware', 'manual'}
SCANNER_BOOL_KEYS = ('auto_add', 'increment_repeat', 'sound', 'vibration',
                     'autofocus')
SCANNER_INT_KEYS = ('scan_timeout_ms', 'dedupe_window_ms')


def _read(key, default=None):
    row = Setting.query.filter_by(key=key).first()
    return row.value if row else default


def _convert(row):
    if row.value_type == 'int':
        try:
            return int(row.value)
        except (TypeError, ValueError):
            return row.value
    if row.value_type == 'float':
        try:
            return float(row.value)
        except (TypeError, ValueError):
            return row.value
    if row.value_type == 'json':
        try:
            return json.loads(row.value)
        except (TypeError, ValueError):
            return row.value
    return row.value


def _write(key, value, value_type):
    row = Setting.query.filter_by(key=key).first()
    if row is None:
        row = Setting(key=key, group='shop', value_type=value_type)
        db.session.add(row)
    if value_type == 'json':
        row.value = json.dumps(value)
    else:
        row.value = str(value)
    row.value_type = value_type
    row.group = 'shop'
    return row


def _scanner_settings():
    """Stored scanner profile merged over the defaults."""
    stored = _read('shop.scanner')
    if isinstance(stored, str):
        try:
            stored = json.loads(stored)
        except ValueError:
            stored = None
    merged = dict(SCANNER_DEFAULTS)
    if isinstance(stored, dict):
        merged.update(stored)
    return merged


def _validate_scanner(value):
    """``None`` when ``value`` is an acceptable scanner profile, else a 400."""
    if not isinstance(value, dict):
        return json_error('shop.scanner must be an object', 400,
                          'invalid_setting_value')
    unknown = sorted(key for key in value if key not in SCANNER_DEFAULTS)
    if unknown:
        return json_error(f'Unknown scanner option {", ".join(unknown)}', 400,
                          'invalid_setting_value')
    preferred = value.get('preferred_input')
    if preferred is not None and preferred not in SCANNER_INPUTS:
        return json_error(
            'shop.scanner.preferred_input must be one of '
            + ', '.join(sorted(SCANNER_INPUTS)), 400, 'invalid_setting_value')
    for key in SCANNER_BOOL_KEYS:
        if key in value and not isinstance(value[key], bool):
            return json_error(f'shop.scanner.{key} must be true or false', 400,
                              'invalid_setting_value')
    for key in SCANNER_INT_KEYS:
        if key in value:
            raw = value[key]
            if isinstance(raw, bool) or not isinstance(raw, int) \
                    or not 100 <= raw <= 5000:
                return json_error(
                    f'shop.scanner.{key} must be a whole number between '
                    '100 and 5000', 400, 'invalid_setting_value')
    return None


@bp.get('/settings')
@require_any_permission('shop.settings.manage', 'shop.view')
def get_shop_settings():
    thresholds = _read('shop.discount.thresholds')
    if isinstance(thresholds, str):
        try:
            thresholds = json.loads(thresholds)
        except ValueError:
            thresholds = None
    merged = dict(DEFAULT_DISCOUNT_THRESHOLDS)
    if isinstance(thresholds, dict):
        merged.update(thresholds)
    return jsonify({
        'costing_method': _read('shop.inventory.costing_method', 'wac'),
        'discount_thresholds': merged,
        'loyalty_earn_rate': _read('shop.loyalty.earn_rate', '1'),
        'alerts': {
            'dead_stock_days': _read('shop.alerts.dead_stock_days', 90),
            'low_stock_days': _read('shop.alerts.low_stock_days', 7),
        },
        'scanner': _scanner_settings(),
        'prefixes': PREFIXES,
        'editable_keys': sorted(EDITABLE),
    })


@bp.put('/settings')
@bp.patch('/settings')
@require_permission('shop.settings.manage')
def update_shop_settings():
    data = parse_json()
    if not data:
        return json_error('No settings supplied', 400)
    previous = {}
    applied = {}
    for key, raw in data.items():
        if key not in EDITABLE:
            return json_error(f'{key} cannot be changed here', 400,
                              'unknown_setting')
        value_type, allowed = EDITABLE[key]
        if value_type == 'string':
            value = str(raw).strip().lower()
            if allowed and value not in allowed:
                return json_error(
                    f'{key} must be one of {", ".join(sorted(allowed))}', 400,
                    'invalid_setting_value')
        elif value_type == 'int':
            try:
                value = int(raw)
            except (TypeError, ValueError):
                return json_error(f'{key} must be a whole number', 400,
                                  'invalid_setting_value')
            if value < 0:
                return json_error(f'{key} cannot be negative', 400,
                                  'invalid_setting_value')
        elif value_type == 'float':
            try:
                value = float(raw)
            except (TypeError, ValueError):
                return json_error(f'{key} must be a number', 400,
                                  'invalid_setting_value')
            if value < 0:
                return json_error(f'{key} cannot be negative', 400,
                                  'invalid_setting_value')
        else:  # json
            value = raw
            if not isinstance(value, (dict, list)):
                return json_error(f'{key} must be an object', 400,
                                  'invalid_setting_value')
            if key == 'shop.scanner':
                error = _validate_scanner(value)
                if error is not None:
                    return error
        previous[key] = _read(key)
        applied[key] = value
        _write(key, value, value_type)
    db.session.commit()
    audit('shop_settings_updated', 'setting', None,
          previous_value=previous, new_value=applied)
    return get_shop_settings()


@bp.get('/settings/numbering-preview')
@require_any_permission('shop.settings.manage', 'shop.view')
def numbering_preview():
    kind = request.args.get('kind', 'sale')
    if kind not in PREFIXES:
        return json_error(f'Unknown document kind {kind}', 400,
                          'unknown_document_kind')
    return jsonify({'kind': kind, 'next': preview(kind)})


@bp.get('/payment-methods')
@require_any_permission('shop.sales.create', 'shop.view')
def shop_payment_methods():
    """Tender options for the till.

    Shop roles deliberately hold no ``services.view``/``transactions.*``
    (that is the Service Agent workspace), so the POS needs its own read-only
    view of the shared payment methods.
    """
    rows = PaymentMethod.query.filter_by(is_active=True).order_by(PaymentMethod.name)
    return jsonify({'payment_methods': [m.to_dict() for m in rows]})
