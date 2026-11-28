"""Service N — Persistent job state machine.

There is no Celery/Redis in this deployment, so the *row* is the queue: a
:class:`~src.models.aage_models.GradingJob` carries everything needed to
enqueue, claim, retry, recover and audit a grading run across processes and
restarts.

States::

    queued ──claim──► running ──ok───► succeeded
      ▲                  │
      │                  ├──retry (attempts < max)──► queued (backoff)
      │                  │
      └──────────────────┴──exhausted──► failed
                             recover()──► queued   (stale lock)

Claiming is optimistic: the row is only taken when its status is still
``queued``, so two workers racing for the same job cannot both win.
"""

from __future__ import annotations

import logging
import os
import socket
import threading
import time
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional, Sequence

from ...models.aage_models import GradingJob
from ...utils.time_utils import now_local
from .constants import (
    DEFAULT_JOB_TIMEOUT_SECONDS,
    JOB_CANCELLED,
    JOB_FAILED,
    JOB_QUEUED,
    JOB_RETRY_BACKOFF_SECONDS,
    JOB_RUNNING,
    JOB_SUCCEEDED,
    JOB_TIMED_OUT,
    JOB_TYPE_GRADE,
    MAX_JOB_ATTEMPTS,
    STALE_LOCK_GRACE_SECONDS,
    STALE_LOCK_SECONDS,
    SUBMISSION_ASSIGNMENT,
    SUBMISSION_PROJECT,
)
from .persistence import db_add, db_commit, db_rollback
from .timeout import clear_deadline, set_deadline

logger = logging.getLogger("aage.jobs")

_ACTIVE_STATUSES = (JOB_QUEUED, JOB_RUNNING)
_TERMINAL_STATUSES = (JOB_SUCCEEDED, JOB_FAILED, JOB_CANCELLED, JOB_TIMED_OUT)

# In-process liveness registry.  A worker registers a lease for the whole
# duration of run_job(); stale recovery never steals a locally live job.  This
# is intentionally process-local (no schema migration): cross-process safety
# comes from the per-job timeout + grace bound and the one-requeue-per-attempt
# marker in job.progress.
_LEASE_LOCK = threading.Lock()
_ACTIVE_LEASES: Dict[int, str] = {}


def _lease_job(job_id: int, worker: str) -> None:
    with _LEASE_LOCK:
        _ACTIVE_LEASES[int(job_id)] = worker


def _release_job(job_id: int, worker: str) -> None:
    with _LEASE_LOCK:
        if _ACTIVE_LEASES.get(int(job_id)) == worker:
            _ACTIVE_LEASES.pop(int(job_id), None)


def _has_live_lease(job_id: int) -> bool:
    with _LEASE_LOCK:
        return int(job_id) in _ACTIVE_LEASES


def _job_status(job_id: int) -> Optional[str]:
    """Read status from the row (never from a stale ORM identity-map object).

    The check must be read-only: a status recheck must never flush unrelated
    pending ORM changes (which can deadlock a SQLite test session).
    """
    from ...models.user_models import db
    try:
        with db.session.no_autoflush:
            return (GradingJob.query
                    .filter(GradingJob.id == job_id)
                    .with_entities(GradingJob.status)
                    .scalar())
    except Exception as exc:  # pragma: no cover - defensive
        logger.debug("AAGE job status recheck failed: %s", exc)
        db_rollback()
        return None


def _cancelled_outcome(job: GradingJob, started: float) -> Dict[str, Any]:
    return {
        "status": JOB_CANCELLED,
        "job_id": job.id,
        "result_id": None,
        "cancelled": True,
        "error": "job cancelled before completion",
        "duration_ms": int((time.time() - started) * 1000),
    }


def _cas_transition(job_id: int, *, from_statuses: Sequence[str],
                    updates: Dict[str, Any]) -> bool:
    """Compare-and-swap a job state; returns True only for the winning worker."""
    changed = (GradingJob.query
               .filter(GradingJob.id == job_id,
                       GradingJob.status.in_(list(from_statuses)))
               .update(updates, synchronize_session=False))
    db_commit()
    return bool(changed)


