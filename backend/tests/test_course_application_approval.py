"""Regression tests for the course-application approval workflow."""

import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_application import CourseApplication
from src.models.course_models import Course, Enrollment
from src.models.user_models import User, Role, db
from src.routes import application_routes


@pytest.fixture()
def approval_records(app):
    """Create isolated approval records without dropping the shared schema."""
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        admin_role = Role.query.filter_by(name="admin").first()
        if admin_role is None:
            admin_role = Role(name="admin")
            db.session.add(admin_role)

        student_role = Role.query.filter_by(name="student").first()
        if student_role is None:
            student_role = Role(name="student")
            db.session.add(student_role)
        db.session.flush()

        admin = User(
            username=f"approval_admin_{suffix}",
            email=f"approval_admin_{suffix}@example.test",
            role_id=admin_role.id,
        )
        admin.set_password("AdminPassword123!")
        db.session.add(admin)
        db.session.flush()

        course = Course(
            title=f"Approval Regression Course {suffix}",
            description="Course used by approval regression tests.",
            instructor_id=admin.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        created_user_ids = [admin.id]

        def make_application(email, full_name="Amina Uwase"):
            record = CourseApplication(
                course_id=course.id,
                full_name=full_name,
                email=email,
                phone="+250788123456",
                motivation="I want to learn.",
                status="pending",
            )
            db.session.add(record)
            db.session.flush()
            return record

        db.session.commit()
        course_id = course.id
        token = create_access_token(identity=str(admin.id))

        yield {
            "admin": admin,
            "student_role_id": student_role.id,
            "course_id": course_id,
            "make_application": make_application,
            "token": token,
            "created_user_ids": created_user_ids,
        }

        # Remove only records created by this fixture; other tests share the
        # same temporary database during a session.
        db.session.rollback()
        enrollments = Enrollment.query.filter_by(course_id=course_id).all()
        enrolled_user_ids = {enrollment.student_id for enrollment in enrollments}
        for enrollment in enrollments:
            db.session.delete(enrollment)
        for record in CourseApplication.query.filter_by(course_id=course_id).all():
            db.session.delete(record)
        db.session.delete(db.session.get(Course, course_id))
        user_ids_to_delete = set(created_user_ids) | enrolled_user_ids
        for user in User.query.filter(User.id.in_(user_ids_to_delete)).all():
            db.session.delete(user)
        db.session.commit()


def _auth_headers(records):
    return {"Authorization": f"Bearer {records['token']}"}


def test_approval_creates_account_and_emails_credentials(
    app, client, approval_records, monkeypatch
):
    records = approval_records
    application = records["make_application"]("new.learner@example.test")
    sent = {}

    monkeypatch.setattr(application_routes, "generate_temp_password", lambda: "Temp@1234")
    monkeypatch.setattr(
        application_routes.brevo_service,
        "send_email",
        lambda **kwargs: sent.update(kwargs) or True,
    )

    response = client.post(
        f"/api/v1/applications/{application.id}/approve",
        json={},
        headers=_auth_headers(records),
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["new_account"] is True
    assert payload["username"] == "amina.uwase"
    assert payload["email_sent"] is True
    assert "Temp@1234" in sent["html_content"]

    with app.app_context():
        user = User.query.filter_by(email="new.learner@example.test").one()
        assert user.username == "amina.uwase"
        assert user.check_password("Temp@1234")
        assert Enrollment.query.filter_by(student_id=user.id, course_id=records["course_id"]).count() == 1


def test_approval_reuses_existing_account_and_sends_reset_option(
    app, client, approval_records, monkeypatch
):
    records = approval_records
    existing = User(
        username="existing.amina",
        # Legacy data may contain different casing and whitespace.
        email="  Existing.Learner@Example.Test ",
        role_id=records["student_role_id"],
    )
    existing.set_password("ExistingPassword123!")
    db.session.add(existing)
    db.session.commit()
    existing_id = existing.id
    records["created_user_ids"].append(existing_id)
    application = records["make_application"]("existing.learner@example.test")
    application_id = application.id
    sent = {}

    monkeypatch.setattr(
        application_routes.brevo_service,
        "send_email",
        lambda **kwargs: sent.update(kwargs) or True,
    )

    response = client.post(
        f"/api/v1/applications/{application_id}/approve",
        json={},
        headers=_auth_headers(records),
    )

    assert response.status_code == 200
    payload = response.get_json()["data"]
    assert payload["new_account"] is False
    assert payload["username"] == "existing.amina"
    assert "existing credentials" in sent["html_content"]
    assert "auth/reset-password?token=" in sent["html_content"]

    with app.app_context():
        refreshed = db.session.get(User, existing_id)
        assert refreshed.check_password("ExistingPassword123!")
        assert refreshed.reset_token
        assert Enrollment.query.filter_by(student_id=existing_id, course_id=records["course_id"]).count() == 1

    # Resending without the explicit reset option preserves the current
    # password and includes the username plus a recovery link.
    response = client.post(
        f"/api/v1/applications/{application_id}/resend-approval",
        json={},
        headers=_auth_headers(records),
    )
    assert response.status_code == 200
    assert response.get_json()["credentials_reset"] is False
    assert "existing.amina" in sent["html_content"]
    assert "auth/reset-password?token=" in sent["html_content"]

    # Password rotation is opt-in and clearly reflected in the email.
    monkeypatch.setattr(application_routes, "generate_temp_password", lambda: "Reset@1234")
    response = client.post(
        f"/api/v1/applications/{application_id}/resend-approval",
        json={"include_credentials": True},
        headers=_auth_headers(records),
    )
    assert response.status_code == 200
    assert response.get_json()["credentials_reset"] is True
    assert "Reset@1234" in sent["html_content"]

    with app.app_context():
        refreshed = db.session.get(User, existing_id)
        assert refreshed.must_change_password is True
        assert refreshed.check_password("Reset@1234")


def test_status_shortcut_uses_full_approval_workflow(
    app, client, approval_records, monkeypatch
):
    records = approval_records
    application = records["make_application"]("status.shortcut@example.test")
    sent = {}
    monkeypatch.setattr(application_routes, "generate_temp_password", lambda: "Shortcut@123")
    monkeypatch.setattr(
        application_routes.brevo_service,
        "send_email",
        lambda **kwargs: sent.update(kwargs) or True,
    )

    response = client.put(
        f"/api/v1/applications/{application.id}/status",
        json={"status": "approved"},
        headers=_auth_headers(records),
    )

    assert response.status_code == 200
    assert response.get_json()["data"]["new_account"] is True
    assert "Shortcut@123" in sent["html_content"]

    with app.app_context():
        user = User.query.filter_by(email="status.shortcut@example.test").one()
        assert Enrollment.query.filter_by(student_id=user.id, course_id=records["course_id"]).count() == 1
