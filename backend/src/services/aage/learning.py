"""Service Q — Learning, calibration and evaluator version governance.

Nothing here retrains a model or edits a prompt.  Calibration is a deterministic
comparison of *already recorded* scores: approved instructor corrections are the
ground truth, the active EvaluatorVersion is the baseline, and candidate scores
must have been produced by an explicit, recorded evaluator run.  When there is
not enough trustworthy data, the run is honestly marked ``insufficient_data``
instead of reporting invented metrics.
"""

from __future__ import annotations

import json
import logging
from statistics import mean
from typing import Any, Dict, List, Optional, Sequence, Tuple

from ...models.aage_models import (
    CalibrationCase,
    CalibrationRun,
    EvaluatorVersion,
    LearningExample,
)
from ...utils.time_utils import now_local
from . import persistence
from .constants import (
    EVALUATOR_ACTIVE,
    EVALUATOR_CANDIDATE,
    EVALUATOR_RETIRED,
    EVALUATOR_ROLLED_BACK,
    LEARNING_APPROVED,
    LEARNING_CANDIDATE,
    LEARNING_REJECTED,
)

logger = logging.getLogger("aage.learning")

#: Below this many trustworthy cases no metrics are reported at all.
MIN_CALIBRATION_CASES = 3
#: A criterion is "in agreement" when the normalised difference is <= 15%.
CRITERION_AGREEMENT_TOLERANCE = 0.15
PASS_THRESHOLD = 0.60


class LearningError(Exception):
    def __init__(self, message: str, code: str = "learning_error",
                 details: Optional[List[Any]] = None, status: int = 400):
        super().__init__(message)
        self.message = message
        self.code = code
        self.details = details or []
        self.status = status


# ---------------------------------------------------------------------------
# Score helpers — all values come from persisted data, never from a model call
# ---------------------------------------------------------------------------

def _score_value(raw: Any) -> Tuple[float, float]:
    """Return ``(marks, maximum)`` from either a number or a score dict."""
    if isinstance(raw, dict):
        marks = raw.get("marks", raw.get("awarded", 0))
        maximum = raw.get("maximum", raw.get("max_marks",
                                            raw.get("max_points", 0)))
    else:
        marks, maximum = raw, 0
    try:
        return float(marks or 0), float(maximum or 0)
    except (TypeError, ValueError):
        return 0.0, 0.0


def _score_map(raw: Any, defaults: Optional[Dict[str, Tuple[float, float]]] = None
               ) -> Dict[str, Tuple[float, float]]:
    """Normalise a persisted score map to ``{key: (marks, maximum)}``.

    Older correction rows store bare marks for ``original_scores`` /
    ``instructor_scores``.  When maxima are missing, borrow the maximum from
    the recorded candidate scores (derived from the result's frozen rubric) so
    the same criterion can be compared deterministically.  No mark is changed.
    """
    if not isinstance(raw, dict):
        return {}
    result = {str(k): _score_value(v) for k, v in raw.items()}
    if defaults:
        for key, (marks, maximum) in list(result.items()):
            if maximum <= 0 and key in defaults:
                result[key] = (marks, defaults[key][1])
    return result


def _normalised_errors(expected: Dict[str, Tuple[float, float]],
                       actual: Dict[str, Tuple[float, float]]) -> List[float]:
    """Absolute criterion errors normalised to 0..1 of the maximum."""
    errors: List[float] = []
    for key, (want, maximum) in expected.items():
        if key not in actual or maximum <= 0:
            continue
        got = actual[key][0]
        errors.append(min(1.0, abs(got - want) / maximum))
    return errors


def _metrics_for(expected: Dict[str, Tuple[float, float]],
                 actual: Dict[str, Tuple[float, float]]) -> Dict[str, Any]:
    errors = _normalised_errors(expected, actual)
    agreement = [1.0 if e <= CRITERION_AGREEMENT_TOLERANCE else 0.0
                 for e in errors]
    false_pass = false_fail = 0
    for key, (want, maximum) in expected.items():
        if key not in actual or maximum <= 0:
            continue
        got = actual[key][0]
        want_pass, got_pass = want >= maximum * PASS_THRESHOLD, got >= maximum * PASS_THRESHOLD
        if got_pass and not want_pass:
            false_pass += 1
        if want_pass and not got_pass:
            false_fail += 1
    total = len(agreement)
    return {
        "mae": round(mean(errors) * 100.0, 4) if errors else None,
        "criterion_agreement": round(sum(agreement) / total, 4) if total else None,
        "false_pass_rate": round(false_pass / total, 4) if total else None,
        "false_fail_rate": round(false_fail / total, 4) if total else None,
        "criterion_count": total,
    }


