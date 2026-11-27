"""Weekly Service Agent financial report — focused backend tests.

Fixtures deliberately use two isolated calendar windows (2031 and 2020) so the
rows created here cannot collide with the dev seed (last 30 days) or with other
test modules.  API routes commit their own transactions, so the module-level
``_cleanup`` fixture removes everything at teardown instead of relying on the
global rollback in conftest.py.
"""
import io
import itertools
import json
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.extensions import db
from app.models import (
    AuditLog, Branch, Client, DailyClosing, Employee, Expense, MoMoSubmission,
    MOMO_PROVIDERS, Notification, OfficialCostPayment, OutstandingAllocation,
    Payment, PaymentMethod, SHORTAGE_REASON_CATEGORIES, Service,
    ServiceTransaction, Setting, User, WEEKLY_REPORT_STATUSES, WeeklyReport,
    WeeklyReportAdjustment, WeeklyReportExpense, generate_transaction_number,
)
from app.services import automation as automation_service
from app.services import notifications as ns
from app.services.weekly_i18n import SUPPORTED_LANGUAGES, bilingual, normalize_language, t
from app.services.weekly_policy import (
    DEFAULTS, WeekPolicyError, available_weeks, business_timezone, get_policy,
    in_week, is_late, is_valid_week_start, normalize_week_start,
    require_week_start, submission_deadline, week_bounds, week_end_for,
    week_for_submission, week_window,
)
from app.services.weekly_exports import _official_cost_rows
from app.services.weekly_report_service import WeeklyReportError, WeeklyReportService

svc = WeeklyReportService()

_future_seq = itertools.count()
_past_seq = itertools.count()
_TRACKED_REPORT_IDS = set()


def _future_week():
    # week_bounds() reads settings, so it must run inside the app context.
    return week_bounds(date(2031, 1, 15))[0] + timedelta(weeks=next(_future_seq))


def _past_week():
    return week_bounds(date(2020, 1, 15))[0] - timedelta(weeks=next(_past_seq))


def _hdr(client, email):
    r = client.post('/api/auth/login', json={'email': email, 'password': 'Password123!'})
    assert r.status_code == 200, r.get_data(as_text=True)
    return {'Authorization': f"Bearer {r.get_json()['access_token']}"}


def _user(email):
    return User.query.filter_by(email=email).first()


def _agent():
    return _user('agent@afritech.dev').employee


def _agent2():
    emp = Employee.query.filter_by(employee_number='EMP-00005').first()
    assert emp is not None
    return emp


def _generate(client, hdr, employee=None, week_start=None):
    employee = employee or _agent()
    week_start = week_start or _future_week()
    body = {'employee_id': employee.id, 'week_start': week_start.isoformat()}
    r = client.post('/api/weekly-reports/generate', headers=hdr, json=body)
    assert r.status_code in (200, 201), r.get_data(as_text=True)
    report = WeeklyReport.query.get(r.get_json()['report']['id'])
    _TRACKED_REPORT_IDS.add(report.id)
    return report


def _detail(client, hdr, report_id):
    r = client.get(f'/api/weekly-reports/{report_id}', headers=hdr)
    assert r.status_code == 200, r.get_data(as_text=True)
    return r.get_json()['report']


def _components(client, hdr, report_id):
    return _detail(client, hdr, report_id)['calculation']['components']


def _authorize_override(report, actor=None):
    report = WeeklyReport.query.get(report.id)
    svc.authorize_shortage_override(report, 'Authorized by finance for this test.',
                                    actor or _user('accountant@afritech.dev'))
    db.session.commit()


def _submit(client, hdr, report_id, payload=None, data=None, override=True):
    report = WeeklyReport.query.get(report_id)
    if override:
        _authorize_override(report)
    if data is not None:
        r = client.post(f'/api/weekly-reports/{report_id}/submit', headers=hdr,
                        data=data, content_type='multipart/form-data')
    else:
        r = client.post(f'/api/weekly-reports/{report_id}/submit', headers=hdr,
                        json=payload or {})
    return r


def _assert_ok(response):
    assert response.status_code == 200, response.get_data(as_text=True)
    return response.get_json()


def _txn(employee, day, price=1000, cost=400, status='completed', paid=True, cash=True,
         service_name=None):
    service = Service.query.first()
    client = Client.query.first()
    pm = PaymentMethod.query.filter_by(code='cash' if cash else 'momo').first()
    gross = Decimal(str(price)) - Decimal(str(cost))
    rate = service.commission_rate or Decimal('0.20')
    commission = (gross * rate).quantize(Decimal('0.01'))
    t = ServiceTransaction(
        transaction_number=f'WKT-{uuid.uuid4().hex[:12]}',
        transaction_date=day, status=status, service_id=service.id,
        client_id=client.id, employee_id=employee.id, branch_id=employee.branch_id,
        payment_method_id=pm.id, service_name=service_name or service.name,
        official_cost=cost, customer_price=price, commission_rate_used=rate,
        commission_source='service', gross_profit=gross, commission_amount=commission,
        company_profit=gross - commission, is_cash=cash,
    )
    db.session.add(t)
    db.session.flush()
    if paid:
        db.session.add(Payment(
            transaction_id=t.id, amount=price, payment_method_id=pm.id,
            paid_at=datetime.now(timezone.utc)))
    db.session.flush()
    return t


def _expense(day, amount=250, status='approved', code='cash', description='WKE-test expense'):
    pm = PaymentMethod.query.filter_by(code=code).first()
    e = Expense(amount=amount, category='transport', description=description,
                expense_date=day, payment_method_id=pm.id,
                submitted_by=_user('agent@afritech.dev').id,
                approved_by=_user('manager@afritech.dev').id, status=status)
    db.session.add(e)
    db.session.flush()
    return e


def _momo(client, hdr, report_id, reference=None, amount=100, **extra):
    payload = {
        'provider': 'momo', 'reference': reference or f'WKM-{uuid.uuid4().hex[:10]}',
        'amount': amount, 'sender_phone': '+250788123456',
        'recipient_phone': '+250788654321', 'confirmation_code': extra.get('confirmation_code', ''),
    }
    payload.update({k: v for k, v in extra.items() if k != 'confirmation_code'})
    r = client.post(f'/api/weekly-reports/{report_id}/momo', headers=hdr, json=payload)
    assert r.status_code == 201, r.get_data(as_text=True)
    return r.get_json()['submission']


def _review(client, hdr, report_id, action, **payload):
    return client.post(f'/api/weekly-reports/{report_id}/review', headers=hdr,
                       json={'action': action, **payload})


def _claim_row(report, txn, amount=None, personal=True, verified=False, reference=None,
               paid_at=None, customer_status='paid'):
    """Seed a cost claim directly for backend-authoritative calculation tests."""
    cost = Decimal(str(txn.official_cost))
    value = cost if amount is None else Decimal(str(amount)) if personal else Decimal('0')
    stamp = paid_at or datetime.combine(txn.transaction_date, datetime.min.time(),
                                        tzinfo=timezone.utc)
    claim = OfficialCostPayment(
        report_id=report.id, transaction_id=txn.id, employee_id=report.employee_id,
        reference_key=f'test:{uuid.uuid4().hex}', official_cost=cost,
        customer_payment_status=customer_status, personal_payment=personal,
        payment_source='personal' if personal else 'not_paid',
        amount=value, is_partial=bool(personal and value < cost),
        provider='momo' if personal else 'not_applicable',
        reference=(reference or f'WKP-{uuid.uuid4().hex[:10]}').upper(), paid_at=stamp,
        sender_phone='+250788111222' if personal else None,
        evidence_path='weekly_reports/test/proof.pdf' if personal else None,
        evidence_name='proof.pdf' if personal else None,
        content_type='application/pdf' if personal else None,
        size_bytes=4 if personal else None,
        verification_status='verified' if verified else 'pending',
        created_by=_user('agent@afritech.dev').id)
    db.session.add(claim)
    db.session.flush()
    return claim


def _claim_api(client, hdr, report, txn, amount=None, personal=True, reference=None,
               paid_at=None, provider='momo', sender_phone='+250788111222', source=None,
               auto=False):
    data = {
        'transaction_id': str(txn.id),
        'personal_payment': 'true' if personal else 'false',
    }
    if auto:
        data['auto_personal'] = 'true'
    else:
        data['notes'] = 'Official cost settlement evidence'
    if source:
        data['payment_source'] = source
    if personal and not auto:
        data.update({
            'amount': str(amount if amount is not None else txn.official_cost),
            'provider': provider,
            'reference': (reference or f'WKP-{uuid.uuid4().hex[:10]}').upper(),
            'sender_phone': sender_phone,
            'paid_at': paid_at or txn.transaction_date.isoformat(),
            'evidence': (io.BytesIO(b'%PDF-1.4\ncost proof'), 'cost-proof.pdf'),
        })
    return client.post(f'/api/weekly-reports/{report.id}/official-cost-payments',
                       headers=hdr, data=data, content_type='multipart/form-data')


@pytest.fixture(autouse=True)
def _cleanup():
    yield
    # A test that intentionally triggers an IntegrityError leaves the session
    # in a failed state; API routes commit their own work, so rolling back here
    # cannot undo the rows we need to delete.
    db.session.rollback()
    # API routes commit, so teardown must actively remove our synthetic rows.
    reports = WeeklyReport.query.filter(
        db.or_(WeeklyReport.week_start >= date(2031, 1, 1),
               WeeklyReport.week_start <= date(2020, 12, 31))).all()
    ids = sorted(set(r.id for r in reports) | _TRACKED_REPORT_IDS)
    _TRACKED_REPORT_IDS.clear()
    if ids:
        refs = [m.id for m in MoMoSubmission.query.filter(MoMoSubmission.report_id.in_(ids)).all()]
        claims = [c.id for c in OfficialCostPayment.query.filter(
            OfficialCostPayment.report_id.in_(ids)).all()]
        adjs = [a.id for a in WeeklyReportAdjustment.query.filter(WeeklyReportAdjustment.report_id.in_(ids)).all()]
        for model, column, values in (
            (MoMoSubmission, MoMoSubmission.id, refs),
            (OfficialCostPayment, OfficialCostPayment.id, claims),
            (WeeklyReportAdjustment, WeeklyReportAdjustment.id, adjs),
            (WeeklyReportExpense, WeeklyReportExpense.report_id, ids),
            (OutstandingAllocation, OutstandingAllocation.report_id, ids),
            (WeeklyReport, WeeklyReport.id, ids),
        ):
            if values:
                model.query.filter(column.in_(values)).delete(synchronize_session=False)
        if refs:
            Notification.query.filter(Notification.related_type == 'weekly_report',
                                      Notification.related_id.in_(refs)).delete(synchronize_session=False)
        entity_ids = [str(i) for i in ids + refs + claims + adjs]
        AuditLog.query.filter(AuditLog.entity.in_(
            ('weekly_report', 'weekly_momo_submission', 'weekly_official_cost_payment',
             'weekly_report_adjustment')),
            AuditLog.entity_id.in_(entity_ids)).delete(synchronize_session=False)
        Notification.query.filter(Notification.related_type == 'weekly_report',
                                  Notification.related_id.in_(ids)).delete(synchronize_session=False)

    txn_ids = [t.id for t in ServiceTransaction.query.filter(
        ServiceTransaction.transaction_number.like('WKT-%')).all()]
    if txn_ids:
        Payment.query.filter(Payment.transaction_id.in_(txn_ids)).delete(synchronize_session=False)
        ServiceTransaction.query.filter(ServiceTransaction.id.in_(txn_ids)).delete(synchronize_session=False)
    DailyClosing.query.filter(DailyClosing.notes.like('WKC-%')).delete(synchronize_session=False)
    Expense.query.filter(Expense.description.like('WKE-%')).delete(synchronize_session=False)
    MoMoSubmission.query.filter(MoMoSubmission.reference.like('WKM-%')).delete(synchronize_session=False)
    db.session.commit()


@pytest.fixture
def policy_override():
    touched = {}

    def _set(key, value):
        table_key = f'weekly_reporting.{key}'
        row = Setting.query.filter_by(key=table_key).first()
        if key not in touched:
            touched[key] = (row.value if row else None)
        if value is None:
            if row:
                db.session.delete(row)
        elif row:
            row.value = str(value)
        else:
            db.session.add(Setting(key=table_key, value=str(value), value_type='string',
                                   group='weekly_reporting'))
        db.session.commit()

    yield _set
    for key, original in touched.items():
        _set(key, original)


@pytest.fixture
def no_email(monkeypatch):
    """Keep notification tests focused on the in-app rows."""
    monkeypatch.setattr(ns, 'email_for_recipient', lambda *args, **kwargs: None)


