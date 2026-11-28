"""Regressions for the project submission → AAGE grading lifecycle.

Covers team-row discovery, instructor corrections staying in sync with the
published AAGE result, and failing AI grades being recorded on module progress.
"""

import pytest
from flask_jwt_extended import create_access_token

from src.models.aage_models import CriterionScore, EvaluationResult
from src.models.course_models import ProjectSubmission
from src.models.student_models import ModuleProgress
from src.models.user_models import db
from src.services.aage.persistence import write_through_grade
from src.utils.time_utils import now_local

from test_project_multi_module_gating import env  # noqa: F401 - shared fixture


@pytest.fixture(autouse=True)
def _release_db(app):
    old_leeway = app.config.get("JWT_DECODE_LEEWAY")
    app.config["JWT_DECODE_LEEWAY"] = 5
    yield
    with app.app_context():
        db.session.rollback()
        db.session.remove()
    if old_leeway is None:
        app.config.pop("JWT_DECODE_LEEWAY", None)
    else:
        app.config["JWT_DECODE_LEEWAY"] = old_leeway


def _auth(app, user_id):
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _published_result(env, submission, score, feedback="AI feedback"):
    result = EvaluationResult(
        submission_type="project",
        submission_id=submission.id,
        assessment_kind="project",
        assessment_id=env["project_id"],
        course_id=env["course_id"],
        student_id=submission.student_id,
        total_awarded=score,
        total_possible=100.0,
        final_score=score,
        grade_letter="F",
        points_awarded=score,
        confidence=100.0,
        requires_review=False,
        status="published",
        feedback=feedback,
        is_official=True,
        published_at=now_local(),
    )
    db.session.add(result)
    db.session.flush()
    for idx, (key, name) in enumerate((("c1", "Research"), ("c2", "Presentation"))):
        db.session.add(CriterionScore(
            result_id=result.id,
            criterion_key=key,
            name=name,
            awarded=score / 2,
            maximum=50.0,
            weight=50.0,
            weighted_score=score / 2,
            rationale="AI assessment",
            evidence_category="CODE_SUPPORTED",
            verification_status="partial",
            order_index=idx,
        ))
    db.session.flush()
    return result


def test_teammate_submission_joins_the_team_row(env, client, app, monkeypatch):
    """A non-primary member must not create a second team submission."""
    from src.routes import student_routes

    monkeypatch.setattr(
        student_routes, "enqueue_for_submission", lambda **kwargs: None
    )

    # Instructor-scaffolded team row: roster set, no work submitted yet.
    submission = ProjectSubmission.query.get(env["submission_id"])
    submission.submitted_at = None
    submission.text_content = None
    submission.project.max_team_size = 2
    db.session.commit()

    response = client.post(
        f"/api/v1/student/projects/{env['project_id']}/submit",
        json={
            "text_content": "submitted by the teammate",
            "team_members": [env["student_id"]],
        },
        headers=_auth(app, env["teammate_id"]),
    )
    assert response.status_code in (200, 201), response.get_json()
    db.session.expire_all()

    submitted = [
        row for row in ProjectSubmission.query.filter_by(
            project_id=env["project_id"]
        ).all()
        if row.submitted_at is not None
    ]
    assert len(submitted) == 1
    assert submitted[0].id == env["submission_id"]
    assert submitted[0].text_content == "submitted by the teammate"
    assert env["teammate_id"] in submitted[0].get_team_members()
    assert env["student_id"] not in submitted[0].get_team_members()


def test_teammates_see_the_shared_submission(env, client, app):
    """Student reads fall back to the team row before grade propagation."""
    assert ProjectSubmission.query.filter_by(
        project_id=env["project_id"], student_id=env["teammate_id"]
    ).first() is None

    details = client.get(
        f"/api/v1/student/projects/{env['project_id']}/details",
        headers=_auth(app, env["teammate_id"]),
    )
    assert details.status_code == 200, details.get_json()
    payload = details.get_json()
    status = payload["project"]["submission_status"]
    assert status["submitted"] is True
    assert status["id"] == env["submission_id"]

    listing = client.get(
        "/api/v1/student/projects",
        headers=_auth(app, env["teammate_id"]),
    )
    assert listing.status_code == 200, listing.get_json()
    row = next(item for item in listing.get_json()
               if item["id"] == env["project_id"])
    assert row["submission_status"]["submitted"] is True
    assert row["submission_status"]["id"] == env["submission_id"]


