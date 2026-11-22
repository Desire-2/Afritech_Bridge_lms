"""Flask test-client coverage for the AAGE HTTP API.

The suite is fully offline: rubric generation falls back to deterministic
templates and legacy publication is monkeypatched.  It focuses on the contract
( envelopes, permissions, validation, pagination, idempotency ) and on the
deterministic re-scoring guarantee in the review workflow.
"""

import hashlib
import json
import uuid

import pytest
from flask_jwt_extended import create_access_token

from src.models.aage_models import (
    CalibrationRun,
    CriterionScore,
    EvaluationEvidence,
    EvaluationResult,
    EvaluationRun,
    EvaluatorVersion,
    GradingAuditLog,
    GradingJob,
    GradingReview,
    LearningExample,
)
from src.models.course_models import Assignment, AssignmentSubmission, Course
from src.models.grading_models import Rubric, RubricCriterion
from src.models.user_models import Role, User, db
from src.services.aage.submission_dispatch import enqueue_for_submission


@pytest.fixture(autouse=True)
def offline_generation(monkeypatch):
    """Never call a live model from the API tests."""
    from src.services.aage import rubric_intelligence as ri
    monkeypatch.setattr(
        ri.RubricIntelligence, "_payload_from_llm",
        lambda self, descriptor, classification: None)


def _user(name, tag):
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    user = User(
        username=f"aage_api_{name}_{tag}",
        email=f"aage_api_{name}_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=role.id,
    )
    db.session.add(user)
    db.session.flush()
    return user


def _auth(app, user):
    with app.app_context():
        token = create_access_token(identity=str(user.id))
    return {"Authorization": f"Bearer {token}"}


def _make_result(env, *, score=50.0, confidence=100.0, requires_review=True,
                 rubric_id=None):
    job = GradingJob(
        submission_type="assignment", submission_id=env["submission"].id,
        assessment_kind="assignment", assessment_id=env["assignment"].id,
        course_id=env["course"].id, student_id=env["student"].id,
        status="succeeded", requested_by=env["instructor"].id,
    )
    db.session.add(job)
    db.session.flush()
    run = EvaluationRun(job_id=job.id, status="succeeded")
    db.session.add(run)
    db.session.flush()
    result = EvaluationResult(
        run_id=run.id, job_id=job.id,
        submission_type="assignment", submission_id=env["submission"].id,
        assessment_kind="assignment", assessment_id=env["assignment"].id,
        course_id=env["course"].id, student_id=env["student"].id,
        rubric_id=rubric_id,
        rubric_snapshot={
            "status": "approved", "weight_total": 100.0,
            "criteria": [
                {"criterion_key": "c1", "name": "Correctness",
                 "max_marks": 50, "weight": 50, "order_index": 0},
                {"criterion_key": "c2", "name": "Quality",
                 "max_marks": 50, "weight": 50, "order_index": 1},
            ],
        },
        total_awarded=score, total_possible=100.0, final_score=score,
        grade_letter="F", points_awarded=score,
        confidence=confidence, requires_review=requires_review,
        status="pending_review" if requires_review else "draft",
        feedback="Automated assessment", ai_provider="stub",
        evaluator_versions=[{"name": "backend", "version": "1.0.0"}],
    )
    db.session.add(result)
    db.session.flush()
    for idx, (key, awarded) in enumerate((("c1", score / 2), ("c2", score / 2))):
        crit = CriterionScore(
            result_id=result.id, criterion_key=key, name=key,
            awarded=awarded, maximum=50.0, weight=50.0,
            weighted_score=awarded, rationale="static inspection",
            evidence_category="CODE_SUPPORTED", verification_status="partial",
            evaluator_name="backend", evaluator_version="1.0.0",
            order_index=idx,
        )
        db.session.add(crit)
        db.session.flush()
        db.session.add(EvaluationEvidence(
            result_id=result.id, criterion_score_id=crit.id,
            criterion_key=key, category="CODE_SUPPORTED",
            source="static_analysis", reference="main.py",
            summary="Source file inspected"))
    review = GradingReview(
        result_id=result.id, status="pending", ai_score=score,
        assigned_to=env["instructor"].id,
    )
    db.session.add(review)
    db.session.flush()
    return {"job": job, "run": run, "result": result, "review": review}


