# Course Management Models for Afritec Bridge LMS

from datetime import datetime
# Assuming db is initialized in main.py or a central extensions file and imported here
# from src.extensions import db # Example if you have an extensions.py
from .user_models import db, User # Assuming user_models.py is in the same directory and has db

class Course(db.Model):
    __tablename__ = 'courses'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    learning_objectives = db.Column(db.Text, nullable=True)
    target_audience = db.Column(db.String(255), nullable=True)
    estimated_duration = db.Column(db.String(100), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_published = db.Column(db.Boolean, default=False, nullable=False)

    instructor = db.relationship('User', backref=db.backref('courses_authored', lazy='dynamic'))
    modules = db.relationship('Module', backref='course', lazy='dynamic', cascade="all, delete-orphan")
    enrollments = db.relationship('Enrollment', backref='course', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Course {self.title}>'

    def to_dict(self, include_modules=False, include_announcements=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'target_audience': self.target_audience,
            'estimated_duration': self.estimated_duration,
            'instructor_id': self.instructor_id,
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'is_published': self.is_published
        }
        if include_modules:
            data['modules'] = [module.to_dict() for module in self.modules]
        if include_announcements:
            data['announcements'] = [ann.to_dict() for ann in self.announcements.order_by(Announcement.created_at.desc())]
        return data

class Module(db.Model):
    __tablename__ = 'modules'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing

    lessons = db.relationship('Lesson', backref='module', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Module {self.title}>'

    def to_dict(self, include_lessons=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'course_id': self.course_id,
            'order': self.order
        }
        if include_lessons:
            data['lessons'] = [lesson.to_dict() for lesson in self.lessons.order_by(Lesson.order)]
        return data

class Lesson(db.Model):
    __tablename__ = 'lessons'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)  # e.g., "text", "video", "quiz_link", "code_exercise"
    content_data = db.Column(db.Text, nullable=False) # Stores rich text, video URL, quiz_id, exercise details
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing

    # If content_type is 'quiz_link', content_data could store the quiz_id
    # quiz = db.relationship('Quiz', backref='lesson', uselist=False) # If a lesson has one quiz

    def __repr__(self):
        return f'<Lesson {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content_type': self.content_type,
            'content_data': self.content_data,
            'module_id': self.module_id,
            'order': self.order
        }

class Enrollment(db.Model):
    __tablename__ = 'enrollments'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_date = db.Column(db.DateTime, default=datetime.utcnow)
    progress = db.Column(db.Float, default=0.0) # Percentage completion, 0.0 to 1.0
    completed_at = db.Column(db.DateTime, nullable=True)

    student = db.relationship('User', backref=db.backref('enrollments', lazy='dynamic'))
    # Course relationship is already defined in Course model via backref

    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_uc'),)

    def __repr__(self):
        return f'<Enrollment User {self.student_id} in Course {self.course_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_date': self.enrollment_date.isoformat(),
            'progress': self.progress,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'student_username': self.student.username if self.student else None,
            'course_title': self.course.title if self.course else None
        }

class Quiz(db.Model):
    __tablename__ = 'quizzes'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True) # Quiz can be linked to a lesson
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    questions = db.relationship('Question', backref='quiz', lazy='dynamic', cascade="all, delete-orphan")
    # Relationships to Course, Module, Lesson if needed for direct linking
    course = db.relationship('Course', backref=db.backref('quizzes', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('quizzes', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('quiz', uselist=False, cascade="all, delete-orphan")) # A lesson might have one quiz directly

    def __repr__(self):
        return f'<Quiz {self.title}>'

    def to_dict(self, include_questions=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'created_at': self.created_at.isoformat()
        }
        if include_questions:
            data['questions'] = [q.to_dict(include_answers=True) for q in self.questions]
        return data

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), nullable=False) # e.g., "multiple_choice", "true_false", "short_answer"
    order = db.Column(db.Integer, nullable=False, default=0)

    answers = db.relationship('Answer', backref='question', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Question {self.text[:50]}>'

    def to_dict(self, include_answers=False, for_student=False):
        data = {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'text': self.text,
            'question_type': self.question_type,
            'order': self.order
        }
        if include_answers:
            data['answers'] = [ans.to_dict(for_student=for_student) for ans in self.answers]
        return data

class Answer(db.Model):
    __tablename__ = 'answers'
    id = db.Column(db.Integer, primary_key=True)
    question_id = db.Column(db.Integer, db.ForeignKey('questions.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    is_correct = db.Column(db.Boolean, default=False, nullable=False)

    def __repr__(self):
        return f'<Answer {self.text[:50]}>'

    def to_dict(self, for_student=False):
        data = {
            'id': self.id,
            'question_id': self.question_id,
            'text': self.text
        }
        if not for_student:
            data['is_correct'] = self.is_correct
        return data

class Submission(db.Model):
    __tablename__ = 'submissions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    # Link to what is being submitted, e.g., quiz or a general assignment (lesson)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True) # For general assignment submissions
    submission_content = db.Column(db.Text, nullable=True) # e.g., JSON of answers for quiz, link to project for assignment
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)

    student = db.relationship('User', backref=db.backref('submissions', lazy='dynamic'))
    quiz = db.relationship('Quiz', backref=db.backref('submissions', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('submissions', lazy='dynamic'))

    def __repr__(self):
        return f'<Submission {self.id} by User {self.student_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'quiz_id': self.quiz_id,
            'lesson_id': self.lesson_id,
            'submission_content': self.submission_content,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'student_username': self.student.username if self.student else None,
            'quiz_title': self.quiz.title if self.quiz else None,
            'lesson_title': self.lesson.title if self.lesson else None
        }

class Announcement(db.Model):
    __tablename__ = 'announcements'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    course = db.relationship('Course', backref=db.backref('announcements', lazy='dynamic', cascade="all, delete-orphan"))
    instructor = db.relationship('User', backref=db.backref('announcements', lazy='dynamic'))

    def __repr__(self):
        return f'<Announcement {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'course_id': self.course_id,
            'instructor_id': self.instructor_id,
            'title': self.title,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'instructor_name': f"{self.instructor.first_name} {self.instructor.last_name}" if self.instructor else None
        }