# ---------------------------------------------------------------------------
# Per-evaluator reliability (global metrics remain unchanged)
# ---------------------------------------------------------------------------

def _identity_from_mapping(payload: Any) -> Tuple[str, str]:
    if not isinstance(payload, dict):
        return "", ""
    if "evaluator_name" in payload or "evaluator_version" in payload:
        return (str(payload.get("evaluator_name") or "").strip(),
                str(payload.get("evaluator_version") or "").strip())
    versions = payload.get("evaluator_versions") or []
    if isinstance(versions, dict):
        versions = [versions]
    for item in versions:
        if not isinstance(item, dict):
            continue
        name = str(item.get("name") or "").strip()
        version = str(item.get("version") or "").strip()
        if name or version:
            return name, version
    return "", ""


def _evaluator_identity(row: Any) -> Tuple[str, str]:
    """Recover (name, version) from an example or a calibration case."""
    name = str(getattr(row, "evaluator_name", "") or "").strip()
    version = str(getattr(row, "evaluator_version", "") or "").strip()
    if name or version:
        return name, version
    found = _identity_from_mapping(getattr(row, "tags", None))
    if any(found):
        return found
    notes = getattr(row, "notes", None)
    if isinstance(notes, str):
        try:
            notes = json.loads(notes)
        except (TypeError, ValueError):
            notes = None
    return _identity_from_mapping(notes)


def _identity_key(name: str, version: str) -> str:
    return f"{name or 'unknown'}:{version or 'unversioned'}"


def _identity_case_counts(rows: Sequence[Any]) -> Dict[str, int]:
    """Counts only — used when there is not enough data for real metrics."""
    counts: Dict[str, int] = {}
    for row in rows:
        if getattr(row, "status", LEARNING_APPROVED) != LEARNING_APPROVED:
            continue
        name, version = _evaluator_identity(row)
        if not (name or version):
            continue
        key = _identity_key(name, version)
        counts[key] = counts.get(key, 0) + 1
    return counts


def _score_pair(row: Any, source: str) -> Tuple[
        Dict[str, Tuple[float, float]], Dict[str, Tuple[float, float]]]:
    """Return (expected, actual) score maps for an example/case row."""
    candidate = _candidate_scores(row)
    if hasattr(row, "expected_scores") or hasattr(row, "baseline_scores"):
        case_candidate = _score_map(
            getattr(row, "candidate_scores", None), candidate) or candidate
        expected = _score_map(getattr(row, "expected_scores", None),
                              case_candidate)
        actual = (case_candidate if source == "candidate"
                  else _score_map(getattr(row, "baseline_scores", None),
                                  case_candidate))
        return expected, actual

    expected = _score_map(getattr(row, "instructor_scores", None), candidate)
    actual = (candidate if source == "candidate"
              else _score_map(getattr(row, "original_scores", None), candidate))
    return expected, actual


def _average_metric(metrics: Sequence[Dict[str, Any]], field: str
                    ) -> Optional[float]:
    values = [float(m[field]) for m in metrics
              if m and m.get(field) is not None]
    return round(mean(values), 4) if values else None


def _average_override(metrics: Sequence[Dict[str, Any]]) -> Optional[float]:
    values = [1.0 - float(m["criterion_agreement"]) for m in metrics
              if m and m.get("criterion_agreement") is not None]
    return round(mean(values), 4) if values else None


