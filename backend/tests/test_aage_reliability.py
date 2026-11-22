"""Focused regressions for the AAGE reliability/security hardening.

These tests avoid live providers and assert *measured* facts only: no invented
grades, token counts or dollar costs.
"""

from __future__ import annotations

import hashlib
import json
import re
import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.aage_models import (
    EvaluationResult,
    EvaluationRun,
    GradingAuditLog,
    GradingJob,
)
from src.models.course_models import Assignment, AssignmentSubmission, Course
from src.models.system_settings_models import SystemSettingsManager
from src.models.user_models import Role, User, db
from src.services.aage import jobs, llm, orchestrator, persistence, policies
from src.services.aage.constants import JOB_CANCELLED, JOB_QUEUED


# ---------------------------------------------------------------------------
# Helpers / fixtures
# ---------------------------------------------------------------------------

def _make_user(name: str, tag: str) -> int:
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    user = User(
        username=f"aage_rel_{name}_{tag}",
        email=f"aage_rel_{name}_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=role.id,
    )
    db.session.add(user)
    db.session.flush()
    return user.id


@pytest.fixture()
def env(app):
    """Create a small isolated course and return plain ids (no ORM leakage)."""
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]
        instructor_id = _make_user("instructor", tag)
        other_id = _make_user("instructor", tag + "other")
        student_id = _make_user("student", tag)

        course = Course(
            title=f"AAGE reliability course {tag}",
            description="course ownership test",
            instructor_id=instructor_id,
            is_published=True,
        )
        other_course = Course(
            title=f"AAGE reliability other course {tag}",
            description="not owned by the test instructor",
            instructor_id=other_id,
            is_published=True,
        )
        db.session.add_all([course, other_course])
        db.session.flush()

        assignment = Assignment(
            title="Build a REST API",
            description="Implement GET /items with tests",
            instructor_id=instructor_id,
            course_id=course.id,
            points_possible=100,
            passing_score=70,
            is_published=True,
        )
        db.session.add(assignment)
        db.session.flush()

        submission = AssignmentSubmission(
            assignment_id=assignment.id,
            student_id=student_id,
            content="See main.py and test_items.py",
            file_url=json.dumps([
                {"filename": "main.py", "url": "memory://main.py"},
            ]),
        )
        db.session.add(submission)
        db.session.commit()
        return {
            "instructor_id": instructor_id,
            "other_id": other_id,
            "student_id": student_id,
            "course_id": course.id,
            "other_course_id": other_course.id,
            "assignment_id": assignment.id,
            "submission_id": submission.id,
        }


def _auth(app, user_id: int) -> dict:
    with app.app_context():
        token = create_access_token(identity=str(user_id))
    return {"Authorization": f"Bearer {token}"}


def _make_job_and_result(env, *, status="draft", requires_review=False,
                         confidence=100.0):
    job = GradingJob(
        submission_type="assignment",
        submission_id=env["submission_id"],
        assessment_kind="assignment",
        assessment_id=env["assignment_id"],
        course_id=env["course_id"],
        student_id=env["student_id"],
        status=JOB_QUEUED,
        requested_by=env["instructor_id"],
    )
    db.session.add(job)
    db.session.flush()
    run = EvaluationRun(job_id=job.id, status="succeeded")
    db.session.add(run)
    db.session.flush()
    result = EvaluationResult(
        run_id=run.id,
        job_id=job.id,
        submission_type="assignment",
        submission_id=env["submission_id"],
        assessment_kind="assignment",
        assessment_id=env["assignment_id"],
        course_id=env["course_id"],
        student_id=env["student_id"],
        rubric_snapshot={"status": "approved", "criteria": []},
        total_awarded=50.0,
        total_possible=100.0,
        final_score=50.0,
        grade_letter="F",
        confidence=confidence,
        requires_review=requires_review,
        status=status,
        feedback="Automated assessment",
    )
    db.session.add(result)
    db.session.flush()
    return job, run, result


# ---------------------------------------------------------------------------
# 1. Cancellation / publish race
# ---------------------------------------------------------------------------

def test_cancelled_job_produces_no_result(app, env):
    with app.app_context():
        job = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=env["submission_id"],
            requested_by=env["instructor_id"],
        )
        assert job.status == JOB_QUEUED
        jobs.cancel_job(job.id, actor_id=env["instructor_id"],
                        reason="reliability regression")

        outcome = jobs.run_job(job)
        assert outcome["status"] == JOB_CANCELLED
        assert EvaluationResult.query.filter_by(job_id=job.id).count() == 0


# ---------------------------------------------------------------------------
# 2. Retry idempotency preserves audit rows
# ---------------------------------------------------------------------------

def test_retry_supersedes_results_without_deleting_audit_rows(app, env):
    with app.app_context():
        _job, _run, first = _make_job_and_result(env)
        _job2, _run2, second = _make_job_and_result(env)
        before = GradingAuditLog.query.filter_by(
            action="results_superseded").count()

        changed = persistence.supersede_results_for_submission(
            submission_type="assignment",
            submission_id=env["submission_id"],
            actor_id=env["instructor_id"],
            reason="retry regression",
        )

        assert set(changed) == {first.id, second.id}
        assert first.status == "superseded"
        assert second.status == "superseded"
        assert GradingAuditLog.query.filter_by(
            action="results_superseded").count() == before + 1


# ---------------------------------------------------------------------------
# 3. Authoritative hard publish gate
# ---------------------------------------------------------------------------

