"""HTTP layer for the Adaptive AI Assessment & Grading Engine.

All endpoints live under ``/api/v1/aage`` and return a consistent envelope::

    {"success": true, "data": ..., "meta": {...}}
    {"success": false, "error": {"code", "message", "details"}}

Authorization is enforced twice: a role check here and a course-ownership
check against the owning ``Course.instructor_id`` (admins bypass the latter).
Students may only *read* their own results/evidence.
"""

from __future__ import annotations

import logging
from datetime import datetime
from functools import wraps
from typing import Any, Dict, Optional

from flask import Blueprint, current_app, jsonify, request
from flask_jwt_extended import get_jwt_identity, verify_jwt_in_request
from flask_jwt_extended.exceptions import JWTExtendedException
from sqlalchemy import or_

from ..models.aage_models import (
    EvaluationResult,
    EvaluatorVersion,
    GradingJob,
    GradingReview,
)
from ..models.course_models import (
    Assignment, AssignmentSubmission, Course, Project, ProjectSubmission,
)
from ..models.excel_grading_models import ExcelGradingResult
from ..models.grading_models import Rubric
from ..models.user_models import User, db
from ..services.aage import (
    analytics,
    assessment_intelligence,
    jobs,
    learning,
    persistence,
    policies,
    review,
    rubric_intelligence,
)
from ..services.aage.assessment_intelligence import AssessmentNotFound
from ..services.aage.constants import (
    EVALUATOR_ACTIVE,
    EVALUATOR_RETIRED,
    JOB_CANCELLED,
    JOB_FAILED,
    JOB_STATUSES,
    JOB_TYPE_GRADE,
    JOB_TIMED_OUT,
    JOB_QUEUED,
    OPEN_REVIEW_STATUSES,
    RESULT_PUBLISHED,
    REVIEW_CHANGES,
    REVIEW_PENDING,
    SUBMISSION_ASSIGNMENT,
    SUBMISSION_PROJECT,
    SUBMISSION_TYPES,
)
from ..services.aage.evaluators import registry as evaluator_registry
from ..services.aage.submission_dispatch import uses_excel_grader
from ..services.aage.jobs import JobError
from ..services.aage.learning import LearningError
from ..services.aage.persistence import SubmissionNotFound
from ..services.aage.policies import PolicyPersistenceError
from ..services.aage.review import ReviewError
from ..services.aage.rubric_intelligence import RubricError
from ..services.aage.scoring import ScoringError
from ..utils.time_utils import now_local

logger = logging.getLogger("aage.routes")

aage_bp = Blueprint("aage_bp", __name__, url_prefix="/api/v1/aage")


# ---------------------------------------------------------------------------
# Envelope + error handling
# ---------------------------------------------------------------------------

class RouteError(Exception):
    def __init__(self, code: str, message: str, status: int = 400,
                 details: Optional[list] = None):
        super().__init__(message)
        self.code = code
        self.message = message
        self.status = status
        self.details = details or []


def ok(data: Any = None, meta: Optional[Dict[str, Any]] = None,
       status: int = 200):
    return jsonify({
        "success": True,
        "data": {} if data is None else data,
        "meta": meta or {},
    }), status


def fail(code: str, message: str, status: int = 400,
         details: Optional[list] = None):
    return jsonify({
        "success": False,
        "error": {"code": code, "message": message, "details": details or []},
    }), status


def _errors(fn):
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except RouteError as exc:
            db.session.rollback()
            return fail(exc.code, exc.message, exc.status, exc.details)
        except JWTExtendedException:
            db.session.rollback()
            return fail("unauthorized", "Authentication required", 401)
        except (RubricError, ReviewError, LearningError, JobError,
                AssessmentNotFound, SubmissionNotFound, ScoringError,
                PolicyPersistenceError) as exc:
            db.session.rollback()
            return fail(
                getattr(exc, "code", None) or "request_failed",
                getattr(exc, "message", None) or str(exc),
                int(getattr(exc, "status", None) or 400),
                list(getattr(exc, "details", None) or []),
            )
        except Exception as exc:
            db.session.rollback()
            logger.exception("AAGE endpoint %s failed", fn.__name__)
            return fail("internal_error", "Unable to complete the request", 500,
                        [{"type": type(exc).__name__}])
    return wrapper


def _auth(fn):
    """``jwt_required()`` semantics with the AAGE error envelope."""
    @wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            verify_jwt_in_request()
        except JWTExtendedException:
            return fail("unauthorized", "Authentication required", 401)
        return fn(*args, **kwargs)
    return wrapper


# ---------------------------------------------------------------------------
# Roles, ownership and payload helpers
# ---------------------------------------------------------------------------

def _current_user() -> User:
    identity = get_jwt_identity()
    try:
        user_id = int(identity)
    except (TypeError, ValueError):
        raise RouteError("unauthorized", "Invalid token identity", 401)
    user = User.query.get(user_id)
    if user is None or not getattr(user, "is_active", True):
        raise RouteError("unauthorized", "User not found", 401)
    return user


def _role(user: User) -> str:
    return str(getattr(getattr(user, "role", None), "name", "") or "").lower()


def _is_admin(user: User) -> bool:
    return _role(user) in ("admin", "superadmin")


def _instructor_only(fn):
    @wraps(fn)
    @_auth
    def wrapper(*args, **kwargs):
        user = _current_user()
        if _role(user) not in ("instructor", "admin", "superadmin"):
            raise RouteError("forbidden", "Instructor access required", 403)
        return fn(*args, **kwargs)
    return wrapper


def _admin_only(fn):
    @wraps(fn)
    @_auth
    def wrapper(*args, **kwargs):
        user = _current_user()
        if not _is_admin(user):
            raise RouteError("forbidden", "Administrator access required", 403)
        return fn(*args, **kwargs)
    return wrapper


def _read_allowed(fn):
    """Any authenticated user, with per-row ownership checks in the handler."""
    @wraps(fn)
    @_auth
    def wrapper(*args, **kwargs):
        _current_user()
        return fn(*args, **kwargs)
    return wrapper


def _owned_course_ids(user: User) -> Optional[list]:
    if _is_admin(user):
        return None
    return [row.id for row in Course.query.filter_by(instructor_id=user.id).all()]


def _require_course(course_id: Optional[int], user: User) -> Course:
    if not course_id:
        raise RouteError("forbidden", "Course ownership cannot be verified", 403)
    course = Course.query.get(course_id)
    if course is None:
        raise RouteError("not_found", "Course not found", 404)
    if not _is_admin(user) and course.instructor_id != user.id:
        raise RouteError("forbidden", "You do not own this course", 403)
    return course


def _body() -> Dict[str, Any]:
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        raise RouteError("invalid_payload", "A JSON object body is required")
    return data


def _page_args() -> tuple:
    page = request.args.get("page", 1, type=int) or 1
    per_page = request.args.get("per_page", 20, type=int) or 20
    return max(1, page), max(1, min(100, per_page))


def _parse_date_arg(name: str) -> Optional[datetime]:
    raw = (request.args.get(name) or "").strip()
    if not raw:
        return None
    try:
        return datetime.fromisoformat(raw.replace("Z", "+00:00")).replace(tzinfo=None)
    except ValueError:
        raise RouteError("invalid_payload", f"{name} must be an ISO-8601 date")


