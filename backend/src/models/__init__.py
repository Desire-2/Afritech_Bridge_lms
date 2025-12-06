# ============================================================================
# Models Package
# 
# This package exports all SQLAlchemy models used in the application.
# As of 2025-11-03: Quiz and Question models have been consolidated
# to avoid duplication and data inconsistency issues.
# ============================================================================

# Course Management Models (Course Models) - PRIMARY
from .course_models import (
    Course,
    Module,
    Lesson,
    Enrollment,
    Quiz,           # ✅ CONSOLIDATED - Single source of truth
    Question,       # ✅ CONSOLIDATED - Single source of truth
    Answer,         # ✅ Replaces old QuestionOption
    Submission,
    Assignment,
    AssignmentSubmission,
    Project,
    ProjectSubmission,
    Announcement
)

# Progress & Analytics Models (Quiz Progress Models)
# NOTE: These ONLY import Quiz and Question from course_models (not locally)
from .quiz_progress_models import (
    QuizAttempt,    # ✅ References consolidated Quiz model
    UserAnswer,     # ✅ References consolidated Question model
    LessonCompletion,  # ✅ Kept here for backward compatibility
    ModuleCompletion,  # ✅ Kept here for backward compatibility
    Certificate,
    # Enums
    QuizFeedbackPolicy,
    QuizPublishStatus,
    QuestionType,
    QuizAttemptStatus
)

# User Models
from .user_models import (
    db,
    User,
    Role
)

# Student Models - Contains UserProgress and other student tracking models
try:
    from .student_models import UserProgress, Badge, UserBadge
except ImportError:
    UserProgress = None  # Optional
    Badge = None
    UserBadge = None

# Opportunity Models
try:
    from .opportunity_models import (
        Opportunity,
        OpportunityApplication
    )
except ImportError:
    pass  # Opportunity models optional

# Achievement Models
try:
    from .achievement_models import Achievement
except ImportError:
    pass  # Achievement models optional

__all__ = [
    # Course Models
    'Course',
    'Module',
    'Lesson',
    'Enrollment',
    'Quiz',
    'Question',
    'Answer',
    'Submission',
    'Assignment',
    'AssignmentSubmission',
    'Project',
    'ProjectSubmission',
    'Announcement',
    
    # Progress Models
    'QuizAttempt',
    'UserAnswer',
    'UserProgress',
    'LessonCompletion',
    'ModuleCompletion',
    'Badge',
    'UserBadge',
    'Certificate',
    
    # Enums
    'QuizFeedbackPolicy',
    'QuizPublishStatus',
    'QuestionType',
    'QuizAttemptStatus',
    
    # User Models
    'db',
    'User',
    'Role'
]

print("✅ Models package loaded - Quiz consolidation complete")
print("   Quiz model: course_models.Quiz")
print("   Question model: course_models.Question")
print("   Answer model: course_models.Answer")
print("   QuizAttempt model: quiz_progress_models.QuizAttempt (references course_models.Quiz)")
