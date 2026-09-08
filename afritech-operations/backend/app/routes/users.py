from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import User, Role, Permission, user_roles
from ..auth.auth import require_permission
from ..services.audit import audit
from .helpers import json_error, parse_json, parse_pagination

bp = Blueprint('users', __name__, url_prefix='/api/users')


@bp.get('')
@require_permission('users.view')
def list_users():
    from ..routes.helpers import paginate, paginate_response
    q = User.query
    email = request.args.get('email')
    if email:
        q = q.filter(User.email.ilike(f'%{email}%'))
    p = paginate(q.order_by(User.created_at.desc()))
    return paginate_response([u.to_dict() for u in p.items], p)


@bp.post('')
@require_permission('users.manage')
def create_user():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'email', 'password')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    email = data['email'].strip().lower()
    if User.query.filter_by(email=email).first():
        return json_error('A user with this email already exists')
    if len(data['password']) < 8:
        return json_error('Password must be at least 8 characters')

    user = User(email=email)
    user.set_password(data['password'])
    user.is_active = bool(data.get('is_active', True))
    user.is_super_admin = bool(data.get('is_super_admin', False))
    user.must_change_password = bool(data.get('must_change_password', True))
    db.session.add(user)
    db.session.flush()
    for code in data.get('roles', []):
        role = Role.query.filter_by(code=code).first()
        if role:
            user.roles.append(role)
    db.session.commit()
    audit('user_created', 'user', user.id, new_value={'email': email, 'roles': data.get('roles')})
    return jsonify({'message': 'User created', 'user': user.to_dict()}), 201


@bp.get('/<int:user_id>')
@require_permission('users.view')
def get_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return json_error('User not found', 404)
    return jsonify({'user': user.to_dict()})


@bp.put('/<int:user_id>')
@require_permission('users.manage')
def update_user(user_id):
    data = parse_json()
    user = User.query.get(user_id)
    if not user:
        return json_error('User not found', 404)
    prev = {'is_active': user.is_active, 'is_super_admin': user.is_super_admin, 'roles': user.role_codes}

    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    if 'is_super_admin' in data:
        user.is_super_admin = bool(data['is_super_admin'])
    if 'password' in data and data['password']:
        if len(data['password']) < 8:
            return json_error('Password must be at least 8 characters')
        user.set_password(data['password'])
    if 'roles' in data:
        user.roles = []
        for code in data['roles']:
            role = Role.query.filter_by(code=code).first()
            if role:
                user.roles.append(role)
    db.session.commit()
    audit('user_updated', 'user', user.id, prev, {'is_active': user.is_active, 'is_super_admin': user.is_super_admin, 'roles': user.role_codes})
    return jsonify({'message': 'User updated', 'user': user.to_dict()})


@bp.delete('/<int:user_id>')
@require_permission('users.manage')
def deactivate_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return json_error('User not found', 404)
    if user.is_super_admin:
        return json_error('Cannot deactivate a super admin', 400)
    user.is_active = False
    db.session.commit()
    audit('user_deactivated', 'user', user.id, prev=True, new_value=False)
    return jsonify({'message': 'User deactivated'})


@bp.get('/roles')
@require_permission('users.view')
def list_roles():
    roles = Role.query.filter_by(is_active=True).all()
    return jsonify({'roles': [r.to_dict() for r in roles]})


@bp.post('/roles')
@require_permission('roles.manage')
def create_role():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'code', 'name')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if Role.query.filter_by(code=data['code']).first():
        return json_error('Role code already exists')
    role = Role(code=data['code'], name=data['name'], description=data.get('description'))
    for code in data.get('permissions', []):
        perm = Permission.query.filter_by(code=code).first()
        if perm:
            role.permissions.append(perm)
    db.session.add(role)
    db.session.commit()
    audit('role_created', 'role', role.id, new_value={'code': role.code, 'permissions': data.get('permissions')})
    return jsonify({'message': 'Role created', 'role': role.to_dict()}), 201


@bp.put('/roles/<int:role_id>')
@require_permission('roles.manage')
def update_role(role_id):
    data = parse_json()
    role = Role.query.get(role_id)
    if not role:
        return json_error('Role not found', 404)
    prev_perms = sorted(p.code for p in role.permissions)
    if 'name' in data:
        role.name = data['name']
    if 'description' in data:
        role.description = data['description']
    if 'permissions' in data:
        role.permissions = []
        for code in data['permissions']:
            perm = Permission.query.filter_by(code=code).first()
            if perm:
                role.permissions.append(perm)
    if 'is_active' in data:
        role.is_active = bool(data['is_active'])
    db.session.commit()
    audit('role_updated', 'role', role.id, {'permissions': prev_perms}, {'permissions': sorted(p.code for p in role.permissions)})
    return jsonify({'message': 'Role updated', 'role': role.to_dict()})


@bp.get('/permissions')
@require_permission('users.view')
def list_permissions():
    perms = Permission.query.order_by(Permission.code).all()
    return jsonify({'permissions': [p.to_dict() for p in perms]})