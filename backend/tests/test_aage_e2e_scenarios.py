"""Required AAGE end-to-end scenarios (offline, deterministic provider).

These scenarios exercise the real orchestrator, artifact analyzer, registry,
scoring and confidence layers. Only the network provider call is stubbed; no
grade, metric or success state is fabricated.
"""

import io
import json
import math
import re
import uuid
import zipfile
from datetime import datetime, timedelta

import pytest

from src.models.aage_models import GradingJob
from src.models.course_models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Project,
    ProjectSubmission,
)
from src.models.user_models import Role, User, db
from src.services.aage import assessment_intelligence, llm as aage_llm
from src.services.aage.orchestrator import evaluate_submission
from src.services.aage.rubric_intelligence import RubricIntelligence


@pytest.fixture(autouse=True)
def offline_provider(monkeypatch):
    """Return schema-valid, bounded responses without contacting a provider."""

    def _request(prompt, *, temperature=0.2, max_tokens=6000,
                 prefer_fast=False, **kwargs):
        if "recommended_evaluators" in prompt:
            return json.dumps({
                "title": "Adapted rubric",
                "discipline": "backend",
                "summary": "Evidence-based rubric for the submitted work.",
                "learning_objectives": ["Apply the assessed skill"],
                "deliverables": ["source files"],
                "technologies": ["Python"],
                "evaluation_methods": ["static inspection"],
                "criteria": [
                    {"key": "implementation", "name": "Implementation",
                     "description": "Core requirement is implemented.",
                     "weight": 70, "max_marks": 70,
                     "is_required": True, "evidence_requirements": ["source file"],
                     "evidence_category": "CODE_SUPPORTED",
                     "evaluator_hint": "backend", "levels": []},
                    {"key": "verification", "name": "Verification",
                     "description": "Evidence or tests support the result.",
                     "weight": 30, "max_marks": 30,
                     "is_required": True, "evidence_requirements": ["test file"],
                     "evidence_category": "CODE_SUPPORTED",
                     "evaluator_hint": "backend", "levels": []},
                ],
                "recommended_evaluators": ["backend"],
                "unverifiable_requirements": [],
                "notes": "",
            }), "offline-stub"

        context = prompt
        if "<<<CONTEXT_BEGIN>>>" in prompt:
            context = prompt.split("<<<CONTEXT_BEGIN>>>", 1)[1].split(
                "<<<CONTEXT_END>>>", 1)[0]
        keys = [k for k in dict.fromkeys(re.findall(
            r'"criterion_key"\s*:\s*"([^"]+)"', context))
            if k and k != "criterion_key"] or ["general"]
        return json.dumps({
            "criteria": [{
                "criterion_key": key,
                "marks": 6.0,
                "max_marks": 10.0,
                "rationale": "Static inspection found partial support.",
                "evidence_category": "CODE_SUPPORTED",
                "verification_status": "partial",
                "evidence": [{
                    "reference": "source",
                    "summary": "Read-only static inspection of submitted text.",
                    "category": "CODE_SUPPORTED",
                    "locator": "source",
                }],
                "feedback": "Add more complete evidence and tests.",
                "limitations": "No untrusted code was executed.",
                "confidence": 0.7,
            } for key in keys],
            "overall_feedback": "Partial implementation requiring review.",
            "strengths": ["Submission contains readable material."],
            "improvements": ["Complete the missing deliverables."],
            "confidence": 0.7,
        }), "offline-stub"

    monkeypatch.setattr(aage_llm.ai_provider_manager, "make_ai_request", _request)
    return _request


@pytest.fixture()
def scenario(app):
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]

        def _user(role_name):
            role = Role.query.filter_by(name=role_name).first()
            if role is None:
                role = Role(name=role_name)
                db.session.add(role)
                db.session.flush()
            user = User(
                username=f"e2e_{role_name}_{tag}_{uuid.uuid4().hex[:4]}",
                email=f"e2e_{role_name}_{tag}_{uuid.uuid4().hex[:4]}@afritech.test",
                password_hash="x", role_id=role.id,
            )
            db.session.add(user)
            db.session.flush()
            return user

        instructor = _user("instructor")
        student = _user("student")
        course = Course(
            title=f"AAGE E2E Course {tag}", description="end-to-end scenario",
            instructor_id=instructor.id, is_published=True,
        )
        db.session.add(course)
        db.session.flush()
        yield {
            "tag": tag,
            "instructor": instructor,
            "student": student,
            "course": course,
        }


