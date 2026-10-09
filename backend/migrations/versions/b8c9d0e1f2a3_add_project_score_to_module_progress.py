"""Add project_score column to module_progress.

Revision ID: b8c9d0e1f2a3
Revises: a9b8c7d6e5f4
Create Date: 2026-10-09 12:00:00.000000

Project grades were written to module_progress.project_score by the grading
routes, but the model never declared the column, so SQLAlchemy discarded the
value silently and project scores never counted toward the module completion
score. This adds the missing column; the model now maps it and the weighted
module score blends it into the hands-on (assignments) bucket.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'b8c9d0e1f2a3'
down_revision = 'a9b8c7d6e5f4'
branch_labels = None
depends_on = None


def upgrade():
    # Older deployments may already have the column if the bootstrap
    # auto-migration ran before Alembic took over schema management.
    bind = op.get_bind()
    progress_columns = {
        column['name'] for column in sa.inspect(bind).get_columns('module_progress')
    }
    if 'project_score' not in progress_columns:
        with op.batch_alter_table('module_progress', schema=None) as batch_op:
            batch_op.add_column(sa.Column('project_score', sa.Float(), nullable=True))


def downgrade():
    with op.batch_alter_table('module_progress', schema=None) as batch_op:
        batch_op.drop_column('project_score')
