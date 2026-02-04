#!/usr/bin/env python3
"""
Migration: add missing enrollment/payment fields to courses table.
Safe to run multiple times.
"""
import sys
from sqlalchemy import text, inspect
from main import app, db


def migrate():
    with app.app_context():
        try:
            print("=" * 80)
            print("MIGRATION: ADD COURSE ENROLLMENT FIELDS")
            print("=" * 80)

            columns = [
                ("enrollment_type", "VARCHAR(20) DEFAULT 'free'"),
                ("price", "FLOAT"),
                ("currency", "VARCHAR(10) DEFAULT 'USD'"),
                ("start_date", "TIMESTAMP"),
                ("module_release_count", "INTEGER"),
                ("module_release_interval", "VARCHAR(50)"),
                ("module_release_interval_days", "INTEGER"),
            ]

            inspector = inspect(db.engine)
            try:
                existing_columns = {col["name"] for col in inspector.get_columns("courses")}
            except Exception as e:
                print(f"❌ Unable to inspect courses table: {str(e)}")
                return False

            added = 0
            for column_name, column_type in columns:
                if column_name in existing_columns:
                    continue

                print(f"➜ Adding {column_name}...")
                try:
                    db.session.execute(text(
                        f"ALTER TABLE courses ADD COLUMN {column_name} {column_type}"
                    ))
                    db.session.commit()
                    print(f"✅ Added {column_name}")
                    added += 1
                except Exception as e:
                    db.session.rollback()
                    print(f"⚠️  Failed to add {column_name}: {str(e)}")

            print("=" * 80)
            print(f"✅ MIGRATION COMPLETED (added {added} columns)")
            print("=" * 80)
            return True

        except Exception as e:
            db.session.rollback()
            print(f"❌ Migration failed: {str(e)}")
            return False


if __name__ == "__main__":
    success = migrate()
    sys.exit(0 if success else 1)
