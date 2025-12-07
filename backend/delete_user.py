#!/usr/bin/env python3
"""Delete a user from the database"""
import sys
from main import app, db
from src.models.user_models import User

def delete_user(email):
    """Delete a user by email"""
    with app.app_context():
        user = User.query.filter_by(email=email).first()
        
        if not user:
            print(f"❌ User not found: {email}")
            return False
        
        print(f"Found user: {user.username} ({user.email})")
        print(f"Role: {user.role.name if user.role else 'No role'}")
        
        # Confirm deletion
        confirm = input(f"\n⚠️  Are you sure you want to delete {user.email}? (yes/no): ")
        if confirm.lower() != 'yes':
            print("❌ Deletion cancelled")
            return False
        
        try:
            db.session.delete(user)
            db.session.commit()
            print(f"✅ User deleted successfully: {email}")
            return True
        except Exception as e:
            db.session.rollback()
            print(f"❌ Error deleting user: {e}")
            return False

if __name__ == "__main__":
    if len(sys.argv) > 1:
        email = sys.argv[1]
    else:
        email = "afritechbridge@yahoo.com"
    
    delete_user(email)
