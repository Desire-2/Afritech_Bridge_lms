"""Generation, versioning and retrieval service for Passport PDFs."""

from __future__ import annotations

import hashlib
import secrets
from datetime import datetime
from typing import Any, Dict, List, Optional

from flask import current_app

from ..config import PDF_VERIFICATION_BASE_CONFIG_KEY
from ..enums import (
    DOCUMENT_CURRENT,
    DOCUMENT_EDITIONS,
    DOCUMENT_PERSONAL_RECORD,
    DOCUMENT_PROFESSIONAL_SHARE,
    DOCUMENT_REVOKED,
)
from ..models import TalentPassport, TalentPassportDocument, db
from .. import services as passport_services
from ...models.user_models import User
from ...utils.time_utils import now_local
from . import repository, storage
from .renderer import render_document
from .spec import DocumentSpec, canonical_spec_hash
from .tokens import TEMPLATE_VERSION
from .validation import validate_pdf


def _verification_url(base_url: str, document_ref: str) -> str:
    configured = current_app.config.get(PDF_VERIFICATION_BASE_CONFIG_KEY)
    base = str(configured or base_url or "").rstrip("/")
    if not base:
        raise ValueError("A verification base URL is required")
    if base.endswith("/api/v1"):
        return f"{base}/talent/verify/{document_ref}"
    return f"{base}/api/v1/talent/verify/{document_ref}"


def _new_ref() -> str:
    return "TP-" + secrets.token_urlsafe(15).replace("-", "").replace("_", "")


def _name_for(student_id: int) -> str:
    user = User.query.get(student_id)
    if user is None:
        return "Learner profile"
    return f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username


def _direction(profile: Dict[str, Any]) -> Dict[str, Any]:
    direction = {key: profile.get(key) for key in (
        "career_interests", "areas_of_specialization", "professional_goals",
        "preferred_work_arrangement", "preferred_opportunities",
    )}
    links = [profile.get(key) for key in ("portfolio_url", "github_url", "linkedin_url")]
    links.extend(profile.get("other_links") or [])
    direction["links"] = [str(item).strip() for item in links if str(item or "").strip()]
    return direction


def build_spec(passport: TalentPassport, edition: str, verification_base_url: str,
               document_ref: str, generated_at: datetime) -> DocumentSpec:
    """Build a normalized spec from authoritative, already-filtered payloads."""
    if edition not in DOCUMENT_EDITIONS:
        raise ValueError("Unknown document edition")

    if edition == DOCUMENT_PROFESSIONAL_SHARE:
        payload = passport_services.public_payload(passport.public_slug)
        if payload is None:
            raise PermissionError("Talent Passport is not publicly available")
        profile = dict(payload.get("profile") or {})
        skills = payload.get("skills") or []
        projects = payload.get("projects") or []
        certificates = payload.get("certificates") or []
        achievements = payload.get("achievements") or []
        learning = payload.get("timeline") or []
        completeness = payload.get("completeness")
        public_url = f"/talent/{passport.public_slug}"
    else:
        payload = passport_services.export_payload(passport.student_id)
        profile = passport_services.serialize_profile(passport)
        profile["name"] = _name_for(passport.student_id)
        skills = payload.get("skills") or []
        projects = payload.get("projects") or []
        certificates = payload.get("certificates") or []
        achievements = payload.get("achievements") or []
        learning = payload.get("timeline") or []
        completeness = payload.get("completeness")
        public_url = payload.get("public_url")

    verified_skills = sum(1 for item in skills if str(item.get("status", "")).upper() == "VERIFIED")
    stats = {
        "skills_verified": verified_skills,
        "certificates": len(certificates),
        "projects": len(projects),
        "learning": len(learning),
    }
    return DocumentSpec(
        edition=edition,
        document_ref=document_ref,
        generated_at=generated_at.isoformat(),
        verification_url=_verification_url(verification_base_url, document_ref),
        profile=profile,
        completeness=completeness,
        learning=learning,
        skills=skills,
        projects=projects,
        certificates=certificates,
        achievements=achievements,
        direction=_direction(profile),
        stats=stats,
        public_url=public_url,
    )


