"""AAGE schemas — the explicit contracts every payload must satisfy.

Two families live here:

``*_AI_SCHEMA``
    Shapes returned by the model.  Validated *before* any business logic runs;
    failures are reported as structured schema errors and never silently
    coerced into scores.

``*_SCHEMA``
    Shapes produced by engine services (rubric payloads, criterion scoring
    packets) so the API layer and the persistence layer agree on one contract.

Constants (evidence categories, verification statuses, job/result states) are
re-exported from :mod:`src.services.aage.constants` for convenience.
"""

from __future__ import annotations

import math

from .validation import Field, Schema

# ---------------------------------------------------------------------------
# Shared enums
# ---------------------------------------------------------------------------

EVIDENCE_CATEGORIES = ("VERIFIED", "CODE_SUPPORTED", "CONTENT_SUPPORTED", "UNVERIFIED")
VERIFICATION_STATUSES = ("verified", "partial", "unverified", "not_applicable")
DISCIPLINES = (
    "frontend", "backend", "fullstack", "data_science", "python",
    "sql", "spreadsheet", "mobile", "devops", "theory", "general",
)
EVALUATOR_KINDS = ("static", "analyzer", "llm", "hybrid", "delegated")
JOB_STATUSES = ("queued", "running", "succeeded", "failed", "cancelled", "timed_out")
RESULT_STATUSES = ("draft", "pending_review", "approved", "published", "rejected", "superseded")
REVIEW_STATUSES = ("pending", "approved", "rejected", "changes_requested")
RUBRIC_STATUSES = ("draft", "pending_approval", "approved", "archived")
LEARNING_STATUSES = ("candidate", "approved", "rejected")

MAX_CRITERIA = 20
MAX_EVIDENCE_PER_CRITERION = 25

# ---------------------------------------------------------------------------
# Performance levels / criteria
# ---------------------------------------------------------------------------

CRITERION_LEVEL_SCHEMA: Schema = {
    "label": Field("str", required=True, max_length=80),
    "min_percent": Field("float", min=0, max=100, required=True, coerce=True),
    "description": Field("str", required=True, max_length=600),
}

CRITERION_SCHEMA: Schema = {
    "key": Field("str", required=True, max_length=80),
    "name": Field("str", required=True, max_length=200),
    "description": Field("str", required=True, max_length=2000),
    "weight": Field("float", required=True, min=0, max=100, coerce=True),
    "max_marks": Field("float", required=True, min=0.5, max=1000, coerce=True),
    "is_required": Field("bool", default=True),
    "evidence_requirements": Field("list", items=Field("str", max_length=300), default=list,
                                   max_length=10),
    "evidence_category": Field("str", choices=EVIDENCE_CATEGORIES, default="CODE_SUPPORTED"),
    "evaluator_hint": Field("str", default=None, nullable=True, max_length=120),
    "evaluator_instructions": Field("str", default=None, nullable=True, max_length=2000),
    "levels": Field("list", items=Field("dict", items=CRITERION_LEVEL_SCHEMA),
                    default=list, max_length=6),
}

# AI rubric generation output -------------------------------------------------

RUBRIC_AI_SCHEMA: Schema = {
    "title": Field("str", required=True, max_length=200),
    "discipline": Field("str", required=True, choices=DISCIPLINES),
    "summary": Field("str", required=True, max_length=1200),
    "learning_objectives": Field("list", items=Field("str", max_length=300),
                                 default=list, max_length=15),
    "deliverables": Field("list", items=Field("str", max_length=300),
                          default=list, max_length=15),
    "technologies": Field("list", items=Field("str", max_length=80),
                          default=list, max_length=25),
    "evaluation_methods": Field("list", items=Field("str", max_length=80),
                                default=list, max_length=10),
    "criteria": Field("list", items=Field("dict", items=CRITERION_SCHEMA),
                      required=True, min_length=1, max_length=MAX_CRITERIA),
    "recommended_evaluators": Field("list", items=Field("str", max_length=60),
                                    default=list, max_length=10),
    "unverifiable_requirements": Field(
        "list",
        items=Field("dict", items={
            "requirement": Field("str", required=True, max_length=400),
            "reason": Field("str", required=True, max_length=400),
        }),
        default=list, max_length=15),
    "notes": Field("str", default=None, nullable=True, max_length=1500),
}