@pytest.fixture()
def env(app):
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]
        instructor = _user("instructor", tag)
        other = _user("instructor", tag + "o")
        student = _user("student", tag)
        other_student = _user("student", tag + "s")
        admin = _user("admin", tag)

        course = Course(
            title=f"AAGE API Course {tag}", description="api tests",
            instructor_id=instructor.id, is_published=True)
        other_course = Course(
            title=f"AAGE API Other Course {tag}", description="api tests",
            instructor_id=other.id, is_published=True)
        db.session.add_all([course, other_course])
        db.session.flush()

        assignment = Assignment(
            title="Build a REST API", description="Implement GET /items with tests",
            instructor_id=instructor.id, course_id=course.id,
            points_possible=100, passing_score=70, is_published=True)
        db.session.add(assignment)
        db.session.flush()

        submission = AssignmentSubmission(
            assignment_id=assignment.id, student_id=student.id,
            content="See main.py and test_items.py",
            file_url=json.dumps([{"filename": "main.py", "url": "memory://main.py"}]))
        db.session.add(submission)
        db.session.flush()

        rubric = Rubric(
            title="API rubric", instructor_id=instructor.id,
            course_id=course.id, total_points=100, status="draft",
            version=1, assessment_kind="assignment", assessment_id=assignment.id)
        db.session.add(rubric)
        db.session.flush()
        for idx, key in enumerate(("c1", "c2")):
            db.session.add(RubricCriterion(
                rubric_id=rubric.id, name=key, max_points=50,
                order_index=idx, weight=50, criterion_key=key))
        db.session.commit()

        data = {
            "instructor": instructor, "other": other,
            "student": student, "other_student": other_student,
            "admin": admin, "course": course, "other_course": other_course,
            "assignment": assignment, "submission": submission, "rubric": rubric,
        }
        data.update(_make_result(data))
        db.session.commit()
        for key in ("instructor", "other", "student", "other_student", "admin",
                    "course", "other_course", "assignment", "submission",
                    "rubric", "job", "result", "review"):
            db.session.refresh(data[key])
        return data


# ---------------------------------------------------------------------------
# Envelope, authentication and permissions
# ---------------------------------------------------------------------------

def test_unauthenticated_request_uses_error_envelope(client):
    resp = client.get("/api/v1/aage/learning/insights")
    assert resp.status_code == 401
    body = resp.get_json()
    assert body["success"] is False
    assert body["error"]["code"] == "unauthorized"


def test_student_cannot_start_grading_approve_rubric_or_publish(app, client, env):
    student = _auth(app, env["student"])
    assert client.post("/api/v1/aage/grading/start", json={
        "submission_type": "assignment",
        "submission_id": env["submission"].id,
    }, headers=student).status_code == 403
    assert client.post(
        f"/api/v1/aage/rubrics/{env['rubric'].id}/approve",
        headers=student).status_code == 403
    assert client.post(
        f"/api/v1/aage/grading/results/{env['result'].id}/publish",
        headers=student).status_code == 403


def test_instructor_cannot_access_another_instructors_course(app, client, env):
    headers = _auth(app, env["other"])
    resp = client.post(
        f"/api/v1/aage/assessments/assignment/{env['assignment'].id}/analyze",
        headers=headers)
    assert resp.status_code == 403
    assert resp.get_json()["error"]["code"] == "forbidden"
    assert client.get(
        f"/api/v1/aage/grading/results/{env['result'].id}",
        headers=headers).status_code == 403
    assert client.get(
        f"/api/v1/aage/reviews/{env['review'].id}",
        headers=headers).status_code == 403


def test_student_can_read_only_own_result_and_evidence(app, client, env):
    own = _auth(app, env["student"])
    other = _auth(app, env["other_student"])

    result_url = f"/api/v1/aage/grading/results/{env['result'].id}"
    evidence_url = f"/api/v1/aage/grading/results/{env['result'].id}/evidence"
    own_result = client.get(result_url, headers=own)
    assert own_result.status_code == 200
    assert own_result.get_json()["success"] is True
    assert own_result.get_json()["data"]["id"] == env["result"].id

    assert client.get(evidence_url, headers=own).status_code == 200
    assert client.get(result_url, headers=other).status_code == 403
    assert client.get(evidence_url, headers=other).status_code == 403


