#!/usr/bin/env python3
"""
Complete Forum Schema Migration Script - Local Development Version
This script ensures all forum-related tables and fields are properly created in the local SQLite database.
"""

import sys
import os
import tempfile
from sqlalchemy import text, inspect, create_engine
from sqlalchemy.exc import SQLAlchemyError

# Add the src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Force SQLite database usage for migration
os.environ['FLASK_ENV'] = 'development'
if 'DATABASE_URL' in os.environ:
    del os.environ['DATABASE_URL']  # Force use of SQLite

from models.user_models import db, User, Role
from models.student_models import StudentForum, ForumPost, ForumSubscription, ForumPostLike

# Import app after setting environment
from main import app

def check_table_exists(inspector, table_name):
    """Check if a table exists in the database"""
    return table_name in inspector.get_table_names()

def check_column_exists(inspector, table_name, column_name):
    """Check if a column exists in a table"""
    if not check_table_exists(inspector, table_name):
        return False
    
    columns = inspector.get_columns(table_name)
    column_names = [col['name'] for col in columns]
    return column_name in column_names

def add_column_if_not_exists(table_name, column_name, column_definition):
    """Add a column to a table if it doesn't exist"""
    try:
        inspector = inspect(db.engine)
        if check_table_exists(inspector, table_name) and not check_column_exists(inspector, table_name, column_name):
            sql = f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_definition}"
            print(f"Adding column {column_name} to {table_name}: {column_definition}")
            db.session.execute(text(sql))
            db.session.commit()
            print(f"✅ Added column {column_name} to {table_name}")
        else:
            print(f"⏭️  Column {column_name} already exists in {table_name}")
    except SQLAlchemyError as e:
        print(f"❌ Error adding column {column_name} to {table_name}: {str(e)}")
        db.session.rollback()

def create_table_if_not_exists():
    """Create forum tables if they don't exist"""
    try:
        inspector = inspect(db.engine)
        
        # Create all tables if they don't exist
        db.create_all()
        print("✅ All forum tables created/verified")
        
        # Check what tables were created
        table_names = inspector.get_table_names()
        forum_tables = ['student_forums', 'forum_posts', 'forum_subscriptions', 'forum_post_likes']
        
        for table in forum_tables:
            if table in table_names:
                print(f"✅ Table {table} exists")
            else:
                print(f"❌ Table {table} is missing")
                
    except SQLAlchemyError as e:
        print(f"❌ Error creating tables: {str(e)}")
        db.session.rollback()

def migrate_student_forums():
    """Migrate StudentForum table fields"""
    print("\n=== Migrating StudentForum table ===")
    
    # Core fields (should already exist)
    core_fields = [
        ('title', 'VARCHAR(200) NOT NULL'),
        ('description', 'TEXT'),
        ('category', 'VARCHAR(100)'),
        ('course_id', 'INTEGER'),
        ('created_by', 'INTEGER NOT NULL'),
        ('created_at', 'DATETIME NOT NULL'),
        ('updated_at', 'DATETIME NOT NULL'),
    ]
    
    # Enhanced fields
    enhanced_fields = [
        ('is_active', 'BOOLEAN DEFAULT 1'),
        ('is_pinned', 'BOOLEAN DEFAULT 0'),
        ('is_locked', 'BOOLEAN DEFAULT 0'),
        ('view_count', 'INTEGER DEFAULT 0'),
        ('allow_anonymous', 'BOOLEAN DEFAULT 0'),
        ('moderated', 'BOOLEAN DEFAULT 0'),
        ('post_count', 'INTEGER DEFAULT 0'),
        ('thread_count', 'INTEGER DEFAULT 0'),
        ('subscriber_count', 'INTEGER DEFAULT 0'),
    ]
    
    all_fields = core_fields + enhanced_fields
    
    for column_name, column_definition in all_fields:
        add_column_if_not_exists('student_forums', column_name, column_definition)

def migrate_forum_posts():
    """Migrate ForumPost table fields"""
    print("\n=== Migrating ForumPost table ===")
    
    # Core fields
    core_fields = [
        ('forum_id', 'INTEGER NOT NULL'),
        ('author_id', 'INTEGER NOT NULL'),
        ('title', 'VARCHAR(200) NOT NULL'),
        ('content', 'TEXT NOT NULL'),
        ('parent_post_id', 'INTEGER'),
        ('created_at', 'DATETIME NOT NULL'),
        ('updated_at', 'DATETIME NOT NULL'),
    ]
    
    # Enhanced fields
    enhanced_fields = [
        ('is_active', 'BOOLEAN DEFAULT 1'),
        ('is_pinned', 'BOOLEAN DEFAULT 0'),
        ('is_locked', 'BOOLEAN DEFAULT 0'),
        ('is_approved', 'BOOLEAN DEFAULT 1'),
        ('is_edited', 'BOOLEAN DEFAULT 0'),
        ('like_count', 'INTEGER DEFAULT 0'),
        ('dislike_count', 'INTEGER DEFAULT 0'),
        ('view_count', 'INTEGER DEFAULT 0'),
        ('is_flagged', 'BOOLEAN DEFAULT 0'),
        ('flag_reason', 'VARCHAR(500)'),
        ('moderated_by', 'INTEGER'),
        ('moderated_at', 'DATETIME'),
    ]
    
    all_fields = core_fields + enhanced_fields
    
    for column_name, column_definition in all_fields:
        add_column_if_not_exists('forum_posts', column_name, column_definition)

