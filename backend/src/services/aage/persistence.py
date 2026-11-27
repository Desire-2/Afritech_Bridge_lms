"""Service M — Persistence & legacy write-through.

The engine's own tables (``evaluation_runs`` / ``evaluation_results`` /
``criterion_scores`` / ``evaluation_evidence``) are the authoritative record of
*what the engine decided and why*.  The legacy grade path
(``submission.grade`` → ``ModuleProgress`` → ``LessonCompletion``) stays the
authoritative record of *what the student sees*.

This module owns the only two bridges between them:

* :func:`save_result` — engine outcome → engine tables (+ review/audit rows),
* :func:`write_through_grade` — an **approved** engine outcome → legacy grade,
  reusing the existing Excel auto-grader write-back helpers so AAGE scores flow
  through exactly the same progress/certificate chain as every other grade.

Nothing here ever writes ``submission.grade`` for an unapproved result.
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Sequence

from ...models.aage_models import (
    CriterionScore,
    EvaluationEvidence,
    EvaluationResult,
    EvaluationRun,
    GradingAuditLog,
    GradingJob,
    GradingReview,
    SubmissionArtifact,
)
from ...models.course_models import (
    Assignment,
    AssignmentSubmission,
    Project,
    ProjectSubmission,
)
from ...utils.time_utils import now_local
from .scoring import letter_grade
from .constants import (
    JOB_CANCELLED,
    RESULT_PENDING_REVIEW,
    RESULT_PUBLISHED,
    RESULT_SUPERSEDED,
    REVIEW_PENDING,
    SUBMISSION_ASSIGNMENT,
    SUBMISSION_PROJECT,
)

logger = logging.getLogger("aage.persistence")

AUDIT_ENTITY_RESULT = "evaluation_result"
AUDIT_ENTITY_JOB = "grading_job"
AUDIT_ENTITY_RUBRIC = "rubric"


class SubmissionNotFound(Exception):
    pass


@dataclass
class LoadedSubmission:
    """Everything the orchestrator needs about one submission."""

    submission_type: str
    submission_id: int
    student_id: int
    assessment_kind: str
    assessment_id: int
    course_id: Optional[int] = None
    module_id: Optional[int] = None
    lesson_id: Optional[int] = None
    points_possible: float = 100.0
    passing_score: Optional[float] = None
    files: List[Dict[str, Any]] = field(default_factory=list)
    text_content: str = ""
    already_graded: bool = False
    current_grade: Optional[float] = None
    row: Any = None
    parent: Any = None


# ---------------------------------------------------------------------------
# Loading
# ---------------------------------------------------------------------------

def load_submission(submission_type: str, submission_id: int) -> LoadedSubmission:
    """Resolve a submission row + its file metadata + written response."""
    if submission_type == SUBMISSION_ASSIGNMENT:
        row = AssignmentSubmission.query.get(submission_id)
        if row is None:
            raise SubmissionNotFound(f"assignment submission {submission_id} not found")
        parent = Assignment.query.get(row.assignment_id)
        files = _parse_files(getattr(row, "file_url", None),
                             getattr(row, "file_name", None))
        text = getattr(row, "content", "") or ""
    elif submission_type == SUBMISSION_PROJECT:
        row = ProjectSubmission.query.get(submission_id)
        if row is None:
            raise SubmissionNotFound(f"project submission {submission_id} not found")
        parent = Project.query.get(row.project_id)
        files = _parse_files(getattr(row, "file_path", None),
                             getattr(row, "file_name", None))
        text = getattr(row, "text_content", "") or ""
    else:
        raise SubmissionNotFound(f"unknown submission type: {submission_type}")

    if parent is None:
        raise SubmissionNotFound(
            f"parent assessment missing for {submission_type} {submission_id}")

    course_id = getattr(parent, "course_id", None)
    module_id = getattr(parent, "module_id", None)
    lesson_id = getattr(parent, "lesson_id", None)
    if module_id is None and lesson_id:
        try:
            from ...models.course_models import Lesson
            lesson = Lesson.query.get(lesson_id)
            module_id = getattr(lesson, "module_id", None)
        except Exception:  # pragma: no cover - model variance
            module_id = None

    return LoadedSubmission(
        submission_type=submission_type,
        submission_id=submission_id,
        student_id=int(row.student_id),
        assessment_kind=submission_type,
        assessment_id=int(parent.id),
        course_id=course_id,
        module_id=module_id,
        lesson_id=lesson_id,
        points_possible=float(getattr(parent, "points_possible", None) or 100.0),
        passing_score=getattr(parent, "passing_score", None),
        files=files,
        text_content=text,
        already_graded=getattr(row, "grade", None) is not None,
        current_grade=getattr(row, "grade", None),
        row=row,
        parent=parent,
    )


def _parse_files(raw: Any, fallback_name: Optional[str]) -> List[Dict[str, Any]]:
    """file_url/file_path may be a JSON array, a dict or a plain path."""
    files: List[Dict[str, Any]] = []
    if not raw:
        return files
    if isinstance(raw, (list, dict)):
        parsed: Any = raw
    else:
        try:
            parsed = json.loads(raw)
        except (TypeError, ValueError):
            parsed = None
    if isinstance(parsed, list):
        files.extend(x for x in parsed if isinstance(x, (dict, str)))
    elif isinstance(parsed, dict):
        files.append(parsed)
    elif fallback_name:
        files.append({"url": str(raw), "filename": fallback_name,
                      "original_filename": fallback_name})
    else:
        files.append({"url": str(raw), "filename": "submission_file"})
    # normalise string entries
    normalised: List[Dict[str, Any]] = []
    for f in files:
        if isinstance(f, str):
            normalised.append({"url": f, "filename": f.rsplit("/", 1)[-1]})
        else:
            normalised.append(f)
    return normalised


# ---------------------------------------------------------------------------
# Artefact manifest → submission_artifacts
# ---------------------------------------------------------------------------

def save_artifacts(manifest: Any, job_id: int) -> List[SubmissionArtifact]:
    rows: List[SubmissionArtifact] = []
    try:
        for meta in (manifest.files or []):
            path = str(meta.get("relative_path") or meta.get("file_name") or "")
            if not path:
                continue
            row = SubmissionArtifact(
                job_id=job_id,
                submission_type=manifest.submission_type,
                submission_id=manifest.submission_id,
                file_name=str(meta.get("file_name") or path)[:400],
                relative_path=path[:600],
                storage=meta.get("storage"),
                external_id=str(meta.get("external_id") or "")[:255] or None,
                size_bytes=meta.get("size_bytes"),
                checksum_sha256=meta.get("checksum_sha256"),
                category=meta.get("category"),
                language=meta.get("language"),
                is_entry_point=bool(meta.get("entry_point")),
                is_required_deliverable=bool(meta.get("is_required_deliverable")),
                truncated=bool(meta.get("truncated")),
                status=str(meta.get("status") or "ready"),
                error=meta.get("error"),
            )
            rows.append(row)
            db_add(row)
        db_commit()
    except Exception:  # pragma: no cover - manifest is metadata only
        logger.exception("AAGE failed to persist artefact manifest for job %s", job_id)
        db_rollback()
    return rows


def db_add(obj: Any) -> None:
    from ...models.user_models import db
    db.session.add(obj)


def db_commit() -> None:
    from ...models.user_models import db
    db.session.commit()


def db_rollback() -> None:
    from ...models.user_models import db
    try:
        db.session.rollback()
    except Exception:  # pragma: no cover
        pass


# ---------------------------------------------------------------------------
# Run / result persistence
# ---------------------------------------------------------------------------

def create_run(job: GradingJob, *, rubric_version_id: Optional[int] = None,
               correlation_id: str = "",
               cost_estimate: Optional[float] = None) -> EvaluationRun:
    run = EvaluationRun(
        job_id=job.id,
        correlation_id=correlation_id or job.correlation_id,
        rubric_version_id=rubric_version_id,
        status="running",
        started_at=now_local(),
        # Always None: never derive a dollar cost from an assumed price table.
        cost_estimate=cost_estimate,
    )
    db_add(run)
    db_commit()
    return run


def finish_run(run: EvaluationRun, *, status: str,
               evaluators: Sequence[Dict[str, Any]],
               artifact_summary: Optional[Dict[str, Any]] = None,
               warnings: Sequence[str] = (),
               conflicts: Sequence[Dict[str, Any]] = (),
               provider: str = "", duration_ms: int = 0,
               tokens_in: int = 0, tokens_out: int = 0,
               usage: Optional[Dict[str, Any]] = None,
               cost_estimate: Optional[float] = None) -> EvaluationRun:
    run.status = status
    run.evaluators = [dict(e) for e in evaluators]
    run.artifact_summary = artifact_summary or {}
    run.warnings = list(warnings)
    run.conflicts = [dict(c) for c in conflicts]
    run.provider = provider or None
    run.duration_ms = duration_ms
    run.tokens_in = tokens_in or None
    run.tokens_out = tokens_out or None
    # cost_estimate is only ever a real value supplied by a provider; the
    # orchestrator passes None because make_ai_request exposes no token usage.
    run.cost_estimate = cost_estimate
    if usage and int(usage.get("llm_calls") or 0) > 0:
        run.cost = {
            "provider": usage.get("provider"),
            "llm_calls": int(usage.get("llm_calls") or 0),
            "prompt_chars": int(usage.get("prompt_chars") or 0),
            "response_chars": int(usage.get("response_chars") or 0),
            "tokens_in": usage.get("tokens_in"),
            "tokens_out": usage.get("tokens_out"),
            "note": ("provider did not expose token usage"
                     if usage.get("tokens_in") is None
                     and usage.get("tokens_out") is None else None),
        }
    run.finished_at = now_local()
    db_commit()
    return run


def save_result(*, run: EvaluationRun, job: GradingJob,
                loaded: LoadedSubmission,
                rubric_snapshot: Dict[str, Any],
                rubric_id: Optional[int],
                rubric_version_id: Optional[int],
                breakdown: Any,
                confidence: Dict[str, Any],
                feedback: str,
                strengths: Sequence[str],
                improvements: Sequence[str],
                evaluator_versions: Sequence[Dict[str, Any]],
                ai_provider: str,
                limitations: Sequence[str],
                evidence_by_key: Dict[str, List[Dict[str, Any]]],
                statuses: Dict[str, str],
                requires_review: bool,
                review_reason: str,
                status: str = RESULT_PENDING_REVIEW) -> EvaluationResult:
    """Persist the authoritative engine outcome (+ criteria + evidence)."""
    final_score = float(breakdown.final_score)
    points_awarded = _scale_points(final_score, loaded.points_possible)

    result = EvaluationResult(
        run_id=run.id,
        job_id=job.id,
        correlation_id=job.correlation_id,
        submission_type=loaded.submission_type,
        submission_id=loaded.submission_id,
        assessment_kind=loaded.assessment_kind,
        assessment_id=loaded.assessment_id,
        course_id=loaded.course_id,
        student_id=loaded.student_id,
        rubric_id=rubric_id,
        rubric_version_id=rubric_version_id,
        rubric_snapshot=rubric_snapshot,
        total_awarded=float(breakdown.total_awarded),
        total_possible=float(breakdown.total_possible),
        final_score=final_score,
        grade_letter=letter_grade(final_score),
        points_awarded=points_awarded,
        confidence=float(confidence.get("score") or 0.0),
        confidence_factors=confidence,
        requires_review=bool(requires_review),
        review_reason=review_reason or None,
        status=status,
        feedback=(feedback or "")[:20000],
        strengths=list(strengths or []),
        improvements=list(improvements or []),
        ai_provider=ai_provider or None,
        evaluator_versions=list(evaluator_versions or []),
        limitations=list(limitations or []),
        is_official=False,
    )
    db_add(result)
    db_flush()

    for outcome in breakdown.criteria:
        crit = CriterionScore(
            result_id=result.id,
            criterion_key=outcome.criterion_key[:80],
            name=(outcome.name or outcome.criterion_key)[:200],
            awarded=outcome.awarded,
            maximum=outcome.maximum,
            weight=outcome.weight,
            weighted_score=outcome.weighted_score,
            rationale=(outcome.rationale or "")[:20000],
            evidence_category=outcome.evidence_category,
            verification_status=outcome.verification_status,
            evaluator_name=outcome.evaluator_name or None,
            evaluator_version=outcome.evaluator_version or None,
            feedback=(outcome.feedback or "")[:20000],
            limitations=(outcome.limitations or "")[:20000],
            is_required=outcome.is_required,
            order_index=outcome.order_index,
        )
        db_add(crit)
        db_flush()
        for ev in (evidence_by_key.get(outcome.criterion_key) or [])[:25]:
            db_add(EvaluationEvidence(
                result_id=result.id,
                criterion_score_id=crit.id,
                criterion_key=outcome.criterion_key[:80],
                category=str(ev.get("category") or "UNVERIFIED")[:30],
                source=str(ev.get("source") or "static_analysis")[:40],
                reference=(str(ev.get("reference") or "")[:600] or None),
                locator=(str(ev.get("locator") or "")[:600] or None),
                summary=str(ev.get("summary") or "")[:700],
                detail=ev.get("detail") if isinstance(ev.get("detail"), dict) else {},
                confidence=ev.get("confidence"),
            ))

    if requires_review:
        db_add(GradingReview(
            result_id=result.id,
            status=REVIEW_PENDING,
            ai_score=final_score,
            assigned_to=None,
        ))

    db_commit()
    logger.info(
        "AAGE result saved id=%s submission=%s/%s score=%.2f confidence=%.1f "
        "review=%s status=%s",
        result.id, loaded.submission_type, loaded.submission_id, final_score,
        result.confidence, requires_review, status,
    )
    return result


def supersede_results_for_submission(*, submission_type: str,
                                      submission_id: int,
                                      except_result_id: Optional[int] = None,
                                      actor_id: Optional[int] = None,
                                      reason: str = "") -> List[int]:
    """Retire inactive results from an earlier attempt at one submission.

    Retry/force-enqueue must leave exactly one *active* result.  Historical
    rows (including published ones and every :class:`GradingAuditLog` entry)
    are preserved; only the status of draft/pending rows changes, so no audit
    trail is erased and already-published grades are never rewritten.
    """
    rows = (EvaluationResult.query
            .filter(EvaluationResult.submission_type == submission_type,
                    EvaluationResult.submission_id == submission_id)
            .order_by(EvaluationResult.id.asc())
            .all())
    changed: List[int] = []
    for row in rows:
        if row.id == except_result_id:
            continue
        if row.is_official or row.status in (RESULT_PUBLISHED,
                                             RESULT_SUPERSEDED, "rejected"):
            continue
        row.status = RESULT_SUPERSEDED
        changed.append(row.id)
    if not changed:
        return changed
    db_commit()
    audit(action="results_superseded", entity_type=AUDIT_ENTITY_RESULT,
          entity_id=max(changed), before={"statuses": "draft/pending_review"},
          after={"result_ids": changed, "status": RESULT_SUPERSEDED},
          actor_id=actor_id,
          reason=reason or "new attempt for the same submission")
    logger.info("AAGE superseded %s prior result(s) for %s/%s: %s",
                len(changed), submission_type, submission_id, changed)
    return changed


def db_flush() -> None:
    from ...models.user_models import db
    db.session.flush()


def _scale_points(percentage: float, points_possible: float) -> float:
    points = float(points_possible or 100.0)
    if points <= 0:
        return 0.0
    return max(0.0, min(points, round(percentage / 100.0 * points, 2)))


# ---------------------------------------------------------------------------
# Legacy write-through (approved results only)
# ---------------------------------------------------------------------------

def _checksums_for_job(job_id: Optional[int]) -> set:
    if not job_id:
        return set()
    rows = SubmissionArtifact.query.filter_by(job_id=job_id).all()
    return {row.checksum_sha256 for row in rows if row.checksum_sha256}


def _artifact_checksums(result: EvaluationResult) -> set:
    """Checksums of the files actually graded by ``result``'s job."""
    return _checksums_for_job(result.job_id)


