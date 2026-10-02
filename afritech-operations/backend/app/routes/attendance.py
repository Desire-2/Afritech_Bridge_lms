from datetime import date, datetime, timezone, time

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Attendance, WorkSchedule, Employee
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..auth.scope import can_access_service_agents, can_view_financials, employee_scope_error, exclude_service_agents, scope_error_status
from ..services.audit import audit
from ..utils.datetime_utils import as_utc
from .helpers import json_error, parse_json, paginate, paginate_response, parse_date, parse_id

bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')

# Overtime feeds payroll, so it is a financial value even though it lives on an
# operational record.
ATTENDANCE_FINANCIAL_FIELDS = ('overtime_hours',)


def attendance_dict_for(rec, user):
    d = rec.to_dict()
    if not can_view_financials(user, rec.employee):
        for f in ATTENDANCE_FINANCIAL_FIELDS:
            d.pop(f, None)
    return d


def compute_hours(clock_in, clock_out):
    if not clock_in or not clock_out:
        return 0
    # SQLite hands back naive datetimes even for timezone-aware columns, while
    # clock-in/out write aware ones — normalize before subtracting.
    delta = (as_utc(clock_out) - as_utc(clock_in)).total_seconds() / 3600
    return round(max(0, delta), 2)


@bp.get('')
@require_any_permission('attendance.view', 'attendance.overview', 'attendance.manage')
def list_attendance():
    user = current_user()
    q = Attendance.query
    # `attendance.manage` is full access; `attendance.overview` is the
    # coordinator view — company-wide but never Service Agents. Everyone else
    # sees only their own rows.
    if not user.has_permission('attendance.manage'):
        if user.has_permission('attendance.overview'):
            q = exclude_service_agents(q, user, Attendance.employee_id)
        else:
            emp = current_employee()
            if emp:
                q = q.filter_by(employee_id=emp.id)
            else:
                q = q.filter(db.text('1 = 0'))
    employee_id = request.args.get('employee_id', type=int)
    if employee_id:
        if not user.has_permission('attendance.manage'):
            # An explicit employee filter must not become a way around the
            # viewer's own scope (e.g. pulling a Service Agent's rows).
            err = employee_scope_error(user, employee_id)
            if err:
                return json_error(err, scope_error_status(err))
        q = q.filter_by(employee_id=employee_id)
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return err
    if start:
        q = q.filter(Attendance.attendance_date >= start)
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return err
    if end:
        q = q.filter(Attendance.attendance_date <= end)
    branch_id = request.args.get('branch_id', type=int)
    department_id = request.args.get('department_id', type=int)
    if branch_id or department_id:
        q = q.join(Employee, Employee.id == Attendance.employee_id)
        if branch_id:
            q = q.filter(Employee.branch_id == branch_id)
        if department_id:
            q = q.filter(Employee.department_id == department_id)
    p = paginate(q.order_by(Attendance.attendance_date.desc(), Attendance.created_at.desc()))
    return paginate_response([attendance_dict_for(a, user) for a in p.items], p)


@bp.get('/overview')
@require_permission('attendance.overview')
def attendance_overview():
    """Per-employee operational roll-up for coordinators (no pay figures)."""
    user = current_user()
    today = date.today()
    rows = (
        exclude_service_agents(
            db.session.query(Attendance.employee_id, Attendance.status, Attendance.attendance_date),
            user, Attendance.employee_id,
        )
        .filter(Attendance.attendance_date <= today)
        .filter(Attendance.attendance_date >= today.replace(day=1))
        .all()
    )
    employees = {
        e.id: e
        for e in exclude_service_agents(Employee.query.filter_by(status='active'), user, Employee.id).all()
    }
    summary = {e.id: {'present': 0, 'late': 0, 'absent': 0, 'leave': 0} for e in employees.values()}
    for emp_id, status, _d in rows:
        bucket = summary.get(emp_id)
        if bucket and status in bucket:
            bucket[status] += 1
    items = [
        {
            'employee_id': e.id,
            'employee_name': e.full_name,
            'position': e.position,
            'department': e.department.name if e.department else None,
            'branch': e.branch.name if e.branch else None,
            **summary[e.id],
            'not_clocked_in': 0,
        }
        for e in employees.values()
    ]
    return jsonify({'items': items})


