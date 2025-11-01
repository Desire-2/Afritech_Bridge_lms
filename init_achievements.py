"""
Initialize Achievement System Data
===================================
Creates default achievements, milestones, leaderboards, and quests
Run this after database migration to populate the achievement system
"""

import os
import sys
from datetime import datetime, timedelta
import json

# Setup path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))

from src.models.achievement_models import (
    Achievement, Milestone, Leaderboard, QuestChallenge
)
from src.models.user_models import db


def create_achievements():
    """Create default achievements"""
    
    achievements = [
        # 🎯 Milestone Achievements (Common - First Steps)
        {
            'name': 'first_steps',
            'title': 'First Steps',
            'description': 'Complete your first lesson',
            'icon': 'target',
            'color': 'blue',
            'category': 'milestone',
            'tier': 'bronze',
            'points': 25,
            'xp_bonus': 10,
            'criteria_type': 'lessons_completed',
            'criteria_value': 1,
            'rarity': 'common',
            'unlock_message': 'Welcome to your learning journey! 🎓'
        },
        {
            'name': 'dedicated_learner',
            'title': 'Dedicated Learner',
            'description': 'Complete 10 lessons',
            'icon': 'book-open',
            'color': 'blue',
            'category': 'milestone',
            'tier': 'silver',
            'points': 100,
            'xp_bonus': 50,
            'criteria_type': 'lessons_completed',
            'criteria_value': 10,
            'rarity': 'uncommon'
        },
        {
            'name': 'knowledge_seeker',
            'title': 'Knowledge Seeker',
            'description': 'Complete 50 lessons',
            'icon': 'graduation-cap',
            'color': 'purple',
            'category': 'milestone',
            'tier': 'gold',
            'points': 500,
            'xp_bonus': 200,
            'criteria_type': 'lessons_completed',
            'criteria_value': 50,
            'rarity': 'rare'
        },
        
        # 🔥 Consistency Achievements
        {
            'name': 'getting_started',
            'title': 'Getting Started',
            'description': 'Learn for 3 days in a row',
            'icon': 'flame',
            'color': 'orange',
            'category': 'consistency',
            'tier': 'bronze',
            'points': 30,
            'xp_bonus': 15,
            'criteria_type': 'streak_days',
            'criteria_value': 3,
            'rarity': 'common'
        },
        {
            'name': 'week_warrior',
            'title': 'Week Warrior',
            'description': 'Maintain a 7-day learning streak',
            'icon': 'flame',
            'color': 'orange',
            'category': 'consistency',
            'tier': 'silver',
            'points': 75,
            'xp_bonus': 35,
            'criteria_type': 'streak_days',
            'criteria_value': 7,
            'rarity': 'uncommon',
            'unlock_message': 'You\'re on fire! Keep that streak going! 🔥'
        },
        {
            'name': 'marathon_runner',
            'title': 'Marathon Runner',
            'description': 'Maintain a 30-day learning streak',
            'icon': 'flame',
            'color': 'red',
            'category': 'consistency',
            'tier': 'gold',
            'points': 300,
            'xp_bonus': 150,
            'criteria_type': 'streak_days',
            'criteria_value': 30,
            'rarity': 'rare'
        },
        {
            'name': 'century_club',
            'title': 'Century Club',
            'description': 'Maintain a 100-day learning streak',
            'icon': 'flame',
            'color': 'purple',
            'category': 'consistency',
            'tier': 'diamond',
            'points': 1000,
            'xp_bonus': 500,
            'criteria_type': 'streak_days',
            'criteria_value': 100,
            'rarity': 'legendary'
        },
        
        # ⚡ Speed Achievements
        {
            'name': 'speed_demon',
            'title': 'Speed Demon',
            'description': 'Complete a lesson in under 5 minutes',
            'icon': 'zap',
            'color': 'yellow',
            'category': 'speed',
            'tier': 'silver',
            'points': 40,
            'xp_bonus': 20,
            'criteria_type': 'fast_completion',
            'criteria_value': 300,  # 5 minutes in seconds
            'rarity': 'uncommon',
            'is_repeatable': True
        },
        {
            'name': 'lightning_round',
            'title': 'Lightning Round',
            'description': 'Complete a lesson in under 3 minutes',
            'icon': 'zap',
            'color': 'yellow',
            'category': 'speed',
            'tier': 'gold',
            'points': 75,
            'xp_bonus': 40,
            'criteria_type': 'fast_completion',
            'criteria_value': 180,
            'rarity': 'rare',
            'is_repeatable': True
        },
        
        # ⭐ Mastery Achievements
        {
            'name': 'perfect_score',
            'title': 'Perfect Score',
            'description': 'Score 100% on a quiz',
            'icon': 'star',
            'color': 'gold',
            'category': 'mastery',
            'tier': 'gold',
            'points': 100,
            'xp_bonus': 50,
            'criteria_type': 'perfect_score',
            'criteria_value': 100,
            'rarity': 'rare',
            'is_repeatable': True,
            'unlock_message': 'Flawless victory! Absolutely perfect! ⭐'
        },
        {
            'name': 'module_master',
            'title': 'Module Master',
            'description': 'Complete all lessons in a module with 100% scores',
            'icon': 'award',
            'color': 'purple',
            'category': 'mastery',
            'tier': 'platinum',
            'points': 250,
            'xp_bonus': 125,
            'criteria_type': 'module_perfect_score',
            'criteria_value': 100,
            'rarity': 'epic',
            'is_repeatable': True
        },
        
        # 🤝 Social Achievements
        {
            'name': 'helpful_hand',
            'title': 'Helpful Hand',
            'description': 'Post 10 helpful comments in discussions',
            'icon': 'users',
            'color': 'green',
            'category': 'social',
            'tier': 'silver',
            'points': 50,
            'xp_bonus': 25,
            'criteria_type': 'social_interactions',
            'criteria_value': 10,
            'rarity': 'uncommon'
        },
        
        # 🌟 Special/Hidden Achievements
        {
            'name': 'early_bird',
            'title': 'Early Bird',
            'description': 'Complete a lesson between 5 AM and 8 AM',
            'icon': 'sunrise',
            'color': 'yellow',
            'category': 'special',
            'tier': 'silver',
            'points': 35,
            'xp_bonus': 20,
            'criteria_type': 'early_bird',
            'criteria_value': 1,
            'rarity': 'rare',
            'is_hidden': True,
            'is_repeatable': True
        },
        {
            'name': 'night_owl',
            'title': 'Night Owl',
            'description': 'Complete a lesson between 10 PM and 2 AM',
            'icon': 'moon',
            'color': 'purple',
            'category': 'special',
            'tier': 'silver',
            'points': 35,
            'xp_bonus': 20,
            'criteria_type': 'night_owl',
            'criteria_value': 1,
            'rarity': 'rare',
            'is_hidden': True,
            'is_repeatable': True
        },
        {
            'name': 'weekend_warrior',
            'title': 'Weekend Warrior',
            'description': 'Complete 5 lessons on a weekend',
            'icon': 'calendar',
            'color': 'blue',
            'category': 'special',
            'tier': 'gold',
            'points': 60,
            'xp_bonus': 30,
            'criteria_type': 'weekend_active',
            'criteria_value': 5,
            'rarity': 'rare',
            'is_hidden': True
        },
        {
            'name': 'highly_engaged',
            'title': 'Highly Engaged',
            'description': 'Complete a lesson with 95%+ engagement score',
            'icon': 'heart',
            'color': 'red',
            'category': 'special',
            'tier': 'gold',
            'points': 80,
            'xp_bonus': 40,
            'criteria_type': 'high_engagement',
            'criteria_value': 95,
            'rarity': 'epic',
            'is_repeatable': True
        }
    ]
    
    created_count = 0
    for ach_data in achievements:
        # Check if achievement already exists
        existing = Achievement.query.filter_by(name=ach_data['name']).first()
        if not existing:
            ach = Achievement(**ach_data)
            db.session.add(ach)
            created_count += 1
    
    db.session.commit()
    print(f"✅ Created {created_count} achievements (skipped {len(achievements) - created_count} existing)")


