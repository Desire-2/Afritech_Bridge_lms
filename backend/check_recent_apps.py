#!/usr/bin/env python3
"""
Check if emails were actually sent for recent applications
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from main import app as flask_app, db
from src.models.course_application import CourseApplication
from sqlalchemy import desc

def check_recent_applications():
    """Check the most recent applications"""
    
    with flask_app.app_context():
        print("="*70)
        print("  RECENT APPLICATIONS CHECK")
        print("="*70)
        
        # Get last 5 applications
        recent_apps = CourseApplication.query.order_by(
            desc(CourseApplication.created_at)
        ).limit(5).all()
        
        if not recent_apps:
            print("\n❌ No applications found")
            return
        
        print(f"\n📋 Found {len(recent_apps)} recent applications:\n")
        
        for app in recent_apps:
            print(f"Application #{app.id}")
            print(f"  Email: {app.email}")
            print(f"  Created: {app.created_at}")
            print(f"  Status: {app.status}")
            print(f"  Course ID: {app.course_id}")
            print()
        
        # Now test sending email to the most recent one
        latest_app = recent_apps[0]
        print(f"🧪 Testing email for application #{latest_app.id}...")
        
        from src.models.course_models import Course
        from src.utils.email_templates import application_received_email
        from src.utils.email_utils import send_email
        
        try:
            course = Course.query.get(latest_app.course_id)
            course_title = course.title if course else "our course"
            
            print(f"   Course: {course_title}")
            print(f"   Recipient: {latest_app.email}")
            
            email_html = application_received_email(latest_app, course_title)
            print(f"   Template: {len(email_html)} characters")
            
            email_sent = send_email(
                to=latest_app.email,
                subject=f"✅ Application Received - {course_title}",
                template=email_html
            )
            
            if email_sent:
                print(f"\n✅ Email can be sent successfully!")
            else:
                print(f"\n❌ Email failed to send!")
                
        except Exception as e:
            print(f"\n❌ Error: {str(e)}")
            import traceback
            traceback.print_exc()

if __name__ == "__main__":
    check_recent_applications()
