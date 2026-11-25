"""Shared branch and department management logic.

Branches and departments are parallel dimensions: a department does not belong
to a branch. Employees and a few operational records reference them
independently, so "delete" means archive (``is_active=False``) — history and
reporting must keep the original label.

Both the legacy employee pickers and the full management API use these helpers
so validation and audit behaviour stay in one place.
"""
from ..extensions import db
from ..models import Branch, Department, Employee
from .audit import audit


KINDS = {
    'branches': {
        'model': Branch,
        'entity': 'branch',
        'label': 'Branch',
        'fields': ('name', 'code', 'city', 'address', 'phone'),
        'search_fields': ('name', 'code', 'city', 'address', 'phone'),
    },
    'departments': {
        'model': Department,
        'entity': 'department',
        'label': 'Department',
        'fields': ('name', 'code', 'description'),
        'search_fields': ('name', 'code', 'description'),
    },
}


def _config(kind):
    return KINDS[kind]


def _clean(value):
    if value is None:
        return None
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def _normalize_code(value):
    code = _clean(value)
    return code.upper() if code else None


def _parse_bool(value, default=True):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        lowered = value.strip().lower()
        if lowered in ('true', '1', 'yes', 'on'):
            return True
        if lowered in ('false', '0', 'no', 'off'):
            return False
    return default


def query_units(kind, search=None, is_active=None):
    """Return a base query; the caller applies ordering and pagination."""
    cfg = _config(kind)
    q = cfg['model'].query
    if is_active is not None:
        q = q.filter(cfg['model'].is_active.is_(bool(is_active)))
    if search:
        like = f'%{search.strip()}%'
        q = q.filter(db.or_(*[
            getattr(cfg['model'], field).ilike(like)
            for field in cfg['search_fields']
        ]))
    return q


def get_unit(kind, unit_id):
    return db.session.get(_config(kind)['model'], unit_id)


def serialize(unit, kind, with_count=False, include_employees=False):
    """Serialize with optional headcount and a short employee preview."""
    cfg = _config(kind)
    data = unit.to_dict()
    data['created_at'] = unit.created_at.isoformat() if unit.created_at else None
    data['updated_at'] = unit.updated_at.isoformat() if unit.updated_at else None
    if with_count or include_employees:
        fk = f"{cfg['entity']}_id"
        data['employee_count'] = Employee.query.filter_by(**{fk: unit.id}).count()
    if include_employees:
        fk = f"{cfg['entity']}_id"
        recent = (Employee.query.filter_by(**{fk: unit.id})
                  .order_by(Employee.id.desc()).limit(8).all())
        data['recent_employees'] = [
            {'id': e.id, 'name': e.full_name, 'position': e.position}
            for e in recent
        ]
    return data


def _validate_identity(name, code):
    if len(name) > 128:
        return 'Name is too long (max 128 characters)'
    if len(code) > 32:
        return 'Code is too long (max 32 characters)'
    return None


def _duplicate(kind, code, exclude_id=None):
    cfg = _config(kind)
    model = cfg['model']
    q = model.query.filter(db.func.upper(model.code) == code)
    if exclude_id is not None:
        q = q.filter(model.id != exclude_id)
    return q.first()


def create_unit(kind, data):
    """Create a branch/department. Returns (unit, error_message)."""
    cfg = _config(kind)
    name = _clean(data.get('name'))
    code = _normalize_code(data.get('code'))
    if not name or not code:
        return None, 'Name and code are required'
    too_long = _validate_identity(name, code)
    if too_long:
        return None, too_long
    if _duplicate(kind, code):
        return None, f"{cfg['label']} code already exists"
    values = {field: _clean(data.get(field)) for field in cfg['fields']}
    values['name'] = name
    values['code'] = code
    values['is_active'] = _parse_bool(data.get('is_active'), True)
    unit = cfg['model'](**values)
    db.session.add(unit)
    db.session.commit()
    audit(f"{cfg['entity']}_created", cfg['entity'], unit.id, new_value=unit.to_dict())
    return unit, None


def update_unit(kind, unit, data):
    """Update mutable fields. Returns an error message or None."""
    cfg = _config(kind)
    previous = unit.to_dict()
    if 'name' in data or 'code' in data:
        name = _clean(data.get('name', unit.name))
        code = _normalize_code(data.get('code', unit.code))
        if not name or not code:
            return 'Name and code are required'
        too_long = _validate_identity(name, code)
        if too_long:
            return too_long
        if _duplicate(kind, code, exclude_id=unit.id):
            return f"{cfg['label']} code already exists"
        unit.name = name
        unit.code = code
    for field in cfg['fields']:
        if field in ('name', 'code') or field not in data:
            continue
        setattr(unit, field, _clean(data.get(field)))
    if 'is_active' in data:
        unit.is_active = _parse_bool(data.get('is_active'), unit.is_active)
    db.session.commit()
    audit(f"{cfg['entity']}_updated", cfg['entity'], unit.id,
          previous_value=previous, new_value=unit.to_dict())
    return None


def set_active(kind, unit, active, action=None):
    """Activate or archive a unit. Returns the number of employees affected."""
    cfg = _config(kind)
    previous = unit.to_dict()
    unit.is_active = bool(active)
    fk = f"{cfg['entity']}_id"
    affected = Employee.query.filter_by(**{fk: unit.id}).count()
    db.session.commit()
    verb = 'restored' if active else 'archived'
    audit(action or f"{cfg['entity']}_{verb}", cfg['entity'], unit.id,
          previous_value=previous, new_value=unit.to_dict())
    return affected


def summary():
    """Small overview used by both management screens."""
    branch_count = Branch.query.count()
    dept_count = Department.query.count()
    return {
        'branches': branch_count,
        'active_branches': Branch.query.filter_by(is_active=True).count(),
        'departments': dept_count,
        'active_departments': Department.query.filter_by(is_active=True).count(),
        'employees': Employee.query.count(),
        'unassigned_employees': Employee.query.filter(
            Employee.branch_id.is_(None), Employee.department_id.is_(None)
        ).count(),
    }
