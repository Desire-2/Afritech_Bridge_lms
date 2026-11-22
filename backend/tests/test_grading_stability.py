"""Regression coverage for stable, non-shrinking AI grades.

A submitted file must not acquire a temporary low score from a degraded AI
run, and re-grading unchanged work must not replace an already published grade
with a different (lower) LLM sample.
"""

from types import SimpleNamespace

import pytest

from src.models.aage_models import (
    EvaluationResult,
    GradingJob,
    SubmissionArtifact,
)
from src.models.course_models import AssignmentSubmission
from src.models.excel_grading_models import ExcelGradingResult
from src.models.user_models import db
from src.services.aage import auto_approval, persistence
from src.services.aage.constants import DEFAULT_CONFIDENCE_POLICY
from src.services.excel_grading import auto_grader
from src.services import excel_grading as excel_grading_pkg
from src.utils.time_utils import now_local

from test_unified_ai_grading import _auth, _env  # noqa: F401 - fixtures/helpers


POLICY = dict(DEFAULT_CONFIDENCE_POLICY)


def _simple_result(**overrides):
    values = {
        "confidence": 80.0,
        "rubric_snapshot": {"status": "approved"},
        "review_reason": "",
        "confidence_factors": {},
        "limitations": [],
        "run_id": None,
        "ai_provider": "nvidia",
        "criteria": SimpleNamespace(all=lambda: []),
        "evidence": SimpleNamespace(all=lambda: []),
    }
    values.update(overrides)
    return SimpleNamespace(**values)


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        data = _env()
        db.session.commit()
        for key in ("instructor", "student", "course", "assignment", "submission"):
            db.session.refresh(data[key])
        return data


def test_fallback_provider_never_auto_approves():
    approved, blockers = auto_approval.should_auto_approve(
        _simple_result(ai_provider="offline-stub"), POLICY)
    assert approved is False
    assert any(b.startswith("fallback_provider") for b in blockers)


def test_degraded_model_result_never_auto_approves():
    approved, blockers = auto_approval.should_auto_approve(
        _simple_result(limitations=[
            "evaluator 'frontend' degraded: model call failed: timeout",
        ]), POLICY)
    assert approved is False
    assert "degraded_evaluation" in blockers


def test_real_provider_result_still_auto_approves():
    approved, blockers = auto_approval.should_auto_approve(
        _simple_result(), POLICY)
    assert approved is True
    assert blockers == []


def test_auto_grade_keeps_higher_existing_grade(app, env):
    with app.app_context():
        # Re-query inside this app context: the fixture's object is detached
        # once its nested app context exits.
        submission = AssignmentSubmission.query.get(env["submission"].id)
        submission.grade = 90.0
        db.session.commit()

        ok = auto_grader._apply_grade_to_submission(
            app, submission.id, "assignment", env["student"].id,
            76.11, 100.0, {"overall_feedback": "new AI sample"},
        )
        assert ok is False
        db.session.refresh(submission)
        assert submission.grade == 90.0

        # An explicit human decision may still lower the grade.
        ok = auto_grader._apply_grade_to_submission(
            app, submission.id, "assignment", env["student"].id,
            70.0, 100.0, {"overall_feedback": "instructor correction"},
            allow_lower=True,
        )
        assert ok is True
        db.session.refresh(submission)
        assert submission.grade == 70.0


def test_auto_grader_pipeline_skips_notification_when_grade_is_retained(
        app, env, monkeypatch):
    """A blocked lower grade must not produce a low-score notification."""
    with app.app_context():
        submission = AssignmentSubmission.query.get(env["submission"].id)
        submission.grade = 90.0
        db.session.commit()

    class FakeService:
        def grade_submission(self, *args, **kwargs):
            return {
                "status": "completed",
                "result": {
                    "total_score": 76.11,
                    "max_score": 100.0,
                    "grade_letter": "C",
                    "confidence": "high",
                },
            }

    notified = []
    progressed = []
    monkeypatch.setattr(excel_grading_pkg, "ExcelGradingService", FakeService)
    monkeypatch.setattr(auto_grader, "_auto_approve_grading_result",
                        lambda *a, **k: True)
    monkeypatch.setattr(auto_grader, "_auto_request_modification_if_needed",
                        lambda *a, **k: False)
    monkeypatch.setattr(auto_grader, "_update_learning_progress",
                        lambda *a, **k: progressed.append(a))
    monkeypatch.setattr(auto_grader, "_notify_student_auto_graded",
                        lambda *a, **k: notified.append(a))

    auto_grader._run_grading_in_background(
        app, env["submission"].id, "assignment", env["student"].id)

    with app.app_context():
        db.session.refresh(
            AssignmentSubmission.query.get(env["submission"].id))
        assert AssignmentSubmission.query.get(env["submission"].id).grade == 90.0
    assert notified == []
    assert progressed == []


