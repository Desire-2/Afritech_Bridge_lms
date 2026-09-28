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
    from src.routes.application_routes import application_bp
    if 'application_bp' not in flask_app.blueprints:
        flask_app.register_blueprint(application_bp)
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

    return {
        'course': course,
        'window': window,
        'student_role': student_role,
        'instructor': instructor,
        'instructor_id': instructor.id,
        'instructor_role': instructor_role,
    }


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


def _make_enrollment(db_session, world, suffix, *, status, payment_status,
                     payment_verified=False, course=None, instructor=None):
    from src.models.user_models import User, Role
    from src.models.course_models import Enrollment, Course

    target_course = course or world['course']
    if instructor is not None:
        # a course owned by another instructor, same shape as the shared one
        other = Course(
            title=f'Other Course {suffix}',
            description='test',
            instructor_id=instructor.id,
            enrollment_type='paid',
            price=100.0,
            currency='USD',
        )
        db_session.add(other)
        db_session.commit()
        target_course = other

    student = User(
        username=f'payer_{suffix}',
        email=f'{suffix}@payer.test',
        password_hash='hashed',
        first_name='Payer',
        last_name=suffix,
        role_id=world['student_role'].id,
        timezone='UTC',
    )
    db_session.add(student)
    db_session.commit()

    enrollment = Enrollment(
        student_id=student.id,
        course_id=target_course.id,
        application_window_id=world['window'].id,
        status=status,
        payment_status=payment_status,
        payment_verified=payment_verified,
        payment_method='bank_transfer',
    )
    db_session.add(enrollment)
    db_session.commit()
    return enrollment


def test_active_enrollment_with_actionable_payment_status_is_selected(db_session, world):
    """A screenshot awaiting verification sits on an enrollment whose status is
    already 'active' - the dashboard flags it, so the scheduler must too."""
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    enrollment = _make_enrollment(
        db_session, world, 'proof',
        status='active', payment_status='submitted_with_proof', payment_verified=False,
    )

    selected = PaymentReminderScheduler.get_pending_payment_enrollments()
    ids = [row[0].id for row in selected]

    assert enrollment.id in ids


def test_active_enrollment_with_settled_payment_is_not_selected(db_session, world):
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    _make_enrollment(
        db_session, world, 'settled',
        status='active', payment_status='completed', payment_verified=False,
    )

    assert PaymentReminderScheduler.get_pending_payment_enrollments() == []


def test_verified_enrollment_is_never_selected(db_session, world):
    """payment_verified wins over an actionable payment_status."""
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    _make_enrollment(
        db_session, world, 'verified',
        status='active', payment_status='pending', payment_verified=True,
    )

    assert PaymentReminderScheduler.get_pending_payment_enrollments() == []


def test_enrollment_scope_is_limited_to_the_instructor(db_session, world):
    from src.models.user_models import User, Role
    from src.services.payment_reminder_scheduler import PaymentReminderScheduler

    other_instructor = User(
        username='other_instructor',
        email='other_instructor@test.com',
        password_hash='hashed',
        first_name='Other',
        last_name='Instructor',
        role_id=world['instructor_role'].id,
        timezone='UTC',
    )
    db_session.add(other_instructor)
    db_session.commit()

    mine = _make_enrollment(
        db_session, world, 'mine',
        status='pending_payment', payment_status=None, payment_verified=False,
    )
    theirs = _make_enrollment(
        db_session, world, 'theirs',
        status='pending_payment', payment_status=None, payment_verified=False,
        instructor=other_instructor,
    )

    all_rows = PaymentReminderScheduler.get_pending_payment_enrollments()
    ids = [row[0].id for row in all_rows]
    assert mine.id in ids and theirs.id in ids

    scoped = PaymentReminderScheduler.get_pending_payment_enrollments(
        instructor_id=world['instructor_id']
    )
    scoped_ids = [row[0].id for row in scoped]
    assert mine.id in scoped_ids
    assert theirs.id not in scoped_ids


def test_flatten_reminder_result_reports_real_totals():
    """/payment-reminders/run used to read keys run_scheduler() never returns,
    so the endpoint always answered with zeros."""
    from src.routes.application_routes import _flatten_reminder_result

    result = {
        'status': 'success',
        'duration_seconds': 2.0,
        'category_results': {
            'submitted_unapproved': {
                'total': 3, 'reminders_needed': 2, 'sent': 2, 'failed': 0,
                'errors': [], 'applications': [],
            },
            'pending_enrollments': {
                'reminders_needed': 4, 'sent': 3, 'failed': 1,
                'errors': [{'email': 'x@y.test', 'error': 'smtp down'}],
                'enrollments': [],
            },
        },
    }

    payload = _flatten_reminder_result(result)

    assert payload['summary']['sent'] == 5
    assert payload['summary']['failed'] == 1
    assert payload['summary']['reminders_needed'] == 6
    assert payload['summary']['total_checked'] == 7
    assert payload['errors'] == [
        {'email': 'x@y.test', 'error': 'smtp down', 'category': 'pending_enrollments'}
    ]
    assert payload['applications'] is None


def test_send_actionable_endpoint_runs_all_pages(app, db_session, world, monkeypatch):
    """The dashboard's Send All Reminders used to hit only the records on the
    current page; it must reach every actionable record."""
    import json as _json
    from flask_jwt_extended import create_access_token
    from src.models.user_models import User, Role
    from src.utils import payment_notifications

    admin_role = Role(name='admin')
    db_session.add(admin_role)
    db_session.commit()
    admin = User(
        username='pay_admin',
        email='pay_admin@test.com',
        password_hash='hashed',
        first_name='Pay',
        last_name='Admin',
        role_id=admin_role.id,
        timezone='UTC',
    )
    db_session.add(admin)
    db_session.commit()

    application = _make_application(
        db_session, world, 'bulk', is_draft=False, payment_status='pending_verification'
    )
    enrollment = _make_enrollment(
        db_session, world, 'bulk',
        status='active', payment_status='submitted_with_proof', payment_verified=False,
    )

    monkeypatch.setattr(
        payment_notifications, 'send_submitted_unapproved_notification', lambda **kwargs: True
    )
    monkeypatch.setattr(
        payment_notifications, 'send_payment_reminder_notification', lambda **kwargs: True
    )

    with app.app_context():
        token = create_access_token(identity=str(admin.id))
    headers = {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}
    url = '/api/v1/applications/payment-reminders/send-actionable'

    client = app.test_client()

    preview = client.post(url, json={'dry_run': True}, headers=headers)
    assert preview.status_code == 200
    preview_data = preview.get_json()
    assert preview_data['summary']['reminders_needed'] == 2
    assert preview_data['summary']['sent'] == 0

    sent = client.post(url, json={'dry_run': False}, headers=headers)
    assert sent.status_code == 200
    sent_data = sent.get_json()
    assert sent_data['summary']['sent'] == 2
    assert sent_data['summary']['failed'] == 0

    # Unauthenticated callers get nothing.
    assert client.post(url, json={'dry_run': True}).status_code == 401

    db_session.refresh(application)
    assert application.payment_reminder_count == 1
    assert enrollment.id is not None
