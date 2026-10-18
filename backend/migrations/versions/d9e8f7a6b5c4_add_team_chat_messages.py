"""Add the team chat room for collaborative projects.

Revision ID: d9e8f7a6b5c4
Revises: a7c3e9f1b2d4
Create Date: 2026-10-18 12:00:00.000000

A "team" is a ProjectSubmission row (the primary submitter plus the ids held
in ``team_members``), so the room is keyed by that row rather than by a member
list: every member of the submission reads and writes the same room, and the
room is removed with the team (``ON DELETE CASCADE``).

Idempotent and safe to re-run, mirroring a7c3e9f1b2d4: environments
provisioned purely by ``create_all`` already have the table.
"""

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'd9e8f7a6b5c4'
down_revision = 'a7c3e9f1b2d4'
branch_labels = None
depends_on = None


def upgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if not inspector.has_table('team_chat_messages'):
        op.create_table(
            'team_chat_messages',
            sa.Column('id', sa.Integer(), primary_key=True),
            sa.Column(
                'submission_id',
                sa.Integer(),
                sa.ForeignKey('project_submissions.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column(
                'sender_id',
                sa.Integer(),
                sa.ForeignKey('users.id', ondelete='CASCADE'),
                nullable=False,
            ),
            sa.Column('body', sa.Text(), nullable=False),
            sa.Column(
                'created_at',
                sa.DateTime(),
                nullable=False,
                server_default=sa.text('CURRENT_TIMESTAMP'),
            ),
        )
        op.create_index(
            'ix_team_chat_messages_submission_id',
            'team_chat_messages',
            ['submission_id'],
        )
        op.create_index(
            'ix_team_chat_messages_sender_id',
            'team_chat_messages',
            ['sender_id'],
        )
        op.create_index(
            'ix_team_chat_messages_created_at',
            'team_chat_messages',
            ['created_at'],
        )


def downgrade():
    bind = op.get_bind()
    inspector = sa.inspect(bind)

    if inspector.has_table('team_chat_messages'):
        op.drop_index(
            'ix_team_chat_messages_created_at', table_name='team_chat_messages'
        )
        op.drop_index(
            'ix_team_chat_messages_sender_id', table_name='team_chat_messages'
        )
        op.drop_index(
            'ix_team_chat_messages_submission_id', table_name='team_chat_messages'
        )
        op.drop_table('team_chat_messages')