def _parse_bool_arg(name: str) -> Optional[bool]:
    raw = request.args.get(name)
    if raw is None or raw == "":
        return None
    text = str(raw).strip().lower()
    if text in ("1", "true", "yes", "on"):
        return True
    if text in ("0", "false", "no", "off"):
        return False
    raise RouteError("invalid_payload", f"{name} must be a boolean")


def _visible_jobs_query(user: User):
    """Base job query scoped to what the caller is allowed to see."""
    query = GradingJob.query
    if _is_admin(user):
        return query
    if _role(user) in ("instructor", "superadmin"):
        owned = _owned_course_ids(user) or []
        if not owned:
            return query.filter(GradingJob.id == -1)
        return query.filter(GradingJob.course_id.in_(owned))
    return query.filter(GradingJob.student_id == user.id)


def _visible_results_query(user: User):
    """Base result query scoped to what the caller is allowed to see."""
    from ..models.aage_models import EvaluationResult
    query = EvaluationResult.query
    if _is_admin(user):
        return query
    if _role(user) in ("instructor", "superadmin"):
        owned = _owned_course_ids(user) or []
        if not owned:
            return query.filter(EvaluationResult.id == -1)
        return query.filter(EvaluationResult.course_id.in_(owned))
    return query.filter(EvaluationResult.student_id == user.id)


def _audit(action: str, entity_type: str, entity_id: Optional[int], *,
           user: User, before: Any = None, after: Any = None,
           reason: str = "") -> None:
    persistence.audit(
        action=action, entity_type=entity_type, entity_id=entity_id,
        before=before, after=after, actor_id=user.id,
        actor_role=_role(user), reason=reason,
        ip_address=(request.remote_addr or "")[:60])


def _descriptor(kind: str, assessment_id: int, user: User):
    descriptor = assessment_intelligence.assessment_intelligence.load(
        kind, assessment_id)
    if not assessment_intelligence.assessment_intelligence.can_access(
            descriptor, user):
        raise RouteError("forbidden", "You do not own this assessment", 403)
    return descriptor


def _assessment_rubric(kind: str, assessment_id: int) -> Optional[Rubric]:
    return (Rubric.query
            .filter(Rubric.assessment_kind == kind,
                    Rubric.assessment_id == assessment_id)
            .order_by(Rubric.version.desc(), Rubric.id.desc()).first())


def _rubric_payload(rubric: Rubric) -> Dict[str, Any]:
    """Wire view of a rubric with both level vocabularies on every criterion.

    The ORM's ``to_dict`` only knows ``performance_levels``; the canonical wire
    key is ``levels``.  Keep the alias for legacy clients while never making
    them guess where the performance bands live.
    """
    payload = rubric.to_dict()
    for criterion in payload.get("criteria") or []:
        levels = (criterion.get("levels") or criterion.get("performance_levels")
                  or rubric_intelligence.DEFAULT_LEVELS)
        criterion["levels"] = levels
        criterion["performance_levels"] = levels
    return payload


def _rubric_owner(rubric: Rubric, user: User) -> None:
    if _is_admin(user):
        return
    if rubric.instructor_id == user.id:
        return
    if rubric.course_id:
        _require_course(rubric.course_id, user)
        return
    raise RouteError("forbidden", "You do not own this rubric", 403)


def _result(result_id: int):
    result = persistence.EvaluationResult.query.get(result_id)
    if result is None:
        raise RouteError("not_found", "Evaluation result not found", 404)
    return result


def _result_course_id(result) -> Optional[int]:
    if result.course_id:
        return result.course_id
    model = Assignment if result.assessment_kind == SUBMISSION_ASSIGNMENT else Project
    row = model.query.get(result.assessment_id)
    return getattr(row, "course_id", None) if row else None


def _result_access(result, user: User, *, writing: bool = False) -> None:
    if _is_admin(user):
        return
    if user.id == result.student_id:
        if writing:
            raise RouteError("forbidden", "Instructor access required", 403)
        return
    _require_course(_result_course_id(result), user)


def _job(job_id: int) -> GradingJob:
    job = jobs.get_job(job_id)
    if job is None:
        raise RouteError("not_found", "Grading job not found", 404)
    return job


def _job_access(job: GradingJob, user: User, *, writing: bool = False) -> None:
    if _is_admin(user):
        return
    if user.id == job.student_id:
        if writing:
            raise RouteError("forbidden", "Instructor access required", 403)
        return
    _require_course(job.course_id, user)


def _review_data(review_id: int) -> Dict[str, Any]:
    return review.get_review(review_id)


def _review_access(payload: Dict[str, Any], user: User) -> None:
    _result_access(_result(payload["review"]["result_id"]), user,
                   writing=_role(user) not in ("instructor", "admin", "superadmin"))


# ---------------------------------------------------------------------------
# Unified grading detail helpers
#
# AAGE is the only grading engine. Spreadsheet files are graded by the native
# ``spreadsheet`` specialist inside AAGE. The helpers below keep the old
# ``engine`` field in responses for compatibility, but it is always ``aage``;
# ``specialist`` tells the UI which specialist evaluator will be selected.
# ---------------------------------------------------------------------------

def _unified_grading_target(submission_type: str, submission_id: int,
                            user: User):
    if submission_type not in SUBMISSION_TYPES:
        raise RouteError("invalid_payload",
                         "submission_type must be assignment or project")
    if isinstance(submission_id, bool) or not isinstance(submission_id, int) \
            or submission_id <= 0:
        raise RouteError("invalid_payload",
                         "submission_id must be a positive integer")

    loaded = persistence.load_submission(submission_type, submission_id)
    _require_course(loaded.course_id, user)
    course = Course.query.get(loaded.course_id) if loaded.course_id else None
    return loaded, course, "aage"


def _specialist_for_submission(loaded: Any, course: Any) -> Optional[str]:
    """Best-effort specialist hint for status/UI responses (not an engine)."""
    try:
        if uses_excel_grader(course, loaded.files):
            return "spreadsheet"
    except Exception:  # pragma: no cover - status must stay best-effort
        pass
    return None


def _latest_excel_result(submission_type: str, submission_id: int):
    submission_column = (
        ExcelGradingResult.assignment_submission_id
        if submission_type == SUBMISSION_ASSIGNMENT
        else ExcelGradingResult.project_submission_id
    )
    return (ExcelGradingResult.query
            .filter(ExcelGradingResult.submission_type == submission_type,
                    submission_column == submission_id)
            .order_by(ExcelGradingResult.id.desc())
            .first())


def _latest_aage_rows(submission_type: str, submission_id: int):
    job = (GradingJob.query
           .filter(GradingJob.submission_type == submission_type,
                   GradingJob.submission_id == submission_id,
                   GradingJob.job_type == JOB_TYPE_GRADE)
           .order_by(GradingJob.id.desc())
           .first())
    result = (EvaluationResult.query
              .filter(EvaluationResult.submission_type == submission_type,
                      EvaluationResult.submission_id == submission_id)
              .order_by(EvaluationResult.id.desc())
              .first())
    # Keep the published grade visible when a newer re-grade draft exists.
    official = (EvaluationResult.query
                .filter(EvaluationResult.submission_type == submission_type,
                        EvaluationResult.submission_id == submission_id,
                        or_(EvaluationResult.is_official.is_(True),
                            EvaluationResult.status == RESULT_PUBLISHED))
                .order_by(EvaluationResult.published_at.desc(),
                          EvaluationResult.id.desc())
                .first())
    review = None
    if result is not None:
        review = (GradingReview.query
                  .filter(GradingReview.result_id == result.id)
                  .order_by(GradingReview.id.desc())
                  .first())
    return job, result, official, review


