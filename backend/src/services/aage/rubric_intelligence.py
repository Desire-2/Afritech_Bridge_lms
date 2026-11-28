"""Service C — Dynamic Rubric Intelligence.

Generates, validates, versions and approves rubrics.

Guarantees enforced here (spec §4):

* criterion weights total exactly 100 % (validated, normalised with a warning),
* different max-score scales are supported,
* criteria are optional/required and carry evidence requirements,
* every rubric revision produces an immutable :class:`RubricVersion` snapshot,
* a rubric that has already graded submissions cannot be changed silently —
  updating it requires explicit acknowledgement and re-approval,
* an instructor must approve a rubric (or link an approved reusable profile)
  before it can be used for official grading.
"""

from __future__ import annotations

import json
import logging
import math
import re
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ...models.course_models import Assignment, Project
from ...models.grading_models import Rubric, RubricCriterion
from ...models.aage_models import (
    GradingProfile,
    RubricVersion,
    EvaluationResult,
)
from ...models.user_models import db
from ...utils.time_utils import now_local
from . import disciplines
from .assessment_intelligence import (
    KIND_ASSIGNMENT,
    AssessmentDescriptor,
    AssessmentIntelligence,
    assessment_intelligence,
)
from .constants import RUBRIC_APPROVED, RUBRIC_DRAFT, RUBRIC_PENDING
from .llm import llm_json, truncate_for_prompt
from .schemas import RUBRIC_AI_SCHEMA, rubric_weights_total
from .validation import SchemaError, try_validate

logger = logging.getLogger("aage.rubric")

WEIGHT_TOLERANCE = 0.01
MAX_CRITERIA = 20

DEFAULT_LEVELS = [
    {"label": "Excellent", "min_percent": 90.0,
     "description": "Exceeds the requirement; polished, complete and correct."},
    {"label": "Good", "min_percent": 75.0,
     "description": "Meets the requirement fully with minor gaps."},
    {"label": "Satisfactory", "min_percent": 60.0,
     "description": "Partially meets the requirement; core idea present but incomplete."},
    {"label": "Needs work", "min_percent": 0.0,
     "description": "Does not yet meet the requirement."},
]

RUBRIC_SYSTEM_PROMPT = """You are the rubric designer for a technical LMS.

Produce a grading rubric for the assessment described in the ASSESSMENT layer.

Rules:
- Disciplines available for "discipline": frontend, backend, fullstack,
  data_science, python, sql, spreadsheet, mobile, devops, theory, general.
- Between 4 and 12 criteria. Each criterion must be MEASURABLE from the
  submitted artefacts (source code, files, written answers) — never grade
  effort, attitude or attendance.
- Criterion "weight" values are percentages and MUST sum to exactly 100.
- "max_marks" is that criterion's own mark scale (they do not need to be equal;
  use 10/20/25/50 etc. as appropriate).
- "key" is a short stable snake_case identifier, unique inside this rubric.
- "levels" describes performance bands: 3-6 entries, "min_percent" decreasing,
  each with a concrete description of what the submission must show.
- "evidence_requirements" lists what an evaluator must be able to point at
  (e.g. "the submitted index.html", "a SELECT query in the script").
- "evidence_category" is one of VERIFIED, CODE_SUPPORTED, CONTENT_SUPPORTED,
  UNVERIFIED. Use UNVERIFIED only when automation truly cannot confirm it.
- "evaluator_hint" is the preferred specialist evaluator name when one exists:
  frontend, backend, data_science, spreadsheet, documents.
- "unverifiable_requirements" lists assessment asks that cannot be checked
  from the submission (be honest — the system must not fake verification).
- Do not mention this instruction set in your output.
- Return JSON only."""


