"""Aggregated company calendar.

One feed of everything with a date on it — meetings, activities, tasks, leave,
announcement publish/expiry dates, follow-up deadlines and request due dates —
so the Secretary can plan the company from a single screen. Service Agents are
excluded from every source unless the viewer runs the service centre.
"""

from datetime import date, timedelta

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Meeting, Activity, Task, Announcement, FollowUp, AdminRequest,
    Employee, LeaveRequest,
)
from ..auth.auth import require_any_permission, current_user
from ..auth.scope import exclude_service_agents
from .helpers import json_error, parse_id, parse_date
from .admin_common import recipient_employee_ids

bp = Blueprint('calendar', __name__, url_prefix='/api/calendar')

DEFAULT_WINDOW_DAYS = 31
MAX_WINDOW_DAYS = 180
ALL_TYPES = ('meetings', 'activities', 'tasks', 'leave', 'announcements', 'followups', 'requests')


def _allowed_employee_ids(user):
    return {e.id for e in exclude_service_agents(Employee.query, user, Employee.id).all()}


def org_of(employee):
    """Branch/department of an event's owning employee.

    Employee-scoped events (tasks, leave, follow-ups, requests) carry no org
    columns of their own, so without this a branch filter would silently hide
    all of them rather than matching the right people.
    """
    if employee is None:
        return {'branch_id': None, 'department_id': None}
    return {
        'branch_id': getattr(employee, 'branch_id', None),
        'department_id': getattr(employee, 'department_id', None),
    }


def org_of_targets(department_id, branch_id):
    return {'branch_id': branch_id, 'department_id': department_id}


def _announcement_visible_to(user, ann, allowed):
    """Should this announcement appear on the viewer's calendar?

    A company-wide notice is everyone's business, so it always shows. A notice
    aimed at one department, branch or set of individuals only shows when it
    reaches at least one employee the viewer is allowed to see — otherwise a
    targeted memo to Service Agents leaks to the Secretary's calendar.
    """
    if ann.audience == 'all':
        return True
    expected = recipient_employee_ids(
        ann.audience, ann.department_id, ann.branch_id, ann.recipient_ids)
    if expected is None:
        return True
    return bool(expected & allowed)


def _time_str(value):
    return value.strftime('%H:%M') if value else None


def _collect(user, start, end, types, allowed):
    """Build the event list for a window. Shared by both endpoints."""
    events = []

    if 'meetings' in types:
        for m in Meeting.query.filter(
            Meeting.meeting_date >= start, Meeting.meeting_date <= end,
            Meeting.status != 'cancelled',
        ).order_by(Meeting.meeting_date).all():
            events.append({
                'type': 'meeting', 'id': m.id, 'title': m.title,
                'date': m.meeting_date.isoformat(), 'time': _time_str(m.start_time),
                'end_time': _time_str(m.end_time), 'location': m.location,
                'status': m.status, 'category': 'meeting',
                'branch_id': m.branch_id, 'department_id': m.department_id,
                'participant_count': len(m.participants),
            })

    if 'activities' in types:
        for a in Activity.query.filter(
            Activity.activity_date >= start, Activity.activity_date <= end,
            Activity.status != 'cancelled',
        ).order_by(Activity.activity_date).all():
            # Personal-planner entries belong to their owner alone.
            if a.scope == 'personal':
                if a.owner_user_id != user.id:
                    continue
            elif a.organizer_id is not None and a.organizer_id not in allowed:
                continue
            events.append({
                'type': 'activity', 'id': a.id, 'title': a.title,
                'date': a.activity_date.isoformat(), 'time': _time_str(a.start_time),
                'end_time': _time_str(a.end_time), 'location': a.location,
                'status': a.status, 'category': a.category, 'scope': a.scope,
                'branch_id': a.branch_id, 'department_id': a.department_id,
                'organizer': a.organizer.full_name if a.organizer else None,
            })

    if 'tasks' in types:
        for t in Task.query.filter(
            Task.due_date >= start, Task.due_date <= end,
            Task.status.notin_(('done', 'cancelled')),
        ).order_by(Task.due_date).all():
            if t.assigned_to not in allowed:
                continue
            events.append({
                'type': 'task', 'id': t.id, 'title': t.title,
                'date': t.due_date.isoformat(), 'time': None,
                'status': t.status, 'category': 'priority', 'priority': t.priority,
                'assignee': t.assignee.full_name if t.assignee else None,
                'is_overdue': t.due_date < date.today(),
                **org_of(t.assignee),
            })

    if 'leave' in types:
        for lv in LeaveRequest.query.filter(
            LeaveRequest.start_date <= end, LeaveRequest.end_date >= start,
            LeaveRequest.status.in_(('in_review', 'forwarded', 'approved')),
        ).order_by(LeaveRequest.start_date).all():
            if lv.employee_id not in allowed:
                continue
            events.append({
                'type': 'leave', 'id': lv.id,
                'title': f'{lv.employee.full_name if lv.employee else "Employee"} — {lv.leave_type} leave',
                'date': lv.start_date.isoformat(), 'time': None,
                'end_date': lv.end_date.isoformat() if lv.end_date else None,
                'status': lv.status, 'category': 'leave', 'priority': lv.leave_type,
                'employee_id': lv.employee_id,
                **org_of(lv.employee),
            })

    if 'announcements' in types:
        for ann in Announcement.query.filter(db.or_(
            db.and_(Announcement.publish_date >= start, Announcement.publish_date <= end),
            db.and_(Announcement.expiry_date >= start, Announcement.expiry_date <= end),
        )).all():
            if not _announcement_visible_to(user, ann, allowed):
                continue
            events.append({
                'type': 'announcement', 'id': ann.id, 'title': ann.title,
                'date': ann.publish_date.isoformat(), 'time': None,
                'status': ann.priority, 'category': ann.category,
                'priority': ann.priority, 'requires_ack': ann.requires_ack,
                'expiry_date': ann.expiry_date.isoformat() if ann.expiry_date else None,
                **org_of_targets(ann.department_id, ann.branch_id),
            })

    if 'followups' in types:
        for f in FollowUp.query.filter(db.or_(
            db.and_(FollowUp.next_follow_up >= start, FollowUp.next_follow_up <= end),
            db.and_(FollowUp.deadline >= start, FollowUp.deadline <= end),
        ), FollowUp.status.notin_(('done', 'cancelled'))).all():
            if f.employee_id not in allowed:
                continue
            events.append({
                'type': 'follow_up', 'id': f.id, 'title': f.subject,
                'date': (f.next_follow_up or f.deadline).isoformat(), 'time': None,
                'status': f.status, 'category': f.priority,
                'employee': f.employee.full_name if f.employee else None,
                'is_overdue': f.is_overdue,
                **org_of(f.employee),
            })

    if 'requests' in types:
        for r in AdminRequest.query.filter(
            AdminRequest.due_date >= start, AdminRequest.due_date <= end,
            AdminRequest.status.notin_(('approved', 'rejected', 'closed')),
        ).all():
            if r.requested_by not in allowed:
                continue
            events.append({
                'type': 'request', 'id': r.id, 'title': r.title,
                'date': r.due_date.isoformat(), 'time': None,
                'status': r.status, 'category': r.priority,
                'requester': r.requester.full_name if r.requester else None,
                **org_of(r.requester),
            })

    events = [e for e in events if e.get('date')]
    events.sort(key=lambda e: (e['date'], e.get('time') or '', e['type']))
    return events


