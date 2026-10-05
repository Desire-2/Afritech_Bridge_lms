"""
Deterministic rule-based automation engine.

Rules currently implemented:
  cash-shortage           : alert when daily closing cash difference exceeds configured threshold
  closing-approval        : alert manager when a closing awaits approval
  expense-approval        : alert when an expense awaits approval
  overdue-task            : alert assignee when a task is overdue
  missing-weekly-plan     : alert manager/instructor when a weekly plan for the current week is missing
  instructor-behind       : alert manager when weekly plan progress is below threshold
  ungraded-assignment     : alert instructor when an assignment remains ungraded past configured days
  task-due-tomorrow       : alert assignee and coordinators about work due tomorrow
  meeting-reminder         : alert participants and coordinators about tomorrow's meetings
  activity-reminder        : alert participants and coordinators about tomorrow's activities
  attendance-alert         : alert coordinators about today's absences and late arrivals
  acknowledgement-pending : alert coordinators about outstanding announcement acknowledgements
  request-stale           : alert coordinators about requests unresolved for more than two days
  task-awaiting-verification: alert coordinators about submitted work awaiting verification

Thresholds come from the settings table:
  automation.cash_shortage_threshold
  automation.plan_progress_threshold
  automation.ungraded_days
"""
from datetime import date, timedelta, datetime, timezone

from ..extensions import db
from ..models import (
    DailyClosing, Expense, Task, WeeklyPlan, Assignment,
    Instructor, Employee, User, Setting,
    Meeting, Announcement, AdminRequest, Activity, Attendance,
)
from ..auth.scope import can_access_service_agents, is_service_agent_employee
from ..utils.datetime_utils import as_utc
from .audience import recipient_employee_ids
from .notifications import notify


def _setting_float(key, default):
    row = Setting.query.filter_by(key=key).first()
    if row and row.value:
        try:
            return float(row.value)
        except Exception:
            return default
    return default


def _setting_int(key, default):
    row = Setting.query.filter_by(key=key).first()
    if row and row.value:
        try:
            return int(round(float(row.value)))
        except Exception:
            return default
    return default


def _managers():
    users = User.query.filter(User.is_active.is_(True)).all()
    return [u for u in users if u.is_super_admin or set(['manager', 'super_admin']).intersection(u.role_codes)]


def _secretaries():
    """Active users holding the Company Secretary role."""
    return [u for u in User.query.filter(User.is_active.is_(True)).all()
            if 'company_secretary' in u.role_codes]


def _coordinators():
    """Every user who should receive coordination reminders.

    Super admins and managers act as coordinators too, so they are included
    rather than making them adopt the Secretary role to see their own queue.
    """
    seen, out = set(), []
    for user in _secretaries() + _managers():
        if user.id not in seen:
            seen.add(user.id)
            out.append(user)
    return out


def _coordinator_can_see(user, employee):
    """Whether ``user`` may be told about a record belonging to ``employee``.

    Coordination reminders used to fan out to every coordinator for every
    record, which quietly punched a hole in the Service Agent boundary: a
    Company Secretary holding no service permission would still receive the
    title of an agent's task or meeting. Each reminder is therefore filtered
    per recipient, using the same permission-based test as the REST layer.
    """
    if employee is None:
        return True
    if can_access_service_agents(user):
        return True
    return not is_service_agent_employee(employee)


def _notify_coordinators(notification_type, message, employees, severity, related_type, related_id, rule):
    """Notify only the coordinators allowed to see ``employees``.

    ``employees`` may be a single Employee, an iterable of them, or None (no
    employee attached, so there is nothing to scope). Returns how many
    notifications were actually sent — the count the rules report.
    """
    if employees is None:
        candidates = []
    elif isinstance(employees, Employee):
        candidates = [employees]
    else:
        candidates = list(employees)

    count = 0
    for u in _coordinators():
        if any(not _coordinator_can_see(u, emp) for emp in candidates):
            continue
        if notify(
            u, notification_type, message,
            severity=severity, related_type=related_type, related_id=related_id,
            rule=rule,
        ):
            count += 1
    return count


