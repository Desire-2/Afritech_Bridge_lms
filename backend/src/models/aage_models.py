"""Adaptive AI Assessment & Grading Engine — persistence layer.

Additive only: no existing table is dropped or altered destructively.
``Rubric`` / ``RubricCriterion`` gain nullable columns in
``migrations/versions/…_add_aage_engine_tables.py`` (see also
``ensure_aage_schema`` below, which self-heals the same way the legacy
``_auto_migrate_missing_columns`` helper does).

Naming note: the spec's ``GradingRubric`` / ``RubricCriterion`` entities are
the *existing* ``rubrics`` / ``rubric_criteria`` tables, extended in place —
the engine deliberately reuses them so ``Assignment.rubric_id`` and
``Project.rubric_id`` keep working unchanged.
"""

from __future__ import annotations

import hashlib
import json
import uuid
from datetime import timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    JSON,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship

from ..utils.time_utils import now_local
from .user_models import db

__all__ = [
    "GradingProfile",
    "RubricVersion",
    "GradingJob",
    "SubmissionArtifact",
    "EvaluationRun",
    "EvaluationResult",
    "CriterionScore",
    "EvaluationEvidence",
    "GradingReview",
    "LearningExample",
    "EvaluatorVersion",
    "CalibrationRun",
    "CalibrationCase",
    "GradingAuditLog",
    "ensure_aage_schema",
]


def _json_digest(payload: Any) -> str:
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


