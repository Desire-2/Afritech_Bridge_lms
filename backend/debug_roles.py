#!/usr/bin/env python3
"""
Debug script to check user roles and create instructor users
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from src.models.user_models import db, User, Role

def check_users_and_roles():
    """Check existing users and their roles"""
    with app.app_context():
        print("🔍 Checking existing roles...")
        roles = Role.query.all()
        for role in roles:
            print(f"  Role: {role.name} (ID: {role.id})")
        
        print("\n🔍 Checking existing users...")
        users = User.query.all()
        for user in users:
            role_name = user.role.name if user.role else "No role"
            print(f"  User: {user.username} | Email: {user.email} | Role: {role_name}")
        
        # Check for instructor users specifically
        instructor_role = Role.query.filter_by(name='instructor').first()
        if instructor_role:
            instructors = User.query.filter_by(role_id=instructor_role.id).all()
            print(f"\n📚 Found {len(instructors)} instructor(s):")
            for instructor in instructors:
                print(f"  - {instructor.username} ({instructor.email})")
        else:
            print("\n❌ No instructor role found!")

def create_instructor_user():
    """Create a test instructor user"""
    with app.app_context():
        # Get or create instructor role
        instructor_role = Role.query.filter_by(name='instructor').first()
        if not instructor_role:
            print("❌ Instructor role not found. Creating it...")
            instructor_role = Role(name='instructor')
            db.session.add(instructor_role)
            db.session.commit()
            print("✅ Instructor role created.")
        
        # Check if instructor user already exists
        existing_instructor = User.query.filter_by(username='instructor_test').first()
        if existing_instructor:
            print(f"👤 Instructor user already exists: {existing_instructor.username}")
            # Update their role to make sure it's correct
            existing_instructor.role_id = instructor_role.id
            db.session.commit()
            print("✅ Updated existing user's role to instructor.")
            return existing_instructor
        
        # Create new instructor user
        from werkzeug.security import generate_password_hash
        
        instructor_user = User(
            username='instructor_test',
            email='instructor@test.com',
            password_hash=generate_password_hash('password123'),
            first_name='Test',
            last_name='Instructor',
            role_id=instructor_role.id
        )
        
        db.session.add(instructor_user)
        db.session.commit()
        
        print("✅ Created new instructor user:")
        print(f"  Username: instructor_test")
        print(f"  Email: instructor@test.com")
        print(f"  Password: password123")
        
        return instructor_user

def fix_existing_user_role(username):
    """Fix the role of an existing user to be instructor"""
    with app.app_context():
        user = User.query.filter_by(username=username).first()
        if not user:
            print(f"❌ User '{username}' not found.")
            return False
        
        instructor_role = Role.query.filter_by(name='instructor').first()
        if not instructor_role:
            print("❌ Instructor role not found.")
            return False
        
        user.role_id = instructor_role.id
        db.session.commit()
        
        print(f"✅ Updated user '{username}' to instructor role.")
        return True

if __name__ == "__main__":
    print("🔍 Debugging user roles for course management access...\n")
    
    # Check current state
    check_users_and_roles()
    
    print("\n" + "="*50)
    print("Options:")
    print("1. Create a test instructor user")
    print("2. Fix existing user role")
    print("3. Just show current state")
    
    choice = input("\nEnter your choice (1-3): ").strip()
    
    if choice == "1":
        create_instructor_user()
        print("\n📚 Updated state:")
        check_users_and_roles()
    elif choice == "2":
        username = input("Enter username to make instructor: ").strip()
        if fix_existing_user_role(username):
            print("\n📚 Updated state:")
            check_users_and_roles()
    elif choice == "3":
        print("\n✅ Current state shown above.")
    else:
        print("❌ Invalid choice.")