class JobError(Exception):
    def __init__(self, message: str, code: str = "job_error"):
        super().__init__(message)
        self.message = message
        self.code = code


# ---------------------------------------------------------------------------
# Enqueue
# ---------------------------------------------------------------------------

def enqueue_grade_job(
    *,
    submission_type: str,
    submission_id: int,
    assessment_kind: Optional[str] = None,
    assessment_id: Optional[int] = None,
    course_id: Optional[int] = None,
    student_id: Optional[int] = None,
    rubric_id: Optional[int] = None,
    evaluators: Optional[Sequence[str]] = None,
    requested_by: Optional[int] = None,
    priority: int = 100,
    force: bool = False,
    timeout_seconds: int = DEFAULT_JOB_TIMEOUT_SECONDS,
    max_attempts: int = MAX_JOB_ATTEMPTS,
    correlation_id: str = "",
) -> GradingJob:
    """Create (or return the existing) job for one submission.

    Idempotent: while a job for the same submission is queued or running a new
    one is *not* created — double-clicking "Grade" cannot spawn two runs.
    ``force=True`` supersedes the active job by cancelling it first.
    """
    if submission_type not in (SUBMISSION_ASSIGNMENT, SUBMISSION_PROJECT):
        raise JobError(f"unknown submission type: {submission_type}",
                       "bad_submission_type")

    existing = active_job(submission_type, submission_id)
    if existing is not None:
        if not force:
            logger.info(
                "AAGE enqueue deduped: submission %s/%s already has job %s (%s)",
                submission_type, submission_id, existing.id, existing.status)
            return existing
        _cancel(existing, actor_id=requested_by, reason="superseded by force enqueue")
        from .persistence import supersede_results_for_submission
        supersede_results_for_submission(
            submission_type=submission_type, submission_id=submission_id,
            actor_id=requested_by, reason="superseded by force enqueue")

    from .persistence import load_submission
    loaded = load_submission(submission_type, submission_id)

    job = GradingJob(
        correlation_id=correlation_id or uuid.uuid4().hex,
        job_type=JOB_TYPE_GRADE,
        submission_type=submission_type,
        submission_id=submission_id,
        assessment_kind=assessment_kind or loaded.assessment_kind,
        assessment_id=assessment_id if assessment_id is not None else loaded.assessment_id,
        course_id=course_id if course_id is not None else loaded.course_id,
        student_id=student_id if student_id is not None else loaded.student_id,
        status=JOB_QUEUED,
        priority=int(priority),
        attempts=0,
        max_attempts=max(1, int(max_attempts)),
        timeout_seconds=max(30, int(timeout_seconds)),
        rubric_id=rubric_id if rubric_id is not None else getattr(
            loaded.parent, "rubric_id", None),
        evaluators=list(evaluators) if evaluators else None,
        requested_by=requested_by,
        progress={"stage": "queued"},
        next_attempt_at=None,
        queued_at=now_local(),
    )
    db_add(job)
    db_commit()
    logger.info(
        "AAGE job queued id=%s submission=%s/%s assessment=%s/%s requested_by=%s",
        job.id, submission_type, submission_id, job.assessment_kind,
        job.assessment_id, requested_by,
    )
    return job


def active_job(submission_type: str, submission_id: int) -> Optional[GradingJob]:
    return (GradingJob.query
            .filter(GradingJob.submission_type == submission_type,
                    GradingJob.submission_id == submission_id,
                    GradingJob.job_type == JOB_TYPE_GRADE,
                    GradingJob.status.in_(_ACTIVE_STATUSES))
            .order_by(GradingJob.id.desc())
            .first())


def get_job(job_id: int) -> Optional[GradingJob]:
    return GradingJob.query.get(job_id)


# ---------------------------------------------------------------------------
# Claim / run
# ---------------------------------------------------------------------------

