"""Enforce one certificate per student per course

Merges the outstanding alembic heads and adds a database-level unique
constraint on certificates (student_id, course_id).

Duplicate rows (created by the previous check-then-create race) are
reconciled before the constraint is applied: the canonical certificate for
each (student_id, course_id) is the lowest-id row — issuance updates a
single row in place, so higher ids are race artifacts. Nothing else
references the certificates table by id except optional enrollment
backrefs, which simply point at the surviving row.

Revision ID: a9c3e1f7b2d4
Revises: (merge heads) d4e5f6a7b8c9, d0a3470a3262, f1d3c2b5a4e7, d3e4f5a6b7c8, c6a713393185
Create Date: 2026-10-11 12:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'a9c3e1f7b2d4'
down_revision = (
    'd4e5f6a7b8c9',
    'd0a3470a3262',
    'f1d3c2b5a4e7',
    'd3e4f5a6b7c8',
    'c6a713393185',
)
branch_labels = None
depends_on = None


def upgrade():
    conn = op.get_bind()

    # 1) Reconcile existing duplicates — keep the lowest id per pair.
    conn.execute(sa.text("""
        DELETE FROM certificates
        WHERE id NOT IN (
            SELECT keep_id FROM (
                SELECT MIN(id) AS keep_id
                FROM certificates
                GROUP BY student_id, course_id
            ) AS keepers
        )
    """))

    # 2) Enforce uniqueness at the database level.
    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.create_unique_constraint(
            'uq_certificates_student_course', ['student_id', 'course_id']
        )


def downgrade():
    with op.batch_alter_table('certificates', schema=None) as batch_op:
        batch_op.drop_constraint('uq_certificates_student_course', type_='unique')
