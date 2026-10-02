"""Internal announcements: publish, target an audience, track acknowledgements."""

from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Announcement, AnnouncementAck, Employee, ANNOUNCEMENT_CATEGORIES, AUDIENCES,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.notifications import notify_employee
from .helpers import (
    json_error, parse_json, required, paginate, paginate_response,
    parse_date, parse_id, parse_id_list,
)
from .admin_common import (
    dump_recipient_ids, load_recipient_ids, recipient_employee_ids,
    audience_ids_in_scope, scope_visible_to_viewer, visible_employee_ids,
)

bp = Blueprint('announcements', __name__, url_prefix='/api/announcements')

PRIORITIES = ('low', 'normal', 'high', 'urgent')


def _validate_audience(data, user):
    """Check audience/targets and return (error|None)."""
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
        bad = [i for i in ids if i not in allowed]
        if bad:
            return json_error('One or more recipients are outside your scope', 403)
        data['recipient_ids'] = ids
    return None


def _resolve_recipients(ann):
    """Employee ids an announcement should reach, or None for company-wide."""
    return recipient_employee_ids(
        ann.audience, ann.department_id, ann.branch_id, ann.recipient_ids,
    )


@bp.get('')
@require_any_permission('announcements.view', 'announcements.manage')
def list_announcements():
    user = current_user()
    q = Announcement.query
    if request.args.get('active_only', 'true').lower() not in ('false', '0'):
        today = date.today()
        q = q.filter(Announcement.publish_date <= today).filter(
            db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today)
        )
    category = request.args.get('category')
    if category:
        if category not in ANNOUNCEMENT_CATEGORIES:
            return json_error(f'Invalid category (expected one of {", ".join(ANNOUNCEMENT_CATEGORIES)})', 400)
        q = q.filter_by(category=category)
    priority = request.args.get('priority')
    if priority:
        if priority not in PRIORITIES:
            return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
        q = q.filter_by(priority=priority)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Announcement.title.ilike(like), Announcement.message.ilike(like)))
    # A viewer only sees what was actually addressed to them.
    q = scope_visible_to_viewer(q, user, Announcement)

    p = paginate(q.order_by(Announcement.priority.desc(), Announcement.publish_date.desc(),
                            Announcement.created_at.desc()))
    emp = current_employee()
    acked = set()
    if emp and p.items:
        acked = {
            a.announcement_id for a in AnnouncementAck.query.filter(
                AnnouncementAck.employee_id == emp.id,
                AnnouncementAck.announcement_id.in_([a.id for a in p.items]),
            ).all()
        }
    items = []
    for a in p.items:
        d = a.to_dict()
        d['acknowledged_by_me'] = a.id in acked
        d['requires_my_ack'] = bool(a.requires_ack and a.is_active and a.id not in acked)
        items.append(d)
    return paginate_response(items, p)


@bp.get('/pending-acknowledgement')
@require_any_permission('announcements.view', 'announcements.manage')
def pending_acknowledgements():
    """Announcements this viewer still has to acknowledge."""
    emp = current_employee()
    if not emp:
        return jsonify({'items': []})
    today = date.today()
    acked = {a.announcement_id for a in AnnouncementAck.query.filter_by(employee_id=emp.id).all()}
    q = Announcement.query.filter(
        Announcement.requires_ack.is_(True),
        Announcement.publish_date <= today,
        db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
        Announcement.id.notin_(acked or {0}),
    )
    q = scope_visible_to_viewer(q, current_user(), Announcement)
    items = [a.to_dict() for a in q.order_by(Announcement.publish_date.desc()).all()]
    return jsonify({'items': items, 'total': len(items)})


