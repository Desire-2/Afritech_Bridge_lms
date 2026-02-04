# Enhanced Achievement System Models for Afritec Bridge LMS
# Creative gamification with streaks, milestones, leaderboards, and dynamic achievements

from datetime import datetime, timedelta
import json
from sqlalchemy.orm import validates
from sqlalchemy.exc import SQLAlchemyError
import logging
from .user_models import db, User
from .course_models import Course, Module, Enrollment

# Set up logger
logger = logging.getLogger(__name__)

class Achievement(db.Model):
    """
    Comprehensive achievement system with multiple types and tiers
    Supports dynamic, hidden, and seasonal achievements
    """
    __tablename__ = 'achievements'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon = db.Column(db.String(100), default='trophy')  # Lucide icon name
    color = db.Column(db.String(20), default='gold')  # gold, silver, bronze, platinum, diamond
    
    # Achievement categorization
    category = db.Column(db.String(50), nullable=False)  # speed, consistency, mastery, social, milestone, special
    tier = db.Column(db.String(20), default='bronze')  # bronze, silver, gold, platinum, diamond
    
    # Points and rewards
    points = db.Column(db.Integer, default=10)
    xp_bonus = db.Column(db.Integer, default=0)  # Extra experience points
    
    # Criteria and conditions
    criteria_type = db.Column(db.String(50), nullable=False)  # lessons_completed, streak_days, perfect_score, etc.
    criteria_value = db.Column(db.Integer, nullable=False)  # Threshold to unlock
    criteria_data = db.Column(db.Text, nullable=True)  # JSON for complex criteria
    
    # Special properties
    is_hidden = db.Column(db.Boolean, default=False)  # Hidden until earned
    is_repeatable = db.Column(db.Boolean, default=False)  # Can be earned multiple times
    is_seasonal = db.Column(db.Boolean, default=False)  # Time-limited achievement
    season_start = db.Column(db.DateTime, nullable=True)
    season_end = db.Column(db.DateTime, nullable=True)
    
    # Rarity and exclusivity
    rarity = db.Column(db.String(20), default='common')  # common, uncommon, rare, epic, legendary
    max_earners = db.Column(db.Integer, nullable=True)  # Limit number who can earn (exclusive achievements)
    current_earners = db.Column(db.Integer, default=0)
    
    # Display and motivation
    unlock_message = db.Column(db.Text, nullable=True)  # Custom message when unlocked
    share_text = db.Column(db.String(280), nullable=True)  # Text for sharing achievement
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Add validation
    @validates('name')
    def validate_name(self, key, name):
        if not name or len(name.strip()) == 0:
            raise ValueError("Achievement name cannot be empty")
        return name.strip()
    
    @validates('points')
    def validate_points(self, key, points):
        if points is not None and points < 0:
            raise ValueError("Achievement points cannot be negative")
        return points
    
    @validates('criteria_value')
    def validate_criteria_value(self, key, criteria_value):
        if criteria_value is not None and criteria_value < 0:
            raise ValueError("Criteria value cannot be negative")
        return criteria_value
    
    @validates('max_earners')
    def validate_max_earners(self, key, max_earners):
        if max_earners is not None and max_earners < 1:
            raise ValueError("Max earners must be at least 1")
        return max_earners
    
    def is_available(self):
        """Check if achievement is currently available to earn with error handling"""
        try:
            if not self.is_active:
                return False
            
            if self.is_seasonal:
                now = datetime.utcnow()
                if self.season_start and now < self.season_start:
                    return False
                if self.season_end and now > self.season_end:
                    return False
            
            if self.max_earners and self.current_earners and self.current_earners >= self.max_earners:
                return False
            
            return True
        except Exception as e:
            logger.error(f"Error checking availability for achievement {self.id}: {str(e)}")
            return False
    
    def to_dict(self, hide_secret=True):
        data = {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'icon': self.icon,
            'color': self.color,
            'category': self.category,
            'tier': self.tier,
            'points': self.points,
            'xp_bonus': self.xp_bonus,
            'rarity': self.rarity,
            'is_repeatable': self.is_repeatable,
            'is_seasonal': self.is_seasonal,
            'season_end': self.season_end.isoformat() if self.season_end else None,
            'current_earners': self.current_earners,
            'max_earners': self.max_earners,
        }
        
        # Hide details for secret achievements not yet earned
        if not hide_secret or not self.is_hidden:
            data.update({
                'description': self.description,
                'criteria_type': self.criteria_type,
                'criteria_value': self.criteria_value,
                'share_text': self.share_text
            })
        else:
            data['description'] = '??? Secret Achievement - Unlock to reveal'
            data['is_hidden'] = True
        
        return data

