"""HTTP API for Talent Passport.

All private routes are JWT-protected and ownership-checked. Public routes
receive only data already filtered by :func:`services.public_payload`; no
client-side toggle can reveal a hidden section.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from functools import wraps
from typing import Any, Dict, Optional, Tuple

from flask import Blueprint, Response, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from sqlalchemy import or_
from sqlalchemy.exc import IntegrityError

from ..models.course_models import Course
from ..models.user_models import User, db
from ..utils.time_utils import now_local
from . import services
from .config import PUBLIC_VIEW_LIMIT_PER_MINUTE
from .enums import (
    DOCUMENT_EDITIONS,
    DOCUMENT_PERSONAL_RECORD,
    DOCUMENT_PROFESSIONAL_SHARE,
    EVIDENCE_APPROVED,
    EVIDENCE_REJECTED,
    EVIDENCE_VERIFICATION_STATES,
    EVIDENCE_VERIFIED,
    MAPPING_SOURCE_TYPES,
    VISIBILITY_KEYS,
)
from .evidence import audit, recompute_student_skill, sync_student
from .models import (
    CourseSkillMapping,
    PassportAuditEvent,
    SkillCategory,
    SkillDefinition,
    SkillEvidence,
    StudentSkill,
    TalentPassport,
)
from .document import service as document_service
from .taxonomy import ensure_taxonomy

talent_passport_bp = Blueprint("talent_passport", __name__, url_prefix="/api/v1")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _error(code: str, message: str, status: int, details: Any = None):
    payload: Dict[str, Any] = {"error": {"code": code, "message": message}}
    if details is not None:
        payload["error"]["details"] = details
    return jsonify(payload), status


def safe(fn):
    """Translate expected domain errors into stable JSON error envelopes."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ValueError as exc:
            return _error("validation_error", str(exc), 400)
        except LookupError as exc:
            return _error("not_found", str(exc), 404)
        except PermissionError as exc:
            return _error("forbidden", str(exc), 403)
        except IntegrityError:
            db.session.rollback()
            return _error("conflict", "The record already exists", 409)
        except Exception:
            current_app.logger.exception("Talent Passport request failed")
            return _error("internal_error", "Request failed", 500)
    return wrapper


def _json_body() -> Dict[str, Any]:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise ValueError("A JSON object body is required")
    return data


def _current_user() -> User:
    try:
        user_id = int(get_jwt_identity())
    except (TypeError, ValueError):
        raise PermissionError("Invalid token identity")
    user = User.query.get(user_id)
    if user is None or not getattr(user, "is_active", True):
        raise PermissionError("User not found")
    return user


def _role(user: User) -> str:
    return str(getattr(getattr(user, "role", None), "name", "") or "").lower()


def _require_admin() -> User:
    user = _current_user()
    if _role(user) not in ("admin", "superadmin"):
        raise PermissionError("Administrator access required")
    return user


def _require_mapping_actor() -> User:
    """Admins manage all mappings; instructors manage their own courses."""
    user = _current_user()
    if _role(user) not in ("admin", "superadmin", "instructor"):
        raise PermissionError("Instructor or administrator access required")
    return user


def _ensure_course_access(actor: User, course_id: int) -> None:
    if _role(actor) == "instructor":
        course = Course.query.get(course_id)
        if course is None or course.instructor_id != actor.id:
            raise PermissionError("You may only map skills to your own courses")


def _requested_student_id() -> Optional[int]:
    value = request.args.get("student_id", type=int)
    if value:
        return value
    if request.is_json:
        data = request.get_json(silent=True) or {}
        if isinstance(data, dict) and data.get("student_id"):
            try:
                return int(data["student_id"])
            except (TypeError, ValueError):
                raise ValueError("student_id must be an integer")
    return None


def _passport_for_request():
    user = _current_user()
    role = _role(user)
    if role == "student":
        return services.get_passport(user.id)
    if role in ("admin", "superadmin"):
        student_id = _requested_student_id() or user.id
        target = User.query.get(student_id)
        if target is None:
            raise LookupError("Student not found")
        return services.get_passport(student_id)
    raise PermissionError("Student access required")


