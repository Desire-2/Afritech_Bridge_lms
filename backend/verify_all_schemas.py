#!/usr/bin/env python3
"""
Comprehensive database schema verification script.
Checks all models against PostgreSQL database schema and reports missing columns.
"""
import os
import sys
from sqlalchemy import text, inspect

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from src.models.user_models import db

# Define expected schemas for all tables based on models
EXPECTED_SCHEMAS = {
    'users': ['id', 'username', 'email', 'password_hash', 'first_name', 'last_name', 
              'profile_picture_url', 'bio', 'role_id', 'created_at', 'updated_at', 
              'reset_token', 'reset_token_expires_at'],
    
    'roles': ['id', 'name', 'description', 'created_at'],
    
    'courses': ['id', 'title', 'description', 'learning_objectives', 'target_audience', 
                'estimated_duration', 'instructor_id', 'created_at', 'updated_at', 'is_published'],
    
    'modules': ['id', 'title', 'description', 'learning_objectives', 'course_id', 'order', 
                'is_published', 'created_at', 'updated_at'],
    
    'lessons': ['id', 'title', 'content_type', 'content_data', 'description', 'learning_objectives', 
                'module_id', 'order', 'duration_minutes', 'is_published', 'created_at', 'updated_at'],
    
    'enrollments': ['id', 'student_id', 'course_id', 'enrollment_date', 'progress', 'completed_at'],
    
    'quizzes': ['id', 'title', 'description', 'course_id', 'module_id', 'lesson_id', 'is_published', 
                'created_at', 'time_limit', 'max_attempts', 'passing_score', 'due_date', 
                'points_possible', 'shuffle_questions', 'shuffle_answers', 'show_correct_answers'],
    
    'questions': ['id', 'quiz_id', 'text', 'question_type', 'order', 'points', 'explanation'],
    
    'answers': ['id', 'question_id', 'text', 'is_correct'],
    
    'submissions': ['id', 'student_id', 'quiz_id', 'lesson_id', 'submission_content', 
                    'submitted_at', 'grade', 'feedback'],
    
    'assignments': ['id', 'title', 'description', 'instructions', 'course_id', 'module_id', 
                    'lesson_id', 'instructor_id', 'assignment_type', 'max_file_size_mb', 
                    'allowed_file_types', 'due_date', 'points_possible', 'is_published', 
                    'created_at', 'updated_at'],
    
    'assignment_submissions': ['id', 'assignment_id', 'student_id', 'content', 'file_url', 
                               'external_url', 'submitted_at', 'grade', 'feedback', 'graded_at', 'graded_by'],
    
    'projects': ['id', 'title', 'description', 'objectives', 'course_id', 'module_ids', 'due_date', 
                 'points_possible', 'is_published', 'submission_format', 'max_file_size_mb', 
                 'allowed_file_types', 'collaboration_allowed', 'max_team_size', 'created_at', 'updated_at'],
    
    'project_submissions': ['id', 'project_id', 'student_id', 'team_members', 'text_content', 
                            'file_path', 'file_name', 'submitted_at', 'grade', 'feedback', 
                            'graded_at', 'graded_by'],
    
    'announcements': ['id', 'course_id', 'instructor_id', 'title', 'content', 'created_at', 'updated_at'],
    
    'lesson_completions': ['id', 'student_id', 'lesson_id', 'completed_at', 'time_spent', 'completed', 
                           'reading_progress', 'engagement_score', 'scroll_progress', 'updated_at', 'last_accessed'],
    
    'user_progress': ['id', 'student_id', 'course_id', 'current_module_id', 'current_lesson_id', 
                      'overall_progress', 'last_accessed', 'created_at', 'updated_at'],
    
    'badges': ['id', 'name', 'description', 'icon_url', 'requirements', 'created_at'],
    
    'user_badges': ['id', 'user_id', 'badge_id', 'earned_at'],
    
    'bookmarks': ['id', 'student_id', 'lesson_id', 'notes', 'created_at'],
    
    'student_notes': ['id', 'student_id', 'lesson_id', 'content', 'created_at', 'updated_at'],
    
    'module_progress': ['id', 'student_id', 'module_id', 'enrollment_id', 'completed_lessons', 
                        'total_lessons', 'completion_percentage', 'started_at', 'completed_at', 
                        'last_accessed', 'updated_at'],
    
    'quiz_attempts': ['id', 'user_id', 'quiz_id', 'started_at', 'completed_at', 'score', 
                      'score_percentage', 'answers', 'time_taken', 'is_submitted', 'attempt_number'],
    
    'achievements': ['id', 'title', 'description', 'icon_url', 'category', 'criteria_type', 
                     'criteria_value', 'tier', 'points_reward', 'created_at'],
    
    'user_achievements': ['id', 'user_id', 'achievement_id', 'earned_at', 'progress'],
    
    'learning_streaks': ['id', 'user_id', 'current_streak', 'longest_streak', 'last_activity_date', 
                         'streak_start_date', 'updated_at'],
    
    'student_points': ['id', 'user_id', 'total_points', 'level', 'updated_at'],
    
    'milestones': ['id', 'title', 'description', 'criteria_type', 'criteria_value', 'reward_points', 
                   'icon_url', 'created_at'],
    
    'user_milestones': ['id', 'user_id', 'milestone_id', 'achieved_at', 'progress'],
    
    'leaderboards': ['id', 'user_id', 'score', 'rank', 'period', 'updated_at'],
    
    'quest_challenges': ['id', 'title', 'description', 'quest_type', 'target_value', 'reward_points', 
                         'time_limit_days', 'is_active', 'created_at', 'expires_at'],
    
    'user_quest_progress': ['id', 'user_id', 'quest_id', 'current_progress', 'started_at', 
                            'completed_at', 'is_completed'],
    
    'opportunities': ['id', 'title', 'description', 'company', 'location', 'opportunity_type', 
                      'requirements', 'application_link', 'deadline', 'is_active', 'created_at', 
                      'updated_at', 'posted_by'],
    
    'forum_categories': ['id', 'name', 'description', 'order', 'created_at'],
    
    'forum_posts': ['id', 'category_id', 'user_id', 'title', 'content', 'is_pinned', 'is_locked', 
                    'view_count', 'created_at', 'updated_at'],
    
    'forum_replies': ['id', 'post_id', 'user_id', 'content', 'created_at', 'updated_at'],
    
    'forum_votes': ['id', 'user_id', 'post_id', 'reply_id', 'vote_type', 'created_at'],
}

