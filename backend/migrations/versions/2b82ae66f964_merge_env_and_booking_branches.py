"""merge env and booking branches

Revision ID: 2b82ae66f964
Revises: c6a713393185, d3e4f5a6b7c8
Create Date: 2026-08-27 12:45:00.142573

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '2b82ae66f964'
down_revision = ('c6a713393185', 'd3e4f5a6b7c8')
branch_labels = None
depends_on = None


def upgrade():
    pass


def downgrade():
    pass
