from ..utils.time_utils import now_local
# Lesson Completion Service - Handle lesson completion requirements and validation
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from flask import current_app

from ..models.user_models import db
from ..models.course_models import Course, Module, Lesson, Quiz, Assignment, AssignmentSubmission
from ..models.student_models import LessonCompletion
from ..models.quiz_progress_models import QuizAttempt


class LessonCompletionService:
    """Service for handling lesson completion requirements and validation"""
    
    # Default passing scores
    DEFAULT_QUIZ_PASSING_SCORE = 70.0
    DEFAULT_ASSIGNMENT_PASSING_SCORE = 60.0
    DEFAULT_LESSON_PASSING_SCORE = 80.0  # Overall lesson score requirement
    
    @staticmethod
    def check_lesson_completion_requirements(student_id: int, lesson_id: int) -> Tuple[bool, str, Dict]:
        """
        Check if a student can complete a lesson based on all requirements
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            Tuple of (can_complete, reason, requirements_data)
        """
        try:
            lesson = Lesson.query.get(lesson_id)
            if not lesson:
                return False, "Lesson not found", {}
            
            # Get lesson assessments (only published ones count as requirements)
            lesson_quiz = Quiz.query.filter_by(lesson_id=lesson_id, is_published=True).first()
            lesson_assignment = Assignment.query.filter_by(lesson_id=lesson_id, is_published=True).first()
            
            requirements = {
                'reading_requirements_met': False,
                'quiz_requirements_met': True,  # Default to True if no quiz
                'assignment_requirements_met': True,  # Default to True if no assignment
                'overall_score_met': False,
                'has_quiz': lesson_quiz is not None,
                'has_assignment': lesson_assignment is not None,
                'quiz_data': None,
                'assignment_data': None,
                'missing_requirements': [],
                'lesson_score': 0.0
            }
            
            # Check quiz requirements
            if lesson_quiz:
                quiz_passed, quiz_score, quiz_msg = LessonCompletionService._check_quiz_requirements(
                    student_id, lesson_quiz
                )
                requirements['quiz_requirements_met'] = quiz_passed
                requirements['quiz_data'] = {
                    'quiz_id': lesson_quiz.id,
                    'title': lesson_quiz.title,
                    'current_score': quiz_score,
                    'passing_score': lesson_quiz.passing_score or LessonCompletionService.DEFAULT_QUIZ_PASSING_SCORE,
                    'passed': quiz_passed,
                    'message': quiz_msg
                }
                if not quiz_passed:
                    requirements['missing_requirements'].append(quiz_msg)
            
            # Check assignment requirements
            if lesson_assignment:
                assignment_passed, assignment_score, assignment_msg = LessonCompletionService._check_assignment_requirements(
                    student_id, lesson_assignment
                )
                requirements['assignment_requirements_met'] = assignment_passed
                requirements['assignment_data'] = {
                    'assignment_id': lesson_assignment.id,
                    'title': lesson_assignment.title,
                    'current_score': assignment_score,
                    'passing_score': LessonCompletionService.DEFAULT_ASSIGNMENT_PASSING_SCORE,
                    'passed': assignment_passed,
                    'message': assignment_msg
                }
                if not assignment_passed:
                    requirements['missing_requirements'].append(assignment_msg)
            
            # Calculate current lesson score to check reading requirements
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if lesson_completion:
                lesson_score = lesson_completion.calculate_lesson_score()
                requirements['lesson_score'] = lesson_score
                
                # Check reading requirements (basic engagement)
                reading_progress = lesson_completion.reading_progress or 0
                engagement_score = lesson_completion.engagement_score or 0
                
                # Reading requirements: At least 90% reading progress and 60% engagement
                # OR if lesson score is >= 80%, consider reading requirements met
                reading_met = (reading_progress >= 90.0 and engagement_score >= 60.0) or lesson_score >= 80.0
                requirements['reading_requirements_met'] = reading_met
                
                if not reading_met:
                    requirements['missing_requirements'].append(
                        f"Complete reading (need 90% reading progress and 60% engagement, currently {reading_progress:.1f}% reading and {engagement_score:.1f}% engagement, or score {lesson_score:.1f}% >= 80%)"
                    )
                
                # Overall score requirement
                score_met = lesson_score >= LessonCompletionService.DEFAULT_LESSON_PASSING_SCORE
                requirements['overall_score_met'] = score_met
                
                if not score_met:
                    requirements['missing_requirements'].append(
                        f"Achieve overall lesson score of 80% (currently {lesson_score:.1f}%)"
                    )
            else:
                requirements['missing_requirements'].append("Start reading the lesson content")
            
            # Determine if lesson can be completed
            can_complete = (
                requirements['reading_requirements_met'] and 
                requirements['quiz_requirements_met'] and 
                requirements['assignment_requirements_met'] and
                requirements['overall_score_met']
            )
            
            if can_complete:
                return True, "All requirements met", requirements
            else:
                missing_count = len(requirements['missing_requirements'])
                reason = f"{missing_count} requirement{'s' if missing_count != 1 else ''} not met: {'; '.join(requirements['missing_requirements'])}"
                return False, reason, requirements
                
        except Exception as e:
            current_app.logger.error(f"Error checking lesson completion requirements: {str(e)}")
            return False, "Error checking requirements", {}
    
    @staticmethod
    def _check_quiz_requirements(student_id: int, quiz: Quiz) -> Tuple[bool, float, str]:
        """Check if student has met quiz requirements"""
        try:
            # Get best quiz attempt
            best_attempt = QuizAttempt.query.filter_by(
                user_id=student_id,
                quiz_id=quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            if not best_attempt:
                return False, 0.0, f"Complete the quiz '{quiz.title}'"
            
            score = best_attempt.score_percentage or 0.0
            passing_score = quiz.passing_score or LessonCompletionService.DEFAULT_QUIZ_PASSING_SCORE
            
            if score >= passing_score:
                return True, score, f"Quiz passed with {score:.1f}%"
            else:
                return False, score, f"Pass the quiz '{quiz.title}' with {passing_score}% (current: {score:.1f}%)"
                
        except Exception as e:
            current_app.logger.error(f"Error checking quiz requirements: {str(e)}")
            return False, 0.0, f"Error checking quiz '{quiz.title}'"
    
    @staticmethod
    def _check_assignment_requirements(student_id: int, assignment: Assignment) -> Tuple[bool, float, str]:
        """Check if student has met assignment requirements"""
        try:
            # Get assignment submission
            submission = AssignmentSubmission.query.filter_by(
                student_id=student_id,
                assignment_id=assignment.id
            ).first()
            
            if not submission:
                return False, 0.0, f"Submit the assignment '{assignment.title}'"
            
            if submission.grade is None:
                return False, 0.0, f"Wait for assignment '{assignment.title}' to be graded"
            
            # Convert grade to percentage if needed
            points_possible = assignment.points_possible or 100
            score_percentage = (submission.grade / points_possible) * 100 if points_possible > 0 else 0.0
            
            if score_percentage >= LessonCompletionService.DEFAULT_ASSIGNMENT_PASSING_SCORE:
                return True, score_percentage, f"Assignment passed with {score_percentage:.1f}%"
            else:
                return False, score_percentage, f"Improve assignment '{assignment.title}' score to 60%+ (current: {score_percentage:.1f}%)"
                
        except Exception as e:
            current_app.logger.error(f"Error checking assignment requirements: {str(e)}")
            return False, 0.0, f"Error checking assignment '{assignment.title}'"
    
    @staticmethod
    def attempt_lesson_completion(student_id: int, lesson_id: int, force_complete: bool = False) -> Tuple[bool, str, Dict]:
        """
        Attempt to complete a lesson with all requirements checked
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            force_complete: Force completion even if requirements not met (admin use)
            
        Returns:
            Tuple of (success, message, completion_data)
        """
        try:
            # Check requirements first
            can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
                student_id, lesson_id
            )
            
            if not can_complete and not force_complete:
                return False, reason, requirements
            
            # Get or create lesson completion
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                lesson_completion = LessonCompletion(
                    student_id=student_id,
                    lesson_id=lesson_id,
                    completed=False,
                    reading_progress=0.0,
                    engagement_score=0.0,
                    scroll_progress=0.0,
                    time_spent=0
                )
                db.session.add(lesson_completion)
            
            # Mark as completed and update timestamp
            lesson_completion.completed = True
            lesson_completion.completed_at = now_local()
            lesson_completion.updated_at = now_local()
            
            # Ensure minimum scores if forced completion
            if force_complete and lesson_completion.reading_progress < 90.0:
                lesson_completion.reading_progress = 100.0
            if force_complete and lesson_completion.engagement_score < 60.0:
                lesson_completion.engagement_score = 80.0
            
            db.session.commit()
            
            # Recalculate lesson score
            final_score = lesson_completion.calculate_lesson_score()
            
            current_app.logger.info(f"Lesson {lesson_id} completed for student {student_id} with score {final_score:.1f}%")
            
            return True, f"Lesson completed successfully with score {final_score:.1f}%", {
                'lesson_id': lesson_id,
                'completion': lesson_completion.to_dict(),
                'final_score': final_score,
                'requirements': requirements
            }
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error completing lesson: {str(e)}")
            return False, f"Error completing lesson: {str(e)}", {}
    
    @staticmethod
    def _propagate_score_changes(student_id: int, lesson_id: int, lesson_completion: Optional[LessonCompletion] = None) -> None:
        """
        Push recalculated lesson scores up the stack:
        lesson -> module score -> enrollment progress.
        
        Called whenever an assessment is published, regraded, removed or a
        reading update changes the lesson score.
        """
        from ..services.progression_service import ProgressionService
        from ..services.enrollment_progress_service import EnrollmentProgressService
        from ..models.course_models import Enrollment
        
        if lesson_completion is None:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
        if not lesson_completion:
            return
        
        lesson = lesson_completion.lesson
        if not lesson or not lesson.module:
            return
        
        course_id = lesson.module.course_id
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=course_id
        ).first()
        
        if enrollment and lesson.module_id:
            ProgressionService._update_course_contribution_score(
                student_id, lesson.module_id, enrollment.id, commit=False
            )
        
        # Re-derive enrollment progress/completion from published content
        EnrollmentProgressService.sync_student_course(student_id, course_id, commit=True)
    
    @staticmethod
    def store_and_propagate_lesson_scores(student_id: int, lesson_id: int, auto_complete: bool = True, propagate: bool = True) -> Optional[Dict]:
        """
        Recompute and persist stored component scores for a lesson, optionally
        auto-complete the lesson when requirements become satisfied, then
        propagate the new score to module and enrollment progress.
        
        Args:
            auto_complete: mark the lesson completed when requirements become met
            propagate: refresh the parent module score + enrollment progress
        
        Returns the recomputed score payload, or None when the student has no
        progress record for this lesson.
        """
        try:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                current_app.logger.warning(
                    f"No lesson completion found for student {student_id}, lesson {lesson_id}"
                )
                return None
            
            score_data = lesson_completion.calculate_and_store_component_scores(commit=False)
            
            # Grading / publishing can make a lesson completable
            if auto_complete:
                can_complete, _, _ = LessonCompletionService.check_lesson_completion_requirements(
                    student_id, lesson_id
                )
                if can_complete and not lesson_completion.completed:
                    lesson_completion.completed = True
                    lesson_completion.completed_at = now_local()
                    current_app.logger.info(
                        f"Lesson {lesson_id} auto-completed for student {student_id} after content change"
                    )
            
            db.session.commit()
            
            if propagate:
                LessonCompletionService._propagate_score_changes(
                    student_id, lesson_id, lesson_completion
                )
            
            return score_data
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(
                f"Error storing lesson scores for student {student_id}, lesson {lesson_id}: {str(e)}"
            )
            return None
    
    @staticmethod
    def recalculate_lesson_for_all_students(lesson_id: int) -> Dict:
        """
        Recompute stored scores for EVERY student with progress in a lesson.
        
        Triggered when an assessment is created/published/unpublished/deleted or
        a lesson's content changes, so scores taken before the assessment existed
        are refreshed instead of staying stale.
        """
        summary = {"lesson_id": lesson_id, "students_updated": 0, "lessons_updated": 0}
        try:
            lesson = Lesson.query.get(lesson_id)
            if not lesson:
                return summary
            
            completions = LessonCompletion.query.filter_by(lesson_id=lesson_id).all()
            if not completions:
                return summary
            
            from ..services.progression_service import ProgressionService
            from ..services.enrollment_progress_service import EnrollmentProgressService
            from ..models.course_models import Enrollment
            touched_students = set()
            
            for completion in completions:
                completion.calculate_and_store_component_scores(commit=False)
                can_complete, _, _ = LessonCompletionService.check_lesson_completion_requirements(
                    completion.student_id, lesson_id
                )
                if can_complete and not completion.completed:
                    completion.completed = True
                    completion.completed_at = now_local()
                touched_students.add(completion.student_id)
                summary["lessons_updated"] += 1
            
            db.session.flush()
            
            # One module score refresh + one enrollment sync per affected student
            course_id = lesson.module.course_id if lesson.module else None
            for student_id in touched_students:
                if course_id and lesson.module_id:
                    enrollment = Enrollment.query.filter_by(
                        student_id=student_id, course_id=course_id
                    ).first()
                    if enrollment:
                        ProgressionService._update_course_contribution_score(
                            student_id, lesson.module_id, enrollment.id, commit=False
                        )
                if course_id:
                    EnrollmentProgressService.sync_student_course(
                        student_id, course_id, commit=False
                    )
            
            db.session.commit()
            summary["students_updated"] = len(touched_students)
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Lesson rescore failed for lesson {lesson_id}: {str(e)}")
        
        return summary
    
    @staticmethod
    def update_lesson_score_after_grading(student_id: int, lesson_id: int) -> bool:
        """
        Update lesson completion after quiz or assignment grading
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            Success status
        """
        try:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                return True  # No completion to update
            
            # Persist freshly computed component scores (the grade just changed)
            lesson_completion.calculate_and_store_component_scores(commit=False)
            
            # Update timestamp to trigger score recalculation
            lesson_completion.updated_at = now_local()
            
            # Check if lesson should now be considered complete
            can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
                student_id, lesson_id
            )
            
            if can_complete and not lesson_completion.completed:
                lesson_completion.completed = True
                lesson_completion.completed_at = now_local()
                current_app.logger.info(f"Lesson {lesson_id} auto-completed for student {student_id} after grading")
            
            db.session.commit()
            
            # Push the new score to module + enrollment progress
            LessonCompletionService._propagate_score_changes(
                student_id, lesson_id, lesson_completion
            )
            
            # Log score update
            new_score = lesson_completion.calculate_lesson_score()
            current_app.logger.info(f"Updated lesson score after grading: lesson={lesson_id}, student={student_id}, score={new_score:.1f}%")
            
            return True
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating lesson score after grading: {str(e)}")
            return False
    
    @staticmethod
    def get_lesson_completion_status(student_id: int, lesson_id: int) -> Dict:
        """
        Get detailed completion status for a lesson
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            Detailed status dictionary
        """
        try:
            can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
                student_id, lesson_id
            )
            
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            status = {
                'can_complete': can_complete,
                'reason': reason,
                'requirements': requirements,
                'completion_data': lesson_completion.to_dict() if lesson_completion else None,
                'is_completed': lesson_completion.completed if lesson_completion else False,
                'lesson_score': lesson_completion.calculate_lesson_score() if lesson_completion else 0.0,
                'completion_percentage': 0.0
            }
            
            # Calculate completion percentage based on requirements
            total_requirements = 4  # reading, quiz, assignment, overall score
            met_requirements = sum([
                requirements.get('reading_requirements_met', False),
                requirements.get('quiz_requirements_met', True),  # True if no quiz
                requirements.get('assignment_requirements_met', True),  # True if no assignment
                requirements.get('overall_score_met', False)
            ])
            
            status['completion_percentage'] = (met_requirements / total_requirements) * 100
            
            return status
            
        except Exception as e:
            current_app.logger.error(f"Error getting lesson completion status: {str(e)}")
            return {
                'can_complete': False,
                'reason': f"Error: {str(e)}",
                'requirements': {},
                'completion_data': None,
                'is_completed': False,
                'lesson_score': 0.0,
                'completion_percentage': 0.0
            }
    
    @staticmethod
    def update_lesson_score_after_quiz_grading(student_id: int, lesson_id: int) -> bool:
        """
        Update lesson score after quiz is graded.
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            bool: True if score was updated, False otherwise
        """
        try:
            # Get or create lesson completion record
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                current_app.logger.warning(f"No lesson completion found for student {student_id}, lesson {lesson_id}")
                return False
            
            # Recalculate, store and propagate component scores
            score_data = LessonCompletionService.store_and_propagate_lesson_scores(student_id, lesson_id)
            if not score_data:
                return False
            
            current_app.logger.info(
                f"Updated lesson score after quiz grading - Student: {student_id}, "
                f"Lesson: {lesson_id}, New Score: {score_data['lesson_score']:.1f}%, "
                f"Quiz Component: {score_data['quiz_component']:.1f}%"
            )
            
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error updating lesson score after quiz grading: {str(e)}")
            return False
    
    @staticmethod
    def update_lesson_score_after_assignment_grading(student_id: int, lesson_id: int) -> bool:
        """
        Update lesson score after assignment is graded.
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            bool: True if score was updated, False otherwise
        """
        try:
            # Get or create lesson completion record
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                current_app.logger.warning(f"No lesson completion found for student {student_id}, lesson {lesson_id}")
                return False
            
            # Recalculate, store and propagate component scores
            score_data = LessonCompletionService.store_and_propagate_lesson_scores(student_id, lesson_id)
            if not score_data:
                return False
            
            current_app.logger.info(
                f"Updated lesson score after assignment grading - Student: {student_id}, "
                f"Lesson: {lesson_id}, New Score: {score_data['lesson_score']:.1f}%, "
                f"Assignment Component: {score_data['assignment_component']:.1f}%"
            )
            
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error updating lesson score after assignment grading: {str(e)}")
            return False
            
    @staticmethod
    def update_lesson_score_after_reading_engagement(student_id: int, lesson_id: int) -> bool:
        """
        Update lesson score after reading/engagement progress changes.
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            bool: True if score was updated, False otherwise
        """
        try:
            # Get lesson completion record
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                # No lesson completion record to update
                return False
            
            # Recalculate and store component scores. Reading/engagement updates
            # happen on autosave, so skip auto-completion and module/enrollment
            # propagation here - those run on explicit completion and grading.
            score_data = LessonCompletionService.store_and_propagate_lesson_scores(
                student_id, lesson_id, auto_complete=False, propagate=False
            )
            if not score_data:
                return False
            
            current_app.logger.info(
                f"Updated lesson score after reading/engagement - Student: {student_id}, "
                f"Lesson: {lesson_id}, New Score: {score_data['lesson_score']:.1f}%, "
                f"Reading: {score_data['reading_component']:.1f}%, "
                f"Engagement: {score_data['engagement_component']:.1f}%"
            )
            
            return True
            
        except Exception as e:
            current_app.logger.error(f"Error updating lesson score after reading/engagement: {str(e)}")
            return False
    
    @staticmethod
    def get_lesson_score_breakdown(student_id: int, lesson_id: int) -> Dict:
        """
        Get detailed lesson score breakdown with stored component scores.
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson
            
        Returns:
            dict: Lesson score breakdown with component scores
        """
        try:
            lesson_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if not lesson_completion:
                return {
                    'lesson_score': 0.0,
                    'reading_component': 0.0,
                    'engagement_component': 0.0,
                    'quiz_component': 0.0,
                    'assignment_component': 0.0,
                    'has_quiz': False,
                    'has_assignment': False,
                    'score_last_updated': None,
                    'completion_status': 'not_started'
                }
            
            # Always recompute from live data: a quiz/assignment may have been
            # published, regraded or removed since the stored snapshot was taken.
            # commit=False keeps this read path from opening its own transaction.
            breakdown = lesson_completion.calculate_and_store_component_scores(commit=False)
            breakdown['score_last_updated'] = (
                lesson_completion.score_last_updated.isoformat()
                if lesson_completion.score_last_updated else None
            )
            
            # Add assessment availability info
            from ..models.course_models import Quiz, Assignment
            has_quiz = Quiz.query.filter_by(lesson_id=lesson_id, is_published=True).first() is not None
            has_assignment = Assignment.query.filter_by(lesson_id=lesson_id, is_published=True).first() is not None
            
            breakdown.update({
                'has_quiz': has_quiz,
                'has_assignment': has_assignment,
                'completion_status': 'completed' if lesson_completion.completed else 'in_progress'
            })
            
            return breakdown
            
        except Exception as e:
            current_app.logger.error(f"Error getting lesson score breakdown: {str(e)}")
            return {
                'lesson_score': 0.0,
                'reading_component': 0.0,
                'engagement_component': 0.0,
                'quiz_component': 0.0,
                'assignment_component': 0.0,
                'has_quiz': False,
                'has_assignment': False,
                'score_last_updated': None,
                'completion_status': 'error'
            }