"""Service P — Instructor review workflow.

The engine never publishes an unreviewed result.  Instructors adjust individual
criterion marks here; every adjustment is re-scored with
:func:`src.services.aage.scoring.compute_breakdown` (the same deterministic
formula the orchestrator used), recorded in the audit log, and only becomes a
legacy grade after an explicit approval that passes the grading policy.

Learning examples are *candidates*: an instructor correction never silently
trains or changes an evaluator.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional, Sequence

from ...models.aage_models import (
    CalibrationRun,
    CriterionScore,
    EvaluationEvidence,
    EvaluationResult,
    GradingAuditLog,
    GradingReview,
    LearningExample,
)
from ...models.course_models import Assignment, Project
from ...utils.time_utils import now_local
from . import persistence, scoring
from .constants import (
    LEARNING_CANDIDATE,
    RESULT_APPROVED,
    RESULT_PENDING_REVIEW,
    RESULT_REJECTED,
    REVIEW_APPROVED,
    REVIEW_CHANGES,
    REVIEW_PENDING,
    REVIEW_REJECTED,
)

logger = logging.getLogger("aage.review")

AUDIT_ENTITY_REVIEW = "grading_review"
AUDIT_ENTITY_LEARNING = "learning_example"


class ReviewError(Exception):
    """A review lifecycle / validation failure with an API-friendly shape."""

    def __init__(self, message: str, code: str = "review_error",
                 details: Optional[List[Any]] = None, status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or []
        self.status = status


# ---------------------------------------------------------------------------
# Internal helpers
# ---------------------------------------------------------------------------

def _get_review(review_id: int) -> GradingReview:
    review = GradingReview.query.get(review_id)
    if review is None:
        raise ReviewError("review not found", "not_found", status=404)
    return review


def _get_result(result_id: int) -> EvaluationResult:
    result = EvaluationResult.query.get(result_id)
    if result is None:
        raise ReviewError("evaluation result not found", "not_found", status=404)
    return result


def _ensure_open(review: GradingReview) -> None:
    if review.status not in (REVIEW_PENDING, REVIEW_CHANGES):
        raise ReviewError(
            f"review is already {review.status}", "review_not_open", status=409)


def _criteria_for_result(result: EvaluationResult) -> List[Dict[str, Any]]:
    """Rebuild scoring-ready criteria from the frozen rubric on the result.

    The result snapshot was normalised by the orchestrator, but older rows may
    still carry legacy key names; map those defensively without ever inventing
    weights or maxima.
    """
    snapshot = result.rubric_snapshot or {}
    raw = snapshot.get("criteria") or []
    criteria: List[Dict[str, Any]] = []
    for idx, item in enumerate(raw):
        crit = dict(item)
        key = str(crit.get("criterion_key") or crit.get("key")
                  or f"criterion_{idx}")
        maximum = crit.get("max_marks", crit.get("maximum",
                                                  crit.get("max_points", 0)))
        criteria.append({
            "criterion_key": key,
            "key": key,
            "name": str(crit.get("name") or key),
            "max_marks": float(maximum or 0),
            "weight": float(crit.get("weight") or 0),
            "is_required": (True if crit.get("is_required") is None
                            else bool(crit.get("is_required"))),
            "order_index": int(crit.get("order_index") or idx),
        })
    if not criteria:
        raise ReviewError(
            "result has no frozen rubric to re-score", "missing_rubric", status=409)
    return criteria


def _current_marks(result: EvaluationResult) -> Dict[str, Dict[str, Any]]:
    marks: Dict[str, Dict[str, Any]] = {}
    for score in result.criteria.all():
        marks[score.criterion_key] = {
            "marks": float(score.awarded),
            "maximum": float(score.maximum),
            "rationale": score.rationale or "",
            "evidence_category": score.evidence_category,
            "verification_status": score.verification_status,
            "evaluator_name": score.evaluator_name or "",
            "evaluator_version": score.evaluator_version or "",
            "feedback": score.feedback or "",
            "limitations": score.limitations or "",
        }
    return marks


def _points_possible(result: EvaluationResult) -> float:
    """Points scale for this assessment, or the result's own marks total."""
    model = (Assignment if result.assessment_kind == "assignment" else Project)
    try:
        row = model.query.get(result.assessment_id)
        if row is not None and getattr(row, "points_possible", None):
            return float(row.points_possible)
    except Exception:  # pragma: no cover - legacy schema variance
        pass
    return float(result.total_possible or 100.0)


