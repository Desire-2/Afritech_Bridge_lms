import json
from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Task, TaskComment
from ..auth.auth import require_any_permission, current_user, current_employee
from ..auth.scope import (
    exclude_service_agents, employee_scope_error, employee_in_scope, scope_error_status,
)
from ..services.audit import audit
from ..services.notifications import notify_employee, notify_users_with_permission
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id, parse_id_list,
)

bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')

TASK_STATUSES = ('todo', 'in_progress', 'submitted', 'verified', 'rejected', 'cancelled')
PRIORITIES = ('low', 'medium', 'high', 'urgent')
VERIFY_STATUSES = ('verified', 'rejected', 'cancelled')

# Transitions the assignee may perform on their own task without any extra
# permission. Everything else needs tasks.assign / tasks.verify.
ASSIGNEE_STATUS_CHANGES = {
    'todo': ('in_progress',),
    'in_progress': ('submitted',),
    'rejected': ('in_progress', 'todo'),
}


def _now():
    return datetime.now(timezone.utc)


def _may_see_all(user):
    """Coordinators (manage / assign / verify) see every task in scope."""
    return any(user.has_permission(p) for p in ('tasks.manage', 'tasks.assign', 'tasks.verify'))


def _can_assign(user):
    return any(user.has_permission(p) for p in ('tasks.manage', 'tasks.assign'))


def _can_verify(user):
    return any(user.has_permission(p) for p in ('tasks.manage', 'tasks.verify'))


def _is_assignee(task):
    emp = current_employee()
    return bool(emp and task.assigned_to == emp.id)


def _task_access_error(user, task):
    """None when the user may read this task, else the message to return."""
    if _may_see_all(user):
        if not employee_in_scope(user, task.assignee):
            return 'This task belongs to an employee outside your coordination scope'
        return None
    if _is_assignee(task):
        return None
    return 'You do not have permission to view this task'


def _task_query(user):
    q = Task.query
    if _may_see_all(user):
        return exclude_service_agents(q, user, Task.assigned_to)
    emp = current_employee()
    if emp is None:
        return q.filter(db.text('1 = 0'))
    return q.filter_by(assigned_to=emp.id)


def _can_set_status(user, task, new_status):
    if new_status == task.status:
        return True
    if new_status in VERIFY_STATUSES:
        return _can_verify(user)
    if _can_assign(user):
        return True
    if _is_assignee(task):
        return new_status in ASSIGNEE_STATUS_CHANGES.get(task.status, ())
    return False


def _set_attachments(task, attachment_ids):
    task.attachments = json.dumps(attachment_ids)


def _notify_status_change(task, user, new_status, prev_status):
    if new_status == 'submitted' and prev_status != 'submitted':
        notify_users_with_permission(
            'tasks.verify', 'task_submitted',
            f'Task submitted for verification: {task.title}',
            related_type='task', related_id=task.id)
    elif new_status == 'verified' and prev_status != 'verified':
        notify_employee(task.assignee, 'task_verified', f'Your task was verified: {task.title}',
                        severity='info', related_type='task', related_id=task.id)
    elif new_status == 'rejected' and prev_status != 'rejected':
        note = f' (note: {task.comments})' if task.comments else ''
        notify_employee(task.assignee, 'task_rejected', f'Your task was rejected: {task.title}{note}',
                        severity='warning', related_type='task', related_id=task.id)
    elif new_status == 'in_progress' and prev_status == 'rejected':
        notify_users_with_permission(
            'tasks.assign', 'task_reopened',
            f'Task reopened by {user.email}: {task.title}',
            related_type='task', related_id=task.id)


