from datetime import date, timedelta
from decimal import Decimal

from flask import Blueprint, request, jsonify

from ..models import (
    ServiceTransaction, Expense, PayrollPeriod, Employee, Attendance, Task,
    DailyClosing, Instructor, WeeklyPlan, PerformanceScore, Notification, User,
    Branch, Service, Client, TeachingActivity, Assignment, AssignmentSubmission,
    Enrollment, InstructorAssignment,
)
from ..auth.auth import require_any_permission, require_auth, current_user, current_employee
from ..services.commission import default_rate
from .helpers import json_error

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