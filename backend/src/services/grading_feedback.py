"""Shared, rubric-aware feedback for revisions.

Auto grading and manual revision requests used to disagree: AAGE produced a
criterion-by-criterion result, but the LMS submission stored only a short
reason such as "Submission does not meet the requirements".  This module turns
the authoritative rubric result into student-facing feedback and revision
reasons so assignments and projects behave the same way.
"""

from __future__ import annotations

import json
import re
from typing import Any, Dict, List, Optional

MAX_FEEDBACK_CHARS = 10000
MAX_REASON_CHARS = 4000

_GENERIC_REASON_PATTERNS = (
    "submission does not meet the requirements",
    "does not meet the requirements",
    "does not meet requirements",
    "needs improvement",
    "modification requested",
    "please review the submission requirements",
    "review the submission requirements",
    "review assignment instructions",
    "see feedback",
    # Frontend quick-select options: useful prompts, not a reason on their own.
    "address the rubric criteria with lower scores",
    "add evidence or examples for each requirement",
    "explain the reasoning behind your conclusions",
    "correct the formatting and structure",
    "include missing references or citations",
    "fix technical issues that prevented access",
    "resubmit original work with proper attribution",
)


def _clean(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, (int, float)) and not isinstance(value, bool):
        return f"{value:g}"
    if not isinstance(value, str):
        return ""
    return re.sub(r"[ \t]+", " ", value).strip()


def is_generic_reason(reason: Any) -> bool:
    """Whether a revision reason is too vague to be useful to a student.

    Long feedback can legitimately contain wording such as "needs
    improvement", so a substring match is only used for short notes. A long
    legacy note that starts with "Modification requested:" is still generic
    because it was created by overwriting the real feedback.
    """
    text = _clean(reason).lower()
    if not text:
        return True
    if text.startswith("modification requested:"):
        return True
    if len(text) <= 100:
        return any(pattern in text for pattern in _GENERIC_REASON_PATTERNS)
    return False


