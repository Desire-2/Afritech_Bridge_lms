"""Backward-compatible PDF entry point.

New code should use :mod:`talent_passport.document.service`, which owns
snapshots, hashes and verification URLs. This module remains so older callers
that passed a filtered payload still receive the backend-rendered professional
document. It never accepts layout or content instructions from the caller.
"""

from __future__ import annotations

import hashlib
from typing import Any, Dict, Optional

from ..utils.time_utils import now_local
from .document.renderer import render_document
from .document.spec import DocumentSpec
from .enums import DOCUMENT_PROFESSIONAL_SHARE

_FALLBACK_VERIFY_BASE = "https://study.afritechbridge.online"


def build_passport_pdf(payload: Dict[str, Any], public_url: Optional[str] = None) -> bytes:
    """Render a filtered payload with the professional document renderer."""
    payload = payload or {}
    profile = payload.get("profile") if isinstance(payload.get("profile"), dict) else {}
    digest = hashlib.sha256(str(payload).encode("utf-8", "replace")).hexdigest()[:10].upper()
    ref = f"TP-PREVIEW-{digest}"
    verification = public_url or f"{_FALLBACK_VERIFY_BASE}/api/v1/talent/verify/{ref}"
    spec = DocumentSpec(
        edition=DOCUMENT_PROFESSIONAL_SHARE,
        document_ref=ref,
        generated_at=now_local().isoformat(),
        verification_url=verification,
        profile=profile,
        completeness=payload.get("completeness"),
        learning=payload.get("timeline") or [],
        skills=payload.get("skills") or [],
        projects=payload.get("projects") or [],
        certificates=payload.get("certificates") or [],
        achievements=payload.get("achievements") or [],
        public_url=payload.get("public_url"),
    )
    return render_document(spec)
