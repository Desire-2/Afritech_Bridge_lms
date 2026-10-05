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
    ('transactions.operational', 'View Transaction Status',
     'Read transaction status, client, service and assignee without any financial value'),
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
    ('attendance.overview', 'Attendance Overview', 'Operational attendance visibility across employees'),
    # leave coordination
    ('leave.view', 'View Leave Requests', 'View leave requests'),
    ('leave.manage', 'Manage Leave Requests', 'Review, approve and reject leave requests'),
    # tasks
    ('tasks.create', 'Create Tasks', 'Create tasks'),
    ('tasks.manage', 'Manage Tasks', 'Manage all tasks'),
    ('tasks.view', 'View Tasks', 'View tasks'),
    ('tasks.assign', 'Assign Tasks', 'Assign and reassign tasks to employees'),
    ('tasks.verify', 'Verify Tasks', 'Verify or reject completed tasks'),
    # reports
    ('reports.view', 'View Reports', 'View reports'),
    ('reports.export', 'Export Reports', 'Export reports'),
    ('reports.operational', 'Administrative Reports', 'Non-financial administrative and operational reports'),
    # meetings & planning (administrative coordination)
    ('meetings.view', 'View Meetings', 'View meetings, agendas and minutes'),
    ('meetings.manage', 'Manage Meetings', 'Schedule meetings, agendas, minutes and action items'),
    ('activities.view', 'View Activities', 'View company and personal activities'),
    ('activities.manage', 'Manage Activities', 'Plan and coordinate company/personal activities'),
    ('calendar.view', 'View Calendar', 'View the company calendar'),
    ('calendar.manage', 'Manage Calendar', 'Manage company calendar entries'),
    # internal communication
    ('announcements.view', 'View Announcements', 'View internal announcements'),
    ('announcements.manage', 'Manage Announcements', 'Publish and manage internal announcements'),
    ('memos.view', 'View Memos', 'View internal memos'),
    ('memos.manage', 'Manage Memos', 'Create and manage internal memos'),
    ('documents.view', 'View Documents', 'View administrative documents'),
    ('documents.manage', 'Manage Documents', 'Upload and manage administrative documents'),
    # administrative requests, follow-ups and escalation
    ('requests.view', 'View Requests', 'View administrative requests'),
    ('requests.manage', 'Manage Requests', 'Review, assign and resolve administrative requests'),
    ('followups.view', 'View Follow-ups', 'View employee follow-ups'),
    ('followups.manage', 'Manage Follow-ups', 'Create and act on employee follow-ups'),
    ('escalations.view', 'View Escalations', 'View escalated administrative issues'),
    ('escalations.manage', 'Manage Escalations', 'Escalate administrative issues to management'),
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

