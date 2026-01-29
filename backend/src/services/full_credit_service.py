# Full Credit Service - Award full credit to students for modules
from datetime import datetime
from typing import Dict, List
from flask import current_app
import logging

from ..models.user_models import db
from ..models.course_models import Module, Lesson, Quiz, Assignment, AssignmentSubmission
from ..models.student_models import LessonCompletion, ModuleProgress
from ..models.quiz_progress_models import QuizAttempt, QuizAttemptStatus

# Set up logger
logger = logging.getLogger(__name__)


class FullCreditService:
    """Service for awarding full credit to students on modules"""
    
    @staticmethod
    def give_module_full_credit(student_id: int, module_id: int, instructor_id: int, enrollment_id: int) -> Dict:
        """
        Award full credit to a student for all components of a module
        
        Args:
            student_id: ID of the student
            module_id: ID of the module
            instructor_id: ID of the instructor (for verification)
            enrollment_id: ID of the enrollment
            
        Returns:
            Dictionary with success status and details
        """
        try:
            logger.info(f"Starting full credit process for student {student_id}, module {module_id}")
            
            module = Module.query.get(module_id)
            if not module:
                logger.warning(f"Module {module_id} not found")
                return {"success": False, "message": "Module not found"}
            
            logger.info(f"Module found: {module.title}")
            
            details = {
                "lessons_updated": 0,
                "quizzes_updated": 0,
                "assignments_updated": 0
            }
            
            # 1. Award full credit for all lessons in the module
            lessons = Lesson.query.filter_by(module_id=module_id).all()
            logger.info(f"Found {len(lessons)} lessons in module {module_id}")
            for lesson in lessons:
                try:
                    FullCreditService._award_lesson_full_credit(student_id, lesson.id, details)
                    logger.debug(f"Awarded lesson credit for lesson {lesson.id}")
                except Exception as lesson_error:
                    logger.error(f"Error awarding lesson {lesson.id} credit: {str(lesson_error)}")
                    raise lesson_error
            
            # 2. Award full credit for all quizzes in the module
            quizzes = Quiz.query.filter_by(module_id=module_id).all()
            logger.info(f"Found {len(quizzes)} quizzes in module {module_id}")
            for quiz in quizzes:
                try:
                    FullCreditService._award_quiz_full_credit(student_id, quiz.id, details)
                    logger.debug(f"Awarded quiz credit for quiz {quiz.id}")
                except Exception as quiz_error:
                    logger.error(f"Error awarding quiz {quiz.id} credit: {str(quiz_error)}")
                    raise quiz_error
            
            # 3. Award full credit for all assignments in the module
            assignments = Assignment.query.filter_by(module_id=module_id).all()
            logger.info(f"Found {len(assignments)} assignments in module {module_id}")
            for assignment in assignments:
                try:
                    FullCreditService._award_assignment_full_credit(student_id, assignment.id, instructor_id, details)
                    logger.debug(f"Awarded assignment credit for assignment {assignment.id}")
                except Exception as assignment_error:
                    logger.error(f"Error awarding assignment {assignment.id} credit: {str(assignment_error)}")
                    raise assignment_error
            
            # 4. Update module progress
            try:
                FullCreditService._update_module_progress(student_id, module_id, enrollment_id, details)
                logger.debug(f"Updated module progress for student {student_id}")
            except Exception as progress_error:
                logger.error(f"Error updating module progress: {str(progress_error)}")
                raise progress_error
            
            # 5. Commit all changes
            db.session.commit()
            logger.info(f"Full credit committed successfully for student {student_id}, module {module_id}")
            
            # Use logger instead of current_app.logger for better reliability
            logger.info(f"Full credit awarded to student {student_id} for module {module_id} by instructor {instructor_id}")
            
            return {
                "success": True,
                "message": f"Full credit awarded for module '{module.title}'",
                "details": details
            }
            
        except Exception as e:
            db.session.rollback()
            logger.error(f"Error awarding full credit: {str(e)}")
            logger.error(f"Full traceback:", exc_info=True)
            return {
                "success": False,
                "message": f"Failed to award full credit: {str(e)}"
            }
    
    @staticmethod
    def _award_lesson_full_credit(student_id: int, lesson_id: int, details: Dict):
        """Award full credit for a lesson"""
        try:
            # Check if lesson completion already exists
            completion = LessonCompletion.query.filter_by(
                student_id=student_id,
                lesson_id=lesson_id
            ).first()
            
            if completion:
                # Update existing completion
                completion.completed = True
                completion.reading_progress = 100.0
                completion.engagement_score = 100.0
                completion.completed_at = datetime.utcnow()
                completion.time_spent = max(completion.time_spent or 0, 3600)  # At least 1 hour
            else:
                # Create new completion
                completion = LessonCompletion(
                    student_id=student_id,
                    lesson_id=lesson_id,
                    completed=True,
                    reading_progress=100.0,
                    engagement_score=100.0,
                    completed_at=datetime.utcnow(),
                    time_spent=3600  # 1 hour
                )
                db.session.add(completion)
            
            details["lessons_updated"] += 1
            
        except Exception as e:
            current_app.logger.warning(f"Error updating lesson {lesson_id} completion: {e}")
    
    @staticmethod
    def _award_quiz_full_credit(student_id: int, quiz_id: int, details: Dict):
        """Award full credit for a quiz"""
        try:
            # Check if quiz attempt already exists
            attempt = QuizAttempt.query.filter_by(
                user_id=student_id,
                quiz_id=quiz_id
            ).first()
            
            if attempt:
                # Update existing attempt with full score
                attempt.score = 100.0
                attempt.score_percentage = 100.0
                attempt.status = QuizAttemptStatus.AUTO_GRADED
                attempt.end_time = datetime.utcnow()
            else:
                # Create new attempt with full score
                attempt = QuizAttempt(
                    user_id=student_id,
                    quiz_id=quiz_id,
                    attempt_number=1,
                    score=100.0,
                    score_percentage=100.0,
                    status=QuizAttemptStatus.AUTO_GRADED,
                    start_time=datetime.utcnow(),
                    end_time=datetime.utcnow()
                )
                db.session.add(attempt)
            
            details["quizzes_updated"] += 1
            
        except Exception as e:
            current_app.logger.warning(f"Error updating quiz {quiz_id} attempt: {e}")
    
    @staticmethod
    def _award_assignment_full_credit(student_id: int, assignment_id: int, instructor_id: int, details: Dict):
        """Award full credit for an assignment"""
        try:
            assignment = Assignment.query.get(assignment_id)
            if not assignment:
                return
                
            # Check if submission already exists
            submission = AssignmentSubmission.query.filter_by(
                student_id=student_id,
                assignment_id=assignment_id
            ).first()
            
            max_points = assignment.points_possible or 100
            
            if submission:
                # Update existing submission with full grade
                submission.grade = max_points
                submission.feedback = f"Full credit awarded by instructor on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}"
                submission.graded_at = datetime.utcnow()
                submission.graded_by = instructor_id
            else:
                # Create new submission with full grade
                submission = AssignmentSubmission(
                    student_id=student_id,
                    assignment_id=assignment_id,
                    content="Full credit awarded by instructor - no submission required",
                    submitted_at=datetime.utcnow(),
                    grade=max_points,
                    feedback=f"Full credit awarded by instructor on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                    graded_at=datetime.utcnow(),
                    graded_by=instructor_id
                )
                db.session.add(submission)
            
            details["assignments_updated"] += 1
            
        except Exception as e:
            current_app.logger.warning(f"Error updating assignment {assignment_id} submission: {e}")
    
    @staticmethod
    def _update_module_progress(student_id: int, module_id: int, enrollment_id: int, details: Dict):
        """Update module progress to reflect full completion"""
        try:
            # Get or create module progress
            progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if progress:
                # Update existing progress
                if hasattr(progress, 'completed'):
                    progress.completed = True
                if hasattr(progress, 'completion_date'):
                    progress.completion_date = datetime.utcnow()
                if hasattr(progress, 'cumulative_score'):
                    progress.cumulative_score = 100.0
                if hasattr(progress, 'course_contribution_score'):
                    progress.course_contribution_score = 10.0  # Full course contribution
                if hasattr(progress, 'quiz_score'):
                    progress.quiz_score = 100.0
                if hasattr(progress, 'assignment_score'):
                    progress.assignment_score = 100.0
            else:
                # Create new progress record
                progress_data = {
                    'student_id': student_id,
                    'module_id': module_id,
                    'enrollment_id': enrollment_id
                }
                
                # Add fields that exist in the current schema
                if hasattr(ModuleProgress, 'completed'):
                    progress_data['completed'] = True
                if hasattr(ModuleProgress, 'completion_date'):
                    progress_data['completion_date'] = datetime.utcnow()
                if hasattr(ModuleProgress, 'cumulative_score'):
                    progress_data['cumulative_score'] = 100.0
                if hasattr(ModuleProgress, 'course_contribution_score'):
                    progress_data['course_contribution_score'] = 10.0
                if hasattr(ModuleProgress, 'quiz_score'):
                    progress_data['quiz_score'] = 100.0
                if hasattr(ModuleProgress, 'assignment_score'):
                    progress_data['assignment_score'] = 100.0
                
                progress = ModuleProgress(**progress_data)
                db.session.add(progress)
            
            details["module_progress_updated"] = True
            
        except Exception as e:
            current_app.logger.warning(f"Error updating module progress: {e}")
    
    @staticmethod
    def get_module_components_summary(module_id: int) -> Dict:
        """Get summary of components in a module"""
        try:
            module = Module.query.get(module_id)
            if not module:
                return {}
            
            lessons = Lesson.query.filter_by(module_id=module_id).all()
            quizzes = Quiz.query.filter_by(module_id=module_id).all()
            assignments = Assignment.query.filter_by(module_id=module_id).all()
            
            return {
                "module_title": module.title,
                "lessons_count": len(lessons),
                "quizzes_count": len(quizzes),
                "assignments_count": len(assignments),
                "total_components": len(lessons) + len(quizzes) + len(assignments)
            }
            
        except Exception as e:
            current_app.logger.error(f"Error getting module summary: {e}")
            return {}