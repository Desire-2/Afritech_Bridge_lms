"""Add payment_verification_hash to course_applications

Revision ID: f1d3c2b5a4e7
Revises: e2d44041ddf2
Create Date: 2026-06-19 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'f1d3c2b5a4e7'
down_revision = 'e2d44041ddf2'
branch_labels = None
depends_on = None


def upgrade():
    with op.batch_alter_table('course_applications', schema=None) as batch_op:
        batch_op.add_column(sa.Column('payment_verification_hash', sa.String(length=64), nullable=True))
        batch_op.create_index(batch_op.f('ix_course_applications_payment_verification_hash'), ['payment_verification_hash'], unique=False)


def downgrade():
    with op.batch_alter_table('course_applications', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_course_applications_payment_verification_hash'))
        batch_op.drop_column('payment_verification_hash')
