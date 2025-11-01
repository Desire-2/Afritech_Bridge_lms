"""
Create Achievement Tables and Initialize Data
==============================================
Simple script to create tables and populate achievement system data
"""

import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from main import app, db

print("\n🚀 Creating achievement system tables...")
print("=" * 60)

with app.app_context():
    try:
        # Create all tables (including achievement tables)
        print("\n📊 Creating database tables...")
        db.create_all()
        print("✅ All tables created successfully!")
        
        # Verify achievement tables were created
        from sqlalchemy import inspect
        inspector = inspect(db.engine)
        tables = inspector.get_table_names()
        
        achievement_tables = [
            'achievements',
            'user_achievements', 
            'learning_streaks',
            'student_points',
            'milestones',
            'user_milestones',
            'leaderboards',
            'quest_challenges',
            'user_quest_progress'
        ]
        
        print("\n📋 Checking achievement tables:")
        for table in achievement_tables:
            if table in tables:
                print(f"  ✅ {table}")
            else:
                print(f"  ❌ {table} - NOT FOUND")
        
        print("\n" + "=" * 60)
        print("✨ Database setup complete!")
        print("\nNext step: Run initialization script")
        print("  python init_achievements.py")
        print("=" * 60 + "\n")
        
    except Exception as e:
        print(f"\n❌ Error creating tables: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