def generate(
    passport: TalentPassport,
    edition: str,
    verification_base_url: str,
    generated_by_id: Optional[int] = None,
    actor_role: Optional[str] = None,
) -> TalentPassportDocument:
    """Render, validate, store and persist one immutable document snapshot."""
    document_ref = _new_ref()
    generated_at = now_local()
    spec = build_spec(passport, edition, verification_base_url, document_ref, generated_at)
    content_sha256 = canonical_spec_hash(spec)
    pdf_bytes = render_document(spec)
    validation = validate_pdf(pdf_bytes, spec)
    file_sha256 = hashlib.sha256(pdf_bytes).hexdigest()

    storage_path = storage.write_pdf(document_ref, pdf_bytes)
    document = repository.create_document(
        passport=passport,
        edition=edition,
        document_ref=document_ref,
        template_version=spec.template_version,
        data_revision=content_sha256[:16],
        content_sha256=content_sha256,
        file_sha256=file_sha256,
        storage_path=storage_path,
        metadata={"validation": validation, "profile_sections": sorted(spec.profile.keys())},
        generated_at=generated_at,
        generated_by_id=generated_by_id,
        actor_role=actor_role,
    )
    db.session.commit()
    db.session.refresh(document)
    return document


def get_document(document_ref: str) -> TalentPassportDocument:
    document = repository.get_by_ref(document_ref)
    if document is None:
        raise LookupError("Document not found")
    return document


def current_for_passport(passport: TalentPassport, edition: str) -> TalentPassportDocument:
    document = repository.current_document(passport.id, edition)
    if document is None:
        raise LookupError("No current document for this edition")
    return document


def current_for_slug(slug: str, verification_base_url: str) -> TalentPassportDocument:
    """Resolve or create the current share edition for a published slug."""
    passport = (TalentPassport.query
                .filter_by(public_slug=slug, is_published=True)
                .first())
    if passport is None:
        raise LookupError("Talent Passport is not publicly available")
    visibility = passport_services.ensure_visibility(passport)
    if not visibility.is_published:
        raise LookupError("Talent Passport is not publicly available")
    document = repository.current_document(passport.id, DOCUMENT_PROFESSIONAL_SHARE)
    if document is None:
        document = generate(passport, DOCUMENT_PROFESSIONAL_SHARE, verification_base_url,
                            actor_role="public")
    return document


def read_document(document: TalentPassportDocument) -> bytes:
    data = storage.read_pdf(document.storage_path)
    actual = hashlib.sha256(data).hexdigest()
    if actual != document.file_sha256:
        raise ValueError("Stored document failed its integrity check")
    return data


def history(passport: TalentPassport, edition: Optional[str] = None
            ) -> List[TalentPassportDocument]:
    return repository.history(passport.id, edition)


def serialize_document(document: TalentPassportDocument, *, private: bool,
                       verification_base_url: str) -> Dict[str, Any]:
    payload: Dict[str, Any] = {
        "document_ref": document.document_ref,
        "edition": document.edition,
        "status": document.status,
        "template_version": document.template_version,
        "generated_at": document.generated_at.isoformat() if document.generated_at else None,
        "verification_url": _verification_url(verification_base_url, document.document_ref),
    }
    if private:
        payload.update({
            "id": document.id,
            "data_revision": document.data_revision,
            "content_sha256": document.content_sha256,
            "file_sha256": document.file_sha256,
            "is_current": bool(document.is_current),
            "superseded_at": document.superseded_at.isoformat() if document.superseded_at else None,
            "revoked_at": document.revoked_at.isoformat() if document.revoked_at else None,
        })
    return payload


def verify(document_ref: str, verification_base_url: str) -> Dict[str, Any]:
    """Public verification result; never returns hashes, ids or private data."""
    document = repository.get_by_ref(document_ref)
    result: Dict[str, Any] = {
        "document_ref": document_ref,
        "verified": False,
        "state": "not_found",
        "edition": None,
        "template_version": None,
        "generated_at": None,
        "verification_url": _verification_url(verification_base_url, document_ref),
    }
    if document is None:
        return result
    passport = TalentPassport.query.get(document.passport_id)
    result.update({
        "edition": document.edition,
        "template_version": document.template_version,
        "generated_at": document.generated_at.isoformat() if document.generated_at else None,
    })
    if document.status == DOCUMENT_REVOKED:
        result["state"] = "revoked"
        return result
    if passport is None or not passport.is_published:
        result["state"] = "unpublished"
        return result
    visibility = passport_services.ensure_visibility(passport)
    if not visibility.is_published:
        result["state"] = "unpublished"
        return result
    try:
        read_document(document)
    except (LookupError, ValueError):
        result["state"] = "integrity_failed"
        return result
    result["state"] = "issued"
    result["verified"] = document.status in (DOCUMENT_CURRENT, "superseded")
    return result


def revoke(document: TalentPassportDocument, actor_id: int,
           actor_role: str) -> TalentPassportDocument:
    from .repository import revoke_document
    document = revoke_document(document, actor_id, actor_role)
    db.session.commit()
    db.session.refresh(document)
    return document
