"""
Tests for the AfriTech Bridge LMS Inactivity System.

Covers:
- Cohort/course scoping of inactive-student detection
- Deduplication of students across multiple enrollments
- Enhanced activity detection (in-progress study counts as active)
- Cohort-scoped termination (leaves other cohorts untouched)
- Account inactivity (deletion candidates) detection
"""

import pytest
from datetime import datetime, timedelta
from flask import Flask
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))


@pytest.fixture
def app():
    flask_app = Flask(__name__)
    flask_app.config['TESTING'] = True
    flask_app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///:memory:'
    flask_app.config['JWT_SECRET_KEY'] = 'test-secret'
    flask_app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    from src.models.user_models import db
    from flask_jwt_extended import JWTManager
    # Force all model modules to register their tables on the metadata
    from src.models import (
        user_models, course_models, course_application, student_models,
        achievement_models, quiz_progress_models, opportunity_models,
        notification_models, system_settings_models, grading_models,
        internship_models, file_models, excel_grading_models, task_models,
        booking_models
    )
    db.init_app(flask_app)
    JWTManager(flask_app)
    return flask_app


@pytest.fixture
def db_session(app):
    with app.app_context():
        from src.models.user_models import db
        db.create_all()
        yield db.session
        db.session.remove()
        db.drop_all()


@pytest.fixture
def roles(db_session):
    from src.models.user_models import Role
    student_role = Role(name='student')
    instructor_role = Role(name='instructor')
    admin_role = Role(name='admin')
    db_session.add_all([student_role, instructor_role, admin_role])
    db_session.commit()
    return {'student': student_role, 'instructor': instructor_role, 'admin': admin_role}


def _make_user(db_session, roles, username, email, days_ago=30):
    from src.utils.time_utils import now_local
    from src.models.user_models import User
    user = User(
        username=username,
        email=email,
        password_hash='hashed',
        first_name='Test',
        last_name=username,
        role_id=roles['student'].id,
        timezone='UTC',
        is_active=True,
        created_at=now_local() - timedelta(days=days_ago),
    )
    db_session.add(user)
    db_session.commit()
    return user


@pytest.fixture
def scenario(db_session, roles):
    """Course + 2 cohorts + students, mirroring cohort-based inactivity."""
    from src.utils.time_utils import now_local
    from src.models.course_models import Course, ApplicationWindow, Enrollment, Module, Lesson
    from src.models.student_models import LessonCompletion
    from src.models.user_models import User

    instructor = User(
        username='instructor_inact',
        email='instructor_inact@test.com',
        password_hash='hashed',
        first_name='Test',
        last_name='Instructor',
        role_id=roles['instructor'].id,
        timezone='UTC',
    )
    db_session.add(instructor)
    db_session.commit()

    course = Course(
        title='Inactivity Test Course',
        description='test',
        instructor_id=instructor.id,
    )
    db_session.add(course)
    db_session.commit()

    window_a = ApplicationWindow(
        course_id=course.id,
        cohort_label='Cohort A',
    )
    window_b = ApplicationWindow(
        course_id=course.id,
        cohort_label='Cohort B',
    )
    db_session.add_all([window_a, window_b])
    db_session.commit()

    # Old student: no activity for 30 days, enrolled in BOTH cohorts.
    stale = User(
        username='stale_student',
        email='stale@test.com',
        password_hash='hashed',
        first_name='Stale',
        last_name='Student',
        role_id=roles['student'].id,
        timezone='UTC',
        is_active=True,
        created_at=now_local() - timedelta(days=40),
        last_activity=now_local() - timedelta(days=20),
    )
    # Active student: only *read* a lesson 5 days ago (never completed it).
    active = User(
        username='active_student',
        email='active@test.com',
        password_hash='hashed',
        first_name='Active',
        last_name='Student',
        role_id=roles['student'].id,
        timezone='UTC',
        is_active=True,
        created_at=now_local() - timedelta(days=40),
        last_activity=now_local() - timedelta(days=5),
    )
    db_session.add_all([stale, active])
    db_session.commit()

    enroll_a_stale = Enrollment(
        student_id=stale.id,
        course_id=course.id,
        application_window_id=window_a.id,
        cohort_label='Cohort A',
        status='active',
    )
    enroll_b_stale = Enrollment(
        student_id=stale.id,
        course_id=course.id,
        application_window_id=window_b.id,
        cohort_label='Cohort B',
        status='active',
    )
    enroll_a_active = Enrollment(
        student_id=active.id,
        course_id=course.id,
        application_window_id=window_a.id,
        cohort_label='Cohort A',
        status='active',
    )
    db_session.add_all([enroll_a_stale, enroll_b_stale, enroll_a_active])

    module = Module(title='M1', course_id=course.id, order=1)
    db_session.add(module)
    db_session.commit()
    lesson = Lesson(
        title='L1',
        content_type='text',
        content_data='hello',
        module_id=module.id,
        order=1,
        is_published=True,
    )
    db_session.add(lesson)
    db_session.commit()

    # The active student has been reading the lesson recently (in-progress).
    completion = LessonCompletion(
        student_id=active.id,
        lesson_id=lesson.id,
        completed=False,
        completed_at=None,
        last_accessed=now_local() - timedelta(days=5),
        updated_at=now_local() - timedelta(days=5),
    )
    db_session.add(completion)
    db_session.commit()

    return {
        'instructor': instructor,
        'course': course,
        'window_a': window_a,
        'window_b': window_b,
        'stale': stale,
        'active': active,
        'enroll_a_stale': enroll_a_stale,
        'enroll_b_stale': enroll_b_stale,
        'enroll_a_active': enroll_a_active,
    }


