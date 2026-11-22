"""Service E — Evaluation Orchestrator.

One submission in, one authoritative :class:`EvaluationResult` out.

Pipeline (each stage is a separate module; this file only sequences them)::

    load submission ─► analyse artefacts ─► classify ─► resolve rubric
                                                    │
                    select evaluators ◄─────────────┘
                            │
                    run specialists (bounded)
                            │
              merge + detect evaluator conflicts
                            │
            scoring.compute_breakdown  (deterministic)
                            │
            confidence.compute_confidence
                            │
                     persist result

Hard rules:

* the model never computes the score — it only proposes per-criterion marks,
  which :mod:`src.services.aage.scoring` clamps and weights;
* an evaluator failure degrades to ``UNVERIFIED``/0 for its criteria, never to
  a guessed mark;
* every run records which evaluators ran, which were rejected and why, and
  every disagreement between them;
* ``submission.grade`` is untouched here — publishing is a separate, explicit
  step (:func:`src.services.aage.persistence.write_through_grade`).
"""

from __future__ import annotations

import logging
import time
import uuid
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence, Tuple

from . import persistence
from .assessment_intelligence import assessment_intelligence
from .confidence import build_confidence_input, compute_confidence
from .constants import (
    EVIDENCE_UNVERIFIED,
    JOB_CANCELLED,
    RESULT_DRAFT,
    RESULT_PENDING_REVIEW,
)
from .evidence import normalise_category
from .rubric_intelligence import RubricIntelligence, normalise_criteria
from .scoring import ScoreBreakdown, ScoringError, compute_breakdown, letter_grade
from .evaluators import registry as evaluator_registry
from .evaluators.base import EvaluationContext, EvaluatorOutput

logger = logging.getLogger("aage.orchestrator")

#: Two evaluators disagreeing by more than this share of the criterion's
#: maximum count as a conflict (recorded, forces review).
CONFLICT_TOLERANCE = 0.15

#: Total wall-clock budget for one evaluation (jobs shorter than this by
#: design; the job timeout is the outer bound).
EVALUATION_BUDGET_SECONDS = 150


class EvaluationError(Exception):
    """Unrecoverable orchestrator failure (bad input, not evaluator noise)."""

    def __init__(self, message: str, code: str = "evaluation_error"):
        super().__init__(message)
        self.message = message
        self.code = code


@dataclass
class EvaluationOutcome:
    """Result of one orchestrator run (mirrors the persisted rows)."""

    job_id: int = 0
    run_id: int = 0
    result_id: int = 0
    correlation_id: str = ""
    status: str = RESULT_PENDING_REVIEW
    final_score: float = 0.0
    grade_letter: str = ""
    confidence: float = 0.0
    requires_review: bool = True
    provisional: bool = False
    review_reason: str = ""
    warnings: List[str] = field(default_factory=list)
    conflicts: List[Dict[str, Any]] = field(default_factory=list)
    budget_exhausted: bool = False
    selected_evaluators: List[str] = field(default_factory=list)
    rejected_evaluators: List[Dict[str, str]] = field(default_factory=list)
    breakdown: Optional[ScoreBreakdown] = None
    error: str = ""

    @property
    def ok(self) -> bool:
        """Whether evaluation itself succeeded.

        ``persist=False`` deliberately produces ``result_id == 0`` (dry runs,
        previews and tests), so a persisted id is *not* a validity signal —
        only an error or a missing breakdown is.
        """
        return not self.error and self.breakdown is not None

    def to_dict(self) -> Dict[str, Any]:
        return {
            "job_id": self.job_id,
            "run_id": self.run_id,
            "result_id": self.result_id,
            "correlation_id": self.correlation_id,
            "status": self.status,
            "final_score": self.final_score,
            "grade_letter": self.grade_letter,
            "confidence": self.confidence,
            "requires_review": self.requires_review,
            "provisional": self.provisional,
            "review_reason": self.review_reason,
            "warnings": self.warnings,
            "conflicts": self.conflicts,
            "selected_evaluators": self.selected_evaluators,
            "rejected_evaluators": self.rejected_evaluators,
            "budget_exhausted": self.budget_exhausted,
            "error": self.error,
        }


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def evaluate_submission(
    submission_type: str,
    submission_id: int,
    *,
    job: Any = None,
    requested_evaluators: Optional[Sequence[str]] = None,
    correlation_id: str = "",
    started_at: Optional[float] = None,
    persist: bool = True,
) -> EvaluationOutcome:
    """Run the full pipeline with a fresh, correlation-scoped usage window.

    The LLM usage accumulator is always opened and always reset — including on
    ``EvaluationError`` and unexpected exceptions — so one job's measured
    counts can never leak into another job or a later API request.
    """
    from . import llm

    correlation_id = correlation_id or uuid.uuid4().hex
    usage_token = llm.start_usage_window(correlation_id=correlation_id)
    try:
        return _evaluate_submission_impl(
            submission_type, submission_id, job=job,
            requested_evaluators=requested_evaluators,
            correlation_id=correlation_id, started_at=started_at,
            persist=persist)
    finally:
        llm.reset_usage_window(usage_token)


