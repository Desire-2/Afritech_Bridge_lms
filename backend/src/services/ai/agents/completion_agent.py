"""Completion agent — finalizes the workflow and produces the handoff summary."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from ....models.workflow_models import AgentResultStatus
from .base import AgentResult, BaseAgent

logger = logging.getLogger(__name__)


class CompletionAgent(BaseAgent):
    agent_type = "completion_agent"
    profile = "completion"
    title = "Completion Agent"

    def execute(self, workflow, task) -> AgentResult:
        workspace = workflow.get_workspace()
        stats = workspace.get("stats") or {}
        plan = workspace.get("plan") or {}
        pending_review = workflow.get_workspace().get("needs_review") or 0

        summary = {
            "course_title": plan.get("title", workflow.title),
            "course_id": workflow.course_id,
            "modules_generated": stats.get("modules", 0),
            "lessons_generated": stats.get("lessons", 0),
            "quizzes_generated": stats.get("quizzes", 0),
            "repairs_applied": stats.get("repairs", 0),
            "items_needing_human_review": pending_review,
            "next_steps": (
                "Review flagged items, then publish the course."
                if pending_review else "Ready to publish — review and publish the course."
            ),
        }
        return AgentResult.success(
            data={"summary": summary},
            message="Generation pipeline complete.",
            agent=self.agent_type,
        )