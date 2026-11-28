"""Shared AAGE constants: statuses, policies, limits.

Everything here is *configuration data*, not behaviour.  Runtime policy knobs
(confidence thresholds, auto-publication) live in the database and are read
through :mod:`src.services.aage.policies`.
"""

from __future__ import annotations

import os


def _env_int(name: str, default: int, minimum: int = 1) -> int:
    """Read a positive integer AAGE setting without ever failing at import."""
    try:
        return max(minimum, int(os.environ.get(name, default)))
    except (TypeError, ValueError):
        return default


# --- evidence ---------------------------------------------------------------

EVIDENCE_VERIFIED = "VERIFIED"
EVIDENCE_CODE = "CODE_SUPPORTED"
EVIDENCE_CONTENT = "CONTENT_SUPPORTED"
EVIDENCE_UNVERIFIED = "UNVERIFIED"

EVIDENCE_CATEGORIES = (
    EVIDENCE_VERIFIED,
    EVIDENCE_CODE,
    EVIDENCE_CONTENT,
    EVIDENCE_UNVERIFIED,
)

# --- job lifecycle ----------------------------------------------------------

JOB_QUEUED = "queued"
JOB_RUNNING = "running"
JOB_SUCCEEDED = "succeeded"
JOB_FAILED = "failed"
JOB_CANCELLED = "cancelled"
JOB_TIMED_OUT = "timed_out"

JOB_STATUSES = (
    JOB_QUEUED, JOB_RUNNING, JOB_SUCCEEDED, JOB_FAILED, JOB_CANCELLED, JOB_TIMED_OUT,
)

JOB_TYPE_GRADE = "grade_submission"
JOB_TYPE_RUBRIC = "generate_rubric"
JOB_TYPE_CALIBRATE = "calibration"

# --- result lifecycle -------------------------------------------------------

RESULT_DRAFT = "draft"
RESULT_PENDING_REVIEW = "pending_review"
RESULT_APPROVED = "approved"
RESULT_PUBLISHED = "published"
RESULT_REJECTED = "rejected"
RESULT_SUPERSEDED = "superseded"

# --- rubric lifecycle -------------------------------------------------------

RUBRIC_DRAFT = "draft"
RUBRIC_PENDING = "pending_approval"
RUBRIC_APPROVED = "approved"
RUBRIC_ARCHIVED = "archived"

# --- review -----------------------------------------------------------------

REVIEW_PENDING = "pending"
REVIEW_APPROVED = "approved"
REVIEW_REJECTED = "rejected"
REVIEW_CHANGES = "changes_requested"
# States an instructor can still act on.  A correction moves a review from
# ``pending`` to ``changes_requested`` without closing it, so both are open.
OPEN_REVIEW_STATUSES = (REVIEW_PENDING, REVIEW_CHANGES)

# --- learning ---------------------------------------------------------------

LEARNING_CANDIDATE = "candidate"
LEARNING_APPROVED = "approved"
LEARNING_REJECTED = "rejected"

# --- evaluators -------------------------------------------------------------

EVALUATOR_ACTIVE = "active"
EVALUATOR_CANDIDATE = "candidate"
EVALUATOR_RETIRED = "retired"
EVALUATOR_ROLLED_BACK = "rolled_back"

# --- submission kinds -------------------------------------------------------

SUBMISSION_ASSIGNMENT = "assignment"
SUBMISSION_PROJECT = "project"
SUBMISSION_TYPES = (SUBMISSION_ASSIGNMENT, SUBMISSION_PROJECT)

# --- limits (security-relevant) --------------------------------------------

MAX_ZIP_COMPRESSED_BYTES = 80 * 1024 * 1024        # 80 MB compressed
MAX_ZIP_UNCOMPRESSED_BYTES = 300 * 1024 * 1024     # 300 MB total after inflate
MAX_ZIP_FILE_COUNT = 4000
MAX_ZIP_COMPRESSION_RATIO = 200                    # zip-bomb heuristic
MAX_SINGLE_FILE_BYTES = 25 * 1024 * 1024           # 25 MB per extracted file
MAX_SOURCE_CHARS_FOR_PROMPT = 60_000                # per-file cap sent to a model
MAX_TOTAL_CHARS_FOR_PROMPT = 180_000                # per-submission cap
MAX_DOWNLOAD_BYTES = 100 * 1024 * 1024

# --- job execution ----------------------------------------------------------

DEFAULT_JOB_TIMEOUT_SECONDS = _env_int("AAGE_JOB_TIMEOUT_SECONDS", 180, 30)
MAX_JOB_ATTEMPTS = _env_int("AAGE_MAX_JOB_ATTEMPTS", 3)
JOB_RETRY_BACKOFF_SECONDS = (5, 20, 60)
# Minimum age before a *running* lock may be considered dead.  Recovery also
# requires the job's own timeout plus STALE_LOCK_GRACE_SECONDS to have elapsed,
# so a live worker always fails/returns its job before another worker can pick
# it up.  Overridable without a schema migration (AAGE_STALE_LOCK_*).
STALE_LOCK_SECONDS = _env_int("AAGE_STALE_LOCK_SECONDS", 300)
STALE_LOCK_GRACE_SECONDS = _env_int("AAGE_STALE_LOCK_GRACE_SECONDS", 30)

# --- default confidence policy --------------------------------------------

CONFIDENCE_AUTO_PUBLISH_MIN = 90.0
CONFIDENCE_PROVISIONAL_MIN = 75.0
# Excel-style approval: the legacy Excel grader self-approves at 0.7 confidence
# when no manual-review flag or critical failure was recorded. AAGE's confidence
# is a meta-confidence over the grading process, so its own auto-publish gate is
# deliberately stricter; this parallel gate mirrors the Excel behaviour.
CONFIDENCE_AUTO_APPROVE_MIN = 70.0
AUTO_APPROVE_NOTE = "Auto-approved by AI grading system"

DEFAULT_CONFIDENCE_POLICY = {
    "auto_publish_min": CONFIDENCE_AUTO_PUBLISH_MIN,
    "provisional_min": CONFIDENCE_PROVISIONAL_MIN,
    "auto_publish_enabled": False,
    "require_all_gates": True,
    "auto_approve_enabled": True,
    "auto_approve_min": CONFIDENCE_AUTO_APPROVE_MIN,
}

# Unverified criteria may not receive more than this fraction of their marks
# unless an instructor overrides it explicitly.
UNVERIFIED_FULL_MARK_CAP = 0.85
