# Enhanced Student Progress and Learning Models for Afritec Bridge LMS

from datetime import datetime
import json
from .user_models import db, User
from .course_models import Course, Module, Lesson, Quiz, Enrollment

class LessonCompletion(db.Model):
    """Track completion status of individual lessons by students"""
    __tablename__ = 'lesson_completions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    completed_at = db.Column(db.DateTime, default=datetime.utcnow)
    time_spent = db.Column(db.Integer, default=0)  # in seconds
    
    # Enhanced progress tracking fields
    completed = db.Column(db.Boolean, default=False)
    reading_progress = db.Column(db.Float, default=0.0)  # 0-100 percentage
    engagement_score = db.Column(db.Float, default=0.0)  # 0-100 engagement score
    scroll_progress = db.Column(db.Float, default=0.0)  # 0-100 scroll percentage
    video_progress = db.Column(db.Float, default=0.0)  # 0-100 video watch percentage
    
    # Stored component scores for lessons with assessments
    reading_component_score = db.Column(db.Float, default=0.0)  # Calculated reading score (0-100)
    engagement_component_score = db.Column(db.Float, default=0.0)  # Calculated engagement score (0-100)
    quiz_component_score = db.Column(db.Float, default=0.0)  # Quiz score contribution (0-100)
    assignment_component_score = db.Column(db.Float, default=0.0)  # Assignment score contribution (0-100)
    lesson_score = db.Column(db.Float, default=0.0)  # Comprehensive lesson score (0-100)
    score_last_updated = db.Column(db.DateTime)  # When lesson score was last calculated
    
    # Enhanced video tracking fields
    video_current_time = db.Column(db.Float, default=0.0)  # Current timestamp in seconds
    video_duration = db.Column(db.Float, default=0.0)  # Total video duration in seconds
    video_completed = db.Column(db.Boolean, default=False)  # 90%+ threshold reached
    video_watch_count = db.Column(db.Integer, default=0)  # Number of times video was watched
    video_last_watched = db.Column(db.DateTime)  # Last video watch timestamp
    playback_speed = db.Column(db.Float, default=1.0)  # Preferred playback speed
    
    # Mixed content video tracking (JSON: {videoIndex: {progress, currentTime, completed}})
    mixed_video_progress = db.Column(db.Text)  # JSON string for tracking multiple videos
    
    # Assignment submission and grading fields
    assignment_submitted = db.Column(db.Boolean, default=False)
    assignment_submission = db.Column(db.Text)  # Student's assignment submission text
    assignment_file_url = db.Column(db.String(500))  # URL to uploaded assignment file
    assignment_submitted_at = db.Column(db.DateTime)  # When assignment was submitted
    assignment_graded = db.Column(db.Boolean, default=False)  # Whether assignment is graded
    assignment_grade = db.Column(db.Float)  # Assignment grade (0-100)
    assignment_feedback = db.Column(db.Text)  # Instructor feedback on assignment
    assignment_graded_at = db.Column(db.DateTime)  # When assignment was graded
    assignment_needs_resubmission = db.Column(db.Boolean, default=False)  # Modification requested
    modification_request_reason = db.Column(db.Text)  # Reason for modification request
    is_resubmission = db.Column(db.Boolean, default=False)  # Is this a resubmission?
    resubmission_reason = db.Column(db.Text)  # Reason for resubmission
    
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('lesson_completions', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('completions', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'lesson_id', name='_student_lesson_completion_uc'),)
    
    def has_quiz(self):
        """Check if this lesson has an associated quiz"""
        from ..models.course_models import Quiz
        return Quiz.query.filter_by(lesson_id=self.lesson_id).first() is not None
    
    def has_assignment(self):
        """Check if this lesson has an associated assignment"""
        from ..models.course_models import Assignment
        return Assignment.query.filter_by(lesson_id=self.lesson_id).first() is not None
    
    def calculate_lesson_score(self):
        """
        Calculate comprehensive lesson score with dynamic weights based on available assessments.
        Enhanced to enforce completion requirements and passing scores.
        
        Dynamic Scoring System:
        - If lesson has BOTH quiz AND assignment: Reading 25%, Engagement 25%, Quiz 25%, Assignment 25%
        - If lesson has ONLY quiz: Reading 35%, Engagement 35%, Quiz 30%, Assignment 0%
        - If lesson has ONLY assignment: Reading 35%, Engagement 35%, Quiz 0%, Assignment 30%
        - If lesson has NO assessments: Reading 50%, Engagement 50%
        
        Enhanced Requirements:
        - Quiz must be passed (70%+ by default) to contribute to score
        - Assignment must be graded and passed (70%+) to contribute to score
        - Reading progress below 90% significantly reduces overall score
        - Engagement below 60% reduces overall score
        
        Returns a score from 0-100
        """
        reading = self.reading_progress or 0.0
        engagement = self.engagement_score or 0.0
        
        # Check what assessments exist for this lesson
        from ..models.quiz_progress_models import QuizAttempt
        from ..models.course_models import Quiz, Assignment, AssignmentSubmission
        
        lesson_quiz = Quiz.query.filter_by(lesson_id=self.lesson_id, is_published=True).first()
        lesson_assignment = Assignment.query.filter_by(lesson_id=self.lesson_id).first()
        
        has_quiz = lesson_quiz is not None
        has_assignment = lesson_assignment is not None
        
        # Get quiz score if quiz exists (with passing requirement)
        quiz_score = 0.0
        quiz_passed = True  # Default for lessons without quiz
        if has_quiz:
            best_attempt = QuizAttempt.query.filter_by(
                user_id=self.student_id,
                quiz_id=lesson_quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            if best_attempt:
                raw_quiz_score = best_attempt.score_percentage or 0.0
                quiz_passing_score = lesson_quiz.passing_score or 70.0
                quiz_passed = raw_quiz_score >= quiz_passing_score
                
                # Only use quiz score if passed, otherwise 0
                quiz_score = raw_quiz_score if quiz_passed else 0.0
            else:
                quiz_passed = False  # No attempt means not passed
        
        # Get assignment score if assignment exists (with passing requirement)
        assignment_score = 0.0
        assignment_passed = True  # Default for lessons without assignment
        if has_assignment:
            best_submission = AssignmentSubmission.query.filter_by(
                student_id=self.student_id,
                assignment_id=lesson_assignment.id
            ).first()
            
            if best_submission and best_submission.grade is not None:
                # Calculate percentage score
                points_possible = lesson_assignment.points_possible or 100
                raw_assignment_score = (best_submission.grade / points_possible) * 100 if points_possible > 0 else 0.0
                assignment_passing_score = 70.0  # Standard assignment passing score
                assignment_passed = raw_assignment_score >= assignment_passing_score
                
                # Only use assignment score if passed, otherwise 0
                assignment_score = raw_assignment_score if assignment_passed else 0.0
            else:
                assignment_passed = False  # No graded submission means not passed
        
        # Apply reading and engagement penalties for poor performance
        reading_penalty = 1.0
        if reading < 90.0:
            # Significant penalty for low reading progress
            reading_penalty = 0.5 + (reading / 90.0) * 0.5  # Scale from 0.5 to 1.0
        
        engagement_penalty = 1.0
        if engagement < 60.0:
            # Penalty for low engagement
            engagement_penalty = 0.7 + (engagement / 60.0) * 0.3  # Scale from 0.7 to 1.0
        
        # Calculate weighted score based on available assessments
        if has_quiz and has_assignment:
            # Full assessment: 25% each component
            # If any assessment not passed, significant score reduction
            if not quiz_passed or not assignment_passed:
                # Cap score at 60% if assessments not passed
                base_score = min(60.0, (reading * 0.5) + (engagement * 0.5))
            else:
                base_score = (
                    (reading * 0.25) +
                    (engagement * 0.25) +
                    (quiz_score * 0.25) +
                    (assignment_score * 0.25)
                )
        elif has_quiz:
            # Quiz only: Reading 35%, Engagement 35%, Quiz 30%
            if not quiz_passed:
                # Cap score at 65% if quiz not passed
                base_score = min(65.0, (reading * 0.5) + (engagement * 0.5))
            else:
                base_score = (
                    (reading * 0.35) +
                    (engagement * 0.35) +
                    (quiz_score * 0.30)
                )
        elif has_assignment:
            # Assignment only: Reading 35%, Engagement 35%, Assignment 30%
            if not assignment_passed:
                # Cap score at 65% if assignment not passed
                base_score = min(65.0, (reading * 0.5) + (engagement * 0.5))
            else:
                base_score = (
                    (reading * 0.35) +
                    (engagement * 0.35) +
                    (assignment_score * 0.30)
                )
        else:
            # No assessments: Reading 50%, Engagement 50%
            base_score = (reading * 0.50) + (engagement * 0.50)
        
        # Apply penalties for poor reading/engagement
        final_score = base_score * reading_penalty * engagement_penalty
        
        return max(0.0, min(100.0, final_score))  # Clamp between 0-100
    
    def get_score_breakdown(self):
        """
        Get detailed score breakdown with weights based on available assessments.
        Enhanced to show completion status and requirements.
        Returns a dictionary with component scores and their weights.
        """
        reading = self.reading_progress or 0.0
        engagement = self.engagement_score or 0.0
        
        from ..models.quiz_progress_models import QuizAttempt
        from ..models.course_models import Quiz, Assignment, AssignmentSubmission
        
        lesson_quiz = Quiz.query.filter_by(lesson_id=self.lesson_id, is_published=True).first()
        lesson_assignment = Assignment.query.filter_by(lesson_id=self.lesson_id).first()
        
        has_quiz = lesson_quiz is not None
        has_assignment = lesson_assignment is not None
        
        # Get quiz score and status if quiz exists
        quiz_score = 0.0
        quiz_passed = True  # Default for lessons without quiz
        quiz_status = "not_required"
        if has_quiz:
            best_attempt = QuizAttempt.query.filter_by(
                user_id=self.student_id,
                quiz_id=lesson_quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            if best_attempt:
                raw_quiz_score = best_attempt.score_percentage or 0.0
                quiz_passing_score = lesson_quiz.passing_score or 70.0
                quiz_passed = raw_quiz_score >= quiz_passing_score
                quiz_score = raw_quiz_score
                quiz_status = "passed" if quiz_passed else "failed"
            else:
                quiz_status = "not_attempted"
                quiz_passed = False
        
        # Get assignment score and status if assignment exists
        assignment_score = 0.0
        assignment_passed = True  # Default for lessons without assignment
        assignment_status = "not_required"
        if has_assignment:
            best_submission = AssignmentSubmission.query.filter_by(
                student_id=self.student_id,
                assignment_id=lesson_assignment.id
            ).first()
            
            if best_submission and best_submission.grade is not None:
                points_possible = lesson_assignment.points_possible or 100
                raw_assignment_score = (best_submission.grade / points_possible) * 100 if points_possible > 0 else 0.0
                assignment_passing_score = 70.0
                assignment_passed = raw_assignment_score >= assignment_passing_score
                assignment_score = raw_assignment_score
                assignment_status = "passed" if assignment_passed else "failed"
            elif best_submission:
                assignment_status = "pending_grade"
                assignment_passed = False
            else:
                assignment_status = "not_submitted"
                assignment_passed = False
        
        # Determine weights based on available assessments
        if has_quiz and has_assignment:
            weights = {'reading': 25, 'engagement': 25, 'quiz': 25, 'assignment': 25}
        elif has_quiz:
            weights = {'reading': 35, 'engagement': 35, 'quiz': 30, 'assignment': 0}
        elif has_assignment:
            weights = {'reading': 35, 'engagement': 35, 'quiz': 0, 'assignment': 30}
        else:
            weights = {'reading': 50, 'engagement': 50, 'quiz': 0, 'assignment': 0}
        
        # Check completion requirements
        reading_meets_requirement = reading >= 90.0
        engagement_meets_requirement = engagement >= 60.0
        
        return {
            'scores': {
                'reading': reading,
                'engagement': engagement,
                'quiz': quiz_score,
                'assignment': assignment_score
            },
            'weights': weights,
            'has_quiz': has_quiz,
            'has_assignment': has_assignment,
            'total_score': self.calculate_lesson_score(),
            'requirements_met': {
                'reading': reading_meets_requirement,
                'engagement': engagement_meets_requirement,
                'quiz': quiz_passed,
                'assignment': assignment_passed
            },
            'completion_status': {
                'quiz': quiz_status,
                'assignment': assignment_status,
                'reading_sufficient': reading_meets_requirement,
                'engagement_sufficient': engagement_meets_requirement,
                'can_complete': (reading_meets_requirement and 
                               engagement_meets_requirement and 
                               quiz_passed and 
                               assignment_passed)
            },
            'passing_scores': {
                'quiz': lesson_quiz.passing_score or 70.0 if has_quiz else None,
                'assignment': 70.0 if has_assignment else None,
                'reading_minimum': 90.0,
                'engagement_minimum': 60.0,
                'overall_minimum': 80.0
            }
        }
    
    def to_dict(self):
        score_breakdown = self.get_score_breakdown()
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'time_spent': self.time_spent,
            'completed': self.completed,
            'reading_progress': self.reading_progress,
            'engagement_score': self.engagement_score,
            'scroll_progress': self.scroll_progress,
            'video_progress': self.video_progress,
            'video_current_time': self.video_current_time if hasattr(self, 'video_current_time') else 0.0,
            'video_duration': self.video_duration if hasattr(self, 'video_duration') else 0.0,
            'video_completed': self.video_completed if hasattr(self, 'video_completed') else False,
            'video_watch_count': self.video_watch_count if hasattr(self, 'video_watch_count') else 0,
            'video_last_watched': self.video_last_watched.isoformat() if hasattr(self, 'video_last_watched') and self.video_last_watched else None,
            'playback_speed': self.playback_speed if hasattr(self, 'playback_speed') else 1.0,
            'mixed_video_progress': json.loads(self.mixed_video_progress) if hasattr(self, 'mixed_video_progress') and self.mixed_video_progress else {},
            'lesson_score': score_breakdown['total_score'],  # Comprehensive lesson score
            'score_breakdown': score_breakdown,  # Detailed breakdown with weights
            'has_quiz': score_breakdown['has_quiz'],
            'has_assignment': score_breakdown['has_assignment'],
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'last_accessed': self.last_accessed.isoformat() if self.last_accessed else None
        }

    def calculate_and_store_component_scores(self):
        """
        Calculate individual component scores and store them in the database.
        This should be called whenever quiz or assignment grades are updated.
        
        Returns:
            dict: Component scores and overall lesson score
        """
        from ..models.quiz_progress_models import QuizAttempt
        from ..models.course_models import Quiz, Assignment, AssignmentSubmission
        
        # Get current progress metrics
        reading = self.reading_progress or 0.0
        engagement = self.engagement_score or 0.0
        
        # Check what assessments exist for this lesson
        lesson_quiz = Quiz.query.filter_by(lesson_id=self.lesson_id, is_published=True).first()
        lesson_assignment = Assignment.query.filter_by(lesson_id=self.lesson_id).first()
        
        has_quiz = lesson_quiz is not None
        has_assignment = lesson_assignment is not None
        
        # Calculate reading component score (based on reading progress and engagement)
        reading_component = reading
        if reading < 90.0:
            # Penalty for insufficient reading
            reading_component *= 0.7
        
        # Calculate engagement component score  
        engagement_component = engagement
        if engagement < 60.0:
            # Penalty for low engagement
            engagement_component *= 0.8
            
        # Calculate quiz component score
        quiz_component = 0.0
        if has_quiz:
            best_attempt = QuizAttempt.query.filter_by(
                user_id=self.student_id,
                quiz_id=lesson_quiz.id
            ).order_by(QuizAttempt.score_percentage.desc()).first()
            
            if best_attempt:
                quiz_score = best_attempt.score_percentage or 0.0
                quiz_passing_score = lesson_quiz.passing_score or 70.0
                
                # Quiz component only counts if passed
                if quiz_score >= quiz_passing_score:
                    quiz_component = quiz_score
                else:
                    quiz_component = 0.0  # Failed quiz contributes 0
                    
        # Calculate assignment component score
        assignment_component = 0.0
        if has_assignment:
            best_submission = AssignmentSubmission.query.filter_by(
                student_id=self.student_id,
                assignment_id=lesson_assignment.id
            ).first()
            
            if best_submission and best_submission.grade is not None:
                points_possible = lesson_assignment.points_possible or 100
                assignment_percentage = (best_submission.grade / points_possible) * 100 if points_possible > 0 else 0.0
                assignment_passing_score = 70.0
                
                # Assignment component only counts if passed
                if assignment_percentage >= assignment_passing_score:
                    assignment_component = assignment_percentage
                else:
                    assignment_component = 0.0  # Failed assignment contributes 0
        
        # Calculate overall lesson score with dynamic weights
        if has_quiz and has_assignment:
            # Full assessment: 25% each component
            if quiz_component == 0 or assignment_component == 0:
                # If any assessment failed, cap score at 60%
                lesson_score = min(60.0, (reading_component * 0.5) + (engagement_component * 0.5))
            else:
                lesson_score = (
                    (reading_component * 0.25) +
                    (engagement_component * 0.25) +
                    (quiz_component * 0.25) +
                    (assignment_component * 0.25)
                )
        elif has_quiz:
            # Quiz only: Reading 35%, Engagement 35%, Quiz 30%
            if quiz_component == 0:
                lesson_score = min(65.0, (reading_component * 0.5) + (engagement_component * 0.5))
            else:
                lesson_score = (
                    (reading_component * 0.35) +
                    (engagement_component * 0.35) +
                    (quiz_component * 0.30)
                )
        elif has_assignment:
            # Assignment only: Reading 35%, Engagement 35%, Assignment 30%
            if assignment_component == 0:
                lesson_score = min(65.0, (reading_component * 0.5) + (engagement_component * 0.5))
            else:
                lesson_score = (
                    (reading_component * 0.35) +
                    (engagement_component * 0.35) +
                    (assignment_component * 0.30)
                )
        else:
            # No assessments: Reading 50%, Engagement 50%
            lesson_score = (reading_component * 0.50) + (engagement_component * 0.50)
        
        # Clamp lesson score between 0-100
        lesson_score = max(0.0, min(100.0, lesson_score))
        
        # Store component scores in database
        self.reading_component_score = reading_component
        self.engagement_component_score = engagement_component
        self.quiz_component_score = quiz_component
        self.assignment_component_score = assignment_component
        self.lesson_score = lesson_score
        self.score_last_updated = datetime.utcnow()
        
        # Update the completion status
        self.updated_at = datetime.utcnow()
        
        try:
            db.session.commit()
        except Exception as e:
            db.session.rollback()
            raise e
            
        return {
            'reading_component': reading_component,
            'engagement_component': engagement_component,
            'quiz_component': quiz_component,
            'assignment_component': assignment_component,
            'lesson_score': lesson_score,
            'has_quiz': has_quiz,
            'has_assignment': has_assignment,
            'updated_at': self.score_last_updated
        }

class UserProgress(db.Model):
    """Track overall progress for students in courses"""
    __tablename__ = 'user_progress'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    completion_percentage = db.Column(db.Float, default=0.0)
    total_time_spent = db.Column(db.Integer, default=0)  # in seconds
    last_accessed = db.Column(db.DateTime, default=datetime.utcnow)
    current_lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=True)
    
    user = db.relationship('User', backref=db.backref('course_progress', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('student_progress', lazy='dynamic'))
    current_lesson = db.relationship('Lesson')
    
    __table_args__ = (db.UniqueConstraint('user_id', 'course_id', name='_user_course_progress_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'course_id': self.course_id,
            'completion_percentage': self.completion_percentage,
            'total_time_spent': self.total_time_spent,
            'last_accessed': self.last_accessed.isoformat(),
            'current_lesson_id': self.current_lesson_id,
            'course_title': self.course.title if self.course else None
        }

class StudentNote(db.Model):
    """Allow students to take notes during lessons"""
    __tablename__ = 'student_notes'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    lesson_id = db.Column(db.Integer, db.ForeignKey('lessons.id'), nullable=False)
    content = db.Column(db.Text, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('notes', lazy='dynamic'))
    lesson = db.relationship('Lesson', backref=db.backref('student_notes', lazy='dynamic'))
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'lesson_id': self.lesson_id,
            'content': self.content,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat(),
            'lesson_title': self.lesson.title if self.lesson else None
        }

class Badge(db.Model):
    """Achievement badges for students"""
    __tablename__ = 'badges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, unique=True)
    description = db.Column(db.Text, nullable=True)
    icon_url = db.Column(db.String(255), nullable=True)
    criteria = db.Column(db.Text, nullable=True)  # JSON string describing criteria
    points = db.Column(db.Integer, default=0)
    is_active = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'criteria': self.criteria,
            'points': self.points,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }

