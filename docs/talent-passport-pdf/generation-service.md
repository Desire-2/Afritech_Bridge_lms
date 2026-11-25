# Generation Service

## 1. Module boundary

The generation pipeline lives in `backend/src/talent_passport/document/`:

| Module | Responsibility |
|---|---|
| `spec.py` | Immutable `DocumentSpec` and canonical content hashing. |
| `assets.py` | Controlled logo/font/QR loading. |
| `text.py` | Font registration, measurement, wrapping and text cleanup. |
| `tokens.py` | Geometry, palette, typography and template identity constants. |
| `primitives.py` | Vector/text/page primitives with top-based coordinates. |
| `blocks.py` | Reusable measured editorial blocks. |
| `cover.py` | Signature cover page. |
| `sections.py` | Canonical ordered content sections. |
| `pagination.py` | Measured flow engine and page transitions. |
| `renderer.py` | Two-pass rendering and PDF metadata. |
| `validation.py` | Fail-closed structural validation of PDF bytes. |
| `storage.py` | Atomic filesystem write/read. |
| `repository.py` | Snapshot persistence, supersession and revocation. |
| `service.py` | Public orchestration API. |

`backend/src/talent_passport/pdf.py` remains as a compatibility facade. Older
callers that pass a filtered payload still receive a backend-rendered
professional document; they cannot supply layout or unapproved content.

## 2. Spec construction

`service.build_spec()` builds a normalized `DocumentSpec` from existing Passport
services:

- **Professional Share Edition** uses `services.public_payload(slug)`, which
  requires a published Passport and applies all section visibility toggles. If
  the Passport is unavailable, generation raises `PermissionError`.
- **Personal Record Edition** uses `services.export_payload(student_id)` plus
  `serialize_profile(passport)` and the learner's name from `User`.

The spec contains only approved content fields, derived statistics, the opaque
`document_ref`, a trusted verification URL, template version and edition/status
labels. No HTTP client supplies a spec.

Statistics are derived in the backend: verified skills, certificates, projects
and learning records. Verified-skills counting uses the canonical status string
`VERIFIED`; no self-asserted proficiency is created by the renderer.

## 3. Generation sequence

`service.generate(passport, edition, verification_base_url, generated_by_id,
actor_role)` performs these steps in order:

1. Create an opaque reference with `TP-` plus a URL-safe random token.
2. Capture `now_local()` as the generation timestamp.
3. Build the `DocumentSpec` through the edition-specific filtered payload.
4. Compute `content_sha256` from `canonical_spec_hash(spec)`.
5. Render PDF bytes with `render_document(spec)`.
6. Validate bytes with `validate_pdf(pdf_bytes, spec)`.
7. Compute `file_sha256` from the exact rendered bytes.
8. Atomically write the PDF to backend storage.
9. Persist a `TalentPassportDocument` row, superseding the previous current row
   for the same edition.
10. Commit and refresh before returning the row.

Any renderer or validator exception propagates to the `@safe` route wrapper,
which converts it to a stable JSON error envelope; no unvalidated file is
persisted.

## 4. Retrieval operations

| Function | Behavior |
|---|---|
| `get_document(ref)` | Fetch by opaque reference; `LookupError` if absent. |
| `current_for_passport(passport, edition)` | Fetch the current row for that edition. |
| `current_for_slug(slug, base_url)` | Resolve published Passport; lazily generate the current share snapshot if none exists. |
| `history(passport, edition)` | Return snapshots newest first, optionally filtered. |
| `read_document(document)` | Read stored bytes and reject them if SHA-256 differs from the stored hash. |
| `serialize_document(document, private, base_url)` | Whitelist metadata; private payload includes hashes and ids. |
| `verify(ref, base_url)` | Fail-closed public verification result. |
| `revoke(document, actor_id, actor_role)` | Explicit administrative revocation. |

All persistence is in the existing Flask-SQLAlchemy session; the Passport module
does not introduce a second database or identity system.
