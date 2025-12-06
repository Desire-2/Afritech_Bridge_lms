# Enhanced Learning Service - Sophisticated learning path features
"""
This service provides advanced learning features:
- Quiz integration with lesson completion
- Smart next lesson recommendations
- Learning streak tracking
- Motivational achievements
- Adaptive learning suggestions
- Lesson flow visualization
"""

from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from flask import current_app
from sqlalchemy import func, and_

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz
from ..models.student_models import (
    ModuleProgress, LessonCompletion, StudentTranscript, UserBadge, Badge, UserProgress
)
from ..models.quiz_progress_models import (
    QuizAttempt, UserAnswer, Certificate
)


class EnhancedLearningService:
    """Advanced learning features and analytics"""
    
    @staticmethod
    def get_next_lessons_with_quiz_info(student_id: int, course_id: int, limit: int = 5) -> Dict:
        """
        Get next lessons with quiz information and requirements
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            limit: Maximum number of lessons to return
            
        Returns:
            Dictionary containing next lessons with quiz status
        """
        try:
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return {"error": "Not enrolled", "next_lessons": []}
            
            # Get all lessons in course with their completion status
            all_lessons = db.session.query(Lesson).join(
                Module, Lesson.module_id == Module.id
            ).filter(Module.course_id == course_id).order_by(
                Module.order, Lesson.order
            ).all()
            
            next_lessons = []
            found_next = False
            
            for lesson in all_lessons:
                completion = LessonCompletion.query.filter_by(
                    student_id=student_id, lesson_id=lesson.id
                ).first()
                
                # Skip already completed lessons
                if completion:
                    continue
                
                # Get quiz info if attached
                quiz = Quiz.query.filter_by(lesson_id=lesson.id).first()
                quiz_info = None
                quiz_status = "no_quiz"
                
                if quiz:
                    # Check if student has attempted the quiz
                    best_attempt = db.session.query(QuizAttempt).filter_by(
                        user_id=student_id, quiz_id=quiz.id
                    ).order_by(QuizAttempt.score_percentage.desc()).first()
                    
                    if best_attempt:
                        score = best_attempt.score_percentage or 0
                        passing_score = quiz.passing_score_percentage or 70
                        quiz_status = "passed" if score >= passing_score else "failed"
                    else:
                        quiz_status = "not_started"
                    
                    quiz_info = {
                        "id": quiz.id,
                        "title": quiz.title,
                        "passing_score": quiz.passing_score_percentage or 70,
                        "attempts_allowed": quiz.attempts_allowed,
                        "time_limit_minutes": quiz.time_limit_minutes,
                        "status": quiz_status,
                        "best_score": best_attempt.score_percentage if best_attempt else None
                    }
                
                lesson_data = {
                    "id": lesson.id,
                    "title": lesson.title,
                    "duration": lesson.duration or 0,
                    "type": lesson.type or "text",
                    "order": lesson.order,
                    "module_id": lesson.module_id,
                    "module_title": lesson.module.title,
                    "quiz": quiz_info,
                    "quiz_required": quiz is not None,
                    "can_start": not quiz_info or quiz_info["status"] != "failed"
                }
                
                next_lessons.append(lesson_data)
                
                if len(next_lessons) >= limit:
                    break
            
            return {
                "success": True,
                "next_lessons": next_lessons,
                "total_pending": len([l for l in all_lessons if not LessonCompletion.query.filter_by(
                    student_id=student_id, lesson_id=l.id
                ).first()])
            }
            
        except Exception as e:
            current_app.logger.error(f"Error getting next lessons: {str(e)}")
            return {"error": str(e), "next_lessons": []}
    
    @staticmethod
    def get_learning_streak(student_id: int, course_id: Optional[int] = None) -> Dict:
        """
        Calculate learning streak for a student
        
        Args:
            student_id: ID of the student
            course_id: Optional course ID to filter by
            
        Returns:
            Dictionary with streak information
        """
        try:
            query = db.session.query(LessonCompletion).filter(
                LessonCompletion.student_id == student_id
            )
            
            if course_id:
                query = query.join(Lesson).join(Module).filter(
                    Module.course_id == course_id
                )
            
            completions = query.order_by(
                LessonCompletion.completed_at.desc()
            ).all()
            
            if not completions:
                return {
                    "current_streak": 0,
                    "longest_streak": 0,
                    "days_active": 0,
                    "total_completed": 0
                }
            
            # Calculate current streak
            today = datetime.utcnow().date()
            current_streak = 0
            check_date = today
            
            completed_dates = {}
            for completion in completions:
                date = completion.completed_at.date() if completion.completed_at else None
                if date:
                    completed_dates[date] = completed_dates.get(date, 0) + 1
            
            # Check backwards from today
            while check_date in completed_dates:
                current_streak += 1
                check_date -= timedelta(days=1)
            
            # Calculate longest streak (simplified)
            longest_streak = current_streak  # Could be enhanced
            
            return {
                "current_streak": current_streak,
                "longest_streak": longest_streak,
                "days_active": len(completed_dates),
                "total_completed": len(completions),
                "completed_today": 1 if today in completed_dates else 0
            }
            
        except Exception as e:
            current_app.logger.error(f"Error calculating streak: {str(e)}")
            return {
                "current_streak": 0,
                "longest_streak": 0,
                "days_active": 0,
                "total_completed": 0
            }
    
    @staticmethod
    def get_learning_achievements(student_id: int, course_id: Optional[int] = None) -> Dict:
        """
        Get student learning achievements and progress milestones
        
        Args:
            student_id: ID of the student
            course_id: Optional course ID to filter by
            
        Returns:
            Dictionary with achievements
        """
        try:
            achievements = {
                "milestones": [],
                "badges_earned": [],
                "certificates_earned": [],
                "recent_activity": []
            }
            
            # Get badges
            user_badges = db.session.query(UserBadge, Badge).join(
                Badge, UserBadge.badge_id == Badge.id
            ).filter(UserBadge.user_id == student_id)
            
            if course_id:
                user_badges = user_badges.filter(
                    UserBadge.context_course_id == course_id
                )
            
            achievements["badges_earned"] = [
                {
                    "id": ub.Badge.id,
                    "name": ub.Badge.name,
                    "icon": ub.Badge.icon_url,
                    "earned_at": ub.UserBadge.awarded_at.isoformat() if ub.UserBadge.awarded_at else None
                }
                for ub in user_badges.all()
            ]
            
            # Get certificates
            certificates = db.session.query(Certificate).filter(
                Certificate.user_id == student_id
            )
            
            if course_id:
                certificates = certificates.filter(Certificate.course_id == course_id)
            
            achievements["certificates_earned"] = [
                {
                    "id": cert.id,
                    "course_title": cert.course.title if cert.course else "Unknown",
                    "issued_at": cert.issued_at.isoformat() if cert.issued_at else None,
                    "certificate_url": cert.certificate_url
                }
                for cert in certificates.all()
            ]
            
            # Get completion milestones
            total_completed = db.session.query(func.count(LessonCompletion.id)).filter(
                LessonCompletion.student_id == student_id
            ).scalar() or 0
            
            # Define milestone thresholds
            milestone_thresholds = [1, 5, 10, 25, 50, 100]
            for threshold in milestone_thresholds:
                if total_completed >= threshold:
                    achievements["milestones"].append({
                        "type": "lessons_completed",
                        "title": f"{threshold} Lessons Completed",
                        "description": f"You've completed {threshold} lessons!",
                        "achieved": True,
                        "icon": "🎯"
                    })
            
            return achievements
            
        except Exception as e:
            current_app.logger.error(f"Error getting achievements: {str(e)}")
            return {"milestones": [], "badges_earned": [], "certificates_earned": []}
    
    @staticmethod
    def get_adaptive_learning_recommendations(student_id: int, course_id: int) -> Dict:
        """
        Get personalized learning recommendations based on student performance
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Dictionary with recommendations
        """
        try:
            recommendations = {
                "review_needed": [],
                "strong_areas": [],
                "suggested_pace": "normal",
                "focus_areas": []
            }
            
            # Get quiz attempts to analyze performance
            quiz_attempts = db.session.query(QuizAttempt).join(
                Quiz, QuizAttempt.quiz_id == Quiz.id
            ).filter(
                QuizAttempt.user_id == student_id,
                Quiz.course_id == course_id
            ).all()
            
            if quiz_attempts:
                scores = [a.score_percentage or 0 for a in quiz_attempts]
                avg_score = sum(scores) / len(scores) if scores else 0
                
                # Performance analysis
                if avg_score < 60:
                    recommendations["suggested_pace"] = "slow"
                    recommendations["focus_areas"].append({
                        "area": "Fundamentals",
                        "reason": "Your recent quiz scores suggest review of core concepts",
                        "suggested_action": "Revisit earlier lessons and take slower pace"
                    })
                elif avg_score > 85:
                    recommendations["suggested_pace"] = "fast"
                    recommendations["strong_areas"].append({
                        "area": "Advanced Topics",
                        "reason": "Your strong quiz performance shows mastery",
                        "suggested_action": "Consider advanced challenges"
                    })
                
                # Find struggling lessons
                low_score_quizzes = [a for a in quiz_attempts if (a.score_percentage or 0) < 70]
                if low_score_quizzes:
                    for quiz in low_score_quizzes[:3]:  # Top 3 struggles
                        lesson = Lesson.query.filter_by(
                            id=getattr(quiz.quiz, 'lesson_id', None)
                        ).first()
                        
                        if lesson:
                            recommendations["review_needed"].append({
                                "lesson_id": lesson.id,
                                "lesson_title": lesson.title,
                                "reason": f"Quiz score: {quiz.score_percentage}% (Need ≥70%)",
                                "recommended_resources": ["Watch again", "Read transcript", "Try practice questions"]
                            })
            
            return recommendations
            
        except Exception as e:
            current_app.logger.error(f"Error getting recommendations: {str(e)}")
            return {
                "review_needed": [],
                "strong_areas": [],
                "suggested_pace": "normal",
                "focus_areas": []
            }
    
    @staticmethod
    def get_course_learning_analytics(student_id: int, course_id: int) -> Dict:
        """
        Get comprehensive learning analytics for a course
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Dictionary with analytics
        """
        try:
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return {"error": "Not enrolled"}
            
            # Calculate completion percentage
            total_lessons = db.session.query(func.count(Lesson.id)).join(
                Module, Lesson.module_id == Module.id
            ).filter(Module.course_id == course_id).scalar() or 1
            
            completed_lessons = db.session.query(func.count(LessonCompletion.id)).join(
                Lesson, LessonCompletion.lesson_id == Lesson.id
            ).join(
                Module, Lesson.module_id == Module.id
            ).filter(
                LessonCompletion.student_id == student_id,
                Module.course_id == course_id
            ).scalar() or 0
            
            # Get time invested
            total_time = db.session.query(func.sum(LessonCompletion.time_spent)).filter(
                LessonCompletion.student_id == student_id
            ).scalar() or 0
            
            # Quiz performance
            quiz_attempts = db.session.query(QuizAttempt).join(
                Quiz, QuizAttempt.quiz_id == Quiz.id
            ).filter(
                QuizAttempt.user_id == student_id,
                Quiz.course_id == course_id
            ).all()
            
            quiz_scores = [a.score_percentage or 0 for a in quiz_attempts]
            avg_quiz_score = sum(quiz_scores) / len(quiz_scores) if quiz_scores else 0
            
            analytics = {
                "course_id": course_id,
                "completion_percentage": (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0,
                "lessons_completed": completed_lessons,
                "total_lessons": total_lessons,
                "time_invested_minutes": int(total_time / 60),
                "average_quiz_score": round(avg_quiz_score, 2),
                "total_quizzes_attempted": len(quiz_attempts),
                "quizzes_passed": len([s for s in quiz_scores if s >= 70]),
                "learning_streak": EnhancedLearningService.get_learning_streak(student_id, course_id),
                "enrollment_date": enrollment.enrollment_date.isoformat() if enrollment.enrollment_date else None,
                "estimated_completion_date": None
            }
            
            # Estimate completion date
            if completed_lessons < total_lessons and analytics["time_invested_minutes"] > 0:
                avg_time_per_lesson = analytics["time_invested_minutes"] / completed_lessons
                remaining_lessons = total_lessons - completed_lessons
                remaining_minutes = avg_time_per_lesson * remaining_lessons
                estimated_date = datetime.utcnow() + timedelta(minutes=remaining_minutes)
                analytics["estimated_completion_date"] = estimated_date.isoformat()
            
            return analytics
            
        except Exception as e:
            current_app.logger.error(f"Error getting analytics: {str(e)}")
            return {"error": str(e)}
    
    @staticmethod
    def create_celebration_milestone(student_id: int, milestone_type: str, data: Dict) -> Dict:
        """
        Create celebration data for learning milestones
        
        Args:
            student_id: ID of the student
            milestone_type: Type of milestone (lesson_complete, course_complete, quiz_passed, etc.)
            data: Additional data for the milestone
            
        Returns:
            Dictionary with celebration information
        """
        celebration_messages = {
            "lesson_complete": {
                "title": "🎉 Lesson Completed!",
                "messages": [
                    "Fantastic work! You're making great progress!",
                    "Keep it up! You're on fire! 🔥",
                    "Excellent! One step closer to mastery!",
                    "Outstanding! Your dedication is showing!"
                ],
                "emoji": "🎯"
            },
            "quiz_passed": {
                "title": "✅ Quiz Passed!",
                "messages": [
                    "You crushed that quiz! 💪",
                    "Perfect score mindset! 🏆",
                    "You really know your stuff!",
                    "Exceptional performance!"
                ],
                "emoji": "🏆"
            },
            "course_complete": {
                "title": "🎓 Course Completed!",
                "messages": [
                    "Congratulations! You've mastered this course! 🌟",
                    "What an incredible journey! Certificate incoming! 📜",
                    "You did it! Time to celebrate! 🎊",
                    "Outstanding achievement! You're a superstar! ⭐"
                ],
                "emoji": "🎓"
            },
            "streak_milestone": {
                "title": "🔥 Learning Streak!",
                "messages": [
                    f"Amazing! You have a {data.get('streak_days', 0)}-day streak! 🔥",
                    "Consistency is key! Keep going!",
                    "Your dedication is inspiring!",
                    "This streak shows real commitment!"
                ],
                "emoji": "🔥"
            }
        }
        
        milestone_data = celebration_messages.get(milestone_type, {})
        
        import random
        message = random.choice(milestone_data.get("messages", ["Great job!"])) if milestone_data else "Great job!"
        
        return {
            "type": milestone_type,
            "title": milestone_data.get("title", "Achievement Unlocked!"),
            "message": message,
            "emoji": milestone_data.get("emoji", "⭐"),
            "show_animation": True,
            "animation_type": "confetti",
            "duration_ms": 3000
        }
    
    @staticmethod
    def auto_redirect_to_quiz_if_required(lesson_id: int, student_id: int) -> Optional[Dict]:
        """
        Check if lesson has a required quiz and return quiz redirect info
        
        Args:
            lesson_id: ID of the lesson
            student_id: ID of the student
            
        Returns:
            Dictionary with quiz info if redirect needed, None otherwise
        """
        try:
            quiz = Quiz.query.filter_by(lesson_id=lesson_id).first()
            
            if not quiz:
                return None
            
            # Check if student has already passed this quiz
            best_attempt = db.session.query(QuizAttempt).filter_by(
                user_id=student_id, quiz_id=quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            if best_attempt and best_attempt.score_percentage and \
               best_attempt.score_percentage >= (quiz.passing_score_percentage or 70):
                # Already passed
                return None
            
            # Redirect to quiz
            return {
                "should_redirect": True,
                "quiz_id": quiz.id,
                "quiz_title": quiz.title,
                "passing_score": quiz.passing_score_percentage or 70,
                "current_score": best_attempt.score_percentage if best_attempt else None,
                "attempts_remaining": (quiz.attempts_allowed or 999) - (
                    db.session.query(func.count(QuizAttempt.id)).filter(
                        QuizAttempt.user_id == student_id,
                        QuizAttempt.quiz_id == quiz.id
                    ).scalar() or 0
                ),
                "redirect_message": f"To complete this lesson, you need to pass the quiz '{quiz.title}' (score ≥ {quiz.passing_score_percentage or 70}%)"
            }
            
        except Exception as e:
            current_app.logger.error(f"Error checking quiz redirect: {str(e)}")
            return None
