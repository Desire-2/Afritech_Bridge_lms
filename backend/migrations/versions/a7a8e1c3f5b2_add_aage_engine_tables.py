"""add AAGE (Adaptive AI Assessment & Grading Engine) tables

Revision ID: a7a8e1c3f5b2
Revises: d9e8f7a6b5c4
Create Date: 2026-11-19 00:00:00.000000

Purely additive: 14 new tables plus nullable columns on the existing
``rubrics`` / ``rubric_criteria`` tables. Every DDL step is guarded so the
revision is safe to re-run after a partial failure and safe against a database
already provisioned by ``db.create_all()``.

Downgrade drops the AAGE tables and extension columns; it is deliberately
data-destructive and must only be used in development.
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = 'a7a8e1c3f5b2'
down_revision = 'd9e8f7a6b5c4'
branch_labels = None
depends_on = None


def _inspector():
    return sa.inspect(op.get_bind())


def _table_exists(name):
    return _inspector().has_table(name)


def _column_names(table):
    return {column['name'] for column in _inspector().get_columns(table)}


def _index_names(table):
    return {index['name'] for index in _inspector().get_indexes(table)}


def _add_columns(table, definitions):
    missing = [(name, column) for name, column in definitions
               if name not in _column_names(table)]
    if not missing:
        return
    with op.batch_alter_table(table, schema=None) as batch_op:
        for _name, column in missing:
            batch_op.add_column(column)


def _drop_columns(table, names):
    existing = _column_names(table)
    present = [name for name in names if name in existing]
    if not present:
        return
    with op.batch_alter_table(table, schema=None) as batch_op:
        for name in present:
            batch_op.drop_column(name)


def _create_index(name, table, columns, unique=False):
    if name not in _index_names(table):
        op.create_index(name, table, columns, unique=unique)


def _drop_index_if_exists(name, table):
    if name in _index_names(table):
        op.drop_index(name, table_name=table)


def _create_table(name, columns, constraints=()):
    if not _table_exists(name):
        op.create_table(name, *columns, *constraints)


def _column(name, type_, nullable=True, primary_key=False,
            foreign_key_target=None, *column_constraints):
    constraints = list(column_constraints)
    if foreign_key_target:
        constraints.insert(0, sa.ForeignKey(foreign_key_target))
    return sa.Column(name, type_, *constraints,
                     nullable=nullable, primary_key=primary_key)


RUBRIC_EXTENSIONS = (
    ('status', sa.Column('status', sa.String(30), nullable=True)),
    ('version', sa.Column('version', sa.Integer(), nullable=True)),
    ('discipline', sa.Column('discipline', sa.String(60), nullable=True)),
    ('assessment_kind', sa.Column('assessment_kind', sa.String(20), nullable=True)),
    ('assessment_id', sa.Column('assessment_id', sa.Integer(), nullable=True)),
    ('source', sa.Column('source', sa.String(20), nullable=True)),
    ('generated_by_ai', sa.Column('generated_by_ai', sa.Boolean(), nullable=True)),
    ('summary', sa.Column('summary', sa.Text(), nullable=True)),
    ('learning_objectives', sa.Column('learning_objectives', sa.JSON(), nullable=True)),
    ('deliverables', sa.Column('deliverables', sa.JSON(), nullable=True)),
    ('technologies', sa.Column('technologies', sa.JSON(), nullable=True)),
    ('evaluation_methods', sa.Column('evaluation_methods', sa.JSON(), nullable=True)),
    ('evaluator_recommendations', sa.Column('evaluator_recommendations', sa.JSON(), nullable=True)),
    ('unverifiable_requirements', sa.Column('unverifiable_requirements', sa.JSON(), nullable=True)),
    ('parent_rubric_id', sa.Column('parent_rubric_id', sa.Integer(), nullable=True)),
    # These reference other tables by id but are plain integers: the legacy
    # rubric tables predate AAGE and retrofitting FKs onto production rows
    # with possible orphan ids would be destructive.
    ('profile_id', sa.Column('profile_id', sa.Integer(), nullable=True)),
    ('approved_by', sa.Column('approved_by', sa.Integer(), nullable=True)),
    ('approved_at', sa.Column('approved_at', sa.DateTime(), nullable=True)),
    ('criteria_weights_total', sa.Column('criteria_weights_total', sa.Float(), nullable=True)),
)

CRITERION_EXTENSIONS = (
    ('created_at', sa.Column('created_at', sa.DateTime(), nullable=True)),
    ('weight', sa.Column('weight', sa.Float(), nullable=True)),
    ('is_required', sa.Column('is_required', sa.Boolean(), nullable=True)),
    ('criterion_key', sa.Column('criterion_key', sa.String(80), nullable=True)),
    ('evidence_requirements', sa.Column('evidence_requirements', sa.JSON(), nullable=True)),
    ('evidence_category', sa.Column('evidence_category', sa.String(30), nullable=True)),
    ('evaluator_hint', sa.Column('evaluator_hint', sa.String(120), nullable=True)),
    ('evaluator_instructions', sa.Column('evaluator_instructions', sa.Text(), nullable=True)),
)

# Columns added to an AAGE table after its initial creation.  Guarded so an
# older evaluation_runs table (created before cost instrumentation) is repaired
# by a fresh upgrade as well as by the runtime self-heal.
EVALUATION_RUN_EXTENSIONS = (
    ('cost', sa.Column('cost', sa.JSON(), nullable=True)),
)

# Base columns of the current Rubric model that predate AAGE. Legacy
# create_all() databases were built from an older model whose rubrics table
# used name / created_by / max_score / assignment_type, so every ORM query on
# Rubric selects columns that do not exist.  Guarded add + backfill below.
RUBRIC_BASE_COLUMNS = (
    ('name', sa.Column('name', sa.String(200), nullable=True)),
    ('is_active', sa.Column('is_active', sa.Boolean(), nullable=True)),
    ('title', sa.Column('title', sa.String(200), nullable=True)),
    ('instructor_id', sa.Column('instructor_id', sa.Integer(), nullable=True)),
    ('course_id', sa.Column('course_id', sa.Integer(), nullable=True)),
    ('is_template', sa.Column('is_template', sa.Boolean(), nullable=True)),
    ('total_points', sa.Column('total_points', sa.Float(), nullable=True)),
)


def _backfill_legacy_rubric():
    """Populate added base columns from the legacy Rubric column names."""
    if not _table_exists('rubrics'):
        return
    columns = _column_names('rubrics')
    for target, expression, required in (
        ('title', 'name', ('name',)),
        ('instructor_id', 'created_by', ('created_by',)),
        ('total_points', 'max_score', ('max_score',)),
        ('is_template', '0', ()),
        ('name', 'title', ('title',)),
        ('is_active', '1', ()),
    ):
        if target not in columns or any(src not in columns for src in required):
            continue
        where = f"{target} IS NULL"
        if required:
            where += " AND " + " AND ".join(f"{src} IS NOT NULL" for src in required)
        op.execute(f"UPDATE rubrics SET {target} = {expression} WHERE {where}")


def upgrade():
    # ── extended legacy rubric tables ────────────────────────────────────
    if _table_exists('rubrics'):
        _add_columns('rubrics', RUBRIC_BASE_COLUMNS)
        _add_columns('rubrics', RUBRIC_EXTENSIONS)
        _backfill_legacy_rubric()
    if _table_exists('rubric_criteria'):
        _add_columns('rubric_criteria', CRITERION_EXTENSIONS)

    # ── grading profiles ─────────────────────────────────────────────────
    _create_table(
        'grading_profiles',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('key', sa.String(120), nullable=False),
            _column('name', sa.String(200), nullable=False),
            _column('discipline', sa.String(60), nullable=False),
            _column('description', sa.Text()),
            _column('course_id', sa.Integer(), foreign_key_target='courses.id'),
            _column('criteria_template', sa.JSON(), nullable=False),
            _column('is_active', sa.Boolean(), nullable=False),
            _column('created_by', sa.Integer(), foreign_key_target='users.id'),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('updated_at', sa.DateTime()),
        ],
    )
    _create_index('ix_grading_profiles_key', 'grading_profiles', ['key'], unique=True)
    _create_index('ix_grading_profiles_discipline', 'grading_profiles', ['discipline'])
    _create_index('ix_grading_profiles_course_id', 'grading_profiles', ['course_id'])

    # ── rubric versions ──────────────────────────────────────────────────
    _create_table(
        'rubric_versions',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('rubric_id', sa.Integer(), nullable=False,
                    foreign_key_target='rubrics.id'),
            _column('version', sa.Integer(), nullable=False),
            _column('checksum', sa.String(64), nullable=False),
            _column('payload', sa.JSON(), nullable=False),
            _column('total_points', sa.Float()),
            _column('weight_total', sa.Float()),
            _column('change_note', sa.Text()),
            _column('created_by', sa.Integer(), foreign_key_target='users.id'),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
        [sa.UniqueConstraint('rubric_id', 'version', name='_rubric_version_uc')],
    )
    _create_index('ix_rubric_versions_rubric_id', 'rubric_versions', ['rubric_id'])
    _create_index('ix_rubric_versions_checksum', 'rubric_versions', ['checksum'])

    # ── grading jobs ─────────────────────────────────────────────────────
    _create_table(
        'grading_jobs',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('correlation_id', sa.String(36), nullable=False),
            _column('job_type', sa.String(40), nullable=False),
            _column('submission_type', sa.String(20), nullable=False),
            _column('submission_id', sa.Integer(), nullable=False),
            _column('assessment_id', sa.Integer(), nullable=False),
            _column('assessment_kind', sa.String(20), nullable=False),
            _column('course_id', sa.Integer(), foreign_key_target='courses.id'),
            _column('student_id', sa.Integer(), foreign_key_target='users.id'),
            _column('status', sa.String(20), nullable=False),
            _column('priority', sa.Integer(), nullable=False),
            _column('attempts', sa.Integer(), nullable=False),
            _column('max_attempts', sa.Integer(), nullable=False),
            _column('next_attempt_at', sa.DateTime()),
            _column('locked_by', sa.String(80)),
            _column('locked_at', sa.DateTime()),
            _column('timeout_seconds', sa.Integer(), nullable=False),
            _column('rubric_id', sa.Integer(), foreign_key_target='rubrics.id'),
            _column('rubric_version_id', sa.Integer(),
                    foreign_key_target='rubric_versions.id'),
            _column('evaluators', sa.JSON()),
            _column('requested_by', sa.Integer(), foreign_key_target='users.id'),
            _column('progress', sa.JSON()),
            _column('error', sa.Text()),
            _column('result_id', sa.Integer()),
            _column('cost', sa.JSON()),
            _column('queued_at', sa.DateTime(), nullable=False),
            _column('started_at', sa.DateTime()),
            _column('finished_at', sa.DateTime()),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('updated_at', sa.DateTime()),
        ],
    )
    # Older builds used a different name for the created_at index.
    if _table_exists('grading_jobs'):
        _drop_index_if_exists('ix_grading_jobs_created_at', 'grading_jobs')
    _create_index('ix_grading_jobs_correlation_id', 'grading_jobs', ['correlation_id'], unique=True)
    _create_index('ix_grading_jobs_job_type', 'grading_jobs', ['job_type'])
    _create_index('ix_grading_jobs_status', 'grading_jobs', ['status'])
    _create_index('ix_grading_jobs_status_next', 'grading_jobs', ['status', 'next_attempt_at'])
    _create_index('ix_grading_jobs_submission', 'grading_jobs', ['submission_type', 'submission_id'])
    _create_index('ix_grading_jobs_assessment_id', 'grading_jobs', ['assessment_id'])
    _create_index('ix_grading_jobs_course_id', 'grading_jobs', ['course_id'])
    _create_index('ix_grading_jobs_student_id', 'grading_jobs', ['student_id'])
    _create_index('ix_grading_jobs_created', 'grading_jobs', ['created_at'])

    # ── submission artifacts ─────────────────────────────────────────────
    _create_table(
        'submission_artifacts',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('job_id', sa.Integer(), nullable=False,
                    foreign_key_target='grading_jobs.id'),
            _column('submission_type', sa.String(20), nullable=False),
            _column('submission_id', sa.Integer(), nullable=False),
            _column('file_name', sa.String(400), nullable=False),
            _column('relative_path', sa.String(600), nullable=False),
            _column('storage', sa.String(40)),
            _column('external_id', sa.String(255)),
            _column('media_type', sa.String(120)),
            _column('size_bytes', sa.Integer()),
            _column('checksum_sha256', sa.String(64)),
            _column('category', sa.String(30)),
            _column('language', sa.String(60)),
            _column('is_entry_point', sa.Boolean()),
            _column('is_required_deliverable', sa.Boolean()),
            _column('truncated', sa.Boolean()),
            _column('extracted', sa.JSON()),
            _column('status', sa.String(20), nullable=False),
            _column('error', sa.Text()),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
        [sa.UniqueConstraint('job_id', 'relative_path', name='_artifact_job_path_uc')],
    )
    _create_index('ix_submission_artifacts_job_id', 'submission_artifacts', ['job_id'])
    _create_index('ix_submission_artifacts_checksum', 'submission_artifacts', ['checksum_sha256'])
    _create_index('ix_submission_artifacts_lookup', 'submission_artifacts',
                  ['submission_type', 'submission_id'])

    # ── evaluation runs ──────────────────────────────────────────────────
    _create_table(
        'evaluation_runs',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('job_id', sa.Integer(), nullable=False,
                    foreign_key_target='grading_jobs.id'),
            _column('correlation_id', sa.String(36)),
            _column('rubric_version_id', sa.Integer(),
                    foreign_key_target='rubric_versions.id'),
            _column('status', sa.String(20), nullable=False),
            _column('evaluators', sa.JSON()),
            _column('artifact_summary', sa.JSON()),
            _column('warnings', sa.JSON()),
            _column('conflicts', sa.JSON()),
            _column('provider', sa.String(40)),
            _column('model', sa.String(120)),
            _column('tokens_in', sa.Integer()),
            _column('tokens_out', sa.Integer()),
            _column('cost_estimate', sa.Float()),
            _column('cost', sa.JSON()),
            _column('started_at', sa.DateTime(), nullable=False),
            _column('finished_at', sa.DateTime()),
            _column('duration_ms', sa.Integer()),
        ],
    )
    # Repair a pre-existing table that predates the cost column.  The create
    # helper is guarded, so this is a no-op on a freshly created table.
    if _table_exists('evaluation_runs'):
        _add_columns('evaluation_runs', EVALUATION_RUN_EXTENSIONS)
    _create_index('ix_evaluation_runs_job_id', 'evaluation_runs', ['job_id'])
    _create_index('ix_evaluation_runs_correlation_id', 'evaluation_runs', ['correlation_id'])

    # ── evaluation results ───────────────────────────────────────────────
    _create_table(
        'evaluation_results',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('run_id', sa.Integer(), foreign_key_target='evaluation_runs.id'),
            _column('job_id', sa.Integer(), foreign_key_target='grading_jobs.id'),
            _column('correlation_id', sa.String(36)),
            _column('submission_type', sa.String(20), nullable=False),
            _column('submission_id', sa.Integer(), nullable=False),
            _column('assessment_kind', sa.String(20), nullable=False),
            _column('assessment_id', sa.Integer(), nullable=False),
            _column('course_id', sa.Integer(), foreign_key_target='courses.id'),
            _column('student_id', sa.Integer(), foreign_key_target='users.id'),
            _column('rubric_id', sa.Integer(), foreign_key_target='rubrics.id'),
            _column('rubric_version_id', sa.Integer(),
                    foreign_key_target='rubric_versions.id'),
            _column('rubric_snapshot', sa.JSON()),
            _column('total_awarded', sa.Float(), nullable=False),
            _column('total_possible', sa.Float(), nullable=False),
            _column('final_score', sa.Float(), nullable=False),
            _column('grade_letter', sa.String(5)),
            _column('points_awarded', sa.Float()),
            _column('confidence', sa.Float(), nullable=False),
            _column('confidence_factors', sa.JSON()),
            _column('requires_review', sa.Boolean(), nullable=False),
            _column('review_reason', sa.Text()),
            _column('status', sa.String(30), nullable=False),
            _column('feedback', sa.Text()),
            _column('strengths', sa.JSON()),
            _column('improvements', sa.JSON()),
            _column('ai_provider', sa.String(40)),
            _column('evaluator_versions', sa.JSON()),
            _column('limitations', sa.JSON()),
            _column('is_official', sa.Boolean(), nullable=False),
            _column('published_at', sa.DateTime()),
            _column('published_by', sa.Integer(), foreign_key_target='users.id'),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('updated_at', sa.DateTime()),
        ],
    )
    if _table_exists('evaluation_results'):
        _drop_index_if_exists('ix_evaluation_results_course', 'evaluation_results')
    _create_index('ix_evaluation_results_submission', 'evaluation_results',
                  ['submission_type', 'submission_id'])
    _create_index('ix_evaluation_results_status', 'evaluation_results', ['status'])
    _create_index('ix_evaluation_results_course_id', 'evaluation_results', ['course_id'])
    _create_index('ix_evaluation_results_job_id', 'evaluation_results', ['job_id'])
    _create_index('ix_evaluation_results_correlation_id', 'evaluation_results', ['correlation_id'])
    _create_index('ix_evaluation_results_assessment_id', 'evaluation_results', ['assessment_id'])
    _create_index('ix_evaluation_results_student_id', 'evaluation_results', ['student_id'])

    # ── criterion scores ─────────────────────────────────────────────────
    _create_table(
        'criterion_scores',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('result_id', sa.Integer(), nullable=False,
                    foreign_key_target='evaluation_results.id'),
            _column('criterion_id', sa.Integer(),
                    foreign_key_target='rubric_criteria.id'),
            _column('criterion_key', sa.String(80), nullable=False),
            _column('name', sa.String(200), nullable=False),
            _column('awarded', sa.Float(), nullable=False),
            _column('maximum', sa.Float(), nullable=False),
            _column('weight', sa.Float(), nullable=False),
            _column('weighted_score', sa.Float(), nullable=False),
            _column('rationale', sa.Text()),
            _column('evidence_category', sa.String(30), nullable=False),
            _column('verification_status', sa.String(20), nullable=False),
            _column('evaluator_name', sa.String(60)),
            _column('evaluator_version', sa.String(30)),
            _column('feedback', sa.Text()),
            _column('limitations', sa.Text()),
            _column('is_required', sa.Boolean()),
            _column('order_index', sa.Integer()),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('updated_at', sa.DateTime()),
        ],
        [sa.UniqueConstraint('result_id', 'criterion_key', name='_criterion_score_result_key_uc')],
    )
    _create_index('ix_criterion_scores_result_id', 'criterion_scores', ['result_id'])

    # ── evidence ─────────────────────────────────────────────────────────
    _create_table(
        'evaluation_evidence',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('result_id', sa.Integer(), nullable=False,
                    foreign_key_target='evaluation_results.id'),
            _column('criterion_score_id', sa.Integer(),
                    foreign_key_target='criterion_scores.id'),
            _column('criterion_key', sa.String(80)),
            _column('category', sa.String(30), nullable=False),
            _column('source', sa.String(40), nullable=False),
            _column('reference', sa.String(600)),
            _column('locator', sa.String(600)),
            _column('summary', sa.String(700), nullable=False),
            _column('detail', sa.JSON()),
            _column('confidence', sa.Float()),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
    )
    _create_index('ix_evaluation_evidence_result_id', 'evaluation_evidence', ['result_id'])
    _create_index('ix_evaluation_evidence_criterion_score_id', 'evaluation_evidence',
                  ['criterion_score_id'])

    # ── reviews ──────────────────────────────────────────────────────────
    _create_table(
        'grading_reviews',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('result_id', sa.Integer(), nullable=False,
                    foreign_key_target='evaluation_results.id'),
            _column('status', sa.String(30), nullable=False),
            _column('assigned_to', sa.Integer(), foreign_key_target='users.id'),
            _column('ai_score', sa.Float()),
            _column('final_score', sa.Float()),
            _column('decision_note', sa.Text()),
            _column('correction_reason', sa.Text()),
            _column('created_by', sa.Integer(), foreign_key_target='users.id'),
            _column('opened_at', sa.DateTime(), nullable=False),
            _column('resolved_at', sa.DateTime()),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('updated_at', sa.DateTime()),
        ],
        [sa.UniqueConstraint('result_id', name='_grading_review_result_uc')],
    )
    _create_index('ix_grading_reviews_result_id', 'grading_reviews', ['result_id'])
    _create_index('ix_grading_reviews_status', 'grading_reviews', ['status'])

    # ── learning examples ────────────────────────────────────────────────
    _create_table(
        'learning_examples',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('result_id', sa.Integer(),
                    foreign_key_target='evaluation_results.id'),
            _column('submission_type', sa.String(20)),
            _column('submission_id', sa.Integer()),
            _column('assessment_id', sa.Integer()),
            _column('course_id', sa.Integer(), foreign_key_target='courses.id'),
            _column('rubric_version_id', sa.Integer(),
                    foreign_key_target='rubric_versions.id'),
            _column('evaluator_name', sa.String(60)),
            _column('evaluator_version', sa.String(30)),
            _column('ai_provider', sa.String(40)),
            _column('original_scores', sa.JSON()),
            _column('instructor_scores', sa.JSON()),
            _column('score_delta', sa.Float()),
            _column('explanation', sa.Text()),
            _column('tags', sa.JSON()),
            _column('status', sa.String(20), nullable=False),
            _column('dataset_version', sa.String(40)),
            _column('approved_by', sa.Integer(), foreign_key_target='users.id'),
            _column('approved_at', sa.DateTime()),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
    )
    _create_index('ix_learning_examples_status', 'learning_examples', ['status'])
    _create_index('ix_learning_examples_result_id', 'learning_examples', ['result_id'])

    # ── evaluator versions ───────────────────────────────────────────────
    _create_table(
        'evaluator_versions',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('name', sa.String(60), nullable=False),
            _column('version', sa.String(30), nullable=False),
            _column('status', sa.String(20), nullable=False),
            _column('description', sa.Text()),
            _column('changelog', sa.Text()),
            _column('config', sa.JSON()),
            _column('prompt_hash', sa.String(64)),
            _column('source_path', sa.String(300)),
            _column('benchmark_mae', sa.Float()),
            _column('criterion_agreement', sa.Float()),
            _column('false_pass_rate', sa.Float()),
            _column('false_fail_rate', sa.Float()),
            _column('override_rate', sa.Float()),
            _column('sample_count', sa.Integer()),
            _column('benchmark_metrics', sa.JSON()),
            _column('created_by', sa.Integer(), foreign_key_target='users.id'),
            _column('created_at', sa.DateTime(), nullable=False),
            _column('activated_at', sa.DateTime()),
            _column('activated_by', sa.Integer(), foreign_key_target='users.id'),
            _column('retired_at', sa.DateTime()),
            _column('supersedes_id', sa.Integer(),
                    foreign_key_target='evaluator_versions.id'),
        ],
        [sa.UniqueConstraint('name', 'version', name='_evaluator_name_version_uc')],
    )
    _create_index('ix_evaluator_versions_name', 'evaluator_versions', ['name'])
    _create_index('ix_evaluator_versions_status', 'evaluator_versions', ['status'])

    # ── calibration ──────────────────────────────────────────────────────
    _create_table(
        'calibration_runs',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('name', sa.String(200), nullable=False),
            _column('status', sa.String(20), nullable=False),
            _column('dataset_version', sa.String(40)),
            _column('baseline_evaluator_version_id', sa.Integer(),
                    foreign_key_target='evaluator_versions.id'),
            _column('candidate_evaluator_version_id', sa.Integer(),
                    foreign_key_target='evaluator_versions.id'),
            _column('case_count', sa.Integer()),
            _column('metrics', sa.JSON()),
            _column('decision', sa.String(20)),
            _column('decision_note', sa.Text()),
            _column('started_at', sa.DateTime()),
            _column('finished_at', sa.DateTime()),
            _column('approved_by', sa.Integer(), foreign_key_target='users.id'),
            _column('approved_at', sa.DateTime()),
            _column('created_by', sa.Integer(), foreign_key_target='users.id'),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
    )
    _create_index('ix_calibration_runs_status', 'calibration_runs', ['status'])

    _create_table(
        'calibration_cases',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('run_id', sa.Integer(), nullable=False,
                    foreign_key_target='calibration_runs.id'),
            _column('submission_type', sa.String(20)),
            _column('submission_id', sa.Integer()),
            _column('course_id', sa.Integer()),
            _column('expected_scores', sa.JSON()),
            _column('baseline_scores', sa.JSON()),
            _column('candidate_scores', sa.JSON()),
            _column('baseline_error', sa.Float()),
            _column('candidate_error', sa.Float()),
            _column('verdict', sa.String(20)),
            _column('notes', sa.Text()),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
    )
    _create_index('ix_calibration_cases_run_id', 'calibration_cases', ['run_id'])

    # ── audit log ────────────────────────────────────────────────────────
    _create_table(
        'grading_audit_logs',
        [
            _column('id', sa.Integer(), primary_key=True),
            _column('actor_id', sa.Integer(), foreign_key_target='users.id'),
            _column('actor_role', sa.String(40)),
            _column('action', sa.String(80), nullable=False),
            _column('entity_type', sa.String(60), nullable=False),
            _column('entity_id', sa.Integer()),
            _column('before', sa.JSON()),
            _column('after', sa.JSON()),
            _column('reason', sa.Text()),
            _column('correlation_id', sa.String(36)),
            _column('ip_address', sa.String(60)),
            _column('created_at', sa.DateTime(), nullable=False),
        ],
    )
    _create_index('ix_grading_audit_entity', 'grading_audit_logs', ['entity_type', 'entity_id'])
    _create_index('ix_grading_audit_correlation', 'grading_audit_logs', ['correlation_id'])
    _create_index('ix_grading_audit_created', 'grading_audit_logs', ['created_at'])


def downgrade():
    for table in (
        'grading_audit_logs', 'calibration_cases', 'calibration_runs',
        'evaluator_versions', 'learning_examples', 'grading_reviews',
        'evaluation_evidence', 'criterion_scores', 'evaluation_results',
        'evaluation_runs', 'submission_artifacts', 'grading_jobs',
        'rubric_versions', 'grading_profiles',
    ):
        if _table_exists(table):
            op.drop_table(table)

    if _table_exists('rubric_criteria'):
        _drop_columns('rubric_criteria', [name for name, _ in CRITERION_EXTENSIONS])
    if _table_exists('rubrics'):
        _drop_columns('rubrics', [name for name, _ in RUBRIC_EXTENSIONS])