class UserBadge(db.Model):
    """Track badges earned by users"""
    __tablename__ = 'user_badges'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('badges.id'), nullable=False)
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('user_badges', lazy='dynamic'))
    badge = db.relationship('Badge', backref=db.backref('awarded_to', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('user_id', 'badge_id', name='_user_badge_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'badge_id': self.badge_id,
            'earned_at': self.earned_at.isoformat(),
            'badge': self.badge.to_dict() if self.badge else None
        }

class StudentBookmark(db.Model):
    """Bookmarked courses by students"""
    __tablename__ = 'student_bookmarks'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('bookmarks', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('bookmarked_by', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_bookmark_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'created_at': self.created_at.isoformat(),
            'course': self.course.to_dict() if self.course else None
        }

class StudentForum(db.Model):
    """Discussion forums for courses and general discussions"""
    __tablename__ = 'student_forums'
    id = db.Column(db.Integer, primary_key=True)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)  # Allow NULL for general forums
    title = db.Column(db.String(255), nullable=False)
    description = db.Column(db.Text, nullable=True)
    created_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Enhanced forum features
    category = db.Column(db.String(100), nullable=True)
    is_pinned = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)
    view_count = db.Column(db.Integer, default=0)
    allow_anonymous = db.Column(db.Boolean, default=True)
    moderated = db.Column(db.Boolean, default=False)
    
    course = db.relationship('Course', backref=db.backref('forums', lazy='dynamic'))
    creator = db.relationship('User', backref=db.backref('created_forums', lazy='dynamic'))
    
    def to_dict(self):
        # Get post and thread counts
        post_count = ForumPost.query.filter_by(forum_id=self.id, is_active=True).count()
        thread_count = ForumPost.query.filter_by(forum_id=self.id, parent_post_id=None, is_active=True).count()
        
        return {
            'id': self.id,
            'course_id': self.course_id,
            'title': self.title,
            'description': self.description,
            'created_by': self.created_by,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'is_active': self.is_active,
            'course_title': self.course.title if self.course else None,
            'creator_name': f"{self.creator.first_name} {self.creator.last_name}" if self.creator else None,
            'post_count': post_count,
            'thread_count': thread_count,
            'is_public': True,  # Default for compatibility
            'is_trending': post_count > 5,  # Simple trending logic
            'is_subscribed': False  # Default for compatibility
        }

class ForumPost(db.Model):
    """Posts in course forums"""
    __tablename__ = 'forum_posts'
    id = db.Column(db.Integer, primary_key=True)
    forum_id = db.Column(db.Integer, db.ForeignKey('student_forums.id'), nullable=False)
    author_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    title = db.Column(db.String(255), nullable=False)
    content = db.Column(db.Text, nullable=False)
    parent_post_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=True)  # For replies
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    # Enhanced forum post features
    is_pinned = db.Column(db.Boolean, default=False)
    is_locked = db.Column(db.Boolean, default=False)
    is_approved = db.Column(db.Boolean, default=True)
    like_count = db.Column(db.Integer, default=0)
    view_count = db.Column(db.Integer, default=0)
    is_anonymous = db.Column(db.Boolean, default=False)
    edited_at = db.Column(db.DateTime)
    edited_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    moderator_notes = db.Column(db.Text)
    
    # Moderation fields
    is_flagged = db.Column(db.Boolean, default=False)
    flag_reason = db.Column(db.Text)
    moderated_by = db.Column(db.Integer, db.ForeignKey('users.id'))
    moderated_at = db.Column(db.DateTime)
    is_edited = db.Column(db.Boolean, default=False)
    dislike_count = db.Column(db.Integer, default=0)
    
    forum = db.relationship('StudentForum', backref=db.backref('posts', lazy='dynamic'))
    author = db.relationship('User', foreign_keys=[author_id], backref=db.backref('forum_posts', lazy='dynamic'))
    parent_post = db.relationship('ForumPost', remote_side=[id], backref='replies')
    
    @property
    def author_name(self):
        """Get the author's full name"""
        return f"{self.author.first_name} {self.author.last_name}" if self.author else "Unknown User"
    
    def to_dict(self):
        return {
            'id': self.id,
            'forum_id': self.forum_id,
            'author_id': self.author_id,
            'title': self.title,
            'content': self.content,
            'parent_post_id': self.parent_post_id,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'is_active': self.is_active,
            'is_pinned': self.is_pinned,
            'is_locked': self.is_locked,
            'is_approved': self.is_approved,
            'is_edited': self.is_edited,
            'like_count': self.like_count,
            'dislike_count': self.dislike_count,
            'view_count': self.view_count,
            'is_flagged': self.is_flagged,
            'flag_reason': self.flag_reason,
            'moderated_by': self.moderated_by,
            'moderated_at': self.moderated_at.isoformat() if self.moderated_at else None,
            'author_name': self.author_name,
            'reply_count': len(self.replies) if hasattr(self, 'replies') else 0
        }


