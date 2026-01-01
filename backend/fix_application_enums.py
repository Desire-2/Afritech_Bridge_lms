#!/usr/bin/env python3
"""
Fix invalid enum values in course_applications table.
This script updates empty strings to NULL for enum fields.
"""
import sys
import os

# Add backend to path
sys.path.insert(0, os.path.dirname(__file__))

from main import app, db
from src.models.course_application import CourseApplication

def fix_enum_values():
    """Fix empty string enum values by setting them to None"""
    with app.app_context():
        # Direct SQL update to fix enum issues
        enum_fields = [
            'excel_skill_level',
            'gender',
            'age_range',
            'education_level',
            'current_status',
            'internet_access_type',
            'preferred_learning_mode',
            'primary_device',
            'digital_skill_level'
        ]
        
        fixed_count = 0
        
        for field in enum_fields:
            # Update empty strings to NULL
            result = db.session.execute(
                db.text(f"UPDATE course_applications SET {field} = NULL WHERE {field} = ''")
            )
            if result.rowcount > 0:
                print(f"✓ Fixed {result.rowcount} records with empty {field}")
                fixed_count += result.rowcount
        
        db.session.commit()
        print(f"\n✅ Total fixes applied: {fixed_count}")
        
        # Verify
        apps = CourseApplication.query.all()
        print(f"✓ Successfully loaded {len(apps)} applications")
        
        return fixed_count

if __name__ == "__main__":
    print("=" * 60)
    print("Fixing Invalid Enum Values in Course Applications")
    print("=" * 60)
    
    try:
        fixed_count = fix_enum_values()
        print(f"\n✅ Success! Fixed {fixed_count} invalid enum values")
    except Exception as e:
        print(f"\n❌ Error: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
