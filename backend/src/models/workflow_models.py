"""Persistent workflow & task models for the autonomous course-creation system.

These tables replace the in-memory task manager with durable state so a
workflow survives process restarts, can be resumed, inspected, and re-run by
the workflow engine (which is authoritative — the LLM never mutates these rows
directly; agents only produce results that the engine records).

Conventions follow the existing codebase: `db` from ``src.models.user_models``,
timestamps via ``now_local()`` (naive, Kigali tz), JSON payloads stored as
text and round-tripped with the ``to_dict``/``from_dict`` helpers.
"""

from __future__ import annotations

import json
import uuid
from typing import Any, Dict, Optional

from sqlalchemy import Enum as SQLEnum
import enum

from ..utils.time_utils import now_local
from .user_models import db


def _new_id() -> str:
    return str(uuid.uuid4())


def _json_dumps(value: Any) -> Optional[str]:
    if value is None:
        return None
    try:
        return json.dumps(value, default=str)
    except (TypeError, ValueError):
        return json.dumps(str(value))


def _json_loads(value: Optional[str], default: Any = None) -> Any:
    if not value:
        return default
    try:
        return json.loads(value)
    except (json.JSONDecodeError, TypeError):
        return default


# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------
class WorkflowStatus(enum.Enum):
    PLANNING = "planning"
    GENERATING = "generating"
    REVIEWING = "reviewing"
    NEEDS_REVIEW = "needs_review"
    PAUSED = "paused"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    FAILED = "failed"


class WorkflowTaskStatus(enum.Enum):
    PENDING = "pending"
    READY = "ready"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    CANCELLED = "cancelled"
    SKIPPED = "skipped"


class AgentResultStatus(str, enum.Enum):
    SUCCESS = "success"
    PARTIAL = "partial"
    FAILED = "failed"
    NEEDS_REVIEW = "needs_review"
    WAITING = "waiting"
    RETRY = "retry"


def _enum_value(value) -> Optional[str]:
    if value is None:
        return None
    if isinstance(value, enum.Enum):
        return value.value
    return str(value)


# ---------------------------------------------------------------------------
# CourseWorkflow
# ---------------------------------------------------------------------------
class CourseWorkflow(db.Model):
    """Top-level autonomous generation workflow for one course attempt."""

    __tablename__ = "course_workflows"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    title = db.Column(db.String(500), nullable=True)

    # Full normalized input the user provided
    input_data = db.Column(db.Text, nullable=True)          # JSON

    status = db.Column(SQLEnum(WorkflowStatus), nullable=False,
                       default=WorkflowStatus.PLANNING)
    current_stage = db.Column(db.String(100), nullable=False, default="planning")
    progress = db.Column(db.Float, nullable=False, default=0.0)

    provider_chain = db.Column(db.Text, nullable=True)      # JSON list of providers
    preferences = db.Column(db.Text, nullable=True)         # JSON (num_* bounds, etc.)

    workspace = db.Column(db.Text, nullable=True)           # JSON — evolving context
    checkpoint = db.Column(db.Text, nullable=True)          # JSON — resume state
    resume_token = db.Column(db.String(100), nullable=True, index=True)

    version = db.Column(db.Integer, nullable=False, default=1)
    error_message = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local,
                           onupdate=now_local)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    cancelled_at = db.Column(db.DateTime, nullable=True)

    # Indexes for the scheduler's hot queries
    __table_args__ = (
        db.Index("ix_workflows_status", "status"),
        db.Index("ix_workflows_instructor", "instructor_id"),
        db.Index("ix_workflows_created", "created_at"),
    )

    def set_input(self, data: Dict[str, Any]) -> None:
        self.input_data = _json_dumps(data)

    def get_input(self) -> Dict[str, Any]:
        return _json_loads(self.input_data, {}) or {}

    def set_preferences(self, data: Dict[str, Any]) -> None:
        self.preferences = _json_dumps(data)

    def get_preferences(self) -> Dict[str, Any]:
        return _json_loads(self.preferences, {}) or {}

    def set_workspace(self, data: Dict[str, Any]) -> None:
        self.workspace = _json_dumps(data)

    def get_workspace(self) -> Dict[str, Any]:
        return _json_loads(self.workspace, {}) or {}

    def set_checkpoint(self, data: Dict[str, Any]) -> None:
        self.checkpoint = _json_dumps(data)

    def get_checkpoint(self) -> Dict[str, Any]:
        return _json_loads(self.checkpoint, {}) or {}

    def set_provider_chain(self, providers: list) -> None:
        self.provider_chain = _json_dumps(providers)

    def get_provider_chain(self) -> list:
        return _json_loads(self.provider_chain, []) or []

    def to_dict(self, include_private: bool = False) -> Dict[str, Any]:
        d: Dict[str, Any] = {
            "id": self.id,
            "course_id": self.course_id,
            "instructor_id": self.instructor_id,
            "title": self.title,
            "status": _enum_value(self.status),
            "current_stage": self.current_stage,
            "progress": round(self.progress or 0.0, 2),
            "provider_chain": self.get_provider_chain(),
            "version": self.version,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "resume_token": self.resume_token,
        }
        if include_private:
            d["input_data"] = self.get_input()
            d["preferences"] = self.get_preferences()
        return d


