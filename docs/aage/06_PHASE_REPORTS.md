# AAGE — Phase completion reports

Status vocabulary: **COMPLETE**, **PARTIAL**, **BLOCKED**, **FAILED**.
A phase is COMPLETE only when its working code, focused tests and recorded
verification are present. Limitations that are intentional and documented do not
make a phase partial unless the brief required the missing capability.

---

## Phase 1 — Foundation and database integrity

**Status: COMPLETE** (AAGE scope; pre-existing legacy migration risks recorded)

### Features audited
14 AAGE models/tables, extended `rubrics` / `rubric_criteria`, FKs, unique
constraints, indexes, Alembic migration, runtime `create_all` / self-heal,
advisory-lock DDL, model exports, historical rubric versions/results/audit logs.

### Already complete before this round
- AAGE tables reuse existing submission/rubric/assignment/project models; no
  duplicate grading system.
- Immutable `rubric_versions` with checksum and `(rubric_id, version)` uniqueness;
  results retain `rubric_snapshot`.
- Append-only `grading_audit_logs`; no destructive AAGE alter on `upgrade()`.

### Fixed
- **Migration non-idempotency and drift.** Rewrote
  `a7a8e1c3f5b2_add_aage_engine_tables.py` with guarded table/column/index
  creation, a single parent (`d9e8f7a6b5c4`), corrected index names
  (`ix_grading_jobs_created`, `ix_evaluation_results_course_id`), restored FKs
  and added `ix_grading_profiles_course_id`.
- **Fresh `flask db upgrade` failure.** The historical migration chain is
  alter-only and initially failed with `NoSuchTableError: announcements`.
  A narrow bootstrap now runs only when the database has zero tables: create the
  model-authoritative schema, ensure AAGE schema and stamp the head. Existing and
  legacy databases still traverse the real migration chain.
- **Advisory lock did not cover DDL.** `_auto_migrate_missing_columns()` and
  `ensure_aage_schema()` now accept the locked PostgreSQL `Connection`.
- **Lock timeout could crash boot.** `TimeoutError` is handled as a transient DB
  failure alongside `ProgrammingError` and `OperationalError`.
- **Model import symmetry.** `Rubric`, `RubricCriterion`, `FeedbackTemplate`,
  `GradingHistory` and `GradingSession` are exported from `src.models`.
  `Rubric.approver` uses an explicit `primaryjoin` because `approved_by` is a
  plain logical id.
- Removed an unused `ensure_aage_schema` import from `rubric_intelligence.py`.
- **AAGE table column drift.** `ensure_aage_schema()` now also repairs missing
  additive columns on AAGE tables (specifically `evaluation_runs.cost`), and the
  migration adds it in a guarded way. This fixed a live `500` where the running
  dev database predated the cost column and `/api/v1/aage/analytics` selected it.
- **Legacy `rubrics` table drift.** The running dev database was created by an
  older `Rubric` model (`name` / `created_by` / `max_score` / `assignment_type`),
  so every AAGE rubric query selected columns the table did not have and
  `/api/v1/aage/assessments/<kind>/<id>/rubric[\/versions]` returned `500`
  (`no such column: rubrics.title`). The self-heal and the guarded migration now
  add the base model columns (`title`, `instructor_id`, `course_id`,
  `is_template`, `total_points`) and backfill them from the legacy names, so any
  `Rubric.query` works again without a new Alembic revision.
- **Legacy `rubrics` INSERT failure.** With reads fixed, the AI rubric generator
  still returned `500` on `NOT NULL constraint failed: rubrics.name`: the legacy
  table's unmapped `name` / `is_active` columns were required by SQL but never
  populated by the current model. `Rubric` now maps both legacy columns with
  safe defaults (`name=''`, `is_active=True`), and a guarded reverse backfill
  keeps a model-created DB coherent. Rubric INSERTs now succeed on both schemas.
- **General model↔DB column reconciliation.** A full diff found four long-lived
  tables with other missing mapped columns (`rubric_criteria.created_at`,
  `feedback_templates.*`, `project_submissions.created_at`,
  `grading_sessions.*`). `ensure_aage_schema()` now ends with an additive,
  idempotent sweep that adds any mapped column an existing table lacks, so drift
  in tables beyond the named rubric repairs cannot surface as `no such column`
  500s.

### Added
- `backend/tests/test_aage_migration.py`: migration idempotency, schema/index
  parity, FK presence, reversible downgrade, fresh upgrade/stamp, model exports,
  legacy `evaluation_runs.cost` repair, legacy `rubrics` base-column repair
  (with backfill), legacy NOT NULL INSERT compatibility, criterion `created_at`
  repair, and the general reconciliation sweep.
