# Troubleshooting

## Generation returns `validation_error`

Check backend logs for a `PDF validation failed` message. Causes include a
missing verified title/reference in the text layer, missing embedded font,
missing image, missing link annotation, wrong page size or fewer than two pages.
This indicates a renderer defect, not a client input problem; no invalid file is
stored.

## `A verification base URL is required`

Set `TALENT_PASSPORT_VERIFICATION_BASE_URL` in Flask config to the public API
origin, for example `https://study.afritechbridge.online`. If the value already
ends with `/api/v1`, it is used directly.

## `Official logo asset is missing`

Ensure `backend/static/images/logo.jpg` ships with the deployment. The renderer
intentionally fails closed rather than substituting a drawn or recolored mark.

## Missing fonts or unusual glyph boxes

Confirm all five TTF files exist in `backend/assets/fonts/` and that
`DEJAVU-LICENSE.txt` is retained. Fonts are registered by filename; changing a
filename requires updating `document/text.py`.

## Public document returns 404

The Passport must be published, have a visibility row with `is_published = true`,
and have a matching `public_slug`. Professional Share generation also requires
these conditions. `current_for_slug()` lazily generates a share snapshot when a
published Passport has none.

## Verification says `integrity_failed`

The database hash and stored bytes disagree. Confirm the configured storage
directory still contains `<document_ref>.pdf` and was restored from backup with
the database. Do not regenerate to “fix” an issued reference; generate a new
document and revoke the damaged one if necessary.

## Verification says `unpublished`

The document exists but the Passport or its visibility row is no longer
published. Republishing restores verification for an otherwise intact,
non-revoked document.

## Ownership 403 on preview or download

Private document routes compare `document.student_id` with the JWT identity.
Only admins/superadmins may access another learner's document. Use the public
current-document routes for legitimately shared Professional Share documents.

## React preview is blank

Preview uses an object URL in an iframe containing backend PDF bytes. Check that
the preview endpoint returned `application/pdf` with inline disposition and that
the browser allows inline PDF viewing. The frontend does not build or repair the
PDF locally.
