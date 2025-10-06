# Progression Service - Handle strict course progression logic
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from flask import current_app

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Enrollment
from ..models.student_models import (
    ModuleProgress, LessonCompletion, AssessmentAttempt, StudentTranscript, StudentSuspension
)


class ProgressionService:
    """Service class for handling strict course progression logic"""
    
    @staticmethod
    def get_student_course_progress(student_id: int, course_id: int) -> Dict:
        """
        Get comprehensive progress information for a student in a course
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Dictionary containing detailed progress information
        """
        try:
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course_id
            ).first()
            
            if not enrollment:
                return {"error": "Enrollment not found"}
            
            course = Course.query.get(course_id)
            modules = course.modules.order_by('order').all()
            
            progress_data = {
                "course": course.to_dict(),
                "enrollment": enrollment.to_dict(),
                "modules": [],
                "overall_progress": 0.0,
                "current_module": None,
                "can_proceed": False,
                "locked_modules": 0,
                "suspension_status": ProgressionService.check_student_suspension_status(student_id, course_id)
            }
            
            completed_modules = 0
            current_module_found = False
            
            for module in modules:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment.id
                ).first()
                
                if not module_progress:
                    # Initialize if missing
                    module_progress = ProgressionService._initialize_module_progress(
                        student_id, module.id, enrollment.id
                    )
                
                module_data = {
                    "module": module.to_dict(include_lessons=True),
                    "progress": module_progress.to_dict(),
                    "lessons_completed": [],
                    "assessments": []
                }
                
                # Get lesson completion status
                lessons = module.lessons.order_by('order').all()
                for lesson in lessons:
                    completion = LessonCompletion.query.filter_by(
                        student_id=student_id, lesson_id=lesson.id
                    ).first()
                    
                    lesson_data = lesson.to_dict()
                    lesson_data['completed'] = completion is not None
                    lesson_data['completed_at'] = completion.completed_at.isoformat() if completion else None
                    lesson_data['time_spent'] = completion.time_spent if completion else 0
                    
                    module_data["lessons_completed"].append(lesson_data)
                
                # Get assessment attempts
                attempts = AssessmentAttempt.query.filter_by(
                    student_id=student_id, module_id=module.id
                ).all()
                
                module_data["assessments"] = [attempt.to_dict() for attempt in attempts]
                
                # Track progress
                if module_progress.status == 'completed':
                    completed_modules += 1
                elif module_progress.status in ['unlocked', 'in_progress'] and not current_module_found:
                    progress_data["current_module"] = module_data
                    current_module_found = True
                
                if module_progress.status == 'locked':
                    progress_data["locked_modules"] += 1
                
                progress_data["modules"].append(module_data)
            
            # Calculate overall progress
            if modules:
                progress_data["overall_progress"] = (completed_modules / len(modules)) * 100
            
            # Check if can proceed (unlock next modules)
            progress_data["can_proceed"] = ProgressionService._can_unlock_next_module(
                student_id, course_id, enrollment.id
            )
            
            return progress_data
            
        except Exception as e:
            current_app.logger.error(f"Progress retrieval error: {str(e)}")
            return {"error": "Failed to retrieve progress"}
    
    @staticmethod
    def complete_lesson(student_id: int, lesson_id: int, time_spent: int = 0) -> Tuple[bool, str, Dict]:
        """
        Mark a lesson as completed with strict progression checking
        
        Args:
            student_id: ID of the student
            lesson_id: ID of the lesson to complete
            time_spent: Time spent on lesson in seconds
            
        Returns:
            Tuple of (success, message, progress_data)
        """
        try:
            lesson = Lesson.query.get(lesson_id)
            if not lesson:
                return False, "Lesson not found", {}
            
            module = lesson.module
            course = module.course
            
            # Check if student is enrolled
            enrollment = Enrollment.query.filter_by(
                user_id=student_id, course_id=course.id
            ).first()
            
            if not enrollment:
                return False, "Not enrolled in this course", {}
            
            # Check if module is unlocked
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not module_progress or module_progress.status == 'locked':
                return False, "Module is locked. Complete previous modules first", {}
            
            # Check if previous lessons in module are completed (strict progression)
            if course.strict_progression:
                previous_lessons = module.lessons.filter(
                    Lesson.order < lesson.order
                ).all()
                
                for prev_lesson in previous_lessons:
                    completion = LessonCompletion.query.filter_by(
                        student_id=student_id, lesson_id=prev_lesson.id
                    ).first()
                    
                    if not completion:
                        return False, f"Complete lesson '{prev_lesson.title}' first", {}
            
            # Check if already completed
            existing_completion = LessonCompletion.query.filter_by(
                student_id=student_id, lesson_id=lesson_id
            ).first()
            
            if existing_completion:
                return True, "Lesson already completed", existing_completion.to_dict()
            
            # Create completion record
            completion = LessonCompletion(
                student_id=student_id,
                lesson_id=lesson_id,
                time_spent=time_spent
            )
            
            db.session.add(completion)
            
            # Update module progress if needed
            if module_progress.status == 'unlocked':
                module_progress.status = 'in_progress'
                module_progress.started_at = datetime.utcnow()
            
            # Update course contribution score (10% of total)
            ProgressionService._update_course_contribution_score(
                student_id, module.id, enrollment.id
            )
            
            db.session.commit()
            
            return True, "Lesson completed successfully", completion.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Lesson completion error: {str(e)}")
            return False, "Failed to complete lesson", {}
    
    @staticmethod
    def check_module_completion(student_id: int, module_id: int, enrollment_id: int) -> Tuple[bool, str]:
        """
        Check if module can be marked as completed based on cumulative score
        
        Args:
            student_id: ID of the student
            module_id: ID of the module
            enrollment_id: ID of the enrollment
            
        Returns:
            Tuple of (can_complete, reason)
        """
        try:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not module_progress:
                return False, "Module progress not found"
            
            # Calculate cumulative score
            cumulative_score = module_progress.calculate_cumulative_score()
            
            # Check if meets passing requirement (80%)
            if cumulative_score >= 80.0:
                # Mark module as completed
                module_progress.status = 'completed'
                module_progress.completed_at = datetime.utcnow()
                
                # Unlock next module
                ProgressionService._unlock_next_module(student_id, module_id, enrollment_id)
                
                db.session.commit()
                return True, f"Module completed with score: {cumulative_score:.1f}%"
            else:
                # Check if this is a final attempt that fails
                if module_progress.attempts_count >= module_progress.max_attempts:
                    # Suspend student from course
                    success, suspension_msg = ProgressionService._suspend_student_from_course(
                        student_id, module_id, enrollment_id, module_progress.attempts_count
                    )
                    if success:
                        return False, f"Insufficient score: {cumulative_score:.1f}%. {suspension_msg}"
                    else:
                        return False, f"Insufficient score: {cumulative_score:.1f}% and suspension failed: {suspension_msg}"
                else:
                    # Mark as failed but allow retake
                    module_progress.status = 'failed'
                    module_progress.failed_at = datetime.utcnow()
                    db.session.commit()
                    remaining_attempts = module_progress.max_attempts - module_progress.attempts_count
                    return False, f"Insufficient score: {cumulative_score:.1f}% (80% required). {remaining_attempts} attempts remaining."
                
        except Exception as e:
            current_app.logger.error(f"Module completion check error: {str(e)}")
            return False, "Error checking module completion"
    
    @staticmethod
    def attempt_module_retake(student_id: int, module_id: int, enrollment_id: int) -> Tuple[bool, str]:
        """
        Allow student to retake a failed module (up to 3 attempts)
        
        Args:
            student_id: ID of the student
            module_id: ID of the module to retake
            enrollment_id: ID of the enrollment
            
        Returns:
            Tuple of (success, message)
        """
        try:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not module_progress:
                return False, "Module progress not found"
            
            if module_progress.status != 'failed':
                return False, "Module is not in failed status"
            
            if module_progress.attempts_count >= module_progress.max_attempts:
                return False, "Maximum attempts reached. Course access revoked"
            
            # Reset module progress for retake
            module_progress.attempts_count += 1
            module_progress.status = 'unlocked'
            module_progress.started_at = None
            module_progress.failed_at = None
            
            # Reset scores
            module_progress.course_contribution_score = 0.0
            module_progress.quiz_score = 0.0
            module_progress.assignment_score = 0.0
            module_progress.final_assessment_score = 0.0
            module_progress.cumulative_score = 0.0
            
            # Clear lesson completions for retake
            LessonCompletion.query.filter_by(student_id=student_id).filter(
                LessonCompletion.lesson.has(module_id=module_id)
            ).delete(synchronize_session='fetch')
            
            # Clear assessment attempts for retake
            AssessmentAttempt.query.filter_by(
                student_id=student_id, module_id=module_id
            ).delete(synchronize_session='fetch')
            
            db.session.commit()
            
            return True, f"Module retake initiated. Attempt {module_progress.attempts_count}/{module_progress.max_attempts}"
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Module retake error: {str(e)}")
            return False, "Failed to initiate retake"
    
    @staticmethod
    def _initialize_module_progress(student_id: int, module_id: int, enrollment_id: int) -> ModuleProgress:
        """Initialize module progress for a student"""
        # Check if this is the first module in course
        module = Module.query.get(module_id)
        first_module = module.course.modules.order_by('order').first()
        
        progress = ModuleProgress(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id,
            status='unlocked' if module.id == first_module.id else 'locked',
            unlocked_at=datetime.utcnow() if module.id == first_module.id else None,
            prerequisites_met=module.id == first_module.id
        )
        
        db.session.add(progress)
        return progress
    
    @staticmethod
    def _can_unlock_next_module(student_id: int, course_id: int, enrollment_id: int) -> bool:
        """Check if student can unlock the next module"""
        course = Course.query.get(course_id)
        modules = course.modules.order_by('order').all()
        
        for i, module in enumerate(modules):
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment_id
            ).first()
            
            if module_progress and module_progress.status == 'completed':
                continue
            elif module_progress and module_progress.can_proceed_to_next():
                return True
            else:
                break
        
        return False
    
    @staticmethod
    def _unlock_next_module(student_id: int, completed_module_id: int, enrollment_id: int):
        """Unlock the next module after completing current one"""
        completed_module = Module.query.get(completed_module_id)
        course = completed_module.course
        
        # Find next module
        next_module = course.modules.filter(
            Module.order > completed_module.order
        ).order_by('order').first()
        
        if next_module:
            next_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=next_module.id,
                enrollment_id=enrollment_id
            ).first()
            
            if next_progress and next_progress.status == 'locked':
                next_progress.status = 'unlocked'
                next_progress.unlocked_at = datetime.utcnow()
                next_progress.prerequisites_met = True
    
    @staticmethod
    def _update_course_contribution_score(student_id: int, module_id: int, enrollment_id: int):
        """Update the course contribution score (10% of total grade)"""
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id
        ).first()
        
        if module_progress:
            # Calculate contribution based on:
            # - Lesson completion rate
            # - Forum participation
            # - Help given to peers
            # - Timeliness of completion
            
            module = Module.query.get(module_id)
            total_lessons = module.lessons.count()
            completed_lessons = LessonCompletion.query.filter_by(student_id=student_id).filter(
                LessonCompletion.lesson.has(module_id=module_id)
            ).count()
            
            completion_rate = (completed_lessons / total_lessons * 100) if total_lessons > 0 else 0
            
            # Base score on completion rate (can be enhanced with forum participation, etc.)
            module_progress.course_contribution_score = min(100.0, completion_rate)
            
            # Recalculate cumulative score
            module_progress.calculate_cumulative_score()
    
    @staticmethod
    def _suspend_student_from_course(student_id: int, module_id: int, enrollment_id: int, total_attempts: int) -> Tuple[bool, str]:
        """
        Suspend student from course due to excessive failed attempts
        
        Args:
            student_id: ID of the student
            module_id: ID of the failed module
            enrollment_id: ID of the enrollment
            total_attempts: Total attempts made
            
        Returns:
            Tuple of (success, message)
        """
        try:
            enrollment = Enrollment.query.get(enrollment_id)
            if not enrollment:
                return False, "Enrollment not found"
            
            # Check if already suspended
            existing_suspension = StudentSuspension.query.filter_by(
                student_id=student_id,
                course_id=enrollment.course_id,
                enrollment_id=enrollment_id
            ).first()
            
            if existing_suspension:
                return False, "Student already suspended from this course"
            
            # Create suspension record
            suspension = StudentSuspension(
                student_id=student_id,
                course_id=enrollment.course_id,
                enrollment_id=enrollment_id,
                failed_module_id=module_id,
                total_attempts_made=total_attempts,
                reason=f"Failed module after {total_attempts} attempts"
            )
            
            db.session.add(suspension)
            
            # Update enrollment status (optional - you might want to keep it active for appeal process)
            # enrollment.status = 'suspended'
            
            db.session.commit()
            
            return True, f"Student suspended from course. Can appeal within 30 days."
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Student suspension error: {str(e)}")
            return False, "Failed to suspend student"
    
    @staticmethod
    def check_student_suspension_status(student_id: int, course_id: int) -> Dict:
        """
        Check if student is suspended from a course
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            
        Returns:
            Dictionary with suspension status information
        """
        try:
            suspension = StudentSuspension.query.filter_by(
                student_id=student_id,
                course_id=course_id,
                reinstated=False
            ).first()
            
            if suspension:
                return {
                    "is_suspended": True,
                    "suspension_details": suspension.to_dict()
                }
            else:
                return {
                    "is_suspended": False,
                    "suspension_details": None
                }
                
        except Exception as e:
            current_app.logger.error(f"Suspension status check error: {str(e)}")
            return {
                "is_suspended": False,
                "suspension_details": None,
                "error": "Failed to check suspension status"
            }
    
    @staticmethod
    def submit_appeal(student_id: int, course_id: int, appeal_text: str) -> Tuple[bool, str]:
        """
        Submit an appeal for course suspension
        
        Args:
            student_id: ID of the student
            course_id: ID of the course
            appeal_text: Student's appeal text
            
        Returns:
            Tuple of (success, message)
        """
        try:
            suspension = StudentSuspension.query.filter_by(
                student_id=student_id,
                course_id=course_id,
                reinstated=False
            ).first()
            
            if not suspension:
                return False, "No active suspension found"
            
            if not suspension.can_submit_appeal():
                return False, "Appeal deadline has passed or appeal already submitted"
            
            # Submit appeal
            suspension.appeal_submitted = True
            suspension.appeal_text = appeal_text
            suspension.appeal_submitted_at = datetime.utcnow()
            suspension.review_status = 'pending'
            
            db.session.commit()
            
            return True, "Appeal submitted successfully. Review will be completed within 5-7 business days."
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Appeal submission error: {str(e)}")
            return False, "Failed to submit appeal"