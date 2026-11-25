# Evidence rules

## States

Talent Passport uses four canonical skill states. They are derived only from
LMS-owned records and explicit review actions:

| State | Meaning | Minimum trigger |
|---|---|---|
| `LEARNING` | The student has a learning relationship with mapped content. | Enrollment in a course with a skill mapping. No grade or proficiency is implied. |
| `EVIDENCE_SUBMITTED` | Work exists, but authority/quality is not yet established. | Assignment, project or quiz attempt record linked to mapped content. |
| `DEMONSTRATED` | An authoritative assessment result meets the mapped criterion. | Approved grade/result at or above the mapped threshold, with accepted provenance. |
| `VERIFIED` | An authorized reviewer or issued credential confirms the skill. | Instructor/admin verification action, or a valid issued certificate. |

State precedence is monotonic within a sync: a later, stronger state can advance
a skill; a corrected source record recomputes the existing row rather than
creating a duplicate.

## Provenance accepted for `DEMONSTRATED`

### Classic assignment/project grading

`graded_by` alone is not sufficient. The Passport requires an instructor/admin/
staff grading signal, such as a `GradingHistory` row or a staff role, before a
classic numeric grade becomes `DEMONSTRATED` evidence.

### AAGE grading

An `EvaluationResult` is official only when:

- `is_official=True` or `status == "published"`; and
- any applicable `GradingReview.status == "approved"`.

Provisional or unapproved AAGE output may remain `EVIDENCE_SUBMITTED`, but it is
not promoted and is not exposed as verified.

### Excel AI grading

`ExcelGradingResult` becomes authoritative only when
`instructor_reviewed=True`. Before that it is provisional and cannot advance a
skill beyond `EVIDENCE_SUBMITTED`.

### Team projects

There is no per-member contribution model in the LMS. A team submission can
support `EVIDENCE_SUBMITTED` for each listed member, but cannot by itself prove
individual capability. It is capped there unless an instructor explicitly
verifies the individual contribution.

### Certificates

An active, issued canonical certificate (`student_models.Certificate`) can
support `VERIFIED`. The Passport consumes the certificate issued by the LMS; it
does not re-evaluate the 70% eligibility rule. `is_active=False` is treated as
revocation. Because no explicit revoke/deactivate route was found in the LMS,
hard deletes remain a manual-sync gap documented in `grading-integration.md`.

## Proficiency

`proficiency_level` and `proficiency_basis` are populated only when a mapping
defines criteria (rubric/criterion, threshold, or proficiency label). Enrollment
or submission alone never produces a proficiency claim.

## Idempotency

Evidence rows are keyed by:

- unique `(student_skill_id, source_type, source_id)`; and
- unique `event_key` shaped as
  `event_type|student_id|source_type|source_id|suffix`.

`course_id` is included in hook calls when available. The `suffix` must change
for a meaningful regrade or update; repeated hooks with the same suffix are
safe no-ops. Corrected grades, resubmissions, certificate changes and project
updates update the existing evidence row instead of inserting duplicates.

## Review actions

Admin/instructor review routes can explicitly verify or reject evidence. Self
verification by the student is not supported. Rejection does not fabricate a
higher state; it records the review outcome and leaves derived state to the
engine.