def test_invalid_payloads_return_400(app, client, env):
    instructor = _auth(app, env["instructor"])
    admin = _auth(app, env["admin"])
    invalid = [
        client.post("/api/v1/aage/grading/start", json={}, headers=instructor),
        client.post("/api/v1/aage/grading/start", json={
            "submission_type": "quiz", "submission_id": 1}, headers=instructor),
        client.put(f"/api/v1/aage/reviews/{env['review'].id}/criteria/c1",
                   json={"marks": "abc", "reason": "why"}, headers=instructor),
        client.put(f"/api/v1/aage/reviews/{env['review'].id}/criteria/c1",
                   json={"marks": 40}, headers=instructor),
        client.post(f"/api/v1/aage/reviews/{env['review'].id}/reject",
                    json={}, headers=instructor),
        client.put("/api/v1/aage/admin/policies",
                   json={"auto_publish_min": 250}, headers=admin),
    ]
    for resp in invalid:
        assert resp.status_code == 400, resp.get_data(as_text=True)
        assert resp.get_json()["error"]["code"] == "invalid_payload"


# ---------------------------------------------------------------------------
# Jobs, pagination, rubrics
# ---------------------------------------------------------------------------

def test_pagination_and_duplicate_job_enqueue_is_idempotent(app, client, env):
    with app.app_context():
        for _ in range(2):
            _make_result(env)
        db.session.commit()

    instructor = _auth(app, env["instructor"])
    first = client.get("/api/v1/aage/reviews/pending?per_page=1&page=1",
                       headers=instructor)
    assert first.status_code == 200
    assert len(first.get_json()["data"]) == 1
    assert first.get_json()["meta"]["total"] >= 3
    assert first.get_json()["meta"]["per_page"] == 1

    second = client.get("/api/v1/aage/reviews/pending?per_page=1&page=2",
                        headers=instructor)
    assert second.status_code == 200
    assert second.get_json()["data"][0]["id"] != first.get_json()["data"][0]["id"]

    payload = {"submission_type": "assignment",
               "submission_id": env["submission"].id}
    created = client.post("/api/v1/aage/grading/start", json=payload,
                          headers=instructor)
    assert created.status_code == 201
    job_id = created.get_json()["data"]["id"]
    again = client.post("/api/v1/aage/grading/start", json=payload,
                        headers=instructor)
    assert again.status_code == 200
    assert again.get_json()["data"]["id"] == job_id
    assert again.get_json()["meta"]["deduplicated"] is True


def test_rubric_endpoints_and_graded_lock(app, client, env):
    instructor = _auth(app, env["instructor"])
    generated = client.post(
        f"/api/v1/aage/assessments/assignment/{env['assignment'].id}/rubric/generate",
        json={"use_llm": False}, headers=instructor)
    assert generated.status_code == 201, generated.get_data(as_text=True)
    rubric_id = generated.get_json()["data"]["id"]
    assert generated.get_json()["data"]["status"] == "draft"

    listing = client.get(
        f"/api/v1/aage/assessments/assignment/{env['assignment'].id}/rubric",
        headers=instructor)
    assert listing.status_code == 200
    assert listing.get_json()["data"]["rubric"]["id"] == rubric_id

    approved = client.post(f"/api/v1/aage/rubrics/{rubric_id}/approve",
                           headers=instructor)
    assert approved.status_code == 200, approved.get_data(as_text=True)
    assert approved.get_json()["data"]["status"] == "approved"
    versions = client.get(
        f"/api/v1/aage/assessments/assignment/{env['assignment'].id}/rubric/versions",
        headers=instructor)
    assert versions.status_code == 200
    assert versions.get_json()["data"]

    with app.app_context():
        stored = EvaluationResult.query.get(env["result"].id)
        stored.rubric_id = rubric_id
        db.session.commit()

    locked = client.put(f"/api/v1/aage/rubrics/{rubric_id}",
                        json={"title": "Changed"}, headers=instructor)
    assert locked.status_code == 409
    assert locked.get_json()["error"]["code"] == "rubric_graded_locked"

    unlocked = client.put(f"/api/v1/aage/rubrics/{rubric_id}",
                          json={"title": "Changed", "acknowledge_graded": True},
                          headers=instructor)
    assert unlocked.status_code == 200


