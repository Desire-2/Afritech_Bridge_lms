"""Repair agent — re-generates a component given the failure summary + prior content."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from ..sanitizer import sanitize_component
from ..orchestration.recovery import validate_component
from .base import AgentResult, BaseAgent
from .parsing import parse_json

logger = logging.getLogger(__name__)


class RepairAgent(BaseAgent):
    agent_type = "repair_agent"
    profile = "repair"
    title = "Repair Agent"

    SYSTEM_PROMPT = """\
You are the REPAIR AGENT. A component of a course failed validation or review. \
Regenerate ONLY the broken component.

Input:
- component_type ("module"|"lesson"|"quiz")
- issue summary (what was wrong)
- the previous (flawed) content, if any
- related context / sibling components

Output ONLY valid JSON matching the same schema as the original component type:
  module:  {"title", "description", "learning_objectives", "order", "is_published": false}
  lesson:  {"title", "description", "content_type": "text", "content_data",
            "learning_objectives", "duration_minutes", "order", "is_published": false}
  quiz:    {"title", "description", "time_limit", "passing_score", "questions": [
             {"question_text", "question_type": "multiple_choice", "points",
              "explanation", "correct_answer", "options": [{"key","text","is_correct"}]}]}
Rules:
- Address every issue from the issue summary concretely.
- Do not degrade other parts that were fine.
- No placeholder text. No meta-commentary. Only the JSON object."""

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        issue = task_input.get("issue") or {}
        component = (task_input.get("component") or [{}])[0]
        component_type = component.get("component_type", "lesson")
        prior = component.get("data") or {}
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user",
             "content": json.dumps({
                 "component_type": component_type,
                 "issue": issue,
                 "previous_content": prior,
                 "sibling_context": task_input.get("sibling_context") or {},
             }, ensure_ascii=False)},
        ]
        try:
            resp = self.send_structured(messages, profile="repair", max_tokens=8192)
            payload = parse_json(resp.content)
            if not isinstance(payload, dict) or not payload:
                raise ValueError("repair returned empty content")
            # preserve targeting metadata from the broken component
            for meta in ("module_title", "lesson_title", "course_title", "title"):
                if meta not in payload:
                    payload[meta] = prior.get(meta)
            payload["is_published"] = False
            cleaned = sanitize_component(component_type, payload)
            review = validate_component(component_type, cleaned)
            if review["passed"]:
                return AgentResult(
                    status="success", data=cleaned, review=review,
                    message="Repair succeeded.",
                    reasoning=resp.reasoning, agent=self.agent_type,
                )
            return AgentResult(
                status="needs_review", data=cleaned, review=review,
                message="Repair produced content still below threshold.",
                reasoning=resp.reasoning, agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("repair agent failed: %s", exc)
            return AgentResult.failed(
                "Repair failed: model returned no usable content.",
                code="REPAIR_ERROR")