def _approved_rubric(scenario, *, kind, assessment, hint, criteria=None):
    criteria = criteria or [
        {"key": "implementation", "name": "Implementation", "weight": 70,
         "max_marks": 70, "evaluator_hint": hint},
        {"key": "verification", "name": "Verification", "weight": 30,
         "max_marks": 30, "evaluator_hint": hint},
    ]
    descriptor = assessment_intelligence.assessment_intelligence.load(kind, assessment.id)
    rubric, _ = RubricIntelligence().generate(
        descriptor, actor_id=scenario["instructor"].id, use_llm=False)
    rubric = RubricIntelligence().update(rubric.id, {
        "criteria": criteria,
        "evaluator_recommendations": [hint],
        "deliverables": ["source files"],
    }, actor_id=scenario["instructor"].id)
    rubric, version = RubricIntelligence().approve(
        rubric.id, actor_id=scenario["instructor"].id)
    db.session.refresh(rubric)
    return rubric, version


def _assignment(scenario, *, title, description, files=None, text=""):
    assignment = Assignment(
        title=title, description=description,
        instructor_id=scenario["instructor"].id,
        course_id=scenario["course"].id, points_possible=100,
        passing_score=70, is_published=True,
    )
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        assignment_id=assignment.id, student_id=scenario["student"].id,
        content=text,
        file_url=json.dumps(files or []),
    )
    db.session.add(submission)
    db.session.flush()
    db.session.refresh(submission)
    return assignment, submission


def _project(scenario, *, title, description, text):
    project = Project(
        title=title, description=description,
        course_id=scenario["course"].id, module_ids="[]",
        due_date=datetime.utcnow() + timedelta(days=7),
        points_possible=100, passing_score=70, is_published=True,
    )
    db.session.add(project)
    db.session.flush()
    submission = ProjectSubmission(
        project_id=project.id, student_id=scenario["student"].id,
        text_content=text,
    )
    db.session.add(submission)
    db.session.flush()
    db.session.refresh(submission)
    return project, submission


def _assert_clean_outcome(outcome, expected_evaluator):
    assert outcome.ok
    assert expected_evaluator in outcome.selected_evaluators
    assert math.isfinite(outcome.final_score)
    assert 0 <= outcome.final_score <= 100
    assert math.isfinite(outcome.confidence)
    assert 0 <= outcome.confidence <= 100


# ── Scenario 1: frontend ZIP submission ────────────────────────────────────

def test_e2e_frontend_submission_zip_is_extracted_and_evaluated(
        scenario, monkeypatch):
    archive = io.BytesIO()
    with zipfile.ZipFile(archive, "w") as zf:
        zf.writestr("index.html", "<html><body><h1>Afritech</h1></body></html>")
        zf.writestr("styles.css", "body { color: #222; }")
        zf.writestr("app.js", "document.addEventListener('DOMContentLoaded', () => {});")
    payload = archive.getvalue()

    from src.services.aage.artifacts import ArtifactAnalyzer

    monkeypatch.setattr(ArtifactAnalyzer, "_download",
                        lambda self, info: payload)

    assignment, submission = _assignment(
        scenario,
        title="Build a responsive landing page",
        description="Create an HTML/CSS/JS landing page with semantic markup.",
        files=[{"filename": "site.zip", "original_filename": "site.zip",
                "url": "memory://site.zip"}],
    )
    _approved_rubric(scenario, kind="assignment", assessment=assignment,
                     hint="frontend")

    outcome = evaluate_submission(
        "assignment", submission.id, persist=False,
        requested_evaluators=["frontend"])
    _assert_clean_outcome(outcome, "frontend")
    assert outcome.warnings is not None


# ── Scenario 2: backend project submission ─────────────────────────────────