# ---------------------------------------------------------------------------
# Review workflow + deterministic re-scoring
# ---------------------------------------------------------------------------

def test_review_marks_rescore_and_correction_creates_learning_example(
        app, client, env, monkeypatch):
    from src.services.aage import persistence

    monkeypatch.setattr(persistence, "write_through_grade",
                        lambda result, **kwargs: True)

    instructor = _auth(app, env["instructor"])
    review_id = env["review"].id
    changed = client.put(
        f"/api/v1/aage/reviews/{review_id}/criteria/c1",
        json={"marks": 50, "reason": "evidence supports full marks"},
        headers=instructor)
    assert changed.status_code == 200, changed.get_data(as_text=True)
    assert changed.get_json()["data"]["result"]["final_score"] == 75.0
    with app.app_context():
        result = EvaluationResult.query.get(env["result"].id)
        assert result.final_score == 75.0
        assert AssignmentSubmission.query.get(env["submission"].id).grade is None
        assert GradingAuditLog.query.filter_by(
            action="review_mark_updated", entity_id=review_id).count() == 1

    correction = client.post(
        f"/api/v1/aage/reviews/{review_id}/correction",
        json={"explanation": "The submission satisfies the full criterion."},
        headers=instructor)
    assert correction.status_code == 200, correction.get_data(as_text=True)
    example = correction.get_json()["data"]["learning_example"]
    assert example["status"] == "candidate"
    assert example["original_scores"]["c1"] == 25.0
    assert example["instructor_scores"]["c1"] == 50.0
    assert example["evaluator_name"] == "backend"
    assert example["tags"]["evidence"], "evidence must travel with the example"

    approved = client.post(f"/api/v1/aage/reviews/{review_id}/approve",
                           headers=instructor)
    assert approved.status_code == 200
    assert approved.get_json()["data"]["published"] is True
    with app.app_context():
        assert GradingAuditLog.query.filter_by(
            action="review_approved", entity_id=review_id).count() == 1


def test_publish_requires_approval_and_passes_policy(app, client, env, monkeypatch):
    from src.services.aage import persistence

    instructor = _auth(app, env["instructor"])
    url = f"/api/v1/aage/grading/results/{env['result'].id}/publish"
    blocked = client.post(url, headers=instructor)
    assert blocked.status_code == 409
    assert blocked.get_json()["error"]["code"] == "review_required"

    with app.app_context():
        stored_review = GradingReview.query.get(env["review"].id)
        stored_result = EvaluationResult.query.get(env["result"].id)
        stored_review.status = "approved"
        stored_result.requires_review = False
        stored_result.confidence = 10.0
        db.session.commit()

    policy_blocked = client.post(url, headers=instructor)
    assert policy_blocked.status_code == 409
    assert policy_blocked.get_json()["error"]["code"] == "policy_blocked"

    with app.app_context():
        stored_result = EvaluationResult.query.get(env["result"].id)
        stored_result.confidence = 100.0
        db.session.commit()
    monkeypatch.setattr(persistence, "write_through_grade",
                        lambda result, **kwargs: True)
    published = client.post(url, headers=instructor)
    assert published.status_code == 200
    assert published.get_json()["data"]["is_official"] is True


# ---------------------------------------------------------------------------
# Learning / admin
# ---------------------------------------------------------------------------

