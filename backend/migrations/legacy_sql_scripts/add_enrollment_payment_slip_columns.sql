-- Migration: Add payment_slip_url and payment_slip_filename to enrollments table
-- These columns were added to the SQLAlchemy model but never migrated to PostgreSQL.
-- Safe to run multiple times (IF NOT EXISTS).

ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_slip_url VARCHAR(500);
ALTER TABLE enrollments ADD COLUMN IF NOT EXISTS payment_slip_filename VARCHAR(255);