# ===========================================================================
# ASSESSMENTS
# ===========================================================================

@aage_bp.route("/assessments/<kind>/<int:assessment_id>/analyze", methods=["POST"])
@_errors
@_instructor_only
def analyze_assessment(kind: str, assessment_id: int):
    user = _current_user()
    descriptor = _descriptor(kind, assessment_id, user)
    data = assessment_intelligence.assessment_intelligence.analyze(descriptor)
    return ok(data, {"kind": kind, "assessment_id": assessment_id})


@aage_bp.route("/assessments/<kind>/<int:assessment_id>/rubric/generate",
               methods=["POST"])
@_errors
@_instructor_only
def generate_rubric(kind: str, assessment_id: int):
    user = _current_user()
    descriptor = _descriptor(kind, assessment_id, user)
    body = request.get_json(silent=True) or {}
    use_llm = bool(body.get("use_llm", True)) if isinstance(body, dict) else True
    rubric_row, warnings = rubric_intelligence.rubric_intelligence.generate(
        descriptor, actor_id=user.id, use_llm=use_llm)
    _audit("rubric_generated", "rubric", rubric_row.id, user=user,
           after={"status": rubric_row.status, "source": rubric_row.source},
           reason=f"generated for {kind} {assessment_id}")
    return ok(_rubric_payload(rubric_row), {"warnings": warnings}, status=201)


@aage_bp.route("/assessments/<kind>/<int:assessment_id>/rubric", methods=["GET"])
@_errors
@_instructor_only
def get_assessment_rubric(kind: str, assessment_id: int):
    user = _current_user()
    _descriptor(kind, assessment_id, user)
    rubric_row = _assessment_rubric(kind, assessment_id)
    return ok({"rubric": _rubric_payload(rubric_row) if rubric_row else None,
               "has_rubric": rubric_row is not None})


@aage_bp.route("/assessments/<kind>/<int:assessment_id>/rubric/versions",
               methods=["GET"])
@_errors
@_instructor_only
def get_rubric_versions(kind: str, assessment_id: int):
    user = _current_user()
    _descriptor(kind, assessment_id, user)
    rubric_row = _assessment_rubric(kind, assessment_id)
    versions = (rubric_intelligence.rubric_intelligence.versions(rubric_row.id)
                if rubric_row else [])
    return ok(versions, {"rubric_id": rubric_row.id if rubric_row else None})


@aage_bp.route("/rubrics/<int:rubric_id>", methods=["PUT"])
@_errors
@_instructor_only
def update_rubric(rubric_id: int):
    user = _current_user()
    rubric_row = rubric_intelligence.rubric_intelligence.get(rubric_id)
    _rubric_owner(rubric_row, user)
    body = _body()
    acknowledge = bool(body.pop("acknowledge_graded", False))
    # Older clients sent one rubric-wide ``performance_levels`` array.  Map it
    # onto criteria that do not declare their own bands instead of letting the
    # whitelist below drop it silently.
    legacy_levels = body.get("performance_levels")
    legacy_applied = 0
    if legacy_levels is not None:
        if not isinstance(legacy_levels, list):
            raise RouteError("invalid_payload", "performance_levels must be a list")
        incoming_criteria = body.get("criteria")
        if not isinstance(incoming_criteria, list) or not incoming_criteria:
            raise RouteError(
                "invalid_payload",
                "top-level performance_levels requires criteria to apply to")
        for criterion in incoming_criteria:
            if not isinstance(criterion, dict):
                raise RouteError("invalid_payload", "criteria entries must be objects")
            if not (criterion.get("levels") or criterion.get("performance_levels")):
                criterion["levels"] = legacy_levels
                criterion["performance_levels"] = legacy_levels
                legacy_applied += 1
        if not legacy_applied:
            raise RouteError(
                "invalid_payload",
                "performance_levels conflicts with per-criterion levels")
    allowed = {"title", "summary", "description", "discipline",
               "learning_objectives", "deliverables", "technologies",
               "evaluation_methods", "evaluator_recommendations",
               "unverifiable_requirements", "criteria"}
    changes = {k: v for k, v in body.items() if k in allowed}
    if "criteria" in changes and not isinstance(changes["criteria"], list):
        raise RouteError("invalid_payload", "criteria must be a list")
    before = {"status": rubric_row.status, "version": rubric_row.version}
    updated = rubric_intelligence.rubric_intelligence.update(
        rubric_id, changes, actor_id=user.id,
        acknowledge_graded=acknowledge)
    _audit("rubric_updated", "rubric", rubric_id, user=user, before=before,
           after={"status": updated.status, "version": updated.version},
           reason="instructor edited rubric")
    return ok(_rubric_payload(updated), {
        "acknowledge_graded": acknowledge,
        "legacy_performance_levels_applied": legacy_applied,
    })


@aage_bp.route("/rubrics/<int:rubric_id>/approve", methods=["POST"])
@_errors
@_instructor_only
def approve_rubric(rubric_id: int):
    user = _current_user()
    rubric_row = rubric_intelligence.rubric_intelligence.get(rubric_id)
    _rubric_owner(rubric_row, user)
    before = {"status": rubric_row.status, "version": rubric_row.version}
    updated, version = rubric_intelligence.rubric_intelligence.approve(
        rubric_id, user.id)
    _audit("rubric_approved", "rubric", rubric_id, user=user, before=before,
           after={"status": updated.status, "version": updated.version,
                  "rubric_version_id": version.id},
           reason="instructor approved rubric")
    return ok(_rubric_payload(updated), {"version": version.to_dict()})


# ===========================================================================
# GRADING
# ===========================================================================

@aage_bp.route("/grading/start", methods=["POST"])
@_errors
@_instructor_only
def start_grading():
    user = _current_user()
    body = _body()
    submission_type = body.get("submission_type")
    submission_id = body.get("submission_id")
    if submission_type not in (SUBMISSION_ASSIGNMENT, SUBMISSION_PROJECT):
        raise RouteError("invalid_payload",
                         "submission_type must be assignment or project")
    if isinstance(submission_id, bool) or not isinstance(submission_id, int) \
            or submission_id <= 0:
        raise RouteError("invalid_payload", "submission_id must be a positive integer")
    evaluators = body.get("evaluators") or []
    if not isinstance(evaluators, list) or any(
            not isinstance(name, str) or not name.strip()
            for name in evaluators):
        raise RouteError("invalid_payload", "evaluators must be a list of names")

    # Spreadsheet submissions are graded by the native spreadsheet specialist.
    # There is no competing Excel engine to dispatch around.
    loaded, _, _ = _unified_grading_target(
        submission_type, submission_id, user)

    existing = jobs.active_job(submission_type, submission_id)
    job = jobs.enqueue_grade_job(
        submission_type=submission_type,
        submission_id=submission_id,
        assessment_kind=loaded.assessment_kind,
        assessment_id=loaded.assessment_id,
        course_id=loaded.course_id,
        student_id=loaded.student_id,
        evaluators=[str(name).strip() for name in evaluators] or None,
        requested_by=user.id,
    )
    if existing is None:
        _audit("grading_started", "grading_job", job.id, user=user,
               after={"submission_type": submission_type,
                      "submission_id": submission_id},
               reason="instructor requested grading")
    return ok(job.to_dict(), {"deduplicated": existing is not None},
              status=201 if existing is None else 200)


