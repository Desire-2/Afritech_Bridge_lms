from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    ServiceTransaction, Expense, PayrollPeriod, Employee, Attendance, Task,
    DailyClosing, Instructor, WeeklyPlan, PerformanceScore, Notification, User,
    Branch, Service, Client, TeachingActivity, Assignment, AssignmentSubmission,
    Enrollment, InstructorAssignment,
    Meeting, Activity, Announcement, AnnouncementAck, AdminRequest, FollowUp,
    Escalation, ActionItem, Document, AuditLog,
)
from ..auth.auth import require_any_permission, require_auth, current_user, current_employee
from ..auth.scope import exclude_service_agents, transaction_read_scope
from ..services.commission import default_rate
from .helpers import json_error
from .admin_common import (
    recipient_employee_ids, audience_ids_in_scope, scope_visible_to_viewer,
)

bp = Blueprint('dashboard', __name__, url_prefix='/api/dashboard')


def _decimal_sum(items, attr):
    return sum(Decimal(str(getattr(i, attr) or 0)) for i in items)


@bp.get('')
@require_any_permission('reports.view')
def dashboard():
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    month_start = today.replace(day=1)
    year_start = today.replace(month=1, day=1)

    def _txns(start):
        q = ServiceTransaction.query.filter(
            ServiceTransaction.transaction_date >= start,
            ServiceTransaction.transaction_date <= today,
        )
        return q.filter_by(status='completed').all()

    today_txns = _txns(today)
    week_txns = _txns(week_start)
    month_txns = _txns(month_start)
    year_txns = _txns(year_start)

    def _revenue(txns):
        return sum(float(t.customer_price) for t in txns)

    def _company(txns):
        return sum(float(t.company_profit) for t in txns)

    def _commission(txns):
        return sum(float(t.commission_amount) for t in txns)

    def _gross(txns):
        return sum(float(t.gross_profit) for t in txns)

    today_expenses = Expense.query.filter(
        Expense.expense_date == today,
        Expense.status.in_(['approved', 'paid']),
    ).all()
    month_expenses = Expense.query.filter(
        Expense.expense_date >= month_start,
        Expense.status.in_(['approved', 'paid']),
    ).all()
    month_payroll = 0.0
    for p in PayrollPeriod.query.filter(
        PayrollPeriod.period_start <= today, PayrollPeriod.period_end >= today
    ).all():
        if p.status in ('approved', 'paid'):
            month_payroll += sum(float(i.net_salary or 0) for i in p.items)

    active_employees = Employee.query.filter_by(status='active').count()
    today_attendance = Attendance.query.filter_by(attendance_date=today).count()
    open_tasks = Task.query.filter(Task.status.in_(['todo', 'in_progress'])).count()
    overdue_tasks = Task.query.filter(
        Task.due_date < today, Task.status.in_(['todo', 'in_progress'])
    ).count()

    active_instructors = Instructor.query.filter_by(is_active=True).count()
    current_plans = WeeklyPlan.query.filter(
        WeeklyPlan.week_start <= today, WeeklyPlan.week_end >= today
    ).all()
    plan_progress = sum(p.progress_percent() for p in current_plans) / len(current_plans) if current_plans else 0

    top_services = {}
    top_employees = {}
    month_all = month_txns
    for t in month_all:
        top_services[t.service_name] = top_services.get(t.service_name, 0) + 1
        name = t.snapshot_employee_name()
        top_employees[name] = top_employees.get(name, 0) + float(t.company_profit)

    recent_scores = PerformanceScore.query.order_by(PerformanceScore.updated_at.desc()).limit(5).all()

    unread = 0
    user = current_user()
    if user:
        unread = Notification.query.filter_by(recipient_id=user.id, is_read=False).count()

    return jsonify({
        'period': {'today': today.isoformat()},
        'financial': {
            'today_revenue': round(_revenue(today_txns), 2),
            'week_revenue': round(_revenue(week_txns), 2),
            'month_revenue': round(_revenue(month_txns), 2),
            'year_revenue': round(_revenue(year_txns), 2),
            'today_gross_profit': round(_gross(today_txns), 2),
            'month_gross_profit': round(_gross(month_txns), 2),
            'today_company_profit': round(_company(today_txns), 2),
            'month_company_profit': round(_company(month_txns), 2),
            'month_commission': round(_commission(month_txns), 2),
            'today_expenses': round(sum(float(e.amount) for e in today_expenses), 2),
            'month_expenses': round(sum(float(e.amount) for e in month_expenses), 2),
            'month_payroll': round(month_payroll, 2),
            'month_net_profit': round(_company(month_txns) - sum(float(e.amount) for e in month_expenses) - month_payroll, 2),
        },
        'service_center': {
            'transactions_today': len(today_txns),
            'transactions_week': len(week_txns),
            'transactions_month': len(month_txns),
            'completed_services_today': len(today_txns),
            'pending_services': _pending_count(today),
            'cancelled_month': ServiceTransaction.query.filter(
                ServiceTransaction.status.in_(['cancelled', 'refunded', 'failed']),
                ServiceTransaction.transaction_date >= month_start,
            ).count(),
            'top_services': [{'name': k, 'count': v} for k, v in sorted(top_services.items(), key=lambda x: x[1], reverse=True)[:5]],
            'top_employees': [{'name': k, 'profit': round(v, 2)} for k, v in sorted(top_employees.items(), key=lambda x: x[1], reverse=True)[:5]],
        },
        'employees': {
            'active_employees': active_employees,
            'today_attendance': today_attendance,
            'open_tasks': open_tasks,
            'overdue_tasks': overdue_tasks,
            'total_employees': Employee.query.count(),
        },
        'instructors': {
            'active_instructors': active_instructors,
            'current_plans': len(current_plans),
            'plan_completion': round(plan_progress, 2),
            'recent_scores': [s.to_dict() for s in recent_scores],
        },
        'closings_pending': DailyClosing.query.filter_by(status='submitted').count(),
        'expenses_pending': Expense.query.filter_by(status='pending').count(),
        'unread_notifications': unread,
        'commission_default': float(default_rate()[0]),
        'branch_count': Branch.query.count(),
        'service_count': Service.query.filter_by(is_active=True).count(),
        'client_count': Client.query.count(),
    })


