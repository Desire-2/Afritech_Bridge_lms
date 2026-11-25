# Talent Passport — File-Level Implementation Plan

Status: implemented. Final verified status is recorded in
`final-engineering-report.md`. Companion to `audit.md`.

## Backend (Flask feature module — no new app)

| File | Purpose |
|---|---|
| `backend/src/talent_passport/__init__.py` | Feature package; exports the blueprint + `init_app`. |
| `backend/src/talent_passport/models.py` | New tables: passports, skill categories/definitions, course/assessment/project skill mappings, student skills, skill evidence, portfolio items, visibility, publication/achievement records, audit events, processed events. All reference existing `users`, `courses`, submissions by FK. |
| `backend/src/talent_passport/enums.py` | Skill status, evidence source, evidence verification, visibility, audit action constants. |
| `backend/src/talent_passport/config.py` | Configurable completeness weights, default visibility, status precedence, achievement rules. |
| `backend/src/talent_passport/taxonomy.py` | Seed taxonomy from the existing `src/config/course_skill_profiles.py` categories + explicit configurable definitions (no scattered string literals). |
| `backend/src/talent_passport/evidence.py` | Evidence engine: idempotent upserts, status transitions, proficiency rules, source record reads through existing models/services. |
| `backend/src/talent_passport/sync.py` | `sync_student`, targeted `handle_event`, backfill; bounded and per-student only. |
| `backend/src/talent_passport/achievements.py` | Explicit, rule-driven passport achievement records; reuses existing `Achievement`/`UserAchievement` where present. |
| `backend/src/talent_passport/services.py` | Aggregation for overview/progress/skills/projects/certificates/achievements/timeline/recommendations/completeness; private and safe-public serializers. |
| `backend/src/talent_passport/pdf.py` | ReportLab PDF generated from the serialized passport (public-safe), with QR verification link and disclaimer. |
| `backend/src/talent_passport/routes.py` | Blueprint `talent_passport_bp` (`/api/v1/student/talent-passport`, `/api/v1/talent/<slug>`, `/api/v1/admin/talent`). Auth, ownership, validation, pagination, safe errors. |
| `backend/src/talent_passport/hooks.py` | `notify_talent_passport(event_type, student_id, source_type, source_id, course_id)` — failure-isolated, idempotent; wired into existing grading/submission/certificate/progress flows. |
| `backend/main.py` | One import + `app.register_blueprint(talent_passport_bp)`; no change to existing routes. |
| `backend/src/models/__init__.py` | Register/export the new models for `create_all` bootstrap. |
| `backend/migrations/versions/<rev>_add_talent_passport.py` | Alembic revision, `down_revision='a7a8e1c3f5b2'`, creates new tables + indexes; downgrade drops only those tables. |
| `backend/tests/test_talent_passport_*.py` | Unit, integration, security and migration tests. |

Hook call sites (smallest possible changes to existing code):
- `src/routes/grading_routes.py` / `excel_grading_routes.py` / `services/assessment_change_hooks.py` →
  `assignment.graded`, `assignment.grade_approved`, `assignment.grade_updated`, project equivalents.
- `src/routes/certificate_routes.py` / `src/services/certificate_service.py` → `certificate.issued`,
  `certificate.revoked`.
- `src/routes/learning_routes.py` / `src/services/progression_service.py` → `course.completed`,
  `module.completed`.
- submission endpoints in `src/routes/student_routes.py` → `assignment.submitted`, `project.submitted`.

## Frontend (inside the existing Next.js app)

| File | Purpose |
|---|---|
| `frontend/src/app/student/talent-passport/page.tsx` | Passport dashboard (overview). |
| `frontend/src/app/student/talent-passport/skills/page.tsx` | Skills + evidence detail. |
| `frontend/src/app/student/talent-passport/projects/page.tsx` | Portfolio curation. |
| `frontend/src/app/student/talent-passport/certificates/page.tsx` | Issued credentials. |
| `frontend/src/app/student/talent-passport/settings/page.tsx` | Professional profile, visibility, publish/unpublish, share. |
| `frontend/src/app/talent/[publicSlug]/page.tsx` | Public, backend-filtered passport. |
| `frontend/src/components/talent-passport/*` | Header, completeness, learning summary, skills, evidence, projects, certificates, achievements, timeline, career direction, visibility, share, empty/loading/error states. |
| `frontend/src/services/talent-passport.service.ts` | Single API client for all passport endpoints. |
| `frontend/src/types/talent-passport.ts` | Shared types. |
| `frontend/src/lib/i18n/talent-passport.ts` | en/fr/rw copy dictionary + hook (no hardcoded user-facing strings in components). |
| `frontend/src/app/student/dashboard/profile/page.tsx` | Improved profile: professional summary fields + prominent Talent Passport entry point. |
| `frontend/src/components/student/StudentSidebar.tsx` | Add Talent Passport nav item (mobile + desktop). |

## Documentation

`docs/talent-passport/{architecture,data-model,api,skill-taxonomy,evidence-rules,grading-integration,certificate-integration,visibility-and-privacy,identity-integration,afritech-work-integration,deployment}.md`

## Order of work

1. Models + migration + taxonomy (verify `flask db upgrade` on a copy of the SQLite DB).
2. Evidence engine + sync/hooks (unit tests first).
3. Services + routes + PDF (integration/security tests).
4. Register blueprint; run full backend suite.
5. Frontend service/types/i18n → components → pages → nav/profile improvements.
6. Frontend tests + typecheck of new files + production build.
7. Docs + final engineering report.
