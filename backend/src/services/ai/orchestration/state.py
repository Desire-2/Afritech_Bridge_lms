"""Workflow state constants and completion criteria (authoritative).

The workflow engine reads these to decide transitions; the LLM/agents never
mutate workflow/task state directly — they return results the engine records.
"""

from __future__ import annotations

from typing import Dict, List, Tuple

# ---- pipeline stage order --------------------------------------------------
STAGE_ORDER = [
    "planning",
    "curriculum",
    "modules",
    "lessons",
    "assessments",
    "validation",
    "consistency",
    "repair",
    "completion",
]

# Which stage a given agent type belongs to (drives progress reporting)
AGENT_STAGE = {
    "planning_agent": "planning",
    "curriculum_agent": "curriculum",
    "module_agent": "modules",
    "lesson_agent": "lessons",
    "assessment_agent": "assessments",
    "reviewer_agent": "validation",
    "quality_agent": "validation",
    "consistency_agent": "consistency",
    "repair_agent": "repair",
    "persistence_agent": "completion",
    "completion_agent": "completion",
}

# Number of work units per stage (used for coarse progress math)
STAGE_WEIGHTS = {
    "planning": 1,
    "curriculum": 2,
    "modules": 4,
    "lessons": 10,
    "assessments": 6,
    "validation": 4,
    "consistency": 1,
    "repair": 3,
    "completion": 1,
}

QUALITY_PASS_THRESHOLD = 0.65  # overall score for a component to be accepted
MAX_REPAIR_ATTEMPTS_PER_TASK = 3

# Default bounded generation sizes (surfaced to the UI; validated server-side)
DEFAULT_NUM_MODULES = 5
DEFAULT_MODULES_PER_LESSON = 3
DEFAULT_LESSONS_PER_MODULE = 3
MAX_NUM_MODULES = 12
MAX_LESSONS_PER_MODULE = 20
MAX_NUM_QUESTIONS = 30
MAX_ASSIGNMENTS = 10
MAX_PROJECTS = 10


def validate_generation_prefs(prefs: Dict) -> Dict:
    """Bound every user-supplied count parameter.

    Returns a sanitized copy. Never trust the client for size limits.
    """
    def _bounded(key: str, default: int, lo: int, hi: int) -> int:
        try:
            val = int(prefs.get(key, default))
        except (TypeError, ValueError):
            val = default
        if val < lo:
            val = lo
        if val > hi:
            val = hi
        return val

    return {
        "course_type": str(prefs.get("course_type", "project")),
        "num_modules": _bounded("num_modules", DEFAULT_NUM_MODULES, 1, MAX_NUM_MODULES),
        "lessons_per_module": _bounded("lessons_per_module", DEFAULT_LESSONS_PER_MODULE, 1, MAX_LESSONS_PER_MODULE),
        "num_questions": _bounded("num_questions", 5, 1, MAX_NUM_QUESTIONS),
        "content_depth": str(prefs.get("content_depth", "standard")),
        "assessment_style": str(prefs.get("assessment_style", "quiz")),
        "include_projects": bool(prefs.get("include_projects", True)),
        "target_audience": str(prefs.get("target_audience", "")),
        "learning_objectives": str(prefs.get("learning_objectives", "")),
        "estimated_duration": str(prefs.get("estimated_duration", "")),
    }


def stage_progress(completed_stages: Dict[str, int]) -> float:
    """Compute 0..100 progress from per-stage completed work-unit counts."""
    total_weight = sum(STAGE_WEIGHTS.values())
    done_weight = sum(min(STAGE_WEIGHTS.get(stage, 0), count)
                      for stage, count in completed_stages.items())
    return round(min(100.0, (done_weight / total_weight) * 100.0), 2)


def update_stage_progress(current: Dict[str, int], task: "object") -> int:
    """Increment the completed-work count for a task's stage. Returns new count."""
    stage = AGENT_STAGE.get(getattr(task, "agent_type", ""), "completion")
    current[stage] = current.get(stage, 0) + 1
    return current[stage]