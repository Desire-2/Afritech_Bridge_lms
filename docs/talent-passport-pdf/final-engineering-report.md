# Professional Talent Passport PDF — Final Engineering Report

Date: 2026-11-23

This report records only changes and verification that were actually performed.
It follows the requested Architecture, Design, Backend, APIs, Integrity,
Frontend, Testing and Files sections.

## 1. Architecture

The original Talent Passport remains one Flask feature module in the existing
LMS. No second app, account system, student table, course system, grading engine
or certificate authority was introduced. The existing LMS tables remain the
source of truth for learning facts; Passport tables continue to hold curation,
self-described profile fields, taxonomy, mappings, derived evidence state,
publication and audit metadata.

The professional PDF is a backend-owned pipeline:

```
LMS records → filtered DocumentSpec (backend only)
            → ReportLab canvas renderer
            → structural validation
            → SHA-256 content/file hashes
            → atomic filesystem write
            → TalentPassportDocument row
            → private history/preview/download + public current/verify
```

The decision to use ReportLab `canvas.Canvas` with a custom measured flow engine
instead of WeasyPrint is recorded in `architecture.md`. The previous
`SimpleDocTemplate` story renderer in `backend/src/talent_passport/pdf.py` was
replaced by a compatibility facade delegating to the professional renderer.

## 2. Design

All visual values are backend constants in
`backend/src/talent_passport/document/tokens.py`: fixed A4 portrait geometry,
18 mm side margins, navy header and paper footer bands, the official
navy/teal/orange/warm-white/paper palette, and a fixed type scale.

Five DejaVu TTF faces are vendored under `backend/assets/fonts/` and registered
with ReportLab `TTFont`, so text is embedded, selectable and searchable without
depending on host fonts. The official `backend/static/images/logo.jpg` is
embedded as its original bytes with aspect-preserving placement; it is never
redrawn, recolored or stretched. The “Bridge to Opportunity” motif is vector
line work generated from coordinates.

Content sections are numbered and ordered: Professional identity, Learning
journey, Skills and competencies, Project portfolio, Credentials, Achievements,
Professional direction and Final verification. Empty share-edition sections are
omitted; the personal record edition may show an explicit empty note.

## 3. Backend

Implemented `backend/src/talent_passport/document/` with `tokens.py`, `text.py`,
`assets.py`, `primitives.py`, `blocks.py`, `spec.py`, `sections.py`, `cover.py`,
`pagination.py`, `renderer.py`, `validation.py`, `storage.py`, `repository.py`,
`service.py` and `__init__.py`.

Key implementation details:

- `DocumentSpec` is immutable and built only from `services.public_payload()` or
  `services.export_payload()` plus profile data; no HTTP client supplies layout
  or unapproved content.
- `renderer.render_document()` performs two passes so every footer prints an
  accurate `PAGE n / total`.
- The flow engine uses measured blocks, heading-plus-first-block groups and
  minimum-height rules. A coordinate mismatch discovered during page-image/text
  inspection was fixed in `FlowEngine.place()` so that bottom-based cursor values
  are converted to the top-based coordinates expected by `Block.draw()`.
- A second coordinate bug was fixed in `assets.draw_logo()`: the logo was embedded
  but drawn below the page edge because a top-based value was passed to the
  bottom-based `canvas.drawImage()` origin. It now converts with
  `PAGE_HEIGHT - (top + height)`, so the official logo is visible on the cover
  and in every repeated header.
- Logo presentation was then strengthened using UI/UX design intelligence
  guidance: the cover mark grew from 14 mm to 20 mm in a tightened chip with a
  teal baseline, the header mark from 6 mm to 8 mm, and a `LogoMark` closing
  signature was added to the final verification panel. The official asset bytes
  remain unchanged.
- `validation.validate_pdf()` fails closed on non-PDF bytes, parser errors,
  fewer than two pages, non-A4 MediaBox, missing searchable title/reference,
  missing embedded fonts, missing images, missing `/URI` annotations or fewer
  than one parsed hyperlink.
- `storage.write_pdf()` uses `mkstemp`, `fsync` and `os.replace` for atomic
  writes, with strict file-name validation; `read_pdf()` rejects traversal paths.
- `repository.create_document()` supersedes the previous current row for the
  same edition and writes audit events; `revoke_document()` is a separate
  explicit action.
