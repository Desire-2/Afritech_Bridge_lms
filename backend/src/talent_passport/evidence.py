"""Talent Passport evidence engine.

Every row written here is derived from an existing LMS record. The LMS tables
remain the single source of truth for progress, grading, certificates and
achievements. Writes are idempotent: a corrected grade or a revoked
certificate updates the existing evidence row instead of creating a duplicate.
"""

from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

from sqlalchemy import or_

from ..models.aage_models import EvaluationResult, GradingReview
from ..models.achievement_models import UserAchievement
from ..models.course_models import (
    Assignment,
    AssignmentSubmission,
    Course,
    Enrollment,
    Project,
    ProjectSubmission,
    Quiz,
    TeamAssignmentEvent,
)
from ..models.excel_grading_models import ExcelGradingResult
from ..models.quiz_progress_models import QuizAttempt
from ..models.grading_models import GradingHistory
from ..models.student_models import Certificate, SkillBadge, StudentSkillBadge
from ..models.user_models import User, db
from ..utils.time_utils import now_local
from .config import DEFAULT_DEMONSTRATION_SCORE
from .enums import (
    EVIDENCE_APPROVED,
    EVIDENCE_PENDING,
    EVIDENCE_REJECTED,
    EVIDENCE_VERIFIED,
    GRADE_APPROVED,
    GRADE_AWAITING_REVIEW,
    GRADE_PROVISIONAL,
    GRADE_UPDATED,
    GRADE_VERIFIED,
    MAPPING_ASSIGNMENT,
    MAPPING_ASSESSMENT,
    MAPPING_COURSE_OUTCOME,
    MAPPING_PROJECT,
    SKILL_DEMONSTRATED,
    SKILL_EVIDENCE_SUBMITTED,
    SKILL_LEARNING,
    SKILL_STATUS_RANK,
    SKILL_VERIFIED,
    SOURCE_ASSIGNMENT_SUBMISSION,
    SOURCE_CERTIFICATE,
    SOURCE_COURSE,
    SOURCE_PROJECT_SUBMISSION,
    SOURCE_QUIZ_ATTEMPT,
)
from .models import (
    CourseSkillMapping,
    PassportAuditEvent,
    PassportVisibility,
    PortfolioItem,
    ProcessedPassportEvent,
    SkillEvidence,
    StudentSkill,
    TalentPassport,
    _new_slug,
)
from .taxonomy import ensure_default_course_mappings, ensure_taxonomy


def _iso(value: Optional[datetime]) -> Optional[str]:
    return value.isoformat() if value else None


def _json_list(value: Any) -> List[Any]:
    if isinstance(value, list):
        return value
    if not value:
        return []
    try:
        parsed = json.loads(value)
        return parsed if isinstance(parsed, list) else []
    except (TypeError, ValueError):
        return []


def _percent(raw: Optional[float], possible: Optional[float] = None) -> Optional[float]:
    if raw is None:
        return None
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return None
    if possible:
        try:
            maximum = float(possible)
            if maximum > 0 and 0 <= value <= maximum:
                return round(value / maximum * 100.0, 2)
        except (TypeError, ValueError):
            pass
    return round(value, 2)


def _event_key(event_type: str, student_id: int, source_type: str,
               source_id: int, suffix: str = "") -> str:
    raw = f"{event_type}|{student_id}|{source_type}|{source_id}|{suffix}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:32]


# ---------------------------------------------------------------------------
# Passport lifecycle helpers
# ---------------------------------------------------------------------------
def ensure_passport(student_id: int) -> TalentPassport:
    """Return the one passport belonging to an existing LMS user."""
    user = User.query.get(student_id)
    if user is None:
        raise ValueError(f"Student {student_id} does not exist")

    passport = TalentPassport.query.filter_by(student_id=student_id).first()
    if passport is None:
        passport = TalentPassport(
            student_id=student_id,
            public_slug=_new_slug(),
            is_published=False,
        )
        db.session.add(passport)
        db.session.flush()

    ensure_visibility(passport)
    return passport


