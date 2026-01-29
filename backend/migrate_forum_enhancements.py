#!/usr/bin/env python3
"""
Migration script to add enhanced forum features to existing database
Adds missing columns to student_forums and forum_posts tables
"""

import sys
import os
from datetime import datetime
from flask import Flask

# Add the backend src directory to the path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'src'))

# Import Flask app setup
from src.models import db
from src.models.student_models import StudentForum, ForumPost

def create_app():
    """Create Flask app for migration"""
    app = Flask(__name__)
    
    # Configure database
    basedir = os.path.abspath(os.path.dirname(__file__))
    app.config['SQLALCHEMY_DATABASE_URI'] = f"sqlite:///{os.path.join(basedir, 'instance', 'afritec_lms_db.db')}"
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
    
    # Initialize database
    db.init_app(app)
    
    return app

def run_migration():
    """Run the forum enhancement migration"""
    app = create_app()
    
    with app.app_context():
        print("Starting forum enhancement migration...")
        
        # Create a connection to execute raw SQL
        connection = db.engine.connect()
        transaction = connection.begin()
        
        try:
            # Add missing columns to student_forums table
            print("Adding columns to student_forums table...")
            
            # Check if columns exist before adding them
            result = connection.execute(db.text("PRAGMA table_info(student_forums)"))
            existing_columns = [row[1] for row in result.fetchall()]
            
            migrations = [
                ("category", "ALTER TABLE student_forums ADD COLUMN category VARCHAR(100)"),
                ("is_pinned", "ALTER TABLE student_forums ADD COLUMN is_pinned BOOLEAN DEFAULT 0"),
                ("is_locked", "ALTER TABLE student_forums ADD COLUMN is_locked BOOLEAN DEFAULT 0"),
                ("view_count", "ALTER TABLE student_forums ADD COLUMN view_count INTEGER DEFAULT 0"),
                ("allow_anonymous", "ALTER TABLE student_forums ADD COLUMN allow_anonymous BOOLEAN DEFAULT 1"),
                ("moderated", "ALTER TABLE student_forums ADD COLUMN moderated BOOLEAN DEFAULT 0")
            ]
            
            for column_name, sql in migrations:
                if column_name not in existing_columns:
                    print(f"  Adding {column_name} column...")
                    connection.execute(db.text(sql))
                else:
                    print(f"  Column {column_name} already exists, skipping...")
            
            # Add missing columns to forum_posts table  
            print("Adding columns to forum_posts table...")
            
            result = connection.execute(db.text("PRAGMA table_info(forum_posts)"))
            existing_posts_columns = [row[1] for row in result.fetchall()]
            
            post_migrations = [
                ("is_pinned", "ALTER TABLE forum_posts ADD COLUMN is_pinned BOOLEAN DEFAULT 0"),
                ("is_locked", "ALTER TABLE forum_posts ADD COLUMN is_locked BOOLEAN DEFAULT 0"),
                ("is_approved", "ALTER TABLE forum_posts ADD COLUMN is_approved BOOLEAN DEFAULT 1"),
                ("is_edited", "ALTER TABLE forum_posts ADD COLUMN is_edited BOOLEAN DEFAULT 0"),
                ("like_count", "ALTER TABLE forum_posts ADD COLUMN like_count INTEGER DEFAULT 0"),
                ("dislike_count", "ALTER TABLE forum_posts ADD COLUMN dislike_count INTEGER DEFAULT 0"),
                ("view_count", "ALTER TABLE forum_posts ADD COLUMN view_count INTEGER DEFAULT 0"),
                ("is_flagged", "ALTER TABLE forum_posts ADD COLUMN is_flagged BOOLEAN DEFAULT 0"),
                ("flag_reason", "ALTER TABLE forum_posts ADD COLUMN flag_reason VARCHAR(255)"),
                ("moderated_by", "ALTER TABLE forum_posts ADD COLUMN moderated_by INTEGER"),
                ("moderated_at", "ALTER TABLE forum_posts ADD COLUMN moderated_at DATETIME")
            ]
            
            for column_name, sql in post_migrations:
                if column_name not in existing_posts_columns:
                    print(f"  Adding {column_name} column...")
                    connection.execute(db.text(sql))
                else:
                    print(f"  Column {column_name} already exists, skipping...")
            
            # Create additional tables for enhanced forum features
            print("Creating additional forum tables...")
            
            # ForumPostLike table
            like_table_sql = """
            CREATE TABLE IF NOT EXISTS forum_post_likes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                post_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                is_like BOOLEAN NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (post_id) REFERENCES forum_posts (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(post_id, user_id)
            )
            """
            connection.execute(db.text(like_table_sql))
            print("  Created forum_post_likes table")
            
            # ForumSubscription table  
            subscription_table_sql = """
            CREATE TABLE IF NOT EXISTS forum_subscriptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                forum_id INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (forum_id) REFERENCES student_forums (id),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(forum_id, user_id)
            )
            """
            connection.execute(db.text(subscription_table_sql))
            print("  Created forum_subscriptions table")
            
            # ForumNotification table
            notification_table_sql = """
            CREATE TABLE IF NOT EXISTS forum_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL,
                forum_id INTEGER,
                post_id INTEGER,
                type VARCHAR(50) NOT NULL,
                title VARCHAR(255) NOT NULL,
                message TEXT,
                is_read BOOLEAN DEFAULT 0,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (user_id) REFERENCES users (id),
                FOREIGN KEY (forum_id) REFERENCES student_forums (id),
                FOREIGN KEY (post_id) REFERENCES forum_posts (id)
            )
            """
            connection.execute(db.text(notification_table_sql))
            print("  Created forum_notifications table")
            
            # Commit the transaction
            transaction.commit()
            print("Migration completed successfully!")
            
        except Exception as e:
            # Rollback on error
            transaction.rollback()
            print(f"Migration failed: {e}")
            raise e
        finally:
            connection.close()

if __name__ == '__main__':
    run_migration()