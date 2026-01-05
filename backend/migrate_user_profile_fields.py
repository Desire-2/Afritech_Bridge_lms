#!/usr/bin/env python3
"""
Migration script to add comprehensive user profile fields to the users table.
This adds all the missing columns needed for the enhanced student profile system.
"""

import os
import sys
from datetime import datetime

# Add the project root to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from sqlalchemy import text

def migrate_user_profile_fields():
    """Add comprehensive profile fields to users table"""
    
    with app.app_context():
        try:
            print("🔄 Starting user profile fields migration...")
            
            # Define all the new columns with their SQL types
            columns_to_add = [
                # Career and Professional Info
                ('portfolio_url', 'VARCHAR(255)'),
                ('github_username', 'VARCHAR(50)'),
                ('linkedin_url', 'VARCHAR(255)'),
                ('twitter_username', 'VARCHAR(50)'),
                ('website_url', 'VARCHAR(255)'),
                ('location', 'VARCHAR(100)'),
                ('timezone', 'VARCHAR(50)'),
                ('job_title', 'VARCHAR(100)'),
                ('company', 'VARCHAR(100)'),
                ('experience_level', 'VARCHAR(20)'),
                ('industry', 'VARCHAR(100)'),
                
                # Skills and Learning
                ('skills', 'TEXT'),
                ('interests', 'TEXT'),
                ('learning_goals', 'TEXT'),
                ('preferred_learning_style', 'VARCHAR(50)'),
                ('daily_learning_time', 'INTEGER'),
                
                # Notification Preferences
                ('email_notifications', 'BOOLEAN DEFAULT true'),
                ('push_notifications', 'BOOLEAN DEFAULT true'),
                ('marketing_emails', 'BOOLEAN DEFAULT false'),
                ('weekly_digest', 'BOOLEAN DEFAULT true'),
                
                # Privacy Settings
                ('profile_visibility', 'VARCHAR(20) DEFAULT \'public\''),
                ('show_email', 'BOOLEAN DEFAULT false'),
                ('show_progress', 'BOOLEAN DEFAULT true'),
                
                # Gamification Preferences
                ('enable_gamification', 'BOOLEAN DEFAULT true'),
                ('show_leaderboard', 'BOOLEAN DEFAULT true'),
                
                # Password Reset
                ('reset_token', 'VARCHAR(255)'),
                ('reset_token_expires_at', 'TIMESTAMP'),
                ('must_change_password', 'BOOLEAN DEFAULT false'),
            ]
            
            # Check which columns already exist
            existing_columns_query = text("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'users' AND table_schema = 'public';
            """)
            
            result = db.session.execute(existing_columns_query)
            existing_columns = {row[0] for row in result}
            print(f"📋 Found {len(existing_columns)} existing columns in users table")
            
            # Add missing columns
            columns_added = 0
            for column_name, column_type in columns_to_add:
                if column_name not in existing_columns:
                    try:
                        alter_query = text(f"ALTER TABLE users ADD COLUMN {column_name} {column_type};")
                        db.session.execute(alter_query)
                        print(f"✅ Added column: {column_name} ({column_type})")
                        columns_added += 1
                    except Exception as col_error:
                        print(f"⚠️  Warning: Could not add column {column_name}: {col_error}")
                else:
                    print(f"⏭️  Column {column_name} already exists, skipping")
            
            # Commit all changes
            if columns_added > 0:
                db.session.commit()
                print(f"\n🎉 Migration completed successfully!")
                print(f"📊 Added {columns_added} new columns to users table")
            else:
                print(f"\n✨ All columns already exist. No migration needed.")
            
            # Verify the migration
            print("\n🔍 Verifying migration...")
            final_result = db.session.execute(existing_columns_query)
            final_columns = {row[0] for row in final_result}
            
            missing_columns = []
            for column_name, _ in columns_to_add:
                if column_name not in final_columns:
                    missing_columns.append(column_name)
            
            if missing_columns:
                print(f"⚠️  Warning: {len(missing_columns)} columns still missing:")
                for col in missing_columns:
                    print(f"   - {col}")
            else:
                print("✅ All required columns are now present in the users table!")
                
        except Exception as e:
            print(f"❌ Error during migration: {str(e)}")
            db.session.rollback()
            raise

if __name__ == "__main__":
    print("=" * 80)
    print("USER PROFILE FIELDS MIGRATION")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 80)
    
    migrate_user_profile_fields()
    
    print("\n" + "=" * 80)
    print("Migration completed. You can now restart the Flask server.")
    print("=" * 80)