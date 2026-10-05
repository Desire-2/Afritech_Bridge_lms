"""
Development/demo seed data. NEVER rely on this data in production dashboards.
Run with:  flask seed-dev
All data is clearly marked as development/demo.
"""
import os
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


# Production gets these three from the `03e60c5ab9dd` migration; the dev seed
# must agree with it so a fresh install looks the same either way.
BRANCH_SEEDS = [
    # (name, code, city)
    ('Head Office', 'HQ', 'Kigali'),
    ('Musanze Branch', 'MSZ', 'Musanze'),
    ('Kigali Branch', 'KGL', 'Kigali'),
]


def seed_branches():
    """Idempotently seed branches by unique code (safe to re-run)."""
    print('[seed-branches] Seeding branches...')
    branches = {}
    for name, code, city in BRANCH_SEEDS:
        br = Branch.query.filter_by(code=code).first()
        if br is None:
            br = Branch(name=name, code=code, city=city, is_active=True)
            db.session.add(br)
        else:
            br.name = name
            br.city = city
            br.is_active = True
        branches[code] = br
    db.session.commit()
    return branches


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


PAYMENT_METHOD_SEEDS = [
    ('Cash', 'cash'),
    ('Mobile Money', 'momo'),
    ('Bank', 'bank'),
    ('Credit / Debit Card', 'card'),
    ('Cheque', 'cheque'),
    ('Online Payment', 'online'),
]


def seed_payment_methods():
    """Idempotently seed payment methods by unique code (safe to re-run)."""
    print('[seed-payment-methods] Seeding payment methods...')
    count = 0
    for name, code in PAYMENT_METHOD_SEEDS:
        pm = PaymentMethod.query.filter_by(code=code).first()
        if pm is None:
            pm = PaymentMethod(name=name, code=code, is_active=True)
            db.session.add(pm)
        else:
            pm.name = name
            pm.is_active = True
        count += 1
    db.session.commit()
    return count


def _pwd():
    return 'Password123!'


class UnsafeSeedError(RuntimeError):
    """Raised when seed_dev would drop a non-local database."""


def assert_safe_to_drop(url=None):
    """Refuse db.drop_all() against anything but local SQLite.

    Production incidents happen when DevelopmentConfig picks up a remote
    DATABASE_URL from .env — seed_dev must never wipe that. Override only
    with SEED_ALLOW_DROP_REMOTE=1 (explicit, intentional).
    """
    if url is None:
        url = db.engine.url
    backend = getattr(url, 'get_backend_name', lambda: url.drivername.split('+')[0])()
    if backend == 'sqlite':
        return
    if os.environ.get('SEED_ALLOW_DROP_REMOTE') == '1':
        return
    raise UnsafeSeedError(
        f'Refusing to drop_all on non-SQLite database ({backend}://). '
        'seed_dev is local-development only. '
        'Fix DATABASE_URL to a local sqlite path, or set SEED_ALLOW_DROP_REMOTE=1 '
        'if you truly intend to wipe this database.'
    )