class TestGeneration:
    def test_generate_is_idempotent_and_unique_constraint_enforced(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        first = _generate(client, admin_hdr, emp, week)
        second = _generate(client, admin_hdr, emp, week)
        assert first.id == second.id
        assert WeeklyReport.query.filter_by(employee_id=emp.id, week_start=week).count() == 1

        duplicate = WeeklyReport(
            report_number=f'WR-DUP-{uuid.uuid4().hex[:6]}', employee_id=emp.id,
            branch_id=emp.branch_id, week_start=week, week_end=week + timedelta(days=6),
            due_at=submission_deadline(week), status='draft')
        db.session.add(duplicate)
        with pytest.raises(IntegrityError):
            db.session.flush()
        db.session.rollback()

    def test_report_number_period_deadline_and_policy_snapshot(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        report = _generate(client, admin_hdr, emp, week)
        assert report.report_number.startswith(f'WR-{week:%Y%m%d}-{emp.id:04d}-')
        assert report.week_end == week + timedelta(days=6)
        assert report.timezone_name == 'Africa/Kigali'
        assert report.period_label == f'{week.isoformat()} – {(week + timedelta(days=6)).isoformat()}'
        assert report.due_at.replace(tzinfo=None) == submission_deadline(week).replace(tzinfo=None)
        calc = json.loads(report.calculation)
        assert set(DEFAULTS) <= set(calc['policy'])
        assert calc['policy']['timezone'] == 'Africa/Kigali'
        assert json.loads(report.snapshot or '{}') == {}  # not locked until submission
        audit_row = AuditLog.query.filter_by(action='weekly_report_generated',
                                             entity_id=str(report.id)).first()
        assert audit_row is not None and audit_row.user_email == 'admin@afritech.dev'

    def test_branch_scoping_on_generation(self, client, admin_hdr):
        week = _future_week()
        one = _generate(client, admin_hdr, _agent(), week)
        two = _generate(client, admin_hdr, _agent2(), week)
        assert one.branch_id == _agent().branch_id
        assert two.branch_id == _agent2().branch_id
        assert one.branch_id != two.branch_id
        result = _assert_ok(client.post(
            '/api/weekly-reports/generate', headers=admin_hdr,
            json={'week_start': (week + timedelta(weeks=1)).isoformat()}))
        assert result['created'] >= 2
        assert result['week_start'] == (week + timedelta(weeks=1)).isoformat()

    def test_current_previous_and_historical_weeks(self, client, admin_hdr):
        reference = date(2031, 1, 20)
        weeks = available_weeks(reference)
        assert len(weeks) == 13
        assert weeks[0] == week_bounds(reference)[0]
        assert weeks[1] == weeks[0] - timedelta(days=7)
        assert weeks[-1] == weeks[0] - timedelta(days=84)
        # Both a previous and a historical week can be materialised.
        assert _generate(client, admin_hdr, week_start=weeks[1]).week_start == weeks[1]
        assert _generate(client, admin_hdr, week_start=weeks[-1]).week_start == weeks[-1]

    def test_late_detection_and_automation_flag(self, client, admin_hdr):
        report = _generate(client, admin_hdr, week_start=_past_week())
        assert report.status == 'late' and report.is_late is True
        future = _generate(client, admin_hdr)
        assert future.status == 'draft' and future.is_late is False
        future.week_start = _past_week()
        future.is_late = False
        future.status = 'draft'
        db.session.commit()
        flagged = automation_service.weekly_report_late_alert(date.today())
        db.session.commit()
        assert flagged >= 1
        db.session.refresh(future)
        assert future.status == 'late' and future.is_late is True

    def test_manual_generation_permissions(self, client, admin_hdr, agent_hdr, manager_hdr):
        emp = _agent()
        week = _future_week()
        own = client.post('/api/weekly-reports/generate', headers=agent_hdr,
                          json={'employee_id': emp.id, 'week_start': week.isoformat()})
        assert own.status_code == 201, own.get_data(as_text=True)
        _TRACKED_REPORT_IDS.add(own.get_json()['report']['id'])
        # Agents may generate their own report but never one for a colleague.
        other = client.post('/api/weekly-reports/generate', headers=agent_hdr,
                            json={'employee_id': _agent2().id,
                                  'week_start': week.isoformat()})
        assert other.status_code == 403
        # Managers can generate only for employees in their own branch.
        manager_emp = _user('manager@afritech.dev').employee
        assert _generate(client, manager_hdr, manager_emp, week).employee_id == manager_emp.id
        r = client.post('/api/weekly-reports/generate', headers=manager_hdr,
                        json={'employee_id': emp.id, 'week_start': (week + timedelta(weeks=1)).isoformat()})
        assert r.status_code == 403
        assert r.get_json()['error'] == 'You can only generate reports for your branch'
        # Admin is not branch-scoped.
        assert _generate(client, admin_hdr, _agent2(), week).employee_id == _agent2().id


class TestCalculation:
    def test_formula_and_source_transaction_filters(self, client, admin_hdr, accountant_hdr):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=1)
        cash = _txn(emp, day, price=1000, cost=400)                # fully paid cash
        momo = _txn(emp, day, price=500, cost=100, cash=False)     # fully paid momo
        partial = _txn(emp, day, price=800, cost=200, paid=False)  # part payment
        db.session.add(Payment(transaction_id=partial.id, amount=400,
                               payment_method_id=PaymentMethod.query.filter_by(code='cash').first().id))
        unpaid = _txn(emp, day, price=600, cost=300, paid=False)   # unpaid
        _txn(emp, day, price=700, cost=200, status='cancelled')    # ineligible status
        _txn(emp, day, price=900, cost=300, status='refunded')     # ineligible status
        db.session.commit()

        report = _generate(client, admin_hdr, emp, week)
        # Customer payment status alone must never produce a deduction.
        assert svc.build_calculation(report)['components']['verified_service_costs'] == '0.00'
        _claim_row(report, cash, verified=True)
        _claim_row(report, momo, verified=True)
        partial_claim = _claim_row(report, partial, amount=100, verified=True)
        _claim_row(report, unpaid, personal=False)   # company-paid: never deductible
        db.session.commit()
        calc = svc.build_calculation(report)
        c = calc['components']
        assert calc['eligible_transaction_count'] == 3
        assert c['eligible_collections'] == '1900.00'  # 1000 + 500 + 400 part payment
        assert c['service_costs'] == '700.00'          # all eligible official costs (display)
        # 400 cash + 100 momo + only 100 of the 200 part-paid cost.
        assert c['verified_service_costs'] == '600.00'
        assert c['verified_provider_payments'] == '600.00'
        assert partial_claim.is_partial is True
        assert c['commission_earned'] == '320.00'      # 20% of 1600 gross profit, shown separately
        assert c['commission_retained'] == '0.00'      # only retained when configured
        assert c['expected_remittance'] == '1300.00'   # 0 + 1900 - 600
        statuses = {row['payment_status']: row for row in calc['transactions']}
        assert statuses['paid']['is_eligible'] is True
        assert statuses['partially_paid']['is_eligible'] is True
        assert statuses['unpaid']['is_eligible'] is False

    def test_daily_closings_do_not_double_count_collections(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=1)
        txn = _txn(emp, day, price=1000, cost=400)
        closing = DailyClosing(employee_id=emp.id, branch_id=emp.branch_id,
                               closing_date=day, transaction_count=1, actual_cash=9999,
                               notes='WKC-manual large cash', status='submitted')
        db.session.add(closing)
        db.session.commit()

        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)
        db.session.commit()
        calc = svc.build_calculation(report)
        assert calc['components']['eligible_collections'] == '1000.00'
        assert calc['components']['expected_remittance'] == '600.00'
        day_row = next(r for r in calc['daily_closings'] if r['date'] == day.isoformat())
        assert day_row['actual_cash'] == '9999.00'
        assert day_row['collections'] == '1000.00'
        assert day_row['comments'] == 'WKC-manual large cash'

    def test_only_approved_collection_funded_expenses_are_deducted(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=2)
        _txn(emp, day, price=1000, cost=400)
        _expense(day, amount=250, status='approved', code='cash')
        _expense(day, amount=300, status='approved', code='momo', description='WKE-non cash')
        _expense(day, amount=400, status='pending', code='cash', description='WKE-pending')
        _expense(day, amount=100, status='paid', code='cash', description='WKE-paid')
        db.session.commit()

        report = _generate(client, admin_hdr, emp, week)
        calc = svc.build_calculation(report)
        assert calc['components']['approved_collection_expenses'] == '350.00'
        # The unclaimed 400 official cost is not deducted from collections.
        assert calc['components']['verified_service_costs'] == '0.00'
        assert calc['components']['expected_remittance'] == '650.00'
        assert len(calc['expenses']) == 2

    def test_expense_linked_to_one_report_only(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=1)
        _txn(emp, day, price=1000, cost=400)
        expense = _expense(day, amount=100, description='WKE-once')
        db.session.commit()

        first = _generate(client, admin_hdr, emp, week)
        assert _submit(client, agent_hdr := _hdr(client, 'agent@afritech.dev'), first.id).status_code == 200
        assert WeeklyReportExpense.query.filter_by(expense_id=expense.id).count() == 1

        second = _generate(client, admin_hdr, emp, week + timedelta(weeks=1))
        # Make the second report's date window overlap the expense date without
        # colliding with the unique (employee, week_start) constraint; the link
        # must stop the same expense being deducted twice.
        second.week_start = first.week_start + timedelta(days=1)
        second.week_end = first.week_end
        db.session.commit()
        assert svc.build_calculation(WeeklyReport.query.get(second.id))['components'][
            'approved_collection_expenses'] == '0.00'
        with pytest.raises(IntegrityError):
            db.session.add(WeeklyReportExpense(report_id=second.id, expense_id=expense.id,
                                               amount=100))
            db.session.flush()
        db.session.rollback()

    def test_adjustments_and_commission_toggle(self, client, admin_hdr, policy_override):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=1)
        txn = _txn(emp, day, price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)
        for kind, amount in (('authorized_receipt', 500), ('provider_payment', 120),
                            ('authorized_refund', 50), ('other_outflow', 30)):
            db.session.add(WeeklyReportAdjustment(
                report_id=report.id, kind=kind, adjusted_amount=amount,
                reason='Documented test adjustment', actor_id=_user('accountant@afritech.dev').id))
        db.session.commit()
        c = svc.build_calculation(WeeklyReport.query.get(report.id))['components']
        assert c['authorized_receipts'] == '500.00'
        assert c['verified_provider_payments'] == '520.00'  # 400 verified cost + 120 adjustment
        assert c['authorized_refunds'] == '50.00'
        assert c['other_outflows'] == '30.00'
        # 0 opening + 1000 collections - 400 verified cost + 500 receipt
        # - 120 provider payment - 50 refund - 30 outflow = 900
        assert c['expected_remittance'] == '900.00'

        policy_override('commission_retained', 'true')
        c = svc.build_calculation(WeeklyReport.query.get(report.id))['components']
        assert c['commission_retained'] == '120.00'  # 20% of 600 gross profit
        assert c['commission_earned'] == '120.00'
        assert c['expected_remittance'] == '780.00'

    def test_submitted_calculation_is_frozen_snapshot(self, client, admin_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, _hdr(client, 'agent@afritech.dev'), report.id).status_code == 200
        expected = _components(client, accountant_hdr, report.id)['expected_remittance']
        # New source rows appear after submission; the frozen calculation must not move.
        _txn(_agent(), report.week_start, price=5000, cost=1000)
        db.session.commit()
        frozen = json.loads(WeeklyReport.query.get(report.id).snapshot)
        assert frozen['components']['expected_remittance'] == expected
        svc.refresh(WeeklyReport.query.get(report.id), _user('accountant@afritech.dev'))
        db.session.commit()
        assert _components(client, accountant_hdr, report.id)['expected_remittance'] == expected


