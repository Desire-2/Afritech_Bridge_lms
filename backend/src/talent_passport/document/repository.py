"""Persistence operations for versioned Passport PDF documents."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import or_

from ..enums import (
    DOCUMENT_CURRENT,
    DOCUMENT_REVOKED,
    DOCUMENT_SUPERSEDED,
    DOCUMENT_AUDIT_REVOKED,
    DOCUMENT_AUDIT_SUPERSEDED,
)
from ..evidence import audit
from ..models import TalentPassport, TalentPassportDocument, db
from ...utils.time_utils import now_local


def get_by_ref(document_ref: str) -> Optional[TalentPassportDocument]:
    return TalentPassportDocument.query.filter_by(document_ref=document_ref).first()


def current_document(passport_id: int, edition: str) -> Optional[TalentPassportDocument]:
    return (TalentPassportDocument.query
            .filter_by(passport_id=passport_id, edition=edition, is_current=True,
                       status=DOCUMENT_CURRENT)
            .order_by(TalentPassportDocument.generated_at.desc(),
                      TalentPassportDocument.id.desc())
            .first())


def history(passport_id: int, edition: Optional[str] = None) -> List[TalentPassportDocument]:
    query = TalentPassportDocument.query.filter_by(passport_id=passport_id)
    if edition:
        query = query.filter_by(edition=edition)
    return query.order_by(TalentPassportDocument.generated_at.desc(),
                          TalentPassportDocument.id.desc()).all()


def _mark_superseded(document: TalentPassportDocument, when: datetime,
                     actor_id: Optional[int] = None,
                     actor_role: Optional[str] = None) -> None:
    if document.status != DOCUMENT_CURRENT or not document.is_current:
        return
    document.status = DOCUMENT_SUPERSEDED
    document.is_current = False
    document.superseded_at = when
    old_passport = TalentPassport.query.get(document.passport_id)
    if old_passport is not None:
        audit(old_passport, DOCUMENT_AUDIT_SUPERSEDED, actor_id, actor_role,
              {"document_ref": document.document_ref, "edition": document.edition})


def create_document(
    *,
    passport: TalentPassport,
    edition: str,
    document_ref: str,
    template_version: str,
    data_revision: str,
    content_sha256: str,
    file_sha256: str,
    storage_path: str,
    metadata: Dict[str, Any],
    generated_at: datetime,
    generated_by_id: Optional[int] = None,
    actor_role: Optional[str] = None,
) -> TalentPassportDocument:
    """Create a new current snapshot and supersede the previous one."""
    previous = current_document(passport.id, edition)
    if previous is not None:
        _mark_superseded(previous, generated_at, generated_by_id, actor_role)

    document = TalentPassportDocument(
        passport_id=passport.id,
        student_id=passport.student_id,
        document_ref=document_ref,
        edition=edition,
        template_version=template_version,
        data_revision=data_revision,
        content_sha256=content_sha256,
        file_sha256=file_sha256,
        storage_path=storage_path,
        status=DOCUMENT_CURRENT,
        is_current=True,
        generated_at=generated_at,
        generated_by_id=generated_by_id,
        metadata_json=metadata,
    )
    db.session.add(document)
    audit(passport, "document.generated", generated_by_id, actor_role, {
        "document_ref": document_ref,
        "edition": edition,
        "template_version": template_version,
        "data_revision": data_revision,
    })
    return document


def revoke_document(document: TalentPassportDocument, actor_id: Optional[int] = None,
                    actor_role: Optional[str] = None) -> TalentPassportDocument:
    when = now_local()
    document.status = DOCUMENT_REVOKED
    document.is_current = False
    document.revoked_at = when
    passport = TalentPassport.query.get(document.passport_id)
    if passport is not None:
        audit(passport, DOCUMENT_AUDIT_REVOKED, actor_id, actor_role,
              {"document_ref": document.document_ref, "edition": document.edition})
    return document