def seed_dev():
    assert_safe_to_drop()
    print('[dev-seed] Clearing existing development data...')
    db.drop_all()
    db.create_all()

    seed_permissions_and_roles()
    ensure_metrics()

    print('[dev-seed] Seeding branches and departments...')
    br = seed_branches()
    head, musanze, kigali = br['HQ'], br['MSZ'], br['KGL']

    service_dept = Department(name='Service Center', code='SVC', description='Irembo and government services')
    training_dept = Department(name='Training', code='TRN', description='Digital skills training')
    finance_dept = Department(name='Finance', code='FIN', description='Accounting and finance')
    admin_dept = Department(name='Administration', code='ADM', description='Company administration and coordination')
    db.session.add_all([service_dept, training_dept, finance_dept, admin_dept])
    db.session.commit()

    seed_payment_methods()
    seed_services()

    by_code = {pm.code: pm for pm in PaymentMethod.query.all()}
    cash, momo, bank = by_code['cash'], by_code['momo'], by_code['bank']
    pms = [by_code['cash'], by_code['momo'], by_code['bank'], by_code['online']]
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

    # Administrative coordination owner: the demo needs a Company Secretary
    # account to exercise the role end to end (nav, dashboard, redaction).
    secretary_user = User(email='secretary@afritech.dev')
    secretary_user.set_password(_pwd())
    db.session.add(secretary_user)
    secretary_user.roles.append(Role.query.filter_by(code='company_secretary').first())
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
    secretary_emp = Employee(first_name='Solange', last_name='Umutoni', email='secretary@afritech.dev',
                             employee_number='EMP-00007', position='Company Secretary', branch_id=head.id,
                             department_id=admin_dept.id, user_id=secretary_user.id, base_salary=220000,
                             employment_date=date.today() - timedelta(days=150))
    db.session.add_all([admin_emp, manager_emp, accountant_emp, agent_emp, agent2_emp,
                        instructor_emp, secretary_emp])
    db.session.commit()

    admin_emp.user_id = admin_user.id
    manager_emp.user_id = manager_user.id
    accountant_emp.user_id = accountant_user.id
    agent_emp.user_id = agent_user.id
    instructor_emp.user_id = instructor_user.id
    secretary_emp.user_id = secretary_user.id

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
            pm = random.choice(pms)
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
            # Seed rows must be timezone-aware too: a naive value written to a
            # `timestamptz` column is silently shifted into the DB session
            # timezone, and mixing naive/aware breaks hour arithmetic.
            clock_in = datetime.combine(
                adate, datetime.min.time().replace(hour=8, minute=15 + (d % 3), tzinfo=timezone.utc))
            clock_out = datetime.combine(
                adate, datetime.min.time().replace(hour=17, minute=0, tzinfo=timezone.utc))
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

    seed_shop(head, kigali, musanze, admin_user, manager_user, agent_emp)

    return dict(admin='admin@afritech.dev', manager='manager@afritech.dev',
                accountant='accountant@afritech.dev', agent='agent@afritech.dev',
                instructor='instructor@afritech.dev',
                secretary='secretary@afritech.dev',
                all_passwords=_pwd())


# ── electronics shop ─────────────────────────────────────────────────────────
# Real retail data for the demo: a small catalogue, opening stock booked
# through the real ledger, a fortnight of POS sales with payments, serials and
# warranties, plus one completed return.  Everything goes through the same
# services the API uses, so the seeded rows obey the same invariants.

SHOP_CATEGORY_SEEDS = [
    ('Phones & Tablets', 'PHN', 'Handsets, phablets and tablets'),
    ('Computers & Laptops', 'CMP', 'Laptops, desktops and workstations'),
    ('Audio', 'AUD', 'Headphones, earbuds and speakers'),
    ('Accessories', 'ACC', 'Chargers, cables, keyboards and mice'),
    ('Power', 'PWR', 'Power banks, adapters and backup power'),
]

SHOP_BRAND_SEEDS = [
    ('Tecno', 'TEC'), ('Samsung', 'SAM'), ('HP', 'HPI'), ('Lenovo', 'LEN'),
    ('Anker', 'ANK'), ('Logitech', 'LOG'),
]

SHOP_SUPPLIER_SEEDS = [
    ('Kigali Electronics Wholesalers', 'KEW', 'Alice Uwera',
     '+250788100200', 'sales@kew.rw', '30 days'),
    ('Rwanda Tech Distributors', 'RTD', 'Patrick Habimana',
     '+250788300400', 'orders@rwandatech.rw', '15 days'),
    ('Nile Imports Ltd', 'NIL', 'Grace Namutebi',
     '+256772000111', 'export@nileimports.ug', 'Prepaid'),
]