class TestDailyClosingIntegration:
    def test_per_day_totals_missing_days_and_comments(self, client, admin_hdr):
        emp = _agent()
        week = _future_week()
        day = week + timedelta(days=2)
        _txn(emp, day, price=900, cost=300)
        db.session.add(DailyClosing(
            employee_id=emp.id, branch_id=emp.branch_id, closing_date=day,
            status='approved', actual_cash=800, notes='WKC-verified count',
            submitted_at=datetime.now(timezone.utc)))
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        calc = svc.build_calculation(report)
        assert len(calc['daily_closings']) == 7
        assert calc['missing_closings'] == [
            (week + timedelta(days=i)).isoformat() for i in range(7) if i != 2]
        row = calc['daily_closings'][2]
        assert row['status'] == 'approved'
        assert row['transaction_count'] == 1
        assert row['collections'] == '900.00'
        assert row['comments'] == 'WKC-verified count'
        assert calc['daily_closings'][0]['expected_cash'] is None

    def test_missing_closing_override_requires_reason(self, client, admin_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        url = f'/api/weekly-reports/{report.id}/missing-closings/override'
        assert client.post(url, headers=accountant_hdr, json={}).status_code == 400
        r = _assert_ok(client.post(url, headers=accountant_hdr,
                                   json={'reason': 'Banking outage on Monday'}))
        assert r['report']['has_missing_closing_override'] is True
        assert r['report']['missing_closing_override_by'] == _user('accountant@afritech.dev').id

    def test_shortage_override_requires_reason_and_audit(self, client, admin_hdr):
        report = _generate(client, admin_hdr)
        actor = _user('accountant@afritech.dev')
        with pytest.raises(WeeklyReportError) as exc:
            svc.authorize_shortage_override(report, '', actor)
        assert exc.value.status == 400
        svc.authorize_shortage_override(WeeklyReport.query.get(report.id),
                                        'CFO approved timing difference', actor)
        db.session.commit()
        report = WeeklyReport.query.get(report.id)
        assert report.override_reason == 'CFO approved timing difference'
        assert report.override_authorized_by == actor.id and report.override_authorized_at
        log = AuditLog.query.filter_by(action='weekly_report_shortage_override_authorized',
                                       entity_id=str(report.id)).first()
        assert log is not None and json.loads(log.new_value)['override_reason'] == report.override_reason


class TestWorkflow:
    def test_draft_update_ready_submit_locks(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        r = _assert_ok(client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                                    json={'shortage_reason_category': 'cash_count_error',
                                          'shortage_explanation': 'Counted twice',
                                          'reviewer_note': 'agent note'}))
        assert r['report']['shortage_explanation'] == 'Counted twice'
        assert report.status == 'draft'
        submitted = _submit(client, agent_hdr, report.id, payload={'submission_note': 'weekly pack'})
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        body = submitted.get_json()['report']
        assert body['status'] == 'submitted' and body['current_version'] == 2
        assert body['submitted_at'] and body['submitted_by'] == _user('agent@afritech.dev').id
        assert WeeklyReport.query.get(report.id).snapshot
        assert client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                            json={'shortage_explanation': 'tamper'}).status_code == 409
        assert WeeklyReport.query.get(report.id).shortage_explanation == 'Counted twice'

    def test_resubmission_after_correction_increments_version(self, client, admin_hdr,
                                                              agent_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'request_correction',
                    reason='Attach the bank statement')
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['report']['status'] == 'returned_for_correction'
        assert r.get_json()['report']['correction_note'] == 'Attach the bank statement'
        r = _assert_ok(client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                                    json={'shortage_explanation': 'Bank statement attached'}))
        assert r['report']['status'] == 'returned_for_correction'
        r = _submit(client, agent_hdr, report.id)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['report']['current_version'] == 3
        assert r.get_json()['report']['status'] == 'submitted'
        assert r.get_json()['report']['correction_note'] is None
        actions = [row.action for row in AuditLog.query.filter_by(
            entity='weekly_report', entity_id=str(report.id)).all()]
        assert 'weekly_report_submitted' in actions
        assert 'weekly_report_returned_for_correction' in actions

    def test_approve_sets_closing_outstanding_and_reject_requires_reason(self, client,
                                                                         admin_hdr, agent_hdr,
                                                                         accountant_hdr):
        report = _generate(client, admin_hdr)
        _submit(client, agent_hdr, report.id)
        r = _review(client, accountant_hdr, report.id, 'approve', reason='all matched')
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()['report']
        assert body['status'] == 'approved'
        assert body['approved_by'] == _user('accountant@afritech.dev').id and body['approved_at']
        assert _review(client, accountant_hdr, report.id, 'approve').status_code == 409

        other = _generate(client, admin_hdr)
        _submit(client, agent_hdr, other.id)
        assert _review(client, accountant_hdr, other.id, 'reject').status_code == 400
        r = _review(client, accountant_hdr, other.id, 'reject', reason='duplicate transfer')
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.get_json()['report']['status'] == 'rejected'
        assert r.get_json()['report']['rejection_reason'] == 'duplicate transfer'

    def test_invalid_transitions_rejected(self, client, admin_hdr, agent_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        with pytest.raises(WeeklyReportError) as exc:
            svc.transition(report, 'approved', _user('accountant@afritech.dev'))
        assert exc.value.status == 409
        assert _review(client, accountant_hdr, report.id, 'approve').status_code == 409
        _submit(client, agent_hdr, report.id)
        assert client.post(f'/api/weekly-reports/{report.id}/submit',
                           headers=agent_hdr, json={}).status_code == 409
        assert _review(client, accountant_hdr, report.id, 'approve').status_code == 200
        assert _review(client, accountant_hdr, report.id, 'request_correction',
                       reason='too late').status_code == 409

    def test_allowed_transitions_exposed_in_detail(self, client, admin_hdr, agent_hdr,
                                                    accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _detail(client, agent_hdr, report.id)['allowed_transitions'] == [
            'ready_for_submission', 'late']
        _submit(client, agent_hdr, report.id)
        assert set(_detail(client, accountant_hdr, report.id)['allowed_transitions']) == {
            'under_financial_review', 'returned_for_correction'}


class TestOfficialCostPayments:
    def test_verified_personal_claim_is_the_only_remittance_credit(
            self, client, admin_hdr, agent_hdr, accountant_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        txn = _txn(_agent(), _future_week() + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, txn.employee, txn.transaction_date - timedelta(days=1))

        response = _claim_api(client, agent_hdr, report, txn, reference='WKP-VERIFIED')
        assert response.status_code == 201, response.get_data(as_text=True)
        claim = response.get_json()['claim']
        assert claim['personal_payment'] is True
        assert claim['amount'] == 400.0
        assert claim['is_partial'] is False
        assert claim['verification_status'] == 'pending'
        assert claim['sender_phone'] == '+250******222'
        before = response.get_json()['report']['calculation']['components']
        assert before['verified_service_costs'] == '0.00'
        assert before['expected_remittance'] == '1000.00'
        listing = _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/official-cost-payments', headers=agent_hdr))
        assert listing['total'] == 1 and listing['verified_total'] == '0.00'

        assert _submit(client, agent_hdr, report.id).status_code == 200
        assert _components(client, accountant_hdr, report.id)['expected_remittance'] == '1000.00'
        r = _review(client, accountant_hdr, report.id, 'verify_cost_payment',
                    claim_id=claim['id'], note='Provider receipt matched')
        assert r.status_code == 200, r.get_data(as_text=True)

        c = _components(client, accountant_hdr, report.id)
        assert c['verified_service_costs'] == '400.00'
        assert c['verified_provider_payments'] == '400.00'
        assert c['expected_remittance'] == '600.00'
        actions = {row['action'] for row in _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/audit', headers=accountant_hdr))['items']}
        assert {'weekly_cost_payment_submitted', 'weekly_cost_payment_verified'} <= actions
        types = {row.type for row in Notification.query.filter_by(
            related_type='weekly_report', related_id=report.id).all()}
        assert {'weekly_cost_payment_submitted', 'weekly_cost_payment_verified'} <= types

    def test_auto_personal_claim_uses_full_transaction_cost_without_extra_fields(
            self, client, admin_hdr, agent_hdr, accountant_hdr, no_email):
        """Selecting 'own funds' only needs the payer answer from the agent."""
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        response = _claim_api(client, agent_hdr, report, txn, auto=True)
        assert response.status_code == 201, response.get_data(as_text=True)
        claim = response.get_json()['claim']
        assert claim['payment_source'] == 'personal'
        assert claim['personal_payment'] is True
        assert claim['auto_personal'] is True
        assert claim['amount'] == 400.0
        assert claim['is_partial'] is False
        assert claim['verification_status'] == 'pending'
        assert claim['evidence_name'] is None

        stored = OfficialCostPayment.query.get(claim['id'])
        assert stored.amount == Decimal('400.00')
        assert stored.sender_phone == emp.phone
        assert stored.evidence_path is None
        assert stored.reference.startswith(f'SELF-{report.id}-')
        assert stored.notes == 'Auto-recorded from the transaction and employee profile'
        assert stored.auto_personal is True

        summary = _detail(client, agent_hdr, report.id)['summary']
        assert summary['personal_paid_applied'] == '400.00'
        assert summary['personal_paid_pending'] == '0.00'
        assert summary['personal_paid_verified'] == '0.00'
        assert summary['expected_amount'] == '600.00'
        cost_row = next(row for row in summary['official_costs']
                        if row['transaction_id'] == txn.id)
        assert cost_row['auto_personal'] is True
        assert cost_row['verified_amount'] == '400.00'
        assert cost_row['verification_status'] == 'pending'

        listing = _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/official-cost-payments', headers=agent_hdr))
        assert listing['verified_total'] == '400.00'

        assert _submit(client, agent_hdr, report.id).status_code == 200
        before = _components(client, accountant_hdr, report.id)
        assert before['verified_service_costs'] == '400.00'
        assert before['expected_remittance'] == '600.00'

        approved = _review(client, accountant_hdr, report.id, 'approve')
        assert approved.status_code == 200, approved.get_data(as_text=True)
        db.session.refresh(stored)
        assert stored.verification_status == 'verified'
        assert stored.verified_by is not None and stored.verified_at is not None
        after = _components(client, accountant_hdr, report.id)
        assert after['expected_remittance'] == '600.00'
        actions = {row['action'] for row in _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/audit', headers=accountant_hdr))['items']}
        assert 'weekly_cost_payment_confirmed_on_approval' in actions

    def test_auto_personal_credit_applies_when_customer_has_not_paid(
            self, client, admin_hdr, agent_hdr, accountant_hdr, no_email):
        """The agent's own funds deduct even for an unpaid customer sale."""
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400, paid=False)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        report.opening_outstanding = Decimal('1000.00')
        db.session.commit()

        before = _detail(client, agent_hdr, report.id)['calculation']
        assert before['eligible_transaction_count'] == 0
        assert before['components']['verified_service_costs'] == '0.00'
        assert before['components']['expected_remittance'] == '1000.00'

        response = _claim_api(client, agent_hdr, report, txn, auto=True)
        assert response.status_code == 201, response.get_data(as_text=True)

        after = _detail(client, agent_hdr, report.id)['calculation']
        assert after['eligible_transaction_count'] == 0
        assert after['components']['verified_service_costs'] == '400.00'
        assert after['components']['expected_remittance'] == '600.00'

        summary = _detail(client, agent_hdr, report.id)['summary']
        assert summary['personal_paid_applied'] == '400.00'
        assert summary['expected_amount'] == '600.00'
        cost_row = next(row for row in summary['official_costs']
                        if row['transaction_id'] == txn.id)
        assert cost_row['customer_payment_status'] == 'unpaid'
        assert cost_row['verified_amount'] == '400.00'
        assert cost_row['verification_status'] == 'pending'

        # Submission must not change an already-applied deduction.
        assert _submit(client, agent_hdr, report.id).status_code == 200
        submitted = _components(client, accountant_hdr, report.id)
        assert submitted['verified_service_costs'] == '400.00'
        assert submitted['expected_remittance'] == '600.00'

        approved = _review(client, accountant_hdr, report.id, 'approve')
        assert approved.status_code == 200, approved.get_data(as_text=True)
        assert _components(client, accountant_hdr, report.id)['expected_remittance'] == '600.00'

    def test_auto_personal_credit_stops_when_reviewer_rejects_it(
            self, client, admin_hdr, agent_hdr, accountant_hdr, no_email):
        """Auto credit is immediate but a reviewer can still reject the claim."""
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        response = _claim_api(client, agent_hdr, report, txn, auto=True)
        assert response.status_code == 201, response.get_data(as_text=True)
        claim = response.get_json()['claim']
        assert _components(client, agent_hdr, report.id)['expected_remittance'] == '600.00'

        assert _submit(client, agent_hdr, report.id).status_code == 200
        rejected = _review(client, accountant_hdr, report.id, 'reject_cost_payment',
                           claim_id=claim['id'], note='Profile phone did not match')
        assert rejected.status_code == 200, rejected.get_data(as_text=True)
        assert _components(client, accountant_hdr, report.id)['expected_remittance'] == '1000.00'

        stored = OfficialCostPayment.query.get(claim['id'])
        assert stored.verification_status == 'rejected'
        approved = _review(client, accountant_hdr, report.id, 'approve')
        assert approved.status_code == 200, approved.get_data(as_text=True)
        db.session.refresh(stored)
        assert stored.verification_status == 'rejected'
        assert _components(client, accountant_hdr, report.id)['expected_remittance'] == '1000.00'

    def test_company_paid_unverified_and_rejected_claims_never_deduct(
            self, client, admin_hdr, agent_hdr, accountant_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        emp = _agent()
        txns = [_txn(emp, week + timedelta(days=1), price=1000, cost=400) for _ in range(3)]
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        company_paid = _claim_api(client, agent_hdr, report, txns[0], personal=False)
        assert company_paid.status_code == 201, company_paid.get_data(as_text=True)
        company_claim = company_paid.get_json()['claim']
        assert company_claim['personal_payment'] is False
        assert company_claim['amount'] == 0.0 and company_claim['evidence_name'] is None

        pending = _claim_api(client, agent_hdr, report, txns[1], reference='WKP-PENDING')
        assert pending.status_code == 201, pending.get_data(as_text=True)
        pending_id = pending.get_json()['claim']['id']

        rejected = _claim_api(client, agent_hdr, report, txns[2], reference='WKP-REJECT')
        assert rejected.status_code == 201, rejected.get_data(as_text=True)
        rejected_id = rejected.get_json()['claim']['id']

        c = svc.build_calculation(WeeklyReport.query.get(report.id))['components']
        assert c['verified_service_costs'] == '0.00'
        assert c['expected_remittance'] == '3000.00'

        assert _submit(client, agent_hdr, report.id).status_code == 200
        assert _review(client, accountant_hdr, report.id, 'verify_cost_payment',
                       claim_id=company_claim['id']).status_code == 409
        assert _review(client, accountant_hdr, report.id, 'reject_cost_payment',
                       claim_id=rejected_id).status_code == 400
        r = _review(client, accountant_hdr, report.id, 'reject_cost_payment',
                    claim_id=rejected_id, note='Receipt belongs to another agent')
        assert r.status_code == 200, r.get_data(as_text=True)

        c = _components(client, accountant_hdr, report.id)
        assert c['verified_service_costs'] == '0.00'
        assert c['expected_remittance'] == '3000.00'
        claims = _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/official-cost-payments',
            headers=accountant_hdr))['items']
        statuses = {row['id']: row['verification_status'] for row in claims}
        assert statuses[company_claim['id']] == 'pending'
        assert statuses[pending_id] == 'pending'
        assert statuses[rejected_id] == 'rejected'

    def test_land_document_cost_is_company_paid_and_never_deducted(
            self, client, admin_hdr, agent_hdr, accountant_hdr, tmp_path, monkeypatch, no_email):
        """The Service shown in Transaction details drives automatic confirmation."""
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        emp = _agent()
        land = _txn(emp, week + timedelta(days=1), price=1000, cost=400,
                    service_name='Land Document')
        ordinary = _txn(emp, week + timedelta(days=2), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        # A legacy verified personal claim on a Land Document cost is ignored.
        legacy = _claim_row(report, land, personal=True, verified=True, amount=400)
        db.session.commit()

        calc = svc.build_calculation(WeeklyReport.query.get(report.id))
        land_row = next(row for row in calc['transactions'] if row['id'] == land.id)
        assert land_row['company_funded'] is True
        assert land_row['official_cost_payment_source'] == 'company'
        assert land_row['personal_payment'] is False
        calc_claim = next(row for row in calc['official_cost_payments']
                          if row['id'] == legacy.id)
        assert calc_claim['payment_source'] == 'company'
        assert calc_claim['personal_payment'] is False
        assert calc_claim['auto_company_funded'] is True
        assert calc['components']['verified_service_costs'] == '0.00'
        assert calc['components']['expected_remittance'] == '2000.00'

        # Even a freshly submitted personal answer is auto-confirmed as company.
        response = _claim_api(client, agent_hdr, report, ordinary, reference='WKP-LD-NORMAL')
        assert response.status_code == 201, response.get_data(as_text=True)
        assert response.get_json()['claim']['verification_status'] == 'pending'

        assert _submit(client, agent_hdr, report.id).status_code == 200
        c = _components(client, accountant_hdr, report.id)
        assert c['verified_service_costs'] == '0.00'
        assert c['expected_remittance'] == '2000.00'

        assert _review(client, accountant_hdr, report.id, 'verify_cost_payment',
                       claim_id=legacy.id, note='Should be refused').status_code == 409
        listing = _assert_ok(client.get(
            f'/api/weekly-reports/{report.id}/official-cost-payments',
            headers=accountant_hdr))
        assert listing['verified_total'] == '0.00'
        ld_claim = next(row for row in listing['items'] if row['id'] == legacy.id)
        assert ld_claim['payment_source'] == 'company'
        assert ld_claim['personal_payment'] is False
        assert ld_claim['auto_company_funded'] is True

        summary = _detail(client, agent_hdr, report.id)['summary']
        ld_cost = next(row for row in summary['official_costs']
                       if row['transaction_id'] == land.id)
        assert ld_cost['company_funded'] is True
        assert ld_cost['payment_source'] == 'company'
        assert ld_cost['verified_amount'] == '0.00'
        assert summary['company_paid'] == '400.00'
        assert summary['personal_paid_verified'] == '0.00'

        export_rows = _official_cost_rows(
            svc.calculation_view(WeeklyReport.query.get(report.id)), 'en')
        exported_land = next(row for row in export_rows[1:]
                             if row[0] == land.transaction_number)
        assert 'AfriTech Bridge' in exported_land[3]
        assert exported_land[8] == '0.00'

    def test_partial_claim_and_duplicate_protection(
            self, client, admin_hdr, agent_hdr, accountant_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        emp = _agent()
        first = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        second = _txn(emp, week + timedelta(days=2), price=800, cost=300)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        partial = _claim_api(client, agent_hdr, report, first, amount=150,
                             reference='WKP-PARTIAL')
        assert partial.status_code == 201, partial.get_data(as_text=True)
        assert partial.get_json()['claim']['is_partial'] is True
        duplicate_txn = _claim_api(client, agent_hdr, report, first,
                                   reference='WKP-OTHER', amount=200)
        assert duplicate_txn.status_code == 409
        duplicate_ref = _claim_api(client, agent_hdr, report, second,
                                   reference='WKP-PARTIAL', amount=100)
        assert duplicate_ref.status_code == 409
        over_cost = _claim_api(client, agent_hdr, report, second,
                               reference='WKP-OVER', amount=301)
        assert over_cost.status_code == 400

        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'verify_cost_payment',
                    claim_id=partial.get_json()['claim']['id'], note='Partial provider settlement')
        assert r.status_code == 200, r.get_data(as_text=True)
        c = _components(client, accountant_hdr, report.id)
        assert c['verified_service_costs'] == '150.00'
        # Collections are 1000 + 800 = 1800; only the verified 150 is credited.
        assert c['expected_remittance'] == '1650.00'

    def test_claim_validation_and_evidence_permissions(
            self, client, admin_hdr, agent_hdr, accountant_hdr, manager_hdr,
            tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        outside = _txn(emp, week - timedelta(days=1), price=500, cost=100)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        no_evidence = client.post(
            f'/api/weekly-reports/{report.id}/official-cost-payments', headers=agent_hdr,
            data={'transaction_id': txn.id, 'personal_payment': 'true', 'amount': '400',
                  'provider': 'momo', 'reference': 'WKP-NOEVID',
                  'sender_phone': '+250788111222', 'paid_at': week.isoformat()},
            content_type='multipart/form-data')
        assert no_evidence.status_code == 400
        assert no_evidence.get_json()['code'] == 'weekly_report.claim_evidence_required'
        assert _claim_api(client, agent_hdr, report, txn, amount=401,
                          reference='WKP-OVER').status_code == 400
        assert _claim_api(client, agent_hdr, report, txn, reference='WKP-BADPROV',
                          provider='wire').status_code == 400
        assert _claim_api(client, agent_hdr, report, txn, reference='WKP-OUTDATE',
                          paid_at=(week + timedelta(days=7)).isoformat()).status_code == 400
        assert _claim_api(client, agent_hdr, report, outside,
                          reference='WKP-OUTSIDE').status_code == 404

        claim = _claim_api(client, agent_hdr, report, txn, reference='WKP-EVIDENCE')
        assert claim.status_code == 201, claim.get_data(as_text=True)
        url = (f'/api/weekly-reports/{report.id}/official-cost-payments/'
               f'{claim.get_json()["claim"]["id"]}/evidence')
        assert client.get(url, headers=agent_hdr).data.startswith(b'%PDF')
        assert client.get(url, headers=accountant_hdr).status_code == 200
        assert client.get(url, headers=manager_hdr).status_code == 403
        secretary = _hdr(client, 'secretary@afritech.dev')
        assert client.get(url, headers=secretary).status_code == 403
        assert client.get(f'/api/weekly-reports/{report.id}/official-cost-payments',
                          headers=secretary).status_code == 403
        assert client.post(f'/api/weekly-reports/{report.id}/official-cost-payments',
                           headers=secretary, json={}).status_code == 403


class TestMoMo:
    def test_add_multiple_submissions_and_mask_phones(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        one = _momo(client, agent_hdr, report.id, reference='wkm-one', amount=100,
                    confirmation_code='CONF-1')
        two = _momo(client, agent_hdr, report.id, reference='WKM-TWO', amount=250,
                    provider='bank_transfer')
        assert one['reference'] == 'WKM-ONE' and one['provider'] == 'momo'
        assert one['sender_phone'] == '+250******456'
        assert one['recipient_phone'] == '+250******321'
        assert one['confirmation_code'] == 'CONF-1'
        assert two['provider'] == 'bank_transfer'
        assert _components(client, agent_hdr, report.id)['agent_reported_submitted'] == '350.00'
        assert _components(client, agent_hdr, report.id)['verified_submitted'] == '0.00'

    def test_duplicate_reference_rejected(self, client, admin_hdr, agent_hdr):
        first = _generate(client, admin_hdr)
        second = _generate(client, admin_hdr)
        _momo(client, agent_hdr, first.id, reference='WKM-DUP', amount=100)
        r = client.post(f'/api/weekly-reports/{second.id}/momo', headers=agent_hdr,
                        json={'reference': 'wkm-dup', 'amount': 50})
        assert r.status_code == 409
        assert r.get_json()['code'] == 'weekly_report.duplicate_reference'

    def test_evidence_is_not_provider_confirmation(self, client, admin_hdr, agent_hdr,
                                                    accountant_hdr, tmp_path, monkeypatch):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        report = _generate(client, admin_hdr)
        evidence = (io.BytesIO(b'%PDF-1.4\nevidence'), 'momo.png')
        r = client.post(f'/api/weekly-reports/{report.id}/momo', headers=agent_hdr,
                        data={'reference': 'WKM-EVIDENCE', 'amount': '200',
                              'provider': 'momo', 'confirmation_code': '',
                              'evidence': evidence},
                        content_type='multipart/form-data')
        assert r.status_code == 201, r.get_data(as_text=True)
        sub = r.get_json()['submission']
        assert sub['verification_status'] == 'pending' and sub['evidence_path']
        assert _components(client, agent_hdr, report.id)['agent_reported_submitted'] == '200.00'
        assert _components(client, agent_hdr, report.id)['verified_submitted'] == '0.00'
        assert _submit(client, agent_hdr, report.id).status_code == 200
        assert _components(client, accountant_hdr, report.id)['verified_submitted'] == '0.00'
        r = _review(client, accountant_hdr, report.id, 'verify_momo', momo_id=sub['id'],
                    note='Transfer confirmed in bank portal')
        assert r.status_code == 200, r.get_data(as_text=True)
        assert _components(client, accountant_hdr, report.id)['verified_submitted'] == '200.00'
        detail = _detail(client, accountant_hdr, report.id)
        assert detail['status'] == 'under_financial_review'
        assert detail['momo_submissions'][0]['verification_status'] == 'verified'
        assert detail['momo_submissions'][0]['verified_by'] == _user('accountant@afritech.dev').id

    def test_delete_only_while_editable(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        sub = _momo(client, agent_hdr, report.id, amount=100)
        url = f'/api/weekly-reports/{report.id}/momo/{sub["id"]}'
        assert client.delete(url, headers=agent_hdr).status_code == 200
        assert MoMoSubmission.query.get(sub['id']) is None
        sub = _momo(client, agent_hdr, report.id, reference='WKM-LOCK', amount=100)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        assert client.delete(f'/api/weekly-reports/{report.id}/momo/{sub["id"]}',
                             headers=agent_hdr).status_code == 409


class TestShortageSurplus:
    def test_shortage_requires_only_a_plain_reason_and_explanation(self, client, admin_hdr,
                                                                    agent_hdr):
        emp = _agent()
        week = _future_week()
        _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        url = f'/api/weekly-reports/{report.id}/submit'
        r = client.post(url, headers=agent_hdr, json={})
        assert r.status_code == 400
        assert r.get_json()['code'] == 'weekly_report.shortage_explanation'
        r = client.post(url, headers=agent_hdr,
                        json={'shortage_reason_category': 'customer_not_paid'})
        assert r.status_code == 400
        # Evidence and a resolution date may still be attached, but a short,
        # honest explanation is enough to submit an explained shortage.
        r = client.post(url, headers=agent_hdr, json={
            'shortage_reason_category': 'customer_not_paid',
            'shortage_explanation': 'Customer has not paid yet',
        })
        assert r.status_code == 200, r.get_data(as_text=True)
        assert WeeklyReport.query.get(report.id).status == 'submitted'

    def test_shortage_with_evidence_and_resolution_date(self, client, admin_hdr, agent_hdr,
                                                        tmp_path, monkeypatch):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)
        db.session.commit()
        evidence = (io.BytesIO(b'%PDF-1.4\nshortage'), 'proof.pdf')
        r = client.post(f'/api/weekly-reports/{report.id}/submit', headers=agent_hdr,
                        data={'shortage_reason_category': 'unrecorded_collection',
                              'shortage_explanation': 'Client paid at closing time',
                              'expected_resolution_date': (week + timedelta(days=9)).isoformat(),
                              'evidence': evidence},
                        content_type='multipart/form-data')
        assert r.status_code == 200, r.get_data(as_text=True)
        detail = r.get_json()['report']
        assert detail['shortage_amount'] == 600.0
        assert detail['shortage_evidence_name'] == 'proof.pdf'
        assert detail['expected_resolution_date'] == (week + timedelta(days=9)).isoformat()
        assert detail['shortage_explanation'] == 'Client paid at closing time'

    def test_authorized_override_allows_unexplained_shortage(self, client, admin_hdr,
                                                              agent_hdr, accountant_hdr):
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)
        db.session.commit()
        _authorize_override(report, _user('accountant@afritech.dev'))
        r = client.post(f'/api/weekly-reports/{report.id}/submit', headers=agent_hdr, json={})
        assert r.status_code == 200, r.get_data(as_text=True)
        body = r.get_json()['report']
        assert body['has_override'] is True and body['shortage_amount'] == 600.0
        assert body['override_authorized_by'] == _user('accountant@afritech.dev').id

    def test_surplus_after_verification(self, client, admin_hdr, agent_hdr, accountant_hdr):
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)
        db.session.commit()
        sub = _momo(client, agent_hdr, report.id, amount=900, reference='WKM-SURPLUS')
        assert _submit(client, agent_hdr, report.id).status_code == 200
        # Unverified submissions do not offset the shortage.
        before = _components(client, accountant_hdr, report.id)
        assert before['agent_reported_submitted'] == '900.00'
        assert before['verified_submitted'] == '0.00'
        assert before['shortage_amount'] == '600.00'
        r = _review(client, accountant_hdr, report.id, 'verify_momo', momo_id=sub['id'])
        assert r.status_code == 200, r.get_data(as_text=True)
        c = _components(client, accountant_hdr, report.id)
        assert c['verified_submitted'] == '900.00'
        assert c['expected_remittance'] == '600.00'
        assert c['surplus_amount'] == '300.00'
        assert c['shortage_amount'] == '0.00'


class TestAdjustmentsCarryForward:
    def test_adjustment_api_has_full_audit_trail(self, client, admin_hdr, agent_hdr,
                                                  accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'authorized_receipt', 'label': 'Bank interest',
                              'original_amount': 0, 'adjusted_amount': 125,
                              'reason': 'Verified bank statement line 7'})
        assert r.status_code == 201, r.get_data(as_text=True)
        adj = r.get_json()['adjustment']
        assert adj['actor_email'] == 'accountant@afritech.dev'
        assert adj['created_at'] and adj['reason'] == 'Verified bank statement line 7'
        assert r.get_json()['report']['authorized_receipts'] == 125.0
        log = AuditLog.query.filter_by(action='weekly_report_adjustment_recorded',
                                       entity_id=str(adj['id'])).first()
        assert log is not None and log.user_email == 'accountant@afritech.dev'
        assert json.loads(log.new_value)['adjusted_amount'] == 125.0
        audit_items = _assert_ok(client.get(f'/api/weekly-reports/{report.id}/audit',
                                            headers=accountant_hdr))['items']
        assert any(row['entity'] == 'weekly_report_adjustment'
                   and row['entity_id'] == str(adj['id']) for row in audit_items)

        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'not_a_kind', 'adjusted_amount': 10, 'reason': 'a valid reason'})
        assert r.status_code == 400
        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'authorized_receipt', 'adjusted_amount': 10, 'reason': 'x'})
        assert r.status_code == 400

    def test_opening_outstanding_carried_once_with_allocation_history(self, client, admin_hdr):
        prior = _generate(client, admin_hdr)
        prior.status = 'approved'
        prior.closing_outstanding = 250
        db.session.commit()
        week = prior.week_start + timedelta(days=7)
        report = _generate(client, admin_hdr, _agent(), week)
        assert report.opening_outstanding == 250
        allocations = OutstandingAllocation.query.filter_by(report_id=report.id).all()
        assert len(allocations) == 1
        assert allocations[0].kind == 'carry_forward'
        assert allocations[0].source_report_id == prior.id
        assert allocations[0].to_dict()['actor_email'] == 'admin@afritech.dev'
        again = _generate(client, admin_hdr, _agent(), week)
        assert again.id == report.id
        assert OutstandingAllocation.query.filter_by(report_id=report.id).count() == 1
        assert svc.build_calculation(WeeklyReport.query.get(report.id))['components'][
            'opening_outstanding'] == '250.00'

    def test_waiver_and_correction_require_audited_allocation(self, client, admin_hdr,
                                                               agent_hdr, accountant_hdr):
        emp = _agent()
        week = _future_week()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)  # expected remittance 600
        db.session.commit()
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'outstanding_waiver', 'original_amount': 100,
                              'adjusted_amount': 0, 'reason': 'Waived after bank confirmation'})
        assert r.status_code == 201, r.get_data(as_text=True)
        report = WeeklyReport.query.get(report.id)
        assert report.closing_outstanding == 500
        waiver = OutstandingAllocation.query.filter_by(report_id=report.id,
                                                       kind='outstanding_waiver').first()
        assert waiver is not None and waiver.amount == -100
        assert waiver.to_dict()['actor_email'] == 'accountant@afritech.dev' and waiver.created_at

        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'outstanding_correction', 'original_amount': 0,
                              'adjusted_amount': 40, 'reason': 'Opening balance corrected'})
        assert r.status_code == 201, r.get_data(as_text=True)
        report = WeeklyReport.query.get(report.id)
        assert report.closing_outstanding == 540
        correction = OutstandingAllocation.query.filter_by(report_id=report.id,
                                                           kind='outstanding_correction').first()
        assert correction is not None and correction.amount == 40
        assert OutstandingAllocation.query.filter_by(report_id=report.id).count() == 2


