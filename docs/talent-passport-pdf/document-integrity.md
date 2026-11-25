# Document Integrity

## 1. Two hashes

Every generated snapshot stores two distinct SHA-256 values:

| Field | Source | Purpose |
|---|---|---|
| `content_sha256` | Canonical JSON of approved spec fields (`canonical_spec_hash`) | Detect changes in the underlying document data and template version. |
| `file_sha256` | Exact bytes returned by the renderer | Detect changes or corruption of the issued PDF file. |

`data_revision` is the first 16 characters of `content_sha256` and is indexed for
quick comparison. Neither hash is used as a public identifier.

## 2. Canonical content rules

`DocumentSpec.canonical_content()` includes the edition, template version,
profile, completeness, learning, skills, projects, certificates, achievements,
direction and statistics. The JSON is serialized with sorted keys, compact
separators and UTF-8, using `default=str` for non-JSON values.

It excludes `document_ref`, `generated_at`, `verification_url`, `public_url` and
`status`, because those are snapshot-specific and should not alter the data
revision when identical information is regenerated.

## 3. Storage integrity

`storage.write_pdf()` writes to a temporary file in the same storage directory,
flushes, calls `fsync`, and then uses `os.replace()` for an atomic rename. Only
bytes beginning with `%PDF` are accepted. File names must match
`^[A-Za-z0-9][A-Za-z0-9_-]{0,63}\.pdf$`, which prevents traversal.

`service.read_document()` re-reads the stored bytes on every preview/download
and compares SHA-256 with `file_sha256`. A mismatch raises `ValueError`, which
the route layer maps to `400 validation_error`. The public verification endpoint
maps the same check to `integrity_failed`.

## 4. Post-render validation

`validate_pdf()` fails closed when:

- bytes are empty or do not start with `%PDF`;
- PDF parsing fails;
- there are fewer than two pages;
- any page's MediaBox is not A4 portrait within 1 pt tolerance;
- extracted searchable text is missing the title or expected document reference;
- no embedded font program (`/FontFile2` or `/FontFile3`) is present;
- no `/URI` annotation is present;
- no embedded image (`/Subtype /Image`) is present;
- no parsed hyperlink annotation with a `/URI` action exists.

The validation summary is stored in `metadata_json` with the validation counters
and the sorted list of profile sections used by the spec.

## 5. Verified behavior

Automated tests cover stored-hash enforcement (a modified stored file is
rejected), versioning/supersession, revocation and public verification. A real
sample document was validated with `pdfinfo`: A4, four pages, correct metadata,
no encryption, forms or JavaScript. The structural validator reported four
hyperlinks, two embedded images, embedded fonts and 2,871 searchable text
characters on that sample.