def evaluator_reliability(examples: Optional[Sequence[LearningExample]] = None,
                          *, cases: Optional[Sequence[Any]] = None,
                          score_source: str = "baseline"
                          ) -> Dict[str, Dict[str, Any]]:
    """Per-evaluator-version reliability from recorded scores only.

    Rows must carry evaluator identity (top-level fields, ``tags`` or case
    ``notes``) and instructor/expected scores.  ``reliability`` is the mean
    criterion agreement against those instructor scores, ``override_rate`` its
    complement; neither value is invented when no usable case exists.  The
    global aggregates on calibration runs are kept for backward compatibility.
    """
    if score_source not in ("baseline", "candidate"):
        raise LearningError("score_source must be 'baseline' or 'candidate'",
                            "invalid_payload")

    rows: List[Any] = []
    if examples is not None:
        rows.extend(list(examples))
    if cases is not None:
        rows.extend(list(cases))
    if examples is None and cases is None:
        rows = LearningExample.query.filter_by(status=LEARNING_APPROVED).all()

    groups: Dict[str, Dict[str, Any]] = {}
    for row in rows:
        if getattr(row, "status", LEARNING_APPROVED) != LEARNING_APPROVED:
            continue
        name, version = _evaluator_identity(row)
        if not (name or version):
            continue
        expected, actual = _score_pair(row, score_source)
        if not expected or not actual:
            continue
        metrics = _metrics_for(expected, actual)
        if not metrics or not metrics.get("criterion_count"):
            continue
        key = _identity_key(name, version)
        entry = groups.setdefault(key, {
            "evaluator_name": name or None,
            "evaluator_version": version or None,
            "case_count": 0,
            "_metrics": [],
        })
        entry["_metrics"].append(metrics)
        entry["case_count"] += 1

    summary: Dict[str, Dict[str, Any]] = {}
    for key, entry in groups.items():
        metrics = entry.pop("_metrics")
        agreement = _average_metric(metrics, "criterion_agreement")
        summary[key] = {
            "evaluator_name": entry["evaluator_name"],
            "evaluator_version": entry["evaluator_version"],
            "case_count": entry["case_count"],
            "mae": _average_metric(metrics, "mae"),
            "criterion_agreement": agreement,
            "agreement": agreement,
            "reliability": agreement,
            "override_rate": _average_override(metrics),
            "false_pass_rate": _average_metric(metrics, "false_pass_rate"),
            "false_fail_rate": _average_metric(metrics, "false_fail_rate"),
        }
    return summary


# ---------------------------------------------------------------------------
# Insights and learning examples
# ---------------------------------------------------------------------------

def _scoped_examples_query(course_ids: Optional[Sequence[int]] = None):
    """Learning examples visible to the caller.

    ``None`` means unrestricted (admin/platform view); an explicit list — even
    an empty one — is scoped to those courses so one instructor can never see
    another instructor's corrections.
    """
    query = LearningExample.query
    if course_ids is not None:
        ids = [int(value) for value in course_ids]
        query = query.filter(LearningExample.course_id.in_(ids or [-1]))
    return query


def learning_insights(course_ids: Optional[Sequence[int]] = None) -> Dict[str, Any]:
    """Honest summary of what the learning store actually contains."""
    examples_query = _scoped_examples_query(course_ids)
    statuses = {
        status: examples_query.filter_by(status=status).count()
        for status in (LEARNING_CANDIDATE, LEARNING_APPROVED, LEARNING_REJECTED)
    }
    approved = examples_query.filter_by(status=LEARNING_APPROVED).all()
    deltas = [float(e.score_delta) for e in approved if e.score_delta is not None]
    evaluator_rows = EvaluatorVersion.query.all()
    active_by_name: Dict[str, str] = {}
    for row in evaluator_rows:
        if row.status == EVALUATOR_ACTIVE:
            active_by_name[row.name] = row.version
    calibrations = CalibrationRun.query.order_by(CalibrationRun.id.desc()).limit(20).all()
    return {
        "examples": {
            "total": sum(statuses.values()),
            "by_status": statuses,
            "approved_with_scores": len(approved),
        },
        "correction_impact": {
            "approved_count": len(deltas),
            "mean_score_delta": round(mean(deltas), 4) if deltas else None,
        },
        "evaluators": {
            "versions": len(evaluator_rows),
            "active_versions": active_by_name,
            "candidates": sum(1 for r in evaluator_rows
                              if r.status == EVALUATOR_CANDIDATE),
        },
        "calibration": {
            "runs": CalibrationRun.query.count(),
            "cases": CalibrationCase.query.count(),
            "reliability_by_evaluator": evaluator_reliability(examples=approved),
            "recent": [
                {"id": r.id, "status": r.status, "decision": r.decision,
                 "name": r.name}
                for r in calibrations
            ],
        },
        "generated_at": now_local().isoformat(),
    }


def list_examples(status: Optional[str] = None,
                  course_ids: Optional[Sequence[int]] = None
                  ) -> List[Dict[str, Any]]:
    query = _scoped_examples_query(course_ids)
    if status:
        query = query.filter(LearningExample.status == status)
    rows = query.order_by(LearningExample.id.desc()).all()
    return [row.to_dict() for row in rows]


def _get_example(example_id: int) -> LearningExample:
    example = LearningExample.query.get(example_id)
    if example is None:
        raise LearningError("learning example not found", "not_found", status=404)
    return example


