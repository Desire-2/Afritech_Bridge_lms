"""AAGE specialist evaluators.

Importing this package registers every evaluator with the registry.  The
orchestrator only ever talks to :mod:`.registry`, so adding an evaluator means
adding a module here and one import line below — no orchestrator change.
"""

from __future__ import annotations

from . import (  # noqa: F401  (import = registration)
    backend,
    data_science,
    documents,
    frontend,
    spreadsheet,
)
from .base import (  # noqa: F401
    BaseEvaluator,
    CriterionEvaluation,
    EvaluationContext,
    EvaluatorOutput,
)
from .registry import (  # noqa: F401
    all_evaluators,
    evaluator_catalog,
    get_evaluator,
    register_evaluator,
    select_evaluators,
    unregister_evaluator,
)

__all__ = [
    "BaseEvaluator",
    "CriterionEvaluation",
    "EvaluationContext",
    "EvaluatorOutput",
    "all_evaluators",
    "evaluator_catalog",
    "get_evaluator",
    "register_evaluator",
    "select_evaluators",
    "unregister_evaluator",
]
