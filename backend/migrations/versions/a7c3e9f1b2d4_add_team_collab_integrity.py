"""Add team-collaboration integrity columns and the assignment audit trail.

Revision ID: a7c3e9f1b2d4
Revises: c3d4e5f6a7b8
Create Date: 2026-10-18 10:00:00.000000

Two changes:

1. ``project_submissions.created_at`` — a new always-set timestamp. Team rows
   scaffolded by the instructor previously inherited ``submitted_at`` from the
   model default, which made empty teams appear in the grading queue as if a
   member had submitted. ``submitted_at`` now stays NULL until a real
   submission, so ``created_at`` carries the ordering that ``submitted_at`` used
   to (``list_project_teams`` / ``team-history``).

2. ``team_assignment_events`` — an append-only audit table. A "team" is a
   ProjectSubmission row whose ``team_members`` column holds the other member
   ids as JSON text, so there is no membership history to query; without this
   table the Assignment History tab can only rebuild current state and can
   never show a move or a removal.

The project's FKs use ``ON DELETE CASCADE`` and the team/actor FKs use
``ON DELETE SET NULL``: removing the last member of a team deletes the
submission row, and the surviving event is the only remaining record of it.

Idempotent and safe to re-run, mirroring d4e5f6a7b8c9: environments
provisioned purely by ``create_all`` may already have the table/columns.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a7c3e9f1b2d4'
down_revision = 'c3d4e5f6a7b8'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    # ── 1. project_submissions.created_at ────────────────────────────────
    if inspector.has_table('project_submissions'):
        columns = {c['name'] for c in inspector.get_columns('project_submissions')}
        if 'created_at' not in columns:
            op.add_column(
                'project_submissions',
                sa.Column('created_at', sa.DateTime(), nullable=True),
            )
            # Backfill: prefer submitted_at; the remaining NULLs (team rows
            # created before this migration already carry submitted_at, so in
            # practice this is a no-op) are stamped from the id ordering so the
            # NOT NULL constraint below can be applied safely.
            op.execute(
                "UPDATE project_submissions "
                "SET created_at = submitted_at WHERE created_at IS NULL"
            )
            op.execute(
                "UPDATE project_submissions "
                "SET created_at = CURRENT_TIMESTAMP WHERE created_at IS NULL"
            )
            with op.batch_alter_table('project_submissions') as batch_op:
                batch_op.alter_column(
                    'created_at',
                    existing_type=sa.DateTime(),
                    nullable=False,
                )

    # ── 2. team_assignment_events ────────────────────────────────────────
    if not inspector.has_table('team_assignment_events'):
        op.create_table(
            'team_assignment_events',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column(
                'project_id',
                sa.Integer(),
                sa.ForeignKey('projects.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column(
                'team_submission_id',
                sa.Integer(),
                sa.ForeignKey('project_submissions.id', ondelete='SET NULL'),
                nullable=True,
            ),
            sa.Column(
                'cohort_id',
                sa.Integer(),
                sa.ForeignKey('application_windows.id', ondelete='SET NULL'),
                nullable=True,
            ),
            sa.Column(
                'actor_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='SET NULL'),
                nullable=True,
            ),
            sa.Column('event_type', sa.String(length=20), nullable=False),
            sa.Column('member_ids', sa.Text(), nullable=True),
            sa.Column(
                'affected_member_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='SET NULL'),
                nullable=True,
            ),
            sa.Column('team_size', sa.Integer(), nullable=True),
            sa.Column('details', sa.Text(), nullable=True),
            sa.Column(
                'created_at',
                sa.DateTime(),
                nullable=False,
                server_default=sa.text('CURRENT_TIMESTAMP'),
            ),
        )
        op.create_index(
            'ix_team_assignment_events_project_id',
            'team_assignment_events',
            ['project_id'],
        )
        op.create_index(
            'ix_team_assignment_events_team_submission_id',
            'team_assignment_events',
            ['team_submission_id'],
        )
        op.create_index(
            'ix_team_assignment_events_created_at',
            'team_assignment_events',
            ['created_at'],
        )

        # ── Backfill: one 'assign' event per pre-existing team ───────────
        # Written with Core (not the ORM) so it works before the app models
        # are imported, and dialect-agnostically for the JSON member list.
        events = sa.table(
            'team_assignment_events',
            sa.column('project_id', sa.Integer),
            sa.column('team_submission_id', sa.Integer),
            sa.column('event_type', sa.String),
            sa.column('member_ids', sa.Text),
            sa.column('team_size', sa.Integer),
            sa.column('details', sa.Text),
            sa.column('created_at', sa.DateTime),
        )
        submissions = sa.table(
            'project_submissions',
            sa.column('id', sa.Integer),
            sa.column('project_id', sa.Integer),
            sa.column('team_members', sa.Text),
            sa.column('submitted_at', sa.DateTime),
            sa.column('created_at', sa.DateTime),
        )
        rows = bind.execute(
            sa.select(
                submissions.c.id,
                submissions.c.project_id,
                submissions.c.team_members,
                submissions.c.created_at,
            ).where(submissions.c.team_members.isnot(None))
        ).fetchall()

        import json
        from datetime import datetime, timezone

        to_insert = []
        for sub_id, project_id, team_members, created_at in rows:
            try:
                member_ids = json.loads(team_members) if team_members else []
            except (ValueError, TypeError):
                member_ids = []
            if not isinstance(member_ids, list):
                member_ids = []
            # +1 for the primary submitter, who is not in team_members.
            team_size = len(member_ids) + 1
            to_insert.append({
                'project_id': project_id,
                'team_submission_id': sub_id,
                'event_type': 'assign',
                'member_ids': json.dumps(member_ids),
                'team_size': team_size,
                'details': 'Backfilled from existing team submission',
                'created_at': created_at or datetime.now(timezone.utc).replace(tzinfo=None),
            })

        if to_insert:
            bind.execute(events.insert(), to_insert)


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('team_assignment_events'):
        op.drop_index(
            'ix_team_assignment_events_created_at', table_name='team_assignment_events'
        )
        op.drop_index(
            'ix_team_assignment_events_team_submission_id',
            table_name='team_assignment_events',
        )
        op.drop_index(
            'ix_team_assignment_events_project_id', table_name='team_assignment_events'
        )
        op.drop_table('team_assignment_events')

    if inspector.has_table('project_submissions'):
        columns = {c['name'] for c in inspector.get_columns('project_submissions')}
        if 'created_at' in columns:
            op.drop_column('project_submissions', 'created_at')