def run_all(scope_date=None):
    scope_date = scope_date or date.today()
    triggers = [
        cash_shortage_alert,
        closing_approval_alert,
        expense_approval_alert,
        overdue_task_alert,
        missing_weekly_plan_alert,
        instructor_behind_schedule_alert,
        task_due_tomorrow_alert,
        upcoming_meeting_reminder,
        upcoming_activity_reminder,
        attendance_status_alert,
        pending_acknowledgement_reminder,
        stale_request_reminder,
        task_awaiting_verification_alert,
        ungraded_assignment_alert,
    ]
    # Electronics shop rules share the same schedule, de-duplication window and
    # commit contract as the rest of the engine. Imported lazily so a shop-less
    # deployment (or a partially migrated one) still runs the core rules.
    try:
        from .shop_alerts import TRIGGERS as SHOP_TRIGGERS
        triggers = triggers + list(SHOP_TRIGGERS)
    except Exception:  # pragma: no cover - shop tables not migrated yet
        pass
    run = []
    for t in triggers:
        try:
            # SAVEPOINT per rule: a rule that blows up rolls back only its own
            # work. The old unconditional `session.rollback()` discarded every
            # notification the earlier rules of the same run had queued.
            with db.session.begin_nested():
                n = t(scope_date)
            run.append((t.__name__, n))
        except Exception as e:  # noqa: BLE001 - isolate failures per rule
            run.append((t.__name__, f'error: {e}'))
    # Persist what the rules produced; `notify()` only queues rows, and the
    # caller (scheduler thread, settings endpoint, test) has no request cycle.
    # Unconditional: the rule counters are NOT a proxy for "something was
    # written" — a recipient who muted the in-app channel makes `notify()`
    # return None while still queueing the de-duplication watermark, and
    # skipping the commit there rolled the watermark back, so the next run
    # re-sent the same e-mail. Committing an empty session is a no-op.
    db.session.commit()
    return run


def cash_shortage_alert(scope_date):
    threshold = _setting_float('automation.cash_shortage_threshold', 0)
    closings = DailyClosing.query.filter(
        DailyClosing.closing_date == scope_date,
        DailyClosing.status.in_(['submitted', 'approved']),
    ).all()
    count = 0
    for c in closings:
        diff = float(c.cash_difference or 0)
        if diff < 0 and abs(diff) >= threshold:
            for m in _managers():
                if notify(
                    m, 'cash_shortage',
                    f'Cash shortage detected: {abs(diff):,.0f} RWF for {c.employee.full_name} on {scope_date}.',
                    severity='critical', related_type='daily_closing', related_id=c.id, rule='cash-shortage'
                ):
                    count += 1
    return count


def closing_approval_alert(scope_date):
    closings = DailyClosing.query.filter_by(status='submitted').all()
    count = 0
    for c in closings:
        for m in _managers():
            if notify(
                m, 'closing_approval',
                f'Daily closing awaiting approval: {c.employee.full_name} ({c.closing_date}).',
                severity='warning', related_type='daily_closing', related_id=c.id, rule='closing-approval'
            ):
                count += 1
    return count


def expense_approval_alert(scope_date=None):
    expenses = Expense.query.filter_by(status='pending').all()
    count = 0
    for e in expenses:
        for m in _managers():
            if notify(
                m, 'expense_approval',
                f'Expense awaiting approval: {e.category} {e.amount:,.0f} RWF.',
                severity='warning', related_type='expense', related_id=e.id, rule='expense-approval'
            ):
                count += 1
    return count


def overdue_task_alert(scope_date):
    tasks = Task.query.filter(
        Task.status.in_(['todo', 'in_progress']),
        Task.due_date.isnot(None),
        Task.due_date < scope_date,
    ).all()
    count = 0
    for t in tasks:
        if t.assignee and t.assignee.user_id:
            if notify(
                t.assignee.user_id, 'task_overdue',
                f'Overdue task: {t.title} (due {t.due_date}).',
                severity='warning', related_type='task', related_id=t.id, rule='overdue-task'
            ):
                count += 1
    return count


def missing_weekly_plan_alert(scope_date):
    week_start = scope_date - timedelta(days=scope_date.weekday())
    week_end = week_start + timedelta(days=6)
    instructors = Instructor.query.filter_by(is_active=True).all()
    count = 0
    for ins in instructors:
        if ins.employee is None or ins.employee.status != 'active':
            continue
        exists = WeeklyPlan.query.filter_by(instructor_id=ins.id, week_start=week_start).first()
        if not exists:
            if ins.employee.user_id:
                if notify(
                    ins.employee.user_id, 'missing_weekly_plan',
                    f'No weekly plan submitted for week {week_start}–{week_end}.',
                    severity='warning', related_type='instructor', related_id=ins.id, rule='missing-weekly-plan'
                ):
                    count += 1
            for m in _managers():
                if notify(
                    m, 'missing_weekly_plan',
                    f'{ins.employee.full_name} has no weekly plan for {week_start}–{week_end}.',
                    severity='warning', related_type='instructor', related_id=ins.id, rule='missing-weekly-plan'
                ):
                    count += 1
    return count


