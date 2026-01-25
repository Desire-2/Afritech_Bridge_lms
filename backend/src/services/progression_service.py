# Progression Service - Handle strict course progression logic
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from flask import current_app

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz
from ..models.student_models import (
    ModuleProgress, LessonCompletion, AssessmentAttempt, StudentTranscript, StudentSuspension
)
from ..models.quiz_progress_models import QuizAttempt


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
                student_id=student_id, course_id=course_id
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
    def check_lesson_quiz_requirement(lesson_id: int) -> Tuple[bool, Optional[Dict]]:
        """
        Check if a lesson has a quiz assigned to it
        
        Args:
            lesson_id: ID of the lesson
            
        Returns:
            Tuple of (has_quiz, quiz_data)
        """
        try:
            quiz = Quiz.query.filter_by(lesson_id=lesson_id, is_published=True).first()
            
            if quiz:
                return True, {
                    "quiz_id": quiz.id,
                    "quiz_title": quiz.title,
                    "passing_score": quiz.passing_score
                }
            return False, None
            
        except Exception as e:
            current_app.logger.error(f"Quiz check error: {str(e)}")
            return False, None
    
    @staticmethod
    def has_passed_quiz(student_id: int, quiz_id: int) -> Tuple[bool, Optional[float]]:
        """
        Check if student has passed the quiz
        
        Args:
            student_id: ID of the student
            quiz_id: ID of the quiz
            
        Returns:
            Tuple of (passed, score)
        """
        try:
            quiz = Quiz.query.get(quiz_id)
            if not quiz:
                return False, None
            
            # Get best attempt
            attempts = QuizAttempt.query.filter_by(
                student_id=student_id,
                quiz_id=quiz_id
            ).order_by(QuizAttempt.created_at.desc()).all()
            
            if not attempts:
                return False, None
            
            best_attempt = max(attempts, key=lambda a: a.score_percentage if a.score_percentage else 0)
            score = best_attempt.score_percentage or 0
            passing_score = quiz.passing_score or 70
            
            return score >= passing_score, score
            
        except Exception as e:
            current_app.logger.error(f"Quiz pass check error: {str(e)}")
            return False, None
    
    @staticmethod
    def complete_lesson(student_id: int, lesson_id: int, time_spent: int = 0) -> Tuple[bool, str, Dict]:
        """
        Mark a lesson as completed with strict progression checking and quiz requirements
        
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
                student_id=student_id, course_id=course.id
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
            
            # ✅ NEW: Check if lesson has a quiz requirement
            has_quiz, quiz_info = ProgressionService.check_lesson_quiz_requirement(lesson_id)
            
            if has_quiz and quiz_info:
                # Quiz is assigned to this lesson - check if student has passed it
                has_passed, quiz_score = ProgressionService.has_passed_quiz(student_id, quiz_info["quiz_id"])
                
                if not has_passed:
                    # Return a special response indicating quiz is required
                    return False, "Quiz required", {
                        "quiz_required": True,
                        "quiz_id": quiz_info["quiz_id"],
                        "quiz_title": quiz_info["quiz_title"],
                        "passing_score": quiz_info["passing_score"],
                        "current_score": quiz_score,
                        "message": f"Complete and pass the quiz '{quiz_info['quiz_title']}' (minimum {quiz_info['passing_score']}%) to complete this lesson"
                    }
            
            # Create completion record with proper flags set
            completion = LessonCompletion(
                student_id=student_id,
                lesson_id=lesson_id,
                time_spent=time_spent,
                completed=True,  # Mark as completed
                reading_progress=100.0,  # Default to 100% if completing manually
                engagement_score=100.0  # Default to 100% for completed lessons
            )
            
            current_app.logger.info(f"📚 Creating lesson completion: lesson_id={lesson_id}, student_id={student_id}, completed=True, reading_progress=100.0, engagement_score=100.0")
            
            db.session.add(completion)
            
            # Update module progress if needed
            if module_progress.status == 'unlocked':
                module_progress.status = 'in_progress'
                module_progress.started_at = datetime.utcnow()
            
            # Update course contribution score (10% of total) - now uses lesson scores
            ProgressionService._update_course_contribution_score(
                student_id, module.id, enrollment.id
            )
            
            # Commit and ensure data is fresh
            db.session.commit()
            db.session.refresh(completion)
            
            current_app.logger.info(f"✅ Lesson {lesson_id} completion committed to database")
            
            return True, "Lesson completed successfully", completion.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Lesson completion error: {str(e)}")
            return False, "Failed to complete lesson", {}
    
    @staticmethod
    def check_module_completion(student_id: int, module_id: int, enrollment_id: int) -> Tuple[bool, str]:
        """
        Check if module can be marked as completed based on STRICT lesson-level requirements.
        
        Enhanced with strict validation:
        1. ALL lessons in module must satisfy individual requirements
        2. Module cumulative score >= 80%
        3. No lesson can have unsatisfied quiz/assignment requirements
        
        Args:
            student_id: ID of the student
            module_id: ID of the module
            enrollment_id: ID of the enrollment
            
        Returns:
            Tuple of (can_complete, detailed_reason)
        """
        try:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not module_progress:
                current_app.logger.warning(f"Module progress not found for student={student_id}, module={module_id}")
                return False, "Module progress not found"
            
            # Get module and lessons
            module = Module.query.get(module_id)
            if not module:
                return False, "Module not found"
                
            lessons = module.lessons.order_by(Lesson.order).all()
            if not lessons:
                return False, "No lessons found in module"
            
            # STRICT LESSON VALIDATION: Check EVERY lesson individually
            from ..services.lesson_completion_service import LessonCompletionService
            
            lesson_failures = []
            lessons_checked = 0
            
            for lesson in lessons:
                lessons_checked += 1
                completion = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson.id
                ).first()
                
                if not completion:
                    lesson_failures.append(f"Lesson '{lesson.title}' not started")
                    continue
                
                # Check comprehensive lesson requirements
                can_complete_lesson, req_reason, req_data = LessonCompletionService.check_lesson_completion_requirements(
                    student_id, lesson.id
                )
                
                if not can_complete_lesson:
                    missing_reqs = req_data.get("missing_requirements", []) if isinstance(req_data, dict) else []
                    if not missing_reqs and req_reason:
                        missing_reqs = [req_reason]
                    lesson_failures.append(f"Lesson '{lesson.title}': {', '.join(missing_reqs) if missing_reqs else req_reason}")
                    continue
                
                # Check lesson score threshold
                lesson_score = completion.calculate_lesson_score()
                if lesson_score < 80.0:
                    lesson_failures.append(f"Lesson '{lesson.title}' score {lesson_score:.1f}% < 80%")
            
            # If ANY lesson fails, module cannot be completed
            if lesson_failures:
                failure_summary = f"Module BLOCKED - {len(lesson_failures)} lesson requirement(s) not satisfied: {'; '.join(lesson_failures[:3])}"
                if len(lesson_failures) > 3:
                    failure_summary += f" (and {len(lesson_failures) - 3} more)"
                
                current_app.logger.info(f"Module {module_id} BLOCKED due to lesson failures: {lesson_failures}")
                return False, failure_summary
            
            # All lessons passed - now check module-level score
            cumulative_score = module_progress.calculate_cumulative_score()
            current_app.logger.info(f"All lessons passed. Module {module_id} cumulative_score={cumulative_score:.2f}% for student {student_id}")
            
            # Check if meets passing requirement (80%)
            if cumulative_score >= 80.0:
                current_app.logger.info(f"Module {module_id} PASSED with {cumulative_score:.2f}% - all {lessons_checked} lessons satisfied - unlocking next module")
                
                # Mark module as completed and save cumulative score
                module_progress.status = 'completed'
                module_progress.completed_at = datetime.utcnow()
                module_progress.cumulative_score = cumulative_score
                
                current_app.logger.info(f"🎯 Setting module {module_id} status='completed', completed_at={module_progress.completed_at}, cumulative_score={cumulative_score}")
                
                # Unlock next module
                ProgressionService._unlock_next_module(student_id, module_id, enrollment_id)
                
                db.session.commit()
                current_app.logger.info(f"✅ Module {module_id} completion committed to database")
                
                return True, f"Module completed successfully! Score: {cumulative_score:.1f}%, All {lessons_checked} lessons satisfied requirements"
                
            else:
                # Module score insufficient even though lessons passed
                current_app.logger.info(f"Module {module_id} lessons passed but score {cumulative_score:.2f}% < 80%")
                
                # Check if this is a final attempt that fails
                if module_progress.attempts_count >= module_progress.max_attempts:
                    # Suspend student from course
                    success, suspension_msg = ProgressionService._suspend_student_from_course(
                        student_id, module_id, enrollment_id, module_progress.attempts_count
                    )
                    if success:
                        return False, f"All lessons satisfied but insufficient module score: {cumulative_score:.1f}%. {suspension_msg}"
                    else:
                        return False, f"All lessons satisfied but insufficient module score: {cumulative_score:.1f}% and suspension failed: {suspension_msg}"
                else:
                    # Mark as failed but allow retake
                    module_progress.status = 'failed'
                    module_progress.failed_at = datetime.utcnow()
                    db.session.commit()
                    remaining_attempts = module_progress.max_attempts - module_progress.attempts_count
                    return False, f"All lessons satisfied but module score {cumulative_score:.1f}% < 80% required. {remaining_attempts} attempts remaining."
                
        except Exception as e:
            current_app.logger.error(f"Module completion check error: {str(e)}")
            return False, f"Error checking module completion: {str(e)}"
    
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
        # Check if progress already exists to prevent duplicates
        existing_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id
        ).first()
        
        if existing_progress:
            return existing_progress
        
        # Check if this is the first module in course
        module = Module.query.get(module_id)
        first_module = module.course.modules.order_by('order').first()
        
        # ENHANCED: Check if student has completed any lessons in this module
        # If they have, the module should be unlocked/in_progress, not locked
        # Query lessons in this module and check for completions
        module_lesson_ids = [lesson.id for lesson in module.lessons]
        has_completed_lessons = False
        completed_count = 0
        
        if module_lesson_ids:
            completed_count = LessonCompletion.query.filter(
                LessonCompletion.student_id == student_id,
                LessonCompletion.lesson_id.in_(module_lesson_ids)
            ).count()
            has_completed_lessons = completed_count > 0
        
        # Determine initial status
        if module.id == first_module.id:
            initial_status = 'unlocked'
            is_unlocked = True
        elif has_completed_lessons:
            # If student has completed lessons, module must have been unlocked before
            initial_status = 'in_progress'
            is_unlocked = True
            current_app.logger.info(f"Restoring module {module_id} as in_progress (found {completed_count} completed lessons)")
        else:
            # Check if previous modules are completed (should be unlocked)
            previous_modules = module.course.modules.filter(
                Module.order < module.order
            ).order_by('order').all()
            
            all_previous_completed = True
            for prev_mod in previous_modules:
                prev_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=prev_mod.id,
                    enrollment_id=enrollment_id
                ).first()
                if not prev_progress or prev_progress.status != 'completed':
                    all_previous_completed = False
                    break
            
            initial_status = 'unlocked' if all_previous_completed else 'locked'
            is_unlocked = all_previous_completed
        
        progress = ModuleProgress(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id,
            status=initial_status,
            unlocked_at=datetime.utcnow() if is_unlocked else None,
            prerequisites_met=is_unlocked
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
        if not completed_module:
            current_app.logger.error(f"Could not find completed module {completed_module_id}")
            return
            
        course = completed_module.course
        
        # Find next module
        next_module = course.modules.filter(
            Module.order > completed_module.order
        ).order_by('order').first()
        
        if next_module:
            current_app.logger.info(f"Attempting to unlock next module {next_module.id} ({next_module.title}) for student {student_id}")
            
            next_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=next_module.id,
                enrollment_id=enrollment_id
            ).first()
            
            if not next_progress:
                # Create the progress record if it doesn't exist
                current_app.logger.info(f"Creating new ModuleProgress for module {next_module.id}")
                next_progress = ModuleProgress(
                    student_id=student_id,
                    module_id=next_module.id,
                    enrollment_id=enrollment_id,
                    status='unlocked',
                    unlocked_at=datetime.utcnow(),
                    prerequisites_met=True
                )
                db.session.add(next_progress)
            elif next_progress.status in ('locked', 'not_started', None):
                # Unlock if currently locked or not started
                current_app.logger.info(f"Unlocking existing ModuleProgress for module {next_module.id} (was: {next_progress.status})")
                next_progress.status = 'unlocked'
                next_progress.unlocked_at = datetime.utcnow()
                next_progress.prerequisites_met = True
            else:
                current_app.logger.info(f"Module {next_module.id} already has status: {next_progress.status}, not changing")
        else:
            current_app.logger.info(f"No next module found after module {completed_module_id} - this may be the last module")
    
    @staticmethod
    def _update_course_contribution_score(student_id: int, module_id: int, enrollment_id: int):
        """Update the course contribution score (10% of total grade) based on lesson scores"""
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id
        ).first()
        
        if module_progress:
            # Calculate module score (average of all comprehensive lesson scores)
            # Each lesson score includes: reading + engagement + quiz + assignment
            module_score = module_progress.calculate_module_score()
            
            # Store as course contribution score (0-100)
            module_progress.course_contribution_score = min(100.0, module_score)
            
            # Recalculate weighted cumulative score (for passing requirements)
            module_progress.calculate_module_weighted_score()
            
            # Commit changes to database
            try:
                db.session.commit()
            except Exception as e:
                db.session.rollback()
                current_app.logger.error(f"Failed to update course contribution score: {str(e)}")
    
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