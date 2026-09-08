from datetime import date

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import CommissionRule, Service, Employee
from ..auth.auth import require_permission, current_user, current_employee
from ..services.commission import CommissionEngine, resolve_commission, default_rate
from ..services.audit import audit
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('commissions', __name__, url_prefix='/api/commissions')


@bp.get('/rules')
@require_permission('settings.manage')
def list_rules():
    q = CommissionRule.query
    scope = request.args.get('scope')
    if scope:
        q = q.filter_by(scope=scope)
    rules = q.order_by(CommissionRule.created_at.desc()).all()
    return jsonify({'rules': [r.to_dict() for r in rules]})


@bp.post('/rules')
@require_permission('settings.manage')
def create_rule():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'rate', 'scope')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    scope = data['scope']
    if scope not in ('default', 'service', 'employee'):
        return json_error('Scope must be default, service or employee')
    if scope == 'service' and not data.get('service_id'):
        return json_error('service_id is required for scope=service')
    if scope == 'employee' and not data.get('employee_id'):
        return json_error('employee_id is required for scope=employee')
    try:
        rate = float(data['rate'])
        if not (0 <= rate <= 1):
            return json_error('Rate must be between 0 and 1 (e.g. 0.20 = 20%)')
    except Exception:
        return json_error('Invalid rate value')
    rule = CommissionRule(
        rate=rate,
        scope=scope,
        service_id=data.get('service_id') or None,
        employee_id=data.get('employee_id') or None,
        effective_from=date.fromisoformat(data['effective_from']) if data.get('effective_from') else date.today(),
        effective_until=date.fromisoformat(data['effective_until']) if data.get('effective_until') else None,
        is_active=bool(data.get('is_active', True)),
        note=data.get('note'),
    )
    db.session.add(rule)
    db.session.commit()
    audit('commission_rule_created', 'commission_rule', rule.id, new_value=data)
    return jsonify({'message': 'Commission rule created', 'rule': rule.to_dict()}), 201


@bp.put('/rules/<int:rule_id>')
@require_permission('settings.manage')
def update_rule(rule_id):
    data = parse_json()
    rule = CommissionRule.query.get(rule_id)
    if not rule:
        return json_error('Rule not found', 404)
    prev = rule.to_dict()
    if 'rate' in data:
        try:
            rate = float(data['rate'])
            if not (0 <= rate <= 1):
                return json_error('Rate must be between 0 and 1')
            rule.rate = rate
        except Exception:
            return json_error('Invalid rate')
    if 'is_active' in data:
        rule.is_active = bool(data['is_active'])
    if 'effective_from' in data and data['effective_from']:
        rule.effective_from = date.fromisoformat(data['effective_from'])
    if 'effective_until' in data and data['effective_until']:
        rule.effective_until = date.fromisoformat(data['effective_until'])
    if 'note' in data:
        rule.note = data['note']
    db.session.commit()
    audit('commission_rule_updated', 'commission_rule', rule.id, prev, rule.to_dict())
    return jsonify({'message': 'Rule updated', 'rule': rule.to_dict()})


@bp.get('/effective')
@require_permission('settings.manage')
def effective_rates():
    """Return the effective rate for a given service/employee."""
    service_id = request.args.get('service_id', type=int)
    employee_id = request.args.get('employee_id', type=int)
    svc = Service.query.get(service_id) if service_id else None
    emp = Employee.query.get(employee_id) if employee_id else None
    rate, source = CommissionEngine().current_rate(service=svc, employee=emp)
    return jsonify({'rate': float(rate), 'source': source})


@bp.get('/default')
@require_permission('settings.manage')
def effective_default():
    rate, source = default_rate()
    return jsonify({'rate': float(rate), 'source': source})