"""
Excel Grading Routes — AI-powered Excel assignment grading endpoints.

Blueprint: excel_grading_bp
Prefix:    /api/v1/excel-grading

Instructor / Admin Endpoints:
  POST /grade/<submission_id>              — Grade a single submission
  POST /grade-batch/<assignment_id>        — Grade all submissions for an assignment
  GET  /results/<result_id>                — Get a grading result by ID
  GET  /results/submission/<id>            — Get result by submission ID
  POST /review/<result_id>                 — Instructor review / override
  GET  /submissions                        — List gradeable Excel submissions
  GET  /history                            — Grading history for a course
  GET  /stats/<course_id>                  — AI grading stats for a course
  POST /preview                            — Upload & preview analysis (no save)

Student Endpoints:
  GET  /my-results                         — Student's own AI grading results
  GET  /my-results/<submission_id>         — Student's result for a specific submission
"""

from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from functools import wraps
from datetime import datetime
import logging

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Assignment, AssignmentSubmission,
    Project, ProjectSubmission, Enrollment,
)
from ..models.excel_grading_models import ExcelGradingResult
from ..services.excel_grading.learning_engine import LearningEngine
from ..utils.email_notifications import (
    send_grade_notification, send_project_graded_notification,
    send_grade_with_modification_notification
)

logger = logging.getLogger(__name__)
_learning_engine = LearningEngine()

# Passing score threshold fallback - used when assignment/project has no passing_score set
DEFAULT_PASSING_PERCENTAGE = 60.0

# ------------------------------------------------------------------
# Role guards
# ------------------------------------------------------------------

def instructor_or_admin_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        uid = get_jwt_identity()
        user = User.query.get(uid)
        if not user or not user.role or user.role.name not in ('instructor', 'admin'):
            return jsonify({"message": "Instructor or admin access required"}), 403
        return f(*args, **kwargs)
    return decorated


def student_required(f):
    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        uid = get_jwt_identity()
        user = User.query.get(uid)
        if not user:
            return jsonify({"message": "User not found"}), 404
        return f(*args, **kwargs)
    return decorated


excel_grading_bp = Blueprint(
    "excel_grading_bp", __name__,
    url_prefix="/api/v1/excel-grading",
)


# ==============================================================
# POST /grade/<submission_id>  — Grade a single submission
# ==============================================================
@excel_grading_bp.route("/grade/<int:submission_id>", methods=["POST"])
@instructor_or_admin_required
def grade_submission(submission_id):
    """
    Trigger AI grading for one submission.

    Body (JSON, optional):
        submission_type: 'assignment' | 'project'  (default: 'assignment')
        force:           bool — re-grade even if already graded
    """
    try:
        data = request.get_json(silent=True) or {}
        submission_type = data.get('submission_type', 'assignment')
        force = data.get('force', False)

        from ..services.excel_grading import ExcelGradingService
        service = ExcelGradingService()
        result = service.grade_submission(submission_id, submission_type, force=force)

        status_code = {
            'completed': 200,
            'already_graded': 200,
            'skipped': 200,
            'failed': 422,
        }.get(result.get('status'), 500)

        return jsonify(result), status_code

    except Exception as e:
        logger.exception(f"Grade submission error: {e}")
        return jsonify({"message": str(e)}), 500


# ==============================================================
# POST /grade-batch/<assignment_id>  — Batch grade
# ==============================================================
@excel_grading_bp.route("/grade-batch/<int:assignment_id>", methods=["POST"])
@instructor_or_admin_required
def grade_batch(assignment_id):
    """
    Grade all ungraded submissions for an assignment / project.

    Body (JSON, optional):
        submission_type: 'assignment' | 'project'
        force:           bool
    """
    try:
        data = request.get_json(silent=True) or {}
        submission_type = data.get('submission_type', 'assignment')
        force = data.get('force', False)

        from ..services.excel_grading import ExcelGradingService
        service = ExcelGradingService()
        result = service.grade_batch(assignment_id, submission_type, force=force)

        return jsonify(result), 200

    except Exception as e:
        logger.exception(f"Batch grade error: {e}")
        return jsonify({"error": str(e)}), 500


