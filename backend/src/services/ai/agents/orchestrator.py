"""Public parent orchestrator for autonomous course-generation workflows.

The DB-backed :mod:`workflow_engine` remains the state machine.  This small
facade gives callers a stable name and makes the delegation contract explicit.
It deliberately delegates to the existing workflow engine instead of creating
a second task system.
"""

from __future__ import annotations

from typing import Any, Dict, Optional

from ..orchestration.workflow_engine import workflow_engine


class CourseCreationOrchestrator:
    """Start, resume, pause/cancel and monitor the persistent workflow."""

    def start(self, workflow, *, input_data: Dict[str, Any], preferences: Dict[str, Any],
              user_id: int, provider: Optional[str] = None):
        return workflow_engine.start_workflow(
            workflow, input_data=input_data, preferences=preferences,
            user_id=user_id, provider=provider,
        )

    def run(self, workflow, max_passes: int = 200):
        return workflow_engine.run_once(workflow, max_passes=max_passes)

    def resume(self, workflow):
        return workflow_engine.resume_workflow(workflow)

    def cancel(self, workflow):
        return workflow_engine.cancel_workflow(workflow)

    def assist_form(self, agent_type: str, context: Dict[str, Any], user_id: int):
        """Delegate one in-form request to its domain agent.

        This path is intentionally preview-only. The existing form remains the
        write boundary; the persistent workflow methods above are used when an
        instructor explicitly starts autonomous generation.
        """
        from . import create_agent
        from .llm import LLMClient

        agent = create_agent(agent_type, llm_client=LLMClient(user_id=user_id))
        return agent, agent.generate_form(context)


course_creation_orchestrator = CourseCreationOrchestrator()
