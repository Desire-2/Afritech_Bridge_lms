"""Add autonomous course-creation workflow tables

Revision ID: ff12a3b4c5d6
Revises: b8c9d0e1f2a3
Create Date: 2026-09-13 09:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'ff12a3b4c5d6'
down_revision = 'b8c9d0e1f2a3'
branch_labels = None
depends_on = None


def upgrade():
    # ---------- course_workflows ----------
    op.create_table(
        'course_workflows',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('instructor_id', sa.Integer(), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('input_data', sa.Text(), nullable=True),
        sa.Column('status', sa.Enum('PLANNING', 'GENERATING', 'REVIEWING',
                                    'NEEDS_REVIEW', 'PAUSED', 'COMPLETED',
                                    'CANCELLED', 'FAILED',
                                    name='workflowstatus', native_enum=False),
                  nullable=False),
        sa.Column('current_stage', sa.String(length=100), nullable=False),
        sa.Column('progress', sa.Float(), nullable=False),
        sa.Column('provider_chain', sa.Text(), nullable=True),
        sa.Column('preferences', sa.Text(), nullable=True),
        sa.Column('workspace', sa.Text(), nullable=True),
        sa.Column('checkpoint', sa.Text(), nullable=True),
        sa.Column('resume_token', sa.String(length=100), nullable=True),
        sa.Column('version', sa.Integer(), nullable=False),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.Column('cancelled_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='fk_wf_course'),
        sa.ForeignKeyConstraint(['instructor_id'], ['users.id'], name='fk_wf_instructor'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_workflows_status', 'course_workflows', ['status'], if_not_exists=True)
    op.create_index('ix_workflows_instructor', 'course_workflows', ['instructor_id'], if_not_exists=True)
    op.create_index('ix_workflows_created', 'course_workflows', ['created_at'], if_not_exists=True)
    op.create_index('ix_workflows_resume_token', 'course_workflows', ['resume_token'], if_not_exists=True)

    # ---------- workflow_tasks ----------
    op.create_table(
        'workflow_tasks',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('parent_task_id', sa.String(length=36), nullable=True),
        sa.Column('agent_type', sa.String(length=100), nullable=False),
        sa.Column('task_type', sa.String(length=100), nullable=False),
        sa.Column('title', sa.String(length=500), nullable=True),
        sa.Column('status', sa.Enum('PENDING', 'READY', 'RUNNING', 'COMPLETED',
                                    'FAILED', 'NEEDS_REVIEW', 'CANCELLED',
                                    'SKIPPED', name='workflowtaskstatus',
                                    native_enum=False), nullable=False),
        sa.Column('result_status', sa.String(length=20), nullable=True),
        sa.Column('input_data', sa.Text(), nullable=True),
        sa.Column('output_data', sa.Text(), nullable=True),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('reasoning', sa.Text(), nullable=True),
        sa.Column('attempts', sa.Integer(), nullable=False),
        sa.Column('max_attempts', sa.Integer(), nullable=False),
        sa.Column('run_order', sa.Integer(), nullable=False),
        sa.Column('scheduled_for', sa.DateTime(), nullable=True),
        sa.Column('locked_at', sa.DateTime(), nullable=True),
        sa.Column('lock_owner', sa.String(length=100), nullable=True),
        sa.Column('lock_until', sa.DateTime(), nullable=True),
        sa.Column('target_type', sa.String(length=50), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.Column('started_at', sa.DateTime(), nullable=True),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_task_wf'),
        sa.ForeignKeyConstraint(['parent_task_id'], ['workflow_tasks.id'], name='fk_task_parent'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_workflow_tasks_status', 'workflow_tasks', ['status'], if_not_exists=True)
    op.create_index('ix_workflow_tasks_workflow_id', 'workflow_tasks', ['workflow_id'], if_not_exists=True)
    op.create_index('ix_workflow_tasks_parent_task_id', 'workflow_tasks', ['parent_task_id'], if_not_exists=True)
    op.create_index('ix_workflow_tasks_workflow_status',
                    'workflow_tasks', ['workflow_id', 'status'], if_not_exists=True)

    # ---------- task_dependencies ----------
    op.create_table(
        'task_dependencies',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('task_id', sa.String(length=36), nullable=False),
        sa.Column('depends_on_task_id', sa.String(length=36), nullable=False),
        sa.Column('condition', sa.String(length=50), nullable=False),
        sa.ForeignKeyConstraint(['task_id'], ['workflow_tasks.id'], name='fk_dep_task'),
        sa.ForeignKeyConstraint(['depends_on_task_id'], ['workflow_tasks.id'],
                                name='fk_dep_dependent'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_task_dependencies_task_id', 'task_dependencies', ['task_id'], if_not_exists=True)
    op.create_index('ix_task_dependencies_depends_on', 'task_dependencies',
                    ['depends_on_task_id'], if_not_exists=True)

    # ---------- workflow_events ----------
    op.create_table(
        'workflow_events',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('task_id', sa.String(length=36), nullable=True),
        sa.Column('event_type', sa.String(length=100), nullable=False),
        sa.Column('payload', sa.Text(), nullable=True),
        sa.Column('seq', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_evt_wf'),
        sa.ForeignKeyConstraint(['task_id'], ['workflow_tasks.id'], name='fk_evt_task'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_workflow_events_workflow_id', 'workflow_events', ['workflow_id'], if_not_exists=True)
    op.create_index('ix_workflow_events_task_id', 'workflow_events', ['task_id'], if_not_exists=True)
    op.create_index('ix_workflow_events_workflow_seq',
                    'workflow_events', ['workflow_id', 'seq'], if_not_exists=True)

    # ---------- agent_runs ----------
    op.create_table(
        'agent_runs',
        sa.Column('id', sa.String(length=36), nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=True),
        sa.Column('task_id', sa.String(length=36), nullable=True),
        sa.Column('agent_type', sa.String(length=100), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=200), nullable=True),
        sa.Column('prompt_hash', sa.String(length=64), nullable=True),
        sa.Column('tokens_in', sa.Integer(), nullable=True),
        sa.Column('tokens_out', sa.Integer(), nullable=True),
        sa.Column('latency_ms', sa.Integer(), nullable=True),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('error_code', sa.String(length=100), nullable=True),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('completed_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_run_wf'),
        sa.ForeignKeyConstraint(['task_id'], ['workflow_tasks.id'], name='fk_run_task'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_agent_runs_workflow_id', 'agent_runs', ['workflow_id'], if_not_exists=True)
    op.create_index('ix_agent_runs_task_id', 'agent_runs', ['task_id'], if_not_exists=True)
    op.create_index('ix_agent_runs_prompt_hash', 'agent_runs', ['prompt_hash'], if_not_exists=True)

    # ---------- quality_reviews ----------
    op.create_table(
        'quality_reviews',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('task_id', sa.String(length=36), nullable=True),
        sa.Column('component_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('score', sa.Float(), nullable=False),
        sa.Column('passed', sa.Boolean(), nullable=False),
        sa.Column('checks', sa.Text(), nullable=True),
        sa.Column('review_data', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_rev_wf'),
        sa.ForeignKeyConstraint(['task_id'], ['workflow_tasks.id'], name='fk_rev_task'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_quality_reviews_workflow_id', 'quality_reviews', ['workflow_id'], if_not_exists=True)
    op.create_index('ix_quality_reviews_task_id', 'quality_reviews', ['task_id'], if_not_exists=True)

    # ---------- repair_attempts ----------
    op.create_table(
        'repair_attempts',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('task_id', sa.String(length=36), nullable=True),
        sa.Column('target_type', sa.String(length=50), nullable=True),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('attempt_number', sa.Integer(), nullable=False),
        sa.Column('issue_summary', sa.Text(), nullable=True),
        sa.Column('repair_prompt_hash', sa.String(length=64), nullable=True),
        sa.Column('provider', sa.String(length=50), nullable=True),
        sa.Column('model', sa.String(length=200), nullable=True),
        sa.Column('new_output', sa.Text(), nullable=True),
        sa.Column('success', sa.Boolean(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_rep_wf'),
        sa.ForeignKeyConstraint(['task_id'], ['workflow_tasks.id'], name='fk_rep_task'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_repair_attempts_workflow_id', 'repair_attempts', ['workflow_id'], if_not_exists=True)
    op.create_index('ix_repair_attempts_task_id', 'repair_attempts', ['task_id'], if_not_exists=True)

    # ---------- course_generation_versions ----------
    op.create_table(
        'course_generation_versions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('course_id', sa.Integer(), nullable=True),
        sa.Column('component_type', sa.String(length=50), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=False),
        sa.Column('version_number', sa.Integer(), nullable=False),
        sa.Column('content_hash', sa.String(length=64), nullable=False),
        sa.Column('content', sa.Text(), nullable=False),
        sa.Column('created_by', sa.Integer(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_ver_wf'),
        sa.ForeignKeyConstraint(['course_id'], ['courses.id'], name='fk_ver_course'),
        sa.PrimaryKeyConstraint('id'),
        if_not_exists=True,
    )
    op.create_index('ix_gen_versions_component_target', 'course_generation_versions',
                    ['component_type', 'target_id', 'version_number'], if_not_exists=True)
    op.create_index('ix_gen_versions_workflow_id', 'course_generation_versions',
                    ['workflow_id'], if_not_exists=True)
    op.create_index('ix_gen_versions_course_id', 'course_generation_versions',
                    ['course_id'], if_not_exists=True)
    op.create_index('ix_gen_versions_content_hash', 'course_generation_versions',
                    ['content_hash'], if_not_exists=True)

    # ---------- agent_memory ----------
    op.create_table(
        'agent_memory',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('workflow_id', sa.String(length=36), nullable=False),
        sa.Column('scope', sa.String(length=50), nullable=False),
        sa.Column('key', sa.String(length=200), nullable=False),
        sa.Column('value', sa.Text(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(['workflow_id'], ['course_workflows.id'], name='fk_mem_wf'),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('workflow_id', 'scope', 'key', name='uq_agent_memory_scope_key'),
        if_not_exists=True,
    )
    op.create_index('ix_agent_memory_workflow_id', 'agent_memory', ['workflow_id'], if_not_exists=True)


def downgrade():
    op.drop_index('ix_agent_memory_workflow_id', table_name='agent_memory')
    op.drop_table('agent_memory')
    op.drop_index('ix_gen_versions_content_hash', table_name='course_generation_versions')
    op.drop_index('ix_gen_versions_course_id', table_name='course_generation_versions')
    op.drop_index('ix_gen_versions_workflow_id', table_name='course_generation_versions')
    op.drop_index('ix_gen_versions_component_target', table_name='course_generation_versions')
    op.drop_table('course_generation_versions')
    op.drop_index('ix_repair_attempts_task_id', table_name='repair_attempts')
    op.drop_index('ix_repair_attempts_workflow_id', table_name='repair_attempts')
    op.drop_table('repair_attempts')
    op.drop_index('ix_quality_reviews_task_id', table_name='quality_reviews')
    op.drop_index('ix_quality_reviews_workflow_id', table_name='quality_reviews')
    op.drop_table('quality_reviews')
    op.drop_index('ix_agent_runs_prompt_hash', table_name='agent_runs')
    op.drop_index('ix_agent_runs_task_id', table_name='agent_runs')
    op.drop_index('ix_agent_runs_workflow_id', table_name='agent_runs')
    op.drop_table('agent_runs')
    op.drop_index('ix_workflow_events_workflow_seq', table_name='workflow_events')
    op.drop_index('ix_workflow_events_task_id', table_name='workflow_events')
    op.drop_index('ix_workflow_events_workflow_id', table_name='workflow_events')
    op.drop_table('workflow_events')
    op.drop_index('ix_task_dependencies_depends_on', table_name='task_dependencies')
    op.drop_index('ix_task_dependencies_task_id', table_name='task_dependencies')
    op.drop_table('task_dependencies')
    op.drop_index('ix_workflow_tasks_workflow_status', table_name='workflow_tasks')
    op.drop_index('ix_workflow_tasks_parent_task_id', table_name='workflow_tasks')
    op.drop_index('ix_workflow_tasks_workflow_id', table_name='workflow_tasks')
    op.drop_index('ix_workflow_tasks_status', table_name='workflow_tasks')
    op.drop_table('workflow_tasks')
    op.drop_index('ix_workflows_resume_token', table_name='course_workflows')
    op.drop_index('ix_workflows_created', table_name='course_workflows')
    op.drop_index('ix_workflows_instructor', table_name='course_workflows')
    op.drop_index('ix_workflows_status', table_name='course_workflows')
    op.drop_table('course_workflows')
