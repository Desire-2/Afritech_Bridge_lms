"""Tests for the extended /applications/check-duplicate response.

The endpoint returns minimal payment context (application_id, workflow
status, payment_status, payment_method) alongside `exists` so the application
form can show a status-aware message and a "Pay Now" shortcut for applicants
whose payment is still incomplete.  Drafts must never count as duplicates.
"""

import uuid

import pytest

from src.models.course_application import CourseApplication
from src.models.course_models import Course
from src.models.user_models import User, Role, db


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        instructor_role = Role.query.filter_by(name="instructor").first()
        if instructor_role is None:
            instructor_role = Role(name="instructor")
            db.session.add(instructor_role)
            db.session.flush()

        instructor = User(
            username=f"cd_instructor_{suffix}",
            email=f"cd_instructor_{suffix}@example.test",
            role_id=instructor_role.id,
        )
        instructor.set_password("Password123!")
        db.session.add(instructor)
        db.session.flush()

        course = Course(
            title=f"Check Duplicate {suffix}",
            description="check-duplicate payment context tests",
            instructor_id=instructor.id,
            is_published=True,
            enrollment_type="paid",
            price=100.0,
            currency="USD",
        )
        db.session.add(course)
        db.session.flush()

        def make_application(email, **kwargs):
            record = CourseApplication(
                course_id=course.id,
                full_name="Test Applicant",
                email=email.lower().strip(),
                phone="+25000000000",
                motivation="I want to learn.",
                status=kwargs.pop("status", "pending"),
                **kwargs,
            )
            db.session.add(record)
            db.session.flush()
            record_id = record.id
            db.session.commit()
            return record_id

        created = {"course_id": course.id, "instructor_id": instructor.id,
                   "make_application": make_application}
        yield created

        CourseApplication.query.filter_by(course_id=created["course_id"]).delete()
        Course.query.filter(Course.id == created["course_id"]).delete()
        User.query.filter(User.id == created["instructor_id"]).delete()
        db.session.commit()


def _get(client, course_id, email):
    return client.get(
        f"/api/v1/applications/check-duplicate?course_id={course_id}&email={email}"
    )


def test_no_application_returns_exists_false(client, env):
    resp = _get(client, env["course_id"], "nobody@example.test")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data == {"exists": False}


def test_draft_is_not_treated_as_duplicate(client, env):
    env["make_application"]("draft.person@example.test", is_draft=True,
                            payment_status=None)
    resp = _get(client, env["course_id"], "draft.person@example.test")
    assert resp.status_code == 200
    assert resp.get_json() == {"exists": False}


def test_submitted_application_returns_payment_context(client, env):
    app_id = env["make_application"](
        "pending.payer@example.test",
        is_draft=False,
        payment_status="pending_verification",
        payment_method="momo_pay_code",
    )
    resp = _get(client, env["course_id"], "pending.payer@example.test")
    assert resp.status_code == 200
    data = resp.get_json()
    assert data["exists"] is True
    assert data["application_id"] == app_id
    assert data["status"] == "pending"
    assert data["payment_status"] == "pending_verification"
    assert data["payment_method"] == "momo_pay_code"


def test_completed_payment_is_reported(client, env):
    env["make_application"](
        "paid.person@example.test",
        is_draft=False,
        payment_status="completed",
        payment_method="paypal",
    )
    resp = _get(client, env["course_id"], "paid.person@example.test")
    data = resp.get_json()
    assert data["exists"] is True
    assert data["payment_status"] == "completed"
    assert data["payment_method"] == "paypal"


def test_email_lookup_is_case_insensitive(client, env):
    env["make_application"]("Case.User@Example.test", is_draft=False,
                            payment_status="pending")
    resp = _get(client, env["course_id"], "case.user@example.test")
    assert resp.get_json()["exists"] is True
