# Data model

## Ownership

| Data | Owner | Passport behavior |
|---|---|---|
| User identity/profile | LMS `users` | Read; add Passport-only professional fields separately. |
| Enrollment, progress | LMS services | Read through canonical services; no second calculator. |
| Submissions, grades | LMS grading models | Reference by source key; derive evidence state. |
| Certificates | `student_models.Certificate` | Consume issued/active records; no re-eligibility logic. |
| Achievements/badges | existing achievement services/models | Mirror explicit records and Passport-only rules. |
| Taxonomy, mappings, curation, visibility, audit | Talent Passport | Owned by this module. |

## Tables created by `f7a2b9c3d4e5`

| Table | Purpose |
|---|---|
| `talent_passports` | One row per student; professional profile, career interests, publication state, slug, completeness. |
| `talent_skill_categories` | Skill categories with localized names and ordering. |
| `talent_skill_definitions` | Stable skill keys, category, source profile key, localized names. |
| `talent_course_skill_mappings` | Course/source → skill mapping with criteria, threshold and verification requirement. |
| `talent_student_skills` | Derived per-student skill state and proficiency basis. |
| `talent_skill_evidence` | Idempotent evidence rows referencing LMS records; review metadata and event key. |
| `talent_portfolio_items` | Curated project/portfolio items with featured flag and display order. |
| `talent_passport_visibility` | Publication flag, section toggles, email/phone disclosure flags. |
| `talent_passport_achievements` | Explicit Passport achievement records over LMS facts. |
| `talent_passport_audit_events` | Publish/unpublish/revoke/verification and other Passport actions. |
| `talent_processed_events` | Deduplication ledger for hook events. |

## Important constraints

- `talent_passports.student_id` is unique and references `users.id`.
- `talent_passports.public_slug` is unique. Unpublishing rotates it.
- `talent_student_skills` is unique by `(passport_id, skill_definition_id)`.
- `talent_skill_evidence` is unique by
  `(student_skill_id, source_type, source_id)` and by `event_key`.
- `talent_portfolio_items` is unique by
  `(passport_id, source_type, source_id)`.
- `talent_passport_visibility.passport_id` is unique.

## Cascade behavior

Passport child rows cascade from their Passport or parent evidence/skill where
appropriate. Course skill mappings cascade when their course is deleted. This
prevents orphaned non-nullable foreign keys during ORM deletes.

## Migration safety

The migration is additive and guarded. It creates only the tables above, and
its downgrade drops only those tables. Repeated upgrade after a partial failure
or a `create_all` bootstrap is safe.
