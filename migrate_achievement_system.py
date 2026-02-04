#!/usr/bin/env python3
"""
Migration script to seed the database with default achievements
Run this script to populate the achievement system with initial data
"""

import sys
import os
from datetime import datetime, timedelta

# Add the backend directory to the path
sys.path.append('/home/desire/My_Project/Client_Project/Afritech_Bridge_lms/backend')
os.chdir('/home/desire/My_Project/Client_Project/Afritech_Bridge_lms/backend')

from src.models.user_models import db
from src.models.achievement_models import Achievement, Milestone, Leaderboard, QuestChallenge
from main import create_app

def create_default_achievements():
    """Create default achievements for the system"""
    print("Creating default achievements...")
    
    achievements = [
        # Speed achievements
        {
            'name': 'speed_demon',
            'title': 'Speed Demon',
            'description': 'Complete a lesson in under 5 minutes',
            'icon': 'zap',
            'color': 'yellow',
            'category': 'speed',
            'tier': 'bronze',
            'points': 25,
            'xp_bonus': 10,
            'criteria_type': 'fast_completion',
            'criteria_value': 300,  # 5 minutes in seconds
            'rarity': 'common'
        },
        {
            'name': 'lightning_learner',
            'title': 'Lightning Learner',
            'description': 'Complete 5 lessons in a single day',
            'icon': 'bolt',
            'color': 'blue',
            'category': 'speed',
            'tier': 'silver',
            'points': 50,
            'xp_bonus': 25,
            'criteria_type': 'daily_lessons',
            'criteria_value': 5,
            'rarity': 'uncommon'
        },
        
        # Consistency achievements
        {
            'name': 'consistent_learner',
            'title': 'Consistent Learner',
            'description': 'Maintain a 7-day learning streak',
            'icon': 'calendar-check',
            'color': 'green',
            'category': 'consistency',
            'tier': 'bronze',
            'points': 50,
            'xp_bonus': 20,
            'criteria_type': 'streak_days',
            'criteria_value': 7,
            'rarity': 'common'
        },
        {
            'name': 'streak_master',
            'title': 'Streak Master',
            'description': 'Maintain a 30-day learning streak',
            'icon': 'flame',
            'color': 'orange',
            'category': 'consistency',
            'tier': 'gold',
            'points': 200,
            'xp_bonus': 100,
            'criteria_type': 'streak_days',
            'criteria_value': 30,
            'rarity': 'rare'
        },
        {
            'name': 'dedication_legend',
            'title': 'Dedication Legend',
            'description': 'Maintain a 100-day learning streak',
            'icon': 'crown',
            'color': 'purple',
            'category': 'consistency',
            'tier': 'diamond',
            'points': 1000,
            'xp_bonus': 500,
            'criteria_type': 'streak_days',
            'criteria_value': 100,
            'rarity': 'legendary'
        },
        
        # Mastery achievements
        {
            'name': 'perfectionist',
            'title': 'Perfectionist',
            'description': 'Score 100% on a quiz',
            'icon': 'star',
            'color': 'gold',
            'category': 'mastery',
            'tier': 'bronze',
            'points': 30,
            'xp_bonus': 15,
            'criteria_type': 'perfect_score',
            'criteria_value': 100,
            'rarity': 'common'
        },
        {
            'name': 'quiz_champion',
            'title': 'Quiz Champion',
            'description': 'Score perfect on 5 different quizzes',
            'icon': 'trophy',
            'color': 'gold',
            'category': 'mastery',
            'tier': 'silver',
            'points': 100,
            'xp_bonus': 50,
            'criteria_type': 'perfect_scores_count',
            'criteria_value': 5,
            'rarity': 'uncommon'
        },
        
        # Milestone achievements
        {
            'name': 'first_steps',
            'title': 'First Steps',
            'description': 'Complete your first lesson',
            'icon': 'footprints',
            'color': 'blue',
            'category': 'milestone',
            'tier': 'bronze',
            'points': 10,
            'xp_bonus': 5,
            'criteria_type': 'lessons_completed',
            'criteria_value': 1,
            'rarity': 'common'
        },
        {
            'name': 'dedicated_student',
            'title': 'Dedicated Student',
            'description': 'Complete 50 lessons',
            'icon': 'book-open',
            'color': 'green',
            'category': 'milestone',
            'tier': 'silver',
            'points': 150,
            'xp_bonus': 75,
            'criteria_type': 'lessons_completed',
            'criteria_value': 50,
            'rarity': 'uncommon'
        },
        {
            'name': 'knowledge_seeker',
            'title': 'Knowledge Seeker',
            'description': 'Complete 100 lessons',
            'icon': 'graduation-cap',
            'color': 'purple',
            'category': 'milestone',
            'tier': 'gold',
            'points': 300,
            'xp_bonus': 150,
            'criteria_type': 'lessons_completed',
            'criteria_value': 100,
            'rarity': 'rare'
        },
        {
            'name': 'course_completer',
            'title': 'Course Completer',
            'description': 'Complete your first course',
            'icon': 'check-circle',
            'color': 'green',
            'category': 'milestone',
            'tier': 'silver',
            'points': 100,
            'xp_bonus': 50,
            'criteria_type': 'courses_completed',
            'criteria_value': 1,
            'rarity': 'common'
        },
        
        # Special achievements
        {
            'name': 'early_bird',
            'title': 'Early Bird',
            'description': 'Complete a lesson between 5 AM and 8 AM',
            'icon': 'sunrise',
            'color': 'yellow',
            'category': 'special',
            'tier': 'bronze',
            'points': 25,
            'xp_bonus': 10,
            'criteria_type': 'early_bird',
            'criteria_value': 1,
            'rarity': 'uncommon'
        },
        {
            'name': 'night_owl',
            'title': 'Night Owl',
            'description': 'Complete a lesson between 10 PM and 2 AM',
            'icon': 'moon',
            'color': 'purple',
            'category': 'special',
            'tier': 'bronze',
            'points': 25,
            'xp_bonus': 10,
            'criteria_type': 'night_owl',
            'criteria_value': 1,
            'rarity': 'uncommon'
        },
        
        # Hidden achievements
        {
            'name': 'easter_egg_finder',
            'title': '???',
            'description': 'A mysterious achievement awaits discovery',
            'icon': 'gift',
            'color': 'rainbow',
            'category': 'special',
            'tier': 'platinum',
            'points': 500,
            'xp_bonus': 250,
            'criteria_type': 'easter_egg',
            'criteria_value': 1,
            'rarity': 'legendary',
            'is_hidden': True
        },
        
        # Seasonal achievement
        {
            'name': 'new_year_resolution',
            'title': 'New Year Resolution',
            'description': 'Complete 10 lessons in the first week of the year',
            'icon': 'calendar',
            'color': 'gold',
            'category': 'special',
            'tier': 'gold',
            'points': 200,
            'xp_bonus': 100,
            'criteria_type': 'seasonal_lessons',
            'criteria_value': 10,
            'rarity': 'epic',
            'is_seasonal': True,
            'season_start': datetime(2024, 1, 1),
            'season_end': datetime(2024, 1, 7)
        }
    ]
    
    for ach_data in achievements:
        # Check if achievement already exists
        existing = Achievement.query.filter_by(name=ach_data['name']).first()
        if existing:
            print(f"Achievement '{ach_data['name']}' already exists, skipping...")
            continue
            
        achievement = Achievement(**ach_data)
        db.session.add(achievement)
    
    print(f"Added {len([a for a in achievements if not Achievement.query.filter_by(name=a['name']).first()])} new achievements")