def test_e2e_backend_project_submission_uses_static_analysis(scenario):
    project, submission = _project(
        scenario,
        title="REST API project",
        description="Implement a validated REST API with tests.",
        text=(
            "```python\n"
            "from flask import Flask, jsonify\n"
            "app = Flask(__name__)\n"
            "@app.route('/items/<int:item_id>')\n"
            "def item(item_id):\n"
            "    return jsonify({'id': item_id})\n"
            "```\n"
            "Tests use pytest to check the endpoint and validation."
        ),
    )
    _approved_rubric(scenario, kind="project", assessment=project,
                     hint="backend")

    outcome = evaluate_submission(
        "project", submission.id, persist=False,
        requested_evaluators=["backend"])
    _assert_clean_outcome(outcome, "backend")
    assert outcome.provisional is False


# ── Scenario 3: data science submission ────────────────────────────────────

def test_e2e_data_science_submission_selects_data_science_evaluator(scenario):
    assignment, submission = _assignment(
        scenario,
        title="Analyse a dataset with pandas",
        description="Load a CSV, clean missing values and plot a histogram.",
        text=(
            "```python\n"
            "import pandas as pd\n"
            "df = pd.read_csv('sales.csv')\n"
            "df = df.dropna()\n"
            "df['total'].hist()\n"
            "```\n"
            "The notebook documents the cleaning steps and findings."
        ),
    )
    rubric = _approved_rubric(
        scenario, kind="assignment", assessment=assignment,
        hint="data_science",
        criteria=[
            {"key": "analysis", "name": "Analysis", "weight": 60,
             "max_marks": 60, "evaluator_hint": "data_science"},
            {"key": "communication", "name": "Communication", "weight": 40,
             "max_marks": 40, "evaluator_hint": "data_science"},
        ],
    )[0]
    rubric.discipline = "data_science"
    db.session.commit()

    outcome = evaluate_submission(
        "assignment", submission.id, persist=False,
        requested_evaluators=["data_science"])
    _assert_clean_outcome(outcome, "data_science")


# ── Scenario 5: new assessment adaptation ──────────────────────────────────

def test_e2e_new_assessment_generates_approves_and_uses_frozen_rubric(scenario):
    assignment, submission = _assignment(
        scenario,
        title="New backend assessment",
        description="Build a small validated service and provide tests.",
        text="```python\n@app.route('/health')\ndef health(): return {'ok': True}\n```",
    )
    descriptor = assessment_intelligence.assessment_intelligence.load("assignment", assignment.id)
    rubric, _ = RubricIntelligence().generate(
        descriptor, actor_id=scenario["instructor"].id, use_llm=True)
    assert rubric.status == "draft"

    rubric = RubricIntelligence().update(
        rubric.id, {
            "criteria": [
                {"key": "implementation", "name": "Implementation",
                 "weight": 70, "max_marks": 70,
                 "evaluator_hint": "backend"},
                {"key": "verification", "name": "Verification",
                 "weight": 30, "max_marks": 30,
                 "evaluator_hint": "backend"},
            ],
            "evaluator_recommendations": ["backend"],
        },
        actor_id=scenario["instructor"].id,
    )
    approved, version = RubricIntelligence().approve(
        rubric.id, actor_id=scenario["instructor"].id)
    assert approved.status == "approved"
    assert approved.criteria_weights_total == 100.0
    assert assignment.rubric_id == approved.id

    outcome = evaluate_submission("assignment", submission.id, persist=False)
    assert outcome.provisional is False
    assert outcome.selected_evaluators == ["backend"]
    assert RubricIntelligence().versions(approved.id)[0]["version"] == version.version


# ── Scenario 6: failed provider ────────────────────────────────────────────

