"""Excel-style auto-approval for AAGE results.

The legacy Excel grader publishes automatically when its assessment produced
no manual-review requirement, no critical failure and a confidence of at least
0.7.  AAGE has a stricter *meta*-confidence gate (``auto_publish``) which also
requires every criterion to be deterministically ``verified``; that is useful
for high-stakes work but means ordinary, properly evidenced submissions can sit
in review forever.

This module implements the Excel-style decision as a **separate, default-on**
track.  It deliberately ignores the ``unverified_criteria``,
``unverified_evidence`` and ``review_required`` signals when the underlying
evidence is genuinely present (``CODE_SUPPORTED`` / ``CONTENT_SUPPORTED``), but
it still blocks on every real failure: a failed deterministic check, evaluator
conflict, degraded/fallback provider, or no substantive artifact evidence.
Deterministic specialists (currently ``spreadsheet``) may publish with a
provisional rubric and with UNVERIFIED absence evidence, because those are
expected outputs of static analysis and must not hide the student's score and
corrective feedback.

AAGE confidence is a meta-confidence over the *grading process*, so it can be
low purely because criterion status was ``unverified`` even when the score is
well evidenced.  For the Excel-style track only, :func:`approval_confidence`
re-normalises the process factors after removing evidence-verification and
calibration-history factors.  That produces a comparable "can we trust this
grade?" number without changing the authoritative confidence stored on the
result or the strict ``auto`` publication path.

Nothing here writes a grade — the caller uses
:func:`persistence.write_through_grade` with the ``auto_approved`` publication
mode.
"""

from __future__ import annotations

import json
import logging
import math
from typing import Any, Dict, List, Sequence, Tuple

from .confidence import FACTOR_WEIGHTS
from .constants import EVIDENCE_UNVERIFIED
from .evidence import normalise_category
from .policies import confidence_policy

logger = logging.getLogger("aage.auto_approval")

#: Factors that describe process maturity/verification rather than whether the
#: awarded marks are trustworthy under Excel-style rules.
_EXCLUDED_APPROVAL_FACTORS = frozenset({
    "evidence_completeness", "evidence_quality",
    "verification_availability", "calibration_history",
})

#: Meta-confidence explanations that are allowed to depress AAGE's own score
#: but must not depress the Excel-style publication score.
_IGNORED_REASON_FRAGMENTS = (
    "have no supporting evidence",
    "no evidence records were produced",
    "are unverified",
    "evaluator has no benchmark history yet",
    "no calibration data for this evaluator yet",
    # Already reflected in the retained `submission_quality` factor.
    "missing deliverables:",
    "hard gate: unverified_criteria",
    "hard gate: unverified_evidence",
    "hard gate: review_required",
)

#: Recorded hard gates that are Excel-style blockers. ``unverified_criteria``,
#: ``unverified_evidence`` and ``review_required`` are intentionally absent.
_BLOCKING_HARD_GATES = frozenset({
    "provisional_rubric", "failed_deterministic_gate", "unresolved_conflicts",
})

_BLOCKING_TEXT_FRAGMENTS = (
    "provisional rubric",
    "no approved rubric",
    "did not pass",
    "disagreement",
    "deterministic check",
)

#: A result produced by a stub/fallback provider is not a real assessment. It
#: may be kept for debugging, but it must never publish a student grade.
_FALLBACK_PROVIDERS = frozenset({
    "offline", "offline-stub", "offline_stub",
    "mock", "fallback",
})

#: Evaluators whose marks come from deterministic static analyzers rather than
#: a model. Their evidence rows are the assessment, so process-maturity signals
#: such as "provisional rubric" or UNVERIFIED absence evidence must not hide the
#: score and feedback from the student.
DETERMINISTIC_SPECIALISTS = frozenset({"spreadsheet"})

#: Process-maturity text that is expected for deterministic specialist runs and
#: must not be mistaken for a real evaluation failure.
_DETERMINISTIC_IGNORED_TEXT = (
    "provisional rubric",
    "no approved rubric",
    "rubric is not instructor-approved",
    "hard gate: provisional_rubric",
    "hard gate: unverified_criteria",
    "hard gate: unverified_evidence",
    "have no supporting evidence",
    "are unverified",
)

#: Process failures that produce a low, untrustworthy score. Publishing them
#: would show the student a temporary low mark that changes on the next run.
_DEGRADED_TEXT_FRAGMENTS = (
    "degraded",
    "model call failed",
    "timed out",
    "timeout",
    "fallback provider",
    "all evaluators failed",
)


