"""Service K — Deterministic Grade Calculation.

Plain, validated Python.  The model never computes or authorises the official
score; it only supplies *marks per criterion*, which are clamped and checked
here.

Formula (spec §9)::

    awarded_score = (criterion_marks / criterion_maximum) * criterion_weight
    final_score   = sum(all weighted criterion scores)   → 0..100

Hard rules enforced:

* marks cannot exceed the criterion maximum or be negative,
* criterion weights must total 100 (±0.01),
* a criterion without evidence cannot silently receive full marks,
* missing criteria follow an explicit policy,
* the final score respects the configured rounding policy,
* points are scaled to ``points_possible`` exactly like the legacy paths do.
"""

from __future__ import annotations

import logging
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from .constants import EVIDENCE_UNVERIFIED, UNVERIFIED_FULL_MARK_CAP

logger = logging.getLogger("aage.scoring")

WEIGHT_TOLERANCE = 0.01
DEFAULT_ROUNDING = 2


class ScoringError(Exception):
    """Raised when a rubric/scoring packet is structurally invalid."""

    def __init__(self, message: str, details: Optional[List[Any]] = None):
        super().__init__(message)
        self.message = message
        self.details = details or []


@dataclass
class CriterionOutcome:
    """Deterministic result for a single rubric criterion."""

    criterion_key: str
    name: str
    awarded: float
    maximum: float
    weight: float
    weighted_score: float
    evidence_category: str = "UNVERIFIED"
    verification_status: str = "unverified"
    rationale: str = ""
    feedback: str = ""
    limitations: str = ""
    evaluator_name: str = ""
    evaluator_version: str = ""
    is_required: bool = True
    order_index: int = 0
    adjustments: List[str] = field(default_factory=list)

    @property
    def percent(self) -> float:
        if self.maximum <= 0:
            return 0.0
        return round(self.awarded / self.maximum * 100.0, 4)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "criterion_key": self.criterion_key,
            "name": self.name,
            "awarded": round(self.awarded, 4),
            "maximum": round(self.maximum, 4),
            "weight": round(self.weight, 4),
            "weighted_score": round(self.weighted_score, 4),
            "percent": self.percent,
            "evidence_category": self.evidence_category,
            "verification_status": self.verification_status,
            "rationale": self.rationale,
            "feedback": self.feedback,
            "limitations": self.limitations,
            "evaluator_name": self.evaluator_name,
            "evaluator_version": self.evaluator_version,
            "is_required": self.is_required,
            "order_index": self.order_index,
            "adjustments": self.adjustments,
        }


@dataclass
class ScoreBreakdown:
    """Final deterministic outcome of a rubric."""

    criteria: List[CriterionOutcome] = field(default_factory=list)
    total_awarded: float = 0.0
    total_possible: float = 0.0
    final_score: float = 0.0
    weight_total: float = 0.0
    problems: List[str] = field(default_factory=list)
    capped_criteria: List[str] = field(default_factory=list)
    missing_criteria: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "total_awarded": round(self.total_awarded, 4),
            "total_possible": round(self.total_possible, 4),
            "final_score": round(self.final_score, 4),
            "weight_total": round(self.weight_total, 4),
            "problems": self.problems,
            "capped_criteria": self.capped_criteria,
            "missing_criteria": self.missing_criteria,
            "criteria": [c.to_dict() for c in self.criteria],
        }


# ---------------------------------------------------------------------------
# Primitive operations
# ---------------------------------------------------------------------------

def _finite_float(value: Any, default: float = 0.0) -> float:
    """Convert to a finite float, falling back to ``default`` on bad input."""
    try:
        number = float(value)
    except (TypeError, ValueError, OverflowError):
        return default
    return number if math.isfinite(number) else default


def validate_rubric_structure(criteria: Sequence[Dict[str, Any]]) -> List[str]:
    """Structural validation of the rubric used to score."""
    problems: List[str] = []
    if not criteria:
        return ["rubric has no criteria"]
    weights: List[float] = []
    for c in criteria:
        key = c.get("criterion_key") or c.get("key") or "?"
        weight_value = c.get("weight")
        try:
            weight = float(weight_value or 0)
        except (TypeError, ValueError, OverflowError):
            problems.append(f"criterion '{key}' has a non-numeric weight")
            continue
        if not math.isfinite(weight):
            problems.append(f"criterion '{key}' has a non-finite weight")
            continue
        weights.append(weight)
        maximum_value = c.get("max_marks") or c.get("maximum") or 0
        try:
            maximum = float(maximum_value)
        except (TypeError, ValueError, OverflowError):
            problems.append(f"criterion '{key}' must have a positive maximum")
            continue
        if not math.isfinite(maximum) or maximum <= 0:
            problems.append(f"criterion '{key}' must have a positive maximum")
    total = round(sum(weights), 4)
    if abs(total - 100.0) > WEIGHT_TOLERANCE:
        problems.append(f"criterion weights total {total}%, expected 100%")
    return problems


