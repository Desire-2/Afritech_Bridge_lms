"""add versioned Talent Passport PDF documents

Revision ID: c4e8b7a1d9f3
Revises: f7a2b9c3d4e5
Create Date: 2026-11-23 00:00:00.000000

Additive only: creates the snapshot table for backend-generated PDFs. No
existing table or column is changed. DDL is guarded so a database created by
``db.create_all()`` or a partially applied migration remains safe to upgrade.
"""
from alembic import op
import sqlalchemy as sa

revision = 'c4e8b7a1d9f3'
down_revision = 'f7a2b9c3d4e5'
branch_labels = None
depends_on = None

TABLE = "talent_passport_documents"


def _has_table(name):
    return sa.inspect(op.get_bind()).has_table(name)


def _index(name, columns, **kwargs):
    if _has_table(TABLE):
        existing = {idx["name"] for idx in sa.inspect(op.get_bind()).get_indexes(TABLE)}
        if name not in existing:
            op.create_index(name, TABLE, columns, **kwargs)


def upgrade():
    if not _has_table(TABLE):
        op.create_table(
            TABLE,
            sa.Column("id", sa.Integer(), primary_key=True),
            sa.Column("passport_id", sa.Integer(), sa.ForeignKey("talent_passports.id"), nullable=False),
            sa.Column("student_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=False),
            sa.Column("document_ref", sa.String(64), nullable=False, unique=True),
            sa.Column("edition", sa.String(32), nullable=False,
                      server_default=sa.text("'professional_share'")),
            sa.Column("template_version", sa.String(20), nullable=False),
            sa.Column("data_revision", sa.String(32), nullable=False),
            sa.Column("content_sha256", sa.String(64), nullable=False),
            sa.Column("file_sha256", sa.String(64), nullable=False),
            sa.Column("storage_path", sa.String(500), nullable=False),
            sa.Column("status", sa.String(20), nullable=False, server_default=sa.text("'current'")),
            sa.Column("is_current", sa.Boolean(), nullable=False, server_default=sa.true()),
            sa.Column("generated_at", sa.DateTime(), nullable=False),
            sa.Column("generated_by_id", sa.Integer(), sa.ForeignKey("users.id"), nullable=True),
            sa.Column("superseded_at", sa.DateTime(), nullable=True),
            sa.Column("revoked_at", sa.DateTime(), nullable=True),
            sa.Column("metadata_json", sa.JSON(), nullable=True),
            sa.UniqueConstraint("document_ref", name="uq_talent_document_ref"),
        )
    _index("ix_talent_passport_documents_passport_id", ["passport_id"])
    _index("ix_talent_passport_documents_student_id", ["student_id"])
    _index("ix_talent_passport_documents_document_ref", ["document_ref"])
    _index("ix_talent_passport_documents_edition", ["edition"])
    _index("ix_talent_passport_documents_status", ["status"])
    _index("ix_talent_passport_documents_generated_at", ["generated_at"])
    _index("ix_talent_passport_documents_file_sha256", ["file_sha256"])
    _index("ix_talent_passport_documents_data_revision", ["data_revision"])
    _index("ix_talent_document_edition_current", ["passport_id", "edition", "is_current"])
    _index("ix_talent_document_ref_status", ["document_ref", "status"])


def downgrade():
    if _has_table(TABLE):
        op.drop_table(TABLE)
