"""Focused AAGE adaptive-learning regression tests.

These tests exercise the review → learning → calibration path without any live
model calls.  All scores are deterministic values persisted by the services
under test; no metric is inferred from thin air.
"""

import uuid

import pytest

from src.models.aage_models import (
    CriterionScore,
    EvaluationResult,
    EvaluatorVersion,
    GradingAuditLog,
    GradingReview,
    LearningExample,
)
from src.models.course_models import Course
from src.models.user_models import db
from src.services.aage import learning, review
from src.services.aage.constants import (
    EVALUATOR_ACTIVE,
    EVALUATOR_CANDIDATE,
    LEARNING_APPROVED,
    LEARNING_CANDIDATE,
    REVIEW_CHANGES,
)


@pytest.fixture(autouse=True)
def _clean_scoped_session():
    """Keep these tests independent of an earlier failed suite's session.

    The shared conftest session can be left in a rolled-back state by an
    unrelated SQLite lock in another test module; a fresh rollback here avoids
    cascading errors without changing any other test's behaviour.
    """
    db.session.rollback()
    yield
    db.session.rollback()


def _rubric_snapshot():
    return {
        "status": "approved",
        "weight_total": 100.0,
        "criteria": [
            {"criterion_key": "c1", "name": "Correctness",
             "max_marks": 10, "weight": 50, "order_index": 0},
            {"criterion_key": "c2", "name": "Quality",
             "max_marks": 10, "weight": 50, "order_index": 1},
        ],
    }


def _score(marks, maximum=10.0):
    return {"marks": float(marks), "maximum": float(maximum)}


def _make_result(app, instructor, *, ai_marks, evaluator_name,
                 evaluator_version="1.0.0"):
    """Persist an AI result + pending review with the given pre-correction marks."""
    with app.app_context():
        db.create_all()
        tag = uuid.uuid4().hex[:8]
        course = Course(
            title=f"AAGE learning course {tag}",
            description="adaptive-learning regression fixture",
            instructor_id=instructor.id, is_published=True)
        db.session.add(course)
        db.session.flush()

        total = float(sum(ai_marks.values()))
        result = EvaluationResult(
            submission_type="assignment", submission_id=1,
            assessment_kind="assignment", assessment_id=0,
            course_id=course.id, student_id=instructor.id,
            rubric_snapshot=_rubric_snapshot(),
            total_awarded=total, total_possible=20.0,
            final_score=round(total / 20.0 * 100.0, 2),
            grade_letter="F", points_awarded=total,
            confidence=60.0, requires_review=True,
            status="pending_review", feedback="AI assessment",
            evaluator_versions=[{"name": evaluator_name,
                                 "version": evaluator_version}],
        )
        db.session.add(result)
        db.session.flush()

        for idx, (key, marks) in enumerate(ai_marks.items()):
            db.session.add(CriterionScore(
                result_id=result.id, criterion_key=key, name=key,
                awarded=float(marks), maximum=10.0, weight=50.0,
                weighted_score=float(marks) * 5.0,
                evidence_category="CODE_SUPPORTED",
                verification_status="partial",
                evaluator_name=evaluator_name,
                evaluator_version=evaluator_version,
                order_index=idx,
            ))

        review_row = GradingReview(
            result_id=result.id, status="pending",
            ai_score=result.final_score, assigned_to=instructor.id)
        db.session.add(review_row)
        db.session.commit()
        return {
            "course_id": course.id, "result_id": result.id,
            "review_id": review_row.id,
            "evaluator_name": evaluator_name,
            "evaluator_version": evaluator_version,
        }


def _correct(app, instructor, case, instructor_marks, dataset_version=None):
    """Apply instructor mark corrections and submit the review correction."""
    with app.app_context():
        for key, marks in instructor_marks.items():
            review.update_criterion_marks(
                case["review_id"], key, marks,
                "evidence supports the adjusted mark", instructor.id)
        payload = review.submit_correction(
            case["review_id"], "AI under-valued the supported evidence",
            instructor.id)
        example_id = payload["learning_example"]["id"]
        if dataset_version:
            example = LearningExample.query.get(example_id)
            example.dataset_version = dataset_version
            db.session.commit()
        return example_id