def test_auto_publication_cannot_bypass_hard_gate(app, env, monkeypatch):
    import src.services.aage.confidence as confidence_module

    with app.app_context():
        _job, _run, result = _make_job_and_result(
            env, status="draft", requires_review=False, confidence=100.0)
        monkeypatch.setattr(policies, "confidence_policy", lambda: {
            "auto_publish_enabled": True,
            "auto_publish_min": 0.0,
            "require_all_gates": True,
            "provisional_min": 75.0,
        })
        monkeypatch.setattr(
            confidence_module, "hard_gate_failures_for_result",
            lambda _result: ["failed_deterministic_gate"])

        assert persistence.write_through_grade(
            result, actor_id=env["instructor_id"], reason="gate regression") is False
        assert result.is_official is False
        assert result.status == "draft"


# ---------------------------------------------------------------------------
# 4. Fail-closed policy persistence
# ---------------------------------------------------------------------------

def test_policy_update_fails_closed_when_storage_fails(app, monkeypatch):
    def _boom(cls, *args, **kwargs):
        raise RuntimeError("settings table unavailable")

    with app.app_context():
        monkeypatch.setattr(SystemSettingsManager, "set_setting", _boom)
        with pytest.raises(policies.PolicyPersistenceError) as exc:
            policies.set_confidence_policy(
                {"auto_publish_min": 91.0}, user_id=1, reason="regression")
        assert exc.value.code == "policy_persistence_failed"


# ---------------------------------------------------------------------------
# 5. Course ownership on learning endpoints
# ---------------------------------------------------------------------------

def test_learning_insights_rejects_foreign_course_id(app, client, env):
    other_headers = _auth(app, env["other_id"])
    resp = client.get(
        f"/api/v1/aage/learning/insights?course_id={env['course_id']}",
        headers=other_headers)
    assert resp.status_code == 403
    assert resp.get_json()["error"]["code"] == "forbidden"


def test_learning_insights_allows_owned_course_id(app, client, env):
    headers = _auth(app, env["instructor_id"])
    resp = client.get(
        f"/api/v1/aage/learning/insights?course_id={env['course_id']}",
        headers=headers)
    assert resp.status_code == 200


# ---------------------------------------------------------------------------
# 6. Honest LLM duration/cost instrumentation
# ---------------------------------------------------------------------------

def _stub_provider(prompt, *, temperature=0.2, max_tokens=6000,
                   prefer_fast=False, **kwargs):
    if "recommended_evaluators" in prompt:
        payload = {
            "title": "Generated API rubric",
            "discipline": "backend",
            "summary": "Evidence-based assessment of a REST API submission.",
            "learning_objectives": ["Design a REST API"],
            "deliverables": ["source code"],
            "technologies": ["Python"],
            "evaluation_methods": ["static source inspection"],
            "criteria": [
                {"key": "api_design", "name": "API design",
                 "description": "Routes are implemented.",
                 "weight": 100, "max_marks": 100, "is_required": True,
                 "evidence_requirements": ["source file"],
                 "evidence_category": "CODE_SUPPORTED",
                 "evaluator_hint": "backend", "levels": []},
            ],
            "recommended_evaluators": ["backend"],
            "unverifiable_requirements": [],
            "notes": "",
        }
        return json.dumps(payload), "unit-stub"
    keys = [k for k in dict.fromkeys(re.findall(
        r'"criterion_key"\s*:\s*"([^"]+)"', prompt)) if k != "criterion_key"]
    payload = {
        "criteria": [{
            "criterion_key": key or "general",
            "marks": 7.0,
            "max_marks": 10.0,
            "rationale": "Static inspection, partial evidence.",
            "evidence_category": "CODE_SUPPORTED",
            "verification_status": "partial",
            "evidence": [{
                "reference": "main.py",
                "summary": "Static inspection of the submitted source.",
                "category": "CODE_SUPPORTED",
                "locator": "main.py",
            }],
            "feedback": "Extend the implementation and add tests.",
            "limitations": "No code was executed.",
            "confidence": 0.7,
        } for key in (keys or ["general"])],
        "overall_feedback": "Partial implementation.",
        "strengths": ["Submission includes source files."],
        "improvements": ["Add deterministic tests."],
        "confidence": 0.7,
    }
    return json.dumps(payload), "unit-stub"


def test_run_records_real_duration_and_honest_cost_json(app, env, monkeypatch):
    monkeypatch.setattr(
        llm.ai_provider_manager, "make_ai_request", _stub_provider)
    with app.app_context():
        job = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=env["submission_id"],
            requested_by=env["instructor_id"],
        )
        outcome = jobs.run_job(job)
        assert outcome["status"] == "succeeded", outcome.get("error")

        run = EvaluationRun.query.filter_by(job_id=job.id).one()
        assert run.duration_ms is not None and run.duration_ms >= 0
        assert run.cost_estimate is None
        assert run.cost is not None
        assert run.cost["provider"] == "unit-stub"
        assert isinstance(run.cost["llm_calls"], int) and run.cost["llm_calls"] > 0
        assert run.cost["prompt_chars"] > 0
        assert run.cost["response_chars"] > 0
        assert run.cost["tokens_in"] is None
        assert run.cost["tokens_out"] is None
        assert run.cost["note"] == "provider did not expose token usage"


def test_usage_accumulator_is_reset_even_when_evaluation_fails(app, env,
                                                              monkeypatch):
    def _fail_load(*args, **kwargs):
        raise persistence.SubmissionNotFound("deliberate failure")

    with app.app_context():
        monkeypatch.setattr(persistence, "load_submission", _fail_load)
        outer_token = llm.start_usage_window(correlation_id="outer")
        try:
            with pytest.raises(persistence.SubmissionNotFound):
                orchestrator.evaluate_submission(
                    "assignment", env["submission_id"], persist=False)
            usage = llm.get_usage()
            assert usage["llm_calls"] == 0
            assert usage["tokens_in"] is None
            assert usage["cost_estimate"] is None
        finally:
            llm.reset_usage_window(outer_token)
