"""Company + personal activity planning (Secretary workspace)."""

from datetime import datetime, time as dtime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Activity, ActivityParticipant, ActivityChecklistItem, Task,
    ACTIVITY_CATEGORIES, ACTIVITY_STATUSES, ACTIVITY_PRIORITIES,
)
from ..auth.auth import require_permission, require_any_permission, current_user
from ..auth.scope import employee_scope_error, employee_ids_scope_error, scope_error_status
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id, parse_id_list,
)

bp = Blueprint('activities', __name__, url_prefix='/api/activities')


def _parse_time(value):
    if not value:
        return None
    try:
        return dtime.fromisoformat(str(value))
    except Exception:
        return None


def _deny_personal_owner(activity, user):
    """Return an error response when ``user`` may not write to a personal plan."""
    if activity.scope == 'personal' and activity.owner_user_id != user.id \
            and not user.is_super_admin:
        return json_error('You can only manage your own personal activities', 403)
    return None


@bp.post('/reorder')
@require_permission('activities.manage')
def reorder_activities():
    """Reorder the daily planner sequence."""
    data = parse_json()
    items = data.get('items') or []
    if not isinstance(items, list):
        return json_error('items must be a list')
    user = current_user()
    updated = 0
    for entry in items:
        if not isinstance(entry, dict) or not entry.get('id'):
            continue
        act_id, err = parse_id(entry.get('id'), 'activity id')
        if err:
            return err
        if not act_id:
            continue
        act = Activity.query.get(act_id)
        if not act:
            continue
        if act.scope == 'personal' and act.owner_user_id != user.id \
                and not user.is_super_admin:
            continue
        position, err = parse_id(entry.get('position'), 'position')
        if err:
            return err
        act.position = position or 0
        updated += 1
    db.session.commit()
    audit('activities_reordered', 'activity', None, new_value={'updated': updated})
    return jsonify({'message': f'{updated} activities reordered'})