def test_e2e_failed_provider_never_produces_a_grade(scenario, monkeypatch):
    def _explode(*args, **kwargs):
        raise RuntimeError("simulated provider outage")

    monkeypatch.setattr(aage_llm.ai_provider_manager, "make_ai_request", _explode)

    assignment, submission = _assignment(
        scenario,
        title="Written analysis essay",
        description="Discuss the trade-offs of two system designs.",
        text="A written response that requires model-based rubric generation.",
    )
    descriptor = assessment_intelligence.assessment_intelligence.load("assignment", assignment.id)
    rubric, warnings = RubricIntelligence().generate(
        descriptor, actor_id=scenario["instructor"].id, use_llm=True)
    assert rubric.status == "draft"
    assert any("model" in w or "provider" in w or "deterministically" in w
               for w in warnings)

    job = GradingJob(
        submission_type="assignment", submission_id=submission.id,
        assessment_kind="assignment", assessment_id=assignment.id,
        course_id=scenario["course"].id, student_id=scenario["student"].id,
        status="queued", requested_by=scenario["instructor"].id,
    )
    db.session.add(job)
    db.session.commit()

    outcome = evaluate_submission(
        "assignment", submission.id, job=job, persist=True,
        requested_evaluators=["documents"])

    # Provider failure degrades conservatively: zero marks, low confidence,
    # forced review and no write-through to the official submission grade.
    assert outcome.final_score == 0.0
    assert outcome.requires_review is True
    assert outcome.provisional is True
    assert outcome.status == "pending_review"
    assert any("provider outage" in w or "LLM request failed" in w
               for w in outcome.warnings)

    from src.models.aage_models import EvaluationResult

    result = EvaluationResult.query.get(outcome.result_id)
    assert result is not None
    assert result.published_at is None
    db.session.refresh(submission)
    assert submission.grade is None


# ── Scenario 4: instructor correction feeds calibration ────────────────────

def test_e2e_instructor_correction_creates_calibratable_example(scenario):
    from src.models.aage_models import (
        EvaluatorVersion,
        GradingReview,
        LearningExample,
    )
    from src.services.aage import learning, review

    dataset_version = f"e2e-{scenario['tag']}"
    for idx in range(3):
        assignment, submission = _assignment(
            scenario,
            title=f"Correction submission {idx}",
            description="Implement and test a small service.",
            text=f"```python\nRESULT = {idx}\n@app.route('/items')\ndef items(): return []\n```",
        )
        _approved_rubric(
            scenario, kind="assignment", assessment=assignment, hint="backend",
            criteria=[
                {"key": "implementation", "name": "Implementation",
                 "weight": 70, "max_marks": 70,
                 "evaluator_hint": "backend"},
                {"key": "verification", "name": "Verification",
                 "weight": 30, "max_marks": 30,
                 "evaluator_hint": "backend"},
            ],
        )
        job = GradingJob(
            submission_type="assignment", submission_id=submission.id,
            assessment_kind="assignment", assessment_id=assignment.id,
            course_id=scenario["course"].id, student_id=scenario["student"].id,
            status="queued", requested_by=scenario["instructor"].id,
        )
        db.session.add(job)
        db.session.flush()
        outcome = evaluate_submission(
            "assignment", submission.id, job=job, persist=True,
            requested_evaluators=["backend"])
        assert outcome.result_id

        grading_review = GradingReview.query.filter_by(
            result_id=outcome.result_id).first()
        assert grading_review is not None
        review.update_criterion_marks(
            grading_review.id, "implementation", 9.0,
            "Evidence was stronger than the model credited.",
            actor_id=scenario["instructor"].id)
        corrected = review.submit_correction(
            grading_review.id,
            "Instructor verified the implementation directly.",
            actor_id=scenario["instructor"].id,
            create_learning_example=True)
        example_id = corrected["learning_example"]["id"]
        example = LearningExample.query.get(example_id)
        assert example.tags["candidate_scores"]
        assert example.tags["candidate_scores_source"] == "evaluation_result"
        assert example.status == "candidate"
        example.dataset_version = dataset_version  # isolate from other suites
        learning.approve_example(example_id, actor_id=scenario["instructor"].id)

    suffix = scenario["tag"][:6]
    baseline = EvaluatorVersion(
        name="backend", version=f"baseline-{suffix}", status="active",
        created_by=scenario["instructor"].id)
    candidate = EvaluatorVersion(
        name="backend", version=f"candidate-{suffix}", status="candidate",
        created_by=scenario["instructor"].id)
    db.session.add_all([baseline, candidate])
    db.session.commit()

    result = learning.start_calibration(
        "backend", candidate.id, actor_id=scenario["instructor"].id,
        dataset_version=dataset_version)
    assert result["status"] == "completed"
    assert result["metrics"]["case_count"] == 3
    assert "baseline" in result["metrics"]
    assert "candidate" in result["metrics"]
    assert any(item.get("evaluator_name") == "backend"
               for item in result["metrics"]["by_evaluator"].values())


