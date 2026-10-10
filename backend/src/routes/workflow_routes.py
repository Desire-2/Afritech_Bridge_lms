"""Workflow API routes — autonomous multi-agent course creation.

Exposes the DB-backed workflow engine through a small REST + SSE surface:

  POST   /api/v1/ai/workflows                 start a workflow (background by default)
  GET    /api/v1/ai/workflows                 list the caller's workflows
  GET    /api/v1/ai/workflows/<id>            workflow status
  POST   /api/v1/ai/workflows/<id>/resume     resume paused/failed/interrupted work
  POST   /api/v1/ai/workflows/<id>/cancel     cancel a workflow
  GET    /api/v1/ai/workflows/<id>/events     SSE event stream (since=<seq>)
  GET    /api/v1/ai/workflows/<id>/tasks      task list for a workflow
  GET    /api/v1/ai/workflows/<id>/tasks/<task_id>
  GET    /api/v1/ai/workflows/<id>/result     final summary + course pointer

Auth: instructor/admin only. All workflows are scoped to their owner;
admins may read any workflow. No secrets are ever returned.
"""

from __future__ import annotations

import logging
import threading
import time
from typing import Optional

from flask import Blueprint, Response, jsonify, request
from flask_jwt_extended import get_jwt_identity, jwt_required
from functools import wraps

from ..models.user_models import db, User
from ..models.workflow_models import (
    CourseWorkflow,
    WorkflowTask,
    WorkflowEvent,
    WorkflowStatus,
)
from ..services.ai.orchestration import state as wf_state
from ..services.ai.orchestration.events import sse_format
from ..services.ai.orchestration.workflow_engine import workflow_engine
from ..utils.api_errors import api_error, require_json

logger = logging.getLogger(__name__)

workflow_bp = Blueprint("workflow_bp", __name__, url_prefix="/api/v1/ai/workflows")


def _current_user() -> Optional[User]:
    try:
        return User.query.get(int(get_jwt_identity()))
    except (TypeError, ValueError):
        return None


def workflow_access_required(f):
    """Instructor/admin only; locks access to the user's own workflows."""

    @wraps(f)
    @jwt_required()
    def decorated(*args, **kwargs):
        user = _current_user()
        if user is None:
            return api_error("Authentication required.", code="AUTH_REQUIRED", status=401)
        if not user.role or user.role.name not in ("instructor", "admin"):
            return api_error("Instructor or admin access required.",
                             code="FORBIDDEN", status=403)
        return f(*args, **kwargs)

    return decorated


def _get_owned_workflow(workflow_id: str, user: User,
                        allow_admin_all: bool = True) -> Optional[CourseWorkflow]:
    wf = CourseWorkflow.query.filter_by(id=workflow_id).first()
    if wf is None:
        return None
    if user.role.name == "admin" and allow_admin_all:
        return wf
    if wf.instructor_id == user.id:
        return wf
    return None


def _workflow_summary(wf: CourseWorkflow,
                      include_private: bool = False) -> dict:
    d = wf.to_dict(include_private=include_private)
    d["progress"] = round(wf.progress or 0.0, 2)
    d["error_message"] = wf.error_message or ""
    return d


def _task_summary(t: WorkflowTask) -> dict:
    out = {
        "id": t.id,
        "workflow_id": t.workflow_id,
        "parent_task_id": t.parent_task_id,
        "agent_type": t.agent_type,
        "task_type": t.task_type,
        "title": t.title,
        "status": t.status.value,
        "result_status": t.result_status,
        "attempts": t.attempts,
        "error_code": t.error_code,
        "error_message": t.error_message or "",
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "completed_at": t.completed_at.isoformat() if t.completed_at else None,
    }
    out["input_data"] = (t.get_input() or {})
    return out


def _task_detail(t: WorkflowTask) -> dict:
    """Task detail includes generated output so the UI can inspect & repair."""
    out = _task_summary(t)
    output_data = t.get_output() or {}
    data = output_data.get("data") or {}
    out["output_data"] = data
    if output_data.get("review") and isinstance(output_data["review"], dict):
        out["review"] = output_data["review"]
    return out


# ---------------------------------------------------------------------------
# Workflow lifecycle
# ---------------------------------------------------------------------------