@aage_bp.route("/grading/unified/status/<submission_type>/<int:submission_id>",
               methods=["GET"])
@_errors
@_instructor_only
def unified_grading_status(submission_type: str, submission_id: int):
    """Status for one grading-detail page.

    ``selected_engine`` is kept for API compatibility and is always ``aage``.
    ``specialist`` hints which evaluator family will be selected. Historical
    Excel rows are still returned so old results remain readable.
    """
    user = _current_user()
    loaded, course, engine = _unified_grading_target(
        submission_type, submission_id, user)

    excel_result = _latest_excel_result(submission_type, submission_id)
    job, result, official, review = _latest_aage_rows(
        submission_type, submission_id)

    data = {
        "submission_type": submission_type,
        "submission_id": submission_id,
        "selected_engine": engine,
        "specialist": _specialist_for_submission(loaded, course),
        "excel_result": excel_result.to_dict() if excel_result else None,
        "aage_job": job.to_dict() if job else None,
        "aage_result": result.to_dict(include_criteria=True) if result else None,
        "official_aage_result": (
            official.to_dict(include_criteria=True) if official else None),
        "review_id": (
            review.id
            if review is not None
            and review.status in ("pending", "changes_requested")
            else None
        ),
    }
    return ok(data, {"engine": engine, "specialist": data["specialist"]})


@aage_bp.route("/grading/unified/start", methods=["POST"])
@_errors
@_instructor_only
def start_unified_grading():
    """Start AAGE grading for any assignment or project submission.

    Spreadsheet files run through the native ``spreadsheet`` specialist inside
    AAGE. This endpoint never writes a grade itself: it only enqueues the job
    that the persistent worker processes through the canonical orchestrator.
    """
    user = _current_user()
    body = _body()
    submission_type = body.get("submission_type")
    submission_id = body.get("submission_id")
    force = body.get("force", False)
    evaluators = body.get("evaluators") or []

    if not isinstance(force, bool):
        raise RouteError("invalid_payload", "force must be a boolean")
    if not isinstance(evaluators, list) or any(
            not isinstance(name, str) or not name.strip()
            for name in evaluators):
        raise RouteError("invalid_payload", "evaluators must be a list of names")

    loaded, course, engine = _unified_grading_target(
        submission_type, submission_id, user)
    specialist = _specialist_for_submission(loaded, course)

    # An ordinary request for an unchanged submission returns the grade that is
    # already published. This keeps "same file, same score" true without
    # blocking an explicit force re-run by an instructor.
    if not force:
        reusable = persistence.published_result_for_current_files(
            submission_type, submission_id)
        if reusable is not None:
            return ok({
                "engine": engine,
                "specialist": specialist,
                "status": "already_graded",
                "result": reusable.to_dict(include_criteria=True),
            }, {"deduplicated": True})

    existing = jobs.active_job(submission_type, submission_id)
    job = jobs.enqueue_grade_job(
        submission_type=submission_type,
        submission_id=submission_id,
        assessment_kind=loaded.assessment_kind,
        assessment_id=loaded.assessment_id,
        course_id=loaded.course_id,
        student_id=loaded.student_id,
        evaluators=[str(name).strip() for name in evaluators] or None,
        requested_by=user.id,
        force=force,
    )
    if existing is None:
        _audit(
            "unified_grading_started", "grading_job", job.id, user=user,
            after={"engine": "aage", "specialist": specialist,
                   "submission_type": submission_type,
                   "submission_id": submission_id, "force": force},
            reason="instructor requested AI grading",
        )
    return ok({
        "engine": "aage",
        "specialist": specialist,
        "status": job.status,
        "job": job.to_dict(),
    }, {"deduplicated": existing is not None},
       status=201 if existing is None else 200)


@aage_bp.route("/grading/jobs", methods=["GET"])
@_errors
@_read_allowed
def list_grading_jobs():
    """Paginated grading queue for the caller's courses/own submissions."""
    user = _current_user()
    page, per_page = _page_args()
    query = _visible_jobs_query(user)

    course_id = request.args.get("course_id", type=int)
    if course_id is not None:
        _require_course(course_id, user)
        query = query.filter(GradingJob.course_id == course_id)
    assessment_id = request.args.get("assessment_id", type=int)
    if assessment_id is not None:
        query = query.filter(GradingJob.assessment_id == assessment_id)
    submission_type = (request.args.get("submission_type") or "").strip()
    if submission_type:
        if submission_type not in SUBMISSION_TYPES:
            raise RouteError("invalid_payload",
                             "submission_type must be assignment or project")
        query = query.filter(GradingJob.submission_type == submission_type)

    statuses = [s.strip() for s in
                (request.args.get("status") or "").split(",") if s.strip()]
    if statuses:
        invalid = [s for s in statuses if s not in JOB_STATUSES]
        if invalid:
            raise RouteError("invalid_payload",
                             f"unknown job status: {', '.join(invalid)}")
        query = query.filter(GradingJob.status.in_(statuses))

    date_from = _parse_date_arg("date_from")
    date_to = _parse_date_arg("date_to")
    if date_from is not None:
        query = query.filter(GradingJob.queued_at >= date_from)
    if date_to is not None:
        query = query.filter(GradingJob.queued_at <= date_to)

    evaluator = (request.args.get("evaluator") or "").strip().lower()
    ordered = query.order_by(GradingJob.id.desc())
    if evaluator:
        rows = [row for row in ordered.all()
                if evaluator in {str(name).strip().lower()
                                 for name in (row.evaluators or [])}]
        total = len(rows)
        rows = rows[(page - 1) * per_page:(page - 1) * per_page + per_page]
    else:
        total = ordered.count()
        rows = ordered.offset((page - 1) * per_page).limit(per_page).all()

    return ok([row.to_dict() for row in rows], {
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
    })


@aage_bp.route("/grading/jobs/<int:job_id>", methods=["GET"])
@_errors
@_read_allowed
def get_grading_job(job_id: int):
    user = _current_user()
    job = _job(job_id)
    _job_access(job, user)
    return ok(job.to_dict())