def claim_next(worker_id: str = "") -> Optional[GradingJob]:
    """Atomically take the highest-priority due job, or return ``None``."""
    now = now_local()
    candidates = (GradingJob.query
                  .filter(GradingJob.status == JOB_QUEUED,
                          GradingJob.job_type == JOB_TYPE_GRADE,
                          (GradingJob.next_attempt_at.is_(None))
                          | (GradingJob.next_attempt_at <= now))
                  .order_by(GradingJob.priority.asc(), GradingJob.queued_at.asc())
                  .limit(5)
                  .all())
    for candidate in candidates:
        # optimistic lock: only one worker may flip queued -> running
        claimed = (GradingJob.query
                   .filter(GradingJob.id == candidate.id,
                           GradingJob.status == JOB_QUEUED)
                   .update({
                       "status": JOB_RUNNING,
                       "locked_by": worker_id or _default_worker_id(),
                       "locked_at": now,
                       "started_at": now,
                       "attempts": (candidate.attempts or 0) + 1,
                       "updated_at": now,
                   }, synchronize_session=False))
        db_commit()
        if claimed:
            job = GradingJob.query.get(candidate.id)
            logger.info("AAGE job claimed id=%s by %s attempt=%s",
                        candidate.id, worker_id or _default_worker_id(),
                        job.attempts if job else "?")
            return job
    return None


def run_job(job: GradingJob, *, persist: bool = True) -> Dict[str, Any]:
    """Execute one claimed job to a terminal state (or a retryable backoff).

    ``job.timeout_seconds`` is a hard wall-clock deadline.  Provider calls read
    the per-thread deadline and abort, and the orchestrator is additionally
    checked after it returns.  Student code is never executed through this
    path, so the deadline only ever interrupts trusted engine work.
    """
    from . import orchestrator

    started = time.time()
    timeout_seconds = max(1, int(job.timeout_seconds
                                 or DEFAULT_JOB_TIMEOUT_SECONDS))
    deadline = time.monotonic() + timeout_seconds
    worker = job.locked_by or _default_worker_id()
    if _job_status(job.id) == JOB_CANCELLED:
        return _cancelled_outcome(job, started)
    _set_progress(job, {"stage": "loading", "attempt": job.attempts})
    db_commit()

    _lease_job(job.id, worker)
    set_deadline(deadline)
    try:
        try:
            outcome = orchestrator.evaluate_submission(
                job.submission_type,
                job.submission_id,
                job=job,
                requested_evaluators=job.evaluators or None,
                correlation_id=job.correlation_id,
                persist=persist,
            )
        except orchestrator.EvaluationError as exc:
            if exc.code == "job_cancelled":
                return _cancelled_outcome(job, started)
            if time.monotonic() >= deadline:
                return _fail(job, f"job exceeded {timeout_seconds}s",
                             "timeout", started, timed_out=True)
            return _fail(job, exc.message, exc.code, started)
        except Exception as exc:  # unexpected — still must leave the job claimable
            if time.monotonic() >= deadline:
                return _fail(job, f"job exceeded {timeout_seconds}s",
                             "timeout", started, timed_out=True)
            logger.exception("AAGE job %s crashed", job.id)
            return _fail(job, str(exc)[:2000], "unexpected_error", started)
    finally:
        clear_deadline()
        _release_job(job.id, worker)

    # A cancel can land while the orchestrator is running: never report or
    # publish success for a job that is no longer active.
    if _job_status(job.id) == JOB_CANCELLED:
        if outcome.result_id:
            from .persistence import supersede_results_for_submission
            supersede_results_for_submission(
                submission_type=job.submission_type,
                submission_id=job.submission_id,
                actor_id=job.requested_by,
                reason="job cancelled during evaluation",
            )
        return _cancelled_outcome(job, started)

    if time.monotonic() >= deadline:
        return _fail(job, f"job exceeded {timeout_seconds}s", "timeout",
                     started, timed_out=True)

    progress = {
        "stage": "succeeded",
        "score": outcome.final_score,
        "confidence": outcome.confidence,
        "requires_review": outcome.requires_review,
        "result_id": outcome.result_id,
        "evaluators": outcome.selected_evaluators,
    }
    cost = {"latency_ms": int((time.time() - started) * 1000)}
    succeeded = _cas_transition(
        job.id,
        from_statuses=(JOB_RUNNING, JOB_QUEUED),
        updates={
            "status": JOB_SUCCEEDED,
            "result_id": outcome.result_id,
            "error": None,
            "finished_at": now_local(),
            "locked_by": None,
            "locked_at": None,
            "progress": progress,
            "cost": cost,
        },
    )
    if not succeeded:
        # Another worker/cancel changed the row under us.  Do not publish.
        final_status = _job_status(job.id)
        logger.warning("AAGE job %s lost the success CAS (status=%s)",
                       job.id, final_status)
        return _cancelled_outcome(job, started)

    job.status = JOB_SUCCEEDED
    job.result_id = outcome.result_id
    job.error = None
    job.finished_at = now_local()
    job.locked_by = None
    job.locked_at = None
    job.progress = progress
    job.cost = cost

    # Excel-style self-approval is the default publication path. It also
    # handles results carrying a review flag, provided no real failure was
    # recorded. The stricter opt-in auto-publish gate stays available.
    if persist and outcome.ok and not getattr(outcome, "budget_exhausted", False):
        published = _maybe_auto_approve(job, outcome)
        if not published and not outcome.requires_review:
            _maybe_auto_publish(job, outcome)

    logger.info(
        "AAGE job succeeded id=%s result=%s score=%.2f confidence=%.1f "
        "worker=%s duration_ms=%d",
        job.id, outcome.result_id, outcome.final_score, outcome.confidence,
        worker, int((time.time() - started) * 1000),
    )
    return {"status": job.status, "result_id": outcome.result_id,
            "score": outcome.final_score, "job_id": job.id, "cancelled": False}


