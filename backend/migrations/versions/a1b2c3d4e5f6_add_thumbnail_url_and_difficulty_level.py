"""Add thumbnail_url and difficulty_level to courses

Revision ID: a1b2c3d4e5f6
Revises: 9b8c7d6e5f4a
Create Date: 2026-07-25 12:00:00.000000

Conditionally adds columns if they don't already exist, so this migration
works on both SQLite (where columns were added outside Alembic)
and PostgreSQL (new environments).

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy import inspect


# revision identifiers, used by Alembic.
revision = 'a1b2c3d4e5f6'
down_revision = '9b8c7d6e5f4a'
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = {c['name'] for c in inspector.get_columns('courses')}

    with op.batch_alter_table('courses', schema=None) as batch_op:
        if 'thumbnail_url' not in columns:
            batch_op.add_column(sa.Column('thumbnail_url', sa.String(length=500), nullable=True))
        if 'difficulty_level' not in columns:
            batch_op.add_column(sa.Column('difficulty_level', sa.String(length=20), nullable=True))


def downgrade():
    conn = op.get_bind()
    inspector = inspect(conn)
    columns = {c['name'] for c in inspector.get_columns('courses')}

    with op.batch_alter_table('courses', schema=None) as batch_op:
        if 'thumbnail_url' in columns:
            batch_op.drop_column('thumbnail_url')
        if 'difficulty_level' in columns:
            batch_op.drop_column('difficulty_level')