def test_unchanged_content_blocks_second_automatic_publication(app, env):
    with app.app_context():
        job_one = GradingJob(
            submission_type="assignment",
            submission_id=env["submission"].id,
            job_type="grade_submission",
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            status="succeeded",
        )
        job_two = GradingJob(
            submission_type="assignment",
            submission_id=env["submission"].id,
            job_type="grade_submission",
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            status="succeeded",
        )
        db.session.add_all([job_one, job_two])
        db.session.flush()

        for job in (job_one, job_two):
            db.session.add(SubmissionArtifact(
                job_id=job.id,
                submission_type="assignment",
                submission_id=env["submission"].id,
                file_name="answer.txt",
                relative_path="answer.txt",
                checksum_sha256="same-file-checksum",
            ))
        db.session.flush()

        published = EvaluationResult(
            job_id=job_one.id,
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=90,
            total_possible=100,
            final_score=90,
            confidence=80,
            status="published",
            is_official=True,
            published_at=now_local(),
        )
        regrade = EvaluationResult(
            job_id=job_two.id,
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=76,
            total_possible=100,
            final_score=76,
            confidence=80,
            status="draft",
            is_official=False,
        )
        db.session.add_all([published, regrade])
        db.session.commit()

        assert persistence._unchanged_content_publication_blocker(regrade) == (
            "already_published_for_unchanged_submission")

        # Simulate a genuine resubmission: different checksum for the new job.
        artifact = (SubmissionArtifact.query
                    .filter_by(job_id=job_two.id).first())
        artifact.checksum_sha256 = "new-file-checksum"
        db.session.commit()
        assert persistence._unchanged_content_publication_blocker(regrade) is None


def test_student_result_prefers_published_over_later_draft(app, client, env):
    with app.app_context():
        published = EvaluationResult(
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=90,
            total_possible=100,
            final_score=90,
            confidence=80,
            status="published",
            is_official=True,
            published_at=now_local(),
        )
        draft = EvaluationResult(
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=40,
            total_possible=100,
            final_score=40,
            confidence=60,
            status="pending_review",
            is_official=False,
        )
        db.session.add_all([published, draft])
        db.session.commit()

    response = client.get(
        f"/api/v1/aage/student/results/{env['submission'].id}?submission_type=assignment",
        headers=_auth(app, env["student"]),
    )
    assert response.status_code == 200
    assert response.get_json()["data"]["final_score"] == 90


def test_unified_status_keeps_published_result_visible(app, client, env):
    with app.app_context():
        published = EvaluationResult(
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=90,
            total_possible=100,
            final_score=90,
            confidence=80,
            status="published",
            is_official=True,
            published_at=now_local(),
        )
        draft = EvaluationResult(
            submission_type="assignment",
            submission_id=env["submission"].id,
            assessment_kind="assignment",
            assessment_id=env["assignment"].id,
            course_id=env["course"].id,
            student_id=env["student"].id,
            total_awarded=40,
            total_possible=100,
            final_score=40,
            confidence=60,
            status="draft",
            is_official=False,
        )
        db.session.add_all([published, draft])
        db.session.commit()
        published_id, draft_id = published.id, draft.id

    response = client.get(
        f"/api/v1/aage/grading/unified/status/assignment/{env['submission'].id}",
        headers=_auth(app, env["instructor"]),
    )
    assert response.status_code == 200
    data = response.get_json()["data"]
    assert data["aage_result"]["id"] == draft_id
    assert data["official_aage_result"]["id"] == published_id


def test_student_excel_endpoints_hide_preliminary_results(app, client, env):
    with app.app_context():
        result = ExcelGradingResult(
            student_id=env["student"].id,
            course_id=env["course"].id,
            submission_type="assignment",
            assignment_submission_id=env["submission"].id,
            total_score=40,
            max_score=100,
            grade_letter="F",
            status="completed",
            instructor_reviewed=False,
            manual_review_required=True,
            instructor_notes="Preliminary AI assessment — instructor review required",
            graded_at=now_local(),
        )
        db.session.add(result)
        db.session.commit()
        result_id = result.id

    headers = _auth(app, env["student"])
    response = client.get(
        f"/api/v1/excel-grading/my-results/{env['submission'].id}"
        "?submission_type=assignment",
        headers=headers,
    )
    assert response.status_code == 404
    listed = client.get("/api/v1/excel-grading/my-results", headers=headers)
    assert listed.get_json()["total"] == 0

    with app.app_context():
        result = ExcelGradingResult.query.get(result_id)
        result.instructor_reviewed = True
        result.manual_review_required = False
        db.session.commit()

    response = client.get(
        f"/api/v1/excel-grading/my-results/{env['submission'].id}"
        "?submission_type=assignment",
        headers=headers,
    )
    assert response.status_code == 200
    assert response.get_json()["total_score"] == 40
    listed = client.get("/api/v1/excel-grading/my-results", headers=headers)
    assert listed.get_json()["total"] == 1
