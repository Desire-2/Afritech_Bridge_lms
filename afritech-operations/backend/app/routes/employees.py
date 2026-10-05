from datetime import date

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Employee, Branch, Department, User, Role, Instructor
from ..auth.auth import require_permission, current_user, current_employee, require_any_permission
from ..auth.scope import (
    can_access_service_agents, can_view_employee_financials, exclude_service_agents,
    is_service_agent_employee, scope_error_status,
)
from ..services.audit import audit
from .helpers import (
    json_error, parse_json, paginate, paginate_response, parse_date, parse_id, parse_code_list,
)

bp = Blueprint('employees', __name__, url_prefix='/api/employees')


PRIVATE_FIELDS = ('national_id', 'base_salary', 'hourly_rate', 'default_commission_rate', 'employment_date', 'emergency_contact')

# Fields a caller may only write when they hold an explicit financial
# permission. Operational roles (e.g. Company Secretary) hold
# ``employees.manage`` and may edit every other profile field, but must not be
# able to set or read pay data.
FINANCIAL_WRITE_FIELDS = ('base_salary', 'hourly_rate', 'default_commission_rate', 'salary_type')

# ``salary_type`` is pay data too: knowing a Secretary that a manager is on a
# hourly rate is a step towards reconstructing pay, so it is redacted on read as
# well as blocked on write. It is kept separate from PRIVATE_FIELDS because that
# tuple is also used to describe "sensitive profile data" elsewhere.
FINANCIAL_READ_FIELDS = ('base_salary', 'hourly_rate', 'default_commission_rate', 'salary_type')


def employee_dict_for(emp, user):
    """Return employee payload with salary/private fields redacted unless authorized.

    The gate is :func:`can_view_employee_financials` — an *explicit* pay-data
    permission. It must never key off ``employees.manage``: that permission is
    an operational one, and Company Secretary holds it, so keying off it would
    hand every salary and national ID straight back to the Secretary.
    """
    d = emp.to_dict()
    if can_view_employee_financials(user):
        return d
    for f in PRIVATE_FIELDS:
        d.pop(f, None)
    for f in FINANCIAL_READ_FIELDS:
        d.pop(f, None)
    return d


def make_employee_number():
    prefix = 'EMP'
    last = Employee.query.order_by(Employee.id.desc()).first()
    seq = (last.id + 1) if last else 1
    return f'{prefix}-{seq:05d}'


def _resolve_role_codes(value, default=None):
    """Validate a role-code payload against the Role table.

    An absent *or empty* payload falls back to ``default`` — a dropdown that
    failed to load must not silently create an employee with no access at all.
    Returns (codes, error_response_or_None). 'super_admin' is passed through
    because it maps to the User.is_super_admin flag, not to a role row.
    """
    codes, err = parse_code_list(value, 'roles')
    if err:
        return None, err
    if not codes:
        codes, err = parse_code_list(default, 'roles')
        if err:
            return None, err
    if not codes:
        return [], None
    unknown = [c for c in codes if c != 'super_admin'
               and not Role.query.filter(Role.code == c).first()]
    if unknown:
        return None, json_error(f'Unknown role(s): {", ".join(unknown)}')
    return codes, None


