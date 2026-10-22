# AfriTech Bridge LMS — API Integration Layer: Implementation Plan

Date: 2026-10-18 · Status: implemented (see `README.md` for the final inventory and verification status)

---

## 1. Goals

Expose existing LMS capabilities to authorized external platforms (main website, jobs portal,
talent platforms, mobile apps, employer portals, payment/notification/reporting systems) through
a **secure, consistent, versioned, documented, tested** API — while the existing `/api/v1` surface
keeps serving the LMS frontend unchanged and the LMS's own business rules stay authoritative.

## 2. Key architecture decisions

### D1 — New versioned namespace: `/api/v2`

All 649 existing routes already live under `/api/v1` and serve the Next.js frontend with
heterogeneous contracts that must not change. Two candidate designs were evaluated:

1. **Patch/document `/api/v1`** — rejected: cannot give one path prefix two response contracts,
   cannot retrofit scoped credentials without touching 649 routes, cannot guarantee no frontend
   regressions.
2. **New versioned namespace** — chosen. `/api/v2` is collision-free, self-describing, and lets the
   integration layer enforce one envelope, one auth model, one error format, one pagination rule.

`/api/v1` remains the **platform (frontend) API**: preserved, inventoried, explicitly *not*
covered by the external compatibility guarantee (documented in `versioning.md` and
`endpoint-inventory.json`). Legacy and v2 routes share the **same models, services, permissions and
business rules** — v2 never re-implements scoring, completion, eligibility or payment logic.

### D2 — Layering (transport ≠ business logic)

```
src/api/                     ← new integration layer (transport only)
  __init__.py                ← api_bp (url_prefix=/api/v2), error handlers, request hooks
  constants.py               ← scopes, error codes, limits, API version
  errors.py                  ← ApiError exception + code→status mapping
  responses.py               ← envelope builders (data/meta/pagination/error)
  pagination.py              ← page/per_page/sort parsing + pagination block
  auth.py                    ← API-key + JWT principal resolution, require() decorator
  ratelimit.py               ← sliding-window limiter per principal/IP, 429 + headers
  middleware.py              ← request IDs, structured access logs, rate-limit headers
  serialization.py           ← timezone-aware ISO-8601 serializers (whitelisted fields)
  dispatch.py                ← calls existing legacy view functions, adapts to v2 envelope
  idempotency.py             ← Idempotency-Key store/replay for retryable POSTs
  events.py                  ← ApiEvent log + HMAC-signed outbound webhook delivery
  routes/*.py                ← thin route modules (health, catalog, identity, learning, …)
src/models/integration_models.py ← new tables only (credentials, webhooks, events, keys, audit)
```

Rules: routes validate + authorize + serialize; business behavior comes from existing services
(`CertificateService`, `CourseProgressService`, `ProgressionService`, `EnrollmentService`,
`EnrollmentProgressService`, `WaitlistService`) or, where behavior exists only inside a legacy
route function, from **dispatching that exact view** (`dispatch.py`) and adapting its JSON — no
duplicate business logic.

### D3 — Authentication model (two credentials, three classes)

| Class | Used by | Requirements |
|---|---|---|
| `public` | health, published catalog, certificate verification, docs | none (per-IP rate limits; API key raises quota) |
| `client` | webhooks, events, token grant | active API key + scope (`X-API-Key`) |
| `user+client` | everything acting on a person (me/enrollments/progress/submissions/…) and every instructor/admin endpoint | active API key + scope **and** a platform JWT with the required role |

- **API keys** (`atb_sk_…`): issued per integration client, stored as SHA-256 hashes with a
  lookup prefix, scoped, expiring, revocable; shown once at creation. Registered via
  admin-only endpoints that deliberately do **not** accept API keys (a key can never mint a key).
- **User JWTs**: same tokens as today (no second auth system). `POST /api/v2/auth/token` mints
  them for a registered client (`grant_type=password|refresh_token` + client credentials,
  rate-limited); partners may also use tokens from `POST /api/v1/auth/login`. Tokens minted through
  the integration token endpoint carry a client binding claim; disabling the client invalidates them.
- Full OAuth 2.0 authorization-code + PKCE (delegated consent flow) is documented as **planned**
  in `versioning.md` — no endpoint pretends to implement it.

Scopes (least privilege): `profile:read|write`, `courses:read`, `enrollments:read|write`,
`applications:read|write`, `progress:read|write`, `assessments:read|write`, `submissions:read|write`,
`grades:read|write`, `certificates:read|issue`, `reports:read`, `webhooks:manage`, `events:read`,
`auth:token`.

### D4 — Contracts

- Success: `{"data": …, "meta": {"request_id": …}}`; lists add
  `pagination: {page, per_page, total_items, total_pages}`.
