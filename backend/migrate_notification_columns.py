"""
Migration script: Add new columns to the notifications table
for the expanded notification system (categories, priorities, entity refs, etc.)

Safe to run multiple times – each ALTER TABLE is wrapped in a try/except
so columns that already exist are silently skipped.
"""

import sqlite3
import os
import sys

DB_PATH = os.path.join(os.path.dirname(__file__), 'instance', 'afritec_lms_db.db')


def get_existing_columns(cursor, table):
    cursor.execute(f"PRAGMA table_info({table})")
    return {row[1] for row in cursor.fetchall()}


def add_column(cursor, table, col_name, col_type, default=None):
    """Add a column if it doesn't already exist."""
    existing = get_existing_columns(cursor, table)
    if col_name in existing:
        print(f"  [skip] {table}.{col_name} already exists")
        return False

    sql = f"ALTER TABLE {table} ADD COLUMN {col_name} {col_type}"
    if default is not None:
        sql += f" DEFAULT {default}"
    cursor.execute(sql)
    print(f"  [added] {table}.{col_name} ({col_type})")
    return True


def migrate():
    if not os.path.exists(DB_PATH):
        print(f"Database not found at {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()

    print("=== Migrating notifications table ===")

    # New columns for the expanded notification model
    new_cols = [
        ('category',        'VARCHAR(30)',  None),
        ('priority',        'VARCHAR(10)',  "'normal'"),
        ('assignment_id',   'INTEGER',      None),
        ('project_id',      'INTEGER',      None),
        ('quiz_id',         'INTEGER',      None),
        ('submission_id',   'INTEGER',      None),
        ('forum_id',        'INTEGER',      None),
        ('post_id',         'INTEGER',      None),
        ('announcement_id', 'INTEGER',      None),
        ('achievement_id',  'INTEGER',      None),
        ('actor_id',        'INTEGER',      None),
        ('action_url',      'VARCHAR(500)', None),
        ('expires_at',      'DATETIME',     None),
    ]

    added = 0
    for col_name, col_type, default in new_cols:
        if add_column(cursor, 'notifications', col_name, col_type, default):
            added += 1

    conn.commit()
    print(f"\nDone – {added} column(s) added to notifications table.")

    # Verify
    print("\n=== Current notifications columns ===")
    for row in cursor.execute("PRAGMA table_info(notifications)").fetchall():
        print(f"  {row[1]:30s} {row[2]}")

    conn.close()


if __name__ == '__main__':
    migrate()