def create_milestones():
    """Create default milestones"""
    
    milestones = [
        # Lesson Milestones
        {
            'name': 'lessons_10',
            'title': '10 Lessons Milestone',
            'description': 'Complete your first 10 lessons',
            'icon': 'target',
            'color': 'blue',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'total_lessons',
            'criteria_value': 10,
            'points_reward': 100,
            'celebration_message': 'Amazing! You\'ve completed 10 lessons! 🎉',
            'is_major': False
        },
        {
            'name': 'lessons_50',
            'title': '50 Lessons Milestone',
            'description': 'Complete 50 lessons',
            'icon': 'book-open',
            'color': 'purple',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'total_lessons',
            'criteria_value': 50,
            'points_reward': 500,
            'celebration_message': 'Incredible! 50 lessons completed! 🌟',
            'is_major': True
        },
        {
            'name': 'lessons_100',
            'title': '100 Lessons Milestone',
            'description': 'Complete 100 lessons',
            'icon': 'graduation-cap',
            'color': 'gold',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'total_lessons',
            'criteria_value': 100,
            'points_reward': 1000,
            'celebration_message': 'Outstanding! Century of lessons achieved! 💯',
            'is_major': True
        },
        
        # Level Milestones
        {
            'name': 'level_5',
            'title': 'Level 5 Reached',
            'description': 'Reach level 5',
            'icon': 'star',
            'color': 'yellow',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'reach_level',
            'criteria_value': 5,
            'points_reward': 200,
            'celebration_message': 'Level 5! You\'re progressing nicely! ⭐'
        },
        {
            'name': 'level_10',
            'title': 'Level 10 Reached',
            'description': 'Reach level 10',
            'icon': 'star',
            'color': 'gold',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'reach_level',
            'criteria_value': 10,
            'points_reward': 500,
            'celebration_message': 'Level 10! You\'re a learning champion! 🏆',
            'is_major': True
        },
        
        # Points Milestones
        {
            'name': 'points_1000',
            'title': '1,000 Points Earned',
            'description': 'Earn your first 1,000 points',
            'icon': 'trophy',
            'color': 'gold',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'total_points',
            'criteria_value': 1000,
            'celebration_message': '1,000 points! Keep up the great work! 💪'
        },
        {
            'name': 'points_5000',
            'title': '5,000 Points Earned',
            'description': 'Earn 5,000 points',
            'icon': 'trophy',
            'color': 'purple',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'total_points',
            'criteria_value': 5000,
            'celebration_message': '5,000 points! You\'re unstoppable! 🚀',
            'is_major': True
        },
        
        # Course Completion Milestones
        {
            'name': 'first_course',
            'title': 'First Course Completed',
            'description': 'Complete your first course',
            'icon': 'award',
            'color': 'blue',
            'milestone_type': 'platform',
            'scope': 'user',
            'criteria_type': 'course_completion',
            'criteria_value': 1,
            'points_reward': 300,
            'celebration_message': 'First course complete! What an achievement! 🎓',
            'is_major': True
        }
    ]
    
    created_count = 0
    for ms_data in milestones:
        existing = Milestone.query.filter_by(name=ms_data['name']).first()
        if not existing:
            ms = Milestone(**ms_data)
            db.session.add(ms)
            created_count += 1
    
    db.session.commit()
    print(f"✅ Created {created_count} milestones (skipped {len(milestones) - created_count} existing)")