# ==============================================================
# GET /results/<result_id>  — Get grading result by ID
# ==============================================================
@excel_grading_bp.route("/results/<int:result_id>", methods=["GET"])
@instructor_or_admin_required
def get_result(result_id):
    """Return a single grading result."""
    result = ExcelGradingResult.query.get(result_id)
    if not result:
        return jsonify({"error": "Result not found"}), 404

    fmt = request.args.get('format', 'full')
    if fmt == 'strict':
        return jsonify(result.to_strict_json()), 200
    return jsonify(result.to_dict()), 200


# ==============================================================
# GET /results/submission/<submission_id>  — Get by submission
# ==============================================================
@excel_grading_bp.route("/results/submission/<int:submission_id>", methods=["GET"])
@instructor_or_admin_required
def get_result_by_submission(submission_id):
    """
    Get the latest grading result for a submission.
    Query: submission_type=assignment|project
    """
    sub_type = request.args.get('submission_type', 'assignment')

    if sub_type == 'assignment':
        result = ExcelGradingResult.query.filter_by(
            assignment_submission_id=submission_id,
            submission_type='assignment',
        ).order_by(ExcelGradingResult.graded_at.desc()).first()
    else:
        result = ExcelGradingResult.query.filter_by(
            project_submission_id=submission_id,
            submission_type='project',
        ).order_by(ExcelGradingResult.graded_at.desc()).first()

    if not result:
        return jsonify({"error": "No grading result found for this submission"}), 404

    fmt = request.args.get('format', 'full')
    if fmt == 'strict':
        return jsonify(result.to_strict_json()), 200
    return jsonify(result.to_dict()), 200