def _direct_example(*, name, version, ai_marks, instructor_marks,
                    status=LEARNING_APPROVED, dataset_version=None):
    """Build an approved example row directly for metric-focused tests."""
    return LearningExample(
        evaluator_name=name, evaluator_version=version,
        dataset_version=dataset_version,
        original_scores={k: _score(v) for k, v in ai_marks.items()},
        instructor_scores={k: _score(v) for k, v in instructor_marks.items()},
        score_delta=float(sum(instructor_marks.values()) - sum(ai_marks.values())),
        tags={"candidate_scores": {
            k: _score(v) for k, v in ai_marks.items()}},
        status=status,
    )


# ---------------------------------------------------------------------------
# Finding 1 — candidate scores are stored from the AI result, not instructor marks
# ---------------------------------------------------------------------------

def test_correction_persists_ai_candidate_scores_and_audit_context(
        app, instructor):
    name = f"backend_{uuid.uuid4().hex[:6]}"
    case = _make_result(app, instructor, ai_marks={"c1": 2.0, "c2": 4.0},
                        evaluator_name=name)

    with app.app_context():
        before_audits = GradingAuditLog.query.count()
        review_id = case["review_id"]
        course_id = case["course_id"]

    example_id = _correct(app, instructor, case, {"c1": 8.0})

    with app.app_context():
        example = LearningExample.query.get(example_id)
        tags = example.tags
        candidate = tags["candidate_scores"]

        # Original (AI) marks and instructor marks remain distinct.
        assert example.status == LEARNING_CANDIDATE
        assert example.original_scores["c1"] == 2.0
        assert example.instructor_scores["c1"] == 8.0
        assert candidate["c1"]["marks"] == 2.0
        assert candidate["c2"]["marks"] == 4.0
        assert candidate["c1"]["maximum"] == 10.0
        assert candidate["c1"]["marks"] != example.instructor_scores["c1"]
        assert tags["candidate_scores_source"] == "evaluation_result"
        assert tags["evaluator_name"] == name
        assert tags["evaluator_version"] == "1.0.0"

        # Audit rows are appended, never rewritten; context/actor travel with them.
        audits = GradingAuditLog.query.filter_by(
            entity_type="grading_review", entity_id=review_id).all()
        assert [a.action for a in audits] == [
            "review_mark_updated", "review_correction_submitted"]
        assert GradingAuditLog.query.count() == before_audits + 3  # + learning row
        for audit in audits:
            assert audit.actor_id == instructor.id
            assert audit.after["context"]["course_id"] == course_id
            assert audit.after["context"]["submission_id"] == 1
        learning_audit = GradingAuditLog.query.filter_by(
            action="learning_example_created", entity_id=example_id).one()
        assert learning_audit.actor_id == instructor.id
        assert learning_audit.after["context"]["course_id"] == course_id
        assert learning_audit.after["evaluator"]["version"] == "1.0.0"


