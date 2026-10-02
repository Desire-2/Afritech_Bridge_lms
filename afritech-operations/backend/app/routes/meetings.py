"""Meeting management: scheduling, participants, agendas, minutes, action items."""

import json
from datetime import date, datetime, time as dtime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Meeting, MeetingParticipant, AgendaItem, MeetingMinute, ActionItem, Task, Employee,
    MEETING_STATUSES, ACTION_ITEM_STATUSES,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..auth.scope import employee_scope_error, employee_ids_scope_error, scope_error_status
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id, parse_id_list,
)

bp = Blueprint('meetings', __name__, url_prefix='/api/meetings')


def _parse_time(value):
    if not value:
        return None
    try:
        return dtime.fromisoformat(str(value))
    except Exception:
        return None


@bp.get('')
@require_any_permission('meetings.view', 'meetings.manage')
def list_meetings():
    user = current_user()
    q = Meeting.query
    status = request.args.get('status')
    search = request.args.get('search')
    mine = request.args.get('mine') == 'true'
    if request.args.get('start'):
        start, err = parse_date(request.args['start'], 'start')
        if err:
            return err
        q = q.filter(Meeting.meeting_date >= start)
    if request.args.get('end'):
        end, err = parse_date(request.args['end'], 'end')
        if err:
            return err
        q = q.filter(Meeting.meeting_date <= end)
    if status:
        q = q.filter_by(status=status)
    if search:
        q = q.filter(db.or_(Meeting.title.ilike(f'%{search}%'),
                            Meeting.location.ilike(f'%{search}%')))
    if mine:
        emp = current_employee()
        participant_ids = []
        if emp:
            participant_ids = [p.meeting_id for p in MeetingParticipant.query.filter_by(employee_id=emp.id).all()]
        q = q.filter(db.or_(Meeting.organizer_id == user.id,
                            Meeting.created_by == user.id,
                            Meeting.id.in_(participant_ids or [-1])))
    p = paginate(q.order_by(Meeting.meeting_date.asc(), Meeting.start_time.asc()))
    return paginate_response([m.to_dict() for m in p.items], p)


