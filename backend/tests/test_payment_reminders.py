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


def test_reminder_email_guides_entering_email_and_clicking_pay_now():
    """The reminder must teach the how-to-pay flow, not just nag.

    Applicants find their existing application by entering their email on
    the application form, then continue with Pay Now — the email spells
    that out (with the exact address to use) and its CTA matches.
    """
    from types import SimpleNamespace

    from src.utils.payment_email_templates import payment_reminder_email

    application = SimpleNamespace(
        id=42,
        full_name="Ada Obi",
        email="ada@example.com",
        course_id=7,
        application_window_id=None,
    )
    html = payment_reminder_email(
        application, "Python Masterclass", {"amount": 50, "currency": "USD"}
    )

    # Step-by-step how-to-pay guidance.
    assert "How to Complete Your Payment" in html
    assert "no need to fill the form again" in html
    assert "enter the address you applied with" in html
    # The exact email the applicant must type into the form.
    assert "ada@example.com" in html
    # The Pay Now step and chosen payment methods.
    assert "Pay Now" in html
    assert "MTN Mobile Money" in html
    # CTA matches the in-form button name and points at the application page.
    assert "💳 Pay Now" in html
    assert "courses/7/apply" in html
    assert "then click" in html


def test_draft_save_email_has_same_how_to_pay_guidance():
    """Single and bulk draft reminders send the "application saved" email —
    it must teach the same how-to-pay flow as the scheduler reminder, or
    bulk reminders nag without unblocking anyone."""
    from types import SimpleNamespace

    from src.utils.payment_email_templates import application_saved_payment_pending_email

    application = SimpleNamespace(
        id=9,
        full_name="Kofi Mensah",
        email="kofi@example.com",
        course_id=3,
        application_window_id=None,
    )
    html = application_saved_payment_pending_email(
        application, "Data Bootcamp", {"amount": 80, "currency": "USD"}
    )

    assert "How to Complete Your Payment" in html
    assert "no need to fill the form again" in html
    assert "kofi@example.com" in html
    assert "MTN Mobile Money" in html
    # CTA now matches the in-form button name used everywhere else.
    assert "💳 Pay Now" in html
    assert "courses/3/apply" in html
    assert "then click" in html


# ── Bulk draft reminders (admin panel scope) ──────────────────────────────

BULK_URL = '/api/v1/applications/drafts/bulk-remind'
STATS_URL = '/api/v1/applications/drafts/statistics'


def _admin_headers(app, db_session):
    from flask_jwt_extended import create_access_token
    from src.models.user_models import User, Role

    admin_role = Role.query.filter_by(name='admin').first()
    if admin_role is None:
        admin_role = Role(name='admin')
        db_session.add(admin_role)
        db_session.commit()
    admin = User(
        username='draft_admin',
        email='draft_admin@test.com',
        password_hash='hashed',
        first_name='Draft',
        last_name='Admin',
        role_id=admin_role.id,
        timezone='UTC',
    )
    db_session.add(admin)
    db_session.commit()

    with app.app_context():
        token = create_access_token(identity=str(admin.id))
    return {'Authorization': f'Bearer {token}', 'Content-Type': 'application/json'}


def _make_second_window(db_session, world, label='Cohort B'):
    from src.models.course_models import ApplicationWindow
    from src.utils.time_utils import now_local

    window = ApplicationWindow(
        course_id=world['course'].id,
        cohort_label=label,
        closes_at=now_local() + timedelta(days=9),
        cohort_start=now_local() + timedelta(days=11),
    )
    db_session.add(window)
    db_session.commit()
    return window


def _capture_route_emails(monkeypatch):
    """Record (email_sent_to, application) pairs for the bulk endpoint."""
    sent_to = []

    def fake_send(**kwargs):
        application = kwargs.get('application')
        sent_to.append(getattr(application, 'email', None))
        return True

    from src.routes import application_routes
    monkeypatch.setattr(application_routes, 'send_payment_pending_notification', fake_send)
    return sent_to