def migrate_forum_subscriptions():
    """Migrate ForumSubscription table fields"""
    print("\n=== Migrating ForumSubscription table ===")
    
    fields = [
        ('user_id', 'INTEGER NOT NULL'),
        ('forum_id', 'INTEGER NOT NULL'),
        ('subscribed_at', 'DATETIME NOT NULL'),
        ('is_active', 'BOOLEAN DEFAULT 1'),
        ('notification_preference', 'VARCHAR(20) DEFAULT "all"'),  # all, mentions, none
    ]
    
    for column_name, column_definition in fields:
        add_column_if_not_exists('forum_subscriptions', column_name, column_definition)

def migrate_forum_post_likes():
    """Migrate ForumPostLike table fields"""
    print("\n=== Migrating ForumPostLike table ===")
    
    fields = [
        ('user_id', 'INTEGER NOT NULL'),
        ('post_id', 'INTEGER NOT NULL'),
        ('is_like', 'BOOLEAN NOT NULL'),  # True for like, False for dislike
        ('created_at', 'DATETIME NOT NULL'),
    ]
    
    for column_name, column_definition in fields:
        add_column_if_not_exists('forum_post_likes', column_name, column_definition)

def create_indexes():
    """Create indexes for better performance"""
    print("\n=== Creating indexes ===")
    
    indexes = [
        # Forum indexes
        ('idx_forums_category', 'student_forums', 'category'),
        ('idx_forums_course_id', 'student_forums', 'course_id'),
        ('idx_forums_created_by', 'student_forums', 'created_by'),
        ('idx_forums_active', 'student_forums', 'is_active'),
        
        # Post indexes
        ('idx_posts_forum_id', 'forum_posts', 'forum_id'),
        ('idx_posts_author_id', 'forum_posts', 'author_id'),
        ('idx_posts_parent_id', 'forum_posts', 'parent_post_id'),
        ('idx_posts_active', 'forum_posts', 'is_active'),
        ('idx_posts_approved', 'forum_posts', 'is_approved'),
        ('idx_posts_flagged', 'forum_posts', 'is_flagged'),
        
        # Subscription indexes
        ('idx_subscriptions_user_id', 'forum_subscriptions', 'user_id'),
        ('idx_subscriptions_forum_id', 'forum_subscriptions', 'forum_id'),
        
        # Like indexes
        ('idx_likes_user_id', 'forum_post_likes', 'user_id'),
        ('idx_likes_post_id', 'forum_post_likes', 'post_id'),
    ]
    
    for index_name, table_name, column_name in indexes:
        try:
            sql = f"CREATE INDEX IF NOT EXISTS {index_name} ON {table_name} ({column_name})"
            db.session.execute(text(sql))
            db.session.commit()
            print(f"✅ Created index {index_name}")
        except SQLAlchemyError as e:
            print(f"⏭️  Index {index_name} might already exist: {str(e)}")
            db.session.rollback()

def verify_migration():
    """Verify that the migration was successful"""
    print("\n=== Verifying migration ===")
    
    inspector = inspect(db.engine)
    
    # Check tables
    required_tables = ['student_forums', 'forum_posts', 'forum_subscriptions', 'forum_post_likes']
    for table in required_tables:
        if check_table_exists(inspector, table):
            print(f"✅ Table {table} exists")
            # Get column count
            columns = inspector.get_columns(table)
            print(f"   - {len(columns)} columns")
            
            # List all columns for debugging
            column_names = [col['name'] for col in columns]
            print(f"   - Columns: {', '.join(column_names)}")
        else:
            print(f"❌ Table {table} is missing")
    
    # Check some critical columns
    critical_columns = [
        ('student_forums', 'is_active'),
        ('student_forums', 'view_count'),
        ('forum_posts', 'is_flagged'),
        ('forum_posts', 'moderated_by'),
        ('forum_subscriptions', 'notification_preference'),
        ('forum_post_likes', 'is_like'),
    ]
    
    for table, column in critical_columns:
        if check_column_exists(inspector, table, column):
            print(f"✅ Column {table}.{column} exists")
        else:
            print(f"❌ Column {table}.{column} is missing")

def main():
    """Main migration function"""
    print("🚀 Starting complete forum schema migration (Local SQLite)...")
    
    with app.app_context():
        print(f"Database: {app.config.get('SQLALCHEMY_DATABASE_URI', 'Not configured')}")
        
        try:
            # Step 1: Create tables
            create_table_if_not_exists()
            
            # Step 2: Migrate individual table fields
            migrate_student_forums()
            migrate_forum_posts()
            migrate_forum_subscriptions()
            migrate_forum_post_likes()
            
            # Step 3: Create indexes
            create_indexes()
            
            # Step 4: Verify migration
            verify_migration()
            
            print("\n🎉 Forum schema migration completed successfully!")
            print("✅ All forum tables and fields should now be properly configured")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {str(e)}")
            import traceback
            traceback.print_exc()
            return False
    
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)