class ForumPostLike(db.Model):
    """Likes and dislikes for forum posts"""
    __tablename__ = 'forum_post_likes'
    id = db.Column(db.Integer, primary_key=True)
    post_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    is_like = db.Column(db.Boolean, nullable=False)  # True for like, False for dislike
    created_at = db.Column(db.DateTime, default=datetime.utcnow)


# TEMPORARILY COMMENTED OUT DUE TO CONSTRAINT CONFLICT
# class ForumSubscription(db.Model):
#     """User subscriptions to forums for notifications"""
#     __tablename__ = 'forum_subscriptions'
#     id = db.Column(db.Integer, primary_key=True)
#     user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
#     forum_id = db.Column(db.Integer, db.ForeignKey('student_forums.id'), nullable=True)
#     thread_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=True)
#     subscription_type = db.Column(db.String(20), nullable=False)
#     notify_replies = db.Column(db.Boolean, default=True)
#     notify_new_threads = db.Column(db.Boolean, default=True)
#     created_at = db.Column(db.DateTime, default=datetime.utcnow)
#     is_active = db.Column(db.Boolean, default=True)
#     
#     user = db.relationship('User', backref=db.backref('forum_subscriptions', lazy='dynamic'))
#     forum = db.relationship('StudentForum', backref=db.backref('subscriptions', lazy='dynamic'))
#     thread = db.relationship('ForumPost', backref=db.backref('thread_subscriptions', lazy='dynamic'))
#     
#     __table_args__ = (db.UniqueConstraint('user_id', 'forum_id', 'thread_id', name='_user_forum_thread_sub_uc'),)