def _maybe_auto_approve(job: GradingJob, outcome: Any) -> bool:
    """Excel-style self-approval: publish when nothing genuinely blocks it.

    Returns ``True`` only when the canonical grade was written. Any failure is
    logged and swallowed so publication can never fail the evaluation itself.
    """
    try:
        from ...models.aage_models import EvaluationResult
        from .auto_approval import should_auto_approve
        from .constants import AUTO_APPROVE_NOTE, REVIEW_APPROVED
        from .persistence import write_through_grade
        from .policies import confidence_policy

        policy = confidence_policy()
        if not bool(policy.get("auto_approve_enabled", True)):
            return False
        if _job_status(job.id) != JOB_SUCCEEDED:
            return False
        result = EvaluationResult.query.get(outcome.result_id)
        if (result is None or result.is_official
                or getattr(result, "status", "")
                in ("superseded", "published", "rejected")):
            return False

        approved, blockers = should_auto_approve(result, policy)
        if not approved:
            logger.info(
                "AAGE auto-approval skipped for job %s result %s: %s",
                job.id, result.id, ",".join(blockers))
            return False
        # A cancel that lands after the decision must not publish.
        if _job_status(job.id) != JOB_SUCCEEDED:
            return False

        if not write_through_grade(
                result, actor_id=None, reason=AUTO_APPROVE_NOTE,
                publication_mode="auto_approved"):
            return False

        review = getattr(result, "review", None)
        if review is not None and review.status in ("pending", "changes_requested"):
            review.status = REVIEW_APPROVED
            review.decision_note = AUTO_APPROVE_NOTE
            review.final_score = result.final_score
            review.resolved_at = now_local()
            db_commit()

        _set_progress(job, {
            "stage": "published",
            "score": outcome.final_score,
            "confidence": result.confidence,
            "requires_review": bool(result.requires_review),
            "result_id": outcome.result_id,
            "publication_mode": "auto_approved",
        })
        db_commit()
        logger.info("AAGE auto-approved job %s result %s (score %.2f)",
                    job.id, result.id, outcome.final_score)
        return True
    except Exception:  # publication must never fail the evaluation itself
        logger.exception("AAGE auto-approval failed for job %s", job.id)
        return False


