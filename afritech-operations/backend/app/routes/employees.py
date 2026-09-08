from datetime import date

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Employee, Branch, Department, User, Role, Instructor
from ..auth.auth import require_permission, current_user, current_employee, require_any_permission
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('employees', __name__, url_prefix='/api/employees')


PRIVATE_FIELDS = ('national_id', 'base_salary', 'hourly_rate', 'default_commission_rate', 'employment_date', 'emergency_contact')


def employee_dict_for(emp, user):
    """Return employee payload with salary/private fields redacted unless authorized."""
    d = emp.to_dict()
    if user and (user.is_super_admin or user.has_permission('employees.manage')
                 or user.has_permission('employees.earnings.view_all')):
        return d
    for f in PRIVATE_FIELDS:
        d.pop(f, None)
    return d


def make_employee_number():
    prefix = 'EMP'
    last = Employee.query.order_by(Employee.id.desc()).first()
    seq = (last.id + 1) if last else 1
    return f'{prefix}-{seq:05d}'


def make_client_number():
    prefix = 'CL'
    last = Employee.query.order_by(Employee.id.desc()).first()
    seq = last.id + 1 if last else 1
    return f'{prefix}-{seq:05d}'


@bp.get('')
@require_any_permission('employees.view', 'employees.manage')
def list_employees():
    q = Employee.query
    search = request.args.get('search')
    branch_id = request.args.get('branch_id', type=int)
    department_id = request.args.get('department_id', type=int)
    status = request.args.get('status')
    position = request.args.get('position')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(
            Employee.first_name.ilike(like), Employee.last_name.ilike(like),
            Employee.employee_number.ilike(like), Employee.email.ilike(like), Employee.phone.ilike(like),
        ))
    if branch_id:
        q = q.filter_by(branch_id=branch_id)
    if department_id:
        q = q.filter_by(department_id=department_id)
    if status:
        q = q.filter_by(status=status)
    if position:
        q = q.filter(Employee.position.ilike(f'%{position}%'))
    user = current_user()
    p = paginate(q.order_by(Employee.created_at.desc()))
    return paginate_response([employee_dict_for(e, user) for e in p.items], p)


@bp.post('')
@require_permission('employees.manage')
def create_employee():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'first_name', 'last_name')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    email = (data.get('email') or '').strip().lower()
    if email and User.query.filter_by(email=email).first():
        return json_error('A user with this email already exists')

    emp = Employee()
    emp.employee_number = make_employee_number()
    emp.first_name = data['first_name']
    emp.last_name = data['last_name']
    emp.phone = data.get('phone')
    emp.email = email
    emp.national_id = data.get('national_id')
    emp.position = data.get('position')
    emp.gender = data.get('gender')
    emp.emergency_contact = data.get('emergency_contact')
    emp.employment_date = date.fromisoformat(data['employment_date']) if data.get('employment_date') else date.today()
    emp.status = data.get('status', 'active')
    emp.salary_type = data.get('salary_type', 'fixed')
    emp.base_salary = data.get('base_salary', 0)
    emp.hourly_rate = data.get('hourly_rate', 0) or 0
    if data.get('default_commission_rate') is not None:
        emp.default_commission_rate = data['default_commission_rate']
    emp.branch_id = data.get('branch_id') or None
    emp.department_id = data.get('department_id') or None

    # create a linked user account by default
    password = data.get('password')
    if email and password:
        user = User(email=email)
        user.set_password(password)
        user.must_change_password = True
        db.session.add(user)
        db.session.flush()
        emp.user_id = user.id
        for code in data.get('roles', ['service_agent']):
            role = Role.query.filter_by(code=code).first()
            if role:
                user.roles.append(role)
            elif code == 'instructor':
                role = Role.query.filter_by(code='instructor').first()
                if role:
                    user.roles.append(role)
    elif data.get('user_id'):
        emp.user_id = data['user_id']

    db.session.add(emp)
    db.session.flush()

    if data.get('is_instructor') or data.get('roles') and 'instructor' in data.get('roles', []):
        existing = Instructor.query.filter_by(employee_id=emp.id).first()
        if not existing:
            db.session.add(Instructor(employee_id=emp.id, specialization=data.get('specialization'), is_active=True))

    db.session.commit()
    audit('employee_created', 'employee', emp.id, new_value=emp.to_dict())
    return jsonify({'message': 'Employee created', 'employee': emp.to_dict()}), 201


@bp.get('/<int:employee_id>')
@require_any_permission('employees.view', 'employees.manage', 'employees.earnings.view_own')
def get_employee(employee_id):
    emp = Employee.query.get(employee_id)
    if not emp:
        return json_error('Employee not found', 404)
    user = current_user()
    if not (user.is_super_admin or user.has_permission('employees.view') or user.has_permission('employees.manage')):
        me = current_employee()
        if not me or me.id != employee_id:
            return json_error('You do not have permission to view this employee', 403)
    return jsonify({'employee': employee_dict_for(emp, user)})


@bp.put('/<int:employee_id>')
@require_permission('employees.manage')
def update_employee(employee_id):
    data = parse_json()
    emp = Employee.query.get(employee_id)
    if not emp:
        return json_error('Employee not found', 404)
    prev = emp.to_dict()
    for field in ['first_name', 'last_name', 'phone', 'national_id', 'position', 'gender',
                  'emergency_contact', 'status', 'salary_type', 'branch_id', 'department_id']:
        if field in data:
            setattr(emp, field, data[field])
    if 'email' in data:
        new_email = (data['email'] or '').strip().lower()
        conflict = User.query.filter_by(email=new_email).first() if new_email else None
        if conflict and emp.user_id != conflict.id:
            return json_error('A user with this email already exists')
        emp.email = new_email
        if emp.user:
            emp.user.email = new_email
    if 'employment_date' in data and data['employment_date']:
        emp.employment_date = date.fromisoformat(data['employment_date'])
    if 'base_salary' in data:
        emp.base_salary = data['base_salary']
    if 'hourly_rate' in data:
        emp.hourly_rate = data['hourly_rate']
    if 'default_commission_rate' in data:
        emp.default_commission_rate = data['default_commission_rate'] if data['default_commission_rate'] not in (None, '') else None
    db.session.commit()
    audit('employee_updated', 'employee', emp.id, prev, emp.to_dict())
    return jsonify({'message': 'Employee updated', 'employee': emp.to_dict()})


