from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Task, Employee
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('tasks', __name__, url_prefix='/api/tasks')


@bp.get('')
@require_any_permission('tasks.view', 'tasks.manage')
def list_tasks():
    user = current_user()
    q = Task.query
    if not user.has_permission('tasks.manage'):
        emp = current_employee()
        if emp:
            q = q.filter_by(assigned_to=emp.id)
        else:
            q = q.filter(db.text('1 = 0'))
    status = request.args.get('status')
    priority = request.args.get('priority')
    assigned_to = request.args.get('assigned_to', type=int)
    overdue = request.args.get('overdue')
    if status:
        q = q.filter_by(status=status)
    if priority:
        q = q.filter_by(priority=priority)
    if assigned_to:
        q = q.filter_by(assigned_to=assigned_to)
    if overdue == 'true':
        q = q.filter(Task.due_date.isnot(None), Task.due_date < date.today(),
                     Task.status.in_(['todo', 'in_progress']))
    p = paginate(q.order_by(Task.created_at.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.post('')
@require_any_permission('tasks.create', 'tasks.manage')
def create_task():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'title', 'assigned_to')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    task = Task(
        title=data['title'],
        description=data.get('description'),
        assigned_to=data['assigned_to'],
        created_by=current_user().id,
        priority=data.get('priority', 'medium'),
        due_date=date.fromisoformat(data['due_date']) if data.get('due_date') else None,
        comments=data.get('comments'),
    )
    db.session.add(task)
    db.session.commit()
    audit('task_created', 'task', task.id, new_value=task.to_dict())
    assignee = Employee.query.get(data['assigned_to'])
    if assignee and assignee.user_id:
        from ..services.notifications import notify
        notify(assignee.user_id, 'task_assigned', f'New task assigned: {task.title}',
               severity='info', related_type='task', related_id=task.id)
    return jsonify({'message': 'Task created', 'task': task.to_dict()}), 201


@bp.put('/<int:task_id>')
@require_any_permission('tasks.manage')
def update_task(task_id):
    data = parse_json()
    task = Task.query.get(task_id)
    if not task:
        return json_error('Task not found', 404)
    user = current_user()
    assignee_emp = current_employee()
    is_assignee = assignee_emp and task.assigned_to == assignee_emp.id
    if not user.has_permission('tasks.manage') and not (is_assignee and 'status' in data and data['status'] == 'completed'):
        return json_error('You do not have permission to update this task', 403)
    prev = task.to_dict()
    for field in ['title', 'description', 'priority', 'comments']:
        if field in data and (user.has_permission('tasks.manage') or field == 'comments'):
            setattr(task, field, data[field])
    if data.get('due_date'):
        task.due_date = date.fromisoformat(data['due_date'])
    if 'status' in data and data['status'] in ('todo', 'in_progress', 'completed', 'verified'):
        task.status = data['status']
        if data['status'] in ('completed', 'verified'):
            task.completed_date = datetime.now(timezone.utc)
    db.session.commit()
    audit('task_updated', 'task', task.id, prev, task.to_dict())
    return jsonify({'message': 'Task updated', 'task': task.to_dict()})