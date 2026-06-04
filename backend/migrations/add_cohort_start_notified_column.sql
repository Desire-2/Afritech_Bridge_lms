-- Add cohort_start_notified flag to prevent duplicate cohort-start emails
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS cohort_start_notified BOOLEAN NOT NULL DEFAULT 0;
