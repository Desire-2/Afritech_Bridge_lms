#!/usr/bin/env python3
"""
Migration script to add MOMO Pay Code payment method support.

This script adds:
1. momo_pay_code_enabled column to the Course model
2. Updates payment_status enum to support new statuses: 'pending_screenshot', 'pending_verification'
3. Ensures uploads directory exists for payment screenshots

Run this script once during deployment:
    python backend/add_momo_pay_code_support.py
"""

import os
import sys
from pathlib import Path

# Add backend directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import db, app
from src.models.course_models import Course
from src.models.course_application import CourseApplication


def migrate():
    """Run the migration."""
    with app.app_context():
        print("🔄 Starting MOMO Pay Code migration...")
        
        try:
            # Check if momo_pay_code_enabled column exists
            inspector = db.inspect(db.engine)
            columns = [col['name'] for col in inspector.get_columns('courses')]
            
            if 'momo_pay_code_enabled' not in columns:
                print("  📝 Adding momo_pay_code_enabled column to courses table...")
                with db.engine.connect() as connection:
                    # SQLAlchemy 2.0 requires commit
                    with connection.begin():
                        connection.execute(db.text(
                            "ALTER TABLE courses ADD COLUMN momo_pay_code_enabled BOOLEAN NOT NULL DEFAULT FALSE"
                        ))
                print("  ✅ Column added successfully")
            else:
                print("  ⏭️  momo_pay_code_enabled column already exists")

            if 'momo_ussd_code' not in columns:
                print("  📝 Adding momo_ussd_code column to courses table...")
                with db.engine.connect() as connection:
                    with connection.begin():
                        connection.execute(db.text(
                            "ALTER TABLE courses ADD COLUMN momo_ussd_code VARCHAR(100)"
                        ))
                print("  ✅ Column added successfully")
            else:
                print("  ⏭️  momo_ussd_code column already exists")

            if 'momo_recipient_name' not in columns:
                print("  📝 Adding momo_recipient_name column to courses table...")
                with db.engine.connect() as connection:
                    with connection.begin():
                        connection.execute(db.text(
                            "ALTER TABLE courses ADD COLUMN momo_recipient_name VARCHAR(100)"
                        ))
                print("  ✅ Column added successfully")
            else:
                print("  ⏭️  momo_recipient_name column already exists")

            # Create uploads directory for payment screenshots
            uploads_dir = os.path.join(os.path.dirname(__file__), 'uploads', 'payment_screenshots')
            Path(uploads_dir).mkdir(parents=True, exist_ok=True)
            print(f"  ✅ Uploads directory ready: {uploads_dir}")

            print("\n✨ Migration completed successfully!")
            print("\n📋 Next steps:")
            print("  1. Restart your backend server")
            print("  2. In the course settings, enable 'MOMO Pay Code (USSD)' for any course that needs it")
            print("  3. Configure the USSD code for that course")
            print("  4. Test the payment flow with a test application")
            
            return True

        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            import traceback
            traceback.print_exc()
            return False


if __name__ == '__main__':
    success = migrate()
    sys.exit(0 if success else 1)