SHOP_PRODUCT_SEEDS = [
    dict(sku='PHN-SPARK-20', barcode='6001300000011', name='Tecno Spark 20',
         category='PHN', brand='TEC', supplier='KEW', cost=120000, price=185000,
         min_price=155000, reorder=6, opening=18, serialized=True, warranty=12,
         variant='8/256GB', attributes={'Colour': 'Black', 'Storage': '256GB'},
         description='6.6" HD display, 8GB RAM, 50MP camera'),
    dict(sku='PHN-A15-128', barcode='6001300000028', name='Samsung Galaxy A15',
         category='PHN', brand='SAM', supplier='RTD', cost=165000, price=240000,
         min_price=205000, reorder=4, opening=12, serialized=True, warranty=12,
         variant='4/128GB', attributes={'Colour': 'Blue', 'Storage': '128GB'},
         description='6.5" Super AMOLED, 5000mAh battery'),
    dict(sku='PHN-TAB-A9', barcode='6001300000035', name='Samsung Galaxy Tab A9',
         category='PHN', brand='SAM', supplier='RTD', cost=210000, price=295000,
         min_price=255000, reorder=3, opening=9, serialized=True, warranty=12,
         variant='4/64GB WiFi', attributes={'Colour': 'Graphite', 'Storage': '64GB'},
         description='8.7" tablet, 64GB storage'),
    dict(sku='CMP-HP-250G9', barcode='6001300000042', name='HP 250 G9',
         category='CMP', brand='HPI', supplier='KEW', cost=480000, price=690000,
         min_price=620000, reorder=2, opening=6, serialized=True, warranty=12,
         variant='i5/8GB/512GB', attributes={'Colour': 'Silver', 'Storage': '512GB'},
         description='15.6" business laptop, Intel Core i5'),
    dict(sku='CMP-IP3-15', barcode='6001300000059', name='Lenovo IdeaPad 3',
         category='CMP', brand='LEN', supplier='RTD', cost=420000, price=610000,
         min_price=545000, reorder=2, opening=5, serialized=True, warranty=12,
         variant='Ryzen5/8GB/512GB', attributes={'Colour': 'Grey', 'Storage': '512GB'},
         description='15.6" laptop, AMD Ryzen 5'),
    dict(sku='AUD-SND-E3', barcode='6001300000066', name='Anker Soundcore Earbuds',
         category='AUD', brand='ANK', supplier='NIL', cost=42000, price=68000,
         min_price=58000, reorder=6, opening=24, serialized=False, warranty=12,
         variant='Black', attributes={'Colour': 'Black'},
         description='Active noise cancelling earbuds'),
    dict(sku='ACC-CHG-65W', barcode='6001300000073', name='Anker 65W USB-C Charger',
         category='ACC', brand='ANK', supplier='NIL', cost=18000, price=32000,
         min_price=27000, reorder=10, opening=40, serialized=False, warranty=6,
         variant='GaN White', attributes={'Colour': 'White'},
         description='Compact GaN charger for laptops and phones'),
    dict(sku='ACC-CBL-USBC', barcode='6001300000080', name='USB-C to USB-C Cable 1.5m',
         category='ACC', brand='ANK', supplier='NIL', cost=3500, price=7000,
         min_price=5500, reorder=20, opening=60, serialized=False, warranty=0,
         variant='1.5m Braided', attributes={'Colour': 'Black'},
         description='100W braided charging cable'),
    dict(sku='ACC-KBD-MK270', barcode='6001300000097', name='Logitech MK270 Combo',
         category='ACC', brand='LOG', supplier='KEW', cost=26000, price=45000,
         min_price=39000, reorder=5, opening=15, serialized=False, warranty=12,
         variant='Wireless Black', attributes={'Colour': 'Black'},
         description='Wireless keyboard and mouse set'),
    dict(sku='PWR-PB-20K', barcode='6001300000103', name='Anker PowerBank 20000mAh',
         category='PWR', brand='ANK', supplier='NIL', cost=22000, price=38000,
         min_price=33000, reorder=8, opening=30, serialized=False, warranty=12,
         variant='20000mAh', attributes={'Colour': 'Black'},
         description='20000mAh power bank with 30W fast charge'),
]