class TestCarryForwardReconciliation:
    """A shortage must reach the next week even if that week was generated first."""

    def _shortage_report(self, client, admin_hdr, agent_hdr):
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)  # expected remittance = 600
        db.session.commit()
        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 200,
            'submission_funding_source': 'agent_phone',
        })
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        # The declared 200 clears the acknowledged balance, not the verified
        # shortage. What remains declared (400) is what carries forward.
        assert svc.calculation_view(report)['components'][
            'closing_outstanding'] == '400.00'
        return report

    def test_approving_after_next_generation_carries_shortage(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        prior = self._shortage_report(client, admin_hdr, agent_hdr)
        following = _generate(client, admin_hdr, _agent(),
                              prior.week_start + timedelta(days=7))
        assert following.opening_outstanding == 0

        approved = _review(client, accountant_hdr, prior.id, 'approve')
        assert approved.status_code == 200, approved.get_data(as_text=True)

        following = WeeklyReport.query.get(following.id)
        assert following.opening_outstanding == 400
        assert _components(client, admin_hdr, following.id)[
            'opening_outstanding'] == '400.00'
        carry = [a for a in following.allocations if a.kind == 'carry_forward']
        assert len(carry) == 1
        assert carry[0].source_report_id == prior.id
        assert carry[0].amount == 400

        # A second reconciliation must not duplicate rows or change the amount.
        svc._reconcile_forward(WeeklyReport.query.get(prior.id),
                               _user('accountant@afritech.dev'))
        db.session.commit()
        assert OutstandingAllocation.query.filter_by(
            report_id=following.id, kind='carry_forward').count() == 1
        assert WeeklyReport.query.get(following.id).opening_outstanding == 400

    def test_report_generated_after_approval_uses_carried_shortage(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        prior = self._shortage_report(client, admin_hdr, agent_hdr)
        assert _review(client, accountant_hdr, prior.id, 'approve').status_code == 200
        following = _generate(client, admin_hdr, _agent(),
                              prior.week_start + timedelta(days=7))
        assert following.opening_outstanding == 400
        carry = [a for a in following.allocations if a.kind == 'carry_forward']
        assert len(carry) == 1 and carry[0].source_report_id == prior.id
        assert carry[0].amount == 400

    def test_locked_following_report_is_not_rewritten(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        prior = self._shortage_report(client, admin_hdr, agent_hdr)
        following = _generate(client, admin_hdr, _agent(),
                              prior.week_start + timedelta(days=7))
        assert _submit(client, agent_hdr, following.id).status_code == 200
        frozen_snapshot = WeeklyReport.query.get(following.id).snapshot

        assert _review(client, accountant_hdr, prior.id, 'approve').status_code == 200
        following = WeeklyReport.query.get(following.id)
        assert following.opening_outstanding == 0
        assert following.snapshot == frozen_snapshot

    def test_next_week_separates_current_expected_from_carried_outstanding(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        prior = self._shortage_report(client, admin_hdr, agent_hdr)
        assert _review(client, accountant_hdr, prior.id, 'approve').status_code == 200

        week = prior.week_start + timedelta(days=7)
        _txn(_agent(), week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        response = client.post('/api/weekly-reports/agent-summary', headers=agent_hdr,
                               json={'week_start': week.isoformat()})
        assert response.status_code == 200, response.get_data(as_text=True)
        body = response.get_json()
        summary = body['summary']
        assert summary['previous_outstanding'] == '400.00'
        assert summary['week_expected_amount'] == '1000.00'
        assert summary['money_to_submit'] == '1400.00'
        assert summary['expected_amount'] == '1400.00'
        selected = [row for row in body['weeks'] if row['selected']][0]
        assert selected['previous_outstanding'] == '400.00'
        assert selected['money_to_submit'] == '1400.00'

    def test_submitted_week_explains_remaining_money_before_and_after_verification(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)  # expected remittance = 600
        transfer = _momo(client, agent_hdr, report.id, amount=200)
        db.session.commit()
        assert _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 200,
            'submission_funding_source': 'agent_phone',
        }).status_code == 200

        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['money_to_submit'] == '600.00'
        assert summary['declared_amount'] == '200.00'
        assert summary['remaining_after_declaration'] == '400.00'
        # A declaration is not evidence: nothing has cleared the verified gap,
        # but the acknowledged remaining balance is what moves to next week.
        assert summary['remaining_after_verification'] == '600.00'
        assert summary['carry_forward_amount'] == '400.00'
        assert summary['carry_forward_amount'] == summary['remaining_after_declaration']

        verified = _review(client, accountant_hdr, report.id, 'verify_momo',
                           momo_id=transfer['id'])
        assert verified.status_code == 200, verified.get_data(as_text=True)
        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['remaining_after_declaration'] == '400.00'
        assert summary['remaining_after_verification'] == '400.00'
        assert summary['carry_forward_amount'] == '400.00'

    def test_carry_uses_declared_remaining_not_total_to_submit(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        prior = self._shortage_report(client, admin_hdr, agent_hdr)
        assert _review(client, accountant_hdr, prior.id, 'approve').status_code == 200

        week = prior.week_start + timedelta(days=7)
        week_txn = _txn(_agent(), week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, _agent(), week)
        _claim_row(report, week_txn, verified=True)  # this week's own expected = 600
        db.session.commit()
        components = _components(client, admin_hdr, report.id)
        assert components['opening_outstanding'] == '400.00'
        assert components['week_expected_amount'] == '600.00'
        assert components['money_to_submit'] == '1000.00'

        # The agent declares part of the 1,000 due. Next week must receive the
        # 750 still outstanding, not the full 1,000 that was due this week.
        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 250,
            'submission_funding_source': 'agent_phone',
        })
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['money_to_submit'] == '1000.00'
        assert summary['remaining_after_declaration'] == '750.00'
        assert summary['carry_forward_amount'] == '750.00'

        assert _review(client, accountant_hdr, report.id, 'approve').status_code == 200
        following = _generate(client, admin_hdr, _agent(), week + timedelta(days=7))
        assert following.opening_outstanding == 750

    def test_verification_above_declaration_reduces_carry(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)  # expected remittance = 600
        transfer = _momo(client, agent_hdr, report.id, amount=500)
        db.session.commit()
        assert _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 200,
            'submission_funding_source': 'agent_phone',
        }).status_code == 200

        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['remaining_after_declaration'] == '400.00'
        assert summary['remaining_after_verification'] == '600.00'
        assert summary['carry_forward_amount'] == '400.00'

        verified = _review(client, accountant_hdr, report.id, 'verify_momo',
                           momo_id=transfer['id'])
        assert verified.status_code == 200, verified.get_data(as_text=True)
        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['remaining_after_declaration'] == '400.00'
        assert summary['remaining_after_verification'] == '100.00'
        assert summary['carry_forward_amount'] == '100.00'

    def test_snapshot_without_declaration_marker_keeps_verified_only_rule(
            self, client, admin_hdr, agent_hdr):
        report = self._shortage_report(client, admin_hdr, agent_hdr)
        stored = WeeklyReport.query.get(report.id)
        snapshot = json.loads(stored.snapshot)
        snapshot['declaration'].pop('declared_submission', None)
        snapshot['components']['closing_outstanding'] = '600.00'
        stored.snapshot = json.dumps(snapshot)
        db.session.commit()

        # A historical snapshot is not silently reinterpreted after deployment.
        assert svc.calculation_view(WeeklyReport.query.get(report.id))[
            'components']['closing_outstanding'] == '600.00'

    def test_unverified_transfer_does_not_clear_declared_carry(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        report = _generate(client, admin_hdr, emp, week)
        _claim_row(report, txn, verified=True)  # expected remittance = 600
        transfer = _momo(client, agent_hdr, report.id, amount=300)
        db.session.commit()
        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 0,
            'submission_funding_source': 'agent_phone',
            'shortage_reason_category': 'customer_not_paid',
            'shortage_explanation': 'Customer has not paid yet',
        }, override=False)
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        # Declaring zero is still an explicit declaration: the frozen marker
        # must survive even though the amount itself is zero.
        snapshot = json.loads(WeeklyReport.query.get(report.id).snapshot)
        assert snapshot['declaration']['declared_submission'] is True

        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['agent_reported_submitted'] == '300.00'
        assert summary['remaining_after_declaration'] == '600.00'
        assert summary['remaining_after_verification'] == '600.00'
        assert summary['carry_forward_amount'] == '600.00'

        rejected = _review(client, accountant_hdr, report.id, 'reject_momo',
                           momo_id=transfer['id'], reason='Receipt not found')
        assert rejected.status_code == 200, rejected.get_data(as_text=True)
        summary = _detail(client, admin_hdr, report.id)['summary']
        assert summary['carry_forward_amount'] == '600.00'


