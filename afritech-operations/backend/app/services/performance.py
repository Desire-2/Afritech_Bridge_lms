from datetime import date, timedelta, datetime, time
from decimal import Decimal, ROUND_HALF_UP

from ..extensions import db
from ..models import (
    PerformanceMetric, PerformanceScore, PerformanceScoreComponent,
    Instructor, WeeklyPlan, TeachingActivity, Assignment, AssignmentSubmission,
    LearnerAttendance,
)


def _dec(v):
    return Decimal(str(v or 0))


def _round(v):
    return _dec(v).quantize(Decimal('0.01'), rounding=ROUND_HALF_UP)


DEFAULT_METRICS = [
    ('teaching_delivery', 'Teaching Delivery', 'Quality and volume of teaching activity', 25),
    ('weekly_planning', 'Weekly Planning', 'Weekly plans created with completed activities', 15),
    ('learner_progress', 'Learner Progress', 'Learners on track in their courses', 25),
    ('assignment_management', 'Assignment Management', 'Assignments issued and graded on time', 15),
    ('attendance', 'Attendance', 'Instructor personal attendance', 10),
    ('reporting', 'Reporting', 'Reporting quality and timeliness', 10),
]


def ensure_metrics():
    for code, name, desc, weight in DEFAULT_METRICS:
        m = PerformanceMetric.query.filter_by(code=code).first()
        if not m:
            db.session.add(PerformanceMetric(code=code, name=name, description=desc, default_weight=weight))
    db.session.commit()


def _weight(metric):
    return _dec(metric.weight if metric.weight is not None else metric.default_weight)


def compute_instructor_score(instructor_id, period_start, period_end, persist=True):
    instructor = Instructor.query.get(instructor_id)
    if not instructor:
        return None

    ensure_metrics()
    metrics = {m.code: m for m in PerformanceMetric.query.filter_by(is_active=True).all()}
    total_weight = sum(_weight(m) for m in metrics.values())
    if total_weight == 0:
        return None

    # --- aggregate actuals ---
    activities = TeachingActivity.query.filter(
        TeachingActivity.instructor_id == instructor_id,
        TeachingActivity.activity_date >= period_start,
        TeachingActivity.activity_date <= period_end,
    ).all()

    plans = WeeklyPlan.query.filter(
        WeeklyPlan.instructor_id == instructor_id,
        WeeklyPlan.week_start >= period_start - timedelta(days=6),
        WeeklyPlan.week_end <= period_end,
    ).all()
    plan_activities = sum((len(p.activities) for p in plans), 0)
    plan_done = sum((sum(1 for a in p.activities if a.status in ('done', 'completed', 'cancelled')) for p in plans), 0)

    assignments = Assignment.query.filter(
        Assignment.instructor_id == instructor_id,
        Assignment.created_at >= datetime.combine(period_start, time.min),
    ).all()
    submissions_total = sum(len(a.submissions) for a in assignments)
    submissions_graded = sum(sum(1 for s in a.submissions if s.graded) for a in assignments)

    attendance_rows = [a for a in instructor.employee.attendance if period_start <= a.attendance_date <= period_end] if instructor.employee else []
    if attendance_rows:
        present = sum(1 for a in attendance_rows if a.status in ('present', 'overtime'))
        attendance_rate = present / len(attendance_rows) * 100
    else:
        attendance_rate = 100.0

    # learner progress (local records)
    from ..models import Enrollment
    assignments_cohort_ids = set(a.cohort_id for a in assignments)
    enrollments = []
    if assignments_cohort_ids:
        enrollments = Enrollment.query.filter(Enrollment.cohort_id.in_(assignments_cohort_ids)).all()
    avg_progress = sum(float(e.progress_percent or 0) for e in enrollments) / len(enrollments) if enrollments else 0
    learner_progress_score = min(100.0, avg_progress)

    reporting_score = 100.0 if plans else 0.0
    if plans:
        has_notes = sum(1 for p in plans if p.note)
        reporting_score = (has_notes / len(plans)) * 100 if plans else 0

    sub_scores = {
        'teaching_delivery': _score_spread(activities, [a.duration_hours or 1 for a in activities], 6),
        'weekly_planning': (plan_done / plan_activities * 100) if plan_activities else 0,
        'learner_progress': learner_progress_score,
        'assignment_management': (submissions_graded / submissions_total * 100) if submissions_total else 0,
        'attendance': attendance_rate,
        'reporting': reporting_score,
    }

    for code in metrics:
        if code not in sub_scores:
            sub_scores[code] = 0.0

    components = []
    weighted_sum = _dec(0)
    for code, metric in metrics.items():
        score = _dec(sub_scores.get(code, 0))
        weight = _weight(metric)
        wscore = _round((score * weight) / total_weight)
        weighted_sum += wscore
        components.append((metric, score, weight, wscore, _explain(code, sub_scores)))

    overall = _round(weighted_sum)
    rating = _rating(overall)

    if persist:
        existing = PerformanceScore.query.filter_by(
            instructor_id=instructor_id, period_start=period_start, period_end=period_end
        ).first()
        if existing:
            PerformanceScoreComponent.query.filter_by(performance_score_id=existing.id).delete()
            score = existing
        else:
            score = PerformanceScore(
                employee_id=instructor.employee_id, instructor_id=instructor_id,
                period_start=period_start, period_end=period_end,
            )
            db.session.add(score)
            db.session.flush()
        score.overall_score = overall
        score.rating = rating
        for metric, s, w, ws, expl in components:
            db.session.add(PerformanceScoreComponent(
                performance_score_id=score.id, metric_id=metric.id,
                score=s, weight=w, weighted_score=ws, explanation=expl,
            ))
        db.session.commit()
        return score.to_dict()
    return overall, rating, sub_scores


def _score_spread(activities, hours, weekly_baseline=6):
    """Heuristic teaching-delivery score based on weeks with recorded activity."""
    if not activities:
        return 0.0
    weeks = {}
    for a in activities:
        key = a.activity_date.isocalendar()[:2]
        weeks[key] = weeks.get(key, 0) + float(a.duration_hours or 1)
    avg_hours = sum(weeks.values()) / max(1, len(weeks))
    return min(100.0, avg_hours / weekly_baseline * 100)


def _explain(code, sub_scores):
    explanations = {
        'teaching_delivery': 'Based on recorded teaching hours vs baseline.',
        'weekly_planning': 'Completed activities / planned activities.',
        'learner_progress': 'Average enrollment progress in instructor cohorts.',
        'assignment_management': 'Graded submissions / total submissions.',
        'attendance': 'Personal attendance rate for the period.',
        'reporting': 'Weekly plans with notes / total plans.',
    }
    return explanations.get(code, '')


def _rating(overall):
    o = float(overall)
    if o >= 85:
        return 'excellent'
    if o >= 70:
        return 'good'
    if o >= 50:
        return 'fair'
    return 'poor'