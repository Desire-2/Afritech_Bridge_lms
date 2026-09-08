from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import ServiceCategory, Service, Client, PaymentMethod
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('services', __name__, url_prefix='/api/services')


def make_client_number():
    from ..models import Client
    last = Client.query.order_by(Client.id.desc()).first()
    seq = (last.id + 1) if last else 1
    return f'CL-{seq:05d}'


def make_service_code():
    seq = (Service.query.count() or 0) + 1
    return f'SVC-{seq:04d}'


@bp.get('')
@require_any_permission('services.view', 'services.manage')
def list_services():
    q = Service.query
    category_id = request.args.get('category_id', type=int)
    active = request.args.get('active')
    search = request.args.get('search')
    if category_id:
        q = q.filter_by(category_id=category_id)
    if active is not None:
        q = q.filter_by(is_active=active.lower() == 'true')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Service.name.ilike(like), Service.code.ilike(like)))
    p = paginate(q.order_by(Service.name))
    return paginate_response([s.to_dict() for s in p.items], p)


@bp.post('')
@require_permission('services.manage')
def create_service():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'customer_price')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    svc = Service(
        name=data['name'],
        code=data.get('code') or make_service_code(),
        description=data.get('description'),
        official_cost=data.get('official_cost', 0),
        customer_price=data['customer_price'],
        commission_rate=data.get('commission_rate') if data.get('commission_rate') not in (None, '') else None,
        category_id=data.get('category_id') or None,
        is_active=bool(data.get('is_active', True)),
    )
    db.session.add(svc)
    db.session.commit()
    audit('service_created', 'service', svc.id, new_value=svc.to_dict())
    return jsonify({'message': 'Service created', 'service': svc.to_dict()}), 201


@bp.get('/<int:service_id>')
@require_any_permission('services.view', 'services.manage')
def get_service(service_id):
    svc = Service.query.get(service_id)
    if not svc:
        return json_error('Service not found', 404)
    return jsonify({'service': svc.to_dict()})


@bp.put('/<int:service_id>')
@require_permission('services.manage')
def update_service(service_id):
    data = parse_json()
    svc = Service.query.get(service_id)
    if not svc:
        return json_error('Service not found', 404)
    prev = svc.to_dict()
    for field in ['name', 'description', 'official_cost', 'customer_price', 'category_id', 'is_active']:
        if field in data:
            setattr(svc, field, data[field])
    if 'commission_rate' in data:
        svc.commission_rate = data['commission_rate'] if data['commission_rate'] not in (None, '') else None
    db.session.commit()
    audit('service_updated', 'service', svc.id, prev, svc.to_dict())
    return jsonify({'message': 'Service updated', 'service': svc.to_dict()})


@bp.post('/<int:service_id>/deactivate')
@require_permission('services.manage')
def deactivate_service(service_id):
    svc = Service.query.get(service_id)
    if not svc:
        return json_error('Service not found', 404)
    svc.is_active = False
    db.session.commit()
    audit('service_deactivated', 'service', svc.id, prev=True, new_value=False)
    return jsonify({'message': 'Service deactivated'})


@bp.post('/<int:service_id>/reactivate')
@require_permission('services.manage')
def reactivate_service(service_id):
    svc = Service.query.get(service_id)
    if not svc:
        return json_error('Service not found', 404)
    svc.is_active = True
    db.session.commit()
    audit('service_reactivated', 'service', svc.id, prev=False, new_value=True)
    return jsonify({'message': 'Service reactivated'})


# ---------- categories ----------
@bp.get('/categories/list', endpoint='list_categories_static')
@require_any_permission('services.view', 'services.manage')
def list_categories():
    cats = ServiceCategory.query.filter_by(is_active=True).order_by(ServiceCategory.name).all()
    return jsonify({'categories': [c.to_dict() for c in cats]})


@bp.post('/categories/', endpoint='create_category_slash')
@bp.post('/categories', endpoint='create_category')
@require_permission('services.manage')
def create_category():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if ServiceCategory.query.filter_by(code=data['code']).first():
        return json_error('Category code already exists')
    cat = ServiceCategory(name=data['name'], code=data['code'], description=data.get('description'),
                          is_active=bool(data.get('is_active', True)))
    db.session.add(cat)
    db.session.commit()
    audit('category_created', 'service_category', cat.id, new_value=data)
    return jsonify({'message': 'Category created', 'category': cat.to_dict()}), 201


# ---------- payment methods ----------
@bp.get('/payment-methods', endpoint='list_payment_methods')
@require_any_permission('services.view', 'transactions.view', 'transactions.create')
def list_payment_methods():
    methods = PaymentMethod.query.filter_by(is_active=True).order_by(PaymentMethod.name).all()
    return jsonify({'payment_methods': [m.to_dict() for m in methods]})


@bp.post('/payment-methods/', endpoint='create_payment_method_slash')
@bp.post('/payment-methods', endpoint='create_payment_method')
@require_permission('settings.manage')
def create_payment_method():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if PaymentMethod.query.filter_by(code=data['code']).first():
        return json_error('Payment method code already exists')
    pm = PaymentMethod(name=data['name'], code=data['code'], is_active=bool(data.get('is_active', True)))
    db.session.add(pm)
    db.session.commit()
    audit('payment_method_created', 'payment_method', pm.id, new_value=data)
    return jsonify({'message': 'Payment method created', 'payment_method': pm.to_dict()}), 201