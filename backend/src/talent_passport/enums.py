"""Stable vocabulary for the Talent Passport domain.

Values are stored as plain strings so the schema works on both SQLite and
PostgreSQL without native enum migrations. Never rename a persisted value
without an explicit migration/compatibility mapping.
"""

# Skill status — ordered from weakest to strongest evidence.
SKILL_LEARNING = "LEARNING"
SKILL_EVIDENCE_SUBMITTED = "EVIDENCE_SUBMITTED"
SKILL_DEMONSTRATED = "DEMONSTRATED"
SKILL_VERIFIED = "VERIFIED"

SKILL_STATUSES = (
    SKILL_LEARNING,
    SKILL_EVIDENCE_SUBMITTED,
    SKILL_DEMONSTRATED,
    SKILL_VERIFIED,
)

SKILL_STATUS_RANK = {status: index for index, status in enumerate(SKILL_STATUSES)}

# What an evidence row is derived from. Always references an LMS record.
SOURCE_COURSE = "course"
SOURCE_MODULE = "module"
SOURCE_LESSON = "lesson"
SOURCE_ASSESSMENT = "assessment"
SOURCE_QUIZ_ATTEMPT = "quiz_attempt"
SOURCE_ASSIGNMENT_SUBMISSION = "assignment_submission"
SOURCE_PROJECT_SUBMISSION = "project_submission"
SOURCE_CERTIFICATE = "certificate"
SOURCE_ACHIEVEMENT = "achievement"

EVIDENCE_SOURCES = (
    SOURCE_COURSE,
    SOURCE_MODULE,
    SOURCE_LESSON,
    SOURCE_ASSESSMENT,
    SOURCE_QUIZ_ATTEMPT,
    SOURCE_ASSIGNMENT_SUBMISSION,
    SOURCE_PROJECT_SUBMISSION,
    SOURCE_CERTIFICATE,
    SOURCE_ACHIEVEMENT,
)

# Grading state as reported by the source LMS system.
GRADE_PROVISIONAL = "provisional"          # AI-generated, not instructor reviewed
GRADE_AWAITING_REVIEW = "awaiting_review"  # submitted and waiting for review
GRADE_APPROVED = "approved"                # instructor approved
GRADE_UPDATED = "updated"                  # instructor changed an existing grade
GRADE_VERIFIED = "verified"                # final, verified process (e.g. issued credential)

GRADING_STATES = (
    GRADE_PROVISIONAL,
    GRADE_AWAITING_REVIEW,
    GRADE_APPROVED,
    GRADE_UPDATED,
    GRADE_VERIFIED,
)

# Verification of an individual evidence row (independent of the skill status).
EVIDENCE_PENDING = "PENDING"
EVIDENCE_APPROVED = "APPROVED"
EVIDENCE_VERIFIED = "VERIFIED"
EVIDENCE_REJECTED = "REJECTED"

EVIDENCE_VERIFICATION_STATES = (
    EVIDENCE_PENDING,
    EVIDENCE_APPROVED,
    EVIDENCE_VERIFIED,
    EVIDENCE_REJECTED,
)

# Mapping source types used when an administrator links a skill to content.
MAPPING_COURSE_OUTCOME = "course_outcome"
MAPPING_MODULE = "module"
MAPPING_ASSESSMENT = "assessment"
MAPPING_PROJECT = "project"
MAPPING_ASSIGNMENT = "assignment"

MAPPING_SOURCE_TYPES = (
    MAPPING_COURSE_OUTCOME,
    MAPPING_MODULE,
    MAPPING_ASSESSMENT,
    MAPPING_PROJECT,
    MAPPING_ASSIGNMENT,
)

# Portfolio item sources. ``manual`` items are student-provided and never verified.
PORTFOLIO_PROJECT = "project_submission"
PORTFOLIO_ASSIGNMENT = "assignment_submission"
PORTFOLIO_MANUAL = "manual"

PORTFOLIO_SOURCES = (PORTFOLIO_PROJECT, PORTFOLIO_ASSIGNMENT, PORTFOLIO_MANUAL)

# Visibility sections. The whole-passport switch is always checked first.
VISIBILITY_KEYS = (
    "professional_profile",
    "skills",
    "projects",
    "certificates",
    "learning_history",
    "achievements",
)

# Backend-owned PDF document editions. Values are persisted as plain strings.
DOCUMENT_PROFESSIONAL_SHARE = "professional_share"
DOCUMENT_PERSONAL_RECORD = "personal_record"
DOCUMENT_EDITIONS = (DOCUMENT_PROFESSIONAL_SHARE, DOCUMENT_PERSONAL_RECORD)

DOCUMENT_CURRENT = "current"
DOCUMENT_SUPERSEDED = "superseded"
DOCUMENT_REVOKED = "revoked"
DOCUMENT_STATUSES = (DOCUMENT_CURRENT, DOCUMENT_SUPERSEDED, DOCUMENT_REVOKED)

DOCUMENT_AUDIT_GENERATED = "document.generated"
DOCUMENT_AUDIT_SUPERSEDED = "document.superseded"
DOCUMENT_AUDIT_REVOKED = "document.revoked"
