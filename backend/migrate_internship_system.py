#!/usr/bin/env python3
"""
Migration: Add Internship Application System Tables
Creates the complete schema for internship tracks, cohorts, and applications.

Run with: python backend/migrate_internship_system.py
"""

import os
import sys
from datetime import datetime

# Add backend to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.internship_models import (
    InternshipTrack,
    InternshipCohort,
    InternshipApplication,
    ApplicationStatusLog,
)


def migrate():
    """Create internship system tables"""
    with app.app_context():
        try:
            print("🔄 Starting Internship System migration...")
            print(f"⏰ Timestamp: {datetime.utcnow().isoformat()}")
            
            # Create all tables
            print("\n📋 Creating tables...")
            
            # Create InternshipTrack table
            print("  ✓ Creating 'internship_tracks' table...")
            db.create_all()
            
            # Verify tables exist
            from sqlalchemy import inspect
            inspector = inspect(db.engine)
            existing_tables = inspector.get_table_names()
            
            expected_tables = [
                'internship_tracks',
                'internship_cohorts',
                'internship_applications',
                'application_status_logs',
            ]
            
            created_tables = []
            for table in expected_tables:
                if table in existing_tables:
                    created_tables.append(table)
                    print(f"  ✓ Verified: {table}")
                else:
                    print(f"  ⚠ Missing: {table}")
            
            if len(created_tables) == len(expected_tables):
                print(f"\n✅ Migration successful!")
                print(f"   - {len(created_tables)} tables created")
                print(f"   - Ready for data seeding")
                return True
            else:
                missing = set(expected_tables) - set(created_tables)
                print(f"\n⚠️  Migration incomplete!")
                print(f"   Missing tables: {', '.join(missing)}")
                return False
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