SHOP_CUSTOMER_SEEDS = [
    ('Jean Bizimana', '+250788123456', 'jean.bizimana@example.rw',
     'KN 4 Ave, Kigali', 'individual', None),
    ('Aline Uwase', '+250788223344', 'aline.uwase@example.rw',
     'KG 11 Ave, Kigali', 'individual', None),
    ('Glory Primary School', '+250788556677', 'procurement@gloryprimary.rw',
     'Remera, Kigali', 'business', '1029384756'),
    ('Kivu Trading Ltd', '+250788998877', 'accounts@kivutrading.rw',
     'KN 3 Ave, Kigali', 'business', '1122334455'),
    ('Emmanuel Habimana', '+250788445566', 'emmanuel.h@example.rw',
     'Rukara, Musanze', 'individual', None),
    ('Chantal Mukasine', '+250788667788', 'chantal.m@example.rw',
     'Musanze Town', 'individual', None),
]


def _seed_line_totals(quantity, unit_price, discount_percent, tax_rate):
    """Mirror the POS pricing rules: discount first, tax added on top."""
    base = round(float(unit_price) * quantity, 2)
    discount = round(base * float(discount_percent or 0) / 100, 2)
    net = round(base - discount, 2)
    tax = round(net * float(tax_rate or 0) / 100, 2)
    return base, discount, tax, round(net + tax, 2)


