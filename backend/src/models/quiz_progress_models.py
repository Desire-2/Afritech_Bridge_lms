# quiz_progress_models.py

from .. import db
from datetime import datetime
import enum

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

class Quiz(db.Model):
    __tablename__ = "quiz"
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    time_limit_minutes = db.Column(db.Integer, nullable=True)
    attempts_allowed = db.Column(db.Integer, nullable=True)
    passing_score_percentage = db.Column(db.Float, nullable=True)
    feedback_policy = db.Column(db.Enum(QuizFeedbackPolicy), nullable=False, default=QuizFeedbackPolicy.IMMEDIATE_SCORE_ONLY)
    shuffle_questions = db.Column(db.Boolean, default=False)
    shuffle_options = db.Column(db.Boolean, default=False)
    publish_status = db.Column(db.Enum(QuizPublishStatus), default=QuizPublishStatus.DRAFT)
    due_date = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    questions = db.relationship("Question", backref="quiz", lazy=True, cascade="all, delete-orphan")
    attempts = db.relationship("QuizAttempt", backref="quiz", lazy=True, cascade="all, delete-orphan")

class Question(db.Model):
    __tablename__ = "question"
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quiz.id"), nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.Enum(QuestionType), nullable=False)
    points = db.Column(db.Integer, nullable=False, default=1)
    order_in_quiz = db.Column(db.Integer, nullable=False)
    image_url = db.Column(db.String(255), nullable=True)
    explanation_text = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    options = db.relationship("QuestionOption", backref="question", lazy=True, cascade="all, delete-orphan")
    user_answers = db.relationship("UserAnswer", backref="question", lazy=True)

class QuestionOption(db.Model):
    __tablename__ = "question_option"
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey("question.id"), nullable=False)
    option_text = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, nullable=True)
    order_value = db.Column(db.Integer, nullable=True)
    match_value = db.Column(db.Text, nullable=True)
    feedback_if_selected = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class QuizAttempt(db.Model):
    __tablename__ = "quiz_attempt"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    quiz_id = db.Column(db.Integer, db.ForeignKey("quiz.id"), nullable=False)
    attempt_number = db.Column(db.Integer, nullable=False)
    start_time = db.Column(db.DateTime, default=datetime.utcnow)
    end_time = db.Column(db.DateTime, nullable=True)
    score = db.Column(db.Float, nullable=True)
    status = db.Column(db.Enum(QuizAttemptStatus), nullable=False, default=QuizAttemptStatus.IN_PROGRESS)
    feedback_viewed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    user_answers = db.relationship("UserAnswer", backref="quiz_attempt", lazy=True, cascade="all, delete-orphan")

class UserAnswer(db.Model):
    __tablename__ = "user_answer"
    id = db.Column(db.Integer, primary_key=True)
    quiz_attempt_id = db.Column(db.Integer, db.ForeignKey("quiz_attempt.id"), nullable=False)
    question_id = db.Column(db.Integer, db.ForeignKey("question.id"), nullable=False)
    answer_data = db.Column(db.JSON, nullable=True)
    is_correct = db.Column(db.Boolean, nullable=True)
    points_awarded = db.Column(db.Float, nullable=True)
    instructor_feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserProgress(db.Model):
    __tablename__ = "user_progress"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    last_accessed_lesson_id = db.Column(db.Integer, db.ForeignKey("lesson.id"), nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "course_id", name="uq_user_course_progress"),)

class LessonCompletion(db.Model):
    __tablename__ = "lesson_completion"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey("lesson.id"), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson_completion"),)

class ModuleCompletion(db.Model):
    __tablename__ = "module_completion"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    module_id = db.Column(db.Integer, db.ForeignKey("module.id"), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    __table_args__ = (db.UniqueConstraint("user_id", "module_id", name="uq_user_module_completion"),)

class Badge(db.Model):
    __tablename__ = "badge"
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(255), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=False)
    criteria_description = db.Column(db.Text, nullable=False)
    icon_url = db.Column(db.String(255), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

class UserBadge(db.Model):
    __tablename__ = "user_badge"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey("badge.id"), nullable=False)
    awarded_at = db.Column(db.DateTime, default=datetime.utcnow)
    context_course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=True)
    __table_args__ = (db.UniqueConstraint("user_id", "badge_id", "context_course_id", name="uq_user_badge_context"),)

class Certificate(db.Model):
    __tablename__ = "certificate"
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("user.id"), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey("course.id"), nullable=False)
    issue_date = db.Column(db.DateTime, default=datetime.utcnow)
    certificate_uid = db.Column(db.String(255), nullable=False, unique=True)
    certificate_url = db.Column(db.String(255), nullable=True)
    template_used = db.Column(db.String(255), nullable=True)
    __table_args__ = (db.UniqueConstraint("user_id", "course_id", name="uq_user_course_certificate"),)

# Note: Assumes 'Lesson' and 'Module' models are defined in 'course_models.py' and have 'id' primary keys.
# If not, these ForeignKey constraints will need adjustment or those models need to be created/updated.
# QuestionBank model is noted as a future enhancement in the spec and not implemented here to keep initial scope manageable.