class _RateLimiter:
    def __init__(self):
        self._hits: Dict[str, deque] = {}
        self._lock = threading.Lock()

    def check(self, key: str) -> bool:
        now = time.monotonic()
        cutoff = now - 60
        with self._lock:
            hits = self._hits.setdefault(key, deque())
            while hits and hits[0] <= cutoff:
                hits.popleft()
            if len(hits) >= PUBLIC_VIEW_LIMIT_PER_MINUTE:
                return False
            hits.append(now)
            return True


_public_limiter = _RateLimiter()


def _public_rate_limited(action: str) -> bool:
    ip = request.remote_addr or "unknown"
    return not _public_limiter.check(f"passport:{action}:{ip}")


def _pdf_response(data: bytes, filename: str, inline: bool = False) -> Response:
    disposition = "inline" if inline else "attachment"
    return Response(
        data,
        mimetype="application/pdf",
        headers={
            "Content-Disposition": f'{disposition}; filename="{filename}"',
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
        },
    )


def _verification_base_url() -> str:
    return request.host_url.rstrip("/")


def _document_edition(default: str = DOCUMENT_PERSONAL_RECORD) -> str:
    data = request.get_json(silent=True) if request.is_json else None
    value = None
    if isinstance(data, dict):
        value = data.get("edition")
    value = value or request.args.get("edition") or default
    if value not in DOCUMENT_EDITIONS:
        raise ValueError("Unknown document edition")
    return value


def _document_for_owner(document_ref: str):
    document = document_service.get_document(document_ref)
    user = _current_user()
    if _role(user) not in ("admin", "superadmin") and document.student_id != user.id:
        raise PermissionError("You may only access your own documents")
    return document


def _document_filename(document) -> str:
    return f"talent-passport-{document.edition}-{document.document_ref}.pdf"


# ---------------------------------------------------------------------------
# Private student routes
# ---------------------------------------------------------------------------
@talent_passport_bp.route("/student/talent-passport/profile", methods=["GET"])
@jwt_required()
@safe
def get_profile():
    passport = _passport_for_request()
    return jsonify({
        "profile": services.serialize_profile(passport),
        "completeness": services.completeness(passport)["score"],
    })


@talent_passport_bp.route("/student/talent-passport/profile", methods=["PUT"])
@jwt_required()
@safe
def put_profile():
    passport = _passport_for_request()
    profile = services.update_profile(passport, _json_body())
    audit(passport, "profile_updated", actor_id=passport.student_id, actor_role="student")
    db.session.commit()
    return jsonify({
        "profile": profile,
        "completeness": services.completeness(passport)["score"],
    })


@talent_passport_bp.route("/student/talent-passport/overview", methods=["GET"])
@jwt_required()
@safe
def get_overview():
    passport = _passport_for_request()
    return jsonify(services.get_overview(passport.student_id))


@talent_passport_bp.route("/student/talent-passport/skills", methods=["GET"])
@jwt_required()
@safe
def get_skills():
    passport = _passport_for_request()
    language = request.args.get("lang", "en")
    return jsonify(services.get_skills(passport.student_id, language))


@talent_passport_bp.route("/student/talent-passport/skills/<int:skill_id>/evidence", methods=["GET"])
@jwt_required()
@safe
def get_skill_evidence(skill_id: int):
    passport = _passport_for_request()
    return jsonify(services.get_skill_evidence(
        passport.student_id, skill_id,
        request.args.get("page", 1), request.args.get("page_size", 20),
    ))


@talent_passport_bp.route("/student/talent-passport/projects", methods=["GET"])
@jwt_required()
@safe
def get_projects():
    passport = _passport_for_request()
    return jsonify(services.get_projects(
        passport.student_id, request.args.get("page", 1), request.args.get("page_size", 20)
    ))


@talent_passport_bp.route("/student/talent-passport/projects", methods=["POST"])
@jwt_required()
@safe
def post_project():
    passport = _passport_for_request()
    item = services.create_project(passport.student_id, _json_body())
    audit(passport, "project_created", actor_id=passport.student_id, actor_role="student",
          details={"portfolio_item_id": item["id"]})
    db.session.commit()
    return jsonify(item), 201


