"""
Excel Grading Routes — compatibility surface for historical Excel results.

AAGE is the only grading engine. These endpoints no longer start an Excel
pipeline: grading/review requests enqueue or delegate to AAGE, while read
endpoints project canonical AAGE results into the old response shape and keep
historical ``ExcelGradingResult`` rows readable.

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
from sqlalchemy import or_
from functools import wraps
from typing import Optional
import logging

from ..models.user_models import db, User, Role
from ..models.course_models import (
    Course, Assignment, AssignmentSubmission,
    Project, ProjectSubmission,
)
from ..models.aage_models import EvaluationResult
from ..models.grading_models import Rubric
from ..models.excel_grading_models import ExcelGradingResult
from ..services.aage import compatibility as aage_compatibility
from ..services.aage import jobs as aage_jobs
from ..services.aage import learning as aage_learning
from ..services.aage import persistence as aage_persistence
from ..services.aage import review as aage_review
from ..services.aage import rubric_intelligence as aage_rubrics
from ..services.aage.scoring import confidence_label, score_for_letter
from ..services.aage.submission_dispatch import uses_excel_grader
from ..services.aage.compatibility import CompatibilityError
from ..services.aage.review import ReviewError as AageReviewError
from ..services.aage.rubric_intelligence import RubricError

logger = logging.getLogger(__name__)

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


# ------------------------------------------------------------------
# AAGE compatibility helpers
# ------------------------------------------------------------------

def _current_user():
    identity = get_jwt_identity()
    try:
        return User.query.get(int(identity))
    except (TypeError, ValueError):  # pragma: no cover - malformed token
        return None


def _can_manage_course(course_id) -> bool:
    user = _current_user()
    if user is None or not user.role:
        return False
    if user.role.name == 'admin':
        return True
    course = Course.query.get(course_id) if course_id else None
    return bool(course and course.instructor_id == user.id)


def _queue_aage_grade(submission_type: str, submission_id: int, force: bool = False):
    """Enqueue AAGE grading and return ``(job, deduplicated, error)``."""
    try:
        loaded = aage_persistence.load_submission(submission_type, submission_id)
    except Exception as exc:
        return None, False, (jsonify({"error": str(exc)}), 404)
    if not _can_manage_course(loaded.course_id):
        return None, False, (jsonify({"message": "Instructor access to this course required"}), 403)

    if not force:
        existing = aage_jobs.active_job(submission_type, submission_id)
        if existing is not None:
            return existing, True, None

    try:
        job = aage_jobs.enqueue_grade_job(
            submission_type=submission_type,
            submission_id=submission_id,
            assessment_kind=loaded.assessment_kind,
            assessment_id=loaded.assessment_id,
            course_id=loaded.course_id,
            student_id=loaded.student_id,
            requested_by=(_current_user().id if _current_user() else None),
            force=force,
        )
        return job, False, None
    except Exception as exc:  # pragma: no cover - defensive
        logger.exception("Excel compatibility endpoint could not enqueue AAGE job")
        return None, False, (jsonify({"error": str(exc)}), 500)


def _specialist_hint(loaded) -> Optional[str]:
    try:
        course = Course.query.get(loaded.course_id) if loaded.course_id else None
        if uses_excel_grader(course, loaded.files):
            return "spreadsheet"
    except Exception:  # pragma: no cover - status hint only
        pass
    return None


def _latest_aage_result(submission_type: str, submission_id: int):
    return (EvaluationResult.query
            .filter(EvaluationResult.submission_type == submission_type,
                    EvaluationResult.submission_id == submission_id)
            .order_by(EvaluationResult.published_at.desc(),
                      EvaluationResult.id.desc())
            .first())


def _aage_legacy_payload(result: EvaluationResult) -> dict:
    """Project an AAGE result into the historical Excel response shape."""
    criteria = result.criteria.all()
    breakdown = {
        row.criterion_key: {"score": row.awarded, "max": row.maximum,
                            "comment": row.rationale or ""}
        for row in criteria
    }
    statuses = [row.verification_status for row in criteria]
    return {
        "id": result.id,
        "aage_result_id": result.id,
        "engine": "aage",
        "submission_type": result.submission_type,
        "assignment_submission_id": (result.submission_id
                                     if result.submission_type == 'assignment' else None),
        "project_submission_id": (result.submission_id
                                  if result.submission_type == 'project' else None),
        "student_id": result.student_id,
        "course_id": result.course_id,
        "total_score": result.total_awarded,
        "max_score": result.total_possible,
        "grade_letter": result.grade_letter,
        "rubric_breakdown": breakdown,
        "rubric_data": result.rubric_snapshot or {},
        "analysis_data": {
            "status_counts": {
                "verified": statuses.count("verified"),
                "partial": statuses.count("partial"),
                "unverified": statuses.count("unverified"),
            },
            "criteria": [row.to_dict() for row in criteria],
        },
        "overall_feedback": result.feedback or "",
        "confidence": confidence_label(result.confidence),
        "manual_review_required": bool(result.requires_review),
        "flagged_issues": [],
        "graded_at": (result.published_at or result.created_at).isoformat()
        if (result.published_at or result.created_at) else None,
        "ai_provider": result.ai_provider,
        "requirements_count": len(criteria),
        "status": result.status,
        "instructor_reviewed": result.status in ('approved', 'published'),
        "instructor_notes": result.review.decision_note if result.review else None,
    }


def _aage_result_for_submission(submission_type: str, submission_id: int,
                                *, finalised_only: bool = False):
    query = EvaluationResult.query.filter(
        EvaluationResult.submission_type == submission_type,
        EvaluationResult.submission_id == submission_id,
    )
    if finalised_only:
        query = query.filter(or_(EvaluationResult.is_official.is_(True),
                                 EvaluationResult.status.in_(('approved', 'published'))))
    return query.order_by(EvaluationResult.published_at.desc(),
                          EvaluationResult.id.desc()).first()


def _aage_rows_for_submission(submission_type: str, submission_id: int):
    return (EvaluationResult.query
            .filter(EvaluationResult.submission_type == submission_type,
                    EvaluationResult.submission_id == submission_id)
            .order_by(EvaluationResult.id.desc()).all())


def _finalised_aage(result: EvaluationResult) -> bool:
    return bool(result and (result.is_official
                            or result.status in ('approved', 'published')))


def _finalised_legacy(result: ExcelGradingResult) -> bool:
    return bool(result and (result.instructor_reviewed
                            or result.status == 'reviewed'))


def _legacy_column(submission_type: str):
    return (ExcelGradingResult.assignment_submission_id
            if submission_type == 'assignment'
            else ExcelGradingResult.project_submission_id)


def _legacy_for_submission(submission_type: str, submission_id: int,
                           *, finalised_only: bool = False):
    query = ExcelGradingResult.query.filter(
        ExcelGradingResult.submission_type == submission_type,
        _legacy_column(submission_type) == submission_id,
    )
    if finalised_only:
        query = query.filter(
            or_(ExcelGradingResult.instructor_reviewed.is_(True),
                ExcelGradingResult.status == 'reviewed'))
    return query.order_by(ExcelGradingResult.graded_at.desc(),
                          ExcelGradingResult.id.desc()).first()


def _latest_result_for_submission(submission_type: str, submission_id: int,
                                  *, finalised_only: bool = False):
    """Return ``(payload, source)`` preferring canonical AAGE results."""
    aage = _aage_result_for_submission(
        submission_type, submission_id, finalised_only=finalised_only)
    if aage is not None:
        return _aage_legacy_payload(aage), 'aage'
    legacy = _legacy_for_submission(
        submission_type, submission_id, finalised_only=finalised_only)
    if legacy is not None:
        return legacy.to_dict(), 'legacy'
    return None, None


# ==============================================================
# POST /grade/<submission_id>  — Compatibility shim to AAGE
# ==============================================================
@excel_grading_bp.route("/grade/<int:submission_id>", methods=["POST"])
@instructor_or_admin_required
def grade_submission(submission_id):
    """Enqueue AAGE grading. Never creates an Excel pipeline result."""
    data = request.get_json(silent=True) or {}
    submission_type = data.get('submission_type', 'assignment')
    if submission_type not in ('assignment', 'project'):
        return jsonify({"error": "submission_type must be 'assignment' or 'project'"}), 400
    force = data.get('force', False)
    if not isinstance(force, bool):
        return jsonify({"error": "force must be a boolean"}), 400

    job, deduplicated, error = _queue_aage_grade(
        submission_type, submission_id, force=force)
    if error is not None:
        return error

    loaded = aage_persistence.load_submission(submission_type, submission_id)
    return jsonify({
        "status": job.status,
        "engine": "aage",
        "specialist": _specialist_hint(loaded),
        "job": job.to_dict(),
        "deduplicated": deduplicated,
        "publication": {"status": "pending", "engine": "aage"},
    }), 200 if deduplicated else 201


# ==============================================================
# POST /grade-batch/<assignment_id>  — Batch grade
# ==============================================================
@excel_grading_bp.route("/grade-batch/<int:assignment_id>", methods=["POST"])
@instructor_or_admin_required
def grade_batch(assignment_id):
    """Enqueue AAGE jobs for every submission of an assignment/project."""
    data = request.get_json(silent=True) or {}
    submission_type = data.get('submission_type', 'assignment')
    if submission_type not in ('assignment', 'project'):
        return jsonify({"error": "submission_type must be 'assignment' or 'project'"}), 400
    force = data.get('force', False)
    if not isinstance(force, bool):
        return jsonify({"error": "force must be a boolean"}), 400

    if submission_type == 'assignment':
        parent = Assignment.query.get(assignment_id)
        submissions = (AssignmentSubmission.query
                       .filter_by(assignment_id=assignment_id).all())
    else:
        parent = Project.query.get(assignment_id)
        submissions = (ProjectSubmission.query
                       .filter_by(project_id=assignment_id).all())
    if parent is None:
        return jsonify({"error": "Assessment not found"}), 404
    if not _can_manage_course(getattr(parent, 'course_id', None)):
        return jsonify({"message": "Instructor access to this course required"}), 403

    results = []
    for submission in submissions:
        job, deduplicated, error = _queue_aage_grade(
            submission_type, submission.id, force=force)
        if error is not None:
            results.append({
                "submission_id": submission.id, "status": "failed",
                "error": error.get_json() if hasattr(error, "get_json") else str(error),
            })
            continue
        results.append({
            "submission_id": submission.id,
            "student_id": submission.student_id,
            "status": job.status,
            "job_id": job.id,
            "deduplicated": deduplicated,
        })

    enqueued = sum(1 for row in results
                   if row.get("status") == aage_jobs.JOB_QUEUED)
    return jsonify({
        "total": len(results),
        "succeeded": enqueued,
        "failed": sum(1 for row in results if row.get("status") == "failed"),
        "skipped": sum(1 for row in results if row.get("deduplicated")),
        "engine": "aage",
        "results": results,
    }), 200


# ==============================================================
# GET /results/<result_id>  — Get grading result by ID
# ==============================================================
@excel_grading_bp.route("/results/<int:result_id>", methods=["GET"])
@instructor_or_admin_required
def get_result(result_id):
    """Return a historical Excel row or its canonical AAGE projection."""
    legacy = ExcelGradingResult.query.get(result_id)
    if legacy is not None:
        if not _can_manage_course(legacy.course_id):
            return jsonify({"message": "Instructor access to this course required"}), 403
        if request.args.get('format') == 'strict':
            return jsonify(legacy.to_strict_json()), 200
        return jsonify(legacy.to_dict()), 200

    aage = EvaluationResult.query.get(result_id)
    if aage is None:
        return jsonify({"error": "Result not found"}), 404
    if not _can_manage_course(aage.course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403
    return jsonify(_aage_legacy_payload(aage)), 200


# ==============================================================
# GET /results/submission/<submission_id>  — Get by submission
# ==============================================================
@excel_grading_bp.route("/results/submission/<int:submission_id>", methods=["GET"])
@instructor_or_admin_required
def get_result_by_submission(submission_id):
    """Latest AAGE result for a submission, or a historical Excel row."""
    sub_type = request.args.get('submission_type', 'assignment')
    if sub_type not in ('assignment', 'project'):
        return jsonify({"error": "submission_type must be 'assignment' or 'project'"}), 400

    payload, source = _latest_result_for_submission(sub_type, submission_id)
    if payload is None:
        return jsonify({"error": "No grading result found for this submission"}), 404
    if not _can_manage_course(payload.get('course_id')):
        return jsonify({"message": "Instructor access to this course required"}), 403
    payload['source'] = source
    return jsonify(payload), 200


# ==============================================================
# POST /review/<result_id>  — Instructor review / override
# ==============================================================
@excel_grading_bp.route("/review/<int:result_id>", methods=["POST"])
@instructor_or_admin_required
def review_result(result_id):
    """Route a historical Excel review through AAGE review/learning/publish."""
    legacy = ExcelGradingResult.query.get(result_id)
    if legacy is None:
        return jsonify({"error": "Result not found"}), 404
    if not _can_manage_course(legacy.course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403

    data = request.get_json(silent=True) or {}
    action = str(data.get('action', 'approve')).strip().lower()
    if action not in ('approve', 'override'):
        return jsonify({"error": "action must be approve or override"}), 400
    instructor_id = int(get_jwt_identity())
    notes = str(data.get('instructor_notes') or '').strip()
    apply_to_submission = bool(data.get('apply_to_submission', True))

    try:
        review_id = aage_compatibility.ensure_aage_review_for_legacy_result(
            legacy, instructor_id)
        result_id_aage = aage_compatibility.review_result_id(review_id)
        adjusted_score = None
        adjusted_grade = None
        learning_example = None

        if action == 'override':
            raw_score = data.get('adjusted_score')
            adjusted_grade = str(data.get('adjusted_grade') or '').strip().upper() or None
            if raw_score is None and adjusted_grade:
                raw_score = score_for_letter(adjusted_grade)
            try:
                adjusted_score = float(raw_score)
            except (TypeError, ValueError, OverflowError):
                return jsonify({"error": "adjusted_score must be a number"}), 400
            reason = notes or 'Instructor override via Excel compatibility endpoint'
            aage_compatibility.apply_legacy_total_override(
                legacy, review_id, adjusted_score, instructor_id, reason)
            payload = aage_review.submit_correction(review_id, reason, instructor_id)
            learning_example = payload.get('learning_example')
        else:
            payload = aage_review.get_review(review_id)

        published = False
        if apply_to_submission:
            payload = aage_review.approve_review(review_id, instructor_id)
            published = bool(payload.get('published'))

        aage_compatibility.record_legacy_review_metadata(
            legacy, review_id=review_id, actor_id=instructor_id, notes=notes,
            action=action, adjusted_score=adjusted_score,
            adjusted_grade=adjusted_grade)
        if published:
            legacy.instructor_reviewed = True
            legacy.status = 'reviewed'

            from ..talent_passport.hooks import notify_talent_passport
            reviewed_marker = (legacy.instructor_reviewed_at.isoformat()
                               if legacy.instructor_reviewed_at
                               else str(legacy.id))
            notify_talent_passport(
                "excel.reviewed", legacy.student_id,
                "excel_grading_result", legacy.id,
                course_id=legacy.course_id,
                suffix=f"instructor:{reviewed_marker}",
            )
            db.session.commit()

        result = EvaluationResult.query.get(result_id_aage)
        response = {
            'message': f"Grading result {action}d successfully",
            'engine': 'aage',
            'aage_result_id': result_id_aage,
            'review_id': review_id,
            'published': published,
            'result': _aage_legacy_payload(result) if result else {},
            'learning_example': learning_example,
        }
        return jsonify(response), 200
    except (AageReviewError, CompatibilityError) as exc:
        db.session.rollback()
        status = getattr(exc, 'status', 400)
        return jsonify({"error": getattr(exc, 'message', str(exc))}), status
    except Exception as exc:
        db.session.rollback()
        logger.exception("AAGE compatibility review failed")
        return jsonify({"error": str(exc)}), 500


# ==============================================================
# GET /submissions  — List gradeable Excel submissions
# ==============================================================
@excel_grading_bp.route("/submissions", methods=["GET"])
@instructor_or_admin_required
def list_gradeable_submissions():
    """List submissions with their canonical AAGE result (or legacy row)."""
    course_id = request.args.get('course_id', type=int)
    if not course_id:
        return jsonify({"error": "course_id is required"}), 400

    course = Course.query.get(course_id)
    if not course:
        return jsonify({"error": "Course not found"}), 404
    if not _can_manage_course(course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403

    from ..services.excel_grading.excel_file_detection import course_is_excel
    if not course_is_excel(course):
        return jsonify({"error": "Not an MS Excel course"}), 400

    assignment_id = request.args.get('assignment_id', type=int)
    status = request.args.get('status', 'pending')
    page = max(1, request.args.get('page', 1, type=int) or 1)
    per_page = max(1, min(100, request.args.get('per_page', 20, type=int) or 20))

    from sqlalchemy.orm import joinedload
    query = AssignmentSubmission.query.join(
        Assignment, Assignment.id == AssignmentSubmission.assignment_id
    ).options(
        joinedload(AssignmentSubmission.student),
        joinedload(AssignmentSubmission.assignment),
    ).filter(Assignment.course_id == course_id)

    if assignment_id:
        query = query.filter(AssignmentSubmission.assignment_id == assignment_id)
    if status == 'pending':
        query = query.filter(AssignmentSubmission.grade.is_(None))
    elif status == 'graded':
        query = query.filter(AssignmentSubmission.grade.isnot(None))

    pagination = query.order_by(AssignmentSubmission.submitted_at.desc()).paginate(
        page=page, per_page=per_page, error_out=False)
    sub_ids = [sub.id for sub in pagination.items]

    aage_map = {}
    legacy_map = {}
    if sub_ids:
        for row in (EvaluationResult.query
                    .filter(EvaluationResult.submission_type == 'assignment',
                            EvaluationResult.submission_id.in_(sub_ids))
                    .order_by(EvaluationResult.id.desc()).all()):
            aage_map.setdefault(row.submission_id, row)
        for row in (ExcelGradingResult.query
                    .filter(ExcelGradingResult.submission_type == 'assignment',
                            ExcelGradingResult.assignment_submission_id.in_(sub_ids))
                    .order_by(ExcelGradingResult.id.desc()).all()):
            legacy_map.setdefault(row.assignment_submission_id, row)

    submissions = []
    for sub in pagination.items:
        aage = aage_map.get(sub.id)
        legacy = legacy_map.get(sub.id)
        payload = _aage_legacy_payload(aage) if aage else (
            legacy.to_dict() if legacy else {})
        student = sub.student
        assignment = sub.assignment
        submissions.append({
            'submission_id': sub.id,
            'assignment_id': sub.assignment_id,
            'assignment_title': assignment.title if assignment else None,
            'student_id': sub.student_id,
            'student_name': f"{student.first_name} {student.last_name}" if student else None,
            'submitted_at': sub.submitted_at.isoformat() if sub.submitted_at else None,
            'manual_grade': sub.grade,
            'ai_graded': bool(payload),
            'ai_score': payload.get('total_score'),
            'ai_grade': payload.get('grade_letter'),
            'engine': payload.get('engine', 'legacy'),
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
    """Unified history: canonical AAGE results plus historical Excel rows."""
    course_id = request.args.get('course_id', type=int)
    student_id = request.args.get('student_id', type=int)
    if course_id and not _can_manage_course(course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403

    page = max(1, request.args.get('page', 1, type=int) or 1)
    per_page = max(1, min(100, request.args.get('per_page', 20, type=int) or 20))

    rows = []
    seen = set()
    aage_query = EvaluationResult.query
    if course_id:
        aage_query = aage_query.filter(EvaluationResult.course_id == course_id)
    if student_id:
        aage_query = aage_query.filter(EvaluationResult.student_id == student_id)
    for result in aage_query.all():
        key = (result.submission_type, result.submission_id)
        if key in seen:
            continue
        seen.add(key)
        payload = _aage_legacy_payload(result)
        payload['source'] = 'aage'
        rows.append(payload)

    legacy_query = ExcelGradingResult.query
    if course_id:
        legacy_query = legacy_query.filter(ExcelGradingResult.course_id == course_id)
    if student_id:
        legacy_query = legacy_query.filter(ExcelGradingResult.student_id == student_id)
    for legacy in legacy_query.all():
        sub_id = (legacy.assignment_submission_id
                  if legacy.submission_type == 'assignment'
                  else legacy.project_submission_id)
        key = (legacy.submission_type, sub_id)
        if key in seen:
            continue
        seen.add(key)
        payload = legacy.to_dict()
        payload['source'] = 'legacy'
        rows.append(payload)

    rows.sort(key=lambda r: str(r.get('graded_at') or ''), reverse=True)
    total = len(rows)
    start = (page - 1) * per_page
    return jsonify({
        'results': rows[start:start + per_page],
        'total': total,
        'page': page,
        'pages': (total + per_page - 1) // per_page,
    }), 200


# ==============================================================
# GET /stats/<course_id>  — AI grading stats for a course
# ==============================================================
@excel_grading_bp.route("/stats/<int:course_id>", methods=["GET"])
@instructor_or_admin_required
def grading_stats(course_id):
    """Statistics over canonical AAGE results and historical Excel rows."""
    if not _can_manage_course(course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403

    payloads = {}
    for result in (EvaluationResult.query
                   .filter(EvaluationResult.course_id == course_id).all()):
        payloads[(result.submission_type, result.submission_id)] = _aage_legacy_payload(result)
    for legacy in (ExcelGradingResult.query
                   .filter(ExcelGradingResult.course_id == course_id).all()):
        sub_id = (legacy.assignment_submission_id
                  if legacy.submission_type == 'assignment'
                  else legacy.project_submission_id)
        key = (legacy.submission_type, sub_id)
        if key not in payloads:
            payloads[key] = legacy.to_dict()

    results = list(payloads.values())
    if not results:
        return jsonify({
            'total_graded': 0, 'average_score': 0, 'average_percentage': 0,
            'grade_distribution': {}, 'confidence_breakdown': {},
            'review_status': {'reviewed': 0, 'pending_review': 0},
        }), 200

    scores = [float(r['total_score']) for r in results if r.get('total_score') is not None]
    max_scores = [float(r['max_score']) for r in results if r.get('max_score')]
    avg_score = sum(scores) / len(scores) if scores else 0
    valid_pcts = [s / m * 100 for s, m in zip(scores, max_scores) if m > 0]
    avg_pct = sum(valid_pcts) / len(valid_pcts) if valid_pcts else 0

    grade_dist = {}
    confidence_dist = {}
    reviewed = 0
    for row in results:
        grade_dist[row.get('grade_letter') or 'N/A'] = (
            grade_dist.get(row.get('grade_letter') or 'N/A', 0) + 1)
        label = row.get('confidence') or 'medium'
        confidence_dist[str(label)] = confidence_dist.get(str(label), 0) + 1
        if row.get('instructor_reviewed') or row.get('status') in ('approved', 'published', 'reviewed'):
            reviewed += 1

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


# ==============================================================
# ─── STUDENT ENDPOINTS ────────────────────────────────────────
# ==============================================================

# ==============================================================
# GET /auto-grade-status/<submission_id>  — Check auto-grade progress
# ==============================================================
@excel_grading_bp.route("/auto-grade-status/<int:submission_id>", methods=["GET"])
@student_required
def auto_grade_status(submission_id):
    """Student-safe grading status. Unreviewed results never expose a score."""
    uid = int(get_jwt_identity())
    sub_type = request.args.get('submission_type', 'assignment')
    if sub_type not in ('assignment', 'project'):
        return jsonify({"error": "submission_type must be 'assignment' or 'project'"}), 400
    try:
        loaded = aage_persistence.load_submission(sub_type, submission_id)
    except Exception:
        return jsonify({'status': 'not_started', 'result_id': None,
                        'grade_letter': None, 'percentage': None}), 200
    if loaded.student_id != uid:
        return jsonify({'status': 'not_started', 'result_id': None,
                        'grade_letter': None, 'percentage': None}), 200

    payload, _ = _latest_result_for_submission(
        sub_type, submission_id, finalised_only=True)
    if payload is not None:
        percentage = None
        if payload.get('max_score'):
            percentage = round(
                float(payload['total_score']) / max(float(payload['max_score']), 1) * 100, 1)
        return jsonify({
            'status': 'completed',
            'result_id': payload.get('id'),
            'grade_letter': payload.get('grade_letter'),
            'percentage': percentage,
            'engine': payload.get('engine', 'legacy'),
        }), 200

    active = aage_jobs.active_job(sub_type, submission_id)
    pending = _aage_result_for_submission(sub_type, submission_id)
    legacy = _legacy_for_submission(sub_type, submission_id)
    if pending is not None and not _finalised_aage(pending):
        status = 'pending_review'
    elif legacy is not None and not _finalised_legacy(legacy):
        status = 'pending_review'
    elif active is not None:
        status = 'processing'
    else:
        status = 'not_started'
    response = {'status': status, 'result_id': None,
                'grade_letter': None, 'percentage': None}
    if status == 'pending_review':
        response['message'] = 'AI assessment is awaiting instructor review.'
    return jsonify(response), 200


# ==============================================================
# GET /my-results  — Student's own AI grading results
# ==============================================================
@excel_grading_bp.route("/my-results", methods=["GET"])
@student_required
def my_results():
    """Only instructor-approved/published results are visible to students."""
    uid = int(get_jwt_identity())
    course_id = request.args.get('course_id', type=int)
    page = max(1, request.args.get('page', 1, type=int) or 1)
    per_page = max(1, min(100, request.args.get('per_page', 20, type=int) or 20))

    rows = {}
    seen = set()
    aage_query = EvaluationResult.query.filter(EvaluationResult.student_id == uid)
    if course_id:
        aage_query = aage_query.filter(EvaluationResult.course_id == course_id)
    for result in aage_query.all():
        if not _finalised_aage(result):
            continue
        key = (result.submission_type, result.submission_id)
        if key in seen:
            continue
        seen.add(key)
        payload = _aage_legacy_payload(result)
        payload['source'] = 'aage'
        rows[key] = payload

    legacy_query = ExcelGradingResult.query.filter(ExcelGradingResult.student_id == uid)
    if course_id:
        legacy_query = legacy_query.filter(ExcelGradingResult.course_id == course_id)
    for legacy in legacy_query.all():
        if not _finalised_legacy(legacy):
            continue
        sub_id = (legacy.assignment_submission_id
                  if legacy.submission_type == 'assignment'
                  else legacy.project_submission_id)
        key = (legacy.submission_type, sub_id)
        if key in seen:
            continue
        seen.add(key)
        payload = legacy.to_dict()
        payload['source'] = 'legacy'
        rows[key] = payload

    ordered = sorted(rows.values(),
                     key=lambda r: str(r.get('graded_at') or ''), reverse=True)
    start = (page - 1) * per_page
    return jsonify({
        'results': ordered[start:start + per_page],
        'total': len(ordered),
        'page': page,
        'pages': (len(ordered) + per_page - 1) // per_page,
    }), 200


# ==============================================================
# GET /my-results/<submission_id>  — Student's result by submission
# ==============================================================
@excel_grading_bp.route("/my-results/<int:submission_id>", methods=["GET"])
@student_required
def my_result_by_submission(submission_id):
    """Return the student's finalised result for one submission."""
    uid = int(get_jwt_identity())
    sub_type = request.args.get('submission_type', 'assignment')
    if sub_type not in ('assignment', 'project'):
        return jsonify({"error": "submission_type must be 'assignment' or 'project'"}), 400
    try:
        loaded = aage_persistence.load_submission(sub_type, submission_id)
    except Exception:
        return jsonify({"error": "No AI grading result found for this submission"}), 404
    if loaded.student_id != uid:
        return jsonify({"error": "No AI grading result found for this submission"}), 404

    payload, source = _latest_result_for_submission(
        sub_type, submission_id, finalised_only=True)
    if payload is None:
        return jsonify({"error": "No AI grading result found for this submission"}), 404
    payload['source'] = source
    return jsonify(payload), 200


