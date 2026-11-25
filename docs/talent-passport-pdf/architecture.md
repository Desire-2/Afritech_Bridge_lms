# Professional Talent Passport PDF — Architecture Audit and Decision

Date: 2026-11-23

This audit was written before renderer, service, API, snapshot and frontend
changes. It records only inspected facts followed by the selected design. The
file-level plan is in `implementation-plan.md`.

## 1. Existing backend PDF infrastructure

The main Flask app is `backend/main.py`. It creates the app at line 129 and
registers the existing blueprints in the 400s. Python is 3.10.12 in the local
environment and the Docker base is `python:3.10-slim` (`backend/Dockerfile:2`).
Flask is pinned to `2.3.3` (`backend/requirements.txt:6`).

PDF-related code already exists in three separate product areas:

| Area | Path | Library | Pattern |
|---|---|---|---|
| Certificates | `backend/src/services/certificate_service.py:883–1644` | ReportLab `canvas`, `qrcode`, Pillow, `pdf2image` | Landscape A4 certificate bytes; QR with `ERROR_CORRECT_H`; verification hash on the certificate model |
| Internship offers | `backend/src/services/internship_offer_service.py:81–759` | ReportLab `canvas`, `qrcode` | A4 PDF written to disk; `pdf_hash = sha256(pdf_bytes)`; public verification by opaque `verification_hash` |
| Payment slips | `backend/src/services/payment_slip_service.py:52–941` | WeasyPrint, `qrcode` | HTML rendered to PDF; used for email attachments |
| Current Passport | `backend/src/talent_passport/pdf.py:75–164` | ReportLab `SimpleDocTemplate`, `qrcode` | A4 story of paragraphs; no metadata beyond title/author; no page numbers, links, tables, backgrounds or validation |

`backend/requirements.txt` pins `reportlab==4.0.9` (:43), `weasyprint==69.0`
(:48), `qrcode[pil]==7.4.2` (:42), `PyPDF2==3.0.1` (:11), `pdf2image==1.16.3`
(:34), `Pillow==10.4.0` (:9) and `pytesseract==0.3.13` (:41). The Docker image
also installs `poppler-utils` and `fonts-dejavu-core`
(`backend/Dockerfile:14–19`).

`PyPDF2` is already used for text extraction in
`backend/src/services/payment_slip_verifier.py:381–383` and
`backend/src/services/aage/artifacts.py:420–424`. There is no existing PDF
structural validation library or PDF snapshot model. The only stored PDF hash
pattern is the internship offer's `pdf_hash`, compared on demand by
`verify_offer_pdf()` (`internship_offer_service.py:619–647`).

## 2. Current Talent Passport PDF flow

`POST /api/v1/student/talent-passport/export/pdf` is JWT-protected and builds a
payload with `services.export_payload(passport.student_id)` before rendering
(`backend/src/talent_passport/routes.py:389–400`). `GET
/api/v1/talent/public/<slug>/pdf` is public, rate-limited and builds its payload
with `services.public_payload(slug)` (`routes.py:417–426`). Both return an
`application/pdf` attachment via `_pdf_response()` (`routes.py:179–184`).

`export_payload()` (`services.py:736–782`) removes portfolio/social URLs and
includes professional self-description, skills, projects, certificates,
achievements, timeline, completeness and a public URL when published.
`public_payload()` (`services.py:785–854`) additionally requires
`is_published`, visibility section toggles and a matching slug; it returns only
whitelisted fields and conditionally exposes email/phone. Both exclude grades,
feedback, verification hashes, evidence internals and internal source IDs.
The renderer consumes only a small subset of those fields.

`build_passport_pdf()` has four styles inherited from ReportLab sample styles:
title 22 pt, heading 13 pt, body 9.5 pt and small 8 pt, all in the default
Helvetica family (`pdf.py:38–56`). It draws a title, name, headline, location,
completeness, narrative sections and a 32 mm QR when a URL is supplied
(`pdf.py:81–142`), then a disclaimer (`pdf.py:145–150`). QR failures are
silently swallowed. There are no hyperlinks, page numbers, header/footer,
backgrounds, controlled images, embedded fonts or post-render checks.

Existing tests only assert that the two endpoints return bytes beginning with
`%PDF` (`backend/tests/test_talent_passport.py:588–590, 715–724`). No visual,
font, pagination, link or privacy-content inspection has been performed.

## 3. Assets, fonts and storage facts

The official logo is `backend/static/images/logo.jpg`. It is already embedded
into certificate and offer PDFs (`certificate_service.py:1066–1087`,
`internship_offer_service.py:147–168`) and served publicly at `GET /api/v1/logo`
(`backend/main.py:338–344`). Mirrors exist in `frontend/public/logo.jpg` and the
operations service. There is no SVG brand mark. The official CEO signature is
`backend/static/images/sign.jpg`.