def create_leaderboards():
    """Create default leaderboards"""
    
    leaderboards = [
        # All-Time Leaderboards
        {
            'name': 'total_points_alltime',
            'title': 'All-Time Top Point Earners',
            'description': 'Students with the most points ever',
            'metric': 'total_points',
            'time_period': 'all_time',
            'scope': 'global',
            'icon': 'trophy',
            'color': 'gold',
            'max_displayed': 100,
            'is_active': True
        },
        {
            'name': 'current_level',
            'title': 'Highest Levels',
            'description': 'Students at the highest levels',
            'metric': 'level',
            'time_period': 'all_time',
            'scope': 'global',
            'icon': 'star',
            'color': 'purple',
            'max_displayed': 50,
            'is_active': True
        },
        {
            'name': 'streak_masters',
            'title': 'Streak Masters',
            'description': 'Longest active learning streaks',
            'metric': 'streak_days',
            'time_period': 'all_time',
            'scope': 'global',
            'icon': 'flame',
            'color': 'orange',
            'max_displayed': 50,
            'is_active': True
        },
        
        # Weekly Leaderboards
        {
            'name': 'weekly_champions',
            'title': 'This Week\'s Champions',
            'description': 'Top performers this week',
            'metric': 'total_points',
            'time_period': 'weekly',
            'scope': 'global',
            'icon': 'crown',
            'color': 'purple',
            'max_displayed': 50,
            'is_active': True
        },
        {
            'name': 'weekly_activity',
            'title': 'Most Active This Week',
            'description': 'Students with most lessons completed this week',
            'metric': 'lessons_completed',
            'time_period': 'weekly',
            'scope': 'global',
            'icon': 'zap',
            'color': 'yellow',
            'max_displayed': 30,
            'is_active': True
        },
        
        # Monthly Leaderboards
        {
            'name': 'monthly_leaders',
            'title': 'Monthly Leaders',
            'description': 'Top point earners this month',
            'metric': 'total_points',
            'time_period': 'monthly',
            'scope': 'global',
            'icon': 'medal',
            'color': 'blue',
            'max_displayed': 50,
            'is_active': True
        }
    ]
    
    created_count = 0
    for lb_data in leaderboards:
        existing = Leaderboard.query.filter_by(name=lb_data['name']).first()
        if not existing:
            lb = Leaderboard(**lb_data)
            db.session.add(lb)
            created_count += 1
    
    db.session.commit()
    print(f"✅ Created {created_count} leaderboards (skipped {len(leaderboards) - created_count} existing)")


