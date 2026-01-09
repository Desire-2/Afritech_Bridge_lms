# Achievement Service - Gamification Logic for Afritec Bridge LMS
# Handles achievement unlocking, streak tracking, points, and milestone detection

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json

from ..models.achievement_models import (
    Achievement, UserAchievement, LearningStreak, Milestone, UserMilestone,
    Leaderboard, StudentPoints, QuestChallenge, UserQuestProgress
)
from ..models.student_models import LessonCompletion, UserProgress, Badge, UserBadge
from ..models.course_models import Enrollment, Course, Module
from ..models.user_models import db, User

class AchievementService:
    """Service for managing achievements and gamification"""
    
    @staticmethod
    def check_and_award_achievements(user_id: int, event_type: str, event_data: dict) -> List[UserAchievement]:
        """
        Check if user has unlocked any achievements based on an event
        
        Args:
            user_id: User ID
            event_type: Type of event (lesson_complete, quiz_pass, streak_milestone, etc.)
            event_data: Additional data about the event
        
        Returns:
            List of newly awarded UserAchievement objects
        """
        newly_awarded = []
        
        # Get all active achievements
        achievements = Achievement.query.filter_by(is_active=True).all()
        
        for achievement in achievements:
            # Skip if not available (seasonal, max_earners, etc.)
            if not achievement.is_available():
                continue
            
            # Skip if already earned (and not repeatable)
            if not achievement.is_repeatable:
                existing = UserAchievement.query.filter_by(
                    user_id=user_id, 
                    achievement_id=achievement.id
                ).first()
                if existing:
                    continue
            
            # Check if criteria met
            if AchievementService._check_achievement_criteria(user_id, achievement, event_type, event_data):
                user_achievement = AchievementService._award_achievement(user_id, achievement, event_data)
                if user_achievement:
                    newly_awarded.append(user_achievement)
        
        return newly_awarded
    
    @staticmethod
    def _check_achievement_criteria(user_id: int, achievement: Achievement, event_type: str, event_data: dict) -> bool:
        """Check if user meets achievement criteria"""
        criteria_type = achievement.criteria_type
        criteria_value = achievement.criteria_value
        
        # Lesson completion achievements
        if criteria_type == 'lessons_completed':
            if event_type == 'lesson_complete':
                total_lessons = LessonCompletion.query.filter_by(
                    student_id=user_id, 
                    completed=True
                ).count()
                return total_lessons >= criteria_value
        
        # Streak achievements
        elif criteria_type == 'streak_days':
            streak = LearningStreak.query.filter_by(user_id=user_id).first()
            if streak:
                return streak.current_streak >= criteria_value
        
        # Perfect score achievements
        elif criteria_type == 'perfect_score':
            if event_type == 'quiz_complete' and event_data.get('score', 0) == 100:
                return True
        
        # Speed achievements
        elif criteria_type == 'fast_completion':
            if event_type == 'lesson_complete':
                time_spent = event_data.get('time_spent', 0)
                return 0 < time_spent <= criteria_value
        
        # Course completion achievements
        elif criteria_type == 'courses_completed':
            completed_courses = Enrollment.query.filter_by(
                student_id=user_id
            ).filter(Enrollment.completed_at.isnot(None)).count()
            return completed_courses >= criteria_value
        
        # Module mastery achievements
        elif criteria_type == 'module_perfect_score':
            if event_type == 'module_complete':
                score = event_data.get('cumulative_score', 0)
                return score >= 95.0
        
        # Consistency achievements
        elif criteria_type == 'weekly_active_days':
            if event_type == 'lesson_complete':
                # Check last 7 days
                week_ago = datetime.utcnow().date() - timedelta(days=7)
                unique_days = db.session.query(
                    db.func.date(LessonCompletion.completed_at)
                ).filter(
                    LessonCompletion.student_id == user_id,
                    LessonCompletion.completed_at >= week_ago,
                    LessonCompletion.completed == True
                ).distinct().count()
                return unique_days >= criteria_value
        
        # Early bird achievement
        elif criteria_type == 'early_bird':
            if event_type == 'lesson_complete':
                # Check if completed between 5 AM and 8 AM
                hour = datetime.utcnow().hour
                return 5 <= hour < 8
        
        # Night owl achievement
        elif criteria_type == 'night_owl':
            if event_type == 'lesson_complete':
                # Check if completed between 10 PM and 2 AM
                hour = datetime.utcnow().hour
                return hour >= 22 or hour < 2
        
        # Engagement achievements
        elif criteria_type == 'high_engagement':
            if event_type == 'lesson_complete':
                engagement = event_data.get('engagement_score', 0)
                return engagement >= criteria_value
        
        # Social achievements
        elif criteria_type == 'forum_posts':
            # Would need forum integration
            pass
        
        # Challenge specific
        elif criteria_type == 'custom':
            criteria_data = json.loads(achievement.criteria_data) if achievement.criteria_data else {}
            # Handle custom criteria
            pass
        
        return False
    
    @staticmethod
    def _award_achievement(user_id: int, achievement: Achievement, context_data: dict) -> Optional[UserAchievement]:
        """Award achievement to user"""
        try:
            # Check if repeatable
            if achievement.is_repeatable:
                existing = UserAchievement.query.filter_by(
                    user_id=user_id,
                    achievement_id=achievement.id
                ).first()
                
                if existing:
                    existing.times_earned += 1
                    existing.earned_at = datetime.utcnow()
                    user_achievement = existing
                else:
                    user_achievement = UserAchievement(
                        user_id=user_id,
                        achievement_id=achievement.id,
                        context_data=json.dumps(context_data),
                        earned_during_course_id=context_data.get('course_id')
                    )
                    db.session.add(user_achievement)
            else:
                user_achievement = UserAchievement(
                    user_id=user_id,
                    achievement_id=achievement.id,
                    context_data=json.dumps(context_data),
                    earned_during_course_id=context_data.get('course_id')
                )
                db.session.add(user_achievement)
            
            # Update achievement earner count
            achievement.current_earners += 1
            
            # Award points
            points_service = StudentPoints.query.filter_by(user_id=user_id).first()
            if not points_service:
                points_service = StudentPoints(user_id=user_id)
                db.session.add(points_service)
            
            points_service.add_points(achievement.points, 'achievement')
            if achievement.xp_bonus:
                points_service.add_xp(achievement.xp_bonus)
            
            db.session.commit()
            return user_achievement
            
        except Exception as e:
            db.session.rollback()
            print(f"Error awarding achievement: {e}")
            return None
    
    @staticmethod
    def update_learning_streak(user_id: int) -> Tuple[int, List[int]]:
        """
        Update user's learning streak
        
        Returns:
            Tuple of (current_streak, new_milestones_reached)
        """
        streak = LearningStreak.query.filter_by(user_id=user_id).first()
        
        if not streak:
            streak = LearningStreak(user_id=user_id)
            db.session.add(streak)
        
        # Get old milestones
        old_milestones = json.loads(streak.milestones_reached) if streak.milestones_reached else []
        
        # Update streak
        current_streak = streak.update_streak(lesson_completed=True)
        
        # Get new milestones
        new_milestones = json.loads(streak.milestones_reached) if streak.milestones_reached else []
        newly_reached = [m for m in new_milestones if m not in old_milestones]
        
        # Award streak points
        if newly_reached:
            points_service = StudentPoints.query.filter_by(user_id=user_id).first()
            if points_service:
                for milestone in newly_reached:
                    bonus_points = milestone * 10  # 10 points per day milestone
                    points_service.add_points(bonus_points, 'streak')
        
        db.session.commit()
        return current_streak, newly_reached
    
    @staticmethod
    def check_milestones(user_id: int, milestone_type: str, context: dict) -> List[UserMilestone]:
        """Check and award milestones"""
        newly_reached = []
        
        milestones = Milestone.query.filter_by(
            milestone_type=milestone_type,
            is_active=True
        ).all()
        
        for milestone in milestones:
            # Check if already reached
            existing = UserMilestone.query.filter_by(
                user_id=user_id,
                milestone_id=milestone.id
            ).first()
            
            if existing:
                continue
            
            # Check criteria
            if AchievementService._check_milestone_criteria(user_id, milestone, context):
                user_milestone = UserMilestone(
                    user_id=user_id,
                    milestone_id=milestone.id,
                    context_data=json.dumps(context)
                )
                db.session.add(user_milestone)
                
                # Award points
                points_service = StudentPoints.query.filter_by(user_id=user_id).first()
                if points_service:
                    points_service.add_points(milestone.points_reward, 'bonus')
                
                # Award badge if specified
                if milestone.badge_id:
                    existing_badge = UserBadge.query.filter_by(
                        user_id=user_id,
                        badge_id=milestone.badge_id
                    ).first()
                    
                    if not existing_badge:
                        user_badge = UserBadge(
                            user_id=user_id,
                            badge_id=milestone.badge_id
                        )
                        db.session.add(user_badge)
                
                newly_reached.append(user_milestone)
        
        db.session.commit()
        return newly_reached
    
    @staticmethod
    def _check_milestone_criteria(user_id: int, milestone: Milestone, context: dict) -> bool:
        """Check if milestone criteria is met"""
        criteria_type = milestone.criteria_type
        criteria_value = milestone.criteria_value
        
        if criteria_type == 'total_lessons':
            total = LessonCompletion.query.filter_by(
                student_id=user_id, 
                completed=True
            ).count()
            return total >= criteria_value
        
        elif criteria_type == 'course_progress':
            if milestone.course_id:
                enrollment = Enrollment.query.filter_by(
                    student_id=user_id,
                    course_id=milestone.course_id
                ).first()
                if enrollment:
                    progress_percentage = enrollment.progress * 100
                    return progress_percentage >= criteria_value
            else:
                # For general course progress across all courses
                progress_percentage = context.get('progress_percentage', 0)
                return progress_percentage >= criteria_value
        
        elif criteria_type == 'course_completion':
            if milestone.course_id:
                enrollment = Enrollment.query.filter_by(
                    student_id=user_id,
                    course_id=milestone.course_id
                ).first()
                return enrollment and enrollment.completed_at is not None
        
        elif criteria_type == 'all_courses_in_category':
            # Would need course categories
            pass
        
        elif criteria_type == 'total_points':
            points = StudentPoints.query.filter_by(user_id=user_id).first()
            return points and points.total_points >= criteria_value
        
        elif criteria_type == 'lesson_streak':
            streak = LearningStreak.query.filter_by(user_id=user_id).first()
            return streak and streak.current_streak >= criteria_value
        
        elif criteria_type == 'reach_level':
            points = StudentPoints.query.filter_by(user_id=user_id).first()
            return points and points.current_level >= criteria_value
        
        return False
    
    @staticmethod
    def get_leaderboard(leaderboard_name: str, limit: int = 100) -> Dict:
        """Get leaderboard rankings"""
        leaderboard = Leaderboard.query.filter_by(
            name=leaderboard_name,
            is_active=True
        ).first()
        
        if not leaderboard:
            return {'error': 'Leaderboard not found'}
        
        # Get rankings based on metric
        metric = leaderboard.metric
        time_period = leaderboard.time_period
        
        query = db.session.query(
            User.id,
            User.first_name,
            User.last_name,
            User.username
        ).join(StudentPoints, User.id == StudentPoints.user_id)
        
        if metric == 'total_points':
            query = query.add_columns(StudentPoints.total_points.label('score'))
            query = query.order_by(StudentPoints.total_points.desc())
        elif metric == 'current_level':
            query = query.add_columns(StudentPoints.current_level.label('score'))
            query = query.order_by(StudentPoints.current_level.desc())
        elif metric == 'streak_days':
            query = query.join(LearningStreak, User.id == LearningStreak.user_id)
            query = query.add_columns(LearningStreak.current_streak.label('score'))
            query = query.order_by(LearningStreak.current_streak.desc())
        
        # Apply time period filter
        if time_period == 'weekly':
            query = query.filter(StudentPoints.week_reset_date >= datetime.utcnow().date() - timedelta(days=7))
            query = query.add_columns(StudentPoints.points_this_week.label('period_score'))
            query = query.order_by(StudentPoints.points_this_week.desc())
        elif time_period == 'monthly':
            query = query.filter(StudentPoints.month_reset_date >= datetime.utcnow().date() - timedelta(days=30))
            query = query.add_columns(StudentPoints.points_this_month.label('period_score'))
            query = query.order_by(StudentPoints.points_this_month.desc())
        
        # Apply course filter if specified
        if leaderboard.scope == 'course' and leaderboard.course_id:
            query = query.join(Enrollment, User.id == Enrollment.student_id)
            query = query.filter(Enrollment.course_id == leaderboard.course_id)
        
        # Limit results
        results = query.limit(min(limit, leaderboard.max_displayed)).all()
        
        rankings = []
        for rank, row in enumerate(results, start=1):
            rankings.append({
                'rank': rank,
                'user_id': row.id,
                'name': f"{row.first_name} {row.last_name}",
                'username': row.username,
                'score': row.score if hasattr(row, 'score') else 0,
                'period_score': row.period_score if hasattr(row, 'period_score') else None
            })
        
        return {
            'leaderboard': leaderboard.to_dict(),
            'rankings': rankings,
            'total_participants': len(rankings),
            'updated_at': datetime.utcnow().isoformat()
        }
    
    @staticmethod
    def get_user_achievements_summary(user_id: int) -> Dict:
        """Get comprehensive achievement summary for user"""
        # Get user achievements
        user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
        
        # Get points
        points = StudentPoints.query.filter_by(user_id=user_id).first()
        if not points:
            points = StudentPoints(user_id=user_id)
            db.session.add(points)
            db.session.commit()
        
        # Get streak
        streak = LearningStreak.query.filter_by(user_id=user_id).first()
        if not streak:
            streak = LearningStreak(user_id=user_id)
            db.session.add(streak)
            db.session.commit()
        
        # Get milestones
        milestones = UserMilestone.query.filter_by(user_id=user_id).all()
        
        # Calculate statistics
        total_achievements = len(user_achievements)
        available_achievements = Achievement.query.filter_by(is_active=True).count()
        
        achievements_by_category = {}
        for ua in user_achievements:
            category = ua.achievement.category
            if category not in achievements_by_category:
                achievements_by_category[category] = 0
            achievements_by_category[category] += 1
        
        achievements_by_tier = {}
        for ua in user_achievements:
            tier = ua.achievement.tier
            if tier not in achievements_by_tier:
                achievements_by_tier[tier] = 0
            achievements_by_tier[tier] += 1
        
        # Get showcased achievements
        showcased = UserAchievement.query.filter_by(
            user_id=user_id,
            is_showcased=True
        ).order_by(UserAchievement.showcase_order).limit(5).all()
        
        return {
            'points': points.to_dict(),
            'streak': streak.to_dict(),
            'achievements': {
                'total_earned': total_achievements,
                'total_available': available_achievements,
                'completion_rate': (total_earned / available_achievements * 100) if available_achievements > 0 else 0,
                'by_category': achievements_by_category,
                'by_tier': achievements_by_tier,
                'recent': [ua.to_dict() for ua in user_achievements[-5:]],
                'showcased': [ua.to_dict() for ua in showcased]
            },
            'milestones': {
                'total_reached': len(milestones),
                'recent': [m.to_dict() for m in milestones[-5:]]
            }
        }
    
    @staticmethod
    def get_available_quests(user_id: int) -> List[Dict]:
        """Get available quests for user"""
        # Get active quests
        now = datetime.utcnow()
        available_quests = QuestChallenge.query.filter(
            QuestChallenge.is_active == True,
            QuestChallenge.start_date <= now,
            QuestChallenge.end_date >= now
        ).all()
        
        result = []
        for quest in available_quests:
            if not quest.is_available():
                continue
            
            # Get user progress
            progress = UserQuestProgress.query.filter_by(
                user_id=user_id,
                quest_id=quest.id
            ).first()
            
            quest_data = quest.to_dict()
            if progress:
                quest_data['user_progress'] = progress.to_dict()
            else:
                quest_data['user_progress'] = None
            
            result.append(quest_data)
        
        return result
    
    @staticmethod
    def start_quest(user_id: int, quest_id: int) -> Tuple[bool, str]:
        """Start a quest for user"""
        quest = QuestChallenge.query.get(quest_id)
        
        if not quest:
            return False, "Quest not found"
        
        if not quest.is_available():
            return False, "Quest is not available"
        
        # Check if already started
        existing = UserQuestProgress.query.filter_by(
            user_id=user_id,
            quest_id=quest_id
        ).first()
        
        if existing:
            return False, "Quest already started"
        
        # Start quest
        progress = UserQuestProgress(
            user_id=user_id,
            quest_id=quest_id
        )
        db.session.add(progress)
        
        quest.current_participants += 1
        
        db.session.commit()
        
        return True, "Quest started successfully"
    
    @staticmethod
    def update_quest_progress(user_id: int, quest_id: int, objective_key: str, value: int) -> bool:
        """Update progress on a quest objective"""
        progress = UserQuestProgress.query.filter_by(
            user_id=user_id,
            quest_id=quest_id
        ).first()
        
        if not progress:
            return False
        
        progress.update_progress(objective_key, value)
        
        # Check if quest completed
        if progress.status == 'completed':
            quest = progress.quest
            quest.completion_count += 1
            
            # Award rewards
            points_service = StudentPoints.query.filter_by(user_id=user_id).first()
            if points_service:
                points_service.add_points(quest.completion_points, 'bonus')
                points_service.add_xp(quest.completion_xp)
        
        db.session.commit()
        return True

    @staticmethod
    def add_points(user_id: int, category: str, points: int, context: dict = None) -> int:
        """Add points to user's score"""
        points_service = StudentPoints.query.filter_by(user_id=user_id).first()
        
        if not points_service:
            points_service = StudentPoints(user_id=user_id)
            db.session.add(points_service)
        
        # Apply engagement bonus for high engagement scores
        if context and context.get('engagement_score', 0) >= 90:
            points = int(points * 1.5)  # 50% bonus for high engagement
        
        points_service.add_points(points, category)
        db.session.commit()
        
        return points
    
    @staticmethod
    def get_user_achievements_summary(user_id: int) -> dict:
        """Get comprehensive achievement summary for user"""
        try:
            # Get user achievements
            user_achievements = UserAchievement.query.filter_by(user_id=user_id).all()
            
            # Get available achievements
            all_achievements = Achievement.query.filter_by(is_active=True).all()
            
            # Get user's points
            points = StudentPoints.query.filter_by(user_id=user_id).first()
            
            # Get user's streak
            streak = LearningStreak.query.filter_by(user_id=user_id).first()
            
            # Calculate statistics
            earned_count = len(user_achievements)
            available_count = len(all_achievements)
            
            # Group by category
            by_category = {}
            for achievement in all_achievements:
                category = achievement.category
                if category not in by_category:
                    by_category[category] = {'total': 0, 'earned': 0}
                by_category[category]['total'] += 1
            
            for user_achievement in user_achievements:
                category = user_achievement.achievement.category
                if category in by_category:
                    by_category[category]['earned'] += 1
            
            # Group by tier
            by_tier = {}
            for user_achievement in user_achievements:
                tier = user_achievement.achievement.tier
                if tier not in by_tier:
                    by_tier[tier] = 0
                by_tier[tier] += 1
            
            return {
                'achievements': {
                    'earned': earned_count,
                    'available': available_count,
                    'percentage': (earned_count / max(available_count, 1)) * 100,
                    'by_category': by_category,
                    'by_tier': by_tier
                },
                'points': points.to_dict() if points else None,
                'streak': streak.to_dict() if streak else None,
                'recent_achievements': [ua.to_dict() for ua in user_achievements[-5:]]  # Last 5
            }
            
        except Exception as e:
            print(f"Error getting achievement summary: {e}")
            return {
                'achievements': {'earned': 0, 'available': 0, 'percentage': 0},
                'points': None,
                'streak': None,
                'recent_achievements': []
            }
