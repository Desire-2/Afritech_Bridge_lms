"""End-to-end tests for the AAGE evaluation pipeline.

Covers Milestone 3 (orchestrator + persistence) and Milestone 4 (job state
machine): a submission goes in, an authoritative ``evaluation_results`` row
comes out, and the legacy ``submission.grade`` is untouched until an explicit
publish.
"""

import json
import re
import uuid

import pytest

from src.models.aage_models import (
    CriterionScore,
    EvaluationEvidence,
    EvaluationResult,
    EvaluationRun,
    GradingJob,
    GradingReview,
)
from src.services.aage import jobs, orchestrator
from src.services.aage.constants import JOB_SUCCEEDED, JOB_QUEUED
from src.services.aage.orchestrator import (
    EvaluationError,
    _criteria_from_snapshot,
    _merge_outputs,
)
from src.services.aage.evaluators.base import CriterionEvaluation, EvaluatorOutput


@pytest.fixture(autouse=True)
def stub_ai_provider(monkeypatch):
    """Deterministic, offline model responses.

    The engine's contract validation still runs on every response — only the
    network call is replaced. Without this fixture the suite makes live
    provider calls (slow, costly and non-reproducible).
    """
    from src.services.aage import llm as aage_llm

    def _request(prompt, *, temperature=0.2, max_tokens=6000,
                 prefer_fast=False, **kwargs):
        if "recommended_evaluators" in prompt:
            payload = {
                "title": "Generated API rubric",
                "discipline": "backend",
                "summary": "Evidence-based assessment of a REST API submission.",
                "learning_objectives": ["Design a REST API", "Write tests"],
                "deliverables": ["source code", "README"],
                "technologies": ["Python", "FastAPI"],
                "evaluation_methods": ["static source inspection"],
                "criteria": [
                    {"key": "api_design", "name": "API design",
                     "description": "Routes and validation are implemented.",
                     "weight": 60, "max_marks": 60, "is_required": True,
                     "evidence_requirements": ["source file"],
                     "evidence_category": "CODE_SUPPORTED",
                     "evaluator_hint": "backend", "levels": []},
                    {"key": "tests", "name": "Testing",
                     "description": "Tests cover the main endpoint.",
                     "weight": 40, "max_marks": 40, "is_required": True,
                     "evidence_requirements": ["test file"],
                     "evidence_category": "CODE_SUPPORTED",
                     "evaluator_hint": "backend", "levels": []},
                ],
                "recommended_evaluators": ["backend"],
                "unverifiable_requirements": [],
                "notes": "",
            }
        else:
            context = prompt
            if "<<<CONTEXT_BEGIN>>>" in prompt:
                context = prompt.split("<<<CONTEXT_BEGIN>>>", 1)[1].split(
                    "<<<CONTEXT_END>>>", 1)[0]
            keys = [k for k in dict.fromkeys(re.findall(
                r'"criterion_key"\s*:\s*"([^"]+)"', context))
                if k and k != "criterion_key"]
            if not keys:
                keys = ["general"]
            payload = {
                "criteria": [
                    {
                        "criterion_key": key,
                        "marks": 6.0,
                        "max_marks": 10.0,
                        "rationale": "Source was inspected statically; partial evidence.",
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
                    }
                    for key in keys
                ],
                "overall_feedback": "Partial implementation with room for improvement.",
                "strengths": ["Submission includes source files."],
                "improvements": ["Add deterministic tests."],
                "confidence": 0.7,
            }
        return json.dumps(payload), "stub"

    monkeypatch.setattr(aage_llm.ai_provider_manager, "make_ai_request", _request)
    return _request


# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def _make_user(instructor=False):
    from src.models.user_models import db, User, Role

    name = "instructor" if instructor else "student"
    role = Role.query.filter_by(name=name).first()
    if role is None:
        role = Role(name=name)
        db.session.add(role)
        db.session.flush()
    import hashlib
    import uuid
    tag = uuid.uuid4().hex[:8]
    user = User(
        username=f"aage_{name}_{tag}",
        email=f"aage_{name}_{tag}@afritech.test",
        password_hash=hashlib.sha256(b"x").hexdigest(),
        role_id=role.id,
    )
    db.session.add(user)
    db.session.commit()
    db.session.refresh(user)
    return user