# ── electronics shop ─────────────────────────────────────────────────────────
# A standalone retail business unit. Nothing here is reachable by the service
# agent, instructor or company secretary: those roles must never read shop
# prices, stock, sales or suppliers. Codes are all namespaced ``shop.*`` so a
# missing grant can never accidentally fall through to a service-centre code.
SHOP_PERMISSIONS = [
    # navigation / overview
    ('shop.view', 'View Shop', 'Open the electronics shop workspace'),
    # catalogue
    ('shop.products.view', 'View Shop Products', 'Browse the product catalogue, variants and prices'),
    ('shop.products.create', 'Create Shop Products', 'Add products, variants, bundles and barcodes'),
    ('shop.products.edit', 'Edit Shop Products', 'Edit product details, prices and attributes'),
    ('shop.products.archive', 'Archive Shop Products', 'Retire or restore products'),
    # inventory
    ('shop.inventory.view', 'View Shop Inventory', 'See stock balances, movements and serials'),
    ('shop.inventory.count', 'Count Shop Stock', 'Run and submit physical stock counts'),
    ('shop.inventory.adjust', 'Adjust Shop Stock', 'Raise damage, loss and correction adjustments'),
    ('shop.inventory.transfer', 'Transfer Shop Stock', 'Dispatch and receive branch-to-branch transfers'),
    ('shop.inventory.receive', 'Receive Shop Stock', 'Receive stock against purchase orders'),
    # suppliers & purchasing
    ('shop.suppliers.view', 'View Shop Suppliers', 'Browse supplier records'),
    ('shop.suppliers.create', 'Manage Shop Suppliers', 'Create and edit suppliers'),
    ('shop.purchases.view', 'View Shop Purchasing', 'Browse purchase orders and receipts'),
    ('shop.purchases.create', 'Create Shop Purchase Orders', 'Draft purchase orders'),
    ('shop.purchases.approve', 'Approve Shop Purchase Orders', 'Approve or cancel purchase orders'),
    ('shop.purchases.receive', 'Receive Shop Purchase Orders',
     'Book goods receipts against approved purchase orders'),
    # sales / POS
    ('shop.sales.view', 'View Shop Sales', 'Read sales recorded at the assigned branch'),
    ('shop.sales.view_all', 'View All Shop Sales', 'Read sales across every branch'),
    ('shop.sales.create', 'Create Shop Sales', 'Ring up, hold and reprint POS sales'),
    ('shop.sales.cancel', 'Cancel Shop Sales', 'Cancel a sale before or after payment'),
    ('shop.sales.refund', 'Refund Shop Sales', 'Refund sales outside the return workflow'),
    # customers, returns, warranty
    ('shop.customers.view', 'View Shop Customers', 'Browse the customer directory'),
    ('shop.customers.manage', 'Manage Shop Customers', 'Create and edit customer records'),
    ('shop.returns.view', 'View Shop Returns', 'Browse customer returns and exchanges'),
    ('shop.returns.create', 'Create Shop Returns', 'Record a return or exchange request'),
    ('shop.returns.approve', 'Approve Shop Returns', 'Approve, reject and complete returns'),
    ('shop.warranty.view', 'View Shop Warranty', 'Read warranty registrations and cases'),
    ('shop.warranty.manage', 'Manage Shop Warranty', 'Register warranties and resolve cases'),
    # reports & money
    ('shop.reports.view', 'View Shop Reports', 'Read operational shop reports and dashboards'),
    ('shop.financial_reports.view', 'View Shop Financial Reports',
     'Read shop revenue, margin, cost and stock-value reports'),
    ('shop.pricing.view', 'View Shop Pricing', 'See purchase cost and margin figures'),
    ('shop.pricing.manage', 'Manage Shop Pricing', 'Change costs, prices and price history'),
    ('shop.discounts.approve', 'Approve Shop Discounts', 'Approve discounts above the attendant limit'),
    # shifts, closings, configuration
    ('shop.shifts.view', 'View Shop Shifts', 'Read till sessions and their totals'),
    ('shop.shifts.manage', 'Manage Shop Shifts', 'Open and close till sessions'),
    ('shop.cash_closing.view', 'View Shop Cash Closing', 'Read daily cash closings'),
    ('shop.cash_closing.approve', 'Approve Shop Cash Closing', 'Approve or reject daily cash closings'),
    ('shop.promotions.manage', 'Manage Shop Promotions', 'Create and manage promotions'),
    ('shop.settings.manage', 'Manage Shop Settings', 'Configure shop numbering, tax and thresholds'),
    ('shop.activities.view', 'View Shop Activities',
     'Read the shop activity trail without money values'),
]

PERMISSIONS = PERMISSIONS + SHOP_PERMISSIONS

SYSTEM_ROLES = {
    'super_admin': 'Super Admin',
    'manager': 'Manager',
    'service_agent': 'Service Agent',
    'instructor': 'Instructor',
    'accountant': 'Accountant',
    'company_secretary': 'Company Secretary',
    'shop_manager': 'Shop Manager',
    'shop_attendant': 'Shop Attendant',
    'storekeeper': 'Storekeeper',
}