@bp.post('')
@require_permission('announcements.manage')
def create_announcement():
    data = parse_json()
    missing = required(data, 'title', 'message')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    user = current_user()
    err = _validate_audience(data, user)
    if err:
        return err

    category = data.get('category') or 'staff_announcement'
    if category not in ANNOUNCEMENT_CATEGORIES:
        return json_error(f'Invalid category (expected one of {", ".join(ANNOUNCEMENT_CATEGORIES)})', 400)
    priority = data.get('priority') or 'normal'
    if priority not in PRIORITIES:
        return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)

    publish_date, err = parse_date(data.get('publish_date'), 'publish_date')
    if err:
        return err
    expiry_date, err = parse_date(data.get('expiry_date'), 'expiry_date')
    if err:
        return err
    if publish_date and expiry_date and expiry_date < publish_date:
        return json_error('expiry_date cannot be before publish_date', 400)

    attachment_id, err = parse_id(data.get('attachment_document_id'), 'attachment_document_id')
    if err:
        return err

    ann = Announcement(
        title=data['title'].strip(), message=data['message'],
        category=category, audience=data.get('audience') or 'all',
        department_id=data.get('department_id'), branch_id=data.get('branch_id'),
        recipient_ids=dump_recipient_ids(data.get('recipient_ids') or []),
        priority=priority, publish_date=publish_date or date.today(),
        expiry_date=expiry_date, requires_ack=bool(data.get('requires_ack')),
        attachment_document_id=attachment_id, created_by=user.id,
    )
    db.session.add(ann)
    db.session.flush()

    # `None` means audience 'all' — a company-wide post still notifies everyone.
    targets = _resolve_recipients(ann)
    employees = Employee.query
    if targets is not None:
        employees = employees.filter(Employee.id.in_(targets))
    for emp in employees.all():
        notify_employee(emp, 'announcement', f'Announcement: {ann.title}',
                        related_type='announcement', related_id=ann.id)
    db.session.commit()
    audit('announcement_created', 'announcement', ann.id, new_value=ann.to_dict())
    return jsonify({'message': 'Announcement published', 'announcement': ann.to_dict()}), 201


@bp.get('/<int:announcement_id>')
@require_any_permission('announcements.view', 'announcements.manage')
def get_announcement(announcement_id):
    ann = Announcement.query.get(announcement_id)
    if not ann:
        return json_error('Announcement not found', 404)
    user = current_user()
    # Audience scoping has to hold for a directly typed id, not just for lists.
    if not scope_visible_to_viewer(Announcement.query.filter_by(id=ann.id), user, Announcement).first():
        return json_error('Announcement not found', 404)
    d = ann.to_dict()
    emp = current_employee()
    ack = AnnouncementAck.query.filter_by(announcement_id=ann.id, employee_id=emp.id).first() if emp else None
    d['acknowledged_by_me'] = ack is not None
    d['requires_my_ack'] = bool(ann.requires_ack and ann.is_active and ack is None)
    d['my_acknowledgement'] = ack.to_dict() if ack else None
    return jsonify({'announcement': d})


@bp.put('/<int:announcement_id>')
@require_permission('announcements.manage')
def update_announcement(announcement_id):
    ann = Announcement.query.get(announcement_id)
    if not ann:
        return json_error('Announcement not found', 404)
    data = parse_json()
    err = _validate_audience(data, current_user())
    if err:
        return err
    prev = ann.to_dict()

    for field in ('title', 'message', 'category', 'audience', 'priority', 'requires_ack'):
        if field in data:
            value = data[field]
            if field == 'category' and value not in ANNOUNCEMENT_CATEGORIES:
                return json_error(f'Invalid category (expected one of {", ".join(ANNOUNCEMENT_CATEGORIES)})', 400)
            if field == 'priority' and value not in PRIORITIES:
                return json_error(f'Invalid priority (expected one of {", ".join(PRIORITIES)})', 400)
            setattr(ann, field, value)
    for field in ('department_id', 'branch_id', 'attachment_document_id'):
        if field in data:
            parsed, err = parse_id(data[field], field)
            if err:
                return err
            setattr(ann, field, parsed)
    for field in ('publish_date', 'expiry_date'):
        if field in data:
            parsed, err = parse_date(data[field], field)
            if err:
                return err
            setattr(ann, field, parsed)
    if 'recipient_ids' in data:
        ann.recipient_ids = dump_recipient_ids(data['recipient_ids'] or [])
    if ann.expiry_date and ann.expiry_date < ann.publish_date:
        return json_error('expiry_date cannot be before publish_date', 400)

    db.session.commit()
    audit('announcement_updated', 'announcement', ann.id, prev, ann.to_dict())
    return jsonify({'message': 'Announcement updated', 'announcement': ann.to_dict()})


