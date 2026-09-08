from datetime import date, datetime, timezone

from flask import Blueprint, request, jsonify

from ..extensions import db
from ..models import (
    Instructor, Course, Cohort, InstructorAssignment, WeeklyPlan, WeeklyPlanActivity,
    Assignment, AssignmentSubmission, Learner, Enrollment, LearnerAttendance,
    TeachingActivity, Employee,
)
from ..auth.auth import require_permission, require_any_permission, current_user, current_employee
from ..services.audit import audit
from ..services.performance import compute_instructor_score
from .helpers import json_error, parse_json, paginate, paginate_response

bp = Blueprint('instructors', __name__, url_prefix='/api/instructors')


def _instructor_manager(user):
    return user.is_super_admin or user.has_permission('instructors.manage')


def _my_instructor():
    emp = current_employee()
    return emp.instructor if emp and emp.instructor else None


# ---------- instructors ----------
@bp.get('')
@require_any_permission('instructors.view', 'instructors.manage')
def list_instructors():
    user = current_user()
    q = Instructor.query
    if not _instructor_manager(user):
        mine = _my_instructor()
        if mine:
            q = q.filter_by(id=mine.id)
        else:
            q = q.filter(db.text('1 = 0'))
    active = request.args.get('active')
    if active is not None:
        q = q.filter_by(is_active=active.lower() == 'true')
    p = paginate(q.order_by(Instructor.created_at.desc()))
    items = [i.to_dict() for i in p.items]
    for i in items:
        for ins in p.items:
            if ins.id == i['id']:
                i['cohort_count'] = InstructorAssignment.query.filter_by(instructor_id=ins.id, is_active=True).count()
                i['plan_count'] = WeeklyPlan.query.filter_by(instructor_id=ins.id).count()
    return paginate_response(items, p)


@bp.post('')
@require_permission('instructors.manage')
def create_instructor():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'employee_id')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    emp = Employee.query.get(data['employee_id'])
    if not emp:
        return json_error('Employee not found', 404)
    if Instructor.query.filter_by(employee_id=emp.id).first():
        return json_error('Employee is already an instructor')
    ins = Instructor(employee_id=emp.id, specialization=data.get('specialization'), bio=data.get('bio'))
    db.session.add(ins)
    db.session.flush()
    if data.get('cohort_ids'):
        for cid in data['cohort_ids']:
            db.session.add(InstructorAssignment(instructor_id=ins.id, cohort_id=cid, is_primary=True))
    db.session.commit()
    audit('instructor_created', 'instructor', ins.id, new_value=data)
    return jsonify({'message': 'Instructor created', 'instructor': ins.to_dict()}), 201


@bp.get('/<int:instructor_id>')
@require_any_permission('instructors.view', 'instructors.manage')
def get_instructor(instructor_id):
    ins = Instructor.query.get(instructor_id)
    if not ins:
        return json_error('Instructor not found', 404)
    user = current_user()
    if not _instructor_manager(user):
        mine = _my_instructor()
        if not mine or mine.id != ins.id:
            return json_error('You do not have permission to view this instructor', 403)
    d = ins.to_dict()
    d['assignments'] = [a.to_dict() for a in InstructorAssignment.query.filter_by(instructor_id=ins.id, is_active=True).all()]
    d['cohort_count'] = InstructorAssignment.query.filter_by(instructor_id=ins.id, is_active=True).count()
    return jsonify({'instructor': d})


@bp.post('/<int:instructor_id>/assign-cohorts')
@require_permission('instructors.manage')
def assign_cohorts(instructor_id):
    data = parse_json()
    ins = Instructor.query.get(instructor_id)
    if not ins:
        return json_error('Instructor not found', 404)
    cohort_ids = data.get('cohort_ids', [])
    prev = [a.to_dict() for a in InstructorAssignment.query.filter_by(instructor_id=ins.id).all()]
    InstructorAssignment.query.filter_by(instructor_id=ins.id).delete()
    for cid in cohort_ids:
        db.session.add(InstructorAssignment(instructor_id=ins.id, cohort_id=cid, is_primary=True))
    db.session.commit()
    audit('instructor_cohorts', 'instructor', ins.id, prev, {'cohort_ids': cohort_ids})
    return jsonify({'message': 'Cohorts assigned'})