# Simple placeholder class to avoid import errors
class ForumSubscription:
    @staticmethod
    def query():
        return EmptyQuery()

class EmptyQuery:
    def filter_by(self, **kwargs):
        return self
    
    def first(self):
        return None
    
    def all(self):
        return []
    
    post = db.relationship('ForumPost', backref=db.backref('post_likes', lazy='dynamic'))
    user = db.relationship('User', backref=db.backref('forum_likes', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('post_id', 'user_id', name='_post_user_like_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'post_id': self.post_id,
            'user_id': self.user_id,
            'is_like': self.is_like,
            'created_at': self.created_at.isoformat()
        }


class ForumSubscription(db.Model):
    """User subscriptions to forum threads for notifications"""
    __tablename__ = 'forum_subscriptions'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    forum_id = db.Column(db.Integer, db.ForeignKey('student_forums.id'), nullable=True)
    thread_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=True)
    subscription_type = db.Column(db.String(20), nullable=False)  # 'forum', 'thread'
    notify_replies = db.Column(db.Boolean, default=True)
    notify_new_threads = db.Column(db.Boolean, default=True)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    user = db.relationship('User', backref=db.backref('forum_subscriptions', lazy='dynamic'))
    forum = db.relationship('StudentForum', backref=db.backref('subscriptions', lazy='dynamic'))
    thread = db.relationship('ForumPost', backref=db.backref('subscriptions', lazy='dynamic'))
    
    __table_args__ = (
        db.UniqueConstraint('user_id', 'forum_id', 'thread_id', name='_user_forum_thread_sub_uc'),
    )
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'forum_id': self.forum_id,
            'thread_id': self.thread_id,
            'subscription_type': self.subscription_type,
            'notify_replies': self.notify_replies,
            'notify_new_threads': self.notify_new_threads,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }


