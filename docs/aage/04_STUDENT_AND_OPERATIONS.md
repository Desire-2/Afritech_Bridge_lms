# Student results and operations

## Student-facing result view

Route: `/student/results/<submissionId>`.

A student can open this page only for their own submission. Eligible results are
published automatically after a successful grading job; blocked results show a
plain **under review** state until an instructor resolves them. Neither state
exposes evaluator internals, prompts, confidence scores, benchmark data or raw
artifact analysis. After publication it shows:

- final grade and status;
- per-criterion marks and short feedback;
- strengths and areas for improvement;
- recommended resources where the rubric provides them;
- the submission and assessment title for context.

If an instructor changed a mark, the student sees the corrected mark and feedback,
not the original AI proposal.

## Data and migration notes

The engine adds AAGE tables and **additive nullable columns** to `rubrics` and
`rubric_criteria`. No grading/progress table is duplicated and no existing column is
removed or rewritten.

At application startup:

1. all models are imported;
2. `db.create_all()` creates missing tables;
3. `ensure_aage_schema()` adds any missing additive columns using the same
   self-healing pattern already used by the legacy app.

The Alembic revision `a7a8e1c3f5b2` has multiple parent ids and is the single head
reported by `alembic heads`; the earlier “six divergent heads” description was
inaccurate. On a clean SQLite database, a full
`flask db upgrade` currently fails in a **pre-existing** initial migration that
reports a missing `announcements` table before it exists. This is unrelated to AAGE
and is handled in normal deployments by the existing `create_all()` bootstrap. Do
not point production at a brand-new empty database and rely only on `db upgrade`
without validating that legacy migration first.

## Running tests

From `backend/`:

```bash
venv/bin/python -m pytest tests/test_aage_pipeline.py \
  tests/test_aage_security.py tests/test_aage_api.py \
  tests/test_aage_registry.py -q --disable-warnings
```

The AAGE tests are offline: an autouse fixture replaces the AI provider call while
leaving schema validation active. They must never make a live model call.

From `frontend/`:

```bash
npx --yes tsx --test tests/aage-service.test.ts
npx tsc --noEmit -p tsconfig.json
```

## Operational safety rules

- No submitted code is executed by Flask, the job worker or any evaluator.
- Grading jobs are durable rows with locks, attempts, backoff, cancellation and a
  correlation id; there is no in-memory-only queue.
- AI output is schema-validated and treated as evidence/proposals, never as truth.
- Final marks and weights are computed by `scoring.py`; unverified evidence is capped.
- Published grades use the canonical LMS write-through path; no second cumulative
  grade calculation exists.
- Rubric versions, evaluator versions, policy changes and review decisions are
  immutable/audited; rollback is explicit.

## Troubleshooting

| Symptom | Likely cause / action |
|---|---|
| `under review` for many submissions | Check artifact resolution and evaluator conflict warnings; raise confidence thresholds only through the audited policy endpoint. |
| Job repeatedly fails | Inspect `grading_jobs.last_error` and correlation id; retry after fixing artifact access. |
| Rubric edit rejected | A used rubric cannot be rewritten. The API forks an editable draft linked to the original; approve the fork to use it. |
| Calibration says `insufficient_data` | Approve more instructor correction examples or calibration cases; metrics are not fabricated. |
| Student cannot see a result | Result is not published, or it belongs to another student. |