# ---------- courses ----------
@bp.get('/courses/list', endpoint='list_courses')
@require_any_permission('courses.view', 'courses.manage')
def list_courses():
    q = Course.query
    active = request.args.get('active')
    if active is not None:
        q = q.filter_by(is_active=active.lower() == 'true')
    courses = q.order_by(Course.name).all()
    return jsonify({'courses': [c.to_dict() for c in courses]})


@bp.post('/courses', endpoint='create_course')
@require_permission('courses.manage')
def create_course():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'code', 'name')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if Course.query.filter_by(code=data['code']).first():
        return json_error('Course code already exists')
    course = Course(code=data['code'], name=data['name'], description=data.get('description'),
                    lms_course_id=data.get('lms_course_id'), is_active=bool(data.get('is_active', True)))
    db.session.add(course)
    db.session.commit()
    audit('course_created', 'course', course.id, new_value=data)
    return jsonify({'message': 'Course created', 'course': course.to_dict()}), 201


@bp.post('/cohorts', endpoint='create_cohort')
@require_permission('courses.manage')
def create_cohort():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'code', 'name', 'course_id')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    if Cohort.query.filter_by(code=data['code']).first():
        return json_error('Cohort code already exists')
    cohort = Cohort(
        code=data['code'], name=data['name'], course_id=data['course_id'],
        start_date=date.fromisoformat(data['start_date']) if data.get('start_date') else None,
        end_date=date.fromisoformat(data['end_date']) if data.get('end_date') else None,
        lms_cohort_id=data.get('lms_cohort_id'),
    )
    db.session.add(cohort)
    db.session.commit()
    audit('cohort_created', 'cohort', cohort.id, new_value=data)
    return jsonify({'message': 'Cohort created', 'cohort': cohort.to_dict()}), 201


@bp.get('/cohorts/list', endpoint='list_cohorts')
@require_any_permission('courses.view', 'courses.manage')
def list_cohorts():
    q = Cohort.query
    course_id = request.args.get('course_id', type=int)
    active = request.args.get('active')
    if course_id:
        q = q.filter_by(course_id=course_id)
    if active is not None:
        q = q.filter_by(is_active=active.lower() == 'true')
    p = paginate(q.order_by(Cohort.created_at.desc()))
    return paginate_response([c.to_dict() for c in p.items], p)


# ---------- weekly plans ----------
@bp.get('weekly-plans/list', endpoint='list_weekly_plans')
@require_any_permission('weekly_plans.view', 'weekly_plans.manage')
def list_weekly_plans():
    user = current_user()
    q = WeeklyPlan.query
    emp = current_employee()
    mine = _my_instructor()
    if not user.has_permission('weekly_plans.view'):
        if mine:
            q = q.filter_by(instructor_id=mine.id)
        else:
            q = q.filter(db.text('1 = 0'))
    elif not _instructor_manager(user) and mine:
        q = q.filter_by(instructor_id=mine.id)
    instructor_id = request.args.get('instructor_id', type=int)
    if instructor_id and _instructor_manager(user):
        q = q.filter_by(instructor_id=instructor_id)
    week_start = request.args.get('week_start')
    status = request.args.get('status')
    if week_start:
        q = q.filter(WeeklyPlan.week_start == date.fromisoformat(week_start))
    if status:
        q = q.filter_by(status=status)
    p = paginate(q.order_by(WeeklyPlan.week_start.desc()))
    return paginate_response([pl.to_dict() for pl in p.items], p)