def _pending_count(target_date):
    return ServiceTransaction.query.filter_by(transaction_date=target_date, status='processing').count()


@bp.get('/me')
@require_auth
def my_dashboard():
    """Personal dashboard for agents/instructors (own data only)."""
    today = date.today()
    month_start = today.replace(day=1)
    emp = current_employee()
    base = {'today': today.isoformat(), 'unread_notifications': 0}
    user = current_user()
    if user:
        base['unread_notifications'] = Notification.query.filter_by(recipient_id=user.id, is_read=False).count()

    if emp:
        my_txns = ServiceTransaction.query.filter(
            ServiceTransaction.employee_id == emp.id,
            ServiceTransaction.status == 'completed',
            ServiceTransaction.transaction_date >= month_start,
        ).all()
        today_txns = ServiceTransaction.query.filter_by(employee_id=emp.id, transaction_date=today, status='completed').all()
        base['my_transactions_month'] = len(my_txns)
        base['my_commission_month'] = round(sum(float(t.commission_amount) for t in my_txns), 2)
        base['my_revenue_month'] = round(sum(float(t.customer_price) for t in my_txns), 2)
        base['my_transactions_today'] = len(today_txns)
        my_closing = DailyClosing.query.filter_by(employee_id=emp.id, closing_date=today).first()
        base['closing_status_today'] = my_closing.status if my_closing else None
        my_tasks = Task.query.filter_by(assigned_to=emp.id)
        base['my_open_tasks'] = my_tasks.filter(Task.status.in_(['todo', 'in_progress'])).count()
        base['my_overdue_tasks'] = my_tasks.filter(
            Task.due_date < today, Task.status.in_(['todo', 'in_progress'])
        ).count()
        att = Attendance.query.filter_by(employee_id=emp.id, attendance_date=today).first()
        base['today_attendance'] = att.to_dict() if att else None

    if emp and emp.instructor:
        base['is_instructor'] = True
        ins = emp.instructor
        plans = WeeklyPlan.query.filter_by(instructor_id=ins.id).order_by(WeeklyPlan.week_start.desc()).limit(5).all()
        base['recent_weekly_plans'] = [p.to_dict() for p in plans]
        base['teaching_activities_today'] = TeachingActivity.query.filter_by(
            instructor_id=ins.id, activity_date=today
        ).count()
        upcoming = TeachingActivity.query.filter(
            TeachingActivity.instructor_id == ins.id,
            TeachingActivity.activity_date >= today,
        ).order_by(TeachingActivity.activity_date.asc()).limit(5).all()
        base['upcoming_activities'] = [t.to_dict() for t in upcoming]
        cur = WeeklyPlan.query.filter(
            WeeklyPlan.instructor_id == ins.id,
            WeeklyPlan.week_start <= today,
            WeeklyPlan.week_end >= today,
        ).first()
        base['current_plan'] = cur.to_dict() if cur else None
        base['plan_completion'] = cur.progress_percent() if cur else 0
        assign_ids = [a.id for a in Assignment.query.filter_by(instructor_id=ins.id).all()]
        base['pending_grading'] = (
            AssignmentSubmission.query.filter(
                AssignmentSubmission.assignment_id.in_(assign_ids),
                AssignmentSubmission.graded == False,  # noqa: E712
            ).count() if assign_ids else 0
        )
        cohort_ids = [a.cohort_id for a in InstructorAssignment.query.filter_by(instructor_id=ins.id, is_active=True).all()]
        base['assigned_cohorts'] = len(cohort_ids)
        base['total_learners'] = Enrollment.query.filter(
            Enrollment.cohort_id.in_(cohort_ids)
        ).count() if cohort_ids else 0

    return jsonify(base)