def approve_example(example_id: int, actor_id: Optional[int]) -> Dict[str, Any]:
    """Explicitly approve a correction candidate for calibration use."""
    example = _get_example(example_id)
    before = {"status": example.status}
    example.status = LEARNING_APPROVED
    example.approved_by = actor_id
    example.approved_at = now_local()
    persistence.db_commit()
    persistence.audit(
        action="learning_example_approved", entity_type="learning_example",
        entity_id=example.id, before=before,
        after={"status": example.status}, actor_id=actor_id)
    return example.to_dict()


# ---------------------------------------------------------------------------
# Deterministic calibration
# ---------------------------------------------------------------------------

def _candidate_scores(example: LearningExample) -> Dict[str, Tuple[float, float]]:
    """Candidate marks must come from a recorded candidate evaluator run."""
    tags = example.tags if isinstance(example.tags, dict) else {}
    return _score_map(tags.get("candidate_scores"))


def _collect_cases(evaluator_name: str,
                   dataset_version: Optional[str]) -> List[LearningExample]:
    query = LearningExample.query.filter_by(status=LEARNING_APPROVED)
    if dataset_version:
        query = query.filter(LearningExample.dataset_version == dataset_version)
    rows = query.order_by(LearningExample.id.desc()).all()
    useful = []
    for row in rows:
        if not _score_map(row.instructor_scores):
            continue
        if evaluator_name and row.evaluator_name and row.evaluator_name != evaluator_name:
            continue
        useful.append(row)
    return useful