def _parse_json_object(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if not isinstance(value, str):
        return {}
    text = value.strip()
    if not text.startswith("{"):
        return {}
    try:
        parsed = json.loads(text)
    except (TypeError, ValueError):
        return {}
    return parsed if isinstance(parsed, dict) else {}


def stored_feedback_text(value: Any) -> str:
    """Return usable feedback, including JSON-wrapped manual grade feedback."""
    parsed = _parse_json_object(value)
    if parsed:
        text = _clean(parsed.get("feedback") or parsed.get("overall_feedback"))
        if text:
            return text
    return _clean(value)


def _number(value: Any) -> Optional[float]:
    try:
        if value is None or isinstance(value, bool):
            return None
        return float(value)
    except (TypeError, ValueError):
        return None


def _first_number(*values: Any) -> Optional[float]:
    for value in values:
        parsed = _number(value)
        if parsed is not None:
            return parsed
    return None


def _as_criteria(value: Any) -> List[Dict[str, Any]]:
    if isinstance(value, dict):
        value = value.get("criteria") or value.get("rubric_scores")
    if not isinstance(value, list):
        return []
    rows: List[Dict[str, Any]] = []
    for item in value:
        if not isinstance(item, dict):
            continue
        name = _clean(item.get("name") or item.get("criterion") or item.get("label"))
        if not name:
            continue
        rows.append({
            "name": name,
            "awarded": _first_number(item.get("awarded"), item.get("score"),
                                     item.get("marks")),
            "maximum": _first_number(item.get("maximum"), item.get("max_marks"),
                                     item.get("max_points"), item.get("out_of")),
            "detail": _clean(item.get("feedback") or item.get("rationale")
                             or item.get("limitation")),
        })
    return rows


def rubric_criteria(grade_data: Optional[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Collect rubric criteria from any supported grade payload shape."""
    grade_data = grade_data or {}
    seen = set()
    rows: List[Dict[str, Any]] = []

    candidates: List[Any] = [
        grade_data.get("criteria"),
        grade_data.get("rubric_breakdown"),
        grade_data.get("analysis_data", {}).get("criteria")
        if isinstance(grade_data.get("analysis_data"), dict) else None,
        grade_data.get("rubric_scores"),
    ]

    for candidate in candidates:
        for row in _as_criteria(candidate):
            key = row["name"].lower()
            if key in seen:
                continue
            seen.add(key)
            if row["awarded"] is None or row["maximum"] is None:
                continue
            rows.append(row)

    rows.sort(key=lambda row: (
        (row["awarded"] / row["maximum"]) if row["maximum"] > 0 else 1.0,
        row["name"].lower(),
    ))
    return rows


def rubric_breakdown_text(grade_data: Optional[Dict[str, Any]], *, limit: int = 5,
                          heading: str = "**Rubric breakdown:**") -> str:
    """A compact, weakest-first breakdown grounded in the actual rubric marks."""
    rows = [row for row in rubric_criteria(grade_data) if row["maximum"] > 0][:limit]
    if not rows:
        return ""

    lines = [heading]
    for row in rows:
        pct = (row["awarded"] / row["maximum"]) * 100
        line = (f"• {row['name']}: {row['awarded']:g}/{row['maximum']:g} "
                f"({pct:.0f}%)")
        if row["detail"]:
            detail = row["detail"]
            if len(detail) > 240:
                detail = detail[:237].rstrip() + "…"
            line += f" — {detail}"
        lines.append(line)
    return "\n".join(lines)


def feedback_text(grade_data: Optional[Dict[str, Any]],
                  existing_feedback: Any = None) -> str:
    """Prefer the current AI result over older/manual feedback text."""
    grade_data = grade_data or {}
    candidates = [
        grade_data.get("overall_feedback"),
        grade_data.get("feedback"),
        existing_feedback,
    ]
    for candidate in candidates:
        text = stored_feedback_text(candidate)
        if text and not is_generic_reason(text):
            return text
    return ""


def build_student_feedback(grade_data: Optional[Dict[str, Any]],
                           existing_feedback: Any = None) -> str:
    """Full feedback shown on the submission: AI narrative + rubric detail."""
    base = feedback_text(grade_data, existing_feedback)
    breakdown = rubric_breakdown_text(grade_data)
    if breakdown and breakdown not in base:
        base = f"{base}\n\n{breakdown}" if base else breakdown
    return base[:MAX_FEEDBACK_CHARS]


def _improvements(grade_data: Optional[Dict[str, Any]]) -> List[str]:
    grade_data = grade_data or {}
    analysis = grade_data.get("analysis_data")
    rows: List[Any] = list(grade_data.get("weaknesses") or [])
    if isinstance(analysis, dict):
        rows.extend(list(analysis.get("weaknesses") or []))
    result: List[str] = []
    for row in rows:
        text = _clean(row)
        if text and text not in result:
            result.append(text)
    return result[:5]


def build_revision_reason(
    *,
    total_score: Optional[float] = None,
    max_score: Optional[float] = None,
    passing_score: Optional[float] = None,
    grade_data: Optional[Dict[str, Any]] = None,
    existing_feedback: Any = None,
    instructor_reason: Any = None,
) -> str:
    """Build a revision reason from evidence, never from a generic placeholder."""
    parts: List[str] = []
    total = _number(total_score)
    maximum = _number(max_score)
    passing = _number(passing_score)

    if total is not None and maximum and maximum > 0:
        pct = (total / maximum) * 100
        if passing is not None:
            parts.append(
                f"Your submission scored {total:g}/{maximum:g} ({pct:.1f}%), "
                f"below the passing score of {passing:g}%."
            )
        else:
            parts.append(f"Your submission scored {total:g}/{maximum:g} ({pct:.1f}%).")

    breakdown = rubric_breakdown_text(
        grade_data, limit=4, heading="**Rubric areas to address:**"
    )
    if breakdown:
        parts.append(breakdown)

    improvements = _improvements(grade_data)
    if improvements:
        parts.append("**Key improvements:**\n"
                     + "\n".join(f"• {item}" for item in improvements))

    feedback = feedback_text(grade_data, existing_feedback)
    if feedback:
        trimmed = feedback[:900]
        if len(feedback) > 900:
            trimmed = trimmed.rstrip() + "…"
        parts.append(f"**Feedback to address:**\n{trimmed}")

    if not is_generic_reason(instructor_reason):
        parts.append(f"**Instructor note:** {_clean(instructor_reason)}")

    if not parts:
        return "Please review the rubric criteria, address the feedback below, and resubmit."

    return "\n\n".join(parts)[:MAX_REASON_CHARS]


def resolve_modification_reason(
    requested_reason: Any,
    *,
    total_score: Optional[float] = None,
    max_score: Optional[float] = None,
    passing_score: Optional[float] = None,
    grade_data: Optional[Dict[str, Any]] = None,
    existing_feedback: Any = None,
) -> str:
    """Use a specific instructor reason, otherwise derive one from the rubric."""
    requested = _clean(requested_reason)
    if not is_generic_reason(requested):
        return requested

    return build_revision_reason(
        total_score=total_score,
        max_score=max_score,
        passing_score=passing_score,
        grade_data=grade_data,
        existing_feedback=existing_feedback,
        instructor_reason=None,
    )


def aage_grade_data(submission_type: str, submission_id: int) -> Dict[str, Any]:
    """Latest published AAGE result as a grade payload for a legacy submission."""
    try:
        from ..models.aage_models import CriterionScore, EvaluationResult
    except Exception:  # pragma: no cover - models are loaded with the app
        return {}

    try:
        query = EvaluationResult.query.filter(
            EvaluationResult.submission_type == submission_type,
            EvaluationResult.submission_id == submission_id,
        )
        query = query.filter(
            (EvaluationResult.is_official.is_(True))
            | (EvaluationResult.status == "published")
        )
        result = query.order_by(
            EvaluationResult.published_at.desc(),
            EvaluationResult.id.desc(),
        ).first()
        if result is None:
            return {}

        criteria = []
        for row in result.criteria.order_by(CriterionScore.order_index.asc()).all():
            criteria.append({
                "name": row.name,
                "awarded": float(row.awarded or 0),
                "maximum": float(row.maximum or 0),
                "feedback": row.feedback or "",
                "rationale": row.rationale or "",
            })

        return {
            "overall_feedback": result.feedback or "",
            "total_score": float(result.final_score or 0),
            "max_score": 100.0,
            "grade_letter": result.grade_letter,
            "strengths": result.strengths or [],
            "weaknesses": result.improvements or [],
            "analysis_data": {
                "strengths": result.strengths or [],
                "weaknesses": result.improvements or [],
                "criteria": criteria,
            },
            "criteria": criteria,
        }
    except Exception:  # pragma: no cover - feedback enrichment is non-critical
        return {}