@aage_bp.route("/grading/jobs/<int:job_id>/retry", methods=["POST"])
@_errors
@_instructor_only
def retry_grading_job(job_id: int):
    user = _current_user()
    job = _job(job_id)
    _job_access(job, user, writing=True)
    if job.status not in (JOB_FAILED, JOB_CANCELLED, JOB_TIMED_OUT):
        raise RouteError("job_not_retryable",
                         f"job in status '{job.status}' cannot be retried", 409)
    before = {"status": job.status, "attempts": job.attempts}
    # Prior attempts may have left draft/pending results.  Retire them so a
    # retry cannot create a second active result for the same submission;
    # historical rows and every audit entry remain intact.
    persistence.supersede_results_for_submission(
        submission_type=job.submission_type,
        submission_id=job.submission_id,
        actor_id=user.id, reason="instructor requested retry")
    job.status = JOB_QUEUED
    job.attempts = 0
    job.error = None
    job.result_id = None
    job.next_attempt_at = None
    job.locked_by = None
    job.locked_at = None
    job.finished_at = None
    job.queued_at = now_local()
    job.progress = {"stage": "retry_queued"}
    persistence.db_commit()
    _audit("grading_job_retried", "grading_job", job.id, user=user,
           before=before, after={"status": job.status},
           reason="instructor requested retry")
    return ok(job.to_dict())


@aage_bp.route("/grading/jobs/<int:job_id>/cancel", methods=["POST"])
@_errors
@_instructor_only
def cancel_grading_job(job_id: int):
    user = _current_user()
    job = _job(job_id)
    _job_access(job, user, writing=True)
    if job.is_terminal():
        raise RouteError("job_not_cancellable", "job is already terminal", 409)
    cancelled = jobs.cancel_job(job_id, actor_id=user.id,
                                reason="cancelled via API")
    return ok(cancelled.to_dict())


@aage_bp.route("/grading/results", methods=["GET"])
@_errors
@_read_allowed
def list_grading_results():
    """Paginated result history for the caller's courses/own submissions."""
    user = _current_user()
    page, per_page = _page_args()
    query = _visible_results_query(user)

    course_id = request.args.get("course_id", type=int)
    if course_id is not None:
        _require_course(course_id, user)
        query = query.filter(persistence.EvaluationResult.course_id == course_id)
    assessment_id = request.args.get("assessment_id", type=int)
    if assessment_id is not None:
        query = query.filter(
            persistence.EvaluationResult.assessment_id == assessment_id)
    submission_type = (request.args.get("submission_type") or "").strip()
    if submission_type:
        if submission_type not in SUBMISSION_TYPES:
            raise RouteError("invalid_payload",
                             "submission_type must be assignment or project")
        query = query.filter(
            persistence.EvaluationResult.submission_type == submission_type)
    status = (request.args.get("status") or "").strip()
    if status:
        query = query.filter(persistence.EvaluationResult.status == status)
    requires_review = _parse_bool_arg("requires_review")
    if requires_review is not None:
        query = query.filter(
            persistence.EvaluationResult.requires_review.is_(requires_review))

    confidence = (request.args.get("confidence") or "").strip().lower()
    if confidence:
        if confidence in ("high", "medium", "low"):
            if confidence == "high":
                query = query.filter(
                    persistence.EvaluationResult.confidence >= 80)
            elif confidence == "medium":
                query = query.filter(
                    persistence.EvaluationResult.confidence >= 50,
                    persistence.EvaluationResult.confidence < 80)
            else:
                query = query.filter(
                    persistence.EvaluationResult.confidence < 50)
        else:
            try:
                threshold = float(confidence)
            except ValueError:
                raise RouteError(
                    "invalid_payload",
                    "confidence must be high, medium, low or a number")
            query = query.filter(
                persistence.EvaluationResult.confidence >= threshold)

    date_from = _parse_date_arg("date_from")
    date_to = _parse_date_arg("date_to")
    if date_from is not None:
        query = query.filter(persistence.EvaluationResult.created_at >= date_from)
    if date_to is not None:
        query = query.filter(persistence.EvaluationResult.created_at <= date_to)

    evaluator = (request.args.get("evaluator") or "").strip().lower()
    ordered = query.order_by(persistence.EvaluationResult.id.desc())
    if evaluator:
        rows = []
        for result in ordered.all():
            names = set()
            for item in result.evaluator_versions or []:
                if isinstance(item, dict):
                    names.add(str(item.get("name") or "").strip().lower())
                else:
                    names.add(str(item).strip().lower())
            if evaluator in names:
                rows.append(result)
        total = len(rows)
        rows = rows[(page - 1) * per_page:(page - 1) * per_page + per_page]
    else:
        total = ordered.count()
        rows = ordered.offset((page - 1) * per_page).limit(per_page).all()

    return ok([row.to_dict(include_criteria=False) for row in rows], {
        "page": page,
        "per_page": per_page,
        "total": total,
        "pages": (total + per_page - 1) // per_page,
    })


def _team_project_ids(submission_id: int, user_id: int):
    """All project submission ids/owners represented by a teammate's row.

    AAGE is enqueued for the submitting student, but a collaborative grade is
    mirrored to the whole team. Student-facing lookups must therefore accept
    any teammate's submission id and return the same published result.
    """
    row = ProjectSubmission.query.get(submission_id)
    if row is None:
        return None, None
    from ..services.project_scoring_service import team_member_ids
    member_ids = team_member_ids(row.project, row)
    if int(user_id) not in member_ids:
        return None, None
    rows = ProjectSubmission.query.filter(
        ProjectSubmission.project_id == row.project_id,
        ProjectSubmission.student_id.in_(member_ids),
    ).all()
    return [int(item.id) for item in rows], member_ids


def _student_result_payload(result) -> Dict[str, Any]:
    """Whitelisted projection: no prompts, evidence or internal diagnostics."""
    model = Assignment if result.assessment_kind == SUBMISSION_ASSIGNMENT else Project
    assessment = model.query.get(result.assessment_id)
    course = Course.query.get(result.course_id) if result.course_id else None

    # The engine does not generate resource recommendations.  Surface any
    # *stored* recommendations (future/instructor-supplied) after strict
    # validation, and otherwise return an honest empty list — never fabricate
    # titles or links from the feedback text.
    stored_resources = getattr(result, "recommended_resources", None)
    if not isinstance(stored_resources, list):
        stored_resources = []
    recommended_resources = [
        item for item in stored_resources
        if isinstance(item, dict) and isinstance(item.get("title"), str)
    ]

    # Revision state lives on the LMS submission, not on the AI result. Keep
    # it separate from feedback so the result page can explain why a resubmit
    # was requested without overwriting the grade narrative.
    modification_reason = None
    submission_model = (AssignmentSubmission if result.submission_type == "assignment"
                        else ProjectSubmission)
    lms_submission = submission_model.query.get(result.submission_id)
    if lms_submission is not None:
        if result.submission_type == "project":
            state = lms_submission.modification_state()
            modification_reason = (
                state.get("modification_request_reason")
                if state.get("modification_requested") else None
            )
        elif getattr(assessment, "modification_requested", False):
            modification_reason = getattr(assessment, "modification_request_reason", None)

    return {
        "submission_id": result.submission_id,
        "submission_type": result.submission_type,
        "assessment_title": getattr(assessment, "title", None),
        "course_title": getattr(course, "title", None),
        "status": result.status,
        "is_official": bool(result.is_official),
        "published_at": (result.published_at.isoformat()
                         if result.published_at else None),
        "final_score": result.final_score,
        "grade_letter": result.grade_letter,
        "points_awarded": result.points_awarded,
        "total_possible": result.total_possible,
        "feedback": result.feedback,
        "modification_request_reason": modification_reason,
        "strengths": result.strengths or [],
        "improvements": result.improvements or [],
        "recommended_resources": recommended_resources,
        "criteria": [
            {
                "criterion_key": c.criterion_key,
                "name": c.name,
                "awarded": c.awarded,
                "maximum": c.maximum,
                "feedback": c.feedback,
            }
            for c in result.criteria.all()
        ],
    }