class ForumNotification(db.Model):
    """Notifications for forum activities"""
    __tablename__ = 'forum_notifications'
    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    forum_id = db.Column(db.Integer, db.ForeignKey('student_forums.id'), nullable=True)
    post_id = db.Column(db.Integer, db.ForeignKey('forum_posts.id'), nullable=True)
    notification_type = db.Column(db.String(50), nullable=False)  # 'new_thread', 'new_reply', 'post_liked', 'mention'
    title = db.Column(db.String(255), nullable=False)
    message = db.Column(db.Text, nullable=False)
    is_read = db.Column(db.Boolean, default=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    user = db.relationship('User', backref=db.backref('forum_notifications', lazy='dynamic'))
    forum = db.relationship('StudentForum')
    post = db.relationship('ForumPost')
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'forum_id': self.forum_id,
            'post_id': self.post_id,
            'notification_type': self.notification_type,
            'title': self.title,
            'message': self.message,
            'is_read': self.is_read,
            'created_at': self.created_at.isoformat()
        }

# ===== NEW ENHANCED MODELS FOR COMPREHENSIVE LMS FEATURES =====

class CourseEnrollmentApplication(db.Model):
    """Handle scholarship course applications and enrollment workflow"""
    __tablename__ = 'course_enrollment_applications'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    application_type = db.Column(db.String(20), nullable=False)  # 'scholarship', 'paid', 'free'
    status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'rejected', 'enrolled'
    motivation_letter = db.Column(db.Text, nullable=True)
    prerequisites_met = db.Column(db.Boolean, default=False)
    payment_status = db.Column(db.String(20), nullable=True)  # 'pending', 'completed', 'failed'
    payment_reference = db.Column(db.String(100), nullable=True)
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    applied_at = db.Column(db.DateTime, default=datetime.utcnow)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    enrolled_at = db.Column(db.DateTime, nullable=True)
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('enrollment_applications', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('applications', lazy='dynamic'))
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_application_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'application_type': self.application_type,
            'status': self.status,
            'motivation_letter': self.motivation_letter,
            'prerequisites_met': self.prerequisites_met,
            'payment_status': self.payment_status,
            'payment_reference': self.payment_reference,
            'reviewed_by': self.reviewed_by,
            'review_notes': self.review_notes,
            'applied_at': self.applied_at.isoformat(),
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'enrolled_at': self.enrolled_at.isoformat() if self.enrolled_at else None,
            'course_title': self.course.title if self.course else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }

class ModuleProgress(db.Model):
    """Track detailed progress through course modules with strict progression"""
    __tablename__ = 'module_progress'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    # Scoring breakdown (80% total required to pass)
    course_contribution_score = db.Column(db.Float, default=0.0)  # 10% - forums, help, tracking
    quiz_score = db.Column(db.Float, default=0.0)  # 30% - knowledge checks
    assignment_score = db.Column(db.Float, default=0.0)  # 40% - hands-on work
    final_assessment_score = db.Column(db.Float, default=0.0)  # 20% - module assessment
    
    cumulative_score = db.Column(db.Float, default=0.0)  # Total weighted score
    attempts_count = db.Column(db.Integer, default=0)
    max_attempts = db.Column(db.Integer, default=3)
    
    status = db.Column(db.String(20), default='locked')  # 'locked', 'unlocked', 'in_progress', 'completed', 'failed'
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    failed_at = db.Column(db.DateTime, nullable=True)
    
    # Unlock logic
    unlocked_at = db.Column(db.DateTime, nullable=True)
    prerequisites_met = db.Column(db.Boolean, default=False)
    
    student = db.relationship('User', backref=db.backref('module_progress', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('student_progress', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('module_progress', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'module_id', 'enrollment_id', name='_student_module_progress_uc'),)
    
    def calculate_module_score(self):
        """
        Calculate the module score as the average of all lesson scores.
        Each lesson score is comprehensive (reading + engagement + quiz + assignment).
        Returns a score from 0-100.
        """
        from sqlalchemy import func
        
        # Get all lessons in this module
        module_lessons = self.module.lessons.all()
        if not module_lessons:
            return 0.0
        
        total_score = 0.0
        scored_lessons = 0
        
        for lesson in module_lessons:
            # Get lesson completion for this student
            completion = LessonCompletion.query.filter_by(
                student_id=self.student_id,
                lesson_id=lesson.id
            ).first()
            
            if completion:
                # Use the comprehensive lesson score calculation
                lesson_score = completion.calculate_lesson_score()
                total_score += lesson_score
                scored_lessons += 1
        
        # Calculate average, or return 0 if no lessons
        return (total_score / scored_lessons) if scored_lessons > 0 else 0.0
    
    def calculate_lessons_average_score(self):
        """Alias for calculate_module_score for backwards compatibility"""
        return self.calculate_module_score()
    
    def calculate_module_weighted_score(self):
        """
        Calculate the weighted module score for passing requirements.
        Uses DYNAMIC WEIGHTS based on available assessments:
        - If no assessments: 100% Reading & Engagement
        - If only quizzes: 30% Reading, 70% Quiz
        - If only assignments: 30% Reading, 70% Assignments
        - If all available: 10% Reading, 30% Quiz, 40% Assignment, 20% Final
        
        Returns a score from 0-100.
        """
        from .course_models import Quiz, Assignment
        
        # Get the module score (average of all lesson scores)
        module_lessons_score = self.calculate_module_score()
        
        # Ensure all scores default to 0.0 if None
        course_contrib = module_lessons_score
        quiz = self.quiz_score or 0.0
        assignment = self.assignment_score or 0.0
        final = self.final_assessment_score or 0.0
        
        # Check what assessments exist in this module
        lesson_ids = [lesson.id for lesson in self.module.lessons] if self.module else []
        
        # Check for lesson-level quizzes (quizzes linked to lessons in this module)
        has_quizzes = Quiz.query.filter(Quiz.lesson_id.in_(lesson_ids)).first() is not None if lesson_ids else False
        
        # Check for lesson-level assignments
        has_assignments = Assignment.query.filter(Assignment.lesson_id.in_(lesson_ids)).first() is not None if lesson_ids else False
        
        # Check for module-level final assessment quiz (quiz with module_id but no lesson_id)
        # This correctly identifies if a final assessment EXISTS, not just if one has been taken
        has_final_assessment = Quiz.query.filter(
            Quiz.module_id == self.module_id,
            Quiz.lesson_id.is_(None),
            Quiz.is_published == True
        ).first() is not None if self.module else False
        
        # Calculate dynamic weights based on available assessments
        if not has_quizzes and not has_assignments and not has_final_assessment:
            # No assessments - Reading & Engagement is 100%
            weighted_score = course_contrib
        elif not has_quizzes and not has_assignments:
            # Only final assessment exists
            weighted_score = (course_contrib * 0.40) + (final * 0.60)
        elif not has_quizzes and not has_final_assessment:
            # Only assignments exist
            weighted_score = (course_contrib * 0.30) + (assignment * 0.70)
        elif not has_assignments and not has_final_assessment:
            # Only quizzes exist
            weighted_score = (course_contrib * 0.30) + (quiz * 0.70)
        elif not has_quizzes:
            # Assignments and final exist, no quizzes
            weighted_score = (course_contrib * 0.15) + (assignment * 0.55) + (final * 0.30)
        elif not has_assignments:
            # Quizzes and final exist, no assignments
            weighted_score = (course_contrib * 0.15) + (quiz * 0.55) + (final * 0.30)
        elif not has_final_assessment:
            # Quizzes and assignments exist, no final
            weighted_score = (course_contrib * 0.15) + (quiz * 0.40) + (assignment * 0.45)
        else:
            # All components exist - use default weights
            weighted_score = (
                (course_contrib * 0.10) +
                (quiz * 0.30) +
                (assignment * 0.40) +
                (final * 0.20)
            )
        
        # Update the cached cumulative_score field
        self.cumulative_score = weighted_score
        return weighted_score
    
    def calculate_cumulative_score(self):
        """Alias for calculate_module_weighted_score for backwards compatibility"""
        return self.calculate_module_weighted_score()
    
    def can_proceed_to_next(self):
        """
        Check if student can proceed to next module with STRICT enforcement.
        
        Requirements:
        1. Module status must be 'completed' 
        2. Cumulative score >= 80%
        3. ALL lessons in module must satisfy their individual requirements
        4. No critical failures in any lesson
        """
        if self.status != 'completed':
            return False
            
        if (self.cumulative_score or 0) < 80.0:
            return False
        
        # STRICT CHECK: Verify ALL lessons in module meet requirements
        from ..services.lesson_completion_service import LessonCompletionService
        
        module = self.module
        lessons = module.lessons.all()
        
        for lesson in lessons:
            completion = LessonCompletion.query.filter_by(
                student_id=self.student_id,
                lesson_id=lesson.id
            ).first()
            
            if not completion:
                # Lesson not started - cannot proceed
                return False
            
            # Check comprehensive lesson requirements
            requirements_status = LessonCompletionService.check_lesson_completion_requirements(
                self.student_id, lesson.id
            )
            
            if not requirements_status["can_complete"]:
                # Lesson requirements not satisfied - cannot proceed
                return False
            
            # Additional check: Lesson score must meet minimum threshold
            lesson_score = completion.calculate_lesson_score()
            if lesson_score < 80.0:  # LESSON_PASSING_SCORE threshold
                return False
        
        # All checks passed
        return True
    
    def get_module_completion_blockers(self):
        """
        Get detailed information about what's blocking module completion.
        Returns a dict with blocking issues and recommendations.
        """
        blockers = []
        recommendations = []
        
        # Check basic requirements
        if self.status != 'completed':
            blockers.append(f"Module status is '{self.status}', needs to be 'completed'")
            recommendations.append("Complete all module requirements to change status")
        
        current_score = self.cumulative_score or 0
        if current_score < 80.0:
            gap = 80.0 - current_score
            blockers.append(f"Module score {current_score:.1f}% is below 80% requirement")
            recommendations.append(f"Increase module score by {gap:.1f}% points")
        
        # Check lesson-level requirements
        from ..services.lesson_completion_service import LessonCompletionService
        
        module = self.module
        lessons = module.lessons.all()
        failed_lessons = []
        
        for lesson in lessons:
            completion = LessonCompletion.query.filter_by(
                student_id=self.student_id,
                lesson_id=lesson.id
            ).first()
            
            if not completion:
                failed_lessons.append({
                    "title": lesson.title,
                    "issue": "Not started",
                    "recommendation": "Start and complete the lesson"
                })
                continue
            
            # Check lesson requirements
            requirements_status = LessonCompletionService.check_lesson_completion_requirements(
                self.student_id, lesson.id
            )
            
            if not requirements_status["can_complete"]:
                missing_reqs = requirements_status.get("missing_requirements", [])
                failed_lessons.append({
                    "title": lesson.title,
                    "issue": f"Requirements not met: {', '.join(missing_reqs)}",
                    "recommendation": "Satisfy all lesson requirements"
                })
                continue
            
            # Check lesson score
            lesson_score = completion.calculate_lesson_score()
            if lesson_score < 80.0:
                failed_lessons.append({
                    "title": lesson.title,
                    "issue": f"Score {lesson_score:.1f}% below 80% requirement",
                    "recommendation": f"Improve lesson score by {80.0 - lesson_score:.1f}% points"
                })
        
        if failed_lessons:
            blockers.append(f"{len(failed_lessons)} lesson(s) have unsatisfied requirements")
            recommendations.append("Complete all lesson requirements before module unlock")
        
        return {
            "can_proceed": len(blockers) == 0,
            "blockers": blockers,
            "recommendations": recommendations,
            "failed_lessons": failed_lessons,
            "total_lessons": len(lessons),
            "passed_lessons": len(lessons) - len(failed_lessons)
        }
    
    def to_dict(self):
        module_score = self.calculate_module_score()
        weighted_score = self.calculate_module_weighted_score()
        
        return {
            'id': self.id,
            'student_id': self.student_id,
            'module_id': self.module_id,
            'enrollment_id': self.enrollment_id,
            'module_score': module_score,  # Pure average of all lesson scores (0-100)
            'course_contribution_score': self.course_contribution_score or 0.0,
            'lessons_average_score': module_score,  # Backwards compatibility
            'quiz_score': self.quiz_score or 0.0,
            'assignment_score': self.assignment_score or 0.0,
            'final_assessment_score': self.final_assessment_score or 0.0,
            'weighted_score': weighted_score,  # Weighted score for passing (0-100)
            'cumulative_score': weighted_score,  # Backwards compatibility
            'attempts_count': self.attempts_count or 0,
            'max_attempts': self.max_attempts or 3,
            'status': self.status or 'locked',
            'started_at': self.started_at.isoformat() if self.started_at else None,
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'failed_at': self.failed_at.isoformat() if self.failed_at else None,
            'unlocked_at': self.unlocked_at.isoformat() if self.unlocked_at else None,
            'prerequisites_met': self.prerequisites_met or False,
            'module_title': self.module.title if self.module else None
        }

class AssessmentAttempt(db.Model):
    """Track multiple attempts at quizzes, assignments, and assessments"""
    __tablename__ = 'assessment_attempts'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    assessment_type = db.Column(db.String(20), nullable=False)  # 'quiz', 'assignment', 'project', 'final_assessment'
    assessment_id = db.Column(db.Integer, nullable=False)  # Generic ID for different assessment types
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    
    attempt_number = db.Column(db.Integer, nullable=False)
    score = db.Column(db.Float, default=0.0)
    max_score = db.Column(db.Float, nullable=False)
    percentage = db.Column(db.Float, default=0.0)
    
    submission_data = db.Column(db.Text, nullable=True)  # JSON data of submission
    feedback = db.Column(db.Text, nullable=True)
    graded_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    
    started_at = db.Column(db.DateTime, default=datetime.utcnow)
    submitted_at = db.Column(db.DateTime, nullable=True)
    graded_at = db.Column(db.DateTime, nullable=True)
    
    status = db.Column(db.String(20), default='in_progress')  # 'in_progress', 'submitted', 'graded', 'failed'
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('assessment_attempts', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('assessment_attempts', lazy='dynamic'))
    grader = db.relationship('User', foreign_keys=[graded_by])
    
    def calculate_percentage(self):
        """Calculate percentage score"""
        if self.max_score > 0:
            self.percentage = (self.score / self.max_score) * 100
        return self.percentage
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'assessment_type': self.assessment_type,
            'assessment_id': self.assessment_id,
            'module_id': self.module_id,
            'attempt_number': self.attempt_number,
            'score': self.score,
            'max_score': self.max_score,
            'percentage': self.percentage,
            'submission_data': self.submission_data,
            'feedback': self.feedback,
            'graded_by': self.graded_by,
            'started_at': self.started_at.isoformat(),
            'submitted_at': self.submitted_at.isoformat() if self.submitted_at else None,
            'graded_at': self.graded_at.isoformat() if self.graded_at else None,
            'status': self.status,
            'module_title': self.module.title if self.module else None
        }

class Certificate(db.Model):
    """Course completion certificates"""
    __tablename__ = 'certificates'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    certificate_number = db.Column(db.String(100), unique=True, nullable=False)
    overall_score = db.Column(db.Float, nullable=False)
    grade = db.Column(db.String(10), nullable=True)  # Deprecated - kept for backward compatibility
    
    skills_acquired = db.Column(db.Text, nullable=True)  # JSON list of skills
    portfolio_items = db.Column(db.Text, nullable=True)  # JSON list of portfolio work
    
    issued_at = db.Column(db.DateTime, default=datetime.utcnow)
    expires_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column(db.Boolean, default=True)
    
    # Digital signature/verification
    verification_hash = db.Column(db.String(256), nullable=False)
    
    student = db.relationship('User', backref=db.backref('certificates', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('certificates', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('certificate', uselist=False))
    
    def generate_certificate_number(self):
        """Generate unique certificate number"""
        from datetime import datetime
        import hashlib
        import random
        
        # Format: ABC-YYYY-NNNNNN
        year = datetime.now().year
        random_num = random.randint(100000, 999999)
        self.certificate_number = f"ABC-{year}-{random_num}"
        
        # Generate verification hash
        hash_string = f"{self.student_id}{self.course_id}{self.certificate_number}{self.issued_at}"
        self.verification_hash = hashlib.sha256(hash_string.encode()).hexdigest()
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_id': self.enrollment_id,
            'certificate_number': self.certificate_number,
            'overall_score': self.overall_score,
            'grade': self.grade,
            'skills_acquired': json.loads(self.skills_acquired) if self.skills_acquired else [],
            'portfolio_items': json.loads(self.portfolio_items) if self.portfolio_items else [],
            'issued_at': self.issued_at.isoformat(),
            'expires_at': self.expires_at.isoformat() if self.expires_at else None,
            'is_active': self.is_active,
            'verification_hash': self.verification_hash,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None,
            'course_title': self.course.title if self.course else None
        }

class SkillBadge(db.Model):
    """Skill-based micro-certifications"""
    __tablename__ = 'skill_badges'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), unique=True, nullable=False)
    description = db.Column(db.Text, nullable=False)
    icon_url = db.Column(db.String(255), nullable=True)
    criteria = db.Column(db.Text, nullable=False)  # JSON criteria for earning
    category = db.Column(db.String(50), nullable=False)  # 'technical', 'soft_skills', 'project', etc.
    difficulty_level = db.Column(db.String(20), nullable=False)  # 'beginner', 'intermediate', 'advanced'
    points_value = db.Column(db.Integer, default=10)
    
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    is_active = db.Column(db.Boolean, default=True)
    
    def to_dict(self):
        return {
            'id': self.id,
            'name': self.name,
            'description': self.description,
            'icon_url': self.icon_url,
            'criteria': json.loads(self.criteria) if self.criteria else {},
            'category': self.category,
            'difficulty_level': self.difficulty_level,
            'points_value': self.points_value,
            'created_at': self.created_at.isoformat(),
            'is_active': self.is_active
        }