def _maybe_auto_publish(job: GradingJob, outcome: Any) -> None:
    try:
        from ...models.aage_models import EvaluationResult
        from .persistence import write_through_grade
        from .policies import confidence_policy

        policy = confidence_policy()
        if not policy.get("auto_publish_enabled"):
            return
        if _job_status(job.id) != JOB_SUCCEEDED:
            logger.info("AAGE auto-publish skipped for job %s: not succeeded",
                        job.id)
            return
        minimum = float(policy.get("auto_publish_min") or 0.0)
        if float(outcome.confidence or 0.0) < minimum:
            logger.info(
                "AAGE auto-publish skipped for job %s: confidence %.1f < %.1f",
                job.id, float(outcome.confidence or 0.0), minimum)
            return
        result = EvaluationResult.query.get(outcome.result_id)
        if result is None or result.is_official or result.requires_review:
            return
        if getattr(result, "status", "") in ("superseded", "published",
                                              "rejected"):
            return
        # require_all_gates is enforced authoritatively inside
        # write_through_grade (and by compute_confidence forcing review).
        # Re-check under the publication path as well: a cancellation that
        # lands after the first check must not publish.
        if _job_status(job.id) != JOB_SUCCEEDED:
            return
        # Automatic dispatch defaults ``requested_by`` to the student; never
        # record them as the grader of their own work.
        actor_id = (job.requested_by
                    if job.requested_by != getattr(result, "student_id", None)
                    else None)
        if write_through_grade(result, actor_id=actor_id,
                               reason="auto-publish (high confidence)"):
            _set_progress(job, {"stage": "published",
                                "score": outcome.final_score,
                                "result_id": outcome.result_id})
            db_commit()
    except Exception:  # publication must never fail the evaluation itself
        logger.exception("AAGE auto-publish failed for job %s", job.id)


def _fail(job: GradingJob, message: str, code: str, started: float,
          *, timed_out: bool = False) -> Dict[str, Any]:
    # The failed run may have left the session in a broken transaction.
    db_rollback()
    if _job_status(job.id) == JOB_CANCELLED or code == "job_cancelled":
        return _cancelled_outcome(job, started)
    attempts = job.attempts or 0
    max_attempts = job.max_attempts or MAX_JOB_ATTEMPTS
    # A timeout is terminal: retrying the same unbounded work would just hang
    # another worker.  Other transient engine failures stay retryable.
    retryable = (not timed_out) and code in (
        "unexpected_error", "all_evaluators_failed", "budget_exhausted")

    job.error = f"{code}: {message}"[:4000]
    if retryable and attempts < max_attempts:
        backoff = JOB_RETRY_BACKOFF_SECONDS[
            min(attempts - 1, len(JOB_RETRY_BACKOFF_SECONDS) - 1)]
        # An older attempt may already have persisted a draft result (e.g. a
        # timeout after save_result).  Retire it so only the next attempt's
        # result is active; audit rows remain untouched.
        from .persistence import supersede_results_for_submission
        supersede_results_for_submission(
            submission_type=job.submission_type,
            submission_id=job.submission_id, actor_id=job.requested_by,
            reason=f"automatic retry after {code}")
        job.status = JOB_QUEUED
        job.next_attempt_at = now_local() + timedelta(seconds=backoff)
        job.locked_by = None
        job.locked_at = None
        job.progress = {"stage": "retry_scheduled", "attempt": attempts,
                        "next_attempt_at": job.next_attempt_at.isoformat(),
                        "error": job.error}
        db_commit()
        logger.warning(
            "AAGE job %s attempt %s/%s failed (%s); retrying in %ss",
            job.id, attempts, max_attempts, code, backoff)
        return {"status": job.status, "job_id": job.id, "error": job.error,
                "retry_in": backoff}

    job.status = JOB_TIMED_OUT if timed_out else JOB_FAILED
    job.finished_at = now_local()
    job.locked_by = None
    job.locked_at = None
    job.progress = {
        "stage": "timed_out" if timed_out else "failed",
        "error": job.error,
    }
    db_commit()
    logger.error("AAGE job %s %s (%s): %s",
                 job.id, "timed out" if timed_out else "failed permanently",
                 code, message[:300])
    return {"status": job.status, "job_id": job.id, "error": job.error}


