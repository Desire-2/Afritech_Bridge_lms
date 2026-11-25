# AfriTech Work integration boundary

## Current state

Talent Passport is an LMS module. In this implementation it does **not** create
AfriTech Work accounts, push records to a jobs service, or consume employer
data. No external account linkage is inferred from email, username, or the
reserved `afritech_user_id` column.

## Supported future integration paths

The module is designed so a future integration can use one of two explicit paths:

1. **Student-initiated sharing.** The student publishes a Passport and shares
   the rotated public slug/URL. The public API returns only the backend-filtered
   sections the student enabled.
2. **Authorized API consumption.** A future AfriTech Work service can call a
   student-authorized API using the existing LMS identity/JWT model. The
   Passport data model already separates LMS-owned evidence from Passport-owned
   curation, so an integration does not need to write learning facts back into
   the LMS.

Neither path grants automatic access to the full private Passport. Publishing
is explicit, section-scoped, and revocable; unpublishing rotates the public
slug so previously shared links stop resolving.

## What must not be exported

Even in a future integration, the following remain private unless a separate,
explicit and tested contract is introduced:

- email, phone, government ID or other direct identifiers;
- numeric grades and instructor feedback attached to evidence;
- verification hashes and internal evidence IDs;
- unapproved AI grading results;
- unpublished sections.

## Data ownership

The LMS remains the source of truth for courses, submissions, grades,
certificates and achievements. Talent Passport stores references, derived skill
state, curation and publication metadata. AfriTech Work should consume the
Passport projection rather than become another writer of LMS facts.