def create_default_milestones():
    """Create default milestones"""
    print("Creating default milestones...")
    
    milestones = [
        {
            'name': 'lesson_milestone_10',
            'title': '10 Lessons Completed',
            'description': 'You have completed 10 lessons total',
            'icon': 'target',
            'color': 'blue',
            'milestone_type': 'platform',
            'criteria_type': 'total_lessons',
            'criteria_value': 10,
            'points_reward': 50
        },
        {
            'name': 'lesson_milestone_25',
            'title': '25 Lessons Completed',
            'description': 'You have completed 25 lessons total',
            'icon': 'target',
            'color': 'green',
            'milestone_type': 'platform',
            'criteria_type': 'total_lessons',
            'criteria_value': 25,
            'points_reward': 100,
            'is_major': True
        },
        {
            'name': 'points_milestone_1000',
            'title': '1,000 Points Earned',
            'description': 'You have earned 1,000 total points',
            'icon': 'star',
            'color': 'yellow',
            'milestone_type': 'platform',
            'criteria_type': 'total_points',
            'criteria_value': 1000,
            'points_reward': 100
        },
        {
            'name': 'level_milestone_5',
            'title': 'Level 5 Reached',
            'description': 'You have reached level 5',
            'icon': 'trending-up',
            'color': 'purple',
            'milestone_type': 'platform',
            'criteria_type': 'reach_level',
            'criteria_value': 5,
            'points_reward': 150,
            'is_major': True,
            'celebration_message': 'Congratulations on reaching level 5! You are becoming a true learning champion!'
        }
    ]
    
    for milestone_data in milestones:
        existing = Milestone.query.filter_by(name=milestone_data['name']).first()
        if existing:
            print(f"Milestone '{milestone_data['name']}' already exists, skipping...")
            continue
            
        milestone = Milestone(**milestone_data)
        db.session.add(milestone)
    
    print(f"Added {len([m for m in milestones if not Milestone.query.filter_by(name=m['name']).first()])} new milestones")

