import json
from datetime import date

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Setting, PaymentMethod, PerformanceMetric, Branch, Department
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from ..services.performance import ensure_metrics, DEFAULT_METRICS
from .helpers import json_error, parse_json

bp = Blueprint('settings', __name__, url_prefix='/api/settings')


def _get_setting(key, default=None):
    row = Setting.query.filter_by(key=key).first()
    return row.value if row else default


def _set_setting(group, key, value, value_type='string'):
    row = Setting.query.filter_by(key=key).first()
    if not row:
        row = Setting(key=key, group=group, value_type=value_type)
        db.session.add(row)
    row.value = value
    row.value_type = value_type
    row.group = group
    return row


@bp.get('')
@require_any_permission('settings.manage')
def get_settings():
    rows = Setting.query.order_by(Setting.group, Setting.key).all()
    data = {'groups': {}}
    for r in rows:
        data['groups'].setdefault(r.group, {})[r.key] = _convert(r)
    data['business_name'] = _get_setting('business.name', 'AfriTech Bridge Operations')
    data['currency'] = _get_setting('business.currency', 'RWF')
    return jsonify(data)


def _convert(row):
    if row.value_type == 'int':
        try:
            return int(row.value)
        except Exception:
            return row.value
    if row.value_type == 'float':
        try:
            return float(row.value)
        except Exception:
            return row.value
    if row.value_type == 'boolean':
        return str(row.value).lower() in ('true', '1')
    if row.value_type == 'json':
        try:
            return json.loads(row.value)
        except Exception:
            return row.value
    return row.value


@bp.put('')
@require_permission('settings.manage')
def update_settings():
    data = parse_json()
    prev = {}
    for group, values in data.items():
        if not isinstance(values, dict):
            continue
        for key, value in values.items():
            full_key = f'{group}.{key}'
            prev[full_key] = _get_setting(full_key)
            if isinstance(value, bool):
                _set_setting(group, full_key, str(value).lower(), 'boolean')
            elif isinstance(value, int):
                _set_setting(group, full_key, str(value), 'int')
            elif isinstance(value, float):
                _set_setting(group, full_key, str(value), 'float')
            elif isinstance(value, (dict, list)):
                _set_setting(group, full_key, json.dumps(value), 'json')
            else:
                _set_setting(group, full_key, str(value), 'string')
    db.session.commit()
    audit('settings_updated', 'setting', None, prev, data)
    return get_settings()


# ---------- business ----------
@bp.get('/business')
@require_any_permission('settings.manage', 'reports.view')
def business():
    defaults = {
        'business.name': 'AfriTech Bridge Operations',
        'business.currency': 'RWF',
        'business.default_commission_rate': '0.20',
        'business.cash_shortage_threshold': '0',
        'timezone': 'Africa/Kigali',
    }
    out = {}
    for key, default in defaults.items():
        out[key] = _get_setting(key, default)
    return jsonify(out)


# ---------- performance weights ----------
@bp.get('/performance-metrics')
@require_any_permission('settings.manage', 'performance.view')
def performance_metrics():
    ensure_metrics()
    metrics = PerformanceMetric.query.order_by(PerformanceMetric.code).all()
    return jsonify({'metrics': [m.to_dict() for m in metrics]})


@bp.put('/performance-metrics')
@require_permission('settings.manage')
def update_performance_metrics():
    data = parse_json()
    metrics = data.get('metrics', [])
    prev = {}
    for m in metrics:
        row = PerformanceMetric.query.filter_by(code=m.get('code')).first()
        if not row:
            continue
        prev[m['code']] = row.to_dict()
        if 'weight' in m:
            row.weight = m['weight']
        if 'minimum_score' in m:
            row.minimum_score = m['minimum_score']
        if 'is_active' in m:
            row.is_active = bool(m['is_active'])
        if 'name' in m:
            row.name = m['name']
    db.session.commit()
    audit('performance_weights_updated', 'performance_metric', None, prev, data)
    return performance_metrics()


# ---------- payment methods ----------
@bp.get('/payment-methods')
@require_any_permission('settings.manage', 'services.view')
def payment_methods():
    methods = PaymentMethod.query.order_by(PaymentMethod.name).all()
    return jsonify({'payment_methods': [m.to_dict() for m in methods]})


@bp.put('/payment-methods')
@require_permission('settings.manage')
def update_payment_methods():
    data = parse_json()
    methods = data.get('payment_methods', [])
    for m in methods:
        row = PaymentMethod.query.filter_by(code=m.get('code')).first()
        if row:
            row.name = m.get('name', row.name)
            row.is_active = bool(m.get('is_active', row.is_active))
    db.session.commit()
    audit('payment_methods_updated', 'payment_method', None, new_value=methods)
    return payment_methods()


@bp.get('/notification-rules')
@require_permission('settings.manage')
def notification_rules():
    rules = {
        'automation.cash_shortage_threshold': _get_setting('automation.cash_shortage_threshold', '0'),
        'automation.plan_progress_threshold': _get_setting('automation.plan_progress_threshold', '50'),
        'automation.ungraded_days': _get_setting('automation.ungraded_days', '7'),
        'automation.missing_closing_alert': _get_setting('automation.missing_closing_alert', 'true'),
    }
    return jsonify({'rules': rules})