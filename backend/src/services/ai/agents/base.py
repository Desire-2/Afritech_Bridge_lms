"""Agent base types: AgentResult + BaseAgent.

Agents NEVER mutate workflow/task rows. They read their task input, call the
provider, and return an :class:`AgentResult`. The workflow engine is the only
thing that records state transitions. This keeps the LLM out of the control
plane and the workflow authoritative.
"""

from __future__ import annotations

import logging
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from ..orchestration import state as wf_state

logger = logging.getLogger(__name__)


@dataclass
class AgentResult:
    """Result an agent returns to the engine."""

    status: str  # AgentResultStatus value: success/partial/failed/needs_review/waiting/retry
    data: Optional[Dict[str, Any]] = None
    reasoning: str = ""
    message: str = ""
    error_code: Optional[str] = None
    error_message: Optional[str] = None
    # Optional dynamically-discovered follow-up tasks (dicts in discovery format)
    new_tasks: List[Dict[str, Any]] = field(default_factory=list)
    # Optional quality-review dict ({passed, score, checks}) for validation agents
    review: Optional[Dict[str, Any]] = None
    agent: str = ""

    @classmethod
    def success(cls, data=None, **kw) -> "AgentResult":
        kw.setdefault("status", "success")
        return cls(data=data, **kw)

    @classmethod
    def partial(cls, data=None, **kw) -> "AgentResult":
        kw.setdefault("status", "partial")
        return cls(data=data, **kw)

    @classmethod
    def failed(cls, message="", code=None, **kw) -> "AgentResult":
        kw.setdefault("status", "failed")
        kw["message"] = message
        kw["error_code"] = code
        kw["error_message"] = message
        return cls(**kw)

    @classmethod
    def needs_review(cls, data=None, message="", **kw) -> "AgentResult":
        kw.setdefault("status", "needs_review")
        kw["message"] = message
        if data is not None:
            kw["data"] = data
        return cls(**kw)


class AgentRegistry:
    """Registry mapping agent_type -> agent class (lives here to avoid a
    circular import between the agents package and its modules)."""

    _registry: Dict[str, Type["BaseAgent"]] = {}

    @classmethod
    def register(cls, agent_type: str, agent_cls: "Type[BaseAgent]") -> None:
        cls._registry[agent_type] = agent_cls
        agent_cls.agent_type = getattr(agent_cls, "agent_type", agent_type)

    @classmethod
    def get(cls, agent_type: str) -> Optional["Type[BaseAgent]"]:
        return cls._registry.get(agent_type)

    @classmethod
    def all(cls) -> Dict[str, "Type[BaseAgent]"]:
        return dict(cls._registry)


class BaseAgent(ABC):
    """Common base for every pipeline agent."""

    agent_type: str = "base"
    profile: str = "planning"          # reasoning-budget/temperature profile
    title: str = "Agent"

    def __init__(self, llm_client=None):
        from .llm import LLMClient
        self.llm = llm_client if llm_client is not None else LLMClient()
        self.agent_type = self.__class__.agent_type

    @abstractmethod
    def execute(self, workflow, task) -> AgentResult:
        """Run the agent for ``task`` within ``workflow``'s pipeline."""

    def send(self, messages, *, profile=None, max_tokens=None, **kw) -> Any:
        """Convenience wrapper around the shared LLM call."""
        from ..providers import AIResponse
        resp: AIResponse = self.llm.generate(
            messages, profile=profile or self.profile,
            max_tokens=max_tokens, **kw,
        )
        return resp

    def send_structured(self, messages, *, profile=None, max_tokens=None, **kw) -> Any:
        from ..providers import AIResponse
        resp: AIResponse = self.llm.generate_structured(
            messages, profile=profile or self.profile,
            max_tokens=max_tokens, **kw,
        )
        return resp

    def record_run(self, workflow_id: str, task_id: str, provider: str, model: str,
                   response) -> None:
        """Persist an AgentRun audit row (best-effort)."""
        try:
            from ....models.workflow_models import AgentRun
            from ....models.user_models import db
            run = AgentRun(
                workflow_id=workflow_id, task_id=task_id,
                agent_type=self.agent_type,
                provider=provider, model=model,
                prompt_hash="",
                tokens_in=(response.usage or {}).get("prompt_tokens"),
                tokens_out=(response.usage or {}).get("completion_tokens"),
                latency_ms=response.latency_ms,
                status="success",
            )
            db.session.add(run)
            db.session.flush()
        except Exception as exc:  # pragma: no cover - non-fatal audit
            logger.debug("agent run audit failed: %s", exc)