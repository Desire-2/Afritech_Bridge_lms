#!/usr/bin/env python3
"""
Simple migration script to seed the database with default achievements
Uses direct database connection without Flask app dependency
"""

import sqlite3
import json
from datetime import datetime, timedelta

def get_db_connection():
    """Get database connection"""
    db_path = '/home/desire/My_Project/Client_Project/Afritech_Bridge_lms/backend/instance/afritec_lms_db.db'
    return sqlite3.connect(db_path)

def create_achievements_table():
    """Create achievements table if it doesn't exist"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name VARCHAR(100) UNIQUE NOT NULL,
            title VARCHAR(150) NOT NULL,
            description TEXT NOT NULL,
            icon VARCHAR(100) DEFAULT 'trophy',
            color VARCHAR(20) DEFAULT 'gold',
            category VARCHAR(50) NOT NULL,
            tier VARCHAR(20) DEFAULT 'bronze',
            points INTEGER DEFAULT 10,
            xp_bonus INTEGER DEFAULT 0,
            criteria_type VARCHAR(50) NOT NULL,
            criteria_value INTEGER NOT NULL,
            criteria_data TEXT,
            is_hidden BOOLEAN DEFAULT 0,
            is_repeatable BOOLEAN DEFAULT 0,
            is_seasonal BOOLEAN DEFAULT 0,
            season_start DATETIME,
            season_end DATETIME,
            rarity VARCHAR(20) DEFAULT 'common',
            max_earners INTEGER,
            current_earners INTEGER DEFAULT 0,
            unlock_message TEXT,
            share_text VARCHAR(280),
            is_active BOOLEAN DEFAULT 1,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    
    conn.commit()
    conn.close()

def insert_default_achievements():
    """Insert default achievements"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Check if achievements already exist
    cursor.execute("SELECT COUNT(*) FROM achievements")
    count = cursor.fetchone()[0]
    
    if count > 0:
        print(f"Found {count} existing achievements, skipping creation")
        conn.close()
        return
    
    achievements = [
        # Speed achievements
        ('speed_demon', 'Speed Demon', 'Complete a lesson in under 5 minutes', 'zap', 'yellow', 
         'speed', 'bronze', 25, 10, 'fast_completion', 300, None, 0, 0, 0, None, None, 'common', None, 0, None, None, 1),
        
        ('lightning_learner', 'Lightning Learner', 'Complete 5 lessons in a single day', 'bolt', 'blue',
         'speed', 'silver', 50, 25, 'daily_lessons', 5, None, 0, 0, 0, None, None, 'uncommon', None, 0, None, None, 1),
        
        # Consistency achievements
        ('consistent_learner', 'Consistent Learner', 'Maintain a 7-day learning streak', 'calendar-check', 'green',
         'consistency', 'bronze', 50, 20, 'streak_days', 7, None, 0, 0, 0, None, None, 'common', None, 0, None, None, 1),
        
        ('streak_master', 'Streak Master', 'Maintain a 30-day learning streak', 'flame', 'orange',
         'consistency', 'gold', 200, 100, 'streak_days', 30, None, 0, 0, 0, None, None, 'rare', None, 0, None, None, 1),
        
        ('dedication_legend', 'Dedication Legend', 'Maintain a 100-day learning streak', 'crown', 'purple',
         'consistency', 'diamond', 1000, 500, 'streak_days', 100, None, 0, 0, 0, None, None, 'legendary', None, 0, None, None, 1),
        
        # Mastery achievements
        ('perfectionist', 'Perfectionist', 'Score 100% on a quiz', 'star', 'gold',
         'mastery', 'bronze', 30, 15, 'perfect_score', 100, None, 0, 0, 0, None, None, 'common', None, 0, None, None, 1),
        
        ('quiz_champion', 'Quiz Champion', 'Score perfect on 5 different quizzes', 'trophy', 'gold',
         'mastery', 'silver', 100, 50, 'perfect_scores_count', 5, None, 0, 0, 0, None, None, 'uncommon', None, 0, None, None, 1),
        
        # Milestone achievements
        ('first_steps', 'First Steps', 'Complete your first lesson', 'footprints', 'blue',
         'milestone', 'bronze', 10, 5, 'lessons_completed', 1, None, 0, 0, 0, None, None, 'common', None, 0, None, None, 1),
        
        ('dedicated_student', 'Dedicated Student', 'Complete 50 lessons', 'book-open', 'green',
         'milestone', 'silver', 150, 75, 'lessons_completed', 50, None, 0, 0, 0, None, None, 'uncommon', None, 0, None, None, 1),
        
        ('knowledge_seeker', 'Knowledge Seeker', 'Complete 100 lessons', 'graduation-cap', 'purple',
         'milestone', 'gold', 300, 150, 'lessons_completed', 100, None, 0, 0, 0, None, None, 'rare', None, 0, None, None, 1),
        
        ('course_completer', 'Course Completer', 'Complete your first course', 'check-circle', 'green',
         'milestone', 'silver', 100, 50, 'courses_completed', 1, None, 0, 0, 0, None, None, 'common', None, 0, None, None, 1),
        
        # Special achievements
        ('early_bird', 'Early Bird', 'Complete a lesson between 5 AM and 8 AM', 'sunrise', 'yellow',
         'special', 'bronze', 25, 10, 'early_bird', 1, None, 0, 0, 0, None, None, 'uncommon', None, 0, None, None, 1),
        
        ('night_owl', 'Night Owl', 'Complete a lesson between 10 PM and 2 AM', 'moon', 'purple',
         'special', 'bronze', 25, 10, 'night_owl', 1, None, 0, 0, 0, None, None, 'uncommon', None, 0, None, None, 1),
        
        # Hidden achievement
        ('easter_egg_finder', '???', 'A mysterious achievement awaits discovery', 'gift', 'rainbow',
         'special', 'platinum', 500, 250, 'easter_egg', 1, None, 1, 0, 0, None, None, 'legendary', None, 0, None, None, 1)
    ]
    
    cursor.executemany('''
        INSERT INTO achievements (
            name, title, description, icon, color, category, tier, points, xp_bonus,
            criteria_type, criteria_value, criteria_data, is_hidden, is_repeatable, is_seasonal,
            season_start, season_end, rarity, max_earners, current_earners, unlock_message,
            share_text, is_active
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', achievements)
    
    print(f"✅ Created {len(achievements)} achievements")
    conn.commit()
    conn.close()

def create_other_tables():
    """Create other achievement-related tables"""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Student Points table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS student_points (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            total_points INTEGER DEFAULT 0,
            lesson_points INTEGER DEFAULT 0,
            quiz_points INTEGER DEFAULT 0,
            assignment_points INTEGER DEFAULT 0,
            streak_points INTEGER DEFAULT 0,
            achievement_points INTEGER DEFAULT 0,
            social_points INTEGER DEFAULT 0,
            bonus_points INTEGER DEFAULT 0,
            total_xp INTEGER DEFAULT 0,
            current_level INTEGER DEFAULT 1,
            xp_to_next_level INTEGER DEFAULT 100,
            global_rank INTEGER,
            course_ranks TEXT DEFAULT '{}',
            points_this_week INTEGER DEFAULT 0,
            points_this_month INTEGER DEFAULT 0,
            week_reset_date DATE,
            month_reset_date DATE,
            point_multiplier REAL DEFAULT 1.0,
            multiplier_expires_at DATETIME,
            last_points_earned_at DATETIME,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # Learning Streaks table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS learning_streaks (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL UNIQUE,
            current_streak INTEGER DEFAULT 0,
            last_activity_date DATE,
            longest_streak INTEGER DEFAULT 0,
            longest_streak_start DATE,
            longest_streak_end DATE,
            total_active_days INTEGER DEFAULT 0,
            total_lessons_completed INTEGER DEFAULT 0,
            total_time_minutes INTEGER DEFAULT 0,
            milestones_reached TEXT DEFAULT '[]',
            streak_freezes_available INTEGER DEFAULT 3,
            last_freeze_used DATE,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users (id)
        )
    ''')
    
    # User Achievements table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS user_achievements (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            achievement_id INTEGER NOT NULL,
            earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            progress REAL DEFAULT 100.0,
            times_earned INTEGER DEFAULT 1,
            context_data TEXT,
            earned_during_course_id INTEGER,
            is_showcased BOOLEAN DEFAULT 0,
            showcase_order INTEGER DEFAULT 0,
            shared_count INTEGER DEFAULT 0,
            FOREIGN KEY (user_id) REFERENCES users (id),
            FOREIGN KEY (achievement_id) REFERENCES achievements (id),
            FOREIGN KEY (earned_during_course_id) REFERENCES courses (id),
            UNIQUE(user_id, achievement_id)
        )
    ''')
    
    print("✅ Created achievement system tables")
    conn.commit()
    conn.close()

def main():
    """Main function"""
    print("🚀 Starting Simple Achievement System Migration...")
    
    try:
        create_other_tables()
        create_achievements_table()
        insert_default_achievements()
        
        # Check final counts
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("SELECT COUNT(*) FROM achievements")
        achievement_count = cursor.fetchone()[0]
        
        conn.close()
        
        print("✅ Achievement system migration completed successfully!")
        print(f"\n📊 Summary:")
        print(f"   - Total Achievements: {achievement_count}")
        
        return 0
        
    except Exception as e:
        print(f"❌ Error during migration: {str(e)}")
        return 1

if __name__ == "__main__":
    exit(main())