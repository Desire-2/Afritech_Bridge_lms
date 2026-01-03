"""
AI Agent API Routes for Afritec Bridge LMS
Provides endpoints for AI-assisted course content generation
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
import logging

from ..models.user_models import db, User
from ..models.course_models import Course, Module, Lesson, Quiz
from ..services.ai_agent_service import ai_agent_service

logger = logging.getLogger(__name__)

def instructor_required(f):
    @wraps(f)
    @jwt_required()
    def decorated_function(*args, **kwargs):
        try:
            current_user_id = get_jwt_identity()
            logger.info(f"instructor_required check: user_id={current_user_id}")
            
            user = User.query.get(current_user_id)
            if not user:
                logger.warning(f"User not found: {current_user_id}")
                return jsonify({"message": "User not found"}), 403
            
            if not user.role:
                logger.warning(f"User {current_user_id} has no role assigned")
                return jsonify({"message": "No role assigned to user"}), 403
            
            if user.role.name not in ['instructor', 'admin']:
                logger.warning(f"User {current_user_id} has role '{user.role.name}', requires instructor/admin")
                return jsonify({"message": f"Instructor access required. Current role: {user.role.name}"}), 403
            
            logger.info(f"Access granted for user {current_user_id} with role {user.role.name}")
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Error in instructor_required: {str(e)}")
            return jsonify({"message": f"Authentication error: {str(e)}"}), 403
    return decorated_function

ai_agent_bp = Blueprint("ai_agent_bp", __name__, url_prefix="/api/v1/ai-agent")

# =====================
# COURSE GENERATION
# =====================

@ai_agent_bp.route("/generate-course-outline", methods=["POST"])
@instructor_required
def generate_course_outline():
    """
    Generate AI-powered course outline based on topic and requirements
    
    Request body:
    {
        "topic": "Machine Learning Basics",
        "target_audience": "Beginners with programming background",
        "learning_objectives": "Understand ML algorithms and implement them"
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('topic'):
            return jsonify({"message": "Topic is required"}), 400
        
        topic = data['topic']
        target_audience = data.get('target_audience', '')
        learning_objectives = data.get('learning_objectives', '')
        
        logger.info(f"Generating course outline for topic: {topic}")
        
        result = ai_agent_service.generate_course_outline(
            topic=topic,
            target_audience=target_audience,
            learning_objectives=learning_objectives
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating course outline: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate course outline",
            "error": str(e)
        }), 500


# =====================
# MODULE GENERATION
# =====================

