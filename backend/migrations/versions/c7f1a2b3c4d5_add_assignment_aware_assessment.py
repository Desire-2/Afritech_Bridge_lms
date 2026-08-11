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


def upgrade():
    with op.batch_alter_table('excel_grading_results') as batch_op:
        batch_op.add_column(sa.Column('assessment_spec_version', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('assessment_spec_hash', sa.String(length=64), nullable=True))
        batch_op.add_column(sa.Column('rubric_version', sa.String(length=30), nullable=True))
        batch_op.add_column(sa.Column('requirements_count', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('requirements_satisfied', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('requirements_partial', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('requirements_failed', sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column('analyzers_used', _json_type(), nullable=True))
        batch_op.add_column(sa.Column('analyzer_errors', _json_type(), nullable=True))
        batch_op.add_column(sa.Column('overall_confidence', sa.Float(), nullable=True))
        batch_op.create_index('ix_excel_grading_results_assessment_spec_hash', ['assessment_spec_hash'])

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
    op.create_index('ix_assignment_assessment_specs_assignment_id', 'assignment_assessment_specs', ['assignment_id'])
    op.create_index('ix_assignment_assessment_specs_course_id', 'assignment_assessment_specs', ['course_id'])
    op.create_index('ix_assignment_assessment_specs_module_id', 'assignment_assessment_specs', ['module_id'])
    op.create_index('ix_assignment_assessment_specs_source_hash', 'assignment_assessment_specs', ['source_hash'])
    op.create_index('ix_assignment_assessment_specs_created_at', 'assignment_assessment_specs', ['created_at'])


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
