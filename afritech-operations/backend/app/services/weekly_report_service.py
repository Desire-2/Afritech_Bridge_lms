"""Backend-authoritative weekly financial reconciliation workflow."""
import copy
import json
import os
import uuid
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from flask import current_app

from ..extensions import db
from ..models import (
    DailyClosing, Employee, Expense, MoMoSubmission, OfficialCostPayment,
    OutstandingAllocation, Payment, PaymentMethod, ServiceTransaction, User,
    WeeklyReport, WeeklyReportAdjustment, WeeklyReportExpense,
    WEEKLY_REPORT_TRANSITIONS, ADJUSTMENT_KINDS, SHORTAGE_REASON_CATEGORIES,
    COST_PAYMENT_VERIFICATION_STATUSES, MOMO_PROVIDERS,
    WEEKLY_SUBMISSION_SOURCES,
)
from ..auth.scope import service_agent_employee_ids
from .audit import audit
from .weekly_policy import (
    get_policy, period_label, submission_deadline, is_late, money,
    week_bounds, week_end_for, require_week_start, is_valid_week_start,
    normalize_week_start, week_window, in_week, business_timezone,
)
from .weekly_i18n import bilingual, t


class WeeklyReportError(Exception):
    def __init__(self, message, code='weekly_report.error', status=400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _dec(value):
    return Decimal(str(value or 0)).quantize(Decimal('0.01'))


def _str(value):
    return f'{_dec(value):.2f}'


def _json(value):
    return json.dumps(value, default=str, sort_keys=True)


def _loads(value, fallback=None):
    if not value:
        return fallback if fallback is not None else {}
    try:
        return json.loads(value)
    except (TypeError, ValueError):
        return fallback if fallback is not None else {}


def _payment_status(transaction, payment_total):
    status = (transaction.status or '').lower()
    if status in ('cancelled', 'refunded', 'reversed'):
        return status
    if status in ('failed', 'unpaid', 'pending_payment'):
        return 'unpaid'
    customer_price = _dec(transaction.customer_price)
    if payment_total <= 0:
        return 'unpaid'
    if customer_price > 0 and payment_total < customer_price:
        return 'partially_paid'
    return 'paid'


def _joined(*parts):
    """Join data-only statement fragments without translating user text."""
    return ' | '.join(str(p) for p in parts if p not in (None, ''))


class WeeklyReportService:
    # ── generation / lookup ────────────────────────────────────────────────

    def ensure_report(self, employee, week_start, actor=None, notify_agent=True):
        """Idempotently create the single report for an agent/week."""
        if employee is None:
            raise WeeklyReportError('Employee not found', 'weekly_report.employee_not_found', 404)
        policy = get_policy()
        week_start = normalize_week_start(
            week_start or week_bounds(policy=policy)[0], policy)
        week_end = week_end_for(week_start, policy)

        existing = WeeklyReport.query.filter_by(
            employee_id=employee.id, week_start=week_start).first()
        if existing:
            return existing, False

        opening = self._opening_for(employee.id, week_start)
        report = WeeklyReport(
            report_number=self._report_number(employee, week_start),
            employee_id=employee.id,
            branch_id=employee.branch_id,
            week_start=week_start,
            week_end=week_end,
            due_at=submission_deadline(week_start, policy),
            timezone_name=policy['timezone'],
            period_label=period_label(week_start, week_end),
            status='late' if is_late(week_start) else 'draft',
            is_late=is_late(week_start),
            generated_by=actor.id if actor else None,
            opening_outstanding=opening,
        )
        db.session.add(report)
        try:
            db.session.flush()
        except Exception:
            # A concurrent worker may have won the unique-constraint race.
            db.session.rollback()
            existing = WeeklyReport.query.filter_by(
                employee_id=employee.id, week_start=week_start).first()
            if existing:
                return existing, False
            raise

        source = self._latest_approved_before(employee.id, week_start)
        if source is not None:
            allocation = OutstandingAllocation(
                employee_id=employee.id,
                report_id=report.id,
                source_report_id=source.id,
                reference_key=f'carry:{source.id}:{report.id}',
                kind='carry_forward',
                amount=opening,
                reason='Opening outstanding carried from the previous approved weekly report.',
                actor_id=actor.id if actor else None,
            )
            db.session.add(allocation)

        calc = self.build_calculation(report)
        self._apply_calculation(report, calc)
        calc['status'] = {'name': report.status}
        report.calculation = _json(self._with_statement(calc))
        db.session.flush()
        audit('weekly_report_generated', 'weekly_report', report.id,
              new_value={'report_number': report.report_number, 'status': report.status},
              user=actor)

        if notify_agent and employee.user_id:
            from .notifications import notify
            notify(employee.user_id, 'weekly_report_generated',
                   bilingual('notification.generated', period=report.period_label),
                   related_type='weekly_report', related_id=report.id,
                   rule='weekly-report-generation')
        return report, True

    def _report_number(self, employee, week_start):
        seq = WeeklyReport.query.filter_by(employee_id=employee.id).count() + 1
        return f'WR-{week_start:%Y%m%d}-{employee.id:04d}-{seq:03d}-{uuid.uuid4().hex[:5].upper()}'

    def _latest_approved_before(self, employee_id, week_start):
        return (WeeklyReport.query
                .filter_by(employee_id=employee_id, status='approved')
                .filter(WeeklyReport.week_start < week_start)
                .order_by(WeeklyReport.week_start.desc())
                .first())

    def _opening_for(self, employee_id, week_start):
        prior = self._latest_approved_before(employee_id, week_start)
        return _dec(prior.closing_outstanding if prior else 0)

    def generate_for_all_agents(self, reference_date=None, actor=None, employee_ids=None):
        week_start, _ = week_bounds(reference_date or date.today(), get_policy())
        ids = service_agent_employee_ids()
        if employee_ids is not None:
            ids = ids & set(employee_ids)
        if not ids:
            return {'week_start': week_start.isoformat(), 'created': 0, 'existing': 0}
        employees = Employee.query.filter(Employee.id.in_(ids)).all()
        created = existing = 0
        for employee in employees:
            report, was_created = self.ensure_report(employee, week_start, actor=actor)
            if was_created:
                created += 1
            else:
                existing += 1
        # The caller owns the transaction: the REST route commits after a
        # successful response, and `automation.run_all()` commits after each
        # SAVEPOINT. Committing here would invalidate that SAVEPOINT.
        return {'week_start': week_start.isoformat(), 'created': created,
                'existing': existing, 'total': len(employees)}

    # ── calculation ────────────────────────────────────────────────────────

    def _outstanding_adjustment_total(self, report):
        """Net approved waiver/correction allocations, excluding carry-forward."""
        return sum(
            (_dec(a.amount) for a in report.allocations
             if a.kind in ('outstanding_correction', 'outstanding_waiver')),
            Decimal('0'),
        )

    @staticmethod
    def _cost_claim_view(claim):
        """Data-only claim view. Phone numbers are masked at the boundary."""
        if claim is None:
            return {
                'id': None, 'personal_payment': None, 'amount': '0.00',
                'is_partial': False, 'provider': None, 'reference': None,
                'paid_at': None, 'sender_phone': None, 'evidence_name': None,
                'notes': None, 'verification_status': 'not_claimed',
                'verification_note': None,
            }
        data = claim.to_dict(include_sensitive=True)
        return {
            'id': data['id'],
            'personal_payment': data['personal_payment'],
            'amount': _str(data['amount']),
            'is_partial': data['is_partial'],
            'provider': data['provider'],
            'reference': data['reference'],
            'paid_at': data['paid_at'],
            'sender_phone': data['sender_phone'],
            'evidence_name': data['evidence_name'],
            'notes': data['notes'],
            'verification_status': data['verification_status'],
            'verification_note': data['verification_note'],
        }

    @classmethod
    def _verified_cost_credit(cls, claim):
        """Only a personally paid, verified claim can reduce remittance."""
        if claim is None or not claim.personal_payment:
            return Decimal('0')
        if claim.verification_status != 'verified':
            return Decimal('0')
        return max(Decimal('0'), _dec(claim.amount))

    def build_calculation(self, report):
        """Recompute from source records only. Never called on locked reports."""
        policy = get_policy()
        eligible_statuses = set(policy['eligible_transaction_statuses'])
        ineligible_statuses = set(policy['ineligible_transaction_statuses'])

        txns = (ServiceTransaction.query
                .filter_by(employee_id=report.employee_id)
                .filter(ServiceTransaction.transaction_date >= report.week_start,
                        ServiceTransaction.transaction_date <= report.week_end)
                .order_by(ServiceTransaction.transaction_date,
                          ServiceTransaction.transaction_number)
                .all())

        claims = OfficialCostPayment.query.filter_by(report_id=report.id).all()
        claims_by_txn = {}
        for claim in claims:
            claims_by_txn.setdefault(claim.transaction_id, []).append(claim)
        claim_rows = [claim.to_dict() for claim in claims]

        txn_rows = []
        eligible = []
        collections = Decimal('0')
        service_costs = Decimal('0')
        commission = Decimal('0')
        verified_cost_amount = Decimal('0')

        for txn in txns:
            payment_total = sum((_dec(p.amount) for p in txn.payments), Decimal('0'))
            # This is the CUSTOMER's payment status. It never proves that the
            # official cost was paid by the agent from her own phone.
            payment_status = _payment_status(txn, payment_total)
            is_eligible = (txn.status in eligible_statuses
                           and txn.status not in ineligible_statuses
                           and payment_status in ('paid', 'partially_paid'))
            cost_claim = (claims_by_txn.get(txn.id) or [None])[0]
            claim_view = self._cost_claim_view(cost_claim)
            row = {
                'id': txn.id,
                'transaction_number': txn.transaction_number,
                'date': txn.transaction_date.isoformat(),
                'status': txn.status,
                'payment_status': payment_status,
                'service_name': txn.service_name,
                'client_name': txn.client.full_name if txn.client else None,
                'customer_price': _str(txn.customer_price),
                'official_cost': _str(txn.official_cost),
                'payment_amount': _str(payment_total),
                'gross_profit': _str(txn.gross_profit),
                'commission_amount': _str(txn.commission_amount),
                'payment_method': (txn.payment_method.name if txn.payment_method else None),
                'is_eligible': is_eligible,
                'cost_payment_claim_id': claim_view['id'],
                'official_cost_payment_status': claim_view['verification_status'],
                'personal_payment': claim_view['personal_payment'],
                'personal_payment_amount': claim_view['amount'],
                'personal_payment_reference': claim_view['reference'],
                'personal_payment_evidence_name': claim_view['evidence_name'],
                'personal_payment_note': claim_view['verification_note'],
            }
            txn_rows.append(row)
            if is_eligible:
                eligible.append(txn)
                collections += payment_total
                service_costs += _dec(txn.official_cost)
                commission += _dec(txn.commission_amount)
                if policy['deduct_verified_service_costs']:
                    for claim in claims_by_txn.get(txn.id, []):
                        verified_cost_amount += self._verified_cost_credit(claim)

        # Daily closings: use the existing triage helper rather than a second
        # implementation of daily arithmetic. Missing closings stay `None`.
        from ..routes.closings import triage_daily_totals
        closing_rows = []
        missing = []
        day = report.week_start
        while day <= report.week_end:
            closing = DailyClosing.query.filter_by(
                employee_id=report.employee_id, closing_date=day).first()
            daily = triage_daily_totals(report.employee_id, day)
            base = {
                'date': day.isoformat(),
                'closing_id': closing.id if closing else None,
                'status': closing.status if closing else 'missing',
                'transaction_count': daily['transaction_count'],
                'collections': _str(daily['customer_payments']),
                'service_costs': _str(daily['service_costs']),
                'expected_cash': _str(daily['expected_cash']) if closing else None,
                'actual_cash': _str(closing.actual_cash) if closing else None,
                'difference': _str(closing.cash_difference) if closing else None,
                'submitted_at': closing.submitted_at.isoformat() if closing and closing.submitted_at else None,
                'comments': closing.notes if closing else None,
            }
            closing_rows.append(base)
            if not closing:
                missing.append(day.isoformat())
            day += timedelta(days=1)

        # Expenses: only approved/paid expenses funded from collections and
        # linked to at most one weekly report.
        expense_rows = []
        expense_total = Decimal('0')
        user = User.query.get(report.employee.user_id) if report.employee and report.employee.user_id else None
        if user:
            candidates = (Expense.query
                          .filter(Expense.submitted_by == user.id,
                                  Expense.expense_date >= report.week_start,
                                  Expense.expense_date <= report.week_end,
                                  Expense.status.in_(['approved', 'paid']))
                          .all())
            funded_codes = set(policy['collection_funded_payment_methods'])
            for exp in candidates:
                method_code = exp.payment_method.code if exp.payment_method else None
                if funded_codes and method_code not in funded_codes:
                    continue
                linked = WeeklyReportExpense.query.filter_by(expense_id=exp.id).first()
                if linked and linked.report_id != report.id:
                    continue  # never deduct the same expense twice
                expense_total += _dec(exp.amount)
                expense_rows.append({
                    'id': exp.id,
                    'date': exp.expense_date.isoformat(),
                    'category': exp.category,
                    'description': exp.description,
                    'amount': _str(exp.amount),
                    'payment_source': method_code,
                    'payment_status': exp.status,
                    'receipt_path': exp.receipt_path,
                    'notes': exp.notes,
                    'approved_by': exp.approved_by,
                    'approver_name': (exp.approver.email if exp.approver else None),
                })

        momo_rows = [
            {
                'id': m.id,
                'provider': m.provider,
                'reference': m.reference,
                'amount': _str(m.amount),
                'submitted_at': m.submitted_at.isoformat() if m.submitted_at else None,
                'sender_phone': MoMoSubmission.mask_phone(m.sender_phone),
                'recipient_phone': MoMoSubmission.mask_phone(m.recipient_phone),
                'confirmation_code': m.confirmation_code,
                'notes': m.notes,
                'evidence_path': m.evidence_path,
                'evidence_name': m.evidence_name,
                'verification_status': m.verification_status,
                'verified_by': m.verified_by,
                'verification_note': m.verification_note,
            }
            for m in report.momo_submissions
        ]
        momo_reported = sum((_dec(m['amount']) for m in momo_rows), Decimal('0'))
        momo_verified = sum((_dec(m['amount']) for m in momo_rows
                             if m['verification_status'] == 'verified'), Decimal('0'))

        adjustments = [a.to_dict() for a in report.adjustments]
        allocation_rows = [a.to_dict() for a in report.allocations]
        adjustment_totals = self._adjustment_totals(adjustments)
        provider_payments = verified_cost_amount + adjustment_totals['provider_payment']
        total_collection_expenses = expense_total + adjustment_totals['collection_expense']
        commission_retained = (commission if policy['commission_retained']
                               else adjustment_totals['commission_retained'])

        # Base is deliberately stored so reviewer adjustments can be applied to
        # a locked snapshot without re-reading mutable source tables or being
        # added twice. Personal cost credits are stored separately so a reviewer
        # can verify/reject them after submission without freezing an incorrect
        # expected remittance.
        pre_cost_expected = (_dec(report.opening_outstanding) + collections
                             - expense_total)
        base_expected = pre_cost_expected - verified_cost_amount
        expected = (base_expected
                    + adjustment_totals['authorized_receipt']
                    - adjustment_totals['provider_payment']
                    - adjustment_totals['collection_expense']
                    - adjustment_totals['authorized_refund']
                    - adjustment_totals['other_outflow']
                    - commission_retained)
        shortage = max(Decimal('0'), expected - momo_verified)
        surplus = max(Decimal('0'), momo_verified - expected)
        outstanding_delta = self._outstanding_adjustment_total(report)
        closing_outstanding = max(
            Decimal('0'), expected - momo_verified + outstanding_delta)

        source = {
            'policy': policy,
            'period': {
                'week_start': report.week_start.isoformat(),
                'week_end': report.week_end.isoformat(),
                'due_at': report.due_at.isoformat() if report.due_at else None,
                'label': report.period_label,
            },
            'agent': {
                'employee_id': report.employee_id,
                'name': report.employee.full_name if report.employee else None,
                'branch_id': report.branch_id,
            },
            'components': {
                'opening_outstanding': _str(report.opening_outstanding),
                'eligible_collections': _str(collections),
                'service_costs': _str(service_costs),
                'verified_service_costs': _str(verified_cost_amount),
                'eligible_expense_total': _str(expense_total),
                'pre_personal_cost_expected': _str(pre_cost_expected),
                'base_expected_remittance': _str(base_expected),
                'authorized_receipts': _str(adjustment_totals['authorized_receipt']),
                'verified_provider_payments': _str(provider_payments),
                'approved_collection_expenses': _str(total_collection_expenses),
                'authorized_refunds': _str(adjustment_totals['authorized_refund']),
                'other_outflows': _str(adjustment_totals['other_outflow']),
                'commission_retained': _str(commission_retained),
                'expected_remittance': _str(expected),
                'agent_reported_submitted': _str(momo_reported),
                'verified_submitted': _str(momo_verified),
                'declared_submitted_amount': _str(report.declared_submitted_amount),
                'submission_funding_source': report.submission_funding_source,
                'shortage_amount': _str(shortage),
                'surplus_amount': _str(surplus),
                'commission_earned': _str(commission),
                'closing_outstanding': _str(closing_outstanding),
            },
            'eligible_transaction_count': len(eligible),
            'transaction_count': len(txns),
            'transactions': txn_rows,
            'daily_closings': closing_rows,
            'missing_closings': missing,
            'closing_override': {
                'reason': report.missing_closing_override_reason,
                'authorized_by': report.missing_closing_override_by,
                'authorized_at': report.missing_closing_override_at.isoformat()
                if report.missing_closing_override_at else None,
            },
            'expenses': expense_rows,
            'momo_submissions': momo_rows,
            'official_cost_payments': claim_rows,
            'adjustments': adjustments,
            'allocations': allocation_rows,
            'declaration': {
                'declared_submitted_amount': _str(report.declared_submitted_amount),
                'submission_funding_source': report.submission_funding_source,
                'shortage_reason_category': report.shortage_reason_category,
                'shortage_explanation': report.shortage_explanation,
                'shortage_evidence_name': report.shortage_evidence_name,
                'expected_resolution_date': report.expected_resolution_date.isoformat()
                if report.expected_resolution_date else None,
                'override_reason': report.override_reason,
            },
            'workflow': {
                'status': report.status,
                'reviewer_id': report.reviewer_id,
                'approved_by': report.approved_by,
                'approved_at': report.approved_at.isoformat() if report.approved_at else None,
                'adjustment_count': len(adjustments),
            },
        }
        return self._with_statement(source)

    def _adjustment_totals(self, adjustments):
        totals = {
            'authorized_receipt': Decimal('0'),
            'provider_payment': Decimal('0'),
            'collection_expense': Decimal('0'),
            'authorized_refund': Decimal('0'),
            'other_outflow': Decimal('0'),
            'commission_retained': Decimal('0'),
        }
        for row in adjustments:
            kind = row.get('kind')
            if kind in totals:
                # original → adjusted is an audited delta, never a second
                # absolute amount added on top of the source total.
                totals[kind] += _dec(row.get('adjusted_amount')) - _dec(row.get('original_amount'))
        return totals

    def _with_statement(self, payload):
        c = payload['components']
        declaration = payload.get('declaration') or {}
        closing_rows = payload.get('daily_closings') or []
        present = sum(1 for row in closing_rows if row.get('closing_id'))
        override = payload.get('closing_override') or {}
        workflow = payload.get('workflow') or {}
        status = (payload['status']['name'] if isinstance(payload.get('status'), dict)
                  else payload.get('status') or workflow.get('status') or '')

        claim_count = len(payload.get('official_cost_payments') or [])
        verified_claims = sum(
            1 for row in (payload.get('official_cost_payments') or [])
            if row.get('personal_payment') and row.get('verification_status') == 'verified'
        )
        values = [
            _joined(payload['period'].get('label'), payload['agent'].get('name')),
            c['opening_outstanding'],
            str(payload['eligible_transaction_count']),
            c['eligible_collections'],
            _joined(c['service_costs'],
                    f'agent-paid verified={_str(c["verified_service_costs"])}',
                    f'claims={verified_claims}/{claim_count}'),
            c['authorized_receipts'],
            c['verified_provider_payments'],
            c['approved_collection_expenses'],
            c['authorized_refunds'],
            c['other_outflows'],
            c['commission_retained'],
            c['expected_remittance'],
            _joined(
                c['agent_reported_submitted'],
                f'declared={c["declared_submitted_amount"]}',
                f'funded_by={c["submission_funding_source"]}',
            ),
            c['verified_submitted'],
            c['shortage_amount'],
            c['surplus_amount'],
            _joined(
                declaration.get('shortage_reason_category'),
                declaration.get('shortage_explanation'),
                declaration.get('shortage_evidence_name'),
                declaration.get('expected_resolution_date'),
                declaration.get('override_reason'),
            ) or '—',
            c['commission_earned'],
            _joined(
                f'{present}/{len(closing_rows) or 7}',
                'missing: ' + ', '.join(payload.get('missing_closings') or [])
                if payload.get('missing_closings') else None,
                override.get('reason'),
            ),
            _joined(
                c['closing_outstanding'],
                f'allocations={len(payload.get("allocations") or [])}',
            ),
            _joined(
                status,
                f'adjustments={workflow.get("adjustment_count", len(payload.get("adjustments") or []))}',
                f'reviewer={workflow.get("reviewer_id")}' if workflow.get('reviewer_id') else None,
                f'approved_by={workflow.get("approved_by")}' if workflow.get('approved_by') else None,
            ),
        ]
        payload['statement'] = [
            {'item': i + 1, 'key': f'statement.{i + 1}', 'value': value}
            for i, value in enumerate(values[:21])
        ]
        return payload

    def refresh(self, report, actor=None, force=False):
        """Refresh a draft calculation; locked reports use the frozen snapshot."""
        if report.status in ('submitted', 'under_financial_review',
                             'returned_for_correction', 'approved', 'rejected'):
            if report.snapshot:
                payload = self.apply_overlays(_loads(report.snapshot), report)
                self._apply_calculation(report, payload)
                report.calculation = _json(payload)
            return _loads(report.calculation or report.snapshot, {})
        payload = self.build_calculation(report)
        self._apply_calculation(report, payload)
        payload['status'] = {'name': report.status}
        report.calculation = _json(self._with_statement(payload))
        return _loads(report.calculation)

    def apply_overlays(self, snapshot, report):
        """Reapply reviewer verification/adjustments to the frozen snapshot."""
        payload = copy.deepcopy(snapshot)
        momo_by_id = {m.id: m for m in report.momo_submissions}
        claim_by_id = {c.id: c for c in report.cost_payment_claims}
        verified_cost_amount = Decimal('0')

        # Cost amounts and source payment facts stay frozen in the snapshot;
        # only the reviewer's verification decision and note are live overlays,
        # exactly as for MoMo transfers.
        claim_rows = []
        claim_ids = set()
        for row in payload.get('official_cost_payments', []):
            claim = claim_by_id.get(row.get('id'))
            if claim is None:
                continue
            row['verification_status'] = claim.verification_status
            row['verified_by'] = claim.verified_by
            row['verified_at'] = claim.verified_at.isoformat() if claim.verified_at else None
            row['verification_note'] = claim.verification_note
            claim_rows.append(row)
            claim_ids.add(claim.id)
            verified_cost_amount += self._verified_cost_credit(claim)
        for extra in report.cost_payment_claims:
            if extra.id in claim_ids:
                continue
            row = extra.to_dict()
            claim_rows.append(row)
            claim_ids.add(extra.id)
            verified_cost_amount += self._verified_cost_credit(extra)
        payload['official_cost_payments'] = claim_rows
        claim_by_txn = {}
        for row in claim_rows:
            claim_by_txn.setdefault(row.get('transaction_id'), row)
        for txn_row in payload.get('transactions', []):
            claim_row = claim_by_txn.get(txn_row.get('id'))
            view = self._cost_claim_view(
                next((c for c in report.cost_payment_claims
                      if claim_row and c.id == claim_row.get('id')), None))
            txn_row['cost_payment_claim_id'] = view['id']
            txn_row['official_cost_payment_status'] = view['verification_status']
            txn_row['personal_payment'] = view['personal_payment']
            txn_row['personal_payment_amount'] = view['amount']
            txn_row['personal_payment_reference'] = view['reference']
            txn_row['personal_payment_evidence_name'] = view['evidence_name']
            txn_row['personal_payment_note'] = view['verification_note']

        momo_reported = Decimal('0')
        momo_verified = Decimal('0')
        live_rows = []
        live_ids = set()
        for row in payload.get('momo_submissions', []):
            source = momo_by_id.get(row.get('id'))
            if source is None:
                # A transfer deleted while the report was returned for
                # correction must not remain in the locked statement.
                continue
            row['verification_status'] = source.verification_status
            row['verified_by'] = source.verified_by
            row['verification_note'] = source.verification_note
            live_rows.append(row)
            live_ids.add(source.id)
            momo_reported += _dec(row['amount'])
            if source.verification_status == 'verified':
                momo_verified += _dec(row['amount'])
        for extra in report.momo_submissions:
            if extra.id not in live_ids:
                row = {
                    'id': extra.id, 'provider': extra.provider, 'reference': extra.reference,
                    'amount': _str(extra.amount),
                    'submitted_at': extra.submitted_at.isoformat() if extra.submitted_at else None,
                    'sender_phone': MoMoSubmission.mask_phone(extra.sender_phone),
                    'recipient_phone': MoMoSubmission.mask_phone(extra.recipient_phone),
                    'confirmation_code': extra.confirmation_code,
                    'notes': extra.notes, 'evidence_path': extra.evidence_path,
                    'evidence_name': extra.evidence_name,
                    'verification_status': extra.verification_status,
                    'verified_by': extra.verified_by,
                    'verification_note': extra.verification_note,
                }
                live_rows.append(row)
                live_ids.add(extra.id)
                momo_reported += _dec(row['amount'])
                if extra.verification_status == 'verified':
                    momo_verified += _dec(row['amount'])
        payload['momo_submissions'] = live_rows

        payload['adjustments'] = [a.to_dict() for a in report.adjustments]
        payload['allocations'] = [a.to_dict() for a in report.allocations]
        payload['declaration'] = {
            'declared_submitted_amount': _str(report.declared_submitted_amount),
            'submission_funding_source': report.submission_funding_source,
            'shortage_reason_category': report.shortage_reason_category,
            'shortage_explanation': report.shortage_explanation,
            'shortage_evidence_name': report.shortage_evidence_name,
            'expected_resolution_date': report.expected_resolution_date.isoformat()
            if report.expected_resolution_date else None,
            'override_reason': report.override_reason,
        }
        payload['closing_override'] = {
            'reason': report.missing_closing_override_reason,
            'authorized_by': report.missing_closing_override_by,
            'authorized_at': report.missing_closing_override_at.isoformat()
            if report.missing_closing_override_at else None,
        }
        payload['workflow'] = {
            'status': report.status,
            'reviewer_id': report.reviewer_id,
            'approved_by': report.approved_by,
            'approved_at': report.approved_at.isoformat() if report.approved_at else None,
            'adjustment_count': len(payload['adjustments']),
        }
        totals = self._adjustment_totals(payload['adjustments'])
        c = payload.setdefault('components', {})
        policy = payload.get('policy') or get_policy()
        # Snapshot stores source totals before reviewer adjustments. Personal
        # official-cost credits are a live overlay so verification decisions
        # recorded after submission are reflected without rewriting source rows.
        base_expenses = _dec(c.get('eligible_expense_total',
                                   c.get('approved_collection_expenses')))
        pre_cost_expected = c.get('pre_personal_cost_expected')
        if pre_cost_expected is None:
            base_expected = (_dec(c.get('expected_remittance'))
                             - _dec(c.get('authorized_receipts'))
                             + _dec(c.get('verified_provider_payments'))
                             - _dec(c.get('eligible_expense_total',
                                          c.get('approved_collection_expenses')))
                             + _dec(c.get('authorized_refunds'))
                             + _dec(c.get('other_outflows'))
                             + _dec(c.get('commission_retained')))
            # Older snapshots embedded the old payment-status-derived cost in
            # `base_expected_remittance`; remove it to recover the source base.
            if c.get('base_expected_remittance'):
                base_expected = _dec(c['base_expected_remittance'])
            pre_cost_expected = base_expected + _dec(c.get('verified_service_costs'))
        pre_cost_expected = _dec(pre_cost_expected)
        verified_costs = (verified_cost_amount
                          if policy.get('deduct_verified_service_costs', True)
                          else Decimal('0'))
        base_expected = pre_cost_expected - verified_costs
        provider_payments = verified_costs + totals['provider_payment']
        collection_expenses = base_expenses + totals['collection_expense']
        commission_retained = (_dec(c.get('commission_earned'))
                               if policy.get('commission_retained')
                               else totals['commission_retained'])
        expected = (base_expected
                    + totals['authorized_receipt']
                    - totals['provider_payment']
                    - totals['collection_expense']
                    - totals['authorized_refund']
                    - totals['other_outflow']
                    - commission_retained)
        closing_outstanding = max(
            Decimal('0'),
            expected - momo_verified + self._outstanding_adjustment_total(report),
        )
        c['pre_personal_cost_expected'] = _str(pre_cost_expected)
        c['base_expected_remittance'] = _str(base_expected)
        c['eligible_expense_total'] = _str(base_expenses)
        c['verified_service_costs'] = _str(verified_costs)
        c['authorized_receipts'] = _str(totals['authorized_receipt'])
        c['verified_provider_payments'] = _str(provider_payments)
        c['approved_collection_expenses'] = _str(collection_expenses)
        c['authorized_refunds'] = _str(totals['authorized_refund'])
        c['other_outflows'] = _str(totals['other_outflow'])
        c['commission_retained'] = _str(commission_retained)
        c['expected_remittance'] = _str(expected)
        c['agent_reported_submitted'] = _str(momo_reported)
        c['verified_submitted'] = _str(momo_verified)
        c['declared_submitted_amount'] = _str(report.declared_submitted_amount)
        c['submission_funding_source'] = report.submission_funding_source
        c['shortage_amount'] = _str(max(Decimal('0'), expected - momo_verified))
        c['surplus_amount'] = _str(max(Decimal('0'), momo_verified - expected))
        c['opening_outstanding'] = _str(report.opening_outstanding)
        c['closing_outstanding'] = _str(closing_outstanding)
        payload['status'] = {'name': report.status}
        return self._with_statement(payload)

    def _apply_calculation(self, report, payload):
        c = payload.get('components', {})
        report.opening_outstanding = _dec(c.get('opening_outstanding'))
        report.eligible_collections = _dec(c.get('eligible_collections'))
        report.service_costs = _dec(c.get('service_costs'))
        report.authorized_receipts = _dec(c.get('authorized_receipts'))
        report.verified_provider_payments = _dec(c.get('verified_provider_payments'))
        report.approved_collection_expenses = _dec(c.get('approved_collection_expenses'))
        report.authorized_refunds = _dec(c.get('authorized_refunds'))
        report.other_outflows = _dec(c.get('other_outflows'))
        report.commission_retained = _dec(c.get('commission_retained'))
        report.expected_remittance = _dec(c.get('expected_remittance'))
        report.agent_reported_submitted = _dec(c.get('agent_reported_submitted'))
        report.verified_submitted = _dec(c.get('verified_submitted'))
        report.shortage_amount = _dec(c.get('shortage_amount'))
        report.surplus_amount = _dec(c.get('surplus_amount'))
        report.commission_earned = _dec(c.get('commission_earned'))
        if c.get('closing_outstanding') is not None:
            report.closing_outstanding = _dec(c['closing_outstanding'])

    # ── workflow ───────────────────────────────────────────────────────────

    def transition(self, report, target, actor=None, reason=None, audit_action=None):
        if target not in WEEKLY_REPORT_TRANSITIONS.get(report.status, []):
            raise WeeklyReportError(
                f'Cannot move report from {report.status} to {target}',
                'weekly_report.invalid_transition', 409)
        previous = report.status
        report.status = target
        if target == 'late':
            report.is_late = True
        if target == 'submitted':
            report.submitted_by = actor.id if actor else report.submitted_by
            report.submitted_at = datetime.now(timezone.utc)
            report.reviewer_id = None
            report.reviewed_at = None
            report.correction_note = None
            report.rejection_reason = None
        if target == 'under_financial_review':
            report.reviewer_id = actor.id if actor else None
            report.reviewed_at = datetime.now(timezone.utc)
        if target == 'returned_for_correction':
            report.correction_note = reason
        if target == 'rejected':
            report.rejection_reason = reason
            report.rejected_at = datetime.now(timezone.utc)
        audit(audit_action or f'weekly_report_{target}', 'weekly_report', report.id,
              previous_value={'status': previous},
              new_value={'status': target, 'version': report.current_version},
              user=actor, reason=reason)
        return report

    @staticmethod
    def _parse_declared_amount(value):
        try:
            amount = _dec(value)
        except (InvalidOperation, ValueError, TypeError):
            raise WeeklyReportError('Amount submitted must be a valid number',
                                    'weekly_report.invalid_amount', 400)
        if amount < 0:
            raise WeeklyReportError('Amount submitted cannot be negative',
                                    'weekly_report.invalid_amount', 400)
        return amount

    def update_draft(self, report, data, actor):
        if report.status not in ('draft', 'ready_for_submission',
                                 'returned_for_correction', 'late'):
            raise WeeklyReportError(
                'A submitted report is locked; request a correction instead.',
                'weekly_report.locked', 409)
        allowed = {
            'shortage_reason_category': 'shortage_reason_category',
            'shortage_explanation': 'shortage_explanation',
            'expected_resolution_date': 'expected_resolution_date',
            'override_reason': 'override_reason',
            'declared_submitted_amount': 'declared_submitted_amount',
            'submission_funding_source': 'submission_funding_source',
        }
        previous = {}
        for key, attr in allowed.items():
            # An empty string clears optional text fields but never erases a
            # money declaration or its required funding source.
            if key not in data or (key in ('declared_submitted_amount',
                                          'submission_funding_source')
                                   and data.get(key) in (None, '')):
                continue
            previous[attr] = getattr(report, attr)
            value = data.get(key)
            if key == 'expected_resolution_date' and value:
                try:
                    value = date.fromisoformat(str(value))
                except ValueError:
                    raise WeeklyReportError('Invalid expected resolution date',
                                            'weekly_report.invalid_date', 400)
            elif key == 'declared_submitted_amount':
                value = self._parse_declared_amount(value)
            elif key == 'submission_funding_source':
                value = str(value).strip()
                if value not in WEEKLY_SUBMISSION_SOURCES:
                    raise WeeklyReportError(
                        'Funding source must be agent_phone, company or someone_else',
                        'weekly_report.invalid_submission_source', 400)
            setattr(report, attr, value)
        if previous:
            audit('weekly_report_draft_updated', 'weekly_report', report.id,
                  previous_value=previous,
                  new_value={k: getattr(report, k) for k in previous}, user=actor)
        self.refresh(report, actor)
        return report

    def submit(self, report, data, actor, files=None):
        if report.status in ('approved', 'rejected'):
            raise WeeklyReportError('Report is closed', 'weekly_report.locked', 409)
        if report.status not in ('draft', 'ready_for_submission', 'late',
                                 'returned_for_correction'):
            raise WeeklyReportError('Report cannot be submitted in its current state',
                                    'weekly_report.invalid_transition', 409)
        policy = get_policy()
        if policy['late_policy'] == 'block' and is_late(report.week_start, policy=policy):
            raise WeeklyReportError(
                'Late submissions are blocked by the current reporting policy.',
                'weekly_report.late_blocked', 403)
        if data.get('shortage_reason_category'):
            report.shortage_reason_category = data.get('shortage_reason_category')
        if data.get('shortage_explanation'):
            report.shortage_explanation = data.get('shortage_explanation')
        if data.get('expected_resolution_date'):
            try:
                report.expected_resolution_date = date.fromisoformat(str(data['expected_resolution_date']))
            except ValueError:
                raise WeeklyReportError('Invalid expected resolution date',
                                        'weekly_report.invalid_date', 400)
        if data.get('declared_submitted_amount') not in (None, ''):
            report.declared_submitted_amount = self._parse_declared_amount(
                data['declared_submitted_amount'])
        if data.get('submission_funding_source') not in (None, ''):
            source = str(data['submission_funding_source']).strip()
            if source not in WEEKLY_SUBMISSION_SOURCES:
                raise WeeklyReportError(
                    'Funding source must be agent_phone, company or someone_else',
                    'weekly_report.invalid_submission_source', 400)
            report.submission_funding_source = source

        evidence = (files or {}).get('evidence')
        evidence_provided = bool(evidence and evidence.filename)

        # Validate the declaration before writing evidence to disk. A rejected
        # submission must not leave an orphaned file behind.
        calc = self.refresh(report, actor)
        c = calc.get('components', {})
        shortage = _dec(c.get('shortage_amount'))
        if shortage > 0:
            if data.get('override_reason'):
                report.override_reason = data['override_reason']
            category_valid = report.shortage_reason_category in SHORTAGE_REASON_CATEGORIES
            explained = bool(category_valid and report.shortage_explanation)
            evidenced = (bool(report.shortage_evidence_path) or evidence_provided
                         or not policy['shortage_requires_evidence'])
            resolution_dated = bool(report.expected_resolution_date)
            authorized = bool(report.override_reason and report.override_authorized_by)
            if not authorized:
                if not explained:
                    raise WeeklyReportError(
                        'A valid shortage category and detailed explanation are required.',
                        'weekly_report.shortage_explanation', 400)
                if not evidenced:
                    raise WeeklyReportError('Evidence is required when a shortage is reported.',
                                            'weekly_report.shortage_evidence', 400)
                if not resolution_dated:
                    raise WeeklyReportError(
                        'An expected resolution date is required for a shortage.',
                        'weekly_report.shortage_resolution', 400)

        if evidence_provided:
            report.shortage_evidence_path = self._store_evidence(evidence, report, 'shortage')
            report.shortage_evidence_name = evidence.filename[:255]

        # Snap the source-of-truth calculation before any workflow mutation.
        calc = self.build_calculation(report)
        calc['status'] = {'name': 'submitted'}
        payload = self._with_statement(calc)
        report.snapshot = _json(payload)
        report.calculation = _json(payload)
        self._apply_calculation(report, payload)
        report.current_version += 1

        if report.status != 'ready_for_submission':
            self.transition(report, 'ready_for_submission', actor,
                            audit_action='weekly_report_marked_ready')
        self.transition(report, 'submitted', actor,
                        reason=data.get('submission_note'),
                        audit_action='weekly_report_submitted')

        # An expense may only be deducted once, permanently.
        for row in payload.get('expenses', []):
            exists = WeeklyReportExpense.query.filter_by(expense_id=row['id']).first()
            if not exists:
                db.session.add(WeeklyReportExpense(
                    report_id=report.id, expense_id=row['id'],
                    amount=_dec(row['amount']), status=row.get('payment_status', 'approved')))

        from .notifications import notify_weekly_reviewers, notify
        message = bilingual('notification.submitted', period=report.period_label,
                            agent=report.employee.full_name if report.employee else 'agent')
        notify_weekly_reviewers(
            report, 'weekly_report_submitted', message,
            related_id=report.id, rule='weekly-report-review')
        if shortage > 0:
            notify_weekly_reviewers(
                report, 'weekly_report_shortage',
                bilingual('notification.shortage', period=report.period_label,
                          amount=f'{shortage:,.0f} RWF'),
                severity='critical', related_id=report.id,
                rule='weekly-report-shortage')
        if report.employee and report.employee.user_id:
            notify(report.employee.user_id, 'weekly_report_submitted_ack',
                   bilingual('notification.submitted_ack', period=report.period_label),
                   related_type='weekly_report', related_id=report.id)
        return report, payload

    def _store_evidence(self, file, report, kind):
        import os
        from werkzeug.utils import secure_filename
        ext = (file.filename.rsplit('.', 1)[-1] or '').lower()
        if ext not in ('pdf', 'png', 'jpg', 'jpeg', 'webp'):
            raise WeeklyReportError('Unsupported evidence file type',
                                    'weekly_report.invalid_evidence', 400)
        folder = os.path.join(current_app.config['UPLOAD_FOLDER'], 'weekly_reports',
                              str(report.id))
        os.makedirs(folder, exist_ok=True)
        file.seek(0, os.SEEK_END)
        size = file.tell()
        file.seek(0)
        if size > 10 * 1024 * 1024:
            raise WeeklyReportError('Evidence file is too large (max 10 MB)',
                                    'weekly_report.invalid_evidence', 400)
        name = f'{kind}_{uuid.uuid4().hex}_{secure_filename(file.filename)}'
        file.save(os.path.join(folder, name))
        return f'/uploads/weekly_reports/{report.id}/{name}'

    @staticmethod
    def _require_editable(report):
        if report.status in ('submitted', 'under_financial_review', 'approved', 'rejected'):
            raise WeeklyReportError(
                'This report is locked; request a correction before overriding it.',
                'weekly_report.locked', 409)

    def authorize_shortage_override(self, report, reason, actor):
        self._require_editable(report)
        if not reason:
            raise WeeklyReportError('An override reason is required',
                                    'weekly_report.override_reason_required', 400)
        policy = get_policy()
        if not policy['allow_override']:
            raise WeeklyReportError('Overrides are disabled by policy',
                                    'weekly_report.override_disabled', 403)
        previous = report.override_reason
        report.override_reason = reason
        report.override_authorized_by = actor.id
        report.override_authorized_at = datetime.now(timezone.utc)
        audit('weekly_report_shortage_override_authorized', 'weekly_report', report.id,
              previous_value={'override_reason': previous},
              new_value={'override_reason': reason}, user=actor, reason=reason)
        from .notifications import notify_weekly_reviewers
        notify_weekly_reviewers(
            report, 'weekly_override_requested',
            bilingual('notification.override_requested', period=report.period_label),
            severity='warning', related_id=report.id,
            rule='weekly-report-override')
        return report

    def acknowledge_missing_closings(self, report, reason, actor):
        self._require_editable(report)
        if not reason:
            raise WeeklyReportError('A reason is required to override missing closings',
                                    'weekly_report.override_reason_required', 400)
        report.missing_closing_override_reason = reason
        report.missing_closing_override_by = actor.id
        report.missing_closing_override_at = datetime.now(timezone.utc)
        audit('weekly_report_missing_closings_authorized', 'weekly_report', report.id,
              new_value={'reason': reason}, user=actor, reason=reason)
        return report

    def verify_momo(self, report, submission, decision, actor, note=None):
        if report.status not in ('submitted', 'under_financial_review',
                                 'returned_for_correction'):
            raise WeeklyReportError('Money submissions can only be reviewed after submission',
                                    'weekly_report.locked', 409)
        if decision not in ('verified', 'rejected', 'pending'):
            raise WeeklyReportError('Invalid verification decision',
                                    'weekly_report.invalid_decision', 400)
        if report.status == 'submitted':
            self.transition(report, 'under_financial_review', actor,
                            audit_action='weekly_report_review_started')
        previous = {'status': submission.verification_status,
                    'note': submission.verification_note}
        submission.verification_status = decision
        submission.verification_note = note
        submission.verified_by = actor.id
        submission.verified_at = datetime.now(timezone.utc)
        audit(f'weekly_momo_{decision}', 'weekly_momo_submission', submission.id,
              previous_value=previous,
              new_value={'status': decision, 'note': note}, user=actor, reason=note)
        if report.employee and report.employee.user_id:
            from .notifications import notify
            notify(report.employee.user_id, 'weekly_momo_verified',
                   ' / '.join((
                       t('notification.momo_verified', 'en', reference=submission.reference,
                         status=t(f'status.{decision}', 'en')),
                       t('notification.momo_verified', 'rw', reference=submission.reference,
                         status=t(f'status.{decision}', 'rw')),
                   )),
                   related_type='weekly_report', related_id=report.id)
        self.refresh(report, actor)
        return submission

    def add_cost_payment(self, report, data, actor, evidence=None):
        """Record who actually funded an official service cost.

        A ``False`` personal-payment answer is kept for audit but carries zero
        credit. A ``True`` answer only becomes deductible after a reviewer has
        verified the claim, its reference and its evidence.
        """
        self._require_editable(report)
        try:
            txn_id = int(data.get('transaction_id'))
        except (TypeError, ValueError):
            raise WeeklyReportError('A transaction is required',
                                    'weekly_report.claim_transaction_required', 400)
        txn = (ServiceTransaction.query
               .filter_by(id=txn_id, employee_id=report.employee_id).first())
        if txn is None or not in_week(txn.transaction_date, report.week_start):
            raise WeeklyReportError('Transaction not found in this reporting week',
                                    'weekly_report.claim_transaction_invalid', 404)
        if OfficialCostPayment.query.filter_by(report_id=report.id,
                                               transaction_id=txn.id).first():
            raise WeeklyReportError('This official cost already has a payment claim',
                                    'weekly_report.claim_duplicate', 409)

        calc = self.calculation_view(report)
        source_row = next((r for r in calc.get('transactions', []) if r.get('id') == txn.id), None)
        customer_status = source_row.get('payment_status') if source_row else 'unknown'
        official_cost = _dec(txn.official_cost)
        raw_personal = data.get('personal_payment')
        if isinstance(raw_personal, bool):
            personal = raw_personal
        else:
            personal = str(raw_personal or '').strip().lower() in ('1', 'true', 'yes', 'on')

        now = datetime.now(timezone.utc)
        if not personal:
            # Capture the negative answer without creating any deductible money.
            amount = Decimal('0')
            provider = 'not_applicable'
            reference = f'NA-{txn.id}'
            sender_phone = None
            paid_at = now
            reference_key = f'not-applicable:{txn.id}:{uuid.uuid4().hex[:8]}'
            evidence_path = evidence_name = content_type = None
            size_bytes = None
        else:
            try:
                amount = _dec(data.get('amount'))
            except Exception:
                raise WeeklyReportError('A valid personally paid amount is required',
                                        'weekly_report.claim_invalid_amount', 400)
            if amount <= 0 or amount > official_cost:
                raise WeeklyReportError(
                    f'Personal payment must be greater than zero and at most {official_cost:.2f}',
                    'weekly_report.claim_invalid_amount', 400)
            provider = (data.get('provider') or '').strip().lower()
            if provider not in MOMO_PROVIDERS:
                raise WeeklyReportError('Invalid personal payment provider',
                                        'weekly_report.claim_invalid_provider', 400)
            reference = (data.get('reference') or '').strip().upper()
            if len(reference) < 4:
                raise WeeklyReportError('A payment reference is required',
                                        'weekly_report.claim_reference_required', 400)
            sender_phone = (data.get('sender_phone') or '').strip() or None
            if not sender_phone:
                raise WeeklyReportError('The sender phone used to pay the cost is required',
                                        'weekly_report.claim_sender_required', 400)
            paid_raw = data.get('paid_at')
            try:
                if paid_raw:
                    paid_at = datetime.fromisoformat(str(paid_raw).replace('Z', '+00:00'))
                    if paid_at.tzinfo is None:
                        paid_at = paid_at.replace(
                            tzinfo=business_timezone(report.timezone_name)).astimezone(timezone.utc)
                else:
                    paid_at = now
            except ValueError:
                raise WeeklyReportError('Invalid payment date/time',
                                        'weekly_report.claim_invalid_date', 400)
            if not in_week(paid_at, report.week_start, get_policy()):
                raise WeeklyReportError(
                    'Personal payment date must fall within the Sunday–Saturday reporting week',
                    'weekly_report.claim_invalid_date', 400)
            normalized_sender = ''.join(ch for ch in sender_phone if ch.isdigit() or ch == '+')
            reference_key = f'{provider}:{reference}:{normalized_sender}'.upper()
            if OfficialCostPayment.query.filter_by(reference_key=reference_key).first():
                raise WeeklyReportError('That personal payment reference already exists',
                                        'weekly_report.claim_duplicate', 409)
            if evidence is None or not getattr(evidence, 'filename', None):
                raise WeeklyReportError('Evidence is required for a personal cost payment',
                                        'weekly_report.claim_evidence_required', 400)
            evidence_path = self._store_evidence(evidence, report, 'official_cost')
            evidence_name = evidence.filename[:255]
            content_type = evidence.mimetype
            size_bytes = os.path.getsize(
                os.path.join(current_app.config['UPLOAD_FOLDER'],
                             evidence_path.replace('/uploads/', '')))

        claim = OfficialCostPayment(
            report_id=report.id, transaction_id=txn.id, employee_id=report.employee_id,
            reference_key=reference_key, official_cost=official_cost,
            customer_payment_status=customer_status, personal_payment=personal,
            amount=amount, is_partial=bool(personal and amount < official_cost),
            provider=provider, reference=reference, paid_at=paid_at,
            sender_phone=sender_phone, evidence_path=evidence_path,
            evidence_name=evidence_name, content_type=content_type,
            size_bytes=size_bytes, notes=data.get('notes'),
            verification_status='pending', created_by=actor.id)
        db.session.add(claim)
        try:
            db.session.flush()
        except Exception:
            db.session.rollback()
            # A concurrent duplicate can fail only after the file was written;
            # do not leave an unreferenced evidence file behind.
            if evidence_path:
                try:
                    os.remove(os.path.join(current_app.config['UPLOAD_FOLDER'],
                                           evidence_path.replace('/uploads/', '')))
                except OSError:
                    pass
            raise WeeklyReportError('Duplicate or invalid official cost payment claim',
                                    'weekly_report.claim_duplicate', 409)
        audit('weekly_cost_payment_submitted', 'weekly_official_cost_payment', claim.id,
              new_value={'transaction_id': txn.id, 'amount': _str(amount),
                         'personal_payment': personal}, user=actor)
        if personal:
            from .notifications import notify_weekly_reviewers
            notify_weekly_reviewers(
                report, 'weekly_cost_payment_submitted',
                bilingual('notification.cost_payment_submitted',
                          reference=reference, period=report.period_label),
                related_id=report.id, rule='weekly-report-cost-payment')
        self.refresh(report, actor)
        return claim

    def delete_cost_payment(self, report, claim, actor):
        self._require_editable(report)
        previous = claim.to_dict()
        audit('weekly_cost_payment_deleted', 'weekly_official_cost_payment', claim.id,
              previous_value=previous, user=actor)
        db.session.delete(claim)
        self.refresh(report, actor)
        return claim

    def verify_cost_payment(self, report, claim, decision, actor, note=None):
        if report.status not in ('submitted', 'under_financial_review',
                                 'returned_for_correction'):
            raise WeeklyReportError('Cost payments can only be reviewed after submission',
                                    'weekly_report.locked', 409)
        if decision not in COST_PAYMENT_VERIFICATION_STATUSES:
            raise WeeklyReportError('Invalid cost payment decision',
                                    'weekly_report.invalid_decision', 400)
        if decision == 'verified' and not claim.personal_payment:
            raise WeeklyReportError(
                'A cost not paid from the agent’s own funds cannot be verified for deduction',
                'weekly_report.claim_not_personal', 409)
        if decision == 'rejected' and not (note or '').strip():
            raise WeeklyReportError('A rejection reason is required',
                                    'weekly_report.claim_reason_required', 400)
        if report.status == 'submitted':
            self.transition(report, 'under_financial_review', actor,
                            audit_action='weekly_report_review_started')
        previous = {'status': claim.verification_status, 'note': claim.verification_note}
        claim.verification_status = decision
        claim.verification_note = note
        claim.verified_by = actor.id
        claim.verified_at = datetime.now(timezone.utc)
        audit(f'weekly_cost_payment_{decision}', 'weekly_official_cost_payment', claim.id,
              previous_value=previous,
              new_value={'status': decision, 'note': note}, user=actor, reason=note)
        if report.employee and report.employee.user_id:
            from .notifications import notify
            notify(report.employee.user_id, 'weekly_cost_payment_verified',
                   ' / '.join((
                       t('notification.cost_payment_verified', 'en',
                         reference=claim.reference, status=t(f'status.{decision}', 'en')),
                       t('notification.cost_payment_verified', 'rw',
                         reference=claim.reference, status=t(f'status.{decision}', 'rw')),
                   )), related_type='weekly_report', related_id=report.id)
        self.refresh(report, actor)
        return claim

    def add_adjustment(self, report, data, actor):
        if report.status not in ('submitted', 'under_financial_review',
                                 'returned_for_correction'):
            raise WeeklyReportError('Adjustments require a submitted report',
                                    'weekly_report.locked', 409)
        kind = data.get('kind')
        if kind not in ADJUSTMENT_KINDS:
            raise WeeklyReportError('Invalid adjustment kind',
                                    'weekly_report.invalid_adjustment', 400)
        reason = (data.get('reason') or '').strip()
        if len(reason) < 5:
            raise WeeklyReportError('A documented adjustment reason is required',
                                    'weekly_report.reason_required', 400)
        try:
            original = _dec(data.get('original_amount'))
            adjusted = _dec(data.get('adjusted_amount'))
        except Exception:
            raise WeeklyReportError('Invalid adjustment amount',
                                    'weekly_report.invalid_amount', 400)
        adjustment = WeeklyReportAdjustment(
            report_id=report.id, kind=kind, label=data.get('label'),
            original_amount=original, adjusted_amount=adjusted,
            reason=reason, actor_id=actor.id)
        db.session.add(adjustment)
        db.session.flush()

        if kind in ('outstanding_correction', 'outstanding_waiver'):
            delta = adjusted - original
            if kind == 'outstanding_waiver':
                delta = -abs(adjusted if adjusted else original)
            allocation = OutstandingAllocation(
                employee_id=report.employee_id, report_id=report.id,
                reference_key=f'{kind}:{adjustment.id}', kind=kind,
                amount=delta, reason=reason, actor_id=actor.id)
            db.session.add(allocation)
            # The refresh below derives the projected closing balance from the
            # allocation history, so do not mutate it here as well.

        audit('weekly_report_adjustment_recorded', 'weekly_report_adjustment', adjustment.id,
              new_value=adjustment.to_dict(), user=actor, reason=reason)
        self.refresh(report, actor)
        return adjustment

    def request_correction(self, report, reason, actor):
        self.transition(report, 'returned_for_correction', actor, reason=reason)
        if report.employee and report.employee.user_id:
            from .notifications import notify
            notify(report.employee.user_id, 'weekly_report_returned',
                   bilingual('notification.returned', period=report.period_label),
                   severity='warning', related_type='weekly_report', related_id=report.id)
        return report

    def decide(self, report, decision, actor, reason=None):
        if report.status == 'submitted':
            self.transition(report, 'under_financial_review', actor,
                            audit_action='weekly_report_review_started')
        if decision == 'approve':
            self.transition(report, 'approved', actor, reason=reason)
            calc = self.refresh(report, actor)
            c = calc.get('components', {})
            # Expected remittance already includes the opening balance; the
            # remaining gap after verified submissions is the carry-forward.
            report.closing_outstanding = _dec(c.get('closing_outstanding'))
            report.approved_by = actor.id
            report.approved_at = datetime.now(timezone.utc)
            if report.snapshot:
                payload = _loads(report.snapshot)
                if payload.get('components'):
                    payload['components']['closing_outstanding'] = _str(report.closing_outstanding)
                    report.snapshot = _json(payload)
            audit('weekly_report_approved', 'weekly_report', report.id,
                  new_value={'closing_outstanding': _str(report.closing_outstanding)},
                  user=actor, reason=reason)
            if report.employee and report.employee.user_id:
                from .notifications import notify
                notify(report.employee.user_id, 'weekly_report_approved',
                       bilingual('notification.approved', period=report.period_label),
                       related_type='weekly_report', related_id=report.id)
        elif decision == 'reject':
            if not reason:
                raise WeeklyReportError('A rejection reason is required',
                                        'weekly_report.reason_required', 400)
            self.transition(report, 'rejected', actor, reason=reason)
            if report.employee and report.employee.user_id:
                from .notifications import notify
                notify(report.employee.user_id, 'weekly_report_rejected',
                       bilingual('notification.rejected', period=report.period_label),
                       severity='critical', related_type='weekly_report', related_id=report.id)
        else:
            raise WeeklyReportError('Invalid review decision',
                                    'weekly_report.invalid_decision', 400)
        return report

    # ── serialized detail ──────────────────────────────────────────────────

    def calculation_view(self, report):
        """Return the current calculation without writing it back to the DB."""
        if report.snapshot:
            return self.apply_overlays(_loads(report.snapshot), report)
        payload = self.build_calculation(report)
        payload['status'] = {'name': report.status}
        return payload

    def detail(self, report, actor=None, refresh=False):
        if refresh:
            calc = self.refresh(report, actor)
        else:
            calc = self.calculation_view(report)
        payload = dict(report.to_dict())
        # A GET must be read-only: expose the freshly derived overlay values in
        # the response without mutating the persisted row or its snapshot.
        amounts = (
            'opening_outstanding', 'eligible_collections', 'service_costs',
            'authorized_receipts', 'verified_provider_payments',
            'approved_collection_expenses', 'authorized_refunds', 'other_outflows',
            'commission_retained', 'expected_remittance', 'agent_reported_submitted',
            'verified_submitted', 'declared_submitted_amount',
            'shortage_amount', 'surplus_amount',
            'commission_earned', 'closing_outstanding',
        )
        components = calc.get('components', {})
        for key in amounts:
            if key in components:
                payload[key] = float(_dec(components[key]))
        payload['calculation'] = calc
        payload['momo_submissions'] = [m.to_dict() for m in report.momo_submissions]
        payload['cost_payment_claims'] = [c.to_dict() for c in report.cost_payment_claims]
        payload['adjustments'] = [a.to_dict() for a in report.adjustments]
        payload['allocations'] = [a.to_dict() for a in report.allocations]
        payload['allowed_transitions'] = WEEKLY_REPORT_TRANSITIONS.get(report.status, [])
        return payload

    def statement_rows(self, report, lang='en'):
        # Read-only and authoritative: draft exports use live source records,
        # locked exports use the snapshot plus reviewer overlays.
        calc = self.calculation_view(report)
        rows = []
        for row in calc.get('statement', []):
            rows.append({
                'item': row['item'],
                'label': t(row['key'], lang),
                'value': row['value'],
            })
        return rows, calc
