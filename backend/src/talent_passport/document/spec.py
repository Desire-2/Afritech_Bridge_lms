"""Backend-owned document specification.

A ``DocumentSpec`` is the complete, already-filtered input to the renderer. It
is built by the backend service from LMS records; HTTP clients never provide or
modify it. Canonical hashing intentionally excludes snapshot-only fields so a
data revision can be compared across regenerations.
"""

from __future__ import annotations

import hashlib
import json
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from .tokens import EDITION_LABELS, STATUS_LABELS, TEMPLATE_VERSION


@dataclass(frozen=True)
class DocumentSpec:
    edition: str
    document_ref: str
    generated_at: str
    verification_url: str
    profile: Dict[str, Any] = field(default_factory=dict)
    completeness: Optional[int] = None
    learning: List[Dict[str, Any]] = field(default_factory=list)
    skills: List[Dict[str, Any]] = field(default_factory=list)
    projects: List[Dict[str, Any]] = field(default_factory=list)
    certificates: List[Dict[str, Any]] = field(default_factory=list)
    achievements: List[Dict[str, Any]] = field(default_factory=list)
    direction: Dict[str, Any] = field(default_factory=dict)
    stats: Dict[str, Any] = field(default_factory=dict)
    public_url: Optional[str] = None
    template_version: str = TEMPLATE_VERSION
    status: str = "current"

    @property
    def edition_label(self) -> str:
        return EDITION_LABELS.get(self.edition, self.edition.upper())

    @property
    def status_label(self) -> str:
        return STATUS_LABELS.get(self.status, self.status.upper())

    def canonical_content(self) -> Dict[str, Any]:
        """Return the authoritative content used for the content hash."""
        return {
            "edition": self.edition,
            "template_version": self.template_version,
            "profile": self.profile,
            "completeness": self.completeness,
            "learning": self.learning,
            "skills": self.skills,
            "projects": self.projects,
            "certificates": self.certificates,
            "achievements": self.achievements,
            "direction": self.direction,
            "stats": self.stats,
        }


def canonical_spec_hash(spec: DocumentSpec) -> str:
    payload = json.dumps(
        spec.canonical_content(),
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
        default=str,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()
