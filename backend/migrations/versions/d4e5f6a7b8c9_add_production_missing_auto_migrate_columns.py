"""Add auto-migrate columns missing from the Alembic history.

Revision ID: d4e5f6a7b8c9
Revises: ff12a3b4c5d6
Create Date: 2026-10-10 09:00:00.000000

_production_ databases never received these columns: the boot-time
``_auto_migrate_missing_columns()`` self-heal was long limited to local
SQLite (concurrent-DDL races), and Alembic had no migration for them, so
every query touching ``user_ai_settings.nvidia_*`` or
``course_applications.current_section`` raised UndefinedColumn there.

This mirrors the self-heal catalog so both mechanisms converge:
  * course_applications.current_section
  * user_ai_settings.nvidia_api_key / nvidia_model_name

``user_ai_settings`` itself is not in the Alembic history either (it was
only ever created by ``create_all`` at boot), so every add is guarded by a
table check — environments provisioned purely by Alembic get the table (and
its columns) from ``create_all`` on first boot, and environments that
already have it get only the missing columns. Like b8c9d0e1f2a3 and
ff12a3b4c5d6, the upgrade is idempotent and safe to re-run.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd4e5f6a7b8c9'
down_revision = 'ff12a3b4c5d6'
branch_labels = None
depends_on = None


_MISSING = {
    'course_applications': {
        'current_section': sa.Column('current_section', sa.Integer(), nullable=True),
    },
    'user_ai_settings': {
        'nvidia_api_key': sa.Column('nvidia_api_key', sa.String(500), nullable=True),
        'nvidia_model_name': sa.Column('nvidia_model_name', sa.String(200), nullable=True),
    },
}


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, additions in _MISSING.items():
        if not inspector.has_table(table):
            # Provisioned by create_all() on first boot, with the columns.
            continue
        existing = {column['name'] for column in inspector.get_columns(table)}
        missing = {
            name: column for name, column in additions.items() if name not in existing
        }
        if not missing:
            continue
        with op.batch_alter_table(table, schema=None) as batch_op:
            for name, column in missing.items():
                batch_op.add_column(column)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)
    for table, additions in _MISSING.items():
        if not inspector.has_table(table):
            continue
        existing = {column['name'] for column in inspector.get_columns(table)}
        present = [name for name in additions if name in existing]
        if not present:
            continue
        with op.batch_alter_table(table, schema=None) as batch_op:
            for name in present:
                batch_op.drop_column(name)