class GradingProfile(db.Model):
    """Reusable, instructor-approved rubric profile for a discipline.

    An assessment that references an approved profile may be graded without a
    per-assessment rubric approval (spec §4, last paragraph).
    """

    __tablename__ = "grading_profiles"

    id = Column(Integer, primary_key=True)
    key = Column(String(120), nullable=False, unique=True, index=True)
    name = Column(String(200), nullable=False)
    discipline = Column(String(60), nullable=False, index=True)
    description = Column(Text)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    criteria_template = Column(JSON, nullable=False, default=list)
    is_active = Column(Boolean, default=True, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "key": self.key,
            "name": self.name,
            "discipline": self.discipline,
            "description": self.description,
            "course_id": self.course_id,
            "criteria_template": self.criteria_template or [],
            "is_active": self.is_active,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


class RubricVersion(db.Model):
    """Immutable snapshot of a rubric at a given version.

    Historical versions are never rewritten; grading results point at the exact
    version they were produced against.
    """

    __tablename__ = "rubric_versions"
    __table_args__ = (
        UniqueConstraint("rubric_id", "version", name="_rubric_version_uc"),
    )

    id = Column(Integer, primary_key=True)
    rubric_id = Column(Integer, ForeignKey("rubrics.id"), nullable=False, index=True)
    version = Column(Integer, nullable=False, default=1)
    checksum = Column(String(64), nullable=False, index=True)
    payload = Column(JSON, nullable=False, default=dict)
    total_points = Column(Float, nullable=True)
    weight_total = Column(Float, nullable=True)
    change_note = Column(Text)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    rubric = relationship("Rubric", backref=db.backref("versions", lazy="dynamic"))

    def to_dict(self, include_payload: bool = True) -> Dict[str, Any]:
        data = {
            "id": self.id,
            "rubric_id": self.rubric_id,
            "version": self.version,
            "checksum": self.checksum,
            "total_points": self.total_points,
            "weight_total": self.weight_total,
            "change_note": self.change_note,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
        if include_payload:
            data["payload"] = self.payload or {}
        return data


class GradingJob(db.Model):
    """Persistent asynchronous grading job.

    The row — not process memory — is the source of truth for job state, which
    is what makes retries, recovery after a worker crash and duplicate-jo
    prevention possible without a distributed queue.
    """

    __tablename__ = "grading_jobs"
    __table_args__ = (
        Index("ix_grading_jobs_status_next", "status", "next_attempt_at"),
        Index("ix_grading_jobs_submission", "submission_type", "submission_id"),
        Index("ix_grading_jobs_created", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    correlation_id = Column(String(36), nullable=False, unique=True, index=True,
                            default=lambda: uuid.uuid4().hex)
    job_type = Column(String(40), nullable=False, default="grade_submission", index=True)

    submission_type = Column(String(20), nullable=False)          # assignment | project
    submission_id = Column(Integer, nullable=False)
    assessment_id = Column(Integer, nullable=False, index=True)
    assessment_kind = Column(String(20), nullable=False)          # assignment | project
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    status = Column(String(20), nullable=False, default="queued", index=True)
    priority = Column(Integer, nullable=False, default=100)
    attempts = Column(Integer, nullable=False, default=0)
    max_attempts = Column(Integer, nullable=False, default=3)
    next_attempt_at = Column(DateTime, nullable=True)
    locked_by = Column(String(80), nullable=True)
    locked_at = Column(DateTime, nullable=True)
    timeout_seconds = Column(Integer, nullable=False, default=180)

    rubric_id = Column(Integer, ForeignKey("rubrics.id"), nullable=True)
    rubric_version_id = Column(Integer, ForeignKey("rubric_versions.id"), nullable=True)
    evaluators = Column(JSON, nullable=True)                      # requested evaluator names

    requested_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    progress = Column(JSON, nullable=True)
    error = Column(Text, nullable=True)
    result_id = Column(Integer, nullable=True)                    # evaluation_results.id (no FK: ordering)

    cost = Column(JSON, nullable=True)                            # {tokens_in,tokens_out,latency_ms,provider}
    queued_at = Column(DateTime, default=now_local, nullable=False)
    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    def is_terminal(self) -> bool:
        return self.status in ("succeeded", "failed", "cancelled", "timed_out")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "correlation_id": self.correlation_id,
            "job_type": self.job_type,
            "submission_type": self.submission_type,
            "submission_id": self.submission_id,
            "assessment_id": self.assessment_id,
            "assessment_kind": self.assessment_kind,
            "course_id": self.course_id,
            "student_id": self.student_id,
            "status": self.status,
            "priority": self.priority,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "rubric_id": self.rubric_id,
            "rubric_version_id": self.rubric_version_id,
            "evaluators": self.evaluators or [],
            "error": self.error,
            "result_id": self.result_id,
            "progress": self.progress or {},
            "queued_at": self.queued_at.isoformat() if self.queued_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SubmissionArtifact(db.Model):
    """Safe, per-file manifest of a submission.

    Metadata + checksum only; file bytes stay in the existing storage backend
    (Google Drive / HTTP URLs) and are never duplicated into PostgreSQL.
    """

    __tablename__ = "submission_artifacts"
    __table_args__ = (
        Index("ix_submission_artifacts_lookup", "submission_type", "submission_id"),
        UniqueConstraint("job_id", "relative_path", name="_artifact_job_path_uc"),
    )

    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("grading_jobs.id"), nullable=False, index=True)
    submission_type = Column(String(20), nullable=False)
    submission_id = Column(Integer, nullable=False)

    file_name = Column(String(400), nullable=False)
    relative_path = Column(String(600), nullable=False)
    storage = Column(String(40), nullable=True)          # google_drive | url | inline | local
    external_id = Column(String(255), nullable=True)
    media_type = Column(String(120), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    checksum_sha256 = Column(String(64), nullable=True, index=True)

    category = Column(String(30), nullable=True)         # source|config|doc|test|data|archive|binary|other
    language = Column(String(60), nullable=True)
    is_entry_point = Column(Boolean, default=False)
    is_required_deliverable = Column(Boolean, default=False)
    truncated = Column(Boolean, default=False)
    extracted = Column(JSON, nullable=True)              # analyzer output for this file
    status = Column(String(20), nullable=False, default="ready")
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_id": self.job_id,
            "submission_type": self.submission_type,
            "submission_id": self.submission_id,
            "file_name": self.file_name,
            "relative_path": self.relative_path,
            "storage": self.storage,
            "media_type": self.media_type,
            "size_bytes": self.size_bytes,
            "checksum_sha256": self.checksum_sha256,
            "category": self.category,
            "language": self.language,
            "is_entry_point": self.is_entry_point,
            "is_required_deliverable": self.is_required_deliverable,
            "truncated": self.truncated,
            "status": self.status,
            "error": self.error,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EvaluationRun(db.Model):
    """One orchestrator execution (may fan out to several evaluators)."""

    __tablename__ = "evaluation_runs"
    id = Column(Integer, primary_key=True)
    job_id = Column(Integer, ForeignKey("grading_jobs.id"), nullable=False, index=True)
    correlation_id = Column(String(36), nullable=True, index=True)
    rubric_version_id = Column(Integer, ForeignKey("rubric_versions.id"), nullable=True)

    status = Column(String(20), nullable=False, default="running")
    evaluators = Column(JSON, nullable=True)             # [{name,version,status,latency_ms,error}]
    artifact_summary = Column(JSON, nullable=True)
    warnings = Column(JSON, nullable=True)
    conflicts = Column(JSON, nullable=True)              # detected evaluator disagreements

    provider = Column(String(40), nullable=True)
    model = Column(String(120), nullable=True)
    tokens_in = Column(Integer, nullable=True)
    tokens_out = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    # Honest usage record, e.g. {"provider": "x", "llm_calls": 2,
    # "prompt_chars": 100, "response_chars": 80, "tokens_in": null,
    # "tokens_out": null, "note": "provider did not expose token usage"}.
    # Never contains an invented dollar amount.
    cost = Column(JSON, nullable=True)

    started_at = Column(DateTime, default=now_local, nullable=False)
    finished_at = Column(DateTime, nullable=True)
    duration_ms = Column(Integer, nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_id": self.job_id,
            "correlation_id": self.correlation_id,
            "rubric_version_id": self.rubric_version_id,
            "status": self.status,
            "evaluators": self.evaluators or [],
            "artifact_summary": self.artifact_summary or {},
            "warnings": self.warnings or [],
            "conflicts": self.conflicts or [],
            "provider": self.provider,
            "duration_ms": self.duration_ms,
            "cost_estimate": self.cost_estimate,
            "cost": self.cost,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
        }


class EvaluationResult(db.Model):
    """Authoritative outcome of a grading run.

    ``final_score`` is a 0–100 percentage computed deterministically by
    :mod:`src.services.aage.scoring`; no model output ever writes it.
    """

    __tablename__ = "evaluation_results"
    __table_args__ = (
        Index("ix_evaluation_results_submission", "submission_type", "submission_id"),
    )

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("evaluation_runs.id"), nullable=True)
    job_id = Column(Integer, ForeignKey("grading_jobs.id"), nullable=True, index=True)
    correlation_id = Column(String(36), nullable=True, index=True)

    submission_type = Column(String(20), nullable=False)
    submission_id = Column(Integer, nullable=False)
    assessment_kind = Column(String(20), nullable=False)
    assessment_id = Column(Integer, nullable=False, index=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True, index=True)
    student_id = Column(Integer, ForeignKey("users.id"), nullable=True, index=True)

    rubric_id = Column(Integer, ForeignKey("rubrics.id"), nullable=True)
    rubric_version_id = Column(Integer, ForeignKey("rubric_versions.id"), nullable=True)
    rubric_snapshot = Column(JSON, nullable=True)        # frozen copy of criteria used

    total_awarded = Column(Float, nullable=False, default=0.0)
    total_possible = Column(Float, nullable=False, default=0.0)
    final_score = Column(Float, nullable=False, default=0.0)   # 0-100 percentage
    grade_letter = Column(String(5), nullable=True)
    points_awarded = Column(Float, nullable=True)              # scaled to points_possible

    confidence = Column(Float, nullable=False, default=0.0)
    confidence_factors = Column(JSON, nullable=True)
    requires_review = Column(Boolean, default=True, nullable=False)
    review_reason = Column(Text, nullable=True)
    status = Column(String(30), nullable=False, default="draft", index=True)

    feedback = Column(Text, nullable=True)
    strengths = Column(JSON, nullable=True)
    improvements = Column(JSON, nullable=True)

    ai_provider = Column(String(40), nullable=True)
    evaluator_versions = Column(JSON, nullable=True)
    limitations = Column(JSON, nullable=True)

    is_official = Column(Boolean, default=False, nullable=False)
    published_at = Column(DateTime, nullable=True)
    published_by = Column(Integer, ForeignKey("users.id"), nullable=True)

    created_at = Column(DateTime, default=now_local, nullable=False)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    criteria = relationship(
        "CriterionScore",
        backref="result",
        cascade="all, delete-orphan",
        lazy="dynamic",
        order_by="CriterionScore.order_index",
    )
    evidence = relationship(
        "EvaluationEvidence",
        backref="result",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )
    review = relationship(
        "GradingReview",
        backref="result",
        cascade="all, delete-orphan",
        uselist=False,
    )

    def to_dict(self, include_criteria: bool = True) -> Dict[str, Any]:
        data: Dict[str, Any] = {
            "id": self.id,
            "run_id": self.run_id,
            "job_id": self.job_id,
            "correlation_id": self.correlation_id,
            "submission_type": self.submission_type,
            "submission_id": self.submission_id,
            "assessment_kind": self.assessment_kind,
            "assessment_id": self.assessment_id,
            "course_id": self.course_id,
            "student_id": self.student_id,
            "rubric_id": self.rubric_id,
            "rubric_version_id": self.rubric_version_id,
            "total_awarded": self.total_awarded,
            "total_possible": self.total_possible,
            "final_score": self.final_score,
            "grade_letter": self.grade_letter,
            "points_awarded": self.points_awarded,
            "confidence": self.confidence,
            "confidence_factors": self.confidence_factors or {},
            "requires_review": self.requires_review,
            "review_reason": self.review_reason,
            "status": self.status,
            "feedback": self.feedback,
            "strengths": self.strengths or [],
            "improvements": self.improvements or [],
            "ai_provider": self.ai_provider,
            "evaluator_versions": self.evaluator_versions or [],
            "limitations": self.limitations or [],
            "is_official": self.is_official,
            "published_at": self.published_at.isoformat() if self.published_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_criteria:
            data["criteria"] = [c.to_dict() for c in self.criteria.all()]
        return data


class CriterionScore(db.Model):
    """Criterion-level outcome: marks, weight, rationale and evidence status."""

    __tablename__ = "criterion_scores"
    __table_args__ = (
        UniqueConstraint("result_id", "criterion_key", name="_criterion_score_result_key_uc"),
    )

    id = Column(Integer, primary_key=True)
    result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=False, index=True)
    criterion_id = Column(Integer, ForeignKey("rubric_criteria.id"), nullable=True)
    criterion_key = Column(String(80), nullable=False)
    name = Column(String(200), nullable=False)

    awarded = Column(Float, nullable=False, default=0.0)
    maximum = Column(Float, nullable=False, default=0.0)
    weight = Column(Float, nullable=False, default=0.0)
    weighted_score = Column(Float, nullable=False, default=0.0)

    rationale = Column(Text, nullable=True)
    evidence_category = Column(String(30), nullable=False, default="UNVERIFIED")
    verification_status = Column(String(20), nullable=False, default="unverified")
    evaluator_name = Column(String(60), nullable=True)
    evaluator_version = Column(String(30), nullable=True)
    feedback = Column(Text, nullable=True)
    limitations = Column(Text, nullable=True)
    is_required = Column(Boolean, default=True)
    order_index = Column(Integer, default=0)

    created_at = Column(DateTime, default=now_local, nullable=False)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    evidence = relationship(
        "EvaluationEvidence",
        backref="criterion_score",
        cascade="all, delete-orphan",
        lazy="dynamic",
    )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "result_id": self.result_id,
            "criterion_id": self.criterion_id,
            "criterion_key": self.criterion_key,
            "name": self.name,
            "awarded": self.awarded,
            "maximum": self.maximum,
            "weight": self.weight,
            "weighted_score": self.weighted_score,
            "rationale": self.rationale,
            "evidence_category": self.evidence_category,
            "verification_status": self.verification_status,
            "evaluator_name": self.evaluator_name,
            "evaluator_version": self.evaluator_version,
            "feedback": self.feedback,
            "limitations": self.limitations,
            "is_required": self.is_required,
            "order_index": self.order_index,
            "evidence": [e.to_dict() for e in self.evidence.all()],
        }


class EvaluationEvidence(db.Model):
    """A single piece of supporting evidence for a criterion."""

    __tablename__ = "evaluation_evidence"
    id = Column(Integer, primary_key=True)
    result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=False, index=True)
    criterion_score_id = Column(Integer, ForeignKey("criterion_scores.id"), nullable=True, index=True)
    criterion_key = Column(String(80), nullable=True)

    category = Column(String(30), nullable=False, default="UNVERIFIED")
    source = Column(String(40), nullable=False, default="static_analysis")
    reference = Column(String(600), nullable=True)      # file path / artifact id
    locator = Column(String(600), nullable=True)        # line/section hint
    summary = Column(String(700), nullable=False)
    detail = Column(JSON, nullable=True)
    confidence = Column(Float, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "criterion_score_id": self.criterion_score_id,
            "criterion_key": self.criterion_key,
            "category": self.category,
            "source": self.source,
            "reference": self.reference,
            "locator": self.locator,
            "summary": self.summary,
            "detail": self.detail or {},
            "confidence": self.confidence,
        }


class GradingReview(db.Model):
    """Instructor review of an AI evaluation."""

    __tablename__ = "grading_reviews"
    __table_args__ = (
        UniqueConstraint("result_id", name="_grading_review_result_uc"),
    )

    id = Column(Integer, primary_key=True)
    result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=False, index=True)
    status = Column(String(30), nullable=False, default="pending", index=True)
    assigned_to = Column(Integer, ForeignKey("users.id"), nullable=True)
    ai_score = Column(Float, nullable=True)
    final_score = Column(Float, nullable=True)
    decision_note = Column(Text, nullable=True)
    correction_reason = Column(Text, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    opened_at = Column(DateTime, default=now_local, nullable=False)
    resolved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)
    updated_at = Column(DateTime, default=now_local, onupdate=now_local)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "result_id": self.result_id,
            "status": self.status,
            "assigned_to": self.assigned_to,
            "ai_score": self.ai_score,
            "final_score": self.final_score,
            "decision_note": self.decision_note,
            "correction_reason": self.correction_reason,
            "opened_at": self.opened_at.isoformat() if self.opened_at else None,
            "resolved_at": self.resolved_at.isoformat() if self.resolved_at else None,
        }


