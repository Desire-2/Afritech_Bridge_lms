"""add Talent Passport tables

Revision ID: f7a2b9c3d4e5
Revises: a7a8e1c3f5b2
Create Date: 2026-11-22 00:00:00.000000

Purely additive: creates the Talent Passport feature tables. No existing table
is modified, so the LMS and its /api/v1 surface keep working unchanged.
Every DDL step is guarded so the revision is safe to re-run after a partial
failure and safe against a database already provisioned by ``db.create_all()``.

Downgrade drops only these tables (development use only).
"""
from alembic import op
import sqlalchemy as sa

revision = 'f7a2b9c3d4e5'
down_revision = 'a7a8e1c3f5b2'
branch_labels = None
depends_on = None


TABLES = [
    "talent_passport_achievements",
    "talent_passport_audit_events",
    "talent_passport_visibility",
    "talent_portfolio_items",
    "talent_skill_evidence",
    "talent_student_skills",
    "talent_course_skill_mappings",
    "talent_skill_definitions",
    "talent_skill_categories",
    "talent_processed_events",
    "talent_passports",
]


def _has_table(name):
    return sa.inspect(op.get_bind()).has_table(name)


def _create(name, *args, **kwargs):
    if not _has_table(name):
        op.create_table(name, *args, **kwargs)


def _index(name, table, columns, **kwargs):
    if _has_table(table):
        existing = {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes(table)}
        if name not in existing:
            op.create_index(name, table, columns, **kwargs)


def _drop(name):
    if _has_table(name):
        op.drop_table(name)


