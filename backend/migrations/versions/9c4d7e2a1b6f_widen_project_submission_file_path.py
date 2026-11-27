"""Widen project_submissions.file_path for Vercel Blob metadata.

Revision ID: 9c4d7e2a1b6f
Revises: e5f6a7b8c9d0
Create Date: 2026-11-27 12:00:00.000000

Project file uploads now store the same JSON file-metadata array as assignment
submissions. A VARCHAR(500) column truncates long Vercel Blob URLs, so widen it
to TEXT. The boot-time schema self-heal performs the same widening for
deployments that do not run Alembic.
"""

from alembic import op
import sqlalchemy as sa


revision = '9c4d7e2a1b6f'
down_revision = 'e5f6a7b8c9d0'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    if bind.dialect.name != 'postgresql':
        # SQLite has no practical VARCHAR length limit; CREATE/ALTER would
        # require a full table copy for no benefit.
        return
    op.execute(
        'ALTER TABLE project_submissions ALTER COLUMN file_path TYPE TEXT'
    )


def downgrade():
    # Not reversed: existing rows may legitimately exceed 500 characters.
    pass
