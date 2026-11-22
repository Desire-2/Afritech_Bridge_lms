"""Dependency-free declarative validation for AAGE.

The engine never trusts raw model output.  Every AI response, rubric payload
and evaluation structure is declared as a :class:`Schema` and passed through
:func:`validate` before any business logic reads it.

Design goals
------------
* no third-party dependency (the project pins ``marshmallow`` but AAGE keeps
  its own tiny validator so schema rules can be asserted in unit tests without
  booting Flask),
* forgiving about *shape* (unknown keys are dropped, not fatal) but strict
  about *content* (wrong type / out-of-range / missing required ⇒ error),
* errors are structured ``{"path": ..., "code": ..., "message": ...}`` so they
  can be returned verbatim through the API error envelope.
"""

from __future__ import annotations

import math
from typing import Any, Dict, Iterable, List, Optional, Sequence, Tuple


class SchemaError(Exception):
    """Raised when a payload fails schema validation."""

    def __init__(self, errors: List[Dict[str, str]]):
        self.errors = errors
        super().__init__("; ".join(f"{e['path']}: {e['message']}" for e in errors))


_TYPE_CHECKS = {
    "str": lambda v: isinstance(v, str),
    "int": lambda v: isinstance(v, int) and not isinstance(v, bool),
    "float": lambda v: isinstance(v, (int, float)) and not isinstance(v, bool),
    "bool": lambda v: isinstance(v, bool),
    "list": lambda v: isinstance(v, list),
    "dict": lambda v: isinstance(v, dict),
    "any": lambda v: True,
}


class Field:
    """A single declarative field rule."""

    __slots__ = (
        "type", "required", "default", "nullable", "min", "max",
        "min_length", "max_length", "items", "choices", "strip", "coerce",
    )

    def __init__(
        self,
        type: str = "any",
        *,
        required: bool = False,
        default: Any = None,
        nullable: bool = False,
        min: Optional[float] = None,
        max: Optional[float] = None,
        min_length: Optional[int] = None,
        max_length: Optional[int] = None,
        items: Optional["Field"] = None,
        choices: Optional[Sequence[Any]] = None,
        strip: bool = True,
        coerce: bool = False,
    ):
        if type not in _TYPE_CHECKS:
            raise ValueError(f"unknown field type: {type}")
        self.type = type
        self.required = required
        self.default = default
        self.nullable = nullable
        self.min = min
        self.max = max
        self.min_length = min_length
        self.max_length = max_length
        self.items = items
        self.choices = list(choices) if choices is not None else None
        self.strip = strip
        self.coerce = coerce


Schema = Dict[str, Field]


def _default(rule: Field) -> Any:
    """Resolve a field default.

    Schemas declare container defaults as ``default=list`` / ``default=dict``
    (the factory, not an instance) so that two validated payloads never share
    a mutable value. Callable defaults must therefore be *called*; storing the
    class itself previously produced a ``<class 'list'>`` value that later
    crashed ``EvidenceValidator.validate`` with ``TypeError``.
    """
    return rule.default() if callable(rule.default) else rule.default


def validate(payload: Any, schema: Schema, *, path: str = "$") -> Dict[str, Any]:
    """Validate ``payload`` against ``schema``.

    Returns a *new* dict containing only the declared keys.  Raises
    :class:`SchemaError` listing every problem found.
    """
    errors: List[Dict[str, str]] = []
    out: Dict[str, Any] = {}

    if not isinstance(payload, dict):
        raise SchemaError([{"path": path, "code": "type", "message": "expected an object"}])

    for key, rule in schema.items():
        node = f"{path}.{key}"
        if key not in payload:
            if rule.required:
                errors.append({"path": node, "code": "required", "message": "field is required"})
            else:
                out[key] = _default(rule)
            continue

        value = payload[key]
        if value is None:
            if rule.nullable:
                out[key] = None
                continue
            if rule.required:
                errors.append({"path": node, "code": "required", "message": "field cannot be null"})
            else:
                out[key] = _default(rule)
            continue

        coerced, err = _coerce_value(value, rule, node)
        if err:
            errors.append(err)
            continue
        out[key] = coerced

    if errors:
        raise SchemaError(errors)
    return out


def _coerce_value(value: Any, rule: Field, node: str) -> Tuple[Any, Optional[Dict[str, str]]]:
    if value is None:
        if rule.nullable:
            return None, None
        return None, {"path": node, "code": "type", "message": "value cannot be null"}

    # ---- numeric coercion -------------------------------------------------
    if rule.type in ("int", "float") and rule.coerce and isinstance(value, str):
        try:
            value = float(value) if rule.type == "float" else int(float(value))
        except (TypeError, ValueError):
            return None, {"path": node, "code": "type", "message": f"expected {rule.type}"}

    check = _TYPE_CHECKS[rule.type]
    if not check(value):
        return None, {"path": node, "code": "type", "message": f"expected {rule.type}, got {type(value).__name__}"}

    if rule.type == "str" and rule.strip:
        value = value.strip()

    if rule.type in ("int", "float"):
        # NaN defeats every min/max comparison (``nan < x`` and ``nan > x``
        # are both False), and infinities silently pass as "valid" numbers.
        # Reject all non-finite values before any range logic runs.
        if not math.isfinite(value):
            return None, {"path": node, "code": "finite", "message": "must be a finite number"}
        if rule.min is not None and value < rule.min:
            return None, {"path": node, "code": "range", "message": f"must be >= {rule.min}"}
        if rule.max is not None and value > rule.max:
            return None, {"path": node, "code": "range", "message": f"must be <= {rule.max}"}

    if rule.type in ("str", "list", "dict"):
        size = len(value)
        if rule.min_length is not None and size < rule.min_length:
            return None, {"path": node, "code": "length", "message": f"must have at least {rule.min_length} item(s)"}
        if rule.max_length is not None and size > rule.max_length:
            return None, {"path": node, "code": "length", "message": f"must have at most {rule.max_length} item(s)"}

    if rule.choices is not None and value not in rule.choices:
        return None, {"path": node, "code": "choice", "message": f"must be one of {rule.choices}"}

    if rule.type == "list" and rule.items is not None:
        cleaned: List[Any] = []
        for idx, item in enumerate(value):
            item_path = f"{node}[{idx}]"
            item_rule = rule.items
            if item_rule.type == "dict" and item_rule.items is not None:
                try:
                    cleaned.append(validate(item, item_rule.items, path=item_path))
                except SchemaError as exc:
                    return None, exc.errors[0]
            elif item_rule.type == "list" and item_rule.items is not None:
                sub, err = _coerce_value(item, Field("list", items=item_rule.items, min_length=item_rule.min_length,
                                                     max_length=item_rule.max_length), item_path)
                if err:
                    return None, err
                cleaned.append(sub)
            else:
                sub, err = _coerce_value(item, item_rule, item_path)
                if err:
                    return None, err
                cleaned.append(sub)
        value = cleaned

    if rule.type == "dict" and rule.items is not None:
        try:
            value = validate(value, rule.items, path=node)
        except SchemaError as exc:
            return None, exc.errors[0]

    return value, None


def try_validate(payload: Any, schema: Schema) -> Tuple[Optional[Dict[str, Any]], List[Dict[str, str]]]:
    """Non-throwing variant: ``(clean_data, errors)``."""
    try:
        return validate(payload, schema), []
    except SchemaError as exc:
        return None, exc.errors


def has_errors(errors: Iterable[Dict[str, str]]) -> bool:
    return any(True for _ in errors)