class TestRBACSecurity:
    def test_agent_is_scoped_to_own_report(self, client, admin_hdr, agent_hdr):
        mine = _generate(client, admin_hdr, _agent())
        other = _generate(client, admin_hdr, _agent2())
        for method in ('get', 'patch'):
            r = getattr(client, method)(f'/api/weekly-reports/{other.id}', headers=agent_hdr,
                                        json={} if method == 'patch' else None)
            assert r.status_code == 403
        assert client.post(f'/api/weekly-reports/{other.id}/submit',
                           headers=agent_hdr, json={}).status_code == 403
        assert client.post(f'/api/weekly-reports/{other.id}/momo', headers=agent_hdr,
                           json={'reference': 'WKM-FORBIDDEN', 'amount': 10}).status_code == 403
        assert client.get(f'/api/weekly-reports/{other.id}/export?format=pdf',
                          headers=agent_hdr).status_code == 403
        r = _assert_ok(client.get('/api/weekly-reports', headers=agent_hdr))
        assert mine.id in {row['id'] for row in r['items']}
        assert other.id not in {row['id'] for row in r['items']}

    def test_manager_is_branch_scoped(self, client, admin_hdr, manager_hdr):
        manager_emp = _user('manager@afritech.dev').employee
        current = week_bounds(date.today())[0]
        own = _generate(client, admin_hdr, manager_emp, current)
        other = _generate(client, admin_hdr, _agent(), current)
        own.status = other.status = 'submitted'
        db.session.commit()

        assert client.get(f'/api/weekly-reports/{own.id}', headers=manager_hdr).status_code == 200
        assert client.get(f'/api/weekly-reports/{other.id}', headers=manager_hdr).status_code == 403
        queue = _assert_ok(client.get('/api/weekly-reports/queue', headers=manager_hdr))
        ids = {row['id'] for row in queue['items']}
        assert own.id in ids and other.id not in ids
        listing = _assert_ok(client.get('/api/weekly-reports', headers=manager_hdr))
        assert own.id in {row['id'] for row in listing['items']}
        assert other.id not in {row['id'] for row in listing['items']}
        weeks = _assert_ok(client.get('/api/weekly-reports/weeks', headers=manager_hdr))['weeks']
        assert weeks[0]['week_start'] == current.isoformat()
        assert weeks[0]['report_count'] == 1
        admin_weeks = _assert_ok(client.get('/api/weekly-reports/weeks',
                                            headers=admin_hdr))['weeks']
        assert admin_weeks[0]['report_count'] == 2

    def test_company_secretary_has_no_weekly_access(self, client, admin_hdr, no_email):
        secretary = _hdr(client, 'secretary@afritech.dev')
        report = _generate(client, admin_hdr)
        paths = [
            '/api/weekly-reports', '/api/weekly-reports/policy',
            '/api/weekly-reports/weeks', '/api/weekly-reports/queue',
            f'/api/weekly-reports/{report.id}',
            f'/api/weekly-reports/{report.id}/transactions?search=test',
            f'/api/weekly-reports/{report.id}/daily-closings',
            f'/api/weekly-reports/{report.id}/expenses',
            f'/api/weekly-reports/{report.id}/audit',
            f'/api/weekly-reports/{report.id}/official-cost-payments',
            f'/api/weekly-reports/{report.id}/official-cost-payments/1/evidence',
            f'/api/weekly-reports/{report.id}/evidence',
            f'/api/weekly-reports/{report.id}/export?format=pdf',
            f'/api/weekly-reports/{report.id}/export?format=xlsx',
        ]
        for path in paths:
            assert client.get(path, headers=secretary).status_code == 403, path
        writes = [
            client.post('/api/weekly-reports/generate', headers=secretary,
                        json={'employee_id': _agent().id,
                              'week_start': _future_week().isoformat()}),
            client.post(f'/api/weekly-reports/{report.id}/review', headers=secretary,
                        json={'action': 'approve'}),
            client.post(f'/api/weekly-reports/{report.id}/momo', headers=secretary,
                        json={'reference': 'WKM-SECRETARY', 'amount': 10}),
            client.post(f'/api/weekly-reports/{report.id}/override', headers=secretary,
                        json={'reason': 'Not allowed'}),
            client.post(f'/api/weekly-reports/{report.id}/adjustments', headers=secretary,
                        json={'kind': 'authorized_receipt', 'reason': 'Not allowed',
                              'original_amount': 0, 'adjusted_amount': 10}),
            client.post(f'/api/weekly-reports/{report.id}/official-cost-payments',
                        headers=secretary, json={}),
            client.delete(f'/api/weekly-reports/{report.id}/official-cost-payments/1',
                          headers=secretary),
            client.post(f'/api/weekly-reports/{report.id}/review', headers=secretary,
                        json={'action': 'verify_cost_payment', 'claim_id': 1}),
        ]
        assert all(r.status_code == 403 for r in writes)

        secretary_id = _user('secretary@afritech.dev').id
        assert ns.notify(secretary_id, 'weekly_report_submitted',
                         'Secretary must never receive this') is None
        assert Notification.query.filter_by(
            recipient_id=secretary_id, type='weekly_report_submitted').count() == 0

    def test_agent_cannot_use_reviewer_or_adjust_endpoints(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        forbidden = [
            client.post(f'/api/weekly-reports/{report.id}/review', headers=agent_hdr,
                        json={'action': 'approve'}),
            client.post(f'/api/weekly-reports/{report.id}/adjustments', headers=agent_hdr,
                        json={'kind': 'authorized_receipt', 'adjusted_amount': 10,
                              'reason': 'should be forbidden'}),
            client.post(f'/api/weekly-reports/{report.id}/override', headers=agent_hdr,
                        json={'reason': 'should be forbidden'}),
            client.post(f'/api/weekly-reports/{report.id}/missing-closings/override',
                        headers=agent_hdr, json={'reason': 'should be forbidden'}),
        ]
        assert all(r.status_code == 403 for r in forbidden)
        assert client.post(f'/api/weekly-reports/{report.id}/submit',
                           headers=_hdr(client, 'accountant@afritech.dev'), json={}).status_code == 403

    def test_unknown_and_cross_branch_reports_do_not_leak(self, client, admin_hdr, agent_hdr):
        other = _generate(client, admin_hdr, _agent2())
        missing = client.get('/api/weekly-reports/999999', headers=admin_hdr)
        assert missing.status_code == 404
        denied = client.get(f'/api/weekly-reports/{other.id}', headers=agent_hdr)
        assert denied.status_code == 403
        assert other.report_number not in denied.get_data(as_text=True)
        assert client.get(f'/api/weekly-reports/{other.id}').status_code in (401, 403)

    def test_phone_numbers_masked_in_all_calculation_views(self, client, admin_hdr, agent_hdr,
                                                            accountant_hdr):
        report = _generate(client, admin_hdr)
        _momo(client, agent_hdr, report.id)
        body = _detail(client, accountant_hdr, report.id)
        raw = json.dumps(body)
        assert '+250788123456' not in raw and '+250788654321' not in raw
        assert body['momo_submissions'][0]['sender_phone'] == '+250******456'
        assert body['calculation']['momo_submissions'][0]['recipient_phone'] == '+250******321'


class TestNotificationsAudit:
    def test_generation_notifies_owner_and_creates_audit(self, client, admin_hdr, accountant_hdr,
                                                          no_email):
        report = _generate(client, admin_hdr)
        agent_id = _user('agent@afritech.dev').id
        notification = Notification.query.filter_by(
            type='weekly_report_generated', related_type='weekly_report',
            related_id=report.id, recipient_id=agent_id).first()
        assert notification is not None
        assert report.period_label in notification.message
        assert notification.created_by_rule == 'weekly-report-generation'
        assert AuditLog.query.filter_by(action='weekly_report_generated',
                                        entity_id=str(report.id)).first() is not None
        audit_items = _assert_ok(client.get(f'/api/weekly-reports/{report.id}/audit',
                                            headers=accountant_hdr))['items']
        assert any(row['action'] == 'weekly_report_generated' for row in audit_items)

    def test_submission_notifies_reviewers_on_shortage_and_acknowledges_agent(
            self, client, admin_hdr, agent_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        emp = _agent()
        week = _future_week()
        _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        r = client.post(f'/api/weekly-reports/{report.id}/submit', headers=agent_hdr,
                        data={'shortage_reason_category': 'cash_count_error',
                              'shortage_explanation': 'Cash counted twice',
                              'expected_resolution_date': (week + timedelta(days=9)).isoformat(),
                              'evidence': (io.BytesIO(b'%PDF-1.4\nshortage'), 'proof.pdf')},
                        content_type='multipart/form-data')
        assert r.status_code == 200, r.get_data(as_text=True)

        by_user = {}
        for row in Notification.query.filter_by(related_type='weekly_report',
                                                related_id=report.id).all():
            by_user.setdefault(row.recipient_id, set()).add(row.type)
        agent_id = _user('agent@afritech.dev').id
        manager_id = _user('manager@afritech.dev').id
        admin_id = _user('admin@afritech.dev').id
        accountant_id = _user('accountant@afritech.dev').id
        secretary_id = _user('secretary@afritech.dev').id
        assert 'weekly_report_submitted_ack' in by_user[agent_id]
        # The seeded Manager is in another branch, so branch scoping suppresses
        # both the submission and the shortage amount from that notification.
        assert manager_id not in by_user
        assert 'weekly_report_submitted' in by_user[admin_id]
        assert 'weekly_report_shortage' in by_user[admin_id]
        assert 'weekly_report_submitted' in by_user[accountant_id]
        assert 'weekly_report_shortage' in by_user[accountant_id]
        assert secretary_id not in by_user
        shortage = Notification.query.filter_by(
            type='weekly_report_shortage', related_id=report.id,
            recipient_id=accountant_id).first()
        assert shortage.severity == 'critical'

    def test_review_decisions_notify_agent_and_are_audited(self, client, admin_hdr, agent_hdr,
                                                           accountant_hdr, no_email):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'request_correction',
                    reason='Attach the supporting receipt')
        assert r.status_code == 200, r.get_data(as_text=True)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'approve', reason='matched')
        assert r.status_code == 200, r.get_data(as_text=True)

        agent_id = _user('agent@afritech.dev').id
        types = {row.type for row in Notification.query.filter_by(
            recipient_id=agent_id, related_type='weekly_report', related_id=report.id).all()}
        assert {'weekly_report_returned', 'weekly_report_approved'} <= types
        actions = {row.action for row in AuditLog.query.filter_by(
            entity='weekly_report', entity_id=str(report.id)).all()}
        assert {'weekly_report_submitted', 'weekly_report_returned_for_correction',
                'weekly_report_approved'} <= actions

        rejected = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, rejected.id).status_code == 200
        r = _review(client, accountant_hdr, rejected.id, 'reject', reason='duplicate transfer')
        assert r.status_code == 200, r.get_data(as_text=True)
        rejection = Notification.query.filter_by(
            type='weekly_report_rejected', recipient_id=agent_id,
            related_id=rejected.id).first()
        assert rejection is not None and rejection.severity == 'critical'

    def test_automation_due_and_late_alerts(self, client, admin_hdr, no_email):
        sunday = week_bounds(date(2031, 1, 15))[0]
        submission_day = sunday + timedelta(days=7)
        assert sunday.weekday() == 6 and submission_day.weekday() == 6
        assert week_for_submission(submission_day) == (sunday, sunday + timedelta(days=6))
        report = _generate(client, admin_hdr, _agent(), sunday)
        assert automation_service.weekly_report_due_alert(submission_day) >= 1
        db.session.commit()
        due = Notification.query.filter_by(type='weekly_report_due',
                                           related_id=report.id).first()
        assert due is not None and '17:00' in due.message
        assert automation_service.weekly_report_due_alert(submission_day) == 0

        past = _generate(client, admin_hdr, _agent(), _past_week())
        # Generation already flags historical weeks; put it back in draft so
        # the automation rule is the component under test here.
        past.status = 'draft'
        past.is_late = False
        db.session.commit()
        assert automation_service.weekly_report_late_alert(date.today()) >= 1
        db.session.commit()
        db.session.refresh(past)
        assert past.status == 'late' and past.is_late is True
        assert Notification.query.filter_by(type='weekly_report_late',
                                            related_id=past.id).first() is not None
        assert AuditLog.query.filter_by(action='weekly_report_marked_late',
                                        entity_id=str(past.id)).first() is not None

    def test_audit_endpoint_includes_momo_events_and_is_access_scoped(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        active = _generate(client, admin_hdr)
        other = _generate(client, admin_hdr, _agent2())
        _momo(client, agent_hdr, active.id, reference='WKM-AUDIT', amount=100)
        assert _submit(client, agent_hdr, active.id).status_code == 200
        items = _assert_ok(client.get(f'/api/weekly-reports/{active.id}/audit',
                                      headers=accountant_hdr))['items']
        actions = {row['action'] for row in items}
        assert {'weekly_report_generated', 'weekly_momo_submitted',
                'weekly_report_submitted'} <= actions
        assert all(row.get('entity_id') != str(other.id) for row in items)
        assert client.get(f'/api/weekly-reports/{other.id}/audit',
                          headers=agent_hdr).status_code == 403


class TestExports:
    def test_pdf_export_is_attachment_with_pdf_mime(self, client, admin_hdr, agent_hdr,
                                                    accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = client.get(f'/api/weekly-reports/{report.id}/export?format=pdf',
                       headers=accountant_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.content_type == 'application/pdf'
        assert r.data.startswith(b'%PDF')
        assert 'attachment' in r.headers['Content-Disposition']
        assert report.report_number in r.headers['Content-Disposition']

    def test_xlsx_export_contains_21_statement_rows_and_localised_labels(
            self, client, admin_hdr, agent_hdr, accountant_hdr):
        from openpyxl import load_workbook

        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = client.get(f'/api/weekly-reports/{report.id}/export?format=xlsx&lang=rw',
                       headers=accountant_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        assert r.content_type == 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        wb = load_workbook(io.BytesIO(r.data), read_only=True, data_only=True)
        assert wb.sheetnames[0] == 'Weekly Report'
        statement = [row for row in wb.worksheets[0].iter_rows(values_only=True)
                     if isinstance(row[0], int)]
        assert [row[0] for row in statement] == list(range(1, 22))
        assert any('raporo' in str(row[1]).lower() for row in statement)
        components = [str(row[0]) for row in wb.worksheets[1].iter_rows(values_only=True)]
        assert 'expected_remittance' in components and 'shortage_amount' in components

    def test_exports_carry_bilingual_personal_cost_evidence(
            self, client, admin_hdr, agent_hdr, accountant_hdr, tmp_path, monkeypatch, no_email):
        from openpyxl import load_workbook
        from app.services import weekly_exports

        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        txn = _txn(_agent(), week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, txn.employee, week)
        claim = _claim_api(client, agent_hdr, report, txn, amount=150,
                           reference='WKP-EXPORT')
        assert claim.status_code == 201, claim.get_data(as_text=True)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        reviewed = _review(client, accountant_hdr, report.id, 'verify_cost_payment',
                           claim_id=claim.get_json()['claim']['id'],
                           note='Receipt matched <receipt.pdf>')
        assert reviewed.status_code == 200, reviewed.get_data(as_text=True)

        for lang, expected in (('en', 'Yes (Partial)'), ('rw', 'Yego (Igice gusa)')):
            response = client.get(f'/api/weekly-reports/{report.id}/export?format=xlsx&lang={lang}',
                                  headers=accountant_hdr)
            assert response.status_code == 200, response.get_data(as_text=True)
            wb = load_workbook(io.BytesIO(response.data), read_only=True, data_only=True)
            costs = wb.worksheets[2]
            values = [str(cell) for row in costs.iter_rows(values_only=True) for cell in row
                      if cell is not None]
            assert any(expected in value for value in values)
            assert any('WKP-EXPORT' in value for value in values)
            assert any('cost-proof.pdf' in value for value in values)
            assert any('Receipt matched' in value for value in values)
            assert any('150.0' in value for value in values)
            # Only the masked phone and the deductible amount are exported.
            assert not any('+250788111222' in value for value in values)
            assert not any('weekly_reports/' in value for value in values)

        calc = svc.calculation_view(WeeklyReport.query.get(report.id))
        rows = weekly_exports._official_cost_rows(calc, 'en')
        joined = str(rows)
        assert '&lt;receipt.pdf&gt;' in joined and '<receipt.pdf>' not in joined
        assert rows[1][-1] == '150.0'

        pdf = client.get(f'/api/weekly-reports/{report.id}/export?format=pdf&lang=rw',
                         headers=accountant_hdr)
        assert pdf.status_code == 200 and pdf.data.startswith(b'%PDF')

    def test_export_permissions_and_validation(self, client, admin_hdr, agent_hdr, accountant_hdr):
        mine = _generate(client, admin_hdr)
        other = _generate(client, admin_hdr, _agent2())
        base = f'/api/weekly-reports/{mine.id}/export'
        assert client.get(base, headers=agent_hdr).status_code == 200
        assert client.get(base, headers=accountant_hdr).status_code == 200
        assert client.get(f'/api/weekly-reports/{other.id}/export',
                          headers=agent_hdr).status_code == 403
        assert client.get(base).status_code in (401, 403)
        invalid = client.get(base + '?format=csv', headers=accountant_hdr)
        assert invalid.status_code == 400
        fallback = client.get(base + '?format=xlsx&lang=xx', headers=accountant_hdr)
        assert fallback.status_code == 200
        from openpyxl import load_workbook
        wb = load_workbook(io.BytesIO(fallback.data), read_only=True, data_only=True)
        assert wb.worksheets[0]['A1'].value == 'Weekly Service Agent Financial Report'


class TestEndToEndWorkflow:
    def test_generate_claim_submit_review_approve_and_export(
            self, client, admin_hdr, agent_hdr, accountant_hdr,
            tmp_path, monkeypatch, no_email):
        """One continuous agent-to-approval flow through the real HTTP API."""
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=3), price=1000, cost=400)
        db.session.commit()

        creation = client.post(
            '/api/weekly-reports/generate', headers=admin_hdr,
            json={'employee_id': emp.id, 'week_start': week.isoformat()})
        assert creation.status_code == 201, creation.get_data(as_text=True)
        generated = creation.get_json()
        report_id = generated['report']['id']
        assert date.fromisoformat(generated['report']['week_start']) == week
        assert date.fromisoformat(generated['report']['week_end']) == week + timedelta(days=6)
        assert generated['report']['status'] == 'draft'
        weekdays = [day['date'] for day in generated['report']['calculation']['daily_closings']]
        assert len(weekdays) == 7

        claim = _claim_api(client, agent_hdr, WeeklyReport.query.get(report_id), txn,
                           reference='WKP-E2E')
        assert claim.status_code == 201, claim.get_data(as_text=True)
        claim_id = claim.get_json()['claim']['id']
        transfer = _momo(client, agent_hdr, report_id, reference='WKM-E2E', amount=600)

        submitted = _assert_ok(_submit(client, agent_hdr, report_id))
        assert submitted['report']['status'] == 'submitted'
        frozen_snapshot = WeeklyReport.query.get(report_id).snapshot
        assert json.loads(frozen_snapshot)['components']['verified_service_costs'] == '0.00'

        assert _review(client, accountant_hdr, report_id, 'verify_cost_payment',
                       claim_id=claim_id, note='Own-funds receipt confirmed').status_code == 200
        assert _review(client, accountant_hdr, report_id, 'verify_momo',
                       momo_id=transfer['id'], note='Transfer confirmed').status_code == 200
        approved = _assert_ok(_review(client, accountant_hdr, report_id, 'approve',
                                      reason='All amounts reconciled'))
        assert approved['report']['status'] == 'approved'

        components = approved['report']['calculation']['components']
        assert components['pre_personal_cost_expected'] == '1000.00'
        assert components['verified_service_costs'] == '400.00'
        assert components['expected_remittance'] == '600.00'
        assert components['verified_submitted'] == '600.00'
        assert components['shortage_amount'] == '0.00'
        assert components['closing_outstanding'] == '0.00'
        # Approval records the final carry-forward once; every other source
        # fact remains exactly as it was frozen at submission.
        submitted_snapshot = json.loads(frozen_snapshot)
        approved_snapshot = json.loads(WeeklyReport.query.get(report_id).snapshot)
        submitted_components = dict(submitted_snapshot.pop('components'))
        approved_components = dict(approved_snapshot.pop('components'))
        assert submitted_snapshot == approved_snapshot
        assert approved_components.pop('closing_outstanding') == '0.00'
        submitted_components.pop('closing_outstanding')
        assert approved_components == submitted_components
        final_snapshot = WeeklyReport.query.get(report_id).snapshot

        detail = _detail(client, accountant_hdr, report_id)
        assert detail['cost_payment_claims'][0]['verification_status'] == 'verified'
        audit = _assert_ok(client.get(f'/api/weekly-reports/{report_id}/audit',
                                      headers=accountant_hdr))['items']
        assert {row['action'] for row in audit} >= {
            'weekly_report_generated', 'weekly_cost_payment_submitted',
            'weekly_cost_payment_verified', 'weekly_momo_verified',
            'weekly_report_approved',
        }
        for fmt in ('pdf', 'xlsx'):
            exported = client.get(f'/api/weekly-reports/{report_id}/export?format={fmt}',
                                  headers=accountant_hdr)
            assert exported.status_code == 200, exported.get_data(as_text=True)
            assert WeeklyReport.query.get(report_id).snapshot == final_snapshot
        secretary = _hdr(client, 'secretary@afritech.dev')
        for path in (f'/api/weekly-reports/{report_id}',
                     f'/api/weekly-reports/{report_id}/official-cost-payments',
                     f'/api/weekly-reports/{report_id}/export'):
            assert client.get(path, headers=secretary).status_code == 403, path


class TestSundayWeekPolicy:
    def test_bounds_window_and_boundary_timestamps(self):
        local = business_timezone()
        for day in range(7):
            date_in_week = date(2031, 1, 12) + timedelta(days=day)
            assert week_bounds(date_in_week) == (date(2031, 1, 12), date(2031, 1, 18))
        sunday, saturday = week_bounds(date(2031, 1, 15))
        assert (sunday.weekday(), saturday.weekday()) == (6, 5)
        assert week_end_for(sunday) == saturday
        assert week_window(sunday) == (
            datetime(2031, 1, 11, 22, tzinfo=timezone.utc),
            datetime(2031, 1, 18, 22, tzinfo=timezone.utc),
        )
        assert in_week(datetime(2031, 1, 18, 23, 59, 59, 999000, tzinfo=local), sunday)
        assert not in_week(datetime(2031, 1, 19, 0, 0, tzinfo=local), sunday)
        assert not in_week(datetime(2031, 1, 11, 23, 59, 59, tzinfo=local), sunday)
        assert in_week(saturday, sunday)

    def test_generation_normalizes_non_sunday_reference_dates(self, client, admin_hdr):
        monday = date(2031, 1, 13)
        legacy_saturday = date(2031, 1, 18)
        assert not is_valid_week_start(monday)
        with pytest.raises(WeekPolicyError):
            require_week_start(monday)
        assert normalize_week_start(monday) == date(2031, 1, 12)
        assert normalize_week_start(legacy_saturday) == date(2031, 1, 19)

        monday_report = _generate(client, admin_hdr, _agent(), monday)
        assert monday_report.week_start == date(2031, 1, 12)
        assert monday_report.week_end == date(2031, 1, 18)

        legacy_report = _generate(client, admin_hdr, _agent(), legacy_saturday)
        assert legacy_report.week_start == date(2031, 1, 19)
        assert legacy_report.week_end == date(2031, 1, 25)

    def test_weeks_endpoint_returns_sunday_saturday_pairs(self, client, agent_hdr):
        weeks = _assert_ok(client.get('/api/weekly-reports/weeks', headers=agent_hdr))['weeks']
        assert len(weeks) == 13
        assert all(date.fromisoformat(row['week_start']).weekday() == 6 for row in weeks)
        assert all(date.fromisoformat(row['week_end']).weekday() == 5 for row in weeks)
        assert all(date.fromisoformat(row['week_end']) ==
                   date.fromisoformat(row['week_start']) + timedelta(days=6) for row in weeks)


class TestPolicyI18n:
    def test_policy_endpoint_exposes_document_defaults(self, client, agent_hdr):
        body = _assert_ok(client.get('/api/weekly-reports/policy', headers=agent_hdr))
        assert set(DEFAULTS) <= set(body['policy'])
        assert body['policy']['timezone'] == 'Africa/Kigali'
        assert body['policy']['late_policy'] == 'allow_flagged'
        assert body['policy']['deduct_verified_service_costs'] is True
        assert body['policy']['commission_retained'] is False
        assert body['statuses'] == WEEKLY_REPORT_STATUSES
        assert body['shortage_reason_categories'] == SHORTAGE_REASON_CATEGORIES
        assert body['momo_providers'] == MOMO_PROVIDERS
        assert body['languages'] == ['en', 'rw']
        assert body['current_week'] == [d.isoformat() for d in week_bounds()]

    def test_settings_override_changes_week_deadline_and_expense_eligibility(
            self, client, admin_hdr, policy_override):
        policy_override('week_start_weekday', '0')
        policy_override('deadline_time', '09:30')
        policy_override('collection_funded_payment_methods', 'cash,momo')
        policy = get_policy()
        # The legal Sunday–Saturday window cannot be overridden by settings.
        assert (policy['week_start_weekday'], policy['week_end_weekday'],
                policy['submission_weekday']) == (6, 5, 6)
        assert policy['deadline_time'] == '09:30'
        assert policy['collection_funded_payment_methods'] == ['cash', 'momo']

        start, end = week_bounds(date(2031, 1, 15))
        assert start == date(2031, 1, 12) and end == start + timedelta(days=6)
        due = submission_deadline(start)
        assert due.astimezone(business_timezone()).date() == date(2031, 1, 19)
        assert (due.hour, due.minute) == (7, 30)  # Africa/Kigali is UTC+2

        emp = _agent()
        day = start + timedelta(days=1)
        _txn(emp, day, price=1000, cost=400)
        _expense(day, amount=250, code='momo', description='WKE-momo-funded')
        db.session.commit()
        report = _generate(client, admin_hdr, emp, start)
        assert report.due_at.replace(tzinfo=None) == due.replace(tzinfo=None)
        c = svc.build_calculation(WeeklyReport.query.get(report.id))['components']
        assert c['approved_collection_expenses'] == '250.00'

    def test_weeks_endpoint_lists_current_previous_and_history(self, client, admin_hdr, agent_hdr):
        current = week_bounds(date.today())[0]
        report = _generate(client, admin_hdr, _agent(), current)
        weeks = _assert_ok(client.get('/api/weekly-reports/weeks', headers=agent_hdr))['weeks']
        assert len(weeks) == 13
        assert [row['week_start'] for row in weeks] == [
            (current - timedelta(weeks=i)).isoformat() for i in range(13)]
        assert weeks[0]['report_count'] == 1
        assert sum(weeks[0]['status_counts'].values()) == 1
        assert weeks[0]['status_counts'][report.status] == 1
        assert weeks[1]['report_count'] == 0
        assert _assert_ok(client.get('/api/weekly-reports/weeks',
                                     headers=agent_hdr))['current']['week_start'] == current.isoformat()

    def test_statement_labels_are_bilingual_but_user_text_is_not_translated(
            self, client, admin_hdr):
        assert SUPPORTED_LANGUAGES == ('en', 'rw')
        assert normalize_language('fr') == 'en'
        assert t('status.submitted', 'rw') != t('status.submitted', 'en')
        message = bilingual('notification.submitted', period='2031-01-10', agent='Tester')
        assert ' / ' in message and 'Tester' in message

        report = _generate(client, admin_hdr)
        report.shortage_explanation = 'Cash counted twice'
        db.session.commit()
        svc.refresh(WeeklyReport.query.get(report.id))
        en_rows, _ = svc.statement_rows(WeeklyReport.query.get(report.id), 'en')
        rw_rows, _ = svc.statement_rows(WeeklyReport.query.get(report.id), 'rw')
        assert len(en_rows) == len(rw_rows) == 21
        assert [row['item'] for row in en_rows] == list(range(1, 22))
        assert [row['label'] for row in en_rows] != [row['label'] for row in rw_rows]
        assert all(row['label'] for row in en_rows + rw_rows)
        assert 'Cash counted twice' in en_rows[16]['value']
        assert 'Cash counted twice' in rw_rows[16]['value']

    def test_pdf_and_xlsx_carry_all_21_bilingual_statement_rows(
            self, client, admin_hdr, no_email, monkeypatch):
        from app.services import weekly_exports
        import reportlab.platypus as platypus
        from openpyxl import load_workbook

        report = _generate(client, admin_hdr)
        report.shortage_explanation = 'Counted twice'
        db.session.commit()
        fresh = WeeklyReport.query.get(report.id)
        svc.refresh(fresh)
        fresh = WeeklyReport.query.get(report.id)

        original_paragraph = platypus.Paragraph
        seen = []

        class RecordingParagraph(original_paragraph):
            def __init__(self, text, *args, **kwargs):
                seen.append(str(text))
                super().__init__(text, *args, **kwargs)

        monkeypatch.setattr(platypus, 'Paragraph', RecordingParagraph)

        for lang in ('en', 'rw'):
            rows, calc = svc.statement_rows(fresh, lang)
            assert len(rows) == 21

            seen.clear()
            pdf, mimetype = weekly_exports.export_pdf(fresh, rows, calc, lang)
            assert mimetype == 'application/pdf'
            assert pdf.getvalue().startswith(b'%PDF')
            assert t('export.title', lang) in ' '.join(seen)
            for row in rows:
                assert weekly_exports._p(row['label']) in seen, (lang, row['item'])
                assert weekly_exports._p(row['value']) in seen, (lang, row['item'])

            xlsx, mimetype = weekly_exports.export_xlsx(fresh, rows, calc, lang)
            assert mimetype.endswith('spreadsheetml.sheet')
            workbook = load_workbook(io.BytesIO(xlsx.getvalue()))
            texts = {str(cell.value) for sheet in workbook
                     for line in sheet.iter_rows()
                     for cell in line if cell.value is not None}
            assert t('export.title', lang) in texts
            for row in rows:
                assert row['label'] in texts, (lang, row['item'])
                assert str(row['value']) in texts, (lang, row['item'])


class TestReviewFindings:
    """Regression tests for the independent review fixes."""

    def test_pdf_export_escapes_user_authored_text(self, client, admin_hdr):
        from app.services import weekly_exports

        assert weekly_exports._p('<b>&') == '&lt;b&gt;&amp;'
        report = _generate(client, admin_hdr)
        report.employee.first_name = '<script>alert(1)</script>'
        report.employee.last_name = 'Agent'
        db.session.flush()
        rows, calc = svc.statement_rows(report, 'en')
        output, mimetype = weekly_exports.export_pdf(report, rows, calc, 'en')
        assert mimetype == 'application/pdf'
        assert output.getvalue().startswith(b'%PDF')

    def test_generation_rule_runs_inside_scheduler_savepoint(self, client, no_email):
        sunday = week_bounds(date(2031, 1, 15))[0]
        submission_day = sunday + timedelta(days=7)
        # Saturday is not a submission day; only Sunday generates reports.
        assert automation_service.weekly_report_generation_alert(submission_day - timedelta(days=1)) == 0
        outcomes = dict(automation_service.run_all(submission_day))
        generated = outcomes['weekly_report_generation_alert']
        assert not str(generated).startswith('error:'), generated
        assert generated >= 1
        assert WeeklyReport.query.filter_by(week_start=sunday).count() >= 1

    def test_overrides_are_rejected_once_report_is_locked(self, client, admin_hdr,
                                                          agent_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        with pytest.raises(WeeklyReportError) as exc:
            svc.authorize_shortage_override(
                WeeklyReport.query.get(report.id), 'Too late',
                _user('accountant@afritech.dev'))
        assert exc.value.status == 409
        for url in (f'/api/weekly-reports/{report.id}/override',
                    f'/api/weekly-reports/{report.id}/missing-closings/override'):
            r = client.post(url, headers=accountant_hdr, json={'reason': 'Too late'})
            assert r.status_code == 409, r.get_data(as_text=True)

    def test_rejected_submission_does_not_store_evidence(self, client, admin_hdr,
                                                         agent_hdr, tmp_path, monkeypatch):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        emp = _agent()
        week = _future_week()
        _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        r = client.post(f'/api/weekly-reports/{report.id}/submit', headers=agent_hdr,
                        data={'evidence': (io.BytesIO(b'%PDF-1.4\nshortage'), 'proof.pdf')},
                        content_type='multipart/form-data')
        assert r.status_code == 400, r.get_data(as_text=True)
        folder = tmp_path / 'weekly_reports' / str(report.id)
        assert not folder.exists() or not any(folder.iterdir())

    def test_deleted_transfer_disappears_from_locked_statement(self, client, admin_hdr,
                                                               agent_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        sub = _momo(client, agent_hdr, report.id, amount=100)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'request_correction',
                    reason='Please rescan the receipt')
        assert r.status_code == 200, r.get_data(as_text=True)
        r = client.delete(f'/api/weekly-reports/{report.id}/momo/{sub["id"]}',
                          headers=agent_hdr)
        assert r.status_code == 200, r.get_data(as_text=True)
        body = _detail(client, agent_hdr, report.id)
        assert all(row['id'] != sub['id'] for row in body['momo_submissions'])
        assert body['calculation']['components']['verified_submitted'] == '0.00'
        assert sub['reference'] not in json.dumps(body)

    def test_read_detail_does_not_mutate_persisted_calculation(self, client, admin_hdr,
                                                              agent_hdr):
        report = _generate(client, admin_hdr)
        before = WeeklyReport.query.get(report.id).eligible_collections
        _txn(_agent(), report.week_start + timedelta(days=1), price=700, cost=200)
        db.session.commit()
        body = _detail(client, agent_hdr, report.id)
        assert Decimal(body['calculation']['components']['eligible_collections']) > before
        db.session.expire_all()
        assert WeeklyReport.query.get(report.id).eligible_collections == before

    def test_adjustment_amounts_are_deltas(self, client, admin_hdr, agent_hdr, accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = client.post(f'/api/weekly-reports/{report.id}/adjustments',
                        headers=accountant_hdr,
                        json={'kind': 'authorized_receipt', 'original_amount': 100,
                              'adjusted_amount': 125, 'reason': 'Bank statement correction'})
        assert r.status_code == 201, r.get_data(as_text=True)
        assert _components(client, accountant_hdr, report.id)['authorized_receipts'] == '25.00'
        assert WeeklyReport.query.get(report.id).authorized_receipts == Decimal('25.00')

    def test_verification_notification_is_bilingual(self, client, admin_hdr, agent_hdr,
                                                    accountant_hdr, no_email):
        report = _generate(client, admin_hdr)
        sub = _momo(client, agent_hdr, report.id)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        r = _review(client, accountant_hdr, report.id, 'verify_momo', momo_id=sub['id'])
        assert r.status_code == 200, r.get_data(as_text=True)
        note = Notification.query.filter_by(type='weekly_momo_verified',
                                            related_type='weekly_report',
                                            related_id=report.id).first()
        assert note is not None
        # Kinyarwanda now uses 'Byagenzuwe' (verified), not 'Yemejwe' (approved).
        assert 'Verified' in note.message and 'Byagenzuwe' in note.message

    def test_short_phone_numbers_are_masked(self):
        assert MoMoSubmission.mask_phone('123') == '***'
        assert MoMoSubmission.mask_phone('788123') == '***123'
        assert MoMoSubmission.mask_phone('+250788123456') == '+250******456'

    def test_momo_date_must_fall_inside_report_period(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        week = report.week_start
        payload = {'provider': 'momo', 'reference': 'WKM-BAD-DATE',
                   'amount': 50, 'submitted_at': (week - timedelta(days=1)).isoformat()}
        bad = client.post(f'/api/weekly-reports/{report.id}/momo',
                          headers=agent_hdr, json=payload)
        assert bad.status_code == 400, bad.get_data(as_text=True)
        good = _momo(client, agent_hdr, report.id, reference='WKM-GOOD-DATE',
                     submitted_at=(week + timedelta(days=1)).isoformat())
        assert good['reference'] == 'WKM-GOOD-DATE'


class TestAgentWeeklySubmissionWorkflow:
    """The Service Agent can generate, declare, submit and freeze her report."""

    def test_agent_generates_only_her_own_report(self, client, agent_hdr):
        week = _future_week()
        r = client.post('/api/weekly-reports/generate', headers=agent_hdr,
                        json={'week_start': week.isoformat()})
        assert r.status_code == 201, r.get_data(as_text=True)
        body = r.get_json()
        report = WeeklyReport.query.get(body['report']['id'])
        _TRACKED_REPORT_IDS.add(report.id)
        assert report.employee_id == _agent().id
        assert report.week_start == week
        assert body['created'] is True

        again = client.post('/api/weekly-reports/generate', headers=agent_hdr,
                            json={'week_start': week.isoformat()})
        assert again.status_code == 200, again.get_data(as_text=True)
        assert again.get_json()['created'] is False

        other = client.post('/api/weekly-reports/generate', headers=agent_hdr,
                            json={'employee_id': _agent2().id,
                                  'week_start': week.isoformat()})
        assert other.status_code == 403

    def test_submission_declaration_saves_and_is_frozen(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        r = client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                         json={'declared_submitted_amount': 1250.5,
                               'submission_funding_source': 'company'})
        assert r.status_code == 200, r.get_data(as_text=True)
        detail = _detail(client, agent_hdr, report.id)
        assert detail['declared_submitted_amount'] == 1250.5
        assert detail['submission_funding_source'] == 'company'

        for bad in ({'declared_submitted_amount': -1},
                    {'declared_submitted_amount': 'many'},
                    {'submission_funding_source': 'unknown'}):
            invalid = client.patch(f'/api/weekly-reports/{report.id}',
                                   headers=agent_hdr, json=bad)
            assert invalid.status_code == 400, invalid.get_data(as_text=True)

        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': '1250.50',
            'submission_funding_source': 'company',
            'surplus_explanation': 'Extra cash from an earlier collection',
        })
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        body = submitted.get_json()['report']
        assert body['declared_submitted_amount'] == 1250.5
        assert body['submission_funding_source'] == 'company'
        components = body['calculation']['components']
        assert components['declared_submitted_amount'] == '1250.50'
        assert components['submission_funding_source'] == 'company'
        assert 'declared=1250.50' in body['calculation']['statement'][12]['value']
        assert 'funded_by=company' in body['calculation']['statement'][12]['value']
        assert 'company' in WeeklyReport.query.get(report.id).snapshot

        locked = client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                              json={'declared_submitted_amount': 1})
        assert locked.status_code == 409

    def test_submit_validates_declaration(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        expected_fields = {
            'declared_submitted_amount': 'declared_submitted_amount',
            'submission_funding_source': 'submission_funding_source',
        }
        for bad, field in expected_fields.items():
            r = _submit(client, agent_hdr, report.id, payload={bad: (
                -5 if bad == 'declared_submitted_amount' else 'someone')})
            assert r.status_code == 400, r.get_data(as_text=True)
            assert r.get_json()['field'] == field
            assert WeeklyReport.query.get(report.id).status in (
                'draft', 'ready_for_submission', 'late')


class TestGuidedAgentFlow:
    """The single-page agent task must stay self-scoped and backend-led."""

    def test_summary_prepares_own_week_in_one_request(self, client, agent_hdr):
        emp = _agent()
        week = _future_week()
        _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()

        first = client.post('/api/weekly-reports/agent-summary', headers=agent_hdr,
                            json={'week_start': week.isoformat()})
        assert first.status_code == 200, first.get_data(as_text=True)
        body = first.get_json()
        assert body['created'] is True
        assert body['employee']['id'] == emp.id
        assert body['report']['employee_id'] == emp.id
        assert body['summary'] == body['report']['summary']
        assert body['policy']['timezone'] == 'Africa/Kigali'
        assert body['constants']['official_cost_payment_sources'] == [
            'personal', 'company', 'someone_else', 'not_paid']
        assert any(row['selected'] for row in body['weeks'])

        summary = body['summary']
        assert summary['week_start'] == week.isoformat()
        assert summary['week_end'] == (week + timedelta(days=6)).isoformat()
        assert summary['transaction_count'] == 1
        assert summary['total_collected'] == '1000.00'
        assert summary['official_costs_total'] == '400.00'
        assert summary['previous_outstanding'] == '0.00'
        assert summary['week_expected_amount'] == '1000.00'
        assert summary['expected_amount'] == '1000.00'
        assert summary['total_expected_amount'] == '1000.00'
        assert summary['money_to_submit'] == '1000.00'
        assert summary['declared_amount'] == '0.00'
        assert summary['declared_shortage'] == '1000.00'
        assert summary['verified_shortage'] == '1000.00'
        assert len(summary['official_costs']) == 1
        assert summary['official_costs'][0]['payment_source'] == 'not_paid'

        repeat = client.post('/api/weekly-reports/agent-summary', headers=agent_hdr,
                             json={'week_start': week.isoformat()})
        assert repeat.status_code == 200
        assert repeat.get_json()['created'] is False
        assert repeat.get_json()['report']['id'] == body['report']['id']

    def test_summary_is_self_scoped_and_closed_to_other_roles(self, client, admin_hdr,
                                                              agent_hdr, accountant_hdr):
        other_employee = _agent2()
        week = _future_week()
        other_report = _generate(client, admin_hdr, other_employee, week)

        denied = client.post('/api/weekly-reports/agent-summary', headers=agent_hdr,
                             json={'report_id': other_report.id})
        assert denied.status_code == 403

        # An employee_id in the payload is never honoured; the agent sees her
        # own report even when she tries to query somebody else's figures.
        scoped = client.post('/api/weekly-reports/agent-summary', headers=agent_hdr,
                             json={'week_start': week.isoformat(),
                                   'employee_id': other_employee.id})
        assert scoped.status_code == 200, scoped.get_data(as_text=True)
        assert scoped.get_json()['report']['employee_id'] == _agent().id

        secretary = _hdr(client, 'secretary@afritech.dev')
        assert client.post('/api/weekly-reports/agent-summary', headers=secretary,
                           json={}).status_code == 403
        assert client.post('/api/weekly-reports/agent-summary', headers=accountant_hdr,
                           json={}).status_code == 403

    def test_non_personal_cost_sources_are_recorded_but_never_deducted(
            self, client, admin_hdr, agent_hdr):
        emp = _agent()
        week = _future_week()
        txns = [_txn(emp, week + timedelta(days=day), price=1000, cost=400)
                for day in (1, 2, 3)]
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        for txn, source in zip(txns, ('company', 'someone_else', 'not_paid')):
            created = _claim_api(client, agent_hdr, report, txn, personal=False,
                                 source=source)
            assert created.status_code == 201, created.get_data(as_text=True)
            assert created.get_json()['claim']['payment_source'] == source

        detail = _detail(client, agent_hdr, report.id)
        summary = detail['summary']
        assert summary['expected_amount'] == '3000.00'
        assert summary['official_costs_total'] == '1200.00'
        assert summary['personal_paid_verified'] == '0.00'
        assert summary['company_paid'] == '400.00'
        assert summary['someone_else_paid'] == '400.00'
        assert summary['not_paid'] == '400.00'
        assert {row['payment_source'] for row in summary['official_costs']} == {
            'company', 'someone_else', 'not_paid'}

    def test_land_document_payer_is_confirmed_automatically_in_step_two(
            self, client, admin_hdr, agent_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        week = _future_week()
        land = _txn(_agent(), week + timedelta(days=1), price=1000, cost=400,
                    service_name='Land Document Apply')
        db.session.commit()
        report = _generate(client, admin_hdr, _agent(), week)

        summary = _detail(client, agent_hdr, report.id)['summary']
        assert summary['expected_amount'] == '1000.00'
        assert summary['company_paid'] == '400.00'
        assert len(summary['official_costs']) == 1
        cost = summary['official_costs'][0]
        assert cost['payment_source'] == 'company'
        assert cost['company_funded'] is True
        assert cost['verified_amount'] == '0.00'

        # A personal answer cannot override the automatic company confirmation.
        created = _claim_api(client, agent_hdr, report, land, reference='WKP-LAND-AUTO')
        assert created.status_code == 201, created.get_data(as_text=True)
        claim = created.get_json()['claim']
        assert claim['payment_source'] == 'company'
        assert claim['personal_payment'] is False
        assert claim['amount'] == 0.0
        assert claim['evidence_name'] is None
        after = _detail(client, agent_hdr, report.id)['summary']
        assert after['expected_amount'] == '1000.00'
        assert after['company_paid'] == '400.00'
        assert after['personal_paid_verified'] == '0.00'

    def test_verified_personal_credit_deducts_but_pending_stays_visible(
            self, client, admin_hdr, agent_hdr):
        emp = _agent()
        week = _future_week()
        txns = [_txn(emp, week + timedelta(days=day), price=1000, cost=400)
                for day in (1, 2)]
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)

        pending = _claim_api(client, agent_hdr, report, txns[0], source='personal')
        assert pending.status_code == 201, pending.get_data(as_text=True)
        _claim_row(report, txns[1], personal=True, verified=True, amount=400)
        db.session.commit()

        summary = _detail(client, agent_hdr, report.id)['summary']
        assert summary['expected_amount'] == '1600.00'
        assert summary['personal_paid_verified'] == '400.00'
        assert summary['personal_paid_pending'] == '400.00'
        assert summary['verified_shortage'] == '1600.00'
        assert {row['verification_status'] for row in summary['official_costs']} == {
            'pending', 'verified'}

        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': '1600.00',
            'submission_funding_source': 'agent_phone',
        }, override=False)
        assert submitted.status_code == 200, submitted.get_data(as_text=True)
        components = submitted.get_json()['report']['calculation']['components']
        assert components['expected_remittance'] == '1600.00'
        assert components['declared_shortage_amount'] == '0.00'
        # A declaration is not verified money; the reviewed shortage remains
        # authoritative until a reviewer verifies a matching transfer.
        assert components['shortage_amount'] == '1600.00'

    def test_explanations_are_required_only_for_less_or_more(
            self, client, admin_hdr, agent_hdr):
        emp = _agent()
        cases = [
            {'declared_submitted_amount': '600.00',
             'submission_funding_source': 'agent_phone'},
            {'declared_submitted_amount': '1100.00',
             'submission_funding_source': 'agent_phone'},
        ]
        for payload in cases:
            week = _future_week()
            _txn(emp, week + timedelta(days=1), price=1000, cost=400)
            db.session.commit()
            report = _generate(client, admin_hdr, emp, week)
            response = _submit(client, agent_hdr, report.id, payload=payload,
                               override=False)
            assert response.status_code == 400, response.get_data(as_text=True)
            assert response.get_json()['code'].startswith('weekly_report.')
            assert WeeklyReport.query.get(report.id).status in (
                'draft', 'ready_for_submission', 'late')

    def test_submission_freezes_declared_amount_and_cost_answers(
            self, client, admin_hdr, agent_hdr):
        week = _future_week()
        txn = _txn(_agent(), week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, _agent(), week)
        submitted = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': '1000.00',
            'submission_funding_source': 'agent_phone',
        }, override=False)
        assert submitted.status_code == 200, submitted.get_data(as_text=True)

        locked = client.patch(f'/api/weekly-reports/{report.id}', headers=agent_hdr,
                              json={'declared_submitted_amount': 1})
        assert locked.status_code == 409
        new_answer = _claim_api(client, agent_hdr, report, txn, source='company')
        assert new_answer.status_code == 409
        assert WeeklyReport.query.get(report.id).declared_submitted_amount == \
            Decimal('1000.00')
        snapshot = json.loads(WeeklyReport.query.get(report.id).snapshot)
        assert snapshot['declaration']['declared_submission'] is True

    def test_declaration_drives_questions_without_erasing_verified_shortage(
            self, client, admin_hdr, agent_hdr):
        emp = _agent()
        cases = [
            ('declared amount matches', '1000.00', {}, '0.00', '1000.00'),
            ('short amount has a reason', '600.00', {
                'shortage_reason_category': 'payment_problem',
                'shortage_explanation': 'The customer paid the balance later',
            }, '400.00', '1000.00'),
            ('zero amount has a reason', '0', {
                'shortage_reason_category': 'customer_not_paid',
                'shortage_explanation': 'Customer has not paid yet',
            }, '1000.00', '1000.00'),
            ('extra amount has a reason', '1100.00', {
                'surplus_explanation': 'Extra cash from an earlier collection',
            }, '0.00', '1000.00'),
        ]
        for label, amount, extra, declared_shortage, verified_shortage in cases:
            week = _future_week()
            _txn(emp, week + timedelta(days=1), price=1000, cost=400)
            db.session.commit()
            report = _generate(client, admin_hdr, emp, week)
            payload = {
                'declared_submitted_amount': amount,
                'submission_funding_source': 'agent_phone',
                **extra,
            }
            response = _submit(client, agent_hdr, report.id, payload=payload,
                               override=False)
            assert response.status_code == 200, \
                f'{label}: {response.get_data(as_text=True)}'
            components = response.get_json()['report']['calculation']['components']
            assert components['declared_shortage_amount'] == declared_shortage
            assert components['shortage_amount'] == verified_shortage
            assert WeeklyReport.query.get(report.id).status == 'submitted'

    def test_guided_reason_labels_are_bilingual(self):
        from app.models import AGENT_SHORTAGE_REASON_CATEGORIES
        assert AGENT_SHORTAGE_REASON_CATEGORIES == [
            'customer_not_paid', 'service_issue', 'payment_problem',
            'money_unavailable', 'incorrect_record', 'other']
        for reason in AGENT_SHORTAGE_REASON_CATEGORIES:
            assert t(f'reason.{reason}', 'en') != f'reason.{reason}'
            assert t(f'reason.{reason}', 'rw') != f'reason.{reason}'
        assert t('reason.customer_not_paid', 'en') == 'Customer has not paid fully'
        assert t('reason.customer_not_paid', 'rw') == \
            'Umukiriya ntiyishyuye amafaranga yose'
        assert t('error.shortage_explanation', 'rw') == \
            'Hagomba gutangwa impamvu yemewe n’ibisobanuro bigufi.'
        assert t('error.surplus_explanation', 'en') == \
            'Please confirm or explain the extra amount.'
        assert t('error.surplus_explanation', 'rw') == \
            'Emeza cyangwa usobanure impamvu hari amafaranga arenga ateganyijwe.'