def ensure_visibility(passport: TalentPassport) -> PassportVisibility:
    # Query by foreign key instead of trusting ``passport.visibility``: that
    # relationship may be cached as None on a freshly created passport whose
    # visibility row was added directly by an earlier call in the same session.
    visibility = PassportVisibility.query.filter_by(passport_id=passport.id).first()
    if visibility is None:
        visibility = PassportVisibility(passport_id=passport.id)
        db.session.add(visibility)
        db.session.flush()
    passport.visibility = visibility  # keep the in-memory relationship consistent
    return visibility


def audit(passport: TalentPassport, action: str, actor_id: Optional[int] = None,
          actor_role: Optional[str] = None, details: Optional[Dict] = None) -> PassportAuditEvent:
    event = PassportAuditEvent(
        passport_id=passport.id,
        actor_id=actor_id,
        actor_role=actor_role,
        action=action,
        details=details or {},
    )
    db.session.add(event)
    return event


def mark_processed(event_key: str, event_type: str, student_id: int) -> bool:
    """Return True if this event key was newly recorded."""
    if ProcessedPassportEvent.query.get(event_key):
        return False
    db.session.add(ProcessedPassportEvent(
        event_key=event_key, event_type=event_type, student_id=student_id
    ))
    db.session.flush()
    return True


# ---------------------------------------------------------------------------
# Mapping resolution
# ---------------------------------------------------------------------------
def mappings_for_course(course_id: int,
                        source_type: Optional[str] = None,
                        source_id: Optional[int] = None) -> List[CourseSkillMapping]:
    """Resolve authorized mappings for a course.

    A specific assessment/project mapping wins. Course-outcome mappings are
    the system-authored fallback and only ever represent learning until a real
    grade or credential is attached.
    """
    query = CourseSkillMapping.query.filter_by(course_id=course_id)
    if source_type is not None and source_id is not None:
        specific = query.filter_by(source_type=source_type, source_id=source_id).all()
        if specific:
            return specific
    return query.filter_by(source_type=MAPPING_COURSE_OUTCOME, source_id=0).all()


def course_for_quiz(quiz: Quiz) -> Optional[Course]:
    if quiz.course_id:
        return Course.query.get(quiz.course_id)
    if quiz.module_id:
        from ..models.course_models import Module
        module = Module.query.get(quiz.module_id)
        return Course.query.get(module.course_id) if module else None
    if quiz.lesson_id:
        from ..models.course_models import Lesson, Module
        lesson = Lesson.query.get(quiz.lesson_id)
        if lesson and lesson.module_id:
            module = Module.query.get(lesson.module_id)
            return Course.query.get(module.course_id) if module else None
    return None


def course_for_assignment(assignment: Assignment) -> Optional[Course]:
    if assignment.course_id:
        return Course.query.get(assignment.course_id)
    if assignment.module_id:
        from ..models.course_models import Module
        module = Module.query.get(assignment.module_id)
        return Course.query.get(module.course_id) if module else None
    return None