class UserAchievement(db.Model):
    """Track achievements earned by users with progress and metadata"""
    __tablename__ = 'user_achievements'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    achievement_id = db.Column(db.Integer, db.ForeignKey('achievements.id'), nullable=False)
    
    # Progress tracking
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    progress = db.Column(db.Float, default=100.0)  # For progressive achievements
    times_earned = db.Column(db.Integer, default=1)  # For repeatable achievements
    
    # Context and metadata
    context_data = db.Column(db.Text, nullable=True)  # JSON: course_id, module_id, etc.
    earned_during_course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    
    # Social features
    is_showcased = db.Column(db.Boolean, default=False)  # Display on profile
    showcase_order = db.Column(db.Integer, default=0)
    shared_count = db.Column(db.Integer, default=0)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('achievements', lazy='dynamic'))
    achievement = db.relationship('Achievement', backref=db.backref('earned_by_users', lazy='dynamic'))
    course = db.relationship('Course')
    
    __table_args__ = (
        db.Index('idx_user_achievement', 'user_id', 'achievement_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'achievement': self.achievement.to_dict(hide_secret=False) if self.achievement else None,
            'earned_at': self.earned_at.isoformat(),
            'progress': self.progress,
            'times_earned': self.times_earned,
            'context_data': json.loads(self.context_data) if self.context_data else {},
            'is_showcased': self.is_showcased,
            'showcase_order': self.showcase_order,
            'shared_count': self.shared_count,
            'course': {
                'id': self.course.id,
                'title': self.course.title,
                'description': self.course.description
            } if self.course else None
        }

class LearningStreak(db.Model):
    """Track daily learning streaks with detailed history"""
    __tablename__ = 'learning_streaks'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    
    # Current streak
    current_streak = db.Column(db.Integer, default=0)
    last_activity_date = db.Column(db.Date, nullable=True)
    
    # Historical records
    longest_streak = db.Column(db.Integer, default=0)
    longest_streak_start = db.Column(db.Date, nullable=True)
    longest_streak_end = db.Column(db.Date, nullable=True)
    
    # Statistics
    total_active_days = db.Column(db.Integer, default=0)
    total_lessons_completed = db.Column(db.Integer, default=0)
    total_time_minutes = db.Column(db.Integer, default=0)
    
    # Streak milestones achieved
    milestones_reached = db.Column(db.Text, default='[]')  # JSON array of milestones [7, 14, 30, 60, 100]
    
    # Freeze/Protection features
    streak_freezes_available = db.Column(db.Integer, default=3)  # Allow missing days
    last_freeze_used = db.Column(db.Date, nullable=True)
    
    # Metadata
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('streak', uselist=False))
    
    def update_streak(self, lesson_completed=True):
        """Update streak based on activity"""
        today = datetime.utcnow().date()
        
        if self.last_activity_date is None:
            # First activity
            self.current_streak = 1
            self.last_activity_date = today
            self.total_active_days = 1
        elif self.last_activity_date == today:
            # Already counted today
            pass
        elif self.last_activity_date == today - timedelta(days=1):
            # Continue streak
            self.current_streak += 1
            self.last_activity_date = today
            self.total_active_days += 1
        elif self.last_activity_date < today - timedelta(days=1):
            # Check for streak freeze
            days_missed = (today - self.last_activity_date).days - 1
            
            if days_missed == 1 and self.streak_freezes_available > 0:
                # Use a freeze
                self.streak_freezes_available -= 1
                self.last_freeze_used = today
                self.current_streak += 1
                self.last_activity_date = today
                self.total_active_days += 1
            else:
                # Streak broken
                if self.current_streak > self.longest_streak:
                    self.longest_streak = self.current_streak
                    self.longest_streak_end = self.last_activity_date
                    
                self.current_streak = 1
                self.last_activity_date = today
                self.total_active_days += 1
        
        # Check for new milestones
        milestones = json.loads(self.milestones_reached) if self.milestones_reached else []
        streak_milestones = [7, 14, 21, 30, 60, 100, 180, 365]
        
        for milestone in streak_milestones:
            if self.current_streak >= milestone and milestone not in milestones:
                milestones.append(milestone)
        
        self.milestones_reached = json.dumps(sorted(milestones))
        
        if lesson_completed:
            self.total_lessons_completed += 1
        
        # Update longest streak
        if self.current_streak > self.longest_streak:
            self.longest_streak = self.current_streak
            if not self.longest_streak_start:
                self.longest_streak_start = today - timedelta(days=self.current_streak - 1)
        
        return self.current_streak
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'current_streak': self.current_streak,
            'last_activity_date': self.last_activity_date.isoformat() if self.last_activity_date else None,
            'longest_streak': self.longest_streak,
            'longest_streak_start': self.longest_streak_start.isoformat() if self.longest_streak_start else None,
            'longest_streak_end': self.longest_streak_end.isoformat() if self.longest_streak_end else None,
            'total_active_days': self.total_active_days,
            'total_lessons_completed': self.total_lessons_completed,
            'total_time_minutes': self.total_time_minutes,
            'milestones_reached': json.loads(self.milestones_reached) if self.milestones_reached else [],
            'streak_freezes_available': self.streak_freezes_available,
            'last_freeze_used': self.last_freeze_used.isoformat() if self.last_freeze_used else None
        }