def clamp_marks(marks: Any, maximum: float) -> tuple:
    """Clamp marks into ``[0, maximum]``.  Returns ``(value, adjustments)``."""
    adjustments: List[str] = []
    try:
        value = float(marks)
    except (TypeError, ValueError, OverflowError):
        return 0.0, ["non-numeric marks treated as 0"]
    if not math.isfinite(value):
        return 0.0, ["non-finite marks treated as 0"]

    if value < 0:
        adjustments.append(f"negative marks {value} clamped to 0")
        value = 0.0
    if maximum > 0 and value > maximum:
        adjustments.append(f"marks {value} exceeded maximum {maximum}; clamped")
        value = float(maximum)
    return value, adjustments


def weighted_criterion_score(marks: float, maximum: float, weight: float) -> float:
    """``(marks / maximum) * weight`` — the one formula used everywhere."""
    marks = _finite_float(marks)
    maximum = _finite_float(maximum)
    weight = _finite_float(weight)
    if maximum <= 0:
        return 0.0
    pct = marks / maximum
    return pct * weight


def apply_unverified_cap(outcome: CriterionOutcome) -> bool:
    """UNVERIFIED criteria cannot reach full marks.

    Returns ``True`` when a cap was applied.
    """
    if outcome.evidence_category != EVIDENCE_UNVERIFIED:
        return False
    if outcome.maximum <= 0:
        return False
    cap = outcome.maximum * UNVERIFIED_FULL_MARK_CAP
    if outcome.awarded > cap + 1e-9:
        outcome.awarded = round(cap, 4)
        outcome.adjustments.append(
            f"capped at {int(UNVERIFIED_FULL_MARK_CAP * 100)}% of maximum because "
            "the evidence category is UNVERIFIED")
        return True
    return False


def letter_grade(percentage: float) -> str:
    """Same banding used by the existing Excel grading engine."""
    percentage = _finite_float(percentage)
    if percentage >= 90:
        return "A"
    if percentage >= 80:
        return "B"
    if percentage >= 70:
        return "C"
    if percentage >= 60:
        return "D"
    return "F"


def score_for_letter(letter: Any) -> Optional[float]:
    """Return the lower bound of a canonical letter band.

    Used only by the historical Excel compatibility override when an instructor
    supplies a letter but no numeric score.  It introduces no new threshold: the
    values are exactly the boundaries in :func:`letter_grade`.
    """
    text = str(letter or "").strip().upper()
    return {"A": 90.0, "B": 80.0, "C": 70.0, "D": 60.0, "F": 0.0}.get(text)


def confidence_score(value: Any) -> float:
    """Normalise legacy confidence labels/fractions to AAGE's 0-100 scale.

    Historical Excel rows store either ``high``/``medium``/``low`` or a 0-1
    fraction.  AAGE stores a 0-100 meta-confidence.  Compatibility readers use
    this single helper instead of re-implementing the mapping in each endpoint.
    """
    if isinstance(value, str):
        labels = {"high": 85.0, "medium": 65.0, "low": 40.0}
        return labels.get(value.strip().lower(), 0.0)
    number = _finite_float(value, 0.0)
    if 0.0 <= number <= 1.0:
        number *= 100.0
    return round(max(0.0, min(100.0, number)), 2)


def confidence_label(score: Any) -> str:
    """Return the legacy high/medium/low label for an AAGE confidence score."""
    number = confidence_score(score)
    if number >= 80.0:
        return "high"
    if number >= 60.0:
        return "medium"
    return "low"


def round_score(value: float, places: int = DEFAULT_ROUNDING) -> float:
    value = _finite_float(value)
    return round(value, places)


def scale_to_points(percentage: float, points_possible: Optional[float]) -> float:
    """Convert a 0–100 percentage into points for ``points_possible``.

    Mirrors the legacy write-back formula
    ``round(total/max * points_possible, 2)`` clamped to ``[0, points]``.
    """
    points = _finite_float(points_possible, 100.0)
    if points <= 0:
        return 0.0
    percentage = _finite_float(percentage)
    scaled = round((max(0.0, min(100.0, percentage)) / 100.0) * points, 2)
    return max(0.0, min(points, scaled))


