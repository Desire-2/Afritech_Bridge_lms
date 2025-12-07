#!/usr/bin/env python3
"""
Verify database schema matches SQLAlchemy models
"""
from main import app, db
from sqlalchemy import text, inspect

def verify_schema():
    """Check if all model columns exist in the database"""
    with app.app_context():
        inspector = inspect(db.engine)
        
        # Get all tables from models
        models_to_check = [
            ('courses', ['id', 'title', 'description', 'learning_objectives', 'target_audience', 
                        'estimated_duration', 'instructor_id', 'is_published', 'created_at', 'updated_at']),
            ('modules', ['id', 'title', 'description', 'learning_objectives', 'course_id', 
                        'order', 'is_published', 'created_at', 'updated_at']),
            ('quizzes', ['id', 'title', 'description', 'course_id', 'module_id', 'lesson_id', 
                        'is_published', 'created_at', 'time_limit', 'max_attempts', 'passing_score',
                        'due_date', 'points_possible', 'shuffle_questions', 'shuffle_answers', 'show_correct_answers'])
        ]
        
        print("=" * 80)
        print("DATABASE SCHEMA VERIFICATION")
        print("=" * 80)
        
        all_good = True
        for table_name, expected_columns in models_to_check:
            print(f"\n📋 Checking table: {table_name}")
            
            # Get actual columns from database
            actual_columns = [col['name'] for col in inspector.get_columns(table_name)]
            
            # Check for missing columns
            missing = set(expected_columns) - set(actual_columns)
            extra = set(actual_columns) - set(expected_columns)
            
            if missing:
                print(f"   ❌ Missing columns: {', '.join(missing)}")
                all_good = False
            else:
                print(f"   ✅ All expected columns present ({len(expected_columns)} columns)")
            
            if extra:
                print(f"   ℹ️  Extra columns in DB: {', '.join(extra)}")
        
        print("\n" + "=" * 80)
        if all_good:
            print("✅ SCHEMA VERIFICATION PASSED")
        else:
            print("⚠️  SCHEMA HAS ISSUES - See above")
        print("=" * 80)
        
        return all_good

if __name__ == "__main__":
    verify_schema()
