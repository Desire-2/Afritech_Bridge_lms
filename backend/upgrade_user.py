#!/usr/bin/env python3
"""
Quick script to help upgrade a user to instructor role or login as instructor
"""

import os
import sys
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from main import app
from src.models.user_models import db, User, Role

def upgrade_user_to_instructor():
    """Interactive script to upgrade any user to instructor"""
    with app.app_context():
        print("🔍 Available users:")
        users = User.query.all()
        
        for i, user in enumerate(users, 1):
            role_name = user.role.name if user.role else "No role"
            print(f"  {i}. {user.username} | {user.email} | Role: {role_name}")
        
        print(f"  {len(users) + 1}. Create new instructor user")
        
        try:
            choice = int(input(f"\nSelect user to make instructor (1-{len(users) + 1}): "))
            
            if choice == len(users) + 1:
                # Create new instructor user
                from werkzeug.security import generate_password_hash
                
                username = input("Enter username for new instructor: ").strip()
                email = input("Enter email for new instructor: ").strip()
                password = input("Enter password for new instructor: ").strip()
                
                instructor_role = Role.query.filter_by(name='instructor').first()
                
                new_user = User(
                    username=username,
                    email=email,
                    password_hash=generate_password_hash(password),
                    first_name='Instructor',
                    last_name='User',
                    role_id=instructor_role.id
                )
                
                db.session.add(new_user)
                db.session.commit()
                
                print(f"✅ Created new instructor user:")
                print(f"   Username: {username}")
                print(f"   Email: {email}")
                print(f"   Password: {password}")
                
            elif 1 <= choice <= len(users):
                selected_user = users[choice - 1]
                instructor_role = Role.query.filter_by(name='instructor').first()
                
                if not instructor_role:
                    print("❌ Instructor role not found!")
                    return
                
                selected_user.role_id = instructor_role.id
                db.session.commit()
                
                print(f"✅ Upgraded user '{selected_user.username}' to instructor role!")
                print(f"   Username: {selected_user.username}")
                print(f"   Email: {selected_user.email}")
                
            else:
                print("❌ Invalid choice.")
                
        except ValueError:
            print("❌ Please enter a valid number.")
        except Exception as e:
            print(f"❌ Error: {e}")

if __name__ == "__main__":
    print("👤 User Role Management Tool")
    print("=" * 40)
    upgrade_user_to_instructor()