@talent_passport_bp.route("/student/talent-passport/projects/<int:project_id>", methods=["PUT"])
@jwt_required()
@safe
def put_project(project_id: int):
    passport = _passport_for_request()
    item = services.update_project(passport.student_id, project_id, _json_body())
    audit(passport, "project_updated", actor_id=passport.student_id, actor_role="student",
          details={"portfolio_item_id": project_id})
    db.session.commit()
    return jsonify(item)


@talent_passport_bp.route("/student/talent-passport/projects/<int:project_id>", methods=["DELETE"])
@jwt_required()
@safe
def delete_project(project_id: int):
    passport = _passport_for_request()
    services.delete_project(passport.student_id, project_id)
    audit(passport, "project_deleted", actor_id=passport.student_id, actor_role="student",
          details={"portfolio_item_id": project_id})
    db.session.commit()
    return jsonify({"success": True})


@talent_passport_bp.route("/student/talent-passport/certificates", methods=["GET"])
@jwt_required()
@safe
def get_certificates():
    passport = _passport_for_request()
    return jsonify(services.get_certificates(
        passport.student_id, request.args.get("page", 1), request.args.get("page_size", 20)
    ))


@talent_passport_bp.route("/student/talent-passport/achievements", methods=["GET"])
@jwt_required()
@safe
def get_achievements():
    passport = _passport_for_request()
    return jsonify(services.get_achievements(
        passport.student_id, request.args.get("page", 1), request.args.get("page_size", 20)
    ))


@talent_passport_bp.route("/student/talent-passport/timeline", methods=["GET"])
@jwt_required()
@safe
def get_timeline():
    passport = _passport_for_request()
    return jsonify(services.get_timeline(
        passport.student_id, request.args.get("page", 1), request.args.get("page_size", 20)
    ))


@talent_passport_bp.route("/student/talent-passport/completeness", methods=["GET"])
@jwt_required()
@safe
def get_completeness():
    passport = _passport_for_request()
    return jsonify(services.completeness(passport))


@talent_passport_bp.route("/student/talent-passport/visibility", methods=["GET"])
@jwt_required()
@safe
def get_visibility():
    passport = _passport_for_request()
    return jsonify(services.serialize_visibility(passport))


@talent_passport_bp.route("/student/talent-passport/visibility", methods=["PUT"])
@jwt_required()
@safe
def put_visibility():
    passport = _passport_for_request()
    visibility = services.update_visibility(passport, _json_body())
    audit(passport, "visibility_updated", actor_id=passport.student_id, actor_role="student")
    db.session.commit()
    return jsonify(visibility)


@talent_passport_bp.route("/student/talent-passport/publish", methods=["POST"])
@jwt_required()
@safe
def publish_passport():
    passport = _passport_for_request()
    visibility = services.serialize_visibility(passport)
    if not any(visibility.get(key) for key in VISIBILITY_KEYS):
        raise ValueError("Select at least one public section before publishing")
    result = services.publish(passport)
    db.session.commit()
    return jsonify(result)


@talent_passport_bp.route("/student/talent-passport/unpublish", methods=["POST"])
@jwt_required()
@safe
def unpublish_passport():
    passport = _passport_for_request()
    result = services.unpublish(passport)
    db.session.commit()
    return jsonify(result)


@talent_passport_bp.route("/student/talent-passport/sync", methods=["POST"])
@jwt_required()
@safe
def sync_passport():
    passport = _passport_for_request()
    counts = sync_student(passport.student_id)
    audit(passport, "manual_sync", actor_id=passport.student_id, actor_role="student")
    db.session.commit()
    return jsonify({"success": True, **counts})


@talent_passport_bp.route("/student/talent-passport/taxonomy", methods=["GET"])
@jwt_required()
@safe
def get_taxonomy():
    ensure_taxonomy()
    db.session.commit()
    return jsonify(services.get_taxonomy(request.args.get("lang", "en")))


