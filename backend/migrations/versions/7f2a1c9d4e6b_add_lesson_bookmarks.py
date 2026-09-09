"""Add lesson-specific student bookmarks.

Revision ID: 7f2a1c9d4e6b
Revises: 2b82ae66f964
"""

from alembic import op
import sqlalchemy as sa


revision = '7f2a1c9d4e6b'
down_revision = '2b82ae66f964'
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'student_lesson_bookmarks',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('student_id', sa.Integer(), nullable=False),
        sa.Column('lesson_id', sa.Integer(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.ForeignKeyConstraint(['lesson_id'], ['lessons.id']),
        sa.ForeignKeyConstraint(['student_id'], ['users.id']),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('student_id', 'lesson_id', name='_student_lesson_bookmark_uc'),
    )


def downgrade():
    op.drop_table('student_lesson_bookmarks')