def _make_assignment(*, instructor, rubric=None, title="Build a REST API"):
    from src.models.course_models import Assignment, Course, AssignmentSubmission
    from src.models.user_models import db

    course = Course(
        title=f"AAGE Test Course {uuid.uuid4().hex[:8]}",  # courses.title is UNIQUE
        description="course for pipeline tests",
        instructor_id=instructor.id,
        is_published=True,
    )
    db.session.add(course)
    db.session.flush()

    assignment = Assignment(
        title=title,
        description=(
            "Build a small REST API in Python. Include a GET /items endpoint, "
            "input validation, tests, and a README. Use FastAPI."
        ),
        instructor_id=instructor.id,
        course_id=course.id,
        points_possible=100,
        passing_score=70,
        is_published=True,
        rubric_id=rubric.id if rubric is not None else None,
    )
    db.session.add(assignment)
    db.session.commit()
    db.session.refresh(assignment)

    student = _make_user(instructor=False)
    submission = AssignmentSubmission(
        assignment_id=assignment.id,
        student_id=student.id,
        content=(
            "I built the API with FastAPI. See main.py for the /items route "
            "and test_items.py for pytest coverage."
        ),
        file_url=json.dumps([
            {"filename": "main.py", "original_filename": "main.py",
             "url": "memory://main.py"},
            {"filename": "test_items.py", "original_filename": "test_items.py",
             "url": "memory://test_items.py"},
        ]),
    )
    db.session.add(submission)
    db.session.commit()
    db.session.refresh(submission)
    return course, assignment, student, submission


def _make_legacy_rubric(*, instructor, assignment):
    """A pre-AAGE rubric: no criterion_key, weights all 0, only max_points."""
    from src.models.grading_models import Rubric, RubricCriterion
    from src.models.user_models import db

    # The scenario fixture creates rows in the outer app context, while this
    # helper runs in a test-local app context.  Merge first so the mutation is
    # dirty in the session that actually commits it.
    assignment = db.session.merge(assignment)

    rubric = Rubric(
        title="Legacy API rubric",
        instructor_id=instructor.id,
        total_points=100,
        status="approved",
        assessment_kind="assignment",
        assessment_id=assignment.id,
    )
    db.session.add(rubric)
    db.session.flush()
    for idx, (name, points) in enumerate([
        ("Endpoint correctness", 40),
        ("Code quality", 30),
        ("Documentation", 30),
    ]):
        db.session.add(RubricCriterion(
            rubric_id=rubric.id,
            name=name,
            description=f"Assess {name.lower()}",
            max_points=points,
            order_index=idx,
            weight=0,               # legacy: never weighted
            criterion_key=None,     # legacy: no stable key
        ))
    db.session.commit()
    db.session.refresh(rubric)
    assignment.rubric_id = rubric.id
    db.session.commit()
    return rubric


# ---------------------------------------------------------------------------
# unit: criterion normalisation
# ---------------------------------------------------------------------------

def test_legacy_criteria_gain_keys_weights_and_max_marks():
    snapshot = {
        "criteria": [
            {"id": 1, "name": "Correctness", "max_points": 60, "weight": 0,
             "order_index": 0, "criterion_key": None},
            {"id": 2, "name": "Style", "max_points": 40, "weight": 0,
             "order_index": 1, "criterion_key": None},
        ]
    }
    criteria = _criteria_from_snapshot(snapshot)

    assert len(criteria) == 2
    for crit in criteria:
        assert crit["criterion_key"], "every criterion needs a stable key"
        assert crit["max_marks"] > 0
    assert {c["max_marks"] for c in criteria} == {60, 40}
    total = round(sum(c["weight"] for c in criteria), 4)
    assert abs(total - 100.0) < 0.01, "zero weights must be redistributed"
    # weights must be proportional to marks (60/40 split)
    by_key = {c["name"]: c for c in criteria}
    assert by_key["Correctness"]["weight"] == pytest.approx(60.0, abs=0.05)
    assert by_key["Style"]["weight"] == pytest.approx(40.0, abs=0.05)