def _primary_evaluator(result: EvaluationResult) -> tuple:
    versions = result.evaluator_versions or []
    if versions and isinstance(versions[0], dict):
        return (str(versions[0].get("name") or ""),
                str(versions[0].get("version") or ""))
    for score in result.criteria.all():
        if score.evaluator_name:
            return score.evaluator_name, score.evaluator_version or ""
    return "", ""


def _result_context(result: EvaluationResult) -> Dict[str, Any]:
    """Course/assessment/submission context copied into audit snapshots."""
    return {
        "course_id": result.course_id,
        "assessment_kind": result.assessment_kind,
        "assessment_id": result.assessment_id,
        "submission_type": result.submission_type,
        "submission_id": result.submission_id,
        "student_id": result.student_id,
    }


def _ai_candidate_scores(result: EvaluationResult,
                         original_marks: Dict[str, Any]
                         ) -> Dict[str, Dict[str, float]]:
    """Rebuild deterministic candidate scores from the result under review.

    ``original_marks`` are the *pre-correction* marks recovered from the review
    audit trail (or the untouched result marks when no mark was adjusted).
    Instructor marks are deliberately never used as candidate scores.  Maximums
    come from the frozen rubric when available, otherwise from the persisted
    criterion rows; nothing is inferred or scaled here.
    """
    maxima: Dict[str, float] = {}
    try:
        for criterion in _criteria_for_result(result):
            maxima[criterion["criterion_key"]] = float(
                criterion["max_marks"] or 0)
    except ReviewError:  # older rows may have no frozen rubric snapshot
        maxima = {}

    rows = {row.criterion_key: row for row in result.criteria.all()}
    scores: Dict[str, Dict[str, float]] = {}
    for key, value in original_marks.items():
        try:
            marks = float(value)
        except (TypeError, ValueError):
            continue
        row = rows.get(key)
        maximum = float(
            (row.maximum if row is not None and row.maximum else None)
            or maxima.get(key, 0) or 0)
        scores[str(key)] = {"marks": marks, "maximum": maximum}
    return scores


def _audit_review(action: str, review: GradingReview, *, actor_id: Optional[int],
                  before: Any, after: Any, reason: str = "") -> None:
    result = _get_result(review.result_id)
    enriched_after = dict(after) if isinstance(after, dict) else after
    if isinstance(enriched_after, dict):
        enriched_after.setdefault("context", _result_context(result))
    persistence.audit(
        action=action, entity_type=AUDIT_ENTITY_REVIEW, entity_id=review.id,
        before=before, after=enriched_after, actor_id=actor_id, reason=reason,
        correlation_id=(result.correlation_id or ""))


def _publish_if_allowed(result: EvaluationResult, review: GradingReview,
                        actor_id: Optional[int]) -> bool:
    """Publish after an explicit instructor approval.

    This is deliberately *not* the automatic-publication path: an instructor
    has read the evidence and approved the result, so ``auto_publish_enabled``
    and ``auto_publish_min`` do not gate it.  Automatic publication (no human
    approval) is handled by :func:`jobs._maybe_auto_publish` and does honour
    both settings.
    """
    return bool(persistence.write_through_grade(
        result, actor_id=actor_id, reason="instructor review approved",
        # An instructor read the evidence and approved; the automated gate is
        # not used to override that human decision.  The write-through still
        # blocks superseded/rejected results and cancelled jobs.
        publication_mode="manual"))