def test_grading_jobs_and_results_lists_are_paginated_and_scoped(app, client, env):
    with app.app_context():
        failed = GradingJob(
            submission_type="assignment", submission_id=env["submission"].id,
            assessment_kind="assignment", assessment_id=env["assignment"].id,
            course_id=env["course"].id, student_id=env["student"].id,
            status="failed", evaluators=["backend"], requested_by=env["instructor"].id,
        )
        db.session.add(failed)
        db.session.commit()
        failed_id = failed.id

    instructor = _auth(app, env["instructor"])
    jobs = client.get("/api/v1/aage/grading/jobs?per_page=1&page=1",
                      headers=instructor)
    assert jobs.status_code == 200
    body = jobs.get_json()
    assert body["success"] is True
    assert len(body["data"]) == 1
    assert body["meta"]["per_page"] == 1
    assert body["meta"]["total"] >= 2
    assert body["meta"]["pages"] >= 2

    filtered = client.get(
        "/api/v1/aage/grading/jobs",
        query_string={"status": "failed", "submission_type": "assignment",
                      "evaluator": "backend"},
        headers=instructor)
    assert filtered.status_code == 200
    assert [j["id"] for j in filtered.get_json()["data"]] == [failed_id]

    bad_status = client.get("/api/v1/aage/grading/jobs?status=nonsense",
                            headers=instructor)
    assert bad_status.status_code == 400
    assert bad_status.get_json()["error"]["code"] == "invalid_payload"

    results = client.get("/api/v1/aage/grading/results?per_page=10",
                         headers=instructor)
    assert results.status_code == 200
    result_body = results.get_json()
    assert result_body["success"] is True
    assert any(r["id"] == env["result"].id for r in result_body["data"])
    assert "criteria" not in result_body["data"][0]

    high = client.get("/api/v1/aage/grading/results",
                      query_string={"confidence": "high",
                                    "requires_review": "true"},
                      headers=instructor)
    assert high.status_code == 200
    assert any(r["id"] == env["result"].id for r in high.get_json()["data"])

    assert client.get("/api/v1/aage/grading/jobs",
                      query_string={"course_id": env["course"].id},
                      headers=_auth(app, env["other"])).status_code == 403

    student = _auth(app, env["student"])
    own_results = client.get("/api/v1/aage/grading/results", headers=student)
    assert own_results.status_code == 200
    assert all(r["student_id"] == env["student"].id
               for r in own_results.get_json()["data"])
    assert client.get("/api/v1/aage/grading/results",
                      headers=_auth(app, env["other_student"])
                      ).get_json()["meta"]["total"] == 0


def test_student_published_result_is_own_and_whitelisted(app, client, env):
    student = _auth(app, env["student"])
    url = f"/api/v1/aage/student/results/{env['submission'].id}"
    hidden = client.get(url, query_string={"submission_type": "assignment"},
                        headers=student)
    assert hidden.status_code == 404, hidden.get_data(as_text=True)

    with app.app_context():
        from src.utils.time_utils import now_local
        result = EvaluationResult.query.get(env["result"].id)
        result.is_official = True
        result.status = "published"
        result.published_at = now_local()
        db.session.commit()

    published = client.get(url, query_string={"submission_type": "assignment"},
                           headers=student)
    assert published.status_code == 200, published.get_data(as_text=True)
    data = published.get_json()["data"]
    assert data["final_score"] == env["result"].final_score
    assert data["assessment_title"] == env["assignment"].title
    assert data["criteria"]
    for forbidden in ("rubric_snapshot", "evidence", "evaluator_versions",
                      "ai_provider", "confidence_factors"):
        assert forbidden not in data

    assert client.get(url, headers=_auth(app, env["other_student"])
                      ).status_code == 404
    assert client.get(url, headers=_auth(app, env["instructor"])
                      ).status_code == 403


def test_auto_publish_honours_flag_and_threshold_but_explicit_approval_does_not(
        app, client, env, monkeypatch):
    from src.services.aage import jobs as aage_jobs, persistence, policies

    writes = []
    monkeypatch.setattr(persistence, "write_through_grade",
                        lambda result, **kwargs: writes.append(result.id) or True)

    # Explicit instructor approval publishes even with auto-publish disabled.
    monkeypatch.setattr(policies, "confidence_policy", lambda: {
        "auto_publish_enabled": False, "auto_publish_min": 90.0,
        "provisional_min": 75.0, "require_all_gates": True,
    })
    approved = client.post(
        f"/api/v1/aage/reviews/{env['review'].id}/approve",
        headers=_auth(app, env["instructor"]))
    assert approved.status_code == 200, approved.get_data(as_text=True)
    assert approved.get_json()["data"]["published"] is True
    assert writes == [env["result"].id]

    # Automatic publication: disabled flag blocks it, the threshold gates it.
    with app.app_context():
        result = EvaluationResult.query.get(env["result"].id)
        result.is_official = False
        result.requires_review = False
        db.session.commit()
    from types import SimpleNamespace
    job = SimpleNamespace(id=env["job"].id, requested_by=env["instructor"].id)
    writes.clear()

    aage_jobs._maybe_auto_publish(
        job, SimpleNamespace(ok=True, requires_review=False,
                             result_id=env["result"].id, confidence=99.0,
                             final_score=99.0))
    assert writes == []

    monkeypatch.setattr(policies, "confidence_policy", lambda: {
        "auto_publish_enabled": True, "auto_publish_min": 90.0,
        "provisional_min": 75.0, "require_all_gates": True,
    })
    aage_jobs._maybe_auto_publish(
        job, SimpleNamespace(ok=True, requires_review=False,
                             result_id=env["result"].id, confidence=80.0,
                             final_score=80.0))
    assert writes == []

    aage_jobs._maybe_auto_publish(
        job, SimpleNamespace(ok=True, requires_review=False,
                             result_id=env["result"].id, confidence=95.0,
                             final_score=95.0))
    assert writes == [env["result"].id]