def _finite(value: Any, default: float = 0.0) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return number if math.isfinite(number) else default


def _evaluator_names(result: Any) -> List[str]:
    raw = getattr(result, "evaluator_versions", None) or []
    if isinstance(raw, str):
        try:
            raw = json.loads(raw)
        except (TypeError, ValueError):
            raw = []
    if isinstance(raw, dict):
        raw = [raw]
    names: List[str] = []
    for item in raw or []:
        if isinstance(item, dict):
            name = str(item.get("name") or "").strip().lower()
        else:
            name = str(item or "").strip().lower()
        if name:
            names.append(name)
    return names


def _evidence_rows(result: Any) -> List[Any]:
    try:
        return list(result.evidence.all())
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE evidence lookup unavailable: %s", exc)
        return []


def _has_publishable_evidence(rows: Sequence[Any]) -> bool:
    """At least one non-UNVERIFIED cite tied to a real artifact."""
    for row in rows:
        reference = str(getattr(row, "reference", "") or "").strip()
        if not reference:
            continue
        if normalise_category(getattr(row, "category", "")) == EVIDENCE_UNVERIFIED:
            continue
        if reference.lower() == "written response" or "/" in reference or "." in reference:
            return True
    return False


def _is_deterministic_evaluator(result: Any) -> bool:
    names = _evaluator_names(result)
    if not names or any(name not in DETERMINISTIC_SPECIALISTS for name in names):
        return False
    provider = str(getattr(result, "ai_provider", "") or "").strip().lower()
    return provider not in _FALLBACK_PROVIDERS


def _without_deterministic_noise(text: str) -> str:
    lowered = str(text or "").lower()
    for fragment in _DETERMINISTIC_IGNORED_TEXT:
        lowered = lowered.replace(fragment, " ")
    return lowered


def _confidence_details(result: Any) -> Tuple[Dict[str, float], List[str], List[str]]:
    factors: Dict[str, float] = {}
    reasons: List[str] = []
    hard_gates: List[str] = []
    raw = getattr(result, "confidence_factors", None)
    if isinstance(raw, dict):
        for key, value in (raw.get("factors") or {}).items():
            factors[str(key)] = _finite(value)
        reasons = [str(item) for item in (raw.get("reasons") or [])]
        hard_gates = [str(item) for item in (raw.get("hard_gate_failures") or [])]
    return factors, reasons, hard_gates


def _ignored_reason(reason: str) -> bool:
    lowered = reason.lower()
    return any(fragment in lowered for fragment in _IGNORED_REASON_FRAGMENTS)


def approval_confidence(result: Any) -> float:
    """Return the 0-100 confidence used by the Excel-style decision.

    The stored AAGE confidence is returned unchanged unless it is below the
    configured minimum *and* the only recorded depressors are evidence
    verification / process-maturity signals.  In that case the trustworthy
    process factors are re-normalised, giving a comparable publication score.
    """
    stored = _finite(getattr(result, "confidence", 0.0))
    factors, reasons, hard_gates = _confidence_details(result)
    if not factors:
        return stored
    if any(gate not in {
            "unverified_criteria", "unverified_evidence", "review_required",
    } for gate in hard_gates):
        return stored
    if any(not _ignored_reason(reason) for reason in reasons):
        return stored

    kept_weight = sum(weight for name, weight in FACTOR_WEIGHTS.items()
                      if name not in _EXCLUDED_APPROVAL_FACTORS)
    if kept_weight <= 0:
        return stored
    numerator = sum(_finite(factors.get(name)) * weight
                    for name, weight in FACTOR_WEIGHTS.items()
                    if name not in _EXCLUDED_APPROVAL_FACTORS)
    derived = round(100.0 * numerator / kept_weight, 2)
    return max(stored, derived)


def _limitation_text(result: Any) -> str:
    chunks: List[str] = []
    for text in (getattr(result, "limitations", None) or []):
        chunks.append(str(text))
    chunks.extend(_confidence_details(result)[1])
    try:
        for score in result.criteria.all():
            for text in (getattr(score, "limitations", None) or []):
                chunks.append(str(text))
            rationale = getattr(score, "rationale", "") or ""
            if "did not pass" in str(rationale).lower():
                chunks.append(str(rationale))
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE criterion limitation recheck unavailable: %s", exc)
    return " ".join(chunks).lower()