class Milestone(db.Model):
    """Dynamic milestones for course and platform progress"""
    __tablename__ = 'milestones'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon = db.Column(db.String(100), default='flag')
    color = db.Column(db.String(20), default='blue')
    
    # Milestone type and scope
    milestone_type = db.Column(db.String(50), nullable=False)  # course, platform, streak, skill, social
    scope = db.Column(db.String(20), default='user')  # user, course, global
    
    # Criteria
    criteria_type = db.Column(db.String(50), nullable=False)
    criteria_value = db.Column(db.Integer, nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)  # For course-specific milestones
    
    # Rewards
    points_reward = db.Column(db.Integer, default=50)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=True)  # Award badge on completion
    unlock_content = db.Column(db.Text, nullable=True)  # JSON: Unlock special content/features
    
    # Display
    celebration_message = db.Column(db.Text, nullable=True)
    is_major = db.Column(db.Boolean, default=False)  # Major milestones get special celebration
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    course = db.relationship('Course')
    badge = db.relationship('Badge')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'description': self.description,
            'icon': self.icon,
            'color': self.color,
            'milestone_type': self.milestone_type,
            'scope': self.scope,
            'criteria_type': self.criteria_type,
            'criteria_value': self.criteria_value,
            'course_id': self.course_id,
            'points_reward': self.points_reward,
            'badge_id': self.badge_id,
            'celebration_message': self.celebration_message,
            'is_major': self.is_major
        }

