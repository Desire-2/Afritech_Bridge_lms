# Talent Passport documentation

Talent Passport is a Flask feature module inside the existing AfriTech Bridge
LMS, with a matching set of Next.js pages inside the existing frontend app.

Start here:

- `audit.md` — required pre-implementation audit: student profile, learning
  data, evidence, integration, recommended architecture, file-level plan.
- `implementation-plan.md` — the original file-level plan.
- `architecture.md` — module boundaries and runtime flow.
- `data-model.md` — tables, ownership and relationships.
- `api.md` — private, public and admin API surface.
- `skill-taxonomy.md` — taxonomy and course/assessment mappings.
- `evidence-rules.md` — evidence states, provenance and proficiency rules.
- `grading-integration.md` — classic, Excel and AAGE grading hooks.
- `certificate-integration.md` — issued-certificate evidence and revocation.
- `visibility-and-privacy.md` — publication, section toggles, public filtering.
- `identity-integration.md` — reuse of LMS identity and reserved external ID.
- `afritech-work-integration.md` — future integration boundary.
- `deployment.md` — migration, registration, verification and rollback.
- `frontend-notes.md` — frontend routes, API layer and frontend verification.
- `final-engineering-report.md` — final A–H report with verified status only.

Any claim marked as "verified" in these documents refers to a command whose
exact invocation and observed result are recorded in `final-engineering-report.md`.
