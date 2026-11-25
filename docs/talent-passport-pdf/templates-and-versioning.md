# Templates, Editions and Versioning

## 1. Template identity

The official template version is `1.0.0`, defined as `TEMPLATE_VERSION` in
`backend/src/talent_passport/document/tokens.py`. It is stored on every
`TalentPassportDocument` row and printed on the cover document-control block.
The PDF metadata also identifies the creator as
`AfriTech Bridge Talent Passport Document Service`.

A future layout change should increment this constant and keep the prior
version's renderer available for historical interpretation if exact reproduction
is required. The current implementation stores enough information to retain and
serve issued bytes unchanged even after the live renderer changes.

## 2. Editions

| Edition | Value | Intended use | Data source |
|---|---|---|---|
| Professional Share | `professional_share` | Employers, partners, QR verification | `services.public_payload()` with publication and per-section visibility enforced |
| Personal Record | `personal_record` | Owner-only fuller record | `services.export_payload()` plus serialized profile and `User` name |

Edition values are stored as plain strings in `enums.py` (`DOCUMENT_EDITIONS`).
The frontend may choose only between these two values when requesting generation;
it cannot inject content or layout.

## 3. Snapshot lifecycle

Each generation creates a new immutable `TalentPassportDocument` row and a new
file named `<document_ref>.pdf`. Issued files are never overwritten.

- The previous current row for the same edition is marked `superseded` with
  `is_current = False` and a `superseded_at` timestamp.
- An audit event `document.superseded` records the change.
- A generation audit event `document.generated` records reference, edition,
  template version and data revision.
- Revocation is a separate explicit administrative action. It marks the row
  `revoked`, clears `is_current`, records `revoked_at` and an audit event.
- A revoked document cannot become current again by regeneration; a new
  generation creates a new row.

Statuses are `current`, `superseded` and `revoked`. Superseded documents remain
downloadable to their owner through history and remain verifiable if the
Passport stays published and file integrity holds.

## 4. Data revision

`data_revision` is the first 16 characters of `content_sha256`. The canonical
hash covers edition, template version, profile, completeness, learning, skills,
projects, certificates, achievements, direction and statistics. It deliberately
excludes snapshot-only fields such as `document_ref`, `generated_at` and
`verification_url`, so the same underlying data produces the same data revision
across regenerations while each issued document still has a unique reference and
rendered file hash.

## 5. Storage and migration

The snapshot table is added by the guarded Alembic revision
`c4e8b7a1d9f3_add_talent_passport_documents.py`, whose `down_revision` is
`f7a2b9c3d4e5`. The migration drops only the new table on downgrade. Migration
lifecycle verification passed for upgrade, downgrade and repeated upgrade.

Storage is local backend filesystem by default under
`<instance_path>/talent_passport_pdf`, configurable via
`TALENT_PASSPORT_PDF_STORAGE_DIR`. The database stores a safe relative file name,
not an arbitrary path.