# ---------------------------------------------------------------------------
# Grade provenance
# ---------------------------------------------------------------------------
def _official_grade(submission_type: str, submission_id: int,
                    raw_grade: Optional[float], possible: Optional[float],
                    graded_at: Optional[datetime],
                    graded_by: Optional[int]) -> Tuple[Optional[float], str, str, str]:
    """Resolve the strongest *authorized* grade for a submission.

    Returns ``(score, grading_state, verification_status, basis)``. AI-only
    results never produce an authorized score here.
    """
    # AAGE is the canonical grading engine. Only published/official results
    # count, and a review-gated result needs an approved instructor review.
    official = (EvaluationResult.query
                .filter(EvaluationResult.submission_type == submission_type,
                        EvaluationResult.submission_id == submission_id,
                        or_(EvaluationResult.is_official.is_(True),
                            EvaluationResult.status == "published"))
                .order_by(EvaluationResult.published_at.desc(), EvaluationResult.id.desc())
                .first())
    if official:
        review = GradingReview.query.filter_by(result_id=official.id).first()
        review_ok = (
            not official.requires_review
            or (review is not None and review.status == "approved")
        )
        if review_ok:
            score = official.final_score
            if review and review.final_score is not None:
                score = review.final_score
            return (
                _percent(score),
                GRADE_APPROVED,
                EVIDENCE_APPROVED,
                f"AAGE evaluation #{official.id} published by instructor",
            )

    # Historical Excel results are only authoritative after explicit review.
    column = (ExcelGradingResult.assignment_submission_id if submission_type == "assignment"
              else ExcelGradingResult.project_submission_id)
    excel = (ExcelGradingResult.query
             .filter(column == submission_id,
                     ExcelGradingResult.instructor_reviewed.is_(True))
             .order_by(ExcelGradingResult.id.desc())
             .first())
    if excel:
        score = excel.instructor_override_score
        if score is None:
            score = _percent(excel.total_score, excel.max_score)
        else:
            score = _percent(score, excel.max_score)
        return score, GRADE_APPROVED, EVIDENCE_APPROVED, "Instructor-reviewed Excel grading result"

    if raw_grade is None or graded_at is None:
        return None, GRADE_AWAITING_REVIEW, EVIDENCE_PENDING, "Submission awaiting review"

    # Classic grade. Require an instructor/admin/staff grader signal or a
    # grading-history row. A graded_by of None means AI/system and stays
    # provisional.
    # Use the most recent audit entry: a corrected grade must be reflected as
    # "updated", not mislabelled by the original "created" row.
    history = (GradingHistory.query
               .filter_by(submission_type=submission_type, submission_id=submission_id)
               .order_by(GradingHistory.created_at.desc(), GradingHistory.id.desc())
               .first())
    grader = User.query.get(graded_by) if graded_by else None
    grader_role = (grader.role.name if grader and grader.role else None)
    staff_role = str(grader_role or "").lower() in {"instructor", "admin", "superadmin", "staff"}

    if history or staff_role:
        state = GRADE_UPDATED if (history and str(history.action).lower() == "updated") else GRADE_APPROVED
        return (
            _percent(raw_grade, possible),
            state,
            EVIDENCE_APPROVED,
            f"Instructor grade recorded by user #{graded_by}",
        )

    return None, GRADE_PROVISIONAL, EVIDENCE_PENDING, "AI/provisional result not approved"


# ---------------------------------------------------------------------------
# Evidence upsert and status derivation
# ---------------------------------------------------------------------------
def get_or_create_student_skill(passport: TalentPassport, student_id: int,
                                skill_definition_id: int) -> StudentSkill:
    row = (StudentSkill.query
           .filter_by(passport_id=passport.id, skill_definition_id=skill_definition_id)
           .first())
    if row is None:
        row = StudentSkill(
            passport_id=passport.id,
            student_id=student_id,
            skill_definition_id=skill_definition_id,
            status=SKILL_LEARNING,
        )
        db.session.add(row)
        db.session.flush()
    return row


def upsert_evidence(student_skill: StudentSkill, *, source_type: str,
                    source_id: int, mapping: Optional[CourseSkillMapping],
                    title: Optional[str] = None,
                    happened_at: Optional[datetime] = None,
                    score: Optional[float] = None,
                    grading_state: Optional[str] = None,
                    verification_status: str = EVIDENCE_PENDING,
                    verified_by: Optional[int] = None,
                    verified_at: Optional[datetime] = None,
                    event_key: Optional[str] = None,
                    extra: Optional[Dict] = None) -> Tuple[Optional[SkillEvidence], bool]:
    """Insert or update one evidence row; never duplicate a source tuple."""
    row = (SkillEvidence.query
           .filter_by(student_skill_id=student_skill.id,
                      source_type=source_type, source_id=source_id)
           .first())
    created = row is None
    if row is None:
        row = SkillEvidence(
            student_skill_id=student_skill.id,
            student_id=student_skill.student_id,
            source_type=source_type,
            source_id=source_id,
        )
        db.session.add(row)

    row.course_id = mapping.course_id if mapping else row.course_id
    row.mapping_id = mapping.id if mapping else row.mapping_id
    row.title = title or row.title
    row.happened_at = happened_at or row.happened_at
    row.score = score
    row.grading_state = grading_state
    row.verification_status = verification_status
    row.verified_by = verified_by
    row.verified_at = verified_at
    row.event_key = event_key or row.event_key
    row.extra = extra
    db.session.flush()
    return row, created