# Administrative coordination permission family. Shared by the Company Secretary
# (primary owner) and the Manager (oversight / escalation target). It deliberately
# contains NO service-operation and NO financial permission.
ADMINISTRATIVE_PERMISSIONS = [
    'employees.view', 'employees.manage',
    'departments.manage', 'branches.manage',
    'tasks.create', 'tasks.manage', 'tasks.view', 'tasks.assign', 'tasks.verify',
    'meetings.view', 'meetings.manage',
    'activities.view', 'activities.manage',
    'calendar.view', 'calendar.manage',
    'announcements.view', 'announcements.manage',
    'memos.view', 'memos.manage',
    'documents.view', 'documents.manage',
    'attendance.view', 'attendance.overview',
    'leave.view', 'leave.manage',
    'requests.view', 'requests.manage',
    'followups.view', 'followups.manage',
    'escalations.view', 'escalations.manage',
    'reports.operational',
    'notifications.view',
]

# Read-only participation rights for staff who take part in company
# communication but never administer it. Every system role holds this whole
# family — the read paths are shared by the whole company. Invariant guarded by
# tests/test_staff_communication_access.py.
STAFF_COMMUNICATION_PERMISSIONS = [
    'announcements.view', 'memos.view', 'documents.view',
    'meetings.view', 'calendar.view', 'requests.view', 'leave.view',
]

# Operational (non-financial) visibility of the service centre.
#
# Kept out of ADMINISTRATIVE_PERMISSIONS on purpose: this family reads the
# *state* of service work — which transaction exists, who it is assigned to,
# whether it is pending — and never a price, cost, commission or profit.
# ``transactions.operational`` is a distinct code from ``transactions.view``
# precisely so a holder cannot inherit the money columns that
# ``ServiceTransaction.to_dict()`` carries by default.
OPERATIONAL_SERVICE_PERMISSIONS = [
    'transactions.operational',
    'services.view',
    'clients.view',
]

# ── electronics shop permission families ─────────────────────────────────────
#
# The shop is a separate business unit: none of these codes may be granted to
# company_secretary, service_agent or instructor, and shop pages never read
# service-centre money columns.

# Company-level oversight of the shop: read everything operational, approve
# returns / discounts / purchase orders / cash closings. Never a POS till.
SHOP_OVERSIGHT_PERMISSIONS = [
    'shop.view',
    'shop.products.view',
    'shop.inventory.view',
    'shop.suppliers.view',
    'shop.purchases.view', 'shop.purchases.approve',
    'shop.sales.view', 'shop.sales.view_all', 'shop.sales.refund',
    'shop.customers.view',
    'shop.returns.view', 'shop.returns.approve',
    'shop.warranty.view',
    'shop.reports.view', 'shop.financial_reports.view',
    'shop.pricing.view',
    'shop.discounts.approve',
    'shop.cash_closing.view', 'shop.cash_closing.approve',
    'shop.activities.view',
]

# Accountant oversight: shop money only — revenue, cost, closings and
# supplier spend — with no till, no catalogue editing and no stock changes.
SHOP_FINANCE_OVERSIGHT_PERMISSIONS = [
    'shop.view',
    'shop.suppliers.view',
    'shop.purchases.view',
    'shop.sales.view', 'shop.sales.view_all',
    'shop.customers.view',
    'shop.returns.view',
    'shop.warranty.view',
    'shop.reports.view', 'shop.financial_reports.view',
    'shop.pricing.view',
    'shop.cash_closing.view', 'shop.cash_closing.approve',
    'shop.activities.view',
]

# Full branch shop operation: catalogue, stock, suppliers, purchasing,
# sales, returns, warranty, promos, settings and closings.
SHOP_MANAGER_PERMISSIONS = [
    'shop.view',
    'shop.products.view', 'shop.products.create', 'shop.products.edit',
    'shop.products.archive',
    'shop.inventory.view', 'shop.inventory.count', 'shop.inventory.adjust',
    'shop.inventory.transfer', 'shop.inventory.receive',
    'shop.suppliers.view', 'shop.suppliers.create',
    'shop.purchases.view', 'shop.purchases.create', 'shop.purchases.approve',
    'shop.purchases.receive',
    'shop.sales.view', 'shop.sales.view_all', 'shop.sales.create',
    'shop.sales.cancel', 'shop.sales.refund',
    'shop.customers.view', 'shop.customers.manage',
    'shop.returns.view', 'shop.returns.create', 'shop.returns.approve',
    'shop.warranty.view', 'shop.warranty.manage',
    'shop.reports.view', 'shop.financial_reports.view',
    'shop.pricing.view', 'shop.pricing.manage',
    'shop.discounts.approve',
    'shop.shifts.view', 'shop.shifts.manage',
    'shop.cash_closing.view', 'shop.cash_closing.approve',
    'shop.promotions.manage',
    'shop.settings.manage',
    'shop.activities.view',
]