# ---------------------------------------------------------------------------
# Versioned document routes (JWT + ownership)
# ---------------------------------------------------------------------------
@talent_passport_bp.route("/student/talent-passport/documents/generate", methods=["POST"])
@jwt_required()
@safe
def generate_document():
    passport = _passport_for_request()
    actor = _current_user()
    edition = _document_edition()
    document = document_service.generate(
        passport, edition, _verification_base_url(),
        generated_by_id=actor.id, actor_role=_role(actor),
    )
    return jsonify(document_service.serialize_document(
        document, private=True, verification_base_url=_verification_base_url()
    )), 201


@talent_passport_bp.route("/student/talent-passport/documents", methods=["GET"])
@jwt_required()
@safe
def list_documents():
    passport = _passport_for_request()
    edition = request.args.get("edition")
    if edition is not None and edition not in DOCUMENT_EDITIONS:
        raise ValueError("Unknown document edition")
    documents = document_service.history(passport, edition)
    return jsonify({"items": [
        document_service.serialize_document(
            item, private=True, verification_base_url=_verification_base_url()
        ) for item in documents
    ]})


@talent_passport_bp.route("/student/talent-passport/documents/<document_ref>/metadata", methods=["GET"])
@jwt_required()
@safe
def document_metadata(document_ref: str):
    document = _document_for_owner(document_ref)
    return jsonify(document_service.serialize_document(
        document, private=True, verification_base_url=_verification_base_url()
    ))


@talent_passport_bp.route("/student/talent-passport/documents/<document_ref>/preview", methods=["GET"])
@jwt_required()
@safe
def document_preview(document_ref: str):
    document = _document_for_owner(document_ref)
    return _pdf_response(document_service.read_document(document),
                         _document_filename(document), inline=True)


@talent_passport_bp.route("/student/talent-passport/documents/<document_ref>/download", methods=["GET"])
@jwt_required()
@safe
def document_download(document_ref: str):
    document = _document_for_owner(document_ref)
    return _pdf_response(document_service.read_document(document),
                         _document_filename(document))


@talent_passport_bp.route("/student/talent-passport/export/pdf", methods=["POST"])
@jwt_required()
@safe
def export_pdf():
    """Legacy owner export: generates a Personal Record snapshot."""
    passport = _passport_for_request()
    actor = _current_user()
    document = document_service.generate(
        passport, DOCUMENT_PERSONAL_RECORD, _verification_base_url(),
        generated_by_id=actor.id, actor_role=_role(actor),
    )
    return _pdf_response(document_service.read_document(document),
                         _document_filename(document))


# ---------------------------------------------------------------------------
# Public routes — backend-filtered, no JWT
# ---------------------------------------------------------------------------
@talent_passport_bp.route("/talent/public/<slug>", methods=["GET"])
@safe
def public_view(slug: str):
    if _public_rate_limited("view"):
        return _error("rate_limited", "Too many requests", 429)
    payload = services.public_payload(slug)
    if payload is None:
        return _error("not_found", "Talent Passport is not publicly available", 404)
    return jsonify(payload)


@talent_passport_bp.route("/talent/public/<slug>/documents/current/metadata", methods=["GET"])
@safe
def public_document_metadata(slug: str):
    if _public_rate_limited("document"):
        return _error("rate_limited", "Too many requests", 429)
    try:
        document = document_service.current_for_slug(slug, _verification_base_url())
    except LookupError as exc:
        return _error("not_found", str(exc), 404)
    return jsonify(document_service.serialize_document(
        document, private=False, verification_base_url=_verification_base_url()
    ))


@talent_passport_bp.route("/talent/public/<slug>/documents/current/preview", methods=["GET"])
@safe
def public_document_preview(slug: str):
    if _public_rate_limited("document"):
        return _error("rate_limited", "Too many requests", 429)
    try:
        document = document_service.current_for_slug(slug, _verification_base_url())
        data = document_service.read_document(document)
    except LookupError as exc:
        return _error("not_found", str(exc), 404)
    return _pdf_response(data, _document_filename(document), inline=True)


@talent_passport_bp.route("/talent/public/<slug>/documents/current/download", methods=["GET"])
@safe
def public_document_download(slug: str):
    if _public_rate_limited("document"):
        return _error("rate_limited", "Too many requests", 429)
    try:
        document = document_service.current_for_slug(slug, _verification_base_url())
        data = document_service.read_document(document)
    except LookupError as exc:
        return _error("not_found", str(exc), 404)
    return _pdf_response(data, _document_filename(document))