@workflow_bp.route("", methods=["POST"])
@workflow_access_required
def start_workflow():
    user = _current_user()
    payload, err = require_json(request)
    if err:
        return err

    topic = str(payload.get("topic") or "").strip()
    if not topic:
        return api_error("topic is required", code="VALIDATION", status=400)

    prefs = wf_state.validate_generation_prefs(payload.get("preferences") or {})
    sync = bool(payload.get("sync", False))
    raw_course_context = payload.get("course_context") or {}
    if not isinstance(raw_course_context, dict):
        raw_course_context = {}
    course_context = {
        key: str(raw_course_context.get(key) or "")[:limit]
        for key, limit in {
            "title": 255,
            "description": 2000,
            "learning_objectives": 1000,
            "target_audience": 255,
            "estimated_duration": 100,
        }.items()
    }

    workflow = CourseWorkflow(
        instructor_id=user.id,
        title=topic[:500],
        current_stage="planning",
        status=WorkflowStatus.PLANNING,
    )
    db.session.add(workflow)
    db.session.flush()
    try:
        workflow_engine.start_workflow(
            workflow,
            input_data={
                "topic": topic,
                "course_id": payload.get("course_id"),
                "course_context": course_context,
            },
            preferences=prefs,
            user_id=user.id,
            provider=prefs.get("provider"),
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("workflow start failed")
        db.session.rollback()
        return api_error(f"Failed to start workflow: {exc}",
                         code="WORKFLOW_START", status=500)

    if sync:
        try:
            workflow_engine.run_once(workflow)
        except Exception:  # noqa: BLE001
            logger.exception("synchronous workflow run failed")
        db.session.refresh(workflow)
        return jsonify({"success": True, "workflow": _workflow_summary(workflow),
                        "background": False}), 201

    _spawn_runner(workflow.id, user)
    return jsonify({"success": True, "workflow": _workflow_summary(workflow),
                    "background": True}), 202


@workflow_bp.route("", methods=["GET"])
@workflow_access_required
def list_workflows():
    user = _current_user()
    try:
        limit = min(max(int(request.args.get("limit", 10)), 1), 50)
        offset = max(int(request.args.get("offset", 0)), 0)
    except (TypeError, ValueError):
        limit, offset = 10, 0

    q = CourseWorkflow.query
    if user.role.name != "admin":
        q = q.filter_by(instructor_id=user.id)
    total = q.count()
    items = (q.order_by(CourseWorkflow.created_at.desc())
             .limit(limit).offset(offset).all())
    return jsonify({"success": True, "data": [_workflow_summary(w) for w in items],
                    "total": total}), 200


@workflow_bp.route("/<workflow_id>", methods=["GET"])
@workflow_access_required
def get_workflow(workflow_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)
    return jsonify({"success": True,
                    "workflow": _workflow_summary(wf, include_private=True)}), 200


@workflow_bp.route("/<workflow_id>/resume", methods=["POST"])
@workflow_access_required
def resume_workflow(workflow_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)
    if wf.status in (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED):
        return api_error("Workflow is already finished", code="ALREADY_TERMINAL", status=409)

    _spawn_runner(wf.id, user)
    return jsonify({"success": True,
                    "workflow": _workflow_summary(wf),
                    "message": "Workflow resumed"}), 202


@workflow_bp.route("/<workflow_id>/cancel", methods=["POST"])
@workflow_access_required
def cancel_workflow(workflow_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)
    try:
        workflow_engine.cancel_workflow(wf)
    except Exception as exc:  # noqa: BLE001
        logger.exception("workflow cancel failed")
        db.session.rollback()
        return api_error(f"Failed to cancel workflow: {exc}",
                         code="WORKFLOW_CANCEL", status=500)
    return jsonify({"success": True,
                    "workflow": _workflow_summary(wf)}), 200


# ---------------------------------------------------------------------------
# Tasks
# ---------------------------------------------------------------------------

@workflow_bp.route("/<workflow_id>/tasks", methods=["GET"])
@workflow_access_required
def list_tasks(workflow_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)
    tasks = (WorkflowTask.query
             .filter_by(workflow_id=wf.id)
             .order_by(WorkflowTask.run_order.asc(),
                       WorkflowTask.created_at.asc())
             .all())
    return jsonify({"success": True,
                    "data": [_task_summary(t) for t in tasks],
                    "count": len(tasks)}), 200


@workflow_bp.route("/<workflow_id>/tasks/<task_id>", methods=["GET"])
@workflow_access_required
def get_task(workflow_id: str, task_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)
    task = WorkflowTask.query.filter_by(workflow_id=wf.id, id=task_id).first()
    if task is None:
        return api_error("Task not found", code="NOT_FOUND", status=404)
    return jsonify({"success": True, "task": _task_detail(task)}), 200


# ---------------------------------------------------------------------------
# Result summary
# ---------------------------------------------------------------------------

@workflow_bp.route("/<workflow_id>/result", methods=["GET"])
@workflow_access_required
def workflow_result(workflow_id: str):
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)

    workspace = wf.get_workspace() or {}
    completion = (WorkflowTask.query
                  .filter_by(workflow_id=wf.id, agent_type="completion_agent")
                  .first())
    summary = {}
    if completion is not None and completion.get_output():
        summary = (completion.get_output() or {}).get("data", {}).get("summary", {})

    return jsonify({
        "success": True,
        "workflow": _workflow_summary(wf),
        "summary": summary,
        "stats": workspace.get("stats") or {},
        "needs_review": workspace.get("needs_review") or 0,
        "course_id": wf.course_id,
    }), 200


