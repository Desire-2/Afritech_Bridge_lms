"""Weekly financial report and money submission API (backend-authoritative)."""
import os
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal, InvalidOperation

from flask import Blueprint, request, jsonify, current_app, send_file

from ..extensions import db
from ..models import (
    AuditLog, Employee, MoMoSubmission, OfficialCostPayment, Setting, User,
    WeeklyReport, MOMO_PROVIDERS, SHORTAGE_REASON_CATEGORIES,
    WEEKLY_REPORT_STATUSES,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.weekly_policy import (
    available_weeks, business_timezone, get_policy,
    normalize_week_start, week_bounds, week_end_for,
)
from ..services.weekly_report_service import WeeklyReportService, WeeklyReportError
from ..services.weekly_i18n import SUPPORTED_LANGUAGES, t
from .helpers import json_error, paginate, paginate_response, parse_date, parse_json

bp = Blueprint('weekly_reports', __name__, url_prefix='/api/weekly-reports')
service = WeeklyReportService()

VIEW_ANY = ('weekly_reports.view', 'weekly_reports.review', 'weekly_reports.adjust',
            'weekly_reports.manage', 'weekly_reports.export')


def _error(exc):
    return json_error(exc.message, exc.status, exc.code)


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
        'momo_providers': MOMO_PROVIDERS,
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


@bp.get('/queue')
@require_any_permission('weekly_reports.review', 'weekly_reports.manage')
def review_queue():
    user = current_user()
    q = WeeklyReport.query.filter(WeeklyReport.status.in_(
        ['submitted', 'under_financial_review', 'returned_for_correction']))
    if _is_manager_scoped(user):
        emp = current_employee()
        q = q.filter_by(branch_id=emp.branch_id if emp else -1)
    status = request.args.get('status')
    if status:
        q = q.filter_by(status=status)
    p = paginate(q.order_by(WeeklyReport.submitted_at.desc()))
    return paginate_response([r.to_dict() for r in p.items], p)


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
@require_permission('weekly_reports.manage')
def generate():
    data = parse_json()
    user = current_user()
    employee_id = data.get('employee_id')
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
    claims = [c.to_dict() for c in report.cost_payment_claims]
    verified_total = sum(
        (Decimal(str(c['amount'])) for c in claims
         if c['personal_payment'] and c['verification_status'] == 'verified'),
        Decimal('0'),
    )
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
        return json_error('Invalid provider', 400)
    reference = (data.get('reference') or '').strip().upper()
    if len(reference) < 4:
        return json_error('A money submission reference is required', 400,
                          'weekly_report.reference_required')
    try:
        amount = Decimal(str(data.get('amount')))
        if not amount.is_finite() or amount <= 0:
            raise InvalidOperation
        amount = amount.quantize(Decimal('0.01'))
    except (InvalidOperation, ValueError, TypeError):
        return json_error('A positive amount is required', 400, 'weekly_report.invalid_amount')
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
        return json_error('Invalid submission date/time', 400, 'weekly_report.invalid_date')

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
                400, 'weekly_report.invalid_date')

    if MoMoSubmission.query.filter_by(reference=reference).first():
        return json_error('That money submission reference already exists', 409,
                          'weekly_report.duplicate_reference')

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
                          'weekly_report.duplicate_reference')
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
    note = data.get('note')
    if note and note != report.reviewer_note:
        previous_note = report.reviewer_note
        report.reviewer_note = str(note)
        audit('weekly_report_reviewer_note_updated', 'weekly_report', report.id,
              previous_value={'reviewer_note': previous_note},
              new_value={'reviewer_note': report.reviewer_note}, user=user)
    try:
        if action in ('verify_momo', 'reject_momo'):
            submission = MoMoSubmission.query.filter_by(
                id=data.get('momo_id'), report_id=report.id).first()
            if not submission:
                return json_error('Money submission not found', 404)
            service.verify_momo(report, submission,
                                'verified' if action == 'verify_momo' else 'rejected',
                                user, data.get('note'))
        elif action in ('verify_cost_payment', 'reject_cost_payment'):
            claim = OfficialCostPayment.query.filter_by(
                id=data.get('claim_id'), report_id=report.id).first()
            if not claim:
                return json_error('Official cost payment not found', 404)
            service.verify_cost_payment(
                report, claim,
                'verified' if action == 'verify_cost_payment' else 'rejected',
                user, data.get('note'))
        elif action == 'request_correction':
            if not (data.get('reason') or '').strip():
                return json_error('A correction reason is required', 400,
                                  'weekly_report.reason_required')
            service.request_correction(report, data['reason'], user)
        elif action in ('approve', 'reject'):
            service.decide(report, action, user, data.get('reason'))
        else:
            return json_error('Invalid review action', 400)
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
    return send_file(output, mimetype=mimetype, as_attachment=True, download_name=filename)
