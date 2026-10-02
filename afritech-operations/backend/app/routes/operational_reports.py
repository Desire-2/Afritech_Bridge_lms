"""Operational (non-financial) reports for the Company Secretary.

These sit apart from ``/api/reports``, which is the finance surface guarded by
``reports.view``. Everything here is gated on ``reports.operational`` and
returns coordination data only: meeting output, task throughput, attendance
counts, request and follow-up ageing, escalations and announcements. No
revenue, commission, payroll, expense or salary figure is selected anywhere in
this module.
"""

from datetime import date, timedelta

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Attendance, Task, Meeting, MeetingMinute, ActionItem, Activity,
    AdminRequest, FollowUp, Escalation, Announcement, Employee, Department, Branch,
    ServiceTransaction,
)
from ..auth.auth import require_permission, current_user
from ..auth.scope import exclude_service_agents
from .helpers import json_error, parse_date, parse_id

bp = Blueprint('operational_reports', __name__, url_prefix='/api/reports/administrative')


def _range():
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return None, None, err
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return None, None, err
    end = end or date.today()
    start = start or (end - timedelta(days=29))
    if end < start:
        return None, None, json_error('end cannot be before start', 400)
    return start, end, None


def _allowed(user):
    return {e.id for e in exclude_service_agents(Employee.query, user, Employee.id).all()}


@bp.get('')
@require_permission('reports.operational')
def administrative_overview():
    """Headline counts across every coordination area, for one window."""
    user = current_user()
    start, end, err = _range()
    if err:
        return err
    allowed = _allowed(user)
    scope = allowed or {0}

    meetings = Meeting.query.filter(Meeting.meeting_date >= start, Meeting.meeting_date <= end).all()
    minutes = MeetingMinute.query.join(Meeting, Meeting.id == MeetingMinute.meeting_id).filter(
        Meeting.meeting_date >= start, Meeting.meeting_date <= end).all()
    actions = ActionItem.query.all()
    tasks = Task.query.filter(Task.assigned_to.in_(scope)).all()
    requests = AdminRequest.query.filter(AdminRequest.requested_by.in_(scope)).all()
    followups = FollowUp.query.filter(FollowUp.employee_id.in_(scope)).all()
    attendance = Attendance.query.filter(
        Attendance.employee_id.in_(scope),
        Attendance.attendance_date >= start, Attendance.attendance_date <= end).all()
    escalations = Escalation.query.all()
    announcements = Announcement.query.filter(
        Announcement.publish_date >= start, Announcement.publish_date <= end).all()

    by_status = lambda rows: {s: sum(1 for r in rows if r.status == s) for s in sorted({r.status for r in rows})}

    return jsonify({
        'start': start.isoformat(),
        'end': end.isoformat(),
        'meetings': {
            'total': len(meetings),
            'held': sum(1 for m in meetings if m.status == 'completed'),
            'cancelled': sum(1 for m in meetings if m.status == 'cancelled'),
            'minutes_recorded': len(minutes),
            'minutes_missing': sum(
                1 for m in meetings if m.status == 'completed' and not m.minutes),
        },
        'action_items': {
            'total': len(actions),
            'done': sum(1 for a in actions if a.status == 'done'),
            'overdue': sum(1 for a in actions if a.is_overdue),
        },
        'tasks': {
            'total': len(tasks),
            'by_status': by_status(tasks),
            'overdue': sum(1 for t in tasks
                           if t.due_date and t.due_date < date.today()
                           and t.status not in ('done', 'cancelled')),
        },
        'activities': {
            'total': Activity.query.filter(
                Activity.activity_date >= start,
                Activity.activity_date <= end).count(),
        },
        'requests': {
            'total': len(requests),
            'by_status': by_status(requests),
            'stale': sum(1 for r in requests if r.is_stale),
        },
        'followups': {
            'total': len(followups),
            'by_status': by_status(followups),
            'overdue': sum(1 for f in followups if f.is_overdue),
        },
        'escalations': {'total': len(escalations), 'by_status': by_status(escalations)},
        'announcements': {'published_in_window': len(announcements)},
        'attendance': {
            'records': len(attendance),
            'by_status': {s: sum(1 for a in attendance if a.status == s)
                          for s in sorted({a.status for a in attendance})},
        },
        'employees_in_scope': len(allowed),
    })