def published_result_for_current_files(
    submission_type: str, submission_id: int,
) -> Optional[EvaluationResult]:
    """Return the published result for the files currently on this submission.

    Used to make an ordinary "grade this submission" request idempotent: when
    the bytes have not changed, the stored result is returned instead of
    starting another model run that could produce a different score.
    """
    latest_job = (GradingJob.query
                  .filter(GradingJob.submission_type == submission_type,
                          GradingJob.submission_id == submission_id)
                  .order_by(GradingJob.id.desc())
                  .first())
    if latest_job is None:
        return None
    checksums = _checksums_for_job(latest_job.id)
    if not checksums:
        return None
    official = (EvaluationResult.query
                .filter(EvaluationResult.submission_type == submission_type,
                        EvaluationResult.submission_id == submission_id,
                        EvaluationResult.is_official.is_(True))
                .order_by(EvaluationResult.published_at.desc(),
                          EvaluationResult.id.desc())
                .all())
    for row in official:
        if _artifact_checksums(row) == checksums:
            return row
    return None


def _unchanged_content_publication_blocker(result: EvaluationResult) -> Optional[str]:
    """Why an automatic re-grade must not replace an already published grade.

    AAGE marks are model-generated, so the same bytes can receive different
    criterion marks on two runs.  Once a grade has been published for a given
    set of files, any later automatic result for those same files is kept as a
    draft/review candidate but never replaces the student's grade.  A genuine
    resubmission has different artifact checksums and is unaffected.
    """
    checksums = _artifact_checksums(result)
    if not checksums:
        return None  # unknown content — let the normal grade guard decide
    official = (EvaluationResult.query
                .filter(EvaluationResult.submission_type == result.submission_type,
                        EvaluationResult.submission_id == result.submission_id,
                        EvaluationResult.is_official.is_(True),
                        EvaluationResult.id != result.id)
                .order_by(EvaluationResult.published_at.desc(),
                          EvaluationResult.id.desc())
                .all())
    for row in official:
        if _artifact_checksums(row) == checksums:
            return "already_published_for_unchanged_submission"
    return None