def start_calibration(evaluator_name: str, candidate_version_id: int,
                      actor_id: Optional[int],
                      dataset_version: Optional[str] = None) -> Dict[str, Any]:
    """Compare candidate vs production scores using only recorded evidence."""
    evaluator_name = str(evaluator_name or "").strip()
    if not evaluator_name:
        raise LearningError("evaluator_name is required", "invalid_payload")

    candidate = EvaluatorVersion.query.get(candidate_version_id)
    if candidate is None or candidate.name != evaluator_name:
        raise LearningError("candidate evaluator version not found",
                            "not_found", status=404)

    baseline = (EvaluatorVersion.query
                .filter(EvaluatorVersion.name == evaluator_name,
                        EvaluatorVersion.status == EVALUATOR_ACTIVE,
                        EvaluatorVersion.id != candidate.id)
                .order_by(EvaluatorVersion.id.desc()).first())

    examples = _collect_cases(evaluator_name, dataset_version)
    usable = [e for e in examples if _candidate_scores(e)]
    started = now_local()

    run = CalibrationRun(
        name=f"{evaluator_name}: {candidate.version} vs "
             f"{baseline.version if baseline else 'no active version'}",
        status="pending",
        dataset_version=dataset_version,
        baseline_evaluator_version_id=baseline.id if baseline else None,
        candidate_evaluator_version_id=candidate.id,
        case_count=len(examples),
        started_at=started,
        created_by=actor_id,
    )
    persistence.db_add(run)
    persistence.db_flush()

    for example in examples:
        candidate_scores = _candidate_scores(example)
        expected = _score_map(example.instructor_scores, candidate_scores)
        baseline_scores = _score_map(example.original_scores, candidate_scores)
        base_err = _normalised_errors(expected, baseline_scores)
        cand_err = _normalised_errors(expected, candidate_scores)
        baseline_mae = round(mean(base_err) * 100.0, 4) if base_err else None
        candidate_mae = round(mean(cand_err) * 100.0, 4) if cand_err else None
        if baseline_mae is None or candidate_mae is None:
            verdict = "unevaluable"
        elif candidate_mae < baseline_mae:
            verdict = "improved"
        elif candidate_mae > baseline_mae:
            verdict = "regressed"
        else:
            verdict = "equal"
        evaluator_name, evaluator_version = _evaluator_identity(example)
        identity_notes = None
        if evaluator_name or evaluator_version:
            identity_notes = json.dumps({
                "evaluator_name": evaluator_name or None,
                "evaluator_version": evaluator_version or None,
            }, sort_keys=True)
        # JSON columns serialise tuples as arrays; persist explicit score dicts
        # so calibration cases stay readable by the same score normaliser.
        candidate_payload = {
            key: {"marks": marks, "maximum": maximum}
            for key, (marks, maximum) in candidate_scores.items()
        } or None
        persistence.db_add(CalibrationCase(
            run_id=run.id,
            submission_type=example.submission_type,
            submission_id=example.submission_id,
            course_id=example.course_id,
            expected_scores=example.instructor_scores,
            baseline_scores=example.original_scores,
            candidate_scores=candidate_payload,
            baseline_error=baseline_mae,
            candidate_error=candidate_mae,
            verdict=verdict,
            notes=identity_notes,
        ))

    insufficient: List[str] = []
    if baseline is None:
        insufficient.append("no active production evaluator version")
    if len(examples) < MIN_CALIBRATION_CASES:
        insufficient.append(
            f"only {len(examples)} approved case(s); "
            f"{MIN_CALIBRATION_CASES} required")
    if len(usable) < MIN_CALIBRATION_CASES:
        insufficient.append(
            f"only {len(usable)} case(s) have recorded candidate scores; "
            f"{MIN_CALIBRATION_CASES} required")

    if insufficient:
        run.status = "insufficient_data"
        run.decision = "insufficient_data"
        run.decision_note = "; ".join(insufficient)[:4000]
        run.metrics = {
            "reason": run.decision_note,
            "minimum_cases": MIN_CALIBRATION_CASES,
            "available_cases": len(examples),
            "candidate_scored_cases": len(usable),
            "by_evaluator_case_counts": _identity_case_counts(examples),
        }
    else:
        candidate_maps = [_candidate_scores(e) for e in usable]
        expected_maps = [_score_map(e.instructor_scores, candidate)
                         for e, candidate in zip(usable, candidate_maps)]
        baseline_maps = [_score_map(e.original_scores, candidate)
                         for e, candidate in zip(usable, candidate_maps)]

        def _mean_metric(key: str) -> Optional[float]:
            values = [_metrics_for(exp, actual)[key]
                      for exp, actual in zip(expected_maps, baseline_maps)]
            values = [v for v in values if v is not None]
            return round(mean(values), 4) if values else None

        def _candidate_metric(key: str) -> Optional[float]:
            values = [_metrics_for(exp, actual)[key]
                      for exp, actual in zip(expected_maps, candidate_maps)]
            values = [v for v in values if v is not None]
            return round(mean(values), 4) if values else None

        def _override_rate(maps: Sequence[Dict[str, Tuple[float, float]]]
                           ) -> Optional[float]:
            values: List[float] = []
            for exp, actual in zip(expected_maps, maps):
                agreement = _metrics_for(exp, actual)["criterion_agreement"]
                if agreement is not None:
                    values.append(1.0 - agreement)
            return round(mean(values), 4) if values else None

        run.status = "completed"
        run.decision = "pending_approval"
        run.decision_note = (
            "metrics computed from approved corrections; activation requires "
            "explicit administrator approval")
        run.metrics = {
            "case_count": len(usable),
            "baseline": {
                "mae": _mean_metric("mae"),
                "criterion_agreement": _mean_metric("criterion_agreement"),
                "false_pass_rate": _mean_metric("false_pass_rate"),
                "false_fail_rate": _mean_metric("false_fail_rate"),
                "override_rate": _override_rate(baseline_maps),
            },
            "candidate": {
                "mae": _candidate_metric("mae"),
                "criterion_agreement": _candidate_metric("criterion_agreement"),
                "false_pass_rate": _candidate_metric("false_pass_rate"),
                "false_fail_rate": _candidate_metric("false_fail_rate"),
                "override_rate": _override_rate(candidate_maps),
            },
            # Global aggregates above are unchanged. These breakdowns answer the
            # same questions per evaluator version when identity was recorded.
            "by_evaluator": evaluator_reliability(examples=usable,
                                                  score_source="baseline"),
            "by_evaluator_candidate": evaluator_reliability(
                examples=usable, score_source="candidate"),
        }

    run.finished_at = now_local()
    persistence.db_commit()
    persistence.audit(
        action="calibration_started", entity_type="calibration_run",
        entity_id=run.id, before=None,
        after={"status": run.status, "decision": run.decision,
               "case_count": run.case_count}, actor_id=actor_id,
        reason=f"calibration of {evaluator_name} {candidate.version}")
    logger.info("AAGE calibration %s finished as %s", run.id, run.status)
    return get_calibration(run.id)