class TestFieldLocatedErrors:
    """Validation failures name the exact field (and row) the UI must show."""

    def test_weekly_report_error_carries_location(self):
        exc = WeeklyReportError('Bad amount', 'weekly_report.invalid_amount', 400,
                                field='declared_submitted_amount',
                                details={'transaction_id': 17})
        assert exc.field == 'declared_submitted_amount'
        assert exc.details['transaction_id'] == 17
        assert exc.code == 'weekly_report.invalid_amount'
        assert exc.status == 400

    def test_empty_json_error_has_no_location(self):
        exc = WeeklyReportError('Locked', 'weekly_report.locked', 409)
        assert exc.field is None
        assert exc.details == {}

    def test_momo_validation_returns_field(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        base = {'provider': 'momo', 'reference': 'VALIDREF',
                'amount': '1000', 'submitted_at': ''}
        cases = [
            ({**base, 'provider': 'wire'}, 'provider'),
            ({**base, 'reference': 'x'}, 'reference'),
            ({**base, 'amount': '0'}, 'amount'),
            ({**base, 'submitted_at': 'not-a-date'}, 'submitted_at'),
        ]
        for payload, field in cases:
            r = client.post(f'/api/weekly-reports/{report.id}/momo',
                            headers=agent_hdr, json=payload)
            assert r.status_code == 400, r.get_data(as_text=True)
            assert r.get_json()['field'] == field

    def test_momo_duplicate_reference_points_at_reference(self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        payload = {'provider': 'momo', 'reference': 'DUP12345', 'amount': '1000'}
        first = client.post(f'/api/weekly-reports/{report.id}/momo',
                            headers=agent_hdr, json=payload)
        assert first.status_code == 201, first.get_data(as_text=True)
        duplicate = client.post(f'/api/weekly-reports/{report.id}/momo',
                                headers=agent_hdr, json=payload)
        assert duplicate.status_code == 409
        assert duplicate.get_json()['field'] == 'reference'

    def test_shortage_explanation_error_points_at_first_missing_field(
            self, client, admin_hdr, agent_hdr):
        report = _generate(client, admin_hdr)
        # An amount below the expected total asks for a reason; neither is given.
        r = _submit(client, agent_hdr, report.id, payload={
            'declared_submitted_amount': 1,
            'submission_funding_source': 'agent_phone',
        })
        assert r.status_code == 400, r.get_data(as_text=True)
        body = r.get_json()
        assert body['code'] in ('weekly_report.shortage_explanation',
                                'weekly_report.surplus_explanation')
        assert body['field'] in ('shortage_reason_category', 'shortage_explanation')

    def test_cost_claim_errors_include_transaction_row(
            self, client, admin_hdr, agent_hdr):
        week = _future_week()
        emp = _agent()
        txn = _txn(emp, week + timedelta(days=1), price=1000, cost=400)
        db.session.commit()
        report = _generate(client, admin_hdr, emp, week)
        url = f'/api/weekly-reports/{report.id}/official-cost-payments'
        data = {'transaction_id': str(txn.id), 'payment_source': 'personal',
                'auto_personal': 'true'}
        first = client.post(url, headers=agent_hdr, data=data)
        assert first.status_code == 201, first.get_data(as_text=True)
        duplicate = client.post(url, headers=agent_hdr, data=data)
        assert duplicate.status_code == 409
        body = duplicate.get_json()
        assert body['field'] == 'payment_source'
        assert body['details']['transaction_id'] == txn.id

    def test_adjustment_errors_name_the_field(self, client, admin_hdr, agent_hdr,
                                              accountant_hdr):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200
        url = f'/api/weekly-reports/{report.id}/adjustments'
        cases = [
            ({'kind': 'nope', 'reason': 'A valid reason'},
             'weekly_report.invalid_adjustment', 'kind'),
            ({'kind': 'authorized_receipt', 'reason': 'x'},
             'weekly_report.reason_required', 'reason'),
            ({'kind': 'authorized_receipt', 'reason': 'A valid reason',
              'original_amount': -1, 'adjusted_amount': 0},
             'weekly_report.invalid_amount', 'original_amount'),
        ]
        for payload, code, field in cases:
            response = client.post(url, headers=accountant_hdr, json=payload)
            assert response.status_code == 400
            body = response.get_json()
            assert body['code'] == code and body['field'] == field


class TestReviewActionWiring:
    """Review endpoints require the right fields and keep notes separate."""

    def test_child_note_does_not_overwrite_report_note(
            self, client, admin_hdr, agent_hdr, accountant_hdr, no_email):
        report = _generate(client, admin_hdr)
        sub = _momo(client, agent_hdr, report.id)
        assert _submit(client, agent_hdr, report.id).status_code == 200

        first = _review(client, accountant_hdr, report.id, 'verify_momo',
                        momo_id=sub['id'], note='receipt checked',
                        report_note='finance overview')
        assert first.status_code == 200, first.get_data(as_text=True)
        assert WeeklyReport.query.get(report.id).reviewer_note == 'finance overview'
        assert MoMoSubmission.query.get(sub['id']).verification_note == 'receipt checked'

        # A later per-item note must never silently rewrite the report note.
        second = _review(client, accountant_hdr, report.id, 'verify_momo',
                         momo_id=sub['id'], note='second look')
        assert second.status_code == 200, second.get_data(as_text=True)
        assert WeeklyReport.query.get(report.id).reviewer_note == 'finance overview'
        assert MoMoSubmission.query.get(sub['id']).verification_note == 'second look'
        assert AuditLog.query.filter_by(
            action='weekly_report_reviewer_note_updated',
            entity='weekly_report', entity_id=str(report.id)).count() == 1

    def test_review_actions_name_missing_fields(
            self, client, admin_hdr, agent_hdr, accountant_hdr, no_email):
        report = _generate(client, admin_hdr)
        assert _submit(client, agent_hdr, report.id).status_code == 200

        for action, field in (('verify_momo', 'momo_id'),
                              ('reject_momo', 'momo_id'),
                              ('verify_cost_payment', 'claim_id'),
                              ('reject_cost_payment', 'claim_id'),
                              ('request_correction', 'review_reason'),
                              ('reject', 'review_reason')):
            response = _review(client, accountant_hdr, report.id, action,
                               reason='   ')
            assert response.status_code == 400, response.get_data(as_text=True)
            assert response.get_json()['field'] == field
        assert WeeklyReport.query.get(report.id).status == 'submitted'

    def test_momo_evidence_download_is_protected_and_audited(
            self, client, admin_hdr, agent_hdr, manager_hdr, tmp_path, monkeypatch, no_email):
        monkeypatch.setitem(client.application.config, 'UPLOAD_FOLDER', str(tmp_path))
        report = _generate(client, admin_hdr)
        response = client.post(f'/api/weekly-reports/{report.id}/momo',
                               headers=agent_hdr,
                               data={'provider': 'momo', 'reference': 'WKM-EVIDENCE',
                                     'amount': '50',
                                     'evidence': (io.BytesIO(b'%PDF-1.4\nmomo proof'),
                                                  'momo-proof.pdf')},
                               content_type='multipart/form-data')
        assert response.status_code == 201, response.get_data(as_text=True)
        sub_id = response.get_json()['submission']['id']
        url = f'/api/weekly-reports/{report.id}/momo/{sub_id}/evidence'
        assert client.get(url, headers=agent_hdr).data.startswith(b'%PDF')
        assert client.get(url, headers=manager_hdr).status_code == 403
        assert AuditLog.query.filter_by(
            action='weekly_momo_evidence_downloaded',
            entity='weekly_momo_submission', entity_id=str(sub_id)).count() == 1

    def test_export_writes_audit(
            self, client, admin_hdr, accountant_hdr, no_email):
        report = _generate(client, admin_hdr)
        response = client.get(f'/api/weekly-reports/{report.id}/export?format=pdf&lang=en',
                              headers=accountant_hdr)
        assert response.status_code == 200
        log = AuditLog.query.filter_by(action='weekly_report_exported',
                                       entity='weekly_report',
                                       entity_id=str(report.id)).first()
        assert log is not None and 'pdf' in log.new_value


# ── central management workspace (GET /queue) ───────────────────────────────


def _queue_state(report, status, submitted_at, shortage=0, declared=0, verified=0,
                 agent_reported=0, missing=(), override=None):
    """Set the frozen review-facing state without touching source transactions."""
    report.status = status
    report.submitted_at = submitted_at
    report.shortage_amount = shortage
    report.declared_submitted_amount = declared
    report.verified_submitted = verified
    report.agent_reported_submitted = agent_reported
    report.missing_closing_override_reason = override
    payload = {
        'missing_closings': list(missing),
        'components': {'expected_remittance': '1000.00'},
        'daily_closings': [
            {'date': day, 'status': 'missing', 'closing_id': None}
            for day in missing
        ],
    }
    report.snapshot = json.dumps(payload)
    report.calculation = json.dumps(payload)
    db.session.flush()


class TestReviewQueueWorkspace:
    """Backend tests for the reviewer/manager/accountant queue workspace."""

    def _seed(self, client, admin_hdr):
        stamp = datetime.now(timezone.utc)
        week_a = _future_week()
        week_b = week_a + timedelta(days=7)
        week_c = week_a + timedelta(days=14)
        agent, agent2 = _agent(), _agent2()
        r1 = _generate(client, admin_hdr, agent, week_a)
        r2 = _generate(client, admin_hdr, agent2, week_a)
        r3 = _generate(client, admin_hdr, agent, week_b)
        r4 = _generate(client, admin_hdr, agent2, week_b)
        r5 = _generate(client, admin_hdr, agent, week_c)
        r6 = _generate(client, admin_hdr, agent2, week_c)

        # r1 is the fully flagged report: shortage, unverified declaration,
        # pending MoMo + pending personal cost claim, and real missing days.
        _queue_state(r1, 'submitted', stamp, shortage=150, declared=1000,
                     verified=400, agent_reported=1000,
                     missing=[week_a.isoformat()])
        _queue_state(r2, 'under_financial_review', stamp + timedelta(hours=1),
                     declared=500, verified=500, agent_reported=500)
        _queue_state(r3, 'submitted', stamp + timedelta(hours=2),
                     declared=300, verified=300, agent_reported=300)
        # r4 has missing days, but an authorized override makes them actionable
        # nowhere; its legacy zero declaration still leaves agent funds unverified.
        _queue_state(r4, 'submitted', stamp + timedelta(hours=3),
                     declared=0, verified=0, agent_reported=200,
                     missing=[week_b.isoformat()],
                     override='Authorized for this test.')
        _queue_state(r5, 'approved', stamp + timedelta(hours=4), shortage=25,
                     declared=100, verified=100, agent_reported=100)
        _queue_state(r6, 'rejected', stamp + timedelta(hours=5))

        db.session.add(MoMoSubmission(
            report_id=r1.id, provider='momo',
            reference=f'WKM-QUEUE-{uuid.uuid4().hex[:8]}', amount=Decimal('500.00'),
            submitted_at=stamp, verification_status='pending',
            created_by=_user('agent@afritech.dev').id))
        claim = _claim_row(r1, _txn(agent, week_a), amount=200,
                           reference='WKP-QUEUE-1')
        assert claim.verification_status == 'pending'
        db.session.commit()

        return {
            'r1': r1, 'r2': r2, 'r3': r3, 'r4': r4, 'r5': r5, 'r6': r6,
            'week_a': week_a, 'week_b': week_b, 'week_c': week_c,
        }

    def test_queue_filters_week_branch_search_and_flags(
            self, client, admin_hdr, accountant_hdr):
        s = self._seed(client, admin_hdr)

        def ids(query=''):
            body = _assert_ok(client.get(f'/api/weekly-reports/queue?{query}',
                                         headers=accountant_hdr))
            return {row['id'] for row in body['items']}

        assert ids(f'week_start={s["week_a"].isoformat()}') == {
            s['r1'].id, s['r2'].id}
        assert ids(f'week_start={s["week_b"].isoformat()}') == {
            s['r3'].id, s['r4'].id}

        branch_id = _agent().branch_id
        assert ids(f'week_start={s["week_a"].isoformat()}&branch_id={branch_id}') == {
            s['r1'].id}
        assert ids(f'branch_id={_agent2().branch_id}') == {
            s['r2'].id, s['r4'].id}

        assert ids(f'week_start={s["week_a"].isoformat()}&search=claude') == {
            s['r1'].id}
        assert ids(f'week_start={s["week_a"].isoformat()}&search=kigali%20branch') == {
            s['r1'].id}
        assert ids(f'search={s["r1"].report_number}') == {s['r1'].id}
        assert ids('search=no-such-agent') == set()

        assert ids('has_shortage=true') == {s['r1'].id}
        assert ids('has_pending=true') == {s['r1'].id}
        assert ids('has_unverified=true') == {s['r1'].id, s['r4'].id}
        assert ids('missing_closings=true') == {s['r1'].id}
        assert ids('has_shortage=false') == {
            s['r1'].id, s['r2'].id, s['r3'].id, s['r4'].id}

        bad_week = client.get('/api/weekly-reports/queue?week_start=2031-01-13',
                              headers=accountant_hdr)
        assert bad_week.status_code == 400
        assert 'Sunday' in bad_week.get_json()['error']

    def test_queue_row_signals_come_from_backend(
            self, client, admin_hdr, accountant_hdr):
        s = self._seed(client, admin_hdr)
        body = _assert_ok(client.get('/api/weekly-reports/queue?per_page=50',
                                     headers=accountant_hdr))
        rows = {row['id']: row for row in body['items']}

        flagged = rows[s['r1'].id]
        assert flagged['pending_submission_count'] == 1
        assert flagged['unverified_personal_payment_count'] == 1
        assert flagged['missing_closing_count'] == 1
        assert flagged['has_shortage'] is True

        clean = rows[s['r2'].id]
        assert clean['pending_submission_count'] == 0
        assert clean['unverified_personal_payment_count'] == 0
        assert clean['missing_closing_count'] == 0
        assert clean['has_shortage'] is False

        # The override does not erase the recorded days, only the review signal.
        assert rows[s['r4'].id]['missing_closing_count'] == 1

    def test_queue_metrics_use_scope_and_ignore_row_filters(
            self, client, admin_hdr, accountant_hdr):
        s = self._seed(client, admin_hdr)

        body = _assert_ok(client.get(
            f'/api/weekly-reports/queue?week_start={s["week_a"].isoformat()}',
            headers=accountant_hdr))
        assert body['metrics'] == {
            'total': 2,
            'submitted': 1,
            'under_review': 1,
            'returned': 0,
            'approved': 0,
            'rejected': 0,
            'shortage_reports': 1,
            'shortage_amount': '150.00',
            'pending_submissions': 1,
            'unverified_payments': 1,
            'missing_closings': 1,
            'total_shortage': '150.00',
        }

        # Search/status are row filters: they must never distort the dashboard.
        filtered = _assert_ok(client.get(
            f'/api/weekly-reports/queue?week_start={s["week_a"].isoformat()}'
            '&status=approved&search=no-match', headers=accountant_hdr))
        assert filtered['items'] == []
        assert filtered['total'] == 0
        assert filtered['metrics'] == body['metrics']

        # A branch filter is part of the scope, so metrics must shrink with it.
        scoped = _assert_ok(client.get(
            f'/api/weekly-reports/queue?week_start={s["week_a"].isoformat()}'
            f'&branch_id={_agent2().branch_id}', headers=accountant_hdr))
        assert scoped['metrics']['total'] == 1
        assert scoped['metrics']['submitted'] == 0
        assert scoped['metrics']['under_review'] == 1
        assert scoped['metrics']['shortage_amount'] == '0.00'
        assert scoped['metrics']['pending_submissions'] == 0
        assert scoped['metrics']['unverified_payments'] == 0
        assert scoped['metrics']['missing_closings'] == 0
        assert scoped['filters']['branch_id'] == _agent2().branch_id

    def test_queue_manager_is_branch_scoped_and_cross_branch_denied(
            self, client, admin_hdr, manager_hdr, accountant_hdr):
        s = self._seed(client, admin_hdr)
        manager_emp = _user('manager@afritech.dev').employee
        own = _generate(client, admin_hdr, manager_emp, s['week_a'])
        _queue_state(own, 'submitted', datetime.now(timezone.utc),
                     declared=10, verified=10, agent_reported=10)
        db.session.commit()

        queue = _assert_ok(client.get('/api/weekly-reports/queue',
                                      headers=manager_hdr))
        ids = {row['id'] for row in queue['items']}
        assert own.id in ids
        assert s['r1'].id not in ids and s['r2'].id not in ids
        assert queue['metrics']['total'] == 1

        denied = client.get(f'/api/weekly-reports/queue?branch_id={_agent().branch_id}',
                            headers=manager_hdr)
        assert denied.status_code == 403
        assert 'own branch' in denied.get_json()['error']

        allowed = _assert_ok(client.get(
            f'/api/weekly-reports/queue?branch_id={manager_emp.branch_id}',
            headers=manager_hdr))
        assert {row['id'] for row in allowed['items']} == {own.id}

        # A non-manager reviewer is free to look across real branches.
        cross = _assert_ok(client.get(
            f'/api/weekly-reports/queue?branch_id={_agent2().branch_id}',
            headers=accountant_hdr))
        assert s['r2'].id in {row['id'] for row in cross['items']}
        unknown = client.get('/api/weekly-reports/queue?branch_id=999999',
                             headers=accountant_hdr)
        assert unknown.status_code == 400

    def test_queue_denies_company_secretary(self, client, admin_hdr, no_email):
        self._seed(client, admin_hdr)
        secretary = _hdr(client, 'secretary@afritech.dev')
        for query in ('', '?status=submitted', '?has_pending=true'):
            response = client.get(f'/api/weekly-reports/queue{query}',
                                  headers=secretary)
            assert response.status_code == 403

    def test_queue_keeps_status_pagination_and_sort_contract(
            self, client, admin_hdr, accountant_hdr):
        s = self._seed(client, admin_hdr)

        first = _assert_ok(client.get('/api/weekly-reports/queue?page=1&per_page=1',
                                      headers=accountant_hdr))
        for key in ('items', 'total', 'page', 'per_page', 'pages'):
            assert key in first
        assert first['page'] == 1 and first['per_page'] == 1
        assert first['total'] == 4 and first['pages'] == 4
        assert len(first['items']) == 1

        second = _assert_ok(client.get('/api/weekly-reports/queue?page=2&per_page=1',
                                       headers=accountant_hdr))
        assert second['page'] == 2 and len(second['items']) == 1
        assert second['items'][0]['id'] != first['items'][0]['id']

        status_only = _assert_ok(client.get(
            '/api/weekly-reports/queue?status=under_financial_review',
            headers=accountant_hdr))
        assert {row['id'] for row in status_only['items']} == {s['r2'].id}

        newest = _assert_ok(client.get('/api/weekly-reports/queue?per_page=50',
                                       headers=accountant_hdr))
        assert [row['id'] for row in newest['items']] == [
            s['r4'].id, s['r3'].id, s['r2'].id, s['r1'].id]
        oldest = _assert_ok(client.get(
            '/api/weekly-reports/queue?sort=oldest&per_page=50',
            headers=accountant_hdr))
        assert [row['id'] for row in oldest['items']] == [
            s['r1'].id, s['r2'].id, s['r3'].id, s['r4'].id]
        by_amount = _assert_ok(client.get(
            '/api/weekly-reports/queue?sort=amount&per_page=50',
            headers=accountant_hdr))
        assert by_amount['items'][0]['id'] == s['r1'].id
        assert client.get('/api/weekly-reports/queue?sort=sideways',
                          headers=accountant_hdr).status_code == 400