def evidence_status(evidence: SkillEvidence,
                    mapping: Optional[CourseSkillMapping] = None) -> str:
    """Derive the public-facing status of one evidence row."""
    if evidence.verification_status == EVIDENCE_REJECTED:
        return SKILL_LEARNING
    if evidence.source_type == SOURCE_COURSE and not evidence.grading_state:
        return SKILL_LEARNING
    if evidence.verification_status == EVIDENCE_VERIFIED:
        return SKILL_VERIFIED

    if evidence.grading_state in (GRADE_APPROVED, GRADE_UPDATED, GRADE_VERIFIED):
        minimum = (mapping.min_score if mapping and mapping.min_score is not None
                   else DEFAULT_DEMONSTRATION_SCORE)
        if evidence.score is not None and float(evidence.score) >= float(minimum):
            if (mapping and mapping.required_verification
                    and evidence.verification_status not in (EVIDENCE_APPROVED, EVIDENCE_VERIFIED)):
                return SKILL_EVIDENCE_SUBMITTED
            return SKILL_DEMONSTRATED
        return SKILL_EVIDENCE_SUBMITTED

    if evidence.grading_state in (GRADE_PROVISIONAL, GRADE_AWAITING_REVIEW):
        return SKILL_EVIDENCE_SUBMITTED

    return SKILL_LEARNING


def recompute_student_skill(student_skill: StudentSkill) -> str:
    """Recompute status/proficiency from all current evidence rows."""
    evidence_rows = (SkillEvidence.query
                     .filter_by(student_skill_id=student_skill.id)
                     .order_by(SkillEvidence.happened_at.desc(), SkillEvidence.id.desc())
                     .all())
    mapping_ids = {row.mapping_id for row in evidence_rows if row.mapping_id}
    mappings = ({m.id: m for m in CourseSkillMapping.query.filter(CourseSkillMapping.id.in_(mapping_ids)).all()}
                if mapping_ids else {})

    statuses = []
    for row in evidence_rows:
        if row.verification_status == EVIDENCE_REJECTED:
            continue
        statuses.append(evidence_status(row, mappings.get(row.mapping_id)))

    status = max(statuses, key=lambda item: SKILL_STATUS_RANK[item]) if statuses else SKILL_LEARNING
    student_skill.status = status

    timestamps = [row.happened_at or row.created_at for row in evidence_rows
                  if row.happened_at or row.created_at]
    student_skill.first_evidence_at = min(timestamps) if timestamps else None
    student_skill.verified_at = (
        now_local() if status == SKILL_VERIFIED and student_skill.verified_at is None
        else student_skill.verified_at if status == SKILL_VERIFIED else None
    )

    # Proficiency exists only when an authorized mapping supplies a label and
    # criterion. Enrolment or an unconfigured assessment never awards it.
    proficiency = None
    basis = None
    for row in evidence_rows:
        mapping = mappings.get(row.mapping_id)
        if not mapping or not mapping.proficiency_label or mapping.min_score is None:
            continue
        if row.score is None or float(row.score) < float(mapping.min_score):
            continue
        if row.verification_status in (EVIDENCE_PENDING, EVIDENCE_REJECTED):
            continue
        if row.grading_state not in (GRADE_APPROVED, GRADE_UPDATED, GRADE_VERIFIED):
            continue
        proficiency = mapping.proficiency_label
        basis = mapping.competency_criteria or (
            f"Authorized assessment criterion (minimum {mapping.min_score:g}%)"
        )
        break
    student_skill.proficiency_level = proficiency
    student_skill.proficiency_basis = basis
    db.session.flush()
    return status


# ---------------------------------------------------------------------------
# Source synchronizers
# ---------------------------------------------------------------------------
def _sync_enrollment(passport: TalentPassport, enrollment: Enrollment) -> Dict[str, int]:
    counts = {"skills": 0, "created": 0, "updated": 0}
    course = Course.query.get(enrollment.course_id)
    if course is None:
        return counts

    ensure_taxonomy()
    ensure_default_course_mappings(course)
    mappings = mappings_for_course(course.id)
    for mapping in mappings:
        student_skill = get_or_create_student_skill(
            passport, enrollment.student_id, mapping.skill_definition_id
        )
        key = _event_key("enrollment.created", enrollment.student_id, SOURCE_COURSE,
                         enrollment.id, suffix=f"mapping-{mapping.id}")
        _, created = upsert_evidence(
            student_skill,
            source_type=SOURCE_COURSE,
            source_id=enrollment.id,
            mapping=mapping,
            title=f"Enrolled in {course.title}",
            happened_at=enrollment.enrollment_date,
            grading_state=None,
            verification_status=EVIDENCE_PENDING,
            event_key=key,
            extra={"course_id": course.id, "status": enrollment.status},
        )
        counts["created" if created else "updated"] += 1
        recompute_student_skill(student_skill)
        counts["skills"] += 1
    return counts


