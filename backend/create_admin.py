#!/usr/bin/env python3
"""
Script to create an admin user for Afritec Bridge LMS
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

def create_admin():
    """Create an admin user in the database"""
    with app.app_context():
        # Check if the admin role exists, create if not
        admin_role = Role.query.filter_by(name='admin').first()
        if not admin_role:
            admin_role = Role(name='admin')
            db.session.add(admin_role)
            db.session.commit()
            print("Created admin role")
        
        # Define admin details
        username = "admin"
        email = "admin@afritecbridge.com"
        password = "Admin@123"  # Default password, should be changed after first login
        first_name = "Admin"
        last_name = "User"
        
        # Check if user already exists
        existing_user = User.query.filter((User.username == username) | (User.email == email)).first()
        if existing_user:
            print(f"User already exists: {existing_user.username} ({existing_user.email})")
            return
        
        # Create new admin user
        new_admin = User(
            username=username,
            email=email,
            first_name=first_name,
            last_name=last_name,
            role_id=admin_role.id,
            password_hash=generate_password_hash(password),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow()
        )
        
        # Add to database
        db.session.add(new_admin)
        db.session.commit()
        
        print(f"Admin user created successfully!")
        print(f"Username: {username}")
        print(f"Email: {email}")
        print(f"Password: {password}")

if __name__ == "__main__":
    create_admin()