def create_quests():
    """Create sample quests"""
    
    now = datetime.utcnow()
    
    quests = [
        # Daily Quest
        {
            'name': 'daily_learner',
            'title': 'Daily Learning Goal',
            'description': 'Complete 3 lessons today',
            'challenge_type': 'daily',
            'difficulty': 'easy',
            'objectives': json.dumps([
                {
                    'key': 'lessons_today',
                    'target': 3,
                    'description': 'Complete 3 lessons'
                }
            ]),
            'progress_tracking': json.dumps({'lessons_today': 0}),
            'start_date': now,
            'end_date': now + timedelta(days=1),
            'completion_points': 50,
            'completion_xp': 25,
            'is_active': True
        },
        
        # Weekly Quest
        {
            'name': 'weekly_warrior',
            'title': 'Weekly Learning Challenge',
            'description': 'Complete 15 lessons this week',
            'challenge_type': 'weekly',
            'difficulty': 'medium',
            'objectives': json.dumps([
                {
                    'key': 'lessons_week',
                    'target': 15,
                    'description': 'Complete 15 lessons this week'
                },
                {
                    'key': 'quizzes_week',
                    'target': 3,
                    'description': 'Complete 3 quizzes this week'
                }
            ]),
            'progress_tracking': json.dumps({'lessons_week': 0, 'quizzes_week': 0}),
            'start_date': now,
            'end_date': now + timedelta(days=7),
            'completion_points': 200,
            'completion_xp': 100,
            'is_active': True
        },
        
        # Special Event Quest
        {
            'name': 'weekend_sprint',
            'title': 'Weekend Learning Sprint',
            'description': 'Complete 10 lessons over the weekend',
            'challenge_type': 'special_event',
            'difficulty': 'hard',
            'objectives': json.dumps([
                {
                    'key': 'weekend_lessons',
                    'target': 10,
                    'description': 'Complete 10 lessons on Saturday or Sunday'
                }
            ]),
            'progress_tracking': json.dumps({'weekend_lessons': 0}),
            'start_date': now,
            'end_date': now + timedelta(days=3),
            'completion_points': 300,
            'completion_xp': 150,
            'is_active': True
        }
    ]
    
    created_count = 0
    for quest_data in quests:
        existing = QuestChallenge.query.filter_by(name=quest_data['name']).first()
        if not existing:
            quest = QuestChallenge(**quest_data)
            db.session.add(quest)
            created_count += 1
    
    db.session.commit()
    print(f"✅ Created {created_count} quests (skipped {len(quests) - created_count} existing)")


def init_all():
    """Initialize all achievement system data"""
    print("\n🚀 Initializing Achievement System...\n")
    
    try:
        create_achievements()
        create_milestones()
        create_leaderboards()
        create_quests()
        
        print("\n🎉 Achievement system initialized successfully!")
        print("\nSummary:")
        print(f"  - Achievements: {Achievement.query.count()}")
        print(f"  - Milestones: {Milestone.query.count()}")
        print(f"  - Leaderboards: {Leaderboard.query.count()}")
        print(f"  - Quests: {QuestChallenge.query.count()}")
        
    except Exception as e:
        print(f"\n❌ Error initializing achievement system: {str(e)}")
        db.session.rollback()
        raise


if __name__ == '__main__':
    from main import app
    
    with app.app_context():
        init_all()
