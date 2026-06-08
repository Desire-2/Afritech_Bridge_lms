-- Migration: Add generic skill assessment columns to course_applications
-- This is an additive-only migration (no existing columns are altered or dropped).
-- These new columns allow Section 3 to work dynamically for any course type.

ALTER TABLE course_applications
    ADD COLUMN skill_profile_key VARCHAR(50) DEFAULT NULL,
    ADD COLUMN has_used_tool BOOLEAN DEFAULT NULL,
    ADD COLUMN tool_skill_level VARCHAR(100) DEFAULT NULL,
    ADD COLUMN tool_tasks_done TEXT DEFAULT NULL,
    ADD COLUMN skill_open_answer TEXT DEFAULT NULL;

-- Index for efficiently filtering by skill profile type
CREATE INDEX idx_course_applications_skill_profile_key ON course_applications(skill_profile_key);