@ai_agent_bp.route("/generate-multiple-modules", methods=["POST"])
@instructor_required
def generate_multiple_modules():
    """
    Generate AI-powered multiple module outlines for a course
    
    Request body:
    {
        "course_id": 1,
        "num_modules": 5 (optional, defaults based on course)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        num_modules = data.get('num_modules', 5)
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Fetch existing modules for context
        existing_modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        existing_modules_context = [{
            "title": module.title,
            "description": module.description or "",
            "learning_objectives": module.learning_objectives or "",
            "order": module.order
        } for module in existing_modules]
        
        logger.info(f"Generating {num_modules} modules for course: {course.title} with {len(existing_modules)} existing modules")
        
        result = ai_agent_service.generate_multiple_modules(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            num_modules=num_modules,
            existing_modules=existing_modules_context
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating multiple modules: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate multiple modules",
            "error": str(e)
        }), 500

@ai_agent_bp.route("/generate-module-content", methods=["POST"])
@instructor_required
def generate_module_content():
    """
    Generate AI-powered module content based on course context
    
    Request body:
    {
        "course_id": 1,
        "module_title": "Introduction to Python" (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        module_title = data.get('module_title', '')
        
        # Fetch existing modules for context
        existing_modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        existing_modules_context = [{
            "title": module.title,
            "description": module.description or "",
            "learning_objectives": module.learning_objectives or "",
            "order": module.order
        } for module in existing_modules]
        
        logger.info(f"Generating module content for course: {course.title} with {len(existing_modules)} existing modules")
        
        result = ai_agent_service.generate_module_content(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            module_title=module_title,
            existing_modules=existing_modules_context
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating module content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate module content",
            "error": str(e)
        }), 500


# =====================
# LESSON GENERATION
# =====================

@ai_agent_bp.route("/generate-multiple-lessons", methods=["POST"])
@instructor_required
def generate_multiple_lessons():
    """
    Generate AI-powered multiple lesson outlines for a module
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "num_lessons": 5 (optional, defaults to 5)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        num_lessons = data.get('num_lessons', 5)
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        logger.info(f"Generating {num_lessons} lessons for module: {module.title} (existing lessons: {len(existing_lessons)})")
        
        result = ai_agent_service.generate_multiple_lessons(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            num_lessons=num_lessons,
            existing_lessons=existing_lessons_data
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating multiple lessons: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate multiple lessons",
            "error": str(e)
        }), 500

@ai_agent_bp.route("/generate-lesson-content", methods=["POST"])
@instructor_required
def generate_lesson_content():
    """
    Generate AI-powered lesson content based on module context
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Variables and Data Types" (optional),
        "lesson_description": "Learn about Python variables" (optional)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        lesson_title = data.get('lesson_title', '')
        lesson_description = data.get('lesson_description', '')
        
        logger.info(f"Generating lesson content for module: {module.title} (existing lessons: {len(existing_lessons)})")
        
        result = ai_agent_service.generate_lesson_content(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            existing_lessons=existing_lessons_data
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating lesson content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate lesson content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-comprehensive-lesson", methods=["POST"])
@instructor_required
def generate_comprehensive_lesson():
    """
    Generate AI-powered COMPREHENSIVE professor-level lesson with step-by-step generation and validation
    
    This endpoint generates a complete, academically rigorous lesson with:
    - Detailed lesson outline and structure
    - Engaging introduction
    - Comprehensive theoretical foundation
    - Practical applications and examples
    - Practice exercises and assessments
    - Summary and additional resources
    
    Each section is generated separately with quality validation.
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_title": "Advanced Python Decorators",
        "lesson_description": "Master the art of Python decorators" (optional),
        "difficulty_level": "intermediate" (optional: "beginner", "intermediate", "advanced")
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        if not data.get('lesson_title'):
            return jsonify({"message": "Lesson title is required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_title = data['lesson_title']
        lesson_description = data.get('lesson_description', '')
        difficulty_level = data.get('difficulty_level', 'intermediate')
        
        # Validate difficulty level
        if difficulty_level not in ['beginner', 'intermediate', 'advanced']:
            return jsonify({"message": "Invalid difficulty_level. Must be 'beginner', 'intermediate', or 'advanced'"}), 400
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get existing lessons in this module for context
        existing_lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        existing_lessons_data = [{
            'title': lesson.title,
            'description': lesson.description or '',
            'order': lesson.order,
            'duration_minutes': lesson.duration_minutes or 0
        } for lesson in existing_lessons]
        
        logger.info(f"Generating COMPREHENSIVE lesson: {lesson_title} for module: {module.title} (difficulty: {difficulty_level}, existing lessons: {len(existing_lessons)})")
        
        # Use the enhanced generation method with validation
        result = ai_agent_service.generate_comprehensive_lesson_with_validation(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            module_objectives=module.learning_objectives or '',
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            difficulty_level=difficulty_level,
            existing_lessons=existing_lessons_data
        )
        
        return jsonify({
            "success": True,
            "data": result,
            "message": f"Comprehensive lesson generated successfully with quality score: {result.get('quality_metrics', {}).get('average_score', 0):.1f}/100"
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating comprehensive lesson: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "message": "Failed to generate comprehensive lesson",
            "error": str(e)
        }), 500


# =====================
# QUIZ GENERATION
# =====================

@ai_agent_bp.route("/generate-quiz-questions", methods=["POST"])
@instructor_required
def generate_quiz_questions():
    """
    Generate AI-powered quiz questions based on lesson content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2,
        "lesson_id": 3,
        "num_questions": 5,
        "question_types": ["multiple_choice", "true_false"]
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_id = data.get('lesson_id')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get lesson content if lesson_id provided
        lesson = None
        lesson_content = ""
        if lesson_id:
            lesson = Lesson.query.filter_by(id=lesson_id, module_id=module_id).first()
            if lesson:
                lesson_content = lesson.content_data or ""
        
        # If no specific lesson, use module description as context
        if not lesson_content:
            lesson_content = f"{module.description}\n\nLearning Objectives:\n{module.learning_objectives}"
        
        num_questions = data.get('num_questions', 5)
        question_types = data.get('question_types', ['multiple_choice', 'true_false'])
        
        logger.info(f"Generating {num_questions} quiz questions for module: {module.title}")
        
        result = ai_agent_service.generate_quiz_questions(
            course_title=course.title,
            module_title=module.title,
            lesson_title=lesson.title if lesson else module.title,
            lesson_content=lesson_content,
            num_questions=num_questions,
            question_types=question_types
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating quiz questions: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate quiz questions",
            "error": str(e)
        }), 500


# =====================
# ASSIGNMENT GENERATION
# =====================

@ai_agent_bp.route("/generate-assignment", methods=["POST"])
@instructor_required
def generate_assignment():
    """
    Generate AI-powered assignment based on module content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get module
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get lessons summary
        lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        lessons_summary = "\n".join([f"- {lesson.title}: {lesson.description or 'No description'}" 
                                    for lesson in lessons]) if lessons else "No lessons yet"
        
        logger.info(f"Generating assignment for module: {module.title}")
        
        result = ai_agent_service.generate_assignment(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or '',
            lessons_summary=lessons_summary
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating assignment: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate assignment",
            "error": str(e)
        }), 500


# =====================
# FINAL PROJECT GENERATION
# =====================

@ai_agent_bp.route("/generate-final-project", methods=["POST"])
@instructor_required
def generate_final_project():
    """
    Generate AI-powered final/capstone project for entire course
    
    Request body:
    {
        "course_id": 1
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        # Get modules summary
        modules = Module.query.filter_by(course_id=course_id).order_by(Module.order).all()
        modules_summary = "\n".join([f"- {module.title}: {module.description or 'No description'}" 
                                    for module in modules]) if modules else "No modules yet"
        
        logger.info(f"Generating final project for course: {course.title}")
        
        result = ai_agent_service.generate_final_project(
            course_title=course.title,
            course_description=course.description or '',
            course_objectives=course.learning_objectives or '',
            modules_summary=modules_summary
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating final project: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate final project",
            "error": str(e)
        }), 500


# =====================
# CONTENT ENHANCEMENT
# =====================

@ai_agent_bp.route("/generate-quiz-from-content", methods=["POST"])
@instructor_required
def generate_quiz_from_content():
    """
    Generate quiz based on actual lesson or module content
    
    Request body:
    {
        "course_id": 1,
        "content_type": "lesson" or "module",
        "lesson_id": 3 (if content_type is lesson),
        "module_id": 2 (if content_type is module),
        "num_questions": 10,
        "difficulty": "mixed" (easy, medium, hard, or mixed)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        content_type = data.get('content_type', 'lesson')
        num_questions = data.get('num_questions', 10)
        difficulty = data.get('difficulty', 'mixed')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        content_text = ""
        content_title = ""
        
        if content_type == 'lesson':
            lesson_id = data.get('lesson_id')
            if not lesson_id:
                return jsonify({"message": "Lesson ID is required for lesson-based quiz"}), 400
            
            lesson = Lesson.query.get(lesson_id)
            if not lesson or lesson.module.course_id != course_id:
                return jsonify({"message": "Lesson not found or access denied"}), 404
            
            content_text = lesson.content_data or ""
            content_title = lesson.title
            
            if not content_text:
                return jsonify({"message": "Lesson has no content to generate quiz from"}), 400
        
        elif content_type == 'module':
            module_id = data.get('module_id')
            if not module_id:
                return jsonify({"message": "Module ID is required for module-based quiz"}), 400
            
            module = Module.query.filter_by(id=module_id, course_id=course_id).first()
            if not module:
                return jsonify({"message": "Module not found"}), 404
            
            # Combine all lessons content from the module
            lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
            if not lessons:
                return jsonify({"message": "Module has no lessons to generate quiz from"}), 400
            
            content_parts = [f"# Module: {module.title}\n\n{module.description or ''}\n\nLearning Objectives:\n{module.learning_objectives or ''}"]
            for lesson in lessons:
                if lesson.content_data:
                    content_parts.append(f"\n\n## {lesson.title}\n\n{lesson.content_data}")
            
            content_text = "\n".join(content_parts)
            content_title = module.title
        
        else:
            return jsonify({"message": "Invalid content_type. Must be 'lesson' or 'module'"}), 400
        
        logger.info(f"Generating quiz from {content_type}: {content_title} ({num_questions} questions, {difficulty} difficulty)")
        
        result = ai_agent_service.generate_quiz_from_content(
            lesson_or_module_content=content_text,
            content_title=content_title,
            content_type=content_type,
            num_questions=num_questions,
            difficulty=difficulty
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating quiz from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate quiz from content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-assignment-from-content", methods=["POST"])
@instructor_required
def generate_assignment_from_content():
    """
    Generate assignment based on actual lesson or module content
    
    Request body:
    {
        "course_id": 1,
        "content_type": "lesson" or "module",
        "lesson_id": 3 (if content_type is lesson),
        "module_id": 2 (if content_type is module),
        "assignment_type": "practical" (practical, theoretical, project, or mixed)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id'):
            return jsonify({"message": "Course ID is required"}), 400
        
        course_id = data['course_id']
        content_type = data.get('content_type', 'lesson')
        assignment_type = data.get('assignment_type', 'practical')
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        content_text = ""
        content_title = ""
        
        if content_type == 'lesson':
            lesson_id = data.get('lesson_id')
            if not lesson_id:
                return jsonify({"message": "Lesson ID is required for lesson-based assignment"}), 400
            
            lesson = Lesson.query.get(lesson_id)
            if not lesson or lesson.module.course_id != course_id:
                return jsonify({"message": "Lesson not found or access denied"}), 404
            
            content_text = lesson.content_data or ""
            content_title = lesson.title
            
            if not content_text:
                return jsonify({"message": "Lesson has no content to generate assignment from"}), 400
        
        elif content_type == 'module':
            module_id = data.get('module_id')
            if not module_id:
                return jsonify({"message": "Module ID is required for module-based assignment"}), 400
            
            module = Module.query.filter_by(id=module_id, course_id=course_id).first()
            if not module:
                return jsonify({"message": "Module not found"}), 404
            
            # Combine all lessons content from the module
            lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
            if not lessons:
                return jsonify({"message": "Module has no lessons to generate assignment from"}), 400
            
            content_parts = [f"# Module: {module.title}\n\n{module.description or ''}\n\nLearning Objectives:\n{module.learning_objectives or ''}"]
            for lesson in lessons:
                if lesson.content_data:
                    content_parts.append(f"\n\n## {lesson.title}\n\n{lesson.content_data}")
            
            content_text = "\n".join(content_parts)
            content_title = module.title
        
        else:
            return jsonify({"message": "Invalid content_type. Must be 'lesson' or 'module'"}), 400
        
        logger.info(f"Generating {assignment_type} assignment from {content_type}: {content_title}")
        
        result = ai_agent_service.generate_assignment_from_content(
            lesson_or_module_content=content_text,
            content_title=content_title,
            content_type=content_type,
            assignment_type=assignment_type
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating assignment from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate assignment from content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/generate-project-from-content", methods=["POST"])
@instructor_required
def generate_project_from_content():
    """
    Generate project based on actual module content
    
    Request body:
    {
        "course_id": 1,
        "module_id": 2
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        
        # Verify instructor owns the course
        course = Course.query.filter_by(id=course_id, instructor_id=current_user_id).first()
        if not course:
            return jsonify({"message": "Course not found or access denied"}), 404
        
        module = Module.query.filter_by(id=module_id, course_id=course_id).first()
        if not module:
            return jsonify({"message": "Module not found"}), 404
        
        # Get all lessons with content
        lessons = Lesson.query.filter_by(module_id=module_id).order_by(Lesson.order).all()
        if not lessons:
            return jsonify({"message": "Module has no lessons to generate project from"}), 400
        
        module_contents = []
        for lesson in lessons:
            if lesson.content_data:
                module_contents.append({
                    "title": lesson.title,
                    "content": lesson.content_data
                })
        
        if not module_contents:
            return jsonify({"message": "Module lessons have no content to generate project from"}), 400
        
        logger.info(f"Generating project from module: {module.title} ({len(module_contents)} lessons)")
        
        result = ai_agent_service.generate_project_from_content(
            module_contents=module_contents,
            module_title=module.title,
            course_title=course.title
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating project from content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate project from content",
            "error": str(e)
        }), 500


# =====================
# ORIGINAL CONTENT ENHANCEMENT
# =====================

@ai_agent_bp.route("/enhance-content", methods=["POST"])
@instructor_required
def enhance_content():
    """
    Enhance existing content using AI
    
    Request body:
    {
        "content_type": "lesson",
        "current_content": "...",
        "enhancement_type": "improve" | "expand" | "simplify" | "add_examples"
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('content_type') or not data.get('current_content'):
            return jsonify({"message": "content_type and current_content are required"}), 400
        
        content_type = data['content_type']
        current_content = data['current_content']
        enhancement_type = data.get('enhancement_type', 'improve')
        
        logger.info(f"Enhancing {content_type} content with {enhancement_type}")
        
        enhanced_content = ai_agent_service.enhance_content(
            content_type=content_type,
            current_content=current_content,
            enhancement_type=enhancement_type
        )
        
        return jsonify({
            "success": True,
            "data": {
                "enhanced_content": enhanced_content
            }
        }), 200
        
    except Exception as e:
        logger.error(f"Error enhancing content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to enhance content",
            "error": str(e)
        }), 500


# =====================
# MIXED CONTENT GENERATION
# =====================

@ai_agent_bp.route("/generate-mixed-content", methods=["POST"])
@instructor_required
def generate_mixed_content():
    """
    Generate AI-powered mixed content lesson with template support
    
    Request body:
    {
        "course_id": 1,
        "module_id": 1,
        "lesson_title": "Introduction to Variables",
        "lesson_description": "Learn about variables in Python",
        "template_id": "intro-video-summary" (optional),
        "existing_sections": [] (optional - for enhancement/append mode)
    }
    """
    try:
        current_user_id = get_jwt_identity()
        data = request.get_json()
        
        if not data or not data.get('course_id') or not data.get('module_id'):
            return jsonify({"message": "Course ID and Module ID are required"}), 400
        
        course_id = data['course_id']
        module_id = data['module_id']
        lesson_title = data.get('lesson_title', '')
        lesson_description = data.get('lesson_description', '')
        template_id = data.get('template_id')
        existing_sections = data.get('existing_sections', [])
        
        # Verify access
        course = Course.query.get(course_id)
        if not course:
            logger.warning(f"Course not found: {course_id}")
            return jsonify({"message": "Course not found"}), 404
        
        # Check if user is the course instructor or an admin
        user = User.query.get(current_user_id)
        is_admin = user and user.role and user.role.name == 'admin'
        is_course_instructor = course.instructor_id == int(current_user_id)
        
        if not (is_course_instructor or is_admin):
            logger.warning(f"User {current_user_id} attempted to access course {course_id} (instructor: {course.instructor_id})")
            return jsonify({"message": "Unauthorized - You are not the instructor of this course"}), 403
        
        logger.info(f"Access granted to course {course_id} for user {current_user_id}")
        
        module = Module.query.get(module_id)
        if not module or module.course_id != course_id:
            return jsonify({"message": "Module not found"}), 404
        
        logger.info(f"Generating mixed content for lesson: {lesson_title} with template: {template_id}")
        
        result = ai_agent_service.generate_mixed_content(
            course_title=course.title,
            module_title=module.title,
            module_description=module.description or "",
            lesson_title=lesson_title,
            lesson_description=lesson_description,
            template_id=template_id,
            existing_sections=existing_sections
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error generating mixed content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to generate mixed content",
            "error": str(e)
        }), 500


@ai_agent_bp.route("/enhance-section-content", methods=["POST"])
@instructor_required
def enhance_section_content():
    """
    Enhance a specific section of mixed content using AI
    
    Request body:
    {
        "section_type": "text",
        "section_content": "Brief content...",
        "context": {
            "lesson_title": "Variables in Python",
            "section_position": "introduction",
            "previous_section": "..."
        }
    }
    """
    try:
        data = request.get_json()
        
        if not data or not data.get('section_type'):
            return jsonify({"message": "Section type is required"}), 400
        
        section_type = data['section_type']
        section_content = data.get('section_content', '')
        context = data.get('context', {})
        
        logger.info(f"Enhancing {section_type} section content")
        
        result = ai_agent_service.enhance_section_content(
            section_type=section_type,
            section_content=section_content,
            context=context
        )
        
        return jsonify({
            "success": True,
            "data": result
        }), 200
        
    except Exception as e:
        logger.error(f"Error enhancing section content: {e}")
        return jsonify({
            "success": False,
            "message": "Failed to enhance section content",
            "error": str(e)
        }), 500


# =====================
# HEALTH CHECK
# =====================

@ai_agent_bp.route("/health", methods=["GET"])
def health_check():
    """Check if AI agent service is available"""
    api_key_configured = ai_agent_service.api_key is not None
    
    return jsonify({
        "status": "operational",
        "api_configured": api_key_configured,
        "message": "AI Agent service is running" if api_key_configured 
                   else "AI Agent service running but API key not configured"
    }), 200