- AAGE worker/timeout settings in `backend/.env.example`.

### Verification
- `flask db heads`: single head `a7a8e1c3f5b2`.
- Fresh SQLite upgrade: 114 tables, AAGE tables present,
  `alembic_version = a7a8e1c3f5b2`.
- `pytest ... test_aage_migration.py`: 7 passed.
- AAGE suite at this point: 58 passed.

### Limitations
- Pre-existing legacy migration revisions still contain destructive dedupe
  deletes and destructive downgrades; they were not rewritten.
- `ensure_aage_schema()` still logs additive-column failures non-fatally; no
  dedicated schema-health probe was added.
- No live PostgreSQL migration was possible in this environment.

---

## Phase 2 — Dynamic rubric intelligence

**Status: COMPLETE**

### Fixed
- Criterion vocabulary mismatch: generation/scoring use `key` / `max_marks`,
  while ORM snapshots use `criterion_key` / `max_points`. Both aliases are now
  emitted and accepted, so editing a persisted rubric no longer silently resets
  a criterion's mark scale.
- Non-finite rubric numbers are rejected in validation and ignored safely by the
  weight-total helper; NaN can no longer poison a whole rubric.
- Frontend `RubricCriterion` now carries `max_marks` and optional `key`; the
  builder exposes a Max marks field and sends both aliases.
- `normalizeRubricPayload()` bridges API/ORM vocabularies and lifts nested
  `levels` into `performance_levels` for the editor.
- `not_found` rubric state is detected by typed `AageError.code`, not only by
  message regex.

### Added
- `backend/tests/test_aage_rubric.py` (3 tests).
- `normalizeRubricPayload` and its frontend unit test.

### Verification
- Backend AAGE suites: **61 passed**.
- Frontend service tests: **34 passed** (Node 22).
- TypeScript: 162 pre-existing errors elsewhere in the repo, **0** in AAGE files.

### Limitations
- Rubric generation still falls back to a deterministic template when no model
  is configured; this is intentional and always forces review.
- AI-generated rubrics remain drafts until an instructor approves them.

---

## Phase 3 — Secure submission processing and evaluators

**Status: COMPLETE**

### Features
- `ArtifactAnalyzer` extracts ZIP/text/code/document artefacts with path-traversal
  rejection, per-file and total-size caps, bounded nesting and checksum manifests;
  no submitted code is executed in Flask or the worker.
- Five registered evaluators (`frontend`, `backend`, `data_science`,
  `spreadsheet`, `documents`) with explicit capability/limitation declarations.
  Browser/API/notebook adapters are honest static-analysis placeholders.
- Deterministic registry selection: requested → rubric-recommended → criterion
  hint → compatible fallback; admin-disabled evaluators are excluded.
- Schema-validated LLM output with bounded repair attempts and provider timeouts.

### Verification
- `test_aage_security.py`: ZIP traversal, size caps, safe text extraction.
- `test_aage_registry.py`: selection order and disabled-evaluator exclusion.
- E2E scenarios 1–3 (frontend ZIP, backend project, data science) all pass with
  the real analyzer, registry and orchestrator (only the network call stubbed).

### Limitations
- No runtime browser/API/notebook execution by design.
- `spreadsheet` evaluator needs the provider for criteria outside the deterministic
  Excel analyzers; otherwise those criteria degrade to zero/unverified.

---

## Phase 4 — Orchestration, jobs and deterministic grading

**Status: COMPLETE**

### Fixed
- Cancellation could land after orchestration and still publish: CAS state
  transitions plus rechecks immediately before the irreversible write; cancel,
  retry and force-enqueue supersede active results instead of deleting them.
- Retry inserted duplicate results: retries are result-idempotent and preserve
  audit rows (`test_retry_supersedes_results_without_deleting_audit_rows`).
- Stale-lock recovery used time only and was unbounded: bounded lease/marker
  recovery with per-attempt progress; an explicit `timeout_seconds` remains
  authoritative. No new job-status schema migration was needed.
- `budget_exhausted` was reported for unrelated failures: the real error code
  now reaches outcomes, audit and retry classification; the misleading retry
  branch was removed.
- Evaluator conflicts reported a resolution but not the winner: added
  `selected_evaluator` / `selected_marks` while keeping existing `resolution`.

### Added
- `backend/tests/test_aage_reliability.py` (8 tests).

### Verification
- Focused AAGE suite (all AAGE modules + reliability): **69 passed**.
- E2E scenarios 1–7 exercise the real orchestrator end to end.
- `git diff --check`: clean.

