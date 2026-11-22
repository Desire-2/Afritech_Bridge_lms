"""Adaptive AI Assessment & Grading Engine (AAGE).

Stable public surface for callers outside the engine.  Submodules are imported
lazily so importing ``src.services.aage`` never creates circular imports or
touches the database; ``from src.services.aage import review`` keeps working.

Nothing here silently scores, publishes or retrains: the determine/review/
publish boundaries are enforced by the individual services.
"""

from __future__ import annotations

import importlib
from typing import Any

#: Public service modules (all importable as ``src.services.aage.<name>``).
__all__ = [
    "analytics",
    "assessment_intelligence",
    "artifacts",
    "constants",
    "disciplines",
    "evaluators",
    "jobs",
    "learning",
    "llm",
    "orchestrator",
    "persistence",
    "policies",
    "review",
    "rubric_intelligence",
    "scoring",
    "submission_dispatch",
    "timeout",
    "validation",
]


def __getattr__(name: str) -> Any:
    if name in __all__:
        module = importlib.import_module(f"{__name__}.{name}")
        globals()[name] = module
        return module
    raise AttributeError(f"module {__name__!r} has no attribute {name!r}")


def __dir__():
    return sorted(set(globals()) | set(__all__))