def _evaluate_submission_impl(
    submission_type: str,
    submission_id: int,
    *,
    job: Any = None,
    requested_evaluators: Optional[Sequence[str]] = None,
    correlation_id: str = "",
    started_at: Optional[float] = None,
    persist: bool = True,
) -> EvaluationOutcome:
    """Run the pipeline itself (see :func:`evaluate_submission`)."""
    t0 = started_at or time.time()
    correlation_id = correlation_id or uuid.uuid4().hex
    outcome = EvaluationOutcome(correlation_id=correlation_id)

    # -- 1. load ------------------------------------------------------------
    loaded = persistence.load_submission(submission_type, submission_id)
    descriptor = assessment_intelligence.load(loaded.assessment_kind,
                                              loaded.assessment_id)

    # -- 2. rubric (before artefacts: expected deliverables come from it) ---
    rubric_intel = RubricIntelligence()
    raw_snapshot, rubric_row, provisional = rubric_intel.resolve(descriptor)
    snapshot = _normalised_snapshot(raw_snapshot)
    criteria = list(snapshot["criteria"])
    if not criteria:
        raise EvaluationError("rubric resolved to zero criteria", "empty_rubric")
    rubric_version_id = _latest_version_id(rubric_row)

    # -- 3. artefacts -------------------------------------------------------
    from .artifacts import ArtifactAnalyzer
    expected = [str(d) for d in (snapshot.get("deliverables") or [])]
    manifest = ArtifactAnalyzer().analyze(
        submission_type=submission_type,
        submission_id=submission_id,
        files=loaded.files,
        text_content=loaded.text_content,
        expected_deliverables=expected or None,
    )
    if persist and job is not None:
        persistence.save_artifacts(manifest, job.id)

    # -- 4. classify --------------------------------------------------------
    classification = assessment_intelligence.classify(
        descriptor,
        file_names=[f.get("file_name", "") for f in manifest.files],
        file_contents=[f.text[:4000] for f in manifest.source_files[:10]],
    )

    # -- 5. context ---------------------------------------------------------
    ctx = EvaluationContext(
        descriptor=descriptor,
        rubric=snapshot,
        manifest=manifest,
        classification=classification,
        correlation_id=correlation_id,
        learned_examples=_learned_examples(loaded, rubric_row),
    )

    # -- 6. select evaluators ------------------------------------------------
    selected, rejected = evaluator_registry.select_evaluators(
        ctx, requested=requested_evaluators)
    if not selected:
        raise EvaluationError(
            "no evaluator is compatible with this submission",
            "no_evaluator")

    # -- 7. run specialists --------------------------------------------------
    started_run = time.time()
    outputs: List[Tuple[Any, EvaluatorOutput]] = []
    evaluator_records: List[Dict[str, Any]] = []
    warnings: List[str] = list(manifest.warnings)
    budget_exhausted = False

    for ev in selected:
        budget_left = EVALUATION_BUDGET_SECONDS - (time.time() - t0)
        if budget_left <= 5:
            budget_exhausted = True
            warnings.append(f"evaluation budget exhausted before '{ev.name}'")
            evaluator_records.append({
                "name": ev.name, "version": ev.version, "status": "skipped",
                "latency_ms": 0, "error": "budget_exhausted",
            })
            continue
        ev_t0 = time.time()
        try:
            owned = ev.criteria_for(ctx)
            if not owned:
                evaluator_records.append({
                    "name": ev.name, "version": ev.version,
                    "status": "skipped", "latency_ms": 0,
                    "error": "no_matching_criteria",
                })
                continue
            output = ev.evaluate(ctx, owned)
            latency = int((time.time() - ev_t0) * 1000)
            output.latency_ms = output.latency_ms or latency
            outputs.append((ev, output))
            evaluator_records.append({
                "name": ev.name, "version": ev.version,
                "status": "ok" if output.ok else "degraded",
                "latency_ms": output.latency_ms,
                "error": "; ".join(output.errors)[:500] or None,
                "criteria": len(output.criteria),
                "used_llm": output.used_llm,
                "provider": output.provider,
            })
            warnings.extend(f"{ev.name}: {w}" for w in output.warnings)
            for err in output.errors:
                warnings.append(f"{ev.name}: {err}")
        except Exception as exc:  # evaluator bug must not kill the run
            logger.exception("AAGE evaluator '%s' crashed", ev.name)
            evaluator_records.append({
                "name": ev.name, "version": ev.version, "status": "error",
                "latency_ms": int((time.time() - ev_t0) * 1000),
                "error": str(exc)[:500],
            })
            warnings.append(f"evaluator '{ev.name}' crashed: {str(exc)[:200]}")

    if not outputs:
        # A real error code lets the job state machine retry *only* genuinely
        # retryable budget exhaustion instead of hiding it in warning text.
        if budget_exhausted:
            raise EvaluationError(
                "evaluation budget exhausted before any evaluator produced output",
                "budget_exhausted")
        raise EvaluationError("every evaluator failed", "all_evaluators_failed")

    # -- 8. merge + conflicts ------------------------------------------------
    marks_by_key, conflicts = _merge_outputs(outputs, criteria)
    warnings.extend(_conflict_warnings(conflicts))

    # -- 9. deterministic scoring --------------------------------------------
    try:
        breakdown = compute_breakdown(criteria, marks_by_key)
    except ScoringError as exc:
        raise EvaluationError(
            f"rubric failed structural validation: {exc.details or exc}",
            "rubric_invalid") from exc

    # Evidence and verification status must come from the evaluation that won
    # the merge — otherwise the score and its justification can come from
    # different evaluators. The full disagreement is preserved in `conflicts`.
    evidence_by_key: Dict[str, List[Dict[str, Any]]] = {
        key: list(mark.get("evidence") or [])
        for key, mark in marks_by_key.items()
    }
    statuses: Dict[str, str] = {
        key: str(mark.get("verification_status") or "unverified")
        for key, mark in marks_by_key.items()
    }
    for outcome_row in breakdown.criteria:
        statuses.setdefault(outcome_row.criterion_key,
                            outcome_row.verification_status)

    # -- 10. confidence -------------------------------------------------------
    used_llm = any(o.used_llm for _e, o in outputs)
    reliability, calibration_cases, override_rate = _reliability_for(
        [ev.name for ev, _o in outputs])
    unverified_evidence = sum(
        1 for rows in evidence_by_key.values() for item in rows
        if normalise_category(item.get("category")) == EVIDENCE_UNVERIFIED)
    failed_gates = (
        [f"rubric:{problem}" for problem in breakdown.problems]
        + [f"missing:{key}" for key in breakdown.missing_criteria]
        + [f"capped:{key}" for key in breakdown.capped_criteria]
        + [f"evaluator:{record['name']}:{record.get('status')}"
           for record in evaluator_records
           if record.get("status") in ("degraded", "error", "skipped")]
    )
    conf_input = build_confidence_input(
        rubric_snapshot=snapshot,
        criteria=criteria,
        evidence_by_key=evidence_by_key,
        statuses=statuses,
        evaluator_names=[ev.name for ev, _o in outputs],
        conflicts=conflicts,
        evaluator_reliability=reliability,
        historical_override_rate=override_rate,
        calibration_case_count=calibration_cases,
        submission_warnings=warnings[:10],
        missing_deliverables=manifest.missing_deliverables,
        rejected_files=len(manifest.rejected),
        artifacts_resolved=bool(manifest.source_files or manifest.binary_files
                                or manifest.text_content),
        used_llm=used_llm,
        unverified_evidence_count=unverified_evidence,
        failed_deterministic_gates=failed_gates,
        provisional=provisional,
    )
    confidence = compute_confidence(conf_input)

    # -- 11. assemble narrative ----------------------------------------------
    feedback, strengths, improvements = _narrative(outputs, breakdown)
    limitations: List[str] = []
    if provisional:
        limitations.append("provisional rubric — no approved rubric governs this grade")
    if (not manifest.source_files and not manifest.binary_files
            and not (manifest.text_content or "").strip()):
        limitations.append("no submission content was retrieved")
    for record in evaluator_records:
        if record.get("status") in ("degraded", "error"):
            limitations.append(
                f"evaluator '{record['name']}' {record['status']}: "
                f"{record.get('error') or 'unknown'}")
    if manifest.missing_deliverables:
        limitations.append(
            "missing declared deliverables: "
            + ", ".join(manifest.missing_deliverables[:5]))

    requires_review = bool(confidence["requires_review"])
    review_reason = "; ".join(confidence.get("reasons") or [])[:2000]
    if conflicts:
        requires_review = True
        review_reason = (review_reason + "; evaluator disagreement recorded").strip("; ")
    if provisional:
        requires_review = True

    status = RESULT_PENDING_REVIEW if requires_review else RESULT_DRAFT
    duration_ms = int((time.time() - t0) * 1000)

    # -- 12. persist ----------------------------------------------------------
    outcome.selected_evaluators = [ev.name for ev, _o in outputs]
    outcome.rejected_evaluators = rejected
    outcome.conflicts = conflicts
    outcome.budget_exhausted = budget_exhausted
    outcome.warnings = warnings[:40]
    outcome.breakdown = breakdown
    outcome.final_score = breakdown.final_score
    outcome.requires_review = requires_review
    outcome.provisional = provisional
    outcome.review_reason = review_reason
    outcome.confidence = float(confidence["score"])

    if not persist:
        outcome.status = status
        outcome.grade_letter = letter_grade(breakdown.final_score)
        return outcome

    if job is None:
        raise EvaluationError(
            "persist=True requires a grading job", "missing_job")

    # A cancel that lands mid-orchestration must not create an evaluation
    # result.  Read the status from the row, never from the stale ORM object.
    if _job_was_cancelled(job):
        raise EvaluationError("grading job was cancelled", "job_cancelled")

    run = persistence.create_run(
        job, rubric_version_id=rubric_version_id,
        correlation_id=correlation_id, cost_estimate=None)
    outcome.run_id = run.id

    result = persistence.save_result(
        run=run, job=job, loaded=loaded,
        rubric_snapshot=snapshot,
        rubric_id=rubric_row.id if rubric_row is not None else None,
        rubric_version_id=rubric_version_id,
        breakdown=breakdown,
        confidence=confidence,
        feedback=feedback,
        strengths=strengths,
        improvements=improvements,
        evaluator_versions=[{
            "name": ev.name, "version": ev.version,
        } for ev, _o in outputs],
        ai_provider=next((o.provider for _e, o in outputs if o.provider), "") or "",
        limitations=limitations,
        evidence_by_key=evidence_by_key,
        statuses=statuses,
        requires_review=requires_review,
        review_reason=review_reason,
        status=status,
    )
    outcome.result_id = result.id
    outcome.status = status
    outcome.grade_letter = result.grade_letter

    # Honest instrumentation: measured llm_calls/characters from this
    # correlation, plus the real duration_ms above.  cost_estimate stays None
    # because the provider abstraction exposes no token usage or price.
    from . import llm
    usage = llm.get_usage()
    persistence.finish_run(
        run,
        status="succeeded",
        evaluators=evaluator_records,
        artifact_summary=manifest.summary(),
        warnings=warnings[:40],
        conflicts=conflicts,
        provider=result.ai_provider or "",
        duration_ms=duration_ms,
        usage=usage,
        cost_estimate=None,
    )

    if job is not None:
        job.result_id = result.id
        job.progress = {"stage": "evaluated", "result_id": result.id,
                        "score": breakdown.final_score}
        persistence.db_commit()

    logger.info(
        "AAGE evaluation done correlation=%s submission=%s/%s score=%.2f "
        "confidence=%.1f review=%s evaluators=%s conflicts=%d duration_ms=%d",
        correlation_id, submission_type, submission_id, breakdown.final_score,
        confidence["score"], requires_review, outcome.selected_evaluators,
        len(conflicts), duration_ms,
    )
    return outcome