def instructor_behind_schedule_alert(scope_date):
    threshold = _setting_float('automation.plan_progress_threshold', 50)
    plans = WeeklyPlan.query.filter(
        WeeklyPlan.week_start <= scope_date,
        WeeklyPlan.week_end >= scope_date,
    ).all()
    count = 0
    for p in plans:
        if p.progress_percent() < threshold:
            for m in _managers():
                if notify(
                    m, 'instructor_behind',
                    f'Instructor {p.instructor.employee.full_name} weekly plan progress is {p.progress_percent()}% (threshold {threshold}%).',
                    severity='warning', related_type='weekly_plan', related_id=p.id, rule='instructor-behind'
                ):
                    count += 1
    return count


def ungraded_assignment_alert(scope_date=None):
    scope_date = scope_date or date.today()
    days = _setting_int('automation.ungraded_days', 7)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    count = 0
    for a in Assignment.query.all():
        ungraded = [s for s in a.submissions if not s.graded and as_utc(s.submitted_at) < cutoff]
        if ungraded:
            if a.instructor and a.instructor.employee and a.instructor.employee.user_id:
                if notify(
                    a.instructor.employee.user_id, 'grading_overdue',
                    f'{len(ungraded)} submission(s) older than {days} days await grading for "{a.title}".',
                    severity='warning', related_type='assignment', related_id=a.id, rule='ungraded-assignment'
                ):
                    count += 1
    return count


def run_scheduled():
    run_all()
    return 'ok'


# ── Company Secretary coordination rules ──────────────────────────────────────
# These only ever carry coordination facts (who, what, when). No rule below
# reads a revenue, commission, payroll, expense or salary field.


def task_due_tomorrow_alert(scope_date=None):
    """Tell the assignee and the coordinators a task is due tomorrow."""
    scope_date = scope_date or date.today()
    tomorrow = scope_date + timedelta(days=1)
    tasks = Task.query.filter(
        Task.due_date == tomorrow,
        Task.status.in_(('todo', 'in_progress')),
    ).all()
    count = 0
    for t in tasks:
        if t.assignee and t.assignee.user_id:
            if notify(
                t.assignee.user_id, 'task_due_tomorrow',
                f'Task "{t.title}" is due tomorrow ({tomorrow}).',
                severity='info', related_type='task', related_id=t.id, rule='task-due-tomorrow',
            ):
                count += 1
        for u in _coordinators():
            # Don't double-notify the assignee, and never tell a coordinator
            # about work that belongs to a Service Agent they cannot see.
            if t.assignee and t.assignee.user_id == u.id:
                continue
            if not _coordinator_can_see(u, t.assignee):
                continue
            if notify(
                u, 'task_due_tomorrow',
                f'"{t.title}" is due tomorrow'
                + (f' ({t.assignee.full_name}).' if t.assignee else '.'),
                severity='info', related_type='task', related_id=t.id, rule='task-due-tomorrow',
            ):
                count += 1
    return count


def upcoming_meeting_reminder(scope_date=None):
    """Remind participants and coordinators about tomorrow's meetings."""
    scope_date = scope_date or date.today()
    tomorrow = scope_date + timedelta(days=1)
    meetings = Meeting.query.filter(
        Meeting.meeting_date == tomorrow,
        Meeting.status == 'scheduled',
    ).all()
    count = 0
    for m in meetings:
        when = f'{m.start_time.strftime("%H:%M")}' if m.start_time else 'during the day'
        participants = [p.employee for p in m.participants if p.employee]
        for emp in participants:
            if emp.user_id:
                if notify(
                    emp.user_id, 'meeting_reminder',
                    f'Reminder: "{m.title}" is tomorrow at {when}'
                    + (f' in {m.location}.' if m.location else '.'),
                    severity='info', related_type='meeting', related_id=m.id,
                    rule='meeting-reminder',
                ):
                    count += 1
        count += _notify_coordinators(
            'meeting_reminder',
            f'Meeting tomorrow at {when}: "{m.title}"'
            + (f' ({len(m.participants)} invited).' if m.participants else ' (no participants).'),
            employees=participants or None,
            severity='info', related_type='meeting', related_id=m.id,
            rule='meeting-reminder',
        )
    return count