def test_admin_policy_rejects_crossed_thresholds(app, client, env):
    admin = _auth(app, env["admin"])
    resp = client.put("/api/v1/aage/admin/policies", json={
        "auto_publish_min": 50, "provisional_min": 75,
    }, headers=admin)
    assert resp.status_code == 400
    assert resp.get_json()["error"]["code"] == "invalid_payload"


def test_calibration_reports_insufficient_data_and_admin_controls(app, client, env):
    with app.app_context():
        candidate = EvaluatorVersion(
            name="backend", version="candidate-1", status="candidate",
            created_by=env["admin"].id)
        db.session.add(candidate)
        db.session.commit()
        candidate_id = candidate.id

    admin = _auth(app, env["admin"])
    run = client.post("/api/v1/aage/learning/calibration/start", json={
        "evaluator_name": "backend", "candidate_version_id": candidate_id,
    }, headers=admin)
    assert run.status_code == 201, run.get_data(as_text=True)
    data = run.get_json()["data"]
    assert data["status"] == "insufficient_data"
    assert data["metrics"]["available_cases"] == 0
    assert "mae" not in data["metrics"], "no metrics without benchmark data"

    detail = client.get(f"/api/v1/aage/learning/calibration/{data['id']}",
                        headers=_auth(app, env["instructor"]))
    assert detail.status_code == 200
    assert detail.get_json()["data"]["cases"] == []

    examples = client.get("/api/v1/aage/learning/examples?status=approved",
                          headers=_auth(app, env["instructor"]))
    assert examples.status_code == 200
    assert examples.get_json()["data"] == []

    policy = client.get("/api/v1/aage/admin/policies", headers=admin)
    assert policy.status_code == 200
    updated = client.put("/api/v1/aage/admin/policies", json={
        "auto_publish_min": 92.0, "auto_publish_enabled": False,
    }, headers=admin)
    assert updated.status_code == 200
    assert updated.get_json()["data"]["auto_publish_min"] == 92.0

    toggled = client.patch("/api/v1/aage/admin/evaluators/backend",
                           json={"active": True}, headers=admin)
    assert toggled.status_code == 200
    assert toggled.get_json()["data"]["active"] is True
    catalog = client.get("/api/v1/aage/admin/evaluators", headers=admin)
    assert catalog.status_code == 200
    assert any(row["name"] == "backend" and row["active"]
               for row in catalog.get_json()["data"])

    analytics = client.get("/api/v1/aage/admin/analytics",
                           query_string={"course_id": env["course"].id},
                           headers=admin)
    assert analytics.status_code == 200
    assert analytics.get_json()["data"]["course_id"] == env["course"].id
    assert analytics.get_json()["data"]["pending_reviews"] >= 1


def test_instructor_analytics_is_course_scoped(client, app, env):
    instructor = _auth(app, env["instructor"])
    student = _auth(app, env["student"])
    admin = _auth(app, env["admin"])

    missing = client.get("/api/v1/aage/analytics", headers=instructor)
    assert missing.status_code == 400
    assert missing.get_json()["error"]["code"] == "course_id_required"

    foreign = client.get(
        "/api/v1/aage/analytics",
        query_string={"course_id": env["other_course"].id}, headers=instructor)
    assert foreign.status_code == 403

    denied = client.get(
        "/api/v1/aage/analytics",
        query_string={"course_id": env["course"].id}, headers=student)
    assert denied.status_code == 403

    own = client.get(
        "/api/v1/aage/analytics",
        query_string={"course_id": env["course"].id}, headers=instructor)
    assert own.status_code == 200
    assert own.get_json()["data"]["course_id"] == env["course"].id
    assert own.get_json()["data"]["pending_reviews"] >= 1

    platform = client.get("/api/v1/aage/analytics", headers=admin)
    assert platform.status_code == 200
    assert platform.get_json()["data"]["course_id"] is None