def _job_was_cancelled(job: Any) -> bool:
    """Fresh, identity-map-independent cancellation check for one job."""
    if job is None or not getattr(job, "id", None):
        return False
    from ...models.user_models import db
    try:
        from ...models.aage_models import GradingJob
        with db.session.no_autoflush:
            status = (GradingJob.query
                      .filter(GradingJob.id == job.id)
                      .with_entities(GradingJob.status)
                      .scalar())
        return status == JOB_CANCELLED
    except Exception as exc:  # pragma: no cover - table not available yet
        logger.debug("AAGE cancellation recheck unavailable: %s", exc)
        persistence.db_rollback()
        return False


# ---------------------------------------------------------------------------
# Merge + conflict detection
# ---------------------------------------------------------------------------

def _merge_outputs(
    outputs: Sequence[Tuple[Any, EvaluatorOutput]],
    criteria: Sequence[Dict[str, Any]],
) -> Tuple[Dict[str, Dict[str, Any]], List[Dict[str, Any]]]:
    """Combine specialist outputs into one marks map.

    Ownership: a criterion with an ``evaluator_hint`` belongs to that
    evaluator; unhinted criteria go to the first evaluator that scored them.
    When two evaluators both score an unhinted criterion and disagree by more
    than :data:`CONFLICT_TOLERANCE` of its maximum, the *lower* score wins
    (conservative) and the disagreement is recorded for instructor review.
    """
    hints = {str(c.get("criterion_key") or c.get("key")):
             (c.get("evaluator_hint") or "").strip().lower()
             for c in criteria}
    maxima = {str(c.get("criterion_key") or c.get("key")):
              float(c.get("max_marks") or c.get("maximum") or 0)
              for c in criteria}

    scored: Dict[str, List[Tuple[str, Any]]] = {}
    for ev, output in outputs:
        for evaluation in output.criteria:
            scored.setdefault(evaluation.criterion_key, []).append(
                (ev.name, evaluation))

    marks: Dict[str, Dict[str, Any]] = {}
    conflicts: List[Dict[str, Any]] = []

    for key, all_entries in scored.items():
        hint = hints.get(key, "")
        max_marks = maxima.get(key, 0.0)

        # Conflict detection always sees every evaluation — an evaluator hint
        # must not hide a disagreement involving another evaluator.
        values = [float(e[1].marks) for e in all_entries]
        spread = (max(values) - min(values)) / max_marks if max_marks > 0 else 0.0
        is_conflict = len(all_entries) > 1 and spread > CONFLICT_TOLERANCE

        candidates = all_entries
        hint_owner_available = False
        if hint:
            preferred = [e for e in all_entries if e[0].lower() == hint]
            if preferred:
                candidates = preferred
                hint_owner_available = True

        if len(candidates) == 1:
            winner = candidates[0]
        elif spread > CONFLICT_TOLERANCE:
            # Conservative on real disagreement, including among hint owners.
            winner = min(candidates, key=lambda e: float(e[1].marks))
        else:
            winner = max(candidates,
                         key=lambda e: (float(e[1].confidence), -float(e[1].marks)))
        marks[key] = _as_mark(winner[1])

        if is_conflict:
            # Report what actually won, not what the hint *would* have chosen.
            if hint_owner_available and winner[0].lower() == hint:
                resolution = "hint_owner_selected"
            elif spread > CONFLICT_TOLERANCE:
                resolution = "lower_score_selected"
            else:
                resolution = "highest_confidence_selected"
            conflicts.append({
                "criterion_key": key,
                "tolerance": CONFLICT_TOLERANCE,
                "spread": round(spread, 4),
                "scores": [
                    {"evaluator": name, "marks": float(e.marks),
                     "max_marks": float(e.max_marks),
                     "confidence": float(e.confidence),
                     "rationale": (e.rationale or "")[:400]}
                    for name, e in all_entries
                ],
                "resolution": resolution,
                "selected_evaluator": winner[0],
                "selected_marks": float(winner[1].marks),
            })

    return marks, conflicts


