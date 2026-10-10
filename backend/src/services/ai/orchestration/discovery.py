"""Autonomous task discovery & repair detection.

The engine is authoritative over task state, but *which* tasks need to exist is
discovered here: after a stage completes, these helpers walk the produced plan
and (a) materialize the module/lesson/quiz work tasks that weren't created at
start time, and (b) record automatic repair requests for any failed or broken
item so the repair agent is guaranteed to run after generation.

Never include secrets in any payload written here.
"""

from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from . import state as wf_state

logger = logging.getLogger(__name__)


def discover_content_tasks(plan: Dict[str, Any],
                           preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Return the full list of module/lesson/assessment task descriptors.

    Each descriptor is a dict the engine turns into a ``WorkflowTask``:
      {agent_type, task_type, title, input_data, parent_hint}
    parent_hint is a stable key ("module:<title>") that the engine maps to a
    parent WorkflowTask so the DAG can be wired after creation.
    """
    tasks: List[Dict[str, Any]] = []
    modules = plan.get("modules") or []
    for m_i, module in enumerate(modules[:wf_state.MAX_NUM_MODULES]):
        if not isinstance(module, dict) or not module.get("title"):
            continue
        module_title = str(module["title"])
        module_key = f"module:{module_title}"
        tasks.append({
            "agent_type": "module_agent",
            "task_type": "module_generation",
            "title": f"Generate module: {module_title}",
            "input_data": {"module": module, "module_index": m_i},
            "parent_hint": None,
            "key": module_key,
        })
        for lesson in (module.get("lessons") or []):
            if not isinstance(lesson, dict) or not lesson.get("title"):
                continue
            lesson_title = str(lesson["title"])
            lesson_key = f"lesson:{module_title}:{lesson_title}"
            tasks.append({
                "agent_type": "lesson_agent",
                "task_type": "lesson_generation",
                "title": f"Generate lesson: {lesson_title}",
                "input_data": {
                    "module": module, "lesson": lesson,
                    "module_index": m_i, "lesson_title": lesson_title,
                },
                "parent_hint": module_key,
                "key": lesson_key,
            })
            if preferences.get("assessment_style", "quiz") != "none":
                tasks.append({
                    "agent_type": "assessment_agent",
                    "task_type": "quiz_generation",
                    "title": f"Generate assessment: {lesson_title}",
                    "input_data": {
                        "module": module, "lesson": lesson,
                        "lesson_title": lesson_title,
                        "num_questions": int(preferences.get("num_questions", 5)),
                        "difficulty": str(preferences.get("content_depth", "standard")),
                    },
                    "parent_hint": lesson_key,
                    "key": f"{lesson_key}:quiz",
                })
    return tasks


def tasks_for_stage(stage: str, plan: Dict[str, Any],
                    preferences: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Which discovery-tasks belong to ``stage``.

    Modules/lessons/assessments are created at start (from plan). Validation,
    consistency and repair tasks are created dynamically by the engine.
    """
    if stage in ("modules", "lessons", "assessments"):
        all_tasks = discover_content_tasks(plan, preferences)
        wanted = {"modules": "module_agent", "lessons": "lesson_agent",
                  "assessments": "assessment_agent"}
        agent = wanted[stage]
        return [t for t in all_tasks if t["agent_type"] == agent]
    return []


def find_failed_parts(tasks: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Render repair descriptors for tasks with FAILED/NEEDS_REVIEW results."""
    repairs = []
    for task in tasks:
        result = task.get("result_status")
        if result in ("failed", "needs_review"):
            repairs.append({
                "task_id": task.get("id"),
                "target_type": task.get("target_type"),
                "target_id": task.get("target_id"),
                "error_message": task.get("error_message", ""),
                "error_code": task.get("error_code", ""),
            })
    return repairs


def consistency_issues(plan: Dict[str, Any], lesson_results: List[Dict[str, Any]],
                       quiz_results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    """Detect cross-component inconsistencies for the repair queue.

    Returns a list of {issue, component, detail} dicts — human and LLM-readable.
    """
    issues: List[Dict[str, Any]] = []

    # every module in the plan must have lessons actually generated
    plan_modules = {str(m.get("title")) for m in (plan.get("modules") or [])}
    generated_modules = {str(r.get("module_title")) for r in lesson_results
                         if r.get("module_title")}
    for title in plan_modules:
        if title and title not in generated_modules:
            issues.append({
                "issue": "module_no_lessons_generated",
                "component": "module",
                "detail": f"Module '{title}' has no generated lessons.",
            })

    # every lesson that claims a quiz should have a quiz result
    lesson_keys = {str(r.get("lesson_title")) for r in lesson_results
                   if r.get("lesson_title")}
    if quiz_results:
        quiz_keys = {str(r.get("lesson_title")) for r in quiz_results
                     if r.get("lesson_title")}
        for title in lesson_keys:
            if title and title not in quiz_keys:
                issues.append({
                    "issue": "missing_quiz",
                    "component": "lesson",
                    "detail": f"Lesson '{title}' has no generated quiz.",
                })

    return issues