"""Backend-owned professional Talent Passport PDF tests.

These tests generate real PDF bytes, validate their structure, exercise the
versioned document APIs, and assert edition filtering and integrity behavior.
"""

from __future__ import annotations

import hashlib
import re
from io import BytesIO

import pytest
from PyPDF2 import PdfReader
from flask_jwt_extended import create_access_token

from src.talent_passport import services as passport_services
from src.talent_passport.document import service as document_service
from src.talent_passport.document.renderer import render_document
from src.talent_passport.document.spec import DocumentSpec
from src.talent_passport.document.validation import validate_pdf
from src.talent_passport.enums import (
    DOCUMENT_PERSONAL_RECORD,
    DOCUMENT_PROFESSIONAL_SHARE,
    DOCUMENT_SUPERSEDED,
)
from src.models.user_models import User, db
from src.talent_passport.models import (
    PassportAchievementRecord,
    PortfolioItem,
    SkillDefinition,
    StudentSkill,
    TalentPassportDocument,
)
from src.utils.time_utils import now_local

from test_talent_passport import _header_id, _passport, _sync, env  # noqa: F401


def _text(data: bytes) -> str:
    return "\n".join(page.extract_text() or "" for page in PdfReader(BytesIO(data)).pages)


def _configure_storage(app, tmp_path):
    root = tmp_path / "documents"
    app.config["TALENT_PASSPORT_PDF_STORAGE_DIR"] = str(root)
    return root


def _publish(env, *, headline="Backend engineer", skills=True, profile=True,
             show_email=False, show_phone=False):
    _sync(env)
    passport = _passport(env)
    passport_services.update_profile(passport, {
        "headline": headline,
        "summary": "I build accessible learning systems forAfrican learners.",
        "city": "Kigali",
        "country": "Rwanda",
        "career_interests": ["Platform engineering"],
        "professional_goals": "Build reliable learning systems.",
    })
    skill = SkillDefinition.query.first()
    assert skill is not None
    existing = StudentSkill.query.filter_by(
        passport_id=passport.id, skill_definition_id=skill.id
    ).first()
    if existing is None:
        db.session.add(StudentSkill(
            passport_id=passport.id,
            student_id=env["student_id"],
            skill_definition_id=skill.id,
            status="VERIFIED",
            proficiency_level="Advanced",
        ))
    passport_services.update_visibility(passport, {
        "professional_profile": profile,
        "skills": skills,
        "projects": False,
        "certificates": False,
        "learning_history": False,
        "achievements": False,
        "show_email": show_email,
        "show_phone": show_phone,
    })
    passport_services.publish(passport)
    db.session.commit()
    return passport


def _sample_spec(ref="TP-UNITTEST-0001") -> DocumentSpec:
    return DocumentSpec(
        edition=DOCUMENT_PROFESSIONAL_SHARE,
        document_ref=ref,
        generated_at=now_local().isoformat(),
        verification_url=f"https://study.afritechbridge.online/api/v1/talent/verify/{ref}",
        profile={
            "name": "Ada Uwimana",
            "headline": "Backend engineer",
            "city": "Kigali",
            "country": "Rwanda",
            "summary": "I build accessible systems.",
        },
        completeness=88,
        learning=[{"kind": "course_completed", "title": "Python", "description": "Completed",
                   "date": "2026-10-02"}],
        skills=[{"name": "Python", "category": "Engineering", "status": "VERIFIED",
                 "proficiency_level": "Advanced"}],
        projects=[{"title": "Dashboard", "description": "Offline-first reporting",
                   "technologies": ["Python"], "external_url": "https://example.com/project"}],
        certificates=[{"title": "Python", "certificate_number": "ABC-2026-000123",
                       "status": "valid", "issued_at": "2026-10-02",
                       "verification_url": "https://example.com/verify/ABC-2026-000123"}],
        achievements=[{"title": "Mentor", "description": "Peer mentoring",
                       "earned_at": "2026-08-01"}],
        direction={"career_interests": ["Platform engineering"]},
        stats={"skills_verified": 1, "certificates": 1, "projects": 1},
    )