@bp.delete('/<int:announcement_id>')
@require_permission('announcements.manage')
def delete_announcement(announcement_id):
    ann = Announcement.query.get(announcement_id)
    if not ann:
        return json_error('Announcement not found', 404)
    data = ann.to_dict()
    db.session.delete(ann)
    db.session.commit()
    audit('announcement_deleted', 'announcement', announcement_id, previous_value=data)
    return jsonify({'message': 'Announcement deleted'})


@bp.post('/<int:announcement_id>/acknowledge')
@require_any_permission('announcements.view', 'announcements.manage')
def acknowledge_announcement(announcement_id):
    ann = Announcement.query.get(announcement_id)
    if not ann:
        return json_error('Announcement not found', 404)
    if not scope_visible_to_viewer(Announcement.query.filter_by(id=ann.id), current_user(), Announcement).first():
        return json_error('Announcement not found', 404)
    if not ann.is_active:
        return json_error('Announcement is no longer active', 409)
    emp = current_employee()
    if not emp:
        return json_error('No employee profile linked to your account', 400)
    existing = AnnouncementAck.query.filter_by(announcement_id=ann.id, employee_id=emp.id).first()
    if existing:
        return json_error('You have already acknowledged this announcement', 409)
    ack = AnnouncementAck(announcement_id=ann.id, employee_id=emp.id,
                          user_id=current_user().id, acknowledged_at=datetime.now(timezone.utc))
    db.session.add(ack)
    db.session.commit()
    audit('announcement_acknowledged', 'announcement', ann.id, new_value=ack.to_dict())
    return jsonify({'message': 'Announcement acknowledged', 'acknowledgement': ack.to_dict()}), 201


@bp.get('/<int:announcement_id>/acknowledgements')
@require_permission('announcements.manage')
def list_acknowledgements(announcement_id):
    """Who has acknowledged, and who has not — needed to chase acknowledgements."""
    ann = Announcement.query.get(announcement_id)
    if not ann:
        return json_error('Announcement not found', 404)
    acked = {a.employee_id: a for a in ann.acknowledgements}
    user = current_user()
    # Roster is scoped to the viewer: a Coordinator who cannot see Service
    # Agents must not be handed their names, nor count them as outstanding.
    expected = audience_ids_in_scope(
        user, ann.audience, ann.department_id, ann.branch_id, ann.recipient_ids)
    if expected is None:
        # Company-wide: there is no fixed roster, so the ack list itself is
        # filtered down to whoever this viewer is allowed to see.
        allowed = visible_employee_ids(user)
    else:
        allowed = expected
    visible_acked = [a for a in ann.acknowledgements if a.employee_id in allowed]
    outstanding = []
    if expected is not None:
        for emp in Employee.query.filter(Employee.id.in_(expected)).order_by(Employee.id).all():
            if emp.id in acked:
                continue
            outstanding.append({
                'employee_id': emp.id,
                'employee': emp.full_name,
                'position': emp.position,
                'department': emp.department.name if emp.department else None,
                'status': 'pending',
            })
    return jsonify({
        'announcement': ann.to_dict(),
        'acknowledged': [a.to_dict() for a in visible_acked],
        'acknowledged_count': len(visible_acked),
        'expected_count': len(expected) if expected is not None else None,
        'outstanding': outstanding,
        'all_acknowledged': bool(expected) and not outstanding,
    })