@talent_passport_bp.route("/talent/public/<slug>/pdf", methods=["GET"])
@safe
def public_pdf(slug: str):
    """Legacy public PDF route: resolves the current Professional Share snapshot."""
    if _public_rate_limited("pdf"):
        return _error("rate_limited", "Too many requests", 429)
    try:
        document = document_service.current_for_slug(slug, _verification_base_url())
        data = document_service.read_document(document)
    except LookupError as exc:
        return _error("not_found", str(exc), 404)
    return _pdf_response(data, _document_filename(document))


@talent_passport_bp.route("/talent/verify/<document_ref>", methods=["GET"])
@safe
def verify_document(document_ref: str):
    if _public_rate_limited("verify"):
        return _error("rate_limited", "Too many requests", 429)
    return jsonify(document_service.verify(document_ref, _verification_base_url()))


# ---------------------------------------------------------------------------
# Admin controls
# ---------------------------------------------------------------------------
@talent_passport_bp.route("/admin/talent/documents/<document_ref>/revoke", methods=["POST"])
@jwt_required()
@safe
def admin_revoke_document(document_ref: str):
    actor = _require_admin()
    document = document_service.get_document(document_ref)
    document_service.revoke(document, actor.id, _role(actor))
    return jsonify(document_service.serialize_document(
        document, private=True, verification_base_url=_verification_base_url()
    ))


@talent_passport_bp.route("/admin/talent/skills", methods=["GET"])
@jwt_required()
@safe
def admin_list_skills():
    _require_admin()
    ensure_taxonomy()
    db.session.commit()
    return jsonify(services.get_taxonomy(request.args.get("lang", "en")))


@talent_passport_bp.route("/admin/talent/skills", methods=["POST"])
@jwt_required()
@safe
def admin_create_skill():
    actor = _require_admin()
    ensure_taxonomy()
    data = _json_body()
    key = str(data.get("key") or "").strip().lower()
    name = str(data.get("name") or "").strip()
    if not key or not name or len(key) > 80 or len(name) > 160:
        raise ValueError("key and name are required")
    if SkillDefinition.query.filter_by(key=key).first():
        raise ValueError("A skill with this key already exists")

    category_key = str(data.get("category_key") or "technical").strip().lower()
    category = SkillCategory.query.filter_by(key=category_key).first()
    if category is None:
        category = SkillCategory(
            key=category_key, name=category_key.replace("_", " ").title(), sort_order=999
        )
        db.session.add(category)
        db.session.flush()

    skill = SkillDefinition(
        key=key,
        name=name,
        name_fr=(data.get("name_fr") or None),
        name_rw=(data.get("name_rw") or None),
        description=(data.get("description") or None),
        category_id=category.id,
        source_profile_key=(data.get("source_profile_key") or None),
        sort_order=int(data.get("sort_order") or 0),
        is_active=bool(data.get("is_active", True)),
    )
    db.session.add(skill)
    audit(_admin_passport(actor), "skill_created", actor.id, _role(actor), {"skill_key": key})
    db.session.commit()
    return jsonify({
        "id": skill.id, "key": skill.key, "name": skill.name,
        "category_id": skill.category_id, "source_profile_key": skill.source_profile_key,
    }), 201


def _admin_passport(actor: User):
    """Audit target for admin-only changes; admins may not own a passport."""
    return services.get_passport(actor.id)


