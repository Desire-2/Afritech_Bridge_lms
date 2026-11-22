"""Service L — Confidence & Quality Assurance.

Confidence is a measure of *how much the evidence supports the awarded score*,
never a function of the score itself.  Two submissions with the same marks can
have very different confidence.

Bands (configurable, see :mod:`src.services.aage.policies`):

===========  ==========================================================
90 – 100     eligible for automatic publication when every gate passes
75 – 89      provisional — instructor review required
< 75         instructor review required
===========  ==========================================================

A rubric that is not approved always forces review, whatever the number.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from .constants import EVIDENCE_VERIFIED, EVIDENCE_UNVERIFIED
from .evidence import normalise_category, normalise_status, summarise_evidence
from .policies import confidence_policy

#: Verdict returned by :func:`hard_gate_failures_for_result` when every
#: deterministic gate passed.  All other values are machine-readable reasons.
GATE_PASSED = "passed"

logger = logging.getLogger("aage.confidence")

#: factor name → contribution to the final 0-100 value
FACTOR_WEIGHTS = {
    "rubric_clarity": 0.16,
    "evidence_completeness": 0.20,
    "evidence_quality": 0.16,
    "verification_availability": 0.12,
    "evaluator_agreement": 0.10,
    "evaluator_reliability": 0.12,
    "submission_quality": 0.08,
    "calibration_history": 0.06,
}

BAND_AUTO = "auto_publish"
BAND_PROVISIONAL = "provisional"
BAND_REVIEW = "review"


@dataclass
class ConfidenceInput:
    """Everything the calculator needs (all optional, all defaulted)."""

    rubric_status: str = "approved"           # approved | profile | provisional | draft
    rubric_weight_total: float = 100.0
    rubric_levels_coverage: float = 1.0       # 0-1 share of criteria with levels
    rubric_evidence_requirements: float = 1.0  # 0-1 share declaring evidence needs
    criterion_count: int = 0
    criteria_with_evidence: int = 0
    evidence_stats: Dict[str, Any] = field(default_factory=dict)
    verified_criteria: int = 0
    unverified_criteria: int = 0
    evaluator_names: Sequence[str] = ()
    conflict_count: int = 0
    conflict_details: Sequence[Dict[str, Any]] = ()
    evaluator_reliability: Optional[float] = None      # 0-1, from EvaluatorVersion
    historical_override_rate: Optional[float] = None   # 0-1
    calibration_case_count: int = 0
    submission_warnings: Sequence[str] = ()
    missing_deliverables: Sequence[str] = ()
    rejected_files: int = 0
    artifacts_resolved: bool = True
    used_llm: bool = True
    # Extra hard-gate signals populated by the orchestrator.  They never
    # inflate confidence; when require_all_gates is on they can only force
    # review.
    unverified_evidence_count: int = 0
    failed_deterministic_gates: Sequence[str] = ()
    provisional: bool = False


def _finite(value: float, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return number if math.isfinite(number) else default


def _ratio(numerator: float, denominator: float) -> float:
    numerator = _finite(numerator)
    denominator = _finite(denominator)
    if not denominator:
        return 0.0
    return max(0.0, min(1.0, numerator / denominator))


def _clamp01(value: float) -> float:
    return max(0.0, min(1.0, _finite(value)))


def hard_gate_failures(*, rubric_status: str = "approved",
                       unverified_criteria: int = 0,
                       unverified_evidence: int = 0,
                       failed_deterministic_gates: Sequence[str] = (),
                       conflicts: Sequence[Dict[str, Any]] = (),
                       provisional: bool = False,
                       requires_review: bool = False) -> List[str]:
    """Deterministic reasons why a result may **not** be auto-published.

    This is intentionally conservative and additive: every gate is a real,
    recorded fact from the evaluation (never a model opinion).  An empty list
    means all gates passed.  ``require_all_gates`` decides whether these facts
    block publication; it is authoritative for the automatic path.
    """
    failures: List[str] = []
    if provisional or rubric_status in ("provisional", "draft"):
        failures.append("provisional_rubric")
    if unverified_criteria > 0:
        failures.append("unverified_criteria")
    if unverified_evidence > 0:
        failures.append("unverified_evidence")
    if failed_deterministic_gates:
        failures.append("failed_deterministic_gate")
    if conflicts:
        failures.append("unresolved_conflicts")
    if requires_review:
        failures.append("review_required")
    return failures


def hard_gate_failures_for_result(result: Any) -> List[str]:
    """Re-check the hard gates from persisted rows before any publication.

    The report computed during evaluation is honoured when present, but the
    live rows are always checked as well so a later review edit, supersession
    or status change cannot make a stale result auto-publishable.
    """
    snapshot = result.rubric_snapshot if isinstance(
        getattr(result, "rubric_snapshot", None), dict) else {}
    stored = (result.confidence_factors or {}).get("hard_gate_failures") \
        if isinstance(getattr(result, "confidence_factors", None), dict) else []
    failures = {str(code) for code in (stored or [])}

    failures.update(hard_gate_failures(
        rubric_status=str(snapshot.get("status") or "approved"),
        provisional=bool(
            (snapshot.get("status") in ("provisional", "draft"))
            or any("provisional rubric" in str(item).lower()
                   for item in (result.limitations or []))),
        requires_review=bool(result.requires_review),
    ))

    # Conflicts live on the evaluation run (no schema change needed).
    try:
        from ...models.aage_models import EvaluationRun
        run = EvaluationRun.query.get(result.run_id) if result.run_id else None
        conflicts = list((run.conflicts if run else None) or [])
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE conflict recheck unavailable: %s", exc)
        conflicts = []
    if conflicts or "evaluator disagreement" in (result.review_reason or "").lower():
        failures.add("unresolved_conflicts")

    try:
        scores = list(result.criteria.all())
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE criterion recheck unavailable: %s", exc)
        scores = []
    unverified_criteria = sum(
        1 for score in scores
        if normalise_status(getattr(score, "verification_status", ""))
        != "verified")
    if unverified_criteria:
        failures.add("unverified_criteria")
    if any("did not pass" in str(getattr(score, "limitations", "")).lower()
           for score in scores):
        failures.add("failed_deterministic_gate")

    try:
        evidence_rows = list(result.evidence.all())
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE evidence recheck unavailable: %s", exc)
        evidence_rows = []
    if any(normalise_category(getattr(row, "category", ""))
           == EVIDENCE_UNVERIFIED for row in evidence_rows):
        failures.add("unverified_evidence")

    return sorted(failures)


def compute_confidence(inp: ConfidenceInput) -> Dict[str, Any]:
    """Return ``{"score", "band", "factors", "requires_review", "reasons"}``."""
    policy = confidence_policy()
    factors: Dict[str, float] = {}
    reasons: List[str] = []

    # 1. rubric clarity ----------------------------------------------------
    if inp.rubric_status == "approved":
        clarity = 1.0
    elif inp.rubric_status == "profile":
        clarity = 0.9
    elif inp.rubric_status == "draft":
        clarity = 0.45
    else:  # provisional — no approved rubric governs this grade
        clarity = 0.5
        reasons.append("no approved rubric; a provisional rubric was used")
    if abs(_finite(inp.rubric_weight_total) - 100.0) > 0.01:
        clarity *= 0.7
        reasons.append(f"rubric weights total {inp.rubric_weight_total}%")
    clarity *= (0.6 + 0.4 * _clamp01(inp.rubric_levels_coverage))
    clarity *= (0.7 + 0.3 * _clamp01(inp.rubric_evidence_requirements))
    factors["rubric_clarity"] = _clamp01(clarity)

    # 2. evidence completeness --------------------------------------------
    completeness = _ratio(inp.criteria_with_evidence, inp.criterion_count)
    factors["evidence_completeness"] = _clamp01(completeness)
    if inp.criterion_count and completeness < 1.0:
        reasons.append(
            f"{inp.criterion_count - inp.criteria_with_evidence} criterion/criteria "
            "have no supporting evidence")

    # 3. evidence quality --------------------------------------------------
    stats = inp.evidence_stats or {}
    quality = _finite(stats.get("avg_trust"))
    if not stats.get("count"):
        quality = 0.0
        reasons.append("no evidence records were produced")
    factors["evidence_quality"] = _clamp01(quality)

    # 4. verification availability ----------------------------------------
    if inp.criterion_count:
        verified_share = _ratio(inp.verified_criteria, inp.criterion_count)
        unverified_share = _ratio(inp.unverified_criteria, inp.criterion_count)
        verification = 0.35 + 0.65 * verified_share
        verification *= (1.0 - 0.5 * unverified_share)
        if unverified_share > 0:
            reasons.append(f"{inp.unverified_criteria} criterion/criteria are unverified")
    else:
        verification = 0.0
    factors["verification_availability"] = _clamp01(verification)

    # 5. evaluator agreement ----------------------------------------------
    if not inp.evaluator_names:
        agreement = 0.6
    else:
        possible = max(1, len(inp.evaluator_names) * (len(inp.evaluator_names) - 1) // 2)
        if len(inp.evaluator_names) < 2:
            agreement = 0.75
        else:
            agreement = 1.0 - _ratio(inp.conflict_count, possible)
        if inp.conflict_count:
            reasons.append(f"{inp.conflict_count} evaluator disagreement(s) detected")
    factors["evaluator_agreement"] = _clamp01(agreement)

    # 6. evaluator reliability (version history) ---------------------------
    if inp.evaluator_reliability is not None:
        reliability = _clamp01(inp.evaluator_reliability)
    else:
        reliability = 0.72  # unproven evaluator — neutral, slightly cautious
        reasons.append("evaluator has no benchmark history yet")
    factors["evaluator_reliability"] = reliability

    # 7. submission quality ------------------------------------------------
    penalties = 0.0
    if inp.missing_deliverables:
        penalties += min(0.5, 0.2 * len(inp.missing_deliverables))
        reasons.append(f"missing deliverables: {', '.join(list(inp.missing_deliverables)[:4])}")
    if not inp.artifacts_resolved:
        penalties += 0.35
        reasons.append("submission artefacts could not be fully retrieved")
    penalties += min(0.25, 0.05 * len(inp.submission_warnings or ()))
    penalties += min(0.2, 0.05 * inp.rejected_files)
    factors["submission_quality"] = _clamp01(1.0 - penalties)

    # 8. calibration history ----------------------------------------------
    if inp.calibration_case_count > 0 and inp.historical_override_rate is not None:
        calibration = _clamp01(1.0 - _clamp01(inp.historical_override_rate))
    elif inp.calibration_case_count > 0:
        calibration = 0.8
    else:
        calibration = 0.6
        if inp.used_llm:
            reasons.append("no calibration data for this evaluator yet")
    factors["calibration_history"] = _clamp01(calibration)

    score = 100.0 * sum(
        factors[name] * weight for name, weight in FACTOR_WEIGHTS.items())
    score = round(max(0.0, min(100.0, score)), 2)

    if score >= float(policy.get("auto_publish_min", 90.0)):
        band = BAND_AUTO
    elif score >= float(policy.get("provisional_min", 75.0)):
        band = BAND_PROVISIONAL
    else:
        band = BAND_REVIEW

    # An unapproved rubric always forces review — policy, not arithmetic.
    if inp.rubric_status in ("provisional", "draft"):
        band = BAND_REVIEW
        reasons.append("mandatory review: rubric is not instructor-approved")

    conflict_records = list(inp.conflict_details) or [
        {}] * int(inp.conflict_count or 0)
    gate_failures = hard_gate_failures(
        rubric_status=inp.rubric_status,
        unverified_criteria=int(inp.unverified_criteria or 0),
        unverified_evidence=int(inp.unverified_evidence_count or 0),
        failed_deterministic_gates=inp.failed_deterministic_gates,
        conflicts=conflict_records,
        provisional=inp.provisional,
    )
    if bool(policy.get("require_all_gates", True)) and gate_failures:
        # A high number can never buy its way past an unverified gate.
        band = BAND_REVIEW
        reasons.extend(f"hard gate: {code}" for code in gate_failures)

    requires_review = band != BAND_AUTO

    return {
        "score": score,
        "band": band,
        "factors": {k: round(v, 3) for k, v in factors.items()},
        "requires_review": requires_review,
        "reasons": reasons[:12],
        "hard_gate_failures": gate_failures,
        "policy": {
            "auto_publish_min": policy.get("auto_publish_min", 90.0),
            "provisional_min": policy.get("provisional_min", 75.0),
            "auto_publish_enabled": bool(policy.get("auto_publish_enabled")),
            "require_all_gates": bool(policy.get("require_all_gates", True)),
        },
    }


def build_confidence_input(*, rubric_snapshot: Dict[str, Any],
                           criteria: Sequence[Dict[str, Any]],
                           evidence_by_key: Dict[str, List[Dict[str, Any]]],
                           statuses: Dict[str, str],
                           evaluator_names: Sequence[str],
                           conflicts: Sequence[Dict[str, Any]] = (),
                           evaluator_reliability: Optional[float] = None,
                           historical_override_rate: Optional[float] = None,
                           calibration_case_count: int = 0,
                           submission_warnings: Sequence[str] = (),
                           missing_deliverables: Sequence[str] = (),
                           rejected_files: int = 0,
                           artifacts_resolved: bool = True,
                           used_llm: bool = True,
                           unverified_evidence_count: int = 0,
                           failed_deterministic_gates: Sequence[str] = (),
                           provisional: bool = False) -> ConfidenceInput:
    """Adapter that turns engine internals into a :class:`ConfidenceInput`."""
    total = len(criteria)
    with_evidence = sum(1 for c in criteria
                        if evidence_by_key.get(c.get("criterion_key") or c.get("key")))
    levels_cov = _ratio(sum(1 for c in criteria if c.get("levels")), total) if total else 0.0
    evidence_cov = _ratio(
        sum(1 for c in criteria if c.get("evidence_requirements")), total) if total else 0.0
    verified = sum(1 for c in criteria
                   if normalise_status(statuses.get(c.get("criterion_key") or c.get("key")))
                   == "verified")
    unverified = sum(1 for c in criteria
                     if normalise_category(
                         _category_for(c, evidence_by_key)) == EVIDENCE_UNVERIFIED)

    all_evidence = [e for rows in evidence_by_key.values() for e in rows]
    stats = summarise_evidence(all_evidence)

    return ConfidenceInput(
        rubric_status=str(rubric_snapshot.get("status") or "approved"),
        rubric_weight_total=float(rubric_snapshot.get("weight_total") or 0),
        rubric_levels_coverage=levels_cov,
        rubric_evidence_requirements=evidence_cov,
        criterion_count=total,
        criteria_with_evidence=with_evidence,
        evidence_stats=stats,
        verified_criteria=verified,
        unverified_criteria=unverified,
        evaluator_names=evaluator_names,
        conflict_count=len(conflicts),
        conflict_details=conflicts,
        evaluator_reliability=evaluator_reliability,
        historical_override_rate=historical_override_rate,
        calibration_case_count=calibration_case_count,
        submission_warnings=submission_warnings,
        missing_deliverables=missing_deliverables,
        rejected_files=rejected_files,
        artifacts_resolved=artifacts_resolved,
        used_llm=used_llm,
        unverified_evidence_count=unverified_evidence_count,
        failed_deterministic_gates=failed_deterministic_gates,
        provisional=provisional,
    )


def _category_for(criterion: Dict[str, Any],
                  evidence_by_key: Dict[str, List[Dict[str, Any]]]) -> str:
    key = criterion.get("criterion_key") or criterion.get("key")
    rows = evidence_by_key.get(key) or []
    if not rows:
        return EVIDENCE_UNVERIFIED
    return rows[0].get("category", EVIDENCE_UNVERIFIED)
