# Certificate integration

## Canonical source

Talent Passport reads the canonical certificate table:

- model: `src/models/student_models.py::Certificate`
- table: `certificates`
- unique `(student_id, course_id)` constraint added by migration `a9c3e1f7b2d4`

The legacy `quiz_progress_models.Certificate` / `certificate` table is not used
by the Passport.

## Eligibility is not reimplemented

Certificate eligibility remains with the LMS:

- `CourseProgressService.evaluate()` is the single source of truth for content
  completion, required module final assessments, and the configured 70%
  `CERTIFICATE_PASSING_SCORE`;
- `CertificateService.evaluate_eligibility()` delegates to that service;
- the Passport consumes certificates that were actually issued.

No Passport-specific pass mark, completion rule, or certificate generator was
added.

## Evidence and portfolio behavior

When a canonical certificate is issued or updated, the Passport syncs the
existing record into:

- certificate evidence for the mapped course skills, supporting `VERIFIED`;
- the certificate list in the private and public (when enabled) projections;
- the learning timeline;
- portfolio/project references where a course project is the mapped source.

Certificates are never fabricated from completion progress. A student who has
met eligibility but has no issued certificate does not receive a Passport
certificate entry.

## Verification metadata

Public output omits certificate verification hashes and internal evidence IDs.
The LMS's existing verification logic remains authoritative; the Passport does
not create a second verification scheme.

## Revocation

- `is_active=False` on the canonical certificate is understood as revocation and
  removes/downgrades the corresponding Passport evidence on sync.
- No explicit certificate revoke/deactivate route was found in the audited LMS
  write paths. Existing hard deletes do not notify the Passport.
- Until such a route exists, operators should run a targeted `sync_student` (or
  full backfill) after certificate deletion. This gap is intentional and is
  listed in the final report rather than being masked by a second certificate
  authority.
