# Deployment

## 1. Runtime dependencies

The backend already pins the required libraries in `backend/requirements.txt`:

- `reportlab==4.0.9` — canvas rendering, TTF embedding, link annotations.
- `PyPDF2==3.0.1` — page counting for two-pass numbering and validation parsing.
- `qrcode[pil]==7.4.2` — high-error-correction QR generation.
- `Pillow==10.4.0` — image support used by QR/reportlab image readers.
- `pdf2image==1.16.3` and `pytesseract==0.3.13` — available for optional rendered-page/OCR inspection.

The Docker image installs `poppler-utils` and `fonts-dejavu-core`. TheRenderer
itself does not depend on host fonts: five DejaVu TTF files and
`DEJAVU-LICENSE.txt` are vendored under `backend/assets/fonts/`.

## 2. Repository assets that must ship

- `backend/assets/fonts/DejaVuSans.ttf`
- `backend/assets/fonts/DejaVuSans-Bold.ttf`
- `backend/assets/fonts/DejaVuSans-Oblique.ttf`
- `backend/assets/fonts/DejaVuSerif.ttf`
- `backend/assets/fonts/DejaVuSerif-Bold.ttf`
- `backend/assets/fonts/DEJAVU-LICENSE.txt`
- `backend/static/images/logo.jpg` — embedded unchanged; renderer fails closed if missing.

## 3. Configuration

| Flask config key | Purpose | Default |
|---|---|---|
| `TALENT_PASSPORT_PDF_STORAGE_DIR` | Directory for issued PDF files | `<instance_path>/talent_passport_pdf` |
| `TALENT_PASSPORT_VERIFICATION_BASE_URL` | Absolute base used to build verification URLs and QR targets | Required for generation; no silent fallback |

The storage directory is created on first write and must be writable by the
backend process. It should be on persistent storage because issued snapshots and
their hashes are retained after supersession. Backups must include both the
database and this directory.

## 4. Database migration

Apply Alembic upgrades to the new head:

```bash
cd backend
flask db upgrade
```

The new revision `c4e8b7a1d9f3` adds the `talent_passport_documents` table. The
migration is guarded and additive; downgrade drops only that table. The helper
`python3 scripts/verify_talent_passport_migration.py` was run against WSL Python
and passed upgrade, downgrade and repeated upgrade checks.

## 5. Rollback

Rolling back the application code to the previous simple renderer does not remove
the new table. Previously issued files remain in storage. Because legacy PDF
endpoints now resolve versioned snapshots, a rollback that also reverts those
routes would return simple PDFs again; the document APIs would no longer be
available. Do not delete the storage directory when rolling back code.

## 6. Operational checks

Recommended post-deploy checks:

1. Generate one document of each edition through the API with a valid JWT.
2. Call the public metadata endpoint for a published Passport and confirm a
   current `professional_share` document resolves.
3. Download the file and confirm the QR target host is the deployed API.
4. Render one page with `pdftoppm` and inspect that text and the logo are visible.
5. Verify the opaque reference through the public verification endpoint.