@bp.get('/meetings')
@require_permission('reports.operational')
def meeting_output_report():
    """Whether meetings happened, and whether they were written up."""
    start, end, err = _range()
    if err:
        return err
    rows = []
    for m in Meeting.query.filter(
        Meeting.meeting_date >= start, Meeting.meeting_date <= end
    ).order_by(Meeting.meeting_date).all():
        minutes = m.minutes[0] if m.minutes else None
        rows.append({
            'meeting_id': m.id,
            'title': m.title,
            'date': m.meeting_date.isoformat(),
            'status': m.status,
            'department': m.department.name if m.department else None,
            'branch': m.branch.name if m.branch else None,
            'invited': len(m.participants),
            'attended': sum(1 for p in m.participants if p.attended),
            'agenda_items': len(m.agenda),
            'minutes_recorded': minutes is not None,
            'minutes_summary': minutes.summary if minutes else None,
            'action_items': len(m.action_items),
            'action_items_done': sum(1 for a in m.action_items if a.status == 'done'),
        })
    return jsonify({
        'start': start.isoformat(), 'end': end.isoformat(),
        'total': len(rows),
        'attendance_rate': round(
            sum(r['attended'] for r in rows) / sum(r['invited'] for r in rows) * 100, 1
        ) if sum(r['invited'] for r in rows) else None,
        'rows': rows,
    })


@bp.get('/task-throughput')
@require_permission('reports.operational')
def task_throughput_report():
    """How work is flowing, and who is carrying it."""
    user = current_user()
    start, end, err = _range()
    if err:
        return err
    allowed = _allowed(user)
    tasks = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.due_date >= start, Task.due_date <= end).all()

    by_employee = {}
    for t in tasks:
        emp = t.assignee
        if not emp:
            continue
        row = by_employee.setdefault(emp.id, {
            'employee_id': emp.id, 'employee': emp.full_name,
            'position': emp.position,
            'department': emp.department.name if emp.department else None,
            'assigned': 0, 'done': 0, 'overdue': 0, 'submitted': 0,
        })
        row['assigned'] += 1
        if t.status == 'done':
            row['done'] += 1
        elif t.status == 'submitted':
            row['submitted'] += 1
        if t.due_date and t.due_date < date.today() and t.status != 'done':
            row['overdue'] += 1

    rows = sorted(by_employee.values(), key=lambda r: (-r['overdue'], -r['assigned']))
    return jsonify({
        'start': start.isoformat(), 'end': end.isoformat(),
        'total': len(tasks),
        'done': sum(1 for t in tasks if t.status == 'done'),
        'awaiting_verification': sum(1 for t in tasks if t.status == 'submitted'),
        'overdue': sum(1 for t in tasks
                       if t.due_date and t.due_date < date.today() and t.status != 'done'),
        'by_employee': rows,
    })


@bp.get('/attendance-summary')
@require_permission('reports.operational')
def attendance_summary_report():
    """Presence counts per employee — never overtime or any pay figure."""
    user = current_user()
    start, end, err = _range()
    if err:
        return err
    allowed = _allowed(user)
    rows = db.session.query(
        Attendance.employee_id, Attendance.status, db.func.count(Attendance.id)
    ).filter(
        Attendance.employee_id.in_(allowed or {0}),
        Attendance.attendance_date >= start,
        Attendance.attendance_date <= end,
    ).group_by(Attendance.employee_id, Attendance.status).all()

    by_employee = {}
    for emp_id, status, count in rows:
        row = by_employee.setdefault(emp_id, {
            'employee_id': emp_id, 'present': 0, 'late': 0, 'absent': 0, 'leave': 0, 'records': 0,
        })
        row[status] = row.get(status, 0) + count
        row['records'] += count

    employees = Employee.query.filter(Employee.id.in_(by_employee or {0})).all()
    for emp in employees:
        row = by_employee[emp.id]
        row['employee'] = emp.full_name
        row['department'] = emp.department.name if emp.department else None
        row['branch'] = emp.branch.name if emp.branch else None
    return jsonify({
        'start': start.isoformat(), 'end': end.isoformat(),
        'total_records': sum(r['records'] for r in by_employee.values()),
        'rows': sorted(by_employee.values(), key=lambda r: (-r['absent'], -r['late'])),
    })


@bp.get('/request-ageing')
@require_permission('reports.operational')
def request_ageing_report():
    """How long administrative requests have been waiting."""
    user = current_user()
    start, end, err = _range()
    if err:
        return err
    allowed = _allowed(user)
    rows = AdminRequest.query.filter(
        AdminRequest.requested_by.in_(allowed or {0}),
        AdminRequest.created_at >= db.func.date(start),
    ).all()

    open_rows = [r for r in rows if r.status in ('submitted', 'in_review', 'more_info', 'forwarded')]
    today = date.today()

    def age_days(row):
        created = row.created_at
        if created is None:
            return 0
        return (today - created.date()).days

    buckets = {'0-2': 0, '3-7': 0, '8-14': 0, '15+': 0}
    for r in open_rows:
        age = age_days(r)
        buckets['0-2' if age <= 2 else '3-7' if age <= 7 else '8-14' if age <= 14 else '15+'] += 1

    return jsonify({
        'start': start.isoformat(), 'end': end.isoformat(),
        'total': len(rows),
        'open': len(open_rows),
        'closed': sum(1 for r in rows if r.status in ('approved', 'rejected', 'closed')),
        'stale': sum(1 for r in open_rows if r.is_stale),
        'age_buckets': buckets,
        'oldest_open': sorted(
            [{'id': r.id, 'title': r.title, 'status': r.status,
              'age_days': age_days(r), 'requester': r.requester.full_name if r.requester else None}
             for r in open_rows],
            key=lambda r: -r['age_days'])[:10],
    })


