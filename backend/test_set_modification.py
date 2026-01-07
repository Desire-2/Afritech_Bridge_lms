#!/usr/bin/env python3

"""
Test script to set modification request on an assignment
"""

import sys
import os
from datetime import datetime
from sqlalchemy import text

# Add the backend directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from main import app, db
from src.models.course_models import Assignment

def set_modification_request(assignment_id, reason="Please improve your work and add more details"):
    """Set modification request on a specific assignment"""
    
    with app.app_context():
        try:
            # Find the assignment
            assignment = Assignment.query.get(assignment_id)
            if not assignment:
                print(f"❌ Assignment with ID {assignment_id} not found")
                return False
            
            # Set modification request fields
            assignment.modification_requested = True
            assignment.modification_request_reason = reason
            assignment.modification_requested_at = datetime.utcnow()
            assignment.can_resubmit = True
            
            # Commit changes
            db.session.commit()
            
            print(f"✅ Modification request set successfully on assignment '{assignment.title}'")
            print(f"   Reason: {reason}")
            print(f"   Requested at: {assignment.modification_requested_at}")
            return True
            
        except Exception as e:
            print(f"❌ Error setting modification request: {str(e)}")
            db.session.rollback()
            return False

def list_assignments():
    """List all assignments to help identify which one to modify"""
    
    with app.app_context():
        try:
            assignments = Assignment.query.all()
            if not assignments:
                print("❌ No assignments found in database")
                return
            
            print("\n📋 Available Assignments:")
            print("-" * 50)
            for assignment in assignments:
                print(f"ID: {assignment.id} | Title: {assignment.title}")
                print(f"   Course: {assignment.course.title if assignment.course else 'N/A'}")
                print(f"   Modification Requested: {assignment.modification_requested}")
                print("-" * 50)
                
        except Exception as e:
            print(f"❌ Error listing assignments: {str(e)}")

if __name__ == "__main__":
    print("🔧 Assignment Modification Request Tool")
    print("=" * 50)
    
    if len(sys.argv) > 1:
        try:
            assignment_id = int(sys.argv[1])
            reason = sys.argv[2] if len(sys.argv) > 2 else "Please improve your work and add more details"
            set_modification_request(assignment_id, reason)
        except ValueError:
            print("❌ Please provide a valid assignment ID as the first argument")
    else:
        print("📋 Listing all assignments...")
        list_assignments()
        print("\n💡 Usage: python test_set_modification.py <assignment_id> [reason]")
        print("   Example: python test_set_modification.py 1 'Please add more references to your work'")