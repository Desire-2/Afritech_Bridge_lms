"""Evaluator registry and selection.

The orchestrator only ever talks to this module — which is how a new evaluator
can be added without touching the orchestrator.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple

from .base import BaseEvaluator, EvaluationContext

logger = logging.getLogger("aage.registry")

_REGISTRY: Dict[str, BaseEvaluator] = {}

#: Durable administrator switch.  Kept separate from evaluator-version status
#: so disabling an evaluator does not rewrite its benchmark/rollback history.
DISABLED_SETTING_KEY = "aage_disabled_evaluators"


def _parse_disabled(raw: Any) -> List[str]:
    if raw is None:
        return []
    if isinstance(raw, str):
        text = raw.strip()
        if not text:
            return []
        try:
            parsed = json.loads(text)
        except (TypeError, ValueError):
            parsed = None
        if isinstance(parsed, list):
            raw = parsed
        else:
            raw = [part for part in text.split(",")]
    if isinstance(raw, dict):
        raw = [name for name, off in raw.items() if off]
    if not isinstance(raw, (list, tuple, set)):
        return []
    names: List[str] = []
    for item in raw:
        name = str(item or "").strip().lower()
        if name and name not in names:
            names.append(name)
    return names


def disabled_names() -> Dict[str, str]:
    """Evaluator names disabled by the durable admin setting.

    Version rows remain the audit trail for activation/rollback, but they no
    longer decide selection: only the explicit setting does.
    """
    try:
        from ....models.system_settings_models import SystemSettingsManager
        raw = SystemSettingsManager.get_setting(DISABLED_SETTING_KEY, [])
        return {name: "admin_disabled" for name in _parse_disabled(raw)}
    except Exception as exc:  # pragma: no cover - settings table missing
        logger.debug("evaluator disabled-setting lookup skipped: %s", exc)
        return {}


def set_evaluator_disabled(name: str, disabled: bool,
                           user_id: Optional[int] = None,
                           reason: str = "") -> List[str]:
    """Persist the admin switch and return the resulting disabled names."""
    name = str(name or "").strip().lower()
    if not name:
        raise RegistryError("evaluator name is required")
    names = [n for n in _parse_disabled(disabled_names()) if n != name]
    if disabled:
        names.append(name)
    try:
        from ....models.system_settings_models import (
            SystemSetting,
            SystemSettingsManager,
        )
        if user_id is None:
            # The settings manager writes an audit row that requires an actor;
            # callers without a request user (startup/tests) still need the
            # durable switch, so upsert the setting directly.
            payload = json.dumps(sorted(names))
            setting = SystemSetting.query.filter_by(
                key=DISABLED_SETTING_KEY).first()
            if setting is None:
                setting = SystemSetting(
                    key=DISABLED_SETTING_KEY, value=payload,
                    data_type="string", category="general")
                from ....models.user_models import db
                db.session.add(setting)
            else:
                setting.set_value(payload)
            from ....models.user_models import db
            db.session.commit()
            SystemSettingsManager._cache[DISABLED_SETTING_KEY] = payload
        else:
            SystemSettingsManager.set_setting(
                DISABLED_SETTING_KEY, json.dumps(sorted(names)),
                user_id=user_id,
                change_reason=reason or (
                    "AAGE evaluator disabled" if disabled
                    else "AAGE evaluator enabled"))
    except Exception as exc:
        from ....models.user_models import db
        db.session.rollback()
        logger.error("could not persist AAGE disabled evaluators: %s", exc)
    return sorted(names)


def is_disabled(name: str) -> bool:
    return str(name or "").strip().lower() in disabled_names()


class RegistryError(Exception):
    pass


def register_evaluator(evaluator: BaseEvaluator) -> BaseEvaluator:
    """Register (or replace) an evaluator under ``evaluator.name``."""
    name = getattr(evaluator, "name", "")
    if not name or name == "base":
        raise RegistryError("evaluator must define a unique non-base name")
    existing = _REGISTRY.get(name)
    if existing is not None and existing is not evaluator:
        logger.info("AAGE evaluator '%s' replaced (%s -> %s)", name,
                    getattr(existing, "version", "?"),
                    getattr(evaluator, "version", "?"))
    _REGISTRY[name] = evaluator
    return evaluator


def unregister_evaluator(name: str) -> None:
    _REGISTRY.pop(name, None)


def all_evaluators() -> List[BaseEvaluator]:
    return [ev for _, ev in sorted(_REGISTRY.items())]


def get_evaluator(name: str) -> Optional[BaseEvaluator]:
    return _REGISTRY.get(name)


def evaluator_catalog() -> List[Dict[str, object]]:
    """Serialised registry — used by the admin API."""
    rows = []
    for ev in all_evaluators():
        rows.append({
            "name": ev.name,
            "version": ev.version,
            "kind": ev.kind,
            "description": ev.description,
            "supported_disciplines": list(ev.supported_disciplines),
            "supported_extensions": list(ev.supported_extensions),
        })
    return rows


# ---------------------------------------------------------------------------
# Selection
# ---------------------------------------------------------------------------

def _recommended_names(rubric: Dict[str, Any]) -> List[str]:
    """Accept both ``["backend"]`` and ``[{"name": "backend"}]`` forms."""
    names: List[str] = []
    for item in rubric.get("evaluator_recommendations") or []:
        if isinstance(item, dict):
            name = item.get("name") or item.get("evaluator")
        else:
            name = item
        name = str(name or "").strip().lower()
        if name and name not in names:
            names.append(name)
    return names


def _hint_names(criteria: Sequence[Dict[str, Any]]) -> List[str]:
    names: List[str] = []
    for criterion in criteria:
        name = str(criterion.get("evaluator_hint") or "").strip().lower()
        if name and name not in names:
            names.append(name)
    return names


def select_evaluators(
    ctx: EvaluationContext,
    requested: Optional[Sequence[str]] = None,
    include_disabled: bool = False,
) -> Tuple[List[BaseEvaluator], List[Dict[str, str]]]:
    """Pick evaluators deterministically for this run.

    Order of preference:

    1. explicitly requested evaluators (when compatible and enabled),
    2. rubric-recommended evaluators that own at least one criterion,
    3. evaluators named by ``evaluator_hint``,
    4. any remaining compatible evaluator that actually reports a matching
       criterion from :meth:`BaseEvaluator.criteria_for`.

    An evaluator that would be skipped for ``no_matching_criteria`` is never
    selected while a compatible alternative exists.  Returns
    ``(selected, rejected)`` with a reason for every excluded candidate so the
    run record is auditable.
    """
    evaluators = all_evaluators()
    by_name = {ev.name.lower(): ev for ev in evaluators}
    recommended = _recommended_names(ctx.rubric)
    hints = _hint_names(ctx.criteria)
    disabled = {} if include_disabled else disabled_names()
    requested_order = []
    for name in requested or []:
        key = str(name or "").strip().lower()
        if key and key not in requested_order:
            requested_order.append(key)

    selected: List[BaseEvaluator] = []
    rejected: List[Dict[str, str]] = []
    eligible: Dict[str, BaseEvaluator] = {}

    def _consider(ev: BaseEvaluator) -> None:
        key = ev.name.lower()
        if key in eligible:
            return
        if key in disabled:
            rejected.append({"evaluator": ev.name,
                             "reason": f"disabled:{disabled[key]}"})
            return
        if not ev.is_compatible(ctx):
            rejected.append({"evaluator": ev.name, "reason": "incompatible"})
            return
        if not ev.criteria_for(ctx):
            rejected.append({"evaluator": ev.name,
                             "reason": "no_matching_criteria"})
            return
        eligible[key] = ev

    # Evaluate every candidate once so rejected/reason is complete.
    for ev in evaluators:
        _consider(ev)

    def _take(names: Iterable[str], *, source: str) -> None:
        for name in names:
            ev = eligible.get(name)
            if ev is None or ev in selected:
                continue
            selected.append(ev)
            logger.info("AAGE registry selected '%s' via %s", ev.name, source)

    _take(requested_order, source="request")
    _take(recommended, source="recommendation")
    _take(hints, source="criterion_hint")
    _take(list(eligible), source="compatible_fallback")

    logger.info("AAGE selected evaluators: %s (rejected: %s)",
                [e.name for e in selected], rejected)
    return selected, rejected