def test_existing_keys_and_weights_are_preserved():
    snapshot = {
        "criteria": [
            {"criterion_key": "cr_1", "name": "A", "max_marks": 50,
             "weight": 70, "evaluator_hint": "backend"},
            {"criterion_key": "cr_2", "name": "B", "max_marks": 50,
             "weight": 30},
        ]
    }
    criteria = _criteria_from_snapshot(snapshot)
    assert [c["criterion_key"] for c in criteria] == ["cr_1", "cr_2"]
    assert criteria[0]["evaluator_hint"] == "backend"
    assert round(sum(c["weight"] for c in criteria), 4) == 100.0


# ---------------------------------------------------------------------------
# unit: evaluator merge + conflict detection
# ---------------------------------------------------------------------------

def _eval(key, marks, max_marks=10, evaluator="backend", confidence=0.8,
          category="CODE_SUPPORTED"):
    return CriterionEvaluation(
        criterion_key=key, marks=marks, max_marks=max_marks,
        rationale="because", evidence_category=category,
        verification_status="verified", confidence=confidence,
        evaluator_name=evaluator, evaluator_version="1.0.0")


def test_merge_uses_hinted_evaluator_for_its_criterion():
    out_a = EvaluatorOutput(evaluator_name="frontend", evaluator_version="1",
                            criteria=[_eval("ui", 8, evaluator="frontend")])
    out_b = EvaluatorOutput(evaluator_name="backend", evaluator_version="1",
                            criteria=[_eval("api", 9, evaluator="backend")])
    criteria = [
        {"criterion_key": "ui", "evaluator_hint": "frontend", "max_marks": 10},
        {"criterion_key": "api", "evaluator_hint": "backend", "max_marks": 10},
    ]
    marks, conflicts = _merge_outputs(
        [(type("E", (), {"name": "frontend"})(), out_a),
         (type("E", (), {"name": "backend"})(), out_b)],
        criteria)
    assert marks["ui"]["marks"] == 8
    assert marks["api"]["marks"] == 9
    assert conflicts == []


def test_merge_records_conflict_and_keeps_the_conservative_score():
    a = EvaluatorOutput(evaluator_name="backend", evaluator_version="1",
                        criteria=[_eval("shared", 9, confidence=0.9)])
    b = EvaluatorOutput(evaluator_name="data_science", evaluator_version="1",
                        criteria=[_eval("shared", 4, confidence=0.9)])
    criteria = [{"criterion_key": "shared", "max_marks": 10}]
    marks, conflicts = _merge_outputs(
        [(type("E", (), {"name": "backend"})(), a),
         (type("E", (), {"name": "data_science"})(), b)],
        criteria)

    assert len(conflicts) == 1
    assert conflicts[0]["criterion_key"] == "shared"
    assert conflicts[0]["spread"] > 0.15
    assert marks["shared"]["marks"] == 4, "conflict must resolve conservatively"


def test_hint_does_not_hide_conflicts_from_other_evaluators():
    owned = EvaluatorOutput(
        evaluator_name="backend", evaluator_version="1",
        criteria=[_eval("api", 9, evaluator="backend")])
    other = EvaluatorOutput(
        evaluator_name="data_science", evaluator_version="1",
        criteria=[_eval("api", 2, evaluator="data_science")])
    criteria = [{"criterion_key": "api", "evaluator_hint": "backend",
                 "max_marks": 10}]
    marks, conflicts = _merge_outputs(
        [(type("E", (), {"name": "backend"})(), owned),
         (type("E", (), {"name": "data_science"})(), other)],
        criteria)

    assert len(conflicts) == 1
    assert len(conflicts[0]["scores"]) == 2
    assert conflicts[0]["resolution"] == "hint_owner_selected"
    # The hinted evaluator owns the criterion, but its evidence travels with
    # the chosen mark.
    assert marks["api"]["marks"] == 9
    assert marks["api"]["evaluator_name"] == "backend"


