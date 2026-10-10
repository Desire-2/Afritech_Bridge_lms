"""Autonomous course-creation agents.

Each agent is stateless, reads its task input, calls the shared LLM client and
returns an :class:`AgentResult`. The workflow engine records state.
"""

from __future__ import annotations

import logging
from typing import Any, Dict

from .base import AgentResult, BaseAgent, AgentRegistry

logger = logging.getLogger(__name__)


def load_all():
    """Import every agent module and register its classes."""
    from . import (  # noqa: F401
        planning_agent,
        generation_agents,
        course_creation_agent,
        module_creation_agent,
        lesson_creation_agent,
        content_development_agent,
        quiz_creation_agent,
        assignment_creation_agent,
        project_creation_agent,
        quality_agents,
        repair_agent,
        persistence_agent,
        completion_agent,
    )

    AgentRegistry.register("planning_agent", planning_agent.PlanningAgent)
    AgentRegistry.register("curriculum_agent", planning_agent.CurriculumAgent)
    AgentRegistry.register("module_agent", generation_agents.ModuleAgent)
    AgentRegistry.register("lesson_agent", generation_agents.LessonAgent)
    AgentRegistry.register("assessment_agent", generation_agents.AssessmentAgent)
    # Public form contracts used by the existing instructor authoring UI.
    # Legacy pipeline agents remain registered for backwards compatibility.
    AgentRegistry.register("course_creation_agent", course_creation_agent.CourseCreationAgent)
    AgentRegistry.register("module_creation_agent", module_creation_agent.ModuleCreationAgent)
    AgentRegistry.register("lesson_creation_agent", lesson_creation_agent.LessonCreationAgent)
    AgentRegistry.register("content_development_agent", content_development_agent.ContentDevelopmentAgent)
    AgentRegistry.register("quiz_creation_agent", quiz_creation_agent.QuizCreationAgent)
    AgentRegistry.register("assignment_creation_agent", assignment_creation_agent.AssignmentCreationAgent)
    AgentRegistry.register("project_creation_agent", project_creation_agent.ProjectCreationAgent)
    AgentRegistry.register("reviewer_agent", quality_agents.ReviewerAgent)
    AgentRegistry.register("quality_agent", quality_agents.QualityAgent)
    AgentRegistry.register("consistency_agent", quality_agents.ConsistencyAgent)
    AgentRegistry.register("repair_agent", repair_agent.RepairAgent)
    AgentRegistry.register("persistence_agent", persistence_agent.PersistenceAgent)
    AgentRegistry.register("completion_agent", completion_agent.CompletionAgent)


def create_agent(agent_type: str, **kwargs: Any) -> BaseAgent:
    """Build a fresh, task-scoped agent instance."""
    load_all()
    agent_cls = AgentRegistry.get(agent_type)
    if agent_cls is None:
        raise ValueError(f"Unknown agent type: {agent_type}")
    return agent_cls(**kwargs)


def available_agents() -> list:
    load_all()
    return sorted(AgentRegistry.all().keys())


# Trigger registration once at import time so `from .agents import X` is enough.
load_all()