def test_renderer_produces_valid_a4_pdf():
    spec = _sample_spec()
    data = render_document(spec)
    result = validate_pdf(data, spec)

    assert data.startswith(b"%PDF")
    assert result["pages"] >= 2
    assert result["page_size_pt"] == [595.28, 841.89]
    assert result["embedded_fonts"] is True
    assert result["hyperlinks"] >= 1
    assert result["embedded_images"] >= 2
    text = _text(data)
    assert "TALENT PASSPORT" in text.upper()
    assert spec.document_ref in text
    assert "PROFESSIONAL SHARE EDITION" in text
    assert b"/FontFile2" in data
    assert b"/DCTDecode" in data  # official JPEG logo embedded via DCTDecode

    # Embedded is not enough: verify the logo is actually placed near the top
    # of the page, not drawn off the bottom edge by a coordinate mistake.
    from src.talent_passport.document import tokens as t

    stream = "\n".join(
        page.get_contents().get_data().decode("latin-1")
        for page in PdfReader(BytesIO(data)).pages
    )
    placements = [
        (float(m.group(1)), float(m.group(2)))
        for m in re.finditer(
            r"[-\d.]+ 0 0 [-\d.]+ ([-\d.]+) ([-\d.]+) cm\s*/[\w.]+ Do", stream
        )
    ]
    assert placements, "no image placements found in PDF content"
    assert any(y > t.PAGE_HEIGHT * 0.7 for _, y in placements), (
        "official logo must be drawn near the top of a page"
    )


def test_logo_is_drawn_inside_the_visible_page():
    """The logo is top-positioned like every helper; drawImage needs bottom-based y.

    A previous bug passed ``top - height`` straight to ReportLab, placing the
    logo below the page edge while the image was still embedded in the file.
    """
    from reportlab.lib.units import mm

    from src.talent_passport.document import tokens as t
    from src.talent_passport.document.assets import draw_logo

    class RecordingCanvas:
        def __init__(self):
            self.calls = []

        def drawImage(self, image, x, y, **kwargs):
            self.calls.append((x, y, kwargs["width"], kwargs["height"]))

    canvas = RecordingCanvas()
    top = 12 * mm
    draw_logo(canvas, 20 * mm, top, 32 * mm, 14 * mm)
    assert len(canvas.calls) == 1
    x, drawn_y, width, height = canvas.calls[0]

    # The recorded bottom-based origin must match the top-based request.
    assert drawn_y == t.PAGE_HEIGHT - (top + height)
    assert 0 < drawn_y < t.PAGE_HEIGHT
    assert drawn_y + height <= t.PAGE_HEIGHT
    assert width > 0 and height > 0


def test_generation_creates_immutable_versions(app, env, tmp_path):
    _configure_storage(app, tmp_path)
    passport = _publish(env)
    first = document_service.generate(
        passport, DOCUMENT_PERSONAL_RECORD,
        "http://localhost:5001", generated_by_id=env["student_id"], actor_role="student",
    )
    first_bytes = document_service.read_document(first)
    first_hash = first.file_sha256

    passport_services.update_profile(passport, {"headline": "Platform engineer"})
    db.session.commit()
    second = document_service.generate(
        passport, DOCUMENT_PERSONAL_RECORD,
        "http://localhost:5001", generated_by_id=env["student_id"], actor_role="student",
    )

    assert first.status == DOCUMENT_SUPERSEDED
    assert first.is_current is False
    assert second.status == "current"
    assert second.content_sha256 != first.content_sha256
    assert first.file_sha256 == first_hash
    assert document_service.read_document(first) == first_bytes
    assert len(document_service.history(passport, DOCUMENT_PERSONAL_RECORD)) == 2
    assert first.storage_path != second.storage_path


def test_private_document_api_ownership_preview_and_download(app, env, tmp_path):
    _configure_storage(app, tmp_path)
    client = app.test_client()
    response = client.post(
        "/api/v1/student/talent-passport/documents/generate",
        headers=_header_id(env["student_id"]),
        json={"edition": DOCUMENT_PERSONAL_RECORD},
    )
    assert response.status_code == 201, response.get_json()
    document = response.get_json()
    assert document["edition"] == DOCUMENT_PERSONAL_RECORD
    assert document["content_sha256"]
    assert document["verification_url"].endswith(document["document_ref"])

    preview = client.get(
        f"/api/v1/student/talent-passport/documents/{document['document_ref']}/preview",
        headers=_header_id(env["student_id"]),
    )
    assert preview.status_code == 200
    assert preview.data.startswith(b"%PDF")
    assert "inline" in preview.headers["Content-Disposition"]
    assert "no-store" in preview.headers["Cache-Control"]

    download = client.get(
        f"/api/v1/student/talent-passport/documents/{document['document_ref']}/download",
        headers=_header_id(env["student_id"]),
    )
    assert download.status_code == 200
    assert "attachment" in download.headers["Content-Disposition"]

    denied = client.get(
        f"/api/v1/student/talent-passport/documents/{document['document_ref']}/metadata",
        headers=_header_id(env["other_student_id"]),
    )
    assert denied.status_code == 403

    history = client.get(
        "/api/v1/student/talent-passport/documents",
        headers=_header_id(env["student_id"]),
    )
    assert history.status_code == 200
    assert len(history.get_json()["items"]) == 1


