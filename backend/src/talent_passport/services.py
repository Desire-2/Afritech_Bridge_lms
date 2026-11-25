"""Aggregation and serialization services for Talent Passport.

This module reads LMS records through their models/services and returns only
fields that are safe for the requested audience. It never invents skills,
grades, credentials, achievements or progress.
"""

from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlparse

from ..models.course_models import Course, Enrollment
from ..models.student_models import Certificate
from ..models.user_models import User
from ..services.certificate_service import CertificateService
from ..utils.time_utils import now_local
from .config import COMPLETENESS_TOTAL, COMPLETENESS_WEIGHTS, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE
from .enums import (
    EVIDENCE_REJECTED,
    SKILL_DEMONSTRATED,
    SKILL_EVIDENCE_SUBMITTED,
    SKILL_LEARNING,
    SKILL_VERIFIED,
    VISIBILITY_KEYS,
)
from .evidence import ensure_passport, ensure_visibility, evidence_status
from .models import (
    CourseSkillMapping,
    PassportAchievementRecord,
    PassportAuditEvent,
    PortfolioItem,
    SkillCategory,
    SkillDefinition,
    SkillEvidence,
    StudentSkill,
    TalentPassport,
    db,
)
from .taxonomy import skill_display


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    return [value]


def _bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    return str(value).lower() in {"1", "true", "yes", "on"}


def _safe_url(value: Any) -> Optional[str]:
    if value in (None, ""):
        return None
    if not isinstance(value, str):
        raise ValueError("URL must be a string")
    parsed = urlparse(value)
    if parsed.scheme not in ("http", "https") or not parsed.netloc:
        raise ValueError("URL must be an absolute http(s) URL")
    return value[:500]


def _page_args(page: Any, page_size: Any) -> Tuple[int, int]:
    try:
        page_number = max(1, int(page or 1))
    except (TypeError, ValueError):
        page_number = 1
    try:
        size = int(page_size or DEFAULT_PAGE_SIZE)
    except (TypeError, ValueError):
        size = DEFAULT_PAGE_SIZE
    return page_number, max(1, min(size, MAX_PAGE_SIZE))


def _paginate(query, page: Any, page_size: Any) -> Tuple[List[Any], Dict[str, int]]:
    page_number, size = _page_args(page, page_size)
    total = query.count()
    rows = query.offset((page_number - 1) * size).limit(size).all()
    return rows, {"total": total, "page": page_number, "page_size": size}


def get_passport(student_id: int) -> TalentPassport:
    return ensure_passport(student_id)


def serialize_profile(passport: TalentPassport) -> Dict[str, Any]:
    return {
        "headline": passport.headline,
        "summary": passport.summary,
        "country": passport.country,
        "city": passport.city,
        "career_interests": _list(passport.career_interests),
        "professional_goals": passport.professional_goals,
        "areas_of_specialization": _list(passport.areas_of_specialization),
        "preferred_work_arrangement": passport.preferred_work_arrangement,
        "preferred_opportunities": _list(passport.preferred_opportunities),
        "languages": _list(passport.languages),
        "portfolio_url": passport.portfolio_url,
        "github_url": passport.github_url,
        "linkedin_url": passport.linkedin_url,
        "other_links": _list(passport.other_links),
    }


PROFILE_STRING_FIELDS = {
    "headline": 160,
    "summary": 20000,
    "country": 80,
    "city": 120,
    "professional_goals": 20000,
    "preferred_work_arrangement": 80,
    "portfolio_url": 255,
    "github_url": 255,
    "linkedin_url": 255,
}
PROFILE_LIST_FIELDS = {
    "career_interests": 60,
    "areas_of_specialization": 60,
    "preferred_opportunities": 60,
    "languages": 60,
}