def test_bulk_remind_scopes_to_selected_cohort(app, db_session, world, monkeypatch):
    """The panel's cohort filter must reach the bulk endpoint — reminding
    'Cohort B' must never email Cohort A applicants."""
    from src.models.course_application import CourseApplication

    headers = _admin_headers(app, db_session)
    sent_to = _capture_route_emails(monkeypatch)

    in_a = _make_application(db_session, world, 'cohorta', is_draft=True, payment_status=None)
    window_b = _make_second_window(db_session, world)
    in_b = CourseApplication(
        course_id=world['course'].id,
        application_window_id=window_b.id,
        full_name='Applicant Cohort B',
        email='cohortb@applicant.test',
        phone='+25000000000',
        motivation='because',
        is_draft=True,
        payment_status=None,
    )
    db_session.add(in_b)
    db_session.commit()

    client = app.test_client()
    resp = client.post(
        BULK_URL,
        json={'stale_days': 0, 'application_window_id': window_b.id},
        headers=headers,
    )
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()

    assert data['matched'] == 1
    assert data['sent'] == 1
    assert sent_to == ['cohortb@applicant.test']

    db_session.refresh(in_a)
    db_session.refresh(in_b)
    assert in_a.payment_reminder_count in (None, 0), "Cohort A draft was emailed by a Cohort B sweep"
    assert in_b.payment_reminder_count == 1