@bp.post('')
@require_permission('meetings.manage')
def create_meeting():
    user = current_user()
    data = parse_json()
    missing = required(data, 'title', 'meeting_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    meeting_date, err = parse_date(data['meeting_date'], 'meeting_date')
    if err:
        return err
    if meeting_date is None:
        return json_error('Missing: meeting_date')
    participant_ids, err = parse_id_list(data.get('participant_ids'), 'participant_ids')
    if err:
        return err
    err = employee_ids_scope_error(user, participant_ids)
    if err:
        return json_error(err, scope_error_status(err))
    for field in ('department_id', 'branch_id'):
        data[field], err = parse_id(data.get(field), field)
        if err:
            return err
    status = data.get('status', 'scheduled')
    if status not in MEETING_STATUSES:
        return json_error(f'Invalid status: {status}')
    meeting = Meeting(
        title=data['title'],
        description=data.get('description'),
        meeting_date=meeting_date,
        start_time=_parse_time(data.get('start_time')),
        end_time=_parse_time(data.get('end_time')),
        location=data.get('location'),
        online_link=data.get('online_link'),
        status=status,
        department_id=data['department_id'],
        branch_id=data['branch_id'],
        organizer_id=user.id,
        created_by=user.id,
    )
    db.session.add(meeting)
    db.session.flush()
    for emp_id in participant_ids:
        db.session.add(MeetingParticipant(meeting_id=meeting.id, employee_id=emp_id))
    db.session.commit()
    audit('meeting_created', 'meeting', meeting.id, new_value=meeting.to_dict())
    for emp_id in participant_ids:
        emp = Employee.query.get(emp_id)
        notify_employee(emp, 'meeting_invited',
                        f'You are invited to "{meeting.title}" on {meeting.meeting_date}.',
                        related_type='meeting', related_id=meeting.id)
    return jsonify({'message': 'Meeting created', 'meeting': meeting.to_dict(with_children=True)}), 201


@bp.get('/action-items')
@require_any_permission('meetings.view', 'meetings.manage', 'tasks.view')
def list_action_items():
    q = ActionItem.query
    status = request.args.get('status')
    overdue = request.args.get('overdue')
    if status:
        q = q.filter_by(status=status)
    if overdue == 'true':
        q = q.filter(ActionItem.deadline.isnot(None), ActionItem.deadline < date.today(),
                     ActionItem.status.in_(('open', 'in_progress')))
    p = paginate(q.order_by(ActionItem.deadline.is_(None), ActionItem.deadline.asc(),
                            ActionItem.id.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.get('/agendas')
@require_any_permission('meetings.view', 'meetings.manage')
def list_agendas():
    q = AgendaItem.query.join(Meeting)
    upcoming = request.args.get('upcoming') != 'false'
    if upcoming:
        q = q.filter(Meeting.meeting_date >= date.today())
    p = paginate(q.order_by(Meeting.meeting_date.desc(), AgendaItem.position.asc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.get('/minutes')
@require_any_permission('meetings.view', 'meetings.manage')
def list_minutes():
    q = MeetingMinute.query.join(Meeting)
    search = request.args.get('search')
    if search:
        q = q.filter(db.or_(Meeting.title.ilike(f'%{search}%'),
                            MeetingMinute.summary.ilike(f'%{search}%')))
    p = paginate(q.order_by(Meeting.meeting_date.desc()))
    return paginate_response([m.to_dict() for m in p.items], p)


@bp.get('/<int:meeting_id>')
@require_any_permission('meetings.view', 'meetings.manage')
def get_meeting(meeting_id):
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    return jsonify({'meeting': meeting.to_dict(with_children=True)})


@bp.put('/<int:meeting_id>')
@require_permission('meetings.manage')
def update_meeting(meeting_id):
    data = parse_json()
    user = current_user()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    participant_ids = None
    if 'participant_ids' in data:
        participant_ids, err = parse_id_list(data['participant_ids'], 'participant_ids')
        if err:
            return err
        err = employee_ids_scope_error(user, participant_ids)
        if err:
            return json_error(err, scope_error_status(err))
    if 'meeting_date' in data and data['meeting_date']:
        meeting_date, err = parse_date(data['meeting_date'], 'meeting_date')
        if err:
            return err
        if meeting_date is not None:
            meeting.meeting_date = meeting_date
    prev = meeting.to_dict()
    for field in ['title', 'description', 'location', 'online_link']:
        if field in data:
            setattr(meeting, field, data[field] or None)
    for field in ('department_id', 'branch_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(meeting, field, parsed)
    if 'start_time' in data:
        meeting.start_time = _parse_time(data.get('start_time'))
    if 'end_time' in data:
        meeting.end_time = _parse_time(data.get('end_time'))
    if data.get('status'):
        if data['status'] not in MEETING_STATUSES:
            return json_error(f'Invalid status: {data["status"]}')
        meeting.status = data['status']
    if participant_ids is not None:
        wanted = set(participant_ids)
        for part in [p for p in meeting.participants if p.employee_id not in wanted]:
            db.session.delete(part)
        existing = {p.employee_id for p in meeting.participants}
        for emp_id in wanted - existing:
            db.session.add(MeetingParticipant(meeting_id=meeting.id, employee_id=emp_id))
    db.session.commit()
    audit('meeting_updated', 'meeting', meeting.id, prev, meeting.to_dict())
    return jsonify({'message': 'Meeting updated', 'meeting': meeting.to_dict(with_children=True)})


@bp.delete('/<int:meeting_id>')
@require_permission('meetings.manage')
def delete_meeting(meeting_id):
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    prev = meeting.to_dict()
    db.session.delete(meeting)
    db.session.commit()
    audit('meeting_deleted', 'meeting', meeting_id, prev, None)
    return jsonify({'message': 'Meeting deleted'})


@bp.post('/<int:meeting_id>/participants')
@require_permission('meetings.manage')
def add_participants(meeting_id):
    data = parse_json()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    ids, err = parse_id_list(data.get('employee_ids'), 'employee_ids')
    if err:
        return err
    err = employee_ids_scope_error(current_user(), ids)
    if err:
        return json_error(err, scope_error_status(err))
    existing = {p.employee_id for p in meeting.participants}
    added = []
    for emp_id in ids:
        if emp_id in existing:
            continue
        db.session.add(MeetingParticipant(meeting_id=meeting.id, employee_id=emp_id))
        existing.add(emp_id)
        added.append(emp_id)
    db.session.commit()
    audit('meeting_participants_added', 'meeting', meeting.id, new_value={'employee_ids': added})
    for emp_id in added:
        notify_employee(Employee.query.get(emp_id), 'meeting_invited',
                        f'You are invited to "{meeting.title}" on {meeting.meeting_date}.',
                        related_type='meeting', related_id=meeting.id)
    return jsonify({'message': f'{len(added)} participant(s) added', 'meeting': meeting.to_dict(with_children=True)})


@bp.delete('/<int:meeting_id>/participants/<int:employee_id>')
@require_permission('meetings.manage')
def remove_participant(meeting_id, employee_id):
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    # Same scope rule as adding: a coordinator cannot add a Service Agent, so
    # they must not be able to edit or remove one a manager invited either.
    err = employee_scope_error(current_user(), employee_id)
    if err:
        return json_error(err, scope_error_status(err))
    part = MeetingParticipant.query.filter_by(meeting_id=meeting_id, employee_id=employee_id).first()
    if not part:
        return json_error('Participant not found', 404)
    db.session.delete(part)
    db.session.commit()
    audit('meeting_participant_removed', 'meeting', meeting_id, new_value={'employee_id': employee_id})
    return jsonify({'message': 'Participant removed'})


@bp.post('/<int:meeting_id>/attendance')
@require_permission('meetings.manage')
def record_meeting_attendance(meeting_id):
    data = parse_json()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    records = data.get('records') or []
    if not isinstance(records, list) or not all(isinstance(r, dict) for r in records):
        return json_error('records must be a list of {employee_id, attended} objects')
    employee_ids = [r.get('employee_id') for r in records]
    parsed_ids, err = parse_id_list(employee_ids, 'employee_id')
    if err:
        return err
    err = employee_ids_scope_error(current_user(), parsed_ids)
    if err:
        return json_error(err, scope_error_status(err))
    for rec, emp_id in zip(records, parsed_ids):
        part = MeetingParticipant.query.filter_by(
            meeting_id=meeting_id, employee_id=emp_id).first()
        if part:
            part.attended = bool(rec.get('attended'))
    db.session.commit()
    audit('meeting_attendance_recorded', 'meeting', meeting_id, new_value={'records': records})
    return jsonify({'message': 'Attendance recorded', 'meeting': meeting.to_dict(with_children=True)})


# ── agenda ───────────────────────────────────────────────────────────────────


@bp.post('/<int:meeting_id>/agenda')
@require_permission('meetings.manage')
def add_agenda_item(meeting_id):
    data = parse_json()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    missing = required(data, 'title')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    presenter_id = None
    if data.get('presenter_id'):
        err = employee_scope_error(current_user(), data['presenter_id'])
        if err:
            return json_error(err, scope_error_status(err))
        presenter_id, err = parse_id(data['presenter_id'], 'presenter_id')
        if err:
            return err
    position, err = parse_id(data.get('position'), 'position')
    if err:
        return err
    if position is None:
        position = max([a.position for a in meeting.agenda] or [0]) + 1
    item = AgendaItem(
        meeting_id=meeting.id,
        title=data['title'],
        notes=data.get('notes'),
        presenter_id=presenter_id,
        position=position,
    )
    db.session.add(item)
    db.session.commit()
    audit('agenda_item_created', 'meeting', meeting.id, new_value=item.to_dict())
    return jsonify({'message': 'Agenda item added', 'agenda_item': item.to_dict()}), 201


@bp.put('/agenda/<int:item_id>')
@require_permission('meetings.manage')
def update_agenda_item(item_id):
    data = parse_json()
    item = AgendaItem.query.get(item_id)
    if not item:
        return json_error('Agenda item not found', 404)
    if 'presenter_id' in data and data['presenter_id']:
        err = employee_scope_error(current_user(), data['presenter_id'])
        if err:
            return json_error(err, scope_error_status(err))
    prev = item.to_dict()
    for field in ['title', 'notes']:
        if field in data:
            setattr(item, field, data[field])
    if 'position' in data:
        position, err = parse_id(data['position'], 'position')
        if err:
            return err
        # position is NOT NULL
        item.position = position or 1
    if 'presenter_id' in data:
        presenter_id, err = parse_id(data['presenter_id'], 'presenter_id')
        if err:
            return err
        item.presenter_id = presenter_id
    db.session.commit()
    audit('agenda_item_updated', 'meeting', item.meeting_id, prev, item.to_dict())
    return jsonify({'message': 'Agenda item updated', 'agenda_item': item.to_dict()})


@bp.delete('/agenda/<int:item_id>')
@require_permission('meetings.manage')
def delete_agenda_item(item_id):
    item = AgendaItem.query.get(item_id)
    if not item:
        return json_error('Agenda item not found', 404)
    meeting_id = item.meeting_id
    db.session.delete(item)
    db.session.commit()
    audit('agenda_item_deleted', 'meeting', meeting_id, new_value={'id': item_id})
    return jsonify({'message': 'Agenda item deleted'})


@bp.post('/agenda/<int:item_id>/task')
@require_permission('meetings.manage')
def agenda_item_to_task(item_id):
    """Turn an agenda item into an assignable task."""
    data = parse_json()
    user = current_user()
    item = AgendaItem.query.get(item_id)
    if not item:
        return json_error('Agenda item not found', 404)
    if item.task_id:
        return json_error('This agenda item already has a task', 409)
    assignee_id = data.get('assigned_to') or item.presenter_id
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
        description=data.get('description') or item.notes,
        assigned_to=assignee_id,
        created_by=user.id,
        priority=priority,
        due_date=due_date,
        meeting_id=item.meeting_id,
    )
    db.session.add(task)
    db.session.flush()
    item.task_id = task.id
    db.session.commit()
    audit('agenda_item_task_created', 'task', task.id, new_value=task.to_dict())
    notify_employee(task.assignee, 'task_assigned', f'New task assigned: {task.title}',
                    related_type='task', related_id=task.id)
    return jsonify({'message': 'Task created from agenda item', 'task': task.to_dict()}), 201


# ── minutes ──────────────────────────────────────────────────────────────────


@bp.post('/<int:meeting_id>/minutes')
@require_permission('meetings.manage')
def record_minutes(meeting_id):
    data = parse_json()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    attachment_ids, err = parse_id_list(data.get('attachment_ids'), 'attachment_ids')
    if err:
        return err
    minute = MeetingMinute(
        meeting_id=meeting.id,
        summary=data.get('summary'),
        discussion=data.get('discussion'),
        decisions=data.get('decisions'),
        attachments=json.dumps(attachment_ids),
        recorded_by=current_user().id,
    )
    db.session.add(minute)
    if meeting.status == 'scheduled':
        meeting.status = 'completed'
    db.session.commit()
    audit('meeting_minutes_recorded', 'meeting', meeting.id, new_value=minute.to_dict())
    return jsonify({'message': 'Minutes recorded', 'minutes': minute.to_dict()}), 201


@bp.put('/minutes/<int:minute_id>')
@require_permission('meetings.manage')
def update_minutes(minute_id):
    data = parse_json()
    minute = MeetingMinute.query.get(minute_id)
    if not minute:
        return json_error('Minutes not found', 404)
    if 'attachment_ids' in data:
        attachment_ids, err = parse_id_list(data['attachment_ids'], 'attachment_ids')
        if err:
            return err
        minute.attachments = json.dumps(attachment_ids)
    prev = minute.to_dict()
    for field in ['summary', 'discussion', 'decisions']:
        if field in data:
            setattr(minute, field, data[field])
    db.session.commit()
    audit('meeting_minutes_updated', 'meeting', minute.meeting_id, prev, minute.to_dict())
    return jsonify({'message': 'Minutes updated', 'minutes': minute.to_dict()})


# ── action items ─────────────────────────────────────────────────────────────


@bp.post('/<int:meeting_id>/action-items')
@require_permission('meetings.manage')
def create_action_item(meeting_id):
    data = parse_json()
    user = current_user()
    meeting = Meeting.query.get(meeting_id)
    if not meeting:
        return json_error('Meeting not found', 404)
    missing = required(data, 'title', 'responsible_id')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    err = employee_scope_error(user, data['responsible_id'])
    if err:
        return json_error(err, scope_error_status(err))
    responsible_id, err = parse_id(data['responsible_id'], 'responsible_id')
    if err:
        return err
    deadline, err = parse_date(data.get('deadline'), 'deadline')
    if err:
        return err
    status = data.get('status')
    if status not in ACTION_ITEM_STATUSES:
        status = 'open'
    priority = data.get('priority')
    if priority not in ('low', 'medium', 'high', 'urgent'):
        priority = 'medium'
    item = ActionItem(
        meeting_id=meeting.id,
        title=data['title'],
        description=data.get('description'),
        responsible_id=responsible_id,
        deadline=deadline,
        status=status,
    )
    db.session.add(item)
    db.session.flush()

    # Action items always link into the task system.
    if data.get('create_task', True):
        task = Task(
            title=item.title,
            description=item.description or f'Action item from {meeting.title}',
            assigned_to=responsible_id,
            created_by=user.id,
            priority=priority,
            due_date=deadline,
            meeting_id=meeting.id,
        )
        db.session.add(task)
        db.session.flush()
        item.task_id = task.id
        notify_employee(task.assignee, 'task_assigned', f'New task assigned: {task.title}',
                        related_type='task', related_id=task.id)
    db.session.commit()
    audit('action_item_created', 'meeting', meeting.id, new_value=item.to_dict())
    return jsonify({'message': 'Action item created', 'action_item': item.to_dict()}), 201


@bp.put('/action-items/<int:item_id>')
@require_any_permission('meetings.manage', 'tasks.verify')
def update_action_item(item_id):
    data = parse_json()
    user = current_user()
    item = ActionItem.query.get(item_id)
    if not item:
        return json_error('Action item not found', 404)
    responsible_id = None
    if 'responsible_id' in data:
        if data['responsible_id']:
            err = employee_scope_error(user, data['responsible_id'])
            if err:
                return json_error(err, scope_error_status(err))
            responsible_id, err = parse_id(data['responsible_id'], 'responsible_id')
            if err:
                return err
    deadline = None
    if 'deadline' in data:
        deadline, err = parse_date(data['deadline'], 'deadline')
        if err:
            return err
    if data.get('status') and data['status'] not in ACTION_ITEM_STATUSES:
        return json_error(f'Invalid status: {data["status"]}')

    prev = item.to_dict()
    for field in ['title', 'description']:
        if field in data:
            setattr(item, field, data[field])
    if 'deadline' in data:
        item.deadline = deadline
    if 'responsible_id' in data:
        # explicit null clears the owner; the column is nullable
        item.responsible_id = responsible_id
    if data.get('status'):
        item.status = data['status']
        if data['status'] == 'done':
            item.completed_date = datetime.now(timezone.utc)
            if item.task and item.task.status != 'verified':
                item.task.status = 'verified'
                item.task.completed_date = item.completed_date
        elif item.completed_date:
            item.completed_date = None
    db.session.commit()
    audit('action_item_updated', 'meeting', item.meeting_id, prev, item.to_dict())
    return jsonify({'message': 'Action item updated', 'action_item': item.to_dict()})
