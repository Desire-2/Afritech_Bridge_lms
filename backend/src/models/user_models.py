# User Models for Afritec Bridge LMS

from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import datetime

# It's assumed that 'db' is initialized in main.py and passed around or imported.
# For now, we'll define a placeholder db instance. If your main app structure differs,
# this import will need to be adjusted.
# from src import db # Assuming db is initialized in src/__init__.py or main.py

# Placeholder for db until actual app structure is fully integrated
# In a real Flask app, db = SQLAlchemy() would be initialized in the main app file.
# For the purpose of this file, we'll assume 'db' will be available in the context it's used.
# We will define the models assuming 'db' is an SQLAlchemy instance.

db = SQLAlchemy() # This line is a placeholder for model definition purposes.
                 # It should be replaced with the actual db instance from the Flask app.

class Role(db.Model):
    __tablename__ = 'roles'
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(64), unique=True, nullable=False)
    users = db.relationship('User', backref='role', lazy='dynamic')

    def __repr__(self):
        return f'<Role {self.name}>'

class User(db.Model):
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    first_name = db.Column(db.String(50), nullable=True)
    last_name = db.Column(db.String(50), nullable=True)
    profile_picture_url = db.Column(db.String(255), nullable=True)
    bio = db.Column(db.Text, nullable=True)
    role_id = db.Column(db.Integer, db.ForeignKey('roles.id'), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Relationships (placeholders, to be expanded with other models)
    # enrollments = db.relationship('Enrollment', backref='student', lazy='dynamic')
    # submissions = db.relationship('Submission', backref='student', lazy='dynamic')
    # courses_authored = db.relationship('Course', backref='author', lazy='dynamic', foreign_keys='Course.instructor_id')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def __repr__(self):
        return f'<User {self.username}>'

    def to_dict(self):
        return {
            'id': self.id,
            'username': self.username,
            'email': self.email,
            'first_name': self.first_name,
            'last_name': self.last_name,
            'profile_picture_url': self.profile_picture_url,
            'bio': self.bio,
            'role': self.role.name if self.role else None,
            'created_at': self.created_at.isoformat(),
            'updated_at': self.updated_at.isoformat()
        }