def _as_mark(evaluation: Any) -> Dict[str, Any]:
    return {
        "marks": float(evaluation.marks),
        "rationale": evaluation.rationale,
        "evidence_category": evaluation.evidence_category,
        "verification_status": evaluation.verification_status,
        "feedback": evaluation.feedback,
        "limitations": evaluation.limitations,
        "evaluator_name": evaluation.evaluator_name,
        "evaluator_version": evaluation.evaluator_version,
        "evidence": evaluation.evidence,
    }


def _conflict_warnings(conflicts: Sequence[Dict[str, Any]]) -> List[str]:
    return [
        f"evaluators disagree on '{c.get('criterion_key')}' "
        f"(spread {float(c.get('spread') or 0):.0%}); "
        f"resolved by {c.get('resolution', 'conservative selection')}"
        for c in conflicts
    ]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _normalised_snapshot(snapshot: Dict[str, Any]) -> Dict[str, Any]:
    """Return a copy of ``snapshot`` whose criteria are scoring-ready.

    The frozen rubric stored on the result must be exactly what was scored,
    so the normalisation happens once, here, and the result feeds both the
    evaluators (via ``ctx.rubric``) and :func:`compute_breakdown`.
    """
    criteria = _criteria_from_snapshot(snapshot)
    if not criteria:
        return dict(snapshot)
    out = dict(snapshot)
    out["criteria"] = criteria
    out["weight_total"] = round(sum(c["weight"] for c in criteria), 4)
    return out