def _sync_assignment(passport: TalentPassport, submission: AssignmentSubmission,
                     course: Course) -> Dict[str, int]:
    counts = {"created": 0, "updated": 0}
    assignment = Assignment.query.get(submission.assignment_id)
    if not assignment:
        return counts

    mappings = mappings_for_course(course.id, MAPPING_ASSIGNMENT, assignment.id)
    if not mappings:
        return counts

    score, grading_state, verification, basis = _official_grade(
        "assignment", submission.id, submission.grade,
        assignment.points_possible, submission.graded_at, submission.graded_by
    )
    for mapping in mappings:
        key = _event_key(
            "assignment.graded" if grading_state else "assignment.submitted",
            submission.student_id,
            SOURCE_ASSIGNMENT_SUBMISSION,
            submission.id,
            suffix=f"{_iso(submission.graded_at) or ''}|mapping-{mapping.id}",
        )
        student_skill = get_or_create_student_skill(
            passport, submission.student_id, mapping.skill_definition_id
        )
        _, created = upsert_evidence(
            student_skill,
            source_type=SOURCE_ASSIGNMENT_SUBMISSION,
            source_id=submission.id,
            mapping=mapping,
            title=assignment.title,
            happened_at=submission.submitted_at,
            score=score,
            grading_state=grading_state,
            verification_status=verification,
            event_key=key,
            extra={"basis": basis, "course_id": course.id},
        )
        counts["created" if created else "updated"] += 1
        recompute_student_skill(student_skill)
    return counts


def _is_team_submission(submission: ProjectSubmission, course_id: int) -> bool:
    members = _json_list(submission.team_members)
    if members:
        return True
    # A member row created by grade propagation deliberately has no roster;
    # the append-only team events are the authoritative membership history.
    events = TeamAssignmentEvent.query.filter_by(project_id=submission.project_id).all()
    for event in events:
        if event.affected_member_id == submission.student_id:
            return True
        if submission.student_id in _json_list(event.member_ids):
            return True
    return False


def _sync_project(passport: TalentPassport, submission: ProjectSubmission,
                  course: Course) -> Dict[str, int]:
    counts = {"created": 0, "updated": 0}
    project = Project.query.get(submission.project_id)
    if not project:
        return counts

    mappings = mappings_for_course(course.id, MAPPING_PROJECT, project.id)
    if not mappings:
        return counts

    score, grading_state, verification, basis = _official_grade(
        "project", submission.id, submission.grade,
        project.points_possible, submission.graded_at, submission.graded_by
    )
    is_team = _is_team_submission(submission, course.id)
    # A shared team grade is not proof of an individual's capability.
    if is_team and grading_state in (GRADE_APPROVED, GRADE_UPDATED):
        grading_state = GRADE_AWAITING_REVIEW
        verification = EVIDENCE_PENDING
        score = None
        basis = "Team submission; individual contribution not separately verified"

    for mapping in mappings:
        key = _event_key(
            "project.graded" if grading_state else "project.submitted",
            submission.student_id,
            SOURCE_PROJECT_SUBMISSION,
            submission.id,
            suffix=f"{_iso(submission.graded_at) or ''}|mapping-{mapping.id}",
        )
        student_skill = get_or_create_student_skill(
            passport, submission.student_id, mapping.skill_definition_id
        )
        _, created = upsert_evidence(
            student_skill,
            source_type=SOURCE_PROJECT_SUBMISSION,
            source_id=submission.id,
            mapping=mapping,
            title=project.title,
            happened_at=submission.submitted_at or submission.created_at,
            score=score,
            grading_state=grading_state,
            verification_status=verification,
            event_key=key,
            extra={"basis": basis, "course_id": course.id, "team_submission": is_team},
        )
        counts["created" if created else "updated"] += 1
        recompute_student_skill(student_skill)

    item = (PortfolioItem.query
            .filter_by(passport_id=passport.id,
                       source_type=SOURCE_PROJECT_SUBMISSION,
                       source_id=submission.id)
            .first())
    if item is None:
        db.session.add(PortfolioItem(
            passport_id=passport.id,
            student_id=submission.student_id,
            source_type=SOURCE_PROJECT_SUBMISSION,
            source_id=submission.id,
            course_id=course.id,
            display_title=project.title,
            display_description=project.description,
            is_featured=False,
            display_order=0,
        ))
        db.session.flush()
    return counts


