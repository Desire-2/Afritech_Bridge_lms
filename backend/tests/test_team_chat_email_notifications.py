"""Posting to the team chat emails the rest of the team.

One message → one email per teammate (never the sender), honouring the
recipient's email preferences, with a short per-room throttle so a burst of
messages doesn't stack near-identical emails. A mail-provider failure must
never turn a saved message into a 500.

The capture fixture patches the shared brevo client the same way
``test_submission_instructor_email`` does; sends happen on a background
thread, so tests wait for them instead of assuming they're done.
"""

import time
import uuid
from datetime import datetime, timedelta

import pytest
from flask_jwt_extended import create_access_token

import src.utils.email_notifications as email_notifications
from src.models.course_models import (
    Course,
    Enrollment,
    Lesson,
    Module,
    Project,
    ProjectSubmission,
)
from src.models.user_models import Role, User, db


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

        def make_user(prefix, **kwargs):
            user = User(
                username=f"{prefix}_{suffix}",
                email=f"{prefix}_{suffix}@example.test",
                role_id=role.id,
                **kwargs,
            )
            user.set_password("Password123!")
            db.session.add(user)
            db.session.flush()
            return user

        sender = make_user("ce_send", first_name="Selina", last_name="Sender")
        mate = make_user("ce_mate", first_name="Mo", last_name="Mate")
        quiet = make_user("ce_quiet", first_name="Quinn", last_name="Quiet")
        quiet.email_notifications = False  # master opt-out
        # No first/last name — the email must never greet "None None".
        applicant = make_user("ce_none")
        outsider = make_user("ce_out")

        course = Course(
            title=f"Chat notify {suffix}",
            description="team chat email tests",
            instructor_id=sender.id,
            is_published=True,
            enrollment_type="free",
        )
        db.session.add(course)
        db.session.flush()

        for student in (sender, mate, quiet, applicant, outsider):
            db.session.add(
                Enrollment(student_id=student.id, course_id=course.id, status="active")
            )

        module = Module(
            title="Module one",
            course_id=course.id,
            order=0,
            is_published=True,
        )
        db.session.add(module)
        db.session.flush()
        lesson = Lesson(
            title="Last lesson",
            content_type="text",
            content_data="{}",
            module_id=module.id,
            order=0,
            is_published=True,
        )
        db.session.add(lesson)
        db.session.flush()

        project = Project(
            title="Ship the chat emails",
            description="notify the team",
            course_id=course.id,
            module_ids=f"[{module.id}]",
            due_date=datetime.utcnow() + timedelta(days=14),
            is_published=True,
            submission_format="both",
            collaboration_allowed=True,
            max_team_size=4,
        )
        db.session.add(project)
        db.session.flush()

        team = ProjectSubmission(
            project_id=project.id,
            student_id=sender.id,
            submitted_at=None,
        )
        team.set_team_members([mate.id, quiet.id, applicant.id])
        db.session.add(team)
        db.session.commit()

        yield {
            "sender_id": sender.id,
            "sender_email": sender.email,
            "mate_id": mate.id,
            "mate_email": mate.email,
            "quiet_id": quiet.id,
            "quiet_email": quiet.email,
            "applicant_id": applicant.id,
            "applicant_email": applicant.email,
            "applicant_username": applicant.username,
            "outsider_id": outsider.id,
            "project_id": project.id,
            "project_title": project.title,
            "course_title": course.title,
            "course_id": course.id,
            "lesson_id": lesson.id,
            "team_id": team.id,
        }


@pytest.fixture(autouse=True)
def fresh_throttle(monkeypatch):
    """The throttle is module-level state — never leak it between tests."""
    monkeypatch.setattr(email_notifications, "_team_chat_notices", {})


@pytest.fixture()
def sent_emails(monkeypatch):
    captured = []

    def fake_send_email(**kwargs):
        captured.append(kwargs)
        return True

    monkeypatch.setattr(email_notifications.brevo_service, "send_email", fake_send_email)
    return captured


def _wait_for(predicate, timeout=5.0):
    deadline = time.time() + timeout
    while time.time() < deadline:
        if predicate():
            return True
        time.sleep(0.05)
    return False


def _auth(user_id, app):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _post_chat(client, app, user_id, project_id, body):
    return client.post(
        f"/api/v1/student/projects/{project_id}/team/chat",
        headers=_auth(user_id, app),
        json={"body": body},
    )


# ── Who gets emailed ───────────────────────────────────────────────────────


def test_each_teammate_is_emailed_and_the_sender_is_not(env, client, app, sent_emails):
    resp = _post_chat(client, app, env["sender_id"], env["project_id"], "I pushed the wireframes")
    assert resp.status_code == 201

    # `quiet` opted out, so only mate + applicant remain.
    assert _wait_for(lambda: len(sent_emails) >= 2), "teammate emails were never sent"
    assert len(sent_emails) == 2
    to_emails = {e["to_emails"][0] for e in sent_emails}
    assert to_emails == {env["mate_email"], env["applicant_email"]}
    assert env["sender_email"] not in to_emails
    assert env["quiet_email"] not in to_emails

    for email in sent_emails:
        assert "Selina Sender" in email["subject"]
        assert env["project_title"] in email["subject"]
        html = email["html_content"]
        assert "Mo" in html or "ce_none" in html  # recipient greeting
        assert "I pushed the wireframes" in html
        assert "Selina Sender" in html
        assert env["course_title"] in html
        # Deep link opens the lesson that carries this project, on its tab.
        assert f"/learn/{env['course_id']}?lesson={env['lesson_id']}&tab=project" in html