def test_public_share_edition_enforces_privacy_and_verification(app, env, tmp_path):
    root = _configure_storage(app, tmp_path)
    passport = _publish(env, skills=True, profile=True, show_email=False, show_phone=False)
    user = User.query.get(env["student_id"])
    user.email = "SECRET_EMAIL@example.test"
    user.phone_number = "SECRET_PHONE"
    # These records belong to sections that the owner hid from the share edition.
    db.session.add(PortfolioItem(
        passport_id=passport.id, student_id=env["student_id"],
        source_type="manual", source_id=None, display_title="SECRET_PROJECT_TITLE",
        display_description="SECRET_PROJECT_DESCRIPTION", is_featured=True, display_order=0,
    ))
    db.session.add(PassportAchievementRecord(
        passport_id=passport.id, student_id=env["student_id"],
        achievement_key="secret_achievement", title="SECRET_ACHIEVEMENT",
        description="SECRET_ACHIEVEMENT_DETAIL", earned_at=now_local(),
    ))
    db.session.commit()

    document = document_service.generate(
        passport, DOCUMENT_PROFESSIONAL_SHARE, "http://localhost:5001", actor_role="public"
    )
    document_ref = document.document_ref  # capture before request teardown detaches ORM object
    text = _text(document_service.read_document(document))
    # Contact details require explicit consent even when the profile is visible.
    assert "SECRET_EMAIL" not in text
    assert "SECRET_PHONE" not in text
    # Hidden section content must never appear as placeholder or real records.
    assert "SECRET_PROJECT_TITLE" not in text
    assert "SECRET_PROJECT_DESCRIPTION" not in text
    assert "SECRET_ACHIEVEMENT" not in text
    assert passport.public_slug in text

    client = app.test_client()
    metadata = client.get(f"/api/v1/talent/public/{passport.public_slug}/documents/current/metadata")
    assert metadata.status_code == 200
    public_meta = metadata.get_json()
    assert public_meta["status"] == "current"
    assert "content_sha256" not in public_meta
    assert "file_sha256" not in public_meta

    verification = client.get(f"/api/v1/talent/verify/{document_ref}")
    assert verification.status_code == 200
    result = verification.get_json()
    assert result["verified"] is True
    assert result["state"] == "issued"
    assert "content_sha256" not in result
    assert "student_id" not in result

    assert list(root.glob("*.pdf"))


def test_revocation_fails_public_verification_closed(app, env, tmp_path):
    _configure_storage(app, tmp_path)
    passport = _publish(env)
    document = document_service.generate(
        passport, DOCUMENT_PROFESSIONAL_SHARE, "http://localhost:5001", actor_role="public"
    )
    document_ref = document.document_ref  # capture before request teardown detaches ORM object
    client = app.test_client()
    revoke = client.post(
        f"/api/v1/admin/talent/documents/{document_ref}/revoke",
        headers=_header_id(env["admin_id"]), json={},
    )
    assert revoke.status_code == 200
    assert revoke.get_json()["status"] == "revoked"

    verification = client.get(f"/api/v1/talent/verify/{document_ref}")
    assert verification.get_json()["state"] == "revoked"
    assert verification.get_json()["verified"] is False


def test_stored_document_hash_is_enforced(app, env, tmp_path):
    _configure_storage(app, tmp_path)
    _sync(env)
    passport = _passport(env)
    document = document_service.generate(
        passport, DOCUMENT_PERSONAL_RECORD, "http://localhost:5001",
        generated_by_id=env["student_id"], actor_role="student",
    )
    from src.talent_passport.document import storage
    path = app.config["TALENT_PASSPORT_PDF_STORAGE_DIR"] + "/" + document.storage_path
    with open(path, "wb") as handle:
        handle.write(b"%PDF-1.4 tampered")
    with pytest.raises(ValueError, match="integrity check"):
        document_service.read_document(document)
