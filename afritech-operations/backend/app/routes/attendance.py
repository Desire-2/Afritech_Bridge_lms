from datetime import date, datetime, timezone, time

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Attendance, WorkSchedule, Employee
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('attendance', __name__, url_prefix='/api/attendance')


def compute_hours(clock_in, clock_out):
    if not clock_in or not clock_out:
        return 0
    delta = (clock_out - clock_in).total_seconds() / 3600
    return round(max(0, delta), 2)


@bp.get('')
@require_any_permission('attendance.view', 'attendance.manage')
def list_attendance():
    user = current_user()
    q = Attendance.query
    if not user.has_permission('attendance.manage'):
        emp = current_employee()
        if emp:
            q = q.filter_by(employee_id=emp.id)
        else:
            q = q.filter(db.text('1 = 0'))
    employee_id = request.args.get('employee_id', type=int)
    start = request.args.get('start')
    end = request.args.get('end')
    status = request.args.get('status')
    if employee_id:
        q = q.filter_by(employee_id=employee_id)
    if status:
        q = q.filter_by(status=status)
    if start:
        q = q.filter(Attendance.attendance_date >= date.fromisoformat(start))
    if end:
        q = q.filter(Attendance.attendance_date <= date.fromisoformat(end))
    p = paginate(q.order_by(Attendance.attendance_date.desc(), Attendance.created_at.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


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
@require_any_permission('attendance.manage', 'attendance.view')
def record_attendance():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'employee_id', 'attendance_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    emp = Employee.query.get(data['employee_id'])
    if not emp:
        return json_error('Employee not found', 404)
    if not user.has_permission('attendance.manage'):
        me = current_employee()
        if not me or me.id != emp.id:
            return json_error('You can only record your own attendance', 403)
    adate = date.fromisoformat(data['attendance_date'])
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
    rec.recorded_by = current_user().id
    db.session.commit()
    audit('attendance_recorded', 'attendance', rec.id, new_value=rec.to_dict())
    return jsonify({'message': 'Attendance recorded', 'attendance': rec.to_dict()}), 201


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