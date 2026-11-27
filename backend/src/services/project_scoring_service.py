"""Project score distribution across modules and team members.

A single project may cover several modules, and a collaborative project may
have several students on one submission.  Every write path (manual grading,
AI publication, full credit, resubmission) uses the helpers here so the
project's percentage lands on the ``ModuleProgress`` of *every* student and
*every* module the project covers.

Progression is deliberately separate: a project only *holds a student back*
in the last module it covers (see ``Project.get_gate_module_id``).  Earlier
modules show and use a graded score, but an ungraded project never blocks
them.
"""

from typing import Iterable, List, Optional

from . import scoring_prefetch


def team_member_ids(project, submission) -> List[int]:
    """All students represented by a project submission, including teammates.

    Team rows created for grade propagation intentionally have an empty
    roster, so discover the team from every row on the project instead of
    trusting only ``submission.team_members``.
    """
    from ..models.course_models import ProjectSubmission

    ids = {int(submission.student_id)}
    ids.update(int(mid) for mid in (submission.get_team_members() or []))
    for row in ProjectSubmission.query.filter_by(project_id=project.id).all():
        roster = set(int(mid) for mid in (row.get_team_members() or []))
        roster.add(int(row.student_id))
        if int(submission.student_id) in roster:
            ids.update(roster)
    return sorted(ids)


def covered_module_ids(project) -> List[int]:
    """All modules the project covers, in course order (whole course = all)."""
    if project is None:
        return []
    return [int(mid) for mid in project.get_covered_modules_in_order()]


def gate_module_id(project) -> Optional[int]:
    return project.get_gate_module_id() if project else None


def _ensure_progress(student_id: int, module_id: int, enrollment_id: int):
    from ..models.student_models import ModuleProgress

    progress = ModuleProgress.query.filter_by(
        student_id=student_id,
        module_id=module_id,
        enrollment_id=enrollment_id,
    ).first()
    if progress is None:
        # Creating ModuleProgress directly with a course_id kwarg used to fail;
        # the service is the canonical initializer.
        from .progression_service import ProgressionService

        progress = ProgressionService._initialize_module_progress(
            student_id, module_id, enrollment_id
        )
    return progress


def distribute_project_score(project, student_ids: Iterable[int],
                             percentage_score: float,
                             *, allow_lower: bool = False) -> List[int]:
    """Write ``percentage_score`` to every covered module for every student.

    Best-score semantics are the default (a re-grade cannot silently lose an
    earlier grade), but unlike the old gate-only write, all covered modules
    and all team members are updated.  An explicit instructor correction may
    pass ``allow_lower=True`` so the stored score matches the submission.
    Returns the module ids written.
    """
    from ..models.course_models import Enrollment
    from ..models.user_models import db

    module_ids = covered_module_ids(project)
    if not module_ids or not student_ids:
        return []

    score = max(0.0, min(100.0, float(percentage_score or 0.0)))
    written = []
    for student_id in {int(sid) for sid in student_ids}:
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=project.course_id
        ).first()
        if enrollment is None:
            continue
        for module_id in module_ids:
            progress = _ensure_progress(student_id, module_id, enrollment.id)
            current = progress.project_score or 0.0
            progress.project_score = score if allow_lower else max(current, score)
            progress.calculate_cumulative_score()
            if module_id not in written:
                written.append(module_id)
    db.session.flush()
    return written


def clear_project_score(project, student_ids: Iterable[int]) -> List[int]:
    """Invalidate stored project scores (e.g. on a resubmission)."""
    from ..models.course_models import Enrollment
    from ..models.user_models import db

    module_ids = covered_module_ids(project)
    if not module_ids or not student_ids:
        return []

    cleared = []
    for student_id in {int(sid) for sid in student_ids}:
        enrollment = Enrollment.query.filter_by(
            student_id=student_id, course_id=project.course_id
        ).first()
        if enrollment is None:
            continue
        for module_id in module_ids:
            progress = _progress_or_none(student_id, module_id, enrollment.id)
            if progress is None:
                continue
            progress.project_score = 0.0
            progress.calculate_cumulative_score()
            if module_id not in cleared:
                cleared.append(module_id)
    db.session.flush()
    return cleared


def _progress_or_none(student_id: int, module_id: int, enrollment_id: int):
    from ..models.student_models import ModuleProgress

    return ModuleProgress.query.filter_by(
        student_id=student_id,
        module_id=module_id,
        enrollment_id=enrollment_id,
    ).first()


