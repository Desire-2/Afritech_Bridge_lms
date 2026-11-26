"""Weekly financial report and money submission API (backend-authoritative)."""
import json
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify, current_app, send_file

from ..extensions import db
from ..models import (
    AuditLog, Branch, Employee, MoMoSubmission, OfficialCostPayment, Setting, User,
    WeeklyReport, MOMO_PROVIDERS, SHORTAGE_REASON_CATEGORIES,
    AGENT_SHORTAGE_REASON_CATEGORIES, OFFICIAL_COST_PAYMENT_SOURCES,
    WEEKLY_REPORT_STATUSES, WEEKLY_SUBMISSION_SOURCES,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.weekly_policy import (
    WeekPolicyError, available_weeks, business_timezone, get_policy, money,
    normalize_week_start, require_week_start, week_bounds, week_end_for,
)
from ..services.weekly_report_service import (
    WeeklyReportService, WeeklyReportError, has_personal_cost_credit,
    is_company_funded_service,
)
from ..services.weekly_i18n import SUPPORTED_LANGUAGES, t
from .helpers import (
    json_error, paginate, paginate_payload, paginate_response,
    parse_date, parse_id, parse_json,
)

bp = Blueprint('weekly_reports', __name__, url_prefix='/api/weekly-reports')
service = WeeklyReportService()

VIEW_ANY = ('weekly_reports.view', 'weekly_reports.review', 'weekly_reports.adjust',
            'weekly_reports.manage', 'weekly_reports.export')


def _error(exc):
    return json_error(exc.message, exc.status, exc.code,
                      getattr(exc, 'field', None), getattr(exc, 'details', None))


def _is_reviewer(user):
    return any(user.has_permission(p) for p in (
        'weekly_reports.review', 'weekly_reports.manage')) or user.is_super_admin


def _is_manager_scoped(user):
    """Manager oversight is branch-scoped; Accountant/Admin is system-wide."""
    if user.is_super_admin or user.has_permission('weekly_reports.manage') and 'manager' not in user.role_codes:
        return False
    return 'manager' in user.role_codes and 'accountant' not in user.role_codes


def _can_access(user, report, write=False):
    if user is None:
        return False
    if user.is_super_admin:
        return True
    if _is_reviewer(user):
        if _is_manager_scoped(user):
            mine = current_employee()
            if not mine or report.branch_id != mine.branch_id:
                return False
        return True
    if user.has_permission('weekly_reports.view') or user.has_permission('weekly_reports.export'):
        emp = current_employee()
        return bool(emp and report.employee_id == emp.id)
    return False


def _report_or_404(report_id, user, write=False):
    report = WeeklyReport.query.get(report_id)
    if not report:
        return None, json_error('Weekly report not found', 404)
    if not _can_access(user, report, write):
        return None, json_error('You do not have access to this weekly report', 403)
    return report, None


@bp.errorhandler(WeeklyReportError)
def handle_weekly_error(exc):
    return _error(exc)


@bp.get('/policy')
@require_any_permission(*VIEW_ANY)
def policy():
    return jsonify({
        'policy': get_policy(),
        'statuses': WEEKLY_REPORT_STATUSES,
        'shortage_reason_categories': SHORTAGE_REASON_CATEGORIES,
        'agent_shortage_reason_categories': AGENT_SHORTAGE_REASON_CATEGORIES,
        'official_cost_payment_sources': OFFICIAL_COST_PAYMENT_SOURCES,
        'momo_providers': MOMO_PROVIDERS,
        'submission_sources': WEEKLY_SUBMISSION_SOURCES,
        'languages': list(SUPPORTED_LANGUAGES),
        'current_week': [d.isoformat() for d in week_bounds()],
    })


@bp.get('/weeks')
@require_any_permission(*VIEW_ANY)
def weeks():
    policy = get_policy()
    policy_rows = []
    for start in available_weeks(policy=policy):
        item = {
            'week_start': start.isoformat(),
            'week_end': week_end_for(start, policy).isoformat(),
        }
        q = WeeklyReport.query.filter_by(week_start=start)
        user = current_user()
        if not _is_reviewer(user):
            emp = current_employee()
            q = q.filter_by(employee_id=emp.id if emp else -1)
        elif _is_manager_scoped(user):
            emp = current_employee()
            q = q.filter_by(branch_id=emp.branch_id if emp else -1)
        item['report_count'] = q.count()
        item['status_counts'] = {
            status: q.filter_by(status=status).count() for status in WEEKLY_REPORT_STATUSES
        }
        policy_rows.append(item)
    return jsonify({'weeks': policy_rows, 'current': policy_rows[0] if policy_rows else None})


@bp.post('/agent-summary')
@require_permission('weekly_reports.submit')
def agent_summary():
    """One self-scoped request that prepares and explains the agent's week.

    The endpoint is deliberately available only to the ``submit`` permission:
    reviewers do not hold it, and a Service Agent can never pass an
    ``employee_id`` to reach another agent's figures. It is idempotent — the
    report is created once and then reused — but unlike a GET it is allowed to
    prepare the draft the same way the existing ``/generate`` action does.
    """
    user = current_user()
    emp = current_employee()
    if not emp:
        return json_error('No employee account is linked to this user', 403)
    data = parse_json() or {}
    # A deep link from the dashboard can name the exact report. It is still
    # self-scoped: another agent's report id is rejected before any figures
    # are calculated or returned.
    if data.get('report_id') not in (None, ''):
        try:
            linked_id = int(data['report_id'])
        except (TypeError, ValueError):
            return json_error('Invalid report id', 400)
        linked = WeeklyReport.query.get(linked_id)
        if not linked or linked.employee_id != emp.id:
            return json_error('You can only open your own weekly report', 403)
        week_start = normalize_week_start(linked.week_start)
    else:
        reference, err = parse_date(data.get('week_start'), 'week_start')
        if err:
            return err
        week_start = normalize_week_start(reference) if reference else week_bounds()[0]
    report, created = service.ensure_report(emp, week_start, actor=user)
    db.session.commit()

    detail = service.detail(report, user)
    policy = get_policy()
    current_week_start = week_bounds()[0]
    week_options = list(available_weeks(policy=policy))
    # A deep link can open a report older than the normal 13-week picker.
    if week_start not in week_options:
        week_options.insert(0, week_start)
    week_rows = []
    for start in week_options:
        mine = WeeklyReport.query.filter_by(week_start=start, employee_id=emp.id).first()
        row = {
            'week_start': start.isoformat(),
            'week_end': week_end_for(start, policy).isoformat(),
            'report_id': mine.id if mine else None,
            'status': mine.status if mine else None,
            'current': start == current_week_start,
            'selected': start == week_start,
        }
        if mine is not None:
            # Stored authoritative columns keep the week picker cheap. The
            # selected week's full overlay-aware breakdown is in `summary`.
            opening = money(mine.opening_outstanding)
            expected = money(mine.expected_remittance)
            row.update({
                'week_expected_amount': f'{expected - opening:.2f}',
                'previous_outstanding': f'{opening:.2f}',
                'money_to_submit': f'{expected:.2f}',
                'closing_outstanding': f'{money(mine.closing_outstanding):.2f}',
            })
        week_rows.append(row)
    return jsonify({
        'message': 'Weekly report prepared',
        'created': created,
        'report': detail,
        'summary': detail['summary'],
        'policy': policy,
        'constants': {
            'statuses': WEEKLY_REPORT_STATUSES,
            'shortage_reason_categories': SHORTAGE_REASON_CATEGORIES,
            'agent_shortage_reason_categories': AGENT_SHORTAGE_REASON_CATEGORIES,
            'official_cost_payment_sources': OFFICIAL_COST_PAYMENT_SOURCES,
            'submission_sources': WEEKLY_SUBMISSION_SOURCES,
            'momo_providers': MOMO_PROVIDERS,
            'languages': list(SUPPORTED_LANGUAGES),
        },
        'employee': {'id': emp.id, 'name': emp.full_name, 'branch_id': emp.branch_id},
        'weeks': week_rows,
    })


# ── central review workspace (GET /queue) helpers ────────────────────────────
# The queue keeps its original default status window; the new filters and
# metrics are additive and never change the authoritative report calculation.

REVIEW_QUEUE_STATUSES = (
    'submitted', 'under_financial_review', 'returned_for_correction',
)
_TRUE_ARGS = frozenset(('1', 'true', 'yes', 'on'))
_FALSE_ARGS = frozenset(('', '0', 'false', 'no', 'off'))


def _bool_arg(name):
    """Return (bool, error) for an optional `?flag=true` query parameter."""
    raw = request.args.get(name)
    if raw is None:
        return False, None
    value = str(raw).strip().lower()
    if value in _TRUE_ARGS:
        return True, None
    if value in _FALSE_ARGS:
        return False, None
    return False, json_error(f'{name} must be true or false', 400, field=name)


def _queue_scope(user):
    """Access scope shared by the queue rows and their dashboard metrics."""
    q = WeeklyReport.query
    if _is_manager_scoped(user):
        emp = current_employee()
        q = q.filter_by(branch_id=emp.branch_id if emp else -1)
    return q


def _pending_verification_exists():
    """Real EXISTS predicates: any pending remittance or cost-payment claim."""
    momo_pending = db.exists().where(
        MoMoSubmission.report_id == WeeklyReport.id,
        MoMoSubmission.verification_status == 'pending',
    ).correlate(WeeklyReport)
    claim_pending = db.exists().where(
        OfficialCostPayment.report_id == WeeklyReport.id,
        OfficialCostPayment.verification_status == 'pending',
    ).correlate(WeeklyReport)
    return db.or_(momo_pending, claim_pending)


def _unverified_submission():
    """Amount-based 'still unverified' signal on the submitted declaration.

    A declared amount is the agent's own statement of what she sent. When a
    declaration is present, anything below it is unverified; older reports with
    no declaration fall back to the agent-reported MoMo total. This is a SQL
    comparison on frozen report columns — no Python post-filtering and no
    recomputation from source transactions.
    """
    declared = db.func.coalesce(WeeklyReport.declared_submitted_amount, 0)
    verified = db.func.coalesce(WeeklyReport.verified_submitted, 0)
    reported = db.func.coalesce(WeeklyReport.agent_reported_submitted, 0)
    return db.or_(
        db.and_(declared > 0, verified < declared),
        db.and_(declared <= 0, verified < reported),
    )


def _frozen_payload(row):
    """Prefer the frozen calculation (with overlays), then the snapshot."""
    for raw in (row.calculation, row.snapshot):
        if not raw:
            continue
        try:
            payload = json.loads(raw)
        except (TypeError, ValueError):
            continue
        if isinstance(payload, dict):
            return payload
    return {}


def _missing_closing_entries(payload):
    """Missing days recorded in the frozen calculation/snapshot JSON.

    build_calculation() writes a top-level `missing_closings` list; older or
    custom snapshots may nest it under `components`. Both shapes are accepted,
    and an empty list (or absent key) means no missing closings. The daily
    closing rows are a last-resort fallback for the same frozen payload.
    """
    if not isinstance(payload, dict):
        return []
    for container in (payload, payload.get('components')):
        if not isinstance(container, dict):
            continue
        raw = container.get('missing_closings')
        if isinstance(raw, list):
            return [str(item) for item in raw if item not in (None, '')]
        if isinstance(raw, dict):
            return [str(key) for key in raw if key not in (None, '')]
    daily = payload.get('daily_closings')
    if isinstance(daily, list):
        return [str(row.get('date')) for row in daily
                if isinstance(row, dict)
                and (row.get('status') == 'missing' or not row.get('closing_id'))]
    return []


def _missing_closing_counts(base_query):
    """Count missing days on already-scoped rows, without recomputing figures.

    `calculation`/`snapshot` are single TEXT JSON blobs, not relational tables.
    SQLite (tests) and PostgreSQL (production) expose different JSON operators,
    so there is no portable SQL predicate for this shape. The helper therefore
    reads only the id/JSON/override columns of rows that have already passed
    the access + week + branch scope filters, and returns both the raw per-row
    counts and the ids still actionable (no reviewer override).
    """
    rows = base_query.with_entities(
        WeeklyReport.id,
        WeeklyReport.calculation,
        WeeklyReport.snapshot,
        WeeklyReport.missing_closing_override_reason,
    ).all()
    counts, actionable = {}, set()
    for row in rows:
        entries = _missing_closing_entries(_frozen_payload(row))
        if not entries:
            continue
        counts[row.id] = len(entries)
        if not row.missing_closing_override_reason:
            actionable.add(row.id)
    return counts, actionable


def _queue_metrics(base_query, actionable_missing):
    """Context counts from the access/week/branch scope, before row filters."""
    status_counts = dict(base_query.with_entities(
        WeeklyReport.status, db.func.count()).group_by(WeeklyReport.status).all())
    shortage = base_query.filter(WeeklyReport.shortage_amount > 0)
    shortage_amount = shortage.with_entities(
        db.func.coalesce(db.func.sum(WeeklyReport.shortage_amount), 0)).scalar()
    amount = str(money(shortage_amount))
    return {
        'total': base_query.count(),
        'submitted': status_counts.get('submitted', 0),
        'under_review': status_counts.get('under_financial_review', 0),
        'returned': status_counts.get('returned_for_correction', 0),
        'approved': status_counts.get('approved', 0),
        'rejected': status_counts.get('rejected', 0),
        'shortage_reports': shortage.count(),
        'shortage_amount': amount,
        'pending_submissions': base_query.filter(
            _pending_verification_exists()).count(),
        'unverified_payments': base_query.filter(_unverified_submission()).count(),
        'missing_closings': len(actionable_missing),
        'total_shortage': amount,  # alias for dashboards using the older label
    }


def _like_pattern(value):
    escaped = str(value).replace('\\', '\\\\').replace('%', '\\%').replace('_', '\\_')
    return f'%{escaped}%'


@bp.get('/queue')
@require_any_permission('weekly_reports.review', 'weekly_reports.manage')
def review_queue():
    user = current_user()

    week_start, err = parse_date(request.args.get('week_start'), 'week_start')
    if err:
        return err
    if week_start:
        try:
            week_start = require_week_start(week_start)
        except WeekPolicyError as exc:
            return json_error(str(exc), 400, field='week_start')

    branch_id, err = parse_id(request.args.get('branch_id'), 'branch_id')
    if err:
        return err
    if _is_manager_scoped(user):
        emp = current_employee()
        my_branch = emp.branch_id if emp else None
        if branch_id is not None and branch_id != my_branch:
            return json_error(
                'Managers can only view weekly reports for their own branch', 403)
    elif branch_id is not None and not Branch.query.get(branch_id):
        return json_error('Unknown branch_id', 400, field='branch_id')

    flags = {}
    for name in ('has_shortage', 'has_pending', 'has_unverified', 'missing_closings'):
        flags[name], err = _bool_arg(name)
        if err:
            return err

    status = request.args.get('status')
    search = (request.args.get('search') or '').strip()
    sort = (request.args.get('sort') or 'newest').strip().lower()
    if sort not in ('newest', 'oldest', 'amount'):
        return json_error('sort must be newest, oldest or amount', 400, field='sort')

    # Scope is applied once and reused by both the rows and their metrics.
    base = _queue_scope(user)
    if week_start:
        base = base.filter_by(week_start=week_start)
    if branch_id is not None:
        base = base.filter_by(branch_id=branch_id)
    missing_counts, actionable_missing = _missing_closing_counts(base)
    metrics = _queue_metrics(base, actionable_missing)

    # The default queue stays backward compatible; every new filter is additive.
    q = base.filter(WeeklyReport.status.in_(REVIEW_QUEUE_STATUSES))
    if status:
        q = q.filter_by(status=status)
    if search:
        pattern = _like_pattern(search)
        # employee_name is a Python property, so compose the stored columns with
        # the portable SQL concatenation operator (SQLite and PostgreSQL agree).
        full_name = (db.func.coalesce(Employee.first_name, '')
                     .op('||')(' ')
                     .op('||')(db.func.coalesce(Employee.last_name, '')))
        q = (q.join(Employee, WeeklyReport.employee_id == Employee.id)
             .outerjoin(Branch, WeeklyReport.branch_id == Branch.id)
             .filter(db.or_(
                 WeeklyReport.report_number.ilike(pattern, escape='\\'),
                 full_name.ilike(pattern, escape='\\'),
                 Branch.name.ilike(pattern, escape='\\'),
             )))
    if flags['has_shortage']:
        q = q.filter(WeeklyReport.shortage_amount > 0)
    if flags['has_pending']:
        q = q.filter(_pending_verification_exists())
    if flags['has_unverified']:
        q = q.filter(_unverified_submission())
    if flags['missing_closings']:
        q = q.filter(WeeklyReport.id.in_(actionable_missing))

    # 'amount' sorts by the shortage the reviewer must clear; null submission
    # timestamps go last in both date directions on every supported database.
    if sort == 'oldest':
        ordering = (WeeklyReport.submitted_at.asc().nullslast(), WeeklyReport.id.asc())
    elif sort == 'amount':
        ordering = (WeeklyReport.shortage_amount.desc(), WeeklyReport.id.desc())
    else:
        ordering = (WeeklyReport.submitted_at.desc().nullslast(), WeeklyReport.id.desc())
    p = paginate(q.order_by(*ordering))

    # Two grouped queries over the page ids (never one query per row) supply the
    # review signals. Counts stay scoped to rows this caller can actually see.
    page_ids = [row.id for row in p.items]
    pending_momo_counts = {}
    pending_claim_counts = {}
    if page_ids:
        pending_momo_counts = dict(db.session.query(
            MoMoSubmission.report_id, db.func.count()).filter(
            MoMoSubmission.report_id.in_(page_ids),
            MoMoSubmission.verification_status == 'pending',
        ).group_by(MoMoSubmission.report_id).all())
        pending_claim_counts = dict(db.session.query(
            OfficialCostPayment.report_id, db.func.count()).filter(
            OfficialCostPayment.report_id.in_(page_ids),
            OfficialCostPayment.verification_status == 'pending',
            OfficialCostPayment.personal_payment.is_(True),
        ).group_by(OfficialCostPayment.report_id).all())

    items = []
    for report in p.items:
        item = report.to_dict()
        item['pending_submission_count'] = pending_momo_counts.get(report.id, 0)
        item['unverified_personal_payment_count'] = pending_claim_counts.get(report.id, 0)
        item['missing_closing_count'] = missing_counts.get(report.id, 0)
        item['has_shortage'] = bool(
            report.shortage_amount is not None and report.shortage_amount > 0)
        items.append(item)

    filters = {
        'status': status or None,
        'week_start': week_start.isoformat() if week_start else None,
        'branch_id': branch_id,
        'search': search or None,
        'has_shortage': flags['has_shortage'],
        'has_pending': flags['has_pending'],
        'has_unverified': flags['has_unverified'],
        'missing_closings': flags['missing_closings'],
        'sort': sort,
    }
    payload = paginate_payload(items, p)
    payload['metrics'] = metrics
    payload['filters'] = filters
    return jsonify(payload)


@bp.get('')
@require_permission('weekly_reports.view')
def list_reports():
    user = current_user()
    q = WeeklyReport.query
    if not _is_reviewer(user):
        emp = current_employee()
        q = q.filter_by(employee_id=emp.id if emp else -1)
    elif _is_manager_scoped(user):
        emp = current_employee()
        q = q.filter_by(branch_id=emp.branch_id if emp else -1)
    status = request.args.get('status')
    week_start, err = parse_date(request.args.get('week_start'), 'week_start')
    if err:
        return err
    employee_id = request.args.get('employee_id', type=int)
    if status:
        q = q.filter_by(status=status)
    if week_start:
        q = q.filter_by(week_start=week_start)
    if employee_id:
        if not _is_reviewer(user):
            return json_error('You can only view your own reports', 403)
        q = q.filter_by(employee_id=employee_id)
    p = paginate(q.order_by(WeeklyReport.week_start.desc(), WeeklyReport.id.desc()))
    return paginate_response([r.to_dict() for r in p.items], p)


@bp.post('/generate')
@require_any_permission('weekly_reports.manage', 'weekly_reports.submit')
def generate():
    data = parse_json()
    user = current_user()
    employee_id = data.get('employee_id')
    # Service Agents do not have manage access, but they must be able to create
    # their own weekly report. Force the target to their own employee row and
    # ignore any attempt to generate on behalf of a colleague.
    agent_self_service = (not _is_reviewer(user)
                          and user.has_permission('weekly_reports.submit'))
    if agent_self_service:
        mine = current_employee()
        if not mine:
            return json_error('No employee account is linked to this user', 403)
        if employee_id and str(employee_id) != str(mine.id):
            return json_error('You can only generate your own weekly report', 403)
        employee_id = mine.id
    week_start, err = parse_date(data.get('week_start'), 'week_start')
    if err:
        return err
    if week_start:
        # Generation accepts any reference date and stores the legal Sunday
        # start. Strict validation still applies to stored report periods.
        week_start = normalize_week_start(week_start)
    kwargs = {}
    if employee_id:
        try:
            employee = Employee.query.get(int(employee_id))
        except (TypeError, ValueError):
            return json_error('Invalid employee_id', 400)
        if not employee:
            return json_error('Employee not found', 404)
        if _is_manager_scoped(user):
            mine = current_employee()
            if not mine or employee.branch_id != mine.branch_id:
                return json_error('You can only generate reports for your branch', 403)
        report, created = service.ensure_report(employee, week_start, actor=user)
        db.session.commit()
        return jsonify({'message': 'Weekly report generated' if created else 'Weekly report already exists',
                        'created': created, 'report': service.detail(report, user)}), (201 if created else 200)
    if _is_manager_scoped(user):
        mine = current_employee()
        if not mine:
            return json_error('No branch scope is available for this account', 403)
        kwargs['employee_ids'] = [
            row.id for row in Employee.query.filter_by(branch_id=mine.branch_id).all()]
    result = service.generate_for_all_agents(week_start or date.today(), actor=user, **kwargs)
    db.session.commit()
    return jsonify({'message': 'Weekly generation complete', **result})


@bp.get('/<int:report_id>')
@require_permission('weekly_reports.view')
def get_report(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    return jsonify({'report': service.detail(report, user)})


@bp.patch('/<int:report_id>')
@require_permission('weekly_reports.submit')
def update_report(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only edit your own report', 403)
    try:
        service.update_draft(report, parse_json(), user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Draft updated', 'report': service.detail(report, user)})


@bp.post('/<int:report_id>/submit')
@require_permission('weekly_reports.submit')
def submit_report(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only submit your own report', 403)
    try:
        report, payload = service.submit(report, request.form.to_dict() or parse_json(),
                                         user, files=request.files)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Weekly financial report submitted',
                    'report': service.detail(report, user)})


@bp.get('/<int:report_id>/transactions')
@require_permission('weekly_reports.view')
def report_transactions(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    calc = service.detail(report, user)['calculation']
    rows = list(calc.get('transactions', []))
    search = (request.args.get('search') or '').lower()
    service_name = request.args.get('service')
    status = request.args.get('status')
    payment_status = request.args.get('payment_status')
    start, err = parse_date(request.args.get('start'), 'start')
    if err:
        return err
    end, err = parse_date(request.args.get('end'), 'end')
    if err:
        return err
    if search:
        rows = [r for r in rows if any(search in str(r.get(k) or '').lower()
                                       for k in ('transaction_number', 'service_name', 'client_name'))]
    if service_name:
        rows = [r for r in rows if r.get('service_name') == service_name]
    if status:
        rows = [r for r in rows if r.get('status') == status]
    if payment_status:
        rows = [r for r in rows if r.get('payment_status') == payment_status]
    if start:
        rows = [r for r in rows if r.get('date', '') >= start.isoformat()]
    if end:
        rows = [r for r in rows if r.get('date', '') <= end.isoformat()]
    page = request.args.get('page', 1, type=int) or 1
    per_page = min(request.args.get('per_page', 25, type=int) or 25, 200)
    total = len(rows)
    items = rows[(page - 1) * per_page: page * per_page]
    return jsonify({'items': items, 'total': total, 'page': page, 'per_page': per_page,
                    'pages': (total + per_page - 1) // per_page})


@bp.get('/<int:report_id>/daily-closings')
@require_permission('weekly_reports.view')
def report_closings(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    calc = service.detail(report, user)['calculation']
    return jsonify({
        'items': calc.get('daily_closings', []),
        'missing': calc.get('missing_closings', []),
        'override': {
            'reason': report.missing_closing_override_reason,
            'authorized_by': report.missing_closing_override_by,
            'authorized_at': report.missing_closing_override_at.isoformat()
            if report.missing_closing_override_at else None,
        },
    })


@bp.get('/<int:report_id>/expenses')
@require_permission('weekly_reports.view')
def report_expenses(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    calc = service.detail(report, user)['calculation']
    return jsonify({'items': calc.get('expenses', [])})


@bp.get('/<int:report_id>/official-cost-payments')
@require_permission('weekly_reports.view')
def report_cost_payments(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    claims = []
    verified_total = Decimal('0')
    for claim in report.cost_payment_claims:
        row = claim.to_dict()
        claims.append(row)
        txn = claim.transaction
        row['service_name'] = txn.service_name if txn else None
        if is_company_funded_service(
                getattr(txn, 'service_name', None), getattr(txn, 'service', None)):
            # Land Document costs are already confirmed as AfriTech Bridge-paid.
            row.update({
                'payment_source': 'company', 'personal_payment': False,
                'amount': 0.0, 'is_partial': False, 'auto_company_funded': True,
            })
        elif has_personal_cost_credit(row):
            # Guided own-funds answers are already credited while pending;
            # approval only finalises their status.
            verified_total += Decimal(str(row['amount']))
    return jsonify({
        'items': claims,
        'total': len(claims),
        # Keep the same two-decimal money format as every other report amount.
        'verified_total': str(verified_total.quantize(Decimal('0.01'))),
    })


@bp.post('/<int:report_id>/official-cost-payments')
@require_permission('weekly_reports.submit')
def add_cost_payment(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only add cost evidence to your own report', 403)
    try:
        claim = service.add_cost_payment(
            report, request.form.to_dict() or parse_json(), user,
            evidence=request.files.get('evidence'))
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Official cost payment recorded',
                    'claim': claim.to_dict(), 'report': service.detail(report, user)}), 201


@bp.delete('/<int:report_id>/official-cost-payments/<int:claim_id>')
@require_permission('weekly_reports.submit')
def delete_cost_payment(report_id, claim_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only change your own report', 403)
    claim = OfficialCostPayment.query.filter_by(id=claim_id, report_id=report.id).first()
    if not claim:
        return json_error('Official cost payment not found', 404)
    try:
        service.delete_cost_payment(report, claim, user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Official cost payment removed'})


@bp.get('/<int:report_id>/official-cost-payments/<int:claim_id>/evidence')
@require_permission('weekly_reports.view')
def download_cost_payment_evidence(report_id, claim_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    claim = OfficialCostPayment.query.filter_by(id=claim_id, report_id=report.id).first()
    if not claim or not claim.evidence_path:
        return json_error('No cost payment evidence was uploaded', 404)
    path = os.path.join(current_app.config['UPLOAD_FOLDER'],
                        claim.evidence_path.replace('/uploads/', ''))
    if not os.path.isfile(path):
        return json_error('Evidence file is missing', 410)
    audit('weekly_cost_payment_evidence_downloaded',
          'weekly_official_cost_payment', claim.id,
          new_value={'file': claim.evidence_name}, user=user)
    return send_file(path, as_attachment=True,
                     download_name=claim.evidence_name or 'evidence')


@bp.get('/<int:report_id>/momo/<int:submission_id>/evidence')
@require_permission('weekly_reports.view')
def download_momo_evidence(report_id, submission_id):
    """Protected MoMo evidence: the same RBAC/audit rules as cost evidence."""
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    submission = MoMoSubmission.query.filter_by(
        id=submission_id, report_id=report.id).first()
    if not submission or not submission.evidence_path:
        return json_error('No money submission evidence was uploaded', 404)
    path = os.path.join(current_app.config['UPLOAD_FOLDER'],
                        submission.evidence_path.replace('/uploads/', ''))
    if not os.path.isfile(path):
        return json_error('Evidence file is missing', 410)
    audit('weekly_momo_evidence_downloaded', 'weekly_momo_submission',
          submission.id, new_value={'file': submission.evidence_name}, user=user)
    return send_file(path, as_attachment=True,
                     download_name=submission.evidence_name or 'evidence')


@bp.post('/<int:report_id>/momo')
@require_permission('weekly_reports.submit')
def add_momo(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only add submissions to your own report', 403)
    if report.status in ('submitted', 'under_financial_review', 'approved', 'rejected'):
        return json_error('A submitted report is locked; request a correction instead.',
                          409, 'weekly_report.locked')

    data = request.form.to_dict() or parse_json()
    provider = data.get('provider', 'momo')
    if provider not in MOMO_PROVIDERS:
        return json_error('Invalid provider', 400, field='provider')
    reference = (data.get('reference') or '').strip().upper()
    if len(reference) < 4:
        return json_error('A money submission reference is required', 400,
                          'weekly_report.reference_required', field='reference')
    try:
        amount = Decimal(str(data.get('amount')))
        if not amount.is_finite() or amount <= 0:
            raise InvalidOperation
        amount = amount.quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError, TypeError):
        return json_error('A positive amount is required', 400,
                          'weekly_report.invalid_amount', field='amount')
    submitted_raw = data.get('submitted_at')
    try:
        if submitted_raw:
            submitted_at = datetime.fromisoformat(str(submitted_raw).replace('Z', '+00:00'))
            if submitted_at.tzinfo is None:
                tz = business_timezone(report.timezone_name)
                submitted_at = submitted_at.replace(tzinfo=tz).astimezone(timezone.utc)
        else:
            submitted_at = datetime.now(timezone.utc)
    except ValueError:
        return json_error('Invalid submission date/time', 400,
                          'weekly_report.invalid_date', field='submitted_at')

    # A client-supplied transfer date must belong to the reported week (or the
    # submission window ending at its deadline). The default "now" is left
    # unchecked so historical/correction workflows can attach evidence later.
    if submitted_raw:
        tz = business_timezone(report.timezone_name)
        local_date = submitted_at.astimezone(tz).date()
        due_at = report.due_at
        if due_at.tzinfo is None:
            due_at = due_at.replace(tzinfo=tz)
        if not (report.week_start <= local_date <= due_at.astimezone(tz).date()):
            return json_error(
                'Submission date must fall within the report week or before its deadline',
                400, 'weekly_report.invalid_date', field='submitted_at')

    if MoMoSubmission.query.filter_by(reference=reference).first():
        return json_error('That money submission reference already exists', 409,
                          'weekly_report.duplicate_reference', field='reference')

    submission = MoMoSubmission(
        report_id=report.id, provider=provider, reference=reference, amount=amount,
        submitted_at=submitted_at, sender_phone=data.get('sender_phone'),
        recipient_phone=data.get('recipient_phone'),
        confirmation_code=data.get('confirmation_code'), notes=data.get('notes'),
        created_by=user.id, verification_status='pending')
    evidence = request.files.get('evidence')
    if evidence and evidence.filename:
        try:
            submission.evidence_path = service._store_evidence(evidence, report, 'momo')
            submission.evidence_name = evidence.filename[:255]
            submission.content_type = evidence.mimetype
            submission.size_bytes = os.path.getsize(
                os.path.join(current_app.config['UPLOAD_FOLDER'],
                             submission.evidence_path.replace('/uploads/', '')))
        except WeeklyReportError as exc:
            return _error(exc)
    db.session.add(submission)
    try:
        db.session.flush()
    except Exception:
        db.session.rollback()
        return json_error('That money submission reference already exists', 409,
                          'weekly_report.duplicate_reference', field='reference')
    audit('weekly_momo_submitted', 'weekly_momo_submission', submission.id,
          new_value={'reference': reference, 'amount': str(amount), 'provider': provider},
          user=user)
    db.session.expire(report, ['momo_submissions'])
    service.refresh(report, user)
    db.session.commit()
    return jsonify({'message': 'Money submission added', 'submission': submission.to_dict()}), 201


@bp.delete('/<int:report_id>/momo/<int:submission_id>')
@require_permission('weekly_reports.submit')
def delete_momo(report_id, submission_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    emp = current_employee()
    if not emp or report.employee_id != emp.id:
        return json_error('You can only change your own report', 403)
    if report.status not in ('draft', 'ready_for_submission', 'late',
                             'returned_for_correction'):
        return json_error('A submitted report is locked; request a correction instead.',
                          409, 'weekly_report.locked')
    submission = MoMoSubmission.query.filter_by(id=submission_id, report_id=report.id).first()
    if not submission:
        return json_error('Money submission not found', 404)
    previous = submission.to_dict()
    db.session.delete(submission)
    audit('weekly_momo_deleted', 'weekly_momo_submission', submission.id,
          previous_value=previous, user=user)
    db.session.expire(report, ['momo_submissions'])
    service.refresh(report, user)
    db.session.commit()
    return jsonify({'message': 'Money submission removed'})


@bp.get('/<int:report_id>/evidence')
@require_permission('weekly_reports.view')
def download_evidence(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    if not report.shortage_evidence_path:
        return json_error('No shortage evidence was uploaded', 404)
    path = os.path.join(current_app.config['UPLOAD_FOLDER'],
                        report.shortage_evidence_path.replace('/uploads/', ''))
    if not os.path.isfile(path):
        return json_error('Evidence file is missing', 410)
    audit('weekly_report_evidence_downloaded', 'weekly_report', report.id,
          new_value={'file': report.shortage_evidence_name}, user=user)
    return send_file(path, as_attachment=True,
                     download_name=report.shortage_evidence_name or 'evidence')


@bp.post('/<int:report_id>/override')
@require_permission('weekly_reports.adjust')
def authorize_override(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    try:
        service.authorize_shortage_override(report, parse_json().get('reason'), user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Shortage override authorized',
                    'report': service.detail(report, user)})


@bp.post('/<int:report_id>/missing-closings/override')
@require_permission('weekly_reports.adjust')
def authorize_missing_closings(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    try:
        service.acknowledge_missing_closings(report, parse_json().get('reason'), user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Missing daily closings acknowledged',
                    'report': service.detail(report, user)})


@bp.post('/<int:report_id>/review')
@require_permission('weekly_reports.review')
def review(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    data = parse_json()
    action = data.get('action')
    # `note` belongs to the child being verified (MoMo/cost claim). A report
    # note must be sent explicitly as `report_note` so a per-item decision never
    # silently overwrites the report-level reviewer note.
    report_note = data.get('report_note')
    try:
        if action in ('verify_momo', 'reject_momo'):
            momo_id = data.get('momo_id')
            if momo_id is None:
                return json_error('A money submission is required', 400,
                                  'weekly_report.momo_required', field='momo_id')
            submission = MoMoSubmission.query.filter_by(
                id=momo_id, report_id=report.id).first()
            if not submission:
                return json_error('Money submission not found', 404,
                                  field='momo_id')
            service.verify_momo(report, submission,
                                'verified' if action == 'verify_momo' else 'rejected',
                                user, data.get('note'))
        elif action in ('verify_cost_payment', 'reject_cost_payment'):
            claim_id = data.get('claim_id')
            if claim_id is None:
                return json_error('An official cost payment is required', 400,
                                  'weekly_report.claim_required', field='claim_id')
            claim = OfficialCostPayment.query.filter_by(
                id=claim_id, report_id=report.id).first()
            if not claim:
                return json_error('Official cost payment not found', 404,
                                  field='claim_id')
            service.verify_cost_payment(
                report, claim,
                'verified' if action == 'verify_cost_payment' else 'rejected',
                user, data.get('note'))
        elif action == 'request_correction':
            if not (data.get('reason') or '').strip():
                return json_error('A correction reason is required', 400,
                                  'weekly_report.reason_required',
                                  field='review_reason')
            service.request_correction(report, data['reason'], user)
        elif action in ('approve', 'reject'):
            service.decide(report, action, user, data.get('reason'))
        else:
            return json_error('Invalid review action', 400,
                              field='action', details={'action': action})
        # Only persist the report note after the action itself succeeded; a
        # rejected request must not leave a half-written review behind.
        if report_note and report_note != report.reviewer_note:
            previous_note = report.reviewer_note
            report.reviewer_note = str(report_note)
            audit('weekly_report_reviewer_note_updated', 'weekly_report', report.id,
                  previous_value={'reviewer_note': previous_note},
                  new_value={'reviewer_note': report.reviewer_note}, user=user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Review action recorded',
                    'report': service.detail(report, user)})


@bp.post('/<int:report_id>/adjustments')
@require_permission('weekly_reports.adjust')
def add_adjustment(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    try:
        adjustment = service.add_adjustment(report, parse_json(), user)
        db.session.commit()
    except WeeklyReportError as exc:
        db.session.rollback()
        return _error(exc)
    return jsonify({'message': 'Adjustment recorded', 'adjustment': adjustment.to_dict(),
                    'report': service.detail(report, user)}), 201


@bp.get('/<int:report_id>/audit')
@require_permission('weekly_reports.view')
def audit_history(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    momo_ids = [m.id for m in report.momo_submissions]
    claim_ids = [c.id for c in report.cost_payment_claims]
    adjustment_ids = [a.id for a in report.adjustments]
    rows = (AuditLog.query
            .filter(db.or_(
                db.and_(AuditLog.entity == 'weekly_report', AuditLog.entity_id == str(report.id)),
                db.and_(AuditLog.entity == 'weekly_momo_submission',
                        AuditLog.entity_id.in_([str(i) for i in momo_ids] or ['-1'])),
                db.and_(AuditLog.entity == 'weekly_official_cost_payment',
                        AuditLog.entity_id.in_([str(i) for i in claim_ids] or ['-1'])),
                db.and_(AuditLog.entity == 'weekly_report_adjustment',
                        AuditLog.entity_id.in_([str(i) for i in adjustment_ids] or ['-1'])),
            ))
            .order_by(AuditLog.created_at.desc()).all())
    return jsonify({'items': [r.to_dict() for r in rows], 'total': len(rows)})


@bp.get('/<int:report_id>/export')
@require_permission('weekly_reports.export')
def export_report(report_id):
    user = current_user()
    report, err = _report_or_404(report_id, user)
    if err:
        return err
    fmt = (request.args.get('format') or 'pdf').lower()
    lang = request.args.get('lang', 'en')
    if lang not in SUPPORTED_LANGUAGES:
        lang = 'en'
    if fmt not in ('pdf', 'xlsx'):
        return json_error('format must be pdf or xlsx', 400)
    from ..services.weekly_exports import export_pdf, export_xlsx
    rows, calc = service.statement_rows(report, lang)
    try:
        if fmt == 'pdf':
            output, mimetype = export_pdf(report, rows, calc, lang)
        else:
            output, mimetype = export_xlsx(report, rows, calc, lang)
    except WeeklyReportError as exc:
        return _error(exc)
    filename = f'{report.report_number}_{lang}.{ "xlsx" if fmt == "xlsx" else "pdf"}'
    audit('weekly_report_exported', 'weekly_report', report.id,
          new_value={'format': fmt, 'language': lang}, user=user)
    return send_file(output, mimetype=mimetype, as_attachment=True, download_name=filename)
