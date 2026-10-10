"""Content generation agents: module, lesson, assessment.

One task per agent run. Each returns a sanitized payload the persistence agent
later materializes (with versioning). Reasoning is returned separately and
never placed inside the content payloads.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict

from ..orchestration import state as wf_state
from ..sanitizer import sanitize_component
from ..orchestration.recovery import validate_component
from .base import AgentResult, BaseAgent
from .parsing import parse_json

logger = logging.getLogger(__name__)


class ModuleAgent(BaseAgent):
    agent_type = "module_agent"
    profile = "curriculum"
    title = "Module Agent"

    SYSTEM_PROMPT = """\
You are the MODULE AGENT in an autonomous course-creation system. You elaborate a \
single module of a course into a rich, ready-to-use module definition.

Input: the course plan JSON including the module and its lessons.
Output ONLY valid JSON:
{
  "title": string,
  "description": string (2-4 sentences, engaging overview),
  "learning_objectives": string (measurable objectives; "By the end learners will be able to ..."),
  "order": number,
  "is_published": false
}
There must be no text outside the JSON object."""

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        module = task_input.get("module") or {}
        workspace = workflow.get_workspace()
        plan = workspace.get("plan") or {}
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user",
             "content": json.dumps({
                 "course_title": plan.get("title"),
                 "course_description": plan.get("description"),
                 "module": module,
                 "course_objectives": plan.get("learning_objectives"),
             }, ensure_ascii=False)},
        ]
        try:
            resp = self.send_structured(messages, profile="curriculum", max_tokens=4096)
            payload = parse_json(resp.content)
            if not isinstance(payload, dict) or not payload.get("title"):
                raise ValueError("Module payload missing title")
            payload["title"] = str(module.get("title") or payload.get("title"))
            payload["is_published"] = False
            cleaned = sanitize_component("module", payload)
            review = validate_component("module", cleaned)
            status = "success" if review["passed"] else "needs_review"
            if review["passed"]:
                return AgentResult(
                    status=status, data=cleaned, review=review,
                    reasoning=resp.reasoning, agent=self.agent_type,
                )
            return AgentResult.needs_review(
                data=cleaned, review=review,
                message="Module content completed but failed quality checks.",
                reasoning=resp.reasoning, agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("module agent failed: %s", exc)
            return AgentResult.failed(
                "Module generation failed: the model produced no usable module.",
                code="MODULE_GEN_ERROR")


class LessonAgent(BaseAgent):
    agent_type = "lesson_agent"
    profile = "lesson_generation"
    title = "Lesson Agent"

    SYSTEM_PROMPT = """\
You are the LESSON AGENT in an autonomous course-creation system. You write \
complete, production-quality lesson content for one lesson.

Input: course context + module + lesson title/description + previous lesson titles.
Output ONLY valid JSON:
{
  "title": string,
  "description": string,
  "content_type": "text",
  "content_data": string,   // full lesson body in clean Markdown. Must be at least 300 words.
  "learning_objectives": string,
  "duration_minutes": number,
  "order": number,
  "is_published": false
}