@aage_bp.route("/student/results/<int:submission_id>", methods=["GET"])
@_errors
@_read_allowed
def get_student_result(submission_id: int):
    """A student's own *published* result for one submission."""
    user = _current_user()
    if _role(user) != "student":
        raise RouteError("forbidden", "Student access required", 403)
    submission_type = (request.args.get("submission_type") or "").strip()
    if submission_type and submission_type not in SUBMISSION_TYPES:
        raise RouteError("invalid_payload",
                         "submission_type must be assignment or project")

    submission_ids = [submission_id]
    student_ids = [user.id]
    if submission_type != "assignment":
        team_submissions, team_students = _team_project_ids(submission_id, user.id)
        if team_submissions:
            submission_ids = team_submissions
            student_ids = team_students

    query = persistence.EvaluationResult.query.filter(
        persistence.EvaluationResult.submission_id.in_(submission_ids),
        persistence.EvaluationResult.student_id.in_(student_ids),
        or_(persistence.EvaluationResult.is_official.is_(True),
            persistence.EvaluationResult.status == RESULT_PUBLISHED))
    if submission_type:
        query = query.filter(
            persistence.EvaluationResult.submission_type == submission_type)
    # Prefer the most recently published result. Selecting "latest by id" can
    # hide the official grade behind a later draft/re-grade and make the
    # student's score appear to disappear or change on refresh.
    result = query.order_by(
        persistence.EvaluationResult.published_at.desc(),
        persistence.EvaluationResult.id.desc()).first()
    if result is None:
        raise RouteError("not_found", "Published result not found", 404)
    return ok(_student_result_payload(result),
              {"submission_id": submission_id,
               "submission_type": result.submission_type})


@aage_bp.route("/student/grading-status/<int:submission_id>", methods=["GET"])
@_errors
@_read_allowed
def student_grading_status(submission_id: int):
    """Minimal grading state for one of the caller's own submissions.

    Student screens use this to distinguish "AAGE is still grading/reviewing"
    from "this submission never entered the AAGE queue" (the latter may be a
    legacy Excel course).  Only status and timestamps are returned — never
    evaluator internals, evidence, prompts or other students' data.
    """
    user = _current_user()
    if _role(user) != "student":
        raise RouteError("forbidden", "Student access required", 403)
    submission_type = (request.args.get("submission_type") or "").strip()
    if submission_type and submission_type not in SUBMISSION_TYPES:
        raise RouteError("invalid_payload",
                         "submission_type must be assignment or project")

    submission_ids = [submission_id]
    student_ids = [user.id]
    if submission_type != "assignment":
        team_submissions, team_students = _team_project_ids(submission_id, user.id)
        if team_submissions:
            submission_ids = team_submissions
            student_ids = team_students

    query = GradingJob.query.filter(
        GradingJob.submission_id.in_(submission_ids),
        GradingJob.student_id.in_(student_ids),
        GradingJob.job_type == JOB_TYPE_GRADE,
    )
    if submission_type:
        query = query.filter(GradingJob.submission_type == submission_type)
    job = query.order_by(GradingJob.id.desc()).first()

    # AAGE owns every assignment/project grade. ``specialist`` is only a hint
    # for the UI; it never selects a second engine.
    engine = "unknown"
    specialist = None
    if submission_type:
        try:
            loaded = persistence.load_submission(submission_type, submission_id)
            if int(loaded.student_id) in {int(sid) for sid in student_ids}:
                course = (getattr(loaded.parent, "course", None)
                          or Course.query.get(loaded.course_id))
                engine = "aage"
                specialist = _specialist_for_submission(loaded, course)
        except Exception:  # pragma: no cover - status must stay best-effort
            pass

    if job is None:
        return ok({
            "submission_id": submission_id,
            "submission_type": submission_type or None,
            "has_job": False,
            "engine": engine,
            "specialist": specialist,
            "status": None,
            "queued_at": None,
            "finished_at": None,
        })

    return ok({
        "submission_id": submission_id,
        "submission_type": job.submission_type,
        "has_job": True,
        "engine": engine,
        "specialist": specialist,
        "status": job.status,
        "queued_at": job.queued_at.isoformat() if job.queued_at else None,
        "finished_at": job.finished_at.isoformat() if job.finished_at else None,
    })


@aage_bp.route("/grading/results/<int:result_id>", methods=["GET"])
@_errors
@_read_allowed
def get_grading_result(result_id: int):
    user = _current_user()
    result = _result(result_id)
    _result_access(result, user)
    return ok(result.to_dict(include_criteria=True))


@aage_bp.route("/grading/results/<int:result_id>/evidence", methods=["GET"])
@_errors
@_read_allowed
def get_grading_evidence(result_id: int):
    user = _current_user()
    result = _result(result_id)
    _result_access(result, user)
    evidence = [e.to_dict() for e in persistence.EvaluationEvidence.query
                .filter_by(result_id=result.id)
                .order_by(persistence.EvaluationEvidence.id).all()]
    return ok(evidence, {"result_id": result.id, "count": len(evidence)})


@aage_bp.route("/grading/results/<int:result_id>/publish", methods=["POST"])
@_errors
@_instructor_only
def publish_grading_result(result_id: int):
    user = _current_user()
    result = _result(result_id)
    _result_access(result, user, writing=True)
    if result.is_official:
        raise RouteError("already_published", "result is already official", 409)

    if result.requires_review:
        review_row = result.review
        if review_row is None or review_row.status != "approved":
            raise RouteError("review_required",
                             "an approved instructor review is required", 409)
    policy = policies.confidence_policy()
    minimum = float(policy.get("provisional_min") or 75.0)
    if policy.get("require_all_gates", True) and float(result.confidence or 0) < minimum:
        raise RouteError("policy_blocked",
                         f"confidence is below the policy minimum of {minimum}", 409)

    # This generic publish endpoint enforces the confidence policy; the
    # dedicated review-approval path is the explicit human override that
    # bypasses automated gates. Both use write_through_grade(manual), which
    # still blocks superseded results and cancelled jobs.
    published = persistence.write_through_grade(
        result, actor_id=user.id, reason="explicit API publication",
        publication_mode="manual")
    if not published:
        raise RouteError("publish_failed", "grade could not be published", 409)
    return ok({"result_id": result.id, "is_official": True,
               "final_score": result.final_score},
              {"policy": policy})


# ===========================================================================
# REVIEWS
# ===========================================================================

@aage_bp.route("/reviews/pending", methods=["GET"])
@_errors
@_instructor_only
def pending_reviews():
    user = _current_user()
    page, per_page = _page_args()
    course_id = request.args.get("course_id", type=int)
    if course_id is not None:
        _require_course(course_id, user)
    status_arg = (request.args.get("status") or "").strip().lower()
    status_map = {
        "": OPEN_REVIEW_STATUSES,
        "open": OPEN_REVIEW_STATUSES,
        "pending": (REVIEW_PENDING,),
        "changes_requested": (REVIEW_CHANGES,),
    }
    if status_arg not in status_map:
        raise RouteError(
            "invalid_payload",
            "status must be pending, changes_requested or open")
    data = review.list_pending(course_id=course_id, page=page,
                               per_page=per_page,
                               course_ids=_owned_course_ids(user),
                               statuses=status_map[status_arg])
    return ok(data["items"], {"page": data["page"],
                              "per_page": data["per_page"],
                              "total": data["total"], "pages": data["pages"]})


