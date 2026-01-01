#!/usr/bin/env python3
"""
Production Database Migration Script
Safely adds missing columns and tables to production database while preserving existing data.
"""

import os
import sys
from sqlalchemy import create_engine, inspect, text, MetaData
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

# Import all models
from src.models.user_models import User, Role
from src.models.course_models import (
    Course, Module, Lesson, Quiz, Question, Answer,
    Assignment, Project, Enrollment, Submission, Announcement
)
from src.models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, StudentPoints,
    Milestone, Leaderboard, QuestChallenge
)
from src.models.opportunity_models import Opportunity
from src.models.quiz_progress_models import QuizAttempt
from src.models.student_models import (
    LessonCompletion, UserProgress, Badge, UserBadge
)
from src.models.course_application import CourseApplication
from src.models.user_models import db

def get_production_engine():
    """Get production database engine"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment variables")
    
    # Transform postgres:// to postgresql+psycopg2://
    if database_url.startswith('postgres://'):
        database_url = database_url.replace('postgres://', 'postgresql+psycopg2://', 1)
    
    print(f"Connecting to production database...")
    engine = create_engine(database_url)
    return engine

def get_table_columns(engine, table_name):
    """Get existing columns for a table"""
    inspector = inspect(engine)
    if table_name in inspector.get_table_names():
        return {col['name'] for col in inspector.get_columns(table_name)}
    return set()

def add_missing_columns(engine):
    """Add missing columns to existing tables"""
    print("\n" + "="*80)
    print("ADDING MISSING COLUMNS TO EXISTING TABLES")
    print("="*80)
    
    # Define column additions with proper SQL types
    column_additions = {
        'users': [
            ("phone_number", "VARCHAR(20)"),
            ("must_change_password", "BOOLEAN DEFAULT FALSE"),
        ],
        'courses': [
            ("thumbnail_url", "TEXT"),
            ("difficulty_level", "VARCHAR(20)"),
            ("estimated_duration_hours", "INTEGER"),
            ("category", "VARCHAR(100)"),
            ("tags", "TEXT"),
            ("prerequisites", "TEXT"),
            ("learning_outcomes", "TEXT"),
            ("is_featured", "BOOLEAN DEFAULT FALSE"),
        ],
        'modules': [
            ("estimated_duration_minutes", "INTEGER"),
            ("prerequisites", "TEXT"),
        ],
        'lessons': [
            ("video_url", "TEXT"),
            ("estimated_duration_minutes", "INTEGER"),
            ("resources", "TEXT"),
        ],
        'quizzes': [
            ("passing_score", "INTEGER DEFAULT 70"),
            ("time_limit_minutes", "INTEGER"),
            ("max_attempts", "INTEGER"),
            ("shuffle_questions", "BOOLEAN DEFAULT FALSE"),
            ("show_correct_answers", "BOOLEAN DEFAULT TRUE"),
        ],
        'enrollments': [
            ("progress_percentage", "FLOAT DEFAULT 0.0"),
            ("last_accessed_at", "TIMESTAMP"),
            ("completed_at", "TIMESTAMP"),
            ("certificate_url", "TEXT"),
        ],
        'applications': [
            ("age_range", "VARCHAR(20)"),
            ("country", "VARCHAR(100)"),
            ("city", "VARCHAR(100)"),
            ("whatsapp_number", "VARCHAR(20)"),
            ("motivation", "TEXT"),
            ("learning_outcomes", "TEXT"),
            ("career_impact", "TEXT"),
            ("internet_access_type", "VARCHAR(50)"),
            ("device_type", "VARCHAR(50)"),
            ("preferred_learning_mode", "VARCHAR(50)"),
            ("weekly_hours", "INTEGER"),
            ("commitment_statement", "TEXT"),
            ("accept_terms", "BOOLEAN DEFAULT FALSE"),
            ("final_rank", "INTEGER"),
        ],
        'course_applications': [
            ("age_range", "VARCHAR(20)"),
            ("country", "VARCHAR(100)"),
            ("city", "VARCHAR(100)"),
            ("whatsapp_number", "VARCHAR(20)"),
            ("motivation", "TEXT"),
            ("learning_outcomes", "TEXT"),
            ("career_impact", "TEXT"),
            ("internet_access_type", "VARCHAR(50)"),
            ("device_type", "VARCHAR(50)"),
            ("preferred_learning_mode", "VARCHAR(50)"),
            ("weekly_hours", "INTEGER"),
            ("commitment_statement", "TEXT"),
            ("accept_terms", "BOOLEAN DEFAULT FALSE"),
            ("final_rank_score", "INTEGER"),
        ],
    }
    
    with engine.connect() as conn:
        for table_name, columns in column_additions.items():
            existing_cols = get_table_columns(engine, table_name)
            
            if not existing_cols:
                print(f"\n⚠️  Table '{table_name}' does not exist yet - will be created later")
                continue
            
            print(f"\n📊 Processing table: {table_name}")
            print(f"   Existing columns: {len(existing_cols)}")
            
            for col_name, col_type in columns:
                if col_name not in existing_cols:
                    try:
                        alter_sql = f"ALTER TABLE {table_name} ADD COLUMN {col_name} {col_type}"
                        print(f"   ➕ Adding column: {col_name} ({col_type})")
                        conn.execute(text(alter_sql))
                        conn.commit()
                        print(f"   ✅ Successfully added {col_name}")
                    except Exception as e:
                        print(f"   ⚠️  Could not add {col_name}: {e}")
                        conn.rollback()
                else:
                    print(f"   ⏭️  Column {col_name} already exists")

def create_missing_tables(engine):
    """Create any missing tables"""
    print("\n" + "="*80)
    print("CREATING MISSING TABLES")
    print("="*80)
    
    inspector = inspect(engine)
    existing_tables = set(inspector.get_table_names())
    
    # Get all model tables
    metadata = db.metadata
    model_tables = set(metadata.tables.keys())
    
    missing_tables = model_tables - existing_tables
    
    if missing_tables:
        print(f"\n📋 Found {len(missing_tables)} missing tables:")
        for table in missing_tables:
            print(f"   - {table}")
        
        print(f"\n🔨 Creating missing tables...")
        metadata.create_all(engine, tables=[metadata.tables[t] for t in missing_tables])
        print(f"✅ Successfully created {len(missing_tables)} tables")
    else:
        print("\n✅ All tables already exist")

def verify_schema(engine):
    """Verify the schema after migration"""
    print("\n" + "="*80)
    print("VERIFYING DATABASE SCHEMA")
    print("="*80)
    
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    
    print(f"\n📊 Total tables: {len(tables)}")
    for table in sorted(tables):
        columns = inspector.get_columns(table)
        print(f"\n   {table}:")
        print(f"      Columns: {len(columns)}")
        for col in columns[:5]:  # Show first 5 columns
            print(f"         - {col['name']} ({col['type']})")
        if len(columns) > 5:
            print(f"         ... and {len(columns) - 5} more columns")

def main():
    """Main migration function"""
    print("\n" + "="*80)
    print("🚀 PRODUCTION DATABASE MIGRATION")
    print("="*80)
    
    try:
        # Get production engine
        engine = get_production_engine()
        print("✅ Connected to production database")
        
        # Step 1: Add missing columns to existing tables
        add_missing_columns(engine)
        
        # Step 2: Create missing tables
        create_missing_tables(engine)
        
        # Step 3: Verify schema
        verify_schema(engine)
        
        print("\n" + "="*80)
        print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        print("="*80)
        print("\n⚠️  Please restart your production server to apply changes.")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == '__main__':
    main()
