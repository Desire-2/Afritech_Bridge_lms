# Professional Talent Passport PDF — File-Level Implementation Plan

Status: planned. Written before renderer, service, API, snapshot and frontend
changes. The factual infrastructure audit is recorded in `architecture.md`.

This plan supersedes the simple ReportLab story builder in
`backend/src/talent_passport/pdf.py` for this feature. It does not change the
existing LMS source-of-truth rules documented in `docs/talent-passport/`.

## 1. Backend design system and renderer

| File | Purpose |
|---|---|
| `backend/src/talent_passport/document/__init__.py` | Export the document renderer, service and public helpers. |
| `backend/src/talent_passport/document/tokens.py` | Immutable A4 geometry, brand colors, type scale, spacing, edition labels and template constants. |
| `backend/src/talent_passport/document/assets.py` | Controlled logo/font loading, aspect-preserving image placement and size/type validation. |
| `backend/src/talent_passport/document/text.py` | Font registration, width measurement, wrapping, truncation policy and HTML-safe text normalization. |
| `backend/src/talent_passport/document/canvas.py` | Low-level page primitives: background fills, rules, motific bridge lines, header/footer, page numbers and link annotations. |
| `backend/src/talent_passport/document/components.py` | Reusable editorial blocks: section heading, skill chip, timeline row, credential card, project card, callout and QR panel. |
| `backend/src/talent_passport/document/pagination.py` | Flow engine with measured height, widow/orphan control, heading keep-with-next and atomic cards. |
| `backend/src/talent_passport/document/sections.py` | Canonical section builders for cover, identity, learning journey, skills, projects, credentials, achievements, direction and verification. |
| `backend/src/talent_passport/document/renderer.py` | Public `render_document(spec) -> bytes` entry point; owns page composition and PDF metadata. |
| `backend/src/talent_passport/document/validation.py` | Post-render structural validation: A4 MediaBox, page count, font embedding, links, QR and required text. |
| `backend/src/talent_passport/pdf.py` | Compatibility façade delegating to the new renderer; keeps the old call signature for existing routes/tests. |

The renderer remains ReportLab `canvas.Canvas` based. It performs its own
measured pagination so the backend, not the browser or CSS engine, owns every
coordinate. All text is drawn with registered embedded TTF fonts and remains
selectable/searchable. QR codes and hyperlinks are generated server-side.

## 2. Authoritative data and edition filtering

| File | Purpose |
|---|---|
| `backend/src/talent_passport/document/spec.py` | Build a normalized, backend-owned `DocumentSpec` from a Passport id and edition; no client-supplied layout/content is accepted. |
| `backend/src/talent_passport/services.py` | Add authoritative document-spec accessors that reuse existing evidence/visibility rules rather than creating a second data path. |
| `backend/src/talent_passport/enums.py` | Add document edition, status and template-version constants. |

Editions:

- `PROFESSIONAL_SHARE`: public-safe; requires published Passport plus per-section visibility; intended for employers and QR verification.
- `PERSONAL_RECORD`: owner-only; may include owner-visible private profile fields and a longer learning record; never includes grades, feedback, verification hashes, internal ids or another student's data.

## 3. Snapshot, versioning and integrity persistence

| File | Purpose |
|---|---|
| `backend/src/talent_passport/models.py` | Add `TalentPassportDocument` for document reference, edition, template version, data revision, content hash, rendered-file hash, storage path, status, ownership and timestamps. |
| `backend/migrations/versions/<rev>_add_talent_passport_documents.py` | Guarded additive Alembic revision after `f7a2b9c3d4e5`; downgrade drops only the new table. |
| `backend/src/talent_passport/document/repository.py` | Create, supersede, revoke and query document rows atomically; enforce one current document per edition. |
| `backend/src/talent_passport/document/storage.py` | Atomic filesystem write/read/delete under a configurable storage root; preserve issued files and refuse path traversal. |
| `backend/src/talent_passport/document/service.py` | Orchestrate spec → render → validate → store → persist metadata; expose generate, current, history, metadata, preview and download operations. |
| `backend/src/config.py` or existing config loader | Add storage root and public verification base URL settings without changing unrelated configuration. |

Each generated document stores both a canonical `content_sha256` and a rendered
`file_sha256`. Superseding an edition marks the previous row `superseded` but
never deletes its file. Revocation marks a row `revoked` and makes public
verification fail closed.

