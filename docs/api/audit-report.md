# AfriTech Bridge LMS — Repository Audit Report

Date: 2026-10-18 · Scope: `backend/` (Flask LMS API), `frontend/` (Next.js client), deployment assets.
Method: full route-map dump from the running application factory, source inspection of every
blueprint, models, services, middleware, tests, and the frontend API client. Counts below were
produced programmatically from `app.url_map`, not estimated.

---

## 1. Platform architecture

| Aspect | Finding |
|---|---|
| Framework | Flask 2.3.3 + Flask-SQLAlchemy 3.1.1 + Flask-JWT-Extended 4.5.3 + Flask-CORS 4.0.0 + Flask-Migrate 4.1.0 |
| Python | 3.10 (virtualenv at `backend/venv`) |
| App construction | Module-level app in `backend/main.py` (no application factory). `app.py` / `wsgi.py` re-export it for deployment. |
| Blueprint registration | 42 blueprints registered in `main.py:393-434`, all imported from `src/routes/*` + `src/blueprints/internships`. |
| Route count | **651 URL rules**: **649 under `/api/v1`**, plus `/` and a `<path:path>` catch-all (JSON 404 for `api/*`, SPA fallback otherwise). |
| Database | SQLite (dev default at `instance/afritec_lms_db.db`) or PostgreSQL (`DATABASE_URL`, forced TLS on Render). Schema bootstrapped with `db.create_all(checkfirst=True)` + column self-heal; Alembic migrations in `backend/migrations/versions/` (Flask-Migrate). |
| Background work | APScheduler-based services (`scheduler_service`, cohort/booking schedulers), `BackgroundTask` model, plus ad-hoc daemon threads. |
| Middleware | `src/middleware/maintenance_mode.py` — the only `before_request` hook (503 JSON during maintenance, admin bypass, route exemptions). |
| Response commit | `main.py:707` `after_request` commits on 2xx, rolls back on error — many legacy routes rely on this implicit commit. |
| CORS | Allow-list from `ALLOWED_ORIGINS` (prod) / dev localhost list; `supports_credentials=True`; headers: `Content-Type, Authorization, X-Requested-With`. |
| Rate limiting | **None** for HTTP generally; one in-process sliding-window limiter used only by public certificate-verify routes (`certificate_routes.py:33`). |
| Request IDs / structured logs | **None.** Plain `logging` basicConfig; no correlation IDs. |
| API documentation | **None** — no OpenAPI/Swagger/ReDoc anywhere (searched backend + frontend). |
| API keys / OAuth | **None.** `enable_oauth` exists only as a settings key with no implementation. |

## 2. Existing API surface (`/api/v1`)

649 endpoints across 42 blueprints. Functional domains (representative, by blueprint):

| Domain | Blueprint(s) | Prefix examples |
|---|---|---|
| Auth & identity | `auth_bp`, `user_bp` (`user_routes.py`) | `/api/v1/auth/login|refresh|logout|forgot-password`, `/api/v1/users/me` |
| Courses & catalog | `course_bp`, `module_bp`, `lesson_bp` | `/api/v1/courses`, `/api/v1/modules/...`, `/api/v1/lessons/...` |
| Enrollments | `enrollment_bp` (from `course_routes.py`) | `/api/v1/enrollments` |
| Applications & payments | `application_bp` (6,905 lines), `waitlist_bp`, `payment_verify_bp` | `/api/v1/applications`, `/api/v1/payments/verify/<hash>` |
| Learning & progress | `student_bp`, `learning_bp`, `progress_bp` | `/api/v1/student/lessons/<id>/complete`, `/api/v1/student/progress/...` |
| Assessments & grading | `instructor_assessment_bp`, `grading_bp`, `excel_grading_bp` | `/api/v1/instructor/assessments/...`, `/api/v1/grading/...` |
| Certificates | `certificate_bp` | `/api/v1/student/certificate/verify/<number>` (public), `/my-certificates`, `/generate/<course_id>` |
| Instructor tools | `instructor_bp`, `course_creation_bp`, `content_assignment_bp`, `instructor_settings_bp` | `/api/v1/instructor/...` |
| Administration | `admin_bp`, `admin_student_bp`, `settings_bp` | `/api/v1/admin/...` |
| Notifications / email | `notification_bp`, `email_bp` | `/api/v1/notifications/...` |
| Internships, bookings, forums, achievements, AI agent, workflows, files, waitlist, maintenance | respective blueprints | `/api/v1/internships/...`, `/api/v1/ai-agent/...`, … |

