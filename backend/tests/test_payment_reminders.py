"""
Tests for the payment reminder scheduler.

Covers the three reminder categories (draft applications, submitted but
unapproved applications, pending-payment enrollments) plus the bookkeeping
that decides whether a reminder is due.
"""

import os
import sys
from datetime import timedelta

import pytest
from flask import Flask

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
def world(db_session):
    """A paid course with a cohort closing in 5 days, plus two applicants."""
    from src.utils.time_utils import now_local
    from src.models.user_models import User, Role
    from src.models.course_models import Course, ApplicationWindow

    instructor_role = Role(name='instructor')
    student_role = Role(name='student')
    db_session.add_all([instructor_role, student_role])
    db_session.commit()

    instructor = User(
        username='pay_instructor',
        email='pay_instructor@test.com',
        password_hash='hashed',
        first_name='Pay',
        last_name='Instructor',
        role_id=instructor_role.id,
        timezone='UTC',
    )
    db_session.add(instructor)
    db_session.commit()

    course = Course(
        title='Paid Reminder Course',
        description='test',
        instructor_id=instructor.id,
        enrollment_type='paid',
        price=100.0,
        currency='USD',
    )
    db_session.add(course)
    db_session.commit()

    window = ApplicationWindow(
        course_id=course.id,
        cohort_label='Cohort A',
        closes_at=now_local() + timedelta(days=5),
        cohort_start=now_local() + timedelta(days=7),
    )
    db_session.add(window)
    db_session.commit()

    return {'course': course, 'window': window, 'student_role': student_role}


def _make_application(db_session, world, suffix, *, is_draft, payment_status):
    from src.models.course_application import CourseApplication

    application = CourseApplication(
        course_id=world['course'].id,
        application_window_id=world['window'].id,
        full_name=f'Applicant {suffix}',
        email=f'{suffix}@applicant.test',
        phone='+25000000000',
        motivation='because',
        is_draft=is_draft,
        payment_status=payment_status,
    )
    db_session.add(application)
    db_session.commit()
    return application


def test_draft_with_null_payment_status_is_selected(db_session, world):
    """`payment_status IN (...)` never matches NULL - the intended NULL row
    must be expressed explicitly or these drafts are silently skipped."""
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    draft = _make_application(db_session, world, 'nullstatus', is_draft=True, payment_status=None)

    selected = PaymentReminderScheduler.get_applications_needing_reminders()
    ids = [app.id for app, *_ in selected]

    assert draft.id in ids
    assert selected[0][4] == 'first'  # 5 days out -> first reminder


def test_draft_with_settled_payment_is_not_selected(db_session, world):
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    _make_application(db_session, world, 'paid', is_draft=True, payment_status='completed')

    assert PaymentReminderScheduler.get_applications_needing_reminders() == []


def test_submitted_application_awaiting_verification_is_selected(db_session, world):
    """Screenshot uploads set payment_status='pending_verification', which the
    payments dashboard already treats as actionable."""
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    application = _make_application(
        db_session, world, 'awaiting', is_draft=False, payment_status='pending_verification'
    )

    selected = PaymentReminderScheduler.get_submitted_unapproved_applications()
    ids = [app.id for app, *_ in selected]

    assert application.id in ids


def test_approved_payment_is_not_selected(db_session, world):
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    _make_application(db_session, world, 'confirmed', is_draft=False, payment_status='confirmed')

    assert PaymentReminderScheduler.get_submitted_unapproved_applications() == []


def test_send_reminders_tolerates_null_reminder_count(db_session, world, monkeypatch):
    """payment_reminder_count is nullable; a NULL must not turn into None + 1."""
    from src.utils import payment_notifications
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    application = _make_application(db_session, world, 'nullcount', is_draft=True, payment_status=None)
    application.payment_reminder_count = None
    db_session.commit()

    monkeypatch.setattr(
        payment_notifications, 'send_payment_reminder_notification', lambda **kwargs: True
    )

    result = PaymentReminderScheduler.send_reminders(
        PaymentReminderScheduler.get_applications_needing_reminders()
    )

    assert result['sent'] == 1
    assert result['failed'] == 0
    db_session.refresh(application)
    assert application.payment_reminder_count == 1
    assert application.last_payment_reminder_sent is not None
    assert application.last_payment_reminder_type == 'first'