# ---------------------------------------------------------------------------
# WorkflowTask
# ---------------------------------------------------------------------------
class WorkflowTask(db.Model):
    """One unit of agent work inside a workflow (a DAG node)."""

    __tablename__ = "workflow_tasks"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    parent_task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                               nullable=True, index=True)
    agent_type = db.Column(db.String(100), nullable=False)
    task_type = db.Column(db.String(100), nullable=False, default="default")
    title = db.Column(db.String(500), nullable=True)

    status = db.Column(SQLEnum(WorkflowTaskStatus), nullable=False,
                       default=WorkflowTaskStatus.PENDING, index=True)
    result_status = db.Column(db.String(20), nullable=True)

    input_data = db.Column(db.Text, nullable=True)     # JSON
    output_data = db.Column(db.Text, nullable=True)    # JSON

    error_code = db.Column(db.String(100), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    # Reasoning captured from the model (stored separately, never course content)
    reasoning = db.Column(db.Text, nullable=True)

    attempts = db.Column(db.Integer, nullable=False, default=0)
    max_attempts = db.Column(db.Integer, nullable=False, default=3)
    run_order = db.Column(db.Integer, nullable=False, default=0)
    scheduled_for = db.Column(db.DateTime, nullable=True)  # future run delay

    # Scheduler concurrency guard (per-worker lease)
    locked_at = db.Column(db.DateTime, nullable=True)
    lock_owner = db.Column(db.String(100), nullable=True)
    lock_until = db.Column(db.DateTime, nullable=True)

    # Optional entity linkage for persistence agents
    target_type = db.Column(db.String(50), nullable=True)   # module/lesson/quiz
    target_id = db.Column(db.Integer, nullable=True)

    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local,
                           onupdate=now_local)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    __table_args__ = (
        db.Index("ix_workflow_tasks_workflow_status",
                 "workflow_id", "status"),
    )
    parent = db.relationship(
        "WorkflowTask", remote_side=[id], backref="children",
        foreign_keys=[parent_task_id],
    )

    def set_input(self, data: Dict[str, Any]) -> None:
        self.input_data = _json_dumps(data)

    def get_input(self) -> Dict[str, Any]:
        return _json_loads(self.input_data, {}) or {}

    def set_output(self, data: Dict[str, Any]) -> None:
        self.output_data = _json_dumps(data)

    def get_output(self) -> Dict[str, Any]:
        return _json_loads(self.output_data, {}) or {}

    def to_dict(self, include_secrets: bool = False) -> Dict[str, Any]:
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "parent_task_id": self.parent_task_id,
            "agent_type": self.agent_type,
            "task_type": self.task_type,
            "title": self.title,
            "status": _enum_value(self.status),
            "result_status": self.result_status,
            "attempts": self.attempts,
            "max_attempts": self.max_attempts,
            "run_order": self.run_order,
            "error_code": self.error_code,
            "error_message": self.error_message,
            "target_type": self.target_type,
            "target_id": self.target_id,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    def dependency_ids(self) -> list:
        deps = TaskDependency.query.filter_by(task_id=self.id).all()
        return [d.depends_on_task_id for d in deps]


# ---------------------------------------------------------------------------
# TaskDependency
# ---------------------------------------------------------------------------
class TaskDependency(db.Model):
    __tablename__ = "task_dependencies"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                        nullable=False, index=True)
    depends_on_task_id = db.Column(db.String(36),
                                   db.ForeignKey("workflow_tasks.id"),
                                   nullable=False, index=True)
    condition = db.Column(db.String(50), nullable=False, default="success")


# ---------------------------------------------------------------------------
# WorkflowEvent
# ---------------------------------------------------------------------------
class WorkflowEvent(db.Model):
    """Append-only event log per workflow (SSE replay / audit)."""

    __tablename__ = "workflow_events"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                        nullable=True, index=True)
    event_type = db.Column(db.String(100), nullable=False)
    payload = db.Column(db.Text, nullable=True)     # JSON
    seq = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)

    __table_args__ = (
        db.Index("ix_workflow_events_workflow_seq", "workflow_id", "seq"),
    )

    def set_payload(self, data: Dict[str, Any]) -> None:
        self.payload = _json_dumps(data)

    def get_payload(self) -> Dict[str, Any]:
        return _json_loads(self.payload, {}) or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "task_id": self.task_id,
            "event_type": self.event_type,
            "payload": self.get_payload(),
            "seq": self.seq,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# AgentRun
