from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import User, Role, Permission
from ..auth.auth import require_permission, require_any_permission, current_user
from ..services.audit import audit
from ..services.employee_link import ensure_employee_for_user
from .helpers import json_error, parse_json, parse_code_list

bp = Blueprint('users', __name__, url_prefix='/api/users')


def _roles_by_code(codes):
    """One query for every requested role code -> {code: Role}."""
    if not codes:
        return {}
    rows = Role.query.filter(Role.code.in_(codes)).all()
    return {r.code: r for r in rows}


def _permissions_by_code(codes):
    """One query for every requested permission code -> {code: Permission}."""
    if not codes:
        return {}
    rows = Permission.query.filter(Permission.code.in_(codes)).all()
    return {p.code: p for p in rows}


def _role_codes_payload(value):
    """Validate a roles payload. Returns (codes, error_response_or_None).

    'super_admin' is accepted but maps to the User.is_super_admin flag, never to
    a role row.
    """
    if value is None:
        return [], None
    codes, err = parse_code_list(value, 'roles')
    if err:
        return None, err
    if not codes:
        return [], None
    lookup = _roles_by_code([c for c in codes if c != 'super_admin'])
    unknown = [c for c in codes if c != 'super_admin' and c not in lookup]
    if unknown:
        return None, json_error(f'Unknown role(s): {", ".join(unknown)}')
    return codes, None


def _permission_codes_payload(value):
    """Validate a permissions payload. Returns (codes, error_response_or_None)."""
    if value is None:
        return [], None
    codes, err = parse_code_list(value, 'permissions')
    if err:
        return None, err
    if not codes:
        return [], None
    lookup = _permissions_by_code(codes)
    unknown = [c for c in codes if c not in lookup]
    if unknown:
        return None, json_error(f'Unknown permission(s): {", ".join(unknown)}')
    return codes, None


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

    codes, err = _role_codes_payload(data.get('roles'))
    if err:
        return err
    role_rows = _roles_by_code([c for c in (codes or []) if c != 'super_admin'])

    user = User(email=email)
    user.set_password(data['password'])
    user.is_active = bool(data.get('is_active', True))
    # The 'super_admin' role code maps to the flag (single source of truth).
    user.is_super_admin = bool(data['is_super_admin']) if 'is_super_admin' in data \
        else ('super_admin' in codes)
    user.must_change_password = bool(data.get('must_change_password', True))
    db.session.add(user)
    db.session.flush()
    for code in codes:
        if code == 'super_admin':
            continue
        user.roles.append(role_rows[code])

    # Create (or link) an employee profile so the user shows up in the
    # employee directory and employee-scoped features (profile, earnings,
    # ownership checks) work. Opt out with create_employee: false.
    if bool(data.get('create_employee', True)):
        ensure_employee_for_user(
            user,
            first_name=data.get('first_name'),
            last_name=data.get('last_name'),
            phone=data.get('phone'),
            position=data.get('position'),
            branch_id=data.get('branch_id'),
            department_id=data.get('department_id'),
            roles=[c for c in codes if c != 'super_admin'] if 'roles' in data else None,
        )

    db.session.commit()
    audit('user_created', 'user', user.id, new_value={
        'email': email,
        'roles': [c for c in codes if c != 'super_admin'] if 'roles' in data else None,
        'is_super_admin': user.is_super_admin,
        'employee_id': user.employee.id if user.employee else None,
    })
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
    actor = current_user()
    prev = {'is_active': user.is_active, 'is_super_admin': user.is_super_admin, 'roles': user.role_codes}

    if 'is_active' in data and not bool(data['is_active']) and user.id == actor.id:
        return json_error('Cannot deactivate your own account')
    if 'is_super_admin' in data and not bool(data['is_super_admin']) \
            and user.is_super_admin and user.id == actor.id:
        return json_error('Cannot remove your own super admin access')

    password_reset_by_admin = False
    if 'password' in data and data['password']:
        if len(data['password']) < 8:
            return json_error('Password must be at least 8 characters')
        user.set_password(data['password'])
        password_reset_by_admin = True
    if 'roles' in data:
        codes, err = _role_codes_payload(data['roles'])
        if err:
            return err
        if 'super_admin' in codes:
            user.is_super_admin = True
        codes = [c for c in codes if c != 'super_admin']
        role_rows = _roles_by_code(codes)
        # Preserve inactive roles — they are invisible to the UI but must not
        # be silently dropped on a save.
        preserved = [r for r in user.roles if not r.is_active]
        user.roles = preserved
        for code in codes:
            user.roles.append(role_rows[code])
    if 'is_active' in data:
        user.is_active = bool(data['is_active'])
    if 'is_super_admin' in data:
        user.is_super_admin = bool(data['is_super_admin'])
    # If super admin was revoked, purge the legacy super_admin role row so
    # access is actually revoked.
    if not user.is_super_admin:
        user.roles = [r for r in user.roles if r.code != 'super_admin']
    if password_reset_by_admin:
        # An admin-set password must end every session the old one opened,
        # otherwise the credential change does not actually lock anyone out.
        from .auth import revoke_all_sessions
        revoke_all_sessions(user.id)
    db.session.commit()
    audit('user_updated', 'user', user.id, prev, {'is_active': user.is_active, 'is_super_admin': user.is_super_admin, 'roles': user.role_codes})
    return jsonify({'message': 'User updated', 'user': user.to_dict()})


@bp.delete('/<int:user_id>')
@require_permission('users.manage')
def deactivate_user(user_id):
    user = User.query.get(user_id)
    if not user:
        return json_error('User not found', 404)
    if user.id == current_user().id:
        return json_error('Cannot deactivate your own account')
    if user.is_super_admin:
        return json_error('Cannot deactivate a super admin', 400)
    user.is_active = False
    db.session.commit()
    audit('user_deactivated', 'user', user.id, previous_value=True, new_value=False)
    return jsonify({'message': 'User deactivated'})


@bp.get('/roles')
@require_any_permission('users.view', 'roles.manage', 'employees.manage')
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
    code = data['code'].strip().lower()
    if not code:
        return json_error('Invalid: code')
    if Role.query.filter_by(code=code).first():
        return json_error('Role code already exists')
    perm_codes, err = _permission_codes_payload(data.get('permissions'))
    if err:
        return err
    role = Role(code=code, name=data['name'], description=data.get('description'))
    if perm_codes:
        perm_rows = _permissions_by_code(perm_codes)
        for pcode in perm_codes:
            role.permissions.append(perm_rows[pcode])
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
    if role.is_system and not current_user().is_super_admin:
        return json_error('Only a super admin can modify system roles', 403)
    prev_perms = sorted(p.code for p in role.permissions)
    if 'name' in data:
        role.name = data['name']
    if 'description' in data:
        role.description = data['description']
    if 'permissions' in data:
        perm_codes, err = _permission_codes_payload(data['permissions'])
        if err:
            return err
        role.permissions = [Permission.query.filter_by(code=c).first() for c in perm_codes]
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