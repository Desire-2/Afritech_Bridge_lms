"""Re-add tasks column to projects table.

Revision ID: a9b8c7d6e5f4
Revises: 7f2a1c9d4e6b
Create Date: 2026-09-10 21:20:00.000000

The application code (instructor_assessment_routes, Project.set_tasks/get_tasks,
and the frontend) stores project tasks in a `tasks` TEXT column. Migration
c6a713393185 dropped that column assuming the model no longer declared it, but
the create/update project handlers still write to it, causing an
UndefinedColumn 500 ("column projects.tasks does not exist") on production.
This restores the column so project creation works again.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9b8c7d6e5f4'
down_revision = '7f2a1c9d4e6b'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.add_column(sa.Column('tasks', sa.Text(), nullable=True))


def downgrade():
    with op.batch_alter_table('projects', schema=None) as batch_op:
        batch_op.drop_column('tasks')