@bp.get('')
@require_any_permission('tasks.view', 'tasks.manage')
def list_tasks():
    user = current_user()
    q = _task_query(user)

    status = request.args.get('status')
    priority = request.args.get('priority')
    overdue = request.args.get('overdue') == 'true'
    mine = request.args.get('mine') == 'true'
    search = request.args.get('search')

    if status:
        if status not in TASK_STATUSES:
            return json_error(f'Invalid status: {status}')
        q = q.filter_by(status=status)
    if priority:
        if priority not in PRIORITIES:
            return json_error(f'Invalid priority: {priority}')
        q = q.filter_by(priority=priority)
    assigned_to, err = parse_id(request.args.get('assigned_to'), 'assigned_to')
    if err:
        return err
    if assigned_to is not None:
        if not _may_see_all(user):
            return json_error('You do not have permission to filter tasks by assignee', 403)
        err = employee_scope_error(user, assigned_to)
        if err:
            return json_error(err, scope_error_status(err))
        q = q.filter_by(assigned_to=assigned_to)
    meeting_id, err = parse_id(request.args.get('meeting_id'), 'meeting_id')
    if err:
        return err
    if meeting_id is not None:
        q = q.filter_by(meeting_id=meeting_id)
    activity_id, err = parse_id(request.args.get('activity_id'), 'activity_id')
    if err:
        return err
    if activity_id is not None:
        q = q.filter_by(activity_id=activity_id)
    if overdue:
        # an overdue task is an *open* task past its due date
        q = q.filter(Task.due_date.isnot(None), Task.due_date < date.today(),
                     Task.status.in_(Task.OPEN_STATUSES))
    if mine:
        emp = current_employee()
        if emp is None:
            return json_error('No employee profile linked to your account', 403)
        q = q.filter_by(assigned_to=emp.id)
    if search:
        q = q.filter(db.or_(Task.title.ilike(f'%{search}%'),
                            Task.description.ilike(f'%{search}%')))
    p = paginate(q.order_by(Task.created_at.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.get('/<int:task_id>')
@require_any_permission('tasks.view', 'tasks.manage')
def get_task(task_id):
    task = Task.query.get(task_id)
    if not task:
        return json_error('Task not found', 404)
    err = _task_access_error(current_user(), task)
    if err:
        return json_error(err, 403)
    return jsonify({'task': task.to_dict()})


@bp.post('')
@require_any_permission('tasks.create', 'tasks.manage')
def create_task():
    user = current_user()
    data = parse_json()
    missing = required(data, 'title', 'assigned_to')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    err = employee_scope_error(user, data['assigned_to'])
    if err:
        return json_error(err, scope_error_status(err))
    assigned_to, err = parse_id(data['assigned_to'], 'assigned_to')
    if err:
        return err
    due_date, err = parse_date(data.get('due_date'), 'due_date')
    if err:
        return err
    attachment_ids, err = parse_id_list(data.get('attachment_ids'), 'attachment_ids')
    if err:
        return err
    meeting_id, err = parse_id(data.get('meeting_id'), 'meeting_id')
    if err:
        return err
    activity_id, err = parse_id(data.get('activity_id'), 'activity_id')
    if err:
        return err
    priority = data.get('priority', 'medium')
    if priority not in PRIORITIES:
        return json_error(f'Invalid priority: {priority}')
    task = Task(
        title=data['title'],
        description=data.get('description'),
        assigned_to=assigned_to,
        created_by=user.id,
        priority=priority,
        due_date=due_date,
        comments=data.get('comments'),
        attachments=json.dumps(attachment_ids) if attachment_ids else None,
        meeting_id=meeting_id,
        activity_id=activity_id,
    )
    db.session.add(task)
    db.session.commit()
    audit('task_created', 'task', task.id, new_value=task.to_dict())
    notify_employee(task.assignee, 'task_assigned', f'New task assigned: {task.title}',
                    severity='info', related_type='task', related_id=task.id)
    return jsonify({'message': 'Task created', 'task': task.to_dict()}), 201


@bp.put('/<int:task_id>')
@require_any_permission('tasks.view', 'tasks.manage')
def update_task(task_id):
    user = current_user()
    data = parse_json()
    task = Task.query.get(task_id)
    if not task:
        return json_error('Task not found', 404)
    err = _task_access_error(user, task)
    if err:
        return json_error(err, 403)

    may_manage = _may_see_all(user)
    is_assignee = _is_assignee(task)

    # ── field-level validation before mutating anything ──
    assigned_to = None
    if 'assigned_to' in data:
        if data['assigned_to'] in (None, ''):
            return json_error('assigned_to cannot be empty', 400)
        err = employee_scope_error(user, data['assigned_to'])
        if err:
            return json_error(err, scope_error_status(err))
        assigned_to, err = parse_id(data['assigned_to'], 'assigned_to')
        if err:
            return err
    due_date = None
    if 'due_date' in data:
        due_date, err = parse_date(data['due_date'], 'due_date')
        if err:
            return err
    attachment_ids = None
    if 'attachment_ids' in data:
        attachment_ids, err = parse_id_list(data['attachment_ids'], 'attachment_ids')
        if err:
            return err
    meeting_id = None
    if 'meeting_id' in data:
        meeting_id, err = parse_id(data['meeting_id'], 'meeting_id')
        if err:
            return err
    activity_id = None
    if 'activity_id' in data:
        activity_id, err = parse_id(data['activity_id'], 'activity_id')
        if err:
            return err
    if 'priority' in data and data['priority'] not in PRIORITIES:
        return json_error(f'Invalid priority: {data["priority"]}')
    if 'status' in data and data['status'] not in TASK_STATUSES:
        return json_error(f'Invalid status: {data["status"]}')
    new_status = data.get('status')

    # ── authorization per field group ──
    managed_fields = {'title', 'description', 'priority', 'due_date',
                      'assigned_to', 'attachment_ids', 'meeting_id', 'activity_id'}
    requested_managed = [f for f in managed_fields if f in data]
    if requested_managed and not _can_assign(user):
        return json_error('You do not have permission to edit task details', 403)
    if new_status is not None and not _can_set_status(user, task, new_status):
        if is_assignee and new_status in ASSIGNEE_STATUS_CHANGES.get(task.status, ()):
            pass
        else:
            return json_error(
                f'Cannot move task from "{task.status}" to "{new_status}"', 409)
    if 'comments' in data and not (may_manage or is_assignee):
        return json_error('You do not have permission to comment on this task', 403)

    prev_status = task.status
    prev = task.to_dict()
    prev_assignee_id = task.assigned_to
    for field in ('title', 'description', 'priority'):
        if field in data:
            setattr(task, field, data[field])
    if 'comments' in data:
        task.comments = data['comments']
    if assigned_to is not None:
        task.assigned_to = assigned_to
    if attachment_ids is not None:
        _set_attachments(task, attachment_ids)
    if meeting_id is not None:
        task.meeting_id = meeting_id
    if activity_id is not None:
        task.activity_id = activity_id
    if 'due_date' in data:
        task.due_date = due_date

    if new_status and new_status != task.status:
        task.status = new_status
        if new_status == 'submitted':
            task.submitted_date = _now()
            task.completed_date = None
        elif new_status == 'verified':
            task.completed_date = _now()
        elif new_status in ('todo', 'in_progress'):
            # reopened / sent back: clear the completion stamps
            task.submitted_date = None
            task.completed_date = None

    db.session.commit()
    audit('task_updated', 'task', task.id, prev, task.to_dict())
    if assigned_to is not None and assigned_to != prev_assignee_id:
        notify_employee(task.assignee, 'task_assigned',
                        f'Task assigned to you: {task.title}',
                        related_type='task', related_id=task.id)
    _notify_status_change(task, user, task.status, prev_status)
    return jsonify({'message': 'Task updated', 'task': task.to_dict()})


# ── comments ─────────────────────────────────────────────────────────────────


@bp.get('/<int:task_id>/comments')
@require_any_permission('tasks.view', 'tasks.manage')
def list_task_comments(task_id):
    task = Task.query.get(task_id)
    if not task:
        return json_error('Task not found', 404)
    err = _task_access_error(current_user(), task)
    if err:
        return json_error(err, 403)
    return jsonify({'comments': [c.to_dict() for c in task.comment_rows]})


@bp.post('/<int:task_id>/comments')
@require_any_permission('tasks.view', 'tasks.manage')
def add_task_comment(task_id):
    user = current_user()
    data = parse_json()
    task = Task.query.get(task_id)
    if not task:
        return json_error('Task not found', 404)
    err = _task_access_error(user, task)
    if err:
        return json_error(err, 403)
    missing = required(data, 'body')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    body = str(data['body']).strip()
    if not body:
        return json_error('Comment cannot be empty')
    if len(body) > 2000:
        return json_error('Comment is too long (2000 characters maximum)')
    comment = TaskComment(task_id=task.id, author_id=user.id, body=body)
    db.session.add(comment)
    db.session.commit()
    audit('task_comment_added', 'task', task.id, new_value=comment.to_dict())
    return jsonify({'message': 'Comment added', 'comment': comment.to_dict()}), 201


@bp.delete('/comments/<int:comment_id>')
@require_any_permission('tasks.view', 'tasks.manage')
def delete_task_comment(comment_id):
    comment = TaskComment.query.get(comment_id)
    if not comment:
        return json_error('Comment not found', 404)
    task = comment.task
    err = _task_access_error(current_user(), task)
    if err:
        return json_error(err, 403)
    if comment.author_id != current_user().id and not _can_assign(current_user()):
        return json_error('You can only delete your own comments', 403)
    db.session.delete(comment)
    db.session.commit()
    audit('task_comment_deleted', 'task', task.id, new_value={'comment_id': comment_id})
    return jsonify({'message': 'Comment deleted'})