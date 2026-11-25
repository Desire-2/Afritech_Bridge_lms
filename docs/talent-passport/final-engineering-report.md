# Talent Passport — Final engineering report (A–H)

Date: 2026-11-22
Scope: `backend/` Flask LMS module + `frontend/` Next.js app inside
`Afritech_Bridge_lms`.

> Verification policy: a statement is marked **Verified** only when the exact
> command and observed result are recorded in section F. Statements about code
> structure are labelled **Implemented** or **Source-inspected**. No live
> browser, production-build, or external-service claim is made.

---

## A. Requirement traceability

| Requirement | Implementation | Status |
|---|---|---|
| Full-stack delivery, backend and frontend | Flask feature module under `backend/src/talent_passport/`; Next.js routes/components under `frontend/src/app/student/talent-passport/`, `frontend/src/app/talent/[publicSlug]/`, and `frontend/src/components/talent-passport/`. | Verified by backend + frontend suites (F). |
| Module inside existing LMS, not a separate app | One blueprint registered in `backend/main.py`; models imported by `backend/src/models/__init__.py`; existing JWT auth and `User` identity reused. | Verified by full backend suite + migration verification (F). |
| Real LMS records only | Evidence references `(source_type, source_id)` into LMS submissions, attempts, certificates, achievements; no sample/synthetic data generator in product code. | Verified by targeted backend tests (F). |
| LMS remains source of truth via services/interfaces | Passport reads canonical enrollment/progress/certificate/achievement models and services; no second progress or certificate eligibility engine. | Source-inspected; canonical suite passed (F). |
| Profile overview, dashboard, skills, projects, certificates, achievements, timeline, career interests, completeness | Private routes + frontend pages for each area; completeness weights in `config.py` and serialized checks. | Verified by route/serialization tests and frontend tests (F). |
| Visibility, public/private, share, PDF, QR | Section toggles, explicit publish/unpublish, rotated slug, public whitelist serializer, PDF export, QR payload/link; QR text fallback in frontend because no QR library is installed. | Verified by privacy/public/PDF tests and frontend tests (F). |
| Instructor/admin mappings and admin controls | Admin skill CRUD, mapping CRUD, evidence verify/reject, audit list; instructors scoped to owned courses. | Verified by permission tests (F). |
| Automatic updates | Failure-isolated hooks on submission, grading, quiz, progress, certificate, achievement, AAGE and Excel paths; `sync_student` backfill fallback. | Verified by hook/canonical-path and idempotency tests (F); gaps in H. |
| Evidence states `LEARNING → EVIDENCE_SUBMITTED → DEMONSTRATED → VERIFIED` | Implemented in `enums.py`/`evidence.py`; no self-verification; proficiency only from mapped criteria. | Verified by state-transition tests (F). |
| Reuse canonical 70% threshold | `CourseProgressService` / `CertificateService` remain authoritative; Passport has no competing pass mark. `DEFAULT_DEMONSTRATION_SCORE = 70` is only a fallback for mapped evidence without an explicit `min_score`. | Source-inspected; canonical full suite passed (F). |
| Private by default, backend-enforced public filtering | All visibility defaults false; public serializer is whitelist-only; email/phone need explicit flags; grades/feedback/hashes/internal IDs omitted. | Verified by privacy/public tests (F). |
| Idempotent processing and in-place correction | Event ledger + unique evidence keys; corrected grades, resubmissions, certificate state changes and project updates update existing rows. | Verified by idempotency and correction tests (F). |
| Migrations, validation, pagination, safe errors, docs, tests | Additive guarded Alembic revision; input validation; `page`/`page_size` clamped 1–100; structured error envelope; this document set. | Verified by full suite + migration script (F). |

---

## B. Audit and architecture

The required audit was written **before** feature code and is preserved in
`docs/talent-passport/audit.md`. It covers, in order:

1. EXISTING STUDENT PROFILE
2. EXISTING LEARNING DATA
3. EXISTING EVIDENCE
4. EXISTING INTEGRATION
5. RECOMMENDED TALENT PASSPORT ARCHITECTURE
6. FILE-LEVEL IMPLEMENTATION PLAN (`implementation-plan.md`)

The chosen architecture is a single Flask feature module:

```
LMS source records → thin failure-isolated hooks → idempotent evidence engine
→ Passport domain tables → private/public APIs + PDF/QR → existing frontend
```

Data ownership is deliberate: the LMS owns identity, learning, grades,
certificates and achievements. The Passport owns taxonomy, mappings, curation,
derived skill state, publication and audit metadata. No original LMS record is
copied into a new authoritative table.

---

## C. Backend implementation

### Module files

