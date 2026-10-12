"""Prevent duplicate direct (no-window) enrollments.

The existing unique constraint (student_id, course_id, application_window_id)
cannot dedupe direct enrollments: SQL treats NULLs as distinct, so the same
student could enroll in the same free course multiple times under race
conditions. This migration:

1. Reconciles existing duplicates, keeping the most meaningful enrollment
   (completed > live > newest) and re-pointing dependent rows
   (module_progress, certificates, student_suspensions) so no progress,
   submission-linked score, or certificate is lost.
2. Adds a partial unique index on (student_id, course_id) for rows where
   application_window_id IS NULL — compatible with PostgreSQL and SQLite.
   Cohort (window) enrollments keep the original three-column constraint.

Revision ID: b7e8f9a0c1d2
Revises: a9c3e1f7b2d4
"""
import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision = 'b7e8f9a0c1d2'
down_revision = 'a9c3e1f7b2d4'
branch_labels = None
depends_on = None


_STATUS_RANK = {'completed': 3, 'active': 2, 'suspended': 1, 'pending_payment': 1, 'terminated': 0}


def upgrade():
    conn = op.get_bind()

    # ── 1. Reconcile existing duplicate direct enrollments ─────────────
    dupes = conn.execute(sa.text("""
        SELECT student_id, course_id
        FROM enrollments
        WHERE application_window_id IS NULL
        GROUP BY student_id, course_id
        HAVING COUNT(*) > 1
    """)).fetchall()

    for student_id, course_id in dupes:
        rows = conn.execute(sa.text("""
            SELECT id, status, progress, completed_at
            FROM enrollments
            WHERE student_id = :sid AND course_id = :cid
              AND application_window_id IS NULL
            ORDER BY id
        """), {"sid": student_id, "cid": course_id}).fetchall()

        def sort_key(row):
            status = _STATUS_RANK.get(row[1] or 'active', 0)
            progress = row[2] or 0.0
            completed = 1 if row[3] else 0
            return (status, completed, progress, row[0])

        ordered = sorted(rows, key=sort_key, reverse=True)
        keeper_id = ordered[0][0]
        loser_ids = [r[0] for r in ordered[1:]]

        for loser_id in loser_ids:
            # module_progress: keep keeper's row on (student, module) clash
            conn.execute(sa.text("""
                UPDATE module_progress
                SET enrollment_id = :keeper
                WHERE enrollment_id = :loser
                  AND NOT EXISTS (
                    SELECT 1 FROM module_progress mp2
                    WHERE mp2.enrollment_id = :keeper
                      AND mp2.module_id = module_progress.module_id
                      AND mp2.student_id = module_progress.student_id
                  )
            """), {"keeper": keeper_id, "loser": loser_id})
            conn.execute(sa.text(
                "DELETE FROM module_progress WHERE enrollment_id = :loser"
            ), {"loser": loser_id})

            # certificates: move to keeper unless keeper already has one
            conn.execute(sa.text("""
                UPDATE certificates
                SET enrollment_id = :keeper
                WHERE enrollment_id = :loser
                  AND NOT EXISTS (
                    SELECT 1 FROM certificates c2
                    WHERE c2.student_id = certificates.student_id
                      AND c2.course_id = certificates.course_id
                      AND c2.id != certificates.id
                  )
            """), {"keeper": keeper_id, "loser": loser_id})
            conn.execute(sa.text(
                "DELETE FROM certificates WHERE enrollment_id = :loser"
            ), {"loser": loser_id})

            # student_suspensions: re-point then drop true duplicates
            conn.execute(sa.text("""
                UPDATE student_suspensions
                SET enrollment_id = :keeper
                WHERE enrollment_id = :loser
                  AND NOT EXISTS (
                    SELECT 1 FROM student_suspensions s2
                    WHERE s2.enrollment_id = :keeper
                      AND s2.student_id = student_suspensions.student_id
                      AND s2.course_id = student_suspensions.course_id
                  )
            """), {"keeper": keeper_id, "loser": loser_id})
            conn.execute(sa.text(
                "DELETE FROM student_suspensions WHERE enrollment_id = :loser"
            ), {"loser": loser_id})

            conn.execute(sa.text(
                "DELETE FROM enrollments WHERE id = :loser"
            ), {"loser": loser_id})

    # ── 2. Partial unique index for direct enrollments ────────────────
    op.create_index(
        'uq_enrollments_direct_student_course',
        'enrollments',
        ['student_id', 'course_id'],
        unique=True,
        postgresql_where=sa.text('application_window_id IS NULL'),
        sqlite_where=sa.text('application_window_id IS NULL'),
    )


def downgrade():
    op.drop_index('uq_enrollments_direct_student_course', table_name='enrollments')