### Authentication & authorization (existing)

- **Pure stateless JWT** in `Authorization: Bearer` (access 1 h, refresh 30 d, both block-listed
  via `revoked_tokens` on logout). No cookies/sessions. Frontend stores tokens in `localStorage`
  and auto-refreshes on 401 (`frontend/src/lib/api-client.ts`).
- **Roles**: plain strings on `roles` table — `student`, `instructor`, `admin`, `intern` (+`staff`
  used by internships), seeded at boot (`main.py:643-651`).
- **No shared decorator module.** ~30 local copies of `admin_required` / `instructor_required` /
  `student_required` / `role_required` are redefined per route file with divergent error keys
  (`{"error": ...}` vs `{"message": ...}`) and inconsistent admin/instructor semantics.
- Passwords: Werkzeug `pbkdf2:sha256` (600k iterations). Reset tokens: opaque random, DB-stored.
- **Authorization gaps found** (documented, not silently changed):
  - `POST /api/v1/applications` review endpoints rely on inline role checks; `GET /api/v1/applications`
    is `@jwt_required()` only (no role gate inside the handler) and serializes with `include_sensitive=True`.
  - `GET /api/v1/modules/<id>/lessons` and `GET /api/v1/lessons/<id>` enforce only the
    *published-course* gate — no enrollment/cohort-release check (module release is enforced on
    `/modules/<id>` but not on the lessons beneath it).
  - K-Pay callback (`POST /api/v1/applications/kpay-callback`) has no signature verification and
    mutates nothing; Flutterwave webhook verifies `verif-hash` but only logs (payment truth is the
    server-side re-query in `POST /api/v1/applications/verify-payment`).
  - Public `GET /api/v1/courses` returns internal payment-gateway configuration
    (`momo_ussd_code`, `bank_transfer_details`, gateway toggles) to anonymous callers.
  - No rate limiting on login / password reset / token endpoints.

### Business logic worth reusing (services)

| Service | Role |
|---|---|
| `EnrollmentService` | `browse_courses`, `enroll_directly` (free courses, canonical dedupe, IntegrityError race handling), `_create_enrollment` (seeds `ModuleProgress`, certificate, transcript). Reached today only by an **unregistered** blueprint (`enrollment_routes.py`). Contains bugs: `_check_prerequisites` queries non-existent `Enrollment.user_id` / `enrollment.completed`. |
| `EnrollmentProgressService` | Authoritative completion counts (`get_progress_counts`), `live_completion`, `sync_enrollment` — measured against **all published** content, never the released subset. |
| `CourseProgressService.evaluate` | Single source of truth for course score + certificate eligibility (Rules A/B/C, `CERTIFICATE_PASSING_SCORE = 70`). |
| `ProgressionService` | `complete_lesson` (module locks, sequential gates, quiz-required short-circuit), module completion/unlock. |
| `LessonCompletionService` | Lesson completion requirements (video ≥ 90 %, quiz ≥ 70, assignment ≥ 60, lesson score ≥ 80) and score propagation after grading. |
| `CertificateService` | `evaluate_eligibility`, `generate_certificate` (dedupe, retry on number collision, transcript + badges), `verify_certificate` (revoked/expired/hash checks, public payload only). |
| `WaitlistService` | `is_enrollment_access_allowed` (cohort start + payment gate → 403/402), `should_require_payment_on_approval`, `verify_enrollment_payment`. |
| `payment_service` | PayPal, Stripe, MTN MoMo, K-Pay, Flutterwave, bank transfer; `POST /api/v1/applications/verify-payment` re-queries the gateway server-side (authoritative). |
| Application workflow | `application_routes.apply_for_course` (330 lines: window-open check, duplicate check, cohort resolution, `evaluate_application` scoring), `approve_application` → account creation + enrollment + module progress seeding. |

### Dead / unregistered code found (not wired, not part of the live API)