def test_merge_within_tolerance_picks_the_more_confident_evaluation():
    a = EvaluatorOutput(evaluator_name="backend", evaluator_version="1",
                        criteria=[_eval("shared", 8, confidence=0.4)])
    b = EvaluatorOutput(evaluator_name="data_science", evaluator_version="1",
                        criteria=[_eval("shared", 8.5, confidence=0.9)])
    criteria = [{"criterion_key": "shared", "max_marks": 10}]
    marks, conflicts = _merge_outputs(
        [(type("E", (), {"name": "backend"})(), a),
         (type("E", (), {"name": "data_science"})(), b)],
        criteria)
    assert conflicts == []
    assert marks["shared"]["marks"] == 8.5


# ---------------------------------------------------------------------------
# integration: full evaluation
# ---------------------------------------------------------------------------

@pytest.fixture()
def scenario(app):
    from src.models.user_models import db

    db.create_all()
    instructor = _make_user(instructor=True)
    course, assignment, student, submission = _make_assignment(
        instructor=instructor)
    return {
        "instructor": instructor,
        "course": course,
        "assignment": assignment,
        "student": student,
        "submission": submission,
    }


def test_evaluate_submission_without_persist(app, scenario):
    with app.app_context():
        outcome = orchestrator.evaluate_submission(
            "assignment", scenario["submission"].id, persist=False)

        assert outcome.ok, outcome.error
        assert outcome.result_id == 0, "persist=False must not write a result"
        assert outcome.breakdown is not None
        assert outcome.final_score >= 0
        assert 0 <= outcome.confidence <= 100
        assert outcome.selected_evaluators, "at least one evaluator must run"
        # provisional rubric (no approved rubric yet) always needs review
        assert outcome.provisional is True
        assert outcome.requires_review is True
        assert outcome.status == "pending_review"


def test_evaluate_submission_with_legacy_rubric(app, scenario):
    with app.app_context():
        _make_legacy_rubric(instructor=scenario["instructor"],
                            assignment=scenario["assignment"])
        outcome = orchestrator.evaluate_submission(
            "assignment", scenario["submission"].id, persist=False)

        assert outcome.ok, outcome.error
        assert outcome.provisional is False, "approved rubric must govern"
        criteria = outcome.breakdown.criteria
        assert len(criteria) == 3
        # legacy rubric: weights were 0, engine redistributed them to 100
        assert round(sum(c.weight for c in criteria), 3) == pytest.approx(
            100.0, abs=0.01)
        assert {c.maximum for c in criteria} == {40.0, 30.0, 30.0}


def test_editing_an_approved_rubric_forks_an_immutable_draft(app, scenario):
    from src.models.grading_models import Rubric
    from src.services.aage import rubric_intelligence

    with app.app_context():
        rubric = _make_legacy_rubric(instructor=scenario["instructor"],
                                     assignment=scenario["assignment"])
        original_id = rubric.id
        engine = rubric_intelligence.RubricIntelligence()
        forked = engine.update(
            original_id,
            {
                "title": "Forked API rubric",
                "criteria": [
                    {"key": "api", "name": "API", "description": "d",
                     "weight": 50, "max_marks": 50},
                    {"key": "tests", "name": "Tests", "description": "d",
                     "weight": 50, "max_marks": 50},
                ],
            },
            actor_id=scenario["instructor"].id,
            acknowledge_graded=True,
        )

        assert forked.id != original_id
        assert forked.parent_rubric_id == original_id
        assert forked.status == "draft"
        original = Rubric.query.get(original_id)
        assert original.title == "Legacy API rubric"
        assert original.status == "approved"
        assert len(original.criteria.all()) == 3


def test_rubric_generation_fails_closed_on_invalid_model_payload(app, scenario):
    from src.services.aage import rubric_intelligence

    with app.app_context():
        descriptor = rubric_intelligence.assessment_intelligence.load(
            "assignment", scenario["assignment"].id)
        engine = rubric_intelligence.RubricIntelligence()
        engine._payload_from_llm = lambda *_a, **_k: {"criteria": "not-a-list"}
        with pytest.raises(rubric_intelligence.RubricError) as exc:
            engine.generate(descriptor, actor_id=scenario["instructor"].id)
        assert exc.value.code == "rubric_invalid"