class StudentSkillBadge(db.Model):
    """Track badges earned by students"""
    __tablename__ = 'student_skill_badges'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    badge_id = db.Column(db.Integer, db.ForeignKey('skill_badges.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=True)  # Optional course context
    module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=True)  # Optional module context
    
    earned_at = db.Column(db.DateTime, default=datetime.utcnow)
    evidence_data = db.Column(db.Text, nullable=True)  # JSON evidence of achievement
    verified = db.Column(db.Boolean, default=False)
    verified_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    verified_at = db.Column(db.DateTime, nullable=True)
    
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('earned_badges', lazy='dynamic'))
    badge = db.relationship('SkillBadge', backref=db.backref('earned_by', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('badges_earned', lazy='dynamic'))
    module = db.relationship('Module', backref=db.backref('badges_earned', lazy='dynamic'))
    verifier = db.relationship('User', foreign_keys=[verified_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'badge_id', 'course_id', 'module_id', name='_student_badge_context_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'badge_id': self.badge_id,
            'course_id': self.course_id,
            'module_id': self.module_id,
            'earned_at': self.earned_at.isoformat(),
            'evidence_data': json.loads(self.evidence_data) if self.evidence_data else {},
            'verified': self.verified,
            'verified_by': self.verified_by,
            'verified_at': self.verified_at.isoformat() if self.verified_at else None,
            'badge': self.badge.to_dict() if self.badge else None,
            'course_title': self.course.title if self.course else None,
            'module_title': self.module.title if self.module else None
        }

class StudentTranscript(db.Model):
    """Comprehensive academic transcript for students"""
    __tablename__ = 'student_transcripts'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    
    # Overall statistics
    total_courses_enrolled = db.Column(db.Integer, default=0)
    total_courses_completed = db.Column(db.Integer, default=0)
    total_certificates = db.Column(db.Integer, default=0)
    total_badges = db.Column(db.Integer, default=0)
    overall_gpa = db.Column(db.Float, default=0.0)
    
    # Time tracking
    total_learning_hours = db.Column(db.Integer, default=0)  # in minutes
    last_updated = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    
    # Skills mapping
    skills_acquired = db.Column(db.Text, nullable=True)  # JSON skills array
    competency_levels = db.Column(db.Text, nullable=True)  # JSON competency mapping
    
    student = db.relationship('User', backref=db.backref('transcript', uselist=False))
    
    def update_statistics(self):
        """Update transcript statistics"""
        # Count completed courses through enrollments
        completed_enrollments = db.session.query(Enrollment).filter(
            Enrollment.student_id == self.student_id,
            Enrollment.completed_at.isnot(None)
        ).count()
        
        # Count certificates
        certificates_count = db.session.query(Certificate).filter_by(
            student_id=self.student_id, 
            is_active=True
        ).count()
        
        # Count badges
        badges_count = db.session.query(StudentSkillBadge).filter_by(student_id=self.student_id).count()
        
        # Update statistics
        self.total_courses_completed = completed_enrollments
        self.total_certificates = certificates_count
        self.total_badges = badges_count
        
        # Calculate GPA based on certificates
        certificates = db.session.query(Certificate).filter_by(
            student_id=self.student_id, 
            is_active=True
        ).all()
        
        if certificates:
            total_score = sum(cert.overall_score for cert in certificates if cert.overall_score)
            self.overall_gpa = (total_score / len(certificates)) / 25 if total_score > 0 else 0.0  # Convert to 4.0 scale
        else:
            self.overall_gpa = 0.0
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'total_courses_enrolled': self.total_courses_enrolled,
            'total_courses_completed': self.total_courses_completed,
            'total_certificates': self.total_certificates,
            'total_badges': self.total_badges,
            'overall_gpa': self.overall_gpa,
            'total_learning_hours': self.total_learning_hours,
            'last_updated': self.last_updated.isoformat(),
            'skills_acquired': json.loads(self.skills_acquired) if self.skills_acquired else [],
            'competency_levels': json.loads(self.competency_levels) if self.competency_levels else {},
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }

class LearningAnalytics(db.Model):
    """Detailed learning analytics and performance tracking"""
    __tablename__ = 'learning_analytics'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    
    # Time analytics
    daily_learning_minutes = db.Column(db.Text, nullable=True)  # JSON time tracking per day
    weekly_learning_minutes = db.Column(db.Text, nullable=True)  # JSON weekly aggregates
    peak_learning_hours = db.Column(db.Text, nullable=True)  # JSON hours when most active
    
    # Performance trends
    quiz_performance_trend = db.Column(db.Text, nullable=True)  # JSON performance over time
    assignment_performance_trend = db.Column(db.Text, nullable=True)
    engagement_score = db.Column(db.Float, default=0.0)  # 0-100 engagement score
    
    # Weak areas identification
    weak_topics = db.Column(db.Text, nullable=True)  # JSON array of struggling topics
    recommended_reviews = db.Column(db.Text, nullable=True)  # JSON recommended review materials
    
    # Learning patterns
    preferred_content_types = db.Column(db.Text, nullable=True)  # JSON content type preferences
    learning_velocity = db.Column(db.Float, default=0.0)  # Lessons per week
    
    last_calculated = db.Column(db.DateTime, default=datetime.utcnow)
    
    student = db.relationship('User', backref=db.backref('learning_analytics', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('student_analytics', lazy='dynamic'))
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', name='_student_course_analytics_uc'),)
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'daily_learning_minutes': json.loads(self.daily_learning_minutes) if self.daily_learning_minutes else {},
            'weekly_learning_minutes': json.loads(self.weekly_learning_minutes) if self.weekly_learning_minutes else {},
            'peak_learning_hours': json.loads(self.peak_learning_hours) if self.peak_learning_hours else {},
            'quiz_performance_trend': json.loads(self.quiz_performance_trend) if self.quiz_performance_trend else [],
            'assignment_performance_trend': json.loads(self.assignment_performance_trend) if self.assignment_performance_trend else [],
            'engagement_score': self.engagement_score,
            'weak_topics': json.loads(self.weak_topics) if self.weak_topics else [],
            'recommended_reviews': json.loads(self.recommended_reviews) if self.recommended_reviews else [],
            'preferred_content_types': json.loads(self.preferred_content_types) if self.preferred_content_types else {},
            'learning_velocity': self.learning_velocity,
            'last_calculated': self.last_calculated.isoformat(),
            'course_title': self.course.title if self.course else None
        }

class StudentSuspension(db.Model):
    """Track student suspensions from courses due to excessive failed attempts"""
    __tablename__ = 'student_suspensions'
    id = db.Column(db.Integer, primary_key=True)
    student_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    course_id = db.Column(db.Integer, db.ForeignKey('courses.id'), nullable=False)
    enrollment_id = db.Column(db.Integer, db.ForeignKey('enrollments.id'), nullable=False)
    
    # Suspension details
    suspended_at = db.Column(db.DateTime, default=datetime.utcnow)
    reason = db.Column(db.String(255), default='Maximum retake attempts exceeded')
    failed_module_id = db.Column(db.Integer, db.ForeignKey('modules.id'), nullable=False)
    total_attempts_made = db.Column(db.Integer, nullable=False)
    
    # Appeal and reinstatement
    can_appeal = db.Column(db.Boolean, default=True)
    appeal_deadline = db.Column(db.DateTime, nullable=True)
    appeal_submitted = db.Column(db.Boolean, default=False)
    appeal_text = db.Column(db.Text, nullable=True)
    appeal_submitted_at = db.Column(db.DateTime, nullable=True)
    
    # Review status
    review_status = db.Column(db.String(20), default='pending')  # 'pending', 'approved', 'denied'
    reviewed_by = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_notes = db.Column(db.Text, nullable=True)
    
    # Reinstatement
    reinstated = db.Column(db.Boolean, default=False)
    reinstated_at = db.Column(db.DateTime, nullable=True)
    additional_attempts_granted = db.Column(db.Integer, default=0)
    
    # Relationships
    student = db.relationship('User', foreign_keys=[student_id], backref=db.backref('suspensions', lazy='dynamic'))
    course = db.relationship('Course', backref=db.backref('suspended_students', lazy='dynamic'))
    enrollment = db.relationship('Enrollment', backref=db.backref('suspension', uselist=False))
    failed_module = db.relationship('Module', backref=db.backref('suspensions_caused', lazy='dynamic'))
    reviewer = db.relationship('User', foreign_keys=[reviewed_by])
    
    __table_args__ = (db.UniqueConstraint('student_id', 'course_id', 'enrollment_id', name='_student_course_suspension_uc'),)
    
    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Set appeal deadline to 30 days from suspension
        from datetime import timedelta
        self.appeal_deadline = self.suspended_at + timedelta(days=30)
    
    def can_submit_appeal(self):
        """Check if student can still submit an appeal"""
        from datetime import datetime
        return (
            self.can_appeal and 
            not self.appeal_submitted and 
            self.appeal_deadline and 
            datetime.utcnow() <= self.appeal_deadline
        )
    
    def to_dict(self):
        return {
            'id': self.id,
            'student_id': self.student_id,
            'course_id': self.course_id,
            'enrollment_id': self.enrollment_id,
            'suspended_at': self.suspended_at.isoformat(),
            'reason': self.reason,
            'failed_module_id': self.failed_module_id,
            'total_attempts_made': self.total_attempts_made,
            'can_appeal': self.can_appeal,
            'appeal_deadline': self.appeal_deadline.isoformat() if self.appeal_deadline else None,
            'appeal_submitted': self.appeal_submitted,
            'appeal_text': self.appeal_text,
            'appeal_submitted_at': self.appeal_submitted_at.isoformat() if self.appeal_submitted_at else None,
            'review_status': self.review_status,
            'reviewed_by': self.reviewed_by,
            'reviewed_at': self.reviewed_at.isoformat() if self.reviewed_at else None,
            'review_notes': self.review_notes,
            'reinstated': self.reinstated,
            'reinstated_at': self.reinstated_at.isoformat() if self.reinstated_at else None,
            'additional_attempts_granted': self.additional_attempts_granted,
            'can_submit_appeal': self.can_submit_appeal(),
            'course_title': self.course.title if self.course else None,
            'failed_module_title': self.failed_module.title if self.failed_module else None,
            'student_name': f"{self.student.first_name} {self.student.last_name}" if self.student else None
        }