def test_fallback_link_when_no_lesson_carries_the_project(env, client, app, sent_emails, monkeypatch):
    """A project whose module has no lessons still gets a working link."""
    with app.app_context():
        lesson = db.session.get(Lesson, env["lesson_id"])
        db.session.delete(lesson)
        db.session.commit()

    resp = _post_chat(client, app, env["sender_id"], env["project_id"], "anyone there?")
    assert resp.status_code == 201
    assert _wait_for(lambda: len(sent_emails) >= 2)
    for email in sent_emails:
        assert f"/student/projects/{env['project_id']}" in email["html_content"]


def test_opted_out_member_is_emailed_again_after_re_enabling(env, client, app, sent_emails):
    with app.app_context():
        quiet = db.session.get(User, env["quiet_id"])
        quiet.email_notifications = True  # flip: now everyone but the sender gets mail
        db.session.commit()

    resp = _post_chat(client, app, env["sender_id"], env["project_id"], "flipping prefs")
    assert resp.status_code == 201
    assert _wait_for(lambda: len(sent_emails) >= 3)
    assert len(sent_emails) == 3
    to_emails = {e["to_emails"][0] for e in sent_emails}
    assert env["quiet_email"] in to_emails
    assert env["sender_email"] not in to_emails


def test_member_without_a_name_gets_a_real_greeting(env, client, app, sent_emails):
    """Users with no first/last name must never be greeted as 'None None'."""
    resp = _post_chat(client, app, env["mate_id"], env["project_id"], "hello team")
    assert resp.status_code == 201
    assert _wait_for(lambda: len(sent_emails) >= 2)
    assert len(sent_emails) == 2

    # Mo posted, so the mail goes to Selina (who has a name) and the
    # nameless applicant (who must be greeted by username instead).
    to_emails = {e["to_emails"][0] for e in sent_emails}
    assert to_emails == {env["sender_email"], env["applicant_email"]}
    assert env["mate_email"] not in to_emails

    applicant_email = next(
        e for e in sent_emails if e["to_emails"][0] == env["applicant_email"]
    )
    assert "None None" not in applicant_email["html_content"]
    assert env["applicant_username"] in applicant_email["html_content"]
    assert "Mo Mate" in applicant_email["subject"]


def test_outsider_cannot_post_and_nobody_is_emailed(env, client, app, sent_emails):
    resp = _post_chat(client, app, env["outsider_id"], env["project_id"], "let me in")
    assert resp.status_code == 403
    time.sleep(0.2)
    assert sent_emails == []


# ── Throttling and failure handling ────────────────────────────────────────


def test_burst_of_messages_emails_each_teammate_once(env, client, app, sent_emails):
    first = _post_chat(client, app, env["sender_id"], env["project_id"], "first line")
    assert first.status_code == 201
    second = _post_chat(client, app, env["sender_id"], env["project_id"], "second line")
    assert second.status_code == 201

    assert _wait_for(lambda: len(sent_emails) >= 2), "teammate emails were never sent"
    time.sleep(0.3)  # give any queued follow-up a chance to show up
    assert len(sent_emails) == 2  # the burst did not double the emails

    # Both messages are still in the room — only the email is throttled.
    page = client.get(
        f"/api/v1/student/projects/{env['project_id']}/team/chat",
        headers=_auth(env["mate_id"], app),
    ).get_json()
    assert [m["body"] for m in page["messages"]] == ["first line", "second line"]


def test_provider_failure_never_breaks_the_post(env, client, app, monkeypatch):
    attempts = []

    def boom(**kwargs):
        attempts.append(kwargs)
        raise RuntimeError("smtp down")

    monkeypatch.setattr(email_notifications.brevo_service, "send_email", boom)

    resp = _post_chat(client, app, env["sender_id"], env["project_id"], "saved regardless")
    assert resp.status_code == 201, resp.get_json()
    assert resp.get_json()["message"]["body"] == "saved regardless"

    # Wait until the background thread has attempted every recipient.
    assert _wait_for(lambda: len(attempts) >= 2), "background sends never ran"

    page = client.get(
        f"/api/v1/student/projects/{env['project_id']}/team/chat",
        headers=_auth(env["mate_id"], app),
    ).get_json()
    assert [m["body"] for m in page["messages"]] == ["saved regardless"]


def test_direct_call_is_deterministic_without_background_thread(env, app, sent_emails):
    """background=False sends inline — useful for schedulers and debugging."""
    with app.app_context():
        project = db.session.get(Project, env["project_id"])
        recipients = User.query.filter(
            User.id.in_([env["mate_id"], env["applicant_id"]])
        ).all()

        queued = email_notifications.notify_team_of_chat_message(
            recipients=recipients,
            sender_name="Selina Sender",
            message_body="inline send",
            project=project,
            submission_id=env["team_id"],
            background=False,
        )

    assert queued == 2
    assert len(sent_emails) == 2
    assert {e["to_emails"][0] for e in sent_emails} == {
        env["mate_email"],
        env["applicant_email"],
    }