### Limitations
- Stale-lock lease state is in-process, not durable across process restarts or
  shared between workers (no-migration design choice).
- Timeouts are cooperative at the provider boundary: a non-cooperative trusted
  callable can hold its daemon thread until it returns.

---

## Phase 5 — Evidence, confidence and publication control

**Status: COMPLETE**

### Fixed
- Auto-publication could bypass hard deterministic gates:
  `write_through_grade(..., publication_mode="auto")` is now the authoritative
  path and enforces every gate independently of the confidence number; manual
  mode is reserved for explicit instructor approval
  (`test_auto_publication_cannot_bypass_hard_gate`).
- Policy updates could report success without persisting:
  `PolicyPersistenceError`, persisted-value verification and best-effort audit
  make updates fail closed (`test_policy_update_fails_closed_when_storage_fails`).
- Student payloads could expose non-array `recommended_resources`: now a
  validated stored array or `[]`.
- AAGE no longer holds every evidenced submission for instructor review. A
  separate default-on `auto_approved` track mirrors Excel's 70% confidence gate,
  promotes real file citations from rationales into validated evidence, and
  ignores only verification/meta review signals. Provisional rubrics, failed
  deterministic checks, conflicts, `UNVERIFIED` evidence and genuinely low
  publishability confidence still block. All publication modes still use the
  shared write-through helper (`test_aage_auto_approval.py`).

### Verification
- Focused AAGE suite: **69 passed** at initial delivery; Excel-style auto-approval
  adds **15 passed** in `test_aage_auto_approval.py`.
- E2E failed-provider scenario confirms zero marks, forced review, low confidence
  and no write-through to the official submission grade.

### Limitations
- `EvaluationResult` has no stored `recommended_resources` yet, so the student
  payload safely returns `[]` until such data exists.

---

## Phase 6 — Instructor review, learning and calibration

**Status: COMPLETE**

### Fixed
- `submit_correction()` now persists the **pre-correction AI candidate scores**
  (recovered from the review audit trail) separately from instructor scores, so
  calibration compares like with like. Rubric maxima come from the frozen
  rubric/persisted criteria.
- Mark updates, corrections and learning-example creation append actor,
  correlation and course/assessment/submission context to the audit log; rows are
  never rewritten.
- Per-evaluator reliability: `evaluator_reliability()` plus
  `by_evaluator` / `by_evaluator_candidate` on calibration runs and
  `calibration.reliability_by_evaluator` in insights. No global-only inference.
- Corrections create `candidate` examples and never auto-approve/publish.
  Calibration still requires ≥3 approved examples **with** candidate scores;
  otherwise it returns `insufficient_data` with case counts and no fabricated MAE.

### Added
- `backend/tests/test_aage_learning.py` (5 focused tests).
- E2E scenario 4: three instructor corrections → approved learning examples →
  calibration with `case_count == 3` and per-evaluator metrics.

### Verification
- Focused learning suite: **5 passed**.
- `test_aage_api.py` + `test_aage_learning.py`: **20 passed**.
- E2E instructor-correction scenario: **passed**.
- `git diff --check`: clean (including explicit check on untracked files).

### Limitations
- Evaluator identity on `CalibrationCase` lives in `notes` JSON rather than
  first-class columns (model changes were out of scope).
- A pre-existing `test_aage_pipeline.py` SQLite lock failure occurs when run in
  the combined command; the new learning tests defensively roll back the shared
  session and pass in isolation and with the API suite.

---

## Phase 7 — API, permissions, audit and operations

**Status: COMPLETE**

### Fixed
- Learning insights, learning examples, calibration detail and calibration cases
  are course-scoped for instructors; admins remain global and audit-logged.
  Foreign-course and owned-course tests pass.
- All mutations (rubric, job, review, correction, calibration, policy,
  publication) append to `grading_audit_logs` with before/after, actor and
  correlation id.
- Envelope, pagination (`page` / `per_page`, max 100), typed `not_found` and
  structured error codes are consistent across all 35 AAGE URL rules.

### Verification
- Route map: 35 AAGE rules under `/api/v1/aage`, no `/api/v2` dependency.
- `test_aage_api.py` and `test_aage_reliability.py`: ownership, fail-closed
  policy, student resource shape and audit assertions pass.

### Limitations
- Admin endpoints are intentionally global; admins may query any `course_id`,
  while instructors cannot.

---

## Phase 8 — Frontend completion

**Status: COMPLETE**

### Fixed
- Grading policies aligned to the backend `0–100` contract, defaults,
  `require_all_gates` and validation; backend `0–1` aggregate ratios are
  normalised once in `aage.service.ts` (analytics, evaluator catalogue,
  calibration detail).
