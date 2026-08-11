"""Add assignment-aware assessment metadata and versioned specs.

Revision ID: c7f1a2b3c4d5
Revises: a1b2c3d4e5f6
"""

from alembic import op
import sqlalchemy as sa

revision = 'c7f1a2b3c4d5'
down_revision = 'a1b2c3d4e5f6'
branch_labels = None
depends_on = None


def _json_type():
    # Keep the migration portable across the production PostgreSQL database
    # and the SQLite databases used by local/test environments.
    return sa.JSON()


def _inspector():
    """Return a fresh inspector bound to the current migration connection.

    A fresh inspector is created on every call so that objects created earlier
    in this migration are reflected correctly (no stale cache).
    """
    return sa.inspect(op.get_bind())


def _existing_indexes(table):
    try:
        return {ix['name'] for ix in _inspector().get_indexes(table)}
    except sa.exc.NoSuchTableError:
        return set()


def upgrade():
    # ─────────────────────────────────────────────────────────────────────
    # excel_grading_results – add new columns / index only if missing.
    #
    # NOTE: main.py calls db.create_all() at import time, which pre-creates
    # tables defined in the models but NEVER alters existing tables. The
    # assignment_assessment_specs table below therefore usually already
    # exists when this migration runs; the column adds on this existing
    # table are the part that genuinely still needs applying.
    # ─────────────────────────────────────────────────────────────────────
    if _inspector().has_table('excel_grading_results'):
        existing = {c['name'] for c in _inspector().get_columns('excel_grading_results')}

        columns = [
            sa.Column('assessment_spec_version', sa.String(length=30), nullable=True),
            sa.Column('assessment_spec_hash', sa.String(length=64), nullable=True),
            sa.Column('rubric_version', sa.String(length=30), nullable=True),
            sa.Column('requirements_count', sa.Integer(), nullable=True),
            sa.Column('requirements_satisfied', sa.Integer(), nullable=True),
            sa.Column('requirements_partial', sa.Integer(), nullable=True),
            sa.Column('requirements_failed', sa.Integer(), nullable=True),
            sa.Column('analyzers_used', _json_type(), nullable=True),
            sa.Column('analyzer_errors', _json_type(), nullable=True),
            sa.Column('overall_confidence', sa.Float(), nullable=True),
        ]
        missing = [col for col in columns if col.name not in existing]
        if missing:
            with op.batch_alter_table('excel_grading_results') as batch_op:
                for col in missing:
                    batch_op.add_column(col)

        if 'ix_excel_grading_results_assessment_spec_hash' not in _existing_indexes('excel_grading_results'):
            op.create_index(
                'ix_excel_grading_results_assessment_spec_hash',
                'excel_grading_results',
                ['assessment_spec_hash'],
            )

    # ─────────────────────────────────────────────────────────────────────
    # assignment_assessment_specs – create the table only if it is missing
    # (it is normally pre-created by main.py's db.create_all() at import
    # time, which is why `CREATE TABLE` previously failed with
    # "relation ... already exists").
    # ─────────────────────────────────────────────────────────────────────
    if not _inspector().has_table('assignment_assessment_specs'):
        op.create_table(
            'assignment_assessment_specs',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column('assignment_id', sa.Integer(), nullable=False),
            sa.Column('course_id', sa.Integer(), sa.ForeignKey('courses.id'), nullable=True),
            sa.Column('module_id', sa.Integer(), nullable=True),
            sa.Column('source_hash', sa.String(length=64), nullable=False),
            sa.Column('engine_version', sa.String(length=30), nullable=False),
            sa.Column('rubric_version', sa.String(length=30), nullable=True),
            sa.Column('spec_data', _json_type(), nullable=False),
            sa.Column('approved', sa.Boolean(), nullable=True, server_default=sa.false()),
            sa.Column('approved_by', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
            sa.Column('approved_at', sa.DateTime(), nullable=True),
            sa.Column('created_at', sa.DateTime(), nullable=True),
            sa.UniqueConstraint('assignment_id', 'source_hash', name='uq_assignment_assessment_source'),
        )

    # Ensure the unique constraint exists even when the table was pre-created.
    # (Batch mode is used so this fallback also works on SQLite, which cannot
    # ALTER TABLE ADD CONSTRAINT outside of a table rebuild.)
    existing_uq = {
        c['name'] for c in _inspector().get_unique_constraints('assignment_assessment_specs')
    }
    if 'uq_assignment_assessment_source' not in existing_uq:
        with op.batch_alter_table('assignment_assessment_specs') as batch_op:
            batch_op.create_unique_constraint(
                'uq_assignment_assessment_source',
                ['assignment_id', 'source_hash'],
            )

    # Ensure all expected indexes exist (idempotent).
    for index_name, column in [
        ('ix_assignment_assessment_specs_assignment_id', 'assignment_id'),
        ('ix_assignment_assessment_specs_course_id', 'course_id'),
        ('ix_assignment_assessment_specs_module_id', 'module_id'),
        ('ix_assignment_assessment_specs_source_hash', 'source_hash'),
        ('ix_assignment_assessment_specs_created_at', 'created_at'),
    ]:
        if index_name not in _existing_indexes('assignment_assessment_specs'):
            op.create_index(index_name, 'assignment_assessment_specs', [column])


def downgrade():
    op.drop_index('ix_assignment_assessment_specs_created_at', table_name='assignment_assessment_specs')
    op.drop_index('ix_assignment_assessment_specs_source_hash', table_name='assignment_assessment_specs')
    op.drop_index('ix_assignment_assessment_specs_module_id', table_name='assignment_assessment_specs')
    op.drop_index('ix_assignment_assessment_specs_course_id', table_name='assignment_assessment_specs')
    op.drop_index('ix_assignment_assessment_specs_assignment_id', table_name='assignment_assessment_specs')
    op.drop_table('assignment_assessment_specs')
    with op.batch_alter_table('excel_grading_results') as batch_op:
        batch_op.drop_index('ix_excel_grading_results_assessment_spec_hash')
        batch_op.drop_column('overall_confidence')
        batch_op.drop_column('analyzer_errors')
        batch_op.drop_column('analyzers_used')
        batch_op.drop_column('requirements_failed')
        batch_op.drop_column('requirements_partial')
        batch_op.drop_column('requirements_satisfied')
        batch_op.drop_column('requirements_count')
        batch_op.drop_column('rubric_version')
        batch_op.drop_column('assessment_spec_hash')
        batch_op.drop_column('assessment_spec_version')