def get_calibration(run_id: int,
                    course_ids: Optional[Sequence[int]] = None) -> Dict[str, Any]:
    run = CalibrationRun.query.get(run_id)
    if run is None:
        raise LearningError("calibration run not found", "not_found", status=404)
    payload = run.to_dict()
    case_query = run.cases
    if course_ids is not None:
        ids = [int(value) for value in course_ids]
        case_query = case_query.filter(CalibrationCase.course_id.in_(ids or [-1]))
    cases: List[Dict[str, Any]] = []
    for case in case_query.order_by(CalibrationCase.id).all():
        case_name, case_version = _evaluator_identity(case)
        cases.append({
            "id": case.id,
            "submission_type": case.submission_type,
            "submission_id": case.submission_id,
            "course_id": case.course_id,
            "evaluator_name": case_name or None,
            "evaluator_version": case_version or None,
            "expected_scores": case.expected_scores or {},
            "baseline_scores": case.baseline_scores or {},
            "candidate_scores": case.candidate_scores or {},
            "baseline_error": case.baseline_error,
            "candidate_error": case.candidate_error,
            "verdict": case.verdict,
        })
    payload["cases"] = cases
    return payload


# ---------------------------------------------------------------------------
# Version activation / rollback (explicit, audited)
# ---------------------------------------------------------------------------

def _get_version(version_id: int) -> EvaluatorVersion:
    version = EvaluatorVersion.query.get(version_id)
    if version is None:
        raise LearningError("evaluator version not found", "not_found", status=404)
    return version


def approve_evaluator_version(version_id: int,
                              actor_id: Optional[int]) -> Dict[str, Any]:
    """Activate a version after explicit authorization. No prompt/model edits."""
    version = _get_version(version_id)
    if version.status in (EVALUATOR_RETIRED, EVALUATOR_ROLLED_BACK):
        # A rolled-back/retired version can be re-activated deliberately, but
        # only by this explicit call and with an audit row.
        pass
    previous = (EvaluatorVersion.query
                .filter(EvaluatorVersion.name == version.name,
                        EvaluatorVersion.status == EVALUATOR_ACTIVE,
                        EvaluatorVersion.id != version.id)
                .order_by(EvaluatorVersion.id.desc()).first())

    before = {"status": version.status,
              "previous_active_id": previous.id if previous else None}
    if previous is not None:
        previous.status = EVALUATOR_RETIRED
        previous.retired_at = now_local()
    version.status = EVALUATOR_ACTIVE
    version.activated_at = now_local()
    version.activated_by = actor_id
    version.supersedes_id = previous.id if previous else None
    persistence.db_commit()
    persistence.audit(
        action="evaluator_version_approved", entity_type="evaluator_version",
        entity_id=version.id, before=before,
        after={"status": version.status,
               "supersedes_id": version.supersedes_id},
        actor_id=actor_id,
        reason=f"activated {version.name} {version.version}")
    return version.to_dict()


def rollback_evaluator_version(version_id: int,
                               actor_id: Optional[int]) -> Dict[str, Any]:
    """Deactivate a version and restore the most recent earlier version."""
    version = _get_version(version_id)
    if version.status != EVALUATOR_ACTIVE:
        raise LearningError("only an active version can be rolled back",
                            "invalid_status", status=409)
    previous = (EvaluatorVersion.query
                .filter(EvaluatorVersion.name == version.name,
                        EvaluatorVersion.id < version.id,
                        EvaluatorVersion.status.in_(
                            (EVALUATOR_RETIRED, EVALUATOR_ACTIVE)))
                .order_by(EvaluatorVersion.id.desc()).first())

    before = {"active_version_id": version.id,
              "restored_version_id": previous.id if previous else None}
    version.status = EVALUATOR_ROLLED_BACK
    version.retired_at = now_local()
    if previous is not None:
        previous.status = EVALUATOR_ACTIVE
        previous.activated_at = now_local()
        previous.activated_by = actor_id
        previous.retired_at = None
    persistence.db_commit()
    persistence.audit(
        action="evaluator_version_rolled_back", entity_type="evaluator_version",
        entity_id=version.id, before=before,
        after={"rolled_back_status": version.status,
               "active_version_id": previous.id if previous else None},
        actor_id=actor_id,
        reason=f"rolled back {version.name} {version.version}")
    return {
        "rolled_back": version.to_dict(),
        "restored": previous.to_dict() if previous else None,
    }


__all__ = [
    "LearningError", "MIN_CALIBRATION_CASES", "learning_insights",
    "list_examples", "approve_example", "evaluator_reliability",
    "start_calibration", "get_calibration", "approve_evaluator_version",
    "rollback_evaluator_version",
]