def validate_profile_payload(data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    clean: Dict[str, Any] = {}
    for key, maximum in PROFILE_STRING_FIELDS.items():
        if key not in data:
            continue
        value = data[key]
        if value is not None and not isinstance(value, str):
            raise ValueError(f"{key} must be a string")
        if value is not None and len(value) > maximum:
            raise ValueError(f"{key} is too long")
        if key.endswith("_url") and value:
            clean[key] = _safe_url(value)
        else:
            clean[key] = value or None

    for key, maximum in PROFILE_LIST_FIELDS.items():
        if key not in data:
            continue
        value = data[key]
        if value is None:
            clean[key] = None
            continue
        if not isinstance(value, list) or len(value) > maximum:
            raise ValueError(f"{key} must be a list with at most {maximum} items")
        clean[key] = [
            str(item).strip()[:120]
            for item in value
            if item is not None and str(item).strip()
        ]

    if "other_links" in data:
        value = data["other_links"]
        if value is None:
            clean["other_links"] = None
        elif not isinstance(value, list) or len(value) > 20:
            raise ValueError("other_links must be a list with at most 20 items")
        else:
            links = []
            for item in value:
                if not isinstance(item, dict):
                    raise ValueError("Each other link must be an object")
                label = str(item.get("label") or "Link")[:80]
                url = _safe_url(item.get("url"))
                if url:
                    links.append({"label": label, "url": url})
            clean["other_links"] = links
    return clean


def update_profile(passport: TalentPassport, data: Dict[str, Any]) -> Dict[str, Any]:
    clean = validate_profile_payload(data)
    for key, value in clean.items():
        setattr(passport, key, value)
    passport.updated_at = now_local()
    db.session.flush()
    return serialize_profile(passport)


def serialize_visibility(passport: TalentPassport) -> Dict[str, Any]:
    visibility = ensure_visibility(passport)
    payload = {
        "is_published": bool(passport.is_published and visibility.is_published),
        "public_slug": passport.public_slug,
        "public_url": f"/talent/{passport.public_slug}",
    }
    for key in VISIBILITY_KEYS:
        payload[key] = bool(getattr(visibility, key))
    payload["show_email"] = bool(visibility.show_email)
    payload["show_phone"] = bool(visibility.show_phone)
    return payload


VISIBILITY_BOOLEAN_FIELDS = (*VISIBILITY_KEYS, "show_email", "show_phone")


def update_visibility(passport: TalentPassport, data: Dict[str, Any]) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    visibility = ensure_visibility(passport)
    for key in VISIBILITY_BOOLEAN_FIELDS:
        if key in data:
            setattr(visibility, key, _bool(data[key]))
    db.session.flush()
    return serialize_visibility(passport)


def publish(passport: TalentPassport) -> Dict[str, Any]:
    from .evidence import audit
    visibility = ensure_visibility(passport)
    if not passport.is_published:
        passport.is_published = True
        passport.published_at = now_local()
    visibility.is_published = True
    audit(passport, "published", actor_id=passport.student_id, actor_role="student")
    db.session.flush()
    return {
        "success": True,
        "public_slug": passport.public_slug,
        "public_url": f"/talent/{passport.public_slug}",
        "is_published": True,
    }


def unpublish(passport: TalentPassport) -> Dict[str, Any]:
    from .evidence import audit
    import secrets

    visibility = ensure_visibility(passport)
    was_published = bool(passport.is_published)
    passport.is_published = False
    passport.published_at = None
    visibility.is_published = False
    # Revoke the old URL: a saved or crawled link must never keep working.
    passport.public_slug = secrets.token_urlsafe(18)
    audit(passport, "unpublished", actor_id=passport.student_id, actor_role="student",
          details={"revoked": was_published})
    db.session.flush()
    return {"success": True, "is_published": False}


def canonical_enrollments(student_id: int) -> List[Enrollment]:
    rows = Enrollment.query.filter_by(student_id=student_id).all()
    canonical = []
    seen = set()
    for row in rows:
        chosen = Enrollment.get_canonical(student_id, row.course_id)
        if chosen is None or chosen.course_id in seen:
            continue
        seen.add(chosen.course_id)
        canonical.append(chosen)
    return canonical


def completeness(passport: TalentPassport, persist: bool = True) -> Dict[str, Any]:
    user = User.query.get(passport.student_id)
    enrollments = canonical_enrollments(passport.student_id)
    skills_count = StudentSkill.query.filter(
        StudentSkill.passport_id == passport.id,
        StudentSkill.status != SKILL_LEARNING,
    ).count()
    projects_count = PortfolioItem.query.filter_by(passport_id=passport.id).count()
    certificates_count = Certificate.query.filter_by(
        student_id=passport.student_id, is_active=True
    ).count()

    has_identity = bool(user and (
        (user.first_name or "").strip() or (user.last_name or "").strip()
        or (user.username or "").strip()
    ))
    checks = {
        "basic_profile": bool(has_identity and (passport.country or passport.city)),
        "professional_summary": bool((passport.summary or "").strip()),
        "career_interests": bool(_list(passport.career_interests)),
        "learning_records": bool(enrollments),
        "skills_evidence": bool(skills_count),
        "projects": bool(projects_count),
        "certificates": bool(certificates_count),
    }
    items = []
    earned_total = 0
    for key, weight in COMPLETENESS_WEIGHTS.items():
        earned = weight if checks.get(key) else 0
        earned_total += earned
        items.append({
            "key": key,
            "label": key.replace("_", " ").title(),
            "weight": weight,
            "earned": earned,
            "completed": bool(checks.get(key)),
        })
    score = round(earned_total / COMPLETENESS_TOTAL * 100) if COMPLETENESS_TOTAL else 0
    if persist and passport.completeness_score != score:
        passport.completeness_score = score
        db.session.flush()
    return {
        "score": score,
        "items": items,
        "missing": [key for key, completed in checks.items() if not completed],
    }


def serialize_skill(student_skill: StudentSkill, language: str = "en") -> Dict[str, Any]:
    definition = student_skill.skill
    category = definition.category if definition else None
    evidence_query = SkillEvidence.query.filter_by(student_skill_id=student_skill.id)
    latest = evidence_query.order_by(SkillEvidence.happened_at.desc(), SkillEvidence.id.desc()).first()
    return {
        "id": student_skill.id,
        "skill": {
            "key": definition.key if definition else None,
            "name": skill_display(definition, language) if definition else "Unknown skill",
            "category": category.name if category else None,
        },
        "status": student_skill.status,
        "proficiency_level": student_skill.proficiency_level,
        "proficiency_basis": student_skill.proficiency_basis,
        "evidence_count": evidence_query.count(),
        "latest_evidence_at": _iso(latest.happened_at or latest.created_at) if latest else None,
    }


def get_skills(student_id: int, language: str = "en") -> Dict[str, Any]:
    passport = get_passport(student_id)
    rows = (StudentSkill.query.filter_by(passport_id=passport.id)
            .join(SkillDefinition, SkillDefinition.id == StudentSkill.skill_definition_id)
            .order_by(SkillDefinition.sort_order, SkillDefinition.name)
            .all())
    return {"items": [serialize_skill(row, language) for row in rows], "total": len(rows)}


def serialize_evidence(row: SkillEvidence) -> Dict[str, Any]:
    mapping = CourseSkillMapping.query.get(row.mapping_id) if row.mapping_id else None
    course = Course.query.get(row.course_id) if row.course_id else None
    extra = dict(row.extra or {})
    status = evidence_status(row, mapping)
    return {
        "id": row.id,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "title": row.title,
        "happened_at": _iso(row.happened_at),
        "score": row.score,
        "grading_state": row.grading_state,
        "verification_status": row.verification_status,
        "status": status,
        "course": {"id": course.id, "title": course.title} if course else None,
        "extra": extra,
    }


def get_skill_evidence(student_id: int, skill_id: int, page: Any = 1,
                       page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    passport = get_passport(student_id)
    student_skill = StudentSkill.query.filter_by(id=skill_id, passport_id=passport.id).first()
    if student_skill is None:
        raise LookupError("Skill not found")
    query = (SkillEvidence.query.filter_by(student_skill_id=student_skill.id)
             .order_by(SkillEvidence.happened_at.desc(), SkillEvidence.id.desc()))
    rows, meta = _paginate(query, page, page_size)
    return {**meta, "items": [serialize_evidence(row) for row in rows]}


def serialize_project(row: PortfolioItem) -> Dict[str, Any]:
    course = Course.query.get(row.course_id) if row.course_id else None
    return {
        "id": row.id,
        "title": row.display_title,
        "description": row.display_description,
        "reflection": row.reflection,
        "technologies": _list(row.technologies),
        "external_url": row.external_url,
        "is_featured": bool(row.is_featured),
        "display_order": int(row.display_order or 0),
        "course": {"id": course.id, "title": course.title} if course else None,
        "source_type": row.source_type,
        "source_id": row.source_id,
        "updated_at": _iso(row.updated_at),
    }


def get_projects(student_id: int, page: Any = 1,
                 page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    passport = get_passport(student_id)
    query = (PortfolioItem.query.filter_by(passport_id=passport.id)
             .order_by(PortfolioItem.is_featured.desc(), PortfolioItem.display_order,
                       PortfolioItem.id.desc()))
    rows, meta = _paginate(query, page, page_size)
    return {**meta, "items": [serialize_project(row) for row in rows]}


def validate_project_payload(data: Dict[str, Any], *, partial: bool = False) -> Dict[str, Any]:
    if not isinstance(data, dict):
        raise ValueError("Request body must be a JSON object")
    clean: Dict[str, Any] = {}
    if not partial or "title" in data:
        title = data.get("title")
        if not isinstance(title, str) or not title.strip() or len(title.strip()) > 255:
            raise ValueError("title is required and must be at most 255 characters")
        clean["display_title"] = title.strip()
    for key in ("description", "reflection"):
        if key in data:
            value = data[key]
            if value is not None and not isinstance(value, str):
                raise ValueError(f"{key} must be a string")
            clean["display_description" if key == "description" else key] = value or None
    if "technologies" in data:
        value = data["technologies"]
        if value is None:
            clean["technologies"] = None
        elif not isinstance(value, list) or len(value) > 40:
            raise ValueError("technologies must be a list with at most 40 items")
        else:
            clean["technologies"] = [str(item).strip()[:60] for item in value if str(item).strip()]
    if "external_url" in data:
        clean["external_url"] = _safe_url(data["external_url"])
    if "is_featured" in data:
        clean["is_featured"] = _bool(data["is_featured"])
    if "display_order" in data:
        try:
            clean["display_order"] = int(data["display_order"])
        except (TypeError, ValueError):
            raise ValueError("display_order must be an integer")
    return clean


def create_project(student_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    from .enums import PORTFOLIO_MANUAL
    passport = get_passport(student_id)
    clean = validate_project_payload(data)
    row = PortfolioItem(
        passport_id=passport.id,
        student_id=student_id,
        source_type=PORTFOLIO_MANUAL,
        source_id=None,
        display_title=clean["display_title"],
        display_description=clean.get("display_description"),
        reflection=clean.get("reflection"),
        technologies=clean.get("technologies"),
        external_url=clean.get("external_url"),
        is_featured=clean.get("is_featured", False),
        display_order=clean.get("display_order", 0),
    )
    db.session.add(row)
    db.session.flush()
    return serialize_project(row)


def update_project(student_id: int, project_id: int, data: Dict[str, Any]) -> Dict[str, Any]:
    passport = get_passport(student_id)
    row = PortfolioItem.query.filter_by(id=project_id, passport_id=passport.id).first()
    if row is None:
        raise LookupError("Project not found")
    clean = validate_project_payload(data, partial=True)
    for key, value in clean.items():
        setattr(row, key, value)
    db.session.flush()
    return serialize_project(row)


def delete_project(student_id: int, project_id: int) -> bool:
    passport = get_passport(student_id)
    row = PortfolioItem.query.filter_by(id=project_id, passport_id=passport.id).first()
    if row is None:
        raise LookupError("Project not found")
    # Only the passport's presentation copy is removed; source LMS records and
    # skill evidence remain intact.
    db.session.delete(row)
    db.session.flush()
    return True


def _certificate_status(certificate: Certificate) -> str:
    if not certificate.is_active:
        return "revoked"
    if certificate.expires_at and certificate.expires_at < now_local():
        return "expired"
    return "valid"


def serialize_certificate(row: Certificate, *, public: bool = False) -> Dict[str, Any]:
    payload = {
        "id": row.id,
        "certificate_number": row.certificate_number,
        "title": row.course.title if row.course else "Course certificate",
        "course": {"id": row.course_id, "title": row.course.title if row.course else None},
        "issued_at": _iso(row.issued_at),
        "expires_at": _iso(row.expires_at),
        "status": _certificate_status(row),
        "verification_url": CertificateService.get_verification_url(row.certificate_number),
    }
    if public:
        return payload
    payload["verification_hash"] = row.verification_hash
    return payload


def get_certificates(student_id: int, page: Any = 1,
                     page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    query = (Certificate.query.filter_by(student_id=student_id)
             .order_by(Certificate.issued_at.desc(), Certificate.id.desc()))
    rows, meta = _paginate(query, page, page_size)
    return {**meta, "items": [serialize_certificate(row) for row in rows]}


def serialize_achievement(row) -> Dict[str, Any]:
    return {
        "id": row.id,
        "key": row.achievement_key,
        "title": row.title,
        "description": row.description,
        "icon": row.icon,
        "earned_at": _iso(row.earned_at),
        "source_type": row.source_type,
        "source_id": row.source_id,
    }


def get_achievements(student_id: int, page: Any = 1,
                     page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    get_passport(student_id)
    query = (PassportAchievementRecord.query
             .filter_by(passport_id=get_passport(student_id).id)
             .order_by(PassportAchievementRecord.earned_at.desc(),
                       PassportAchievementRecord.id.desc()))
    rows, meta = _paginate(query, page, page_size)
    return {**meta, "items": [serialize_achievement(row) for row in rows]}


def _timeline_items(student_id: int) -> List[Dict[str, Any]]:
    items: List[Dict[str, Any]] = []
    for enrollment in canonical_enrollments(student_id):
        course = Course.query.get(enrollment.course_id)
        if course is None:
            continue
        completed = bool(enrollment.completed_at) or enrollment.status == "completed"
        date = enrollment.completed_at or enrollment.enrollment_date
        items.append({
            "kind": "course_completed" if completed else "enrollment",
            "title": course.title,
            "description": "Course completed" if completed else "Enrolled in course",
            "date": _iso(date),
            "source_type": "enrollment",
            "source_id": enrollment.id,
            "status": "completed" if completed else "in_progress",
        })

    passport = get_passport(student_id)
    for evidence in SkillEvidence.query.filter_by(student_id=student_id).all():
        if evidence.source_type == "course":
            continue  # enrolment already represented above
        mapping = CourseSkillMapping.query.get(evidence.mapping_id) if evidence.mapping_id else None
        status = evidence_status(evidence, mapping)
        items.append({
            "kind": "evidence",
            "title": evidence.title or "Learning evidence",
            "description": f"Evidence status: {status.replace('_', ' ').title()}",
            "date": _iso(evidence.happened_at or evidence.created_at),
            "source_type": evidence.source_type,
            "source_id": evidence.source_id,
            "status": status,
        })

    for certificate in Certificate.query.filter_by(student_id=student_id).all():
        items.append({
            "kind": "certificate",
            "title": f"Certificate: {certificate.course.title if certificate.course else 'Course'}",
            "description": f"Certificate {_certificate_status(certificate)}",
            "date": _iso(certificate.issued_at),
            "source_type": "certificate",
            "source_id": certificate.id,
            "status": _certificate_status(certificate),
        })

    for achievement in passport.achievement_records.all():
        items.append({
            "kind": "achievement",
            "title": achievement.title,
            "description": achievement.description,
            "date": _iso(achievement.earned_at),
            "source_type": achievement.source_type,
            "source_id": achievement.source_id,
            "status": "awarded",
        })

    items = [item for item in items if item.get("date")]
    items.sort(key=lambda item: item["date"], reverse=True)
    for index, item in enumerate(items, start=1):
        item["id"] = index
    return items


def get_timeline(student_id: int, page: Any = 1,
                 page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    page_number, size = _page_args(page, page_size)
    items = _timeline_items(student_id)
    start = (page_number - 1) * size
    return {
        "items": items[start:start + size],
        "total": len(items),
        "page": page_number,
        "page_size": size,
    }


def get_overview(student_id: int, language: str = "en") -> Dict[str, Any]:
    passport = get_passport(student_id)
    enrollments = canonical_enrollments(student_id)
    skills = get_skills(student_id, language)["items"]
    timeline = get_timeline(student_id, 1, 5)["items"]
    stats = {
        "courses_in_progress": sum(
            1 for row in enrollments
            if not (row.completed_at or row.status == "completed")
        ),
        "courses_completed": sum(
            1 for row in enrollments
            if row.completed_at or row.status == "completed"
        ),
        "skills_learning": sum(1 for row in skills if row["status"] == SKILL_LEARNING),
        "skills_demonstrated": sum(1 for row in skills if row["status"] == SKILL_DEMONSTRATED),
        "skills_verified": sum(1 for row in skills if row["status"] == SKILL_VERIFIED),
        "skills_evidence_submitted": sum(
            1 for row in skills if row["status"] == SKILL_EVIDENCE_SUBMITTED
        ),
        "projects": PortfolioItem.query.filter_by(passport_id=passport.id).count(),
        "certificates": Certificate.query.filter_by(student_id=student_id, is_active=True).count(),
        "achievements": passport.achievement_records.count(),
    }
    return {
        "profile": serialize_profile(passport),
        "stats": stats,
        "recent_timeline": timeline,
        "completeness": completeness(passport)["score"],
        "last_synced_at": _iso(passport.last_synced_at),
    }


def get_taxonomy(language: str = "en") -> Dict[str, Any]:
    categories = SkillCategory.query.filter_by(is_active=True).order_by(SkillCategory.sort_order).all()
    skills = SkillDefinition.query.filter_by(is_active=True).order_by(SkillDefinition.sort_order).all()
    return {
        "categories": [
            {
                "id": row.id,
                "key": row.key,
                "name": skill_display(row, language),
                "name_fr": row.name_fr,
                "name_rw": row.name_rw,
                "sort_order": row.sort_order,
            }
            for row in categories
        ],
        "skills": [
            {
                "id": row.id,
                "key": row.key,
                "name": skill_display(row, language),
                "category_id": row.category_id,
                "source_profile_key": row.source_profile_key,
            }
            for row in skills
        ],
    }


def get_audit(student_id: int, page: Any = 1,
              page_size: Any = DEFAULT_PAGE_SIZE) -> Dict[str, Any]:
    passport = get_passport(student_id)
    query = (PassportAuditEvent.query.filter_by(passport_id=passport.id)
             .order_by(PassportAuditEvent.created_at.desc(), PassportAuditEvent.id.desc()))
    rows, meta = _paginate(query, page, page_size)
    return {
        **meta,
        "items": [{
            "id": row.id,
            "actor_id": row.actor_id,
            "actor_role": row.actor_role,
            "action": row.action,
            "details": row.details or {},
            "created_at": _iso(row.created_at),
        } for row in rows],
    }


# ---------------------------------------------------------------------------
# Public, privacy-filtered payload
# ---------------------------------------------------------------------------
def _public_profile(passport: TalentPassport, visibility) -> Dict[str, Any]:
    # A hidden professional-profile section means no identity or contact data
    # at all. Each remaining section is independently gated below.
    if not getattr(visibility, "professional_profile", False):
        return {}
    user = User.query.get(passport.student_id)
    name = ""
    if user:
        name = f"{user.first_name or ''} {user.last_name or ''}".strip() or user.username
    payload = {
        "name": name,
        "headline": passport.headline,
        "summary": passport.summary,
        "country": passport.country,
        "city": passport.city,
        "career_interests": _list(passport.career_interests),
        "professional_goals": passport.professional_goals,
        "areas_of_specialization": _list(passport.areas_of_specialization),
        "preferred_work_arrangement": passport.preferred_work_arrangement,
        "preferred_opportunities": _list(passport.preferred_opportunities),
        "languages": _list(passport.languages),
        "portfolio_url": passport.portfolio_url,
        "github_url": passport.github_url,
        "linkedin_url": passport.linkedin_url,
        "other_links": _list(passport.other_links),
        "show_email": bool(visibility.show_email),
        "show_phone": bool(visibility.show_phone),
        "email": user.email if visibility.show_email and user else None,
        "phone": getattr(user, "phone_number", None) if visibility.show_phone and user else None,
    }
    return payload


def export_payload(student_id: int) -> Dict[str, Any]:
    """Owner-facing export payload with no grades, feedback or contact details."""
    passport = get_passport(student_id)
    profile = serialize_profile(passport)
    profile.pop("portfolio_url", None)
    profile.pop("github_url", None)
    profile.pop("linkedin_url", None)
    profile.pop("other_links", None)
    return {
        "profile": profile,
        "skills": [
            {
                "name": item["skill"]["name"],
                "category": item["skill"]["category"],
                "status": item["status"],
                "proficiency_level": item["proficiency_level"],
            }
            for item in get_skills(student_id)["items"]
        ],
        "projects": [
            {
                "title": item["title"],
                "description": item["description"],
                "technologies": item["technologies"],
                "external_url": item["external_url"],
            }
            for item in get_projects(student_id, 1, MAX_PAGE_SIZE)["items"]
        ],
        "certificates": [
            serialize_certificate(row, public=True)
            for row in Certificate.query.filter_by(student_id=student_id, is_active=True).all()
        ],
        "achievements": [
            serialize_achievement(row) for row in passport.achievement_records.all()
        ],
        "timeline": [
            {
                "kind": item["kind"],
                "title": item["title"],
                "description": item["description"],
                "date": item["date"],
            }
            for item in get_timeline(student_id, 1, MAX_PAGE_SIZE)["items"]
        ],
        "completeness": completeness(passport)["score"],
        "public_url": f"/talent/{passport.public_slug}" if passport.is_published else None,
    }


def public_payload(slug: str) -> Optional[Dict[str, Any]]:
    """Return a privacy-filtered payload, or None when not publicly visible."""
    passport = TalentPassport.query.filter_by(public_slug=slug).first()
    if passport is None or not passport.is_published:
        return None
    visibility = ensure_visibility(passport)
    if not visibility.is_published:
        return None

    skills_payload = []
    if visibility.skills:
        for skill in get_skills(passport.student_id)["items"]:
            # Scores, feedback, verification hashes and internal ids stay private.
            skills_payload.append({
                "name": skill["skill"]["name"],
                "category": skill["skill"]["category"],
                "status": skill["status"],
                "proficiency_level": skill["proficiency_level"],
            })

    projects_payload = []
    if visibility.projects:
        for row in (PortfolioItem.query.filter_by(passport_id=passport.id)
                    .order_by(PortfolioItem.is_featured.desc(), PortfolioItem.display_order).all()):
            projects_payload.append({
                "title": row.display_title,
                "description": row.display_description,
                "reflection": row.reflection,
                "technologies": _list(row.technologies),
                "external_url": row.external_url,
            })

    certificates_payload = []
    if visibility.certificates:
        for row in Certificate.query.filter_by(student_id=passport.student_id).all():
            if not row.is_active:
                continue
            certificates_payload.append(serialize_certificate(row, public=True))

    achievements_payload = []
    if visibility.achievements:
        for row in passport.achievement_records.all():
            achievements_payload.append({
                "title": row.title,
                "description": row.description,
                "icon": row.icon,
                "earned_at": _iso(row.earned_at),
            })

    timeline_payload = []
    if visibility.learning_history:
        for item in _timeline_items(passport.student_id)[:50]:
            timeline_payload.append({
                "kind": item["kind"],
                "title": item["title"],
                "description": item["description"],
                "date": item["date"],
            })

    return {
        "profile": _public_profile(passport, visibility),
        "sections": {key: bool(getattr(visibility, key)) for key in VISIBILITY_KEYS},
        "skills": skills_payload,
        "projects": projects_payload,
        "certificates": certificates_payload,
        "achievements": achievements_payload,
        "timeline": timeline_payload,
        "published_at": _iso(passport.published_at),
        "completeness": passport.completeness_score,
    }