class LearningExample(db.Model):
    """Instructor-approved correction, used for retrieval-based calibration.

    Candidates become ``approved`` only through an explicit instructor action;
    nothing is auto-promoted.
    """

    __tablename__ = "learning_examples"
    id = Column(Integer, primary_key=True)
    result_id = Column(Integer, ForeignKey("evaluation_results.id"), nullable=True, index=True)
    submission_type = Column(String(20), nullable=True)
    submission_id = Column(Integer, nullable=True)
    assessment_id = Column(Integer, nullable=True)
    course_id = Column(Integer, ForeignKey("courses.id"), nullable=True)

    rubric_version_id = Column(Integer, ForeignKey("rubric_versions.id"), nullable=True)
    evaluator_name = Column(String(60), nullable=True)
    evaluator_version = Column(String(30), nullable=True)
    ai_provider = Column(String(40), nullable=True)

    original_scores = Column(JSON, nullable=True)
    instructor_scores = Column(JSON, nullable=True)
    score_delta = Column(Float, nullable=True)
    explanation = Column(Text, nullable=True)
    tags = Column(JSON, nullable=True)

    status = Column(String(20), nullable=False, default="candidate", index=True)
    dataset_version = Column(String(40), nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "result_id": self.result_id,
            "submission_type": self.submission_type,
            "submission_id": self.submission_id,
            "assessment_id": self.assessment_id,
            "course_id": self.course_id,
            "evaluator_name": self.evaluator_name,
            "evaluator_version": self.evaluator_version,
            "ai_provider": self.ai_provider,
            "original_scores": self.original_scores or {},
            "instructor_scores": self.instructor_scores or {},
            "score_delta": self.score_delta,
            "explanation": self.explanation,
            "tags": self.tags or [],
            "status": self.status,
            "dataset_version": self.dataset_version,
            "approved_by": self.approved_by,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class EvaluatorVersion(db.Model):
    """Versioned evaluator configuration with benchmark metrics and rollback."""

    __tablename__ = "evaluator_versions"
    __table_args__ = (
        UniqueConstraint("name", "version", name="_evaluator_name_version_uc"),
    )

    id = Column(Integer, primary_key=True)
    name = Column(String(60), nullable=False, index=True)
    version = Column(String(30), nullable=False)
    status = Column(String(20), nullable=False, default="candidate", index=True)

    description = Column(Text)
    changelog = Column(Text)
    config = Column(JSON, nullable=True)
    prompt_hash = Column(String(64), nullable=True)
    source_path = Column(String(300), nullable=True)

    benchmark_mae = Column(Float, nullable=True)
    criterion_agreement = Column(Float, nullable=True)
    false_pass_rate = Column(Float, nullable=True)
    false_fail_rate = Column(Float, nullable=True)
    override_rate = Column(Float, nullable=True)
    sample_count = Column(Integer, nullable=True)
    benchmark_metrics = Column(JSON, nullable=True)

    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)
    activated_at = Column(DateTime, nullable=True)
    activated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    retired_at = Column(DateTime, nullable=True)
    supersedes_id = Column(Integer, ForeignKey("evaluator_versions.id"), nullable=True)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "version": self.version,
            "status": self.status,
            "description": self.description,
            "changelog": self.changelog,
            "config": self.config or {},
            "benchmark_mae": self.benchmark_mae,
            "criterion_agreement": self.criterion_agreement,
            "false_pass_rate": self.false_pass_rate,
            "false_fail_rate": self.false_fail_rate,
            "override_rate": self.override_rate,
            "sample_count": self.sample_count,
            "benchmark_metrics": self.benchmark_metrics or {},
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "activated_at": self.activated_at.isoformat() if self.activated_at else None,
            "supersedes_id": self.supersedes_id,
        }


