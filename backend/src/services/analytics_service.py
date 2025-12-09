# Analytics Service - Learning analytics and performance tracking
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from flask import current_app
import json
from sqlalchemy import func, desc

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Enrollment, Lesson
from ..models.student_models import (
    LearningAnalytics, ModuleProgress, LessonCompletion, 
    AssessmentAttempt, StudentTranscript
)


class AnalyticsService:
    """Service class for learning analytics and performance tracking"""
    
    @staticmethod
    def get_student_dashboard_analytics(student_id: int) -> Dict:
        """
        Get comprehensive analytics for student dashboard
        
        Args:
            student_id: ID of the student
            
        Returns:
            Dictionary containing dashboard analytics
        """
        try:
            student = User.query.get(student_id)
            if not student:
                return {"error": "Student not found"}
            
            # Get basic enrollment stats
            enrollments = Enrollment.query.filter_by(student_id=student_id).all()
            completed_courses = len([e for e in enrollments if e.completed])
            
            # Calculate learning time this week
            week_start = datetime.utcnow() - timedelta(days=7)
            recent_completions = LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.completed_at >= week_start
            ).all()
            
            weekly_minutes = sum(comp.time_spent for comp in recent_completions) // 60
            
            # Get recent performance trends
            recent_assessments = AssessmentAttempt.query.filter(
                AssessmentAttempt.student_id == student_id,
                AssessmentAttempt.graded_at >= week_start,
                AssessmentAttempt.status == 'graded'
            ).all()
            
            avg_performance = 0
            if recent_assessments:
                avg_performance = sum(att.percentage for att in recent_assessments) / len(recent_assessments)
            
            # Get transcript info
            transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
            if not transcript:
                transcript = StudentTranscript(student_id=student_id)
                db.session.add(transcript)
                db.session.commit()
            
            # Active learning streak
            streak = AnalyticsService._calculate_learning_streak(student_id)
            
            dashboard_data = {
                "student_info": {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}",
                    "email": student.email
                },
                "enrollment_stats": {
                    "total_enrolled": len(enrollments),
                    "completed_courses": completed_courses,
                    "in_progress": len(enrollments) - completed_courses
                },
                "learning_stats": {
                    "weekly_minutes": weekly_minutes,
                    "learning_streak": streak,
                    "avg_performance": round(avg_performance, 1)
                },
                "transcript_summary": transcript.to_dict(),
                "recent_activity": AnalyticsService._get_recent_activity(student_id),
                "upcoming_deadlines": AnalyticsService._get_upcoming_deadlines(student_id),
                "recommendations": AnalyticsService._get_learning_recommendations(student_id)
            }
            
            return dashboard_data
            
        except Exception as e:
            current_app.logger.error(f"Dashboard analytics error: {str(e)}")
            return {"error": "Failed to load dashboard analytics"}
    
    @staticmethod
    def get_course_analytics(student_id: int, course_id: int) -> Dict:
        """
        Get detailed analytics for a specific course
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Dictionary containing course analytics
        """
        try:
            # Get or create learning analytics record
            analytics = LearningAnalytics.query.filter_by(
                student_id=student_id, course_id=course_id
            ).first()
            
            if not analytics:
                analytics = AnalyticsService._create_learning_analytics(student_id, course_id)
            
            # Update analytics if stale
            if analytics.last_calculated < datetime.utcnow() - timedelta(hours=6):
                AnalyticsService._update_learning_analytics(analytics)
            
            # Get module-wise progress
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            module_analytics = []
            if enrollment:
                course = Course.query.get(course_id)
                for module in course.modules.order_by('order'):
                    module_progress = ModuleProgress.query.filter_by(
                        student_id=student_id,
                        module_id=module.id,
                        enrollment_id=enrollment.id
                    ).first()
                    
                    if module_progress:
                        module_data = {
                            "module": module.to_dict(),
                            "progress": module_progress.to_dict(),
                            "performance_breakdown": {
                                "course_contribution": module_progress.course_contribution_score,
                                "quiz_score": module_progress.quiz_score,
                                "assignment_score": module_progress.assignment_score,
                                "final_assessment": module_progress.final_assessment_score,
                                "cumulative": module_progress.cumulative_score
                            },
                            "time_analytics": AnalyticsService._get_module_time_analytics(
                                student_id, module.id
                            )
                        }
                        module_analytics.append(module_data)
            
            return {
                "course_analytics": analytics.to_dict(),
                "module_analytics": module_analytics,
                "performance_trends": AnalyticsService._get_performance_trends(student_id, course_id),
                "learning_patterns": AnalyticsService._get_learning_patterns(student_id, course_id)
            }
            
        except Exception as e:
            current_app.logger.error(f"Course analytics error: {str(e)}")
            return {"error": "Failed to load course analytics"}
    
    @staticmethod
    def get_progress_report(student_id: int, course_id: int = None) -> Dict:
        """
        Generate comprehensive progress report
        
        Args:
            student_id: ID of the student
            course_id: Optional specific course ID
            
        Returns:
            Progress report data
        """
        try:
            report_data = {
                "generated_at": datetime.utcnow().isoformat(),
                "student_id": student_id,
                "overall_progress": {},
                "course_progress": [],
                "skill_development": {},
                "recommendations": []
            }
            
            # Overall progress
            transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
            if transcript:
                report_data["overall_progress"] = transcript.to_dict()
            
            # Course-specific progress
            enrollments_query = Enrollment.query.filter_by(student_id=student_id)
            if course_id:
                enrollments_query = enrollments_query.filter_by(course_id=course_id)
            
            enrollments = enrollments_query.all()
            
            for enrollment in enrollments:
                course_progress = {
                    "course": enrollment.course.to_dict(),
                    "enrollment": enrollment.to_dict(),
                    "modules": []
                }
                
                # Module progress
                module_progresses = ModuleProgress.query.filter_by(
                    student_id=student_id, enrollment_id=enrollment.id
                ).all()
                
                for mp in module_progresses:
                    module_data = mp.to_dict()
                    module_data["module_info"] = mp.module.to_dict()
                    course_progress["modules"].append(module_data)
                
                report_data["course_progress"].append(course_progress)
            
            # Skill development tracking
            report_data["skill_development"] = AnalyticsService._analyze_skill_development(student_id)
            
            # Generate recommendations
            report_data["recommendations"] = AnalyticsService._generate_progress_recommendations(student_id)
            
            return report_data
            
        except Exception as e:
            current_app.logger.error(f"Progress report error: {str(e)}")
            return {"error": "Failed to generate progress report"}
    
    @staticmethod
    def get_weak_areas_analysis(student_id: int, course_id: int) -> Dict:
        """
        Analyze weak areas and provide targeted recommendations
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Weak areas analysis
        """
        try:
            # Get failed assessments and low scores
            low_scores = AssessmentAttempt.query.filter(
                AssessmentAttempt.student_id == student_id,
                AssessmentAttempt.percentage < 70,
                AssessmentAttempt.status == 'graded'
            ).join(Module).filter(Module.course_id == course_id).all()
            
            weak_areas = {}
            for attempt in low_scores:
                module_title = attempt.module.title
                if module_title not in weak_areas:
                    weak_areas[module_title] = {
                        "module_id": attempt.module_id,
                        "attempts": [],
                        "avg_score": 0,
                        "topics": []
                    }
                
                weak_areas[module_title]["attempts"].append({
                    "type": attempt.assessment_type,
                    "score": attempt.percentage,
                    "date": attempt.graded_at.isoformat() if attempt.graded_at else None
                })
            
            # Calculate averages and extract topics
            for area in weak_areas.values():
                if area["attempts"]:
                    area["avg_score"] = sum(att["score"] for att in area["attempts"]) / len(area["attempts"])
                
                # Extract topics from module (simplified)
                module = Module.query.get(area["module_id"])
                if module and module.learning_objectives:
                    area["topics"] = module.learning_objectives.split('\n')[:3]  # First 3 objectives
            
            # Generate recommendations
            recommendations = []
            for module_title, data in weak_areas.items():
                recommendations.append({
                    "module": module_title,
                    "priority": "high" if data["avg_score"] < 50 else "medium",
                    "action": f"Review {module_title} materials and retake assessments",
                    "resources": [
                        f"Re-read lessons in {module_title}",
                        f"Complete practice exercises for {module_title}",
                        "Seek help in course forums"
                    ]
                })
            
            return {
                "weak_areas": weak_areas,
                "recommendations": recommendations,
                "improvement_plan": AnalyticsService._create_improvement_plan(weak_areas)
            }
            
        except Exception as e:
            current_app.logger.error(f"Weak areas analysis error: {str(e)}")
            return {"error": "Failed to analyze weak areas"}
    
    @staticmethod
    def _calculate_learning_streak(student_id: int) -> int:
        """Calculate consecutive days of learning activity"""
        today = datetime.utcnow().date()
        streak = 0
        check_date = today
        
        while True:
            # Check if there was learning activity on this date
            activity = LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                func.date(LessonCompletion.completed_at) == check_date
            ).first()
            
            if activity:
                streak += 1
                check_date -= timedelta(days=1)
            else:
                break
            
            # Limit check to reasonable range
            if streak > 100:
                break
        
        return streak
    
    @staticmethod
    def _get_recent_activity(student_id: int) -> List[Dict]:
        """Get recent learning activities"""
        recent_date = datetime.utcnow() - timedelta(days=7)
        
        activities = []
        
        # Recent lesson completions
        lessons = LessonCompletion.query.filter(
            LessonCompletion.student_id == student_id,
            LessonCompletion.completed_at >= recent_date
        ).order_by(desc(LessonCompletion.completed_at)).limit(5).all()
        
        for lesson in lessons:
            activities.append({
                "type": "lesson_completed",
                "title": lesson.lesson.title,
                "module": lesson.lesson.module.title,
                "date": lesson.completed_at.isoformat()
            })
        
        # Recent assessment submissions
        assessments = AssessmentAttempt.query.filter(
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.submitted_at >= recent_date
        ).order_by(desc(AssessmentAttempt.submitted_at)).limit(5).all()
        
        for assessment in assessments:
            activities.append({
                "type": "assessment_submitted",
                "title": f"{assessment.assessment_type} submitted",
                "module": assessment.module.title,
                "score": assessment.percentage,
                "date": assessment.submitted_at.isoformat()
            })
        
        # Sort by date and return latest 10
        activities.sort(key=lambda x: x["date"], reverse=True)
        return activities[:10]
    
    @staticmethod
    def _get_upcoming_deadlines(student_id: int) -> List[Dict]:
        """Get upcoming assignment/assessment deadlines"""
        # This would be more complex with real deadline tracking
        # For now, return placeholder data
        return [
            {
                "type": "assignment",
                "title": "Module 2 Project",
                "course": "Python Programming",
                "due_date": (datetime.utcnow() + timedelta(days=3)).isoformat(),
                "priority": "high"
            }
        ]
    
    @staticmethod
    def _get_learning_recommendations(student_id: int) -> List[Dict]:
        """Generate personalized learning recommendations"""
        recommendations = []
        
        # Check if student has low engagement
        recent_activity = LessonCompletion.query.filter(
            LessonCompletion.student_id == student_id,
            LessonCompletion.completed_at >= datetime.utcnow() - timedelta(days=3)
        ).count()
        
        if recent_activity == 0:
            recommendations.append({
                "type": "engagement",
                "title": "Continue Your Learning Journey",
                "description": "You haven't completed any lessons in the past 3 days. Keep the momentum going!",
                "action": "Complete at least one lesson today"
            })
        
        # Check for incomplete modules
        incomplete_modules = ModuleProgress.query.filter(
            ModuleProgress.student_id == student_id,
            ModuleProgress.status == 'in_progress'
        ).count()
        
        if incomplete_modules > 2:
            recommendations.append({
                "type": "focus",
                "title": "Focus Your Learning",
                "description": f"You have {incomplete_modules} modules in progress. Consider focusing on one at a time.",
                "action": "Complete one module before starting new ones"
            })
        
        return recommendations
    
    @staticmethod
    def _create_learning_analytics(student_id: int, course_id: int) -> LearningAnalytics:
        """Create new learning analytics record"""
        analytics = LearningAnalytics(
            student_id=student_id,
            course_id=course_id,
            engagement_score=0.0,
            learning_velocity=0.0
        )
        
        db.session.add(analytics)
        AnalyticsService._update_learning_analytics(analytics)
        return analytics
    
    @staticmethod
    def _update_learning_analytics(analytics: LearningAnalytics):
        """Update learning analytics calculations"""
        # Calculate engagement score
        recent_activity = LessonCompletion.query.filter(
            LessonCompletion.student_id == analytics.student_id,
            LessonCompletion.completed_at >= datetime.utcnow() - timedelta(days=30)
        ).count()
        
        analytics.engagement_score = min(100.0, recent_activity * 5)  # 5 points per lesson
        
        # Calculate learning velocity (lessons per week)
        weeks_enrolled = 4  # Simplified - would calculate actual enrollment duration
        total_lessons = LessonCompletion.query.filter_by(
            student_id=analytics.student_id
        ).count()
        
        analytics.learning_velocity = total_lessons / weeks_enrolled if weeks_enrolled > 0 else 0
        
        analytics.last_calculated = datetime.utcnow()
        db.session.commit()
    
    @staticmethod
    def _get_module_time_analytics(student_id: int, module_id: int) -> Dict:
        """Get time analytics for a specific module"""
        completions = LessonCompletion.query.join(Lesson).filter(
            Lesson.module_id == module_id,
            LessonCompletion.student_id == student_id
        ).all()
        
        total_time = sum(comp.time_spent for comp in completions)
        return {
            "total_minutes": total_time // 60,
            "average_per_lesson": (total_time // len(completions)) // 60 if completions else 0,
            "sessions": len(completions)
        }
    
    @staticmethod
    def _get_performance_trends(student_id: int, course_id: int) -> List[Dict]:
        """Get performance trends over time"""
        assessments = AssessmentAttempt.query.join(Module).filter(
            Module.course_id == course_id,
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.status == 'graded'
        ).order_by(AssessmentAttempt.graded_at).all()
        
        trends = []
        for assessment in assessments:
            trends.append({
                "date": assessment.graded_at.isoformat(),
                "score": assessment.percentage,
                "type": assessment.assessment_type,
                "module": assessment.module.title
            })
        
        return trends
    
    @staticmethod
    def _get_learning_patterns(student_id: int, course_id: int) -> Dict:
        """Analyze learning patterns"""
        # Simplified pattern analysis
        return {
            "peak_hours": [14, 15, 16],  # 2-4 PM most active
            "preferred_content": "video",  # Based on completion rates
            "study_frequency": "daily",
            "average_session_length": 45  # minutes
        }
    
    @staticmethod
    def _analyze_skill_development(student_id: int) -> Dict:
        """Analyze skill development progress"""
        # This would integrate with badge system and skill tracking
        return {
            "acquired_skills": ["Python Basics", "Database Design"],
            "in_progress_skills": ["Web Development", "API Design"],
            "recommended_skills": ["Cloud Computing", "DevOps"]
        }
    
    @staticmethod
    def _generate_progress_recommendations(student_id: int) -> List[Dict]:
        """Generate recommendations based on progress analysis"""
        return [
            {
                "type": "improvement",
                "priority": "high",
                "description": "Focus on completing assignments to improve scores",
                "action": "Review assignment rubrics and seek feedback"
            },
            {
                "type": "engagement",
                "priority": "medium", 
                "description": "Participate more in course forums",
                "action": "Answer peer questions and share insights"
            }
        ]
    
    @staticmethod
    def _create_improvement_plan(weak_areas: Dict) -> Dict:
        """Create structured improvement plan"""
        return {
            "duration": "2 weeks",
            "daily_goals": [
                "Complete 2 lessons from weak areas",
                "Practice exercises for 30 minutes",
                "Participate in forum discussions"
            ],
            "weekly_goals": [
                "Retake one failed assessment",
                "Complete all incomplete assignments"
            ],
            "success_metrics": [
                "Achieve 80%+ on retaken assessments",
                "Complete all overdue work"
            ]
        }