@bp.get('')
@require_any_permission('employees.view', 'employees.manage')
def list_employees():
    user = current_user()
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
    # Query-level Service Agent exclusion, so the employee picker a coordinator
    # reads from can never offer a row they are not allowed to act on.
    q = exclude_service_agents(q, user, Employee.id)
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
    user = current_user()
    email = (data.get('email') or '').strip().lower()
    if email and User.query.filter_by(email=email).first():
        return json_error('A user with this email already exists')

    # Setting pay data requires an explicit financial permission; an
    # operational creator (e.g. Company Secretary) silently drops those fields
    # rather than being handed salary values in the response.
    blocked = [f for f in FINANCIAL_WRITE_FIELDS if f in data and not can_view_employee_financials(user)]
    for f in blocked:
        data.pop(f, None)

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
    employment_date, err = parse_date(data.get('employment_date'), 'employment_date')
    if err:
        return err
    emp.employment_date = employment_date or date.today()
    emp.status = data.get('status', 'active')
    emp.salary_type = data.get('salary_type', 'fixed')
    emp.base_salary = data.get('base_salary', 0)
    emp.hourly_rate = data.get('hourly_rate', 0) or 0
    if data.get('default_commission_rate') is not None:
        emp.default_commission_rate = data['default_commission_rate']
    emp.branch_id, err = parse_id(data.get('branch_id'), 'branch_id')
    if err:
        return err
    emp.department_id, err = parse_id(data.get('department_id'), 'department_id')
    if err:
        return err

    # roles may be supplied whether or not a linked user account is created
    role_codes, err = _resolve_role_codes(data.get('roles'), default=['service_agent'])
    if err:
        return err
    role_rows = {}
    if role_codes:
        role_rows = {r.code: r for r in Role.query.filter(Role.code.in_(role_codes)).all()}
    role_codes_for_instructor = role_codes

    # create a linked user account by default
    password = data.get('password')
    if email and password:
        user = User(email=email)
        user.set_password(password)
        user.must_change_password = True
        user.is_super_admin = 'super_admin' in role_codes
        db.session.add(user)
        db.session.flush()
        emp.user_id = user.id
        for code in role_codes:
            if code == 'super_admin':
                continue
            user.roles.append(role_rows[code])
    elif data.get('user_id'):
        linked = User.query.get(data['user_id'])
        if not linked:
            return json_error('User not found', 404)
        emp.user_id = linked.id

    db.session.add(emp)
    db.session.flush()

    if data.get('is_instructor') or 'instructor' in role_codes_for_instructor:
        existing = Instructor.query.filter_by(employee_id=emp.id).first()
        if not existing:
            db.session.add(Instructor(employee_id=emp.id, specialization=data.get('specialization'), is_active=True))

    db.session.commit()
    audit('employee_created', 'employee', emp.id, new_value=emp.to_dict())
    return jsonify({'message': 'Employee created', 'employee': employee_dict_for(emp, user)}), 201


@bp.get('/<int:employee_id>')
@require_any_permission('employees.view', 'employees.manage', 'employees.earnings.view_own')
def get_employee(employee_id):
    emp = Employee.query.get(employee_id)
    if not emp:
        return json_error('Employee not found', 404)
    user = current_user()
    # Row-level Service Agent boundary: `employees.view` is a company-wide
    # read, so it must not become a back door to a Service Agent profile.
    if is_service_agent_employee(emp) and not can_access_service_agents(user):
        return json_error('Service Agent employees are outside your coordination scope', 403)
    if not (user.is_super_admin or user.has_permission('employees.view') or user.has_permission('employees.manage')):
        me = current_employee()
        if not me or me.id != employee_id:
            return json_error('You do not have permission to view this employee', 403)
    return jsonify({'employee': employee_dict_for(emp, user)})


@bp.put('/<int:employee_id>')
@require_permission('employees.manage')
def update_employee(employee_id):
    data = parse_json()
    user = current_user()
    emp = Employee.query.get(employee_id)
    if not emp:
        return json_error('Employee not found', 404)
    # Service Agents sit outside a coordinator's scope: readable only by roles
    # that administer the service centre, never editable through this endpoint.
    if is_service_agent_employee(emp) and not can_access_service_agents(user):
        return json_error('Service Agent employees are outside your coordination scope',
                          scope_error_status('Service Agent employees are outside your coordination scope'))
    prev = emp.to_dict()
    for field in ('branch_id', 'department_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(emp, field, parsed)
    for field in ['first_name', 'last_name', 'phone', 'national_id', 'position', 'gender',
                  'emergency_contact', 'status']:
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
    if 'employment_date' in data:
        employment_date, err = parse_date(data['employment_date'], 'employment_date')
        if err:
            return err
        emp.employment_date = employment_date or date.today()
    # Pay data is writable only with an explicit financial permission.
    if not can_view_employee_financials(user):
        for field in FINANCIAL_WRITE_FIELDS:
            data.pop(field, None)
    for field in FINANCIAL_WRITE_FIELDS:
        if field not in data:
            continue
        if field == 'default_commission_rate':
            setattr(emp, field, data[field] if data[field] not in (None, '') else None)
        else:
            setattr(emp, field, data[field])
    db.session.commit()
    audit('employee_updated', 'employee', emp.id, prev, emp.to_dict())
    return jsonify({'message': 'Employee updated', 'employee': employee_dict_for(emp, user)})


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
        # view_own callers get the same redacted profile as the directory:
        # commission / payroll history is the point of the endpoint, private
        # and pay columns are not.
        'employee': employee_dict_for(emp, user),
        'total_commission_earned': total_commission_earned,
        'payroll_items': [i.to_dict() for i in items],
    })