class UserMilestone(db.Model):
    """Track milestones reached by users"""
    __tablename__ = 'user_milestones'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    milestone_id = db.Column(db.Integer, db.ForeignKey('milestones.id'), nullable=False)
    
    reached_at = db.Column(db.DateTime, default=datetime.utcnow)
    context_data = db.Column(db.Text, nullable=True)  # JSON context
    
    # Relationships
    user = db.relationship('User', backref=db.backref('milestones', lazy='dynamic'))
    milestone = db.relationship('Milestone', backref=db.backref('reached_by_users', lazy='dynamic'))
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'milestone_id', name='_user_milestone_uc'),
        db.Index('idx_user_milestone', 'user_id', 'milestone_id'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'milestone': self.milestone.to_dict() if self.milestone else None,
            'reached_at': self.reached_at.isoformat(),
            'context_data': json.loads(self.context_data) if self.context_data else {}
        }

class Leaderboard(db.Model):
    """Leaderboard configurations for various metrics"""
    __tablename__ = 'leaderboards'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=True)
    
    # Leaderboard configuration
    metric = db.Column(db.String(50), nullable=False)  # total_points, streak_days, courses_completed, etc.
    time_period = db.Column(db.String(20), default='all_time')  # all_time, monthly, weekly, daily
    scope = db.Column(db.String(20), default='global')  # global, course, cohort
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    
    # Display settings
    icon = db.Column(db.String(100), default='trophy')
    color = db.Column(db.String(20), default='gold')
    max_displayed = db.Column(db.Integer, default=100)
    
    # Rewards for top performers
    top_rewards = db.Column(db.Text, nullable=True)  # JSON rewards for top 3, top 10, etc.
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    last_updated = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Relationships
    course = db.relationship('Course')
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'description': self.description,
            'metric': self.metric,
            'time_period': self.time_period,
            'scope': self.scope,
            'course_id': self.course_id,
            'icon': self.icon,
            'color': self.color,
            'max_displayed': self.max_displayed,
            'last_updated': self.last_updated.isoformat()
        }