# ==============================================================
# POST /review/<result_id>  — Instructor review / override
# ==============================================================
@excel_grading_bp.route("/review/<int:result_id>", methods=["POST"])
@instructor_or_admin_required
def review_result(result_id):
    """
    Instructor confirms, adjusts, or overrides the AI grade.

    Body (JSON):
        action:           'approve' | 'override'
        adjusted_score:   float (only for override)
        adjusted_grade:   str   (only for override)
        instructor_notes: str
    """
    result = ExcelGradingResult.query.get(result_id)
    if not result:
        return jsonify({"error": "Result not found"}), 404

    data = request.get_json(silent=True) or {}
    action = data.get('action', 'approve')
    instructor_id = int(get_jwt_identity())

    try:
        result.instructor_reviewed = True
        result.instructor_id = instructor_id
        result.reviewed_at = datetime.utcnow()

        if action == 'override':
            new_score = data.get('adjusted_score')
            new_grade = data.get('adjusted_grade')
            if new_score is not None:
                result.total_score = float(new_score)
            if new_grade:
                result.grade_letter = new_grade
            result.instructor_notes = data.get('instructor_notes', '')

        elif action == 'approve':
            result.instructor_notes = data.get('instructor_notes', '')

        # Optionally update the actual submission grade
        if data.get('apply_to_submission', True):
            _apply_grade_to_submission(result)

        db.session.commit()

        # ---- Learning: record this review as experience ----
        try:
            assignment_id = None
            module_id = None
            if result.assignment_submission:
                assignment_id = result.assignment_submission.assignment_id
                assignment = Assignment.query.get(assignment_id)
                if assignment:
                    module_id = assignment.module_id

            if assignment_id:
                final_score = (
                    float(data.get('adjusted_score'))
                    if action == 'override' and data.get('adjusted_score') is not None
                    else result.total_score
                )
                _learning_engine.record_grading_outcome(
                    grading_result_id=result.id,
                    assignment_id=assignment_id,
                    course_id=result.course_id,
                    module_id=module_id,
                    ai_score=result.total_score,
                    ai_max_score=result.max_score,
                    instructor_action=action,
                    instructor_score=final_score if action == 'override' else None,
                    instructor_notes=data.get('instructor_notes', ''),
                    rubric_used=result.rubric_breakdown,
                    analysis_summary=result.analysis_data,
                )

                # When instructor approves, mark the generated rubric as trusted
                if action == 'approve':
                    _learning_engine.mark_rubric_approved(assignment_id)

                logger.info(
                    f"Learning: recorded instructor {action} for result #{result.id}"
                )
        except Exception as learn_err:
            # Learning is non-critical — never block the review response
            logger.warning(f"Learning recording failed (non-critical): {learn_err}")

        # ===== AUTO-MODIFICATION REQUEST + NOTIFICATION on AI grade approval/override =====
        modification_auto_requested = False
        modification_reason = None
        try:
            final_score = result.total_score
            assignment = None
            project = None
            submission = None
            student = None
            points_possible = result.max_score or 100
            
            # Determine if this is an assignment or project submission
            if result.submission_type == 'assignment' and result.assignment_submission_id:
                submission = AssignmentSubmission.query.get(result.assignment_submission_id)
                if submission:
                    assignment = submission.assignment
                    student = User.query.get(submission.student_id)
                    if assignment:
                        points_possible = assignment.points_possible or 100
            elif result.submission_type == 'project' and result.project_submission_id:
                submission = ProjectSubmission.query.get(result.project_submission_id)
                if submission:
                    project = submission.project
                    student = User.query.get(submission.student_id)
                    if project:
                        points_possible = project.points_possible or 100
            
            if final_score is not None and (assignment or project):
                percentage_score = round((final_score / points_possible) * 100, 2)
                target = assignment or project
                
                # Use the passing score set during creation, fallback to default
                passing_threshold = target.passing_score if target.passing_score is not None else DEFAULT_PASSING_PERCENTAGE
                
                if percentage_score < passing_threshold:
                    max_resubs = target.max_resubmissions or 3
                    current_resubs = target.resubmission_count or 0
                    
                    if current_resubs < max_resubs:
                        item_type = "project" if project else "assignment"
                        modification_reason = (
                            f"Your {item_type} score of {final_score:.1f}/{points_possible} ({percentage_score:.1f}%) is below the "
                            f"passing threshold of {passing_threshold}%. "
                            f"Please review the feedback and resubmit your work with improvements."
                        )
                        
                        instructor_notes = data.get('instructor_notes', '').strip()
                        if instructor_notes:
                            modification_reason += f"\n\nInstructor Notes: {instructor_notes}"
                        
                        target.modification_requested = True
                        target.modification_request_reason = modification_reason
                        target.modification_requested_at = datetime.utcnow()
                        target.modification_requested_by = instructor_id
                        target.can_resubmit = True
                        target.resubmission_count = current_resubs + 1
                        
                        db.session.commit()
                        modification_auto_requested = True
                        
                        logger.info(
                            f"🔄 AI grade {action}: auto-modification requested for {item_type} {target.id} - "
                            f"scored {percentage_score:.1f}% (below {passing_threshold}% threshold)"
                        )
                    else:
                        logger.info(
                            f"⚠️ AI grade {action}: score below passing but max resubmissions ({max_resubs}) reached"
                        )
                else:
                    # Score meets passing - clear any existing modification request
                    if target.modification_requested:
                        target.modification_requested = False
                        target.modification_request_reason = None
                        target.modification_requested_at = None
                        target.modification_requested_by = None
                        target.can_resubmit = False
                        db.session.commit()
                        logger.info(
                            f"✅ AI grade {action}: score {percentage_score:.1f}% meets passing threshold {passing_threshold}% - "
                            f"cleared modification request"
                        )
                
                # Send email notification to student
                if student and student.email and submission:
                    try:
                        instructor = User.query.get(instructor_id)
                        instructor_name = f"{instructor.first_name} {instructor.last_name}" if instructor else "Your Instructor"
                        from flask import current_app
                        frontend_url = current_app.config.get('FRONTEND_URL', 'http://localhost:3000')
                        
                        if modification_auto_requested:
                            from datetime import timedelta
                            resubmission_deadline = (datetime.utcnow() + timedelta(days=7)).strftime('%B %d, %Y')
                            
                            send_grade_with_modification_notification(
                                submission=submission,
                                assignment=target,
                                student=student,
                                grade=final_score,
                                feedback=result.overall_feedback or data.get('instructor_notes', ''),
                                modification_reason=modification_reason,
                                instructor_name=instructor_name,
                                resubmission_deadline=resubmission_deadline,
                                frontend_url=frontend_url,
                                passing_percentage=passing_threshold,
                                is_project=(project is not None)
                            )
                            logger.info(f"📧 AI grade {action}: sent grade+modification notification to {student.email}")
                        else:
                            if project:
                                send_project_graded_notification(
                                    submission=submission,
                                    project=project,
                                    student=student,
                                    grade=final_score,
                                    feedback=result.overall_feedback or data.get('instructor_notes', '')
                                )
                            else:
                                send_grade_notification(
                                    submission=submission,
                                    assignment=assignment,
                                    student=student,
                                    grade=final_score,
                                    feedback=result.overall_feedback or data.get('instructor_notes', '')
                                )
                            logger.info(f"📧 AI grade {action}: sent grade notification to {student.email}")
                    except Exception as email_err:
                        logger.warning(f"⚠️ AI grade review: email notification failed: {email_err}")
        except Exception as mod_error:
            logger.error(f"❌ Error in AI grade review auto-modification: {str(mod_error)}")
        # ===== END AUTO-MODIFICATION REQUEST =====

        response_data = {
            "message": f"Grading result {action}d successfully",
            "result": result.to_dict(),
        }
        
        if modification_auto_requested:
            response_data["modification_requested"] = True
            response_data["modification_reason"] = modification_reason
            response_data["message"] = (
                f"Grading result {action}d successfully. Score is below passing threshold — "
                f"modification request has been automatically sent to the student."
            )

        return jsonify(response_data), 200

    except Exception as e:
        db.session.rollback()
        logger.exception(f"Review error: {e}")
        return jsonify({"error": str(e)}), 500


