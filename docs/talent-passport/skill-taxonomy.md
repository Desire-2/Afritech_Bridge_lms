# Skill taxonomy and mappings

## Taxonomy source

The Passport taxonomy is seeded from the existing LMS configuration in
`backend/src/config/course_skill_profiles.py`. That file is used as a taxonomy
and mapping **seed source only**; the LMS remains the source of truth for
learning facts.

Taxonomy tables:

- `talent_skill_categories` — category key, localized names, sort order, active flag;
- `talent_skill_definitions` — stable skill key, category, localized names,
  description, `source_profile_key`, sort order, active flag.

`source_profile_key` links a Passport skill definition back to the existing
course skill profile key. Skills are not invented from free-text `User.skills`
values; self-described profile text is kept separate from evidence-backed
skills.

## Mappings

`talent_course_skill_mappings` connects a course to a skill definition and a
source record:

- `course_id` — the LMS course;
- `skill_definition_id` — the taxonomy skill;
- `source_type` / `source_id` — course outcome, assignment, project, quiz or
  grading source;
- `competency_criteria`, `min_score`, `proficiency_label` — what must be shown;
- `required_verification` — whether explicit review is required;
- `created_by` — the actor who created the mapping.

A unique constraint prevents duplicate mappings for the same
course/skill/source tuple.

## Who can manage mappings

- Admins can create, update and delete mappings for any course.
- Instructors can manage mappings only for courses they own; the route layer
  enforces this with `_require_mapping_actor()` and `_ensure_course_access()`.
- Students have no mapping-management permission.

## Backfill and automatic update

Mappings are read by the evidence engine when a hook or `sync_student` runs.
Existing LMS records are backfilled through the same engine, so historical data
uses the same rules as live events. Changing a mapping affects derived state on
the next targeted/full sync; it does not rewrite historical LMS grades.
