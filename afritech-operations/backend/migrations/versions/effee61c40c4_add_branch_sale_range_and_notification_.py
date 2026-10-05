"""add branch, sale-range and notification-unread indexes

Every index here exists only in the models before this revision, so the
tables they serve fell back to a full scan:

* ``shop_sales.created_at`` — every report/dashboard filters a date window
  (``routes/shop/reports.py::_sales_query``, ``shifts.py::_closing_figures``).
* ``shop_sales (branch_id, created_at)`` — the same window pinned to a branch,
  which is how a scoped user or a daily closing reads sales.
* ``notifications (recipient_id, is_read)`` — the unread bell count that runs
  on each page load (``routes/notifications.py``, ``routes/dashboard.py``).
* ``employees.branch_id`` — roster filtering and audience resolution
  (``routes/employees.py``, ``services/audience.py``).
* ``shop_returns.branch_id`` — per-branch return listings
  (``routes/shop/returns.py``, ``routes/shop/shifts.py``).

``if_not_exists`` / ``if_exists`` keep the revision idempotent: a database
that was (re)built with ``flask seed-dev`` already carries these indexes from
``db.create_all()`` while still sitting on the previous revision.

Revision ID: effee61c40c4
Revises: 413cd5253040
Create Date: 2026-10-04 09:27:10.292551

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = 'effee61c40c4'
down_revision = '413cd5253040'
branch_labels = None
depends_on = None

INDEXES = (
    ('ix_shop_sales_created_at', 'shop_sales', ['created_at']),
    ('ix_shop_sales_branch_created_at', 'shop_sales', ['branch_id', 'created_at']),
    ('ix_notifications_recipient_read', 'notifications', ['recipient_id', 'is_read']),
    ('ix_employees_branch_id', 'employees', ['branch_id']),
    ('ix_shop_returns_branch_id', 'shop_returns', ['branch_id']),
)


def upgrade():
    for name, table, columns in INDEXES:
        op.create_index(name, table, columns, if_not_exists=True)


def downgrade():
    for name, table, columns in reversed(INDEXES):
        op.drop_index(name, table_name=table, if_exists=True)