No font files are tracked in repository source. ReportLab's local installation
bundles `Vera.ttf`, `VeraBd.ttf`, `VeraIt.ttf` and `VeraBI.ttf` under
`reportlab/fonts`. WSL also exposes DejaVu and Ubuntu TTFs under
`/usr/share/fonts/truetype/`. No backend code currently calls
`pdfmetrics.registerFont` or embeds a custom font.

Storage is mixed: offer letters persist a filesystem path plus hash
(`internship_models.py:369–370`, `internship_offer_service.py:595–599`), while
uploaded course/application files use Google Drive when configured and
`/uploads/...` paths or data URLs otherwise. There is no S3 abstraction.
Background work uses APScheduler, database-backed task threads and an AAGE job
row-as-queue; PDF generation does not currently use a job system.

## 4. Frontend boundary

The Passport frontend already treats PDFs as backend-owned blobs:
`frontend/src/services/talent-passport.service.ts` posts to the private export
endpoint with `responseType: 'blob'` (`:301–310`) and GETs the public PDF
(`:324–334`); `downloadBlob()` (`:154–166`) creates a temporary object URL for
download. `SharePanel.tsx` and `PublicPassportView.tsx` call those methods. No
Talent Passport code uses jsPDF, canvas, `window.print()` or client-side layout.
A different feature, transcript PDF, does use jsPDF in
`frontend/src/lib/transcriptPdf.ts`; it is outside this module's scope and must
not be used for Passport.

Existing inline PDF preview patterns use an `<iframe>` with an object URL or a
server URL (`frontend/src/components/FilePreview.tsx:173–183`,
`frontend/src/app/admin/internships/applications/[id]/page.tsx:219–226,
1065–1098`). No Passport preview exists yet.

## 5. API and verification conventions

Private endpoints use `@jwt_required()` and scoped lookups; public certificate
verification is JWT-free, rate-limited per IP and never echoes hashes
(`backend/src/routes/certificate_routes.py:33–73, 221–372`). Talent Passport
already uses `@safe`, role helpers and an in-process public rate limiter
(`talent_passport/routes.py:60–78, 125–176`). Offer verification demonstrates
the opaque-token pattern: a public route resolves a stored `verification_hash`
without exposing internal ids.

## 6. Renderer decision

The professional PDF will use **ReportLab `canvas.Canvas` with a backend-owned
flow engine**, not WeasyPrint.

Reasons:

1. ReportLab is already pinned and used for the existing certificate and offer
   documents, so no new runtime dependency is required.
2. Low-level canvas drawing gives deterministic A4 coordinates, fixed margins,
   controlled pagination, vector rules/motifs, precise image placement and
   direct `linkURL` annotations.
3. ReportLab TTF registration embeds font subsets, satisfying the embedded-font
   and selectable/searchable-text requirements. The current `SimpleDocTemplate`
   approach cannot enforce the required heading/keep-together rules or exact
   page composition.
4. WeasyPrint's CSS paged-media layout is appropriate for receipts such as
   payment slips, but its automatic pagination would leave page geometry and
   orphan control outside the backend's explicit control.
5. `PyPDF2`, `qrcode[pil]`, Pillow and poppler are already available for
   validation, QR generation and rendered-page inspection.

Font strategy: vendor DejaVu Sans and DejaVu Serif TTF files into the backend
under a controlled asset directory and register them with `TTFont`. This avoids
relying on a host font path; the Docker image already includes
`fonts-dejavu-core`, and the DejaVu license permits redistribution with its
copyright notice. Body and labels use sans, while the display title and large
numerals use serif for the editorial credential look.

Branding strategy: embed the exact bytes of `backend/static/images/logo.jpg`
with `ImageReader`, preserve its aspect ratio, and never redraw, recolor or
stretch it. Brand colors are applied only to surrounding bands, rules, text and
motifs.

## 7. Resulting architecture

```
existing LMS records
    │ existing Passport evidence/visibility/services
    ▼
canonical DocumentSpec (backend only)
    │ edition filtering + normalized copy of approved fields
    ▼
ReportLab document renderer
    │ A4 geometry, embedded fonts, vector motif, QR, links, metadata
    ▼
validate → hash content and bytes → atomic file write
    │
    ▼
TalentPassportDocument row (edition, version, revision, hashes, status)
    │
    ├── private history/metadata/preview/download (JWT + ownership)
    └── public current document + public verification (opaque reference)
```

The frontend remains a request/preview/download client. It never supplies
layout, content, fonts, images or print CSS, and it cannot influence which
fields pass the backend's edition filtering.
