"""Form-aware agent primitives used by the instructor authoring forms.

The existing authoring UI is the source of truth for field names and
validation.  These agents receive a small, serialisable description of that
form and return only a validated ``fields`` mapping.  They never persist
anything and never replace an instructor value unless the caller explicitly
asks them to.
"""

from __future__ import annotations

import json
import logging
from typing import Any, Dict, Iterable, List, Optional

from .base import AgentResult, BaseAgent
from .parsing import parse_json

logger = logging.getLogger(__name__)


def _text(value: Any, limit: int = 4000) -> str:
    return str(value or "").strip()[:limit]


def _compact(value: Any, depth: int = 0) -> Any:
    """Keep prompt context bounded without changing the form contract."""
    if depth > 3:
        return _text(value, 1000) if not isinstance(value, (dict, list)) else "[context omitted]"
    if isinstance(value, str):
        return value[:12000]
    if isinstance(value, list):
        return [_compact(item, depth + 1) for item in value[:30]]
    if isinstance(value, dict):
        return {str(key)[:100]: _compact(item, depth + 1) for key, item in list(value.items())[:40]}
    return value


def normalize_form_schema(schema: Any, defaults: Optional[Iterable[str]] = None) -> List[Dict[str, Any]]:
    """Normalise the frontend's field definition into a safe prompt shape."""
    if isinstance(schema, dict):
        schema = schema.get("fields") or schema.get("properties") or []
        if isinstance(schema, dict):
            schema = [dict(value, field=key) if isinstance(value, dict) else {"field": key, "type": value}
                      for key, value in schema.items()]
    if not isinstance(schema, list):
        schema = []
    result: List[Dict[str, Any]] = []
    for item in schema[:64]:
        if isinstance(item, str):
            item = {"field": item, "type": "string"}
        if not isinstance(item, dict):
            continue
        name = item.get("field") or item.get("name") or item.get("key")
        if not name or not isinstance(name, str):
            continue
        options = item.get("options") or item.get("enum") or []
        if not isinstance(options, list):
            options = []
        result.append({
            "field": name[:100],
            "label": _text(item.get("label") or name, 120),
            "type": _text(item.get("type") or "string", 40),
            "required": bool(item.get("required", False)),
            "options": [str(option)[:120] for option in options[:50]],
            "validation": item.get("validation") if isinstance(item.get("validation"), dict) else {},
        })
    if not result:
        result = [{"field": name, "label": name, "type": "string", "required": False, "options": [], "validation": {}}
                  for name in (defaults or [])]
    return result


def _is_blank(value: Any) -> bool:
    return value is None or value == "" or value == [] or value == {}


def _coerce(value: Any, spec: Dict[str, Any]) -> Any:
    """Coerce a model value to the type the existing form expects."""
    kind = str(spec.get("type") or "string").lower()
    if kind in {"number", "integer", "int", "float"}:
        if isinstance(value, bool):
            raise ValueError("boolean is not a number")
        number = float(value)
        return int(number) if kind in {"integer", "int"} or number.is_integer() else number
    if kind in {"boolean", "bool", "checkbox"}:
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.strip().lower() in {"true", "yes", "1", "on"}:
            return True
        if isinstance(value, str) and value.strip().lower() in {"false", "no", "0", "off"}:
            return False
        raise ValueError("expected a boolean")
    if kind in {"array", "list", "multiselect"}:
        if isinstance(value, str):
            try:
                value = json.loads(value)
            except (TypeError, ValueError):
                value = [line.strip(" -*•\t") for line in value.splitlines() if line.strip()]
        if not isinstance(value, list):
            raise ValueError("expected a list")
        return value[:100]
    if kind in {"object", "json"}:
        if isinstance(value, str):
            value = json.loads(value)
        if not isinstance(value, (dict, list)):
            raise ValueError("expected JSON data")
        return value
    return _text(value, 20000)


