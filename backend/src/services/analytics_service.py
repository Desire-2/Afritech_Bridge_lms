# Analytics Service - Learning analytics and performance tracking
from datetime import datetime, timedelta
from typing import Dict, List, Optional
from flask import current_app
import json
from sqlalchemy import func, desc

from ..models.user_models import db, User
from ..models.course_models import (
    Course, Module, Enrollment, Lesson, Quiz, 
    Assignment, AssignmentSubmission
)
from ..models.quiz_progress_models import QuizAttempt
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
    def get_instructor_student_analytics(instructor_id: int, course_id: int = None) -> Dict:
        """
        Get comprehensive student performance analytics for instructor
        
        Args:
            instructor_id: ID of the instructor
            course_id: Optional specific course ID
            
        Returns:
            Dictionary containing student performance analytics
        """
        try:
            # Get instructor's courses
            course_query = Course.query.filter_by(instructor_id=instructor_id)
            if course_id:
                course_query = course_query.filter_by(id=course_id)
            
            courses = course_query.all()
            course_ids = [c.id for c in courses]
            
            if not course_ids:
                return {
                    "overview": {
                        "total_students": 0,
                        "active_students": 0,
                        "total_courses": 0,
                        "activity_rate": 0
                    },
                    "course_analytics": [],
                    "students_performance": [],
                    "struggling_students": [],
                    "top_performers": [],
                    "recommendations": [{
                        "type": "course_creation",
                        "priority": "high",
                        "title": "Create your first course",
                        "description": "You haven't created any courses yet",
                        "actions": ["Create a new course", "Add course content", "Publish your course"]
                    }]
                }
            
            # Get all enrollments for these courses
            enrollments = Enrollment.query.filter(Enrollment.course_id.in_(course_ids)).all()
            student_ids = [e.student_id for e in enrollments]
            
            # Overall analytics
            total_students = len(set(student_ids))
            active_students = AnalyticsService._get_active_students_count(student_ids)
            
            # Performance analytics by course
            course_analytics = []
            for course in courses:
                course_enrollments = [e for e in enrollments if e.course_id == course.id]
                course_student_ids = [e.student_id for e in course_enrollments]
                
                # Module performance breakdown
                modules_performance = []
                try:
                    course_modules = course.modules.order_by('order').all() if hasattr(course, 'modules') else []
                    for module in course_modules:
                        try:
                            module_performance = AnalyticsService._get_module_performance(module.id, course_student_ids)
                            modules_performance.append(module_performance)
                        except Exception as e:
                            current_app.logger.warning(f"Error getting module {module.id} performance: {e}")
                            continue
                except Exception as e:
                    current_app.logger.warning(f"Error accessing modules for course {course.id}: {e}")
                
                # Assignment and quiz performance
                try:
                    assignments_performance = AnalyticsService._get_assignments_performance(course.id, course_student_ids)
                except Exception as e:
                    current_app.logger.warning(f"Error getting assignments performance for course {course.id}: {e}")
                    assignments_performance = {"total_assignments": 0, "performance": []}
                
                try:
                    quizzes_performance = AnalyticsService._get_quizzes_performance(course.id, course_student_ids)
                except Exception as e:
                    current_app.logger.warning(f"Error getting quizzes performance for course {course.id}: {e}")
                    quizzes_performance = {"total_quizzes": 0, "performance": []}
                
                course_analytics.append({
                    "course": course.to_dict(),
                    "total_enrolled": len(course_enrollments),
                    "completion_rate": AnalyticsService._safe_calculate_completion_rate(course.id),
                    "average_progress": AnalyticsService._safe_calculate_average_progress(course.id, course_student_ids),
                    "modules_performance": modules_performance,
                    "assignments_performance": assignments_performance,
                    "quizzes_performance": quizzes_performance,
                    "grade_distribution": AnalyticsService._safe_get_grade_distribution(course.id, course_student_ids)
                })
            
            # Student-wise performance
            students_performance = []
            for student_id in set(student_ids):
                student_data = AnalyticsService._get_student_performance_summary(student_id, course_ids)
                students_performance.append(student_data)
            
            # Struggling students identification
            struggling_students = AnalyticsService._identify_struggling_students(student_ids, course_ids)
            
            # Top performers
            top_performers = AnalyticsService._get_top_performers(student_ids, course_ids)
            
            return {
                "overview": {
                    "total_students": total_students,
                    "active_students": active_students,
                    "total_courses": len(courses),
                    "activity_rate": (active_students / total_students * 100) if total_students > 0 else 0
                },
                "course_analytics": course_analytics,
                "students_performance": students_performance,
                "struggling_students": struggling_students,
                "top_performers": top_performers,
                "recommendations": AnalyticsService._generate_instructor_recommendations(course_analytics, struggling_students)
            }
            
        except Exception as e:
            current_app.logger.error(f"Instructor student analytics error: {str(e)}")
            current_app.logger.error(f"Full traceback: ", exc_info=True)
            return {"error": f"Failed to load instructor student analytics: {str(e)}"}
    
    @staticmethod
    def _get_active_students_count(student_ids: List[int]) -> int:
        """Get count of students who have been active in the last 7 days"""
        week_ago = datetime.utcnow() - timedelta(days=7)
        active_count = LessonCompletion.query.filter(
            LessonCompletion.student_id.in_(student_ids),
            LessonCompletion.completed_at >= week_ago
        ).distinct(LessonCompletion.student_id).count()
        return active_count
    
    @staticmethod
    def _get_module_performance(module_id: int, student_ids: List[int]) -> Dict:
        """Get performance statistics for a module"""
        
        module = Module.query.get(module_id)
        progresses = ModuleProgress.query.filter(
            ModuleProgress.module_id == module_id,
            ModuleProgress.student_id.in_(student_ids)
        ).all()
        
        if not progresses:
            return {
                "module": module.to_dict() if module else {},
                "students_enrolled": 0,
                "completion_rate": 0,
                "average_score": 0,
                "performance_breakdown": {}
            }
        
        # Check for completed status - use different attribute names based on what exists
        completed = 0
        for p in progresses:
            if hasattr(p, 'completed') and p.completed:
                completed += 1
            elif hasattr(p, 'completion_date') and p.completion_date is not None:
                completed += 1
            elif hasattr(p, 'cumulative_score') and p.cumulative_score is not None and p.cumulative_score >= 70:
                completed += 1
        
        scores = [p.cumulative_score for p in progresses if p.cumulative_score is not None]
        avg_score = sum(scores) / len(scores) if scores else 0
        
        # Performance breakdown
        excellent = len([s for s in scores if s >= 90])
        good = len([s for s in scores if 80 <= s < 90])
        average = len([s for s in scores if 70 <= s < 80])
        poor = len([s for s in scores if s < 70])
        
        return {
            "module": module.to_dict() if module else {},
            "students_enrolled": len(progresses),
            "completion_rate": (completed / len(progresses) * 100) if progresses else 0,
            "average_score": round(avg_score, 2),
            "performance_breakdown": {
                "excellent": excellent,
                "good": good,
                "average": average,
                "poor": poor
            }
        }
    
    @staticmethod
    def _get_assignments_performance(course_id: int, student_ids: List[int]) -> Dict:
        """Get assignment performance statistics for a course"""
        
        # Get assignments for this course
        assignments = Assignment.query.join(Module).filter(Module.course_id == course_id).all()
        
        if not assignments:
            return {"total_assignments": 0, "performance": []}
        
        assignment_performance = []
        for assignment in assignments:
            try:
                # Use raw SQL query to avoid issues with missing columns
                from sqlalchemy import text
                query = text("""
                    SELECT id, assignment_id, student_id, grade, submitted_at, feedback, graded_at, graded_by 
                    FROM assignment_submissions 
                    WHERE assignment_id = :assignment_id 
                    AND student_id IN :student_ids 
                    AND grade IS NOT NULL
                """)
                result = db.session.execute(query, {
                    'assignment_id': assignment.id,
                    'student_ids': tuple(student_ids) if student_ids else (0,)
                })
                submissions = result.fetchall()
            except Exception as e:
                current_app.logger.warning(f"Error querying assignment submissions for assignment {assignment.id}: {e}")
                submissions = []
            
            if submissions:
                grades = [float(s.grade) for s in submissions if s.grade is not None]
                avg_grade = sum(grades) / len(grades) if grades else 0
                submission_rate = (len(submissions) / len(student_ids) * 100) if student_ids else 0
                
                assignment_performance.append({
                    "assignment": assignment.to_dict(),
                    "submissions": len(submissions),
                    "submission_rate": round(submission_rate, 2),
                    "average_grade": round(avg_grade, 2),
                    "grade_distribution": AnalyticsService._calculate_grade_distribution(grades)
                })
        
        return {
            "total_assignments": len(assignments),
            "performance": assignment_performance
        }
    
    @staticmethod
    def _get_quizzes_performance(course_id: int, student_ids: List[int]) -> Dict:
        """Get quiz performance statistics for a course"""
        
        # Get quizzes for this course
        quizzes = Quiz.query.join(Module).filter(Module.course_id == course_id).all()
        
        if not quizzes:
            return {"total_quizzes": 0, "performance": []}
        
        quiz_performance = []
        for quiz in quizzes:
            # Use QuizAttempt with correct attribute name
            attempts = QuizAttempt.query.filter(
                QuizAttempt.quiz_id == quiz.id,
                QuizAttempt.user_id.in_(student_ids),  # Use user_id instead of student_id
                QuizAttempt.score.isnot(None)
            ).all()
            
            if attempts:
                scores = [a.score for a in attempts]
                avg_score = sum(scores) / len(scores)
                completion_rate = (len(attempts) / len(student_ids) * 100) if student_ids else 0
                
                quiz_performance.append({
                    "quiz": quiz.to_dict(),
                    "attempts": len(attempts),
                    "completion_rate": round(completion_rate, 2),
                    "average_score": round(avg_score, 2),
                    "score_distribution": AnalyticsService._calculate_score_distribution(scores)
                })
        
        return {
            "total_quizzes": len(quizzes),
            "performance": quiz_performance
        }
    
    @staticmethod
    def _get_student_performance_summary(student_id: int, course_ids: List[int]) -> Dict:
        """Get performance summary for a specific student"""
        
        student = User.query.get(student_id)
        if not student:
            return {}
        
        # Get enrollments for these courses
        enrollments = Enrollment.query.filter(
            Enrollment.student_id == student_id,
            Enrollment.course_id.in_(course_ids)
        ).all()
        
        course_performance = []
        total_score = 0
        course_count = 0
        
        for enrollment in enrollments:
            # Get module progresses for this enrollment
            module_progresses = ModuleProgress.query.filter_by(
                student_id=student_id,
                enrollment_id=enrollment.id
            ).all()
            
            if module_progresses:
                course_scores = [mp.cumulative_score for mp in module_progresses if mp.cumulative_score is not None]
                if course_scores:
                    course_avg = sum(course_scores) / len(course_scores)
                    total_score += course_avg
                    course_count += 1
                    
                    course_performance.append({
                        "course": enrollment.course.to_dict(),
                        "progress": AnalyticsService._safe_get_enrollment_progress(enrollment),
                        "average_score": round(course_avg, 2),
                        "modules_completed": len([mp for mp in module_progresses if AnalyticsService._is_module_completed(mp)]),
                        "total_modules": len(module_progresses)
                    })
        
        overall_average = (total_score / course_count) if course_count > 0 else 0
        
        # Get recent activity
        recent_activity = LessonCompletion.query.filter(
            LessonCompletion.student_id == student_id,
            LessonCompletion.completed_at >= datetime.utcnow() - timedelta(days=7)
        ).count()
        
        return {
            "student": student.to_dict(),
            "overall_average": round(overall_average, 2),
            "courses_enrolled": len(enrollments),
            "recent_activity": recent_activity,
            "course_performance": course_performance,
            "status": AnalyticsService._determine_student_status(overall_average, recent_activity)
        }
    
    @staticmethod
    def _identify_struggling_students(student_ids: List[int], course_ids: List[int]) -> List[Dict]:
        """Identify students who need additional support"""
        struggling = []
        
        for student_id in student_ids:
            student_summary = AnalyticsService._get_student_performance_summary(student_id, course_ids)
            
            # Criteria for struggling students
            if (student_summary.get('overall_average', 0) < 70 or 
                student_summary.get('recent_activity', 0) == 0):
                
                struggling.append({
                    **student_summary,
                    "support_needed": AnalyticsService._get_support_recommendations(student_summary)
                })
        
        return struggling
    
    @staticmethod
    def _get_top_performers(student_ids: List[int], course_ids: List[int]) -> List[Dict]:
        """Get top performing students"""
        all_students = []
        
        for student_id in student_ids:
            student_summary = AnalyticsService._get_student_performance_summary(student_id, course_ids)
            if student_summary.get('overall_average', 0) > 0:
                all_students.append(student_summary)
        
        # Sort by overall average and return top 10
        all_students.sort(key=lambda x: x.get('overall_average', 0), reverse=True)
        return all_students[:10]
    
    @staticmethod
    def _calculate_grade_distribution(grades: List[float]) -> Dict:
        """Calculate distribution of grades"""
        if not grades:
            return {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        
        distribution = {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
        
        for grade in grades:
            if grade >= 90:
                distribution["A"] += 1
            elif grade >= 80:
                distribution["B"] += 1
            elif grade >= 70:
                distribution["C"] += 1
            elif grade >= 60:
                distribution["D"] += 1
            else:
                distribution["F"] += 1
        
        return distribution
    
    @staticmethod
    def _determine_student_status(overall_average: float, recent_activity: int) -> str:
        """Determine student status based on performance and activity"""
        if overall_average >= 85 and recent_activity > 0:
            return "excellent"
        elif overall_average >= 75 and recent_activity > 0:
            return "good"
        elif overall_average >= 60:
            return "average"
        elif recent_activity == 0:
            return "inactive"
        else:
            return "struggling"
    
    @staticmethod
    def _get_support_recommendations(student_summary: Dict) -> List[str]:
        """Generate support recommendations for struggling students"""
        recommendations = []
        
        if student_summary.get('recent_activity', 0) == 0:
            recommendations.append("Re-engage student through personalized outreach")
            recommendations.append("Schedule one-on-one meeting to address concerns")
        
        if student_summary.get('overall_average', 0) < 60:
            recommendations.append("Provide additional tutoring or support materials")
            recommendations.append("Consider allowing assignment resubmissions")
            recommendations.append("Connect with peer mentors or study groups")
        
        return recommendations
    
    @staticmethod
    def _generate_instructor_recommendations(course_analytics: List[Dict], struggling_students: List[Dict]) -> List[Dict]:
        """Generate actionable recommendations for instructors"""
        recommendations = []
        
        # Check for courses with low completion rates
        for course_data in course_analytics:
            if course_data.get('completion_rate', 0) < 70:
                recommendations.append({
                    "type": "course_improvement",
                    "priority": "high",
                    "title": f"Improve completion rate for {course_data['course']['title']}",
                    "description": f"Completion rate is only {course_data['completion_rate']:.1f}%",
                    "actions": [
                        "Review course structure and pacing",
                        "Add more engaging content or activities",
                        "Provide clearer learning objectives"
                    ]
                })
        
        # Check for struggling students
        if len(struggling_students) > 0:
            recommendations.append({
                "type": "student_support",
                "priority": "medium",
                "title": f"{len(struggling_students)} students need additional support",
                "description": "Several students are showing signs of academic difficulty",
                "actions": [
                    "Schedule individual meetings with struggling students",
                    "Provide additional resources or tutoring",
                    "Consider adjusting assessment difficulty"
                ]
            })
        
        return recommendations
    
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
    
    @staticmethod
    def _calculate_course_completion_rate(course_id: int) -> float:
        """Calculate completion rate for a course"""
        total_enrollments = Enrollment.query.filter_by(course_id=course_id).count()
        completed_enrollments = Enrollment.query.filter(
            Enrollment.course_id == course_id,
            Enrollment.completed_at.isnot(None)
        ).count()
        
        return (completed_enrollments / total_enrollments * 100) if total_enrollments > 0 else 0
    
    @staticmethod
    def _calculate_average_progress(course_id: int, student_ids: List[int]) -> float:
        """Calculate average progress for students in a course"""
        enrollments = Enrollment.query.filter(
            Enrollment.course_id == course_id,
            Enrollment.student_id.in_(student_ids)
        ).all()
        
        if not enrollments:
            return 0
        
        total_progress = sum(AnalyticsService._safe_get_enrollment_progress(e) for e in enrollments)
        return total_progress / len(enrollments)
    
    @staticmethod
    def _get_grade_distribution(course_id: int, student_ids: List[int]) -> Dict:
        """Get grade distribution for a course"""
        
        # Get all module progresses for the course
        module_progresses = ModuleProgress.query.join(Module).filter(
            Module.course_id == course_id,
            ModuleProgress.student_id.in_(student_ids),
            ModuleProgress.cumulative_score.isnot(None)
        ).all()
        
        scores = [mp.cumulative_score for mp in module_progresses]
        return AnalyticsService._calculate_grade_distribution(scores)
    
    @staticmethod
    def _calculate_score_distribution(scores: List[float]) -> Dict:
        """Calculate distribution of scores"""
        if not scores:
            return {"90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "0-59": 0}
        
        distribution = {"90-100": 0, "80-89": 0, "70-79": 0, "60-69": 0, "0-59": 0}
        
        for score in scores:
            if score >= 90:
                distribution["90-100"] += 1
            elif score >= 80:
                distribution["80-89"] += 1
            elif score >= 70:
                distribution["70-79"] += 1
            elif score >= 60:
                distribution["60-69"] += 1
            else:
                distribution["0-59"] += 1
        
        return distribution
    
    @staticmethod
    def _safe_calculate_completion_rate(course_id: int) -> float:
        """Safely calculate completion rate for a course"""
        try:
            return AnalyticsService._calculate_course_completion_rate(course_id)
        except Exception as e:
            current_app.logger.warning(f"Error calculating completion rate for course {course_id}: {e}")
            return 0.0
    
    @staticmethod
    def _safe_calculate_average_progress(course_id: int, student_ids: List[int]) -> float:
        """Safely calculate average progress for students in a course"""
        try:
            enrollments = Enrollment.query.filter(
                Enrollment.course_id == course_id,
                Enrollment.student_id.in_(student_ids)
            ).all()
            
            if not enrollments:
                return 0
            
            # Use completion status instead of progress_percentage if it doesn't exist
            total_progress = 0
            for e in enrollments:
                if hasattr(e, 'progress_percentage') and e.progress_percentage is not None:
                    total_progress += e.progress_percentage
                elif hasattr(e, 'completed_at') and e.completed_at is not None:
                    total_progress += 100  # Completed = 100%
                else:
                    total_progress += 0  # Not started or in progress = 0%
            
            return total_progress / len(enrollments)
        except Exception as e:
            current_app.logger.warning(f"Error calculating average progress for course {course_id}: {e}")
            return 0.0
    
    @staticmethod
    def _safe_get_grade_distribution(course_id: int, student_ids: List[int]) -> Dict:
        """Safely get grade distribution for a course"""
        try:
            return AnalyticsService._get_grade_distribution(course_id, student_ids)
        except Exception as e:
            current_app.logger.warning(f"Error getting grade distribution for course {course_id}: {e}")
            return {"A": 0, "B": 0, "C": 0, "D": 0, "F": 0}
    
    @staticmethod
    def _safe_get_enrollment_progress(enrollment) -> float:
        """Safely get enrollment progress"""
        if hasattr(enrollment, 'progress_percentage') and enrollment.progress_percentage is not None:
            return enrollment.progress_percentage
        elif hasattr(enrollment, 'completed_at') and enrollment.completed_at is not None:
            return 100.0
        else:
            return 0.0
    
    @staticmethod
    def _is_module_completed(module_progress) -> bool:
        """Check if a module is completed using available attributes"""
        if hasattr(module_progress, 'completed') and module_progress.completed:
            return True
        elif hasattr(module_progress, 'completion_date') and module_progress.completion_date is not None:
            return True
        elif hasattr(module_progress, 'cumulative_score') and module_progress.cumulative_score is not None and module_progress.cumulative_score >= 70:
            return True
        return False