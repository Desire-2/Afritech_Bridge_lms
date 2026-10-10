"""Course plan value object produced by planning/curriculum agents.

Normalized, schema-checked plan the rest of the pipeline consumes. The LLM's
raw JSON output is validated and coerced into this structure by the planning
agent — the engine never trusts raw model JSON directly.
"""

from __future__ import annotations

from typing import Any, Dict, List, Optional


class CoursePlan:
    """Validated course generation plan.

    - title / description / objectives / audience / estimated_duration
    - modules: [{title, description, objectives, lessons: [{title, description}]}]
    """

    def __init__(self, title: str, description: str, learning_objectives: str,
                 target_audience: str, estimated_duration: str,
                 skill_level: str = "intermediate",
                 modules: Optional[List[Dict[str, Any]]] = None):
        self.title = (title or "").strip()
        self.description = (description or "").strip()
        self.learning_objectives = (learning_objectives or "").strip()
        self.target_audience = (target_audience or "").strip()
        self.estimated_duration = (estimated_duration or "").strip()
        self.skill_level = (skill_level or "intermediate").strip()
        self.modules = modules or []

    # ------------------------------------------------------------------
    @property
    def module_titles(self) -> List[str]:
        return [str(m.get("title", "")).strip() for m in self.modules if m.get("title")]

    @property
    def lesson_count(self) -> int:
        return sum(len(self._module_lessons(m)) for m in self.modules)

    @staticmethod
    def _module_lessons(module: Dict[str, Any]) -> List[Dict[str, Any]]:
        return [l for l in (module.get("lessons") or []) if l and l.get("title")]

    # ------------------------------------------------------------------
    @classmethod
    def from_llm_json(cls, data: Dict[str, Any], *, max_modules: int = 12,
                      max_lessons_per_module: int = 20) -> "CoursePlan":
        """Build a bound, cleaned plan — malformed entries are dropped, counts
        clamped. Never trust raw LLM output for structure/size."""
        modules: List[Dict[str, Any]] = []
        raw_modules = data.get("modules") or data.get("module_outline") or []
        if isinstance(raw_modules, dict):
            raw_modules = raw_modules.get("modules", [])
        for i, m in enumerate(raw_modules[:max_modules]):
            if not isinstance(m, dict):
                continue
            title = str(m.get("title", f"Module {i + 1}")).strip()
            if not title:
                title = f"Module {i + 1}"
            lessons: List[Dict[str, Any]] = []
            raw_lessons = m.get("lessons") or []
            for j, lesson in enumerate(raw_lessons[:max_lessons_per_module]):
                if not isinstance(lesson, dict):
                    continue
                lesson_title = str(lesson.get("title", f"Lesson {j + 1}")).strip()
                lessons.append({
                    "title": lesson_title or f"Lesson {j + 1}",
                    "description": str(lesson.get("description", "")).strip(),
                })
            modules.append({
                "title": title,
                "description": str(m.get("description", "")).strip(),
                "objectives": str(m.get("objectives", m.get("learning_objectives", ""))).strip(),
                "lessons": lessons,
            })

        title = str(data.get("title", data.get("course_title", ""))).strip() or "Untitled Course"
        return cls(
            title=title,
            description=str(data.get("description", "")).strip(),
            learning_objectives=str(data.get("learning_objectives",
                                             data.get("objectives", ""))).strip(),
            target_audience=str(data.get("target_audience", "")).strip(),
            estimated_duration=str(data.get("estimated_duration", "")).strip(),
            skill_level=str(data.get("skill_level", "intermediate")).strip(),
            modules=modules,
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "title": self.title,
            "description": self.description,
            "learning_objectives": self.learning_objectives,
            "target_audience": self.target_audience,
            "estimated_duration": self.estimated_duration,
            "skill_level": self.skill_level,
            "modules": self.modules,
        }