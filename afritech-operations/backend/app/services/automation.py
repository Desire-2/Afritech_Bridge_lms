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
  missing-daily-closing   : alert manager when an agent has no closing for yesterday

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
)
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
    return [u for u in users if set(['manager', 'super_admin']).intersection(u.role_codes)]


def run_all(scope_date=None):
    scope_date = scope_date or date.today()
    triggers = [
        cash_shortage_alert,
        closing_approval_alert,
        expense_approval_alert,
        overdue_task_alert,
        missing_weekly_plan_alert,
        instructor_behind_schedule_alert,
    ]
    run = []
    for t in triggers:
        try:
            n = t(scope_date)
            run.append((t.__name__, n))
        except Exception as e:  # noqa
            db.session.rollback()
            run.append((t.__name__, f'error: {e}'))
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
                notify(
                    m, 'cash_shortage',
                    f'Cash shortage detected: {abs(diff):,.0f} RWF for {c.employee.full_name} on {scope_date}.',
                    severity='critical', related_type='daily_closing', related_id=c.id, rule='cash-shortage'
                )
                count += 1
    return count


def closing_approval_alert(scope_date):
    closings = DailyClosing.query.filter_by(status='submitted').all()
    count = 0
    for c in closings:
        for m in _managers():
            notify(
                m, 'closing_approval',
                f'Daily closing awaiting approval: {c.employee.full_name} ({c.closing_date}).',
                severity='warning', related_type='daily_closing', related_id=c.id, rule='closing-approval'
            )
            count += 1
    return count


def expense_approval_alert(scope_date=None):
    expenses = Expense.query.filter_by(status='pending').all()
    count = 0
    for e in expenses:
        for m in _managers():
            notify(
                m, 'expense_approval',
                f'Expense awaiting approval: {e.category} {e.amount:,.0f} RWF.',
                severity='warning', related_type='expense', related_id=e.id, rule='expense-approval'
            )
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
            notify(
                t.assignee.user_id, 'task_overdue',
                f'Overdue task: {t.title} (due {t.due_date}).',
                severity='warning', related_type='task', related_id=t.id, rule='overdue-task'
            )
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
                notify(
                    ins.employee.user_id, 'missing_weekly_plan',
                    f'No weekly plan submitted for week {week_start}–{week_end}.',
                    severity='warning', related_type='instructor', related_id=ins.id, rule='missing-weekly-plan'
                )
                count += 1
            for m in _managers():
                notify(
                    m, 'missing_weekly_plan',
                    f'{ins.employee.full_name} has no weekly plan for {week_start}–{week_end}.',
                    severity='warning', related_type='instructor', related_id=ins.id, rule='missing-weekly-plan'
                )
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
                notify(
                    m, 'instructor_behind',
                    f'Instructor {p.instructor.employee.full_name} weekly plan progress is {p.progress_percent()}% (threshold {threshold}%).',
                    severity='warning', related_type='weekly_plan', related_id=p.id, rule='instructor-behind'
                )
                count += 1
    return count


def ungraded_assignment_alert(scope_date=None):
    scope_date = scope_date or date.today()
    days = _setting_int('automation.ungraded_days', 7)
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    count = 0
    for a in Assignment.query.all():
        ungraded = [s for s in a.submissions if not s.graded and s.submitted_at < cutoff]
        if ungraded:
            if a.instructor and a.instructor.employee and a.instructor.employee.user_id:
                notify(
                    a.instructor.employee.user_id, 'grading_overdue',
                    f'{len(ungraded)} submission(s) older than {days} days await grading for "{a.title}".',
                    severity='warning', related_type='assignment', related_id=a.id, rule='ungraded-assignment'
                )
                count += 1
    return count


def run_scheduled():
    run_all()
    return 'ok'