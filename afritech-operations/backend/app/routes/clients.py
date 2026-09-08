from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Client
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('clients', __name__, url_prefix='/api/clients')


def make_client_number():
    last = Client.query.order_by(Client.id.desc()).first()
    seq = (last.id + 1) if last else 1
    return f'CL-{seq:05d}'


@bp.get('')
@require_any_permission('clients.view', 'clients.manage')
def list_clients():
    q = Client.query
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(
            Client.first_name.ilike(like), Client.last_name.ilike(like),
            Client.phone.ilike(like), Client.client_number.ilike(like),
        ))
    p = paginate(q.order_by(Client.created_at.desc()))
    user = current_user()
    items = []
    for c in p.items:
        d = c.to_dict()
        items.append(d)
    return paginate_response(items, p)


@bp.post('')
@require_permission('clients.manage')
def create_client():
    from .helpers import required
    data = parse_json()
    missing = required(data, 'first_name', 'last_name')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    client = Client(
        client_number=make_client_number(),
        first_name=data['first_name'],
        last_name=data['last_name'],
        phone=data.get('phone'),
        reference_info=data.get('reference_info'),
        created_by=current_user().id,
    )
    db.session.add(client)
    db.session.commit()
    audit('client_created', 'client', client.id, new_value=client.to_dict())
    return jsonify({'message': 'Client created', 'client': client.to_dict()}), 201


@bp.get('/<int:client_id>')
@require_any_permission('clients.view', 'clients.manage')
def get_client(client_id):
    client = Client.query.get(client_id)
    if not client:
        return json_error('Client not found', 404)
    return jsonify({'client': client.to_dict()})


@bp.put('/<int:client_id>')
@require_permission('clients.manage')
def update_client(client_id):
    data = parse_json()
    client = Client.query.get(client_id)
    if not client:
        return json_error('Client not found', 404)
    prev = client.to_dict()
    for field in ['first_name', 'last_name', 'phone', 'reference_info']:
        if field in data:
            setattr(client, field, data[field])
    db.session.commit()
    audit('client_updated', 'client', client.id, prev, client.to_dict())
    return jsonify({'message': 'Client updated', 'client': client.to_dict()})