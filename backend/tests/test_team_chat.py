"""Team contact details and the team chat room.

``users.phone_number`` is optional and usually blank, so ``GET
/student/projects/<id>/my-team`` falls back to the application form every
enrolled student filled in — the roster on the project tab is useless without
a way to reach a teammate.

The chat room is keyed by the team's ProjectSubmission row: its members can
read and write it, nobody else can.

Everything is set up inside the fixture: the app fixture keeps one session
alive for the whole test, so rows changed *after* the fixture yield a
different session than the routes read from.
"""

import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

from src.models.course_application import CourseApplication
from src.models.course_models import Course, Enrollment, Project, ProjectSubmission
from src.models.user_models import User, Role, db


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        suffix = uuid.uuid4().hex[:10]

        role = Role.query.filter_by(name="student").first()
        if role is None:
            role = Role(name="student")
            db.session.add(role)
            db.session.flush()

        def make_user(prefix, phone_number=None):
            user = User(
                username=f"{prefix}_{suffix}",
                email=f"{prefix}_{suffix}@example.test",
                role_id=role.id,
                phone_number=phone_number,
            )
            user.set_password("Password123!")
            db.session.add(user)
            db.session.flush()
            return user

        # Four ways a teammate's number can (or cannot) be found:
        lead = make_user("tc_lead", phone_number="+1 555 0100")   # on the account
        mate = make_user("tc_mate")                               # linked application
        applicant = make_user("tc_app")                           # matched by email
        nobody = make_user("tc_none")                             # no number anywhere
        outsider = make_user("tc_out")                            # enrolled, not on the team

        course = Course(
            title=f"Team chat {suffix}",
            description="team chat tests",
            instructor_id=lead.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        for student in (lead, mate, applicant, nobody, outsider):
            db.session.add(
                Enrollment(student_id=student.id, course_id=course.id, status="active")
            )

        mate_application = CourseApplication(
            course_id=course.id,
            full_name="Team Mate",
            email=mate.email,
            phone="+233 20 000 0001",
            motivation="Learn to build things",
        )
        db.session.add(mate_application)
        db.session.flush()
        Enrollment.query.filter_by(
            student_id=mate.id, course_id=course.id
        ).first().application_id = mate_application.id

        # Filed with the same address but never linked to the enrollment, so
        # only an email match can find it.
        db.session.add(
            CourseApplication(
                course_id=course.id,
                full_name="Applicant",
                email=applicant.email,
                phone="+233 77 000 0002",
                motivation="Learn to build things",
            )
        )

        project = Project(
            title="Ship the feature",
            description="collaborate",
            course_id=course.id,
            module_ids="[]",
            due_date=datetime.utcnow() + timedelta(days=30),
            is_published=True,
            submission_format="both",
            collaboration_allowed=True,
            max_team_size=4,
        )
        # A sibling project with collaboration switched off, for the 400 paths.
        closed_project = Project(
            title="Solo only",
            description="no teams here",
            course_id=course.id,
            module_ids="[]",
            due_date=datetime.utcnow() + timedelta(days=30),
            is_published=True,
            submission_format="text_response",
            collaboration_allowed=False,
        )
        db.session.add(project)
        db.session.add(closed_project)
        db.session.flush()

        team = ProjectSubmission(
            project_id=project.id,
            student_id=lead.id,
            submitted_at=None,
        )
        team.set_team_members([mate.id, applicant.id, nobody.id])
        db.session.add(team)

        db.session.commit()

        yield {
            "lead_id": lead.id,
            "mate_id": mate.id,
            "applicant_id": applicant.id,
            "nobody_id": nobody.id,
            "outsider_id": outsider.id,
            "mate_username": mate.username,
            "lead_username": lead.username,
            "course_id": course.id,
            "project_id": project.id,
            "closed_project_id": closed_project.id,
            "team_id": team.id,
        }


def _auth(user_id, app):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _my_team(client, app, user_id, project_id):
    return client.get(
        f"/api/v1/student/projects/{project_id}/my-team",
        headers=_auth(user_id, app),
    )


def _chat_url(project_id):
    return f"/api/v1/student/projects/{project_id}/team/chat"


def _members(response):
    return {m["id"]: m for m in response.get_json()["team"]["members"]}


# ── Contact details ────────────────────────────────────────────────────────


def test_account_phone_number_is_preferred(env, client, app):
    members = _members(_my_team(client, app, env["lead_id"], env["project_id"]))
    assert members[env["lead_id"]]["phone"] == "+1 555 0100"


def test_phone_falls_back_to_application_form(env, client, app):
    """The application form is where a phone number actually lives."""
    members = _members(_my_team(client, app, env["lead_id"], env["project_id"]))
    assert members[env["mate_id"]]["phone"] == "+233 20 000 0001"


def test_phone_falls_back_by_email_when_enrollment_has_no_application(
    env, client, app
):
    members = _members(_my_team(client, app, env["lead_id"], env["project_id"]))
    assert members[env["applicant_id"]]["phone"] == "+233 77 000 0002"


def test_member_without_any_number_gets_an_empty_string(env, client, app):
    members = _members(_my_team(client, app, env["mate_id"], env["project_id"]))
    assert members[env["nobody_id"]]["phone"] == ""


def test_member_names_never_render_as_none_none(env, client, app):
    """first_name/last_name are unset for many accounts."""
    members = _members(_my_team(client, app, env["lead_id"], env["project_id"]))
    for member in members.values():
        assert member["name"]
        assert "None" not in member["name"]


# ── Chat room ──────────────────────────────────────────────────────────────


def test_team_members_can_exchange_messages(env, client, app):
    sent = client.post(
        _chat_url(env["project_id"]),
        headers=_auth(env["lead_id"], app),
        json={"body": "I pushed the wireframes"},
    )
    assert sent.status_code == 201
    message = sent.get_json()["message"]
    assert message["sender_id"] == env["lead_id"]
    assert message["submission_id"] == env["team_id"]

    page = client.get(
        _chat_url(env["project_id"]), headers=_auth(env["mate_id"], app)
    ).get_json()
    assert page["submission_id"] == env["team_id"]
    assert page["viewer_id"] == env["mate_id"]
    assert [m["body"] for m in page["messages"]] == ["I pushed the wireframes"]
    assert page["messages"][0]["sender_name"] == env["lead_username"]


def test_polling_after_the_last_id_returns_only_new_messages(env, client, app):
    first = client.post(
        _chat_url(env["project_id"]),
        headers=_auth(env["lead_id"], app),
        json={"body": "first"},
    ).get_json()["message"]

    polled = client.get(
        f"{_chat_url(env['project_id'])}?after={first['id']}",
        headers=_auth(env["lead_id"], app),
    ).get_json()
    assert polled["messages"] == []

    second = client.post(
        _chat_url(env["project_id"]),
        headers=_auth(env["mate_id"], app),
        json={"body": "second"},
    ).get_json()["message"]

    polled = client.get(
        f"{_chat_url(env['project_id'])}?after={first['id']}",
        headers=_auth(env["lead_id"], app),
    ).get_json()
    assert [m["body"] for m in polled["messages"]] == ["second"]
    assert polled["messages"][0]["id"] > first["id"]


def test_a_scaffolded_team_starts_with_an_empty_room(env, client, app):
    page = client.get(
        _chat_url(env["project_id"]), headers=_auth(env["mate_id"], app)
    ).get_json()
    assert page["messages"] == []


def test_students_outside_the_team_cannot_read_or_post(env, client, app):
    headers = _auth(env["outsider_id"], app)

    assert client.get(_chat_url(env["project_id"]), headers=headers).status_code == 403
    assert (
        client.post(
            _chat_url(env["project_id"]), headers=headers, json={"body": "hi"}
        ).status_code
        == 403
    )


def test_empty_and_oversized_messages_are_rejected(env, client, app):
    headers = _auth(env["lead_id"], app)

    assert (
        client.post(
            _chat_url(env["project_id"]), headers=headers, json={"body": "   "}
        ).status_code
        == 400
    )
    assert (
        client.post(
            _chat_url(env["project_id"]), headers=headers, json={"body": "x" * 2001}
        ).status_code
        == 400
    )


def test_chat_is_closed_when_collaboration_is_off(env, client, app):
    headers = _auth(env["lead_id"], app)
    url = _chat_url(env["closed_project_id"])

    assert client.get(url, headers=headers).status_code == 400
    assert (
        client.post(url, headers=headers, json={"body": "hi"}).status_code == 400
    )