@bp.post('/clock-in')
@require_any_permission('attendance.manage', 'attendance.view')
def clock_in():
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked', 400)
    today = date.today()
    existing = Attendance.query.filter_by(employee_id=emp.id, attendance_date=today).first()
    if existing and existing.clock_in:
        return json_error('Already clocked in today', 409)
    now = datetime.now(timezone.utc)
    if existing:
        rec = existing
    else:
        rec = Attendance()
        db.session.add(rec)
    rec.employee_id = emp.id
    rec.attendance_date = today
    rec.clock_in = now
    rec.status = 'present'
    db.session.commit()
    audit('attendance_clock_in', 'attendance', rec.id, new_value=rec.to_dict())
    return jsonify({'message': 'Clocked in', 'attendance': rec.to_dict()}), 201


@bp.post('/clock-out')
@require_any_permission('attendance.manage', 'attendance.view')
def clock_out():
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked', 400)
    today = date.today()
    rec = Attendance.query.filter(
        Attendance.employee_id == emp.id,
        Attendance.attendance_date == today,
        Attendance.clock_in.isnot(None),
    ).first()
    if not rec:
        return json_error('No clock-in record found for today', 404)
    if rec.clock_out:
        return json_error('Already clocked out today', 409)
    now = datetime.now(timezone.utc)
    rec.clock_out = now
    rec.total_hours = compute_hours(rec.clock_in, rec.clock_out)
    db.session.commit()
    audit('attendance_clock_out', 'attendance', rec.id, new_value=rec.to_dict())
    return jsonify({'message': 'Clocked out', 'attendance': rec.to_dict()})


@bp.post('/record')
@require_any_permission('attendance.manage', 'attendance.overview', 'attendance.view')
def record_attendance():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'employee_id', 'attendance_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    emp_id, err = parse_id(data['employee_id'], 'employee_id')
    if err:
        return err
    emp = Employee.query.get(emp_id)
    if not emp:
        return json_error('Employee not found', 404)
    if not user.has_permission('attendance.manage'):
        me = current_employee()
        if not me or me.id != emp.id:
            # Recording somebody else's attendance is a coordinator action.
            if not user.has_permission('attendance.overview'):
                return json_error('You can only record your own attendance', 403)
            # ...and only for employees inside their coordination scope.
            err = employee_scope_error(user, emp_id)
            if err:
                return json_error(err, scope_error_status(err))
    adate, err = parse_date(data['attendance_date'], 'attendance_date')
    if err:
        return err
    rec = Attendance.query.filter_by(employee_id=emp.id, attendance_date=adate).first()
    if not rec:
        rec = Attendance(employee_id=emp.id, attendance_date=adate)
        db.session.add(rec)
    rec.status = data.get('status', 'present')
    rec.note = data.get('note')
    if data.get('clock_in'):
        rec.clock_in = datetime.fromisoformat(data['clock_in'].replace('Z', '+00:00'))
    if data.get('clock_out'):
        rec.clock_out = datetime.fromisoformat(data['clock_out'].replace('Z', '+00:00'))
    rec.total_hours = compute_hours(rec.clock_in, rec.clock_out)
    rec.overtime_hours = data.get('overtime_hours', 0) or 0
    rec.recorded_by = user.id
    db.session.commit()
    audit('attendance_recorded', 'attendance', rec.id, new_value=rec.to_dict())
    return jsonify({'message': 'Attendance recorded', 'attendance': attendance_dict_for(rec, user)}), 201


@bp.get('/schedules')
@require_any_permission('attendance.view', 'attendance.manage')
def list_schedules():
    schedules = WorkSchedule.query.filter_by(is_active=True).all()
    return jsonify({'schedules': [s.to_dict() for s in schedules]})


@bp.post('/schedules')
@require_permission('settings.manage')
def create_schedule():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'start_time', 'end_time')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    def parse_time(v):
        return time.fromisoformat(v)
    try:
        start = parse_time(data['start_time']); end = parse_time(data['end_time'])
    except Exception:
        return json_error('Times must be HH:MM', 400)
    sched = WorkSchedule(name=data['name'], start_time=start, end_time=end,
                         late_threshold_minutes=data.get('late_threshold_minutes', 15),
                         workdays=data.get('workdays', 'mon-fri'),
                         is_active=bool(data.get('is_active', True)))
    db.session.add(sched)
    db.session.commit()
    audit('work_schedule_created', 'work_schedule', sched.id, new_value=data)
    return jsonify({'message': 'Schedule created', 'schedule': sched.to_dict()}), 201