"""Seed permission catalog and default system roles."""

from ..extensions import db
from ..models import Permission, Role

PERMISSIONS = [
    # users & roles
    ('users.manage', 'Manage Users', 'Create, update and manage user accounts'),
    ('users.view', 'View Users', 'View user accounts'),
    ('roles.manage', 'Manage Roles', 'Manage roles and permissions'),
    # employees
    ('employees.manage', 'Manage Employees', 'Create, update and manage employees'),
    ('employees.view', 'View Employees', 'View employee records'),
    ('employees.earnings.view_all', 'View All Earnings', 'View all employees earnings'),
    ('employees.earnings.view_own', 'View Own Earnings', 'View own earnings'),
    # branches & departments
    ('branches.manage', 'Manage Branches', 'Manage branches'),
    ('departments.manage', 'Manage Departments', 'Manage departments'),
    # services
    ('services.manage', 'Manage Services', 'Create, update services catalogue'),
    ('services.view', 'View Services', 'View service catalogue'),
    # clients
    ('clients.manage', 'Manage Clients', 'Create, update clients'),
    ('clients.view', 'View Clients', 'View client directory'),
    # transactions
    ('transactions.create', 'Create Transactions', 'Create service transactions'),
    ('transactions.view', 'View Transactions', 'View transactions'),
    ('transactions.view_all', 'View All Transactions', 'View all employees transactions'),
    ('transactions.cancel', 'Cancel Transactions', 'Cancel/refund transactions'),
    ('transactions.edit', 'Edit Transactions', 'Edit transaction details'),
    ('transactions.approve', 'Approve Transactions', 'Approve transactions'),
    # daily closing
    ('closings.submit', 'Submit Daily Closing', 'Submit daily closing'),
    ('closings.approve', 'Approve Daily Closing', 'Approve or reject daily closing'),
    ('closings.view', 'View Daily Closing', 'View daily closings'),
    # expenses
    ('expenses.create', 'Create Expenses', 'Submit expenses'),
    ('expenses.approve', 'Approve Expenses', 'Approve or reject expenses'),
    ('expenses.view', 'View Expenses', 'View expenses'),
    # payroll
    ('payroll.manage', 'Manage Payroll', 'Create and edit payroll periods'),
    ('payroll.approve', 'Approve Payroll', 'Approve payroll'),
    ('payroll.mark_paid', 'Mark Payroll Paid', 'Mark payroll as paid'),
    ('payroll.view', 'View Payroll', 'View payroll'),
    # attendance
    ('attendance.manage', 'Manage Attendance', 'Record and edit attendance'),
    ('attendance.view', 'View Attendance', 'View attendance records'),
    # tasks
    ('tasks.create', 'Create Tasks', 'Create tasks'),
    ('tasks.manage', 'Manage Tasks', 'Manage all tasks'),
    ('tasks.view', 'View Tasks', 'View tasks'),
    # reports
    ('reports.view', 'View Reports', 'View reports'),
    ('reports.export', 'Export Reports', 'Export reports'),
    # instructors
    ('instructors.manage', 'Manage Instructors', 'Create and manage instructors'),
    ('instructors.view', 'View Instructors', 'View instructors'),
    ('weekly_plans.manage', 'Manage Weekly Plans', 'Create and manage weekly plans'),
    ('weekly_plans.view', 'View Weekly Plans', 'View weekly plans'),
    ('performance.view', 'View Performance', 'View performance scores'),
    ('learner_progress.view', 'View Learner Progress', 'View learner progress'),
    ('courses.manage', 'Manage Courses', 'Manage courses and cohorts'),
    ('courses.view', 'View Courses', 'View courses and cohorts'),
    # notifications
    ('notifications.view', 'View Notifications', 'View notifications'),
    # audit
    ('audit.view', 'View Audit Log', 'View audit logs'),
    # settings
    ('settings.manage', 'Manage Settings', 'Manage application settings'),
    # integration
    ('integration.manage', 'Manage LMS Integration', 'Configure LMS integration'),
]

SYSTEM_ROLES = {
    'super_admin': 'Super Admin',
    'manager': 'Manager',
    'service_agent': 'Service Agent',
    'instructor': 'Instructor',
    'accountant': 'Accountant',
}

ROLE_PERMISSIONS = {
    'manager': [
        'employees.manage', 'employees.view', 'employees.earnings.view_all',
        'services.view', 'clients.view',
        'transactions.view', 'transactions.view_all', 'transactions.approve', 'transactions.cancel', 'transactions.edit',
        'closings.submit', 'closings.approve', 'closings.view',
        'expenses.create', 'expenses.approve', 'expenses.view',
        'payroll.manage', 'payroll.approve', 'payroll.mark_paid', 'payroll.view',
        'attendance.manage', 'attendance.view',
        'tasks.create', 'tasks.manage', 'tasks.view',
        'reports.view', 'reports.export',
        'instructors.manage', 'instructors.view',
        'weekly_plans.view', 'performance.view', 'learner_progress.view',
        'courses.manage', 'courses.view',
        'notifications.view',
    ],
    'service_agent': [
        'services.view',
        'clients.manage', 'clients.view',
        'transactions.create', 'transactions.view', 'transactions.edit',
        'closings.submit', 'closings.view',
        'expenses.create',
        'attendance.view',
        'tasks.view',
        'employees.earnings.view_own',
        'notifications.view',
    ],
    'instructor': [
        'attendance.view',
        'tasks.view',
        'weekly_plans.manage', 'weekly_plans.view',
        'learner_progress.view',
        'courses.view',
        'employees.earnings.view_own',
        'notifications.view',
    ],
    'accountant': [
        'employees.view', 'employees.earnings.view_all',
        'services.view', 'clients.view',
        'transactions.view', 'transactions.view_all',
        'closings.view',
        'expenses.create', 'expenses.approve', 'expenses.view',
        'payroll.manage', 'payroll.view',
        'reports.view', 'reports.export',
        'notifications.view',
    ],
}


def seed_permissions_and_roles():
    perm_map = {}
    for code, name, desc in PERMISSIONS:
        p = Permission.query.filter_by(code=code).first()
        if not p:
            p = Permission(code=code, name=name, description=desc)
            db.session.add(p)
            db.session.flush()
        perm_map[code] = p

    for code, name in SYSTEM_ROLES.items():
        role = Role.query.filter_by(code=code).first()
        if not role:
            role = Role(code=code, name=name, description=f'{name} role', is_system=True)
            db.session.add(role)
            db.session.flush()
        if code == 'super_admin':
            role.permissions = list(perm_map.values())  # all permissions
        else:
            codes = ROLE_PERMISSIONS.get(code, [])
            role.permissions = [perm_map[c] for c in codes if c in perm_map]
        role.is_active = True

    db.session.commit()
    return perm_map