@bp.get('/<int:employee_id>/transactions')
@require_any_permission('transactions.view_all', 'transactions.view', 'transactions.operational')
def employee_transactions(employee_id):
    from ..models import ServiceTransaction, Employee as Emp
    from ..auth.scope import employee_scope_error, scope_error_status, redact_transaction
    ei = current_employee()
    user = current_user()
    if not user.has_permission('transactions.view_all'):
        # `transactions.operational` is the Company Secretary's money-free
        # coordinator scope: full status visibility inside her scope, never a
        # price, cost or commission.
        if user.has_permission('transactions.operational'):
            err = employee_scope_error(user, employee_id)
            if err:
                return json_error(err, scope_error_status(err))
        elif not ei or ei.id != employee_id:
            return json_error('You do not have permission to view these transactions', 403)
    q = ServiceTransaction.query.filter_by(employee_id=employee_id)
    status = request.args.get('status')
    start = request.args.get('start')
    end = request.args.get('end')
    from ..models import ServiceTransaction as ST
    if status:
        q = q.filter_by(status=status)
    if request.args.get('start'):
        start, err = parse_date(request.args['start'], 'start')
        if err:
            return err
        q = q.filter(ST.transaction_date >= start)
    if request.args.get('end'):
        end, err = parse_date(request.args['end'], 'end')
        if err:
            return err
        q = q.filter(ST.transaction_date <= end)
    p = paginate(q.order_by(ST.created_at.desc()))
    return paginate_response([redact_transaction(t.to_dict(), user) for t in p.items], p)


@bp.get('/<int:employee_id>/attendance')
@require_any_permission('attendance.view', 'attendance.overview', 'attendance.manage')
def employee_attendance(employee_id):
    from ..models import Attendance
    from ..auth.scope import employee_scope_error, scope_error_status
    from .attendance import attendance_dict_for
    me = current_employee()
    user = current_user()
    if not user.has_permission('attendance.manage'):
        if user.has_permission('attendance.overview'):
            err = employee_scope_error(user, employee_id)
            if err:
                return json_error(err, scope_error_status(err))
        elif not me or me.id != employee_id:
            return json_error('You do not have permission to view this employee\'s attendance', 403)
    q = Attendance.query.filter_by(employee_id=employee_id)
    if request.args.get('start'):
        start, err = parse_date(request.args['start'], 'start')
        if err:
            return err
        q = q.filter(Attendance.attendance_date >= start)
    if request.args.get('end'):
        end, err = parse_date(request.args['end'], 'end')
        if err:
            return err
        q = q.filter(Attendance.attendance_date <= end)
    p = paginate(q.order_by(Attendance.attendance_date.desc()))
    return paginate_response([attendance_dict_for(a, user) for a in p.items], p)


@bp.get('/<int:employee_id>/tasks')
@require_any_permission('tasks.view', 'tasks.manage')
def employee_tasks(employee_id):
    from ..models import Task
    from ..auth.scope import employee_in_scope
    me = current_employee()
    user = current_user()
    may_see_all = any(user.has_permission(p) for p in ('tasks.manage', 'tasks.assign', 'tasks.verify'))
    if may_see_all:
        if not employee_in_scope(user, Employee.query.get(employee_id)):
            return json_error('This employee is outside your coordination scope', 403)
    elif not me or me.id != employee_id:
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