# Comprehensive Grading Routes for Afritec Bridge LMS
# Handles grading for assignments, projects, and quiz review

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from sqlalchemy import func, and_, or_, desc, case
from datetime import datetime, timedelta
import logging
import json
import math
import statistics

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Module, Assignment, AssignmentSubmission, 
    Project, ProjectSubmission, Quiz, Submission, Enrollment, Lesson
)
from ..models.student_models import AssessmentAttempt, LessonCompletion
from ..utils.email_notifications import send_grade_notification, send_project_graded_notification

logger = logging.getLogger(__name__)

# Helper for role checking
from functools import wraps

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        current_user_id = get_jwt_identity()
        user = User.query.get(current_user_id)
        if not user or not user.role or user.role.name not in ['instructor', 'admin']:
            return jsonify({"message": "Instructor access required"}), 403
        return f(*args, **kwargs)
    return decorated_function

grading_bp = Blueprint("grading_bp", __name__, url_prefix="/api/v1/grading")

# =====================
# ASSIGNMENT GRADING
# =====================

@grading_bp.route("/assignments/submissions", methods=["GET"])
@instructor_required
def get_assignment_submissions():
    """
    Get assignment submissions for grading with filtering options.
    Query params: course_id, assignment_id, status (pending/graded/all), student_id
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get filter parameters
        course_id = request.args.get('course_id', type=int)
        assignment_id = request.args.get('assignment_id', type=int)
        status = request.args.get('status', 'pending')  # pending, graded, all
        student_id = request.args.get('student_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        search_query = request.args.get('search_query', type=str)
        sort_by = request.args.get('sort_by', 'submitted_at')
        sort_order = request.args.get('sort_order', 'desc')
        date_start = request.args.get('date_start')
        date_end = request.args.get('date_end')
        
        # Build query
        query = db.session.query(AssignmentSubmission).join(Assignment).join(Course)
        
        # Filter by instructor's courses
        query = query.filter(Course.instructor_id == current_user_id)
        
        # Apply filters
        if course_id:
            query = query.filter(Assignment.course_id == course_id)
        
        if assignment_id:
            query = query.filter(AssignmentSubmission.assignment_id == assignment_id)
        
        if student_id:
            query = query.filter(AssignmentSubmission.student_id == student_id)
        
        # Status filter
        if status == 'pending':
            query = query.filter(AssignmentSubmission.grade.is_(None))
        elif status == 'graded':
            query = query.filter(AssignmentSubmission.grade.isnot(None))
        
        # Search functionality
        if search_query:
            search_filter = or_(
                User.first_name.ilike(f'%{search_query}%'),
                User.last_name.ilike(f'%{search_query}%'),
                User.email.ilike(f'%{search_query}%'),
                Assignment.title.ilike(f'%{search_query}%'),
                AssignmentSubmission.content.ilike(f'%{search_query}%')
            )
            query = query.join(User, User.id == AssignmentSubmission.student_id)
            query = query.filter(search_filter)
        
        # Date range filtering
        if date_start:
            query = query.filter(AssignmentSubmission.submitted_at >= datetime.fromisoformat(date_start))
        if date_end:
            query = query.filter(AssignmentSubmission.submitted_at <= datetime.fromisoformat(date_end))
        
        # Calculate priority scores for sorting
        priority_score = case(
            (and_(Assignment.due_date < datetime.utcnow(), AssignmentSubmission.grade.is_(None)), 3),  # Overdue
            (Assignment.due_date < datetime.utcnow() + timedelta(days=1), 2),  # Due soon
            else_=1
        )
        
        # Enhanced sorting options
        sort_mapping = {
            'submitted_at': AssignmentSubmission.submitted_at,
            'due_date': Assignment.due_date,
            'student_name': User.last_name,
            'grade': AssignmentSubmission.grade,
            'priority': priority_score,
            'days_late': func.greatest(0, func.date_part('day', AssignmentSubmission.submitted_at - Assignment.due_date))
        }
        
        if sort_by in sort_mapping:
            sort_column = sort_mapping[sort_by]
            if sort_order == 'desc':
                query = query.order_by(desc(sort_column))
            else:
                query = query.order_by(sort_column)
        else:
            # Default order by priority and submission date
            query = query.order_by(
                desc(priority_score),
                AssignmentSubmission.grade.is_(None).desc(),
                AssignmentSubmission.submitted_at.desc()
            )
        
        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Build response
        submissions_data = []
        for submission in paginated.items:
            submission_dict = submission.to_dict()
            # Add assignment details
            submission_dict['assignment_title'] = submission.assignment.title
            submission_dict['assignment_points'] = submission.assignment.points_possible
            submission_dict['course_title'] = submission.assignment.course.title
            submission_dict['course_id'] = submission.assignment.course_id
            submission_dict['due_date'] = submission.assignment.due_date.isoformat() if submission.assignment.due_date else None
            
            # Calculate days late
            days_late = 0
            if submission.assignment.due_date and submission.submitted_at:
                time_diff = submission.submitted_at - submission.assignment.due_date
                days_late = max(0, time_diff.days + time_diff.seconds / 86400)
            
            # Enhanced metrics
            content = submission.content or ''
            word_count = len(content.split()) if content else 0
            reading_time = max(1, word_count // 200)  # ~200 words per minute
            
            # Priority calculation
            priority_level = 'low'
            if days_late > 0 and not submission.grade:
                priority_level = 'high'
            elif submission.assignment.due_date and submission.assignment.due_date < datetime.utcnow() + timedelta(days=1):
                priority_level = 'medium'
            
            # Estimated grading time
            estimated_time = max(5, min(30, reading_time + word_count // 100))
            
            submission_dict['days_late'] = days_late
            submission_dict['student_name'] = f"{submission.student.first_name} {submission.student.last_name}"
            submission_dict['student_email'] = submission.student.email
            submission_dict['word_count'] = word_count
            submission_dict['reading_time'] = reading_time
            submission_dict['priority_level'] = priority_level
            submission_dict['estimated_grading_time'] = estimated_time
            
            submissions_data.append(submission_dict)
        
        # Generate analytics for the current set of submissions
        analytics = generate_grading_analytics(paginated.items, current_user_id, course_id)
        
        return jsonify({
            'submissions': submissions_data,
            'pagination': {
                'page': paginated.page,
                'per_page': paginated.per_page,
                'total': paginated.total,
                'pages': paginated.pages
            },
            'analytics': analytics
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching assignment submissions: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch submissions", "error": str(e)}), 500


@grading_bp.route("/assignments/submissions/<int:submission_id>", methods=["GET"])
@instructor_required
def get_assignment_submission_detail(submission_id):
    """Get detailed view of a single assignment submission for grading."""
    try:
        current_user_id = int(get_jwt_identity())
        
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Build detailed response
        submission_dict = submission.to_dict()
        
        # Add comprehensive assignment details
        assignment_data = submission.assignment.to_dict()
        submission_dict['assignment'] = assignment_data
        submission_dict['assignment_title'] = assignment_data['title']
        submission_dict['assignment_points'] = assignment_data['points_possible']
        
        # Enhanced course information
        submission_dict['course'] = {
            'id': submission.assignment.course.id,
            'title': submission.assignment.course.title,
            'instructor_name': f"{submission.assignment.course.instructor.first_name} {submission.assignment.course.instructor.last_name}" if submission.assignment.course.instructor else None
        }
        submission_dict['course_title'] = submission.assignment.course.title
        
        # Calculate submission timing
        submission_dict['days_late'] = 0
        if submission.assignment.due_date and submission.submitted_at:
            days_late = (submission.submitted_at - submission.assignment.due_date).days
            submission_dict['days_late'] = max(0, days_late)
        
        # Add comprehensive student info
        student = submission.student
        submission_dict['student_info'] = {
            'id': student.id,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'username': student.username,
            'first_name': student.first_name,
            'last_name': student.last_name
        }
        
        # Get student's other submissions for this assignment (attempt history)
        previous_submissions = AssignmentSubmission.query.filter(
            AssignmentSubmission.student_id == submission.student_id,
            AssignmentSubmission.assignment_id == submission.assignment_id,
            AssignmentSubmission.id != submission_id
        ).order_by(AssignmentSubmission.submitted_at.desc()).all()
        
        submission_dict['previous_attempts'] = [
            {
                'id': sub.id,
                'submitted_at': sub.submitted_at.isoformat(),
                'grade': sub.grade
            } for sub in previous_submissions
        ]
        
        return jsonify(submission_dict), 200
        
    except Exception as e:
        logger.error(f"Error fetching submission detail: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch submission", "error": str(e)}), 500


@grading_bp.route("/assignments/submissions/<int:submission_id>/grade", methods=["POST", "PUT"])
@instructor_required
def grade_assignment_submission(submission_id):
    """
    Grade an assignment submission.
    Body: { grade: float, feedback: string, rubric_scores: {...} }
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submission = AssignmentSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Validate grade with improved error handling
        grade = data.get('grade')
        if grade is None:
            return jsonify({"message": "Grade is required"}), 400
        
        try:
            grade = float(grade)
            max_points = submission.assignment.points_possible or 100
            if grade < 0 or grade > max_points:
                return jsonify({
                    "message": f"Grade must be between 0 and {max_points}"
                }), 400
        except (ValueError, TypeError) as e:
            return jsonify({"message": f"Invalid grade value: {str(e)}"}), 400
        
        # Update submission with validated data
        submission.grade = grade
        submission.feedback = data.get('feedback', '').strip()
        submission.graded_at = datetime.utcnow()
        submission.graded_by = current_user_id
        
        # Store rubric scores if provided with better structure
        rubric_scores = data.get('rubric_scores')
        if rubric_scores and isinstance(rubric_scores, dict):
            rubric_data = {
                'feedback': submission.feedback,
                'rubric_scores': rubric_scores,
                'graded_at': submission.graded_at.isoformat(),
                'graded_by': current_user_id,
                'version': '1.0'  # For future compatibility
            }
            # Store as properly formatted JSON
            submission.feedback = json.dumps(rubric_data, indent=2)
        
        db.session.commit()
        
        # ===== FIX: Update module progress with assignment score =====
        try:
            from ..models.student_models import ModuleProgress
            
            assignment = submission.assignment
            student_id = submission.student_id
            
            # Calculate percentage score with validation
            points_possible = assignment.points_possible or 100
            if points_possible > 0:
                percentage_score = round((grade / points_possible) * 100, 2)
                percentage_score = max(0, min(100, percentage_score))  # Clamp to 0-100
            else:
                percentage_score = 0
            
            # Get module_id from assignment (with fallback logic)
            module_id = getattr(assignment, 'module_id', None)
            if not module_id and hasattr(assignment, 'lesson_id') and assignment.lesson_id:
                lesson = Lesson.query.get(assignment.lesson_id)
                if lesson and hasattr(lesson, 'module_id'):
                    module_id = lesson.module_id
            
            if module_id:
                # Get enrollment with validation
                enrollment = Enrollment.query.filter_by(
                    student_id=student_id,
                    course_id=assignment.course_id
                ).first()
                
                if enrollment:
                    module_progress = ModuleProgress.query.filter_by(
                        student_id=student_id,
                        module_id=module_id,
                        enrollment_id=enrollment.id
                    ).first()
                    
                    if module_progress:
                        # Use best assignment score (keep the higher score)
                        current_assignment_score = module_progress.assignment_score or 0.0
                        new_score = max(current_assignment_score, percentage_score)
                        module_progress.assignment_score = new_score
                        
                        # Safely update cumulative score
                        if hasattr(module_progress, 'calculate_cumulative_score'):
                            module_progress.calculate_cumulative_score()
                        
                        db.session.commit()
                        logger.info(f"✅ Updated module {module_id} assignment score for student {student_id}: {new_score}%")
                    else:
                        logger.warning(f"⚠️ Module progress not found for student {student_id}, module {module_id}")
                else:
                    logger.warning(f"⚠️ Enrollment not found for student {student_id}, course {assignment.course_id}")
            else:
                logger.warning(f"⚠️ Module ID not found for assignment {assignment.id}")
                
        except Exception as mp_error:
            logger.error(f"❌ Error updating module progress: {str(mp_error)}")
            # Don't fail the whole request, just log the error
        # ===== END FIX =====
        
        # ===== FIX: Create/Update LessonCompletion for assignment score =====
        try:
            assignment = submission.assignment
            student_id = submission.student_id
            lesson_id = getattr(assignment, 'lesson_id', None)
            
            if lesson_id:
                lesson_completion = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson_id
                ).first()
                
                # Calculate assignment percentage for reference with validation
                points_possible = assignment.points_possible or 100
                if points_possible > 0:
                    assignment_percentage = round((grade / points_possible) * 100, 2)
                    assignment_percentage = max(0, min(100, assignment_percentage))
                else:
                    assignment_percentage = 0
                
                # Use the enhanced lesson completion service to handle updates
                from ..services.lesson_completion_service import LessonCompletionService
                
                # Update lesson scores using the enhanced scoring system
                score_updated = LessonCompletionService.update_lesson_score_after_assignment_grading(
                    student_id, lesson_id
                )
                
                if score_updated:
                    logger.info(f"✅ Lesson score updated after assignment grading - Student: {student_id}, Lesson: {lesson_id}")
                    
                    # Get the updated score breakdown for logging
                    breakdown = LessonCompletionService.get_lesson_score_breakdown(student_id, lesson_id)
                    logger.info(f"📊 New lesson score breakdown: {breakdown['lesson_score']:.1f}% "
                              f"(Reading: {breakdown['reading_component']:.1f}%, "
                              f"Engagement: {breakdown['engagement_component']:.1f}%, "
                              f"Assignment: {breakdown['assignment_component']:.1f}%)")
                else:
                    logger.warning(f"⚠️ Failed to update lesson score after assignment grading")
                
                # Check if lesson can now be completed with the new scores
                lesson_completion = LessonCompletion.query.filter_by(
                    student_id=student_id, lesson_id=lesson_id
                ).first()
                
                if lesson_completion:
                    # Check completion requirements with updated scores
                    can_complete, reason, requirements = LessonCompletionService.check_lesson_completion_requirements(
                        student_id, lesson_id
                    )
                    
                    if can_complete and not lesson_completion.completed:
                        # Auto-complete the lesson since all requirements are now met
                        success, message, completion_data = LessonCompletionService.attempt_lesson_completion(
                            student_id, lesson_id
                        )
                        if success:
                            logger.info(f"🎯 Lesson {lesson_id} auto-completed for student {student_id} after assignment grading: {message}")
                    
                    # Log the current completion status
                    logger.info(f"📋 Lesson completion status - Can complete: {can_complete}, Reason: {reason}")
                
        except Exception as lc_error:
            logger.warning(f"❌ Error updating lesson completion after assignment grading: {str(lc_error)}")
            # Don't fail the whole request, just log the error
        # ===== END LessonCompletion FIX =====
        
        # Send email notification to student about grade
        email_sent = False
        try:
            student = User.query.get(submission.student_id)
            if student and student.email:
                logger.info(f"📧 Preparing grade notification for student {student.email}")
                logger.info(f"   Assignment: {submission.assignment.title if submission.assignment else 'N/A'}")
                logger.info(f"   Grade: {grade}/100")
                
                email_sent = send_grade_notification(
                    submission=submission,
                    assignment=submission.assignment,
                    student=student,
                    grade=grade,
                    feedback=data.get('feedback', '')
                )
                
                if email_sent:
                    logger.info(f"✅ Grade notification sent successfully to {student.email}")
                else:
                    logger.warning(f"⚠️ Grade notification failed to send to {student.email}")
            else:
                logger.warning(f"⚠️ Cannot send grade notification - student not found or no email")
        except Exception as email_error:
            logger.error(f"❌ Error sending grade notification: {str(email_error)}")
            # Don't fail the request if email fails
        
        # Send grade notification email with improved error handling
        try:
            student = User.query.get(submission.student_id)
            if student and student.email and hasattr(student, 'first_name'):
                # Import here to avoid circular imports
                from ..utils.email_notifications import send_grade_notification
                
                send_grade_notification(
                    submission=submission,
                    assignment=assignment,
                    student=student,
                    grade=grade,
                    feedback=data.get('feedback', '')
                )
                logger.info(f"✅ Assignment grade notification sent to {student.email}")
            else:
                logger.warning(f"⚠️ Invalid student data for assignment submission {submission_id}")
        except Exception as email_error:
            logger.error(f"❌ Failed to send assignment grade notification: {str(email_error)}")
            # Don't fail the request if email fails
        
        logger.info(f"✅ Assignment submission {submission_id} graded successfully by instructor {current_user_id}")
        
        return jsonify({
            "message": "Assignment graded successfully",
            "submission": submission.to_dict(),
            "grade": grade,
            "percentage": round((grade / (assignment.points_possible or 100)) * 100, 2)
        }), 200
        
    except ValueError as ve:
        db.session.rollback()
        logger.error(f"❌ Validation error in assignment grading: {str(ve)}")
        return jsonify({"message": "Validation error", "error": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error grading assignment: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to grade assignment", "error": str(e)}), 500


@grading_bp.route("/assignments/submissions/bulk-grade", methods=["POST"])
@instructor_required
def bulk_grade_assignments():
    """
    Grade multiple assignment submissions at once.
    Body: { submissions: [{ id: int, grade: float, feedback: string }, ...] }
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submissions_to_grade = data.get('submissions', [])
        if not submissions_to_grade:
            return jsonify({"message": "No submissions provided"}), 400
        
        graded_count = 0
        errors = []
        
        for item in submissions_to_grade:
            try:
                submission_id = item.get('id')
                grade = item.get('grade')
                feedback = item.get('feedback', '')
                
                if submission_id is None or grade is None:
                    errors.append(f"Submission {submission_id}: Missing grade or id")
                    continue
                
                submission = AssignmentSubmission.query.get(submission_id)
                if not submission:
                    errors.append(f"Submission {submission_id}: Not found")
                    continue
                
                # Verify instructor owns the course
                if submission.assignment.course.instructor_id != current_user_id:
                    errors.append(f"Submission {submission_id}: Access denied")
                    continue
                
                # Validate grade
                grade = float(grade)
                if grade < 0 or grade > submission.assignment.points_possible:
                    errors.append(f"Submission {submission_id}: Invalid grade value")
                    continue
                
                # Update submission
                submission.grade = grade
                submission.feedback = feedback
                submission.graded_at = datetime.utcnow()
                submission.graded_by = current_user_id
                
                # Create/Update LessonCompletion for this assignment
                try:
                    assignment = submission.assignment
                    lesson_id = assignment.lesson_id if hasattr(assignment, 'lesson_id') else None
                    
                    if lesson_id:
                        # Calculate assignment percentage
                        points_possible = assignment.points_possible or 100
                        assignment_percentage = (grade / points_possible) * 100
                        
                        lesson_completion = LessonCompletion.query.filter_by(
                            student_id=submission.student_id,
                            lesson_id=lesson_id
                        ).first()
                        
                        if not lesson_completion:
                            # Create with reasonable defaults based on assignment grade
                            default_reading = min(100.0, 70.0 + (assignment_percentage * 0.3))
                            default_engagement = min(100.0, 60.0 + (assignment_percentage * 0.4))
                            
                            lesson_completion = LessonCompletion(
                                student_id=submission.student_id,
                                lesson_id=lesson_id,
                                completed=True,
                                reading_progress=default_reading,
                                engagement_score=default_engagement,
                                scroll_progress=default_reading,
                                time_spent=300,
                                completed_at=datetime.utcnow(),
                                updated_at=datetime.utcnow(),
                                last_accessed=datetime.utcnow()
                            )
                            db.session.add(lesson_completion)
                            logger.info(f"Created LessonCompletion for lesson {lesson_id}, student {submission.student_id} (bulk grading)")
                        else:
                            # Boost scores if too low and assignment grade is good
                            if lesson_completion.reading_progress < 50.0 and assignment_percentage >= 70:
                                new_reading = min(100.0, 70.0 + (assignment_percentage * 0.3))
                                if new_reading > lesson_completion.reading_progress:
                                    lesson_completion.reading_progress = new_reading
                                    lesson_completion.scroll_progress = new_reading
                            
                            if lesson_completion.engagement_score < 50.0 and assignment_percentage >= 70:
                                new_engagement = min(100.0, 60.0 + (assignment_percentage * 0.4))
                                if new_engagement > lesson_completion.engagement_score:
                                    lesson_completion.engagement_score = new_engagement
                            
                            lesson_completion.updated_at = datetime.utcnow()
                except Exception as lc_error:
                    logger.warning(f"Error creating LessonCompletion for submission {submission_id}: {str(lc_error)}")
                
                graded_count += 1
                
            except Exception as e:
                errors.append(f"Submission {item.get('id')}: {str(e)}")
        
        db.session.commit()
        
        return jsonify({
            "message": f"Successfully graded {graded_count} submissions",
            "graded_count": graded_count,
            "errors": errors if errors else None
        }), 200
        
    except Exception as e:
        db.session.rollback()
        logger.error(f"Error in bulk grading: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to bulk grade", "error": str(e)}), 500


# =====================
# PROJECT GRADING
# =====================

@grading_bp.route("/projects/submissions", methods=["GET"])
@instructor_required
def get_project_submissions():
    """
    Get project submissions for grading with filtering options.
    Query params: course_id, project_id, status (pending/graded/all), student_id
    """
    try:
        current_user_id = int(get_jwt_identity())
        
        # Get filter parameters
        course_id = request.args.get('course_id', type=int)
        project_id = request.args.get('project_id', type=int)
        status = request.args.get('status', 'pending')
        student_id = request.args.get('student_id', type=int)
        page = request.args.get('page', 1, type=int)
        per_page = request.args.get('per_page', 20, type=int)
        
        # Build query
        query = db.session.query(ProjectSubmission).join(Project).join(Course)
        
        # Filter by instructor's courses
        query = query.filter(Course.instructor_id == current_user_id)
        
        # Apply filters
        if course_id:
            query = query.filter(Project.course_id == course_id)
        
        if project_id:
            query = query.filter(ProjectSubmission.project_id == project_id)
        
        if student_id:
            query = query.filter(ProjectSubmission.student_id == student_id)
        
        # Status filter
        if status == 'pending':
            query = query.filter(ProjectSubmission.grade.is_(None))
        elif status == 'graded':
            query = query.filter(ProjectSubmission.grade.isnot(None))
        
        # Order by submission date
        query = query.order_by(
            ProjectSubmission.grade.is_(None).desc(),
            ProjectSubmission.submitted_at.desc()
        )
        
        # Paginate
        paginated = query.paginate(page=page, per_page=per_page, error_out=False)
        
        # Build response
        submissions_data = []
        for submission in paginated.items:
            submission_dict = submission.to_dict()
            # Add project details
            submission_dict['project_title'] = submission.project.title
            submission_dict['project_points'] = submission.project.points_possible
            submission_dict['course_title'] = submission.project.course.title
            submission_dict['course_id'] = submission.project.course_id
            submission_dict['due_date'] = submission.project.due_date.isoformat()
            
            # Calculate days late
            if submission.submitted_at:
                days_late = (submission.submitted_at - submission.project.due_date).days
                submission_dict['days_late'] = max(0, days_late)
            else:
                submission_dict['days_late'] = 0
            
            submissions_data.append(submission_dict)
        
        return jsonify({
            'submissions': submissions_data,
            'pagination': {
                'page': paginated.page,
                'per_page': paginated.per_page,
                'total': paginated.total,
                'pages': paginated.pages
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching project submissions: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch submissions", "error": str(e)}), 500


@grading_bp.route("/projects/submissions/<int:submission_id>", methods=["GET"])
@instructor_required
def get_project_submission_detail(submission_id):
    """Get detailed view of a single project submission for grading."""
    try:
        current_user_id = int(get_jwt_identity())
        
        submission = ProjectSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Build detailed response
        submission_dict = submission.to_dict()
        
        # Add comprehensive project details
        project_data = submission.project.to_dict(include_modules=True)
        submission_dict['project'] = project_data
        submission_dict['project_title'] = project_data['title']
        submission_dict['project_points'] = project_data['points_possible']
        
        # Enhanced course information
        submission_dict['course'] = {
            'id': submission.project.course.id,
            'title': submission.project.course.title,
            'instructor_name': f"{submission.project.course.instructor.first_name} {submission.project.course.instructor.last_name}" if submission.project.course.instructor else None
        }
        submission_dict['course_title'] = submission.project.course.title
        
        # Calculate submission timing
        submission_dict['days_late'] = 0
        if submission.project.due_date and submission.submitted_at:
            days_late = (submission.submitted_at - submission.project.due_date).days
            submission_dict['days_late'] = max(0, days_late)
            
        # Add due date for frontend display
        submission_dict['due_date'] = submission.project.due_date.isoformat() if submission.project.due_date else None
        
        # Add comprehensive student info
        student = submission.student
        submission_dict['student_info'] = {
            'id': student.id,
            'name': f"{student.first_name} {student.last_name}",
            'email': student.email,
            'username': student.username,
            'first_name': student.first_name,
            'last_name': student.last_name
        }
        
        # Add team members info if collaborative project
        if submission.project.collaboration_allowed and submission.team_members:
            team_ids = submission.get_team_members()
            team_members = User.query.filter(User.id.in_(team_ids)).all()
            submission_dict['team_members_info'] = [
                {
                    'id': member.id,
                    'name': f"{member.first_name} {member.last_name}",
                    'email': member.email
                } for member in team_members
            ]
        
        return jsonify(submission_dict), 200
        
    except Exception as e:
        logger.error(f"Error fetching project submission detail: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch submission", "error": str(e)}), 500


@grading_bp.route("/projects/submissions/<int:submission_id>/grade", methods=["POST", "PUT"])
@instructor_required
def grade_project_submission(submission_id):
    """
    Grade a project submission.
    Body: { grade: float, feedback: string, rubric_scores: {...} }
    """
    try:
        current_user_id = int(get_jwt_identity())
        data = request.get_json()
        
        submission = ProjectSubmission.query.get(submission_id)
        if not submission:
            return jsonify({"message": "Submission not found"}), 404
        
        # Verify instructor owns the course
        if submission.project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Validate grade with improved error handling
        grade = data.get('grade')
        if grade is None:
            return jsonify({"message": "Grade is required"}), 400
        
        try:
            grade = float(grade)
            max_points = submission.project.points_possible or 100
            if grade < 0 or grade > max_points:
                return jsonify({
                    "message": f"Grade must be between 0 and {max_points}"
                }), 400
        except (ValueError, TypeError) as e:
            return jsonify({"message": f"Invalid grade value: {str(e)}"}), 400
        
        # Update submission with validated data
        submission.grade = grade
        submission.feedback = data.get('feedback', '').strip()
        submission.graded_at = datetime.utcnow()
        submission.graded_by = current_user_id
        
        # Store rubric scores if provided with better structure
        rubric_scores = data.get('rubric_scores')
        if rubric_scores and isinstance(rubric_scores, dict):
            rubric_data = {
                'feedback': submission.feedback,
                'rubric_scores': rubric_scores,
                'graded_at': submission.graded_at.isoformat(),
                'graded_by': current_user_id,
                'project_type': 'collaborative' if submission.project.collaboration_allowed else 'individual',
                'version': '1.0'  # For future compatibility
            }
            # Store as properly formatted JSON
            submission.feedback = json.dumps(rubric_data, indent=2)
        
        # Handle team member grading for collaborative projects
        if submission.project.collaboration_allowed and submission.team_members:
            try:
                team_ids = submission.get_team_members() if hasattr(submission, 'get_team_members') else []
                if team_ids:
                    logger.info(f"✅ Graded collaborative project for team: {team_ids}")
            except Exception as team_error:
                logger.warning(f"⚠️ Error handling team members: {str(team_error)}")
        
        db.session.commit()
        
        # Send email notification to student about project grade with improved error handling
        try:
            student = User.query.get(submission.student_id)
            if student and student.email:
                send_project_graded_notification(
                    submission=submission,
                    project=submission.project,
                    student=student,
                    grade=grade,
                    feedback=data.get('feedback', '')
                )
                logger.info(f"✅ Project grade notification email sent to {student.email} for project '{submission.project.title}'")
            else:
                logger.warning(f"⚠️ Student not found or has no email for project submission {submission_id}")
        except Exception as email_error:
            logger.error(f"❌ Failed to send project grade notification email: {str(email_error)}")
            # Don't fail the request if email fails
        
        logger.info(f"✅ Project submission {submission_id} graded successfully by instructor {current_user_id}")
        
        return jsonify({
            "message": "Project graded successfully",
            "submission": submission.to_dict(),
            "grade": grade,
            "percentage": round((grade / (submission.project.points_possible or 100)) * 100, 2),
            "is_collaborative": submission.project.collaboration_allowed
        }), 200
        
    except ValueError as ve:
        db.session.rollback()
        logger.error(f"❌ Validation error in project grading: {str(ve)}")
        return jsonify({"message": "Validation error", "error": str(ve)}), 400
    except Exception as e:
        db.session.rollback()
        logger.error(f"❌ Error grading project: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to grade project", "error": str(e)}), 500


# =====================
# GRADING ANALYTICS
# =====================

@grading_bp.route("/analytics/summary", methods=["GET"])
@instructor_required
def get_grading_summary():
    """Get summary of grading workload and statistics."""
    try:
        current_user_id = int(get_jwt_identity())
        course_id = request.args.get('course_id', type=int)
        
        # Get instructor's courses
        courses_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            courses_query = courses_query.filter_by(id=course_id)
        
        course_ids = [c.id for c in courses_query.all()]
        
        # Assignment submissions stats
        assignment_pending = db.session.query(func.count(AssignmentSubmission.id)).join(Assignment).filter(
            Assignment.course_id.in_(course_ids),
            AssignmentSubmission.grade.is_(None)
        ).scalar() or 0
        
        assignment_graded = db.session.query(func.count(AssignmentSubmission.id)).join(Assignment).filter(
            Assignment.course_id.in_(course_ids),
            AssignmentSubmission.grade.isnot(None)
        ).scalar() or 0
        
        # Project submissions stats
        project_pending = db.session.query(func.count(ProjectSubmission.id)).join(Project).filter(
            Project.course_id.in_(course_ids),
            ProjectSubmission.grade.is_(None)
        ).scalar() or 0
        
        project_graded = db.session.query(func.count(ProjectSubmission.id)).join(Project).filter(
            Project.course_id.in_(course_ids),
            ProjectSubmission.grade.isnot(None)
        ).scalar() or 0
        
        # Recent grading activity (last 7 days)
        week_ago = datetime.utcnow() - timedelta(days=7)
        
        recent_assignment_grades = db.session.query(func.count(AssignmentSubmission.id)).join(Assignment).filter(
            Assignment.course_id.in_(course_ids),
            AssignmentSubmission.graded_at >= week_ago,
            AssignmentSubmission.graded_by == current_user_id
        ).scalar() or 0
        
        recent_project_grades = db.session.query(func.count(ProjectSubmission.id)).join(Project).filter(
            Project.course_id.in_(course_ids),
            ProjectSubmission.graded_at >= week_ago,
            ProjectSubmission.graded_by == current_user_id
        ).scalar() or 0
        
        # Average grading time (if timestamps available)
        # This would require additional fields to track when grading started
        
        return jsonify({
            "assignments": {
                "pending": assignment_pending,
                "graded": assignment_graded,
                "total": assignment_pending + assignment_graded,
                "recent_graded": recent_assignment_grades
            },
            "projects": {
                "pending": project_pending,
                "graded": project_graded,
                "total": project_pending + project_graded,
                "recent_graded": recent_project_grades
            },
            "total_pending": assignment_pending + project_pending,
            "total_graded": assignment_graded + project_graded
        }), 200
        
    except Exception as e:
        logger.error(f"Error fetching grading summary: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch summary", "error": str(e)}), 500


@grading_bp.route("/analytics/grade-distribution", methods=["GET"])
@instructor_required
def get_grade_distribution():
    """Get grade distribution statistics for assignments and projects."""
    try:
        current_user_id = int(get_jwt_identity())
        course_id = request.args.get('course_id', type=int)
        assignment_id = request.args.get('assignment_id', type=int)
        project_id = request.args.get('project_id', type=int)
        
        # Get instructor's courses
        courses_query = Course.query.filter_by(instructor_id=current_user_id)
        if course_id:
            courses_query = courses_query.filter_by(id=course_id)
        
        course_ids = [c.id for c in courses_query.all()]
        
        result = {}
        
        # Assignment grade distribution
        if not project_id:
            assignment_query = db.session.query(
                AssignmentSubmission.grade
            ).join(Assignment).filter(
                Assignment.course_id.in_(course_ids),
                AssignmentSubmission.grade.isnot(None)
            )
            
            if assignment_id:
                assignment_query = assignment_query.filter(AssignmentSubmission.assignment_id == assignment_id)
            
            assignment_grades = [g[0] for g in assignment_query.all()]
            
            if assignment_grades:
                result['assignments'] = {
                    'average': sum(assignment_grades) / len(assignment_grades),
                    'median': sorted(assignment_grades)[len(assignment_grades) // 2],
                    'min': min(assignment_grades),
                    'max': max(assignment_grades),
                    'count': len(assignment_grades),
                    'distribution': _calculate_distribution(assignment_grades)
                }
        
        # Project grade distribution
        if not assignment_id:
            project_query = db.session.query(
                ProjectSubmission.grade
            ).join(Project).filter(
                Project.course_id.in_(course_ids),
                ProjectSubmission.grade.isnot(None)
            )
            
            if project_id:
                project_query = project_query.filter(ProjectSubmission.project_id == project_id)
            
            project_grades = [g[0] for g in project_query.all()]
            
            if project_grades:
                result['projects'] = {
                    'average': sum(project_grades) / len(project_grades),
                    'median': sorted(project_grades)[len(project_grades) // 2],
                    'min': min(project_grades),
                    'max': max(project_grades),
                    'count': len(project_grades),
                    'distribution': _calculate_distribution(project_grades)
                }
        
        return jsonify(result), 200
        
    except Exception as e:
        logger.error(f"Error fetching grade distribution: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch distribution", "error": str(e)}), 500


def _calculate_distribution(grades):
    """Helper to calculate grade distribution in ranges."""
    ranges = {
        'A (90-100)': 0,
        'B (80-89)': 0,
        'C (70-79)': 0,
        'D (60-69)': 0,
        'F (0-59)': 0
    }
    
    for grade in grades:
        if grade >= 90:
            ranges['A (90-100)'] += 1
        elif grade >= 80:
            ranges['B (80-89)'] += 1
        elif grade >= 70:
            ranges['C (70-79)'] += 1
        elif grade >= 60:
            ranges['D (60-69)'] += 1
        else:
            ranges['F (0-59)'] += 1
    
    return ranges


# =====================
# FEEDBACK TEMPLATES
# =====================

@grading_bp.route("/feedback-templates", methods=["GET"])
@instructor_required
def get_feedback_templates():
    """Get saved feedback templates for instructor (stored in user preferences or separate table)."""
    try:
        # TODO: Implement feedback template storage
        # For now, return common templates
        templates = [
            {
                "id": 1,
                "name": "Excellent Work",
                "content": "Excellent work! Your submission demonstrates a thorough understanding of the concepts and exceeds expectations."
            },
            {
                "id": 2,
                "name": "Good Effort",
                "content": "Good effort! Your work shows understanding of the key concepts. Consider reviewing the feedback for areas of improvement."
            },
            {
                "id": 3,
                "name": "Needs Improvement",
                "content": "Your submission needs improvement. Please review the rubric and course materials, and feel free to reach out if you need clarification."
            },
            {
                "id": 4,
                "name": "Missing Requirements",
                "content": "Your submission is missing key requirements. Please review the assignment instructions and resubmit with all required components."
            },
            {
                "id": 5,
                "name": "Late Submission",
                "content": "Your submission was received after the due date. Please be mindful of deadlines for future assignments."
            }
        ]
        
        return jsonify(templates), 200
        
    except Exception as e:
        logger.error(f"Error fetching feedback templates: {str(e)}", exc_info=True)
        return jsonify({"message": "Failed to fetch templates", "error": str(e)}), 500


# Register blueprint
logger.info("Grading routes module loaded successfully")


# =====================
# HELPER FUNCTIONS
# =====================

def generate_grading_analytics(submissions, instructor_id, course_id=None):
    """Generate enhanced grading analytics for submissions."""
    if not submissions:
        return {
            'summary': {
                'total_pending': 0,
                'total_graded': 0,
                'average_grade': 0,
                'completion_rate': 0,
                'overdue_count': 0,
                'due_soon_count': 0
            },
            'insights': {
                'suggested_actions': [],
                'priority_items': []
            }
        }
    
    graded = [s for s in submissions if s.grade is not None]
    pending = [s for s in submissions if s.grade is None]
    overdue = [s for s in pending if s.assignment.due_date and s.assignment.due_date < datetime.utcnow()]
    due_soon = [s for s in pending if s.assignment.due_date and 
                s.assignment.due_date > datetime.utcnow() and 
                s.assignment.due_date < datetime.utcnow() + timedelta(days=1)]
    
    average_grade = statistics.mean([s.grade for s in graded]) if graded else 0
    
    # Generate insights
    suggested_actions = []
    if len(overdue) > 0:
        suggested_actions.append(f"You have {len(overdue)} overdue submissions that need immediate attention.")
    if len(due_soon) > 0:
        suggested_actions.append(f"{len(due_soon)} assignments are due soon and haven't been graded yet.")
    if len(pending) > len(graded) and len(graded) > 0:
        suggested_actions.append("Consider using bulk grading for similar assignments to save time.")
    
    priority_items = [
        {
            'id': s.id,
            'title': s.assignment.title,
            'student_name': f"{s.student.first_name} {s.student.last_name}",
            'days_late': max(0, (datetime.utcnow() - s.assignment.due_date).days) if s.assignment.due_date else 0,
            'priority': 'high' if s in overdue else 'medium' if s in due_soon else 'low'
        }
        for s in sorted(overdue + due_soon, 
                       key=lambda x: x.assignment.due_date if x.assignment.due_date else datetime.utcnow())[:5]
    ]
    
    return {
        'summary': {
            'total_pending': len(pending),
            'total_graded': len(graded),
            'average_grade': round(average_grade, 2),
            'completion_rate': round((len(graded) / len(submissions)) * 100, 2) if submissions else 0,
            'overdue_count': len(overdue),
            'due_soon_count': len(due_soon)
        },
        'insights': {
            'suggested_actions': suggested_actions,
            'priority_items': priority_items
        }
    }
