"""Compatibility helpers for historical Excel grading rows.

New work never creates an ``ExcelGradingResult``.  This module exists only so
that historical rows remain readable and can be reviewed through the shared
AAGE review/learning flow.  It does not implement a second scorer: it copies the
legacy row's *own* marks into an AAGE result snapshot and lets
:mod:`src.services.aage.review` re-score any instructor adjustment with the
canonical :func:`src.services.aage.scoring.compute_breakdown`.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from ...models.aage_models import (
    CriterionScore,
    EvaluationEvidence,
    EvaluationResult,
    GradingReview,
)
from ...models.course_models import AssignmentSubmission, ProjectSubmission
from ...models.excel_grading_models import ExcelGradingResult
from ...utils.time_utils import now_local
from . import persistence, review as aage_review, scoring
from .constants import RESULT_PENDING_REVIEW, REVIEW_PENDING

logger = logging.getLogger("aage.compatibility")


class CompatibilityError(Exception):
    """Raised when a legacy row cannot be represented in the AAGE flow."""

    def __init__(self, message: str, code: str = "legacy_result_invalid",
                 status: int = 409):
        super().__init__(message)
        self.message = message
        self.code = code
        self.status = status


def _criteria_from_legacy(legacy: ExcelGradingResult) -> List[Dict[str, Any]]:
    """Build scoring-ready criteria from the legacy row's recorded marks."""
    requirements = [
        row for row in ((legacy.analysis_data or {}).get("requirement_results") or [])
        if isinstance(row, dict)
    ]
    rows: List[Dict[str, Any]] = []
    if requirements:
        for req in requirements:
            maximum = max(0.0, float(req.get("max_score") or 0))
            if maximum <= 0:
                continue
            key = str(req.get("requirement_id") or f"req_{len(rows) + 1:03d}")[:80]
            rows.append({
                "criterion_key": key,
                "name": str(req.get("requirement") or key)[:200],
                "awarded": max(0.0, min(maximum, float(req.get("score") or 0))),
                "maximum": maximum,
                "status": str(req.get("status") or "NOT_FOUND"),
                "evidence": [str(x) for x in (req.get("evidence") or []) if str(x).strip()],
                "missing": [str(x) for x in (req.get("missing") or []) if str(x).strip()],
                "feedback": str(req.get("fix") or ""),
            })
    if not rows:
        breakdown = legacy.rubric_breakdown or {}
        for key, value in breakdown.items():
            if not isinstance(value, dict):
                continue
            maximum = max(0.0, float(value.get("max") or 0))
            if maximum <= 0:
                continue
            rows.append({
                "criterion_key": str(key)[:80],
                "name": str(key)[:200],
                "awarded": max(0.0, min(maximum, float(value.get("score") or 0))),
                "maximum": maximum,
                "status": "SATISFIED",
                "evidence": [],
                "missing": [],
                "feedback": "",
            })
    if not rows:
        raise CompatibilityError(
            "historical result has no criterion marks to review",
            "legacy_result_without_criteria",
        )

    total = sum(row["maximum"] for row in rows)
    for index, row in enumerate(rows):
        row["weight"] = round(row["maximum"] / total * 100.0, 4) if total else 0.0
        row["order_index"] = index
        row["weighted_score"] = round(scoring.weighted_criterion_score(
            row["awarded"], row["maximum"], row["weight"]), 4)
    return rows


def _submission_context(legacy: ExcelGradingResult):
    if legacy.submission_type == "assignment":
        submission = AssignmentSubmission.query.get(legacy.assignment_submission_id)
        parent = submission.assignment if submission else None
    else:
        submission = ProjectSubmission.query.get(legacy.project_submission_id)
        parent = submission.project if submission else None
    return submission, parent


def _latest_aage_result(legacy: ExcelGradingResult) -> Optional[EvaluationResult]:
    return (EvaluationResult.query
            .filter(EvaluationResult.submission_type == legacy.submission_type,
                    EvaluationResult.submission_id == (
                        legacy.assignment_submission_id
                        if legacy.submission_type == "assignment"
                        else legacy.project_submission_id))
            .order_by(EvaluationResult.published_at.desc(),
                      EvaluationResult.id.desc())
            .first())