- Calibration recent-run list sourced from `learning.insights.calibration.recent`
  with detail-by-ID loading via the existing detail endpoint.
- Typed `not_found` handling and student-safe error classification using
  structured code/status only; raw provider/model errors are never shown to
  students.
- Student grading history via the existing results API with field whitelisting
  and submission/user double-checks.
- Pure role gating helpers, admin-only controls, course-scoped reports and
  SSR-safe query handling.
- Pure formatting/report adapters with unit coverage.

### Added
- `aage-contracts.test.ts` (7 tests) and expanded `aage-service.test.ts` (47 tests).

### Verification
- Node 22: **54 tests, 54 passed, 0 failed**.
- `npx tsc --noEmit -p tsconfig.json`: exit 2 with **162 pre-existing errors** in
  unrelated files; **0 AAGE-specific errors**.
- `git diff --check`: clean (including untracked-file check).

### Limitations
- No browser/component E2E: React Testing Library is not installed; pure adapters
  and service contracts are covered, but rendered-component behaviour is not.
- Admin AAGE controls exist but `/instructor/assessment-intelligence` is not
  reachable for admins because the out-of-scope instructor layout guard requires
  `role === 'instructor'`.

---

## Phase 9 — Final verification, E2E, benchmarks and delivery

**Status: COMPLETE**

### Verified
- Seven required E2E scenarios run in one command: **7 passed** (3.67 s).
  Only the network provider call is stubbed; grades/confidence/review states are
  real outputs of the orchestrator.
- Existing LMS regression suites (scoring unification, certificate consistency,
  certificate system, progress completion): **67 passed**.
- Focused AAGE suite (API, pipeline, registry, security, migration, rubric,
  reliability): **76 passed** (20.46 s) at phase delivery; later work adds
  auto-approval and dispatch regressions (see combined count below).
- Combined AAGE run (focused + learning + all 7 E2E scenarios): **88 passed**
  (22.40 s) at phase delivery. The E2E calibration scenario isolates its dataset
  with a unique `dataset_version` so it cannot pick up examples from other suites.
- Full backend suite: **540 passed, 1 skipped, 13 failed** (343.62 s). All 13
  failures are pre-existing payment-slip OCR tests blocked by the missing
  `pytesseract` module; no AAGE/grading/upload test failed. The previously
  observed order-dependent `422` in `test_completion_state_get_is_read_only`
  passes alone and remains documented as a pre-existing intermittent issue.
- Frontend Node 22: **54 passed, 0 failed**; TypeScript **0 AAGE errors**
  (162 pre-existing unrelated errors remain).
- Post-delivery submission-dispatch fix: `test_aage_api.py` **20 passed** and
  all Node 22 frontend tests **210 passed** at the time; after the policy-field
  additions the full frontend suite is **220 passed, 0 failed**. TypeScript
  reports **0 errors** in the changed files. The legacy Excel result endpoint
  is no longer called for AAGE submissions, including submissions made before
  the fix.
- Post-delivery rubric-expansion fix: `test_grading_submission_detail.py`
  **4 passed**, covering assignment/project details, the default no-rubric
  response, and a missing rubric row.
- Post-delivery HTML-submission fix: `test_submission_html_download.py`
  **4 passed** (auth walls still rejected; declared HTML accepted; AAGE manifest
  keeps declared files). A live re-run of submission 11 produced a `ready`
  artifact (5464 bytes) and rationales citing the real `contact_form.html`.
- Post-delivery Excel-style auto-approval: `test_aage_auto_approval.py`
  **15 passed**. Combined API + pipeline + registry + reliability + E2E +
  auto-approval + detail + HTML check: **80 passed**. AAGE frontend service and
  contract tests: **55 passed**; the full Node 22 frontend suite: **220 passed,
  0 failed**. A live deterministic-provider regrade of submission 11 reached
  `published` automatically (`publication_mode=auto_approved`, `is_official=1`,
  `requires_review=0`, confidence 77.94) without manual approval.
- Alembic: single head `a7a8e1c3f5b2`; fresh SQLite upgrade verified in Phase 1.
- `git diff --check`: clean.

### Quality-gate honesty
- MAE, agreement, false pass/fail and override rate are derived only from
  approved calibration cases or stored versions; missing data yields
  `insufficient_data` / `None`, never invented values.
- Processing time comes from real `EvaluationRun.duration_ms`.
- LLM usage records real call counts and character counts; token and dollar
  cost remain null because the provider exposes no usage signal.

### Limitations
- No live provider benchmark, labelled corpus, PostgreSQL migration, load test,
  SAST scan or browser component E2E was executed in this environment.