| File | Responsibility |
|---|---|
| `backend/src/talent_passport/__init__.py` | Exports blueprint and `init_app`. |
| `enums.py` | Stable state/source/verification/visibility vocabularies. |
| `config.py` | Completeness weights, private defaults, pagination and public rate limit. |
| `models.py` | Eleven SQLAlchemy models mapped to the new tables. |
| `taxonomy.py` | Seed categories/skills and default mapping from `course_skill_profiles.py`. |
| `evidence.py` | Mapping resolution, grade provenance, idempotent upserts, state recomputation and per-student sync. |
| `sync.py` | Backfill entry point and re-exports. |
| `achievements.py` | Mirrors existing LMS achievements and verified skill badges only. |
| `services.py` | Validation, serialization, aggregation, publication and public/export payloads. |
| `pdf.py` | ReportLab PDF from already-filtered payloads, with QR link and disclaimer. |
| `hooks.py` | `notify_talent_passport(...)`: SAVEPOINT-isolated, idempotent, never raises. |
| `routes.py` | `/api/v1` student, public and admin endpoints. |

### API surface

- Student/private: profile, overview, skills, evidence, projects, certificates,
  achievements, timeline, completeness, visibility, publish, unpublish, sync,
  taxonomy, PDF export.
- Public: `GET /api/v1/talent/public/<slug>` and its PDF variant, JWT-free and
  rate-limited.
- Admin/instructor: taxonomy, mappings, evidence verify/reject and audit.

Full method/path details are in `docs/talent-passport/api.md`.

### Migration

`backend/migrations/versions/f7a2b9c3d4e5_add_talent_passport.py` revises
`a7a8e1c3f5b2`. It creates 11 Passport tables and their indexes with guarded
DDL. Downgrade drops only those tables.

---

## D. Frontend implementation

### Routes and shell integration

- Private: `/student/talent-passport` plus `skills`, `skills/[skillId]/evidence`,
  `projects`, `certificates`, `achievements`, `timeline`, `settings`.
- Public: `/talent/[publicSlug]`.
- Shared sidebar gains one Talent Passport item; the student profile page gains
  a prominent link card.

### API and safety

- `talent-passport.service.ts` reuses existing `axiosInstance` for private/admin
  calls and a JWT-free axios instance for public calls.
- `page`/`page_size` pagination and typed `TalentApiError` parsing.
- `serializePublicPassport` is whitelist-only and drops unknown/disabled fields.
- State badges render only backend values; the frontend never promotes a result
  to `VERIFIED`.
- A small `en`/`fr`/`rw` dictionary is provided; no app-wide i18n rewrite.
- No QR package is installed, so the share panel shows the generated public URL
  rather than fabricating an image.

Details and file inventory: `docs/talent-passport/frontend-notes.md`.

---

## E. Evidence, grading, certificate and privacy rules

- **States:** `LEARNING`, `EVIDENCE_SUBMITTED`, `DEMONSTRATED`, `VERIFIED`.
- **AAGE:** official only when `is_official=True` or `status == "published"`,
  with an approved `GradingReview` where required.
- **Excel:** authoritative only when `instructor_reviewed=True`.
- **Classic grading:** `graded_by` alone is insufficient; a staff grader signal
  or `GradingHistory` is required.
- **Team projects:** capped at `EVIDENCE_SUBMITTED` unless individual
  contribution is explicitly verified.
- **Certificates:** canonical `student_models.Certificate` only; active →
  `VERIFIED`, inactive/expired → rejected. No re-implemented 70% rule.
- **Proficiency:** only when a mapping supplies rubric/criterion and threshold.
- **Publication:** private by default; publish needs at least one section;
  unpublish rotates the slug; email/phone require explicit flags.
- **Idempotency:** event key includes event type, student, source, source id and
  a meaningful suffix; corrections update existing rows.

See `evidence-rules.md`, `grading-integration.md`,
`certificate-integration.md` and `visibility-and-privacy.md`.

---

## F. Verification actually executed

Environment notes: backend used WSL `python3` 3.10.12; frontend used
`/root/.nvm/versions/node/v20.19.6/bin/node`. The missing `pytesseract` Python
wrapper was installed in the test environment before the final full backend
run so unrelated payment tests could execute.

### F.1 Backend targeted suite

```bash
cd /root/My_project/Afritech_Bridge_lms/backend
python3 -m pytest tests/test_talent_passport.py -q --disable-warnings
```

Observed: `19 passed, 157 warnings in 7.32s`.

Covered tests: enrollment-only learning; classic grade + `GradingHistory`;
provisional grade rejection; AAGE official/review gating; corrected-grade
in-place update; team-project cap and individual verification; certificate
revocation; event idempotency; hook sync/idempotency; canonical hook wiring;
private publication/toggle/slug rotation; cross-student access denial;
admin verification permission and self-verification ban; instructor mapping
ownership; owner-only PDF export; hook failure isolation; course deletion
cascade; user deletion cascade; additive migration sanity.

### F.2 Full backend suite

```bash
cd /root/My_project/Afritech_Bridge_lms/backend
python3 -m pytest tests -q --disable-warnings
```

Observed: `608 passed, 5 skipped, 2127 warnings in 188.22s (0:03:08)`.