class CalibrationRun(db.Model):
    """Benchmark comparison of a candidate evaluator against the active one."""

    __tablename__ = "calibration_runs"

    id = Column(Integer, primary_key=True)
    name = Column(String(200), nullable=False)
    status = Column(String(20), nullable=False, default="pending", index=True)
    dataset_version = Column(String(40), nullable=True)

    baseline_evaluator_version_id = Column(Integer, ForeignKey("evaluator_versions.id"), nullable=True)
    candidate_evaluator_version_id = Column(Integer, ForeignKey("evaluator_versions.id"), nullable=True)

    case_count = Column(Integer, default=0)
    metrics = Column(JSON, nullable=True)     # mae, criterion_agreement, false_pass/fail, ...
    decision = Column(String(20), nullable=True)
    decision_note = Column(Text, nullable=True)

    started_at = Column(DateTime, nullable=True)
    finished_at = Column(DateTime, nullable=True)
    approved_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    cases = relationship("CalibrationCase", backref="run", cascade="all, delete-orphan",
                         lazy="dynamic")

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status,
            "dataset_version": self.dataset_version,
            "baseline_evaluator_version_id": self.baseline_evaluator_version_id,
            "candidate_evaluator_version_id": self.candidate_evaluator_version_id,
            "case_count": self.case_count,
            "metrics": self.metrics or {},
            "decision": self.decision,
            "decision_note": self.decision_note,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "approved_at": self.approved_at.isoformat() if self.approved_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class CalibrationCase(db.Model):
    """One benchmark submission in a calibration run."""

    __tablename__ = "calibration_cases"

    id = Column(Integer, primary_key=True)
    run_id = Column(Integer, ForeignKey("calibration_runs.id"), nullable=False, index=True)
    submission_type = Column(String(20), nullable=True)
    submission_id = Column(Integer, nullable=True)
    course_id = Column(Integer, nullable=True)

    expected_scores = Column(JSON, nullable=True)   # instructor-verified criterion scores
    baseline_scores = Column(JSON, nullable=True)
    candidate_scores = Column(JSON, nullable=True)
    baseline_error = Column(Float, nullable=True)
    candidate_error = Column(Float, nullable=True)
    verdict = Column(String(20), nullable=True)     # improved | regressed | equal
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)


