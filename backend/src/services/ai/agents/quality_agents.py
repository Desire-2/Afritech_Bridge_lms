"""Quality & consistency agents — validation, review, cross-checks, repair requests."""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, List

from ....models.workflow_models import AgentResultStatus
from ..orchestration.recovery import validate_component, summary_of
from ..orchestration.discovery import consistency_issues, find_failed_parts
from .base import AgentResult, BaseAgent

logger = logging.getLogger(__name__)


class ReviewerAgent(BaseAgent):
    """LLM-based reviewer: reads generated components and grades them."""
    agent_type = "reviewer_agent"
    profile = "review"
    title = "Reviewer Agent"

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        components = task_input.get("components") or []

        review_summaries = []
        issues = []
        for comp in components:
            comp_review = validate_component(comp.get("component_type", "lesson"),
                                             comp.get("data") or {})
            review_summaries.append({"title": comp.get("title"),
                                     "component_type": comp.get("component_type"),
                                     **comp_review})
            if not comp_review["passed"]:
                issues.append({
                    "issue": "validation_failed",
                    "component": comp.get("component_type"),
                    "detail": summary_of(comp_review),
                })

        # Deterministic pass — LLM pass adds depth but never overrides.
        passed_all = all(r.get("passed") for r in review_summaries)
        repair_tasks = []
        if issues:
            # only request repairs if we haven't hit the cap yet
            for iss in issues:
                repair_tasks.append({
                    "agent_type": "repair_agent",
                    "task_type": "repair",
                    "title": f"Repair: {iss.get('component', 'component')} — {iss.get('detail', '')[:60]}",
                    "input_data": {
                        "issue": iss,
                        "component": components,
                    },
                })
        if passed_all:
            return AgentResult.success(
                data={"reviews": review_summaries},
                review={"passed": True, "score": 1.0,
                        "checks": {s["title"]: {"passed": True} for s in review_summaries}},
                agent=self.agent_type,
            )
        return AgentResult.needs_review(
            data={"reviews": review_summaries, "issues": issues},
            review={"passed": False, "score": 0.4,
                    "checks": {s["title"]: {"passed": s["passed"]} for s in review_summaries}},
            message=f"{len(repair_tasks)} component(s) need repair.",
            new_tasks=repair_tasks,
            agent=self.agent_type,
        )


class QualityAgent(BaseAgent):
    """Deterministic quality gate run on a single generated component."""
    agent_type = "quality_agent"
    profile = "validation"
    title = "Quality Agent"

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        component_type = task_input.get("component_type", "lesson")
        payload = task_input.get("data") or {}
        review = validate_component(component_type, payload)
        if review["passed"]:
            return AgentResult.success(
                data=payload, review=review,
                message=f"{component_type} passed quality gate.",
                agent=self.agent_type,
            )
        return AgentResult.needs_review(
            data=payload, review=review,
            message=f"{component_type} failed quality gate: {summary_of(review)}",
            new_tasks=[{
                "agent_type": "repair_agent",
                "task_type": "repair",
                "title": f"Repair {component_type} ({task.get_input().get('title', '')})",
                "input_data": {
                    "issue": {"issue": "quality_failed", "component": component_type,
                              "detail": summary_of(review)},
                    "component": [{"component_type": component_type, "data": payload,
                                   "title": task.get_input().get("title", "")}],
                },
            }],
            agent=self.agent_type,
        )


class ConsistencyAgent(BaseAgent):
    """Cross-component consistency scan; emits repair tasks for gaps."""
    agent_type = "consistency_agent"
    profile = "consistency"
    title = "Consistency Agent"

    def execute(self, workflow, task) -> AgentResult:
        task_input = task.get_input() or {}
        workspace = workflow.get_workspace()
        plan = workspace.get("plan") or task_input.get("plan") or {}
        lesson_results = task_input.get("lesson_results") or []
        quiz_results = task_input.get("quiz_results") or []

        issues = consistency_issues(plan, lesson_results, quiz_results)
        if not issues:
            return AgentResult.success(
                data={"issues": [], "consistent": True},
                message="All components consistent.",
                agent=self.agent_type,
            )
        repair_tasks = [{
            "agent_type": "repair_agent",
            "task_type": "repair",
            "title": f"Fix {iss['issue']}: {iss.get('detail', '')[:60]}",
            "input_data": {"issue": iss, "component": iss.get("component", {})},
        } for iss in issues]
        return AgentResult.needs_review(
            data={"issues": issues, "consistent": False},
            message=f"{len(issues)} consistency issue(s) found.",
            new_tasks=repair_tasks,
            agent=self.agent_type,
        )