def validate_and_merge_fields(
    generated: Any,
    schema: List[Dict[str, Any]],
    current: Dict[str, Any],
    *,
    target_fields: Optional[Iterable[str]] = None,
    overwrite_existing: bool = False,
) -> Dict[str, Any]:
    """Validate model output and protect existing instructor edits."""
    if isinstance(generated, dict) and isinstance(generated.get("fields"), dict):
        generated = generated["fields"]
    if not isinstance(generated, dict):
        raise ValueError("model output must contain a fields object")

    definitions = {item["field"]: item for item in schema if item.get("field")}
    targets = {str(field) for field in target_fields or [] if field}
    fields: Dict[str, Any] = {}
    warnings: List[str] = []
    preserved: List[str] = []
    for name, value in generated.items():
        if name not in definitions:
            warnings.append(f"Ignored unsupported field: {name}")
            continue
        if targets and name not in targets:
            continue
        if not overwrite_existing and not targets and name in current and not _is_blank(current.get(name)):
            preserved.append(name)
            continue
        try:
            normalized = _coerce(value, definitions[name])
        except (TypeError, ValueError, json.JSONDecodeError) as exc:
            warnings.append(f"Ignored invalid value for {name}: {exc}")
            continue
        validation = definitions[name].get("validation") or {}
        max_length = validation.get("maxLength") or validation.get("max_length")
        if max_length and isinstance(normalized, str) and len(normalized) > int(max_length):
            warnings.append(f"Ignored {name}: exceeds the form's maximum length")
            continue
        min_length = validation.get("minLength") or validation.get("min_length")
        if min_length and isinstance(normalized, str) and len(normalized) < int(min_length):
            warnings.append(f"Ignored {name}: does not meet the form's minimum length")
            continue
        min_value = validation.get("min")
        max_value = validation.get("max")
        if min_value is not None and isinstance(normalized, (int, float)) and normalized < float(min_value):
            warnings.append(f"Ignored {name}: is below the form's minimum")
            continue
        if max_value is not None and isinstance(normalized, (int, float)) and normalized > float(max_value):
            warnings.append(f"Ignored {name}: exceeds the form's maximum")
            continue
        options = definitions[name].get("options") or []
        if options and normalized not in options:
            # Be forgiving about case, but never pass an invented enum value
            match = next((option for option in options if str(option).lower() == str(normalized).lower()), None)
            if match is None:
                warnings.append(f"Ignored {name}: value is not one of the form options")
                continue
            normalized = match
        if _is_blank(normalized):
            warnings.append(f"Ignored empty value for {name}")
            continue
        fields[name] = normalized

    missing = [item["field"] for item in schema
               if item.get("required") and _is_blank(fields.get(item["field"], current.get(item["field"])))]
    if missing:
        warnings.append("Required fields still need attention: " + ", ".join(missing))
    return {"fields": fields, "changed_fields": list(fields), "preserved_fields": preserved,
            "warnings": warnings, "missing_required_fields": missing}


class FormAwareAgent(BaseAgent):
    """Base class for the seven domain agents that operate existing forms."""

    domain = "LMS authoring"
    default_fields: tuple[str, ...] = ()
    instructions = "Generate useful, accurate values aligned with the supplied context."

    def generate_form(self, context: Dict[str, Any]) -> AgentResult:
        schema = normalize_form_schema(context.get("form_schema"), self.default_fields)
        raw_current = context.get("current_values") if isinstance(context.get("current_values"), dict) else {}
        schema_names = {item["field"] for item in schema}
        current = {name: _compact(value) for name, value in raw_current.items() if name in schema_names}
        target_fields = context.get("target_fields")
        overwrite_existing = bool(context.get("overwrite_existing", False))
        safe_context = {
            "entity_type": context.get("entity_type"),
            "instruction": _text(context.get("user_instruction"), 4000),
            "form_schema": schema,
            "current_values": current,
            "course_context": _compact(context.get("course_context") or {}),
            "module_context": _compact(context.get("module_context") or {}),
            "lesson_context": _compact(context.get("lesson_context") or {}),
            "related_context": _compact(context.get("related_context") or {}),
            "target_fields": list(target_fields or []),
        }
        system = f"""You are the {self.title} for the AfriTech Bridge LMS.
You operate the existing {self.domain} form. Do not invent fields, enum values,
relationships, or content formats. The supplied form_schema is authoritative.
Return ONLY JSON in this exact shape: {{\"fields\": {{...}}}}.
Only include fields that exist in form_schema. Use enum option values exactly.
The instructor's current values are protected unless overwrite_existing is true
or a target field was explicitly selected. Do not submit or persist anything.
{self.instructions}"""
        try:
            response = self.send_structured([
                {"role": "system", "content": system},
                {"role": "user", "content": json.dumps(safe_context, ensure_ascii=False)},
            ], profile=self.profile, max_tokens=8192)
            parsed = parse_json(response.content)
            merged = validate_and_merge_fields(
                parsed, schema, current, target_fields=target_fields,
                overwrite_existing=overwrite_existing,
            )
            if not merged["fields"]:
                return AgentResult.needs_review(
                    data=merged, message="No validated form fields were generated.",
                    reasoning=response.reasoning, agent=self.agent_type,
                )
            return AgentResult.success(
                data=merged, reasoning=response.reasoning,
                message=f"{self.title} generated {len(merged['fields'])} form field(s).",
                review={"passed": not bool(merged["missing_required_fields"]),
                        "score": 1.0 if not merged["warnings"] else 0.8,
                        "checks": {"schema": True, "protected_values": True}},
                agent=self.agent_type,
            )
        except Exception as exc:  # noqa: BLE001
            logger.warning("%s form generation failed: %s", self.agent_type, exc)
            return AgentResult.failed(
                "AI generation failed. Existing form values were preserved.",
                code="FORM_GENERATION_FAILED", agent=self.agent_type,
            )

    def execute(self, workflow, task) -> AgentResult:
        return self.generate_form(task.get_input() or {})