class StudentPoints(db.Model):
    """Comprehensive points system for gamification"""
    __tablename__ = 'student_points'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False, unique=True)
    
    # Points breakdown
    total_points = db.Column(db.Integer, default=0)
    lesson_points = db.Column(db.Integer, default=0)
    quiz_points = db.Column(db.Integer, default=0)
    assignment_points = db.Column(db.Integer, default=0)
    streak_points = db.Column(db.Integer, default=0)
    achievement_points = db.Column(db.Integer, default=0)
    social_points = db.Column(db.Integer, default=0)
    bonus_points = db.Column(db.Integer, default=0)
    
    # Experience and leveling
    total_xp = db.Column(db.Integer, default=0)
    current_level = db.Column(db.Integer, default=1)
    xp_to_next_level = db.Column(db.Integer, default=100)
    
    # Rankings
    global_rank = db.Column(db.Integer, nullable=True)
    course_ranks = db.Column(db.Text, default='{}')  # JSON: {course_id: rank}
    
    # Statistics
    points_this_week = db.Column(db.Integer, default=0)
    points_this_month = db.Column(db.Integer, default=0)
    week_reset_date = db.Column(db.Date, nullable=True)
    month_reset_date = db.Column(db.Date, nullable=True)
    
    # Multipliers and boosts
    point_multiplier = db.Column(db.Float, default=1.0)
    multiplier_expires_at = db.Column(db.DateTime, nullable=True)
    
    # Metadata
    last_points_earned_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Relationships
    user = db.relationship('User', backref=db.backref('points', uselist=False))
    
    # Add validation
    @validates('total_points', 'lesson_points', 'quiz_points', 'assignment_points', 
               'streak_points', 'achievement_points', 'social_points', 'bonus_points')
    def validate_points(self, key, value):
        if value is not None and value < 0:
            raise ValueError(f"{key} cannot be negative")
        return value
    
    @validates('current_level')
    def validate_level(self, key, level):
        if level is not None and level < 1:
            raise ValueError("Level must be at least 1")
        return level
    
    @validates('point_multiplier')
    def validate_multiplier(self, key, multiplier):
        if multiplier is not None and multiplier < 0:
            raise ValueError("Point multiplier cannot be negative")
        return multiplier
    
    def add_points(self, points, category='bonus', apply_multiplier=True):
        """Add points with optional multiplier and validation"""
        try:
            if points is None or points < 0:
                logger.warning(f"Invalid points value: {points}")
                return 0
                
            # Ensure point_multiplier is not None
            if self.point_multiplier is None:
                self.point_multiplier = 1.0
            
            if apply_multiplier and self.point_multiplier > 1.0:
                if self.multiplier_expires_at and datetime.utcnow() < self.multiplier_expires_at:
                    points = int(points * self.point_multiplier)
                else:
                    self.point_multiplier = 1.0
                    self.multiplier_expires_at = None
            
            # Add to category (ensure fields are not None)
            if category == 'lesson':
                self.lesson_points = (self.lesson_points or 0) + points
            elif category == 'quiz':
                self.quiz_points = (self.quiz_points or 0) + points
            elif category == 'assignment':
                self.assignment_points = (self.assignment_points or 0) + points
            elif category == 'streak':
                self.streak_points = (self.streak_points or 0) + points
            elif category == 'achievement':
                self.achievement_points = (self.achievement_points or 0) + points
            elif category == 'social':
                self.social_points = (self.social_points or 0) + points
            else:
                self.bonus_points = (self.bonus_points or 0) + points
            
            self.total_points = (self.total_points or 0) + points
            self.points_this_week = (self.points_this_week or 0) + points
            self.points_this_month = (self.points_this_month or 0) + points
            self.last_points_earned_at = datetime.utcnow()
            
            # Check for level up
            self._check_level_up()
            
            return points
            
        except Exception as e:
            logger.error(f"Error adding points for user {self.user_id}: {str(e)}")
            return 0
    
    def add_xp(self, xp):
        """Add experience points and check for level up"""
        self.total_xp = (self.total_xp or 0) + xp
        self._check_level_up()
    
    def _check_level_up(self):
        """Check and process level ups"""
        # Ensure fields are not None
        if self.total_xp is None:
            self.total_xp = 0
        if self.xp_to_next_level is None:
            self.xp_to_next_level = 100
        if self.current_level is None:
            self.current_level = 1
            
        while self.total_xp >= self.xp_to_next_level:
            self.current_level += 1
            self.total_xp -= self.xp_to_next_level
            # Calculate next level XP requirement (progressive)
            self.xp_to_next_level = int(100 * (1.15 ** (self.current_level - 1)))
    
    def reset_weekly_points(self):
        """Reset weekly points counter"""
        self.points_this_week = 0
        self.week_reset_date = datetime.utcnow().date()
    
    def reset_monthly_points(self):
        """Reset monthly points counter"""
        self.points_this_month = 0
        self.month_reset_date = datetime.utcnow().date()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'total_points': self.total_points,
            'lesson_points': self.lesson_points,
            'quiz_points': self.quiz_points,
            'assignment_points': self.assignment_points,
            'streak_points': self.streak_points,
            'achievement_points': self.achievement_points,
            'social_points': self.social_points,
            'bonus_points': self.bonus_points,
            'total_xp': self.total_xp,
            'current_level': self.current_level,
            'xp_to_next_level': self.xp_to_next_level,
            'global_rank': self.global_rank,
            'course_ranks': json.loads(self.course_ranks) if self.course_ranks else {},
            'points_this_week': self.points_this_week,
            'points_this_month': self.points_this_month,
            'point_multiplier': self.point_multiplier,
            'multiplier_expires_at': self.multiplier_expires_at.isoformat() if self.multiplier_expires_at else None
        }