def test_cohort_scoping_picks_stale_student_only(db_session, scenario):
    from src.services.inactivity_service import InactivityService

    inactive_a = InactivityService.get_inactive_students(
        instructor_id=scenario['instructor'].id,
        application_window_id=scenario['window_a'].id,
        threshold_days=7,
    )

    ids = {s['student_id'] for s in inactive_a}
    assert scenario['stale'].id in ids
    # The active student read a lesson 5 days ago -> not counted as inactive.
    assert scenario['active'].id not in ids

    # The stale student's enrolled_courses are scoped to THIS cohort only.
    stale_row = next(s for s in inactive_a if s['student_id'] == scenario['stale'].id)
    assert len(stale_row['enrolled_courses']) == 1
    assert stale_row['enrolled_courses'][0]['application_window_id'] == scenario['window_a'].id
    assert stale_row['enrolled_courses'][0]['cohort_label'] == 'Cohort A'


def test_different_cohort_shows_different_enrollment(db_session, scenario):
    from src.services.inactivity_service import InactivityService

    inactive_b = InactivityService.get_inactive_students(
        instructor_id=scenario['instructor'].id,
        application_window_id=scenario['window_b'].id,
        threshold_days=7,
    )

    ids = {s['student_id'] for s in inactive_b}
    assert scenario['stale'].id in ids
    assert scenario['active'].id not in ids

    stale_row = next(s for s in inactive_b if s['student_id'] == scenario['stale'].id)
    assert stale_row['enrolled_courses'][0]['application_window_id'] == scenario['window_b'].id
    assert stale_row['enrolled_courses'][0]['cohort_label'] == 'Cohort B'


def test_student_deduplicated_across_courses(db_session, roles, scenario):
    """A student in two courses must appear only once in the inactive list."""
    from src.utils.time_utils import now_local
    from src.models.course_models import Course, Enrollment
    from src.services.inactivity_service import InactivityService

    course2 = Course(
        title='Inactivity Test Course 2',
        description='test',
        instructor_id=scenario['instructor'].id,
    )
    db_session.add(course2)
    db_session.commit()

    db_session.add(Enrollment(
        student_id=scenario['stale'].id,
        course_id=course2.id,
        status='active',
    ))
    db_session.commit()

    inactive = InactivityService.get_inactive_students(
        instructor_id=scenario['instructor'].id,
        threshold_days=7,
    )

    stale_rows = [s for s in inactive if s['student_id'] == scenario['stale'].id]
    assert len(stale_rows) == 1
    assert len(inactive) == 1


def test_in_progress_study_counts_as_active(db_session, scenario):
    """Reading a lesson (without completing it) must not mark a student inactive."""
    from src.services.inactivity_service import InactivityService

    inactive = InactivityService.get_inactive_students(
        instructor_id=scenario['instructor'].id,
        application_window_id=scenario['window_a'].id,
        threshold_days=7,
    )
    assert scenario['active'].id not in {s['student_id'] for s in inactive}


def test_termination_is_scoped_to_cohort(db_session, scenario):
    """Terminating a student in one cohort must not touch other cohorts."""
    from src.models.course_models import Enrollment
    from src.services.inactivity_service import InactivityService

    result = InactivityService.terminate_inactive_student(
        student_id=scenario['stale'].id,
        instructor_id=scenario['instructor'].id,
        reason='Inactivity',
        course_id=scenario['course'].id,
        application_window_id=scenario['window_a'].id,
    )
    assert result['success'] is True
    assert len(result['terminated_courses']) == 1

    enroll_a = Enrollment.query.get(scenario['enroll_a_stale'].id)
    enroll_b = Enrollment.query.get(scenario['enroll_b_stale'].id)
    assert enroll_a.status == 'terminated'
    # The other cohort must remain untouched.
    assert enroll_b.status == 'active'
    assert enroll_b.termination_reason is None


def test_termination_requires_instructor_ownership(db_session, roles, scenario):
    """An instructor cannot terminate enrollments from a course they don't teach."""
    from src.utils.time_utils import now_local
    from src.models.user_models import User
    from src.models.course_models import Course, Enrollment, ApplicationWindow
    from src.services.inactivity_service import InactivityService

    other_instructor = User(
        username='other_instructor',
        email='other_instructor@test.com',
        password_hash='hashed',
        first_name='Other',
        last_name='Instructor',
        role_id=roles['instructor'].id,
        timezone='UTC',
    )
    db_session.add(other_instructor)
    db_session.flush()
    other_course = Course(title='Other Instructor Course', description='test', instructor_id=other_instructor.id)
    db_session.add(other_course)
    db_session.flush()
    other_window = ApplicationWindow(course_id=other_course.id, cohort_label='Other Cohort')
    db_session.add_all([other_instructor, other_course, other_window])
    db_session.commit()

    db_session.add(Enrollment(
        student_id=scenario['stale'].id,
        course_id=other_course.id,
        application_window_id=other_window.id,
        status='active',
    ))
    db_session.commit()

    result = InactivityService.terminate_inactive_student(
        student_id=scenario['stale'].id,
        instructor_id=scenario['instructor'].id,
        reason='Inactivity',
        course_id=other_course.id,
        application_window_id=other_window.id,
    )
    assert result['success'] is False


def test_get_inactive_users_only_returns_inactive_users(db_session, roles, scenario):
    from src.services.inactivity_service import InactivityService

    inactive = InactivityService.get_inactive_users(threshold_days=7)

    user_ids = {u['user_id'] for u in inactive}
    assert scenario['stale'].id in user_ids
    assert scenario['active'].id not in user_ids