@bp.get('/service-operations')
@require_permission('reports.operational')
def service_operations_report():
    """How service work is flowing — counts and status only.

    Deliberately built from the transaction *status* columns: no price, cost,
    commission or profit is selected, so there is nothing here for a
    non-financial role to accidentally receive.
    """
    start, end, err = _range()
    if err:
        return err
    txns = ServiceTransaction.query.filter(
        ServiceTransaction.transaction_date >= start,
        ServiceTransaction.transaction_date <= end,
    ).all()
    today = date.today()

    by_status = {s: 0 for s in ('created', 'processing', 'completed', 'failed', 'cancelled', 'refunded')}
    for t in txns:
        by_status[t.status] = by_status.get(t.status, 0) + 1

    open_rows = [t for t in txns if t.status in ('created', 'processing')]
    pending = [{
        'transaction_id': t.id,
        'transaction_number': t.transaction_number,
        'transaction_date': t.transaction_date.isoformat() if t.transaction_date else None,
        'status': t.status,
        'service_name': t.service_name,
        'client_name': t.client.full_name if t.client else None,
        'employee_id': t.employee_id,
        'employee_name': t.snapshot_employee_name(),
        'branch_id': t.branch_id,
        'age_days': (today - t.transaction_date).days if t.transaction_date else 0,
        'created_at': t.created_at.isoformat() if t.created_at else None,
    } for t in sorted(open_rows, key=lambda r: (r.transaction_date or today))]

    by_employee = {}
    for t in txns:
        row = by_employee.setdefault(t.employee_id, {
            'employee_id': t.employee_id,
            'employee': t.snapshot_employee_name(),
            'total': 0, 'completed': 0, 'processing': 0,
            'created': 0, 'failed': 0, 'cancelled': 0, 'refunded': 0,
        })
        row['total'] += 1
        row[t.status] = row.get(t.status, 0) + 1

    completed_dates = sorted(
        {t.transaction_date for t in txns if t.status == 'completed' and t.transaction_date})
    span = ((completed_dates[-1] - completed_dates[0]).days + 1) if len(completed_dates) > 1 else None

    return jsonify({
        'start': start.isoformat(), 'end': end.isoformat(),
        'total': len(txns),
        'by_status': by_status,
        'open': len(open_rows),
        'oldest_open_days': max((p['age_days'] for p in pending), default=0),
        'completion_rate': round(by_status.get('completed', 0) / len(txns) * 100, 1) if txns else 0.0,
        'completion_span_days': span,
        'pending': pending[:25],
        'by_employee': sorted(by_employee.values(), key=lambda r: -r['total']),
    })


@bp.get('/department-branch')
@require_permission('reports.operational')
def department_branch_report():
    """Headcount and coordination load per department and branch."""
    user = current_user()
    allowed = _allowed(user)
    employees = Employee.query.filter(Employee.id.in_(allowed or {0})).all()

    departments, branches = {}, {}
    for emp in employees:
        if emp.department:
            d = departments.setdefault(emp.department_id, {
                'department_id': emp.department_id, 'department': emp.department.name,
                'headcount': 0, 'positions': {}})
            d['headcount'] += 1
            d['positions'][emp.position or 'Unassigned'] = \
                d['positions'].get(emp.position or 'Unassigned', 0) + 1
        if emp.branch:
            b = branches.setdefault(emp.branch_id, {
                'branch_id': emp.branch_id, 'branch': emp.branch.name, 'headcount': 0})
            b['headcount'] += 1

    open_tasks = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.status.notin_(('done', 'cancelled'))).count()
    open_requests = AdminRequest.query.filter(
        AdminRequest.requested_by.in_(allowed or {0}),
        AdminRequest.status.in_(('submitted', 'in_review', 'more_info', 'forwarded'))).count()

    return jsonify({
        'headcount': len(employees),
        'departments': sorted(departments.values(), key=lambda d: d['department'] or ''),
        'branches': sorted(branches.values(), key=lambda b: b['branch'] or ''),
        'open_tasks': open_tasks,
        'open_requests': open_requests,
    })