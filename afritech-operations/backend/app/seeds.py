"""
Development/demo seed data. NEVER rely on this data in production dashboards.
Run with:  flask seed-dev
All data is clearly marked as development/demo.
"""
import random
from datetime import date, timedelta, datetime, timezone

import click
from flask.cli import with_appcontext

from .extensions import db
from .models import (
    User, Role, Employee, Branch, Department, ServiceCategory, Service, Client,
    PaymentMethod, ServiceTransaction, Payment, Expense, Attendance, Task,
    Instructor, Course, Cohort, WeeklyPlan, WeeklyPlanActivity, TeachingActivity, Enrollment, Learner,
    CommissionRule, generate_transaction_number,
)
from .auth.permissions import seed_permissions_and_roles
from .services.performance import ensure_metrics

SERVICE_CATEGORY_SEEDS = [
    ('Government Services', 'GOV', 'Irembo and government document applications'),
    ('Digital Services', 'DIG', 'Online account setup and digital assistance'),
    ('Printing & Scanning', 'PRT', 'Printing, scanning, photocopying and lamination'),
]

SERVICE_SEEDS = [
    # (name, code, category_code, official_cost, customer_price, commission_rate, description)
    ('Birth Certificate', 'BC', 'GOV', 500, 900, 0.20, 'Apply for a birth certificate via Irembo'),
    ('Land Document', 'LD', 'GOV', 2000, 4000, 0.20, 'Land title, plot and ownership document applications'),
    ('Criminal Record', 'CR', 'GOV', 1000, 2500, 0.20, 'Police clearance / criminal record certificate'),
    ('Civil Registration', 'CIV', 'GOV', 800, 1500, 0.20, 'Civil status and marriage registration services'),
    ('Irembo Application', 'IRM', 'GOV', 500, 1500, 0.20, 'General Irembo application assistance'),
    ('National ID', 'NID', 'GOV', 1000, 2500, 0.20, 'National ID application, renewal or replacement'),
    ('Driving License', 'DL', 'GOV', 1000, 3000, 0.20, 'Driving permit application and renewal'),
    ('Other Government Service', 'OTH-GOV', 'GOV', 500, 1500, 0.20, 'Other government-related application types'),
    ('Account Creation', 'ACC', 'DIG', 0, 1000, 0.25, 'E-government account creation and activation'),
    ('Email Setup', 'EML', 'DIG', 0, 750, 0.25, 'Email account creation and configuration'),
    ('Document Upload', 'DUP', 'DIG', 0, 500, 0.20, 'Preparing and uploading documents online'),
    ('Other Digital Service', 'OTH', 'DIG', 0, 500, 0.20, 'Other online / digital assistance'),
    ('Printing', 'PRN', 'PRT', 50, 200, 0.15, 'Black & white or color printing per page'),
    ('Scanning', 'SCN', 'PRT', 30, 100, 0.15, 'Document scanning to PDF or image'),
    ('Photocopy', 'PHO', 'PRT', 25, 100, 0.15, 'Photocopying per page'),
    ('Lamination', 'LAM', 'PRT', 200, 500, 0.20, 'Document lamination and binding'),
]


def seed_services():
    """Idempotently seed service categories and services by unique code (safe to re-run)."""
    print('[seed-services] Seeding service categories...')
    cats = {}
    for name, code, description in SERVICE_CATEGORY_SEEDS:
        cat = ServiceCategory.query.filter_by(code=code).first()
        if cat is None:
            cat = ServiceCategory(name=name, code=code, description=description)
            db.session.add(cat)
        else:
            cat.name = name
            if description:
                cat.description = description
        cats[code] = cat
    db.session.flush()

    print('[seed-services] Seeding services...')
    count = 0
    for name, code, cat_code, cost, price, rate, description in SERVICE_SEEDS:
        svc = Service.query.filter_by(code=code).first()
        if svc is None:
            svc = Service(name=name, code=code, category_id=cats[cat_code].id,
                          official_cost=cost, customer_price=price, commission_rate=rate,
                          description=description, is_active=True)
            db.session.add(svc)
        else:
            svc.name = name
            svc.category_id = cats[cat_code].id
            svc.official_cost = cost
            svc.customer_price = price
            svc.commission_rate = rate
            svc.description = description or svc.description
            svc.is_active = True
        count += 1
    db.session.commit()
    return count


def _pwd():
    return 'Password123!'