def request_project_modification(submissions: Iterable, reason: str,
                                 requested_by: Optional[int]) -> int:
    """Mark each student's submission as eligible for resubmission.

    The count is per submission, so one student's revision request never
    consumes another student's allowance. Repeated requests for the same
    pending revision do not double-count.
    """
    from ..utils.time_utils import now_local

    changed = 0
    for submission in submissions:
        if submission is None:
            continue
        # A legacy project-level flag may make modification_state() report a
        # request even though this student has never had a per-submission
        # revision. Count only real per-submission requests.
        if not submission.modification_requested:
            submission.resubmission_count = (submission.resubmission_count or 0) + 1
        submission.modification_requested = True
        submission.modification_request_reason = reason
        submission.modification_requested_at = now_local()
        submission.modification_requested_by = requested_by
        # A legacy project-level flag must not keep this student blocked.
        submission.can_resubmit = True
        changed += 1
    return changed


def resubmission_check(project, submission) -> tuple:
    """``(allowed, reason)`` for a project resubmission."""
    if submission is None or submission.submitted_at is None:
        return True, "first_submission"
    state = submission.modification_state()
    if not (state['modification_requested'] and state['can_resubmit']):
        return False, "No revision has been requested for this submission"
    max_resubmissions = project.max_resubmissions or 3
    if (submission.resubmission_count or 0) >= max_resubmissions:
        return False, f"Maximum resubmissions ({max_resubmissions}) reached"
    return True, "resubmission"


def prepare_project_resubmission(project, submission, data: dict) -> list:
    """Reset the shared team grade and mark the work as handed in again.

    Returns the student ids represented by the resubmitted team.
    """
    from ..models.course_models import ProjectSubmission
    from ..utils.time_utils import now_local

    member_ids = team_member_ids(project, submission)
    rows = ProjectSubmission.query.filter(
        ProjectSubmission.project_id == project.id,
        ProjectSubmission.student_id.in_(member_ids),
    ).all()

    for row in rows:
        row.grade = None
        row.feedback = None
        row.graded_at = None
        row.graded_by = None
    clear_project_modification(rows)

    submission.is_resubmission = True
    submission.original_submission_id = (
        submission.original_submission_id or submission.id
    )
    submission.submission_notes = (
        data.get('resubmission_notes') or submission.submission_notes
    )
    submission.submitted_at = now_local()
    clear_project_score(project, member_ids)
    return member_ids


def clear_project_modification(submissions: Iterable) -> None:
    """Clear a fulfilled revision request on the given submissions."""
    for submission in submissions:
        if submission is None:
            continue
        submission.modification_requested = False
        submission.modification_request_reason = None
        submission.modification_requested_at = None
        submission.modification_requested_by = None
        submission.can_resubmit = False


def project_gate_status(student_id: int, module_id: int, course_id: int) -> dict:
    """Describe the projects that hold a student to this module.

    Returns ``{"required": bool, "completed": bool, "projects": [...]}``.
    A gate project is complete once it has a graded submission at or above
    the project's passing score.
    """
    from ..models.course_models import Project, ProjectSubmission

    gate_ids = scoring_prefetch.gating_project_ids(course_id, module_id)
    result = {
        "required": bool(gate_ids),
        "completed": not gate_ids,
        "projects": [],
    }
    if not gate_ids:
        return result

    projects = Project.query.filter(
        Project.id.in_(gate_ids), Project.is_published.is_(True)
    ).all()
    all_complete = True
    for project in projects:
        # A grade on any row belonging to this student's team counts for every
        # member: propagated rows carry it, but older teams may only have the
        # submitter's row with the member id stored in ``team_members``.
        all_rows = ProjectSubmission.query.filter(
            ProjectSubmission.project_id == project.id,
            ProjectSubmission.grade.isnot(None),
        ).all()
        relevant = []
        for row in all_rows:
            member_ids = {int(mid) for mid in (row.get_team_members() or [])}
            if int(row.student_id) == int(student_id) or int(student_id) in member_ids:
                relevant.append(row)

        points = float(project.points_possible or 100)
        passing = float(
            project.passing_score if project.passing_score is not None else 60.0
        )
        percentages = [
            min(100.0, max(0.0, (float(row.grade or 0.0) / points) * 100))
            for row in relevant
        ] if points > 0 else [0.0]
        best = max(percentages or [0.0])
        complete = best >= passing
        result["projects"].append({
            "id": project.id,
            "title": project.title,
            "best_grade": best,
            "best_percentage": best,
            "passing_score": passing,
            "completed": complete,
        })
        if not complete:
            all_complete = False
    result["completed"] = all_complete
    return result


def project_gate_blocker(student_id: int, module_id: int, course_id: int) -> Optional[str]:
    """Human-readable reason this module is still held by a project, if any."""
    status = project_gate_status(student_id, module_id, course_id)
    if status["completed"]:
        return None
    titles = ", ".join(p["title"] for p in status["projects"] if not p["completed"])
    return f"Complete the project '{titles}' before this module can be completed"