def check_table_schema(table_name, expected_columns):
    """Check if all expected columns exist in the table"""
    with app.app_context():
        try:
            result = db.session.execute(text(f"""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name='{table_name}'
                ORDER BY ordinal_position
            """))
            
            existing_columns = [row[0] for row in result]
            
            if not existing_columns:
                return None, []  # Table doesn't exist
            
            missing_columns = [col for col in expected_columns if col not in existing_columns]
            extra_columns = [col for col in existing_columns if col not in expected_columns]
            
            return missing_columns, extra_columns
            
        except Exception as e:
            return None, []

def generate_migration_sql(table_name, missing_columns):
    """Generate SQL to add missing columns"""
    sql_statements = []
    
    # Column type mapping (common types)
    type_mapping = {
        'id': 'INTEGER',
        'title': 'VARCHAR(255)',
        'name': 'VARCHAR(255)',
        'description': 'TEXT',
        'content': 'TEXT',
        'username': 'VARCHAR(100)',
        'email': 'VARCHAR(255)',
        'password_hash': 'VARCHAR(255)',
        'first_name': 'VARCHAR(100)',
        'last_name': 'VARCHAR(100)',
        'bio': 'TEXT',
        'url': 'VARCHAR(255)',
        'icon_url': 'VARCHAR(255)',
        'profile_picture_url': 'VARCHAR(255)',
        'file_url': 'VARCHAR(255)',
        'file_path': 'VARCHAR(500)',
        'file_name': 'VARCHAR(255)',
        'external_url': 'VARCHAR(255)',
        'application_link': 'VARCHAR(255)',
        'is_': 'BOOLEAN DEFAULT FALSE',
        'created_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'updated_at': 'TIMESTAMP DEFAULT CURRENT_TIMESTAMP',
        'completed_at': 'TIMESTAMP',
        'submitted_at': 'TIMESTAMP',
        'earned_at': 'TIMESTAMP',
        'graded_at': 'TIMESTAMP',
        'started_at': 'TIMESTAMP',
        'last_': 'TIMESTAMP',
        'expires_at': 'TIMESTAMP',
        'deadline': 'TIMESTAMP',
        'due_date': 'TIMESTAMP',
        'progress': 'FLOAT DEFAULT 0.0',
        'score': 'FLOAT',
        'grade': 'FLOAT',
        'points': 'FLOAT DEFAULT 10.0',
        'order': 'INTEGER DEFAULT 0',
        'count': 'INTEGER DEFAULT 0',
        'type': 'VARCHAR(50)',
        'level': 'INTEGER DEFAULT 1',
        'rank': 'INTEGER',
        'period': 'VARCHAR(50)',
        'location': 'VARCHAR(255)',
        'company': 'VARCHAR(255)',
        'requirements': 'TEXT',
        'objectives': 'TEXT',
        'instructions': 'TEXT',
        'feedback': 'TEXT',
        'answers': 'TEXT',
        'module_ids': 'TEXT',
        'team_members': 'TEXT',
        'allowed_file_types': 'VARCHAR(255)',
        'time_': 'INTEGER',
        'max_': 'INTEGER',
        'current_': 'INTEGER',
        'total_': 'INTEGER',
        'passing_score': 'INTEGER DEFAULT 70',
        'attempt_number': 'INTEGER DEFAULT 1',
        'target_value': 'INTEGER',
        'reward_points': 'INTEGER DEFAULT 0',
        'points_reward': 'INTEGER DEFAULT 0',
        'points_possible': 'FLOAT DEFAULT 100.0',
        'shuffle_': 'BOOLEAN DEFAULT FALSE',
        'show_': 'BOOLEAN DEFAULT TRUE',
    }
    
    for col in missing_columns:
        col_type = 'TEXT'  # Default
        nullable = 'NULL'
        
        # Determine type based on column name patterns
        for pattern, mapped_type in type_mapping.items():
            if pattern in col:
                col_type = mapped_type
                break
        
        # Foreign keys
        if col.endswith('_id') and col != 'id':
            col_type = 'INTEGER'
            nullable = 'NULL'  # Most FKs are nullable except explicitly NOT NULL
        
        # IDs are primary keys
        if col == 'id':
            continue  # Skip primary key
        
        sql = f"ALTER TABLE {table_name} ADD COLUMN {col} {col_type}"
        if 'DEFAULT' not in col_type:
            sql += f" {nullable}"
        sql += ";"
        
        sql_statements.append(sql)
    
    return sql_statements

