from ..utils.time_utils import now_local
# Full Credit Service - Award full credit to students for modules
from datetime import datetime
from typing import Dict, List
from flask import current_app
import logging

from ..models.user_models import db
from ..models.course_models import Module, Lesson, Quiz, Assignment, AssignmentSubmission, Enrollment
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
                "assignments_updated": 0,
                "projects_updated": 0
            }
            
            # 1. Award full credit for all lessons in the module (published only)
            lessons = Lesson.query.filter_by(
                module_id=module_id, is_published=True
            ).all()
            lesson_ids = [lesson.id for lesson in lessons]
            logger.info(f"Found {len(lessons)} published lessons in module {module_id}")
            for lesson in lessons:
                try:
                    FullCreditService._award_lesson_full_credit(student_id, lesson.id, details)
                    logger.debug(f"Awarded lesson credit for lesson {lesson.id}: {lesson.title}")
                except Exception as lesson_error:
                    logger.error(f"Error awarding lesson {lesson.id} credit: {str(lesson_error)}")
                    raise lesson_error
            
            # 2. Award full credit for all quizzes in the module —
            # module-level finals AND lesson-linked quizzes
            from sqlalchemy import or_
            quizzes = Quiz.query.filter(
                or_(
                    Quiz.module_id == module_id,
                    Quiz.lesson_id.in_(lesson_ids) if lesson_ids else False
                ),
                Quiz.is_published == True  # noqa: E712
            ).all()
            logger.info(f"Found {len(quizzes)} published quizzes in module {module_id}")
            for quiz in quizzes:
                try:
                    FullCreditService._award_quiz_full_credit(student_id, quiz.id, details)
                    logger.debug(f"Awarded quiz credit for quiz {quiz.id}: {quiz.title}")
                except Exception as quiz_error:
                    logger.error(f"Error awarding quiz {quiz.id} credit: {str(quiz_error)}")
                    raise quiz_error
            
            # 3. Award full credit for all assignments in the module —
            # module-linked AND lesson-linked
            assignments = Assignment.query.filter(
                or_(
                    Assignment.module_id == module_id,
                    Assignment.lesson_id.in_(lesson_ids) if lesson_ids else False
                ),
                Assignment.is_published == True  # noqa: E712
            ).all()
            logger.info(f"Found {len(assignments)} published assignments in module {module_id}")
            for assignment in assignments:
                try:
                    FullCreditService._award_assignment_full_credit(student_id, assignment.id, instructor_id, details)
                    logger.debug(f"Awarded assignment credit for assignment {assignment.id}: {assignment.title}")
                except Exception as assignment_error:
                    logger.error(f"Error awarding assignment {assignment.id} credit: {str(assignment_error)}")
                    raise assignment_error
            
            # 3b. Award full credit for published projects covering this module
            from ..models.course_models import Project, ProjectSubmission
            for project in Project.query.filter_by(
                course_id=module.course_id, is_published=True
            ).all():
                covered = project.get_modules()
                if covered and module_id not in covered:
                    continue
                try:
                    FullCreditService._award_project_full_credit(
                        student_id, project, instructor_id, details
                    )
                except Exception as project_error:
                    logger.error(f"Error awarding project {project.id} credit: {str(project_error)}")
                    raise project_error
            
            # 4. Update module progress
            try:
                FullCreditService._update_module_progress(student_id, module_id, enrollment_id, details)
                logger.debug(f"Updated module progress for student {student_id}")
            except Exception as progress_error:
                logger.error(f"Error updating module progress: {str(progress_error)}")
                raise progress_error
            
            # 5. Flush changes to ensure they're staged properly
            try:
                db.session.flush()
                logger.debug("All changes flushed to database session")
            except Exception as flush_error:
                logger.error(f"Error flushing session: {flush_error}")
                raise flush_error
            
            # 6. Commit all changes
            db.session.commit()
            logger.info(f"Full credit committed successfully for student {student_id}, module {module_id}")
            
            # 7. Unlock the next module and sync enrollment so a full-credit
            # grant can never strand the learner behind a locked module
            try:
                from .progression_service import ProgressionService
                from .enrollment_progress_service import EnrollmentProgressService
                ProgressionService._unlock_next_module(
                    student_id=student_id,
                    completed_module_id=module_id,
                    enrollment_id=enrollment_id
                )
                enrollment = Enrollment.query.get(enrollment_id)
                if enrollment:
                    EnrollmentProgressService.sync_enrollment(enrollment, commit=True)
                else:
                    db.session.commit()
                logger.info(f"Unlocked next module and synced enrollment {enrollment_id}")
            except Exception as followup_error:
                db.session.rollback()
                logger.error(
                    f"Full credit committed but unlock/sync failed for student "
                    f"{student_id}, module {module_id}: {str(followup_error)}",
                    exc_info=True
                )
            
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
                completion.scroll_progress = 100.0
                completion.video_progress = 100.0
                completion.video_completed = True
                completion.lesson_score = 100.0
                completion.reading_component_score = 100.0
                completion.engagement_component_score = 100.0
                completion.quiz_component_score = 100.0
                completion.assignment_component_score = 100.0
                completion.completed_at = now_local()
                completion.score_last_updated = now_local()
                completion.time_spent = max(completion.time_spent or 0, 3600)  # At least 1 hour
            else:
                # Create new completion
                completion = LessonCompletion(
                    student_id=student_id,
                    lesson_id=lesson_id,
                    completed=True,
                    reading_progress=100.0,
                    engagement_score=100.0,
                    scroll_progress=100.0,
                    video_progress=100.0,
                    video_completed=True,
                    lesson_score=100.0,
                    reading_component_score=100.0,
                    engagement_component_score=100.0,
                    quiz_component_score=100.0,
                    assignment_component_score=100.0,
                    completed_at=now_local(),
                    score_last_updated=datetime.utcnow(),
                    time_spent=3600  # 1 hour
                )
                db.session.add(completion)
            
            details["lessons_updated"] += 1
            logger.debug(f"Successfully updated lesson {lesson_id} completion for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error updating lesson {lesson_id} completion: {e}", exc_info=True)
            # Don't silently continue - this is a critical error
            raise e
    
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
                attempt.end_time = now_local()
            else:
                # Create new attempt with full score
                attempt = QuizAttempt(
                    user_id=student_id,
                    quiz_id=quiz_id,
                    attempt_number=1,
                    score=100.0,
                    score_percentage=100.0,
                    status=QuizAttemptStatus.AUTO_GRADED,
                    start_time=now_local(),
                    end_time=now_local()
                )
                db.session.add(attempt)
            
            details["quizzes_updated"] += 1
            logger.debug(f"Successfully updated quiz {quiz_id} attempt for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error updating quiz {quiz_id} attempt: {e}", exc_info=True)
            # Don't silently continue - this is a critical error
            raise e
    
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
                submission.feedback = f"Full credit awarded by instructor on {now_local().strftime('%Y-%m-%d %H:%M')}"
                submission.graded_at = now_local()
                submission.graded_by = instructor_id
            else:
                # Create new submission with full grade
                submission = AssignmentSubmission(
                    student_id=student_id,
                    assignment_id=assignment_id,
                    content="Full credit awarded by instructor - no submission required",
                    submitted_at=now_local(),
                    grade=max_points,
                    feedback=f"Full credit awarded by instructor on {datetime.utcnow().strftime('%Y-%m-%d %H:%M')}",
                    graded_at=now_local(),
                    graded_by=instructor_id
                )
                db.session.add(submission)
            
            details["assignments_updated"] += 1
            logger.debug(f"Successfully updated assignment {assignment_id} submission for student {student_id}")
            
        except Exception as e:
            logger.error(f"Error updating assignment {assignment_id} submission: {e}", exc_info=True)
            # Don't silently continue - this is a critical error  
            raise e
    
    @staticmethod
    def _award_project_full_credit(student_id: int, project, instructor_id: int, details: Dict):
        """Award full credit for a published project covering the module."""
        from ..models.course_models import ProjectSubmission
        
        submission = ProjectSubmission.query.filter_by(
            student_id=student_id,
            project_id=project.id
        ).first()
        
        max_points = project.points_possible or 100
        feedback = (
            f"Full credit awarded by instructor on "
            f"{now_local().strftime('%Y-%m-%d %H:%M')}"
        )
        
        if submission:
            # Idempotent: only raise the grade, never lower it
            submission.grade = max(submission.grade or 0.0, max_points)
            submission.feedback = feedback
            submission.graded_at = now_local()
            submission.graded_by = instructor_id
        else:
            submission = ProjectSubmission(
                student_id=student_id,
                project_id=project.id,
                text_content="Full credit awarded by instructor - no submission required",
                grade=max_points,
                feedback=feedback,
                graded_at=now_local(),
                graded_by=instructor_id
            )
            db.session.add(submission)
        
        details["projects_updated"] += 1
        logger.debug(
            f"Awarded project credit for project {project.id} to student {student_id}"
        )
    
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
                # Update existing progress — course_contribution_score is on
                # the 0-100 scale (lesson average), not 0-10
                progress.status = 'completed'
                progress.completed_at = now_local()
                progress.cumulative_score = 100.0
                progress.course_contribution_score = 100.0
                progress.quiz_score = 100.0
                progress.assignment_score = 100.0
                progress.project_score = 100.0
                progress.final_assessment_score = 100.0
                progress.prerequisites_met = True
            else:
                # Create new progress record
                progress = ModuleProgress(
                    student_id=student_id,
                    module_id=module_id,
                    enrollment_id=enrollment_id,
                    status='completed',
                    completed_at=now_local(),
                    started_at=now_local(),
                    unlocked_at=now_local(),
                    cumulative_score=100.0,
                    course_contribution_score=100.0,
                    quiz_score=100.0,
                    assignment_score=100.0,
                    project_score=100.0,
                    final_assessment_score=100.0,
                    prerequisites_met=True,
                    attempts_count=1
                )
                db.session.add(progress)
            
            details["module_progress_updated"] = True
            logger.debug(f"Successfully updated module progress for student {student_id}, module {module_id}")
            
        except Exception as e:
            logger.error(f"Error updating module progress: {e}", exc_info=True)
            # Don't silently continue - this is a critical error
            raise e
    
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