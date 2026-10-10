"""Planning & curriculum agents — turn the user's brief into a validated plan."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Optional

from ....models.workflow_models import AgentResultStatus
from ..orchestration.plan import CoursePlan
from ..sanitizer import clean_string
from .base import AgentResult, BaseAgent
from .parsing import parse_json

logger = logging.getLogger(__name__)


PLANNING_SYSTEM_PROMPT = """\
You are the PLANNING AGENT in an autonomous course-creation system for the \
AfriTech Bridge LMS. You produce a validated course outline that downstream \
generation agents consume.

Inputs you receive:
- topic / course brief
- target_audience
- learning_objectives
- desired number of modules and lessons_per_module

You MUST reply with ONLY valid JSON and exactly this schema:
{
  "title": string,
  "description": string,
  "learning_objectives": string,
  "target_audience": string,
  "estimated_duration": string,
  "skill_level": "beginner|intermediate|advanced",
  "modules": [
    {
      "title": string,
      "description": string,
      "objectives": string,
      "lessons": [
        {"title": string, "description": string}
      ]
    }
  ]
}

Rules:
- Module/lesson titles must be unique and descriptive.
- Do not invent more modules or lessons than requested; honor the requested \
counts but keep at least 1 module and 1 lesson per module.
- Cover objectives meaningfully across modules (progression: basics -> advanced).
- Skill level must be one of beginner/intermediate/advanced.
No markdown, no prose — only the JSON object.
"""


def _user_message_from_input(task_input: Dict[str, Any],
                             workflow_input: Dict[str, Any]) -> str:
    course_context = workflow_input.get("course_context") or {}
    topic = clean_string(task_input.get("topic") or workflow_input.get("topic")
                         or course_context.get("title"),
                         "Course topic", 500)
    audience = clean_string(task_input.get("target_audience")
                            or workflow_input.get("target_audience")
                            or course_context.get("target_audience"), "", 300)
    objectives = clean_string(
        task_input.get("learning_objectives")
        or workflow_input.get("learning_objectives")
        or course_context.get("learning_objectives"), "", 2000)
    description = clean_string(course_context.get("description"), "", 2000)
    duration = clean_string(course_context.get("estimated_duration"), "", 100)
    prefs = task_input.get("preferences") or {}
    num_modules = int(prefs.get("num_modules", 5))
    lessons_per_module = int(prefs.get("lessons_per_module", 3))
    return (
        f"Create a complete course plan.\n"
        f"Topic: {topic}\n"
        f"Target audience: {audience or 'adult learners'}\n"
        f"Learning objectives: {objectives or 'comprehensive practical skills'}\n"
        f"Existing course description to preserve or improve: {description or 'none'}\n"
        f"Requested duration: {duration or 'not specified'}\n"
        f"Modules: {num_modules}; Lessons per module: {lessons_per_module}.\n"
        f"Return the JSON plan."
    )


class PlanningAgent(BaseAgent):
    agent_type = "planning_agent"
    profile = "planning"
    title = "Planning Agent"

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input()
        wf_input = workflow.get_input()
        messages = [
            {"role": "system", "content": PLANNING_SYSTEM_PROMPT},
            {"role": "user", "content": _user_message_from_input(task_input, wf_input)},
        ]
        try:
            resp = self.send_structured(messages, profile="planning", max_tokens=8192)
            plan_dict = parse_json(resp.content)
            plan = CoursePlan.from_llm_json(plan_dict, max_modules=12)
            if not plan.modules:
                return AgentResult.failed(
                    "The plan had no modules: the model produced an outline with "
                    "no module data.", code="EMPTY_PLAN")
            # normalize into workflow workspace key
            return AgentResult.success(
                data={"plan": plan.to_dict()},
                reasoning=resp.reasoning,
                agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001 - malformed provider output
            logger.warning("planning agent failed: %s", exc)
            return AgentResult.failed(
                f"Planning failed: plan could not be produced.", code="PLAN_ERROR")


class CurriculumAgent(BaseAgent):
    agent_type = "curriculum_agent"
    profile = "curriculum"
    title = "Curriculum Agent"

    CURRICULUM_SYSTEM_PROMPT = """\
You are the CURRICULUM AGENT. Refine an existing course plan for pedagogic \
quality before generation. You receive the plan JSON.

Improve: module/lesson ordering (progressive difficulty), wording of objectives \
(must be measurable), and consistency between modules and course description.

Return ONLY the same JSON schema as the input plan (same keys). Preserve every \
module and lesson title from the input unless correction is essential."""

    def execute(self, workflow, task) -> AgentResult:
        workspace = workflow.get_workspace()
        plan = workspace.get("plan") or (task.get_input().get("plan"))
        if not plan:
            return AgentResult.needs_review(
                message="No plan to refine (planning stage did not produce one).",
            )
        messages = [
            {"role": "system", "content": self.CURRICULUM_SYSTEM_PROMPT},
            {"role": "user",
             "content": f"Refine this plan JSON:\n{json.dumps(plan, ensure_ascii=False)}"},
        ]
        try:
            resp = self.send_structured(messages, profile="curriculum", max_tokens=8192)
            refined = parse_json(resp.content)
            cleaned = CoursePlan.from_llm_json(refined).to_dict()
            if not cleaned.get("modules"):
                cleaned = plan
            return AgentResult.success(
                data={"plan": cleaned}, reasoning=resp.reasoning,
                agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("curriculum agent failed: %s", exc)
            return AgentResult.partial(
                data={"plan": plan}, message="Used the plan as-is (refinement failed).",
                agent=self.agent_type)