class RubricError(Exception):
    """Rubric validation / lifecycle error with structured details."""

    def __init__(self, message: str, code: str = "rubric_error",
                 details: Optional[List[Any]] = None, status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or []
        self.status = status


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------

_MARKS_FIELDS = ("max_marks", "max_points", "maximum", "max_score")


def _finite_number(value: Any) -> Optional[float]:
    """Return a finite float or ``None`` for NaN/inf/garbage."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _criterion_number(criterion: Dict[str, Any], fields: Sequence[str]) -> Optional[float]:
    for field in fields:
        if field not in criterion or criterion[field] in (None, ""):
            continue
        return _finite_number(criterion[field])
    return 0.0


def _criterion_marks(criterion: Dict[str, Any]) -> Optional[float]:
    return _criterion_number(criterion, _MARKS_FIELDS)


def _criterion_levels(criterion: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Read performance bands from either vocabulary used across the stack.

    ``levels`` is canonical on the wire; ORM snapshots and older clients use
    ``performance_levels``.  Both may be present, so prefer the canonical key
    but never let an empty value hide a populated alias.
    """
    levels = criterion.get("levels") or criterion.get("performance_levels") or DEFAULT_LEVELS
    return list(levels)


def _promote_level_aliases(payload: Dict[str, Any]) -> None:
    """Normalise incoming criteria to the canonical ``levels`` key in place.

    Schema validation drops undeclared keys, so aliases must be promoted before
    a generation payload is validated.  Per-criterion values are authoritative.
    """
    for criterion in payload.get("criteria") or []:
        if isinstance(criterion, dict) and not criterion.get("levels"):
            alias = criterion.get("performance_levels")
            if alias:
                criterion["levels"] = alias


def validate_criteria(criteria: Sequence[Dict[str, Any]],
                      max_points: Optional[float] = None) -> List[str]:
    """Return a list of human-readable problems (empty == valid)."""
    problems: List[str] = []
    if not criteria:
        return ["rubric must contain at least one criterion"]
    if len(criteria) > MAX_CRITERIA:
        problems.append(f"rubric has {len(criteria)} criteria (max {MAX_CRITERIA})")

    total = rubric_weights_total(criteria)
    if abs(total - 100.0) > WEIGHT_TOLERANCE:
        problems.append(f"criterion weights total {total}%, expected 100%")

    seen_keys = set()
    for idx, c in enumerate(criteria):
        key = (c.get("key") or "").strip()
        if not key:
            problems.append(f"criteria[{idx}] is missing a key")
        elif key in seen_keys:
            problems.append(f"duplicate criterion key: {key}")
        else:
            seen_keys.add(key)

        marks = _criterion_marks(c)
        if marks is None:
            problems.append(f"criterion '{key or idx}' has a non-finite mark value")
        elif marks <= 0:
            problems.append(f"criterion '{key or idx}' must have max_marks > 0")
        weight = _criterion_number(c, ("weight",))
        if weight is None:
            problems.append(f"criterion '{key or idx}' has a non-finite weight")
        elif weight < 0:
            problems.append(f"criterion '{key or idx}' has a negative weight")
        if not (c.get("name") or "").strip():
            problems.append(f"criterion '{key or idx}' is missing a name")

    if max_points is not None and max_points > 0:
        total_marks = sum(_criterion_marks(c) or 0 for c in criteria)
        if total_marks <= 0:
            problems.append("total marks must be greater than zero")
    return problems


def normalise_criteria(criteria: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], List[str]]:
    """Fill defaults, deduplicate keys, normalise weights to exactly 100."""
    warnings: List[str] = []
    cleaned: List[Dict[str, Any]] = []
    used = set()

    for idx, raw in enumerate(criteria):
        c = dict(raw)
        key = (c.get("key") or "").strip() or _slug(c.get("name") or f"criterion_{idx}")
        base, suffix = key, 2
        while key in used:
            key = f"{base}_{suffix}"
            suffix += 1
        used.add(key)
        c["key"] = key
        c["criterion_key"] = key
        c["name"] = (c.get("name") or key).strip()[:200]
        c["description"] = (c.get("description") or "").strip()[:2000]
        weight = _criterion_number(c, ("weight",))
        c["weight"] = max(0.0, weight if weight is not None else 0.0)
        marks = _criterion_marks(c)
        c["max_marks"] = max(0.5, marks if marks is not None else 10.0)
        # Emit both vocabularies so ORM snapshots and generation payloads can
        # round-trip without silently resetting a criterion's mark scale.
        c["max_points"] = c["max_marks"]
        c["is_required"] = True if c.get("is_required") is None else bool(c["is_required"])
        c["evidence_requirements"] = [str(x)[:300] for x in (c.get("evidence_requirements") or [])][:10]
        c.setdefault("evidence_category", "CODE_SUPPORTED")
        levels = _criterion_levels(c)
        c["levels"] = levels
        # Emit the ORM vocabulary too: forks and version snapshots read either
        # key, and a client sending only the alias must round-trip its levels.
        c["performance_levels"] = levels
        cleaned.append(c)

    total = sum(c["weight"] for c in cleaned)
    if abs(total - 100.0) > WEIGHT_TOLERANCE:
        if total <= 0:
            # Equal split rather than an invalid rubric.
            share = round(100.0 / len(cleaned), 4)
            for c in cleaned:
                c["weight"] = share
            cleaned[-1]["weight"] = round(100.0 - share * (len(cleaned) - 1), 4)
            warnings.append("all weights were zero; distributed equally")
        else:
            factor = 100.0 / total
            for c in cleaned:
                c["weight"] = round(c["weight"] * factor, 4)
            # push rounding residue onto the heaviest criterion
            residue = round(100.0 - sum(c["weight"] for c in cleaned), 4)
            heaviest = max(cleaned, key=lambda c: c["weight"])
            heaviest["weight"] = round(heaviest["weight"] + residue, 4)
            warnings.append(f"weights were normalised from {round(total, 2)}% to 100%")

    return cleaned, warnings


