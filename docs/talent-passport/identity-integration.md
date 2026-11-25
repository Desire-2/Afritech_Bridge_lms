# Identity integration

## Source of truth

Talent Passport does not introduce a second account system. The authenticated
LMS `User` row is the only student identity:

- private Passport routes derive `student_id` from `get_jwt_identity()`;
- a passport row has a unique foreign key to `users.id`;
- no login, password, registration, or profile-mirroring endpoint was added.

The existing `User` profile remains the source for identity fields that appear
in the UI. Passport-owned professional fields (headline, summary, career
interests, goals, links, preferred opportunities) are additions on the
`talent_passports` row and are edited only through Passport routes.

## Reserved external identifier

`talent_passports.afritech_user_id` is nullable and unique. It is a forward-compatible
slot for a future AfriTech Identity mapping; this implementation does **not**
populate it automatically and does **not** assume that an external identity
exists.

A future integration must:

1. obtain an explicit, audited link from the student or an authorized operator;
2. resolve the link to the existing LMS `User.id` before writing;
3. keep `users.id` as the passport owner, not the external identifier;
4. preserve the private-by-default publication rules in
   `visibility-and-privacy.md`.

## Roles

Passport route decorators reuse the LMS JWT roles (`student`, `instructor`,
`admin`). Instructor mapping controls are additionally scoped to courses the
instructor owns; admin controls are not course-scoped. There is no Passport-only
role table.

## Data minimization

Public Passport payloads are built from a whitelist. Identity/contact data is
not copied into the Passport evidence records. Email and phone appear in a
public payload only when the student has explicitly enabled the corresponding
visibility flags; internal IDs, verification hashes, grades, feedback and
unapproved AI results are omitted.
