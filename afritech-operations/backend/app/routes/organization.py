"""Management API for branches and departments.

The employee blueprint keeps its small active-only pickers. These routes add
the missing management operations: searchable/paginated lists (including
archived rows), detail, create, update, archive and restore.
"""
from flask import Blueprint, jsonify, request

from ..auth.auth import require_any_permission, require_permission
from ..services.organization import (
    KINDS, create_unit, get_unit, query_units, serialize, set_active, summary,
    update_unit,
)
from .helpers import json_error, paginate, paginate_response, parse_json

bp = Blueprint('organization', __name__, url_prefix='/api/organization')


def _active_filter(value):
    """Map UI status filter to a boolean. Returns (value, error)."""
    if value is None or not value.strip() or value.lower() == 'all':
        return None, None
    if value.lower() in ('active', 'true', '1'):
        return True, None
    if value.lower() in ('inactive', 'archived', 'false', '0'):
        return False, None
    return None, json_error('Invalid is_active filter')


def _list(kind):
    active, err = _active_filter(request.args.get('is_active'))
    if err:
        return err
    search = (request.args.get('search') or '').strip() or None
    model = KINDS[kind]['model']
    q = query_units(kind, search=search, is_active=active)
    p = paginate(q.order_by(model.name.asc(), model.id.asc()))
    return paginate_response(
        [serialize(row, kind, with_count=True) for row in p.items], p
    )


def _detail(kind, unit_id):
    unit = get_unit(kind, unit_id)
    if not unit:
        return json_error(f"{KINDS[kind]['label']} not found", 404)
    return jsonify({KINDS[kind]['entity']: serialize(unit, kind, with_count=True,
                                                    include_employees=True)})


def _create(kind):
    unit, err = create_unit(kind, parse_json())
    if err:
        return json_error(err)
    label = KINDS[kind]['entity']
    return jsonify({'message': f'{label.capitalize()} created',
                    label: serialize(unit, kind, with_count=True)}), 201


def _update(kind, unit_id):
    unit = get_unit(kind, unit_id)
    if not unit:
        return json_error(f"{KINDS[kind]['label']} not found", 404)
    err = update_unit(kind, unit, parse_json())
    if err:
        return json_error(err)
    label = KINDS[kind]['entity']
    return jsonify({'message': f'{label.capitalize()} updated',
                    label: serialize(unit, kind, with_count=True)})


def _archive(kind, unit_id):
    unit = get_unit(kind, unit_id)
    if not unit:
        return json_error(f"{KINDS[kind]['label']} not found", 404)
    affected = set_active(kind, unit, False)
    label = KINDS[kind]['entity']
    return jsonify({
        'message': f'{label.capitalize()} archived',
        label: serialize(unit, kind, with_count=True),
        'employee_count': affected,
    })


def _restore(kind, unit_id):
    unit = get_unit(kind, unit_id)
    if not unit:
        return json_error(f"{KINDS[kind]['label']} not found", 404)
    set_active(kind, unit, True)
    label = KINDS[kind]['entity']
    return jsonify({'message': f'{label.capitalize()} restored',
                    label: serialize(unit, kind, with_count=True)})


@bp.get('/summary')
@require_any_permission('branches.manage', 'departments.manage')
def organization_summary():
    return jsonify(summary())


@bp.get('/branches')
@require_permission('branches.manage')
def list_branches():
    return _list('branches')


@bp.get('/branches/<int:unit_id>')
@require_permission('branches.manage')
def get_branch(unit_id):
    return _detail('branches', unit_id)


@bp.post('/branches')
@require_permission('branches.manage')
def add_branch():
    return _create('branches')


@bp.patch('/branches/<int:unit_id>')
@require_permission('branches.manage')
def edit_branch(unit_id):
    return _update('branches', unit_id)


@bp.delete('/branches/<int:unit_id>')
@require_permission('branches.manage')
def archive_branch(unit_id):
    return _archive('branches', unit_id)


@bp.post('/branches/<int:unit_id>/restore')
@require_permission('branches.manage')
def restore_branch(unit_id):
    return _restore('branches', unit_id)


@bp.get('/departments')
@require_permission('departments.manage')
def list_departments():
    return _list('departments')


@bp.get('/departments/<int:unit_id>')
@require_permission('departments.manage')
def get_department(unit_id):
    return _detail('departments', unit_id)


@bp.post('/departments')
@require_permission('departments.manage')
def add_department():
    return _create('departments')


@bp.patch('/departments/<int:unit_id>')
@require_permission('departments.manage')
def edit_department(unit_id):
    return _update('departments', unit_id)


@bp.delete('/departments/<int:unit_id>')
@require_permission('departments.manage')
def archive_department(unit_id):
    return _archive('departments', unit_id)


@bp.post('/departments/<int:unit_id>/restore')
@require_permission('departments.manage')
def restore_department(unit_id):
    return _restore('departments', unit_id)