def _slug(text: str) -> str:
    slug = re.sub(r"[^a-z0-9]+", "_", (text or "").lower()).strip("_")
    return (slug or "criterion")[:60]


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class RubricIntelligence:
    """Rubric generation, validation, versioning and approval."""

    def __init__(self, intelligence: Optional[AssessmentIntelligence] = None):
        self.intelligence = intelligence or assessment_intelligence

    # -- payload helpers ----------------------------------------------------

    @staticmethod
    def snapshot(rubric: Rubric) -> Dict[str, Any]:
        """Frozen, JSON-serialisable view of a rubric + its criteria."""
        criteria = []
        for row in sorted(rubric.criteria.all(), key=lambda c: c.order_index or 0):
            criterion = dict(row.to_dict())
            # The ORM/to_dict vocabulary (criterion_key/max_points) and the
            # generation vocabulary (key/max_marks) must coexist in the frozen
            # snapshot; validation and deterministic scoring both read it.
            criterion.setdefault("key", criterion.get("criterion_key"))
            criterion.setdefault("max_marks", criterion.get("max_points"))
            # The ORM exposes only ``performance_levels`` while generation and
            # grading use ``levels``; freeze both so forks keep custom bands.
            levels = _criterion_levels(criterion)
            criterion["levels"] = levels
            criterion["performance_levels"] = levels
            criteria.append(criterion)
        return {
            "rubric_id": rubric.id,
            "title": rubric.title,
            "description": rubric.description,
            "version": rubric.version or 1,
            "status": rubric.status or RUBRIC_APPROVED,
            "discipline": rubric.discipline,
            "assessment_kind": rubric.assessment_kind,
            "assessment_id": rubric.assessment_id,
            "max_score": float(rubric.total_points or 100.0),
            "weight_total": round(sum(float(c.get("weight") or 0) for c in criteria), 2),
            "summary": rubric.summary,
            "learning_objectives": rubric.learning_objectives or [],
            "deliverables": rubric.deliverables or [],
            "technologies": rubric.technologies or [],
            "evaluation_methods": rubric.evaluation_methods or [],
            "evaluator_recommendations": rubric.evaluator_recommendations or [],
            "unverifiable_requirements": rubric.unverifiable_requirements or [],
            "criteria": criteria,
        }

    # -- generation ---------------------------------------------------------

    def generate(
        self,
        descriptor: AssessmentDescriptor,
        actor_id: Optional[int] = None,
        use_llm: bool = True,
        profile: Optional[GradingProfile] = None,
    ) -> Tuple[Rubric, List[str]]:
        """Create a **draft** rubric for an assessment.

        Returns ``(rubric, warnings)``.  The rubric is never auto-approved.
        """
        classification = self.intelligence.classify(descriptor)
        warnings: List[str] = []
        payload: Optional[Dict[str, Any]] = None
        source = "fallback"

        if profile is not None and profile.criteria_template:
            payload = self._payload_from_profile(profile, descriptor, classification)
            source = "profile"
            warnings.append(f"derived from approved profile '{profile.key}'")
        elif use_llm:
            payload = self._payload_from_llm(descriptor, classification)
            if payload is not None:
                source = "ai"

        if payload is None:
            payload = self._payload_deterministic(descriptor, classification)
            source = "fallback"
            warnings.append("generated deterministically (model unavailable)")

        _promote_level_aliases(payload)
        clean, errors = try_validate(payload, RUBRIC_AI_SCHEMA)
        if errors:
            # Never fall back to raw model JSON: an invalid shape must fail the
            # generation request rather than silently becoming a graded rubric.
            logger.warning("rubric AI payload failed schema validation: %s", errors[:5])
            raise RubricError(
                "generated rubric failed schema validation",
                code="rubric_invalid", details=errors[:10],
            )
        criteria, norm_warnings = normalise_criteria(clean.get("criteria") or [])
        warnings.extend(norm_warnings)
        clean["criteria"] = criteria

        problems = validate_criteria(criteria, descriptor.points_possible)
        if problems:
            raise RubricError("generated rubric failed validation",
                              code="rubric_invalid", details=problems)

        rubric = self._persist(
            payload=clean,
            descriptor=descriptor,
            actor_id=actor_id,
            status=RUBRIC_DRAFT,
            source=source,
        )
        return rubric, warnings

    def _payload_from_llm(self, descriptor: AssessmentDescriptor,
                          classification) -> Optional[Dict[str, Any]]:
        assessment_view = descriptor.prompt_view()
        assessment_view["detected_discipline"] = classification.discipline
        assessment_view["detected_technologies"] = classification.technologies
        assessment_view["detected_frameworks"] = classification.frameworks
        assessment_view["candidate_deliverables"] = classification.deliverables
        assessment_view["extracted_learning_objectives"] = classification.learning_objectives

        call = llm_json(
            RUBRIC_SYSTEM_PROMPT,
            RUBRIC_AI_SCHEMA,
            assessment=assessment_view,
            contract={
                "type": "object",
                "required": ["title", "discipline", "summary", "criteria"],
                "criteria_item": {
                    "type": "object",
                    "required": ["key", "name", "description", "weight", "max_marks"],
                },
                "weights_must_sum_to": 100,
            },
            temperature=0.2,
            max_tokens=6000,
        )
        if not call.ok or not call.data:
            logger.warning("rubric generation model call failed: %s", call.errors[:3])
            return None
        call.data["_llm"] = True
        call.data["_provider"] = call.provider
        return call.data

    @staticmethod
    def _payload_from_profile(profile: GradingProfile,
                              descriptor: AssessmentDescriptor,
                              classification) -> Dict[str, Any]:
        criteria, _ = normalise_criteria(list(profile.criteria_template or []))
        return {
            "title": descriptor.title,
            "discipline": profile.discipline or classification.discipline,
            "summary": profile.description or f"Approved profile '{profile.name}'",
            "learning_objectives": classification.learning_objectives,
            "deliverables": classification.deliverables,
            "technologies": classification.technologies,
            "evaluation_methods": classification.evaluation_methods,
            "criteria": criteria,
            "recommended_evaluators": [c.get("evaluator_hint") for c in criteria
                                       if c.get("evaluator_hint")],
            "unverifiable_requirements": [],
            "_profile": profile.key,
        }

    @staticmethod
    def _payload_deterministic(descriptor: AssessmentDescriptor,
                               classification) -> Dict[str, Any]:
        """Fallback rubric — no model required.

        Discipline-specific templates keep the fallback meaningful instead of
        one generic rubric for every subject.
        """
        discipline = classification.discipline
        templates = _DETERMINISTIC_TEMPLATES.get(discipline) or _DETERMINISTIC_TEMPLATES["general"]
        criteria = []
        share = round(100.0 / len(templates), 4)
        for idx, (key, name, desc, marks, hint) in enumerate(templates):
            criteria.append({
                "key": key,
                "name": name,
                "description": desc,
                "weight": share if idx < len(templates) - 1 else 0,
                "max_marks": marks,
                "is_required": True,
                "evidence_requirements": [f"submission artefacts relevant to: {name}"],
                "evidence_category": "CODE_SUPPORTED",
                "evaluator_hint": hint,
                "levels": list(DEFAULT_LEVELS),
            })
        criteria, _ = normalise_criteria(criteria)
        return {
            "title": descriptor.title,
            "discipline": discipline,
            "summary": (descriptor.description or descriptor.title or "")[:800],
            "learning_objectives": classification.learning_objectives,
            "deliverables": classification.deliverables,
            "technologies": classification.technologies,
            "evaluation_methods": classification.evaluation_methods,
            "criteria": criteria,
            "recommended_evaluators": sorted({c["evaluator_hint"] for c in criteria
                                              if c.get("evaluator_hint")}),
            "unverifiable_requirements": [],
            "_deterministic": True,
        }

    def _persist(self, *, payload: Dict[str, Any], descriptor: AssessmentDescriptor,
                 actor_id: Optional[int], status: str, source: str) -> Rubric:
        criteria_payload = payload.get("criteria") or []
        problems = validate_criteria(criteria_payload)
        if problems:
            raise RubricError("rubric payload invalid", details=problems)

        max_marks = round(sum(float(c["max_marks"]) for c in criteria_payload), 2)

        rubric = Rubric(
            title=(payload.get("title") or descriptor.title or "Rubric")[:200],
            description=(payload.get("summary") or "")[:4000],
            instructor_id=actor_id or descriptor.instructor_id,
            course_id=descriptor.course_id,
            is_template=False,
            total_points=max_marks,
            status=status,
            version=1,
            discipline=payload.get("discipline"),
            assessment_kind=descriptor.kind,
            assessment_id=descriptor.id,
            source=source,
            generated_by_ai=bool(payload.get("_llm")),
            summary=payload.get("summary"),
            learning_objectives=payload.get("learning_objectives") or [],
            deliverables=payload.get("deliverables") or [],
            technologies=payload.get("technologies") or [],
            evaluation_methods=payload.get("evaluation_methods") or [],
            evaluator_recommendations=payload.get("recommended_evaluators") or [],
            unverifiable_requirements=payload.get("unverifiable_requirements") or [],
            criteria_weights_total=rubric_weights_total(criteria_payload),
        )
        db.session.add(rubric)
        db.session.flush()

        for idx, c in enumerate(criteria_payload):
            db.session.add(RubricCriterion(
                rubric_id=rubric.id,
                name=c["name"],
                description=c.get("description"),
                max_points=float(c["max_marks"]),
                order_index=idx,
                performance_levels=_criterion_levels(c),
                weight=float(c["weight"]),
                is_required=bool(c.get("is_required", True)),
                criterion_key=c["key"],
                evidence_requirements=c.get("evidence_requirements") or [],
                evidence_category=c.get("evidence_category"),
                evaluator_hint=c.get("evaluator_hint"),
                evaluator_instructions=c.get("evaluator_instructions"),
            ))

        # Draft rubrics are linked to the assessment so instructors can find
        # them, but grading only consumes APPROVED rubrics (see resolve()).
        assessment_row = descriptor.raw
        if assessment_row is not None and getattr(assessment_row, "rubric_id", None) is None:
            assessment_row.rubric_id = rubric.id

        db.session.commit()
        logger.info("AAGE created draft rubric %s for %s %s",
                    rubric.id, descriptor.kind, descriptor.id)
        return rubric

    # -- lifecycle ----------------------------------------------------------

    def get(self, rubric_id: int) -> Rubric:
        rubric = Rubric.query.get(rubric_id)
        if rubric is None:
            raise RubricError("rubric not found", code="not_found", status=404)
        return rubric

    def validate(self, rubric_id: int) -> Dict[str, Any]:
        rubric = self.get(rubric_id)
        payload = self.snapshot(rubric)
        problems = validate_criteria(payload["criteria"], rubric.total_points)
        return {
            "valid": not problems,
            "problems": problems,
            "weight_total": payload["weight_total"],
            "max_score": payload["max_score"],
            "criterion_count": len(payload["criteria"]),
        }

    def has_graded_submissions(self, rubric_id: int) -> int:
        return EvaluationResult.query.filter_by(rubric_id=rubric_id).count()

    def update(self, rubric_id: int, changes: Dict[str, Any],
               actor_id: Optional[int] = None,
               acknowledge_graded: bool = False) -> Rubric:
        """Edit a rubric without ever rewriting a graded/approved snapshot.

        Draft rubrics are edited in place.  Approved or already-used rubrics are
        *forked* into a new draft with ``parent_rubric_id`` pointing at the
        original; the original and its ``RubricVersion`` rows stay immutable.
        """
        rubric = self.get(rubric_id)
        graded = self.has_graded_submissions(rubric_id)
        locked = bool(graded) or rubric.is_approved()
        if locked and not acknowledge_graded:
            raise RubricError(
                f"rubric has {graded} graded submission(s) or is approved; "
                "acknowledge the change to fork a new draft",
                code="rubric_graded_locked", status=409,
                details=[{"graded_results": graded, "fork_required": True}],
            )

        target = self._fork_rubric(rubric, actor_id) if locked else rubric

        if "criteria" in changes:
            criteria, warnings = normalise_criteria(changes["criteria"])
            problems = validate_criteria(criteria, changes.get("max_score"))
            if problems:
                raise RubricError("rubric payload invalid", details=problems)
            self._replace_criteria(target, criteria)
            target.criteria_weights_total = rubric_weights_total(criteria)
            target.total_points = round(sum(float(c["max_marks"]) for c in criteria), 2)

        for field_name in ("title", "summary", "description", "discipline",
                           "learning_objectives", "deliverables", "technologies",
                           "evaluation_methods", "evaluator_recommendations",
                           "unverifiable_requirements"):
            if field_name in changes:
                setattr(target, field_name, changes[field_name])

        # A fork is always an unapproved draft; it must be approved explicitly
        # before it can grade anything new.  Original rows are never touched.
        if locked:
            target.status = RUBRIC_DRAFT
        elif target.status == RUBRIC_APPROVED:
            target.status = RUBRIC_PENDING
        db.session.commit()
        return target

    def _fork_rubric(self, rubric: Rubric, actor_id: Optional[int]) -> Rubric:
        """Create a new draft copy of ``rubric`` for safe editing."""
        payload = self.snapshot(rubric)
        fork = Rubric(
            title=payload["title"],
            description=payload.get("description"),
            instructor_id=actor_id or rubric.instructor_id,
            course_id=rubric.course_id,
            is_template=rubric.is_template,
            total_points=payload.get("max_score") or rubric.total_points,
            status=RUBRIC_DRAFT,
            version=(rubric.version or 1) + 1,
            discipline=payload.get("discipline"),
            assessment_kind=payload.get("assessment_kind"),
            assessment_id=payload.get("assessment_id"),
            source="instructor",
            generated_by_ai=bool(rubric.generated_by_ai),
            summary=payload.get("summary"),
            learning_objectives=payload.get("learning_objectives") or [],
            deliverables=payload.get("deliverables") or [],
            technologies=payload.get("technologies") or [],
            evaluation_methods=payload.get("evaluation_methods") or [],
            evaluator_recommendations=payload.get("evaluator_recommendations") or [],
            unverifiable_requirements=payload.get("unverifiable_requirements") or [],
            parent_rubric_id=rubric.id,
            profile_id=rubric.profile_id,
            approved_by=None,
            approved_at=None,
            criteria_weights_total=payload.get("weight_total"),
        )
        db.session.add(fork)
        db.session.flush()
        for idx, c in enumerate(payload.get("criteria") or []):
            db.session.add(RubricCriterion(
                rubric_id=fork.id,
                name=c["name"],
                description=c.get("description"),
                max_points=float(c.get("max_marks") or c.get("max_points") or 0),
                order_index=idx,
                performance_levels=_criterion_levels(c),
                weight=float(c.get("weight") or 0),
                is_required=bool(c.get("is_required", True)),
                criterion_key=c.get("criterion_key") or c.get("key"),
                evidence_requirements=c.get("evidence_requirements") or [],
                evidence_category=c.get("evidence_category"),
                evaluator_hint=c.get("evaluator_hint"),
                evaluator_instructions=c.get("evaluator_instructions"),
            ))
        db.session.flush()
        logger.info("AAGE forked rubric %s -> draft %s", rubric.id, fork.id)
        return fork

    def _replace_criteria(self, rubric: Rubric, criteria: List[Dict[str, Any]]) -> None:
        for existing in list(rubric.criteria.all()):
            db.session.delete(existing)
        db.session.flush()
        for idx, c in enumerate(criteria):
            db.session.add(RubricCriterion(
                rubric_id=rubric.id,
                name=c["name"],
                description=c.get("description"),
                max_points=float(c["max_marks"]),
                order_index=idx,
                performance_levels=_criterion_levels(c),
                weight=float(c["weight"]),
                is_required=bool(c.get("is_required", True)),
                criterion_key=c["key"],
                evidence_requirements=c.get("evidence_requirements") or [],
                evidence_category=c.get("evidence_category"),
                evaluator_hint=c.get("evaluator_hint"),
                evaluator_instructions=c.get("evaluator_instructions"),
            ))

    def approve(self, rubric_id: int, actor_id: Optional[int],
                link_assessment: bool = True) -> Tuple[Rubric, RubricVersion]:
        """Approve a rubric and freeze its current version."""
        rubric = self.get(rubric_id)
        payload = self.snapshot(rubric)
        problems = validate_criteria(payload["criteria"], rubric.total_points)
        if problems:
            raise RubricError("cannot approve an invalid rubric",
                              code="rubric_invalid", details=problems)

        rubric.status = RUBRIC_APPROVED
        rubric.approved_by = actor_id
        rubric.approved_at = now_local()
        rubric.criteria_weights_total = payload["weight_total"]

        if link_assessment and rubric.assessment_kind and rubric.assessment_id:
            model = Assignment if rubric.assessment_kind == KIND_ASSIGNMENT else Project
            row = model.query.get(rubric.assessment_id)
            if row is not None:
                row.rubric_id = rubric.id

        version = self._snapshot_version(rubric, payload, actor_id,
                                         change_note="approved")
        db.session.commit()
        logger.info("AAGE rubric %s approved (version %s)", rubric.id, version.version)
        return rubric, version

    def reject(self, rubric_id: int, actor_id: Optional[int], reason: str = "") -> Rubric:
        rubric = self.get(rubric_id)
        rubric.status = RUBRIC_DRAFT
        payload = self.snapshot(rubric)
        self._snapshot_version(rubric, payload, actor_id,
                               change_note=f"rejected: {reason}"[:500])
        db.session.commit()
        return rubric

    def _snapshot_version(self, rubric: Rubric, payload: Dict[str, Any],
                          actor_id: Optional[int],
                          change_note: str = "") -> RubricVersion:
        last = (RubricVersion.query.filter_by(rubric_id=rubric.id)
                .order_by(RubricVersion.version.desc()).first())
        version_number = (last.version + 1) if last else 1
        payload = dict(payload)
        payload["version"] = version_number
        version = RubricVersion(
            rubric_id=rubric.id,
            version=version_number,
            checksum=_checksum(payload),
            payload=payload,
            total_points=payload.get("max_score"),
            weight_total=payload.get("weight_total"),
            change_note=change_note,
            created_by=actor_id,
        )
        rubric.version = version_number
        db.session.add(version)
        db.session.flush()
        return version

    def versions(self, rubric_id: int) -> List[Dict[str, Any]]:
        rows = (RubricVersion.query.filter_by(rubric_id=rubric_id)
                .order_by(RubricVersion.version.desc()).all())
        return [v.to_dict(include_payload=False) for v in rows]

    def version_payload(self, rubric_id: int, version: int) -> Dict[str, Any]:
        row = RubricVersion.query.filter_by(rubric_id=rubric_id, version=version).first()
        if row is None:
            raise RubricError("rubric version not found", code="not_found", status=404)
        return row.to_dict(include_payload=True)

    # -- resolution for grading --------------------------------------------

    def resolve(self, descriptor: AssessmentDescriptor
                ) -> Tuple[Dict[str, Any], Rubric, bool]:
        """Find the rubric that should grade this assessment.

        Returns ``(snapshot, rubric, provisional)``.

        * ``provisional=False`` — an approved rubric (or approved reusable
          profile) governs the grade.
        * ``provisional=True`` — no approved rubric exists; a deterministic
          fallback rubric is used and the result **must** be reviewed by an
          instructor.
        """
        # 1. rubric explicitly linked and approved
        if descriptor.rubric_id:
            rubric = Rubric.query.get(descriptor.rubric_id)
            if rubric is not None and rubric.is_approved():
                return self.snapshot(rubric), rubric, False

        # 2. any approved rubric registered for this assessment
        rubric = (Rubric.query.filter_by(
            assessment_kind=descriptor.kind,
            assessment_id=descriptor.id,
            status=RUBRIC_APPROVED,
        ).order_by(Rubric.version.desc()).first())
        if rubric is not None:
            return self.snapshot(rubric), rubric, False

        # 3. approved reusable profile for the discipline
        classification = self.intelligence.classify(descriptor)
        profile = (GradingProfile.query.filter_by(
            discipline=classification.discipline, is_active=True
        ).order_by(GradingProfile.id.desc()).first())
        if profile is None:
            profile = GradingProfile.query.filter_by(
                discipline="general", is_active=True).first()
        if profile is not None:
            payload = self._payload_from_profile(profile, descriptor, classification)
            payload, _ = normalise_criteria(payload["criteria"])
            return (self._snapshot_view(profile, payload, descriptor), None, False)

        # 4. provisional fallback
        payload = self._payload_deterministic(descriptor, classification)
        payload["criteria"], _ = normalise_criteria(payload["criteria"])
        logger.warning("AAGE: no approved rubric for %s %s — provisional grading",
                       descriptor.kind, descriptor.id)
        return (self._snapshot_view(None, payload, descriptor), None, True)

    @staticmethod
    def _snapshot_view(profile: Optional[GradingProfile],
                       payload: Dict[str, Any],
                       descriptor: AssessmentDescriptor) -> Dict[str, Any]:
        criteria = payload.get("criteria") or []
        return {
            "rubric_id": None,
            "profile_id": profile.id if profile else None,
            "title": payload.get("title") or descriptor.title,
            "description": payload.get("summary") or "",
            "version": 0,
            "status": "profile" if profile else "provisional",
            "discipline": payload.get("discipline"),
            "assessment_kind": descriptor.kind,
            "assessment_id": descriptor.id,
            "max_score": round(sum(float(c["max_marks"]) for c in criteria), 2),
            "weight_total": rubric_weights_total(criteria),
            "summary": payload.get("summary"),
            "learning_objectives": payload.get("learning_objectives") or [],
            "deliverables": payload.get("deliverables") or [],
            "technologies": payload.get("technologies") or [],
            "evaluation_methods": payload.get("evaluation_methods") or [],
            "evaluator_recommendations": payload.get("recommended_evaluators") or [],
            "unverifiable_requirements": payload.get("unverifiable_requirements") or [],
            "criteria": criteria,
        }

    # -- profiles -----------------------------------------------------------

    def save_profile(self, *, key: str, name: str, discipline: str,
                     criteria: List[Dict[str, Any]], description: str = "",
                     course_id: Optional[int] = None,
                     actor_id: Optional[int] = None) -> GradingProfile:
        cleaned, _ = normalise_criteria(criteria)
        problems = validate_criteria(cleaned)
        if problems:
            raise RubricError("profile rubric invalid", details=problems)
        profile = GradingProfile.query.filter_by(key=key).first()
        if profile is None:
            profile = GradingProfile(key=key, name=name, discipline=discipline,
                                     created_by=actor_id)
            db.session.add(profile)
        profile.name = name
        profile.discipline = discipline
        profile.description = description
        profile.criteria_template = cleaned
        profile.course_id = course_id
        profile.is_active = True
        db.session.commit()
        return profile

    def best_profile(self, discipline: str,
                     course_id: Optional[int] = None) -> Optional[GradingProfile]:
        if course_id:
            row = GradingProfile.query.filter_by(
                discipline=discipline, course_id=course_id, is_active=True).first()
            if row:
                return row
        return GradingProfile.query.filter_by(
            discipline=discipline, is_active=True).first()