# ---------------------------------------------------------------------------
class AgentRun(db.Model):
    """Audit record of each actual LLM call made by an agent."""

    __tablename__ = "agent_runs"

    id = db.Column(db.String(36), primary_key=True, default=_new_id)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=True, index=True)
    task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                        nullable=True, index=True)
    agent_type = db.Column(db.String(100), nullable=True)
    provider = db.Column(db.String(50), nullable=True)
    model = db.Column(db.String(200), nullable=True)
    prompt_hash = db.Column(db.String(64), nullable=True, index=True)
    tokens_in = db.Column(db.Integer, nullable=True)
    tokens_out = db.Column(db.Integer, nullable=True)
    latency_ms = db.Column(db.Integer, nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    error_code = db.Column(db.String(100), nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    completed_at = db.Column(db.DateTime, nullable=True)


# ---------------------------------------------------------------------------
# QualityReview
# ---------------------------------------------------------------------------
class QualityReview(db.Model):
    """Structured validation result for a generated component."""

    __tablename__ = "quality_reviews"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                        nullable=True, index=True)
    component_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer, nullable=True)
    score = db.Column(db.Float, nullable=False, default=0.0)
    passed = db.Column(db.Boolean, nullable=False, default=False)
    checks = db.Column(db.Text, nullable=True)      # JSON {check: {passed, notes}}
    review_data = db.Column(db.Text, nullable=True)  # JSON detailed payload
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)

    def set_checks(self, checks: Dict[str, Any]) -> None:
        self.checks = _json_dumps(checks)

    def get_checks(self) -> Dict[str, Any]:
        return _json_loads(self.checks, {}) or {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "workflow_id": self.workflow_id,
            "task_id": self.task_id,
            "component_type": self.component_type,
            "target_id": self.target_id,
            "score": round(self.score or 0.0, 2),
            "passed": self.passed,
            "checks": self.get_checks(),
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


# ---------------------------------------------------------------------------
# RepairAttempt
# ---------------------------------------------------------------------------
class RepairAttempt(db.Model):
    """Track every autonomous repair of a failed/failing component."""

    __tablename__ = "repair_attempts"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    task_id = db.Column(db.String(36), db.ForeignKey("workflow_tasks.id"),
                        nullable=True, index=True)
    target_type = db.Column(db.String(50), nullable=True)
    target_id = db.Column(db.Integer, nullable=True)
    attempt_number = db.Column(db.Integer, nullable=False, default=1)
    issue_summary = db.Column(db.Text, nullable=True)
    repair_prompt_hash = db.Column(db.String(64), nullable=True)
    provider = db.Column(db.String(50), nullable=True)
    model = db.Column(db.String(200), nullable=True)
    new_output = db.Column(db.Text, nullable=True)  # JSON output after repair
    success = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)


# ---------------------------------------------------------------------------
# CourseGenerationVersion
# ---------------------------------------------------------------------------
class CourseGenerationVersion(db.Model):
    """Immutable version history so generation never clobbers instructor edits.

    Persistence agents write a NEW version row and only then (re)apply the
    payload to the target entity, preserving an audit trail and enabling
    rollback.
    """

    __tablename__ = "course_generation_versions"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=True,
                          index=True)
    component_type = db.Column(db.String(50), nullable=False)
    target_id = db.Column(db.Integer, nullable=False)
    version_number = db.Column(db.Integer, nullable=False, default=1)
    content_hash = db.Column(db.String(64), nullable=False, index=True)
    content = db.Column(db.Text, nullable=False)  # JSON payload snapshot
    created_by = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)

    __table_args__ = (
        db.Index("ix_gen_versions_component_target",
                 "component_type", "target_id", "version_number"),
    )

    def set_content(self, data: Dict[str, Any]) -> None:
        self.content = _json_dumps(data)


# ---------------------------------------------------------------------------
# AgentMemory
# ---------------------------------------------------------------------------
class AgentMemory(db.Model):
    """Compact key/value memory scoped to a workflow for agent chaining."""

    __tablename__ = "agent_memory"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    workflow_id = db.Column(db.String(36), db.ForeignKey("course_workflows.id"),
                            nullable=False, index=True)
    scope = db.Column(db.String(50), nullable=False, default="workflow")
    key = db.Column(db.String(200), nullable=False)
    value = db.Column(db.Text, nullable=True)  # JSON
    created_at = db.Column(db.DateTime, nullable=False, default=now_local)
    updated_at = db.Column(db.DateTime, nullable=False, default=now_local,
                           onupdate=now_local)

    __table_args__ = (
        db.UniqueConstraint("workflow_id", "scope", "key",
                            name="uq_agent_memory_scope_key"),
    )

    def get_value(self) -> Any:
        return _json_loads(self.value, None)

    @classmethod
    def get(cls, workflow_id: str, scope: str, key: str) -> Any:
        row = cls.query.filter_by(workflow_id=workflow_id, scope=scope,
                                  key=key).first()
        return row.get_value() if row else None

    @classmethod
    def set(cls, workflow_id: str, scope: str, key: str, value: Any) -> None:
        row = cls.query.filter_by(workflow_id=workflow_id, scope=scope,
                                  key=key).first()
        if row is None:
            row = cls(workflow_id=workflow_id, scope=scope, key=key)
            db.session.add(row)
        row.value = _json_dumps(value)
        db.session.flush()