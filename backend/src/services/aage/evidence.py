"""Service J — Evidence Verification.

Every criterion score must be backed by evidence.  This module owns:

* building evidence records from deterministic analysis,
* validating evidence before it is stored (references must point at real
  artefacts in the submission — the model cannot invent file paths),
* normalising evidence categories and verification statuses,
* deciding how "unverified" evidence constrains marks.
"""

from __future__ import annotations

import logging
import posixpath
from dataclasses import dataclass, field
from typing import Any, Dict, Iterable, List, Optional, Sequence

from .constants import (
    EVIDENCE_CODE,
    EVIDENCE_CONTENT,
    EVIDENCE_UNVERIFIED,
    EVIDENCE_VERIFIED,
    EVIDENCE_CATEGORIES,
)

logger = logging.getLogger("aage.evidence")

MAX_EVIDENCE_PER_CRITERION = 25
MAX_SUMMARY_CHARS = 700
MAX_REFERENCE_CHARS = 600

#: category → is the claim backed by something the system itself confirmed?
_CATEGORY_TRUST = {
    EVIDENCE_VERIFIED: 1.0,
    EVIDENCE_CODE: 0.75,
    EVIDENCE_CONTENT: 0.6,
    EVIDENCE_UNVERIFIED: 0.0,
}

#: allowed provenance for evidence rows
EVIDENCE_SOURCES = (
    "static_analysis", "analyzer", "artifact_manifest", "student_content",
    "llm", "test", "instructor",
)


@dataclass
class EvidenceItem:
    """One evidence record for a criterion."""

    category: str = EVIDENCE_UNVERIFIED
    source: str = "static_analysis"
    reference: str = ""          # artefact path / "written response" / analyzer id
    locator: str = ""            # line/section hint
    summary: str = ""
    detail: Dict[str, Any] = field(default_factory=dict)
    confidence: float = 0.5

    def to_dict(self) -> Dict[str, Any]:
        return {
            "category": self.category,
            "source": self.source,
            "reference": self.reference[:MAX_REFERENCE_CHARS],
            "locator": self.locator[:MAX_REFERENCE_CHARS],
            "summary": self.summary[:MAX_SUMMARY_CHARS],
            "detail": self.detail,
            "confidence": round(float(self.confidence), 3),
        }


def normalise_category(value: Any) -> str:
    text = str(value or "").strip().upper()
    aliases = {
        "VERIFIED": EVIDENCE_VERIFIED,
        "CODE": EVIDENCE_CODE,
        "CODE_SUPPORTED": EVIDENCE_CODE,
        "SOURCE": EVIDENCE_CODE,
        "CONTENT": EVIDENCE_CONTENT,
        "CONTENT_SUPPORTED": EVIDENCE_CONTENT,
        "UNVERIFIED": EVIDENCE_UNVERIFIED,
        "NONE": EVIDENCE_UNVERIFIED,
        "": EVIDENCE_UNVERIFIED,
    }
    return aliases.get(text, EVIDENCE_UNVERIFIED)


def normalise_status(value: Any) -> str:
    text = str(value or "").strip().lower()
    aliases = {
        "verified": "verified", "confirmed": "verified", "checked": "verified",
        "partial": "partial", "partially": "partial",
        "unverified": "unverified", "unknown": "unverified", "": "unverified",
        "not_applicable": "not_applicable", "n/a": "not_applicable",
    }
    return aliases.get(text, "unverified")


def trust_factor(category: str) -> float:
    return _CATEGORY_TRUST.get(normalise_category(category), 0.0)


class EvidenceValidator:
    """Validates evidence against the actual submission manifest."""

    def __init__(self, manifest_paths: Optional[Iterable[str]] = None,
                 has_written_response: bool = False):
        self.paths = {self._norm(p) for p in (manifest_paths or []) if p}
        self.has_written_response = has_written_response

    @staticmethod
    def _norm(path: str) -> str:
        return posixpath.normpath(str(path or "").replace("\\", "/")).lstrip("./")

    def known_references(self) -> List[str]:
        return sorted(self.paths)

    def validate(self, evidence: Sequence[Dict[str, Any]],
                 criterion_key: str = "") -> List[Dict[str, Any]]:
        """Return cleaned evidence rows, dropping anything unverifiable.

        A reference that does not correspond to a real artefact is *demoted*
        to ``UNVERIFIED`` and annotated rather than silently kept — the engine
        must not present an invented file path as proof.
        """
        cleaned: List[Dict[str, Any]] = []
        seen = set()
        for raw in list(evidence)[:MAX_EVIDENCE_PER_CRITERION]:
            if not isinstance(raw, dict):
                continue
            item = EvidenceItem(
                category=normalise_category(raw.get("category")),
                source=str(raw.get("source") or "static_analysis")[:40],
                reference=str(raw.get("reference") or "")[:MAX_REFERENCE_CHARS],
                locator=str(raw.get("locator") or "")[:MAX_REFERENCE_CHARS],
                summary=str(raw.get("summary") or "")[:MAX_SUMMARY_CHARS],
                detail=raw.get("detail") if isinstance(raw.get("detail"), dict) else {},
                confidence=float(raw.get("confidence") if isinstance(raw.get("confidence"), (int, float)) else 0.5),
            )
            if not item.summary:
                continue

            dedupe = (item.reference, item.summary[:120])
            if dedupe in seen:
                continue
            seen.add(dedupe)

            if item.reference and not self._reference_exists(item.reference):
                item.category = EVIDENCE_UNVERIFIED
                item.detail = dict(item.detail)
                item.detail["reference_not_found"] = True
                item.detail["declared_reference"] = item.reference
                item.confidence = min(item.confidence, 0.2)
                item.summary = (item.summary + " (reference could not be confirmed)")[
                    :MAX_SUMMARY_CHARS]
                logger.info("AAGE demoted unverifiable evidence reference %r (%s)",
                            item.reference, criterion_key)

            if item.category == EVIDENCE_UNVERIFIED:
                item.confidence = min(item.confidence, 0.35)

            cleaned.append(item.to_dict())
        return cleaned

    def _reference_exists(self, reference: str) -> bool:
        ref = self._norm(reference)
        if not ref:
            return True
        lowered = ref.lower()
        if lowered in ("written response", "written_response", "submission text",
                       "student answer", "inline text"):
            return self.has_written_response
        if ref in self.paths:
            return True
        base = posixpath.basename(ref)
        return any(posixpath.basename(p) == base for p in self.paths)


def summarise_evidence(evidence: Sequence[Dict[str, Any]]) -> Dict[str, Any]:
    """Aggregate statistics used by the confidence service."""
    total = len(evidence)
    by_category = {c: 0 for c in EVIDENCE_CATEGORIES}
    trust_sum = 0.0
    for item in evidence:
        cat = normalise_category(item.get("category"))
        by_category[cat] = by_category.get(cat, 0) + 1
        trust_sum += trust_factor(cat)
    return {
        "count": total,
        "by_category": by_category,
        "avg_trust": round(trust_sum / total, 3) if total else 0.0,
        "unverified_share": round(by_category.get(EVIDENCE_UNVERIFIED, 0) / total, 3)
        if total else 1.0,
    }