def test_manual_grade_updates_published_aage_result(env, client, app, monkeypatch):
    """Instructor corrections must win on the student's AAGE result too."""
    import src.talent_passport.hooks as passport_hooks

    monkeypatch.setattr(
        passport_hooks, "notify_talent_passport", lambda *args, **kwargs: None
    )

    primary = ProjectSubmission.query.get(env["submission_id"])
    carrier = ProjectSubmission(
        project_id=env["project_id"], student_id=env["teammate_id"],
        submitted_at=None,
    )
    db.session.add(carrier)
    db.session.flush()
    first = _published_result(env, primary, 40.0)
    second = _published_result(env, carrier, 55.0)
    result_ids = [first.id, second.id]
    db.session.commit()

    response = client.post(
        f"/api/v1/grading/projects/submissions/{env['submission_id']}/grade",
        json={
            "grade": 75,
            "feedback": "Instructor correction",
            "rubric_criteria": [
                {"name": "Research", "score": 40, "max_points": 50},
                {"name": "Presentation", "score": 35, "max_points": 50},
            ],
        },
        headers=_auth(app, env["instructor_id"]),
    )
    assert response.status_code == 200, response.get_json()
    db.session.expire_all()
    updated = EvaluationResult.query.filter(
        EvaluationResult.id.in_(result_ids)
    ).order_by(EvaluationResult.id.asc()).all()
    assert len(updated) == 2

    for result in updated:
        assert result.final_score == pytest.approx(75.0)
        assert result.points_awarded == pytest.approx(75.0)
        assert result.grade_letter == "C"
        assert result.feedback == "Instructor correction"
        marks = {c.name: c.awarded for c in result.criteria.all()}
        assert marks["Research"] == pytest.approx(40.0)
        assert marks["Presentation"] == pytest.approx(35.0)

    student_result = client.get(
        f"/api/v1/aage/student/results/{env['submission_id']}?submission_type=project",
        headers=_auth(app, env["student_id"]),
    )
    assert student_result.status_code == 200, student_result.get_json()
    payload = student_result.get_json()
    payload = payload.get("data", payload)
    assert payload["final_score"] == pytest.approx(75.0)
    assert payload["feedback"] == "Instructor correction"


def test_failing_aage_project_grade_still_updates_module_scores(
    env, app, monkeypatch
):
    """A failing AI score is recorded everywhere without advancing progress."""
    import src.services.excel_grading.auto_grader as auto_grader
    import src.talent_passport.hooks as passport_hooks

    monkeypatch.setattr(
        auto_grader, "_notify_student_auto_graded", lambda *args, **kwargs: True
    )
    monkeypatch.setattr(
        passport_hooks, "notify_talent_passport", lambda *args, **kwargs: None
    )

    submission = ProjectSubmission.query.get(env["submission_id"])
    result = EvaluationResult(
        submission_type="project",
        submission_id=submission.id,
        assessment_kind="project",
        assessment_id=env["project_id"],
        course_id=env["course_id"],
        student_id=env["student_id"],
        total_awarded=45.0,
        total_possible=100.0,
        final_score=45.0,
        grade_letter="F",
        points_awarded=45.0,
        confidence=100.0,
        requires_review=False,
        status="approved",
        feedback="Missing supporting evidence.",
    )
    db.session.add(result)
    db.session.flush()
    result_id = result.id
    db.session.commit()

    assert write_through_grade(
        result, publication_mode="auto_approved", reason="offline regression"
    ) is True

    db.session.expire_all()
    assert EvaluationResult.query.get(result_id).is_official is True
    for student_id in (env["student_id"], env["teammate_id"]):
        for module_id in (env["m1_id"], env["m2_id"]):
            enrollment_id = (
                env["teammate_enrollment_id"]
                if student_id == env["teammate_id"]
                else env["enrollment_id"]
            )
            progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id,
            ).one()
            assert progress.project_score == pytest.approx(45.0)
