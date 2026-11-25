# Privacy and Security

## 1. Backend-only authority

The browser never supplies layout, content, fonts, images or print CSS for a
Passport document. It sends only an edition choice (`professional_share` or
`personal_record`) to the generate endpoint. All filtering, rendering, hashing,
storage and validation happen in the backend.

## 2. Edition filtering

- **Professional Share** is built from `services.public_payload(slug)`. That
  serializer requires `is_published` and a matching visibility row, and applies
  each section toggle (`professional_profile`, `skills`, `projects`,
  `certificates`, `learning_history`, `achievements`). Email and phone appear
  only when `show_email` / `show_phone` are enabled.
- **Personal Record** is built from the owner's export payload and profile. It
  is only reachable through JWT-protected owner routes.

Hidden sections are omitted entirely; the renderer never substitutes placeholder
records for hidden data. Empty personal-record sections may show a small
“No approved records in this section yet.” note, which contains no third-party
data.

## 3. Excluded content

Neither edition includes grades, feedback, verification hashes, evidence
internals, internal source ids, unpublished submissions, provisional AI results
or another student's data. Public metadata excludes database ids and hashes;
private metadata includes them only to the owner or an administrator.

## 4. Authorization

| Route group | Protection |
|---|---|
| Private generate/history/metadata/preview/download | `@jwt_required()` plus `_document_for_owner()`, which compares `document.student_id` with the token identity unless the user is admin/superadmin |
| Public current metadata/preview/download | No JWT; in-process per-IP rate limit; requires published Passport and visibility |
| Public verification | No JWT; per-IP rate limit; fail-closed |
| Admin revoke | `@jwt_required()` plus `_require_admin()` |

## 5. Storage and path safety

Files are stored under a configurable backend directory, defaulting to the Flask
instance path. Only safe relative file names derived from the opaque reference
are accepted by `storage.read_pdf()`. Remote asset fetching is not used. The
logo and fonts come from repository-owned files.

## 6. Verification privacy

Public verification accepts only the opaque `document_ref`. It never accepts or
returns internal ids, content hashes or file hashes. The response states are
`not_found`, `issued`, `revoked`, `unpublished` and `integrity_failed`; only a
non-revoked document with a published Passport, published visibility and an
intact file can be `verified: true`.

## 7. Known environment limitation

An unrelated full-project frontend typecheck still reports pre-existing parse
errors in two non-Passport files. The changed Passport files produced no
TypeScript errors in the filtered check, and the production build was run with
`typescript.ignoreBuildErrors: true`; a clean full-project typecheck is not
claimed.