# Criterion-level evaluation output from an evaluator -------------------------

CRITERION_SCORE_AI_SCHEMA: Schema = {
    "criterion_key": Field("str", required=True, max_length=80),
    "marks": Field("float", required=True, min=0, coerce=True),
    "max_marks": Field("float", required=True, min=0, coerce=True),
    "rationale": Field("str", required=True, max_length=1500),
    "evidence_category": Field("str", required=True, choices=EVIDENCE_CATEGORIES),
    "verification_status": Field("str", required=True, choices=VERIFICATION_STATUSES),
    "evidence": Field(
        "list",
        items=Field("dict", items={
            "reference": Field("str", required=True, max_length=400),
            "summary": Field("str", required=True, max_length=600),
            "category": Field("str", required=True, choices=EVIDENCE_CATEGORIES),
            "locator": Field("str", default=None, nullable=True, max_length=400),
        }),
        default=list, max_length=MAX_EVIDENCE_PER_CRITERION),
    "feedback": Field("str", default=None, nullable=True, max_length=1200),
    "limitations": Field("str", default=None, nullable=True, max_length=600),
    "confidence": Field("float", default=0.5, min=0, max=1, coerce=True),
}

EVALUATOR_OUTPUT_AI_SCHEMA: Schema = {
    "criteria": Field(
        "list",
        items=Field("dict", items=CRITERION_SCORE_AI_SCHEMA),
        required=True, min_length=1, max_length=MAX_CRITERIA),
    "overall_feedback": Field("str", default=None, nullable=True, max_length=4000),
    "strengths": Field("list", items=Field("str", max_length=300), default=list, max_length=10),
    "improvements": Field("list", items=Field("str", max_length=300), default=list, max_length=10),
    "confidence": Field("float", default=0.5, min=0, max=1, coerce=True),
    "notes": Field("str", default=None, nullable=True, max_length=1000),
}

# Student-facing feedback -----------------------------------------------------

FEEDBACK_AI_SCHEMA: Schema = {
    "summary": Field("str", required=True, max_length=2000),
    "strengths": Field("list", items=Field("str", max_length=300), default=list, max_length=10),
    "improvements": Field("list", items=Field("str", max_length=300), default=list, max_length=10),
    "resources": Field(
        "list",
        items=Field("dict", items={
            "title": Field("str", required=True, max_length=200),
            "url": Field("str", default=None, nullable=True, max_length=400),
            "reason": Field("str", default=None, nullable=True, max_length=300),
        }),
        default=list, max_length=8),
}

# Deterministic criterion scoring packet (produced by engine, not by the LLM) --

CRITERION_RESULT_SCHEMA: Schema = {
    "criterion_key": Field("str", required=True),
    "name": Field("str", required=True, max_length=200),
    "awarded": Field("float", required=True, min=0, coerce=True),
    "maximum": Field("float", required=True, min=0.0001, coerce=True),
    "weight": Field("float", required=True, min=0, max=100, coerce=True),
    "weighted_score": Field("float", required=True, min=0, max=100, coerce=True),
    "evidence_category": Field("str", required=True, choices=EVIDENCE_CATEGORIES),
    "verification_status": Field("str", required=True, choices=VERIFICATION_STATUSES),
    "rationale": Field("str", required=True, max_length=2000),
}


def rubric_weights_total(criteria) -> float:
    """Sum of finite criterion weights — must equal 100 (±0.01).

    Non-finite values are ignored here and reported by ``validate_criteria``;
    ignoring them keeps this helper from poisoning a whole rubric with NaN.
    """
    total = 0.0
    for criterion in criteria or []:
        try:
            weight = float(criterion.get("weight") or 0)
        except (TypeError, ValueError):
            continue
        if math.isfinite(weight):
            total += weight
    return round(total, 2)
