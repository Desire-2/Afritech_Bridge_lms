"""Service O — AAGE dashboard analytics.

Every figure is derived from persisted AAGE rows.  Where a denominator is zero
the rate is ``None`` together with an explicit denominator, so the dashboard
never presents a fabricated success rate for an empty system.
"""

from __future__ import annotations

import logging
from statistics import mean
from typing import Any, Dict, List, Optional, Tuple

from ...models.aage_models import (
    EvaluationResult,
    EvaluationRun,
    EvaluatorVersion,
    GradingJob,
    GradingReview,
    LearningExample,
)
from .constants import (
    EVALUATOR_ACTIVE,
    JOB_FAILED,
    JOB_SUCCEEDED,
    LEARNING_APPROVED,
    OPEN_REVIEW_STATUSES,
    REVIEW_APPROVED,
    REVIEW_CHANGES,
    REVIEW_PENDING,
    REVIEW_REJECTED,
)

logger = logging.getLogger("aage.analytics")

SCORE_BUCKETS = ((0, 20), (20, 40), (40, 60), (60, 70),
                 (70, 80), (80, 90), (90, 101))
CONFIDENCE_BUCKETS = ((0, 25), (25, 50), (50, 75), (75, 90), (90, 101))


def _submissions(course_id: Optional[int]) -> set:
    pairs: set = set()
    for model in (EvaluationResult, GradingJob):
        query = model.query
        if course_id is not None:
            query = query.filter(model.course_id == course_id)
        for row in query.with_entities(
                model.submission_type, model.submission_id).all():
            if row[0] and row[1] is not None:
                pairs.add((row[0], row[1]))
    return pairs


def _distribution(values: List[float], buckets: Tuple[Tuple[int, int], ...]
                  ) -> List[Dict[str, Any]]:
    rows: List[Dict[str, Any]] = []
    for low, high in buckets:
        count = sum(1 for v in values if low <= v < high)
        rows.append({"min": low, "max": high if high <= 100 else 100,
                     "count": count})
    return rows


def dashboard_metrics(course_id: Optional[int] = None) -> Dict[str, Any]:
    """Dashboard figures, optionally restricted to one course."""
    result_query = EvaluationResult.query
    job_query = GradingJob.query
    review_query = GradingReview.query
    run_query = EvaluationRun.query
    example_query = LearningExample.query
    version_query = EvaluatorVersion.query

    if course_id is not None:
        result_query = result_query.filter(EvaluationResult.course_id == course_id)
        # Runs/jobs/reviews/examples are joined through their owning result.
        result_ids = result_query.with_entities(EvaluationResult.id)
        job_query = GradingJob.query.filter(GradingJob.id.in_(
            result_query.with_entities(EvaluationResult.job_id)))
        run_ids = result_query.with_entities(EvaluationResult.run_id)
        run_query = EvaluationRun.query.filter(EvaluationRun.id.in_(run_ids))
        review_query = GradingReview.query.filter(
            GradingReview.result_id.in_(result_ids))
        example_query = example_query.filter(
            LearningExample.result_id.in_(result_ids))

    results = result_query.all()
    review_rows = review_query.all()
    jobs = job_query.all()
    runs = run_query.all()
    examples = example_query.all()

    total_submissions = len(_submissions(course_id))
    auto_graded = sum(1 for r in results if not r.requires_review)
    # ``changes_requested`` is still waiting on an instructor decision.
    pending_reviews = sum(1 for r in review_rows
                          if r.status in OPEN_REVIEW_STATUSES)
    failed_jobs = sum(1 for j in jobs if j.status == JOB_FAILED)

    durations = [float(r.duration_ms) for r in runs
                 if r.duration_ms is not None]
    average_ms = round(mean(durations), 2) if durations else None

    resolved = [r for r in review_rows
                if r.status in (REVIEW_APPROVED, REVIEW_REJECTED)]
    corrected = [r for r in resolved
                 if (r.correction_reason or "").strip()]
    correction_rate = (round(len(corrected) / len(resolved), 4)
                       if resolved else None)

    # Per-evaluator performance: version benchmarks are the only trustworthy
    # source of evaluator quality metrics; unknown values stay None.
    versions = version_query.order_by(EvaluatorVersion.name,
                                      EvaluatorVersion.id).all()
    per_evaluator: Dict[str, Any] = {}
    for version in versions:
        entry = per_evaluator.setdefault(version.name, {
            "active_version": None,
            "versions": [],
        })
        if version.status == EVALUATOR_ACTIVE:
            entry["active_version"] = version.version
        entry["versions"].append({
            "id": version.id,
            "version": version.version,
            "status": version.status,
            "mae": version.benchmark_mae,
            "criterion_agreement": version.criterion_agreement,
            "false_pass_rate": version.false_pass_rate,
            "false_fail_rate": version.false_fail_rate,
            "override_rate": version.override_rate,
            "sample_count": version.sample_count,
        })

    scores = [float(r.final_score) for r in results
              if r.final_score is not None]
    confidences = [float(r.confidence) for r in results
                   if r.confidence is not None]

    return {
        "course_id": course_id,
        "total_submissions": total_submissions,
        "auto_graded_count": auto_graded,
        "pending_reviews": pending_reviews,
        "failed_jobs": failed_jobs,
        "average_processing_time": {
            "ms": average_ms,
            "seconds": round(average_ms / 1000.0, 3) if average_ms is not None else None,
            "sample_count": len(durations),
        },
        "instructor_correction_rate": {
            "rate": correction_rate,
            "corrected": len(corrected),
            "resolved_reviews": len(resolved),
        },
        "per_evaluator_performance": per_evaluator,
        "score_distribution": _distribution(scores, SCORE_BUCKETS),
        "confidence_distribution": _distribution(confidences, CONFIDENCE_BUCKETS),
        "review_status_counts": {
            status: sum(1 for r in review_rows if r.status == status)
            for status in (REVIEW_PENDING, REVIEW_CHANGES, REVIEW_APPROVED,
                           REVIEW_REJECTED)
        },
        "learning_examples": {
            "total": len(examples),
            "approved": sum(1 for e in examples
                            if e.status == LEARNING_APPROVED),
        },
        "jobs_succeeded": sum(1 for j in jobs if j.status == JOB_SUCCEEDED),
        "results_count": len(results),
    }


__all__ = ["dashboard_metrics"]
