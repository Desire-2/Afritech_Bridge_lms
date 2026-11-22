"""Services A & B — Assessment Integration, Discovery and Classification.

``AssessmentIntelligence`` is the single entry point the rest of the engine (and
the HTTP layer) uses to talk about "an assessment".  It hides whether the
underlying row is an ``Assignment`` or a ``Project`` and exposes a stable
descriptor for classification, rubric generation and grading.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Tuple

from ...models.course_models import Assignment, Project, Course
from . import disciplines
from .disciplines import Classification, classify_assessment

logger = logging.getLogger("aage.assessment")

KIND_ASSIGNMENT = "assignment"
KIND_PROJECT = "project"
KINDS = (KIND_ASSIGNMENT, KIND_PROJECT)


class AssessmentNotFound(Exception):
    """No such assignment/project, or it is not visible to the caller."""


@dataclass
class AssessmentDescriptor:
    """Stable, storage-agnostic view of an assignment or project."""

    kind: str
    id: int
    title: str
    description: str = ""
    instructions: str = ""
    course_id: Optional[int] = None
    course_title: str = ""
    course_description: str = ""
    module_id: Optional[int] = None
    lesson_id: Optional[int] = None
    instructor_id: Optional[int] = None
    points_possible: float = 100.0
    passing_score: Optional[float] = None
    is_published: bool = False
    allowed_file_types: List[str] = field(default_factory=list)
    assignment_type: str = ""
    rubric_id: Optional[int] = None
    raw: Any = None

    @property
    def key(self) -> Tuple[str, int]:
        return (self.kind, self.id)

    @property
    def text_blob(self) -> str:
        return "\n\n".join(
            x for x in (self.title, self.description, self.instructions) if x
        )

    def prompt_view(self) -> Dict[str, Any]:
        """Assessment data as it is shown to the model (instructor-authored)."""
        return {
            "assessment_type": self.kind,
            "assessment_id": self.id,
            "title": self.title,
            "description": self.description or "",
            "instructions": self.instructions or "",
            "course_title": self.course_title,
            "max_points": self.points_possible,
            "passing_score": self.passing_score,
            "submission_formats": self.allowed_file_types or ["any"],
        }


def _parse_file_types(value: Any) -> List[str]:
    if not value:
        return []
    if isinstance(value, list):
        return [str(v).lower() for v in value]
    import json
    try:
        parsed = json.loads(value)
        if isinstance(parsed, list):
            return [str(v).lower() for v in parsed]
    except (TypeError, ValueError):
        pass
    return [s.strip().lower() for s in str(value).split(",") if s.strip()]


class AssessmentIntelligence:
    """Loads and classifies assessments (Services A + B)."""

    # -- loading ------------------------------------------------------------

    def load(self, kind: str, assessment_id: int) -> AssessmentDescriptor:
        if kind not in KINDS:
            raise AssessmentNotFound(f"unknown assessment kind: {kind}")
        model = Assignment if kind == KIND_ASSIGNMENT else Project
        row = model.query.get(assessment_id)
        if row is None:
            raise AssessmentNotFound(f"{kind} {assessment_id} not found")

        course = None
        if getattr(row, "course_id", None):
            course = Course.query.get(row.course_id)

        return AssessmentDescriptor(
            kind=kind,
            id=row.id,
            title=row.title or "",
            description=(row.description or ""),
            instructions=getattr(row, "instructions", "") or "",
            course_id=getattr(row, "course_id", None),
            course_title=(course.title if course else ""),
            course_description=(getattr(course, "description", "") or "") if course else "",
            module_id=getattr(row, "module_id", None),
            lesson_id=getattr(row, "lesson_id", None),
            instructor_id=getattr(row, "instructor_id", None),
            points_possible=float(getattr(row, "points_possible", None) or 100.0),
            passing_score=getattr(row, "passing_score", None),
            is_published=bool(getattr(row, "is_published", False)),
            allowed_file_types=_parse_file_types(getattr(row, "allowed_file_types", None)),
            assignment_type=getattr(row, "assignment_type", "") or "",
            rubric_id=getattr(row, "rubric_id", None),
            raw=row,
        )

    def can_access(self, descriptor: AssessmentDescriptor, user) -> bool:
        """Instructor owns the course, or the caller is an admin."""
        if user is None:
            return False
        role = getattr(getattr(user, "role", None), "name", "") or ""
        if str(role).lower() in ("admin", "superadmin"):
            return True
        if descriptor.instructor_id and descriptor.instructor_id == getattr(user, "id", None):
            return True
        if descriptor.course_id:
            course = Course.query.get(descriptor.course_id)
            if course and getattr(course, "instructor_id", None) == getattr(user, "id", None):
                return True
        return False

    # -- discovery / classification (Service B) -----------------------------

    def classify(
        self,
        descriptor: AssessmentDescriptor,
        file_names: Optional[List[str]] = None,
        file_contents: Optional[List[str]] = None,
    ) -> Classification:
        """Deterministic classification — no model call, always available."""
        return classify_assessment(
            title=descriptor.title,
            description=descriptor.description,
            instructions=descriptor.instructions,
            course_title=descriptor.course_title,
            course_description=descriptor.course_description,
            file_names=file_names or [],
            file_contents=file_contents or [],
        )

    def analyze(self, descriptor: AssessmentDescriptor,
                file_names: Optional[List[str]] = None,
                file_contents: Optional[List[str]] = None) -> Dict[str, Any]:
        """Full analysis payload: classification + detected deliverables."""
        classification = self.classify(descriptor, file_names, file_contents)
        payload = classification.to_dict()
        payload.update({
            "assessment": descriptor.prompt_view(),
            "has_rubric": bool(descriptor.rubric_id),
        })
        return payload


# module-level convenience singleton
assessment_intelligence = AssessmentIntelligence()