def _checksum(payload: Dict[str, Any]) -> str:
    import hashlib
    blob = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()


# ---------------------------------------------------------------------------
# Deterministic fallback templates (key, name, description, max_marks, evaluator)
# ---------------------------------------------------------------------------

_D_T = Tuple[str, str, str, float, str]

_DETERMINISTIC_TEMPLATES: Dict[str, List[_D_T]] = {
    "frontend": [
        ("html_semantics", "HTML semantics",
         "Semantic structure, landmarks, headings hierarchy and valid markup.", 15.0, "frontend"),
        ("css_design", "CSS & visual design",
         "Layout, typography, colour use and overall visual quality.", 15.0, "frontend"),
        ("responsive", "Responsive design",
         "Behaviour across mobile, tablet and desktop viewports.", 15.0, "frontend"),
        ("javascript", "JavaScript functionality",
         "Interactivity, DOM handling and correctness of implemented behaviour.", 20.0, "frontend"),
        ("requirements", "Requirements compliance",
         "Every stated requirement in the brief is present and working.", 15.0, "frontend"),
        ("accessibility", "Accessibility",
         "Alt text, labels, keyboard access and contrast.", 10.0, "frontend"),
        ("code_quality", "Code quality & organisation",
         "Readable, consistent, DRY source with sensible file structure.", 10.0, "frontend"),
    ],
    "backend": [
        ("api_design", "API design",
         "Resource naming, verbs, status codes and response shapes.", 15.0, "backend"),
        ("routes", "Route / endpoint implementation",
         "Required endpoints exist and are wired to handlers.", 15.0, "backend"),
        ("business_logic", "Business logic",
         "Core rules implemented correctly and completely.", 20.0, "backend"),
        ("data_model", "Data model & relationships",
         "Schema, keys and relationships match the brief.", 15.0, "backend"),
        ("validation", "Input validation",
         "Requests are validated and invalid input rejected.", 10.0, "backend"),
        ("auth", "Authentication & authorization",
         "Protected routes and role checks behave correctly.", 10.0, "backend"),
        ("error_handling", "Error handling & security",
         "Errors returned safely; no obvious secrets or injection risks.", 10.0, "backend"),
        ("quality", "Code quality & documentation",
         "Readable code, comments/docstrings and setup notes.", 5.0, "backend"),
    ],
    "data_science": [
        ("data_understanding", "Dataset understanding",
         "Correct loading and clear description of the data.", 10.0, "data_science"),
        ("data_quality", "Data quality handling",
         "Missing values, duplicates and types handled appropriately.", 15.0, "data_science"),
        ("transformations", "Transformations & feature work",
         "Appropriate cleaning, aggregation and feature engineering.", 15.0, "data_science"),
        ("analysis", "Exploratory analysis & statistics",
         "Relevant statistics and correctly interpreted exploratory work.", 15.0, "data_science"),
        ("visualisation", "Visualisation",
         "Charts chosen suit the question; readable and labelled.", 10.0, "data_science"),
        ("modelling", "Modelling & evaluation",
         "Sensible model choice with valid, non-leaky evaluation metrics.", 20.0, "data_science"),
        ("interpretation", "Interpretation & reproducibility",
         "Conclusions supported by results; steps reproducible.", 10.0, "data_science"),
        ("documentation", "Documentation",
         "Narrative explains the reasoning end-to-end.", 5.0, "data_science"),
    ],
    "spreadsheet": [
        ("formulas", "Formulas",
         "Correct formulas for the required calculations.", 30.0, "spreadsheet"),
        ("structure", "Workbook structure",
         "Named sheets, sensible layout and traceable inputs/outputs.", 15.0, "spreadsheet"),
        ("pivots", "Pivot tables & summaries",
         "Pivot tables/summaries answer the stated questions.", 15.0, "spreadsheet"),
        ("visualisation", "Charts & formatting",
         "Readable charts, consistent formatting and clear presentation.", 10.0, "spreadsheet"),
        ("automation", "VBA / Power Query automation",
         "Macros or queries where required, working as described.", 15.0, "spreadsheet"),
        ("validation", "Data validation",
         "Input validation and error handling in cells.", 5.0, "spreadsheet"),
        ("documentation", "Documentation",
         "Assumptions and steps documented inside the workbook.", 10.0, "spreadsheet"),
    ],
    "sql": [
        ("schema", "Schema design",
         "Tables, keys and relationships match the requirements.", 20.0, "backend"),
        ("queries", "Query correctness",
         "Queries return the required results.", 30.0, "backend"),
        ("complexity", "Joins, grouping & subqueries",
         "Appropriate use of joins, aggregates, CTEs/subqueries.", 20.0, "backend"),
        ("optimisation", "Indexes & optimisation",
         "Indexes or query rewrites that support performance.", 10.0, "backend"),
        ("constraints", "Constraints & integrity",
         "Constraints enforce the stated business rules.", 10.0, "backend"),
        ("documentation", "Documentation",
         "Assumptions and query purpose explained.", 10.0, "backend"),
    ],
    "python": [
        ("correctness", "Functional correctness",
         "Program produces correct results for the required cases.", 30.0, "backend"),
        ("structure", "Code structure",
         "Sensible functions/classes and separation of concerns.", 15.0, "backend"),
        ("error_handling", "Error handling",
         "Edge cases and invalid input handled deliberately.", 15.0, "backend"),
        ("complexity", "Algorithmic approach",
         "Appropriate algorithms and data structures.", 15.0, "backend"),
        ("tests", "Testing",
         "Tests present and covering the main behaviour.", 10.0, "backend"),
        ("readability", "Readability & documentation",
         "Naming, comments and docstrings.", 15.0, "backend"),
    ],
    "theory": [
        ("content", "Coverage of the question",
         "All parts of the question addressed.", 30.0, "documents"),
        ("accuracy", "Technical accuracy",
         "Statements are correct and well founded.", 25.0, "documents"),
        ("structure", "Structure & argument",
         "Logical flow with clear introduction, body and conclusion.", 15.0, "documents"),
        ("evidence", "Use of examples/evidence",
         "Claims supported with examples, references or data.", 15.0, "documents"),
        ("presentation", "Presentation & referencing",
         "Readable formatting and proper attribution.", 15.0, "documents"),
    ],
    "general": [
        ("requirements", "Requirements compliance",
         "All stated requirements present in the submission.", 30.0, "documents"),
        ("accuracy", "Accuracy",
         "Content is correct and free of material errors.", 25.0, "documents"),
        ("completeness", "Completeness",
         "Work is finished — no placeholders or missing sections.", 20.0, "documents"),
        ("quality", "Quality of presentation",
         "Clear, organised and readable.", 15.0, "documents"),
        ("documentation", "Documentation / explanation",
         "Reasoning is explained so a reader can follow it.", 10.0, "documents"),
    ],
}

_DETERMINISTIC_TEMPLATES["fullstack"] = (
    _DETERMINISTIC_TEMPLATES["frontend"][:4] + _DETERMINISTIC_TEMPLATES["backend"][:4]
)
_DETERMINISTIC_TEMPLATES["mobile"] = _DETERMINISTIC_TEMPLATES["frontend"]
_DETERMINISTIC_TEMPLATES["devops"] = _DETERMINISTIC_TEMPLATES["backend"]


rubric_intelligence = RubricIntelligence()