@bp.get('')
@require_any_permission('activities.view', 'activities.manage')
def list_activities():
    user = current_user()
    q = Activity.query
    scope = request.args.get('scope', 'all')  # all | company | personal
    mine = request.args.get('mine') == 'true'

    if scope == 'personal' or mine:
        q = q.filter_by(scope='personal', owner_user_id=user.id)
    elif scope == 'company':
        q = q.filter_by(scope='company')
    else:
        q = q.filter(db.or_(Activity.scope == 'company',
                            db.and_(Activity.scope == 'personal',
                                    Activity.owner_user_id == user.id)))
    if request.args.get('start'):
        start, err = parse_date(request.args['start'], 'start')
        if err:
            return err
        q = q.filter(Activity.activity_date >= start)
    if request.args.get('end'):
        end, err = parse_date(request.args['end'], 'end')
        if err:
            return err
        q = q.filter(Activity.activity_date <= end)
    status = request.args.get('status')
    category = request.args.get('category')
    search = request.args.get('search')
    if status:
        q = q.filter_by(status=status)
    if category:
        q = q.filter_by(category=category)
    if search:
        q = q.filter(Activity.title.ilike(f'%{search}%'))
    p = paginate(q.order_by(Activity.activity_date.asc(), Activity.start_time.asc(),
                            Activity.position.asc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.post('')
@require_permission('activities.manage')
def create_activity():
    user = current_user()
    data = parse_json()
    missing = required(data, 'title', 'activity_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    activity_date, err = parse_date(data['activity_date'], 'activity_date')
    if err:
        return err
    if activity_date is None:
        return json_error('Missing: activity_date')
    scope = data.get('scope', 'company')
    if scope not in ('company', 'personal'):
        return json_error('scope must be company or personal')
    status = data.get('status', 'planned')
    if status not in ACTIVITY_STATUSES:
        return json_error(f'Invalid status: {status}')
    category = data.get('category', 'Administration')
    if category not in ACTIVITY_CATEGORIES:
        return json_error(f'Invalid category: {category}')
    priority = data.get('priority')
    if priority not in ACTIVITY_PRIORITIES:
        priority = 'medium'
    participant_ids, err = parse_id_list(data.get('participant_ids'), 'participant_ids')
    if err:
        return err
    err = employee_ids_scope_error(user, participant_ids)
    if err:
        return json_error(err, scope_error_status(err))
    for field in ('organizer_id', 'department_id', 'branch_id'):
        data[field], err = parse_id(data.get(field), field)
        if err:
            return err
    position, err = parse_id(data.get('position'), 'position')
    if err:
        return err

    owner_id = user.id if scope == 'personal' else (data.get('owner_user_id') or None)
    activity = Activity(
        title=data['title'],
        description=data.get('description'),
        activity_date=activity_date,
        start_time=_parse_time(data.get('start_time')),
        end_time=_parse_time(data.get('end_time')),
        category=category,
        priority=priority,
        location=data.get('location'),
        expected_outcome=data.get('expected_outcome'),
        status=status,
        notes=data.get('notes'),
        scope=scope,
        owner_user_id=owner_id,
        organizer_id=data['organizer_id'],
        department_id=data['department_id'],
        branch_id=data['branch_id'],
        position=position or 0,
        created_by=user.id,
    )
    db.session.add(activity)
    db.session.flush()
    for emp_id in participant_ids:
        db.session.add(ActivityParticipant(activity_id=activity.id, employee_id=emp_id))
    for i, title in enumerate(data.get('checklist') or [], start=1):
        if isinstance(title, str) and title.strip():
            db.session.add(ActivityChecklistItem(activity_id=activity.id, title=title.strip(), position=i))
    db.session.commit()
    audit('activity_created', 'activity', activity.id, new_value=activity.to_dict())
    return jsonify({'message': 'Activity created', 'activity': activity.to_dict(with_children=True)}), 201


@bp.get('/<int:activity_id>')
@require_any_permission('activities.view', 'activities.manage')
def get_activity(activity_id):
    activity = Activity.query.get(activity_id)
    if not activity:
        return json_error('Activity not found', 404)
    if activity.scope == 'personal' and activity.owner_user_id != current_user().id \
            and not current_user().has_permission('activities.manage'):
        return json_error('You do not have permission to view this activity', 403)
    return jsonify({'activity': activity.to_dict(with_children=True)})


@bp.put('/<int:activity_id>')
@require_permission('activities.manage')
def update_activity(activity_id):
    user = current_user()
    data = parse_json()
    activity = Activity.query.get(activity_id)
    if not activity:
        return json_error('Activity not found', 404)
    denied = _deny_personal_owner(activity, user)
    if denied:
        return denied

    participant_ids = None
    if 'participant_ids' in data:
        participant_ids, err = parse_id_list(data['participant_ids'], 'participant_ids')
        if err:
            return err
        err = employee_ids_scope_error(user, participant_ids)
        if err:
            return json_error(err, scope_error_status(err))

    if 'activity_date' in data and data['activity_date']:
        activity_date, err = parse_date(data['activity_date'], 'activity_date')
        if err:
            return err
        if activity_date is not None:
            activity.activity_date = activity_date

    prev = activity.to_dict()
    for field in ['title', 'description', 'location', 'expected_outcome', 'notes']:
        if field in data:
            setattr(activity, field, data[field] or None)
    for field in ('department_id', 'branch_id', 'organizer_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(activity, field, parsed)
    if 'position' in data:
        position, err = parse_id(data['position'], 'position')
        if err:
            return err
        # position is NOT NULL — never coerce an explicit 0/None into None.
        activity.position = position or 0
    if 'start_time' in data:
        activity.start_time = _parse_time(data.get('start_time'))
    if 'end_time' in data:
        activity.end_time = _parse_time(data.get('end_time'))
    if data.get('status'):
        if data['status'] not in ACTIVITY_STATUSES:
            return json_error(f'Invalid status: {data["status"]}')
        activity.status = data['status']
    if data.get('category'):
        if data['category'] not in ACTIVITY_CATEGORIES:
            return json_error(f'Invalid category: {data["category"]}')
        activity.category = data['category']
    if data.get('priority') in ACTIVITY_PRIORITIES:
        activity.priority = data['priority']
    if participant_ids is not None:
        wanted = set(participant_ids)
        for part in [p for p in activity.participants if p.employee_id not in wanted]:
            db.session.delete(part)
        existing = {p.employee_id for p in activity.participants}
        for emp_id in wanted - existing:
            db.session.add(ActivityParticipant(activity_id=activity.id, employee_id=emp_id))
    db.session.commit()
    audit('activity_updated', 'activity', activity.id, prev, activity.to_dict())
    return jsonify({'message': 'Activity updated', 'activity': activity.to_dict(with_children=True)})


@bp.delete('/<int:activity_id>')
@require_permission('activities.manage')
def delete_activity(activity_id):
    user = current_user()
    activity = Activity.query.get(activity_id)
    if not activity:
        return json_error('Activity not found', 404)
    denied = _deny_personal_owner(activity, user)
    if denied:
        return denied
    prev = activity.to_dict()
    db.session.delete(activity)
    db.session.commit()
    audit('activity_deleted', 'activity', activity_id, prev, None)
    return jsonify({'message': 'Activity deleted'})


@bp.post('/<int:activity_id>/participants')
@require_permission('activities.manage')
def add_participants(activity_id):
    user = current_user()
    data = parse_json()
    activity = Activity.query.get(activity_id)
    if not activity:
        return json_error('Activity not found', 404)
    denied = _deny_personal_owner(activity, user)
    if denied:
        return denied
    ids, err = parse_id_list(data.get('employee_ids'), 'employee_ids')
    if err:
        return err
    err = employee_ids_scope_error(user, ids)
    if err:
        return json_error(err, scope_error_status(err))
    existing = {p.employee_id for p in activity.participants}
    for emp_id in ids:
        if emp_id not in existing:
            db.session.add(ActivityParticipant(activity_id=activity.id, employee_id=emp_id))
            existing.add(emp_id)
    db.session.commit()
    audit('activity_participants_added', 'activity', activity.id, new_value={'employee_ids': ids})
    return jsonify({'message': 'Participants added', 'activity': activity.to_dict(with_children=True)})


# ── checklist ────────────────────────────────────────────────────────────────


@bp.post('/<int:activity_id>/checklist')
@require_permission('activities.manage')
def add_checklist_item(activity_id):
    user = current_user()
    data = parse_json()
    activity = Activity.query.get(activity_id)
    if not activity:
        return json_error('Activity not found', 404)
    denied = _deny_personal_owner(activity, user)
    if denied:
        return denied
    missing = required(data, 'title')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    position, err = parse_id(data.get('position'), 'position')
    if err:
        return err
    if position is None:
        position = max([c.position for c in activity.checklist] or [0]) + 1
    item = ActivityChecklistItem(
        activity_id=activity.id,
        title=data['title'],
        position=position,
    )
    db.session.add(item)
    db.session.commit()
    audit('activity_checklist_added', 'activity', activity.id, new_value=item.to_dict())
    return jsonify({'message': 'Checklist item added', 'item': item.to_dict()}), 201


@bp.put('/checklist/<int:item_id>')
@require_permission('activities.manage')
def update_checklist_item(item_id):
    data = parse_json()
    item = ActivityChecklistItem.query.get(item_id)
    if not item:
        return json_error('Checklist item not found', 404)
    denied = _deny_personal_owner(item.activity, current_user())
    if denied:
        return denied
    prev = item.to_dict()
    if 'title' in data and data['title']:
        item.title = data['title']
    if 'position' in data:
        position, err = parse_id(data['position'], 'position')
        if err:
            return err
        item.position = position or 1
    if 'is_done' in data:
        item.is_done = bool(data['is_done'])
        item.completed_at = datetime.now(timezone.utc) if item.is_done else None
    db.session.commit()
    audit('activity_checklist_updated', 'activity', item.activity_id, prev, item.to_dict())
    return jsonify({'message': 'Checklist item updated', 'item': item.to_dict()})


@bp.delete('/checklist/<int:item_id>')
@require_permission('activities.manage')
def delete_checklist_item(item_id):
    item = ActivityChecklistItem.query.get(item_id)
    if not item:
        return json_error('Checklist item not found', 404)
    activity_id = item.activity_id
    denied = _deny_personal_owner(item.activity, current_user())
    if denied:
        return denied
    db.session.delete(item)
    db.session.commit()
    audit('activity_checklist_removed', 'activity', activity_id, new_value={'id': item_id})
    return jsonify({'message': 'Checklist item removed'})


@bp.post('/checklist/<int:item_id>/task')
@require_permission('activities.manage')
def checklist_item_to_task(item_id):
    data = parse_json()
    user = current_user()
    item = ActivityChecklistItem.query.get(item_id)
    if not item:
        return json_error('Checklist item not found', 404)
    denied = _deny_personal_owner(item.activity, user)
    if denied:
        return denied
    if item.task_id:
        return json_error('This checklist item already has a task', 409)
    activity = item.activity
    assignee_id = data.get('assigned_to') or activity.organizer_id
    err = employee_scope_error(user, assignee_id)
    if err:
        return json_error(err, scope_error_status(err))
    assignee_id, err = parse_id(assignee_id, 'assigned_to')
    if err:
        return err
    priority = data.get('priority')
    if priority not in ('low', 'medium', 'high', 'urgent'):
        priority = 'medium'
    due_date, err = parse_date(data.get('due_date'), 'due_date')
    if err:
        return err
    task = Task(
        title=data.get('title') or item.title,
        description=data.get('description') or f'From activity: {activity.title}',
        assigned_to=assignee_id,
        created_by=user.id,
        priority=priority,
        due_date=due_date or activity.activity_date,
        activity_id=activity.id,
    )
    db.session.add(task)
    db.session.flush()
    item.task_id = task.id
    db.session.commit()
    audit('checklist_item_task_created', 'task', task.id, new_value=task.to_dict())
    notify_employee(task.assignee, 'task_assigned', f'New task assigned: {task.title}',
                    related_type='task', related_id=task.id)
    return jsonify({'message': 'Task created', 'task': task.to_dict()}), 201
