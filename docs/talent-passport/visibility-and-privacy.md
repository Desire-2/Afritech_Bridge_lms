# Visibility and privacy

## Default posture

Every Passport is private by default:

- `is_published` defaults to false;
- all section toggles default to false;
- `show_email` and `show_phone` default to false;
- no public slug is usable until explicit publication.

The legacy loose `User.profile_visibility` setting is not inherited.

## Publication

Publishing is an explicit student action and requires at least one visible
section. The backend records:

- `is_published = true`;
- `published_at`;
- an audit event;
- a non-predictable `public_slug` generated with `secrets.token_urlsafe(18)`.

Unpublishing revokes the link and rotates the slug. A retired link is reported
as unavailable (HTTP 410 in the public API); it cannot be revived by setting the
same visibility flags again.

## Section toggles

The visibility row controls independent sections:

- `professional_profile`
- `skills`
- `projects`
- `certificates`
- `learning_history`
- `achievements`

Even when `professional_profile` is enabled, only whitelisted professional
fields are serialized. Direct identity fields are not part of that section.
Email and phone require their own explicit flags.

## Public payload filtering

The public serializer is whitelist-only:

- disabled sections are omitted/empty and are not rendered by the public page;
- email and phone appear only when the corresponding flag is true;
- numeric grades, instructor feedback, verification hashes, internal evidence
  IDs and unverified AI results are never included;
- unknown fields are dropped by both backend serialization and the frontend's
  `serializePublicPassport` safety function.

The frontend does not promote states or invent values; it renders only backend
values.

## Authorization

- Private routes require a student JWT and ownership of the passport.
- Public routes require no JWT and accept only a valid published slug.
- Admin controls require admin role.
- Instructor mapping/verification controls are scoped to owned courses.
- Students cannot verify their own evidence.

## Audit and revocation

Publish, unpublish, visibility changes, verification/rejection and revoke-type
actions are written to `talent_passport_audit_events`. Audit events are part of
the private/admin projection only.