def write_through_grade(result: EvaluationResult, *,
                         actor_id: Optional[int] = None,
                         reason: str = "approved",
                         publication_mode: str = "auto") -> bool:
    """Publish an engine result onto the legacy grade path.

    ``publication_mode`` (default ``"auto"``) is the internal gate switch:

    * ``"auto"`` — background/API-free publication.  Requires auto-publish to
      be enabled, no review flag and, when ``require_all_gates`` is set, every
      deterministic gate to pass (verified evidence, no failed check, no
      provisional rubric, no conflict, no review requirement).
    * ``"manual"`` — **only** for an explicit instructor approval (approved
      review / publish endpoint).  A human has inspected the evidence, so the
      automated gate is not used to weaken that decision.
    * ``"auto_approved"`` — Excel-style self-approval. The decision was made by
      :mod:`auto_approval`, which already checked confidence and every real
      failure signal; the strict ``auto`` gates (which require deterministic
      ``verified`` status) are intentionally not reapplied here.

    Reuses the existing Excel auto-grader write-back helpers so ModuleProgress,
    LessonCompletion and certificate scoring behave identically to every other
    grade in the system.
    """
    if publication_mode not in ("auto", "manual", "auto_approved"):
        raise ValueError(f"unknown publication mode: {publication_mode}")

    if result.is_official:
        logger.info("AAGE write-through skipped: result %s already official", result.id)
        return False
    if result.status in (RESULT_SUPERSEDED, RESULT_PUBLISHED, "rejected"):
        logger.info("AAGE write-through skipped: result %s status=%s",
                    result.id, result.status)
        return False

    # A cancellation that lands after orchestration must never publish.
    from .constants import JOB_SUCCEEDED
    job_status = None
    if result.job_id:
        from .jobs import _job_status
        job_status = _job_status(result.job_id)
    if job_status == JOB_CANCELLED:
        logger.info("AAGE write-through blocked by cancelled job %s",
                    result.job_id)
        return False

    # Keep automatic re-grades from silently changing a published grade for
    # unchanged files.  Manual instructor approval deliberately bypasses this:
    # a human may correct a grade after reviewing the evidence.
    if publication_mode in ("auto", "auto_approved"):
        unchanged = _unchanged_content_publication_blocker(result)
        if unchanged:
            logger.info(
                "AAGE write-through skipped for result %s: %s "
                "(submission %s/%s)", result.id, unchanged,
                result.submission_type, result.submission_id,
            )
            audit(
                action="grade_publication_skipped",
                entity_type=AUDIT_ENTITY_RESULT,
                entity_id=result.id,
                after={"final_score": result.final_score,
                       "publication_mode": publication_mode},
                actor_id=actor_id,
                reason=unchanged,
                correlation_id=result.correlation_id,
            )
            return False

    if publication_mode == "auto":
        from .policies import confidence_policy
        policy = confidence_policy()
        if not policy.get("auto_publish_enabled"):
            return False
        if result.requires_review:
            logger.info("AAGE write-through blocked: result %s needs review",
                        result.id)
            return False
        if bool(policy.get("require_all_gates", True)):
            from .confidence import hard_gate_failures_for_result
            failures = hard_gate_failures_for_result(result)
            if failures:
                logger.info(
                    "AAGE write-through blocked for result %s by gates: %s",
                    result.id, ",".join(failures))
                return False
        # Re-check cancellation immediately before the irreversible write.
        if result.job_id:
            from .jobs import _job_status
            if _job_status(result.job_id) == JOB_CANCELLED:
                return False

    if publication_mode == "auto_approved":
        if result.job_id:
            from .jobs import _job_status
            if _job_status(result.job_id) == JOB_CANCELLED:
                return False
        # The self-approval decision replaced the review requirement.
        result.requires_review = False

    loaded = load_submission(result.submission_type, result.submission_id)
    grade_data = {
        "overall_feedback": result.feedback or "",
        "total_score": result.final_score,
        "max_score": 100.0,
        "grade_letter": result.grade_letter,
        "strengths": result.strengths or [],
        "weaknesses": result.improvements or [],
        "analysis_data": {
            "strengths": result.strengths or [],
            "weaknesses": result.improvements or [],
        },
    }

    try:
        from ...services.excel_grading.auto_grader import (
            _apply_grade_to_submission,
            _auto_request_modification_if_needed,
            _notify_student_auto_graded,
            _update_learning_progress,
        )
    except Exception as exc:  # pragma: no cover - import guard
        logger.error("AAGE write-through helpers unavailable: %s", exc)
        return False

    app = _current_app()
    if app is None:  # pragma: no cover - requires app context
        logger.error("AAGE write-through needs an application context")
        return False

    ok = _apply_grade_to_submission(
        app,
        loaded.submission_id,
        loaded.submission_type,
        loaded.student_id,
        result.final_score,
        100.0,
        grade_data,
        allow_lower=(publication_mode == "manual"),
        # Never lose the AI explanation just because a re-grade would lower an
        # already published score. The grade stays; revision + feedback still
        # reach the student.
        keep_feedback_on_lower=True,
    )
    if not ok:
        logger.error("AAGE write-through failed for result %s", result.id)
        return False

    # Failed grades follow the same LMS resubmission policy as manual grading:
    # below the assessment's passing score, create a modification request with
    # evidence-based feedback and do not advance lesson progress yet.
    modification_requested = _auto_request_modification_if_needed(
        app,
        loaded.submission_id,
        loaded.submission_type,
        loaded.student_id,
        result.final_score,
        100.0,
        grade_data,
    )
    if not modification_requested:
        _update_learning_progress(
            app,
            loaded.submission_id,
            loaded.submission_type,
            loaded.student_id,
            result.final_score,
            100.0,
            allow_lower=(publication_mode == "manual"),
        )

    try:
        _notify_student_auto_graded(
            app,
            loaded.submission_id,
            loaded.submission_type,
            loaded.student_id,
            {"result": grade_data},
            modification_requested=modification_requested,
        )
    except Exception:  # pragma: no cover - notification is non-critical
        logger.warning("AAGE grade notification failed for result %s", result.id)

    result.is_official = True
    result.status = "published"
    result.published_at = now_local()
    result.published_by = actor_id
    if actor_id:
        # Mirror instructor grading: record who approved the publication.
        try:
            loaded.row.graded_by = actor_id
            loaded.row.graded_at = now_local()
        except Exception:  # pragma: no cover
            pass

    # This is the authoritative grade publication point for every AAGE path
    # (jobs, reviews and explicit API publication). Refresh Passport evidence
    # in the same transaction; the hook is failure-isolated and idempotent.
    from ...talent_passport.hooks import notify_talent_passport
    passport_source = (
        "assignment_submission" if result.submission_type == SUBMISSION_ASSIGNMENT
        else "project_submission"
    )
    published_at = result.published_at.isoformat() if result.published_at else ""
    notify_talent_passport(
        "aage.published", result.student_id,
        passport_source, result.submission_id,
        course_id=result.course_id,
        suffix=f"result-{result.id}-{published_at}",
    )
    db_commit()

    audit(
        action="grade_published",
        entity_type=AUDIT_ENTITY_RESULT,
        entity_id=result.id,
        before={"is_official": False, "status": "approved"},
        after={"is_official": True, "status": "published",
               "final_score": result.final_score},
        actor_id=actor_id,
        reason=reason,
        correlation_id=result.correlation_id,
    )
    logger.info("AAGE write-through complete result=%s score=%.2f", result.id,
                result.final_score)
    return True


def _current_app() -> Any:
    try:
        from flask import current_app
        return current_app._get_current_object()
    except Exception:
        return None


# ---------------------------------------------------------------------------
# Audit trail
# ---------------------------------------------------------------------------

def audit(*, action: str, entity_type: str, entity_id: Optional[int],
          before: Any = None, after: Any = None,
          actor_id: Optional[int] = None, actor_role: str = "",
          reason: str = "", correlation_id: str = "",
          ip_address: str = "") -> None:
    try:
        db_add(GradingAuditLog(
            actor_id=actor_id,
            actor_role=actor_role or None,
            action=action[:80],
            entity_type=entity_type[:60],
            entity_id=entity_id,
            before=_jsonable(before),
            after=_jsonable(after),
            reason=reason or None,
            correlation_id=correlation_id or None,
            ip_address=ip_address or None,
        ))
        db_commit()
    except Exception:  # pragma: no cover - audit must not break grading
        logger.exception("AAGE audit write failed (%s %s)", entity_type, entity_id)


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    try:
        json.dumps(value, default=str)
        return value
    except (TypeError, ValueError):
        return {"repr": str(value)[:2000]}
