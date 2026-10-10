"""Cross-component quality & consistency validation.

The reviewer/quality/consistency agents produce these structured results which
the engine stores as ``QualityReview`` rows. ``validate_component`` is meant to
be called with rule-based checks (deterministic) — the LLM-based reviewer
returns compatible dicts so both flows share the same shape.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List, Optional

from . import state as wf_state

logger = logging.getLogger(__name__)


def validate_component(component_type: str, payload: Dict[str, Any],
                       *, threshold: float = None) -> Dict[str, Any]:
    """Run deterministic rule checks on a generated component.

    Returns: {"passed": bool, "score": 0..1 float, "checks": {check: {...}}}

    Component types: module | lesson | quiz | assignment
    """
    checks: Dict[str, Dict[str, Any]] = {}
    text_blob = json.dumps(payload, ensure_ascii=False)

    def _check(name: str, passed: bool, note: str) -> None:
        checks[name] = {"passed": bool(passed), "note": note,
                        "weight": 1.0}

    # generic non-empty + required text
    _check("has_content", bool(text_blob and text_blob.strip() != "{}"),
           "Empty payload rejected")

    title = (payload.get("title") or "").strip()
    _check("has_title", bool(title), "Title is missing")

    if component_type == "lesson":
        requires = ["content", "summary", "objectives"]
    elif component_type == "quiz":
        requires = ["questions"]
    elif component_type == "module":
        requires = ["description", "objectives"]
    else:
        requires = []

    missing = [r for r in requires if not payload.get(r)]
    _check("required_fields", not missing,
           f"Missing fields: {', '.join(missing)}" if missing else "All required fields present")

    if component_type == "quiz":
        questions = payload.get("questions") or []
        _check("has_questions", len(questions) > 0, f"{len(questions)} questions")
        valid_q = 0
        for q in questions:
            if not isinstance(q, dict):
                continue
            opts = q.get("options") or []
            keys = [str(o.get("key", "")).strip().upper() for o in opts]
            if q.get("question_text") and len(opts) >= 2 and \
                    str(q.get("correct_answer", "")).strip().upper() in keys:
                valid_q += 1
        _check("valid_questions",
               valid_q == len(questions) and len(questions) > 0,
               f"{valid_q}/{len(questions)} questions structurally valid")

    # Length sanity: unreasonably short content is a failure
    content = (payload.get("content") or "")
    _check("content_length",
           component_type != "lesson" or len(str(content).strip()) >= 150,
           f"Content only {len(str(content).strip())} chars")

    passed_checks = [c for c in checks.values() if c["passed"]]
    score = (len(passed_checks) / len(checks)) if checks else 0.0
    passed = score >= (threshold if threshold is not None else wf_state.QUALITY_PASS_THRESHOLD)
    return {"passed": bool(passed), "score": round(score, 2), "checks": checks}


def summary_of(review: Dict[str, Any]) -> str:
    """Human-readable one line for repair prompts."""
    if not review:
        return "Validation did not run."
    failing = [name for name, c in (review.get("checks") or {}).items()
               if not c.get("passed")]
    if not failing:
        return "All validation checks passed."
    return f"Score {review.get('score', 0)} — failing checks: {', '.join(failing)}"