def cancel_job(job_id: int, *, actor_id: Optional[int] = None,
               reason: str = "") -> Optional[GradingJob]:
    job = get_job(job_id)
    if job is None or job.is_terminal():
        return job
    _cancel(job, actor_id=actor_id, reason=reason or "cancelled by request")
    return job


def _cancel(job: GradingJob, *, actor_id: Optional[int], reason: str) -> bool:
    """CAS cancel: only an active job can become cancelled, once."""
    from .persistence import audit
    before = {"status": job.status}
    updates = {
        "status": JOB_CANCELLED,
        "finished_at": now_local(),
        "locked_by": None,
        "locked_at": None,
        "progress": {"stage": "cancelled", "reason": reason},
    }
    if not _cas_transition(job.id,
                           from_statuses=(JOB_QUEUED, JOB_RUNNING),
                           updates=updates):
        logger.info("AAGE job %s cancel lost the CAS (already terminal)", job.id)
        return False
    job.status = JOB_CANCELLED
    job.finished_at = updates["finished_at"]
    job.locked_by = None
    job.locked_at = None
    job.progress = updates["progress"]
    audit(action="job_cancelled", entity_type="grading_job", entity_id=job.id,
          before=before, after={"status": JOB_CANCELLED}, actor_id=actor_id,
          reason=reason, correlation_id=job.correlation_id)
    logger.info("AAGE job %s cancelled (%s)", job.id, reason)
    return True


# ---------------------------------------------------------------------------
# Recovery
# ---------------------------------------------------------------------------

def recover_stale(limit: int = 50,
                  timeout_seconds: Optional[int] = None) -> int:
    """Requeue (or fail) running jobs whose worker died holding the lock.

    Recovery is deliberately bounded, not purely time-based:

    * a job with a live lease in this process is never stolen;
    * with default settings the lock must be older than **both**
      ``STALE_LOCK_SECONDS`` and the job's own timeout plus grace, so the
      worker always reaches its deadline before another worker can recover it;
    * a job is requeued at most once per attempt (marker in ``progress``), and
      never beyond ``max_attempts``;
    * an explicit ``timeout_seconds`` (startup/tests/operator override) is
      authoritative for the age check.

    No schema migration is required: the lease marker lives in the existing
    JSON ``progress`` column.
    """
    explicit = timeout_seconds is not None
    try:
        age = max(1, int(timeout_seconds)) if explicit else STALE_LOCK_SECONDS
    except (TypeError, ValueError):
        age = STALE_LOCK_SECONDS
        explicit = False
    now = now_local()
    cutoff = now - timedelta(seconds=age)
    stale = (GradingJob.query
             .filter(GradingJob.status == JOB_RUNNING,
                     GradingJob.locked_at.isnot(None),
                     GradingJob.locked_at < cutoff)
             .order_by(GradingJob.locked_at.asc())
             .limit(max(1, int(limit)))
             .all())
    recovered = 0
    for job in stale:
        worker = job.locked_by or "unknown"
        if _has_live_lease(job.id):
            logger.debug("AAGE job %s not stale: live local lease", job.id)
            continue
        previous = job.progress if isinstance(job.progress, dict) else {}
        attempts = int(job.attempts or 0)
        if previous.get("recovered_for_attempt") == attempts:
            logger.debug("AAGE job %s already recovered for attempt %s",
                         job.id, attempts)
            continue
        if not explicit:
            job_timeout = max(1, int(job.timeout_seconds
                                     or DEFAULT_JOB_TIMEOUT_SECONDS))
            min_age = job_timeout + STALE_LOCK_GRACE_SECONDS
            if (now - job.locked_at).total_seconds() < min_age:
                continue

        base = dict(previous)
        if attempts < (job.max_attempts or MAX_JOB_ATTEMPTS):
            updates = {
                "status": JOB_QUEUED,
                "next_attempt_at": now,
                "locked_by": None,
                "locked_at": None,
                "progress": {
                    **base,
                    "stage": "recovered",
                    "reason": f"stale lock from {worker}",
                    "attempt": attempts,
                    "recovered_for_attempt": attempts,
                },
            }
        else:
            updates = {
                "status": JOB_FAILED,
                "error": "worker died and no attempts remain",
                "finished_at": now,
                "locked_by": None,
                "locked_at": None,
                "progress": {
                    **base,
                    "stage": "failed",
                    "reason": "stale lock",
                    "recovered_for_attempt": attempts,
                },
            }
        # CAS on the exact lock value prevents two recovery loops from
        # requeueing the same abandoned job.
        changed = (GradingJob.query
                   .filter(GradingJob.id == job.id,
                           GradingJob.status == JOB_RUNNING,
                           GradingJob.locked_at == job.locked_at)
                   .update(updates, synchronize_session=False))
        db_commit()
        if not changed:
            continue
        for key, value in updates.items():
            setattr(job, key, value)
        recovered += 1
        if updates["status"] == JOB_QUEUED:
            logger.warning("AAGE job %s recovered from stale lock (%s)",
                           job.id, worker)
        else:
            logger.error("AAGE job %s abandoned after stale lock", job.id)
    return recovered


