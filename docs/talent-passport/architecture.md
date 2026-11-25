# Architecture

## Module boundary

Talent Passport is one Flask feature module inside the existing application:

```
backend/src/talent_passport/
  __init__.py     package/blueprint export
  models.py       Passport-owned tables
  enums.py        canonical state/action constants
  config.py       completeness and presentation configuration
  taxonomy.py     taxonomy bootstrap from course_skill_profiles.py
  evidence.py     idempotent evidence engine and mapping resolution
  sync.py         targeted event handling, per-student sync, backfill
  achievements.py explicit Passport achievement rules over LMS records
  services.py     aggregation and private/public serializers
  pdf.py          public-safe PDF and QR payload
  hooks.py        failure-isolated notify_talent_passport entry point
  routes.py       /api/v1 private, public and admin endpoints
```

`backend/main.py` registers one blueprint. The existing LMS remains the source
of truth for identity, courses, progress, grading, certificates and
achievements.

## Runtime flow

```
LMS write (grade, submission, progress, certificate, achievement)
        │ thin hook
        ▼
notify_talent_passport(event_type, student_id, source_type, source_id,
                       course_id, suffix)
        │ failure isolated
        ▼
event key + evidence upsert → skill state derivation → summary recompute
        │
        ▼
private API / public filtered API / PDF / QR share link
```

Hooks never perform the LMS write; they only notify. If a hook fails, the LMS
write is not rolled back. A targeted or full `sync_student` is the retry and
backfill path.

## Read model

The Passport stores only:

- curation (featured projects, order, reflections, links);
- professional self-described profile fields;
- taxonomy and mappings;
- derived student skills and evidence references;
- publication/visibility/audit metadata;
- processed event keys.

It does not copy submissions, grades, certificates or courses into new
authoritative tables. Each evidence row references the original LMS record by
`(source_type, source_id)`.

## Frontend boundary

The frontend is a route group inside the existing Next.js app. Private pages
reuse the existing JWT axios instance and student layout. The public page uses
a JWT-free client and renders only fields returned by the backend public
serializer. No second auth flow or account system exists.
