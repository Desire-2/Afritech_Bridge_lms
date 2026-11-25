"""Talent Passport persistence models.

Design rules (see docs/talent-passport/data-model.md):
* One passport per existing ``User`` (no second account system).
* Evidence stores references + minimal presentation metadata only; the LMS
  tables remain the single source of truth for learning facts.
* All writes are idempotent through unique constraints and ``event_key``.
"""

from __future__ import annotations

import secrets

from sqlalchemy import Index, UniqueConstraint

from ..models.user_models import db
from ..utils.time_utils import now_local
from .enums import (
    DOCUMENT_CURRENT,
    DOCUMENT_PROFESSIONAL_SHARE,
    EVIDENCE_APPROVED,
    EVIDENCE_PENDING,
    SKILL_LEARNING,
)


def _new_slug() -> str:
    """Unpredictable public identifier — never an internal database id."""
    return secrets.token_urlsafe(18)


def _new_document_ref() -> str:
    """Opaque verification reference for an issued PDF snapshot."""
    return "TP-" + secrets.token_urlsafe(15).replace("-", "").replace("_", "")


class TalentPassport(db.Model):
    __tablename__ = "talent_passports"

    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False, unique=True, index=True
    )
    # Reserved for the shared AfriTech Identity Layer. Nullable until that
    # integration exists; never used as a credential.
    afritech_user_id = db.Column(db.String(64), nullable=True, unique=True, index=True)
    public_slug = db.Column(db.String(64), nullable=False, unique=True, index=True, default=_new_slug)

    # Student-authored professional information (never overrides LMS facts).
    headline = db.Column(db.String(160), nullable=True)
    summary = db.Column(db.Text, nullable=True)
    country = db.Column(db.String(80), nullable=True)
    city = db.Column(db.String(120), nullable=True)
    career_interests = db.Column(db.JSON, nullable=True)
    professional_goals = db.Column(db.Text, nullable=True)
    areas_of_specialization = db.Column(db.JSON, nullable=True)
    preferred_work_arrangement = db.Column(db.String(80), nullable=True)
    preferred_opportunities = db.Column(db.JSON, nullable=True)
    languages = db.Column(db.JSON, nullable=True)
    portfolio_url = db.Column(db.String(255), nullable=True)
    github_url = db.Column(db.String(255), nullable=True)
    linkedin_url = db.Column(db.String(255), nullable=True)
    other_links = db.Column(db.JSON, nullable=True)

    is_published = db.Column(db.Boolean, nullable=False, default=False, index=True)
    published_at = db.Column(db.DateTime, nullable=True)
    completeness_score = db.Column(db.Integer, nullable=False, default=0)
    last_synced_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    student = db.relationship(
        "User",
        foreign_keys=[student_id],
        backref=db.backref(
            "talent_passport",
            uselist=False,
            cascade="all, delete-orphan",
            passive_deletes=False,
        ),
    )

    def __repr__(self):  # pragma: no cover - debugging helper
        return f"<TalentPassport student={self.student_id}>"


class SkillCategory(db.Model):
    __tablename__ = "talent_skill_categories"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(64), nullable=False, unique=True, index=True)
    name = db.Column(db.String(120), nullable=False)
    name_fr = db.Column(db.String(120), nullable=True)
    name_rw = db.Column(db.String(120), nullable=True)
    description = db.Column(db.Text, nullable=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True)


class SkillDefinition(db.Model):
    __tablename__ = "talent_skill_definitions"

    id = db.Column(db.Integer, primary_key=True)
    key = db.Column(db.String(80), nullable=False, unique=True, index=True)
    category_id = db.Column(db.Integer, db.ForeignKey("talent_skill_categories.id"), nullable=False)
    name = db.Column(db.String(160), nullable=False)
    name_fr = db.Column(db.String(160), nullable=True)
    name_rw = db.Column(db.String(160), nullable=True)
    description = db.Column(db.Text, nullable=True)
    source_profile_key = db.Column(db.String(64), nullable=True, index=True)
    sort_order = db.Column(db.Integer, nullable=False, default=0)
    is_active = db.Column(db.Boolean, nullable=False, default=True, index=True)

    category = db.relationship("SkillCategory", backref=db.backref("skills", lazy="dynamic"))