def ensure_aage_review_for_legacy_result(
    legacy: ExcelGradingResult, actor_id: Optional[int] = None
) -> int:
    """Return an open AAGE review id for a historical Excel result.

    If the submission already has an AAGE result, its review is reused; no new
    evaluation row is created.  Otherwise one compatibility result is created,
    carrying the legacy row's own marks and evidence.
    """
    existing = _latest_aage_result(legacy)
    if existing is None:
        existing = _create_compatibility_result(legacy, actor_id=actor_id)

    review = existing.review
    if review is None:
        review = GradingReview(
            result_id=existing.id,
            status=REVIEW_PENDING,
            ai_score=legacy.total_score,
            final_score=legacy.total_score,
            assigned_to=actor_id,
            created_by=actor_id,
            opened_at=now_local(),
            decision_note="Migrated from a historical Excel grading result.",
        )
        persistence.db_add(review)
        persistence.db_commit()
    return review.id


def _create_compatibility_result(legacy: ExcelGradingResult,
                                 actor_id: Optional[int] = None
                                 ) -> EvaluationResult:
    submission, parent = _submission_context(legacy)
    if submission is None or parent is None:
        raise CompatibilityError("the linked submission no longer exists",
                                 "legacy_submission_missing", 404)

    criteria = _criteria_from_legacy(legacy)
    maximum = max(0.0, float(legacy.max_score or 0)) or sum(
        row["maximum"] for row in criteria) or 100.0
    awarded = max(0.0, min(maximum, float(legacy.total_score or 0)))
    final_score = round(awarded / maximum * 100.0, 2)
    points_possible = float(getattr(parent, "points_possible", None) or maximum)

    snapshot_criteria = [{
        "criterion_key": row["criterion_key"],
        "key": row["criterion_key"],
        "name": row["name"],
        "max_marks": row["maximum"],
        "weight": row["weight"],
        "is_required": True,
        "order_index": row["order_index"],
    } for row in criteria]

    result = EvaluationResult(
        submission_type=legacy.submission_type,
        submission_id=(legacy.assignment_submission_id
                       if legacy.submission_type == "assignment"
                       else legacy.project_submission_id),
        assessment_kind=legacy.submission_type,
        assessment_id=parent.id,
        course_id=legacy.course_id,
        student_id=legacy.student_id,
        rubric_snapshot={
            "status": "approved",
            "source": "legacy_excel_compatibility",
            "legacy_result_id": legacy.id,
            "assessment_spec_version": legacy.assessment_spec_version,
            "criteria": snapshot_criteria,
        },
        total_awarded=awarded,
        total_possible=maximum,
        final_score=final_score,
        grade_letter=legacy.grade_letter or scoring.letter_grade(final_score),
        points_awarded=scoring.scale_to_points(final_score, points_possible),
        confidence=scoring.confidence_score(
            legacy.overall_confidence if legacy.overall_confidence is not None
            else legacy.confidence),
        requires_review=True,
        review_reason="Migrated historical Excel result for instructor review",
        status=RESULT_PENDING_REVIEW,
        feedback=legacy.overall_feedback or "",
        strengths=[],
        improvements=[],
        ai_provider=legacy.ai_provider or "",
        evaluator_versions=[{
            "name": "spreadsheet-legacy",
            "version": (legacy.assessment_spec_version
                        or legacy.rubric_version or "1.0.0"),
        }],
        limitations=[
            "Historical Excel result; workbook bytes are not re-analysed by "
            "this compatibility migration."
        ],
    )
    persistence.db_add(result)
    persistence.db_flush()

    for row in criteria:
        score = CriterionScore(
            result_id=result.id,
            criterion_key=row["criterion_key"],
            name=row["name"],
            awarded=row["awarded"],
            maximum=row["maximum"],
            weight=row["weight"],
            weighted_score=row["weighted_score"],
            rationale="Copied from historical Excel result: " + row["status"],
            evidence_category="CODE_SUPPORTED" if row["evidence"] else "UNVERIFIED",
            verification_status="partial" if row["evidence"] else "unverified",
            evaluator_name="spreadsheet-legacy",
            evaluator_version=(legacy.assessment_spec_version
                               or legacy.rubric_version or "1.0.0"),
            feedback=row["feedback"],
            limitations="Historical evidence only; no live workbook analysis.",
            is_required=True,
            order_index=row["order_index"],
        )
        persistence.db_add(score)
        persistence.db_flush()
        for summary in row["evidence"][:8]:
            persistence.db_add(EvaluationEvidence(
                result_id=result.id,
                criterion_score_id=score.id,
                criterion_key=row["criterion_key"],
                category="CODE_SUPPORTED" if row["evidence"] else "UNVERIFIED",
                source="legacy_excel",
                reference=legacy.file_name or "",
                locator="",
                summary=summary[:700],
                detail={"requirement_status": row["status"],
                        "missing": row["missing"][:5]},
                confidence=scoring.confidence_score(legacy.confidence) / 100.0,
            ))

    analysis = dict(legacy.analysis_data or {})
    analysis["aage_compatibility_result_id"] = result.id
    legacy.analysis_data = analysis
    persistence.audit(
        action="legacy_excel_result_migrated",
        entity_type="evaluation_result",
        entity_id=result.id,
        after={"legacy_result_id": legacy.id,
               "final_score": result.final_score},
        actor_id=actor_id,
        reason="historical Excel result opened in shared AAGE review",
    )
    persistence.db_commit()
    return result