def test_approved_correction_scores_drive_deterministic_calibration(
        app, instructor):
    name = f"backend_{uuid.uuid4().hex[:6]}"
    dataset = f"ds_{uuid.uuid4().hex[:8]}"
    with app.app_context():
        db.create_all()
        baseline = EvaluatorVersion(
            name=name, version="1.0.0", status=EVALUATOR_ACTIVE)
        candidate = EvaluatorVersion(
            name=name, version="2.0.0", status=EVALUATOR_CANDIDATE)
        db.session.add_all([baseline, candidate])
        db.session.commit()
        candidate_id = candidate.id

    cases = [
        ({"c1": 2.0, "c2": 4.0}, {"c1": 8.0, "c2": 4.0}),  # mae 30%
        ({"c1": 3.0, "c2": 4.0}, {"c1": 8.0, "c2": 4.0}),  # mae 25%
        ({"c1": 4.0, "c2": 4.0}, {"c1": 8.0, "c2": 4.0}),  # mae 20%
    ]
    example_ids = []
    for ai, adjusted in cases:
        case = _make_result(app, instructor, ai_marks=ai, evaluator_name=name)
        example_ids.append(_correct(app, instructor, case, adjusted,
                                    dataset_version=dataset))

    with app.app_context():
        for example_id in example_ids:
            learning.approve_example(example_id, actor_id=instructor.id)

        run = learning.start_calibration(name, candidate_id,
                                         actor_id=instructor.id,
                                         dataset_version=dataset)

    assert run["status"] == "completed"
    assert run["decision"] == "pending_approval"
    assert run["case_count"] == 3
    assert run["metrics"]["case_count"] == 3
    assert run["metrics"]["baseline"]["mae"] == 25.0
    assert run["metrics"]["candidate"]["mae"] == 25.0
    assert run["metrics"]["baseline"]["override_rate"] == 0.5

    key = f"{name}:1.0.0"
    by_evaluator = run["metrics"]["by_evaluator"]
    assert key in by_evaluator
    assert by_evaluator[key]["case_count"] == 3
    assert by_evaluator[key]["evaluator_version"] == "1.0.0"
    assert by_evaluator[key]["mae"] == 25.0
    assert by_evaluator[key]["criterion_agreement"] == 0.5
    assert by_evaluator[key]["reliability"] == 0.5
    assert by_evaluator[key]["override_rate"] == 0.5

    # The global aggregation is still present for backward compatibility.
    assert "baseline" in run["metrics"]
    assert "candidate" in run["metrics"]
    assert len(run["cases"]) == 3
    assert all(c["evaluator_version"] == "1.0.0" for c in run["cases"])
    for case in run["cases"]:
        assert isinstance(case["candidate_scores"], dict), case
        for key, marks in case["baseline_scores"].items():
            assert case["candidate_scores"][key]["marks"] == marks


# ---------------------------------------------------------------------------
# Finding 2 — reliability is available per evaluator version
# ---------------------------------------------------------------------------

def test_reliability_is_grouped_by_evaluator_version(app, instructor):
    name = f"backend_{uuid.uuid4().hex[:6]}"
    dataset = f"ds_{uuid.uuid4().hex[:8]}"
    rows = [
        _direct_example(name=name, version="1.0.0",
                        ai_marks={"c1": 0.0, "c2": 10.0},
                        instructor_marks={"c1": 10.0, "c2": 10.0},
                        dataset_version=dataset),
        _direct_example(name=name, version="1.0.0",
                        ai_marks={"c1": 0.0, "c2": 10.0},
                        instructor_marks={"c1": 10.0, "c2": 10.0},
                        dataset_version=dataset),
        _direct_example(name=name, version="2.0.0",
                        ai_marks={"c1": 9.0, "c2": 10.0},
                        instructor_marks={"c1": 10.0, "c2": 10.0},
                        dataset_version=dataset),
        _direct_example(name=name, version="2.0.0",
                        ai_marks={"c1": 9.0, "c2": 10.0},
                        instructor_marks={"c1": 10.0, "c2": 10.0},
                        dataset_version=dataset),
        _direct_example(name="", version="",
                        ai_marks={"c1": 0.0, "c2": 0.0},
                        instructor_marks={"c1": 10.0, "c2": 10.0},
                        dataset_version=dataset),
    ]
    with app.app_context():
        db.create_all()
        db.session.add_all(rows)
        db.session.commit()

        summary = learning.evaluator_reliability(examples=rows)
        candidate_summary = learning.evaluator_reliability(
            examples=rows, score_source="candidate")

    assert set(summary) == {f"{name}:1.0.0", f"{name}:2.0.0"}
    assert summary[f"{name}:1.0.0"]["case_count"] == 2
    assert summary[f"{name}:1.0.0"]["mae"] == 50.0
    assert summary[f"{name}:1.0.0"]["criterion_agreement"] == 0.5
    assert summary[f"{name}:1.0.0"]["reliability"] == 0.5
    assert summary[f"{name}:1.0.0"]["override_rate"] == 0.5

    assert summary[f"{name}:2.0.0"]["case_count"] == 2
    assert summary[f"{name}:2.0.0"]["mae"] == 5.0
    assert summary[f"{name}:2.0.0"]["reliability"] == 1.0
    assert summary[f"{name}:2.0.0"]["override_rate"] == 0.0
    assert candidate_summary[f"{name}:2.0.0"]["case_count"] == 2

    with app.app_context():
        insights = learning.learning_insights()
    assert f"{name}:1.0.0" in insights["calibration"]["reliability_by_evaluator"]
    assert f"{name}:2.0.0" in insights["calibration"]["reliability_by_evaluator"]


