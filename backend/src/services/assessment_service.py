# Assessment Service - Handle quizzes, assignments, and projects
from datetime import datetime
from typing import Dict, List, Optional, Tuple
from flask import current_app
import json

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Quiz, Question, Answer
from ..models.student_models import AssessmentAttempt, ModuleProgress
from ..utils.email_notifications import send_quiz_grade_notification


class AssessmentService:
    """Service class for handling all types of assessments"""
    
    @staticmethod
    def start_quiz_attempt(student_id: int, quiz_id: int) -> Tuple[bool, str, Dict]:
        """
        Start a new quiz attempt
        
        Args:
            student_id: ID of the student
            quiz_id: ID of the quiz
            
        Returns:
            Tuple of (success, message, attempt_data)
        """
        try:
            quiz = Quiz.query.get(quiz_id)
            if not quiz:
                return False, "Quiz not found", {}
            
            module = quiz.module
            course = module.course
            
            # Check enrollment
            enrollment = db.session.query(Enrollment).filter_by(
                user_id=student_id, course_id=course.id
            ).first()
            
            if not enrollment:
                return False, "Not enrolled in course", {}
            
            # Check if module is unlocked
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not module_progress or module_progress.status == 'locked':
                return False, "Module is locked", {}
            
            # Check existing attempts
            existing_attempts = AssessmentAttempt.query.filter_by(
                student_id=student_id,
                assessment_type='quiz',
                assessment_id=quiz_id,
                module_id=module.id
            ).count()
            
            # Allow multiple attempts for quizzes (best score counts)
            attempt_number = existing_attempts + 1
            
            # Create new attempt
            attempt = AssessmentAttempt(
                student_id=student_id,
                assessment_type='quiz',
                assessment_id=quiz_id,
                module_id=module.id,
                attempt_number=attempt_number,
                max_score=float(len(quiz.questions)),
                status='in_progress'
            )
            
            db.session.add(attempt)
            db.session.commit()
            
            # Prepare quiz data for student (without correct answers)
            quiz_data = {
                "quiz": quiz.to_dict(),
                "questions": [
                    {
                        "id": q.id,
                        "question_text": q.question_text,
                        "question_type": q.question_type,
                        "options": [
                            {"id": opt.id, "option_text": opt.option_text}
                            for opt in q.answers
                        ]
                    }
                    for q in quiz.questions
                ],
                "attempt": attempt.to_dict(),
                "time_limit": quiz.time_limit,
                "instructions": quiz.instructions
            }
            
            return True, "Quiz attempt started", quiz_data
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Quiz start error: {str(e)}")
            return False, "Failed to start quiz", {}
    
    @staticmethod
    def submit_quiz_attempt(attempt_id: int, answers: List[Dict]) -> Tuple[bool, str, Dict]:
        """
        Submit quiz answers and calculate score
        
        Args:
            attempt_id: ID of the attempt
            answers: List of answer dictionaries
            
        Returns:
            Tuple of (success, message, result_data)
        """
        try:
            attempt = AssessmentAttempt.query.get(attempt_id)
            if not attempt:
                return False, "Attempt not found", {}
            
            if attempt.status != 'in_progress':
                return False, "Attempt already submitted", {}
            
            quiz = Quiz.query.get(attempt.assessment_id)
            
            # Calculate score
            correct_answers = 0
            total_questions = len(quiz.questions)
            detailed_results = []
            
            for answer_data in answers:
                question_id = answer_data.get('question_id')
                selected_answer_ids = answer_data.get('selected_answers', [])
                
                question = Question.query.get(question_id)
                if not question:
                    continue
                
                correct_answer_ids = [
                    ans.id for ans in question.answers if ans.is_correct
                ]
                
                # Check if answer is correct
                is_correct = set(selected_answer_ids) == set(correct_answer_ids)
                if is_correct:
                    correct_answers += 1
                
                detailed_results.append({
                    "question_id": question_id,
                    "question_text": question.question_text,
                    "selected_answers": selected_answer_ids,
                    "correct_answers": correct_answer_ids,
                    "is_correct": is_correct,
                    "explanation": question.explanation
                })
            
            # Calculate scores with proper validation
            score = float(correct_answers)
            percentage = round((score / total_questions * 100), 2) if total_questions > 0 else 0
            
            # Ensure percentage is within valid range
            percentage = max(0, min(100, percentage))
            
            # Update attempt with validated data
            attempt.score = score
            attempt.percentage = percentage
            attempt.submission_data = json.dumps({
                "answers": answers,
                "detailed_results": detailed_results,
                "timestamp": datetime.utcnow().isoformat()
            })
            attempt.submitted_at = datetime.utcnow()
            attempt.status = 'submitted'
            
            # Update module progress quiz score (30% of total)
            AssessmentService._update_module_quiz_score(
                attempt.student_id, attempt.module_id, percentage
            )
            
            db.session.commit()
            
            # Send email notification to student about quiz grade with improved error handling
            try:
                student = User.query.get(attempt.student_id)
                if student and student.email:
                    send_quiz_grade_notification(
                        student=student,
                        quiz=quiz,
                        score=int(score),
                        total_points=total_questions
                    )
                    current_app.logger.info(f"✅ Quiz grade notification sent to {student.email} for quiz '{quiz.title}'")
                else:
                    current_app.logger.warning(f"⚠️ Invalid student data for quiz attempt {attempt_id}")
            except Exception as email_error:
                current_app.logger.error(f"❌ Failed to send quiz grade notification: {str(email_error)}")
                # Don't fail the request if email fails
            
            result_data = {
                "attempt": attempt.to_dict(),
                "score": int(score),
                "percentage": percentage,
                "total_questions": total_questions,
                "correct_answers": correct_answers,
                "quiz_title": quiz.title,
                "passed": percentage >= 60,
                "detailed_results": detailed_results
            }
            
            return True, "Quiz submitted successfully", result_data
            
        except ValueError as ve:
            db.session.rollback()
            current_app.logger.error(f"❌ Quiz submission validation error: {str(ve)}")
            return False, f"Validation error: {str(ve)}", {}
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"❌ Quiz submission error: {str(e)}", exc_info=True)
            return False, "Failed to submit quiz", {}
    
    @staticmethod
    def start_assignment(student_id: int, assignment_id: int) -> Tuple[bool, str, Dict]:
        """
        Start working on an assignment
        
        Args:
            student_id: ID of the student
            assignment_id: ID of the assignment
            
        Returns:
            Tuple of (success, message, assignment_data)
        """
        try:
            # Note: This assumes Assignment model exists in course_models
            # You may need to import it or create it
            assignment = db.session.query(Assignment).get(assignment_id)
            if not assignment:
                return False, "Assignment not found", {}
            
            module = assignment.module
            course = module.course
            
            # Check enrollment and module access
            enrollment = db.session.query(Enrollment).filter_by(
                user_id=student_id, course_id=course.id
            ).first()
            
            if not enrollment:
                return False, "Not enrolled in course", {}
            
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module.id,
                enrollment_id=enrollment.id
            ).first()
            
            if not module_progress or module_progress.status == 'locked':
                return False, "Module is locked", {}
            
            # Check existing attempts
            existing_attempts = AssessmentAttempt.query.filter_by(
                student_id=student_id,
                assessment_type='assignment',
                assessment_id=assignment_id,
                module_id=module.id
            ).count()
            
            max_attempts = 3  # Allow up to 3 submission attempts
            if existing_attempts >= max_attempts:
                return False, f"Maximum attempts ({max_attempts}) reached", {}
            
            attempt_number = existing_attempts + 1
            
            # Create new attempt
            attempt = AssessmentAttempt(
                student_id=student_id,
                assessment_type='assignment',
                assessment_id=assignment_id,
                module_id=module.id,
                attempt_number=attempt_number,
                max_score=float(assignment.max_points),
                status='in_progress'
            )
            
            db.session.add(attempt)
            db.session.commit()
            
            assignment_data = {
                "assignment": assignment.to_dict(),
                "attempt": attempt.to_dict(),
                "attempt_number": attempt_number,
                "max_attempts": max_attempts,
                "rubric": json.loads(assignment.rubric) if assignment.rubric else None
            }
            
            return True, "Assignment started", assignment_data
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Assignment start error: {str(e)}")
            return False, "Failed to start assignment", {}
    
    @staticmethod
    def submit_assignment(attempt_id: int, submission_data: Dict) -> Tuple[bool, str, Dict]:
        """
        Submit assignment for grading
        
        Args:
            attempt_id: ID of the attempt
            submission_data: Assignment submission data
            
        Returns:
            Tuple of (success, message, submission_result)
        """
        try:
            attempt = AssessmentAttempt.query.get(attempt_id)
            if not attempt:
                return False, "Attempt not found", {}
            
            if attempt.status != 'in_progress':
                return False, "Attempt already submitted", {}
            
            # Update attempt with submission
            attempt.submission_data = json.dumps(submission_data)
            attempt.submitted_at = datetime.utcnow()
            attempt.status = 'submitted'
            
            db.session.commit()
            
            return True, "Assignment submitted for grading", attempt.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Assignment submission error: {str(e)}")
            return False, "Failed to submit assignment", {}
    
    @staticmethod
    def grade_assignment(attempt_id: int, grader_id: int, score: float, feedback: str) -> Tuple[bool, str, Dict]:
        """
        Grade an assignment (instructor/TA function)
        
        Args:
            attempt_id: ID of the attempt to grade
            grader_id: ID of the grader
            score: Score assigned
            feedback: Grading feedback
            
        Returns:
            Tuple of (success, message, graded_result)
        """
        try:
            attempt = AssessmentAttempt.query.get(attempt_id)
            if not attempt:
                return False, "Attempt not found", {}
            
            if attempt.status != 'submitted':
                return False, "Attempt not ready for grading", {}
            
            # Update attempt with grade
            attempt.score = score
            attempt.percentage = (score / attempt.max_score * 100) if attempt.max_score > 0 else 0
            attempt.feedback = feedback
            attempt.graded_by = grader_id
            attempt.graded_at = datetime.utcnow()
            attempt.status = 'graded'
            
            # Update module progress assignment score (40% of total)
            AssessmentService._update_module_assignment_score(
                attempt.student_id, attempt.module_id, attempt.percentage
            )
            
            db.session.commit()
            
            return True, "Assignment graded successfully", attempt.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Assignment grading error: {str(e)}")
            return False, "Failed to grade assignment", {}
    
    @staticmethod
    def start_final_assessment(student_id: int, module_id: int) -> Tuple[bool, str, Dict]:
        """
        Start final module assessment
        
        Args:
            student_id: ID of the student
            module_id: ID of the module
            
        Returns:
            Tuple of (success, message, assessment_data)
        """
        try:
            module = Module.query.get(module_id)
            if not module:
                return False, "Module not found", {}
            
            # Check if all prerequisites are met
            # (all lessons completed, quizzes taken, assignments submitted)
            prerequisites_met = AssessmentService._check_final_assessment_prerequisites(
                student_id, module_id
            )
            
            if not prerequisites_met:
                return False, "Complete all module requirements first", {}
            
            # Check existing attempts
            existing_attempts = AssessmentAttempt.query.filter_by(
                student_id=student_id,
                assessment_type='final_assessment',
                module_id=module_id
            ).count()
            
            if existing_attempts >= 3:  # Max 3 attempts
                return False, "Maximum attempts reached", {}
            
            attempt_number = existing_attempts + 1
            
            # Create final assessment attempt
            attempt = AssessmentAttempt(
                student_id=student_id,
                assessment_type='final_assessment',
                assessment_id=module_id,  # Use module_id as assessment_id
                module_id=module_id,
                attempt_number=attempt_number,
                max_score=100.0,  # Final assessment out of 100
                status='in_progress'
            )
            
            db.session.add(attempt)
            db.session.commit()
            
            # Generate final assessment questions/tasks
            assessment_data = AssessmentService._generate_final_assessment(module)
            assessment_data["attempt"] = attempt.to_dict()
            
            return True, "Final assessment started", assessment_data
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Final assessment start error: {str(e)}")
            return False, "Failed to start final assessment", {}
    
    @staticmethod
    def submit_final_assessment(attempt_id: int, submission_data: Dict) -> Tuple[bool, str, Dict]:
        """
        Submit final assessment for grading
        
        Args:
            attempt_id: ID of the attempt
            submission_data: Assessment submission data
            
        Returns:
            Tuple of (success, message, result)
        """
        try:
            attempt = AssessmentAttempt.query.get(attempt_id)
            if not attempt:
                return False, "Attempt not found", {}
            
            # Auto-grade or mark for manual grading
            auto_score = AssessmentService._auto_grade_final_assessment(submission_data)
            
            attempt.submission_data = json.dumps(submission_data)
            attempt.submitted_at = datetime.utcnow()
            
            if auto_score is not None:
                attempt.score = auto_score
                attempt.percentage = auto_score
                attempt.status = 'graded'
                
                # Update module progress final assessment score (20% of total)
                AssessmentService._update_module_final_score(
                    attempt.student_id, attempt.module_id, auto_score
                )
            else:
                attempt.status = 'submitted'  # Needs manual grading
            
            db.session.commit()
            
            return True, "Final assessment submitted", attempt.to_dict()
            
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Final assessment submission error: {str(e)}")
            return False, "Failed to submit final assessment", {}
    
    @staticmethod
    def get_student_assessment_history(student_id: int, module_id: int = None) -> List[Dict]:
        """Get assessment history for a student"""
        query = AssessmentAttempt.query.filter_by(student_id=student_id)
        
        if module_id:
            query = query.filter_by(module_id=module_id)
        
        attempts = query.order_by(AssessmentAttempt.started_at.desc()).all()
        return [attempt.to_dict() for attempt in attempts]
    
    @staticmethod
    def _update_module_quiz_score(student_id: int, module_id: int, percentage: float):
        """Update quiz score in module progress (30% weight)"""
        from ..models.course_models import Enrollment
        
        enrollment = db.session.query(Enrollment).join(Course).join(Module).filter(
            Module.id == module_id, Enrollment.user_id == student_id
        ).first()
        
        if enrollment:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment.id
            ).first()
            
            if module_progress:
                # Use best quiz score
                module_progress.quiz_score = max(module_progress.quiz_score, percentage)
                module_progress.calculate_cumulative_score()
    
    @staticmethod
    def _update_module_assignment_score(student_id: int, module_id: int, percentage: float):
        """Update assignment score in module progress (40% weight)"""
        from ..models.course_models import Enrollment
        
        enrollment = db.session.query(Enrollment).join(Course).join(Module).filter(
            Module.id == module_id, Enrollment.user_id == student_id
        ).first()
        
        if enrollment:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment.id
            ).first()
            
            if module_progress:
                # Use best assignment score
                module_progress.assignment_score = max(module_progress.assignment_score, percentage)
                module_progress.calculate_cumulative_score()
    
    @staticmethod
    def _update_module_final_score(student_id: int, module_id: int, percentage: float):
        """Update final assessment score in module progress (20% weight)"""
        from ..models.course_models import Enrollment
        
        enrollment = db.session.query(Enrollment).join(Course).join(Module).filter(
            Module.id == module_id, Enrollment.user_id == student_id
        ).first()
        
        if enrollment:
            module_progress = ModuleProgress.query.filter_by(
                student_id=student_id,
                module_id=module_id,
                enrollment_id=enrollment.id
            ).first()
            
            if module_progress:
                module_progress.final_assessment_score = percentage
                module_progress.calculate_cumulative_score()
                
                # Check if module can be completed
                from .progression_service import ProgressionService
                ProgressionService.check_module_completion(
                    student_id, module_id, enrollment.id
                )
    
    @staticmethod
    def _check_final_assessment_prerequisites(student_id: int, module_id: int) -> bool:
        """Check if student has completed all module requirements"""
        module = Module.query.get(module_id)
        
        # Check lesson completion
        total_lessons = module.lessons.count()
        completed_lessons = db.session.query(LessonCompletion).join(Lesson).filter(
            Lesson.module_id == module_id,
            LessonCompletion.student_id == student_id
        ).count()
        
        if completed_lessons < total_lessons:
            return False
        
        # Check quiz attempts
        quiz_attempts = AssessmentAttempt.query.filter_by(
            student_id=student_id,
            module_id=module_id,
            assessment_type='quiz'
        ).count()
        
        # Require at least one quiz attempt
        if quiz_attempts == 0:
            return False
        
        return True
    
    @staticmethod
    def _generate_final_assessment(module: Module) -> Dict:
        """Generate final assessment content"""
        # This is a simplified version - in reality, you'd have more complex logic
        return {
            "title": f"Final Assessment - {module.title}",
            "description": f"Comprehensive assessment covering all topics in {module.title}",
            "questions": [
                {
                    "type": "essay",
                    "question": f"Explain the key concepts learned in {module.title}",
                    "points": 50
                },
                {
                    "type": "practical",
                    "question": "Complete the hands-on project demonstrating your skills",
                    "points": 50
                }
            ],
            "time_limit": 120,  # 2 hours
            "instructions": "Complete all sections. Save your work frequently."
        }
    
    @staticmethod
    def _auto_grade_final_assessment(submission_data: Dict) -> Optional[float]:
        """Auto-grade final assessment if possible"""
        # For now, return None to indicate manual grading needed
        # In the future, this could use AI/ML for automated grading
        return None