def aage_result_for_legacy(legacy: ExcelGradingResult) -> Optional[EvaluationResult]:
    """Return the AAGE mirror attached to a historical Excel row, if any."""
    existing = _latest_aage_result(legacy)
    if existing is not None:
        return existing
    analysis = legacy.analysis_data or {}
    mirror_id = analysis.get("aage_compatibility_result_id") if isinstance(analysis, dict) else None
    if mirror_id:
        return EvaluationResult.query.get(int(mirror_id))
    return None


def apply_legacy_total_override(legacy: ExcelGradingResult,
                                review_id: int,
                                target_score: Any,
                                actor_id: Optional[int],
                                reason: str) -> EvaluationResult:
    """Translate a legacy whole-score override into AAGE criterion marks.

    The legacy UI only sends a total/letter.  AAGE reviews individual criteria,
    so the total is distributed across the frozen rubric's marks.  Every mark
    change goes through :func:`aage.review.update_criterion_marks`, which
    re-scores with the canonical deterministic scorer and preserves the original
    marks in the audit trail for learning.
    """
    result = EvaluationResult.query.get(review_result_id(review_id))
    if result is None:
        raise CompatibilityError("the linked AAGE result no longer exists")

    maximum = max(0.0, float(result.total_possible or 0)) or sum(
        float(c.maximum or 0) for c in result.criteria.all())
    try:
        target = float(target_score)
    except (TypeError, ValueError, OverflowError):
        raise CompatibilityError("adjusted_score must be a number",
                                 "invalid_adjusted_score")
    if not 0 <= target <= max(maximum, 100.0):
        raise CompatibilityError(
            f"adjusted_score must be between 0 and {max(maximum, 100.0):g}",
            "invalid_adjusted_score")
    if maximum <= 0:
        raise CompatibilityError("the historical result has no scoreable rubric")

    criteria = aage_review._criteria_for_result(result)
    current = aage_review._current_marks(result)
    marks = {key: float(value["marks"]) for key, value in current.items()}
    current_total = sum(marks.values())
    maxima = {c["criterion_key"]: float(c["max_marks"]) for c in criteria}
    if current_total > 0:
        factor = target / current_total
        proposed = {key: min(maxima.get(key, value), value * factor)
                    for key, value in marks.items()}
    else:
        weight_total = sum(float(c["max_marks"]) for c in criteria) or 1.0
        proposed = {c["criterion_key"]: target * float(c["max_marks"]) / weight_total
                    for c in criteria}

    for key, value in proposed.items():
        aage_review.update_criterion_marks(
            review_id, key, round(value, 4), reason, actor_id)
    return EvaluationResult.query.get(result.id)


def review_result_id(review_id: int) -> int:
    """Resolve a review id without importing the route layer."""
    from ...models.aage_models import GradingReview
    review = GradingReview.query.get(int(review_id))
    if review is None:
        raise CompatibilityError("review not found", "review_not_found", 404)
    return int(review.result_id)


def record_legacy_review_metadata(legacy: ExcelGradingResult, *,
                                  review_id: int,
                                  actor_id: Optional[int],
                                  notes: str,
                                  action: str,
                                  adjusted_score: Optional[float] = None,
                                  adjusted_grade: Optional[str] = None) -> None:
    """Mirror review metadata on historical rows without creating a grade."""
    analysis = dict(legacy.analysis_data or {})
    analysis["aage_review_id"] = review_id
    legacy.analysis_data = analysis
    legacy.instructor_notes = notes[:2000] if notes else legacy.instructor_notes
    if action == "override" and adjusted_score is not None:
        legacy.total_score = adjusted_score
        legacy.max_score = legacy.max_score or 100
        legacy.grade_letter = adjusted_grade or scoring.letter_grade(
            adjusted_score / max(float(legacy.max_score), 1) * 100.0)
    legacy.instructor_id = actor_id
    legacy.instructor_reviewed_at = now_local()
    persistence.db_commit()
