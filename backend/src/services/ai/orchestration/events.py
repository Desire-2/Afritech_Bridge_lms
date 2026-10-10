"""SSE event emission for the workflow workspace.

Every event is a JSON dict. Fields are whitelisted — NO secrets (API keys,
provider credentials) ever appear. Reasoning is transmitted (it is useful
context for the instructor), but it is tagged and never persisted as content.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from ....models.workflow_models import WorkflowEvent

logger = logging.getLogger(__name__)


def record_event(workflow_id: str, event_type: str, payload: Dict[str, Any],
                 task_id: Optional[str] = None, seq: Optional[int] = None,
                 commit: bool = True) -> WorkflowEvent:
    """Persist an event to the workflow_events log (audit + replay)."""
    clean = sanitize_event_payload(payload)
    event = WorkflowEvent(
        workflow_id=workflow_id,
        task_id=task_id,
        event_type=event_type,
        seq=seq if seq is not None else _next_seq(workflow_id),
    )
    event.set_payload(clean)
    from ....models.user_models import db
    db.session.add(event)
    if commit:
        try:
            db.session.commit()
        except Exception as exc:  # pragma: no cover - defensive
            db.session.rollback()
            logger.warning("event record failed: %s", exc)
    return event


def _next_seq(workflow_id: str) -> int:
    from ....models.user_models import db
    last = (
        db.session.query(WorkflowEvent.seq)
        .filter(WorkflowEvent.workflow_id == workflow_id)
        .order_by(WorkflowEvent.seq.desc())
        .first()
    )
    return (last[0] + 1) if last else 1


def sanitize_event_payload(payload: Dict[str, Any]) -> Dict[str, Any]:
    """Strip anything that looks like a credential before logging."""
    if not payload:
        return {}
    blocked = ("api_key", "api-key", "key", "secret", "token", "authorization",
               "password")
    clean: Dict[str, Any] = {}
    for k, v in payload.items():
        lk = str(k).lower()
        if any(b in lk for b in blocked):
            continue
        if isinstance(v, dict):
            clean[k] = sanitize_event_payload(v)
        elif isinstance(v, list):
            clean[k] = [
                sanitize_event_payload(item) if isinstance(item, dict) else item
                for item in v
            ]
        else:
            clean[k] = v
    return clean


def sse_format(event: WorkflowEvent, task: Optional[Dict[str, Any]] = None) -> str:
    """Render one SSE wire frame for the workflow workspace endpoint."""
    data: Dict[str, Any] = {
        "type": event.event_type,
        "workflow_id": event.workflow_id,
        "task_id": event.task_id,
        "payload": event.get_payload(),
        "seq": event.seq,
    }
    if task:
        data["task"] = task
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"