@aage_bp.route("/reviews/<int:review_id>", methods=["GET"])
@_errors
@_instructor_only
def get_review(review_id: int):
    user = _current_user()
    payload = _review_data(review_id)
    _review_access(payload, user)
    return ok(payload)


@aage_bp.route("/reviews/<int:review_id>/criteria/<criterion_key>",
               methods=["PUT"])
@_errors
@_instructor_only
def update_review_criterion(review_id: int, criterion_key: str):
    user = _current_user()
    payload = _review_data(review_id)
    _review_access(payload, user)
    body = _body()
    marks = body.get("marks")
    reason = body.get("reason")
    if isinstance(marks, bool) or not isinstance(marks, (int, float, str)):
        raise RouteError("invalid_payload", "marks must be a number")
    if isinstance(marks, str):
        try:
            float(marks)
        except ValueError:
            raise RouteError("invalid_payload", "marks must be a number")
    if not isinstance(reason, str) or not reason.strip():
        raise RouteError("invalid_payload", "reason is required")
    data = review.update_criterion_marks(
        review_id, criterion_key, marks, reason, actor_id=user.id)
    return ok(data)


@aage_bp.route("/reviews/<int:review_id>/correction", methods=["POST"])
@_errors
@_instructor_only
def submit_review_correction(review_id: int):
    user = _current_user()
    payload = _review_data(review_id)
    _review_access(payload, user)
    body = _body()
    explanation = body.get("explanation")
    if not isinstance(explanation, str) or not explanation.strip():
        raise RouteError("invalid_payload", "explanation is required")
    create_example = body.get("create_learning_example", True)
    if not isinstance(create_example, bool):
        raise RouteError("invalid_payload",
                         "create_learning_example must be a boolean")
    data = review.submit_correction(
        review_id, explanation, actor_id=user.id,
        create_learning_example=create_example)
    return ok(data)


@aage_bp.route("/reviews/<int:review_id>/approve", methods=["POST"])
@_errors
@_instructor_only
def approve_review(review_id: int):
    user = _current_user()
    payload = _review_data(review_id)
    _review_access(payload, user)
    return ok(review.approve_review(review_id, actor_id=user.id))


@aage_bp.route("/reviews/<int:review_id>/reject", methods=["POST"])
@_errors
@_instructor_only
def reject_review(review_id: int):
    user = _current_user()
    payload = _review_data(review_id)
    _review_access(payload, user)
    body = _body()
    reason = body.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise RouteError("invalid_payload", "reason is required")
    return ok(review.reject_review(review_id, reason, actor_id=user.id))


# ===========================================================================
# LEARNING
# ===========================================================================

def _learning_course_scope(user: User) -> Optional[list]:
    """Course ids an instructor may see; ``None`` is the unrestricted admin view.

    An explicit ``course_id`` query argument is validated against ownership so
    a caller cannot silently widen the scope.  Without one, instructors are
    implicitly limited to the courses they own (existing callers keep working).
    """
    raw = request.args.get("course_id")
    if raw is not None and raw != "":
        try:
            course_id = int(raw)
        except (TypeError, ValueError):
            raise RouteError("invalid_payload", "course_id must be an integer")
        _require_course(course_id, user)
        return [course_id]
    return _owned_course_ids(user)


@aage_bp.route("/learning/insights", methods=["GET"])
@_errors
@_instructor_only
def learning_insights():
    user = _current_user()
    return ok(learning.learning_insights(
        course_ids=_learning_course_scope(user)))


@aage_bp.route("/learning/examples", methods=["GET"])
@_errors
@_instructor_only
def learning_examples():
    user = _current_user()
    status = request.args.get("status")
    return ok(learning.list_examples(
        status=status, course_ids=_learning_course_scope(user)),
        {"status": status})


@aage_bp.route("/learning/examples/<int:example_id>/approve", methods=["POST"])
@_errors
@_admin_only
def approve_learning_example(example_id: int):
    user = _current_user()
    return ok(learning.approve_example(example_id, actor_id=user.id))


@aage_bp.route("/learning/calibration/start", methods=["POST"])
@_errors
@_admin_only
def start_calibration():
    user = _current_user()
    body = _body()
    name = body.get("evaluator_name")
    candidate_id = body.get("candidate_version_id")
    dataset_version = body.get("dataset_version")
    if not isinstance(name, str) or not name.strip():
        raise RouteError("invalid_payload", "evaluator_name is required")
    if isinstance(candidate_id, bool) or not isinstance(candidate_id, int) \
            or candidate_id <= 0:
        raise RouteError("invalid_payload",
                         "candidate_version_id must be a positive integer")
    if dataset_version is not None and not isinstance(dataset_version, str):
        raise RouteError("invalid_payload", "dataset_version must be a string")
    data = learning.start_calibration(
        name.strip(), candidate_id, actor_id=user.id,
        dataset_version=dataset_version)
    return ok(data, status=201)


@aage_bp.route("/learning/calibration/<int:run_id>", methods=["GET"])
@_errors
@_instructor_only
def get_calibration(run_id: int):
    user = _current_user()
    # Calibration runs are global benchmarks; scope the per-submission cases
    # to courses the caller owns so student scores cannot leak across teachers.
    return ok(learning.get_calibration(
        run_id, course_ids=_learning_course_scope(user)))


@aage_bp.route("/learning/evaluator-versions/<int:version_id>/approve",
               methods=["POST"])
@_errors
@_admin_only
def approve_evaluator_version(version_id: int):
    user = _current_user()
    return ok(learning.approve_evaluator_version(version_id, actor_id=user.id))


@aage_bp.route("/learning/evaluator-versions/<int:version_id>/rollback",
               methods=["POST"])
@_errors
@_admin_only
def rollback_evaluator_version(version_id: int):
    user = _current_user()
    return ok(learning.rollback_evaluator_version(version_id, actor_id=user.id))


# ===========================================================================
# ANALYTICS
# ===========================================================================

@aage_bp.route("/analytics", methods=["GET"])
@_errors
@_instructor_only
def dashboard_analytics():
    """Instructor-facing metrics, scoped to a course they own.

    Administrators may omit ``course_id`` for a platform-wide view.  Instructors
    must supply it so one teacher can never see another teacher's grading data.
    """
    user = _current_user()
    course_id = request.args.get("course_id", type=int)
    if course_id is not None:
        _require_course(course_id, user)
    elif not _is_admin(user):
        raise RouteError("course_id_required",
                         "course_id is required for instructors", 400)
    return ok(analytics.dashboard_metrics(course_id=course_id),
              {"course_id": course_id})


# ===========================================================================
# EVALUATOR CATALOG
# ===========================================================================