class QuestChallenge(db.Model):
    """Time-limited quests and challenges for engagement"""
    __tablename__ = 'quest_challenges'
    
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    title = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    
    # Challenge details
    challenge_type = db.Column(db.String(50), nullable=False)  # daily, weekly, monthly, special_event
    difficulty = db.Column(db.String(20), default='medium')  # easy, medium, hard, expert
    
    # Objectives
    objectives = db.Column(db.Text, nullable=False)  # JSON array of objectives
    progress_tracking = db.Column(db.Text, nullable=False)  # JSON structure for tracking
    
    # Timing
    start_date = db.Column(db.DateTime, nullable=False)
    end_date = db.Column(db.DateTime, nullable=False)
    
    # Rewards
    completion_points = db.Column(db.Integer, default=100)
    completion_xp = db.Column(db.Integer, default=50)
    reward_badges = db.Column(db.Text, nullable=True)  # JSON array of badge IDs
    special_reward = db.Column(db.Text, nullable=True)  # Description of special reward
    
    # Display
    icon = db.Column(db.String(100), default='target')
    banner_image = db.Column(db.String(255), nullable=True)
    color_theme = db.Column(db.String(20), default='purple')
    
    # Participation
    max_participants = db.Column(db.Integer, nullable=True)
    current_participants = db.Column(db.Integer, default=0)
    completion_count = db.Column(db.Integer, default=0)
    
    # Metadata
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def is_available(self):
        """Check if challenge is currently available"""
        now = datetime.utcnow()
        available = (
            self.is_active and
            self.start_date <= now <= self.end_date
        )
        
        if self.max_participants and self.current_participants >= self.max_participants:
            return False
        
        return available
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'title': self.title,
            'description': self.description,
            'challenge_type': self.challenge_type,
            'difficulty': self.difficulty,
            'objectives': json.loads(self.objectives) if self.objectives else [],
            'start_date': self.start_date.isoformat(),
            'end_date': self.end_date.isoformat(),
            'completion_points': self.completion_points,
            'completion_xp': self.completion_xp,
            'special_reward': self.special_reward,
            'icon': self.icon,
            'color_theme': self.color_theme,
            'current_participants': self.current_participants,
            'completion_count': self.completion_count,
            'is_available': self.is_available()
        }

class UserQuestProgress(db.Model):
    """Track user progress on quests and challenges"""
    __tablename__ = 'user_quest_progress'
    
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    quest_id = db.Column(db.Integer, db.ForeignKey('quest_challenges.id'), nullable=False)
    
    # Progress tracking
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    progress_data = db.Column(db.Text, default='{}')  # JSON tracking individual objectives
    completion_percentage = db.Column(db.Float, default=0.0)
    
    # Status
    status = db.Column(db.String(20), default='in_progress')  # in_progress, completed, expired, abandoned
    
    # Relationships
    user = db.relationship('User', backref=db.backref('quest_progress', lazy='dynamic'))
    quest = db.relationship('QuestChallenge', backref=db.backref('user_progress', lazy='dynamic'))
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'quest_id', name='_user_quest_uc'),
        db.Index('idx_user_quest', 'user_id', 'quest_id'),
    )
    
    def update_progress(self, objective_key, value):
        """Update progress on a specific objective"""
        progress = json.loads(self.progress_data) if self.progress_data else {}
        progress[objective_key] = value
        self.progress_data = json.dumps(progress)
        
        # Calculate completion percentage
        quest_objectives = json.loads(self.quest.objectives) if self.quest else []
        if quest_objectives:
            completed_objectives = sum(1 for obj in quest_objectives if progress.get(obj['key'], 0) >= obj['target'])
            self.completion_percentage = (completed_objectives / len(quest_objectives)) * 100
            
            if self.completion_percentage >= 100:
                self.status = 'completed'
                self.completed_at = datetime.utcnow()
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'quest': self.quest.to_dict() if self.quest else None,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'progress_data': json.loads(self.progress_data) if self.progress_data else {},
            'completion_percentage': self.completion_percentage,
            'status': self.status
        }