def _mapping_data(data: Dict[str, Any]) -> Dict[str, Any]:
    try:
        course_id = int(data["course_id"])
        skill_definition_id = int(data["skill_definition_id"])
    except (KeyError, TypeError, ValueError):
        raise ValueError("course_id and skill_definition_id are required integers")
    if Course.query.get(course_id) is None:
        raise LookupError("Course not found")
    _ensure_course_access(_current_user(), course_id)
    if SkillDefinition.query.get(skill_definition_id) is None:
        raise LookupError("Skill definition not found")

    source_type = str(data.get("source_type") or "course_outcome")
    if source_type not in MAPPING_SOURCE_TYPES:
        raise ValueError("Invalid mapping source_type")
    try:
        source_id = int(data.get("source_id") or 0)
    except (TypeError, ValueError):
        raise ValueError("source_id must be an integer")

    min_score = data.get("min_score")
    if min_score not in (None, ""):
        try:
            min_score = float(min_score)
        except (TypeError, ValueError):
            raise ValueError("min_score must be a number")
        if not 0 <= min_score <= 100:
            raise ValueError("min_score must be between 0 and 100")
    else:
        min_score = None

    proficiency_label = data.get("proficiency_label")
    if proficiency_label is not None:
        proficiency_label = str(proficiency_label).strip()[:64] or None
    return {
        "course_id": course_id,
        "skill_definition_id": skill_definition_id,
        "source_type": source_type,
        "source_id": source_id,
        "competency_criteria": (data.get("competency_criteria") or None),
        "min_score": min_score,
        "proficiency_label": proficiency_label,
        "required_verification": bool(data.get("required_verification", False)),
        "created_by": _current_user().id,
    }


def _serialize_mapping(row: CourseSkillMapping) -> Dict[str, Any]:
    course = Course.query.get(row.course_id)
    skill = SkillDefinition.query.get(row.skill_definition_id)
    return {
        "id": row.id,
        "course": {"id": row.course_id, "title": course.title if course else None},
        "skill": {"id": row.skill_definition_id, "name": skill.name if skill else None},
        "source_type": row.source_type,
        "source_id": row.source_id,
        "competency_criteria": row.competency_criteria,
        "min_score": row.min_score,
        "proficiency_label": row.proficiency_label,
        "required_verification": bool(row.required_verification),
    }


@talent_passport_bp.route("/admin/talent/mappings", methods=["GET"])
@jwt_required()
@safe
def admin_list_mappings():
    actor = _require_mapping_actor()
    query = CourseSkillMapping.query
    if _role(actor) == "instructor":
        query = query.join(Course, Course.id == CourseSkillMapping.course_id).filter(
            Course.instructor_id == actor.id
        )
    query = query.order_by(CourseSkillMapping.course_id, CourseSkillMapping.id)
    rows, meta = _admin_paginate(query)
    return jsonify({**meta, "items": [_serialize_mapping(row) for row in rows]})


@talent_passport_bp.route("/admin/talent/mappings", methods=["POST"])
@jwt_required()
@safe
def admin_create_mapping():
    actor = _require_mapping_actor()
    values = _mapping_data(_json_body())
    row = CourseSkillMapping(**values)
    db.session.add(row)
    db.session.flush()
    audit(_admin_passport(actor), "mapping_created", actor.id, _role(actor),
          {"mapping_id": row.id})
    db.session.commit()
    return jsonify(_serialize_mapping(row)), 201


@talent_passport_bp.route("/admin/talent/mappings/<int:mapping_id>", methods=["PUT"])
@jwt_required()
@safe
def admin_update_mapping(mapping_id: int):
    actor = _require_mapping_actor()
    row = CourseSkillMapping.query.get(mapping_id)
    if row is None:
        raise LookupError("Mapping not found")
    data = _json_body()
    values = _mapping_data({**{k: getattr(row, k) for k in (
        "course_id", "skill_definition_id", "source_type", "source_id",
        "competency_criteria", "min_score", "proficiency_label", "required_verification",
    )}, **data})
    values.pop("created_by", None)
    for key, value in values.items():
        setattr(row, key, value)
    row.updated_at = now_local()
    audit(_admin_passport(actor), "mapping_updated", actor.id, _role(actor),
          {"mapping_id": row.id})
    db.session.commit()
    return jsonify(_serialize_mapping(row))


@talent_passport_bp.route("/admin/talent/mappings/<int:mapping_id>", methods=["DELETE"])
@jwt_required()
@safe
def admin_delete_mapping(mapping_id: int):
    actor = _require_mapping_actor()
    row = CourseSkillMapping.query.get(mapping_id)
    if row is None:
        raise LookupError("Mapping not found")
    db.session.delete(row)
    audit(_admin_passport(actor), "mapping_deleted", actor.id, _role(actor),
          {"mapping_id": mapping_id})
    db.session.commit()
    return jsonify({"success": True})


