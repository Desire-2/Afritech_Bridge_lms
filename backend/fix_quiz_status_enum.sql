-- Fix PostgreSQL enum for quiz_attempts status
-- Add missing enum values to quizattemptstatus

-- Add SUBMITTED enum value
DO $$
BEGIN
    BEGIN
        ALTER TYPE quizattemptstatus ADD VALUE 'SUBMITTED';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- Add GRADED enum value
DO $$
BEGIN
    BEGIN
        ALTER TYPE quizattemptstatus ADD VALUE 'GRADED';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- Add MANUAL_GRADING_PENDING enum value
DO $$
BEGIN
    BEGIN
        ALTER TYPE quizattemptstatus ADD VALUE 'MANUAL_GRADING_PENDING';
    EXCEPTION
        WHEN duplicate_object THEN null;
    END;
END $$;

-- List all enum values after update
SELECT enumlabel as available_status_values 
FROM pg_enum 
WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'quizattemptstatus')
ORDER BY enumlabel;