@bp.post('weekly-plans', endpoint='create_weekly_plan')
@require_permission('weekly_plans.manage')
def create_weekly_plan():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'week_start', 'week_end')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    instructor_id = data.get('instructor_id')
    if not instructor_id:
        emp = current_employee()
        if not emp or not emp.instructor:
            return json_error('No instructor profile', 400)
        instructor_id = emp.instructor.id
    plan = WeeklyPlan(
        instructor_id=instructor_id,
        week_start=date.fromisoformat(data['week_start']),
        week_end=date.fromisoformat(data['week_end']),
        title=data.get('title'),
        note=data.get('note'),
    )
    db.session.add(plan)
    db.session.flush()

    for act in data.get('activities', []):
        db.session.add(WeeklyPlanActivity(
            weekly_plan_id=plan.id,
            activity_date=date.fromisoformat(act['activity_date']),
            course_id=act.get('course_id'),
            cohort_id=act.get('cohort_id'),
            module=act.get('module'),
            lesson=act.get('lesson'),
            activity=act['activity'],
            description=act.get('description'),
            expected_outcome=act.get('expected_outcome'),
            duration_hours=act.get('duration_hours', 1),
        ))
    db.session.commit()
    audit('weekly_plan_created', 'weekly_plan', plan.id, new_value=data)
    return jsonify({'message': 'Weekly plan created', 'plan': plan.to_dict()}), 201


@bp.put('weekly-plans/<int:plan_id>', endpoint='update_weekly_plan')
@require_permission('weekly_plans.manage')
def update_weekly_plan(plan_id):
    data = parse_json()
    plan = WeeklyPlan.query.get(plan_id)
    if not plan:
        return json_error('Weekly plan not found', 404)
    prev = plan.to_dict()
    if 'title' in data:
        plan.title = data['title']
    if 'note' in data:
        plan.note = data['note']
    if 'status' in data and data['status'] in ('planned', 'in_progress', 'completed'):
        plan.status = data['status']
    db.session.commit()
    audit('weekly_plan_updated', 'weekly_plan', plan.id, prev, plan.to_dict())
    return jsonify({'message': 'Weekly plan updated', 'plan': plan.to_dict()})


@bp.put('weekly-plans/<int:plan_id>/activities/<int:activity_id>', endpoint='update_weekly_plan_activity')
@require_permission('weekly_plans.manage')
def update_activity(plan_id, activity_id):
    data = parse_json()
    act = WeeklyPlanActivity.query.filter_by(id=activity_id, weekly_plan_id=plan_id).first()
    if not act:
        return json_error('Activity not found', 404)
    prev = act.to_dict()
    for field in ['module', 'lesson', 'activity', 'description', 'expected_outcome', 'notes']:
        if field in data:
            setattr(act, field, data[field])
    if data.get('duration_hours') is not None:
        act.duration_hours = data['duration_hours']
    if data.get('activity_date'):
        act.activity_date = date.fromisoformat(data['activity_date'])
    if 'status' in data and data['status'] in ('planned', 'done', 'cancelled', 'missed'):
        act.status = data['status']
        act.completed_at = datetime.now(timezone.utc) if data['status'] == 'done' else None
    db.session.commit()
    audit('weekly_plan_activity_updated', 'activity', act.id, prev, act.to_dict())
    return jsonify({'message': 'Activity updated', 'activity': act.to_dict()})


# ---------- teaching activities ----------
@bp.get('teaching-activities/list', endpoint='list_teaching_activities')
@require_any_permission('instructors.view', 'instructors.manage', 'performance.view')
def list_teaching_activities():
    user = current_user()
    q = TeachingActivity.query
    mine = _my_instructor()
    if not _instructor_manager(user):
        if mine:
            q = q.filter_by(instructor_id=mine.id)
        else:
            q = q.filter(db.text('1 = 0'))
    instructor_id = request.args.get('instructor_id', type=int)
    cohort_id = request.args.get('cohort_id', type=int)
    start = request.args.get('start')
    end = request.args.get('end')
    if instructor_id and _instructor_manager(user):
        q = q.filter_by(instructor_id=instructor_id)
    if cohort_id:
        q = q.filter_by(cohort_id=cohort_id)
    if start:
        q = q.filter(TeachingActivity.activity_date >= date.fromisoformat(start))
    if end:
        q = q.filter(TeachingActivity.activity_date <= date.fromisoformat(end))
    p = paginate(q.order_by(TeachingActivity.activity_date.desc()))
    return paginate_response([t.to_dict() for t in p.items], p)