class GradingAuditLog(db.Model):
    """Who changed what in the engine, with before/after snapshots."""

    __tablename__ = "grading_audit_logs"
    __table_args__ = (
        Index("ix_grading_audit_entity", "entity_type", "entity_id"),
        Index("ix_grading_audit_created", "created_at"),
    )

    id = Column(Integer, primary_key=True)
    actor_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    actor_role = Column(String(40), nullable=True)
    action = Column(String(80), nullable=False)
    entity_type = Column(String(60), nullable=False)
    entity_id = Column(Integer, nullable=True)
    before = Column(JSON, nullable=True)
    after = Column(JSON, nullable=True)
    reason = Column(Text, nullable=True)
    correlation_id = Column(String(36), nullable=True, index=True)
    ip_address = Column(String(60), nullable=True)
    created_at = Column(DateTime, default=now_local, nullable=False)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "actor_id": self.actor_id,
            "actor_role": self.actor_role,
            "action": self.action,
            "entity_type": self.entity_type,
            "entity_id": self.entity_id,
            "before": self.before,
            "after": self.after,
            "reason": self.reason,
            "correlation_id": self.correlation_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# Startup self-healing schema (mirrors the legacy auto-migration helper)
# ---------------------------------------------------------------------------

def reconcile_model_columns(bind=None, logger=None) -> None:
    """Add mapped model columns that an existing DB table is missing.

    Long-lived development/production databases are often grown incrementally
    by ``create_all()`` without a matching Alembic revision for every model
    column. A single missing mapped column makes every ORM query on that table
    fail with ``OperationalError: no such column``. This guarded, additive
    sweep closes that gap for every mapped table that already exists, adding
    nullable columns only. Tables that do not yet exist are left to
    ``create_all()``/Alembic. Idempotent: already-present columns are skipped.
    """
    import sqlalchemy as sa
    from sqlalchemy import inspect

    bind = bind or db.engine
    try:
        inspector = inspect(bind)
        existing_tables = set(inspector.get_table_names())
        to_add = []
        for table in db.metadata.sorted_tables:
            if table.name not in existing_tables:
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for column in table.columns:
                if column.name in existing:
                    continue
                # Raw ALTER TABLE cannot reproduce server defaults or
                # constraints, so add the column as nullable. The model still
                # enforces its own validation for all ORM writes.
                to_add.append((table.name, column))

        if not to_add:
            return
        statements = [
            sa.text(
                f"ALTER TABLE {table} ADD COLUMN {col.name} "
                f"{col.type.compile(bind.dialect)}"
            )
            for table, col in to_add
        ]
        if hasattr(bind, "execute") and hasattr(bind, "commit"):
            # A Connection stays in a failed transaction after one bad DDL
            # statement. Commit/roll back per statement so a single failure
            # cannot poison every later table on the same locked connection.
            for statement in statements:
                try:
                    bind.execute(statement)
                    bind.commit()
                except Exception:
                    bind.rollback()
                    raise
        else:
            with bind.begin() as conn:
                for statement in statements:
                    conn.execute(statement)
        if logger:
            logger.info("AAGE schema reconciliation added %s columns: %s",
                        len(statements), [(t, c.name) for t, c in to_add])
    except Exception as exc:  # pragma: no cover - defensive
        try:
            if hasattr(bind, "rollback"):
                bind.rollback()
        except Exception:
            pass
        if logger:
            logger.warning("AAGE schema reconciliation skipped: %s", exc)