# ==============================================================
# GET /submissions  — List gradeable Excel submissions
# ==============================================================
@excel_grading_bp.route("/submissions", methods=["GET"])
@instructor_or_admin_required
def list_gradeable_submissions():
    """
    List submissions that can be AI-graded (MS Excel courses only).

    Query params:
        course_id: int (required)
        assignment_id: int (optional — filter to single assignment)
        status: pending | graded | all (default: pending)
        page: int
        per_page: int
    """
    course_id = request.args.get('course_id', type=int)
    if not course_id:
        return jsonify({"error": "course_id is required"}), 400

    course = Course.query.get(course_id)
    if not course:
        return jsonify({"error": "Course not found"}), 404

    # Validate this is an Excel course
    from ..services.excel_grading import ExcelGradingService
    svc = ExcelGradingService()
    if not svc._is_excel_course(course):
        return jsonify({"error": "Not an MS Excel course"}), 400

    assignment_id = request.args.get('assignment_id', type=int)
    status = request.args.get('status', 'pending')
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    # Build query
    query = AssignmentSubmission.query.join(
        Assignment, Assignment.id == AssignmentSubmission.assignment_id
    ).filter(Assignment.course_id == course_id)

    if assignment_id:
        query = query.filter(AssignmentSubmission.assignment_id == assignment_id)

    if status == 'pending':
        query = query.filter(AssignmentSubmission.grade.is_(None))
    elif status == 'graded':
        query = query.filter(AssignmentSubmission.grade.isnot(None))

    pagination = query.order_by(AssignmentSubmission.submitted_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False
    )

    submissions = []
    for sub in pagination.items:
        # Check if already AI-graded
        ai_result = ExcelGradingResult.query.filter_by(
            assignment_submission_id=sub.id,
            submission_type='assignment',
        ).first()

        student = User.query.get(sub.student_id)
        assignment = Assignment.query.get(sub.assignment_id)

        submissions.append({
            'submission_id': sub.id,
            'assignment_id': sub.assignment_id,
            'assignment_title': assignment.title if assignment else None,
            'student_id': sub.student_id,
            'student_name': f"{student.first_name} {student.last_name}" if student else None,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
            'manual_grade': sub.grade,
            'ai_graded': ai_result is not None,
            'ai_score': ai_result.total_score if ai_result else None,
            'ai_grade': ai_result.grade_letter if ai_result else None,
        })

    return jsonify({
        'submissions': submissions,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
        'per_page': pagination.per_page,
    }), 200