def reap_zombie_running(timeout_seconds: Optional[int] = None) -> int:
    """Alias kept for callers that only remember the 'zombie' wording."""
    return recover_stale(timeout_seconds=timeout_seconds)


# ---------------------------------------------------------------------------
# Worker loop
# ---------------------------------------------------------------------------

_worker_seq = 0


def _default_worker_id() -> str:
    global _worker_seq
    _worker_seq += 1
    return f"{socket.gethostname()}:{os.getpid()}:{_worker_seq}"


def _set_progress(job: GradingJob, progress: Dict[str, Any]) -> None:
    job.progress = {**(job.progress or {}), **progress}


def process_once(worker_id: str = "") -> Optional[Dict[str, Any]]:
    """Claim at most one job and run it.  Returns the outcome or ``None``."""
    job = claim_next(worker_id)
    if job is None:
        return None
    return run_job(job)


def start_worker(app: Any, *, poll_interval: float = 2.0,
                 name: str = "aage-worker") -> threading.Thread:
    """Start the in-process background worker (daemon, stops with the app)."""
    stop = threading.Event()

    def _loop() -> None:
        worker_id = _default_worker_id()
        logger.info("AAGE worker started (%s, poll=%.1fs)", worker_id,
                    poll_interval)
        while not stop.is_set():
            try:
                with app.app_context():
                    recover_stale(limit=5)
                    outcome = process_once(worker_id)
                    if outcome is None:
                        stop.wait(poll_interval)
            except Exception:  # never let the worker die
                logger.exception("AAGE worker loop error")
                stop.wait(min(30.0, poll_interval * 5))
        logger.info("AAGE worker stopped (%s)", worker_id)

    thread = threading.Thread(target=_loop, name=name, daemon=True)
    thread.aage_stop = stop  # type: ignore[attr-defined]
    thread.start()
    return thread


def stop_worker(thread: threading.Thread) -> None:
    stop = getattr(thread, "aage_stop", None)
    if stop is not None:
        stop.set()
    thread.join(timeout=10)


def job_to_dict(job: Optional[GradingJob]) -> Optional[Dict[str, Any]]:
    return job.to_dict() if job is not None else None


def list_jobs(*, statuses: Optional[Sequence[str]] = None,
              submission_type: Optional[str] = None,
              submission_id: Optional[int] = None,
              limit: int = 50) -> List[Dict[str, Any]]:
    query = GradingJob.query
    if statuses:
        query = query.filter(GradingJob.status.in_(list(statuses)))
    if submission_type:
        query = query.filter(GradingJob.submission_type == submission_type)
    if submission_id is not None:
        query = query.filter(GradingJob.submission_id == submission_id)
    rows = (query.order_by(GradingJob.id.desc()).limit(int(limit)).all())
    return [r.to_dict() for r in rows]