@bp.get('/<int:employee_id>/earnings')
@require_any_permission('employees.earnings.view_all', 'employees.earnings.view_own')
def employee_earnings(employee_id):
    user = current_user()
    emp = Employee.query.get(employee_id)
    if not emp:
        return json_error('Employee not found', 404)
    if not (user.has_permission('employees.earnings.view_all') or (user.employee and user.employee.id == employee_id)):
        return json_error('You do not have permission to view this employee\'s earnings', 403)

    from ..models import PayrollItem
    items = PayrollItem.query.filter_by(employee_id=employee_id).order_by(PayrollItem.created_at.desc()).all()
    total_commission_earned = sum(float(i.commission or 0) for i in items)
    return jsonify({
        'employee': emp.to_dict(),
        'total_commission_earned': total_commission_earned,
        'payroll_items': [i.to_dict() for i in items],
    })


@bp.get('/<int:employee_id>/transactions')
@require_any_permission('transactions.view_all', 'transactions.view')
def employee_transactions(employee_id):
    from ..models import ServiceTransaction
    ei = current_employee()
    user = current_user()
    if not user.has_permission('transactions.view_all') and (not ei or ei.id != employee_id):
        return json_error('You do not have permission to view these transactions', 403)
    q = ServiceTransaction.query.filter_by(employee_id=employee_id)
    status = request.args.get('status')
    start = request.args.get('start')
    end = request.args.get('end')
    from ..models import ServiceTransaction as ST
    if status:
        q = q.filter_by(status=status)
    if start:
        q = q.filter(ST.transaction_date >= date.fromisoformat(start))
    if end:
        q = q.filter(ST.transaction_date <= date.fromisoformat(end))
    p = paginate(q.order_by(ST.created_at.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.get('/<int:employee_id>/attendance')
@require_any_permission('attendance.view', 'attendance.manage')
def employee_attendance(employee_id):
    from ..models import Attendance
    me = current_employee()
    user = current_user()
    if not user.has_permission('attendance.manage') and (not me or me.id != employee_id):
        return json_error('You do not have permission to view this employee\'s attendance', 403)
    q = Attendance.query.filter_by(employee_id=employee_id)
    start = request.args.get('start')
    end = request.args.get('end')
    if start:
        q = q.filter(Attendance.attendance_date >= date.fromisoformat(start))
    if end:
        q = q.filter(Attendance.attendance_date <= date.fromisoformat(end))
    p = paginate(q.order_by(Attendance.attendance_date.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.get('/<int:employee_id>/tasks')
@require_any_permission('tasks.view', 'tasks.manage')
def employee_tasks(employee_id):
    from ..models import Task
    me = current_employee()
    user = current_user()
    if not user.has_permission('tasks.manage') and (not me or me.id != employee_id):
        return json_error('You do not have permission to view these tasks', 403)
    q = Task.query.filter_by(assigned_to=employee_id)
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    p = paginate(q.order_by(Task.created_at.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.get('/<int:employee_id>/performance')
@require_permission('performance.view')
def employee_performance(employee_id):
    from ..models import PerformanceScore
    me = current_employee()
    user = current_user()
    if not user.has_permission('instructors.manage') and (not me or me.id != employee_id):
        return json_error('You do not have permission to view this employee\'s performance', 403)
    scores = PerformanceScore.query.filter_by(employee_id=employee_id).order_by(PerformanceScore.period_start.desc()).all()
    return jsonify({'scores': [s.to_dict() for s in scores]})


@bp.get('/departments', endpoint='list_departments')
@require_any_permission('employees.view', 'employees.manage', 'departments.manage')
def list_departments():
    q = Department.query.filter_by(is_active=True)
    depts = q.order_by(Department.name).all()
    return jsonify({'departments': [d.to_dict() for d in depts]})


@bp.post('/departments')
@require_permission('departments.manage')
def create_department():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if Department.query.filter_by(code=data['code']).first():
        return json_error('Department code already exists')
    dept = Department(name=data['name'], code=data['code'], description=data.get('description'), is_active=bool(data.get('is_active', True)))
    db.session.add(dept)
    db.session.commit()
    audit('department_created', 'department', dept.id, new_value=data)
    return jsonify({'message': 'Department created', 'department': dept.to_dict()}), 201


@bp.get('/branches', endpoint='list_branches')
@require_any_permission('employees.view', 'employees.manage', 'branches.manage')
def list_branches():
    branches = Branch.query.filter_by(is_active=True).order_by(Branch.name).all()
    return jsonify({'branches': [b.to_dict() for b in branches]})


@bp.post('/branches')
@require_permission('branches.manage')
def create_branch():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'name', 'code')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if Branch.query.filter_by(code=data['code']).first():
        return json_error('Branch code already exists')
    br = Branch(name=data['name'], code=data['code'], city=data.get('city'), address=data.get('address'),
                phone=data.get('phone'), is_active=bool(data.get('is_active', True)))
    db.session.add(br)
    db.session.commit()
    audit('branch_created', 'branch', br.id, new_value=data)
    return jsonify({'message': 'Branch created', 'branch': br.to_dict()}), 201