## 4. APIs

| File | Purpose |
|---|---|
| `backend/src/talent_passport/routes.py` | Add private generate/history/metadata/preview/download routes, public current-document routes and the public verification route. Keep the two existing PDF endpoints as compatibility wrappers. |
| `backend/src/talent_passport/serializers.py` (new if needed) | Whitelist-only document metadata serializers; private metadata may include hashes, public metadata does not. |

Planned endpoints follow the existing `/api/v1` and `@jwt_required()` / `@safe`
conventions:

- `POST /api/v1/student/talent-passport/documents/generate`
- `GET /api/v1/student/talent-passport/documents`
- `GET /api/v1/student/talent-passport/documents/<document_ref>/metadata`
- `GET /api/v1/student/talent-passport/documents/<document_ref>/preview`
- `GET /api/v1/student/talent-passport/documents/<document_ref>/download`
- `GET /api/v1/talent/public/<slug>/documents/current/metadata`
- `GET /api/v1/talent/public/<slug>/documents/current/preview`
- `GET /api/v1/talent/public/<slug>/documents/current/download`
- `GET /api/v1/talent/verify/<document_ref>`
- `POST /api/v1/admin/talent/documents/<document_ref>/revoke`

Compatibility: the existing owner export and public `/pdf` endpoints continue to
return PDF bytes by resolving or generating the current Professional Share
document. They are not allowed to bypass edition filtering.

## 5. Frontend (request, preview and download only)

| File | Purpose |
|---|---|
| `frontend/src/services/talent-passport.service.ts` | Add document generation, history, metadata, preview and download methods; keep blob handling but no PDF construction. |
| `frontend/src/types/talent-passport.ts` | Add document metadata/edition/status types. |
| `frontend/src/components/talent-passport/DocumentControls.tsx` | Edition selector, generate action, progress/error states, preview and download actions. |
| `frontend/src/components/talent-passport/SharePanel.tsx` | Delegate PDF actions to `DocumentControls`; keep share URL/QR text information. |
| `frontend/src/components/talent-passport/PublicPassportView.tsx` | Replace direct `/pdf` download with preview/download of the backend current document. |
| `frontend/src/app/student/talent-passport/documents/page.tsx` | History view showing version, generated time, status and actions. |
| `frontend/src/lib/i18n/talent-passport.ts` | Add en/fr/rw copy for editions, versions, statuses and generation states. |

No jsPDF, pdf-lib, html2canvas, canvas drawing, `window.print()` or editable
HTML printing may be used for Talent Passport. Preview uses an iframe/object
URL containing backend bytes only.

## 6. Tests and visual verification

| File | Purpose |
|---|---|
| `backend/tests/test_talent_passport_pdf.py` | Unit/integration tests for A4, embedded fonts, text extraction, page count, links/QR, metadata, privacy, ownership, hashes, snapshots, supersede/revoke and verification. |
| `backend/scripts/render_talent_passport_samples.py` | Generate sample PDFs into a temporary directory for manual visual inspection; test-only helper, not product code. |
| `backend/scripts/verify_talent_passport_documents.py` | Reusable validation script for generated files (pdfinfo/pdftoppm when available). |
| `frontend/tests/talent-passport-documents.test.ts` | Service URL/blob tests and confirmation that no client PDF construction is imported by Passport code. |

Verification plan:

1. Run targeted and full backend suites.
2. Generate real PDFs, inspect `pdfinfo` output, render pages to PNG and visually inspect cover/content/footer.
3. Run privacy/security/integrity tests and migration lifecycle check.
4. Run targeted frontend typecheck/tests and full production build.
5. Record exact commands and observed results in `final-engineering-report.md`.

## 7. Documentation

Create every file listed in `docs/talent-passport-pdf/README.md`, especially:

- `design-system.md`
- `pagination.md`
- `generation-service.md`
- `templates-and-versioning.md`
- `document-integrity.md`
- `privacy-and-security.md`
- `verification.md`
- `deployment.md`
- `print-reliability.md`
- `troubleshooting.md`
- `final-engineering-report.md`

The final report will follow the required Architecture, Design, Backend, APIs,
Integrity, Frontend, Testing and Files sections and will only claim executed and
verified behavior.