def seed_shop(head, kigali, musanze, admin_user, manager_user, seller_emp):
    """Catalogue, opening stock, customers, promotion, sales and a return."""
    from .models import (
        ShopProductCategory, ShopBrand, ShopAttribute,
        ShopSupplier, ShopProduct, ShopProductVariant, ShopCustomer,
        ShopPromotion, ShopSerializedItem, ShopSale, ShopSaleItem, ShopPayment,
        ShopWarrantyRegistration, ShopReturn, ShopReturnItem,
    )
    from .services.shop_inventory import post_movement
    from .services.shop_series import next_number

    print('[dev-seed] Seeding electronics shop catalogue...')
    today = date.today()

    categories = {}
    for name, code, description in SHOP_CATEGORY_SEEDS:
        row = ShopProductCategory(name=name, code=code, description=description)
        db.session.add(row)
        categories[code] = row
    db.session.flush()

    brands = {}
    for name, code in SHOP_BRAND_SEEDS:
        row = ShopBrand(name=name, code=code)
        db.session.add(row)
        brands[code] = row

    for name, code in (('Colour', 'COL'), ('Storage', 'STO'),
                       ('Connectivity', 'CON')):
        if not ShopAttribute.query.filter_by(code=code).first():
            db.session.add(ShopAttribute(name=name, code=code))
    db.session.flush()

    suppliers = {}
    for company, code, contact, phone, email, terms in SHOP_SUPPLIER_SEEDS:
        row = ShopSupplier(code=code, company_name=company,
                           contact_person=contact, phone=phone, email=email,
                           payment_terms=terms)
        db.session.add(row)
        suppliers[code] = row
    db.session.flush()

    products = []
    for spec in SHOP_PRODUCT_SEEDS:
        product = ShopProduct(
            sku=spec['sku'], barcode=spec['barcode'], name=spec['name'],
            description=spec['description'],
            category_id=categories[spec['category']].id,
            brand_id=brands[spec['brand']].id,
            supplier_id=suppliers[spec['supplier']].id,
            purchase_cost=spec['cost'], selling_price=spec['price'],
            min_selling_price=spec['min_price'],
            reorder_level=spec['reorder'],
            reorder_quantity=spec['reorder'] * 2,
            is_serialized=spec['serialized'],
            warranty_months=spec['warranty'],
            warranty_provider='AfriTech Bridge' if spec['warranty'] else None,
            warranty_terms=(f'{spec["warranty"]}-month limited warranty covering '
                            f'manufacturing defects' if spec['warranty'] else None),
            created_by=admin_user.id,
        )
        db.session.add(product)
        db.session.flush()
        variant = ShopProductVariant(
            product_id=product.id, sku=f"{spec['sku']}-STD",
            barcode=f"{spec['barcode']}0", name=spec['variant'],
            attributes=spec.get('attributes') or {},
            purchase_cost=spec['cost'], selling_price=spec['price'],
        )
        db.session.add(variant)
        products.append((product, variant, spec))
    db.session.commit()

    # Opening stock — booked through the ledger so balances, costing and the
    # movement history all start from the same place the API would use.
    print('[dev-seed] Booking shop opening stock...')
    stock = {}          # (product_id, branch_id) -> units left
    serials = {}        # (product_id, branch_id) -> [serial rows still free]
    serial_counter = 1
    split = ((head, 0.5), (kigali, 0.3), (musanze, 0.2))
    for product, variant, spec in products:
        opening = int(spec['opening'])
        allocated = 0
        for index, (branch, share) in enumerate(split):
            if index == len(split) - 1:
                units = opening - allocated
            else:
                units = int(opening * share)
                allocated += units
            if units <= 0:
                continue
            post_movement(product_id=product.id, branch_id=branch.id,
                          variant_id=variant.id, movement_type='opening_balance',
                          quantity=units, unit_cost=float(spec['cost']),
                          reference_type='manual',
                          note='Shop opening stock',
                          user_id=admin_user.id)
            stock[(product.id, branch.id)] = units
            if spec['serialized']:
                rows = []
                for _ in range(units):
                    row = ShopSerializedItem(
                        serial_number=f"{spec['sku']}-{serial_counter:05d}",
                        product_id=product.id, variant_id=variant.id,
                        branch_id=branch.id, status='in_stock',
                        condition='good', purchase_cost=spec['cost'],
                        selling_price=spec['price'],
                        supplier_id=suppliers[spec['supplier']].id,
                        received_at=datetime.now(timezone.utc),
                        created_at=datetime.now(timezone.utc),
                        updated_at=datetime.now(timezone.utc),
                    )
                    db.session.add(row)
                    serial_counter += 1
                    rows.append(row)
                db.session.flush()
                serials[(product.id, branch.id)] = rows
    db.session.commit()

    print('[dev-seed] Seeding shop customers and promotion...')
    customers = []
    for i, (full_name, phone, email, address, ctype, tax_number) in enumerate(
            SHOP_CUSTOMER_SEEDS, 1):
        customer = ShopCustomer(
            customer_number=f'CUS-{i:05d}', full_name=full_name, phone=phone,
            email=email, address=address, customer_type=ctype,
            tax_number=tax_number, credit_limit=300000 if ctype == 'business' else 0,
            created_by=admin_user.id,
        )
        db.session.add(customer)
        customers.append(customer)
    db.session.flush()

    promotion = ShopPromotion(
        name='Back to School 10%', code='SCHOOL10', promotion_type='percentage',
        value=10, min_purchase_amount=100000, max_discount_amount=60000,
        starts_at=datetime.combine(today - timedelta(days=30),
                                   datetime.min.time(), tzinfo=timezone.utc),
        ends_at=datetime.combine(today + timedelta(days=60),
                                 datetime.min.time(), tzinfo=timezone.utc),
        is_active=True, usage_limit=200,
        notes='10% off baskets above 100,000 RWF during the school season',
    )
    db.session.add(promotion)
    db.session.commit()

    # Two weeks of till activity: dates, branches, tenders and customers are
    # mixed so the reports, warranty register and stock ledger have real depth.
    print('[dev-seed] Recording shop sales history...')
    catalog = list(products)
    payment_methods = {m.code: m for m in PaymentMethod.query.filter_by(
        is_active=True).all()}
    tenders = [('cash', 0.6), ('momo', 0.4)]
    tax_rate = 18  # institutional buyers are billed with VAT on top

    def pick_tender():
        roll = random.random()
        running = 0.0
        for code, weight in tenders:
            running += weight
            if roll <= running:
                return payment_methods.get(code) or payment_methods['cash']
        return payment_methods['cash']

    sale_rows = []
    for index in range(14):
        when = datetime.combine(
            today - timedelta(days=random.randint(0, 11)),
            datetime.min.time().replace(hour=random.randint(9, 17),
                                        minute=random.randint(0, 59),
                                        tzinfo=timezone.utc))
        branch = head if index % 3 else kigali
        customer = random.choice(customers)
        institutional = customer.customer_type == 'business'
        rate = tax_rate if institutional else 0

        # Choose lines that still have stock at this branch.
        choices = [spec for spec in catalog
                   if stock.get((spec[0].id, branch.id), 0) > 0]
        if not choices:
            continue
        random.shuffle(choices)
        lines = []
        for product, variant, spec in choices[:random.randint(1, 3)]:
            available = stock.get((product.id, branch.id), 0)
            quantity = min(available, random.randint(1, 2))
            if quantity <= 0:
                continue
            stock[(product.id, branch.id)] = available - quantity
            lines.append((product, variant, spec, quantity))
        if not lines:
            continue

        discount_percent = 10 if (institutional and index % 2 == 0) else 0
        subtotal = discount_total = tax_total = total = 0.0
        priced = []
        for product, variant, spec, quantity in lines:
            base, discount, tax, line_total = _seed_line_totals(
                quantity, spec['price'], discount_percent, rate)
            subtotal += base
            discount_total += discount
            tax_total += tax
            total += line_total
            priced.append((product, variant, spec, quantity, base, discount,
                           tax, line_total))
        total = round(total, 2)

        sale = ShopSale(
            sale_number=next_number('sale', when=when), branch_id=branch.id,
            customer_id=customer.id, status='completed', sale_type='pos',
            subtotal=round(subtotal, 2), discount_amount=round(discount_total, 2),
            tax_amount=round(tax_total, 2), total_amount=total,
            amount_paid=total, amount_due=0, change_given=0,
            discount_reason='Institutional volume discount' if discount_percent else None,
            discount_approved_by=manager_user.id if discount_percent else None,
            notes='Seeded demo sale',
            created_by=manager_user.id,
            created_at=when, updated_at=when,
        )
        db.session.add(sale)
        db.session.flush()

        for product, variant, spec, quantity, base, discount, tax, line_total in priced:
            item = ShopSaleItem(
                sale_id=sale.id, product_id=product.id, variant_id=variant.id,
                quantity=quantity, unit_price=spec['price'],
                unit_cost=spec['cost'], discount_amount=discount,
                discount_percent=discount_percent or 0, tax_rate=rate,
                tax_amount=tax, line_total=line_total,
                warranty_months=product.warranty_months or 0,
                warranty_terms=product.warranty_terms,
            )
            sale.items.append(item)
            db.session.flush()

            post_movement(product_id=product.id, branch_id=branch.id,
                          variant_id=variant.id, movement_type='sale',
                          quantity=-quantity, unit_cost=float(spec['cost']),
                          reference_type='sale', reference_id=sale.id,
                          note=f'Sale {sale.sale_number}', user_id=manager_user.id,
                          timestamp=when)

            sold_serials = []
            if product.is_serialized:
                free = serials.get((product.id, branch.id)) or []
                for _ in range(quantity):
                    if not free:
                        break
                    row = free.pop(0)
                    row.sale_item_id = item.id
                    row.status = 'sold'
                    row.sold_at = when
                    sold_serials.append(row)
                serials[(product.id, branch.id)] = free

            if product.warranty_months:
                db.session.add(ShopWarrantyRegistration(
                    warranty_number=next_number('warranty', when=when),
                    sale_item_id=item.id, product_id=product.id,
                    customer_id=customer.id,
                    serial_id=sold_serials[0].id if sold_serials else None,
                    warranty_months=product.warranty_months,
                    provider=product.warranty_provider,
                    terms=product.warranty_terms, start_date=when,
                    end_date=when + timedelta(days=product.warranty_months * 30),
                ))

        tender = pick_tender()
        sale.payments.append(ShopPayment(
            payment_method_id=tender.id, amount=total,
            reference=f'Demo sale {sale.sale_number}', status='completed',
            paid_at=when, created_by=manager_user.id,
        ))
        sale_rows.append((sale, priced, branch, customer))
    db.session.commit()

    # One completed return so the returns and stock ledgers are not empty.
    if sale_rows:
        print('[dev-seed] Recording a completed shop return...')
        sale, priced, branch, customer = sale_rows[-1]
        product, variant, spec, quantity, base, discount, tax, line_total = priced[0]
        refund = round(line_total, 2)
        returned = ShopReturn(
            return_number=next_number('return'), sale_id=sale.id,
            branch_id=branch.id, customer_id=customer.id,
            return_type='refund', status='completed', reason='Box damaged on collection',
            notes='Seeded demo return', subtotal_returned=refund,
            tax_returned=tax, refund_amount=refund, restock_fee=0,
            requested_by=seller_emp.user_id or manager_user.id,
            approved_by=admin_user.id,
            approved_at=datetime.now(timezone.utc),
            completed_at=datetime.now(timezone.utc),
        )
        db.session.add(returned)
        db.session.flush()
        item = sale.items[0]
        db.session.add(ShopReturnItem(
            return_id=returned.id, sale_item_id=item.id,
            product_id=product.id, variant_id=variant.id,
            quantity=1, unit_price=item.unit_price, unit_cost=item.unit_cost,
            tax_amount=tax, condition='good', restock=True,
            note='Returned to stock',
        ))
        item.returned_quantity = int(item.returned_quantity or 0) + 1
        sale.amount_refunded = refund
        sale.status = 'partially_refunded' if refund < float(sale.total_amount or 0) \
            else 'refunded'
        sale.payments.append(ShopPayment(
            payment_method_id=payment_methods['cash'].id, amount=-refund,
            reference=f'Refund {returned.return_number}', status='refunded',
            paid_at=datetime.now(timezone.utc), created_by=admin_user.id,
        ))
        post_movement(product_id=product.id, branch_id=branch.id,
                      variant_id=variant.id, movement_type='customer_return',
                      quantity=1, reference_type='return', reference_id=returned.id,
                      note=f'{returned.return_number} restocked',
                      user_id=admin_user.id)
        db.session.commit()

    # Loyalty balances follow from the seeded sales.
    for customer in customers:
        spend = sum(float(s.total_amount or 0) for s in customer.sales
                    if s.status in ('completed', 'partially_refunded', 'refunded'))
        customer.loyalty_points = int(spend // 1000)
    db.session.commit()
    print(f'[dev-seed] Shop: {len(products)} products, {len(sale_rows)} sales, '
          f'{len(customers)} customers')


@click.command('seed-dev')
@with_appcontext
def seed_dev_command():
    try:
        creds = seed_dev()
    except UnsafeSeedError as exc:
        raise click.ClickException(str(exc))
    print('\n=== DEV SEED COMPLETE ===')
    print('All passwords: ', _pwd())
    print('Admin:      ', creds['admin'])
    print('Manager:    ', creds['manager'])
    print('Accountant: ', creds['accountant'])
    print('Service agent: ', creds['agent'])
    print('Instructor: ', creds['instructor'])
    print('Company secretary: ', creds['secretary'])


@click.command('seed-services')
@with_appcontext
def seed_services_command():
    n = seed_services()
    click.echo(f'Seeded {n} services across {ServiceCategory.query.count()} categories')


@click.command('seed-payment-methods')
@with_appcontext
def seed_payment_methods_command():
    n = seed_payment_methods()
    click.echo(f'Seeded {n} payment methods')


def register_cli(app):
    app.cli.add_command(seed_dev_command)
    app.cli.add_command(seed_services_command)
    app.cli.add_command(seed_payment_methods_command)