# ---------------------------------------------------------------------------
# Automatic submission dispatch + student-safe grading status
# ---------------------------------------------------------------------------

def test_auto_dispatch_queues_aage_job_and_deduplicates(app, client, env):
    student = _auth(app, env["student"])
    before = GradingJob.query.count()

    job = enqueue_for_submission(
        submission_type="assignment",
        submission_id=env["submission"].id,
        student_id=env["student"].id,
    )
    assert job is not None
    assert job.submission_type == "assignment"
    assert job.submission_id == env["submission"].id
    assert job.student_id == env["student"].id
    assert job.requested_by == env["student"].id
    assert GradingJob.query.count() == before + 1

    # A second call while the job is active must not create another queue row.
    duplicate = enqueue_for_submission(
        submission_type="assignment",
        submission_id=env["submission"].id,
        student_id=env["student"].id,
    )
    assert duplicate is not None
    assert duplicate.id == job.id
    assert GradingJob.query.count() == before + 1

    status = client.get(
        f"/api/v1/aage/student/grading-status/{env['submission'].id}",
        query_string={"submission_type": "assignment"}, headers=student)
    assert status.status_code == 200
    body = status.get_json()["data"]
    assert body["has_job"] is True
    assert body["submission_type"] == "assignment"
    assert body["engine"] == "aage"
    assert body["status"] in ("queued", "running", "succeeded")


def test_grading_status_reports_aage_for_spreadsheet_submissions(app, client, env):
    course = Course(
        title=f"MS Excel Basics {uuid.uuid4().hex[:6]}", description="spreadsheets",
        instructor_id=env["instructor"].id, is_published=True)
    db.session.add(course)
    db.session.flush()
    assignment = Assignment(
        title="Workbook", description="Submit the workbook",
        instructor_id=env["instructor"].id, course_id=course.id,
        points_possible=100, is_published=True)
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        assignment_id=assignment.id, student_id=env["student"].id,
        file_url=json.dumps([{"filename": "report.xlsx", "url": "memory://report.xlsx"}]))
    db.session.add(submission)
    db.session.commit()

    response = client.get(
        f"/api/v1/aage/student/grading-status/{submission.id}",
        query_string={"submission_type": "assignment"},
        headers=_auth(app, env["student"]))
    assert response.status_code == 200
    body = response.get_json()["data"]
    assert body["has_job"] is False
    assert body["engine"] == "aage"
    assert body["specialist"] == "spreadsheet"


def test_auto_dispatch_ignores_legacy_excel_trigger_flag(env):
    before = GradingJob.query.count()
    job = enqueue_for_submission(
        submission_type="assignment",
        submission_id=env["submission"].id,
        student_id=env["student"].id,
        excel_grading_triggered=True,
    )
    assert job is not None
    assert job.submission_type == "assignment"
    assert GradingJob.query.count() == before + 1


def test_auto_dispatch_never_breaks_the_submission(monkeypatch, env):
    from src.services.aage import submission_dispatch

    def explode(**_kwargs):
        raise RuntimeError("queue unavailable")

    monkeypatch.setattr(submission_dispatch.jobs, "enqueue_grade_job", explode)
    assert enqueue_for_submission(
        submission_type="project",
        submission_id=env["submission"].id,
        student_id=env["student"].id,
    ) is None


def test_student_grading_status_is_scoped_to_own_submissions(app, client, env):
    other = _auth(app, env["other_student"])
    response = client.get(
        f"/api/v1/aage/student/grading-status/{env['submission'].id}",
        headers=other)
    assert response.status_code == 200
    assert response.get_json()["data"]["has_job"] is False

    instructor = _auth(app, env["instructor"])
    assert client.get(
        f"/api/v1/aage/student/grading-status/{env['submission'].id}",
        headers=instructor).status_code == 403

    invalid = client.get(
        f"/api/v1/aage/student/grading-status/{env['submission'].id}",
        query_string={"submission_type": "quiz"},
        headers=_auth(app, env["student"]))
    assert invalid.status_code == 400
