# Dashboard Service - Aggregate data for student dashboard
from datetime import datetime, timedelta
from typing import Dict, List
from flask import current_app

from ..models.user_models import db, User
from ..models.course_models import Course, Enrollment, Module, Lesson
from ..models.student_models import (
    ModuleProgress, LessonCompletion, AssessmentAttempt, 
    Certificate, StudentSkillBadge, StudentTranscript
)
from .analytics_service import AnalyticsService
from .progression_service import ProgressionService
from .certificate_service import CertificateService


class DashboardService:
    """Service class for aggregating student dashboard data"""
    
    @staticmethod
    def get_comprehensive_dashboard(student_id: int) -> Dict:
        """
        Get complete dashboard data for student
        
        Args:
            student_id: ID of the student
            
        Returns:
            Dictionary containing all dashboard information
        """
        try:
            student = User.query.get(student_id)
            if not student:
                return {"error": "Student not found"}
            
            dashboard_data = {
                "student_info": {
                    "id": student.id,
                    "name": f"{student.first_name} {student.last_name}",
                    "email": student.email,
                    "profile_picture": getattr(student, 'profile_picture', None),
                    "member_since": student.created_at.isoformat()
                },
                "overview": DashboardService._get_overview_stats(student_id),
                "my_learning": DashboardService._get_my_learning_data(student_id),
                "my_progress": DashboardService._get_progress_summary(student_id),
                "recent_activity": DashboardService._get_recent_activity(student_id),
                "achievements": DashboardService._get_achievements_summary(student_id),
                "upcoming_tasks": DashboardService._get_upcoming_tasks(student_id),
                "performance_insights": DashboardService._get_performance_insights(student_id),
                "learning_recommendations": DashboardService._get_learning_recommendations(student_id)
            }
            
            return dashboard_data
            
        except Exception as e:
            current_app.logger.error(f"Dashboard data error: {str(e)}")
            return {"error": "Failed to load dashboard data"}
    
    @staticmethod
    def get_my_learning_page(student_id: int) -> Dict:
        """
        Get detailed data for My Learning page
        
        Args:
            student_id: ID of the student
            
        Returns:
            My Learning page data
        """
        try:
            enrollments = Enrollment.query.filter_by(student_id=student_id).all()
            
            learning_data = {
                "active_courses": [],
                "completed_courses": [],
                "course_stats": {
                    "total_enrolled": len(enrollments),
                    "in_progress": 0,
                    "completed": 0,
                    "total_time_spent": 0
                },
                "current_focus": None,
                "next_lessons": [],
                "continue_learning": []
            }
            
            for enrollment in enrollments:
                course_data = {
                    "course": enrollment.course.to_dict(),
                    "enrollment": enrollment.to_dict(),
                    "progress": DashboardService._get_course_progress_summary(
                        student_id, enrollment.course_id, enrollment.id
                    ),
                    "next_action": DashboardService._get_next_action(
                        student_id, enrollment.course_id, enrollment.id
                    )
                }
                
                if enrollment.completed_at is not None:
                    learning_data["completed_courses"].append(course_data)
                    learning_data["course_stats"]["completed"] += 1
                else:
                    learning_data["active_courses"].append(course_data)
                    learning_data["course_stats"]["in_progress"] += 1
                    
                    # Add to continue learning if in progress
                    if course_data["progress"]["current_module"]:
                        learning_data["continue_learning"].append({
                            "course": enrollment.course.to_dict(),
                            "current_module": course_data["progress"]["current_module"],
                            "progress_percentage": course_data["progress"]["completion_percentage"],
                            "last_accessed": course_data["progress"]["last_accessed"]
                        })
            
            # Get current focus (most recently accessed course)
            if learning_data["continue_learning"]:
                learning_data["current_focus"] = max(
                    learning_data["continue_learning"],
                    key=lambda x: x["last_accessed"] or "1970-01-01T00:00:00"
                )
            
            # Get upcoming lessons across all courses
            learning_data["next_lessons"] = DashboardService._get_next_lessons(student_id)
            
            return learning_data
            
        except Exception as e:
            current_app.logger.error(f"My Learning data error: {str(e)}")
            return {"error": "Failed to load learning data"}
    
    @staticmethod
    def get_browse_courses_data(student_id: int, filters: Dict = None) -> Dict:
        """
        Get data for Browse Courses page
        
        Args:
            student_id: ID of the student
            filters: Optional filters for course search
            
        Returns:
            Course browsing data
        """
        try:
            from .enrollment_service import EnrollmentService
            
            # Get available courses
            courses = EnrollmentService.browse_courses(student_id, filters)
            
            # Categorize courses
            browse_data = {
                "featured_courses": [],
                "free_courses": [],
                "paid_courses": [],
                "scholarship_courses": [],
                "recommended_courses": [],
                "course_categories": DashboardService._get_course_categories(),
                "enrollment_stats": {
                    "available": 0,
                    "enrolled": 0,
                    "pending_applications": 0
                }
            }
            
            for course in courses:
                if course["enrollment_status"] == "enrolled":
                    browse_data["enrollment_stats"]["enrolled"] += 1
                elif course["enrollment_status"] in ["pending", "pending_payment"]:
                    browse_data["enrollment_stats"]["pending_applications"] += 1
                else:
                    browse_data["enrollment_stats"]["available"] += 1
                
                # Categorize by enrollment type
                if course["enrollment_type"] == "free":
                    browse_data["free_courses"].append(course)
                elif course["enrollment_type"] == "paid":
                    browse_data["paid_courses"].append(course)
                elif course["enrollment_type"] == "scholarship":
                    browse_data["scholarship_courses"].append(course)
                
                # Add to featured if high rating or popular
                if course.get("featured", False):
                    browse_data["featured_courses"].append(course)
            
            # Get personalized recommendations
            browse_data["recommended_courses"] = DashboardService._get_recommended_courses(student_id)
            
            return browse_data
            
        except Exception as e:
            current_app.logger.error(f"Browse courses data error: {str(e)}")
            return {"error": "Failed to load course data"}
    
    @staticmethod
    def get_opportunities_data(student_id: int) -> Dict:
        """
        Get opportunities (scholarships/jobs) data
        
        Args:
            student_id: ID of the student
            
        Returns:
            Opportunities data
        """
        try:
            from ..models.opportunity_models import Opportunity
            
            # Get available opportunities
            opportunities = Opportunity.query.filter_by(is_active=True).all()
            
            opportunities_data = {
                "scholarships": [],
                "jobs": [],
                "internships": [],
                "competitions": [],
                "my_applications": [],
                "recommendations": []
            }
            
            for opp in opportunities:
                opp_dict = opp.to_dict()
                
                # Categorize by type
                if opp.opportunity_type == "scholarship":
                    opportunities_data["scholarships"].append(opp_dict)
                elif opp.opportunity_type == "job":
                    opportunities_data["jobs"].append(opp_dict)
                elif opp.opportunity_type == "internship":
                    opportunities_data["internships"].append(opp_dict)
                elif opp.opportunity_type == "competition":
                    opportunities_data["competitions"].append(opp_dict)
            
            # Get student's applications (would need to implement opportunity applications)
            # opportunities_data["my_applications"] = get_student_opportunity_applications(student_id)
            
            # Get personalized recommendations based on skills/courses
            opportunities_data["recommendations"] = DashboardService._get_opportunity_recommendations(student_id)
            
            return opportunities_data
            
        except Exception as e:
            current_app.logger.error(f"Opportunities data error: {str(e)}")
            return {"error": "Failed to load opportunities data"}
    
    @staticmethod
    def _get_overview_stats(student_id: int) -> Dict:
        """Get overview statistics for dashboard"""
        enrollments = Enrollment.query.filter_by(student_id=student_id).all()
        certificates = Certificate.query.filter_by(student_id=student_id, is_active=True).count()
        badges = StudentSkillBadge.query.filter_by(student_id=student_id).count()
        
        # Calculate total learning time
        total_time = db.session.query(
            db.func.sum(LessonCompletion.time_spent)
        ).filter_by(student_id=student_id).scalar() or 0
        
        # Learning streak
        streak = AnalyticsService._calculate_learning_streak(student_id)
        
        return {
            "total_courses": len(enrollments),
            "completed_courses": len([e for e in enrollments if e.completed_at is not None]),
            "certificates_earned": certificates,
            "badges_earned": badges,
            "total_learning_hours": round(total_time / 3600, 1),  # Convert to hours
            "learning_streak": streak,
            "current_level": DashboardService._calculate_student_level(student_id)
        }
    
    @staticmethod
    def _get_my_learning_data(student_id: int) -> Dict:
        """Get condensed my learning data for dashboard"""
        try:
            active_enrollments = Enrollment.query.filter(
                Enrollment.student_id == student_id,
                Enrollment.completed_at.is_(None)
            ).limit(3).all()
            
            learning_data = {
                "active_courses": [],
                "continue_where_left": None,
                "next_deadline": None
            }
            
            for enrollment in active_enrollments:
                try:
                    course_progress = DashboardService._get_course_progress_summary(
                        student_id, enrollment.course_id, enrollment.id
                    )
                    
                    learning_data["active_courses"].append({
                        "course": enrollment.course.to_dict(),
                        "progress_percentage": course_progress["completion_percentage"],
                        "current_module": course_progress["current_module"],
                        "next_lesson": course_progress["next_lesson"]
                    })
                except Exception as e:
                    current_app.logger.error(f"Error processing enrollment {enrollment.id}: {e}")
                    # Continue processing other enrollments
                    continue
            
            # Find most recent course to continue
            if learning_data["active_courses"]:
                try:
                    # Sort by most recent activity
                    recent_activity = LessonCompletion.query.filter_by(
                        student_id=student_id
                    ).order_by(LessonCompletion.completed_at.desc()).first()
                    
                    if recent_activity:
                        course_id = recent_activity.lesson.module.course.id
                        for course_data in learning_data["active_courses"]:
                            if course_data["course"]["id"] == course_id:
                                learning_data["continue_where_left"] = course_data
                                break
                except Exception as e:
                    current_app.logger.warning(f"Error finding recent activity: {e}")
            
            return learning_data
        except Exception as e:
            current_app.logger.error(f"Error in _get_my_learning_data: {e}")
            return {
                "active_courses": [],
                "continue_where_left": None,
                "next_deadline": None
            }
    
    @staticmethod
    def _get_progress_summary(student_id: int) -> Dict:
        """Get progress summary for dashboard"""
        # Get transcript
        transcript = StudentTranscript.query.filter_by(student_id=student_id).first()
        if not transcript:
            transcript = StudentTranscript(student_id=student_id)
            db.session.add(transcript)
            transcript.update_statistics()
            db.session.commit()
        
        # Get recent performance
        recent_assessments = AssessmentAttempt.query.filter(
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.status == 'graded',
            AssessmentAttempt.graded_at >= datetime.utcnow() - timedelta(days=30)
        ).all()
        
        avg_recent_score = 0
        if recent_assessments:
            avg_recent_score = sum(att.percentage for att in recent_assessments) / len(recent_assessments)
        
        return {
            "overall_gpa": transcript.overall_gpa,
            "total_certificates": transcript.total_certificates,
            "total_badges": transcript.total_badges,
            "learning_hours": transcript.total_learning_hours // 60,  # Convert to hours
            "recent_avg_score": round(avg_recent_score, 1),
            "skill_progress": DashboardService._get_skill_progress_summary(student_id)
        }
    
    @staticmethod
    def _get_recent_activity(student_id: int) -> List[Dict]:
        """Get recent learning activities"""
        activities = []
        
        # Recent lesson completions
        recent_lessons = LessonCompletion.query.filter_by(
            student_id=student_id
        ).order_by(LessonCompletion.completed_at.desc()).limit(5).all()
        
        for lesson in recent_lessons:
            activities.append({
                "type": "lesson_completed",
                "title": lesson.lesson.title,
                "course": lesson.lesson.module.course.title,
                "timestamp": lesson.completed_at.isoformat(),
                "icon": "book-open"
            })
        
        # Recent assessment submissions
        recent_assessments = AssessmentAttempt.query.filter_by(
            student_id=student_id
        ).order_by(AssessmentAttempt.submitted_at.desc()).limit(3).all()
        
        for assessment in recent_assessments:
            if assessment.submitted_at:
                activities.append({
                    "type": "assessment_submitted",
                    "title": f"{assessment.assessment_type.title()} submitted",
                    "course": assessment.module.course.title,
                    "timestamp": assessment.submitted_at.isoformat(),
                    "score": assessment.percentage,
                    "icon": "clipboard-check"
                })
        
        # Sort by timestamp and return latest 5
        activities.sort(key=lambda x: x["timestamp"], reverse=True)
        return activities[:5]
    
    @staticmethod
    def _get_achievements_summary(student_id: int) -> Dict:
        """Get achievements summary"""
        recent_certificates = Certificate.query.filter_by(
            student_id=student_id, is_active=True
        ).order_by(Certificate.issued_at.desc()).limit(3).all()
        
        recent_badges = StudentSkillBadge.query.filter_by(
            student_id=student_id
        ).order_by(StudentSkillBadge.earned_at.desc()).limit(5).all()
        
        return {
            "recent_certificates": [cert.to_dict() for cert in recent_certificates],
            "recent_badges": [badge.to_dict() for badge in recent_badges],
            "achievements_count": {
                "certificates": len(recent_certificates),
                "badges": len(recent_badges)
            }
        }
    
    @staticmethod
    def _get_upcoming_tasks(student_id: int) -> List[Dict]:
        """Get upcoming tasks and deadlines"""
        tasks = []
        
        # Find incomplete assessments
        incomplete_assessments = AssessmentAttempt.query.filter_by(
            student_id=student_id, status='in_progress'
        ).all()
        
        for assessment in incomplete_assessments:
            tasks.append({
                "type": "assessment",
                "title": f"Complete {assessment.assessment_type}",
                "course": assessment.module.course.title,
                "module": assessment.module.title,
                "priority": "high",
                "due_date": None  # Would need to implement deadline tracking
            })
        
        # Find next lessons to complete
        next_lessons = DashboardService._get_next_lessons(student_id, limit=3)
        for lesson in next_lessons:
            tasks.append({
                "type": "lesson",
                "title": f"Complete lesson: {lesson['lesson']['title']}",
                "course": lesson["course"]["title"],
                "module": lesson["module"]["title"],
                "priority": "medium",
                "due_date": None
            })
        
        return tasks[:5]  # Limit to 5 tasks
    
    @staticmethod
    def _get_performance_insights(student_id: int) -> Dict:
        """Get performance insights"""
        # Get recent trend
        recent_scores = AssessmentAttempt.query.filter(
            AssessmentAttempt.student_id == student_id,
            AssessmentAttempt.status == 'graded',
            AssessmentAttempt.graded_at >= datetime.utcnow() - timedelta(days=30)
        ).order_by(AssessmentAttempt.graded_at).all()
        
        trend = "stable"
        if len(recent_scores) >= 2:
            first_half = recent_scores[:len(recent_scores)//2]
            second_half = recent_scores[len(recent_scores)//2:]
            
            first_avg = sum(s.percentage for s in first_half) / len(first_half)
            second_avg = sum(s.percentage for s in second_half) / len(second_half)
            
            if second_avg > first_avg + 5:
                trend = "improving"
            elif second_avg < first_avg - 5:
                trend = "declining"
        
        return {
            "performance_trend": trend,
            "strong_areas": ["Python Programming", "Database Design"],  # Would analyze actual data
            "improvement_areas": ["Web APIs", "Testing"],  # Would analyze actual data
            "study_recommendation": DashboardService._get_study_recommendation(trend)
        }
    
    @staticmethod
    def _get_learning_recommendations(student_id: int) -> List[Dict]:
        """Get personalized learning recommendations"""
        return AnalyticsService._get_learning_recommendations(student_id)
    
    @staticmethod
    def _get_course_progress_summary(student_id: int, course_id: int, enrollment_id: int) -> Dict:
        """Get course progress summary"""
        try:
            course = Course.query.get(course_id)
            if not course:
                return {
                    "completion_percentage": 0,
                    "completed_modules": 0,
                    "total_modules": 0,
                    "current_module": None,
                    "next_lesson": None,
                    "last_accessed": None
                }
            
            modules = course.modules.order_by('order').all()
            
            # Handle courses with no modules
            if not modules:
                return {
                    "completion_percentage": 0,
                    "completed_modules": 0,
                    "total_modules": 0,
                    "current_module": None,
                    "next_lesson": None,
                    "last_accessed": None
                }
            
            completed_modules = 0
            current_module = None
            next_lesson = None
            last_accessed = None
            
            for module in modules:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment_id
                ).first()
                
                if module_progress:
                    if module_progress.status == 'completed':
                        completed_modules += 1
                    elif module_progress.status in ['unlocked', 'in_progress'] and not current_module:
                        current_module = module.title
                        
                        # Find next lesson - only if module has lessons
                        try:
                            completed_lesson_ids = [
                                lc.lesson_id for lc in LessonCompletion.query.filter_by(
                                    student_id=student_id
                                ).all()
                            ]
                            
                            if hasattr(module, 'lessons') and module.lessons:
                                next_lesson_obj = module.lessons.filter(
                                    ~Lesson.id.in_(completed_lesson_ids)
                                ).order_by('order').first()
                                
                                if next_lesson_obj:
                                    next_lesson = next_lesson_obj.title
                        except Exception as e:
                            current_app.logger.warning(f"Error finding next lesson: {e}")
                            next_lesson = None
                    
                    if module_progress.started_at:
                        last_accessed = module_progress.started_at.isoformat()
            
            completion_percentage = (completed_modules / len(modules) * 100) if modules else 0
            
            return {
                "completion_percentage": round(completion_percentage, 1),
                "completed_modules": completed_modules,
                "total_modules": len(modules),
                "current_module": current_module,
                "next_lesson": next_lesson,
                "last_accessed": last_accessed
            }
        except Exception as e:
            current_app.logger.error(f"Error in _get_course_progress_summary: {e}")
            return {
                "completion_percentage": 0,
                "completed_modules": 0,
                "total_modules": 0,
                "current_module": None,
                "next_lesson": None,
                "last_accessed": None
            }
    
    @staticmethod
    def _get_next_action(student_id: int, course_id: int, enrollment_id: int) -> Dict:
        """Get next recommended action for a course"""
        # Find current unlocked module
        course = Course.query.get(course_id)
        current_module = None
        
        for module in course.modules.order_by('order'):
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment_id
            ).first()
            
            if module_progress and module_progress.status in ['unlocked', 'in_progress']:
                current_module = module
                break
        
        if not current_module:
            return {"action": "start_course", "description": "Begin your learning journey"}
        
        # Check what's needed in current module
        completed_lessons = LessonCompletion.query.join(Lesson).filter(
            Lesson.module_id == current_module.id,
            LessonCompletion.student_id == student_id
        ).count()
        
        total_lessons = current_module.lessons.count()
        
        if completed_lessons < total_lessons:
            return {
                "action": "continue_lessons",
                "description": f"Continue with lessons in {current_module.title}",
                "progress": f"{completed_lessons}/{total_lessons} lessons completed"
            }
        else:
            return {
                "action": "take_assessment",
                "description": f"Complete assessments for {current_module.title}",
                "progress": "Ready for assessment"
            }
    
    @staticmethod
    def _get_next_lessons(student_id: int, limit: int = 10) -> List[Dict]:
        """Get next lessons across all enrolled courses"""
        enrollments = Enrollment.query.filter(
            Enrollment.student_id == student_id,
            Enrollment.completed_at.is_(None)
        ).all()
        
        next_lessons = []
        
        for enrollment in enrollments:
            course = enrollment.course
            
            # Find current module
            for module in course.modules.order_by('order'):
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                ).first()
                
                if module_progress and module_progress.status in ['unlocked', 'in_progress']:
                    # Find next lesson in this module
                    completed_lesson_ids = [
                        lc.lesson_id for lc in LessonCompletion.query.filter_by(
                            student_id=student_id
                        ).all()
                    ]
                    
                    next_lesson = module.lessons.filter(
                        ~Lesson.id.in_(completed_lesson_ids)
                    ).order_by('order').first()
                    
                    if next_lesson:
                        next_lessons.append({
                            "lesson": next_lesson.to_dict(),
                            "module": module.to_dict(),
                            "course": course.to_dict()
                        })
                    break
        
        return next_lessons[:limit]
    
    @staticmethod
    def _get_course_categories() -> List[Dict]:
        """Get course categories for browsing"""
        # This would be dynamic based on actual course data
        return [
            {"name": "Programming", "count": 15, "icon": "code"},
            {"name": "Data Science", "count": 8, "icon": "chart-bar"},
            {"name": "Web Development", "count": 12, "icon": "globe"},
            {"name": "Mobile Development", "count": 6, "icon": "mobile"},
            {"name": "Design", "count": 10, "icon": "palette"},
            {"name": "Business", "count": 7, "icon": "briefcase"}
        ]
    
    @staticmethod
    def _get_recommended_courses(student_id: int) -> List[Dict]:
        """Get personalized course recommendations"""
        # This would use ML/recommendation algorithms
        # For now, return popular courses not yet enrolled
        enrolled_course_ids = [
            e.course_id for e in Enrollment.query.filter_by(student_id=student_id).all()
        ]
        
        recommended = Course.query.filter(
            ~Course.id.in_(enrolled_course_ids),
            Course.is_published == True
        ).limit(3).all()
        
        return [course.to_dict() for course in recommended]
    
    @staticmethod
    def _get_opportunity_recommendations(student_id: int) -> List[Dict]:
        """Get opportunity recommendations based on student profile"""
        # This would analyze student skills and completed courses
        return [
            {
                "title": "Junior Developer Internship",
                "type": "internship",
                "company": "Tech Startup Inc.",
                "match_score": 85,
                "reason": "Matches your Python and Web Development skills"
            }
        ]
    
    @staticmethod
    def _calculate_student_level(student_id: int) -> Dict:
        """Calculate student level based on achievements"""
        certificates = Certificate.query.filter_by(student_id=student_id, is_active=True).count()
        badges = StudentSkillBadge.query.filter_by(student_id=student_id).count()
        
        # Simple level calculation
        total_points = (certificates * 100) + (badges * 10)
        
        if total_points < 100:
            level = "Beginner"
            next_level_points = 100
        elif total_points < 500:
            level = "Intermediate"
            next_level_points = 500
        elif total_points < 1000:
            level = "Advanced"
            next_level_points = 1000
        else:
            level = "Expert"
            next_level_points = None
        
        return {
            "current_level": level,
            "current_points": total_points,
            "next_level_points": next_level_points,
            "progress_to_next": ((total_points / next_level_points) * 100) if next_level_points else 100
        }
    
    @staticmethod
    def _get_skill_progress_summary(student_id: int) -> Dict:
        """Get summary of skill development"""
        badges = StudentSkillBadge.query.filter_by(student_id=student_id).all()
        
        skill_categories = {}
        for badge in badges:
            category = badge.badge.category
            if category not in skill_categories:
                skill_categories[category] = 0
            skill_categories[category] += 1
        
        return {
            "categories": skill_categories,
            "total_skills": len(badges),
            "recent_skills": [badge.badge.name for badge in badges[-3:]]  # Last 3 earned
        }
    
    @staticmethod
    def _get_study_recommendation(trend: str) -> str:
        """Get study recommendation based on performance trend"""
        if trend == "improving":
            return "Great progress! Keep up the current study routine."
        elif trend == "declining":
            return "Consider reviewing previous materials and seeking help in forums."
        else:
            return "Maintain consistent study habits and try practice exercises."