def upcoming_activity_reminder(scope_date=None):
    """Remind participants and coordinators about tomorrow's activities."""
    scope_date = scope_date or date.today()
    tomorrow = scope_date + timedelta(days=1)
    activities = Activity.query.filter(
        Activity.activity_date == tomorrow,
        Activity.status.in_(('planned', 'in_progress')),
    ).all()
    count = 0
    for a in activities:
        when = f' at {a.start_time.strftime("%H:%M")}' if a.start_time else ''
        participants = [p.employee for p in a.participants if p.employee]
        for emp in participants:
            if emp.user_id:
                if notify(
                    emp.user_id, 'activity_reminder',
                    f'Reminder: "{a.title}" is tomorrow ({tomorrow}){when}.',
                    severity='info', related_type='activity', related_id=a.id,
                    rule='activity-reminder',
                ):
                    count += 1
        count += _notify_coordinators(
            'activity_reminder',
            f'Activity tomorrow ({tomorrow}): "{a.title}"'
            + (f' ({len(a.participants)} invited).' if a.participants else '.'),
            employees=participants or None,
            severity='info', related_type='activity', related_id=a.id,
            rule='activity-reminder',
        )
    return count


def attendance_status_alert(scope_date=None):
    """Tell coordinators who is absent or late today.

    Absences and late arrivals are recorded by the attendance routes; the
    people running the day only learn about them if somebody tells them. The
    24-hour rule window keeps a re-run from re-paging the same record, and the
    central gate in `notify()` keeps Service-Agent absences away from
    coordinators that may not see those employees.
    """
    scope_date = scope_date or date.today()
    rows = Attendance.query.filter(
        Attendance.attendance_date == scope_date,
        Attendance.status.in_(('absent', 'late')),
    ).all()
    count = 0
    for rec in rows:
        employee = Employee.query.get(rec.employee_id)
        if employee is None:
            continue
        count += _notify_coordinators(
            'attendance_alert',
            f'{employee.full_name} is marked {rec.status} for {scope_date}.',
            employees=employee,
            severity='warning' if rec.status == 'absent' else 'info',
            related_type='attendance', related_id=rec.id,
            rule='attendance-alert',
        )
    return count


def pending_acknowledgement_reminder(scope_date=None):
    """Chase acknowledgements that are still outstanding."""
    scope_date = scope_date or date.today()
    announcements = Announcement.query.filter(
        Announcement.requires_ack.is_(True),
        Announcement.publish_date <= scope_date,
        db.or_(Announcement.expiry_date.is_(None), Announcement.expiry_date >= scope_date),
    ).all()
    count = 0
    for ann in announcements:
        expected = recipient_employee_ids(
            ann.audience, ann.department_id, ann.branch_id, ann.recipient_ids)
        if expected is None:
            # Company-wide: there is no fixed roster to be outstanding against,
            # so there is nothing actionable to chase.
            continue
        acked = {a.employee_id for a in ann.acknowledgements}
        outstanding_ids = expected - acked
        if not outstanding_ids:
            continue
        outstanding = Employee.query.filter(Employee.id.in_(outstanding_ids)).all()
        if not outstanding:
            continue
        count += _notify_coordinators(
            'acknowledgement_pending',
            f'"{ann.title}" has {len(outstanding)} outstanding acknowledgement(s).',
            employees=outstanding,
            severity='warning', related_type='announcement', related_id=ann.id,
            rule='acknowledgement-pending',
        )
    return count


def stale_request_reminder(scope_date=None):
    """Flag administrative requests sitting unresolved for more than two days."""
    scope_date = scope_date or date.today()
    rows = AdminRequest.query.filter(
        AdminRequest.status.in_(('submitted', 'in_review', 'forwarded', 'more_info')),
    ).all()
    stale = [r for r in rows if r.is_stale]
    count = 0
    for r in stale:
        count += _notify_coordinators(
            'request_stale',
            f'Stale request: "{r.title}" is still {r.status}.',
            employees=r.requester,
            severity='warning', related_type='admin_request', related_id=r.id,
            rule='request-stale',
        )
    return count


def task_awaiting_verification_alert(scope_date=None):
    """Tell coordinators that work is sitting in the verification queue."""
    tasks = Task.query.filter(Task.status == 'submitted').all()
    count = 0
    for t in tasks:
        for u in _coordinators():
            if t.assignee and t.assignee.user_id == u.id:
                continue
            if not _coordinator_can_see(u, t.assignee):
                continue
            if notify(
                u, 'task_awaiting_verification',
                f'"{t.title}" is submitted and awaiting verification'
                + (f' ({t.assignee.full_name}).' if t.assignee else '.'),
                severity='info', related_type='task', related_id=t.id,
                rule='task-awaiting-verification',
            ):
                count += 1
    return count