@bp.post('teaching-activities', endpoint='create_teaching_activity')
@require_permission('instructors.manage')
def create_teaching_activity():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'lesson_topic', 'activity_date')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    emp = current_employee()
    instructor_id = data.get('instructor_id')
    if not instructor_id:
        if not emp or not emp.instructor:
            return json_error('No instructor profile', 400)
        instructor_id = emp.instructor.id
    act = TeachingActivity(
        instructor_id=instructor_id,
        course_id=data.get('course_id'),
        cohort_id=data.get('cohort_id'),
        activity_date=date.fromisoformat(data['activity_date']),
        lesson_topic=data['lesson_topic'],
        duration_hours=data.get('duration_hours', 1),
        learner_count=data.get('learner_count', 0),
        notes=data.get('notes'),
    )
    db.session.add(act)
    db.session.commit()
    audit('teaching_activity_created', 'teaching_activity', act.id, new_value=act.to_dict())
    return jsonify({'message': 'Teaching activity recorded', 'activity': act.to_dict()}), 201


# ---------- assignments ----------
@bp.get('assignments/list', endpoint='list_assignments')
@require_any_permission('instructors.view', 'instructors.manage', 'performance.view')
def list_assignments():
    user = current_user()
    q = Assignment.query
    mine = _my_instructor()
    if not _instructor_manager(user):
        if mine:
            q = q.filter_by(instructor_id=mine.id)
        else:
            q = q.filter(db.text('1 = 0'))
    cohort_id = request.args.get('cohort_id', type=int)
    course_id = request.args.get('course_id', type=int)
    instructor_id = request.args.get('instructor_id', type=int)
    if cohort_id:
        q = q.filter_by(cohort_id=cohort_id)
    if course_id:
        q = q.filter_by(course_id=course_id)
    if instructor_id and _instructor_manager(user):
        q = q.filter_by(instructor_id=instructor_id)
    p = paginate(q.order_by(Assignment.created_at.desc()))
    return paginate_response([a.to_dict() for a in p.items], p)


@bp.post('assignments', endpoint='create_assignment')
@require_permission('instructors.manage')
def create_assignment():
    data = parse_json()
    from .helpers import required
    missing = required(data, 'title', 'course_id', 'cohort_id')
    if missing:
        return json_error(f'Missing: {", ".join(missing)}')
    emp = current_employee()
    instructor_id = data.get('instructor_id')
    if not instructor_id:
        if not emp or not emp.instructor:
            return json_error('No instructor profile', 400)
        instructor_id = emp.instructor.id
    assignment = Assignment(
        course_id=data['course_id'], cohort_id=data['cohort_id'], instructor_id=instructor_id,
        title=data['title'], description=data.get('description'),
        due_date=date.fromisoformat(data['due_date']) if data.get('due_date') else None,
        total_marks=data.get('total_marks', 100),
        lms_assignment_id=data.get('lms_assignment_id'),
    )
    db.session.add(assignment)
    db.session.commit()
    audit('assignment_created', 'assignment', assignment.id, new_value=data)
    return jsonify({'message': 'Assignment created', 'assignment': assignment.to_dict()}), 201


@bp.post('assignments/<int:assignment_id>/grade', endpoint='grade_submission')
@require_permission('instructors.manage')
def grade_submission(assignment_id):
    data = parse_json()
    assignment = Assignment.query.get(assignment_id)
    if not assignment:
        return json_error('Assignment not found', 404)
    submission_id = data.get('submission_id')
    if not submission_id:
        return json_error('submission_id required', 400)
    sub = AssignmentSubmission.query.filter_by(id=submission_id, assignment_id=assignment.id).first()
    if not sub:
        return json_error('Submission not found', 404)
    prev = sub.to_dict()
    sub.marks_earned = data.get('marks_earned')
    sub.graded = True
    sub.graded_at = datetime.now(timezone.utc)
    sub.feedback = data.get('feedback')
    db.session.commit()
    audit('assignment_graded', 'assignment_submission', sub.id, prev, sub.to_dict())
    return jsonify({'message': 'Submission graded', 'submission': sub.to_dict()})


