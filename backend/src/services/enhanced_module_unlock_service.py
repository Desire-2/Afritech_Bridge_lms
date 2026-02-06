# Enhanced Module Unlock Service - Comprehensive Module Progression System
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from flask import current_app
from sqlalchemy import and_, func

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Enrollment, Quiz, Assignment
from ..models.student_models import (
    ModuleProgress, LessonCompletion, StudentTranscript
)
from ..models.quiz_progress_models import QuizAttempt
from .lesson_completion_service import LessonCompletionService


class EnhancedModuleUnlockService:
    """
    Enhanced service for handling module unlock logic with comprehensive validation,
    better error handling, and improved user experience features.
    """
    
    # Constants
    MODULE_PASSING_SCORE = 70.0  # Reduced from 80% for improved module accessibility
    LESSON_PASSING_SCORE = 80.0  # Kept at 80% for lesson completion rigor
    PREVIEW_UNLOCK_THRESHOLD = 60.0  # Allow module preview at 60%
    
    @staticmethod
    def check_module_unlock_eligibility(student_id: int, module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """
        Comprehensive check if a module can be unlocked.
        
        Returns detailed information about unlock eligibility including:
        - Current progress state
        - Requirements status
        - Actionable recommendations
        - Preview availability
        """
        try:
            # Get module and validate
            module = Module.query.get(module_id)
            if not module:
                return {"eligible": False, "error": "Module not found"}
            
            # Get current module progress
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not module_progress:
                # Initialize if missing
                module_progress = EnhancedModuleUnlockService._safe_initialize_module_progress(
                    student_id, module_id, enrollment_id
                )
            
            # Check prerequisite modules
            prerequisite_status = EnhancedModuleUnlockService._check_prerequisite_modules(
                student_id, module, enrollment_id
            )
            
            # Get detailed lesson requirements status
            lesson_requirements = EnhancedModuleUnlockService._check_lesson_requirements(
                student_id, module_id
            )
            
            # Calculate comprehensive scoring
            scoring_breakdown = EnhancedModuleUnlockService._calculate_comprehensive_module_score(
                student_id, module_id, enrollment_id
            )
            
            # Determine unlock status
            can_unlock_fully = (
                prerequisite_status["all_completed"] and 
                lesson_requirements["all_lessons_passed"] and 
                scoring_breakdown["total_score"] >= EnhancedModuleUnlockService.MODULE_PASSING_SCORE
            )
            
            # Check preview eligibility
            can_preview = (
                prerequisite_status["all_completed"] and 
                scoring_breakdown["total_score"] >= EnhancedModuleUnlockService.PREVIEW_UNLOCK_THRESHOLD
            )
            
            # Generate recommendations
            recommendations = EnhancedModuleUnlockService._generate_unlock_recommendations(
                prerequisite_status, lesson_requirements, scoring_breakdown
            )
            
            return {
                "eligible": can_unlock_fully,
                "can_preview": can_preview,
                "current_status": module_progress.status if module_progress else "not_started",
                "total_score": scoring_breakdown["total_score"],
                "required_score": EnhancedModuleUnlockService.MODULE_PASSING_SCORE,
                "prerequisites": prerequisite_status,
                "lesson_requirements": lesson_requirements,
                "scoring_breakdown": scoring_breakdown,
                "recommendations": recommendations,
                "unlock_timestamp": datetime.utcnow().isoformat(),
                "next_module_info": EnhancedModuleUnlockService._get_next_module_info(module)
            }
            
        except Exception as e:
            current_app.logger.error(f"Module unlock eligibility check error: {str(e)}")
            return {"eligible": False, "error": f"Eligibility check failed: {str(e)}"}
    
    @staticmethod
    def attempt_module_unlock(student_id: int, current_module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """
        Attempt to unlock the next module with comprehensive validation and error handling.
        
        Returns:
            Dict with unlock result, any errors, and detailed feedback
        """
        try:
            # First check if current module is eligible for completion
            current_module = Module.query.get(current_module_id)
            if not current_module:
                return {"success": False, "error": "Current module not found"}
            
            # Validate current module completion
            completion_status = EnhancedModuleUnlockService._validate_current_module_completion(
                student_id, current_module_id, enrollment_id
            )
            
            if not completion_status["can_complete"]:
                return {
                    "success": False,
                    "error": "Current module requirements not met",
                    "details": completion_status,
                    "action_required": "complete_current_module"
                }
            
            # Complete current module
            completion_result = EnhancedModuleUnlockService._complete_current_module(
                student_id, current_module_id, enrollment_id
            )
            
            if not completion_result["success"]:
                return completion_result
            
            # Find and unlock next module
            next_module = current_module.course.modules.filter(
                Module.order > current_module.order
            ).order_by(Module.order).first()
            
            if not next_module:
                # This was the last module - check for course completion
                course_completion = EnhancedModuleUnlockService._check_course_completion(
                    student_id, current_module.course_id, enrollment_id
                )
                return {
                    "success": True,
                    "message": "Course completed successfully!",
                    "course_completed": True,
                    "completion_details": course_completion,
                    "unlock_type": "course_completion"
                }
            
            # Unlock next module
            unlock_result = EnhancedModuleUnlockService._perform_next_module_unlock(
                student_id, next_module.id, enrollment_id
            )
            
            # Add celebration and notification data
            unlock_result.update({
                "current_module": {
                    "id": current_module_id,
                    "title": current_module.title,
                    "completed_score": completion_status["total_score"]
                },
                "next_module": {
                    "id": next_module.id,
                    "title": next_module.title,
                    "order": next_module.order
                },
                "celebration_data": {
                    "achievement_unlocked": f"Module {current_module.order} completed!",
                    "score_achieved": completion_status["total_score"],
                    "next_challenge": f"Module {next_module.order}: {next_module.title}"
                }
            })
            
            return unlock_result
            
        except Exception as e:
            current_app.logger.error(f"Module unlock attempt error: {str(e)}")
            db.session.rollback()
            return {
                "success": False,
                "error": f"Unlock failed: {str(e)}",
                "error_type": "system_error"
            }
    
    @staticmethod
    def get_module_unlock_progress(student_id: int, enrollment_id: int) -> Dict[str, Any]:
        """
        Get comprehensive progress information for module unlocking across entire course.
        """
        try:
            enrollment = Enrollment.query.get(enrollment_id)
            if not enrollment:
                return {"error": "Enrollment not found"}
            
            course = enrollment.course
            modules = course.modules.order_by(Module.order).all()
            
            progress_data = {
                "course_id": course.id,
                "course_title": course.title,
                "total_modules": len(modules),
                "modules_completed": 0,
                "modules_unlocked": 0,
                "current_module_id": None,
                "next_unlockable_module": None,
                "overall_progress": 0.0,
                "modules": []
            }
            
            for module in modules:
                module_progress = ModuleProgress.query.filter_by(
                    student_id=student_id,
                    module_id=module.id,
                    enrollment_id=enrollment_id
                ).first()
                
                if not module_progress:
                    module_progress = EnhancedModuleUnlockService._safe_initialize_module_progress(
                        student_id, module.id, enrollment_id
                    )
                
                # Get unlock eligibility for this module
                eligibility = EnhancedModuleUnlockService.check_module_unlock_eligibility(
                    student_id, module.id, enrollment_id
                )
                
                module_data = {
                    "id": module.id,
                    "title": module.title,
                    "order": module.order,
                    "status": module_progress.status,
                    "score": module_progress.cumulative_score or 0.0,
                    "eligibility": eligibility,
                    "unlocked_at": module_progress.unlocked_at.isoformat() if module_progress.unlocked_at else None,
                    "completed_at": module_progress.completed_at.isoformat() if module_progress.completed_at else None
                }
                
                progress_data["modules"].append(module_data)
                
                # Update counters
                if module_progress.status == "completed":
                    progress_data["modules_completed"] += 1
                elif module_progress.status in ["unlocked", "in_progress"]:
                    progress_data["modules_unlocked"] += 1
                    if not progress_data["current_module_id"]:
                        progress_data["current_module_id"] = module.id
                elif module_progress.status == "locked" and eligibility["eligible"]:
                    if not progress_data["next_unlockable_module"]:
                        progress_data["next_unlockable_module"] = module_data
            
            # Calculate overall progress
            if len(modules) > 0:
                progress_data["overall_progress"] = (progress_data["modules_completed"] / len(modules)) * 100
            
            return progress_data
            
        except Exception as e:
            current_app.logger.error(f"Module unlock progress error: {str(e)}")
            return {"error": f"Progress retrieval failed: {str(e)}"}
    
    @staticmethod
    def handle_unlock_notification(student_id: int, module_id: int, notification_type: str) -> Dict[str, Any]:
        """
        Handle various types of unlock notifications and user interactions.
        
        Args:
            notification_type: 'pre_unlock_warning', 'unlock_celebration', 'unlock_reminder'
        """
        try:
            module = Module.query.get(module_id)
            if not module:
                return {"success": False, "error": "Module not found"}
            
            user = User.query.get(student_id)
            if not user:
                return {"success": False, "error": "Student not found"}
            
            notification_data = {
                "type": notification_type,
                "student_id": student_id,
                "module_id": module_id,
                "module_title": module.title,
                "timestamp": datetime.utcnow().isoformat()
            }
            
            if notification_type == "pre_unlock_warning":
                # Student is close to unlocking next module
                progress = EnhancedModuleUnlockService.check_module_unlock_eligibility(
                    student_id, module_id, None  # We'll find enrollment
                )
                notification_data.update({
                    "message": f"You're close to unlocking {module.title}!",
                    "current_progress": progress.get("total_score", 0),
                    "required_progress": EnhancedModuleUnlockService.MODULE_PASSING_SCORE,
                    "recommendations": progress.get("recommendations", [])
                })
            
            elif notification_type == "unlock_celebration":
                # Module has been successfully unlocked
                notification_data.update({
                    "message": f"🎉 Congratulations! {module.title} is now unlocked!",
                    "celebration_type": "module_unlock",
                    "next_steps": [
                        f"Start learning {module.title}",
                        "Review the module overview",
                        "Complete lessons in order"
                    ]
                })
            
            elif notification_type == "unlock_reminder":
                # Gentle reminder about available unlocked module
                notification_data.update({
                    "message": f"Don't forget to continue with {module.title}",
                    "reminder_type": "gentle",
                    "action_url": f"/learn/{module.course_id}?module={module_id}"
                })
            
            # Store notification in database if needed (implement based on your notification system)
            # NotificationService.create_notification(notification_data)
            
            return {
                "success": True,
                "notification": notification_data
            }
            
        except Exception as e:
            current_app.logger.error(f"Unlock notification error: {str(e)}")
            return {
                "success": False,
                "error": f"Notification failed: {str(e)}"
            }
    
    # Helper Methods
    
    @staticmethod
    def _check_prerequisite_modules(student_id: int, module: Module, enrollment_id: int) -> Dict[str, Any]:
        """Check if all prerequisite modules are properly completed."""
        previous_modules = module.course.modules.filter(
            Module.order < module.order
        ).order_by(Module.order).all()
        
        completed_count = 0
        failed_modules = []
        
        for prev_module in previous_modules:
            prev_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=prev_module.id,
                enrollment_id=enrollment_id
            ).first()
            
            if prev_progress and prev_progress.status == "completed":
                if prev_progress.cumulative_score >= EnhancedModuleUnlockService.MODULE_PASSING_SCORE:
                    completed_count += 1
                else:
                    failed_modules.append({
                        "id": prev_module.id,
                        "title": prev_module.title,
                        "score": prev_progress.cumulative_score,
                        "required": EnhancedModuleUnlockService.MODULE_PASSING_SCORE
                    })
            else:
                failed_modules.append({
                    "id": prev_module.id,
                    "title": prev_module.title,
                    "status": prev_progress.status if prev_progress else "not_started",
                    "required": "completed"
                })
        
        return {
            "all_completed": len(failed_modules) == 0,
            "completed_count": completed_count,
            "total_count": len(previous_modules),
            "failed_modules": failed_modules
        }
    
    @staticmethod
    def _check_lesson_requirements(student_id: int, module_id: int) -> Dict[str, Any]:
        """
        Check if all lessons in the module meet individual requirements with STRICT enforcement.
        
        Returns detailed information about each lesson's status and requirements.
        """
        module = Module.query.get(module_id)
        lessons = module.lessons.order_by(Lesson.order).all()
        
        passed_lessons = []
        failed_lessons = []
        critical_failures = []
        
        for lesson in lessons:
            completion = LessonCompletion.query.filter_by(
                student_id=student_id,
                lesson_id=lesson.id
            ).first()
            
            if not completion:
                # Lesson not started - critical failure
                failure_info = {
                    "id": lesson.id,
                    "title": lesson.title,
                    "order": lesson.order,
                    "status": "not_started",
                    "requirements": ["lesson_must_be_started"],
                    "critical": True,
                    "score": 0.0
                }
                failed_lessons.append(failure_info)
                critical_failures.append(failure_info)
                continue
            
            # Check comprehensive lesson requirements using the service
            from .lesson_completion_service import LessonCompletionService
            can_complete_lesson, req_reason, requirements_status = LessonCompletionService.check_lesson_completion_requirements(
                student_id, lesson.id
            )
            requirements_status = requirements_status if isinstance(requirements_status, dict) else {}
            requirements_status["can_complete"] = can_complete_lesson
            requirements_status["reason"] = req_reason
            
            lesson_score = completion.calculate_lesson_score()
            
            if can_complete_lesson:
                # Additional check: Ensure lesson score meets the passing threshold
                if lesson_score >= EnhancedModuleUnlockService.LESSON_PASSING_SCORE:
                    passed_lessons.append({
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "score": lesson_score,
                        "completed_at": completion.completed_at.isoformat() if completion.completed_at else None,
                        "status": "passed"
                    })
                else:
                    # Score below threshold - critical failure
                    failure_info = {
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "score": lesson_score,
                        "status": "score_below_threshold",
                        "requirements": [f"lesson_score_must_be_at_least_{EnhancedModuleUnlockService.LESSON_PASSING_SCORE}%"],
                        "current_score": lesson_score,
                        "required_score": EnhancedModuleUnlockService.LESSON_PASSING_SCORE,
                        "critical": True
                    }
                    failed_lessons.append(failure_info)
                    critical_failures.append(failure_info)
            else:
                # Requirements not met - determine if critical
                missing_requirements = requirements_status.get("missing_requirements", [])
                is_critical = any(req in ["quiz_not_passed", "assignment_not_graded", "assignment_not_passed"] for req in missing_requirements)
                
                failure_info = {
                    "id": lesson.id,
                    "title": lesson.title,
                    "order": lesson.order,
                    "score": lesson_score,
                    "status": "requirements_not_met",
                    "requirements": missing_requirements,
                    "detailed_status": requirements_status,
                    "critical": is_critical
                }
                failed_lessons.append(failure_info)
                
                if is_critical:
                    critical_failures.append(failure_info)
        
        # Generate summary
        all_lessons_passed = len(failed_lessons) == 0
        has_critical_failures = len(critical_failures) > 0
        
        # Create blocking message if there are failures
        blocking_message = None
        if not all_lessons_passed:
            if has_critical_failures:
                blocking_message = f"Module BLOCKED: {len(critical_failures)} lesson(s) have critical requirement failures that prevent module completion"
            else:
                blocking_message = f"Module completion delayed: {len(failed_lessons)} lesson(s) need requirement improvements"
        
        return {
            "all_lessons_passed": all_lessons_passed,
            "passed_count": len(passed_lessons),
            "total_count": len(lessons),
            "failed_lessons": failed_lessons,
            "passed_lessons": passed_lessons,
            "critical_failures": critical_failures,
            "has_critical_failures": has_critical_failures,
            "blocking_message": blocking_message,
            "can_proceed_to_next_module": all_lessons_passed,  # Only if ALL lessons pass
            "strict_enforcement": True
        }
    
    @staticmethod
    def _calculate_comprehensive_module_score(student_id: int, module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """Calculate comprehensive module score with detailed breakdown."""
        module_progress = ModuleProgress.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            enrollment_id=enrollment_id
        ).first()
        
        if not module_progress:
            return {
                "total_score": 0.0,
                "breakdown": {
                    "lessons_average": 0.0,
                    "quiz_score": 0.0,
                    "assignment_score": 0.0,
                    "final_assessment": 0.0
                },
                "weights_used": {},
                "assessment_availability": {}
            }
        
        # Calculate with dynamic weights
        total_score = module_progress.calculate_module_weighted_score()
        lessons_score = module_progress.calculate_module_score()
        
        return {
            "total_score": total_score,
            "breakdown": {
                "lessons_average": lessons_score,
                "quiz_score": module_progress.quiz_score or 0.0,
                "assignment_score": module_progress.assignment_score or 0.0,
                "final_assessment": module_progress.final_assessment_score or 0.0
            },
            "weights_used": {
                "lessons": "varies",  # Dynamic based on available assessments
                "quiz": "varies",
                "assignment": "varies", 
                "final": "varies"
            },
            "raw_cumulative": module_progress.cumulative_score or 0.0
        }
    
    @staticmethod
    def _generate_unlock_recommendations(prerequisite_status: Dict, lesson_requirements: Dict, scoring_breakdown: Dict) -> List[str]:
        """Generate actionable recommendations for module unlock."""
        recommendations = []
        
        if not prerequisite_status["all_completed"]:
            recommendations.append(f"Complete {len(prerequisite_status['failed_modules'])} prerequisite module(s)")
            for failed_mod in prerequisite_status["failed_modules"][:2]:  # Show top 2
                recommendations.append(f"Complete '{failed_mod['title']}' with 80%+ score")
        
        if not lesson_requirements["all_lessons_passed"]:
            recommendations.append(f"Complete {len(lesson_requirements['failed_lessons'])} lesson(s) with requirements")
            for failed_lesson in lesson_requirements["failed_lessons"][:2]:  # Show top 2
                if failed_lesson.get("requirements"):
                    recommendations.append(f"Lesson '{failed_lesson['title']}': {', '.join(failed_lesson['requirements'])}")
        
        current_score = scoring_breakdown["total_score"]
        required_score = EnhancedModuleUnlockService.MODULE_PASSING_SCORE
        
        if current_score < required_score:
            gap = required_score - current_score
            recommendations.append(f"Increase overall score by {gap:.1f}% points")
            
            # Specific scoring recommendations
            breakdown = scoring_breakdown["breakdown"]
            if breakdown["quiz_score"] < 70:
                recommendations.append("Improve quiz performance (target: 70%+)")
            if breakdown["assignment_score"] < 70:
                recommendations.append("Complete assignments with higher quality")
            if breakdown["lessons_average"] < 80:
                recommendations.append("Review lessons for better reading/engagement scores")
        
        if len(recommendations) == 0:
            recommendations.append("All requirements met! Module ready to unlock.")
        
        return recommendations[:5]  # Limit to top 5 recommendations
    
    @staticmethod
    def _safe_initialize_module_progress(student_id: int, module_id: int, enrollment_id: int) -> ModuleProgress:
        """Safely initialize module progress with proper error handling."""
        try:
            from .progression_service import ProgressionService
            return ProgressionService._initialize_module_progress(student_id, module_id, enrollment_id)
        except Exception as e:
            current_app.logger.error(f"Failed to initialize module progress: {str(e)}")
            # Create basic progress record
            progress = ModuleProgress(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id,
                status='locked',
                prerequisites_met=False
            )
            db.session.add(progress)
            db.session.commit()
            return progress
    
    @staticmethod
    def _validate_current_module_completion(student_id: int, module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """
        Validate that current module is ready for completion with STRICT lesson requirement enforcement.
        
        Module can only be completed if:
        1. ALL lessons in the module satisfy their individual requirements
        2. Module overall score >= 80%
        3. All prerequisites are met
        """
        try:
            # Get module and its lessons
            module = Module.query.get(module_id)
            if not module:
                return {
                    "can_complete": False,
                    "message": "Module not found",
                    "total_score": 0.0,
                    "breakdown": {},
                    "failed_lessons": [],
                    "validation_errors": ["Module not found"]
                }
            
            lessons = module.lessons.order_by(Lesson.order).all()
            if not lessons:
                return {
                    "can_complete": False,
                    "message": "No lessons found in module",
                    "total_score": 0.0,
                    "breakdown": {},
                    "failed_lessons": [],
                    "validation_errors": ["No lessons in module"]
                }
            
            # STRICT VALIDATION: Check each lesson individually
            failed_lessons = []
            lesson_validation_errors = []
            all_lessons_satisfied = True
            
            for lesson in lessons:
                # Check if lesson exists in completion table
                completion = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson.id
                ).first()
                
                if not completion:
                    failed_lessons.append({
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "error": "Lesson not started",
                        "requirements": ["lesson_not_started"]
                    })
                    lesson_validation_errors.append(f"Lesson '{lesson.title}' not started")
                    all_lessons_satisfied = False
                    continue
                
                # Use the enhanced lesson completion service for strict validation
                from .lesson_completion_service import LessonCompletionService
                can_complete_lesson, req_reason, lesson_requirements = LessonCompletionService.check_lesson_completion_requirements(
                    student_id, lesson.id
                )
                lesson_requirements = lesson_requirements if isinstance(lesson_requirements, dict) else {}
                lesson_requirements["can_complete"] = can_complete_lesson
                lesson_requirements["reason"] = req_reason

                if not can_complete_lesson:
                    # Get detailed missing requirements
                    missing_reqs = lesson_requirements.get("missing_requirements", [])
                    current_scores = lesson_requirements.get("current_scores", {})
                    
                    failed_lessons.append({
                        "id": lesson.id,
                        "title": lesson.title,
                        "order": lesson.order,
                        "error": f"Requirements not satisfied: {', '.join(missing_reqs)}",
                        "requirements": missing_reqs,
                        "current_scores": current_scores,
                        "lesson_score": completion.calculate_lesson_score()
                    })
                    lesson_validation_errors.append(
                        f"Lesson '{lesson.title}': {', '.join(missing_reqs) if missing_reqs else req_reason}"
                    )
                    all_lessons_satisfied = False
                
                # Additional check: Ensure lesson score meets minimum threshold
                lesson_score = completion.calculate_lesson_score()
                if lesson_score < EnhancedModuleUnlockService.LESSON_PASSING_SCORE:
                    if not any(fl["id"] == lesson.id for fl in failed_lessons):
                        failed_lessons.append({
                            "id": lesson.id,
                            "title": lesson.title,
                            "order": lesson.order,
                            "error": f"Lesson score {lesson_score:.1f}% below required {EnhancedModuleUnlockService.LESSON_PASSING_SCORE}%",
                            "requirements": [f"score_below_{EnhancedModuleUnlockService.LESSON_PASSING_SCORE}%"],
                            "current_scores": {"lesson_score": lesson_score},
                            "required_score": EnhancedModuleUnlockService.LESSON_PASSING_SCORE
                        })
                        lesson_validation_errors.append(
                            f"Lesson '{lesson.title}' score {lesson_score:.1f}% < {EnhancedModuleUnlockService.LESSON_PASSING_SCORE}%"
                        )
                        all_lessons_satisfied = False
            
            # Get module-level scoring
            scoring = EnhancedModuleUnlockService._calculate_comprehensive_module_score(
                student_id, module_id, enrollment_id
            )
            
            # STRICT MODULE VALIDATION: Module can only complete if:
            # 1. ALL lessons satisfy their requirements (already checked above)
            # 2. Module overall score >= MODULE_PASSING_SCORE
            module_score_sufficient = scoring["total_score"] >= EnhancedModuleUnlockService.MODULE_PASSING_SCORE
            
            # Compile all validation errors
            validation_errors = []
            if not all_lessons_satisfied:
                validation_errors.extend(lesson_validation_errors)
            
            if not module_score_sufficient:
                gap = EnhancedModuleUnlockService.MODULE_PASSING_SCORE - scoring["total_score"]
                validation_errors.append(f"Module score {scoring['total_score']:.1f}% < {EnhancedModuleUnlockService.MODULE_PASSING_SCORE}% (need {gap:.1f}% more)")
            
            # Final determination
            can_complete = all_lessons_satisfied and module_score_sufficient
            
            # Craft appropriate message
            if can_complete:
                message = f"Module ready for completion! All {len(lessons)} lessons satisfy requirements and module score is {scoring['total_score']:.1f}%"
            else:
                message = f"Module cannot be completed: {len(failed_lessons)} lesson(s) have unsatisfied requirements"
                if not module_score_sufficient:
                    message += f" and module score {scoring['total_score']:.1f}% is below {EnhancedModuleUnlockService.MODULE_PASSING_SCORE}%"
            
            return {
                "can_complete": can_complete,
                "message": message,
                "total_score": scoring["total_score"],
                "breakdown": scoring["breakdown"],
                "failed_lessons": failed_lessons,
                "validation_errors": validation_errors,
                "lessons_checked": len(lessons),
                "lessons_passed": len(lessons) - len(failed_lessons),
                "strict_validation": True
            }
            
        except Exception as e:
            current_app.logger.error(f"Module completion validation error: {str(e)}")
            return {
                "can_complete": False,
                "message": f"Validation error: {str(e)}",
                "total_score": 0.0,
                "breakdown": {},
                "failed_lessons": [],
                "validation_errors": [f"System error: {str(e)}"]
            }
    
    @staticmethod
    def _complete_current_module(student_id: int, module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """Mark current module as completed with proper validation."""
        try:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not module_progress:
                return {"success": False, "error": "Module progress not found"}
            
            # Calculate final score
            final_score = module_progress.calculate_module_weighted_score()
            
            # Update completion status
            module_progress.status = 'completed'
            module_progress.completed_at = datetime.utcnow()
            module_progress.cumulative_score = final_score
            
            db.session.commit()
            
            return {
                "success": True,
                "final_score": final_score,
                "completed_at": module_progress.completed_at.isoformat()
            }
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Module completion error: {str(e)}")
            return {"success": False, "error": f"Completion failed: {str(e)}"}
    
    @staticmethod
    def _perform_next_module_unlock(student_id: int, next_module_id: int, enrollment_id: int) -> Dict[str, Any]:
        """Perform the actual unlock of the next module."""
        try:
            next_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=next_module_id,
                enrollment_id=enrollment_id
            ).first()
            
            if not next_progress:
                # Create new progress record
                next_progress = ModuleProgress(
                    student_id=student_id,
                    module_id=next_module_id,
                    enrollment_id=enrollment_id,
                    status='unlocked',
                    unlocked_at=datetime.utcnow(),
                    prerequisites_met=True
                )
                db.session.add(next_progress)
            else:
                # Update existing record
                next_progress.status = 'unlocked'
                next_progress.unlocked_at = datetime.utcnow()
                next_progress.prerequisites_met = True
            
            db.session.commit()
            
            return {
                "success": True,
                "message": f"Next module unlocked successfully",
                "module_id": next_module_id,
                "unlocked_at": next_progress.unlocked_at.isoformat(),
                "unlock_type": "next_module"
            }
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Next module unlock error: {str(e)}")
            return {"success": False, "error": f"Next module unlock failed: {str(e)}"}
    
    @staticmethod
    def _check_course_completion(student_id: int, course_id: int, enrollment_id: int) -> Dict[str, Any]:
        """Check if entire course is completed and handle course completion logic."""
        try:
            course = Course.query.get(course_id)
            modules = course.modules.all()
            
            completed_modules = ModuleProgress.query.filter_by(
                student_id=student_id,
                enrollment_id=enrollment_id,
                status='completed'
            ).filter(
                ModuleProgress.module_id.in_([m.id for m in modules])
            ).all()
            
            is_completed = len(completed_modules) == len(modules)
            
            if is_completed:
                # Calculate overall course score
                total_score = sum(mp.cumulative_score or 0 for mp in completed_modules) / len(completed_modules)
                
                # Update enrollment
                enrollment = Enrollment.query.get(enrollment_id)
                enrollment.completed_at = datetime.utcnow()
                enrollment.progress = 1.0
                
                db.session.commit()
                
                return {
                    "course_completed": True,
                    "overall_score": total_score,
                    "completed_modules": len(completed_modules),
                    "total_modules": len(modules),
                    "completion_date": enrollment.completed_at.isoformat()
                }
            
            return {
                "course_completed": False,
                "completed_modules": len(completed_modules),
                "total_modules": len(modules)
            }
            
        except Exception as e:
            current_app.logger.error(f"Course completion check error: {str(e)}")
            return {"course_completed": False, "error": str(e)}
    
    @staticmethod
    def _get_next_module_info(current_module: Module) -> Optional[Dict[str, Any]]:
        """Get information about the next module in sequence."""
        next_module = current_module.course.modules.filter(
            Module.order > current_module.order
        ).order_by(Module.order).first()
        
        if next_module:
            return {
                "id": next_module.id,
                "title": next_module.title,
                "order": next_module.order,
                "lesson_count": next_module.lessons.count()
            }
        return None