- `backend/src/talent_passport/evidence.py` `ensure_visibility()` was corrected
  to query `PassportVisibility` directly and set the relationship, fixing a
  latent duplicate-row bug.
- Added `TalentPassportDocument` to `models.py`, document constants to
  `enums.py`, PDF config keys to `config.py`, and guarded migration
  `c4e8b7a1d9f3_add_talent_passport_documents.py` after `f7a2b9c3d4e5`.

## 4. APIs

Routes added in `backend/src/talent_passport/routes.py`:

| Method | Path | Protection |
|---|---|---|
| POST | `/api/v1/student/talent-passport/documents/generate` | JWT + owner |
| GET | `/api/v1/student/talent-passport/documents` | JWT + owner |
| GET | `/api/v1/student/talent-passport/documents/<ref>/metadata` | JWT + owner |
| GET | `/api/v1/student/talent-passport/documents/<ref>/preview` | JWT + owner |
| GET | `/api/v1/student/talent-passport/documents/<ref>/download` | JWT + owner |
| GET | `/api/v1/talent/public/<slug>/documents/current/metadata` | Public + rate limit |
| GET | `/api/v1/talent/public/<slug>/documents/current/preview` | Public + rate limit |
| GET | `/api/v1/talent/public/<slug>/documents/current/download` | Public + rate limit |
| GET | `/api/v1/talent/verify/<document_ref>` | Public + rate limit |
| POST | `/api/v1/admin/talent/documents/<ref>/revoke` | JWT + admin |

Legacy `POST /student/talent-passport/export/pdf` and `GET
/talent/public/<slug>/pdf` now resolve versioned snapshots instead of bypassing
edition filtering. Private metadata includes hashes/ids; public metadata and
verification do not.

## 5. Integrity

Each snapshot stores `content_sha256` (canonical spec hash), `file_sha256`
(exact rendered bytes) and an indexed 16-character `data_revision`. Snapshot-only
fields such as reference, timestamp and verification URL are excluded from the
canonical hash. `read_document()` re-hashes stored bytes on every preview and
download; a mismatch raises an error that routes map to a safe envelope. Public
verification returns states `not_found`, `issued`, `revoked`, `unpublished` or
`integrity_failed` and never exposes hashes, ids or private data. Issued files
are retained after supersession and revocation.

## 6. Frontend

`frontend/src/services/talent-passport.service.ts` gained document generate,
history, metadata, preview, download and public verification methods. Its legacy
`exportPdf()` and `getPublicPdf()` now delegate to versioned document endpoints.
Types were added in `frontend/src/types/talent-passport.ts` (`TalentDocument`,
`TalentDocumentEdition`, `TalentDocumentStatus`, `TalentDocumentList`,
`TalentDocumentVerification`).

A new `frontend/src/components/talent-passport/DocumentPanel.tsx` provides
edition selection, generation, history, inline PDF preview and download. It was
mounted on the settings page. Preview uses only an iframe with an object URL
containing backend bytes. No jsPDF, PDF-lib, html2canvas, canvas drawing,
`window.print()` or editable HTML printing was added to the Passport module.
i18n keys were added in English, French and Kinyarwanda. The official
`/logo.jpg` asset is displayed in the shared `PassportPageHeader` and the
`DocumentPanel` header using `next/image`, matching the brand asset already
embedded in the PDF.

## 7. Testing

Executed commands and observed results (WSL Python 3.10.12; Node v20.19.6):

- `python3 -m pytest tests/test_talent_passport_pdf.py -q --disable-warnings`
  → `6 passed, 72 warnings in 3.99s` originally; `7 passed, 72 warnings` after
  adding the logo-placement regression tests.
- `python3 -m pytest tests/test_talent_passport.py -q --disable-warnings`
  → `19 passed, 160 warnings in 6.81s`.
- `python3 -m pytest tests/test_talent_passport_pdf.py tests/test_talent_passport.py -q --disable-warnings`
  → `25 passed, 219 warnings in 19.93s` (after the pagination fix); `26 passed,
  219 warnings in 9.71s` after the logo fix.
- `python3 scripts/verify_talent_passport_migration.py` → PASS for upgrade,
  downgrade and repeated upgrade.
- A full backend suite run initially found one unrelated hardcoded head revision
  in `tests/test_aage_migration.py`; it was updated to `c4e8b7a1d9f3`, and the
  targeted test then passed (`1 passed, 13 warnings in 43.78s`).