# ── Scenario 7: existing LMS scoring/progression/certificate regression ────
def test_e2e_published_grade_flows_through_canonical_lms_scoring(scenario):
    """An approved AAGE result must write through the *existing* grade path
    and leave module progression / certificate scoring untouched."""
    from src.models.course_models import Enrollment, Lesson, Module
    from src.models.aage_models import EvaluationResult
    from src.services.aage import persistence
    from src.services.course_progress_service import CourseProgressService
    from src.services.enrollment_progress_service import EnrollmentProgressService

    module = Module(
        title=f"Regression module {scenario['tag']}", description="module",
        course_id=scenario["course"].id, order=1, is_published=True,
    )
    db.session.add(module)
    db.session.flush()
    lesson = Lesson(
        title=f"Regression lesson {scenario['tag']}", content_type="text",
        content_data="<p>content</p>", module_id=module.id, order=1,
        is_published=True,
    )
    db.session.add(lesson)
    db.session.flush()
    enrollment = Enrollment(
        student_id=scenario["student"].id, course_id=scenario["course"].id,
        status="active", progress=0.0,
    )
    db.session.add(enrollment)
    db.session.commit()

    assignment = Assignment(
        title="Canonical write-through assignment",
        description="Build and test a small endpoint.",
        instructor_id=scenario["instructor"].id,
        course_id=scenario["course"].id, module_id=module.id,
        points_possible=100, passing_score=70, is_published=True,
    )
    db.session.add(assignment)
    db.session.flush()
    submission = AssignmentSubmission(
        assignment_id=assignment.id, student_id=scenario["student"].id,
        content="```python\n@app.route('/health')\ndef health(): return {'ok': True}\n```",
        file_url=json.dumps([]),
    )
    db.session.add(submission)
    db.session.flush()
    db.session.refresh(submission)

    _approved_rubric(scenario, kind="assignment", assessment=assignment,
                     hint="backend")
    job = GradingJob(
        submission_type="assignment", submission_id=submission.id,
        assessment_kind="assignment", assessment_id=assignment.id,
        course_id=scenario["course"].id, student_id=scenario["student"].id,
        status="queued", requested_by=scenario["instructor"].id,
    )
    db.session.add(job)
    db.session.flush()
    outcome = evaluate_submission(
        "assignment", submission.id, job=job, persist=True,
        requested_evaluators=["backend"])
    assert outcome.result_id

    result = EvaluationResult.query.get(outcome.result_id)
    assert result.is_official is False
    db.session.refresh(submission)
    assert submission.grade is None  # auto-publish is off by default

    assert persistence.write_through_grade(
        result, actor_id=scenario["instructor"].id,
        publication_mode="manual") is True

    db.session.refresh(submission)
    assert submission.grade == pytest.approx(round(result.final_score, 2))
    assert "AI analysis" in (submission.feedback or "")
    db.session.refresh(result)
    assert result.is_official is True
    assert result.status == "published"

    # Idempotency: a second publish must not write the grade twice.
    assert persistence.write_through_grade(
        result, actor_id=scenario["instructor"].id,
        publication_mode="manual") is False

    # The existing progression/scoring services still compute correctly.
    db.session.refresh(enrollment)
    EnrollmentProgressService.sync_enrollment(enrollment, commit=True)
    state = CourseProgressService.evaluate(
        scenario["student"].id, scenario["course"].id,
        activate_prefetch=False)
    assert math.isfinite(state["overall_score"])
    assert 0 <= state["overall_score"] <= 100
    assert submission.grade == pytest.approx(round(result.final_score, 2))