def ensure_aage_schema(bind=None, logger=None) -> None:
    """Add missing additive columns of the extended legacy tables.

    ``bind`` may be an Engine or an already-open Connection. Passing the
    advisory-locked connection keeps the DDL in the same PostgreSQL session as
    the lock. ``db.create_all()`` creates missing tables; this helper adds
    missing columns to pre-existing tables (the extended legacy rubric tables
    plus AAGE tables that gained columns after their initial creation, such as
    ``evaluation_runs.cost``).

    Legacy databases were often created by an older ``Rubric`` model whose
    ``rubrics`` table used ``name`` / ``created_by`` / ``max_score`` /
    ``assignment_type``.  The current model (and therefore every ORM query)
    expects ``title`` / ``instructor_id`` / ``total_points`` / ``course_id`` /
    ``is_template``.  Those base columns are added here too and backfilled from
    their legacy equivalents; otherwise any ``Rubric.query`` fails at runtime
    with ``OperationalError: no such column: rubrics.title``.
    """
    import sqlalchemy as sa
    from sqlalchemy import inspect

    bind = bind or db.engine

    additions: Dict[str, List[sa.Column]] = {
        "rubrics": [
            # Base columns required by the current Rubric model. Old
            # create_all() databases may still use name/created_by/max_score.
            sa.Column("title", sa.String(200), nullable=True),
            sa.Column("instructor_id", sa.Integer(), nullable=True),
            sa.Column("course_id", sa.Integer(), nullable=True),
            sa.Column("is_template", sa.Boolean(), nullable=True),
            sa.Column("total_points", sa.Float(), nullable=True),
            # AAGE lifecycle / approval metadata.
            sa.Column("status", sa.String(30), nullable=True),
            sa.Column("version", sa.Integer(), nullable=True),
            sa.Column("discipline", sa.String(60), nullable=True),
            sa.Column("assessment_kind", sa.String(20), nullable=True),
            sa.Column("assessment_id", sa.Integer(), nullable=True),
            sa.Column("source", sa.String(20), nullable=True),
            sa.Column("generated_by_ai", sa.Boolean(), nullable=True),
            sa.Column("summary", sa.Text(), nullable=True),
            sa.Column("learning_objectives", sa.JSON(), nullable=True),
            sa.Column("deliverables", sa.JSON(), nullable=True),
            sa.Column("technologies", sa.JSON(), nullable=True),
            sa.Column("evaluation_methods", sa.JSON(), nullable=True),
            sa.Column("evaluator_recommendations", sa.JSON(), nullable=True),
            sa.Column("unverifiable_requirements", sa.JSON(), nullable=True),
            sa.Column("parent_rubric_id", sa.Integer(), nullable=True),
            sa.Column("profile_id", sa.Integer(), nullable=True),
            sa.Column("approved_by", sa.Integer(), nullable=True),
            sa.Column("approved_at", sa.DateTime(), nullable=True),
            sa.Column("criteria_weights_total", sa.Float(), nullable=True),
        ],
        "rubric_criteria": [
            sa.Column("weight", sa.Float(), nullable=True),
            sa.Column("is_required", sa.Boolean(), nullable=True),
            sa.Column("criterion_key", sa.String(80), nullable=True),
            sa.Column("evidence_requirements", sa.JSON(), nullable=True),
            sa.Column("evidence_category", sa.String(30), nullable=True),
            sa.Column("evaluator_hint", sa.String(120), nullable=True),
            sa.Column("evaluator_instructions", sa.Text(), nullable=True),
        ],
        # AAGE tables themselves can also drift when a column is added to the
        # model after the table was first created (e.g. the honest LLM-usage
        # `cost` payload).  Guarded, nullable additions are safe to repeat.
        "evaluation_runs": [
            sa.Column("cost", sa.JSON(), nullable=True),
        ],
    }

    # (target column, backfill SQL expression, source columns that must exist)
    # for legacy base columns renamed before AAGE shipped.
    backfills: Dict[str, List[tuple]] = {
        "rubrics": [
            ("title", "name", ("name",)),
            ("instructor_id", "created_by", ("created_by",)),
            ("total_points", "max_score", ("max_score",)),
            # Render booleans for the active dialect: PostgreSQL rejects the
            # integer literal 0/1 for a boolean column and leaves the whole
            # transaction aborted, which silently skipped every later table.
            ("is_template", False, ()),
            # Reverse direction for a DB created from the model where the
            # legacy NOT NULL columns were added back as nullable.
            ("name", "title", ("title",)),
            ("is_active", True, ()),
        ],
    }

    def _run(statements):
        if not statements:
            return
        if hasattr(bind, "execute") and hasattr(bind, "commit"):
            # Commit/roll back each statement so one bad backfill does not
            # abort the shared advisory-locked connection for later tables.
            for statement in statements:
                try:
                    bind.execute(statement)
                    bind.commit()
                except Exception:
                    bind.rollback()
                    raise
        else:
            with bind.begin() as conn:
                for statement in statements:
                    conn.execute(statement)

    inspector = inspect(bind)
    existing_tables = set(inspector.get_table_names())
    for table, columns in additions.items():
        if table not in existing_tables:
            continue
        try:
            existing = {c["name"] for c in inspector.get_columns(table)}
            missing = [c for c in columns if c.name not in existing]
            if missing:
                statements = [
                    sa.text(
                        f"ALTER TABLE {table} ADD COLUMN {col.name} "
                        f"{col.type.compile(bind.dialect)}"
                    )
                    for col in missing
                ]
                _run(statements)
                if logger:
                    logger.info("AAGE auto-migration added %s columns to %s",
                                [c.name for c in missing], table)

            # Backfill newly added (or still-null) base columns from their
            # legacy equivalents. Guarded so a source column that never
            # existed cannot turn the self-heal into a 500. Use the union of
            # pre-existing and just-added names because the Inspector may
            # cache its column list at this point.
            refreshed = existing | {c.name for c in missing}
            fills = []
            for target, expression, required in backfills.get(table, ()):
                if target not in refreshed:
                    continue
                if any(src not in refreshed for src in required):
                    continue
                where = f"{target} IS NULL"
                if required:
                    where += " AND " + " AND ".join(
                        f"{src} IS NOT NULL" for src in required
                    )
                rendered = expression
                if isinstance(expression, bool):
                    rendered = str(
                        (sa.true() if expression else sa.false()).compile(
                            dialect=bind.dialect
                        )
                    )
                fills.append(sa.text(
                    f"UPDATE {table} SET {target} = {rendered} WHERE {where}"
                ))
            if fills:
                _run(fills)
        except Exception as exc:  # pragma: no cover - defensive
            try:
                if hasattr(bind, "rollback"):
                    bind.rollback()
            except Exception:
                pass
            if logger:
                logger.warning("AAGE auto-migration skipped for %s: %s", table, exc)

    # Final sweep: catch any other mapped column a legacy table is missing.
    # Runs after the named repairs/backfills above so their backfill logic
    # stays authoritative for the rubric tables.
    reconcile_model_columns(bind, logger)