def _criteria_from_snapshot(snapshot: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Normalise rubric criteria into scoring-ready dicts.

    Handles both generations of rubric rows: new-style criteria carry
    ``criterion_key``/``max_marks``, legacy rows only carry
    ``max_points``/``order_index`` and often leave ``weight`` at 0.
    """
    raw: List[Dict[str, Any]] = []
    for idx, crit in enumerate(snapshot.get("criteria") or []):
        c = dict(crit)
        # canonical key: prefer the stored criterion_key so it survives
        if (c.get("criterion_key") or "").strip():
            c["key"] = str(c["criterion_key"]).strip()
        # legacy rows expose max_points / maximum instead of max_marks
        if not c.get("max_marks"):
            c["max_marks"] = c.get("max_marks") or c.get("maximum") or c.get("max_points") or 0
        c.pop("maximum", None)
        c.pop("max_points", None)
        if not (c.get("name") or "").strip():
            c["name"] = f"Criterion {idx + 1}"
        raw.append(c)

    if not raw:
        return []

    # Legacy rubrics pre-date weighting (every weight is 0).  Distribute the
    # 100% across criteria in proportion to their maximum marks so the
    # scoring formula stays meaningful; :func:`normalise_criteria` then
    # rounds and dedupes.
    total_weight = sum(float(c.get("weight") or 0) for c in raw)
    if total_weight <= 0:
        points = sum(float(c.get("max_marks") or 0) for c in raw)
        if points > 0:
            for c in raw:
                c["weight"] = round(float(c.get("max_marks") or 0) / points * 100.0, 4)
        else:
            share = round(100.0 / len(raw), 4)
            for c in raw:
                c["weight"] = share

    normalised, problems = normalise_criteria(raw)
    for problem in problems:
        logger.warning("AAGE rubric normalisation: %s", problem)

    criteria: List[Dict[str, Any]] = []
    for idx, crit in enumerate(normalised):
        key = str(crit.get("key") or crit.get("criterion_key")
                  or f"criterion_{idx}")[:80]
        criteria.append({
            "criterion_key": key,
            "key": key,
            "id": crit.get("id"),
            "name": str(crit.get("name") or key)[:200],
            "description": str(crit.get("description") or ""),
            "max_marks": float(crit.get("max_marks") or 0),
            "weight": float(crit.get("weight") or 0),
            "is_required": (True if crit.get("is_required") is None
                            else bool(crit.get("is_required"))),
            "order_index": int(crit.get("order_index") or idx),
            "levels": crit.get("levels") or crit.get("performance_levels") or [],
            "performance_levels": crit.get("levels") or crit.get("performance_levels") or [],
            "evidence_requirements": crit.get("evidence_requirements") or [],
            "evidence_category": crit.get("evidence_category"),
            "evaluator_hint": crit.get("evaluator_hint") or "",
            "evaluator_instructions": crit.get("evaluator_instructions") or "",
        })

    drift = round(100.0 - sum(c["weight"] for c in criteria), 4)
    if criteria and abs(drift) > 0.0001:
        criteria[-1]["weight"] = round(criteria[-1]["weight"] + drift, 4)
    return criteria


def _latest_version_id(rubric_row: Any) -> Optional[int]:
    """Highest :class:`RubricVersion` id for a rubric, if any has been cut."""
    if rubric_row is None:
        return None
    try:
        from ...models.aage_models import RubricVersion
        row = (RubricVersion.query
               .filter_by(rubric_id=rubric_row.id)
               .order_by(RubricVersion.version.desc())
               .first())
        return row.id if row is not None else None
    except Exception as exc:  # pragma: no cover - table may not exist yet
        logger.debug("rubric version lookup failed: %s", exc)
        return None


def _learned_examples(loaded: persistence.LoadedSubmission,
                      rubric_row: Any) -> List[Dict[str, Any]]:
    """Approved instructor corrections relevant to this submission."""
    try:
        from ...models.aage_models import LearningExample
        query = LearningExample.query.filter_by(status="approved")
        version_id = _latest_version_id(rubric_row)
        if version_id is not None:
            query = query.filter(LearningExample.rubric_version_id == version_id)
        else:
            # No frozen version for this rubric yet — fall back to the
            # assessment id rather than conflating a rubric id with a version id.
            query = query.filter(
                LearningExample.assessment_id == loaded.assessment_id)
        rows = query.order_by(LearningExample.id.desc()).limit(5).all()
        return [{
            "original_scores": r.original_scores or {},
            "instructor_scores": r.instructor_scores or {},
            "score_delta": r.score_delta,
            "explanation": (r.explanation or "")[:1000],
        } for r in rows]
    except Exception as exc:  # pragma: no cover - table may not exist yet
        logger.debug("learned examples unavailable: %s", exc)
        return []


def _reliability_for(names: Sequence[str]
                     ) -> Tuple[Optional[float], int, Optional[float]]:
    """Benchmark reliability for the evaluators that ran (0-1 or None)."""
    try:
        from ...models.aage_models import CalibrationCase, EvaluatorVersion
        wanted = list(set(names))
        rows = (EvaluatorVersion.query
                .filter(EvaluatorVersion.name.in_(wanted),
                        EvaluatorVersion.status == "active")
                .all())
        agreements = [r.criterion_agreement for r in rows
                      if r.criterion_agreement is not None]
        overrides = [r.override_rate for r in rows
                     if r.override_rate is not None]
        reliability = (sum(agreements) / len(agreements)) if agreements else None
        override_rate = (sum(overrides) / len(overrides)) if overrides else None
        cases = (CalibrationCase.query
                 .filter(CalibrationCase.verdict.in_(["improved", "regressed"]))
                 .count())
        return reliability, int(cases), override_rate
    except Exception as exc:  # pragma: no cover
        logger.debug("evaluator reliability unavailable: %s", exc)
        return None, 0, None


def _narrative(outputs: Sequence[Tuple[Any, EvaluatorOutput]],
               breakdown: ScoreBreakdown) -> Tuple[str, List[str], List[str]]:
    """One coherent feedback block from the specialist outputs."""
    feedback_parts: List[str] = []
    strengths: List[str] = []
    improvements: List[str] = []
    for _ev, output in outputs:
        if output.overall_feedback:
            feedback_parts.append(output.overall_feedback.strip())
        for item in (output.strengths or [])[:5]:
            if item not in strengths:
                strengths.append(item)
        for item in (output.improvements or [])[:5]:
            if item not in improvements:
                improvements.append(item)

    header = (
        f"AI analysis: {breakdown.final_score:.1f}% "
        f"({breakdown.total_awarded:.1f}/{breakdown.total_possible:.1f} marks)."
    )
    weakest = sorted(
        (c for c in breakdown.criteria if c.maximum > 0),
        key=lambda c: c.percent)[:2]
    if weakest:
        header += " Focus areas: " + ", ".join(
            f"{c.name} ({c.percent:.0f}%)" for c in weakest) + "."

    body = "\n\n".join(feedback_parts)[:6000]
    feedback = (header + ("\n\n" + body if body else "")).strip()
    return feedback, strengths[:10], improvements[:10]

