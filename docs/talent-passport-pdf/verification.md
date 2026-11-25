# Public Verification

## 1. Public reference

Each issued PDF carries an opaque reference of the form
`TP-<random URL-safe token>` and a QR code pointing to an absolute verification
URL. Internal database ids, slugs, hashes and student ids are never used as the
public verification key.

The verification base URL comes from Flask config
`TALENT_PASSPORT_VERIFICATION_BASE_URL`. If it already ends with `/api/v1`, the
route is appended directly; otherwise `/api/v1` is inserted. Missing base URL
fails generation with `ValueError`.

## 2. Endpoint

`GET /api/v1/talent/verify/<document_ref>` is public and rate-limited. It
returns a whitelisted object:

```json
{
  "document_ref": "TP-...",
  "verified": true,
  "state": "issued",
  "edition": "professional_share",
  "template_version": "1.0.0",
  "generated_at": "...",
  "verification_url": "https://.../api/v1/talent/verify/TP-..."
}
```

Public verification never returns content hashes, file hashes, internal ids or
private profile data.

## 3. State rules

`service.verify()` evaluates in this order:

1. Unknown reference → `not_found`, `verified: false`.
2. Document status `revoked` → `revoked`, `verified: false`.
3. Passport missing or `is_published` false → `unpublished`, `verified: false`.
4. Visibility row missing or `is_published` false → `unpublished`, `verified: false`.
5. Stored bytes missing or SHA-256 mismatch → `integrity_failed`, `verified: false`.
6. Otherwise → `issued`; `verified` is true for `current` or `superseded` status.

Revocation and integrity failures therefore fail closed. Superseded documents
remain verifiable while the Passport is still published and the file is intact.

## 4. QR and hyperlink behavior

The cover and final verification section both render the same reference. The QR
is generated with high error correction from the trusted absolute URL. The printed
`Open verification` text is a real PDF `linkURL` annotation, not just decorative
text. Automated validation checks for at least one working `/URI` annotation and
one embedded image.

## 5. Frontend boundary

The frontend service exposes `getVerification(documentRef)` using the public
client, which does not attach a JWT. No frontend code computes or validates
hashes; verification is a backend decision.