def upgrade():
    _create(
        "talent_passports",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False, unique=True),
        sa.Column("afritech_user_id", sa.String(64), nullable=True, unique=True),
        sa.Column("public_slug", sa.String(64), nullable=False, unique=True),
        sa.Column("headline", sa.String(160), nullable=True),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("country", sa.String(80), nullable=True),
        sa.Column("city", sa.String(120), nullable=True),
        sa.Column("career_interests", sa.JSON(), nullable=True),
        sa.Column("professional_goals", sa.Text(), nullable=True),
        sa.Column("areas_of_specialization", sa.JSON(), nullable=True),
        sa.Column("preferred_work_arrangement", sa.String(80), nullable=True),
        sa.Column("preferred_opportunities", sa.JSON(), nullable=True),
        sa.Column("languages", sa.JSON(), nullable=True),
        sa.Column("portfolio_url", sa.String(255), nullable=True),
        sa.Column("github_url", sa.String(255), nullable=True),
        sa.Column("linkedin_url", sa.String(255), nullable=True),
        sa.Column("other_links", sa.JSON(), nullable=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("published_at", sa.DateTime(), nullable=True),
        sa.Column("completeness_score", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("last_synced_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    _index("ix_talent_passports_student_id", "talent_passports", ["student_id"])
    _index("ix_talent_passports_public_slug", "talent_passports", ["public_slug"])
    _index("ix_talent_passports_is_published", "talent_passports", ["is_published"])

    _create(
        "talent_skill_categories",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("name_fr", sa.String(120), nullable=True),
        sa.Column("name_rw", sa.String(120), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )

    _create(
        "talent_skill_definitions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("key", sa.String(80), nullable=False, unique=True),
        sa.Column("category_id", sa.Integer(), sa.ForeignKey("talent_skill_categories.id"), nullable=False),
        sa.Column("name", sa.String(160), nullable=False),
        sa.Column("name_fr", sa.String(160), nullable=True),
        sa.Column("name_rw", sa.String(160), nullable=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_profile_key", sa.String(64), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    _index("ix_talent_skill_definitions_source_profile_key", "talent_skill_definitions", ["source_profile_key"])

    _create(
        "talent_course_skill_mappings",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=False),
        sa.Column("skill_definition_id", sa.Integer(), sa.ForeignKey("talent_skill_definitions.id"), nullable=False),
        sa.Column("source_type", sa.String(40), nullable=False, server_default="course_outcome"),
        sa.Column("source_id", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("competency_criteria", sa.Text(), nullable=True),
        sa.Column("min_score", sa.Float(), nullable=True),
        sa.Column("proficiency_label", sa.String(64), nullable=True),
        sa.Column("required_verification", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("course_id", "skill_definition_id", "source_type", "source_id",
                            name="uq_talent_mapping_course_skill_source"),
    )
    _index("ix_talent_course_skill_mappings_course_id", "talent_course_skill_mappings", ["course_id"])
    _index("ix_talent_course_skill_mappings_skill_definition_id", "talent_course_skill_mappings", ["skill_definition_id"])
    _index("ix_talent_mapping_source", "talent_course_skill_mappings", ["source_type", "source_id"])

    _create(
        "talent_student_skills",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("skill_definition_id", sa.Integer(), sa.ForeignKey("talent_skill_definitions.id"), nullable=False),
        sa.Column("status", sa.String(32), nullable=False, server_default="LEARNING"),
        sa.Column("proficiency_level", sa.String(64), nullable=True),
        sa.Column("proficiency_basis", sa.String(255), nullable=True),
        sa.Column("first_evidence_at", sa.DateTime(), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("passport_id", "skill_definition_id", name="uq_talent_student_skill"),
    )
    for column in ("passport_id", "student_id", "skill_definition_id", "status"):
        _index(f"ix_talent_student_skills_{column}", "talent_student_skills", [column])

    _create(
        "talent_skill_evidence",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("student_skill_id", sa.Integer(), sa.ForeignKey("talent_student_skills.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_type", sa.String(48), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=False),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("mapping_id", sa.Integer(), sa.ForeignKey("talent_course_skill_mappings.id"), nullable=True),
        sa.Column("title", sa.String(255), nullable=True),
        sa.Column("happened_at", sa.DateTime(), nullable=True),
        sa.Column("score", sa.Float(), nullable=True),
        sa.Column("grading_state", sa.String(32), nullable=True),
        sa.Column("verification_status", sa.String(32), nullable=False, server_default="PENDING"),
        sa.Column("verified_by", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("verified_at", sa.DateTime(), nullable=True),
        sa.Column("event_key", sa.String(160), nullable=True, unique=True),
        sa.Column("extra", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("student_skill_id", "source_type", "source_id", name="uq_talent_evidence_source"),
    )
    for column in ("student_skill_id", "student_id", "course_id", "verification_status"):
        _index(f"ix_talent_skill_evidence_{column}", "talent_skill_evidence", [column])
    _index("ix_talent_evidence_student_source", "talent_skill_evidence", ["student_id", "source_type", "source_id"])

    _create(
        "talent_portfolio_items",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("source_type", sa.String(48), nullable=False),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("course_id", sa.Integer(), sa.ForeignKey("courses.id"), nullable=True),
        sa.Column("display_title", sa.String(255), nullable=False),
        sa.Column("display_description", sa.Text(), nullable=True),
        sa.Column("reflection", sa.Text(), nullable=True),
        sa.Column("technologies", sa.JSON(), nullable=True),
        sa.Column("external_url", sa.String(500), nullable=True),
        sa.Column("is_featured", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("display_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("passport_id", "source_type", "source_id", name="uq_talent_portfolio_source"),
    )
    for column in ("passport_id", "student_id", "course_id", "is_featured"):
        _index(f"ix_talent_portfolio_items_{column}", "talent_portfolio_items", [column])

    _create(
        "talent_passport_visibility",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False, unique=True),
        sa.Column("is_published", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("professional_profile", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("skills", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("projects", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("certificates", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("learning_history", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("achievements", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("show_email", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("show_phone", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    _index("ix_talent_passport_visibility_passport_id", "talent_passport_visibility", ["passport_id"])

    _create(
        "talent_passport_achievements",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("achievement_key", sa.String(80), nullable=False),
        sa.Column("title", sa.String(180), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("source_type", sa.String(48), nullable=True),
        sa.Column("source_id", sa.Integer(), nullable=True),
        sa.Column("icon", sa.String(80), nullable=True),
        sa.Column("earned_at", sa.DateTime(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("passport_id", "achievement_key", "source_type", "source_id",
                            name="uq_talent_passport_achievement"),
    )
    for column in ("passport_id", "student_id"):
        _index(f"ix_talent_passport_achievements_{column}", "talent_passport_achievements", [column])

    _create(
        "talent_passport_audit_events",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False),
        sa.Column("actor_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("actor_role", sa.String(40), nullable=True),
        sa.Column("action", sa.String(80), nullable=False),
        sa.Column("details", sa.JSON(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    for column in ("passport_id", "action", "created_at"):
        _index(f"ix_talent_passport_audit_events_{column}", "talent_passport_audit_events", [column])

    _create(
        "talent_processed_events",
        sa.Column("event_key", sa.String(200), primary_key=True),
        sa.Column("event_type", sa.String(80), nullable=False),
        sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
        sa.Column("processed_at", sa.DateTime(), nullable=False),
    )
    _index("ix_talent_processed_events_student_id", "talent_processed_events", ["student_id"])


def downgrade():
    for name in TABLES:
        _drop(name)