- `enrollment_routes.py` (`student_enrollment`), `student_assessment_routes.py` (`student_assessment`),
  `quiz_progress_routes.py` (`quiz_progress_api`, registration commented out), `enhanced_grading_routes.py`,
  `assessment_routes.py` — blueprints defined but never registered.
- `course_routes.py` registers `quiz_bp` / `submission_bp` with **zero routes**.
- `src/routes/user.py` + `src/models/user.py` — unauthenticated CRUD leftovers, never registered.
- `EnrollmentService._process_payment_gateway` lazy-imports a non-existent `mtn_payment_service`.

## 3. Frontend consumption

- Base URL: `NEXT_PUBLIC_API_URL` (default `http://localhost:5001/api/v1`) — one env var, 50+ call sites.
- Two client layers: axios `src/lib/api-client.ts` (auto refresh on 401) and `BaseApiService`
  (`src/services/api/base.service.ts`, unwraps `{success, data}` envelopes). Many raw `fetch` calls.
- Auth: `localStorage` keys `token`, `refreshToken`, `user`; `AuthContext` handles proactive refresh.
- No OpenAPI tooling, no generated client. Some components defensively handle both array and
  paginated shapes because `/api/v1/courses` returns a bare array while other endpoints return objects.

## 4. Tests, CI, dependencies

- `backend/tests/` — 22 pytest modules, shared `conftest.py` that points `DATABASE_URL` at a temp
  SQLite file before importing `main`.
- **Baseline run (before any change): 280 passed, 6 failed** — pre-existing failures in
  `test_internship.py` (5) and `test_rate_limit_handler.py` (1). Recorded as baseline; not caused by this work.
- `.github/` contains workflows; `backend/requirements.txt` pins all deps (no lockfile).
- No lint/typecheck configuration for the backend.

## 5. Security posture summary

| Control | Status |
|---|---|
| HTTPS | Terminus/proxy (Render) — enforced in deployment docs; app itself does not redirect HTTP. |
| CORS allowlist | Yes (env-driven), but headers omit `X-API-Key` / `X-Request-Id`. |
| Password auth | JWT + blocklist; **no rate limiting on `/auth/login`**. |
| M2M credentials | **None** (no API keys, no OAuth clients). |
| Input validation | Ad-hoc per route; no shared validator for new APIs; marshmallow installed but used in few places. |
| Mass assignment | Mostly avoided by explicit field reads; some admin update routes accept broad payloads. |
| Rate limiting | Only certificate-verify routes. |
| Secrets | Kept in `.env` (git-ignored); `.env.example` documents names. Some provider keys also in DB settings (masked in output). |
| Webhook inbound | Flutterwave signature verified; K-Pay unverified (and non-persisting). |
| Logging | No request IDs; login handler uses `print()`; no structured logs; tokens not logged today. |
| Audit trail | `SettingAuditLog` for system settings only. |

## 6. Integration gaps (what this project addresses)

1. No versioned, consistent-contract surface for external platforms — `/api/v1` is the frontend's
   heterogeneous API (mixed `{message}`/`{success,data}`/bare-array shapes, per-file auth decorators).
2. No machine-to-machine credentials, scopes, rotation, or revocation.
3. No authoritative OpenAPI document, interactive docs, or integration guide.
4. No pagination/filter contract on the public catalog (`GET /api/v1/courses` ignores paging params
   the frontend already sends).
5. No outbound event/webhook delivery for partners (enrollment, application, grading, certificate events).
6. No request IDs, structured logs, or per-client rate limits for third-party traffic.
7. No idempotency support for retryable writes.
8. Certificate verification exists publicly but is undocumented and rate-limited only in-process per IP.

## 7. Constraints that shaped the design

- The working Flask backend must not be replaced; no microservices; no duplicate models for reads.
- 649 existing routes already occupy `/api/v1/*`, so a **new contract version** (`/api/v2`) is the
  only collision-free way to introduce a consistent envelope, scoped credentials, and uniform
  auth without touching the frontend's routes.
- Business rules (progress, eligibility, grading, payment verification) must be reused — achieved by
  calling the existing services directly and, for behavior that lives only in legacy route
  functions, by **dispatching to those exact views** and adapting the response envelope.
- Schema changes are limited to genuinely new integration tables (credentials, webhooks, events,
  idempotency keys, audit log).