def _sync_quiz_attempt(passport: TalentPassport, attempt: QuizAttempt,
                       course: Course) -> Dict[str, int]:
    counts = {"created": 0, "updated": 0}
    quiz = Quiz.query.get(attempt.quiz_id)
    if not quiz:
        return counts

    mappings = mappings_for_course(course.id, MAPPING_ASSESSMENT, quiz.id)
    if not mappings:
        return counts

    state_name = str(getattr(attempt.status, "value", attempt.status))
    raw_score = attempt.score_percentage if attempt.score_percentage is not None else attempt.score
    score = _percent(raw_score, quiz.points_possible if attempt.score_percentage is None else None)
    if state_name in ("graded", "auto_graded") and score is not None and not attempt.security_violation:
        grading_state = GRADE_APPROVED
        verification = EVIDENCE_APPROVED
        basis = "Objective quiz result recorded by the LMS"
    else:
        grading_state = GRADE_AWAITING_REVIEW
        verification = EVIDENCE_PENDING
        score = None
        basis = "Quiz attempt submitted or not eligible as evidence"

    for mapping in mappings:
        key = _event_key(
            "quiz.submitted", attempt.user_id, SOURCE_QUIZ_ATTEMPT, attempt.id,
            suffix=f"{_iso(attempt.end_time) or ''}|mapping-{mapping.id}",
        )
        student_skill = get_or_create_student_skill(
            passport, attempt.user_id, mapping.skill_definition_id
        )
        _, created = upsert_evidence(
            student_skill,
            source_type=SOURCE_QUIZ_ATTEMPT,
            source_id=attempt.id,
            mapping=mapping,
            title=quiz.title,
            happened_at=attempt.end_time or attempt.start_time,
            score=score,
            grading_state=grading_state,
            verification_status=verification,
            event_key=key,
            extra={"basis": basis, "course_id": course.id, "attempt_number": attempt.attempt_number},
        )
        counts["created" if created else "updated"] += 1
        recompute_student_skill(student_skill)
    return counts


def _sync_certificate(passport: TalentPassport, certificate: Certificate) -> Dict[str, int]:
    counts = {"created": 0, "updated": 0}
    mappings = mappings_for_course(certificate.course_id)
    if not mappings:
        return counts

    course = Course.query.get(certificate.course_id)
    active = bool(certificate.is_active)
    expired = bool(certificate.expires_at and certificate.expires_at < now_local())
    if active and not expired:
        grading_state = GRADE_VERIFIED
        verification = EVIDENCE_VERIFIED
        score = _percent(certificate.overall_score)
        basis = "Issued LMS course certificate"
    else:
        grading_state = GRADE_PROVISIONAL
        verification = EVIDENCE_REJECTED
        score = None
        basis = "Certificate revoked or expired"

    for mapping in mappings:
        key = _event_key(
            "certificate.issued", certificate.student_id, SOURCE_CERTIFICATE,
            certificate.id,
            suffix=f"{_iso(certificate.issued_at) or ''}|{active}|{expired}|mapping-{mapping.id}",
        )
        student_skill = get_or_create_student_skill(
            passport, certificate.student_id, mapping.skill_definition_id
        )
        _, created = upsert_evidence(
            student_skill,
            source_type=SOURCE_CERTIFICATE,
            source_id=certificate.id,
            mapping=mapping,
            title=f"Certificate: {course.title if course else 'Course'}",
            happened_at=certificate.issued_at,
            score=score,
            grading_state=grading_state,
            verification_status=verification,
            event_key=key,
            extra={
                "basis": basis,
                "certificate_number": certificate.certificate_number,
                "course_id": certificate.course_id,
            },
        )
        counts["created" if created else "updated"] += 1
        recompute_student_skill(student_skill)
    return counts


def _sync_achievements(passport: TalentPassport, student_id: int) -> Dict[str, int]:
    """Mirror existing LMS achievements into the passport; add no new rules."""
    from .achievements import sync_achievement_records
    return sync_achievement_records(passport, student_id)