# ---------------------------------------------------------------------------
# SSE events
# ---------------------------------------------------------------------------

@workflow_bp.route("/<workflow_id>/events", methods=["GET"])
@workflow_access_required
def workflow_events(workflow_id: str):
    """SSE stream (or plain JSON when Accept is not text/event-stream).

    ?since=<seq> resumes from a specific event sequence number.
    """
    user = _current_user()
    wf = _get_owned_workflow(workflow_id, user)
    if wf is None:
        return api_error("Workflow not found", code="NOT_FOUND", status=404)

    try:
        since = max(int(request.args.get("since", 0)), 0)
    except (TypeError, ValueError):
        since = 0

    if request.accept_mimetypes.best != "text/event-stream":
        events = (WorkflowEvent.query
                  .filter(WorkflowEvent.workflow_id == wf.id,
                          WorkflowEvent.seq > since)
                  .order_by(WorkflowEvent.seq.asc())
                  .all())
        return jsonify({
            "success": True,
            "data": [{
                "type": ev.event_type,
                "workflow_id": ev.workflow_id,
                "task_id": ev.task_id,
                "payload": ev.get_payload(),
                "seq": ev.seq,
                "timestamp": ev.created_at.isoformat() if ev.created_at else None,
            } for ev in events],
        }), 200

    terminal = (WorkflowStatus.COMPLETED, WorkflowStatus.CANCELLED,
                WorkflowStatus.FAILED)

    def generate():
        last_seq = since
        waited = 0
        max_wait = 900  # 15 minutes
        while waited < max_wait:
            events = (WorkflowEvent.query
                      .filter(WorkflowEvent.workflow_id == wf.id,
                              WorkflowEvent.seq > last_seq)
                      .order_by(WorkflowEvent.seq.asc())
                      .limit(50)
                      .all())
            for ev in events:
                yield sse_format(ev)
                last_seq = max(last_seq, ev.seq or 0)
            db.session.expire_all()
            current = CourseWorkflow.query.get(wf.id)
            if current is not None and current.status in terminal:
                db.session.expire_all()
                tail = (WorkflowEvent.query
                        .filter(WorkflowEvent.workflow_id == wf.id,
                                WorkflowEvent.seq > last_seq)
                        .order_by(WorkflowEvent.seq.asc()).all())
                for ev in tail:
                    yield sse_format(ev)
                    last_seq = max(last_seq, ev.seq or 0)
                yield 'event: done\ndata: {"final": true}\n\n'
                break
            if not events:
                waited += 1
            time.sleep(1)
        yield 'event: timeout\ndata: {"final": false}\n\n'

    return Response(generate(), mimetype="text/event-stream",
                    headers={
                        "Cache-Control": "no-cache",
                        "Connection": "keep-alive",
                        "X-Accel-Buffering": "no",
                    })


# ---------------------------------------------------------------------------
# Background runner
# ---------------------------------------------------------------------------

def _spawn_runner(workflow_id: str, user: User) -> None:
    """Run the engine in a daemon thread so the request returns immediately."""
    from flask import current_app

    app = current_app._get_current_object()

    def run():
        with app.app_context():
            wf = CourseWorkflow.query.get(workflow_id)
            if wf is None:
                return
            workflow_engine.resume_workflow(wf)
            db.session.commit()

    t = threading.Thread(target=run, name=f"wf-runner-{workflow_id[:8]}",
                         daemon=True)
    t.start()