def main():
    print("=" * 100)
    print("DATABASE SCHEMA VERIFICATION")
    print("=" * 100)
    print()
    
    all_missing = {}
    all_extra = {}
    tables_not_found = []
    
    with app.app_context():
        for table_name, expected_cols in EXPECTED_SCHEMAS.items():
            missing, extra = check_table_schema(table_name, expected_cols)
            
            if missing is None:
                tables_not_found.append(table_name)
                print(f"❌ Table '{table_name}' does not exist in database")
                continue
            
            if missing or extra:
                print(f"\n📋 Table: {table_name}")
                
                if missing:
                    all_missing[table_name] = missing
                    print(f"   ⚠️  Missing columns: {', '.join(missing)}")
                
                if extra:
                    all_extra[table_name] = extra
                    print(f"   ℹ️  Extra columns (not in model): {', '.join(extra)}")
            else:
                print(f"✅ Table '{table_name}' - All columns match")
    
    print()
    print("=" * 100)
    print("SUMMARY")
    print("=" * 100)
    
    if tables_not_found:
        print(f"\n❌ Tables not found: {len(tables_not_found)}")
        for table in tables_not_found:
            print(f"   - {table}")
    
    if all_missing:
        print(f"\n⚠️  Tables with missing columns: {len(all_missing)}")
        total_missing = sum(len(cols) for cols in all_missing.values())
        print(f"   Total missing columns: {total_missing}")
        
        print("\n" + "=" * 100)
        print("MIGRATION SQL (Add Missing Columns)")
        print("=" * 100)
        
        for table, cols in all_missing.items():
            print(f"\n-- Table: {table}")
            for sql in generate_migration_sql(table, cols):
                print(sql)
    
    if all_extra:
        print(f"\nℹ️  Tables with extra columns: {len(all_extra)}")
        print("   (These columns exist in DB but not in models - may be deprecated)")
    
    if not tables_not_found and not all_missing:
        print("\n✅ All schemas are in sync! No missing columns found.")
    
    print("\n" + "=" * 100)

if __name__ == "__main__":
    main()