# Quality/benchmark metrics and full version rows are deliberately restricted
# to administrators; instructors need only enough metadata to pick a specialist.
_INSTRUCTOR_EVALUATOR_FIELDS = (
    "name", "version", "active", "registered", "description",
    "supported_disciplines",
)


@aage_bp.route("/evaluators", methods=["GET"])
@_errors
@_instructor_only
def evaluator_catalog():
    """Instructor-safe catalog — no benchmark, quality rates or version detail."""
    _current_user()
    return ok([{field: row.get(field) for field in _INSTRUCTOR_EVALUATOR_FIELDS}
               for row in _evaluator_catalog_rows()])


# ===========================================================================
# ADMIN
# ===========================================================================

@aage_bp.route("/admin/evaluators", methods=["GET"])
@_errors
@_admin_only
def admin_evaluators():
    _current_user()
    return ok(_evaluator_catalog_rows())


def _evaluator_catalog_rows() -> list:
    """Full admin catalog (including metrics); never return it directly."""
    rows = []
    disabled = evaluator_registry.disabled_names()
    versions = EvaluatorVersion.query.order_by(
        EvaluatorVersion.name, EvaluatorVersion.id).all()
    by_name: Dict[str, list] = {}
    for version in versions:
        by_name.setdefault(version.name, []).append(version.to_dict())
    registered = {row["name"]: row for row in evaluator_registry.evaluator_catalog()}
    for name in sorted(set(by_name) | set(registered)):
        current = next((v for v in by_name.get(name, [])
                        if v["status"] == EVALUATOR_ACTIVE), None)
        info = registered.get(name, {})
        is_disabled = name.lower() in disabled
        # Prefer the active version's aggregate metrics; fall back to the
        # newest version row so the dashboard has something honest to show
        # even before a version is activated.
        versions_for_name = by_name.get(name, [])
        metrics = current or (versions_for_name[-1] if versions_for_name else {})
        rows.append({
            "name": name,
            "version": current["version"] if current else info.get("version"),
            # The durable admin switch wins over version-row status so a
            # disabled evaluator is reported (and selected) as disabled even
            # when an old active version row still exists.
            "active": current is not None and not is_disabled,
            "disabled": is_disabled,
            "registered": name in registered,
            "description": info.get("description"),
            "supported_disciplines": info.get("supported_disciplines", []),
            "benchmark_mae": metrics.get("benchmark_mae"),
            "criterion_agreement": metrics.get("criterion_agreement"),
            "false_pass_rate": metrics.get("false_pass_rate"),
            "false_fail_rate": metrics.get("false_fail_rate"),
            "override_rate": metrics.get("override_rate"),
            "sample_count": metrics.get("sample_count"),
            "versions": versions_for_name,
        })
    return rows


@aage_bp.route("/admin/evaluators/<name>", methods=["PATCH"])
@_errors
@_admin_only
def set_evaluator_active(name: str):
    user = _current_user()
    body = _body()
    active = body.get("active")
    if not isinstance(active, bool):
        raise RouteError("invalid_payload", "active must be a boolean")

    rows = (EvaluatorVersion.query.filter_by(name=name)
            .order_by(EvaluatorVersion.id.desc()).all())
    if active:
        current = next((r for r in rows if r.status == EVALUATOR_ACTIVE), None)
        if current is not None:
            evaluator_registry.set_evaluator_disabled(
                name, False, user_id=user.id,
                reason="admin enabled evaluator")
            return ok({"name": name, "active": True, "disabled": False,
                       "evaluator": current.to_dict()}, {"changed": False})
        source = rows[0] if rows else None
        if source is None:
            registered = evaluator_registry.get_evaluator(name)
            if registered is None:
                raise RouteError("not_found", "evaluator not found", 404)
            source = EvaluatorVersion(
                name=name,
                version=str(getattr(registered, "version", "1.0.0")),
                status="candidate",
                description=getattr(registered, "description", None),
                config={"enabled_via": "admin API"},
                created_by=user.id,
            )
            db.session.add(source)
            db.session.flush()
        before = {"status": source.status}
        source.status = EVALUATOR_ACTIVE
        source.activated_at = now_local()
        source.activated_by = user.id
        source.retired_at = None
        persistence.db_commit()
        evaluator_registry.set_evaluator_disabled(
            name, False, user_id=user.id, reason="admin enabled evaluator")
        _audit("evaluator_activated", "evaluator_version", source.id,
               user=user, before=before, after={"status": source.status},
               reason="admin enabled evaluator")
        return ok({"name": name, "active": True, "disabled": False,
                   "evaluator": source.to_dict()}, {"changed": True})

    if not rows and evaluator_registry.get_evaluator(name) is None:
        raise RouteError("not_found", "evaluator not found", 404)
    # Durable switch first: this is what selection and the admin listing read.
    evaluator_registry.set_evaluator_disabled(
        name, True, user_id=user.id, reason="admin disabled evaluator")
    changed = []
    for row in rows:
        if row.status == EVALUATOR_ACTIVE:
            before = {"status": row.status}
            row.status = EVALUATOR_RETIRED
            row.retired_at = now_local()
            changed.append(row.id)
            persistence.db_commit()
            _audit("evaluator_deactivated", "evaluator_version", row.id,
                   user=user, before=before, after={"status": row.status},
                   reason="admin disabled evaluator")
    return ok({"name": name, "active": False, "disabled": True,
               "changed_ids": changed})


@aage_bp.route("/admin/policies", methods=["GET"])
@_errors
@_admin_only
def get_policies():
    _current_user()
    return ok(policies.confidence_policy())


@aage_bp.route("/admin/policies", methods=["PUT"])
@_errors
@_admin_only
def update_policies():
    user = _current_user()
    body = _body()
    updates: Dict[str, Any] = {}
    for key in ("auto_publish_min", "provisional_min", "auto_approve_min"):
        if key in body:
            value = body[key]
            if isinstance(value, bool) or not isinstance(value, (int, float)) \
                    or not 0 <= float(value) <= 100:
                raise RouteError("invalid_payload",
                                 f"{key} must be a percentage between 0 and 100")
            updates[key] = float(value)
    for key in ("auto_publish_enabled", "require_all_gates",
                "auto_approve_enabled"):
        if key in body:
            if not isinstance(body[key], bool):
                raise RouteError("invalid_payload", f"{key} must be a boolean")
            updates[key] = body[key]
    if not updates:
        raise RouteError("invalid_payload", "no policy fields supplied")
    before = policies.confidence_policy()
    merged = dict(before)
    merged.update(updates)
    if float(merged["auto_publish_min"]) < float(merged["provisional_min"]):
        raise RouteError(
            "invalid_payload",
            "auto_publish_min must be greater than or equal to provisional_min")
    after = policies.set_confidence_policy(updates, user_id=user.id,
                                           reason="admin API policy update")
    _audit("policy_updated", "grading_policy", None, user=user,
           before=before, after=after, reason="admin updated grading policy")
    return ok(after, {"changed": sorted(updates)})


@aage_bp.route("/admin/analytics", methods=["GET"])
@_errors
@_admin_only
def admin_analytics():
    _current_user()
    course_id = request.args.get("course_id", type=int)
    return ok(analytics.dashboard_metrics(course_id=course_id),
              {"course_id": course_id})


__all__ = ["aage_bp"]