class CourseSkillMapping(db.Model):
    """Administrator/instructor-authored mapping from LMS content to a skill.

    ``source_type`` + ``source_id`` locate the exact LMS object. Course-level
    mappings use ``source_id = 0`` so the uniqueness constraint works on every
    supported database (NULLs compare differently across engines).
    """

    __tablename__ = "talent_course_skill_mappings"

    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=False, index=True)
    skill_definition_id = db.Column(
        db.Integer, db.ForeignKey("talent_skill_definitions.id"), nullable=False, index=True
    )
    source_type = db.Column(db.String(40), nullable=False, default="course_outcome")
    source_id = db.Column(db.Integer, nullable=False, default=0)
    competency_criteria = db.Column(db.Text, nullable=True)
    min_score = db.Column(db.Float, nullable=True)
    # A proficiency label may only be awarded when an authorized mapping
    # explicitly defines one and the evidence score reaches ``min_score``.
    proficiency_label = db.Column(db.String(64), nullable=True)
    required_verification = db.Column(db.Boolean, nullable=False, default=False)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    skill = db.relationship("SkillDefinition", backref=db.backref("course_mappings", lazy="dynamic"))
    # Deleting a course must delete its mappings, not try to NULL this
    # non-nullable foreign key during the ORM's dependency pass.
    course = db.relationship(
        "Course",
        backref=db.backref(
            "talent_skill_mappings",
            lazy="dynamic",
            cascade="all, delete-orphan",
            passive_deletes=False,
        ),
    )

    __table_args__ = (
        UniqueConstraint(
            "course_id", "skill_definition_id", "source_type", "source_id",
            name="uq_talent_mapping_course_skill_source",
        ),
        Index("ix_talent_mapping_source", "source_type", "source_id"),
    )


class StudentSkill(db.Model):
    """A student's derived skill record. Status is computed from evidence."""

    __tablename__ = "talent_student_skills"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    skill_definition_id = db.Column(
        db.Integer, db.ForeignKey("talent_skill_definitions.id"), nullable=False, index=True
    )
    status = db.Column(db.String(32), nullable=False, default=SKILL_LEARNING, index=True)
    # Only set when a mapped rubric/assessment defines a proficiency rule.
    proficiency_level = db.Column(db.String(64), nullable=True)
    proficiency_basis = db.Column(db.String(255), nullable=True)
    first_evidence_at = db.Column(db.DateTime, nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "skills", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )
    skill = db.relationship("SkillDefinition", backref=db.backref("student_skills", lazy="dynamic"))

    __table_args__ = (
        UniqueConstraint("passport_id", "skill_definition_id", name="uq_talent_student_skill"),
    )


class SkillEvidence(db.Model):
    """One deduplicated piece of evidence for a student skill.

    A corrected grade updates the row with the same source tuple; it never
    creates a second row. ``event_key`` provides an additional idempotency
    guard for repeated event deliveries.
    """

    __tablename__ = "talent_skill_evidence"

    id = db.Column(db.Integer, primary_key=True)
    student_skill_id = db.Column(
        db.Integer, db.ForeignKey("talent_student_skills.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    source_type = db.Column(db.String(48), nullable=False)
    source_id = db.Column(db.Integer, nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=True, index=True)
    mapping_id = db.Column(
        db.Integer, db.ForeignKey("talent_course_skill_mappings.id"), nullable=True
    )

    # Minimal presentation metadata copied at sync time from the source record.
    title = db.Column(db.String(255), nullable=True)
    happened_at = db.Column(db.DateTime, nullable=True)
    score = db.Column(db.Float, nullable=True)
    grading_state = db.Column(db.String(32), nullable=True)
    verification_status = db.Column(
        db.String(32), nullable=False, default=EVIDENCE_PENDING, index=True
    )
    verified_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    event_key = db.Column(db.String(160), nullable=True, unique=True)
    extra = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    student_skill = db.relationship(
        "StudentSkill",
        backref=db.backref(
            "evidence", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )

    __table_args__ = (
        UniqueConstraint(
            "student_skill_id", "source_type", "source_id",
            name="uq_talent_evidence_source",
        ),
        Index("ix_talent_evidence_student_source", "student_id", "source_type", "source_id"),
    )


class PortfolioItem(db.Model):
    """Student curation layer over existing project/assignment submissions."""

    __tablename__ = "talent_portfolio_items"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    source_type = db.Column(db.String(48), nullable=False)
    # NULL for student-authored (manual) items; NULLs are distinct, so many may exist.
    source_id = db.Column(db.Integer, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=True, index=True)

    display_title = db.Column(db.String(255), nullable=False)
    display_description = db.Column(db.Text, nullable=True)
    reflection = db.Column(db.Text, nullable=True)
    technologies = db.Column(db.JSON, nullable=True)
    external_url = db.Column(db.String(500), nullable=True)
    is_featured = db.Column(db.Boolean, nullable=False, default=False, index=True)
    display_order = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "portfolio_items", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )

    __table_args__ = (
        UniqueConstraint(
            "passport_id", "source_type", "source_id",
            name="uq_talent_portfolio_source",
        ),
    )


class PassportVisibility(db.Model):
    __tablename__ = "talent_passport_visibility"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, unique=True, index=True
    )
    is_published = db.Column(db.Boolean, nullable=False, default=False)
    professional_profile = db.Column(db.Boolean, nullable=False, default=False)
    skills = db.Column(db.Boolean, nullable=False, default=False)
    projects = db.Column(db.Boolean, nullable=False, default=False)
    certificates = db.Column(db.Boolean, nullable=False, default=False)
    learning_history = db.Column(db.Boolean, nullable=False, default=False)
    achievements = db.Column(db.Boolean, nullable=False, default=False)
    show_email = db.Column(db.Boolean, nullable=False, default=False)
    show_phone = db.Column(db.Boolean, nullable=False, default=False)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local, onupdate=now_local)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "visibility", uselist=False, cascade="all, delete-orphan", passive_deletes=False
        ),
    )


