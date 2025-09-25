#!/usr/bin/env python3
"""
Script to create an instructor user for Afritec Bridge LMS
"""
import os
import sys
from datetime import datetime
from werkzeug.security import generate_password_hash

# Add the parent directory to the path so we can import from the app
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

# Import Flask application and models
from main import app, db
from src.models.user_models import User, Role

def create_instructor():
    """Create an instructor user in the database"""
    with app.app_context():
        # Check if the instructor role exists, create if not
        instructor_role = Role.query.filter_by(name='instructor').first()
        if not instructor_role:
            instructor_role = Role(name='instructor')
            db.session.add(instructor_role)
            db.session.commit()
            print("Created instructor role")
        
        # Define instructor details
        username = "instructor"
        email = "instructor@afritecbridge.com"
        password = "Instructor@123"  # Default password, should be changed after first login
        first_name = "John"
        last_name = "Doe"
        
        # Check if user already exists
        existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing_user:
            print(f"User already exists: {existing_user.username} ({existing_user.email})")
            return
        
        # Create new instructor user
        new_instructor = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role_id=instructor_role.id,
            password_hash=generate_password_hash(password),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Add to database
        db.session.add(new_instructor)
        db.session.commit()
        
        print(f"Instructor user created successfully!")
        print(f"Username: {username}")
        print(f"Email: {email}")
        print(f"Password: {password}")
        print("Please change the password after first login.")

if __name__ == '__main__':
    create_instructor()