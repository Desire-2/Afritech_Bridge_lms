"""Runtime policy knobs for AAGE.

Stored as a single JSON system setting so administrators can change grading
behaviour without a deploy.  Reads degrade to documented defaults when the
setting (or the settings table) is unavailable — the engine must never be
unusable because a config row is missing.

Writes are fail-closed: :func:`set_confidence_policy` raises
:class:`PolicyPersistenceError` when the setting could not be stored, so an API
caller can never report a policy change that was not persisted.
"""

from __future__ import annotations

import copy
import json
import logging
from typing import Any, Dict

from .constants import DEFAULT_CONFIDENCE_POLICY

logger = logging.getLogger("aage.policies")

CONFIDENCE_KEY = "aage_confidence_policy"
AUTO_PUBLISH_KEY = "aage_auto_publish_enabled"
REVIEW_KEY = "aage_require_instructor_review"

_FALLBACK = copy.deepcopy(DEFAULT_CONFIDENCE_POLICY)

#: policy keys an administrator is allowed to change through the API
WRITABLE_KEYS = (
    "auto_publish_min", "provisional_min", "auto_publish_enabled",
    "require_all_gates", "auto_approve_enabled", "auto_approve_min",
)


class PolicyPersistenceError(Exception):
    """A policy update could not be durably stored (never report success)."""

    def __init__(self, message: str = "confidence policy could not be saved"):
        super().__init__(message)
        self.message = message
        self.code = "policy_persistence_failed"
        self.status = 500


def _as_dict(value: Any) -> Dict[str, Any]:
    if isinstance(value, dict):
        return value
    if isinstance(value, str) and value.strip():
        try:
            parsed = json.loads(value)
            if isinstance(parsed, dict):
                return parsed
        except (TypeError, ValueError):
            logger.warning("AAGE policy setting is not valid JSON; using defaults")
    return {}


def confidence_policy() -> Dict[str, Any]:
    """Effective confidence policy."""
    policy = copy.deepcopy(_FALLBACK)
    try:
        from ...models.system_settings_models import SystemSettingsManager
        stored = _as_dict(SystemSettingsManager.get_setting(CONFIDENCE_KEY, {}))
        policy.update({k: v for k, v in stored.items() if k in policy})
        # independent top-level switches
        auto = SystemSettingsManager.get_setting(AUTO_PUBLISH_KEY, None)
        if auto is not None:
            policy["auto_publish_enabled"] = bool(auto) and str(auto).lower() in (
                "1", "true", "yes", "on")
    except Exception as exc:  # settings table may not exist yet
        logger.debug("AAGE confidence policy fallback: %s", exc)
    try:
        policy["auto_publish_min"] = float(policy.get("auto_publish_min") or 90.0)
        policy["provisional_min"] = float(policy.get("provisional_min") or 75.0)
        policy["auto_approve_min"] = float(policy.get("auto_approve_min") or 70.0)
    except (TypeError, ValueError):
        policy.update({"auto_publish_min": 90.0, "provisional_min": 75.0,
                       "auto_approve_min": 70.0})
    policy["auto_approve_enabled"] = bool(policy.get("auto_approve_enabled", True))
    return policy


def set_confidence_policy(updates: Dict[str, Any], user_id: Any = None,
                          reason: str = "") -> Dict[str, Any]:
    """Persist a partial policy update (admin only — enforced by the route).

    Atomic from the caller's point of view: either the JSON setting is stored
    or :class:`PolicyPersistenceError` is raised and no "success" is reported.
    The effective policy is re-read after the write, so the returned value is
    what the engine will actually use (including independent top-level
    switches).  A failed attempt is written to the audit log when available.
    """
    unknown = sorted(set(updates or {}) - set(WRITABLE_KEYS))
    if unknown:
        raise PolicyPersistenceError(
            f"unsupported policy field(s): {', '.join(unknown)}")

    policy = confidence_policy()
    for key in WRITABLE_KEYS:
        if key in (updates or {}):
            policy[key] = updates[key]

    payload = json.dumps(policy)
    try:
        from ...models.system_settings_models import SystemSettingsManager
        SystemSettingsManager.set_setting(
            CONFIDENCE_KEY,
            payload,
            user_id=user_id,
            change_reason=reason or "AAGE confidence policy update",
        )
        # Verify the durable value instead of trusting the write helper.
        stored = _as_dict(SystemSettingsManager.get_setting(CONFIDENCE_KEY, {}))
        if not stored:
            raise PolicyPersistenceError("policy setting was not persisted")
    except PolicyPersistenceError:
        raise
    except Exception as exc:
        logger.error("could not persist AAGE policy: %s", exc)
        _audit_failure(user_id=user_id, reason=reason, error=exc)
        raise PolicyPersistenceError(
            f"confidence policy could not be saved: {exc}") from exc

    effective = confidence_policy()
    if any(float(effective.get(key, -1)) != float(policy[key])
           if key in ("auto_publish_min", "provisional_min", "auto_approve_min")
           else bool(effective.get(key)) != bool(policy[key])
           for key in WRITABLE_KEYS if key in (updates or {})):
        _audit_failure(user_id=user_id, reason=reason,
                       error="stored policy differs from requested update")
        raise PolicyPersistenceError(
            "stored policy differs from the requested update")
    return effective


def _audit_failure(*, user_id: Any, reason: str, error: Any) -> None:
    """Best-effort audit of a rejected/failed policy change."""
    try:
        from .persistence import audit
        audit(action="policy_update_failed", entity_type="grading_policy",
              entity_id=None, after={"reason": reason or "policy write failed",
                                     "error": str(error)[:500]},
              actor_id=user_id, reason=reason or "policy persistence failure")
    except Exception as exc:  # pragma: no cover - audit must not mask the error
        logger.debug("policy failure audit unavailable: %s", exc)


def auto_publish_enabled() -> bool:
    return bool(confidence_policy().get("auto_publish_enabled"))
