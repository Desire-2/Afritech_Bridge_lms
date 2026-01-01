#!/usr/bin/env python3
"""
Fix invalid internet_access_type enum values in database
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from sqlalchemy import text

def fix_invalid_enum_values():
    """Fix invalid internet_access_type values"""
    
    with app.app_context():
        print("="*70)
        print("  FIXING INVALID ENUM VALUES")
        print("="*70)
        
        # Update all invalid internet_access_type values
        updates = [
            ("home_wifi", "stable_broadband"),
            ("wifi", "stable_broadband"),
            ("home_internet", "stable_broadband"),
            ("broadband", "stable_broadband"),
            ("", "other"),  # Empty string
        ]
        
        total_fixed = 0
        
        for old_value, new_value in updates:
            try:
                result = db.session.execute(
                    text("""
                        UPDATE course_applications 
                        SET internet_access_type = :new_value 
                        WHERE internet_access_type = :old_value
                    """),
                    {"old_value": old_value, "new_value": new_value}
                )
                
                count = result.rowcount
                if count > 0:
                    print(f"✅ Fixed {count} records: '{old_value}' → '{new_value}'")
                    total_fixed += count
                    
            except Exception as e:
                print(f"❌ Error fixing '{old_value}': {str(e)}")
        
        db.session.commit()
        
        print(f"\n✅ Total records fixed: {total_fixed}")
        print("\n" + "="*70)
        
        # Verify no more invalid values
        print("  VERIFYING DATABASE")
        print("="*70)
        
        try:
            result = db.session.execute(
                text("""
                    SELECT DISTINCT internet_access_type 
                    FROM course_applications 
                    WHERE internet_access_type IS NOT NULL
                """)
            )
            
            values = [row[0] for row in result]
            print(f"\nCurrent values in database:")
            for v in values:
                print(f"  - {v}")
                
            valid_values = ["stable_broadband", "mobile_data", "limited_access", "public_wifi", "other"]
            invalid = [v for v in values if v not in valid_values and v]
            
            if invalid:
                print(f"\n⚠️  Still have invalid values: {invalid}")
                print("   Run this script again or fix manually")
            else:
                print(f"\n✅ All values are now valid!")
                
        except Exception as e:
            print(f"❌ Error verifying: {str(e)}")

if __name__ == "__main__":
    fix_invalid_enum_values()