- Errors: `{"error": {"code", "message", "details", "request_id"}}` with stable codes
  (`VALIDATION_ERROR`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`,
  `PAYMENT_REQUIRED`, `IDEMPOTENCY_KEY_REUSED`, `SERVICE_UNAVAILABLE`, `INTERNAL_ERROR`).
- Status: 200/201/202/204/400/401/403/404/409/422/429/500 as appropriate; never stack traces.
- Pagination `page` (≥1), `per_page` (default 20, max 100), whitelisted `sort`/`order` per endpoint.
- Timestamps: ISO-8601 with explicit `+02:00` (app stores Africa/Kigali wall-clock time).
- Every response carries `X-Request-Id` and `X-API-Version: 2`; rate-limited endpoints add
  `X-RateLimit-*` / `Retry-After`.
- Blueprint-scoped Flask error handlers produce the v2 error envelope **only** for `/api/v2`
  (legacy error shapes untouched → frontend safe).

### D5 — Events and webhooks (outbound)

`ApiEvent` rows (append-only log for reconciliation) + `WebhookSubscription` (HMAC secret
`whsec_…` shown once) + `WebhookDelivery` (status, attempts, next retry). Deliveries are POSTed
from a daemon thread with exponential backoff (5 attempts), signature header
`X-ATB-Signature: t=<unix>,v1=<hex>` (HMAC-SHA256 over `t.body`), plus `X-ATB-Event-Id` /
`X-ATB-Delivery-Id` for receiver-side idempotency; failed deliveries are replayable via API.
Emission hooks are added at existing business events (application approved, enrollment created,
course completed, submission graded, certificate issued, payment verified) — each hook is
failure-isolated (never breaks the platform flow).

### D6 — Rate limiting, idempotency, observability

- In-process sliding window: public 60/min/IP, authenticated 300/min/key, token endpoint
  10/min/IP+client (env-overridable). 429 + `Retry-After`. Documented limitation: per-worker
  counters (Render runs multiple gunicorn workers).
- `Idempotency-Key` header on state-changing POSTs: replay of the stored 2xx response, `409` on
  reuse with a different payload.
- Request ID (accept inbound `X-Request-Id` when well-formed, else generate), structured JSON-ish
  access logs with principal + latency, secrets never logged; `ApiAuditLog` rows for credential
  and webhook administration.

### D7 — Documentation

- Authoritative spec: `docs/api/openapi.json` (OpenAPI **3.1**), served at
  `GET /api/v2/openapi.json` (+ alias `/api/openapi.json`).
- Swagger UI at `/api/v2/docs` (+ `/api/docs`), ReDoc at `/api/v2/redoc` (+ `/api/redoc`)
  (CDN assets; the JSON spec itself is served locally).
- Human guides under `docs/api/` (getting-started, authentication, endpoints, errors, pagination,
  webhooks, versioning, security, environment, deployment, changelog) + tested examples in
  `examples/` (curl, Python, JavaScript, TypeScript).
- `docs/api/endpoint-inventory.json` + `endpoints.md`: machine-readable inventory of **all**
  registered routes (existing 649 + new) generated by `backend/scripts/generate_api_inventory.py`
  with implementation status and auth classification; legacy routes are explicitly excluded from
  the OpenAPI spec with justification (heterogeneous frozen frontend contracts).

## 3. Endpoint inventory (v2 = documented + tested)

| # | Endpoint | Auth class | Backed by |
|---|---|---|---|
| 1 | `GET /api/v2/health` | public | DB ping, version |
| 2 | `GET /api/v2/openapi.json` · `GET /api/v2/docs` · `GET /api/v2/redoc` | public | spec file |
| 3 | `POST /api/v2/auth/token` | client (`auth:token`) | JWT issuance (login/refresh logic) |
| 4 | `GET /api/v2/me` · `PUT /api/v2/me` | user+client (`profile:read/write`) | `User` |
| 5 | `GET /api/v2/courses` | public (key raises quota) | `Course` published + filters/pagination |
| 6 | `GET /api/v2/courses/{id}` | public | `Course.to_dict` (public whitelist) |
| 7 | `GET /api/v2/courses/{id}/modules` | public | release-aware module list |
| 8 | `GET /api/v2/courses/{id}/eligibility` | user+client (`courses:read`) | window status + `WaitlistService` + enrollment |
| 9 | `GET /api/v2/me/enrollments` · `GET /api/v2/me/enrollments/{id}` | user+client (`enrollments:read`) | `Enrollment` + progress service |
| 10 | `POST /api/v2/me/enrollments` | user+client (`enrollments:write`) + Idempotency-Key | `EnrollmentService.enroll_directly` |
| 11 | `GET /api/v2/me/applications` · `GET /api/v2/me/applications/{id}` | user+client (`applications:read`) | `CourseApplication` (email-matched, safe fields) |
| 12 | `POST /api/v2/courses/{id}/applications` | user+client (`applications:write`) + Idempotency-Key | extracted `ApplicationService.submit` (same rules as platform form) |
| 13 | `GET /api/v2/me/courses/{id}/modules` · `GET …/lessons/{lesson_id}` | user+client (`courses:read`) | enrollment + cohort release + payment gate |
| 14 | `GET /api/v2/me/courses/{id}/progress` | user+client (`progress:read`) | `EnrollmentProgressService` + `CourseProgressService.evaluate` |
| 15 | `POST /api/v2/me/lessons/{id}/complete` | user+client (`progress:write`) + Idempotency-Key | dispatch → `learning_routes.complete_lesson` |
| 16 | `POST /api/v2/me/lessons/{id}/video-progress` | user+client (`progress:write`) | dispatch → `student_routes.update_lesson_progress` |
| 17 | `GET /api/v2/me/courses/{id}/assessments` · `GET /api/v2/me/quizzes/{id}` | user+client (`assessments:read`) | Quiz/Assignment/Project models, enrollment-gated |
| 18 | `POST /api/v2/me/quizzes/{id}/submissions` | user+client (`assessments:write`) + Idempotency-Key | dispatch → `student_routes.submit_quiz` |
| 19 | `GET /api/v2/me/submissions` · `GET /api/v2/me/submissions/{id}` | user+client (`submissions:read`) | own Assignment/Project submissions + quiz attempts |
| 20 | `POST /api/v2/me/assignments/{id}/submissions` · `POST /api/v2/me/projects/{id}/submissions` | user+client (`submissions:write`) + Idempotency-Key | dispatch → legacy submit views |
| 21 | `GET /api/v2/me/certificates` · `POST /api/v2/me/courses/{id}/certificates` | user+client (`certificates:read`/`issue`) | `CertificateService` (eligibility enforced) |
| 22 | `GET /api/v2/certificates/{number}/verify` | public (key raises quota) | `CertificateService.verify_certificate` |
| 23 | `GET /api/v2/instructor/courses` | user+client (`courses:read`, role instructor\|admin) | own courses |
| 24 | `GET /api/v2/instructor/courses/{id}/students` | user+client (`grades:read`) | dispatch → `course_routes.get_course_instructor_details` |
| 25 | `GET /api/v2/instructor/submissions` | user+client (`grades:read`) | grading queue (assignments/projects) |
| 26 | `POST /api/v2/instructor/submissions/{type}/{id}/grade` | user+client (`grades:write`) + Idempotency-Key | dispatch → `grading_routes.grade_*` |
| 27 | `GET /api/v2/admin/stats` · `GET /api/v2/admin/enrollments` · `GET /api/v2/admin/applications` | user+client (`reports:read`, role admin) | aggregate queries, paginated, safe fields |
| 28 | `GET/POST /api/v2/admin/integration-clients` (+ `GET/{id}`, `POST/{id}/keys`, `DELETE/{id}/keys/{key_id}`) | admin JWT only (by design: keys cannot mint keys) | `ApiClient`/`ApiKey` + audit log |
| 29 | `GET/POST /api/v2/webhooks/subscriptions`, `GET/{id}`, `DELETE/{id}` | client (`webhooks:manage`) | `WebhookSubscription` (secret once) |
| 30 | `GET /api/v2/webhooks/deliveries`, `POST /api/v2/webhooks/deliveries/{id}/replay` | client (`webhooks:manage`) | `WebhookDelivery` |
| 31 | `GET /api/v2/events` | client (`events:read`) | `ApiEvent` (`since` cursor) |

Explicitly **not** exposed through v2 (marked unavailable in the docs): OAuth authorization-code
flow (planned), file upload/download (storage authorization is frontend-specific), payments
initiation/verification (provider callbacks + server-side verification stay on `/api/v1`; v2 only
*emits* verified payment events), AI authoring/grading tools, admin write operations beyond
credential management (use the platform admin UI/API).

## 4. Migration strategy

- One Alembic revision adds: `api_clients`, `api_keys`, `api_events`, `webhook_subscriptions`,
  `webhook_deliveries`, `api_idempotency_keys`, `api_audit_log`. No existing table is altered.
- Tables are also covered by the boot-time `create_all(checkfirst=True)` bootstrap, so deployments
  that never run Alembic still work; Alembic remains the primary path (`flask db upgrade`).
- Rollback: `flask db downgrade <previous>` removes the new tables only; v2 blueprint removal is a
  code revert; `/api/v1` is untouched throughout.

## 5. Verification plan

1. Functional tests per endpoint (status codes, envelope, pagination, validation, persistence).
2. Authorization tests: no creds / bad key / revoked & expired key / missing scope / missing JWT /
   wrong role / cross-user isolation (student A vs B), instructor-vs-admin boundaries.
3. Security tests: injection-shaped input, mass assignment, idempotency conflicts, rate-limit 429,
   webhook signature validity, secret non-exposure (keys hashed, secret returned once).
4. Contract tests: spec↔route parity in both directions, declared security matches live behavior,
   response examples validated against schemas (minimal local validator, no new dependency).
5. Regression: full existing suite (baseline 280 passed / 6 pre-existing failures) + route-map diff
  proving `/api/v1` is unchanged.