def _contains_blocking_text(text: str) -> bool:
    return any(fragment in text for fragment in _BLOCKING_TEXT_FRAGMENTS)


def auto_approval_blockers(result: Any, policy: Dict[str, Any] | None = None
                           ) -> List[str]:
    """Machine-readable reasons why Excel-style auto-approval must not happen.

    An empty list means the result is safe to publish without an instructor.
    Deterministic specialists (currently the native spreadsheet evaluator) are
    allowed to publish with a provisional rubric and with UNVERIFIED absence
    evidence, provided at least one real artifact cite supports the marks and
    no genuine process failure was recorded. Otherwise students never receive
    the score and corrective feedback that deterministic analysis did produce.
    """
    effective = policy if policy is not None else confidence_policy()
    blockers: List[str] = []
    if not bool(effective.get("auto_approve_enabled", True)):
        blockers.append("auto_approve_disabled")
        return blockers

    evidence_rows = _evidence_rows(result)
    deterministic = _is_deterministic_evaluator(result)
    publishable_evidence = _has_publishable_evidence(evidence_rows)

    minimum = _finite(effective.get("auto_approve_min"), 70.0)
    confidence = approval_confidence(result)
    if not deterministic and confidence < minimum:
        blockers.append(f"low_confidence:{confidence:.2f}<{minimum:.2f}")

    provider = str(getattr(result, "ai_provider", "") or "").strip().lower()
    if provider in _FALLBACK_PROVIDERS:
        blockers.append(f"fallback_provider:{provider}")

    degraded_text = " ".join([
        str(getattr(result, "review_reason", "") or ""),
        _limitation_text(result),
    ]).lower()
    if any(fragment in degraded_text for fragment in _DEGRADED_TEXT_FRAGMENTS):
        blockers.append("degraded_evaluation")

    snapshot = result.rubric_snapshot or {}
    if not deterministic and isinstance(snapshot, dict):
        if str(snapshot.get("status") or "").lower() in ("provisional", "draft"):
            blockers.append("provisional_rubric")

    hard_gates = _confidence_details(result)[2]
    if deterministic:
        hard_gates = [gate for gate in hard_gates
                      if gate not in ("provisional_rubric",
                                      "unverified_criteria",
                                      "unverified_evidence")]
    if any(gate in _BLOCKING_HARD_GATES for gate in hard_gates):
        blockers.append("failed_deterministic_gate"
                        if "failed_deterministic_gate" in hard_gates
                        else "provisional_rubric"
                        if "provisional_rubric" in hard_gates
                        else "unresolved_conflicts")

    review_reason = str(getattr(result, "review_reason", "") or "")
    limitations = _limitation_text(result)
    if deterministic:
        review_reason = _without_deterministic_noise(review_reason)
        limitations = _without_deterministic_noise(limitations)
    else:
        review_reason = review_reason.lower()
    if _contains_blocking_text(review_reason):
        if "disagreement" in review_reason:
            blockers.append("unresolved_conflicts")
        if "did not pass" in review_reason or "deterministic check" in review_reason:
            blockers.append("failed_deterministic_gate")
        if "provisional rubric" in review_reason or "no approved rubric" in review_reason:
            blockers.append("provisional_rubric")
    if _contains_blocking_text(limitations):
        blockers.append("failed_deterministic_gate")

    if getattr(result, "run_id", None):
        try:
            from ...models.aage_models import EvaluationRun
            run = EvaluationRun.query.get(result.run_id)
            if run and list(run.conflicts or []):
                blockers.append("unresolved_conflicts")
        except Exception as exc:  # pragma: no cover - defensive
            logger.debug("AAGE conflict recheck unavailable: %s", exc)

    if deterministic:
        if not publishable_evidence:
            blockers.append("no_publishable_evidence")
    elif any(normalise_category(getattr(row, "category", ""))
             == EVIDENCE_UNVERIFIED for row in evidence_rows):
        blockers.append("unverified_evidence")

    # Preserve order but remove duplicates.
    return list(dict.fromkeys(blockers))


def should_auto_approve(result: Any, policy: Dict[str, Any] | None = None
                        ) -> Tuple[bool, List[str]]:
    """Return ``(approved, blockers)`` for one persisted result."""
    blockers = auto_approval_blockers(result, policy)
    return (not blockers), blockers