def test_full_job_run_persists_authoritative_rows(app, scenario):
    with app.app_context():
        _make_legacy_rubric(instructor=scenario["instructor"],
                            assignment=scenario["assignment"])
        job = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=scenario["submission"].id,
            requested_by=scenario["instructor"].id,
        )
        assert job.status == JOB_QUEUED

        # idempotent enqueue: a second click returns the same job
        again = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=scenario["submission"].id,
        )
        assert again.id == job.id

        outcome = jobs.run_job(job)
        assert outcome["status"] == JOB_SUCCEEDED, outcome.get("error")

        result = EvaluationResult.query.filter_by(job_id=job.id).one()
        assert result.submission_type == "assignment"
        assert result.submission_id == scenario["submission"].id
        assert result.student_id == scenario["student"].id
        assert result.status == "pending_review"
        assert result.requires_review is True
        assert result.is_official is False, "nothing publishes without review"
        assert 0 <= result.final_score <= 100
        assert result.confidence >= 0
        assert result.rubric_snapshot and result.rubric_snapshot["criteria"]

        scores = CriterionScore.query.filter_by(result_id=result.id).all()
        assert len(scores) == 3
        assert all(s.maximum > 0 for s in scores)
        assert round(sum(s.weight for s in scores), 3) == pytest.approx(
            100.0, abs=0.01)

        run = EvaluationRun.query.filter_by(job_id=job.id).one()
        assert run.status == "succeeded"
        assert run.evaluators and isinstance(run.evaluators, list)

        # pending review means a review row is waiting for an instructor
        review = GradingReview.query.filter_by(result_id=result.id).one()
        assert review.status == "pending"
        assert review.ai_score == result.final_score

        # the engine must NOT have written the legacy grade
        from src.models.course_models import AssignmentSubmission
        fresh = AssignmentSubmission.query.get(scenario["submission"].id)
        assert fresh.grade is None

        job = jobs.get_job(job.id)
        assert job.result_id == result.id
        assert job.progress["stage"] in ("succeeded", "published")


def test_evidence_rows_are_persisted(app, scenario):
    with app.app_context():
        job = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=scenario["submission"].id,
        )
        jobs.run_job(job)
        result = EvaluationResult.query.filter_by(job_id=job.id).one()
        evidence = EvaluationEvidence.query.filter_by(
            result_id=result.id).all()
        assert evidence, "every run must leave an evidence trail"
        for ev in evidence:
            assert ev.summary
            assert ev.category in ("VERIFIED", "CODE_SUPPORTED",
                                   "CONTENT_SUPPORTED", "UNVERIFIED")


def test_unknown_submission_raises(app, scenario):
    with app.app_context():
        with pytest.raises(Exception):
            orchestrator.evaluate_submission("assignment", 999999,
                                             persist=False)


def test_enqueue_rejects_unknown_submission_type(app):
    with app.app_context():
        with pytest.raises(jobs.JobError):
            jobs.enqueue_grade_job(submission_type="quiz", submission_id=1)


def test_cancel_job_leaves_terminal_state(app, scenario):
    with app.app_context():
        job = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=scenario["submission"].id,
        )
        jobs.cancel_job(job.id, actor_id=scenario["instructor"].id,
                        reason="changed my mind")
        job = jobs.get_job(job.id)
        assert job.status == "cancelled"
        # a cancelled job frees the submission for a fresh enqueue
        fresh = jobs.enqueue_grade_job(
            submission_type="assignment",
            submission_id=scenario["submission"].id,
        )
        assert fresh.id != job.id


def test_evaluate_requires_a_job_when_persisting(app, scenario):
    with app.app_context():
        with pytest.raises(EvaluationError) as exc:
            orchestrator.evaluate_submission(
                "assignment", scenario["submission"].id, persist=True)
        assert exc.value.code == "missing_job"
