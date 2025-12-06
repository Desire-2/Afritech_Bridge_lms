# quiz_progress_models.py
# CONSOLIDATED: Quiz and Question models have been moved to course_models.py
# This file now contains ONLY progress tracking and analytics models

from .user_models import db  # ✅ Import db from user_models
from datetime import datetime
import enum

# ============================================================================
# NOTE: As of 2025-11-03, the following tables have been consolidated:
# 
# REMOVED from this file (moved to course_models.py):
#   - Quiz model (was in 'quiz' table, now uses 'quizzes' table)
#   - Question model (was in 'question' table, now uses 'questions' table)
#   - QuestionOption model (was in 'question_option' table, now uses 'answers' table)
#
# REASON: Single source of truth prevents data inconsistency
# 
# ACTION REQUIRED: 
#   - Import Quiz and Question from course_models
#   - Drop old 'quiz', 'question', 'question_option' tables
#   - Verify quiz_attempts and user_answers reference new tables
# ============================================================================

# Import consolidated models
from .course_models import Quiz, Question

# Enum definitions for SQLAlchemy Enum type
class QuizFeedbackPolicy(enum.Enum):
    IMMEDIATE_FULL = "immediate_full"
    IMMEDIATE_SCORE_ONLY = "immediate_score_only"
    AFTER_DUE_DATE = "after_due_date"
    MANUAL_RELEASE = "manual_release"

class QuizPublishStatus(enum.Enum):
    DRAFT = "draft"
    PUBLISHED = "published"
    ARCHIVED = "archived"

class QuestionType(enum.Enum):
    MULTIPLE_CHOICE_SINGLE = "multiple_choice_single"
    MULTIPLE_CHOICE_MULTIPLE = "multiple_choice_multiple"
    TRUE_FALSE = "true_false"
    FILL_IN_BLANKS = "fill_in_blanks"
    SHORT_ANSWER = "short_answer"
    ORDERING = "ordering"
    MATCHING = "matching"

class QuizAttemptStatus(enum.Enum):
    IN_PROGRESS = "in_progress"
    SUBMITTED = "submitted"
    GRADED = "graded"
    AUTO_GRADED = "auto_graded"
    MANUAL_GRADING_PENDING = "manual_grading_pending"

class QuizAttempt(db.Model):
    __tablename__ = "quiz_attempts"  # ✅ Plural naming convention
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)  # ✅ Fixed: users (not user)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quizzes.id"), nullable=False)  # ✅ Fixed: quizzes (not quiz)
    attempt_number = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    score = db.Column(db.Float, nullable=True)
    score_percentage = db.Column(db.Float, nullable=True)  # ✅ Added for compatibility with progression_service
    status = db.Column(db.Enum(QuizAttemptStatus), nullable=False, default=QuizAttemptStatus.IN_PROGRESS)
    feedback_viewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships - Fixed to reference consolidated Quiz model
    quiz = db.relationship("Quiz", backref=db.backref("quiz_attempts", lazy="dynamic", cascade="all, delete-orphan"))
    user_answers = db.relationship("UserAnswer", backref="quiz_attempt", lazy=True, cascade="all, delete-orphan")

class UserAnswer(db.Model):
    __tablename__ = "user_answers"  # ✅ Plural naming convention
    id = db.Column(db.Integer, primary_key=True)
    quiz_attempt_id = db.Column(db.Integer, db.ForeignKey("quiz_attempts.id"), nullable=False)  # ✅ Fixed: quiz_attempts (not quiz_attempt)
    question_id = db.Column(db.Integer, db.ForeignKey("questions.id"), nullable=False)  # ✅ Fixed: questions (not question)
    answer_data = db.Column(db.JSON, nullable=True)
    is_correct = db.Column(db.Boolean, nullable=True)
    points_awarded = db.Column(db.Float, nullable=True)
    instructor_feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationships - Fixed to reference consolidated models
    question = db.relationship("Question", backref=db.backref("user_answers", lazy="dynamic"))

# NOTE: UserProgress, LessonCompletion, ModuleCompletion consolidated to student_models.py (Lines 45-79)
# These models are imported from there and defined only once as single source of truth

class LessonCompletion(db.Model):
    __tablename__ = "lesson_completion"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)  # ✅ Fixed: users (not user)
    lesson_id = db.Column(db.Integer, db.ForeignKey("lessons.id"), nullable=False)  # ✅ Fixed: lessons (not lesson)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_completion"),)

class ModuleCompletion(db.Model):
    __tablename__ = "module_completion"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)  # ✅ Fixed: users (not user)
    module_id = db.Column(db.Integer, db.ForeignKey("modules.id"), nullable=False)  # ✅ Fixed: modules (not module)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "module_id", name="uq_user_module_completion"),)

# NOTE: Badge and UserBadge consolidated to student_models.py (Lines 98-135)
# These models are imported from there and defined only once as single source of truth

class Certificate(db.Model):
    __tablename__ = "certificate"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)  # ✅ Fixed: users (not user)
    course_id = db.Column(db.Integer, db.ForeignKey("courses.id"), nullable=False)  # ✅ Fixed: courses (not course)
    issue_date = db.Column(db.DateTime, default=datetime.utcnow)
    certificate_uid = db.Column(db.String(255), nullable=False, unique=True)
    certificate_url = db.Column(db.String(255), nullable=True)
    template_used = db.Column(db.String(255), nullable=True)
    __table_args__ = (db.UniqueConstraint("user_id", "course_id", name="uq_user_course_certificate"),)

# Note: Assumes 'Lesson' and 'Module' models are defined in 'course_models.py' and have 'id' primary keys.
# If not, these ForeignKey constraints will need adjustment or those models need to be created/updated.
# QuestionBank model is noted as a future enhancement in the spec and not implemented here to keep initial scope manageable.

