#!/usr/bin/env python3
"""
SQLite Schema Analysis Script
Analyzes the current SQLite database schema for migration planning
"""

import sqlite3
import os
import json

def analyze_sqlite_schema():
    """Analyze SQLite database schema"""
    db_path = "instance/afritec_lms_db.db"
    if not os.path.exists(db_path):
        print("❌ SQLite database not found at:", db_path)
        return
    
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    
    print("🔍 SQLite Database Schema Analysis")
    print("=" * 60)
    
    # Get all tables
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;")
    tables = [row[0] for row in cursor.fetchall()]
    
    print(f"\n📊 Database Summary:")
    print(f"   Database: {db_path}")
    print(f"   Total tables: {len(tables)}")
    
    # Categorize tables
    categories = {
        'Users & Auth': ['roles', 'users'],
        'Courses': ['courses', 'modules', 'lessons', 'enrollments', 'course_applications', 'course_enrollment_applications'],
        'Assessments': ['quizzes', 'questions', 'answers', 'quiz_attempts', 'quiz_attempt', 'user_answers', 'user_answer'],
        'Assignments': ['assignments', 'assignment_submissions'],
        'Projects': ['projects', 'project_submissions'],
        'Progress': ['lesson_completions', 'module_completion', 'module_progress', 'user_progress', 'submissions'],
        'Gamification': ['achievements', 'user_achievements', 'learning_streaks', 'student_points', 'milestones', 'user_milestones', 'leaderboards', 'quest_challenges', 'user_quest_progress'],
        'Badges': ['badge', 'badges', 'skill_badges', 'user_badge', 'user_badges', 'student_skill_badges'],
        'Certificates': ['certificate', 'certificates', 'student_transcripts'],
        'Communication': ['announcements', 'student_notes', 'student_bookmarks'],
        'Forums': ['student_forums', 'forum_posts', 'forum_post_likes', 'forum_subscriptions', 'forum_notifications'],
        'Analytics': ['learning_analytics', 'assessment_attempts', 'student_suspensions'],
        'File Management': ['file_comments', 'file_analyses'],
        'Other': ['opportunities']
    }
    
    print(f"\n📋 Tables by Category:")
    for category, category_tables in categories.items():
        found_tables = [t for t in category_tables if t in tables]
        if found_tables:
            print(f"   {category}: {len(found_tables)} tables")
            for table in found_tables:
                print(f"      - {table}")
    
    # Find uncategorized tables
    categorized = set()
    for category_tables in categories.values():
        categorized.update(category_tables)
    
    uncategorized = [t for t in tables if t not in categorized]
    if uncategorized:
        print(f"   Uncategorized: {len(uncategorized)} tables")
        for table in uncategorized:
            print(f"      - {table}")
    
    # Detailed table analysis
    print(f"\n📝 Detailed Table Information:")
    table_details = {}
    
    for table in sorted(tables):
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        
        # Get foreign keys
        cursor.execute(f"PRAGMA foreign_key_list({table})")
        foreign_keys = cursor.fetchall()
        
        # Get indexes
        cursor.execute(f"PRAGMA index_list({table})")
        indexes = cursor.fetchall()
        
        table_details[table] = {
            'columns': len(columns),
            'foreign_keys': len(foreign_keys),
            'indexes': len(indexes)
        }
        
        print(f"\n   Table: {table}")
        print(f"      Columns: {len(columns)}")
        print(f"      Foreign Keys: {len(foreign_keys)}")
        print(f"      Indexes: {len(indexes)}")
        
        if len(columns) <= 10:  # Show columns for smaller tables
            print(f"      Column Details:")
            for col in columns:
                col_id, name, data_type, not_null, default, pk = col
                flags = []
                if pk: flags.append("PK")
                if not_null: flags.append("NOT NULL")
                if default is not None: flags.append(f"DEFAULT {default}")
                flags_str = f" ({', '.join(flags)})" if flags else ""
                print(f"         {name}: {data_type}{flags_str}")
        
        if foreign_keys:
            print(f"      Foreign Keys:")
            for fk in foreign_keys:
                print(f"         {fk[3]} -> {fk[2]}({fk[4]})")
    
    # Generate migration summary
    print(f"\n🎯 Migration Requirements:")
    print(f"   - Create {len(tables)} tables in PostgreSQL")
    print(f"   - Map SQLite data types to PostgreSQL equivalents")
    print(f"   - Preserve all foreign key relationships")
    print(f"   - Recreate all indexes for performance")
    print(f"   - Handle DATETIME -> TIMESTAMP WITH TIME ZONE conversion")
    print(f"   - Convert JSON columns to JSONB for better performance")
    
    # Data type analysis
    all_types = set()
    for table in tables:
        cursor.execute(f"PRAGMA table_info({table})")
        columns = cursor.fetchall()
        for col in columns:
            all_types.add(col[2])  # data_type
    
    print(f"\n🔧 Data Types Found:")
    for dtype in sorted(all_types):
        print(f"   - {dtype}")
    
    conn.close()

def main():
    """Main analysis function"""
    analyze_sqlite_schema()

if __name__ == "__main__":
    main()