# ==============================================================
# GET /history  — Grading history for a course
# ==============================================================
@excel_grading_bp.route("/history", methods=["GET"])
@instructor_or_admin_required
def grading_history():
    """
    Query params: course_id, student_id, page, per_page
    """
    course_id = request.args.get('course_id', type=int)
    student_id = request.args.get('student_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = ExcelGradingResult.query
    if course_id:
        query = query.filter_by(course_id=course_id)
    if student_id:
        query = query.filter_by(student_id=student_id)

    pagination = query.order_by(
        ExcelGradingResult.graded_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    return jsonify({
        'results': [r.to_dict() for r in pagination.items],
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    }), 200


# ==============================================================
# GET /stats/<course_id>  — AI grading stats for a course
# ==============================================================
@excel_grading_bp.route("/stats/<int:course_id>", methods=["GET"])
@instructor_or_admin_required
def grading_stats(course_id):
    """
    AI grading statistics for a course.
    Returns total graded, average score, score distribution, etc.
    """
    try:
        results = ExcelGradingResult.query.filter_by(
            course_id=course_id, status='completed'
        ).all()

        if not results:
            return jsonify({
                'total_graded': 0, 'average_score': 0, 'average_percentage': 0,
                'grade_distribution': {}, 'confidence_breakdown': {},
                'review_status': {'reviewed': 0, 'pending_review': 0},
            }), 200

        scores = [r.total_score for r in results]
        max_scores = [r.max_score for r in results]
        avg_score = sum(scores) / len(scores) if scores else 0
        avg_pct = sum(s / m * 100 for s, m in zip(scores, max_scores) if m > 0) / len(scores) if scores else 0

        # Grade distribution
        grade_dist = {}
        for r in results:
            g = r.grade_letter or 'N/A'
            grade_dist[g] = grade_dist.get(g, 0) + 1

        # Confidence breakdown
        confidence_dist = {}
        for r in results:
            c = r.confidence or 'medium'
            confidence_dist[c] = confidence_dist.get(c, 0) + 1

        reviewed = sum(1 for r in results if r.instructor_reviewed)

        return jsonify({
            'total_graded': len(results),
            'average_score': round(avg_score, 2),
            'average_percentage': round(avg_pct, 1),
            'grade_distribution': grade_dist,
            'confidence_breakdown': confidence_dist,
            'review_status': {
                'reviewed': reviewed,
                'pending_review': len(results) - reviewed,
            },
            'highest_score': max(scores) if scores else 0,
            'lowest_score': min(scores) if scores else 0,
        }), 200
    except Exception as e:
        logger.exception(f"Stats error: {e}")
        return jsonify({"error": str(e)}), 500


# ==============================================================
# ─── STUDENT ENDPOINTS ────────────────────────────────────────
# ==============================================================

# ==============================================================
# GET /auto-grade-status/<submission_id>  — Check auto-grade progress
# ==============================================================
@excel_grading_bp.route("/auto-grade-status/<int:submission_id>", methods=["GET"])
@student_required
def auto_grade_status(submission_id):
    """
    Lightweight poll endpoint for students to check if AI auto-grading
    has finished for their submission.

    Query: submission_type=assignment|project (default: assignment)

    Returns:
        status: 'not_started' | 'processing' | 'completed' | 'failed'
        result_id: int | null  (if completed)
        grade_letter: str | null
        percentage: float | null
    """
    uid = int(get_jwt_identity())
    sub_type = request.args.get('submission_type', 'assignment')

    if sub_type == 'assignment':
        result = ExcelGradingResult.query.filter_by(
            assignment_submission_id=submission_id,
            submission_type='assignment',
            student_id=uid,
        ).order_by(ExcelGradingResult.graded_at.desc()).first()
    else:
        result = ExcelGradingResult.query.filter_by(
            project_submission_id=submission_id,
            submission_type='project',
            student_id=uid,
        ).order_by(ExcelGradingResult.graded_at.desc()).first()

    if not result:
        return jsonify({
            'status': 'not_started',
            'result_id': None,
            'grade_letter': None,
            'percentage': None,
        }), 200

    payload = {
        'status': result.status or 'processing',
        'result_id': result.id if result.status == 'completed' else None,
        'grade_letter': result.grade_letter if result.status == 'completed' else None,
        'percentage': round(result.total_score / max(result.max_score, 1) * 100, 1)
            if result.status == 'completed' and result.max_score else None,
    }
    return jsonify(payload), 200


# ==============================================================
# GET /my-results  — Student's own AI grading results
# ==============================================================
@excel_grading_bp.route("/my-results", methods=["GET"])
@student_required
def my_results():
    """
    Return the current student's AI grading results.

    Query params:
        course_id: int (optional)
        page / per_page
    """
    uid = int(get_jwt_identity())
    course_id = request.args.get('course_id', type=int)
    page = request.args.get('page', 1, type=int)
    per_page = request.args.get('per_page', 20, type=int)

    query = ExcelGradingResult.query.filter_by(student_id=uid, status='completed')
    if course_id:
        query = query.filter_by(course_id=course_id)

    pagination = query.order_by(
        ExcelGradingResult.graded_at.desc()
    ).paginate(page=page, per_page=per_page, error_out=False)

    # Return student-safe subset (no instructor notes / internal flags)
    results = []
    for r in pagination.items:
        results.append({
            'id': r.id,
            'submission_type': r.submission_type,
            'assignment_submission_id': r.assignment_submission_id,
            'project_submission_id': r.project_submission_id,
            'course_id': r.course_id,
            'file_name': r.file_name,
            'total_score': r.total_score,
            'max_score': r.max_score,
            'grade_letter': r.grade_letter,
            'rubric_breakdown': r.rubric_breakdown,
            'overall_feedback': r.overall_feedback,
            'confidence': r.confidence,
            'graded_at': r.graded_at.isoformat() if r.graded_at else None,
            'instructor_reviewed': r.instructor_reviewed,
            'status': r.status,
        })

    return jsonify({
        'results': results,
        'total': pagination.total,
        'page': pagination.page,
        'pages': pagination.pages,
    }), 200


# ==============================================================
# GET /my-results/<submission_id>  — Student's result by submission
# ==============================================================
@excel_grading_bp.route("/my-results/<int:submission_id>", methods=["GET"])
@student_required
def my_result_by_submission(submission_id):
    """
    Return the student's AI grading result for a specific submission.
    Query: submission_type=assignment|project (default: assignment)
    """
    uid = int(get_jwt_identity())
    sub_type = request.args.get('submission_type', 'assignment')

    if sub_type == 'assignment':
        result = ExcelGradingResult.query.filter_by(
            assignment_submission_id=submission_id,
            submission_type='assignment',
            student_id=uid,
        ).order_by(ExcelGradingResult.graded_at.desc()).first()
    else:
        result = ExcelGradingResult.query.filter_by(
            project_submission_id=submission_id,
            submission_type='project',
            student_id=uid,
        ).order_by(ExcelGradingResult.graded_at.desc()).first()

    if not result:
        return jsonify({"error": "No AI grading result found for this submission"}), 404

    return jsonify({
        'id': result.id,
        'submission_type': result.submission_type,
        'file_name': result.file_name,
        'total_score': result.total_score,
        'max_score': result.max_score,
        'grade_letter': result.grade_letter,
        'rubric_breakdown': result.rubric_breakdown,
        'overall_feedback': result.overall_feedback,
        'confidence': result.confidence,
        'graded_at': result.graded_at.isoformat() if result.graded_at else None,
        'instructor_reviewed': result.instructor_reviewed,
        'status': result.status,
    }), 200


# ==============================================================
# POST /preview  — Upload & preview analysis (no save)
# ==============================================================
@excel_grading_bp.route("/preview", methods=["POST"])
@instructor_or_admin_required
def preview_analysis():
    """
    Upload an Excel file and get AI analysis preview without saving.
    Useful for instructors to test what the AI agent would report.

    Body: multipart/form-data with 'file' field
    """
    try:
        if 'file' not in request.files:
            return jsonify({"error": "No file provided"}), 400

        file = request.files['file']
        if not file.filename:
            return jsonify({"error": "Empty filename"}), 400

        # Validate extension
        import os
        ext = os.path.splitext(file.filename)[1].lower()
        from ..services.excel_grading.excel_grading_service import ALLOWED_EXTENSIONS
        if ext not in ALLOWED_EXTENSIONS:
            return jsonify({
                "error": f"File type '{ext}' not supported. Allowed: {', '.join(ALLOWED_EXTENSIONS)}"
            }), 400

        file_bytes = file.read()
        if not file_bytes:
            return jsonify({"error": "Empty file"}), 400

        # Run analyzers
        from ..services.excel_grading.excel_analyzer import ExcelAnalyzer
        from ..services.excel_grading.formula_analyzer import FormulaAnalyzer
        from ..services.excel_grading.chart_analyzer import ChartAnalyzer
        from ..services.excel_grading.formatting_analyzer import FormattingAnalyzer

        wb = ExcelAnalyzer(file_bytes, file.filename)
        wb_analysis = wb.analyze()

        formula_analysis = FormulaAnalyzer(wb_analysis).analyze()
        chart_analysis = ChartAnalyzer(file_bytes, file.filename).analyze()
        formatting_analysis = FormattingAnalyzer(file_bytes, file.filename).analyze()

        return jsonify({
            'preview': True,
            'file_name': file.filename,
            'file_size': len(file_bytes),
            'workbook': wb_analysis,
            'formulas': formula_analysis,
            'charts': chart_analysis,
            'formatting': formatting_analysis,
        }), 200

    except Exception as e:
        logger.exception(f"Preview error: {e}")
        return jsonify({"error": str(e)}), 500


# ==============================================================
# GET /learning/stats  — AI learning statistics for a course
# ==============================================================
@excel_grading_bp.route("/learning/stats", methods=["GET"])
@instructor_or_admin_required
def learning_stats():
    """
    Return AI learning statistics: calibration accuracy, number of
    reviews recorded, rubrics generated/approved, pattern insights.

    Query params:
        course_id  (required)
    """
    course_id = request.args.get('course_id', type=int)
    if not course_id:
        return jsonify({"message": "course_id is required"}), 400

    try:
        stats = _learning_engine.get_learning_stats(course_id)
        return jsonify(stats), 200
    except Exception as e:
        logger.exception(f"Learning stats error: {e}")
        return jsonify({"error": str(e)}), 500


# ==============================================================
# GET /learning/rubric/<assignment_id>  — Generated rubric for an assignment
# ==============================================================
@excel_grading_bp.route("/learning/rubric/<int:assignment_id>", methods=["GET"])
@instructor_or_admin_required
def get_generated_rubric(assignment_id):
    """
    Retrieve the AI-generated rubric for a specific assignment.

    This lets instructors inspect what the AI built from the instructions
    and optionally approve it for future grading sessions.
    """
    from ..models.excel_grading_models import GeneratedRubric

    rubric = GeneratedRubric.query.filter_by(
        assignment_id=assignment_id,
    ).order_by(GeneratedRubric.created_at.desc()).first()

    if not rubric:
        return jsonify({"message": "No generated rubric found for this assignment"}), 404

    return jsonify(rubric.to_dict()), 200


# ==============================================================
# POST /learning/rubric/<assignment_id>/approve  — Approve generated rubric
# ==============================================================
@excel_grading_bp.route("/learning/rubric/<int:assignment_id>/approve", methods=["POST"])
@instructor_or_admin_required
def approve_generated_rubric(assignment_id):
    """
    Explicitly approve a generated rubric so the AI uses it with
    higher confidence in future grading runs.
    """
    _learning_engine.mark_rubric_approved(assignment_id)
    return jsonify({"message": "Rubric approved successfully"}), 200


# ==============================================================
# Helpers
# ==============================================================

def _apply_grade_to_submission(result: ExcelGradingResult):
    """Push the AI grade onto the real submission record."""
    try:
        if result.submission_type == 'assignment' and result.assignment_submission_id:
            sub = AssignmentSubmission.query.get(result.assignment_submission_id)
            if sub:
                sub.grade = result.total_score
                sub.feedback = result.overall_feedback
                sub.graded_at = datetime.utcnow()
                sub.graded_by = result.instructor_id
                logger.info(f"Applied AI grade to AssignmentSubmission#{sub.id}")

        elif result.submission_type == 'project' and result.project_submission_id:
            sub = ProjectSubmission.query.get(result.project_submission_id)
            if sub:
                sub.grade = result.total_score
                sub.feedback = result.overall_feedback
                sub.graded_at = datetime.utcnow()
                sub.graded_by = result.instructor_id
                logger.info(f"Applied AI grade to ProjectSubmission#{sub.id}")
    except Exception as e:
        logger.error(f"Failed to apply grade to submission: {e}")