# ==============================================================
# GET /analyze-assignment/<assignment_id> — dry-run interpretation
# ==============================================================
@excel_grading_bp.route("/analyze-assignment/<int:assignment_id>", methods=["GET", "POST"])
@instructor_or_admin_required
def analyze_assignment(assignment_id):
    """Show the generated assessment contract without grading a submission."""
    try:
        assignment = Assignment.query.get(assignment_id)
        if not assignment:
            return jsonify({"error": "Assignment not found"}), 404
        from ..services.excel_grading.excel_grading_service import ExcelGradingService
        service = ExcelGradingService()
        module = service._load_module(assignment)
        requirements = service._parse_requirements(assignment, module, assignment.course)
        spec = requirements.get('assessment_spec', {})
        scope = spec.get('scope', {})
        analyzers = []
        if scope.get('scope_formulas'):
            analyzers.append('FormulaAnalyzer')
        if scope.get('scope_charts'):
            analyzers.append('ChartAnalyzer')
        if scope.get('scope_pivots'):
            analyzers.append('PivotAnalyzer')
        if scope.get('scope_power_query'):
            analyzers.append('PowerQueryAnalyzer')
        if scope.get('scope_vba'):
            analyzers.append('VBAAnalyzer')
        if scope.get('scope_formatting'):
            analyzers.append('FormattingAnalyzer')
        ambiguities = [
            r['requirement'] for r in spec.get('requirements', [])
            if r.get('method_constraint') == 'flexible' or r.get('manual_review')
        ]
        return jsonify({
            'dry_run': True,
            'assignment': {
                'id': assignment.id,
                'title': assignment.title,
                'description': assignment.description,
                'instructions': assignment.instructions,
            },
            'assignment_interpretation': spec.get('identity', {}),
            'requirements_detected': spec.get('requirements', []),
            'rubric_generated': spec.get('rubric', {}),
            'analyzers_selected': analyzers,
            'evidence_strategies': sorted({r.get('evidence_source') for r in spec.get('requirements', [])}),
            'potential_ambiguities': ambiguities[:30],
            'difficulty': spec.get('difficulty', {}),
            'source_hash': spec.get('source_hash'),
        }), 200
    except Exception as exc:
        logger.exception("Assignment analysis error: %s", exc)
        return jsonify({"error": str(exc)}), 500


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

        # Limit file size to 50 MB to prevent memory abuse
        MAX_PREVIEW_SIZE = 50 * 1024 * 1024
        if len(file_bytes) > MAX_PREVIEW_SIZE:
            return jsonify({"error": "File too large. Maximum size is 50 MB."}), 400

        # Run analyzers
        from ..services.excel_grading.excel_analyzer import ExcelAnalyzer
        from ..services.excel_grading.formula_analyzer import FormulaAnalyzer
        from ..services.excel_grading.chart_analyzer import ChartAnalyzer
        from ..services.excel_grading.formatting_analyzer import FormattingAnalyzer

        wb = ExcelAnalyzer(file_bytes, file.filename)
        wb_analysis = wb.analyze()

        formula_analysis = FormulaAnalyzer(wb_analysis).analyze()
        chart_analysis = ChartAnalyzer(wb_analysis).analyze()
        formatting_analysis = FormattingAnalyzer(wb_analysis).analyze()

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
    """Project AAGE learning insights through the legacy endpoint."""
    course_id = request.args.get('course_id', type=int)
    if not course_id:
        return jsonify({"message": "course_id is required"}), 400
    if not _can_manage_course(course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403

    try:
        payload = aage_learning.learning_insights(course_ids=[course_id])
        payload['engine'] = 'aage'
        return jsonify(payload), 200
    except Exception as e:
        logger.exception("AAGE learning stats error: %s", e)
        return jsonify({"error": str(e)}), 500


# ==============================================================
# GET /learning/rubric/<assignment_id>  — Generated rubric for an assignment
# ==============================================================
@excel_grading_bp.route("/learning/rubric/<int:assignment_id>", methods=["GET"])
@instructor_or_admin_required
def get_generated_rubric(assignment_id):
    """Return the canonical AAGE rubric for an assignment."""
    rubric = (Rubric.query
              .filter(Rubric.assessment_kind == 'assignment',
                      Rubric.assessment_id == assignment_id)
              .order_by(Rubric.id.desc()).first())
    if rubric is None:
        return jsonify({"message": "No generated rubric found for this assignment"}), 404
    if not _can_manage_course(rubric.course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403
    return jsonify({"id": rubric.id, "engine": "aage",
                    "rubric": rubric.to_dict()}), 200


# ==============================================================
# POST /learning/rubric/<assignment_id>/approve  — Approve generated rubric
# ==============================================================
@excel_grading_bp.route("/learning/rubric/<int:assignment_id>/approve", methods=["POST"])
@instructor_or_admin_required
def approve_generated_rubric(assignment_id):
    """Approve the canonical AAGE rubric for an assignment."""
    rubric = (Rubric.query
              .filter(Rubric.assessment_kind == 'assignment',
                      Rubric.assessment_id == assignment_id)
              .order_by(Rubric.id.desc()).first())
    if rubric is None:
        return jsonify({"message": "No generated rubric found for this assignment"}), 404
    if not _can_manage_course(rubric.course_id):
        return jsonify({"message": "Instructor access to this course required"}), 403
    try:
        updated, version = aage_rubrics.rubric_intelligence.approve(
            rubric.id, int(get_jwt_identity()))
    except RubricError as exc:
        return jsonify({"error": getattr(exc, 'message', str(exc))}), 409
    return jsonify({"message": "Rubric approved successfully", "engine": "aage",
                    "rubric": updated.to_dict(),
                    "version": version.to_dict()}), 200
