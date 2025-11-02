# Course Management Models for Afritec Bridge LMS

from datetime import datetime
# Assuming db is initialized in main.py or a central extensions file and imported here
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
            data['modules'] = [module.to_dict(include_lessons=True) for module in self.modules]
        if include_announcements:
            data['announcements'] = [ann.to_dict() for ann in self.announcements.order_by(Announcement.created_at.desc())]
        return data

class Module(db.Model):
    __tablename__ = 'modules'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    learning_objectives = db.Column(db.Text, nullable=True)  # What students should learn in this module
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    lessons = db.relationship('Lesson', backref='module', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Module {self.title}>'

    def to_dict(self, include_lessons=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'course_id': self.course_id,
            'order': self.order,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_lessons:
            data['lessons'] = [lesson.to_dict() for lesson in self.lessons.order_by(Lesson.order)]
        return data

class Lesson(db.Model):
    __tablename__ = 'lessons'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    content_type = db.Column(db.String(50), nullable=False)  # "text", "video", "pdf", "mixed"
    content_data = db.Column(db.Text, nullable=False) # Stores rich text, video URL, file paths, or JSON for mixed content
    description = db.Column(db.Text, nullable=True)  # Brief description of the lesson
    learning_objectives = db.Column(db.Text, nullable=True)  # What students should learn
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    order = db.Column(db.Integer, nullable=False, default=0) # For sequencing
    duration_minutes = db.Column(db.Integer, nullable=True)  # Estimated duration
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f'<Lesson {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'content_type': self.content_type,
            'content_data': self.content_data,
            'description': self.description,
            'learning_objectives': self.learning_objectives,
            'module_id': self.module_id,
            'order': self.order,
            'duration_minutes': self.duration_minutes,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
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
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    # Quiz settings fields
    time_limit = db.Column(db.Integer, nullable=True)  # Time limit in minutes
    max_attempts = db.Column(db.Integer, nullable=True)  # Maximum number of attempts
    passing_score = db.Column(db.Integer, default=70)  # Passing score percentage
    due_date = db.Column(db.DateTime, nullable=True)  # Due date for the quiz
    points_possible = db.Column(db.Float, default=100.0)  # Total points possible
    shuffle_questions = db.Column(db.Boolean, default=False)  # Shuffle questions for each student
    shuffle_answers = db.Column(db.Boolean, default=False)  # Shuffle answer choices
    show_correct_answers = db.Column(db.Boolean, default=True)  # Show correct answers after submission

    questions = db.relationship('Question', backref='quiz', lazy='dynamic', cascade="all, delete-orphan")
    # Relationships to Course, Module, Lesson if needed for direct linking
    course = db.relationship('Course', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
    module = db.relationship('Module', backref=db.backref('quizzes', lazy='dynamic', cascade="all, delete-orphan"))
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
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'time_limit': self.time_limit,
            'max_attempts': self.max_attempts,
            'passing_score': self.passing_score,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'points_possible': self.points_possible,
            'shuffle_questions': self.shuffle_questions,
            'shuffle_answers': self.shuffle_answers,
            'show_correct_answers': self.show_correct_answers
        }
        if include_questions:
            # Use .all() because questions relationship is lazy='dynamic'
            data['questions'] = [q.to_dict(include_answers=True) for q in self.questions.all()]
        return data

class Question(db.Model):
    __tablename__ = 'questions'
    id = db.Column(db.Integer, primary_key=True)
    quiz_id = db.Column(db.Integer, db.ForeignKey('quizzes.id'), nullable=False)
    text = db.Column(db.Text, nullable=False)
    question_type = db.Column(db.String(50), nullable=False) # e.g., "multiple_choice", "true_false", "short_answer"
    order = db.Column(db.Integer, nullable=False, default=0)
    points = db.Column(db.Float, default=10.0)
    explanation = db.Column(db.Text, nullable=True)

    answers = db.relationship('Answer', backref='question', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Question {self.text[:50]}>'

    def to_dict(self, include_answers=False, for_student=False):
        data = {
            'id': self.id,
            'quiz_id': self.quiz_id,
            'text': self.text,
            'question_text': self.text,
            'question_type': self.question_type,
            'order': self.order,
            'order_index': self.order,
            'points': self.points,
            'explanation': self.explanation
        }
        if include_answers:
            # Use .all() because answers relationship is lazy='dynamic'
            data['answers'] = [ans.to_dict(for_student=for_student) for ans in self.answers.all()]
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
            'text': self.text,
            'answer_text': self.text
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

class Assignment(db.Model):
    __tablename__ = 'assignments'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    instructions = db.Column(db.Text, nullable=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True)
    instructor_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assignment_type = db.Column(db.String(50), nullable=False, default='file_upload')  # 'file_upload', 'text_response', 'both'
    max_file_size_mb = db.Column(db.Integer, default=10)  # Maximum file size in MB
    allowed_file_types = db.Column(db.String(255), nullable=True)  # JSON string of allowed extensions
    due_date = db.Column(db.DateTime, nullable=True)
    points_possible = db.Column(db.Float, default=100.0)
    is_published = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    course = db.relationship('Course', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    module = db.relationship('Module', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    lesson = db.relationship('Lesson', backref=db.backref('assignments', lazy='dynamic', cascade="all, delete-orphan"))
    submissions = db.relationship('AssignmentSubmission', backref='assignment', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Assignment {self.title}>'

    def to_dict(self):
        return {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'instructions': self.instructions,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'lesson_id': self.lesson_id,
            'instructor_id': self.instructor_id,
            'assignment_type': self.assignment_type,
            'max_file_size_mb': self.max_file_size_mb,
            'allowed_file_types': self.allowed_file_types,
            'due_date': self.due_date.isoformat() if self.due_date else None,
            'points_possible': self.points_possible,
            'is_published': self.is_published,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

class AssignmentSubmission(db.Model):
    __tablename__ = 'assignment_submissions'
    id = db.Column(db.Integer, primary_key=True)
    assignment_id = db.Column(db.Integer, db.ForeignKey('assignments.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    text_content = db.Column(db.Text, nullable=True)  # For text responses
    file_path = db.Column(db.String(500), nullable=True)  # Path to uploaded file
    file_name = db.Column(db.String(255), nullable=True)  # Original filename
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('assignment_submissions', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by], backref=db.backref('graded_assignments', lazy='dynamic'))

    def __repr__(self):
        return f'<AssignmentSubmission {self.id} for Assignment {self.assignment_id}>'

    def to_dict(self):
        return {
            'id': self.id,
            'assignment_id': self.assignment_id,
            'student_id': self.student_id,
            'text_content': self.text_content,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'graded_by': self.graded_by,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'grader_name': f"{self.grader.first_name} {self.grader.last_name}" if self.grader else None
        }

class Project(db.Model):
    __tablename__ = 'projects'
    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=False)
    objectives = db.Column(db.Text, nullable=True)  # Learning objectives for the project
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    module_ids = db.Column(db.Text, nullable=False)  # JSON string of module IDs that the project covers
    due_date = db.Column(db.DateTime, nullable=False)
    points_possible = db.Column(db.Float, default=100.0)
    is_published = db.Column(db.Boolean, default=False)
    submission_format = db.Column(db.String(50), default='file_upload')  # 'file_upload', 'text_response', 'both', 'presentation'
    max_file_size_mb = db.Column(db.Integer, default=50)  # Larger for projects
    allowed_file_types = db.Column(db.String(255), nullable=True)  # JSON string of allowed extensions
    collaboration_allowed = db.Column(db.Boolean, default=False)
    max_team_size = db.Column(db.Integer, default=1)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships
    course = db.relationship('Course', backref=db.backref('projects', lazy='dynamic', cascade="all, delete-orphan"))
    submissions = db.relationship('ProjectSubmission', backref='project', lazy='dynamic', cascade="all, delete-orphan")

    def __repr__(self):
        return f'<Project {self.title}>'

    def get_modules(self):
        """Get the list of module IDs this project covers"""
        import json
        try:
            return json.loads(self.module_ids) if self.module_ids else []
        except:
            return []

    def set_modules(self, module_list):
        """Set the list of module IDs this project covers"""
        import json
        self.module_ids = json.dumps(module_list)

    def to_dict(self, include_modules=False):
        data = {
            'id': self.id,
            'title': self.title,
            'description': self.description,
            'objectives': self.objectives,
            'course_id': self.course_id,
            'module_ids': self.get_modules(),
            'due_date': self.due_date.isoformat(),
            'points_possible': self.points_possible,
            'is_published': self.is_published,
            'submission_format': self.submission_format,
            'max_file_size_mb': self.max_file_size_mb,
            'allowed_file_types': self.allowed_file_types,
            'collaboration_allowed': self.collaboration_allowed,
            'max_team_size': self.max_team_size,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }
        if include_modules:
            module_ids = self.get_modules()
            modules = Module.query.filter(Module.id.in_(module_ids)).all() if module_ids else []
            data['modules'] = [module.to_dict() for module in modules]
        return data

class ProjectSubmission(db.Model):
    __tablename__ = 'project_submissions'
    id = db.Column(db.Integer, primary_key=True)
    project_id = db.Column(db.Integer, db.ForeignKey('projects.id'), nullable=False)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    team_members = db.Column(db.Text, nullable=True)  # JSON string of team member IDs if collaboration allowed
    text_content = db.Column(db.Text, nullable=True)  # For text responses or project descriptions
    file_path = db.Column(db.String(500), nullable=True)  # Path to uploaded file
    file_name = db.Column(db.String(255), nullable=True)  # Original filename
    submitted_at = db.Column(db.DateTime, default=datetime.utcnow)
    grade = db.Column(db.Float, nullable=True)
    feedback = db.Column(db.Text, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('project_submissions', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by], backref=db.backref('graded_projects', lazy='dynamic'))

    def __repr__(self):
        return f'<ProjectSubmission {self.id} for Project {self.project_id}>'

    def get_team_members(self):
        """Get the list of team member IDs"""
        import json
        try:
            return json.loads(self.team_members) if self.team_members else []
        except:
            return []

    def set_team_members(self, member_list):
        """Set the list of team member IDs"""
        import json
        self.team_members = json.dumps(member_list)

    def to_dict(self):
        return {
            'id': self.id,
            'project_id': self.project_id,
            'student_id': self.student_id,
            'team_members': self.get_team_members(),
            'text_content': self.text_content,
            'file_path': self.file_path,
            'file_name': self.file_name,
            'submitted_at': self.submitted_at.isoformat(),
            'grade': self.grade,
            'feedback': self.feedback,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'graded_by': self.graded_by,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'grader_name': f"{self.grader.first_name} {self.grader.last_name}" if self.grader else None
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