# Till attendant: sell, take payments, look after customers, request returns
# and manage their own till. No catalogue edits, no stock changes, no money
# reports and no approvals — discounts above the configured limit escalate
# instead of being granted here.
SHOP_ATTENDANT_PERMISSIONS = [
    'shop.view',
    'shop.products.view',
    'shop.inventory.view',
    'shop.customers.view', 'shop.customers.manage',
    'shop.sales.view', 'shop.sales.create',
    'shop.returns.view', 'shop.returns.create',
    'shop.warranty.view',
    'shop.shifts.view', 'shop.shifts.manage',
]

# Storekeeper: catalogue upkeep, receiving, transfers, counts and adjustments.
# Deliberately no POS selling, no supplier purchase approval and no financial
# reports.
SHOP_STOREKEEPER_PERMISSIONS = [
    'shop.view',
    'shop.products.view', 'shop.products.create', 'shop.products.edit',
    'shop.products.archive',
    'shop.inventory.view', 'shop.inventory.count', 'shop.inventory.adjust',
    'shop.inventory.transfer', 'shop.inventory.receive',
    'shop.suppliers.view', 'shop.suppliers.create',
    'shop.purchases.view', 'shop.purchases.create', 'shop.purchases.receive',
    'shop.reports.view',
    'shop.activities.view',
]

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
        *ADMINISTRATIVE_PERMISSIONS,
        *SHOP_OVERSIGHT_PERMISSIONS,
    ],
    'service_agent': [
        'services.view',
        'clients.manage', 'clients.view',
        'transactions.create', 'transactions.view', 'transactions.edit',
        'closings.submit', 'closings.view',
        'expenses.create',
        'attendance.view',
        'tasks.view',
        # The service centre reads company communication like everyone else —
        # before this the role 403'd on /announcements, /memos, /documents,
        # /meetings, /calendar and /requests (and had no menu entries).
        *STAFF_COMMUNICATION_PERMISSIONS,
        'employees.earnings.view_own',
        'notifications.view',
    ],
    'instructor': [
        'attendance.view',
        'tasks.view',
        'leave.view',
        'weekly_plans.manage', 'weekly_plans.view',
        'learner_progress.view',
        'courses.view',
        'employees.earnings.view_own',
        'notifications.view',
        *STAFF_COMMUNICATION_PERMISSIONS,
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
        *STAFF_COMMUNICATION_PERMISSIONS,
        *SHOP_FINANCE_OVERSIGHT_PERMISSIONS,
    ],
    # Dedicated administrative coordination role. Explicitly independent from
    # the manager permission set: no service-centre writes, no financial access.
    'company_secretary': [*ADMINISTRATIVE_PERMISSIONS, *OPERATIONAL_SERVICE_PERMISSIONS],
    # Electronics shop unit — three operational roles. All of them read company
    # communication like everyone else (guarded by
    # tests/test_staff_communication_access.py).
    'shop_manager': [
        *SHOP_MANAGER_PERMISSIONS,
        *STAFF_COMMUNICATION_PERMISSIONS,
        'notifications.view',
    ],
    'shop_attendant': [
        *SHOP_ATTENDANT_PERMISSIONS,
        *STAFF_COMMUNICATION_PERMISSIONS,
        'notifications.view',
    ],
    'storekeeper': [
        *SHOP_STOREKEEPER_PERMISSIONS,
        *STAFF_COMMUNICATION_PERMISSIONS,
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
            # dict.fromkeys: a role may list a code in both its own block and
            # the shared administrative family.
            role.permissions = [perm_map[c] for c in dict.fromkeys(codes) if c in perm_map]
        role.is_active = True

    db.session.commit()
    return perm_map