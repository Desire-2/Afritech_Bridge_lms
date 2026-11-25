# API reference

All Talent Passport endpoints are mounted on the existing Flask app under
`/api/v1`. There is no separate API service or auth system.

## Conventions

### Errors

Errors use the Passport error envelope:

```json
{"error": {"code": "error_code", "message": "Human readable message", "details": {}}}
```

Mapping: `ValueError → 400`, `LookupError → 404`, `PermissionError → 403`,
`IntegrityError → 409`, unexpected errors → `500`.

### Pagination

Endpoints that list records accept `page` (default `1`, minimum `1`) and
`page_size` (default `20`, clamped to `1..100`). Responses include
`items` and `meta: {"total", "page", "page_size"}`.

### Authorization helpers

- Student routes resolve ownership from the JWT identity; a forged
  `?student_id=` cannot read another student's Passport.
- Admin/superadmin can target another student with `student_id`.
- Instructors can use mapping routes only for courses they own.
- Students cannot verify their own evidence.
- Public routes require no JWT and are rate-limited per IP per action at
  60 requests/minute.

## Private student routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/student/talent-passport/profile` | Profile + completeness. |
| PUT | `/api/v1/student/talent-passport/profile` | Validate and update Passport-owned professional fields. |
| GET | `/api/v1/student/talent-passport/overview` | Profile, stats, recent timeline, completeness, last sync. |
| GET | `/api/v1/student/talent-passport/skills?lang=` | Skill states with counts. |
| GET | `/api/v1/student/talent-passport/skills/<id>/evidence` | Paginated evidence for one skill. |
| GET | `/api/v1/student/talent-passport/projects` | Paginated portfolio list. |
| POST | `/api/v1/student/talent-passport/projects` | Create a manual portfolio item. |
| PUT | `/api/v1/student/talent-passport/projects/<id>` | Update a portfolio item. |
| DELETE | `/api/v1/student/talent-passport/projects/<id>` | Remove a portfolio presentation row. |
| GET | `/api/v1/student/talent-passport/certificates` | Paginated issued certificates. |
| GET | `/api/v1/student/talent-passport/achievements` | Paginated mirrored achievements/badges. |
| GET | `/api/v1/student/talent-passport/timeline` | Paginated derived activity timeline. |
| GET | `/api/v1/student/talent-passport/completeness` | Score, checks, missing items. |
| GET | `/api/v1/student/talent-passport/visibility` | Publication state, section toggles, share URL. |
| PUT | `/api/v1/student/talent-passport/visibility` | Update section toggles and email/phone disclosure. |
| POST | `/api/v1/student/talent-passport/publish` | Publish; requires at least one visible section. |
| POST | `/api/v1/student/talent-passport/unpublish` | Revoke and rotate the public slug. |
| POST | `/api/v1/student/talent-passport/sync` | Run targeted student sync/backfill. |
| GET | `/api/v1/student/talent-passport/taxonomy?lang=` | Localized taxonomy. |
| POST | `/api/v1/student/talent-passport/export/pdf` | Download a public-safe PDF for the owner. |

## Public routes

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/v1/talent/public/<slug>` | Backend-filtered public Passport; 404 when unpublished/unknown. |
| GET | `/api/v1/talent/public/<slug>/pdf` | Public-safe PDF with QR link to `/talent/<slug>`. |

Retired/unpublished slugs are not revived. The public response contains only
enabled sections and whitelisted fields; grades, feedback, verification hashes,
internal IDs and unapproved AI results are omitted.

## Admin / instructor routes

| Method | Path | Access | Purpose |
|---|---|---|---|
| GET | `/api/v1/admin/talent/skills?lang=` | admin | Taxonomy list. |
| POST | `/api/v1/admin/talent/skills` | admin | Create skill; auto-creates a missing category. |
| GET | `/api/v1/admin/talent/mappings` | admin/instructor | Mapping list; instructors filtered to own courses. |
| POST | `/api/v1/admin/talent/mappings` | admin/instructor | Create mapping for an accessible course. |
| PUT | `/api/v1/admin/talent/mappings/<id>` | admin/instructor | Partial update with ownership check. |
| DELETE | `/api/v1/admin/talent/mappings/<id>` | admin/instructor | Delete mapping with ownership check. |
| GET | `/api/v1/admin/talent/evidence?status=&q=` | admin | Search evidence by status/title/user. |
| POST | `/api/v1/admin/talent/evidence/<id>/verify` | admin | Explicit verification; self-verification forbidden. |
| POST | `/api/v1/admin/talent/evidence/<id>/reject` | admin | Reject evidence and recompute skill state. |
| GET | `/api/v1/admin/talent/audit?student_id=` | admin | Paginated audit events. |

Mapping payload validation includes `min_score` in `0..100` and
`proficiency_label` length ≤ 64.