# ---------------------------------------------------------------------------
# Public sync entry points
# ---------------------------------------------------------------------------
def sync_student(student_id: int, course_id: Optional[int] = None) -> Dict[str, int]:
    """Reconcile one student's passport from LMS records.

    This function never commits; the caller's request transaction owns commit.
    """
    totals = {
        "synthesized": 1,
        "evidence_created": 0,
        "evidence_updated": 0,
        "skills": 0,
        "achievements_created": 0,
    }
    passport = ensure_passport(student_id)
    ensure_taxonomy()

    enrollments_query = Enrollment.query.filter_by(student_id=student_id)
    if course_id:
        enrollments_query = enrollments_query.filter_by(course_id=course_id)
    enrollments = enrollments_query.order_by(Enrollment.id.desc()).all()

    canonical_enrollments = []
    seen_courses = set()
    for enrollment in enrollments:
        canonical = Enrollment.get_canonical(student_id, enrollment.course_id)
        if canonical is None or canonical.id != enrollment.id:
            continue
        if enrollment.course_id in seen_courses:
            continue
        seen_courses.add(enrollment.course_id)
        canonical_enrollments.append(canonical)

    eligible_course_ids = {row.course_id for row in canonical_enrollments}
    for enrollment in canonical_enrollments:
        counter = _sync_enrollment(passport, enrollment)
        totals["evidence_created"] += counter["created"]
        totals["evidence_updated"] += counter["updated"]
        totals["skills"] += counter.get("skills", 0)

    for submission in AssignmentSubmission.query.filter_by(student_id=student_id).all():
        assignment = Assignment.query.get(submission.assignment_id)
        course = course_for_assignment(assignment) if assignment else None
        if course is None or course.id not in eligible_course_ids:
            continue
        if course_id and course.id != course_id:
            continue
        counter = _sync_assignment(passport, submission, course)
        totals["evidence_created"] += counter["created"]
        totals["evidence_updated"] += counter["updated"]

    for submission in ProjectSubmission.query.all():
        if (submission.student_id != student_id
                and student_id not in _json_list(submission.team_members)):
            continue
        project = Project.query.get(submission.project_id)
        course = Course.query.get(project.course_id) if project else None
        if course is None or course.id not in eligible_course_ids:
            continue
        if course_id and course.id != course_id:
            continue
        counter = _sync_project(passport, submission, course)
        totals["evidence_created"] += counter["created"]
        totals["evidence_updated"] += counter["updated"]

    for attempt in QuizAttempt.query.filter_by(user_id=student_id).all():
        quiz = Quiz.query.get(attempt.quiz_id)
        course = course_for_quiz(quiz) if quiz else None
        if course is None or course.id not in eligible_course_ids:
            continue
        if course_id and course.id != course_id:
            continue
        counter = _sync_quiz_attempt(passport, attempt, course)
        totals["evidence_created"] += counter["created"]
        totals["evidence_updated"] += counter["updated"]

    for certificate in Certificate.query.filter_by(student_id=student_id).all():
        if course_id and certificate.course_id != course_id:
            continue
        counter = _sync_certificate(passport, certificate)
        totals["evidence_created"] += counter["created"]
        totals["evidence_updated"] += counter["updated"]

    achievements = _sync_achievements(passport, student_id)
    totals["achievements_created"] = achievements["created"]

    passport.last_synced_at = now_local()
    db.session.flush()
    return totals


def handle_event(event_type: str, student_id: int, source_type: str,
                 source_id: int, course_id: Optional[int] = None,
                 suffix: str = "") -> Dict[str, Any]:
    """Idempotent targeted update for one LMS event.

    The event key is recorded only after a successful reconciliation, so a
    failed hook can safely retry.
    """
    key = _event_key(event_type, student_id, source_type, source_id, suffix)
    if ProcessedPassportEvent.query.get(key):
        return {
            "duplicate": True,
            "event_key": key,
            "evidence_created": 0,
            "evidence_updated": 0,
            "skills": 0,
            "achievements_created": 0,
        }

    result = sync_student(student_id, course_id)
    mark_processed(key, event_type, student_id)
    return {"duplicate": False, "event_key": key, **result}
