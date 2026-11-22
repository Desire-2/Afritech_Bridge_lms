# AAGE HTTP API reference

Base path: `/api/v1/aage`. All endpoints require `Authorization: Bearer <JWT>` and
use the same JWT/role model as the rest of v1. This is deliberate: `/api/v2`
requires an API key scope that the existing frontend does not have.

## Conventions

Success:

```json
{
  "success": true,
  "data": { "...": "..." },
  "meta": { "page": 1, "per_page": 20, "total": 42 }
}
```

Failure:

```json
{
  "success": false,
  "error": {
    "code": "forbidden",
    "message": "You do not own this course",
    "details": {}
  }
}
```

List endpoints support `page` (default 1) and `per_page` (default 20, max 100).
`kind` and `submission_type` accept only `assignment` or `project`.

Authorization rules:

- Students may read **only their own** published results/evidence.
- Instructors may act only on courses where `course.instructor_id == their id`.
- Admins bypass ownership checks but every mutation is audit-logged.
- Rubric approval, grade publication, reviewer decisions, evaluator-version
  approval/rollback and policy changes are instructor/admin-only.

---

## Assessment and rubric intelligence

| Method | Path | Purpose |
|---|---|---|
| POST | `/assessments/<kind>/<id>/analyze` | Describe/classify an assignment or project and return evidence requirements, recommended evaluators and unverifiable requirements. Does not grade. |
| POST | `/assessments/<kind>/<id>/rubric/generate` | Generate an AI rubric draft (weights, levels, evidence needs, evaluator hints). Creates a new draft version; never overwrites an approved version. |
| GET | `/assessments/<kind>/<id>/rubric` | Current rubric including criteria and version metadata. |
| PUT | `/rubrics/<id>` | Edit a draft rubric in place. Approved or already-used rubrics are forked into a new draft (`parent_rubric_id` set); the original and its versions are never rewritten. The response contains the new draft id. |
| POST | `/rubrics/<id>/approve` | Instructor approval; freezes an immutable `RubricVersion` snapshot. |
| GET | `/assessments/<kind>/<id>/rubric/versions` | Version history, oldest first. |

Rubric criteria must have numeric weights summing to exactly 100 before approval.
Each criterion has a stable `criterion_key`, `max_marks`, performance `levels`,
`evidence_requirements` and evaluator instructions.

## Grading jobs and results

| Method | Path | Purpose |
|---|---|---|
| POST | `/grading/start` | Enqueue a persistent, idempotent job. Body: `{"submission_type":"assignment","submission_id":123,"evaluators":["backend"]}`. Repeating an active identical request returns the existing job. |
| GET | `/grading/jobs?page=&per_page=&course_id=&assessment_id=&submission_type=&status=&evaluator=&date_from=&date_to=` | Paginated grading queue scoped to the caller's courses (students see only their own). `meta` carries `page`, `per_page`, `total`, `pages`. |
| GET | `/grading/results?page=&per_page=&course_id=&assessment_id=&submission_type=&status=&requires_review=&confidence=&evaluator=&date_from=&date_to=` | Paginated result history with the same scoping. List rows omit the per-criterion breakdown. |
| GET | `/grading/jobs/<id>` | Job status, progress stage, attempts, timestamps and correlation id. |
| POST | `/grading/jobs/<id>/retry` | Retry a failed/timed-out job with bounded backoff. |
| POST | `/grading/jobs/<id>/cancel` | Cancel a queued/running job without leaving an ambiguous grade. |
| GET | `/grading/results/<id>` | Authoritative result, score, confidence, review state and criterion breakdown. |
| GET | `/grading/results/<id>/evidence` | Evidence rows with category, locator, summary and verification status. |
| POST | `/grading/results/<id>/publish` | Publish after policy check and review approval. Writes through the canonical submission grade path. |
| GET | `/student/results/<submission_id>?submission_type=` | A signed-in student's **own published** result for one submission. Returns a whitelisted projection (title, score, criteria, feedback); unpublished or foreign results are `404`. |

