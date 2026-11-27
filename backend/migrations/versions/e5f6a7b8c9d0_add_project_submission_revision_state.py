"""Add per-submission project revision state.

Revision ID: e5f6a7b8c9d0
Revises: c4e8b7a1d9f3
Create Date: 2026-11-27 00:00:00.000000

Modification/resubmission state used to live on the shared ``projects`` row,
so requesting a revision from one student allowed every student in the course
to resubmit.  These columns put that state on the student's own submission.
"""

from alembic import op
import sqlalchemy as sa


revision = 'e5f6a7b8c9d0'
down_revision = 'c4e8b7a1d9f3'
branch_labels = None
depends_on = None


NEW_COLUMNS = {
    'modification_requested': sa.Column(
        'modification_requested', sa.Boolean(), nullable=False,
        server_default=sa.false(),
    ),
    'modification_request_reason': sa.Column(
        'modification_request_reason', sa.Text(), nullable=True,
    ),
    'modification_requested_at': sa.Column(
        'modification_requested_at', sa.DateTime(), nullable=True,
    ),
    'modification_requested_by': sa.Column(
        'modification_requested_by', sa.Integer(), nullable=True,
    ),
    'can_resubmit': sa.Column(
        'can_resubmit', sa.Boolean(), nullable=False,
        server_default=sa.false(),
    ),
}


def upgrade():
    bind = op.get_bind()
    existing = {
        column['name']
        for column in sa.inspect(bind).get_columns('project_submissions')
    }
    with op.batch_alter_table('project_submissions', schema=None) as batch_op:
        for name, column in NEW_COLUMNS.items():
            if name not in existing:
                batch_op.add_column(column)


def downgrade():
    with op.batch_alter_table('project_submissions', schema=None) as batch_op:
        for name in NEW_COLUMNS:
            batch_op.drop_column(name)