# ---------------------------------------------------------------------------
# Full breakdown
# ---------------------------------------------------------------------------

def compute_breakdown(
    rubric_criteria: Sequence[Dict[str, Any]],
    marks_by_key: Dict[str, Dict[str, Any]],
    *,
    missing_policy: str = "zero",
    rounding: int = DEFAULT_ROUNDING,
    apply_unverified_limits: bool = True,
) -> ScoreBreakdown:
    """Compute the full deterministic breakdown.

    Parameters
    ----------
    rubric_criteria:
        Rubric criteria (``key``/``name``/``max_marks``/``weight``/...).
    marks_by_key:
        ``{criterion_key: {"marks": float, "rationale": str,
        "evidence_category": str, "verification_status": str, ...}}``.
    missing_policy:
        ``"zero"`` — an unevaluated required criterion scores 0;
        ``"proportional"`` — unevaluated criteria are excluded and the
        remaining weights are renormalised (used when the assessment is
        explicitly partial).  Always reported in ``missing_criteria``.
    """
    problems = validate_rubric_structure(rubric_criteria)
    if problems:
        raise ScoringError("rubric structure invalid", details=problems)

    outcomes: List[CriterionOutcome] = []
    missing: List[str] = []

    for idx, crit in enumerate(rubric_criteria):
        key = str(crit.get("criterion_key") or crit.get("key") or f"criterion_{idx}")
        name = str(crit.get("name") or key)
        maximum = float(crit.get("max_marks") or crit.get("maximum") or 0)
        weight = float(crit.get("weight") or 0)
        required = crit.get("is_required")
        required = True if required is None else bool(required)

        supplied = marks_by_key.get(key) or marks_by_key.get(str(idx)) or {}
        if not supplied:
            missing.append(key)
            supplied = {"marks": 0.0,
                        "rationale": "criterion was not evaluated in this run",
                        "evidence_category": EVIDENCE_UNVERIFIED,
                        "verification_status": "unverified"}

        marks, adjustments = clamp_marks(supplied.get("marks", 0.0), maximum)
        outcome = CriterionOutcome(
            criterion_key=key,
            name=name,
            awarded=marks,
            maximum=maximum,
            weight=weight,
            weighted_score=0.0,
            evidence_category=str(supplied.get("evidence_category") or EVIDENCE_UNVERIFIED),
            verification_status=str(supplied.get("verification_status") or "unverified"),
            rationale=str(supplied.get("rationale") or "")[:2000],
            feedback=str(supplied.get("feedback") or "")[:1200],
            limitations=str(supplied.get("limitations") or "")[:600],
            evaluator_name=str(supplied.get("evaluator_name") or ""),
            evaluator_version=str(supplied.get("evaluator_version") or ""),
            is_required=required,
            order_index=int(crit.get("order_index") or idx),
            adjustments=adjustments,
        )
        if apply_unverified_limits:
            apply_unverified_cap(outcome)
        outcome.weighted_score = round(
            weighted_criterion_score(outcome.awarded, outcome.maximum, outcome.weight), 6)
        outcomes.append(outcome)

    weight_total = round(sum(o.weight for o in outcomes), 4)

    if missing and missing_policy == "proportional":
        evaluated_weight = sum(o.weight for o in outcomes if o.criterion_key not in missing)
        if evaluated_weight > 0 and evaluated_weight < 100:
            factor = 100.0 / evaluated_weight
            for o in outcomes:
                if o.criterion_key not in missing:
                    o.weight = round(o.weight * factor, 6)
                    o.weighted_score = round(
                        weighted_criterion_score(o.awarded, o.maximum, o.weight), 6)
            weight_total = round(sum(o.weight for o in outcomes), 4)
            logger.info("AAGE proportional missing-policy rescaled weights to %.2f",
                        weight_total)

    final_score = sum(o.weighted_score for o in outcomes)
    final_score = round_score(final_score, rounding)
    final_score = max(0.0, min(100.0, final_score))

    breakdown = ScoreBreakdown(
        criteria=outcomes,
        total_awarded=round(sum(o.awarded for o in outcomes), 4),
        total_possible=round(sum(o.maximum for o in outcomes), 4),
        final_score=final_score,
        weight_total=weight_total,
        problems=problems,
        capped_criteria=[o.criterion_key for o in outcomes if o.adjustments],
        missing_criteria=missing,
    )
    if abs(weight_total - 100.0) > WEIGHT_TOLERANCE:
        breakdown.problems.append(f"weight total {weight_total} != 100")
    return breakdown