# ---------- learners ----------
@bp.get('cohorts/<int:cohort_id>/learners', endpoint='list_cohort_learners')
@require_any_permission('learner_progress.view', 'instructors.view', 'instructors.manage')
def list_cohort_learners(cohort_id):
    user = current_user()
    if not user.has_permission('courses.manage') and not user.has_permission('instructors.manage'):
        mine = _my_instructor()
        allowed = mine and InstructorAssignment.query.filter_by(instructor_id=mine.id, cohort_id=cohort_id, is_active=True).first()
        if not allowed:
            return json_error('You do not have permission to view this cohort', 403)
    q = Learner.query.filter_by(cohort_id=cohort_id)
    search = request.args.get('search')
    if search:
        like = f'%{search}%'
        q = q.filter(db.or_(Learner.name.ilike(like), Learner.email.ilike(like)))
    p = paginate(q.order_by(Learner.name))
    items = []
    for l in p.items:
        d = l.to_dict()
        enroll = Enrollment.query.filter_by(learner_id=l.id, cohort_id=cohort_id).first()
        d['enrollment'] = enroll.to_dict() if enroll else None
        items.append(d)
    return paginate_response(items, p)


@bp.post('cohorts/<int:cohort_id>/learners', endpoint='create_cohort_learner')
@require_permission('courses.manage')
def create_cohort_learner(cohort_id):
    data = parse_json()
    cohort = Cohort.query.get(cohort_id)
    if not cohort:
        return json_error('Cohort not found', 404)
    learner = Learner(
        cohort_id=cohort_id,
        lms_user_id=data.get('lms_user_id'),
        name=data.get('name'), email=data.get('email'), phone=data.get('phone'),
        enrollment_date=date.today(),
    )
    db.session.add(learner)
    db.session.flush()
    db.session.add(Enrollment(learner_id=learner.id, course_id=cohort.course_id, cohort_id=cohort_id))
    db.session.commit()
    audit('learner_created', 'learner', learner.id, new_value=data)
    return jsonify({'message': 'Learner added', 'learner': learner.to_dict()}), 201


@bp.put('enrollments/<int:enrollment_id>', endpoint='update_enrollment')
@require_permission('courses.manage')
def update_enrollment(enrollment_id):
    data = parse_json()
    enroll = Enrollment.query.get(enrollment_id)
    if not enroll:
        return json_error('Enrollment not found', 404)
    prev = enroll.to_dict()
    for field in ['progress_percent', 'average_score', 'attendance_rate', 'risk_status']:
        if field in data:
            setattr(enroll, field, data[field])
    db.session.commit()
    audit('enrollment_updated', 'enrollment', enroll.id, prev, enroll.to_dict())
    return jsonify({'message': 'Learner progress updated', 'enrollment': enroll.to_dict()})


@bp.post('cohorts/<int:cohort_id>/attendance', endpoint='create_learner_attendance')
@require_permission('courses.manage')
def create_learner_attendance(cohort_id):
    data = parse_json()
    if not isinstance(data.get('records'), list) or not data['records']:
        return json_error('records must be a non-empty list')
    created = []
    for r in data['records']:
        att = LearnerAttendance(
            learner_id=r['learner_id'], course_id=r.get('course_id'),
            cohort_id=cohort_id, attendance_date=date.fromisoformat(r['attendance_date']),
            status=r.get('status', 'present'), note=r.get('note'),
        )
        db.session.add(att)
        created.append(att)
    db.session.commit()
    audit('learner_attendance', 'learner_attendance', cohort_id, new_value={'count': len(created)})
    return jsonify({'message': f'{len(created)} attendance records saved'}), 201


# ---------- performance ----------
@bp.post('/<int:instructor_id>/performance/calculate', endpoint='calculate_instructor_performance')
@require_any_permission('performance.view', 'instructors.manage')
def calculate_performance(instructor_id):
    data = parse_json()
    user = current_user()
    if not _instructor_manager(user):
        mine = _my_instructor()
        if not mine or mine.id != instructor_id:
            return json_error('You can only calculate your own performance', 403)
    period_start = date.fromisoformat(data.get('period_start', (date.today().replace(day=1)).isoformat()))
    period_end = date.fromisoformat(data.get('period_end', date.today().isoformat()))
    result = compute_instructor_score(instructor_id, period_start, period_end, persist=True)
    if result is None:
        return json_error('Could not compute performance', 400)
    return jsonify({'message': 'Performance calculated', 'score': result})