def test_bulk_remind_filters_by_no_cohort(app, db_session, world, monkeypatch):
    """application_window_id='none' targets drafts with no cohort assigned."""
    from src.models.course_application import CourseApplication

    headers = _admin_headers(app, db_session)
    sent_to = _capture_route_emails(monkeypatch)

    unassigned = CourseApplication(
        course_id=world['course'].id,
        application_window_id=None,
        full_name='Unassigned Applicant',
        email='unassigned@applicant.test',
        phone='+25000000000',
        motivation='because',
        is_draft=True,
        payment_status=None,
    )
    linked = _make_application(db_session, world, 'linked', is_draft=True, payment_status=None)
    db_session.add(unassigned)
    db_session.commit()

    client = app.test_client()
    resp = client.post(BULK_URL, json={'stale_days': 0, 'application_window_id': 'none'}, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()

    assert data['matched'] == 1
    assert sent_to == ['unassigned@applicant.test']
    db_session.refresh(linked)
    assert linked.payment_reminder_count in (None, 0)


def test_bulk_remind_never_emails_settled_drafts_by_default(app, db_session, world, monkeypatch):
    """Drafts that already paid must be skipped like the list endpoint does,
    but an explicit payment_status filter opts them back in."""
    headers = _admin_headers(app, db_session)
    sent_to = _capture_route_emails(monkeypatch)

    paid = _make_application(db_session, world, 'settled', is_draft=True, payment_status='completed')
    unpaid = _make_application(db_session, world, 'owes', is_draft=True, payment_status=None)

    client = app.test_client()

    resp = client.post(BULK_URL, json={'stale_days': 0}, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['matched'] == 1
    assert sent_to == ['owes@applicant.test']

    # Explicit filter: admin deliberately reminds already-paid rows.
    resp = client.post(BULK_URL, json={'stale_days': 0, 'payment_status': 'completed'}, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['matched'] == 1
    assert sent_to == ['owes@applicant.test', 'settled@applicant.test']

    db_session.refresh(paid)
    db_session.refresh(unpaid)
    assert paid.payment_reminder_count == 1
    assert unpaid.payment_reminder_count == 1


def test_bulk_remind_honours_search_and_reports_cap(app, db_session, world, monkeypatch):
    """The dialog count includes the search term, so the run must too — and
    matched/capped tell the admin when the safety cap trimmed the run."""
    headers = _admin_headers(app, db_session)
    sent_to = _capture_route_emails(monkeypatch)

    _make_application(db_session, world, 'found', is_draft=True, payment_status=None)
    # Different name so a search for 'found' cannot match it.
    _make_application(db_session, world, 'other', is_draft=True, payment_status=None)
    with app.app_context():
        from src.models.course_application import CourseApplication
        other = CourseApplication.query.filter_by(email='other@applicant.test').first()
        other.full_name = 'Zed Nobody'
        db_session.commit()

    client = app.test_client()

    resp = client.post(BULK_URL, json={'stale_days': 0, 'search': 'found'}, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['matched'] == 1
    assert data['sent'] == 1
    assert data['capped'] is False

    # Cap: two drafts match everything, but only one may be emailed.
    resp = client.post(BULK_URL, json={'stale_days': 0, 'max_recipients': 1}, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    data = resp.get_json()
    assert data['matched'] == 2
    assert data['total_stale'] == 1
    assert data['capped'] is True


def test_bulk_remind_stale_days_zero_targets_fresh_drafts(app, db_session, world, monkeypatch):
    """stale_days defaults to 3; the panel's 'all matching filters' scope
    sends stale_days=0 which must reach drafts saved seconds ago."""
    headers = _admin_headers(app, db_session)
    sent_to = _capture_route_emails(monkeypatch)

    fresh = _make_application(db_session, world, 'fresh', is_draft=True, payment_status=None)

    client = app.test_client()

    stale_only = client.post(BULK_URL, json={'stale_days': 3}, headers=headers)
    assert stale_only.status_code == 200
    assert stale_only.get_json()['matched'] == 0
    assert sent_to == []

    all_matching = client.post(BULK_URL, json={'stale_days': 0}, headers=headers)
    assert all_matching.status_code == 200
    assert all_matching.get_json()['matched'] == 1

    db_session.refresh(fresh)
    assert fresh.payment_reminder_count == 1


def test_draft_statistics_respect_scope_filters(app, db_session, world):
    """Cards must reflect the same cohort/payment scope as the list the admin
    is about to remind, including the 3+ day stale counter."""
    headers = _admin_headers(app, db_session)
    from src.utils.time_utils import now_local

    stale_in_a = _make_application(db_session, world, 'olda', is_draft=True, payment_status=None)
    stale_in_a.updated_at = now_local() - timedelta(days=10)
    window_b = _make_second_window(db_session, world)
    from src.models.course_application import CourseApplication
    fresh_in_b = CourseApplication(
        course_id=world['course'].id,
        application_window_id=window_b.id,
        full_name='Fresh B',
        email='freshb@applicant.test',
        phone='+25000000000',
        motivation='because',
        is_draft=True,
        payment_status=None,
    )
    paid_in_a = _make_application(db_session, world, 'paid', is_draft=True, payment_status='completed')
    db_session.add(fresh_in_b)
    db_session.commit()

    client = app.test_client()

    # Unfiltered: paid draft excluded by default (matches the list).
    resp = client.get(STATS_URL, headers=headers)
    assert resp.status_code == 200, resp.get_json()
    stats = resp.get_json()
    assert stats['total_drafts'] == 2
    assert stats['age_breakdown']['stale_3d_plus'] == 1
    assert stats['age_breakdown']['stale_30d_plus'] == 0

    # Cohort scope: only Cohort A rows, whose single 10-day-old draft is stale.
    resp = client.get(STATS_URL, headers=headers, query_string={'application_window_id': world['window'].id})
    stats = resp.get_json()
    assert stats['total_drafts'] == 1
    assert stats['age_breakdown']['stale_3d_plus'] == 1

    # Other cohort: the fresh draft only.
    resp = client.get(STATS_URL, headers=headers, query_string={'application_window_id': window_b.id})
    stats = resp.get_json()
    assert stats['total_drafts'] == 1
    assert stats['age_breakdown']['stale_3d_plus'] == 0

    # Explicit payment filter surfaces the settled draft.
    resp = client.get(STATS_URL, headers=headers, query_string={'payment_status': 'completed'})
    stats = resp.get_json()
    assert stats['total_drafts'] == 1

    # Course breakdown is available for the course dropdown.
    resp = client.get(STATS_URL, headers=headers)
    breakdown = resp.get_json()['course_breakdown']
    assert any(row['course_id'] == world['course'].id and row['draft_count'] == 2 for row in breakdown)