Results are `pending_review` only when a real blocker is recorded: a provisional
rubric, a failed deterministic check, evaluator conflict, `UNVERIFIED` evidence,
or insufficient publishability confidence. A successful job with evidenced
`CODE_SUPPORTED` / `CONTENT_SUPPORTED` criteria self-approves and writes the
canonical grade automatically, matching the Excel grader's behaviour. A model
never writes the grade itself; publication always reuses the shared
write-through helper. The stricter `auto_publish` gate remains opt-in.

## Instructor review

| Method | Path | Purpose |
|---|---|---|
| GET | `/reviews/pending?course_id=&page=&per_page=` | Pending reviews with minimal student-identifying data. |
| GET | `/reviews/<id>` | Full review packet: submission view, artifacts, AI result, criterion scores, evidence, feedback, confidence and history. |
| PUT | `/reviews/<id>/criteria/<key>` | Adjust one criterion: `{"marks": 7.5, "reason": "..."}`. Final score is recomputed deterministically. |
| POST | `/reviews/<id>/correction` | Record an explanation and optionally create a learning example from original vs adjusted scores. |
| POST | `/reviews/<id>/approve` | Approve the reviewed result for publication. |
| POST | `/reviews/<id>/reject` | Reject with `{"reason": "..."}`; result is not published. |

All mark changes and decisions append to `grading_audit_logs`.

## Learning and calibration

| Method | Path | Purpose |
|---|---|---|
| GET | `/learning/insights` | Aggregate summary `{examples, correction_impact, evaluators, calibration, generated_at}`. The frontend renders these as insight cards; no student work or raw evaluator internals are returned. |
| GET | `/learning/examples?status=` | Approved/pending/rejected learning examples. `status` is optional. |
| POST | `/learning/examples/<id>/approve` | Approve one correction example for benchmark use. |
| POST | `/learning/calibration/start` | Deterministically compare a candidate evaluator version to production on approved examples. Body: `{"evaluator_name":"backend","candidate_version_id":12,"dataset_version":"v1"}`. |
| GET | `/learning/calibration/<id>` | Run status, MAE, criterion agreement, false pass/fail rates, override rate and per-case rows. |
| POST | `/learning/evaluator-versions/<id>/approve` | Explicitly activate a calibrated version. |
| POST | `/learning/evaluator-versions/<id>/rollback` | Restore the previous production version. |

If benchmark data is insufficient, the run reports `insufficient_data` with the
missing counts rather than fabricated metrics. No prompt/model changes silently.

## Analytics

| Method | Path | Purpose |
|---|---|---|
| GET | `/analytics?course_id=` | Instructor-facing dashboard metrics. `course_id` is required for instructors and checked for ownership; administrators may omit it for a platform-wide view. |

## Administration

| Method | Path | Purpose |
|---|---|---|
| GET | `/admin/evaluators` | Registered evaluators, versions, active state, compatibility metadata and aggregate quality metrics (MAE, agreement, override rate, sample count) from the active or newest version. |
| PATCH | `/admin/evaluators/<name>` | `{"active": false}`. Disables selection, not historical results. |
| GET | `/admin/policies` | Current confidence thresholds, review requirements, strict auto-publish flag and Excel-style auto-approval flag. |
| PUT | `/admin/policies` | Update policy thresholds. Accepts `auto_approve_enabled` / `auto_approve_min` in addition to the strict `auto_publish_*` keys. Audit-logged; applies to new runs only. |
| GET | `/admin/analytics?course_id=` | Dashboard metrics computed from persisted AAGE rows. |

## Status codes

- `200` success/read/update, `201` created/enqueued/approved, `202` accepted async job.
- `400` invalid payload or rubric weights, `403` forbidden, `404` not found.
- `409` invalid state transition (publish before approval, edit after grading, duplicate active job).
- `422` schema validation failure with field-level `details`.
- `500` unexpected failure; correlation id is included for support.