class PassportAchievementRecord(db.Model):
    """Passport-specific achievements with explicit earned rules."""

    __tablename__ = "talent_passport_achievements"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    achievement_key = db.Column(db.String(80), nullable=False)
    title = db.Column(db.String(180), nullable=False)
    description = db.Column(db.Text, nullable=True)
    source_type = db.Column(db.String(48), nullable=True)
    source_id = db.Column(db.Integer, nullable=True)
    icon = db.Column(db.String(80), nullable=True)
    earned_at = db.Column(db.DateTime, nullable=False, default=now_local)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "achievement_records", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )

    __table_args__ = (
        UniqueConstraint(
            "passport_id", "achievement_key", "source_type", "source_id",
            name="uq_talent_passport_achievement",
        ),
    )


class PassportAuditEvent(db.Model):
    """Attribution for important changes; never stores sensitive payloads."""

    __tablename__ = "talent_passport_audit_events"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, index=True
    )
    actor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    actor_role = db.Column(db.String(40), nullable=True)
    action = db.Column(db.String(80), nullable=False, index=True)
    details = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "audit_events", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )


class TalentPassportDocument(db.Model):
    """Immutable, versioned snapshot of a backend-generated Passport PDF.

    Issued files are never overwritten. A new generation marks the previous
    document for the same edition as superseded; revocation is a separate,
    explicit administrative action. The opaque ``document_ref`` is the only
    identifier used in public verification URLs.
    """

    __tablename__ = "talent_passport_documents"

    id = db.Column(db.Integer, primary_key=True)
    passport_id = db.Column(
        db.Integer, db.ForeignKey("talent_passports.id"), nullable=False, index=True
    )
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    document_ref = db.Column(
        db.String(64), nullable=False, unique=True, index=True, default=_new_document_ref
    )
    edition = db.Column(db.String(32), nullable=False, default=DOCUMENT_PROFESSIONAL_SHARE, index=True)
    template_version = db.Column(db.String(20), nullable=False)
    data_revision = db.Column(db.String(32), nullable=False, index=True)
    content_sha256 = db.Column(db.String(64), nullable=False)
    file_sha256 = db.Column(db.String(64), nullable=False, index=True)
    storage_path = db.Column(db.String(500), nullable=False)
    status = db.Column(db.String(20), nullable=False, default=DOCUMENT_CURRENT, index=True)
    is_current = db.Column(db.Boolean, nullable=False, default=True, index=True)
    generated_at = db.Column(db.DateTime, nullable=False, default=now_local, index=True)
    generated_by_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    superseded_at = db.Column(db.DateTime, nullable=True)
    revoked_at = db.Column(db.DateTime, nullable=True)
    metadata_json = db.Column(db.JSON, nullable=True)

    passport = db.relationship(
        "TalentPassport",
        backref=db.backref(
            "documents", lazy="dynamic", cascade="all, delete-orphan", passive_deletes=False
        ),
    )

    __table_args__ = (
        Index("ix_talent_document_edition_current", "passport_id", "edition", "is_current"),
        Index("ix_talent_document_ref_status", "document_ref", "status"),
    )

    def __repr__(self):  # pragma: no cover - debugging helper
        return f"<TalentPassportDocument ref={self.document_ref} edition={self.edition}>"


class ProcessedPassportEvent(db.Model):
    """Append-only dedupe ledger for background/event delivery retries."""

    __tablename__ = "talent_processed_events"

    event_key = db.Column(db.String(200), primary_key=True)
    event_type = db.Column(db.String(80), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    processed_at = db.Column(db.DateTime, nullable=False, default=now_local)


__all__ = [
    "TalentPassport",
    "SkillCategory",
    "SkillDefinition",
    "CourseSkillMapping",
    "StudentSkill",
    "SkillEvidence",
    "PortfolioItem",
    "PassportVisibility",
    "PassportAchievementRecord",
    "PassportAuditEvent",
    "TalentPassportDocument",
    "ProcessedPassportEvent",
]