### F.3 Migration lifecycle

```bash
cd /root/My_project/Afritech_Bridge_lms/backend
python3 scripts/verify_talent_passport_migration.py
```

Observed:

```text
PASS: upgrade created all Talent Passport tables from previous head
PASS: downgrade removed only Talent Passport tables
PASS: repeated upgrade is safe
```

The script simulates an existing database at the previous head, then uses the
real Flask CLI for upgrade/downgrade/repeated upgrade. It avoids the
fresh-database auto-stamp branch.

### F.4 Frontend targeted typecheck

```bash
cd /root/My_project/Afritech_Bridge_lms/frontend
/root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.talent-passport.json
```

Observed: exit `0`, no output.

### F.5 Frontend tests

```bash
cd /root/My_project/Afritech_Bridge_lms/frontend
/root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.talent-test.json
/root/.nvm/versions/node/v20.19.6/bin/node --test .talent-test-build/tests/talent-passport.test.js
```

Observed: `tests 8`, `pass 8`, `fail 0`, `duration_ms 675.001647`.
The temporary `.talent-test-build` directory was removed afterward.

Covered: URL builder, private/admin URL construction, JWT-free public client,
API error parsing, failed-request error translation, public serializer whitelist
and envelope handling.

### F.6 Full frontend typecheck (not clean — pre-existing)

```bash
cd /root/My_project/Afritech_Bridge_lms/frontend
/root/.nvm/versions/node/v20.19.6/bin/node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
```

Observed: exit `1` with 157 parse errors confined to two files that were not
changed by this work:

- `src/components/instructor/EnhancedModificationDashboard.tsx`
- `src/components/instructor/ai-agent/index-new.ts`

No clean full-project frontend typecheck is claimed.

### F.7 Production build

After replacing the unavailable `IdCard` icon with `Contact` in
`frontend/src/components/student/StudentSidebar.tsx` and
`frontend/src/app/student/dashboard/profile/page.tsx`, the full production build
was run. Node 20 had to be placed on `PATH`, not only used to invoke Next, because
Turbopack spawns a child `node` process for PostCSS.

```bash
cd /root/My_project/Afritech_Bridge_lms/frontend
export PATH=/root/.nvm/versions/node/v20.19.6/bin:$PATH
node node_modules/next/dist/bin/next build
```

Observed: exit `0`; `✓ Compiled successfully in 82s`; static generation reached
`92/92` in `14.9s`; the route table includes all Talent Passport private routes
and `/talent/[publicSlug]`.

---

## G. Documentation and operational readiness

Created documentation in `docs/talent-passport/`:

- `README.md`
- `audit.md`
- `implementation-plan.md`
- `architecture.md`
- `data-model.md`
- `api.md`
- `skill-taxonomy.md`
- `evidence-rules.md`
- `grading-integration.md`
- `certificate-integration.md`
- `visibility-and-privacy.md`
- `identity-integration.md`
- `afritech-work-integration.md`
- `deployment.md`
- `frontend-notes.md`
- `final-engineering-report.md`

Deployment uses the existing Flask app and a single additive Alembic revision.
Rollback is `flask db downgrade a7a8e1c3f5b2`. The verification script in F.3 is
committed for repeatable migration checks.

**Not verified:** no live backend/browser visual check, no external AfriTech Work
API call, and no external identity mapping was executed. These are release-time
gates, not claimed deliverables of this round. The production build itself was
verified in F.7.

---

## H. Known limitations and next steps

### Documented manual-sync gaps

1. Certificate revocation/expiry has no dedicated hook. The engine understands
   `is_active=False` and expiry, but a hard delete or out-of-band deactivation
   needs `POST /student/talent-passport/sync` or `backfill_students()`.
2. Enrollment creation/deletion write sites have no hook. `LEARNING` evidence is
   produced by progress/certificate hooks or a backfill.
3. Module/lesson completion has no hook or dedicated synchronizer.
4. Mapping create/update/delete does not immediately recompute existing skill
   state; changes take effect on the next sync.
5. Skill-badge award/verification changes have no hook. Only verified
   `StudentSkillBadge` rows are mirrored during achievement sync.

### Other limitations

- There is no per-member project contribution model in the LMS; team evidence is
  deliberately capped.
- No QR library is installed in the frontend; the share panel shows the URL.
- The full frontend typecheck remains blocked by two pre-existing unrelated
  source files.
- No live visual/UX review was run; the production build was verified in F.7.
- AfriTech Work integration is future work; no automatic data exchange exists.

### Recommended next steps

1. Add certificate revoke/deactivate events once an explicit LMS route exists.
2. Hook enrollment create/delete and module/lesson completion if Passport needs
   immediate `LEARNING` updates without manual sync.
3. Recompute affected students synchronously after mapping changes.
4. Fix the two pre-existing frontend parse-error files, then rerun the full
   project typecheck.
5. Run a live backend + browser smoke test of publish → public view → PDF →
   unpublish before release.