# ---------------------------------------------------------------------------
# Review listing / detail
# ---------------------------------------------------------------------------

def list_pending(course_id: Optional[int] = None, page: int = 1,
                 per_page: int = 20,
                 course_ids: Optional[Sequence[int]] = None) -> Dict[str, Any]:
    """Return paginated pending reviews (optionally scoped to courses)."""
    page = max(1, int(page or 1))
    per_page = max(1, min(100, int(per_page or 20)))

    query = GradingReview.query.filter(GradingReview.status == REVIEW_PENDING)
    if course_id is not None:
        allowed = {int(course_id)}
        if course_ids is not None:
            allowed &= {int(c) for c in course_ids}
        if not allowed:
            return {"items": [], "page": page, "per_page": per_page,
                    "total": 0, "pages": 0}
        result_ids = (EvaluationResult.query
                      .filter(EvaluationResult.course_id.in_(sorted(allowed)))
                      .with_entities(EvaluationResult.id))
        query = query.filter(GradingReview.result_id.in_(result_ids))
    elif course_ids is not None:
        result_ids = (EvaluationResult.query
                      .filter(EvaluationResult.course_id.in_(
                          [int(c) for c in course_ids] or [-1]))
                      .with_entities(EvaluationResult.id))
        query = query.filter(GradingReview.result_id.in_(result_ids))

    total = query.count()
    rows = (query.order_by(GradingReview.id.desc())
            .offset((page - 1) * per_page).limit(per_page).all())
    items: List[Dict[str, Any]] = []
    for review in rows:
        result = _get_result(review.result_id)
        item = review.to_dict()
        item["result"] = {
            "id": result.id,
            "final_score": result.final_score,
            "confidence": result.confidence,
            "course_id": result.course_id,
            "student_id": result.student_id,
            "assessment_kind": result.assessment_kind,
            "assessment_id": result.assessment_id,
            "requires_review": result.requires_review,
        }
        items.append(item)
    return {
        "items": items,
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
    }


def get_review(review_id: int) -> Dict[str, Any]:
    """Full review detail: review, authoritative result and criterion scores."""
    review = _get_review(review_id)
    result = _get_result(review.result_id)
    evidence = [e.to_dict() for e in EvaluationEvidence.query.filter_by(
        result_id=result.id).order_by(EvaluationEvidence.id).all()]
    return {
        "review": review.to_dict(),
        "result": result.to_dict(include_criteria=True),
        "evidence": evidence,
    }


# ---------------------------------------------------------------------------
# Mark adjustments (always deterministic)
# ---------------------------------------------------------------------------