- Final full backend suite after all fixes:
  `python3 -m pytest tests -q --disable-warnings` →
  `615 passed, 5 skipped, 2188 warnings in 213.68s (0:03:33)`. (An earlier run
  showed one unrelated order-dependent approval-test failure; that test passes
  in isolation and the final clean run confirms no regression.)
- `npx --yes tsx --test tests/talent-passport.test.ts` → all 9 tests passed,
  including the new document-method URL test.
- `npx --yes tsc -p tsconfig.talent-passport.json --noEmit --pretty false` →
  clean exit with no diagnostics for the Passport module.
- A clean full-project `tsc -p tsconfig.json --noEmit` is not claimed because two
  unrelated pre-existing files (`EnhancedModificationDashboard.tsx` and
  `index-new.ts`) contain parse errors.
- `npm run build` → production build completed successfully (re-run after the
  final frontend cleanup and logo additions; compiled in 2.3 min, generated
  92 static pages, `BUILD_EXIT=0`).
- Real PDF generation produced a four-page A4 document. `pdfinfo` reported A4,
  4 pages, correct title/author/creator/subject metadata and no encryption,
  forms or JavaScript. `validate_pdf()` reported 4 hyperlinks, 2 embedded
  images, embedded fonts and 2,871 text characters.
- Pages were rendered with `pdftoppm -png -r 110`. Text-position inspection with
  `pdftotext -bbox-layout` found the section-order defect described above; the
  fix was verified by re-generating the PDF and confirming sections 01–03 on
  page 2, 04–07 on page 3 and 08 on page 4 in top-to-bottom order.
- After the logo fix, a freshly generated PDF was rendered at 150 dpi and the
  logo was confirmed visible by pixel inspection: 725 dark pixels in the cover
  logo region and 116 in the page-2 header logo region. The content-stream
  assertion confirmed an image placement at y≈768 pt (top of the 841.89 pt
  page). Temporarily restoring the old coordinate made both new tests fail.
- After the visual refinement, a freshly rendered PDF still validated as 3 A4
  pages with 4 hyperlinks, 2 embedded images and embedded fonts. Pixel counts
  rose to 1,612 (cover), 210 (page-2 header) and 595 (final-page mark).
  `pdftotext -layout` confirmed sections 01–04 on page 2 and 05–08 on page 3 in
  order, with the closing signature on the final page.
- The full backend suite was re-run after these changes and passed:
  `615 passed, 5 skipped, 2188 warnings in 213.68s`.

## 8. Files

Backend:

- `backend/src/talent_passport/document/` — renderer package (14 modules).
- `backend/src/talent_passport/pdf.py` — compatibility facade.
- `backend/src/talent_passport/routes.py` — document and verification APIs.
- `backend/src/talent_passport/models.py` — `TalentPassportDocument`.
- `backend/src/talent_passport/enums.py` — document constants.
- `backend/src/talent_passport/config.py` — storage/verification config keys.
- `backend/src/talent_passport/evidence.py` — visibility duplicate-row fix.
- `backend/migrations/versions/c4e8b7a1d9f3_add_talent_passport_documents.py`.
- `backend/scripts/verify_talent_passport_migration.py` — updated head check.
- `backend/tests/test_talent_passport_pdf.py` — 6 PDF/integrity/privacy tests.
- `backend/tests/test_aage_migration.py` — head revision assertion updated.
- `backend/assets/fonts/` — five TTF faces and `DEJAVU-LICENSE.txt`.
- `backend/static/images/logo.jpg` — official logo embedded unchanged.

Frontend:

- `frontend/src/services/talent-passport.service.ts`.
- `frontend/src/types/talent-passport.ts`.
- `frontend/src/components/talent-passport/DocumentPanel.tsx` (new).
- `frontend/src/app/student/talent-passport/settings/page.tsx`.
- `frontend/src/lib/i18n/talent-passport.ts`.
- `frontend/tests/talent-passport.test.ts`.

Documentation:

- `docs/talent-passport-pdf/README.md`, `architecture.md`,
  `implementation-plan.md`, `design-system.md`, `pagination.md`,
  `generation-service.md`, `templates-and-versioning.md`,
  `document-integrity.md`, `privacy-and-security.md`, `verification.md`,
  `deployment.md`, `print-reliability.md`, `troubleshooting.md` and this report.
