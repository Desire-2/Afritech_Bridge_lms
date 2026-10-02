"""Internal memos / office notices, addressed the same way as announcements."""

from datetime import datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import Memo, Employee, AUDIENCES
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id, parse_id_list,
)
from .admin_common import (
    dump_recipient_ids, recipient_employee_ids, scope_visible_to_viewer,
    visible_employee_ids,
)

bp = Blueprint('memos', __name__, url_prefix='/api/memos')

CATEGORIES = ('office_notice', 'internal_circular', 'policy', 'reminder', 'other')


def _validate_audience(data, user):
    audience = data.get('audience') or 'all'
    if audience not in AUDIENCES:
        return json_error(f'Invalid audience (expected one of {", ".join(AUDIENCES)})', 400)
    if audience in ('department', 'branch'):
        field = 'department_id' if audience == 'department' else 'branch_id'
        value, err = parse_id(data.get(field), field)
        if err:
            return err
        if not value:
            return json_error(f'{field} is required when audience is "{audience}"', 400)
        data[field] = value
    if audience == 'custom':
        ids, err = parse_id_list(data.get('recipient_ids'), 'recipient_ids')
        if err:
            return err
        if not ids:
            return json_error('recipient_ids is required when audience is "custom"', 400)
        allowed = visible_employee_ids(user)
        if [i for i in ids if i not in allowed]:
            return json_error('One or more recipients are outside your scope', 403)
        data['recipient_ids'] = ids
    return None


def _resolve_recipients(memo):
    return recipient_employee_ids(
        memo.audience, memo.department_id, memo.branch_id, memo.recipient_ids,
    )


@bp.get('')
@require_any_permission('memos.view', 'memos.manage')
def list_memos():
    user = current_user()
    q = Memo.query
    category = request.args.get('category')
    if category:
        if category not in CATEGORIES:
            return json_error(f'Invalid category (expected one of {", ".join(CATEGORIES)})', 400)
        q = q.filter_by(category=category)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Memo.title.ilike(like), Memo.message.ilike(like)))
    published_only = request.args.get('published_only', 'true').lower() not in ('false', '0')
    if published_only:
        q = q.filter(Memo.published_at.isnot(None))
    q = scope_visible_to_viewer(q, user, Memo)
    p = paginate(q.order_by(Memo.published_at.desc(), Memo.created_at.desc()))
    return paginate_response([m.to_dict() for m in p.items], p)


@bp.post('')
@require_permission('memos.manage')
def create_memo():
    data = parse_json()
    missing = required(data, 'title', 'message')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    err = _validate_audience(data, user)
    if err:
        return err
    category = data.get('category') or 'office_notice'
    if category not in CATEGORIES:
        return json_error(f'Invalid category (expected one of {", ".join(CATEGORIES)})', 400)
    attachment_id, err = parse_id(data.get('attachment_document_id'), 'attachment_document_id')
    if err:
        return err

    memo = Memo(
        title=data['title'].strip(), message=data['message'], category=category,
        audience=data.get('audience') or 'all',
        department_id=data.get('department_id'), branch_id=data.get('branch_id'),
        recipient_ids=dump_recipient_ids(data.get('recipient_ids') or []),
        attachment_document_id=attachment_id,
        published_at=datetime.now(timezone.utc) if data.get('publish', True) else None,
        created_by=user.id,
    )
    db.session.add(memo)
    db.session.flush()

    # `None` means audience 'all' — a company-wide post still notifies everyone.
    targets = _resolve_recipients(memo)
    employees = Employee.query
    if targets is not None:
        employees = employees.filter(Employee.id.in_(targets))
    for emp in employees.all():
        notify_employee(emp, 'memo', f'Memo: {memo.title}',
                        related_type='memo', related_id=memo.id)
    db.session.commit()
    audit('memo_created', 'memo', memo.id, new_value=memo.to_dict())
    return jsonify({'message': 'Memo created', 'memo': memo.to_dict()}), 201


@bp.get('/<int:memo_id>')
@require_any_permission('memos.view', 'memos.manage')
def get_memo(memo_id):
    user = current_user()
    memo = scope_visible_to_viewer(Memo.query.filter_by(id=memo_id), user, Memo).first()
    if not memo:
        return json_error('Memo not found', 404)
    return jsonify({'memo': memo.to_dict()})


@bp.put('/<int:memo_id>')
@require_permission('memos.manage')
def update_memo(memo_id):
    memo = Memo.query.get(memo_id)
    if not memo:
        return json_error('Memo not found', 404)
    data = parse_json()
    err = _validate_audience(data, current_user())
    if err:
        return err
    prev = memo.to_dict()

    for field in ('title', 'message', 'category', 'audience'):
        if field in data:
            if field == 'category' and data[field] not in CATEGORIES:
                return json_error(f'Invalid category (expected one of {", ".join(CATEGORIES)})', 400)
            setattr(memo, field, data[field])
    for field in ('department_id', 'branch_id', 'attachment_document_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(memo, field, parsed)
    if 'recipient_ids' in data:
        memo.recipient_ids = dump_recipient_ids(data['recipient_ids'] or [])
    if 'publish' in data:
        memo.published_at = datetime.now(timezone.utc) if data['publish'] else None

    db.session.commit()
    audit('memo_updated', 'memo', memo.id, prev, memo.to_dict())
    return jsonify({'message': 'Memo updated', 'memo': memo.to_dict()})


@bp.post('/<int:memo_id>/publish')
@require_permission('memos.manage')
def publish_memo(memo_id):
    memo = Memo.query.get(memo_id)
    if not memo:
        return json_error('Memo not found', 404)
    if memo.published_at:
        return json_error('Memo is already published', 409)
    memo.published_at = datetime.now(timezone.utc)
    # `None` means audience 'all' — a company-wide post still notifies everyone.
    targets = _resolve_recipients(memo)
    employees = Employee.query
    if targets is not None:
        employees = employees.filter(Employee.id.in_(targets))
    for emp in employees.all():
        notify_employee(emp, 'memo', f'Memo: {memo.title}',
                        related_type='memo', related_id=memo.id)
    db.session.commit()
    audit('memo_published', 'memo', memo.id, new_value=memo.to_dict())
    return jsonify({'message': 'Memo published', 'memo': memo.to_dict()})


@bp.delete('/<int:memo_id>')
@require_permission('memos.manage')
def delete_memo(memo_id):
    memo = Memo.query.get(memo_id)
    if not memo:
        return json_error('Memo not found', 404)
    data = memo.to_dict()
    db.session.delete(memo)
    db.session.commit()
    audit('memo_deleted', 'memo', memo_id, previous_value=data)
    return jsonify({'message': 'Memo deleted'})