def _admin_paginate(query) -> Tuple[list, Dict[str, int]]:
    page, size = services._page_args(request.args.get("page", 1), request.args.get("page_size", 20))
    total = query.count()
    rows = query.offset((page - 1) * size).limit(size).all()
    return rows, {"total": total, "page": page, "page_size": size}


@talent_passport_bp.route("/admin/talent/evidence", methods=["GET"])
@jwt_required()
@safe
def admin_list_evidence():
    _require_admin()
    query = SkillEvidence.query
    status = request.args.get("status")
    if status:
        normalized = status.upper()
        if normalized not in EVIDENCE_VERIFICATION_STATES:
            raise ValueError("Invalid verification status")
        query = query.filter(SkillEvidence.verification_status == normalized)
    search = (request.args.get("q") or "").strip()
    if search:
        pattern = f"%{search}%"
        query = query.join(User, User.id == SkillEvidence.student_id).filter(
            or_(
                SkillEvidence.title.ilike(pattern),
                User.username.ilike(pattern),
                User.first_name.ilike(pattern),
                User.last_name.ilike(pattern),
            )
        )
    query = query.order_by(SkillEvidence.created_at.desc(), SkillEvidence.id.desc())
    rows, meta = _admin_paginate(query)
    items = []
    for row in rows:
        item = services.serialize_evidence(row)
        student = User.query.get(row.student_id)
        skill = StudentSkill.query.get(row.student_skill_id)
        definition = SkillDefinition.query.get(skill.skill_definition_id) if skill else None
        item["student"] = student.username if student else None
        item["skill"] = definition.name if definition else None
        items.append(item)
    return jsonify({**meta, "items": items})


def _review_evidence(evidence_id: int, verify: bool):
    actor = _require_admin()
    row = SkillEvidence.query.get(evidence_id)
    if row is None:
        raise LookupError("Evidence not found")
    if row.student_id == actor.id:
        raise PermissionError("Self-verification is not allowed")
    if verify:
        row.verification_status = EVIDENCE_VERIFIED
        row.verified_by = actor.id
        row.verified_at = now_local()
        action = "evidence_verified"
    else:
        row.verification_status = EVIDENCE_REJECTED
        row.verified_by = None
        row.verified_at = None
        action = "evidence_rejected"
    if row.student_skill is not None:
        recompute_student_skill(row.student_skill)
        passport = row.student_skill.passport
        if passport is not None:
            audit(passport, action, actor.id, _role(actor), {"evidence_id": row.id})
    db.session.commit()
    return jsonify(services.serialize_evidence(row))


@talent_passport_bp.route("/admin/talent/evidence/<int:evidence_id>/verify", methods=["POST"])
@jwt_required()
@safe
def admin_verify_evidence(evidence_id: int):
    return _review_evidence(evidence_id, True)


@talent_passport_bp.route("/admin/talent/evidence/<int:evidence_id>/reject", methods=["POST"])
@jwt_required()
@safe
def admin_reject_evidence(evidence_id: int):
    return _review_evidence(evidence_id, False)


@talent_passport_bp.route("/admin/talent/audit", methods=["GET"])
@jwt_required()
@safe
def admin_audit():
    _require_admin()
    query = PassportAuditEvent.query
    student_id = request.args.get("student_id", type=int)
    if student_id:
        query = query.join(TalentPassport, TalentPassport.id == PassportAuditEvent.passport_id)
        query = query.filter(TalentPassport.student_id == student_id)
    query = query.order_by(PassportAuditEvent.created_at.desc(), PassportAuditEvent.id.desc())
    rows, meta = _admin_paginate(query)
    return jsonify({
        **meta,
        "items": [{
            "id": row.id,
            "passport_id": row.passport_id,
            "actor_id": row.actor_id,
            "actor_role": row.actor_role,
            "action": row.action,
            "details": row.details or {},
            "created_at": row.created_at.isoformat() if row.created_at else None,
        } for row in rows],
    })