Lesson quality requirements (REQUIRED):
- content_data must be substantial, structured Markdown with headings, subheadings, \
examples, exercises, and a summary.
- Embed practical examples relevant to the African tech/AfriTech context where apt.
- Be self-contained: does not depend on lessons not visible in input.
- Do NOT include meta-commentary (no "I generated this...", no "Note: this content...").
- Never include placeholder text such as [...], TODO, INSERT, TBD.
Only the JSON object, nothing else."""

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        lesson = task_input.get("lesson") or {}
        module = task_input.get("module") or {}
        workspace = workflow.get_workspace()
        plan = workspace.get("plan") or {}
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user",
             "content": json.dumps({
                 "course_title": plan.get("title"),
                 "module": module,
                 "lesson": lesson,
                 "module_lessons": [l.get("title") for l in (module.get("lessons") or [])],
                 "learning_objectives": task_input.get("learning_objectives", ""),
             }, ensure_ascii=False)},
        ]
        try:
            resp = self.send_structured(
                messages, profile="lesson_generation",
                max_tokens=config_max_lesson_tokens(),
            )
            payload = parse_json(resp.content)
            if not isinstance(payload, dict):
                raise ValueError("Lesson payload malformed")
            payload["title"] = str(lesson.get("title") or payload.get("title"))
            payload["is_published"] = False
            payload["module_title"] = module.get("title")
            cleaned = sanitize_component("lesson", payload)
            review = validate_component("lesson", cleaned)
            if review["passed"]:
                return AgentResult(
                    status="success", data=cleaned, review=review,
                    reasoning=resp.reasoning, agent=self.agent_type,
                )
            return AgentResult.needs_review(
                data=cleaned, review=review,
                message="Lesson completed but failed quality checks.",
                reasoning=resp.reasoning, agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("lesson agent failed: %s", exc)
            return AgentResult.failed(
                "Lesson generation failed: model returned no usable lesson.",
                code="LESSON_GEN_ERROR")


def config_max_lesson_tokens() -> int:
    from ..providers import config
    return config.NVIDIA_AI_MAX_TOKENS


class AssessmentAgent(BaseAgent):
    agent_type = "assessment_agent"
    profile = "assessment_generation"
    title = "Assessment Agent"

    SYSTEM_PROMPT = """\
You are the ASSESSMENT AGENT. Create a high-quality quiz for ONE lesson.

Input: lesson title, module context, and the lesson content_data.
Output ONLY valid JSON:
{
  "title": string,
  "description": string,
  "time_limit": number,       // minutes for whole quiz
  "passing_score": number,    // 0-100
  "max_attempts": number,
  "num_questions_requested": number,
  "questions": [
    {
      "question_text": string,
      "question_type": "multiple_choice",
      "points": number,
      "explanation": string,
      "options": [{"key": "A", "text": "...", "is_correct": bool}]
    }
  ]
}
Rules:
- Exactly match the requested question count when possible.
- Every multiple-choice question MUST have exactly 4 options with keys A-D and \
exactly ONE is_correct=true. correct_answer is not required externally: is_correct \
carries it, but ALSO include "correct_answer": "B" on each question.
- Do not repeat questions. Question wording must be clear and unambiguous.
- Explanations must be provided for every question.
Only the JSON object."""

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        lesson = task_input.get("lesson") or {}
        module = task_input.get("module") or {}
        num_questions = min(int(task_input.get("num_questions", 5) or 5),
                            wf_state.MAX_NUM_QUESTIONS)
        lesson_content = ""
        workspace_tasks = task.get_input().get("lesson_output") or {}
        lesson_content = str(lesson_content or task_input.get("lesson_content") or "")
        messages = [
            {"role": "system", "content": self.SYSTEM_PROMPT},
            {"role": "user",
             "content": json.dumps({
                 "lesson_title": task_input.get("lesson_title") or lesson.get("title"),
                 "module": module,
                 "lesson_description": lesson.get("description", ""),
                 "lesson_content": lesson_content[:15000],
                 "num_questions": num_questions,
             }, ensure_ascii=False)},
        ]
        try:
            resp = self.send_structured(
                messages, profile="assessment_generation", max_tokens=8192)
            payload = parse_json(resp.content)
            if not isinstance(payload, dict) or not payload.get("questions"):
                raise ValueError("quiz payload missing questions")
            payload["title"] = str(payload.get("title")
                                   or f"{lesson.get('title', 'Lesson')} Quiz")
            payload["lesson_title"] = str(lesson.get("title"))
            payload["module_title"] = module.get("title")
            payload["num_questions_requested"] = num_questions
            cleaned = sanitize_component("quiz", payload)
            review = validate_component("quiz", cleaned)
            if review["passed"]:
                return AgentResult(
                    status="success", data=cleaned, review=review,
                    reasoning=resp.reasoning, agent=self.agent_type,
                )
            return AgentResult.needs_review(
                data=cleaned, review=review,
                message="Quiz completed but failed quality checks.",
                reasoning=resp.reasoning, agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("assessment agent failed: %s", exc)
            return AgentResult.failed(
                "Assessment generation failed: model returned no usable quiz.",
                code="QUIZ_GEN_ERROR")