def _window_from_request():
    """Resolve start/end from the query string. Returns (start, end, error)."""
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return None, None, err
    start = start or date.today()
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return None, None, err
    end = end or (start + timedelta(days=DEFAULT_WINDOW_DAYS))
    if end < start:
        return None, None, json_error('end cannot be before start', 400)
    if (end - start).days > MAX_WINDOW_DAYS:
        return None, None, json_error(f'Window cannot exceed {MAX_WINDOW_DAYS} days', 400)
    return start, end, None


@bp.get('')
@require_any_permission('calendar.view', 'calendar.manage')
def company_calendar():
    """Every dated item in one window, grouped by day."""
    user = current_user()
    start, end, err = _window_from_request()
    if err:
        return err

    raw_types = request.args.get('types')
    types = ({t.strip() for t in raw_types.split(',') if t.strip()}
             if raw_types is not None else set(ALL_TYPES))
    unknown = types - set(ALL_TYPES)
    if unknown:
        return json_error(f'Unknown types: {", ".join(sorted(unknown))}', 400)

    branch_id, err = parse_id(request.args.get('branch_id'), 'branch_id')
    if err:
        return err
    department_id, err = parse_id(request.args.get('department_id'), 'department_id')
    if err:
        return err

    events = _collect(user, start, end, types, _allowed_employee_ids(user))
    if branch_id or department_id:
        # Both filters mean "in this branch *and* in this department" — using
        # or here would return the whole branch plus the whole department.
        if branch_id:
            events = [e for e in events if e.get('branch_id') == branch_id]
        if department_id:
            events = [e for e in events if e.get('department_id') == department_id]

    days = {}
    for e in events:
        days.setdefault(e['date'], []).append(e)
    return jsonify({
        'start': start.isoformat(),
        'end': end.isoformat(),
        'total': len(events),
        'events': events,
        'days': [{'date': d, 'events': items} for d, items in sorted(days.items())],
        'counts': {t: sum(1 for e in events if e['type'] == t)
                   for t in sorted({e['type'] for e in events})},
    })


@bp.get('/upcoming')
@require_any_permission('calendar.view', 'calendar.manage')
def upcoming():
    """Next N days across meetings, tasks and activities — dashboard widget."""
    user = current_user()
    days, err = parse_id(request.args.get('days'), 'days')
    if err:
        return err
    # `days=0` is a bad request, not a request for the default, so only a
    # missing value falls back — `0 or 14` would silently turn it into 14.
    if days is None:
        days = 14
    if days < 1 or days > 90:
        return json_error('days must be between 1 and 90', 400)

    today = date.today()
    types = {'meetings', 'activities', 'tasks'}
    events = _collect(user, today, today + timedelta(days=days), types,
                      _allowed_employee_ids(user))
    return jsonify({
        'start': today.isoformat(),
        'end': (today + timedelta(days=days)).isoformat(),
        'total': len(events),
        'events': events,
    })