# ---------------------------------------------------------------------------
# Findings 3 & 4 — approval rules and honest insufficient_data
# ---------------------------------------------------------------------------

def test_correction_does_not_silently_approve_example(app, instructor):
    name = f"backend_{uuid.uuid4().hex[:6]}"
    dataset = f"ds_{uuid.uuid4().hex[:8]}"
    with app.app_context():
        db.create_all()
        candidate = EvaluatorVersion(
            name=name, version="2.0.0", status=EVALUATOR_CANDIDATE)
        db.session.add(candidate)
        db.session.commit()
        candidate_id = candidate.id

    case = _make_result(app, instructor, ai_marks={"c1": 2.0, "c2": 4.0},
                        evaluator_name=name)
    example_id = _correct(app, instructor, case, {"c1": 8.0},
                          dataset_version=dataset)

    with app.app_context():
        example = LearningExample.query.get(example_id)
        stored_review = GradingReview.query.get(case["review_id"])
        stored_result = EvaluationResult.query.get(case["result_id"])
        assert example.status == LEARNING_CANDIDATE
        assert stored_review.status == REVIEW_CHANGES
        assert stored_result.status == "pending_review"
        assert LearningExample.query.filter_by(
            evaluator_name=name, status=LEARNING_APPROVED).count() == 0

        run = learning.start_calibration(name, candidate_id,
                                         actor_id=instructor.id,
                                         dataset_version=dataset)
        assert run["status"] == "insufficient_data"
        assert run["metrics"]["available_cases"] == 0
        assert "mae" not in run["metrics"]

        # Explicit approval is required, and one case is still not enough.
        learning.approve_example(example_id, actor_id=instructor.id)
        run = learning.start_calibration(name, candidate_id,
                                         actor_id=instructor.id,
                                         dataset_version=dataset)
        assert run["status"] == "insufficient_data"
        assert run["metrics"]["available_cases"] == 1
        assert "mae" not in run["metrics"]
        assert run["metrics"]["by_evaluator_case_counts"] == {
            f"{name}:1.0.0": 1}


def test_calibration_with_no_cases_reports_insufficient_data(app, instructor):
    name = f"backend_{uuid.uuid4().hex[:6]}"
    dataset = f"ds_{uuid.uuid4().hex[:8]}"
    with app.app_context():
        db.create_all()
        candidate = EvaluatorVersion(
            name=name, version="2.0.0", status=EVALUATOR_CANDIDATE)
        db.session.add(candidate)
        db.session.commit()
        candidate_id = candidate.id

        run = learning.start_calibration(name, candidate_id,
                                         actor_id=instructor.id,
                                         dataset_version=dataset)

    assert run["status"] == "insufficient_data"
    assert run["decision"] == "insufficient_data"
    assert run["metrics"]["available_cases"] == 0
    assert run["metrics"]["candidate_scored_cases"] == 0
    assert run["metrics"]["by_evaluator_case_counts"] == {}
    assert "mae" not in run["metrics"]
    assert "by_evaluator" not in run["metrics"]
    assert run["cases"] == []