@bp.get('/secretary')
@require_any_permission(
    'reports.operational', 'announcements.manage', 'meetings.manage',
    'documents.manage', 'requests.manage', 'followups.manage', 'escalations.manage',
)
def secretary_dashboard():
    """Company Secretary workspace summary.

    Deliberately operational: meetings, tasks, attendance counts, requests,
    follow-ups, escalations and announcements. No revenue, commission, payroll,
    expense or salary figure appears anywhere in this payload — the Secretary
    has no financial permissions, so the numbers are not merely hidden in the
    frontend, they are never computed here.
    """
    user = current_user()
    emp = current_employee()
    today = date.today()
    week_start = today - timedelta(days=today.weekday())
    allowed = {e.id for e in exclude_service_agents(Employee.query, user, Employee.id).all()}

    base = {
        'today': today.isoformat(),
        'week_start': week_start.isoformat(),
        'employee': {
            'id': emp.id if emp else None,
            'name': emp.full_name if emp else None,
            'position': emp.position if emp else None,
            'department': emp.department.name if emp and emp.department else None,
            'branch': emp.branch.name if emp and emp.branch else None,
        },
        'unread_notifications': 0,
    }
    if user:
        base['unread_notifications'] = Notification.query.filter_by(
            recipient_id=user.id, is_read=False).count()

    # Today's meetings.
    meetings_today = Meeting.query.filter(
        Meeting.meeting_date == today, Meeting.status != 'cancelled').all()
    base['meetings_today'] = [m.to_dict() for m in meetings_today]
    base['meetings_today_count'] = len(meetings_today)
    base['meetings_awaiting_minutes'] = Meeting.query.filter(
        Meeting.meeting_date < today,
        Meeting.status.in_(('completed', 'in_progress')),
    ).count()
    base['upcoming_meetings'] = [
        m.to_dict() for m in Meeting.query.filter(
            Meeting.meeting_date > today, Meeting.status == 'scheduled'
        ).order_by(Meeting.meeting_date.asc()).limit(5).all()
    ]

    # Tasks the Secretary is responsible for verifying.
    open_tasks = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.status.notin_(('done', 'cancelled')),
    )
    base['tasks_open'] = open_tasks.count()
    base['tasks_overdue'] = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.status.in_(('todo', 'in_progress')),
        Task.due_date < today,
    ).count()
    base['tasks_awaiting_verification'] = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}), Task.status == 'submitted').count()
    base['my_tasks'] = [t.to_dict() for t in Task.query.filter(
        Task.assigned_to == emp.id,
        Task.status.notin_(('done', 'cancelled')),
    ).order_by(Task.due_date.is_(None), Task.due_date.asc()).limit(10).all()] if emp else []
    base['tasks_due_tomorrow'] = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.due_date == today + timedelta(days=1),
        Task.status.notin_(('done', 'cancelled')),
    ).count()

    # Attendance, operational only (no overtime / pay figures).
    month_start = today.replace(day=1)
    attendance_month = Attendance.query.filter(
        Attendance.employee_id.in_(allowed or {0}),
        Attendance.attendance_date >= month_start,
    )
    status_counts = {row[0]: row[1] for row in db.session.query(
        Attendance.status, db.func.count(Attendance.id)
    ).filter(
        Attendance.employee_id.in_(allowed or {0}),
        Attendance.attendance_date >= month_start,
    ).group_by(Attendance.status).all()}
    base['attendance_month'] = {
        'period_start': month_start.isoformat(),
        'present': status_counts.get('present', 0),
        'late': status_counts.get('late', 0),
        'absent': status_counts.get('absent', 0),
        'leave': status_counts.get('leave', 0),
        'records': attendance_month.count(),
        'employees_tracked': len(allowed),
    }
    base['not_clocked_in_today'] = Attendance.query.filter(
        Attendance.attendance_date == today,
        Attendance.clock_in.is_(None),
        Attendance.employee_id.in_(allowed or {0}),
    ).count()

    # Requests, follow-ups, escalations.
    open_requests = AdminRequest.query.filter(
        AdminRequest.requested_by.in_(allowed or {0}),
        AdminRequest.status.in_(('submitted', 'in_review', 'more_info', 'forwarded')),
    )
    base['requests_open'] = open_requests.count()
    base['requests_stale'] = sum(1 for r in open_requests.all() if r.is_stale)
    base['requests_by_status'] = {
        row[0]: row[1] for row in db.session.query(
            AdminRequest.status, db.func.count(AdminRequest.id)
        ).filter(
            AdminRequest.requested_by.in_(allowed or {0}),
            AdminRequest.status.in_(('submitted', 'in_review', 'more_info', 'forwarded')),
        ).group_by(AdminRequest.status).all()
    }
    base['recent_requests'] = [r.to_dict() for r in AdminRequest.query.filter(
        AdminRequest.requested_by.in_(allowed or {0}),
        AdminRequest.status.notin_(('closed',)),
    ).order_by(AdminRequest.created_at.desc()).limit(5).all()]

    open_followups = FollowUp.query.filter(
        FollowUp.employee_id.in_(allowed or {0}),
        FollowUp.status.in_(('open', 'waiting')),
    )
    base['followups_open'] = open_followups.count()
    base['followups_overdue'] = sum(1 for f in open_followups.all() if f.is_overdue)
    base['overdue_followups'] = [f.to_dict() for f in FollowUp.query.filter(
        FollowUp.employee_id.in_(allowed or {0}),
        FollowUp.status.in_(('open', 'waiting')),
        FollowUp.next_follow_up.isnot(None),
        FollowUp.next_follow_up < today,
    ).order_by(FollowUp.next_follow_up.asc()).limit(5).all()]

    base['escalations_open'] = Escalation.query.filter(
        Escalation.status.in_(('created', 'assigned'))).count()
    base['recent_escalations'] = [e.to_dict() for e in Escalation.query.filter(
        Escalation.status.in_(('created', 'assigned'))
    ).order_by(Escalation.created_at.desc()).limit(5).all()]

    # Announcements and acknowledgements.
    base['announcements_active'] = Announcement.query.filter(
        Announcement.publish_date <= today,
        db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
    ).count()
    acked_ids = {a.announcement_id for a in AnnouncementAck.query.filter_by(
        employee_id=emp.id).all()} if emp else set()
    pending_ack = Announcement.query.filter(
        Announcement.requires_ack.is_(True),
        Announcement.publish_date <= today,
        db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
        Announcement.id.notin_(acked_ids or {0}),
    ).all()
    base['announcements_pending_my_ack'] = [
        a.to_dict() for a in scope_visible_to_viewer(
            Announcement.query.filter(Announcement.id.in_([a.id for a in pending_ack] or [0])),
            user, Announcement).all()
    ]
    acks_pending_chase = 0
    for ann in Announcement.query.filter(
        Announcement.requires_ack.is_(True),
        Announcement.publish_date <= today,
        db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= today),
    ).all():
        # Scoped to the viewer, so a Coordinator is never shown (or made to
        # chase) an acknowledgement from a Service Agent.
        expected = audience_ids_in_scope(
            user, ann.audience, ann.department_id, ann.branch_id, ann.recipient_ids)
        if expected is None:
            continue
        acked = {a.employee_id for a in ann.acknowledgements}
        acks_pending_chase += len((expected & allowed) - acked)
    base['acknowledgements_pending'] = acks_pending_chase

    # Documents.
    base['documents_total'] = Document.query.count()
    base['recent_documents'] = [d.to_dict() for d in Document.query.order_by(
        Document.created_at.desc()).limit(5).all()]

    # Activities / planning.
    base['activities_today'] = [a.to_dict() for a in Activity.query.filter(
        Activity.activity_date == today, Activity.status != 'cancelled',
    ).order_by(Activity.position).all()]
    base['open_action_items'] = ActionItem.query.filter(
        ActionItem.status.in_(('open', 'in_progress'))).count()
    base['overdue_action_items'] = sum(
        1 for a in ActionItem.query.filter(
            ActionItem.status.in_(('open', 'in_progress'))).all() if a.is_overdue)

    # ── coordination workspace feed ─────────────────────────────────────────
    # Everything below answers "what needs attention, when, and who owns it".
    # It is built from status columns only — no revenue, commission, payroll,
    # expense or salary value is ever selected here.

    task_status = {row[0]: row[1] for row in db.session.query(
        Task.status, db.func.count(Task.id)
    ).filter(Task.assigned_to.in_(allowed or {0})).group_by(Task.status).all()}
    task_overdue = Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.status.in_(('todo', 'in_progress')),
        Task.due_date < today,
    ).count()
    base['task_progress'] = {
        'assigned': sum(task_status.values()),
        'todo': task_status.get('todo', 0),
        'in_progress': task_status.get('in_progress', 0),
        'awaiting_verification': task_status.get('submitted', 0),
        'completed': task_status.get('done', 0),
        'overdue': task_overdue,
        'cancelled': task_status.get('cancelled', 0),
        'completion_rate': round(
            task_status.get('done', 0) / sum(task_status.values()) * 100, 1
        ) if task_status else 0.0,
    }

    def _hhmm(value):
        return value.strftime('%H:%M') if value else None

    # One merged, time-ordered agenda for today: meetings, activities and
    # tasks that are due before the day closes.
    schedule = []
    for m in meetings_today:
        schedule.append({
            'kind': 'meeting', 'id': m.id, 'time': _hhmm(m.start_time),
            'end_time': _hhmm(m.end_time), 'title': m.title,
            'detail': m.location or m.branch or m.department or '',
            'status': m.status, 'href': '/meetings',
        })
    for a in base['activities_today']:
        schedule.append({
            'kind': 'activity', 'id': a['id'], 'time': a.get('start_time'),
            'end_time': a.get('end_time'), 'title': a['title'],
            'detail': a.get('location') or a.get('category') or '',
            'status': a['status'], 'href': '/activities',
        })
    for t in Task.query.filter(
        Task.assigned_to.in_(allowed or {0}),
        Task.due_date == today,
        Task.status.in_(('todo', 'in_progress')),
    ).order_by(Task.due_date).limit(10).all():
        schedule.append({
            'kind': 'task', 'id': t.id, 'time': None, 'end_time': None,
            'title': t.title, 'detail': f"Due today · {t.assignee.full_name if t.assignee else ''}",
            'status': t.status, 'href': '/tasks',
        })
    schedule.sort(key=lambda row: (row['time'] is None, row['time'] or ''))
    base['today_schedule'] = schedule

    # The week the Secretary is planning against, day by day.
    week_days = []
    for offset in range(7):
        day = week_start + timedelta(days=offset)
        week_days.append({
            'date': day.isoformat(),
            'weekday': day.strftime('%A'),
            'is_today': day == today,
            'meetings': Meeting.query.filter(
                Meeting.meeting_date == day, Meeting.status != 'cancelled').count(),
            'activities': Activity.query.filter(
                Activity.activity_date == day, Activity.status != 'cancelled').count(),
            'task_deadlines': Task.query.filter(
                Task.assigned_to.in_(allowed or {0}),
                Task.due_date == day,
                Task.status.notin_(('done', 'cancelled'))).count(),
        })
    base['week_overview'] = week_days

    # Follow-ups the Secretary should chase next.
    pending_service_open = 0
    if user and transaction_read_scope(user) != 'own':
        pending_service_open = ServiceTransaction.query.filter(
            ServiceTransaction.status.in_(('created', 'processing'))).count()

    attention = [
        ('Overdue tasks', task_overdue, '/tasks', 'danger', 'bi-exclamation-circle'),
        ('Tasks awaiting your verification',
         base['tasks_awaiting_verification'], '/tasks', 'warning', 'bi-check2-all'),
        ('Meetings awaiting minutes',
         base['meetings_awaiting_minutes'], '/meetings', 'warning', 'bi-journal-text'),
        ('Overdue action items',
         base['overdue_action_items'], '/meetings', 'danger', 'bi-flag'),
        ('Stale employee requests', base['requests_stale'], '/requests', 'warning', 'bi-inbox'),
        ('Overdue follow-ups', base['followups_overdue'], '/follow-ups', 'danger', 'bi-arrow-repeat'),
        ('Service requests pending follow-up',
         pending_service_open, '/transactions', 'warning', 'bi-hourglass-split'),
        ('Employees not clocked in today',
         base['not_clocked_in_today'], '/attendance', 'warning', 'bi-clock-history'),
        ('Announcements awaiting acknowledgement',
         base['acknowledgements_pending'], '/announcements', 'info', 'bi-megaphone'),
        ('Open escalations', base['escalations_open'], '/escalations', 'danger',
         'bi-exclamation-diamond'),
    ]
    base['needs_attention'] = [
        {'label': label, 'count': count, 'href': href, 'tone': tone, 'icon': icon}
        for label, count, href, tone, icon in attention if count
    ]

    # Service-centre status, visible only to roles that may read it at all.
    base['service_operations'] = None
    if user and transaction_read_scope(user) != 'own':
        svc_status = {row[0]: row[1] for row in db.session.query(
            ServiceTransaction.status, db.func.count(ServiceTransaction.id)
        ).group_by(ServiceTransaction.status).all()}
        base['service_operations'] = {
            'total': sum(svc_status.values()),
            'completed': svc_status.get('completed', 0),
            'processing': svc_status.get('processing', 0),
            'created': svc_status.get('created', 0),
            'failed': svc_status.get('failed', 0),
            'cancelled': svc_status.get('cancelled', 0),
            'pending_follow_up': svc_status.get('created', 0) + svc_status.get('processing', 0),
        }

    # Recent coordination activity, straight from the audit trail.
    COORDINATION_ACTIONS = (
        'task_created', 'task_updated', 'task_comment_added',
        'meeting_created', 'meeting_updated', 'meeting_minutes_recorded',
        'meeting_attendance_recorded', 'action_item_created', 'action_item_updated',
        'activity_created', 'activity_updated', 'activity_deleted',
        'announcement_created', 'announcement_updated', 'announcement_acknowledged',
        'memo_created', 'memo_published', 'memo_updated',
        'document_uploaded', 'document_updated', 'document_deleted',
        'admin_request_created', 'admin_request_updated', 'admin_request_resolved',
        'followup_created', 'followup_updated', 'followup_progress_recorded',
        'escalation_created', 'escalation_updated', 'escalation_resolved',
        'leave_requested', 'leave_request_decided',
        'employee_updated', 'attendance_recorded',
    )
    base['recent_activity'] = [{
        'id': row.id,
        'action': row.action,
        'entity': row.entity,
        'entity_id': row.entity_id,
        'actor': row.user_email,
        'at': row.created_at.isoformat() if row.created_at else None,
    } for row in AuditLog.query.filter(
        AuditLog.action.in_(COORDINATION_ACTIONS),
    ).order_by(AuditLog.created_at.desc()).limit(10).all()]

    return jsonify(base)