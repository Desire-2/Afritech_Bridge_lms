"""Merge payment_verification_hash heads for course_applications and enrollments

Revision ID: 5581c97b79fe
Revises: d0a3470a3262, f1d3c2b5a4e7
Create Date: 2026-06-21 12:36:17.931235

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '5581c97b79fe'
down_revision = ('d0a3470a3262', 'f1d3c2b5a4e7')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
