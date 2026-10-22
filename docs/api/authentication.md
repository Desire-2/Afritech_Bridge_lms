# Authentication & authorization — `/api/v2`

Date: 2026-10-22 · Surfaces: [`backend/src/api`](../../backend/src/api), live spec at `/api/v2/openapi.json`

Every non-public endpoint needs **two independent credentials**:

| Credential | Header | Identifies | Never |
|---|---|---|---|
| **API key** | `X-API-Key: atb_sk_…` | the integration client (main website, jobs portal, mobile BFF) | a person |
| **User JWT** | `Authorization: Bearer <access token>` | the learner, instructor or admin the request acts on | a client |

A key alone never satisfies a user-guarded endpoint; a JWT alone never satisfies a
scope-guarded endpoint. Endpoints that read or write *a user's* data require both.
An invalid key presented to a public endpoint is still rejected (401) — the key is
resolved in a blueprint `before_request` hook before any view runs.

## 1. API keys

Keys are issued **by an administrator** through credential-administration endpoints
that deliberately accept *no* API key (a key can never mint or revoke keys):

```
POST   /api/v2/admin/integration-clients                     create a client
POST   /api/v2/admin/integration-clients/<client_id>/keys    mint a key (shown once)
PATCH  /api/v2/admin/integration-clients/<client_id>/keys/<key_id>   revoke/rotate
```

* Format: `atb_sk_` + 40 url-safe random characters.
* Storage: only the SHA-256 hash (`ApiKey.key_hash`); the secret is returned
  **exactly once**, at creation time. `key_prefix` exists only so admin lists can
  identify a key without storing it.
* A revoked or inactive key fails closed on the next request.

## 2. User tokens

`POST /api/v2/auth/token` mints user access/refresh tokens for an integration
client. It requires the `auth:token` scope on the presented key (the client secret
may arrive in the `X-API-Key` header or the `client_secret` body field).

```bash
curl -X POST /api/v2/auth/token \
  -H 'Content-Type: application/json' \
  -d '{
    "client_secret": "atb_sk_…",
    "grant_type": "password",
    "username": "learner@example.com",
    "password": "…"
  }'
```

`grant_type` is `password` (username/email + password) or `refresh_token`
(previously minted refresh token, bound to the same `client_id`). The response
carries `access_token`, `refresh_token`, `token_type: "Bearer"`, `expires_in`
and the key's `scope` list. Tokens are the platform's existing JWTs — the same
ones `/api/v1/auth/login` issues — so the two surfaces stay interchangeable.

## 3. Scopes

Scopes map one-to-one onto endpoint groups. The key must carry **every** scope an
endpoint requires; a missing scope is a `403 FORBIDDEN` whose `details` list the
gaps. The live catalogue is `src/api/constants.py::SCOPES` and is echoed on the
spec as `x-scopes`.

| Scope | Grants |
|---|---|
| `auth:token` | mint user tokens at `/auth/token` |
| `profile:read` / `profile:write` | the authenticated user's profile |
| `courses:read` | catalogue, modules, lessons |
| `enrollments:read` / `enrollments:write` | the learner's enrollments |
| `applications:read` / `applications:write` | the learner's course applications |
| `progress:read` / `progress:write` | lesson/video progress |
| `assessments:read` / `assessments:write` | quizzes and attempts |
| `submissions:read` / `submissions:write` | assignments and projects |
| `grades:read` / `grades:write` | instructor grading queues and results |
| `certificates:read` / `certificates:issue` | the learner's certificates |
| `reports:read` | organization-level reports (admin role) |
| `webhooks:manage` | webhook subscriptions and replays |
| `events:read` | the integration event log |

Roles (`admin`, `instructor`) are enforced *in addition to* scopes where an
endpoint is role-gated — e.g. everything under `/admin/*` needs `reports:read`
**and** an admin JWT.

## 4. Public endpoints

`/health`, `/auth/token`, `/docs`, `/redoc`, `/openapi.json` and the certificate
verification endpoint take no credentials. Everything else requires at least an
API key.

## 5. Errors & limits

All failures use the v2 envelope, with `request_id` for support:

```json
{"error": {"code": "UNAUTHENTICATED", "message": "…",
           "details": [{"header": "X-API-Key", "issue": "required"}],
           "request_id": "…"}}
```

| Status | Meaning |
|---|---|
| 401 | missing or invalid credentials (bad key, expired JWT) |
| 403 | valid principal, but the key lacks the scope or the role |
| 429 | rate limit exceeded — honour `Retry-After` |

Defaults (overridable via env): 60 req/min unauthenticated, 300 req/min
authenticated, 10 req/min on `/auth/token`; `/health` is exempt. Responses carry
`X-API-Version: v2` and, when present, `X-Request-Id`.