def seed_dev():
    print('[dev-seed] Clearing existing development data...')
    db.drop_all()
    db.create_all()

    seed_permissions_and_roles()
    ensure_metrics()

    print('[dev-seed] Seeding branches and departments...')
    head = Branch(name='Head Office', code='HQ', city='Kigali')
    musanze = Branch(name='Musanze Branch', code='MSZ', city='Musanze')
    kigali = Branch(name='Kigali Branch', code='KGL', city='Kigali')
    db.session.add_all([head, musanze, kigali])

    service_dept = Department(name='Service Center', code='SVC', description='Irembo and government services')
    training_dept = Department(name='Training', code='TRN', description='Digital skills training')
    finance_dept = Department(name='Finance', code='FIN', description='Accounting and finance')
    db.session.add_all([service_dept, training_dept, finance_dept])
    db.session.commit()

    print('[dev-seed] Seeding payment methods...')
    cash = PaymentMethod(name='Cash', code='cash')
    momo = PaymentMethod(name='Mobile Money', code='momo')
    bank = PaymentMethod(name='Bank', code='bank')
    other = PaymentMethod(name='Other', code='other')
    db.session.add_all([cash, momo, bank, other])

    seed_services()

    print('[dev-seed] Seeding users and employees...')
    admin_user = User(email='admin@afritech.dev')
    admin_user.set_password(_pwd())
    admin_user.is_super_admin = True
    admin_user.is_active = True
    db.session.add(admin_user)
    db.session.flush()

    manager_user = User(email='manager@afritech.dev')
    manager_user.set_password(_pwd())
    db.session.add(manager_user)
    manager_user.roles.append(Role.query.filter_by(code='manager').first())
    db.session.flush()

    accountant_user = User(email='accountant@afritech.dev')
    accountant_user.set_password(_pwd())
    db.session.add(accountant_user)
    accountant_user.roles.append(Role.query.filter_by(code='accountant').first())
    db.session.flush()

    agent_user = User(email='agent@afritech.dev')
    agent_user.set_password(_pwd())
    db.session.add(agent_user)
    agent_user.roles.append(Role.query.filter_by(code='service_agent').first())
    db.session.flush()

    instructor_user = User(email='instructor@afritech.dev')
    instructor_user.set_password(_pwd())
    db.session.add(instructor_user)
    instructor_user.roles.append(Role.query.filter_by(code='instructor').first())
    db.session.flush()

    db.session.flush()

    admin_emp = Employee(first_name='Aline', last_name='Uwase', email='admin@afritech.dev',
                         employee_number='EMP-00001', position='General Manager', branch_id=head.id,
                         department_id=finance_dept.id, user_id=admin_user.id, base_salary=400000,
                         employment_date=date.today() - timedelta(days=400))
    manager_emp = Employee(first_name='Eric', last_name='Mugisha', email='manager@afritech.dev',
                           employee_number='EMP-00002', position='Operations Manager', branch_id=head.id,
                           department_id=service_dept.id, user_id=manager_user.id, base_salary=300000,
                           employment_date=date.today() - timedelta(days=350))
    accountant_emp = Employee(first_name='Diane', last_name='Ingabire', email='accountant@afritech.dev',
                              employee_number='EMP-00003', position='Accountant', branch_id=head.id,
                              department_id=finance_dept.id, user_id=accountant_user.id, base_salary=280000,
                              employment_date=date.today() - timedelta(days=300))
    agent_emp = Employee(first_name='Claude', last_name='Niyonzima', email='agent@afritech.dev',
                         employee_number='EMP-00004', position='Service Agent', branch_id=kigali.id,
                         department_id=service_dept.id, user_id=agent_user.id, base_salary=50000,
                         employment_date=date.today() - timedelta(days=200))
    agent2_emp = Employee(first_name='Beata', last_name='Mukamana', email='beata@afritech.dev',
                          employee_number='EMP-00005', position='Service Agent', branch_id=musanze.id,
                          department_id=service_dept.id, base_salary=50000,
                          employment_date=date.today() - timedelta(days=180))
    instructor_emp = Employee(first_name='Jean', last_name='Baptiste', email='instructor@afritech.dev',
                              employee_number='EMP-00006', position='Instructor', branch_id=head.id,
                              department_id=training_dept.id, user_id=instructor_user.id, base_salary=250000,
                              employment_date=date.today() - timedelta(days=260))
    db.session.add_all([admin_emp, manager_emp, accountant_emp, agent_emp, agent2_emp, instructor_emp])
    db.session.commit()

    admin_emp.user_id = admin_user.id
    manager_emp.user_id = manager_user.id
    accountant_emp.user_id = accountant_user.id
    agent_emp.user_id = agent_user.id
    instructor_emp.user_id = instructor_user.id

    print('[dev-seed] Seeding instructors/courses/cohorts...')
    ins = Instructor(employee_id=instructor_emp.id, specialization='Digital Skills, Excel, Web')
    db.session.add(ins)
    db.session.flush()

    excel = Course(code='EXCEL', name='Microsoft Excel Essentials', description='Spreadsheets, formulas, dashboards')
    web = Course(code='WEB', name='Web Development Fundamentals', description='HTML, CSS, JavaScript')
    db.session.add_all([excel, web])
    db.session.flush()

    c1 = Cohort(code='EXCEL-Q3', name='Excel Q3 2026', course_id=excel.id, start_date=date.today() - timedelta(days=20), end_date=date.today() + timedelta(days=40))
    c2 = Cohort(code='WEB-Q3', name='Web Dev Q3 2026', course_id=web.id, start_date=date.today() - timedelta(days=10), end_date=date.today() + timedelta(days=50))
    db.session.add_all([c1, c2])
    db.session.flush()

    db.session.add_all([
        Learner(name='Grace Uwimana', email='grace@learner.dev', cohort_id=c1.id, enrollment_date=date.today() - timedelta(days=20)),
        Learner(name='Kevin Habimana', email='kevin@learner.dev', cohort_id=c1.id, enrollment_date=date.today() - timedelta(days=20)),
        Learner(name='Sandra Uwera', email='sandra@learner.dev', cohort_id=c2.id, enrollment_date=date.today() - timedelta(days=10)),
        Learner(name='Olivier Nshimiyimana', email='olivier@learner.dev', cohort_id=c2.id, enrollment_date=date.today() - timedelta(days=10)),
    ])
    db.session.commit()

    for l in Learner.query.all():
        db.session.add(Enrollment(learner_id=l.id, course_id=c1.course_id if l.cohort_id == c1.id else c2.course_id,
                                  cohort_id=l.cohort_id, progress_percent=35, average_score=72, attendance_rate=88))

    print('[dev-seed] Seeding clients and transactions...')
    client_names = [
        ('Aline', 'Mukeshimana'), ('Patrick', 'Ndayisaba'), ('Chantal', 'Uwase'),
        ('Emmanuel', 'Habimana'), ('Josiane', 'Mukasine'), ('Fidele', 'Niyibizi'),
        ('Claudine', 'Mukamana'), ('Theo', 'Rugamba'), ('Esther', 'Gasarabwe'),
        ('Innocent', 'Umutoni'),
    ]
    clients = []
    for i, (fn, ln) in enumerate(client_names, 1):
        c = Client(client_number=f'CL-{i:05d}', first_name=fn, last_name=ln,
                   phone=f'07{i:08d}', reference_info=f'Street {i}, Kigali')
        db.session.add(c)
        clients.append(c)
    db.session.flush()

    services = Service.query.all()
    by_name = {s.name: s for s in services}
    today = date.today()
    tx_num = 1
    transactions = []
    for offset in range(30):
        tdate = today - timedelta(days=offset)
        count = random.randint(2, 6)
        for _ in range(count):
            svc = random.choice(services)
            client = random.choice(clients)
            agent = random.choice([agent_emp, agent2_emp])
            pm = random.choice([cash, momo, bank, other])
            cost = svc.official_cost
            price = svc.customer_price
            gross = price - cost
            rate = svc.commission_rate if svc.commission_rate is not None else 0.20
            commission = gross * rate
            t = ServiceTransaction(
                transaction_number=generate_transaction_number(db.session),
                transaction_date=tdate, status='completed', service_id=svc.id,
                service_name=svc.name, client_id=client.id, employee_id=agent.id,
                branch_id=agent.branch_id, payment_method_id=pm.id,
                official_cost=cost, customer_price=price, commission_rate_used=rate,
                commission_source='service' if rate != 0.20 else 'default',
                gross_profit=round(gross, 2), commission_amount=round(commission, 2),
                company_profit=round(gross - commission, 2), is_cash=pm.code == 'cash',
            )
            db.session.add(t)
            tx_num += 1
            transactions.append(t)
            db.session.flush()
            db.session.add(Payment(transaction_id=t.id, amount=price, payment_method_id=pm.id))
    db.session.commit()

    print('[dev-seed] Seeding expenses, attendance, tasks, weekly plans...')
    expense_cats = ['internet', 'transport', 'supplies', 'equipment', 'rent', 'utilities', 'office']
    for i in range(15):
        db.session.add(Expense(
            amount=random.randint(3000, 80000),
            category=random.choice(expense_cats),
            description=f'Development demo expense #{i+1}',
            expense_date=today - timedelta(days=random.randint(0, 20)),
            payment_method_id=random.choice([cash.id, momo.id, bank.id]),
            submitted_by=manager_user.id, status=random.choice(['pending', 'approved', 'paid', 'rejected']),
            approved_by=admin_user.id if i % 2 == 0 else None,
        ))

    for emp in [agent_emp, agent2_emp, manager_emp, accountant_emp, instructor_emp]:
        for d in range(15):
            adate = today - timedelta(days=d)
            if adate.weekday() >= 5:
                continue
            clock_in = datetime.combine(adate, datetime.min.time().replace(hour=8, minute=15 + (d % 3)))
            clock_out = datetime.combine(adate, datetime.min.time().replace(hour=17, minute=0))
            db.session.add(Attendance(
                employee_id=emp.id, attendance_date=adate, clock_in=clock_in, clock_out=clock_out,
                status='present' if d % 7 else 'late',
                total_hours=round((clock_out - clock_in).total_seconds() / 3600, 2),
                recorded_by=manager_user.id,
            ))

    db.session.add_all([
        Task(title='Prepare monthly report', description='Compile September service centre report', assigned_to=manager_emp.id,
             created_by=admin_user.id, priority='high', due_date=today + timedelta(days=2), status='todo'),
        Task(title='Reconcile cash drawer', description='Count cash and submit daily closing', assigned_to=agent_emp.id,
             created_by=manager_user.id, priority='medium', due_date=today, status='in_progress'),
        Task(title='Review June payroll figures', description='Double check commission entries', assigned_to=accountant_emp.id,
             created_by=admin_user.id, priority='medium', due_date=today - timedelta(days=1), status='todo'),
    ])

    # weekly plans + teaching activities for the instructor
    ws = today - timedelta(days=today.weekday())
    plan = WeeklyPlan(instructor_id=ins.id, week_start=ws, week_end=ws + timedelta(days=6),
                      title='Excel week', status='in_progress', note='Focus on formulas and practical exercises')
    db.session.add(plan)
    db.session.flush()
    module_lessons = [
        ('Formulas', 'SUM / AVERAGE', 'Teach core formulas', 'Students apply formulas', 2),
        ('Pivot Tables', 'Intro to pivot tables', 'Pivot table practical', 'Students build a pivot', 2),
        ('Charts', 'Visualising data', 'Build a dashboard', 'Dashboard completed', 3),
    ]
    for i, (mod, lesson, act, outcome, dur) in enumerate(module_lessons):
        adate = ws + timedelta(days=i)
        db.session.add(WeeklyPlanActivity(
            weekly_plan_id=plan.id, activity_date=adate, course_id=excel.id, cohort_id=c1.id,
            module=mod, lesson=lesson, activity=act, expected_outcome=outcome, duration_hours=dur,
            status='done' if i == 0 else 'planned',
        ))
        db.session.add(TeachingActivity(
            instructor_id=ins.id, course_id=excel.id, cohort_id=c1.id, activity_date=adate,
            lesson_topic=lesson, duration_hours=dur, learner_count=14 + i, notes='Class went well', source='local',
        ))

    db.session.commit()

    return dict(admin='admin@afritech.dev', manager='manager@afritech.dev',
                accountant='accountant@afritech.dev', agent='agent@afritech.dev',
                instructor='instructor@afritech.dev',
                all_passwords=_pwd())


@click.command('seed-dev')
@with_appcontext
def seed_dev_command():
    creds = seed_dev()
    print('\n=== DEV SEED COMPLETE ===')
    print('All passwords: ', _pwd())
    print('Admin:      ', creds['admin'])
    print('Manager:    ', creds['manager'])
    print('Accountant: ', creds['accountant'])
    print('Service agent: ', creds['agent'])
    print('Instructor: ', creds['instructor'])


@click.command('seed-services')
@with_appcontext
def seed_services_command():
    n = seed_services()
    click.echo(f'Seeded {n} services across {ServiceCategory.query.count()} categories')


def register_cli(app):
    app.cli.add_command(seed_dev_command)
    app.cli.add_command(seed_services_command)