def create_default_leaderboards():
    """Create default leaderboards"""
    print("Creating default leaderboards...")
    
    leaderboards = [
        {
            'name': 'global_points',
            'title': 'Global Points Leaderboard',
            'description': 'Top performers by total points earned',
            'metric': 'total_points',
            'time_period': 'all_time',
            'scope': 'global',
            'icon': 'trophy',
            'color': 'gold',
            'max_displayed': 100
        },
        {
            'name': 'weekly_points',
            'title': 'Weekly Points Leaderboard',
            'description': 'Top performers this week',
            'metric': 'total_points',
            'time_period': 'weekly',
            'scope': 'global',
            'icon': 'calendar',
            'color': 'blue',
            'max_displayed': 50
        },
        {
            'name': 'streak_leaders',
            'title': 'Streak Champions',
            'description': 'Longest current learning streaks',
            'metric': 'streak_days',
            'time_period': 'all_time',
            'scope': 'global',
            'icon': 'flame',
            'color': 'orange',
            'max_displayed': 50
        }
    ]
    
    for lb_data in leaderboards:
        existing = Leaderboard.query.filter_by(name=lb_data['name']).first()
        if existing:
            print(f"Leaderboard '{lb_data['name']}' already exists, skipping...")
            continue
            
        leaderboard = Leaderboard(**lb_data)
        db.session.add(leaderboard)
    
    print(f"Added {len([l for l in leaderboards if not Leaderboard.query.filter_by(name=l['name']).first()])} new leaderboards")

def create_default_quests():
    """Create default quest challenges"""
    print("Creating default quests...")
    
    # Calculate dates
    now = datetime.utcnow()
    week_from_now = now + timedelta(days=7)
    month_from_now = now + timedelta(days=30)
    
    quests = [
        {
            'name': 'weekly_warrior',
            'title': 'Weekly Warrior',
            'description': 'Complete 7 lessons this week to prove your dedication',
            'challenge_type': 'weekly',
            'difficulty': 'medium',
            'objectives': '[{"key": "lessons_completed", "title": "Complete Lessons", "description": "Complete 7 lessons", "target": 7}]',
            'progress_tracking': '{"lessons_completed": {"type": "counter", "max": 7}}',
            'start_date': now,
            'end_date': week_from_now,
            'completion_points': 150,
            'completion_xp': 75,
            'icon': 'sword',
            'color_theme': 'blue',
            'max_participants': 1000
        },
        {
            'name': 'quiz_master_challenge',
            'title': 'Quiz Master Challenge',
            'description': 'Score above 80% on 5 different quizzes',
            'challenge_type': 'special_event',
            'difficulty': 'hard',
            'objectives': '[{"key": "high_score_quizzes", "title": "High Score Quizzes", "description": "Score 80%+ on quizzes", "target": 5}]',
            'progress_tracking': '{"high_score_quizzes": {"type": "counter", "max": 5}}',
            'start_date': now,
            'end_date': month_from_now,
            'completion_points': 300,
            'completion_xp': 150,
            'special_reward': 'Exclusive Quiz Master badge',
            'icon': 'brain',
            'color_theme': 'purple',
            'max_participants': 500
        },
        {
            'name': 'speed_learning_sprint',
            'title': 'Speed Learning Sprint',
            'description': 'Complete 3 lessons in under 30 minutes total',
            'challenge_type': 'daily',
            'difficulty': 'easy',
            'objectives': '[{"key": "fast_lessons", "title": "Fast Lesson Completions", "description": "Complete lessons quickly", "target": 3}]',
            'progress_tracking': '{"fast_lessons": {"type": "counter", "max": 3}, "total_time": {"type": "timer", "max": 1800}}',
            'start_date': now,
            'end_date': now + timedelta(days=1),
            'completion_points': 100,
            'completion_xp': 50,
            'icon': 'zap',
            'color_theme': 'yellow'
        }
    ]
    
    for quest_data in quests:
        existing = QuestChallenge.query.filter_by(name=quest_data['name']).first()
        if existing:
            print(f"Quest '{quest_data['name']}' already exists, skipping...")
            continue
            
        quest = QuestChallenge(**quest_data)
        db.session.add(quest)
    
    print(f"Added {len([q for q in quests if not QuestChallenge.query.filter_by(name=q['name']).first()])} new quests")

def main():
    """Main function to run the migration"""
    print("🚀 Starting Achievement System Migration...")
    
    # Create Flask app and database context
    app = create_app()
    
    with app.app_context():
        try:
            # Create all tables if they don't exist
            db.create_all()
            
            # Seed default data
            create_default_achievements()
            create_default_milestones()
            create_default_leaderboards()
            create_default_quests()
            
            # Commit all changes
            db.session.commit()
            
            print("✅ Achievement system migration completed successfully!")
            print("\n📊 Summary:")
            print(f"   - Total Achievements: {Achievement.query.count()}")
            print(f"   - Total Milestones: {Milestone.query.count()}")
            print(f"   - Total Leaderboards: {Leaderboard.query.count()}")
            print(f"   - Total Quests: {QuestChallenge.query.count()}")
            
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error during migration: {str(e)}")
            return 1
    
    return 0

if __name__ == "__main__":
    sys.exit(main())