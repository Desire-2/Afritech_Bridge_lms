# Enhanced Content Assignment Routes for Afritec Bridge LMS
# Manages assignment of quizzes, assignments, and projects to modules and lessons

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
import json

from ..models.user_models import db, User, Role
from ..models.course_models import Course, Module, Lesson, Quiz, Assignment, Project, AssignmentSubmission
from ..models.student_models import ModuleProgress, LessonCompletion
from ..models.quiz_progress_models import QuizAttempt

# Helper for role checking
from functools import wraps

def role_required(roles):
    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            current_user_id = get_jwt_identity()
            if not current_user_id:
                return jsonify({"message": "Authentication required"}), 401
            
            user = User.query.get(current_user_id)
            if not user:
                return jsonify({"message": "User not found"}), 404
            
            if user.role not in roles:
                return jsonify({"message": "Insufficient permissions"}), 403
            
            return f(*args, **kwargs)
        return decorated_function
    return decorator

# Define role decorators
instructor_required = role_required(['instructor', 'admin'])
admin_required = role_required(['admin'])

content_assignment_bp = Blueprint('content_assignment', __name__, url_prefix='/api/v1/content-assignment')

# ==================== QUIZ ASSIGNMENT ROUTES ====================

@content_assignment_bp.route("/quizzes", methods=["POST"])
@instructor_required
def create_quiz():
    """Create a quiz and assign it to module/lesson"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        # Validate required fields
        required_fields = ['title', 'course_id']
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400
        
        # Verify instructor has access to the course
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        if course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied. You can only create quizzes for your own courses"}), 403
        
        # Create quiz
        quiz = Quiz(
            title=data['title'],
            description=data.get('description', ''),
            course_id=data['course_id'],
            module_id=data.get('module_id'),
            lesson_id=data.get('lesson_id'),
            is_published=data.get('is_published', False)
        )
        
        db.session.add(quiz)
        db.session.commit()
        
        return jsonify({
            "message": "Quiz created successfully",
            "quiz": quiz.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error creating quiz", "error": str(e)}), 500

@content_assignment_bp.route("/quizzes/<int:quiz_id>/assign", methods=["PUT"])
@instructor_required
def assign_quiz():
    """Assign or reassign a quiz to module/lesson"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        quiz = Quiz.query.get(quiz_id)
        if not quiz:
            return jsonify({"message": "Quiz not found"}), 404
        
        # Verify instructor has access
        if quiz.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Update assignment
        quiz.module_id = data.get('module_id')
        quiz.lesson_id = data.get('lesson_id')
        
        # Validate module belongs to course
        if quiz.module_id:
            module = Module.query.get(quiz.module_id)
            if not module or module.course_id != quiz.course_id:
                return jsonify({"message": "Module does not belong to this course"}), 400
        
        # Validate lesson belongs to module
        if quiz.lesson_id:
            lesson = Lesson.query.get(quiz.lesson_id)
            if not lesson or (quiz.module_id and lesson.module_id != quiz.module_id):
                return jsonify({"message": "Lesson does not belong to the specified module"}), 400
        
        db.session.commit()
        
        return jsonify({
            "message": "Quiz assignment updated successfully",
            "quiz": quiz.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating quiz assignment", "error": str(e)}), 500

@content_assignment_bp.route("/modules/<int:module_id>/quizzes", methods=["GET"])
@jwt_required()
def get_module_quizzes(module_id):
    """Get all quizzes assigned to a module"""
    try:
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        quizzes = Quiz.query.filter_by(module_id=module_id, is_published=True).all()
        
        return jsonify({
            "module": module.to_dict(),
            "quizzes": [quiz.to_dict() for quiz in quizzes]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching module quizzes", "error": str(e)}), 500

@content_assignment_bp.route("/lessons/<int:lesson_id>/quiz", methods=["GET"])
@jwt_required()
def get_lesson_quiz(lesson_id):
    """Get all quizzes assigned to a specific lesson with student attempt data"""
    try:
        current_user_id = int(get_jwt_identity())
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({"message": "Lesson not found"}), 404
        
        # Get all published quizzes for this lesson
        quizzes = Quiz.query.filter_by(lesson_id=lesson_id, is_published=True).all()
        
        # Enrich quiz data with student's best attempt
        enriched_quizzes = []
        enriched_quiz_single = None
        
        for quiz in quizzes:
            # Include questions with answers (for student display, answers without is_correct)
            quiz_data = quiz.to_dict(include_questions=True)
            
            # Get student's best attempt for this quiz
            best_attempt = QuizAttempt.query.filter_by(
                user_id=current_user_id,
                quiz_id=quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            # Count total attempts
            attempts_count = QuizAttempt.query.filter_by(
                user_id=current_user_id,
                quiz_id=quiz.id
            ).count()
            
            # Add enriched fields for frontend
            if best_attempt:
                quiz_data['current_score'] = best_attempt.score_percentage
                quiz_data['best_score'] = best_attempt.score_percentage
                quiz_data['last_attempted'] = best_attempt.end_time.isoformat() if best_attempt.end_time else None
                quiz_data['attempts_used'] = attempts_count
                quiz_data['quiz_id'] = quiz.id  # Ensure quiz_id is in response
                quiz_data['quiz_title'] = quiz.title  # Ensure quiz_title is in response
            else:
                quiz_data['current_score'] = None
                quiz_data['best_score'] = None
                quiz_data['last_attempted'] = None
                quiz_data['attempts_used'] = 0
                quiz_data['quiz_id'] = quiz.id
                quiz_data['quiz_title'] = quiz.title
            
            enriched_quizzes.append(quiz_data)
            
            # Keep first quiz for backward compatibility
            if enriched_quiz_single is None:
                enriched_quiz_single = quiz_data
        
        return jsonify({
            "lesson": lesson.to_dict(),
            "quiz": enriched_quiz_single,  # For backward compatibility, return first as 'quiz'
            "quizzes": enriched_quizzes  # Return all quizzes with enriched data
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching lesson quiz", "error": str(e)}), 500

# ==================== ASSIGNMENT MANAGEMENT ROUTES ====================

@content_assignment_bp.route("/assignments", methods=["POST"])
@instructor_required
def create_assignment():
    """Create an assignment and assign it to module/lesson"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        # Validate required fields
        required_fields = ['title', 'description', 'course_id']
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400
        
        # Verify instructor has access to the course
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        if course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Parse due date
        due_date = None
        if data.get('due_date'):
            try:
                due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
            except ValueError:
                return jsonify({"message": "Invalid due date format"}), 400
        
        # Create assignment
        assignment = Assignment(
            title=data['title'],
            description=data['description'],
            instructions=data.get('instructions', ''),
            course_id=data['course_id'],
            module_id=data.get('module_id'),
            lesson_id=data.get('lesson_id'),
            instructor_id=current_user_id,
            assignment_type=data.get('assignment_type', 'file_upload'),
            max_file_size_mb=data.get('max_file_size_mb', 10),
            allowed_file_types=data.get('allowed_file_types'),
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),
            is_published=data.get('is_published', False)
        )
        
        db.session.add(assignment)
        db.session.commit()
        
        return jsonify({
            "message": "Assignment created successfully",
            "assignment": assignment.to_dict()
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error creating assignment", "error": str(e)}), 500

@content_assignment_bp.route("/assignments/<int:assignment_id>/assign", methods=["PUT"])
@instructor_required
def assign_assignment():
    """Assign or reassign an assignment to module/lesson"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"message": "Assignment not found"}), 404
        
        # Verify instructor has access
        if assignment.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Update assignment
        assignment.module_id = data.get('module_id')
        assignment.lesson_id = data.get('lesson_id')
        
        # Validate module belongs to course
        if assignment.module_id:
            module = Module.query.get(assignment.module_id)
            if not module or module.course_id != assignment.course_id:
                return jsonify({"message": "Module does not belong to this course"}), 400
        
        # Validate lesson belongs to module
        if assignment.lesson_id:
            lesson = Lesson.query.get(assignment.lesson_id)
            if not lesson or (assignment.module_id and lesson.module_id != assignment.module_id):
                return jsonify({"message": "Lesson does not belong to the specified module"}), 400
        
        db.session.commit()
        
        return jsonify({
            "message": "Assignment updated successfully",
            "assignment": assignment.to_dict()
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating assignment", "error": str(e)}), 500

@content_assignment_bp.route("/modules/<int:module_id>/assignments", methods=["GET"])
@jwt_required()
def get_module_assignments(module_id):
    """Get all assignments for a module"""
    try:
        module = Module.query.get(module_id)
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        assignments = Assignment.query.filter_by(module_id=module_id, is_published=True).all()
        
        return jsonify({
            "module": module.to_dict(),
            "assignments": [assignment.to_dict() for assignment in assignments]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching module assignments", "error": str(e)}), 500

@content_assignment_bp.route("/lessons/<int:lesson_id>/assignments", methods=["GET"])
@jwt_required()
def get_lesson_assignments(lesson_id):
    """Get all assignments for a lesson with submission status"""
    try:
        current_user_id = int(get_jwt_identity())
        
        lesson = Lesson.query.get(lesson_id)
        if not lesson:
            return jsonify({"message": "Lesson not found"}), 404
        
        assignments = Assignment.query.filter_by(lesson_id=lesson_id, is_published=True).all()
        
        # Add submission status for each assignment
        assignments_with_status = []
        for assignment in assignments:
            try:
                assignment_dict = assignment.to_dict()
                
                # Get submission for current user
                submission = AssignmentSubmission.query.filter_by(
                    assignment_id=assignment.id,
                    student_id=current_user_id
                ).first()
                
                # Build submission status
                submission_status = {
                    'submitted': submission is not None,
                    'status': 'not_submitted'
                }
                
                if submission:
                    submission_status['id'] = submission.id
                    submission_status['submitted_at'] = submission.submitted_at.isoformat() if submission.submitted_at else None
                    
                    if submission.grade is not None:
                        submission_status['status'] = 'graded'
                        submission_status['grade'] = submission.grade
                        submission_status['feedback'] = submission.feedback
                        submission_status['graded_at'] = submission.graded_at.isoformat() if submission.graded_at else None
                        # Safely get grader name
                        try:
                            if submission.graded_by:
                                grader = User.query.get(submission.graded_by)
                                if grader:
                                    submission_status['grader_name'] = grader.full_name
                        except:
                            pass
                    else:
                        submission_status['status'] = 'submitted'
                else:
                    # Check if overdue - handle both datetime and string
                    try:
                        if assignment.due_date:
                            due_date = assignment.due_date
                            if isinstance(due_date, str):
                                due_date = datetime.fromisoformat(due_date.replace('Z', '+00:00'))
                            if due_date < datetime.utcnow():
                                submission_status['status'] = 'late'
                    except:
                        pass
                
                assignment_dict['submission_status'] = submission_status
                assignments_with_status.append(assignment_dict)
            except Exception as assignment_error:
                # Log individual assignment error but continue with others
                print(f"Error processing assignment {assignment.id}: {str(assignment_error)}")
                # Still add the assignment without submission status
                assignment_dict = assignment.to_dict()
                assignment_dict['submission_status'] = {
                    'submitted': False,
                    'status': 'not_submitted'
                }
                assignments_with_status.append(assignment_dict)
        
        return jsonify({
            "lesson": lesson.to_dict(),
            "assignments": assignments_with_status
        }), 200
        
    except Exception as e:
        print(f"Error fetching lesson assignments: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({"message": "Error fetching lesson assignments", "error": str(e)}), 500

# ==================== PROJECT MANAGEMENT ROUTES ====================

@content_assignment_bp.route("/projects", methods=["POST"])
@instructor_required
def create_project():
    """Create a project and assign it to modules"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        # Validate required fields
        required_fields = ['title', 'description', 'course_id', 'due_date']
        for field in required_fields:
            if field not in data:
                return jsonify({"message": f"Missing required field: {field}"}), 400
        
        # Verify instructor has access to the course
        course = Course.query.get(data['course_id'])
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        if course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Parse due date
        try:
            due_date = datetime.fromisoformat(data['due_date'].replace('Z', '+00:00'))
        except ValueError:
            return jsonify({"message": "Invalid due date format"}), 400
        
        # Create project
        project = Project(
            title=data['title'],
            description=data['description'],
            objectives=data.get('objectives', ''),
            course_id=data['course_id'],
            due_date=due_date,
            points_possible=data.get('points_possible', 100.0),
            is_published=data.get('is_published', False),
            submission_format=data.get('submission_format', 'file_upload'),
            max_file_size_mb=data.get('max_file_size_mb', 50),
            allowed_file_types=data.get('allowed_file_types'),
            collaboration_allowed=data.get('collaboration_allowed', False),
            max_team_size=data.get('max_team_size', 1)
        )
        
        # Set modules
        module_ids = data.get('module_ids', [])
        project.set_modules(module_ids)
        
        db.session.add(project)
        db.session.commit()
        
        return jsonify({
            "message": "Project created successfully",
            "project": project.to_dict(include_modules=True)
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error creating project", "error": str(e)}), 500

@content_assignment_bp.route("/projects/<int:project_id>/assign-modules", methods=["PUT"])
@instructor_required
def assign_project_modules():
    """Assign or reassign project to modules"""
    current_user_id = int(get_jwt_identity())
    data = request.get_json()
    
    try:
        project = Project.query.get(project_id)
        if not project:
            return jsonify({"message": "Project not found"}), 404
        
        # Verify instructor has access
        if project.course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Validate module IDs belong to course
        module_ids = data.get('module_ids', [])
        for module_id in module_ids:
            module = Module.query.get(module_id)
            if not module or module.course_id != project.course_id:
                return jsonify({"message": f"Module {module_id} does not belong to this course"}), 400
        
        # Update project modules
        project.set_modules(module_ids)
        db.session.commit()
        
        return jsonify({
            "message": "Project modules updated successfully",
            "project": project.to_dict(include_modules=True)
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({"message": "Error updating project modules", "error": str(e)}), 500

@content_assignment_bp.route("/courses/<int:course_id>/projects", methods=["GET"])
@jwt_required()
def get_course_projects(course_id):
    """Get all projects for a course"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        projects = Project.query.filter_by(course_id=course_id, is_published=True).all()
        
        return jsonify({
            "course": course.to_dict(),
            "projects": [project.to_dict(include_modules=True) for project in projects]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching course projects", "error": str(e)}), 500

# ==================== COMPREHENSIVE CONTENT OVERVIEW ====================

@content_assignment_bp.route("/courses/<int:course_id>/content-overview", methods=["GET"])
@jwt_required()
def get_course_content_overview(course_id):
    """Get comprehensive overview of all content assigned to course modules and lessons"""
    try:
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        # Get modules with their content
        modules_data = []
        for module in course.modules.filter_by(is_published=True).order_by(Module.order):
            # Get module quizzes
            module_quizzes = Quiz.query.filter_by(module_id=module.id, is_published=True).all()
            
            # Get module assignments
            module_assignments = Assignment.query.filter_by(module_id=module.id, is_published=True).all()
            
            # Get lessons with their content
            lessons_data = []
            for lesson in module.lessons.filter_by(is_published=True).order_by(Lesson.order):
                lesson_quiz = Quiz.query.filter_by(lesson_id=lesson.id, is_published=True).first()
                lesson_assignments = Assignment.query.filter_by(lesson_id=lesson.id, is_published=True).all()
                
                lessons_data.append({
                    **lesson.to_dict(),
                    'quiz': lesson_quiz.to_dict() if lesson_quiz else None,
                    'assignments': [assignment.to_dict() for assignment in lesson_assignments]
                })
            
            modules_data.append({
                **module.to_dict(),
                'lessons': lessons_data,
                'quizzes': [quiz.to_dict() for quiz in module_quizzes],
                'assignments': [assignment.to_dict() for assignment in module_assignments]
            })
        
        # Get course projects
        projects = Project.query.filter_by(course_id=course_id, is_published=True).all()
        
        return jsonify({
            "course": course.to_dict(),
            "modules": modules_data,
            "projects": [project.to_dict(include_modules=True) for project in projects]
        }), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching content overview", "error": str(e)}), 500

# ==================== STUDENT PROGRESS TRACKING ====================

@content_assignment_bp.route("/students/<int:student_id>/course/<int:course_id>/content-progress", methods=["GET"])
@jwt_required()
def get_student_content_progress(student_id, course_id):
    """Get student's progress on all content types in a course"""
    current_user_id = int(get_jwt_identity())
    
    try:
        # Check if current user is the student or instructor
        course = Course.query.get(course_id)
        if not course:
            return jsonify({"message": "Course not found"}), 404
        
        if current_user_id != student_id and course.instructor_id != current_user_id:
            return jsonify({"message": "Access denied"}), 403
        
        # Get comprehensive progress data
        progress_data = {
            "lessons": [],
            "quizzes": [],
            "assignments": [],
            "projects": [],
            "overall_stats": {
                "total_lessons": 0,
                "completed_lessons": 0,
                "total_quizzes": 0,
                "completed_quizzes": 0,
                "total_assignments": 0,
                "completed_assignments": 0,
                "total_projects": 0,
                "completed_projects": 0
            }
        }
        
        # Process lessons
        for module in course.modules.filter_by(is_published=True):
            for lesson in module.lessons.filter_by(is_published=True):
                lesson_completion = LessonCompletion.query.filter_by(
                    student_id=student_id,
                    lesson_id=lesson.id
                ).first()
                
                progress_data["lessons"].append({
                    "lesson": lesson.to_dict(),
                    "completed": lesson_completion.completed if lesson_completion else False,
                    "completion_date": lesson_completion.completed_at.isoformat() if lesson_completion and lesson_completion.completed_at else None
                })
                
                progress_data["overall_stats"]["total_lessons"] += 1
                if lesson_completion and lesson_completion.completed:
                    progress_data["overall_stats"]["completed_lessons"] += 1
        
        # TODO: Add similar processing for quizzes, assignments, and projects
        # This would require additional progress tracking models
        
        return jsonify(progress_data), 200
        
    except Exception as e:
        return jsonify({"message": "Error fetching content progress", "error": str(e)}), 500