def update_criterion_marks(review_id: int, criterion_key: str, marks: Any,
                           reason: str, actor_id: Optional[int]) -> Dict[str, Any]:
    """Change one criterion's marks and re-score the whole result.

    The model is never involved: :func:`scoring.compute_breakdown` clamps the
    mark, recomputes every weighted score and the final percentage.
    """
    review = _get_review(review_id)
    _ensure_open(review)
    result = _get_result(review.result_id)

    try:
        value = float(marks)
    except (TypeError, ValueError):
        raise ReviewError("marks must be a number", "invalid_marks")
    if value < 0:
        raise ReviewError("marks cannot be negative", "invalid_marks")

    criterion_key = str(criterion_key or "").strip()
    score = next((c for c in result.criteria.all()
                  if c.criterion_key == criterion_key), None)
    if score is None:
        raise ReviewError("criterion not found on this result",
                          "criterion_not_found", status=404)
    if not str(reason or "").strip():
        raise ReviewError("a reason is required for mark changes",
                          "reason_required")

    criteria = _criteria_for_result(result)
    marks_by_key = _current_marks(result)
    before = {
        "marks": {k: v["marks"] for k, v in marks_by_key.items()},
        "final_score": result.final_score,
    }
    marks_by_key[criterion_key]["marks"] = value
    marks_by_key[criterion_key]["rationale"] = (
        f"Instructor adjustment: {str(reason).strip()[:1000]}")
    marks_by_key[criterion_key]["verification_status"] = "instructor_reviewed"

    # An instructor's explicit correction overrides the automatic UNVERIFIED
    # cap; all other deterministic clamps/weights still apply.
    breakdown = scoring.compute_breakdown(
        criteria, marks_by_key, apply_unverified_limits=False)

    by_key = {c.criterion_key: c for c in breakdown.criteria}
    for row in result.criteria.all():
        outcome = by_key.get(row.criterion_key)
        if outcome is None:
            continue
        row.awarded = outcome.awarded
        row.weight = outcome.weight
        row.weighted_score = outcome.weighted_score
        if row.criterion_key == criterion_key:
            row.rationale = outcome.rationale
            row.verification_status = "instructor_reviewed"

    result.total_awarded = breakdown.total_awarded
    result.total_possible = breakdown.total_possible
    result.final_score = breakdown.final_score
    result.grade_letter = scoring.letter_grade(breakdown.final_score)
    result.points_awarded = scoring.scale_to_points(
        breakdown.final_score, _points_possible(result))
    result.status = RESULT_PENDING_REVIEW
    review.final_score = breakdown.final_score
    review.decision_note = str(reason).strip()[:4000]
    persistence.db_commit()

    after = {
        "marks": {k: v["marks"] for k, v in marks_by_key.items()},
        "final_score": result.final_score,
        "criterion_key": criterion_key,
        "awarded": by_key[criterion_key].awarded,
    }
    _audit_review("review_mark_updated", review, actor_id=actor_id,
                  before=before, after=after, reason=str(reason).strip())

    return get_review(review_id)


# ---------------------------------------------------------------------------
# Corrections / learning examples
# ---------------------------------------------------------------------------

def _original_marks(review: GradingReview,
                    current: Dict[str, Dict[str, Any]]) -> Dict[str, Any]:
    """Recover the pre-correction marks from the review's audit trail."""
    rows = (GradingAuditLog.query
            .filter(GradingAuditLog.entity_type == AUDIT_ENTITY_REVIEW,
                    GradingAuditLog.entity_id == review.id,
                    GradingAuditLog.action == "review_mark_updated")
            .order_by(GradingAuditLog.id.asc()).all())
    if rows:
        first = rows[0].before or {}
        if isinstance(first, dict) and isinstance(first.get("marks"), dict):
            return first["marks"]
    return {k: v["marks"] for k, v in current.items()}


