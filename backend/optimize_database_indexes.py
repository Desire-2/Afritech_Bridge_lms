#!/usr/bin/env python3
"""
Database Index Optimization Script
Adds indexes to improve query performance for frequently accessed columns
"""

from main import app, db
from sqlalchemy import text, inspect

def check_index_exists(table_name, index_name):
    """Check if an index already exists"""
    inspector = inspect(db.engine)
    indexes = inspector.get_indexes(table_name)
    return any(idx['name'] == index_name for idx in indexes)

def add_indexes():
    """Add performance-optimizing indexes"""
    with app.app_context():
        print("🔍 Checking and adding database indexes for performance...")
        
        indexes_to_add = [
            # Enrollment indexes
            {
                'table': 'enrollments',
                'name': 'idx_enrollment_student_course',
                'columns': ['student_id', 'course_id'],
                'unique': False
            },
            {
                'table': 'enrollments',
                'name': 'idx_enrollment_student',
                'columns': ['student_id'],
                'unique': False
            },
            
            # ModuleProgress indexes
            {
                'table': 'module_progress',
                'name': 'idx_module_progress_student_module',
                'columns': ['student_id', 'module_id', 'enrollment_id'],
                'unique': False
            },
            {
                'table': 'module_progress',
                'name': 'idx_module_progress_status',
                'columns': ['student_id', 'status'],
                'unique': False
            },
            
            # LessonCompletion indexes
            {
                'table': 'lesson_completions',
                'name': 'idx_lesson_completion_student_lesson',
                'columns': ['student_id', 'lesson_id'],
                'unique': False
            },
            
            # QuizAttempt indexes
            {
                'table': 'quiz_attempts',
                'name': 'idx_quiz_attempt_user_quiz',
                'columns': ['user_id', 'quiz_id'],
                'unique': False
            },
            
            # Module indexes
            {
                'table': 'modules',
                'name': 'idx_module_course_order',
                'columns': ['course_id', 'order'],
                'unique': False
            },
            
            # Lesson indexes
            {
                'table': 'lessons',
                'name': 'idx_lesson_module_order',
                'columns': ['module_id', 'order'],
                'unique': False
            },
        ]
        
        added_count = 0
        skipped_count = 0
        
        for idx_config in indexes_to_add:
            table = idx_config['table']
            name = idx_config['name']
            columns = idx_config['columns']
            unique = idx_config.get('unique', False)
            
            # Check if index already exists
            if check_index_exists(table, name):
                print(f"⏭️  Index '{name}' already exists on {table}")
                skipped_count += 1
                continue
            
            try:
                # Create index
                unique_str = 'UNIQUE' if unique else ''
                # Quote column names to handle reserved keywords like 'order'
                columns_str = ', '.join([f'"{col}"' for col in columns])
                sql = f"CREATE {unique_str} INDEX {name} ON {table} ({columns_str})"
                
                db.session.execute(text(sql))
                db.session.commit()
                print(f"✅ Added index '{name}' on {table}({columns_str})")
                added_count += 1
                
            except Exception as e:
                print(f"❌ Error creating index '{name}': {str(e)}")
                db.session.rollback()
        
        print(f"\n📊 Summary: {added_count} indexes added, {skipped_count} already existed")
        print("✅ Database optimization complete!")

if __name__ == "__main__":
    add_indexes()
