"""Content sanitization for AI output before persistence.

Applied by all persistence-facing agents so that anything written to the
course tables is safe, consistently formatted markdown, and never contains
prompt-injection residue echoed back from the model.
"""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

# Engineering/needs-vetting phrases sometimes leaked by instruction-following
# models — strip these out of persisted course content.
LEAK_PHRASES = [
    "asked by the user to",
    "as described in the system prompt",
    "according to the system prompt",
    "the user asked me to",
    "as an ai, ",
    "i cannot",
]

JSON_FENCE = re.compile(r"```(?:json)?\s*(.*?)```", re.DOTALL | re.IGNORECASE)


def strip_code_fences(text: str) -> str:
    """Remove markdown code fences; if the fenced block is pure JSON keep the
    JSON (assessment payloads come fenced)."""
    m = JSON_FENCE.search(text)
    if m:
        inner = m.group(1).strip()
        if inner.startswith("{") or inner.startswith("["):
            return inner
    return text


def clean_markdown(text: str) -> str:
    """Normalize markdown: strip fence residue and leak phrases, collapse
    runaway blank lines, bound total length."""
    if not text:
        return ""
    out = strip_code_fences(text)
    for phrase in LEAK_PHRASES:
        out = out.replace(phrase, "", )
        # catch capitalized variant quickly
        out = re.sub(re.escape(phrase), "", out, flags=re.IGNORECASE)
    out = re.sub(r"\n{3,}", "\n\n", out)
    out = re.sub(r"[ \t]+\n", "\n", out)
    return out.strip()


def clean_string(value: Any, default: str = "", max_len: int = 500) -> str:
    if value is None:
        return default
    cleaned = str(value).strip()
    cleaned = clean_markdown(cleaned)
    cleaned = re.sub(r"[\x00-\x08\x0b\x0c\x0e-\x1f]", "", cleaned)
    return cleaned[:max_len]


def sanitize_component(component_type: str, payload: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    """Deep-clean a generated component payload in place (returns a new dict)."""
    if not payload or not isinstance(payload, dict):
        return {}

    result: Dict[str, Any] = {}
    for key, value in payload.items():
        if isinstance(value, str):
            result[key] = clean_markdown(value)
        elif isinstance(value, list):
            result[key] = [
                sanitize_component(component_type, item) if isinstance(item, dict) else (
                    clean_markdown(item) if isinstance(item, str) else item)
                for item in value
            ]
        elif isinstance(value, dict):
            result[key] = sanitize_component(component_type, value)
        else:
            result[key] = value

    if component_type == "quiz":
        for idx, q in enumerate(result.get("questions") or []):
            if not isinstance(q, dict):
                continue
            q["question_text"] = clean_string(q.get("question_text"), f"Question {idx + 1}", 1000)
            options = q.get("options") or []
            keys = [str(o.get("key", "")).strip().upper() for o in options if isinstance(o, dict)]
            if keys and str(q.get("correct_answer", "")).strip().upper() not in keys:
                q["correct_answer"] = keys[0]
    return result


def content_hash(payload: Any) -> str:
    import hashlib
    try:
        text = repr(payload)
    except Exception:
        text = str(payload)
    return hashlib.sha256(text.encode()).hexdigest()