def submit_correction(review_id: int, explanation: str, actor_id: Optional[int],
                      create_learning_example: bool = True) -> Dict[str, Any]:
    """Record an instructor correction and optionally a learning candidate."""
    review = _get_review(review_id)
    _ensure_open(review)
    result = _get_result(review.result_id)
    explanation = str(explanation or "").strip()
    if not explanation:
        raise ReviewError("an explanation is required", "explanation_required")

    review.correction_reason = explanation[:8000]
    review.status = REVIEW_CHANGES
    review.final_score = result.final_score
    persistence.db_commit()

    example: Optional[LearningExample] = None
    if create_learning_example:
        current = _current_marks(result)
        original = _original_marks(review, current)
        adjusted = {k: v["marks"] for k, v in current.items()}
        delta = round(
            sum(float(adjusted.get(k, 0)) - float(original.get(k, 0))
                for k in set(original) | set(adjusted)), 4)
        evaluator_name, evaluator_version = _primary_evaluator(result)
        # The candidate evaluator's criterion marks are the AI marks that were
        # being corrected, never the instructor's adjusted marks.  Keeping both
        # maps on the example is what makes calibration honest.
        candidate_scores = _ai_candidate_scores(result, original)
        run = None
        if result.run_id:
            from ...models.aage_models import EvaluationRun
            run = EvaluationRun.query.get(result.run_id)
        evidence = [e.to_dict() for e in EvaluationEvidence.query.filter_by(
            result_id=result.id).order_by(EvaluationEvidence.id).limit(25).all()]
        example = LearningExample(
            result_id=result.id,
            submission_type=result.submission_type,
            submission_id=result.submission_id,
            assessment_id=result.assessment_id,
            course_id=result.course_id,
            rubric_version_id=result.rubric_version_id,
            evaluator_name=evaluator_name or None,
            evaluator_version=evaluator_version or None,
            ai_provider=result.ai_provider or None,
            original_scores=original,
            instructor_scores=adjusted,
            score_delta=delta,
            explanation=explanation[:8000],
            status=LEARNING_CANDIDATE,
            tags={
                "model": (run.model if run else None),
                "evidence": evidence,
                "rubric_version_id": result.rubric_version_id,
                "evaluator_versions": result.evaluator_versions or [],
                "evaluator_name": evaluator_name or None,
                "evaluator_version": evaluator_version or None,
                "candidate_scores": candidate_scores,
                "candidate_scores_source": "evaluation_result",
            },
        )
        persistence.db_add(example)
        persistence.db_commit()
        persistence.audit(
            action="learning_example_created", entity_type=AUDIT_ENTITY_LEARNING,
            entity_id=example.id, before=None,
            after={"result_id": result.id, "status": LEARNING_CANDIDATE,
                   "score_delta": delta,
                   "context": _result_context(result),
                   "evaluator": {"name": evaluator_name or None,
                                 "version": evaluator_version or None}},
            actor_id=actor_id, reason=explanation[:500])

    _audit_review("review_correction_submitted", review, actor_id=actor_id,
                  before={"status": REVIEW_PENDING},
                  after={"status": review.status,
                         "learning_example_id": example.id if example else None},
                  reason=explanation)
    payload = get_review(review_id)
    payload["learning_example"] = example.to_dict() if example else None
    return payload


# ---------------------------------------------------------------------------
# Review decisions
# ---------------------------------------------------------------------------

def approve_review(review_id: int, actor_id: Optional[int]) -> Dict[str, Any]:
    """Approve a review and publish the instructor-approved result.

    Unlike automatic publication (``jobs._maybe_auto_publish``), this path is
    gated by an explicit human decision and therefore does not apply the
    ``auto_publish_enabled`` / ``auto_publish_min`` thresholds.
    """
    review = _get_review(review_id)
    _ensure_open(review)
    result = _get_result(review.result_id)

    before = {"review_status": review.status, "result_status": result.status,
              "final_score": result.final_score}
    review.status = REVIEW_APPROVED
    review.resolved_at = now_local()
    result.status = RESULT_APPROVED
    result.requires_review = False
    persistence.db_commit()

    published = _publish_if_allowed(result, review, actor_id)
    _audit_review("review_approved", review, actor_id=actor_id, before=before,
                  after={"review_status": review.status,
                         "result_status": result.status,
                         "final_score": result.final_score,
                         "published": published},
                  reason="instructor approved the corrected grade")
    payload = get_review(review_id)
    payload["published"] = published
    return payload


def reject_review(review_id: int, reason: str,
                  actor_id: Optional[int]) -> Dict[str, Any]:
    """Reject the evaluation. Never writes through to a legacy grade."""
    review = _get_review(review_id)
    _ensure_open(review)
    result = _get_result(review.result_id)
    reason = str(reason or "").strip()
    if not reason:
        raise ReviewError("a rejection reason is required", "reason_required")

    before = {"review_status": review.status, "result_status": result.status}
    review.status = REVIEW_REJECTED
    review.decision_note = reason[:4000]
    review.resolved_at = now_local()
    result.status = RESULT_REJECTED
    result.requires_review = False
    persistence.db_commit()

    _audit_review("review_rejected", review, actor_id=actor_id, before=before,
                  after={"review_status": review.status,
                         "result_status": result.status},
                  reason=reason)
    return get_review(review_id)


__all__ = [
    "ReviewError", "list_pending", "get_review", "update_criterion_marks",
    "submit_correction", "approve_review", "reject_review",
]
